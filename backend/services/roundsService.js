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
 * @returns {Promise<Object>} { status, rounds_created, total_matches }
 */
async function gerarRodas(id_tournament, id_category, startDate) {
  return new Promise((resolve, reject) => {
    // 1. Busca todos os jogadores da categoria
    const playersQuery = `
      SELECT id_player, name, side
      FROM players
      WHERE id_tournament = ? AND category_id = ?
      ORDER BY id_player
    `;

    db.all(playersQuery, [id_tournament, id_category], (err, players) => {
      if (err) return reject(err);

      if (!players || players.length < 2) {
        return reject(new Error('Mínimo 2 jogadores necessário'));
      }

      const playerIds = players.map(p => p.id_player);

      // 2. Gera rodadas com algoritmo Berger
      const bergerRounds = generateBergerRounds(playerIds);

      if (bergerRounds.length === 0) {
        return reject(new Error('Erro ao gerar rodadas'));
      }

      // 3. Cria registros de rounds no banco
      let roundsCreated = 0;
      let doublesCreated = 0;
      let currentDate = new Date(startDate);

      const insertRoundQuery = `
        INSERT INTO rounds (id_tournament, id_category, round_number, scheduled_date, window_start, window_end, status)
        VALUES (?, ?, ?, ?, '18:00', '23:00', 'PENDING')
      `;

      const insertDoubleQuery = `
        INSERT INTO doubles (id_tournament, id_player1, id_player2, display_name, id_round)
        VALUES (?, ?, ?, ?, ?)
      `;

      let roundCounter = 0;

      bergerRounds.forEach((roundPairs, roundIndex) => {
        db.run(insertRoundQuery, [id_tournament, id_category, roundIndex + 1, currentDate], function(err) {
          if (err) return reject(err);

          const roundId = this.lastID;
          roundsCreated++;

          // Insere duplas desta rodada
          roundPairs.forEach(pair => {
            const displayName = `${players.find(p => p.id_player === pair.player1).name} / ${players.find(p => p.id_player === pair.player2).name}`;

            db.run(insertDoubleQuery, [id_tournament, pair.player1, pair.player2, displayName, roundId], (err) => {
              if (err) return reject(err);
              doublesCreated++;
            });
          });

          // Avança para próxima quinta-feira
          currentDate.setDate(currentDate.getDate() + 7);
        });
      });

      setTimeout(() => {
        resolve({
          status: 'success',
          rounds_created: roundsCreated,
          doubles_created: doublesCreated,
          total_rounds: bergerRounds.length
        });
      }, 500);
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
  return new Promise((resolve, reject) => {
    const query = `
      SELECT
        r.id_round,
        r.round_number,
        r.scheduled_date,
        r.window_start,
        r.window_end,
        r.status,
        COUNT(d.id_double) as total_doubles
      FROM rounds r
      LEFT JOIN doubles d ON d.id_round = r.id_round
      WHERE r.id_tournament = ? AND r.id_category = ?
      GROUP BY r.id_round, r.round_number, r.scheduled_date
      ORDER BY r.round_number ASC
    `;

    db.all(query, [id_tournament, id_category], (err, rounds) => {
      if (err) return reject(err);

      // Para cada rodada, busca as duplas
      if (!rounds || rounds.length === 0) {
        return resolve([]);
      }

      const result = [];
      let processed = 0;

      rounds.forEach(round => {
        const doublesQuery = `
          SELECT id_double, id_player1, id_player2, display_name
          FROM doubles
          WHERE id_round = ?
          ORDER BY id_double
        `;

        db.all(doublesQuery, [round.id_round], (err, doubles) => {
          if (err) return reject(err);

          result.push({
            ...round,
            doubles: doubles || []
          });

          processed++;
          if (processed === rounds.length) {
            resolve(result.sort((a, b) => a.round_number - b.round_number));
          }
        });
      });
    });
  });
}

/**
 * Obtém próximas rodadas não iniciadas
 * @param {number} id_tournament - ID do torneio
 * @returns {Promise<Array>} Próximas rodadas com status
 */
async function getProximasRodadas(id_tournament) {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT
        r.id_round,
        r.round_number,
        r.id_category,
        r.scheduled_date,
        r.status,
        COUNT(d.id_double) as total_doubles
      FROM rounds r
      LEFT JOIN doubles d ON d.id_round = r.id_round
      WHERE r.id_tournament = ? AND r.status IN ('PENDING', 'IN_PROGRESS')
      GROUP BY r.id_round
      ORDER BY r.scheduled_date ASC
      LIMIT 5
    `;

    db.all(query, [id_tournament], (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
}

module.exports = {
  gerarRodas,
  getCalendario,
  getProximasRodadas,
  generateBergerRounds // export para testes
};
