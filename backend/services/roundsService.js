// roundsService.js - Geração de rodadas com algoritmo Berger (round-robin)
// Garante: nenhuma dupla (A,B) aparece mais de 1 vez, todos contra todos

const db = require('../database');

/**
 * Shuffle de array (Fisher-Yates)
 */
function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Algoritmo Berger para round-robin sem repetição de parceiros
 * Para N jogadores, gera N-1 rodadas onde nenhuma dupla (A,B) aparece 2x
 */
function generateBergerRounds(playerIds) {
  const n = playerIds.length;
  if (n < 2) return [];

  const rounds = [];
  const numRounds = n % 2 === 0 ? n - 1 : n;

  // Se N é ímpar, adiciona jogador "fantasma" (bye)
  let players = n % 2 === 0 ? [...playerIds] : [...playerIds, null];

  for (let round = 0; round < numRounds; round++) {
    const roundPairs = [];

    // Emparelha posições opostas: 0-N-1, 1-N-2, etc.
    for (let i = 0; i < players.length / 2; i++) {
      const p1 = players[i];
      const p2 = players[players.length - 1 - i];

      if (p1 !== null && p2 !== null) {
        roundPairs.push({ player1: p1, player2: p2 });
      }
    }

    rounds.push(roundPairs);

    // Rotaciona players para próxima rodada (fixa posição 0)
    if (round < numRounds - 1) {
      const first = players[0];
      const rest = players.slice(1);
      const last = rest.pop();
      players = [first, last, ...rest];
    }
  }

  return rounds;
}

/**
 * Gera todas as rodadas para uma categoria + cria doubles
 * @param {number} id_tournament - ID do torneio
 * @param {number} id_category - ID da categoria
 * @param {Date} startDate - Data de início (quinta-feira)
 * @returns {Promise<Object>} { status, rounds_created, doubles_created, total_rounds }
 */
async function gerarRodas(id_tournament, id_category, startDate) {
  return new Promise((resolve, reject) => {
    // 1. Busca todos os jogadores da categoria
    db.all(
      'SELECT * FROM players WHERE id_tournament = ? AND category_id = ? ORDER BY id_player',
      [id_tournament, id_category],
      (err, players) => {
      if (err) return reject(err);

      if (!players || players.length < 2) {
        return reject(new Error('Mínimo 2 jogadores necessário'));
      }

      const playerIds = players.map((p) => p.id_player);

      // 2. Gera rodadas com algoritmo Berger
      const bergerRounds = generateBergerRounds(playerIds);

      if (bergerRounds.length === 0) {
        return reject(new Error('Erro ao gerar rodadas'));
      }

      // 3. Cria registros de rounds no banco - usando Promises para await correto
      let roundsCreated = 0;
      let doublesCreated = 0;
      let currentDate = new Date(startDate);

      const insertRoundQuery = `
        INSERT INTO rounds (id_tournament, id_category, round_number, scheduled_date, window_start, window_end, status)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `;

      const insertDoubleQuery = `
        INSERT INTO doubles (id_tournament, id_player1, id_player2, display_name, id_round)
        VALUES (?, ?, ?, ?, ?)
      `;

      // Helper: wrap db.run em Promise
      const dbRun = (query, params) => new Promise((res, rej) => {
        db.run(query, params, function(err) {
          if (err) rej(err);
          else res(this.lastID);
        });
      });

      const insertMatchQuery = `
        INSERT INTO matches (id_tournament, id_double_a, id_double_b, status)
        VALUES (?, ?, ?, ?)
      `;

      let matchesCreated = 0;

      // Processa rodadas sequencialmente
      (async () => {
        try {
          for (let roundIndex = 0; roundIndex < bergerRounds.length; roundIndex++) {
            const roundPairs = bergerRounds[roundIndex];

            // Insere round e obtém seu ID
            const roundId = await dbRun(insertRoundQuery, [
              id_tournament,
              id_category,
              roundIndex + 1,
              currentDate.toISOString().split('T')[0], // YYYY-MM-DD format
              '18:00',
              '23:00',
              'PENDING'
            ]);
            roundsCreated++;

            // Insere todas as duplas desta rodada e coleta seus IDs
            const doubleIds = [];
            for (const pair of roundPairs) {
              const player1 = players.find(p => p.id_player === pair.player1);
              const player2 = players.find(p => p.id_player === pair.player2);
              const displayName = `${player1.name} / ${player2.name}`;

              const doubleId = await dbRun(insertDoubleQuery, [
                id_tournament,
                pair.player1,
                pair.player2,
                displayName,
                roundId
              ]);
              doubleIds.push(doubleId);
              doublesCreated++;
            }

            // Embaralha as duplas e cria matches (dupla A vs dupla B)
            // Ex: 5 duplas → 2 matches, 1 dupla fica de bye nesta rodada
            const shuffledDoubles = shuffle(doubleIds);
            for (let k = 0; k + 1 < shuffledDoubles.length; k += 2) {
              await dbRun(insertMatchQuery, [
                id_tournament,
                shuffledDoubles[k],
                shuffledDoubles[k + 1],
                'TO_PLAY'
              ]);
              matchesCreated++;
            }

            // Avança para próxima quinta-feira
            currentDate.setDate(currentDate.getDate() + 7);
          }

          // Todas as operações completadas
          resolve({
            status: 'success',
            rounds_created: roundsCreated,
            doubles_created: doublesCreated,
            matches_created: matchesCreated,
            total_rounds: bergerRounds.length
          });
        } catch (err) {
          reject(err);
        }
      })();
    });
  });
}

