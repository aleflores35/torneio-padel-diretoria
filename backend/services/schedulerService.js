const db = require('../database');

const agendarJogos = (id_tournament) => {
  return new Promise((resolve, reject) => {
    // Buscar todas as pecas do quebra-cabeca
    const queries = {
      tournament: 'SELECT * FROM tournaments WHERE id_tournament = ?',
      courts: 'SELECT * FROM courts WHERE id_tournament = ? ORDER BY order_index ASC',
      matches: 'SELECT * FROM matches WHERE id_tournament = ? AND status = "TO_PLAY" ORDER BY stage DESC' // Inicia com GROUP
    };

    db.get(queries.tournament, [id_tournament], (err, tournament) => {
      if (err) return reject(err);
      
      db.all(queries.courts, [id_tournament], (err, courts) => {
        if (err) return reject(err);
        
        db.all(queries.matches, [id_tournament], (err, matches) => {
          if (err) return reject(err);

          if (matches.length === 0) return resolve({ status: 'no_matches' });

          const MIN_REST = 30; // Minutos
          const GAME_DURATION = 30; // Minutos para jogos até 6 games
          const SLOT_DURATION = 35; // Fluxo mais rápido
          
          let currentTime = new Date(`${tournament.start_date}T09:00:00`);
          const doubleLastEnding = {}; // { id_double: datetime }
          const scheduledMatches = [];

          // Agrupando por stage
          const stages = ['GROUP', 'QUARTERFINAL', 'SEMIFINAL', 'FINAL'];
          
          stages.forEach(stage => {
            const stageMatches = matches.filter(m => m.stage === stage);
            
            while (stageMatches.length > 0) {
              // Buscar matches que podem ser jogadas agora (respeitando descanso)
              let matchesScheduledInCurrentSlot = 0;

              for (let court of courts) {
                if (stageMatches.length === 0) break;

                // Tentar encontrar uma match que respeite o descanso de ambas as duplas
                const eligibleIdx = stageMatches.findIndex(m => {
                  const lastA = doubleLastEnding[m.id_double_a] || null;
                  const lastB = doubleLastEnding[m.id_double_b] || null;
                  
                  const canA = !lastA || (currentTime.getTime() >= (new Date(lastA).getTime() + (MIN_REST * 60000)));
                  const canB = !lastB || (currentTime.getTime() >= (new Date(lastB).getTime() + (MIN_REST * 60000)));
                  
                  return canA && canB;
                });

                if (eligibleIdx !== -1) {
                  const match = stageMatches.splice(eligibleIdx, 1)[0];
                  match.id_court = court.id_court;
                  match.scheduled_at = currentTime.toISOString();
                  match.planned_duration_min = GAME_DURATION;
                  
                  // Atualizar fim da partida para ambas as duplas
                  const endTime = new Date(currentTime.getTime() + (GAME_DURATION * 60000));
                  doubleLastEnding[match.id_double_a] = endTime.toISOString();
                  doubleLastEnding[match.id_double_b] = endTime.toISOString();
                  
                  scheduledMatches.push(match);
                  matchesScheduledInCurrentSlot++;
                }
              }

              // Avancar o tempo sempre que terminarmos uma rodada nas quadras
              // Mesmo que algumas quadras fiquem vazias por falta de duplas descansadas
              currentTime = new Date(currentTime.getTime() + (SLOT_DURATION * 60000));
            }
          });

          // Persistir no banco
          db.serialize(() => {
            const stmt = db.prepare('UPDATE matches SET id_court = ?, scheduled_at = ?, planned_duration_min = ? WHERE id_match = ?');
            scheduledMatches.forEach(m => {
              stmt.run([m.id_court, m.scheduled_at, m.planned_duration_min, m.id_match]);
            });
            stmt.finalize((err) => {
              if (err) reject(err);
              else resolve({ status: 'scheduled', count: scheduledMatches.length });
            });
          });
        });
      });
    });
  });
};

/**
 * Agenda matches de uma rodada (Ranking SRB) - VERSÃO SIMPLIFICADA
 * - 1 única quadra de vidro
 * - Janela quinta 18h-23h (5 horas)
 * - **CRITICAL**: Max 1 jogo por pessoa por dia (quinta-feira)
 * - Se não cabe na janela, adia para próxima quinta-feira
 */
