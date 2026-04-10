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
 * - 1 única quadra
 * - Janela quinta 18h-23h (5 horas)
 * - Max 1 jogo por pessoa por dia (quinta-feira)
 * Uses simple queries compatible with supabaseAdapter
 */
const agendarRodada = async (id_round) => {
  const dbGet = (sql, params) => new Promise((res, rej) =>
    db.get(sql, params, (err, row) => err ? rej(err) : res(row))
  );
  const dbAll = (sql, params) => new Promise((res, rej) =>
    db.all(sql, params, (err, rows) => err ? rej(err) : res(rows || []))
  );
  const dbRun = (sql, params) => new Promise((res, rej) =>
    db.run(sql, params, function(err) { err ? rej(err) : res(this); })
  );

  // 1. Buscar rodada
  const round = await dbGet('SELECT * FROM rounds WHERE id_round = ?', [id_round]);
  if (!round) throw new Error('Rodada não encontrada');

  // Normalize to HH:MM (Supabase may return HH:MM:SS)
  const windowStart = (round.window_start || '18:00').substring(0, 5);
  const windowEnd   = (round.window_end   || '23:00').substring(0, 5);

  // 2-4. Buscar quadra, duplas e matches em paralelo
  const [courts, doubles, allMatches, allTournamentDoubles] = await Promise.all([
    dbAll('SELECT * FROM courts WHERE id_tournament = ?', [round.id_tournament]),
    dbAll('SELECT * FROM doubles WHERE id_round = ?', [id_round]),
    dbAll('SELECT * FROM matches WHERE id_tournament = ? AND status = ?', [round.id_tournament, 'TO_PLAY']),
    dbAll('SELECT * FROM doubles WHERE id_tournament = ?', [round.id_tournament]),
  ]);

  if (!courts.length) throw new Error('Quadra não encontrada para este torneio');
  const court = courts[0];

  if (!doubles.length) return { status: 'no_doubles', round_id: id_round };

  const doubleIds = doubles.map(d => d.id_double);
  const matches = allMatches.filter(m =>
    doubleIds.includes(m.id_double_a) && doubleIds.includes(m.id_double_b)
  );

  if (!matches.length) return { status: 'no_matches', round_id: id_round };

  // 5. Montar mapa de dupla → jogadores (usando todos os doubles do torneio para lookup)
  const allDoublesMap = {};
  allTournamentDoubles.forEach(d => { allDoublesMap[d.id_double] = d; });
  const doubleMap = {};
  doubles.forEach(d => { doubleMap[d.id_double] = [d.id_player1, d.id_player2]; });

  // 6. Configurar janela de tempo
  const MATCH_DURATION = 55;
  const SLOT_DURATION  = 60; // 55 + 5 buffer

  const [startH, startM] = windowStart.split(':').map(Number);
  const [endH,   endM  ] = windowEnd.split(':').map(Number);

  // Usar data da rodada no formato local para evitar problemas de timezone
  const dateStr = round.scheduled_date.substring(0, 10); // 'YYYY-MM-DD'
  let slotStart = new Date(`${dateStr}T${windowStart}:00`);
  const slotEnd  = new Date(`${dateStr}T${windowEnd}:00`);

  const scheduledMatches = [];
  // Conjunto de players já agendados neste dia (controle em memória + banco)
  const busyPlayers = new Set();

  // 7. Pré-carregar conflitos (matches já agendados nesta data) usando mapa em memória
  // allMatches já contém TO_PLAY do torneio; buscar também matches sem status específico
  const allTournamentMatches = await dbAll('SELECT * FROM matches WHERE id_tournament = ?', [round.id_tournament]);
  for (const em of allTournamentMatches) {
    if (em.scheduled_at && em.scheduled_at.startsWith(dateStr)) {
      const dA = allDoublesMap[em.id_double_a];
      const dB = allDoublesMap[em.id_double_b];
      if (dA) { busyPlayers.add(dA.id_player1); busyPlayers.add(dA.id_player2); }
      if (dB) { busyPlayers.add(dB.id_player1); busyPlayers.add(dB.id_player2); }
    }
  }

  // 8. Agendar matches sequencialmente no slot disponível
  for (const match of matches) {
    const players = [
      ...(doubleMap[match.id_double_a] || []),
      ...(doubleMap[match.id_double_b] || [])
    ].filter(Boolean);

    const hasConflict = players.some(p => busyPlayers.has(p));
    const fitsInWindow = (slotStart.getTime() + MATCH_DURATION * 60000) <= slotEnd.getTime();

    if (!hasConflict && fitsInWindow) {
      match.id_court = court.id_court;
      match.scheduled_at = `${dateStr}T${String(slotStart.getHours()).padStart(2,'0')}:${String(slotStart.getMinutes()).padStart(2,'0')}:00`;
      match.planned_duration_min = MATCH_DURATION;
      scheduledMatches.push(match);

      // Marca jogadores como ocupados neste dia
      players.forEach(p => busyPlayers.add(p));
      slotStart = new Date(slotStart.getTime() + SLOT_DURATION * 60000);
    }
  }

  // 9. Persiste matches agendados (status permanece TO_PLAY; scheduled_at indica agendamento)
  for (const m of scheduledMatches) {
    await dbRun(
      'UPDATE matches SET id_court = ?, scheduled_at = ?, planned_duration_min = ? WHERE id_match = ?',
      [m.id_court, m.scheduled_at, m.planned_duration_min, m.id_match]
    );
  }

  // 10. Atualiza status da rodada
  await dbRun('UPDATE rounds SET status = ? WHERE id_round = ?', ['IN_PROGRESS', id_round]);

  return {
    status: 'scheduled',
    round_id: id_round,
    date: dateStr,
    matches_scheduled: scheduledMatches.length,
    matches_unscheduled: matches.length - scheduledMatches.length,
    schedule: scheduledMatches.map(m => ({
      id_match: m.id_match,
      time: m.scheduled_at,
      double_a: m.id_double_a,
      double_b: m.id_double_b
    }))
  };
};

module.exports = { agendarJogos, agendarRodada };