/**
 * Obtém calendário de rodadas de uma categoria
 * @param {number} id_tournament - ID do torneio
 * @param {number} id_category - ID da categoria
 * @returns {Promise<Array>} Rodadas com duplas do dia
 */
async function getCalendario(id_tournament, id_category) {
  const dbAll = (sql, params) => new Promise((res, rej) =>
    db.all(sql, params, (err, rows) => err ? rej(err) : res(rows || []))
  );

  // 1. Fetch rounds for this tournament+category
  const rounds = await dbAll(
    'SELECT * FROM rounds WHERE id_tournament = ? AND id_category = ? ORDER BY round_number',
    [id_tournament, id_category]
  );
  if (!rounds.length) return [];

  // 2. Fetch all doubles for this tournament and group by id_round
  const allDoubles = await dbAll(
    'SELECT * FROM doubles WHERE id_tournament = ? ORDER BY id_double',
    [id_tournament]
  );
  const doublesByRound = {};
  allDoubles.forEach(d => {
    if (!doublesByRound[d.id_round]) doublesByRound[d.id_round] = [];
    doublesByRound[d.id_round].push(d);
  });

  return rounds.map(r => ({
    id_round: r.id_round,
    round_number: r.round_number,
    scheduled_date: r.scheduled_date,
    window_start: r.window_start,
    window_end: r.window_end,
    status: r.status,
    doubles: doublesByRound[r.id_round] || [],
    total_doubles: (doublesByRound[r.id_round] || []).length
  }));
}

/**
 * Obtém próximas rodadas não iniciadas
 * @param {number} id_tournament - ID do torneio
 * @returns {Promise<Array>} Próximas rodadas com status
 */
async function getProximasRodadas(id_tournament) {
  const dbAll = (sql, params) => new Promise((res, rej) =>
    db.all(sql, params, (err, rows) => err ? rej(err) : res(rows || []))
  );

  // Fetch all rounds for this tournament, filter PENDING/IN_PROGRESS in JS, limit 5
  const rounds = await dbAll(
    'SELECT * FROM rounds WHERE id_tournament = ? ORDER BY scheduled_date',
    [id_tournament]
  );
  const pending = rounds.filter(r => r.status === 'PENDING' || r.status === 'IN_PROGRESS').slice(0, 5);

  // Count doubles per round from a single query
  const allDoubles = await dbAll(
    'SELECT * FROM doubles WHERE id_tournament = ?',
    [id_tournament]
  );
  const doubleCountByRound = {};
  allDoubles.forEach(d => {
    doubleCountByRound[d.id_round] = (doubleCountByRound[d.id_round] || 0) + 1;
  });

  return pending.map(r => ({
    id_round: r.id_round,
    round_number: r.round_number,
    id_category: r.id_category,
    scheduled_date: r.scheduled_date,
    status: r.status,
    total_doubles: doubleCountByRound[r.id_round] || 0
  }));
}

module.exports = {
  gerarRodas,
  getCalendario,
  getProximasRodadas,
  generateBergerRounds // export para testes
};