const agendarRodada = (id_round) => {
  return new Promise((resolve, reject) => {
    // 1. Buscar rodada + torneio + quadra
    db.get('SELECT * FROM rounds WHERE id_round = ?', [id_round], (err, round) => {
      if (err) return reject(err);
      if (!round) return reject(new Error('Rodada não encontrada'));

      db.get(
        'SELECT c.* FROM courts c WHERE c.id_tournament = (SELECT id_tournament FROM rounds WHERE id_round = ?) LIMIT 1',
        [id_round],
        (err, court) => {
          if (err) return reject(err);
          if (!court) return reject(new Error('Quadra não encontrada'));

          // 2. Buscar matches TO_PLAY desta rodada com suas duplas
          db.all(
            `SELECT m.id_match, m.id_double_a, m.id_double_b
             FROM matches m
             WHERE m.id_tournament = (SELECT id_tournament FROM rounds WHERE id_round = ?)
             AND m.id_double_a IN (SELECT id_double FROM doubles WHERE id_round = ?)
             AND m.id_double_b IN (SELECT id_double FROM doubles WHERE id_round = ?)
             AND m.status = 'TO_PLAY'
             ORDER BY m.id_match ASC`,
            [id_round, id_round, id_round],
            (err, matches) => {
              if (err) return reject(err);

              if (matches.length === 0) {
                return resolve({ status: 'no_matches', round_id: id_round });
              }

              const MATCH_DURATION = 55;
              const BUFFER = 5;
              const SLOT_DURATION = MATCH_DURATION + BUFFER;

              const [startHour, startMin] = round.window_start.split(':').map(Number);
              let currentTime = new Date(round.scheduled_date);
              currentTime.setHours(startHour, startMin, 0, 0);

              const windowEndTime = new Date(currentTime);
              const [endHour, endMin] = round.window_end.split(':').map(Number);
              windowEndTime.setHours(endHour, endMin, 0, 0);

              const scheduledMatches = [];
              let processed = 0;

              // 3. Para cada match, valida e agenda
              matches.forEach((match) => {
                // Busca jogadores das duas duplas
                db.get('SELECT id_player1, id_player2 FROM doubles WHERE id_double = ?', [match.id_double_a], (err, d1) => {
                  if (err) return reject(err);

                  db.get('SELECT id_player1, id_player2 FROM doubles WHERE id_double = ?', [match.id_double_b], (err, d2) => {
                    if (err) return reject(err);

                    // Todos os 4 jogadores do match
                    const allPlayers = [d1.id_player1, d1.id_player2, d2.id_player1, d2.id_player2];
                    const dateStr = currentTime.toISOString().split('T')[0];

                    // Helper: verifica se um jogador tem match neste dia
                    const hasPlayerConflict = (playerId, cb) => {
                      db.get(
                        `SELECT COUNT(*) as cnt FROM matches m
                         WHERE (m.id_double_a IN (SELECT id_double FROM doubles WHERE id_player1 = ? OR id_player2 = ?)
                                OR m.id_double_b IN (SELECT id_double FROM doubles WHERE id_player1 = ? OR id_player2 = ?))
                         AND DATE(m.scheduled_at) = ?
                         AND m.status IN ('CALLING', 'IN_PROGRESS', 'SCHEDULED')`,
                        [playerId, playerId, playerId, playerId, dateStr],
                        (err, result) => {
                          if (err) return cb(err);
                          cb(null, result.cnt > 0);
                        }
                      );
                    };

                    // Verifica todos os 4 jogadores em paralelo
                    let conflictCount = 0;
                    let checksDone = 0;

                    allPlayers.forEach((playerId) => {
                      hasPlayerConflict(playerId, (err, hasConflict) => {
                        if (err) return reject(err);
                        if (hasConflict) conflictCount++;
                        checksDone++;

                        if (checksDone === 4) {
                          // Todos os checks terminados
                          if (conflictCount === 0 && currentTime.getTime() + (MATCH_DURATION * 60000) <= windowEndTime.getTime()) {
                            // Pode agendar neste horário
                            match.id_court = court.id_court;
                            match.scheduled_at = currentTime.toISOString();
                            match.planned_duration_min = MATCH_DURATION;
                            scheduledMatches.push(match);

                            currentTime = new Date(currentTime.getTime() + (SLOT_DURATION * 60000));
                          }

                          processed++;
                          if (processed === matches.length) {
                            // 4. Persiste no banco
                            db.serialize(() => {
                              const stmt = db.prepare('UPDATE matches SET id_court = ?, scheduled_at = ?, planned_duration_min = ? WHERE id_match = ?');
                              scheduledMatches.forEach(m => {
                                stmt.run([m.id_court, m.scheduled_at, m.planned_duration_min, m.id_match]);
                              });
                              stmt.finalize((err) => {
                                if (err) return reject(err);

                                db.run('UPDATE rounds SET status = ? WHERE id_round = ?', ['IN_PROGRESS', id_round], (err) => {
                                  if (err) return reject(err);
                                  resolve({
                                    status: 'scheduled',
                                    round_id: id_round,
                                    matches_scheduled: scheduledMatches.length,
                                    matches_unscheduled: matches.length - scheduledMatches.length
                                  });
                                });
                              });
                            });
                          }
                        }
                      });
                    });
                  });
                });
              });
            }
          );
        }
      );
    });
  });
};

module.exports = { agendarJogos, agendarRodada };
