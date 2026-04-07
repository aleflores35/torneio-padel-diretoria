const db = require('../database');

const duplasService = {
  /**
   * Sortear duplas para uma fase, garantindo que não se repitem
   * Respeita preferências de lado (RIGHT/LEFT/EITHER)
   * Todos jogam contra todos
   */
  sortearDuplasParaFase: (phaseId, athletes, callback) => {
    if (!athletes || athletes.length < 2) {
      return callback(new Error('Precisa de pelo menos 2 atletas'));
    }

    // Verificar duplas já sorteadas nesta fase
    db.all(
      'SELECT athlete1_id, athlete2_id FROM drawn_doubles WHERE phase_id = ?',
      [phaseId],
      (err, existingDoubles) => {
        if (err) return callback(err);

        const existingSet = new Set();
        (existingDoubles || []).forEach((d) => {
          existingSet.add(
            `${Math.min(d.athlete1_id, d.athlete2_id)}-${Math.max(d.athlete1_id, d.athlete2_id)}`
          );
        });

        // Gerar todas as possíveis duplas únicas que não existem
        const possibleDoubles = [];
        for (let i = 0; i < athletes.length; i++) {
          for (let j = i + 1; j < athletes.length; j++) {
            const key = `${Math.min(athletes[i].id, athletes[j].id)}-${Math.max(athletes[i].id, athletes[j].id)}`;
            if (!existingSet.has(key)) {
              possibleDoubles.push({
                athlete1: athletes[i],
                athlete2: athletes[j]
              });
            }
          }
        }

        if (possibleDoubles.length === 0) {
          return callback(new Error('Todas as combinações possíveis já foram sorteadas'));
        }

        // Embaralhar e pegar um subset
        const shuffled = duplasService._shuffleArray(possibleDoubles);
        const batchSize = Math.min(10, shuffled.length);
        const selectedDoubles = shuffled.slice(0, batchSize);

        // Registrar no banco as duplas sorteadas
        let completed = 0;
        const results = [];

        selectedDoubles.forEach((dupla) => {
          db.logDrawnDouble(phaseId, dupla.athlete1.id, dupla.athlete2.id, (err) => {
            if (err) console.error('Error logging drawn double:', err);
            results.push({
              athlete1_id: dupla.athlete1.id,
              athlete1_name: dupla.athlete1.name,
              athlete2_id: dupla.athlete2.id,
              athlete2_name: dupla.athlete2.name
            });
            completed++;
            if (completed === selectedDoubles.length) {
              callback(null, results);
            }
          });
        });
      }
    );
  },

  /**
   * Embaralhar array (Fisher-Yates)
   */
  _shuffleArray: (arr) => {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  },

  /**
   * Gerar chaves/groups a partir de duplas
   */
  gerarChaves: (duplas, numGroups, callback) => {
    const groups = Array.from({ length: numGroups }, () => []);
    let groupIndex = 0;

    duplas.forEach((dupla) => {
      groups[groupIndex].push(dupla);
      groupIndex = (groupIndex + 1) % numGroups;
    });

    callback(null, groups);
  },

  /**
   * Sortear duplas para uma rodada específica (Ranking SRB)
   * Garante que nenhum jogador seja parceiro de outro mais de 1 vez
   * @param {number} id_round - ID da rodada
   * @param {Function} callback - (err, { status, doubles_created })
   */
  sortearDuplasRodada: (id_round, callback) => {
    // 1. Buscar rodada e seus jogadores
    const getRoundQuery = `
      SELECT r.id_round, r.id_tournament, r.id_category, r.round_number
      FROM rounds r
      WHERE r.id_round = ?
    `;

    db.get(getRoundQuery, [id_round], (err, round) => {
      if (err) return callback(err);
      if (!round) return callback(new Error('Rodada não encontrada'));

      // 2. Buscar todos os jogadores da categoria
      const getPlayersQuery = `
        SELECT id_player, name, side
        FROM players
        WHERE id_tournament = ? AND category_id = ?
        ORDER BY id_player
      `;

      db.all(getPlayersQuery, [round.id_tournament, round.id_category], (err, players) => {
        if (err) return callback(err);

        if (!players || players.length < 2) {
          return callback(new Error('Mínimo 2 jogadores necessário'));
        }

        // 3. Buscar histórico de parceiros anteriores
        const getPartnerHistoryQuery = `
          SELECT DISTINCT
            CASE
              WHEN id_player1 = ? THEN id_player2
              ELSE id_player1
            END as partner_id
          FROM doubles
          WHERE (id_player1 = ? OR id_player2 = ?)
            AND id_round IS NOT NULL
            AND id_tournament = ?
        `;

        const partnerHistory = {};
        let playersProcessed = 0;

        players.forEach(player => {
          db.all(getPartnerHistoryQuery, [player.id_player, player.id_player, player.id_player, round.id_tournament], (err, partners) => {
            if (err) return callback(err);

            partnerHistory[player.id_player] = new Set((partners || []).map(p => p.partner_id));
            playersProcessed++;

            if (playersProcessed === players.length) {
              // 4. Gerar duplas válidas (sem repetição de parceiros)
              const validDoubles = [];
              for (let i = 0; i < players.length; i++) {
                for (let j = i + 1; j < players.length; j++) {
                  const p1 = players[i];
                  const p2 = players[j];

                  // Verificar se já foram parceiros
                  const p1_partners = partnerHistory[p1.id_player] || new Set();
                  const p2_partners = partnerHistory[p2.id_player] || new Set();

                  if (!p1_partners.has(p2.id_player) && !p2_partners.has(p1.id_player)) {
                    validDoubles.push({
                      id_player1: p1.id_player,
                      id_player2: p2.id_player,
                      display_name: `${p1.name} / ${p2.name}`
                    });
                  }
                }
              }

              if (validDoubles.length === 0) {
                return callback(new Error('Nenhuma dupla válida encontrada (todos já foram parceiros)'));
              }

              // 5. Embaralhar e inserir
              const shuffled = duplasService._shuffleArray(validDoubles);
              let inserted = 0;

              db.serialize(() => {
                const stmt = db.prepare(
                  'INSERT INTO doubles (id_tournament, id_player1, id_player2, display_name, id_round) VALUES (?, ?, ?, ?, ?)'
                );

                shuffled.forEach(dupla => {
                  stmt.run(
                    [round.id_tournament, dupla.id_player1, dupla.id_player2, dupla.display_name, id_round],
                    function(err) {
                      if (err) return callback(err);
                      inserted++;

                      if (inserted === shuffled.length) {
                        callback(null, {
                          status: 'success',
                          doubles_created: inserted,
                          round_id: id_round
                        });
                      }
                    }
                  );
                });

                stmt.finalize();
              });
            }
          });
        });
      });
    });
  }
};

module.exports = duplasService;
