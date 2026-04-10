// rankingService.js - Cálculo de pontuação individual para Ranking SRB
// Win: +3 | Loss: +1 | WO: 0
// Rewritten with decomposed simple queries compatible with supabaseAdapter

const db = require('../database');

const dbAll = (sql, params) => new Promise((res, rej) =>
  db.all(sql, params, (err, rows) => err ? rej(err) : res(rows || []))
);

/**
 * Obtém a classificação individual de uma categoria
 * @param {number} id_tournament - ID do torneio
 * @param {number} id_category - ID da categoria
 * @returns {Promise<Array>} Array ordenado de jogadores com pontos
 */
async function getStandings(id_tournament, id_category) {
  // 1. Players in this category
  const players = await dbAll(
    'SELECT * FROM players WHERE id_tournament = ? AND category_id = ?',
    [id_tournament, id_category]
  );
  if (!players.length) return [];

  const playerIds = new Set(players.map(p => p.id_player));

  // 2. All doubles for this tournament — filter to category players in JS
  const allDoubles = await dbAll(
    'SELECT * FROM doubles WHERE id_tournament = ?',
    [id_tournament]
  );
  const categoryDoubles = allDoubles.filter(d =>
    playerIds.has(d.id_player1) || playerIds.has(d.id_player2)
  );
  const doubleIds = new Set(categoryDoubles.map(d => d.id_double));
  const doubleMap = {};
  categoryDoubles.forEach(d => { doubleMap[d.id_double] = d; });

  // 3. Finished matches for this tournament — filter to category doubles in JS
  const allMatches = await dbAll(
    'SELECT * FROM matches WHERE id_tournament = ? AND status = ?',
    [id_tournament, 'FINISHED']
  );
  const catMatches = allMatches.filter(m =>
    doubleIds.has(m.id_double_a) && doubleIds.has(m.id_double_b)
  );

  // 4. Aggregate points per player
  const stats = {};
  players.forEach(p => {
    stats[p.id_player] = { points: 0, wins: 0, losses: 0, walkovers: 0, matches_played: 0 };
  });

  for (const match of catMatches) {
    const dA = doubleMap[match.id_double_a];
    const dB = doubleMap[match.id_double_b];
    if (!dA || !dB) continue;

    const isWalkover = match.games_double_a === 0 && match.games_double_b === 0;
    const aWon = match.games_double_a > match.games_double_b;
    const bWon = match.games_double_b > match.games_double_a;

    const sides = [
      { players: [dA.id_player1, dA.id_player2], won: aWon, lost: bWon },
      { players: [dB.id_player1, dB.id_player2], won: bWon, lost: aWon }
    ];

    for (const side of sides) {
      for (const pid of side.players) {
        if (!pid || !stats[pid]) continue;
        stats[pid].matches_played++;
        if (isWalkover) {
          stats[pid].walkovers++;
        } else if (side.won) {
          stats[pid].wins++;
          stats[pid].points += 3;
        } else if (side.lost) {
          stats[pid].losses++;
          stats[pid].points += 1;
        }
      }
    }
  }

  return players.map(p => ({
    id_player: p.id_player,
    name: p.name,
    side: p.side,
    points: stats[p.id_player].points,
    wins: stats[p.id_player].wins,
    losses: stats[p.id_player].losses,
    walkovers: stats[p.id_player].walkovers,
    matches_played: stats[p.id_player].matches_played
  })).sort((a, b) =>
    b.points - a.points || b.wins - a.wins || b.matches_played - a.matches_played
  );
}

/**
 * Obtém líderes por lado (DIREITA e ESQUERDA) de uma categoria
 */
async function getLeadersByHand(id_tournament, id_category) {
  const standings = await getStandings(id_tournament, id_category);
  const result = { direita: null, esquerda: null };
  for (const p of standings) {
    if (p.side === 'RIGHT' && !result.direita) result.direita = p;
    if (p.side === 'LEFT' && !result.esquerda) result.esquerda = p;
    if (result.direita && result.esquerda) break;
  }
  return result;
}

/**
 * Obtém classificação de todas as categorias de um torneio
 */
async function getAllCategoryStandings(id_tournament) {
  // Get all players to discover which categories exist in this tournament
  const players = await dbAll(
    'SELECT * FROM players WHERE id_tournament = ?',
    [id_tournament]
  );
  const catIds = [...new Set(players.map(p => p.category_id).filter(Boolean))].sort();

  const standings = {};
  for (const catId of catIds) {
    standings[catId] = await getStandings(id_tournament, catId);
  }
  return standings;
}

module.exports = {
  getStandings,
  getLeadersByHand,
  getAllCategoryStandings
};
