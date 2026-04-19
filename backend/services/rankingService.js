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
  // Fetch players, doubles, and matches (FINISHED, WO, and IN_PROGRESS with valid score) in parallel
  const [players, allDoubles, finishedMatches, woMatches, inProgressMatches] = await Promise.all([
    dbAll('SELECT * FROM players WHERE id_tournament = ? AND category_id = ?', [id_tournament, id_category]),
    dbAll('SELECT * FROM doubles WHERE id_tournament = ?', [id_tournament]),
    dbAll('SELECT * FROM matches WHERE id_tournament = ? AND status = ?', [id_tournament, 'FINISHED']),
    dbAll('SELECT * FROM matches WHERE id_tournament = ? AND status = ?', [id_tournament, 'WO']),
    dbAll('SELECT * FROM matches WHERE id_tournament = ? AND status = ?', [id_tournament, 'IN_PROGRESS']),
  ]);
  if (!players.length) return [];

  // IN_PROGRESS only counts when a valid score exists (at least one side > 0, not tie)
  const scoredInProgress = inProgressMatches.filter(m => {
    const a = m.games_double_a ?? 0;
    const b = m.games_double_b ?? 0;
    return (a > 0 || b > 0) && a !== b;
  }).map(m => ({ ...m, status: 'FINISHED' })); // normalize to FINISHED semantics

  const allMatches = [...finishedMatches, ...woMatches, ...scoredInProgress];
  const playerIds = new Set(players.map(p => p.id_player));

  const categoryDoubles = allDoubles.filter(d =>
    playerIds.has(d.id_player1) || playerIds.has(d.id_player2)
  );
  const doubleIds = new Set(categoryDoubles.map(d => d.id_double));
  const doubleMap = {};
  categoryDoubles.forEach(d => { doubleMap[d.id_double] = d; });
  const catMatches = allMatches.filter(m =>
    doubleIds.has(m.id_double_a) && doubleIds.has(m.id_double_b)
  );

  // 4. Aggregate points per player
  const stats = {};
  players.forEach(p => {
    stats[p.id_player] = { points: 0, wins: 0, losses: 0, wos: 0, matches_played: 0, games_for: 0, games_against: 0 };
  });

  for (const match of catMatches) {
    const dA = doubleMap[match.id_double_a];
    const dB = doubleMap[match.id_double_b];
    if (!dA || !dB) continue;

    const absents = new Set(Array.isArray(match.absent_player_ids) ? match.absent_player_ids : []);
    const playersA = [dA.id_player1, dA.id_player2].filter(Boolean);
    const playersB = [dB.id_player1, dB.id_player2].filter(Boolean);
    const aAllAbsent = playersA.length > 0 && playersA.every(p => absents.has(p));
    const bAllAbsent = playersB.length > 0 && playersB.every(p => absents.has(p));

    const gamesA = match.games_double_a ?? 0;
    const gamesB = match.games_double_b ?? 0;
    const isFinishedWithScore = match.status === 'FINISHED' && (gamesA > 0 || gamesB > 0);

    if (isFinishedWithScore) {
      // Regra normal: vencedores +3, perdedores +1
      const aWon = gamesA > gamesB;
      const bWon = gamesB > gamesA;
      for (const pid of playersA) {
        if (!stats[pid]) continue;
        stats[pid].matches_played++;
        stats[pid].games_for += gamesA;
        stats[pid].games_against += gamesB;
        if (aWon) { stats[pid].wins++; stats[pid].points += 3; }
        else if (bWon) { stats[pid].losses++; stats[pid].points += 1; }
      }
      for (const pid of playersB) {
        if (!stats[pid]) continue;
        stats[pid].matches_played++;
        stats[pid].games_for += gamesB;
        stats[pid].games_against += gamesA;
        if (bWon) { stats[pid].wins++; stats[pid].points += 3; }
        else if (aWon) { stats[pid].losses++; stats[pid].points += 1; }
      }
    } else {
      // WO ou sem placar: regra individual
      // - Ausente: 0 pts (walkover)
      // - Se a dupla adversária inteira faltou: +3 (vitória por WO)
      // - Compareceu mas não jogou (parceiro do faltoso): +1
      for (const pid of playersA) {
        if (!stats[pid]) continue;
        stats[pid].matches_played++;
        if (absents.has(pid)) { stats[pid].wos++; }
        else if (bAllAbsent)  { stats[pid].wins++; stats[pid].points += 3; }
        else                  { stats[pid].points += 1; }
      }
      for (const pid of playersB) {
        if (!stats[pid]) continue;
        stats[pid].matches_played++;
        if (absents.has(pid)) { stats[pid].wos++; }
        else if (aAllAbsent)  { stats[pid].wins++; stats[pid].points += 3; }
        else                  { stats[pid].points += 1; }
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
    wos: stats[p.id_player].wos,
    matches_played: stats[p.id_player].matches_played,
    games_for: stats[p.id_player].games_for,
    games_against: stats[p.id_player].games_against,
    games_balance: stats[p.id_player].games_for - stats[p.id_player].games_against
  })).sort((a, b) =>
    b.points - a.points
    || b.wins - a.wins
    || b.games_balance - a.games_balance
    || a.losses - b.losses
    || a.wos - b.wos
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

  const results = await Promise.all(catIds.map(catId => getStandings(id_tournament, catId)));
  const standings = {};
  catIds.forEach((catId, i) => { standings[catId] = results[i]; });
  return standings;
}

module.exports = {
  getStandings,
  getLeadersByHand,
  getAllCategoryStandings
};
