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
 * Agenda matches de uma rodada (Ranking SRB)
 * - 1 única quadra de vidro
 * - Janela quinta 18h-23h (5 horas = ~5 jogos de ~50min)
 * - Matches sequenciais sem verificação de descanso
 */
const agendarRodada = (id_round) => {
  return new Promise((resolve, reject) => {
    const queries = {
      round: 'SELECT * FROM rounds WHERE id_round = ?',
      tournament: `
        SELECT t.* FROM tournaments t
        WHERE t.id_tournament = (SELECT id_tournament FROM rounds WHERE id_round = ?)
      `,
      court: `
        SELECT c.* FROM courts c
        WHERE c.id_tournament = (SELECT id_tournament FROM rounds WHERE id_round = ?)
        LIMIT 1
      `,
      matches: `
        SELECT m.* FROM matches m
        JOIN doubles d ON d.id_double = m.id_double_a OR d.id_double = m.id_double_b
        WHERE d.id_round = ? AND m.status = 'TO_PLAY'
        ORDER BY m.id_match ASC
      `
    };

    db.get(queries.round, [id_round], (err, round) => {
      if (err) return reject(err);
      if (!round) return reject(new Error('Rodada não encontrada'));

      db.get(queries.tournament, [id_round], (err, tournament) => {
        if (err) return reject(err);

        db.get(queries.court, [id_round], (err, court) => {
          if (err) return reject(err);
          if (!court) return reject(new Error('Quadra não encontrada'));

          db.all(queries.matches, [id_round], (err, matches) => {
            if (err) return reject(err);

            if (matches.length === 0) {
              return resolve({ status: 'no_matches', round_id: id_round });
            }

            const MATCH_DURATION = 55; // Minutos (partida simples típica)
            const BUFFER = 5; // Minutos entre matches
            const SLOT_DURATION = MATCH_DURATION + BUFFER; // 60 min total por slot

            // Horário da rodada: quinta 18h (conforme round.window_start)
            const [startHour, startMin] = round.window_start.split(':').map(Number);
            let currentTime = new Date(round.scheduled_date);
            currentTime.setHours(startHour, startMin, 0, 0);

            const windowEndTime = new Date(currentTime);
            const [endHour, endMin] = round.window_end.split(':').map(Number);
            windowEndTime.setHours(endHour, endMin, 0, 0);

            const scheduledMatches = [];

            // Agenda matches sequencialmente até atingir fim da janela
            for (let match of matches) {
              if (currentTime.getTime() + (MATCH_DURATION * 60000) > windowEndTime.getTime()) {
                break; // Não cabe mais na janela
              }

              match.id_court = court.id_court;
              match.scheduled_at = currentTime.toISOString();
              match.planned_duration_min = MATCH_DURATION;
              scheduledMatches.push(match);

              // Próximo slot
              currentTime = new Date(currentTime.getTime() + (SLOT_DURATION * 60000));
            }

            // Persistir no banco
            db.serialize(() => {
              const stmt = db.prepare('UPDATE matches SET id_court = ?, scheduled_at = ?, planned_duration_min = ? WHERE id_match = ?');
              scheduledMatches.forEach(m => {
                stmt.run([m.id_court, m.scheduled_at, m.planned_duration_min, m.id_match]);
              });
              stmt.finalize((err) => {
                if (err) return reject(err);

                // Atualiza status da rodada para IN_PROGRESS
                db.run('UPDATE rounds SET status = ? WHERE id_round = ?', ['IN_PROGRESS', id_round], (err) => {
                  if (err) return reject(err);
                  resolve({
                    status: 'scheduled',
                    round_id: id_round,
                    matches_scheduled: scheduledMatches.length,
                    matches_pending: matches.length - scheduledMatches.length
                  });
                });
              });
            });
          });
        });
      });
    });
  });
};

module.exports = { agendarJogos, agendarRodada };
