// rankingService.js - Cálculo de pontuação individual para Ranking SRB
// Win: +3 | Loss: +1 | WO: 0

const db = require('../database');

/**
 * Obtém a classificação individual de uma categoria
 * @param {number} id_tournament - ID do torneio
 * @param {number} id_category - ID da categoria
 * @returns {Promise<Array>} Array ordenado de jogadores com pontos
 */
async function getStandings(id_tournament, id_category) {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT
        p.id_player,
        p.name,
        p.side,
        COALESCE(SUM(CASE
          WHEN (d.id_double = m.id_double_a AND m.games_double_a > m.games_double_b)
            OR (d.id_double = m.id_double_b AND m.games_double_b > m.games_double_a)
          THEN 3
          WHEN (d.id_double = m.id_double_a AND m.games_double_a < m.games_double_b)
            OR (d.id_double = m.id_double_b AND m.games_double_b < m.games_double_a)
          THEN 1
          ELSE 0
        END), 0) as points,
        COUNT(CASE WHEN m.status = 'FINISHED' THEN 1 END) as matches_played,
        COUNT(CASE WHEN
          (d.id_double = m.id_double_a AND m.games_double_a > m.games_double_b)
          OR (d.id_double = m.id_double_b AND m.games_double_b > m.games_double_a)
          THEN 1
        END) as wins,
        COUNT(CASE WHEN
          (d.id_double = m.id_double_a AND m.games_double_a < m.games_double_b)
          OR (d.id_double = m.id_double_b AND m.games_double_b < m.games_double_a)
          THEN 1
        END) as losses,
        COUNT(CASE WHEN
          (m.games_double_a = 0 AND m.games_double_b = 0 AND m.status = 'FINISHED')
          THEN 1
        END) as walkover
      FROM players p
      JOIN doubles d ON p.id_player IN (d.id_player1, d.id_player2)
      LEFT JOIN matches m ON (d.id_double = m.id_double_a OR d.id_double = m.id_double_b)
        AND m.id_tournament = ?
        AND m.status = 'FINISHED'
      WHERE p.id_tournament = ?
        AND p.category_id = ?
      GROUP BY p.id_player, p.name, p.side
      ORDER BY points DESC, wins DESC, matches_played DESC
    `;

    db.all(query, [id_tournament, id_tournament, id_category], (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

/**
 * Obtém líderes por lado (DIREITA e ESQUERDA) de uma categoria
 * @param {number} id_tournament - ID do torneio
 * @param {number} id_category - ID da categoria
 * @returns {Promise<Object>} { direita: player, esquerda: player }
 */
async function getLeadersByHand(id_tournament, id_category) {
  return new Promise((resolve, reject) => {
    const query = `
      WITH player_points AS (
        SELECT
          p.id_player,
          p.name,
          p.side,
          COALESCE(SUM(CASE
            WHEN (d.id_double = m.id_double_a AND m.games_double_a > m.games_double_b)
              OR (d.id_double = m.id_double_b AND m.games_double_b > m.games_double_a)
            THEN 3
            WHEN (d.id_double = m.id_double_a AND m.games_double_a < m.games_double_b)
              OR (d.id_double = m.id_double_b AND m.games_double_b < m.games_double_a)
            THEN 1
            ELSE 0
          END), 0) as points
        FROM players p
        JOIN doubles d ON p.id_player IN (d.id_player1, d.id_player2)
        LEFT JOIN matches m ON (d.id_double = m.id_double_a OR d.id_double = m.id_double_b)
          AND m.id_tournament = ?
          AND m.status = 'FINISHED'
        WHERE p.id_tournament = ?
          AND p.category_id = ?
        GROUP BY p.id_player, p.name, p.side
      )
      SELECT
        side,
        name,
        points,
        id_player
      FROM (
        SELECT
          side,
          name,
          points,
          id_player,
          ROW_NUMBER() OVER (PARTITION BY side ORDER BY points DESC) as rn
        FROM player_points
        WHERE side IN ('RIGHT', 'LEFT')
      ) ranked
      WHERE rn = 1
    `;

    db.all(query, [id_tournament, id_tournament, id_category], (err, rows) => {
      if (err) reject(err);
      else {
        const result = { direita: null, esquerda: null };
        rows?.forEach(row => {
          if (row.side === 'RIGHT') result.direita = row;
          if (row.side === 'LEFT') result.esquerda = row;
        });
        resolve(result);
      }
    });
  });
}

/**
 * Obtém classificação de todas as categorias de um torneio
 * @param {number} id_tournament - ID do torneio
 * @returns {Promise<Object>} Classificações agrupadas por categoria
 */
async function getAllCategoryStandings(id_tournament) {
  return new Promise((resolve, reject) => {
    const categoriesQuery = `
      SELECT DISTINCT id_category
      FROM players
      WHERE id_tournament = ?
      ORDER BY id_category
    `;

    db.all(categoriesQuery, [id_tournament], async (err, categories) => {
      if (err) return reject(err);

      try {
        const standings = {};
        for (const cat of categories || []) {
          standings[cat.id_category] = await getStandings(id_tournament, cat.id_category);
        }
        resolve(standings);
      } catch (e) {
        reject(e);
      }
    });
  });
}

module.exports = {
  getStandings,
  getLeadersByHand,
  getAllCategoryStandings
};
