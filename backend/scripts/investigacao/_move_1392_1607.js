// MOVE #1392 (Mariele/Francine x Michele/Sabrina) de 09/07 18:30 Vidro -> 16/07 21:10 Parede.
// Atende pedido da Mariele: 1 jogo por noite (ela tinha #1392+#1393 em 09/07; fica so #1393 19:10).
// 16/07 ja tem rodada feminina (round 436) -> nao precisa criar round. Move id_round das 2 duplas + scheduled_at + id_court.
// Verifica colisoes (mesmo horario por jogador / por quadra) em 09/07 (origem) e 16/07 (destino).
// DRY default; CONFIRM_EXECUTE=yes grava.
const supabase = require('../../supabase');
const CONFIRM = process.env.CONFIRM_EXECUTE === 'yes';
const TID = 7;
const ck = (r, w) => { if (r && r.error) { console.error('ERRO', w, r.error.message); process.exit(1); } };

const MOVE = { match:1392, dblA:3066, dblB:3067, round:436, at:'2026-07-16T21:10:00', court:17, label:'Mariele/Francine x Michele/Sabrina -> 16/07 21:10 Parede' };
const DATES = ['2026-07-09','2026-07-16'];

(async () => {
  if (!supabase) { console.error('SEM supabase'); process.exit(1); }
  const { data: rounds } = await supabase.from('rounds').select('id_round,scheduled_date,id_category').eq('id_tournament', TID);
  const rDate = {}; rounds.forEach(r => rDate[r.id_round] = r.scheduled_date);
  const { data: dbls } = await supabase.from('doubles').select('id_double,id_round,id_player1,id_player2,display_name').in('id_round', rounds.map(r=>r.id_round));
  const dMap = {}; dbls.forEach(d => dMap[d.id_double] = d);
  const { data: players } = await supabase.from('players').select('id_player,name').eq('id_tournament', TID);
  const pName = {}; players.forEach(p => pName[p.id_player] = p.name);
  const { data: courts } = await supabase.from('courts').select('id_court,name');
  const cName = {}; courts.forEach(c => cName[c.id_court] = c.name);
  const { data: matches } = await supabase.from('matches').select('id_match,id_double_a,id_double_b,id_court,scheduled_at').in('id_double_a', dbls.map(d=>d.id_double));

  const sim = matches.map(m => ({ ...m }));
  const dSim = {}; dbls.forEach(d => dSim[d.id_double] = { ...d });
  dSim[MOVE.dblA].id_round = MOVE.round; dSim[MOVE.dblB].id_round = MOVE.round;
  const mm = sim.find(m => m.id_match === MOVE.match);
  mm.scheduled_at = MOVE.at + '+00:00'; mm.id_court = MOVE.court;

  const dateOf = (m, useSim) => rDate[(useSim ? dSim : dMap)[m.id_double_a].id_round];
  const playersOf = (m) => [dMap[m.id_double_a], dMap[m.id_double_b]].flatMap(d => [d.id_player1, d.id_player2]).filter(Boolean);

  const m0 = matches.find(x => x.id_match === MOVE.match);
  console.log(`=== ANTES ===\n  #${MOVE.match}: ${dMap[m0.id_double_a].display_name} X ${dMap[m0.id_double_b].display_name}`);
  console.log(`     ${rDate[dMap[m0.id_double_a].id_round]} ${(m0.scheduled_at||'').slice(11,16)} ${cName[m0.id_court]}`);
  console.log(`=== DEPOIS (simulado) ===\n  #${MOVE.match}: ${MOVE.label}`);
  console.log(`     ${dateOf(mm,true)} ${(mm.scheduled_at||'').slice(11,16)} ${cName[mm.id_court]}`);

  console.log('\n=== VERIFICACAO (pos-move) ===');
  let problemas = 0;
  for (const date of DATES) {
    const daySim = sim.filter(m => dateOf(m, true) === date);
    console.log(`\n  ${date}: ${daySim.length} jogos`);
    const bySlot = {};
    for (const m of daySim) { const t=(m.scheduled_at||'').slice(11,16); (bySlot[t]=bySlot[t]||[]).push(m); }
    for (const t of Object.keys(bySlot).sort()) {
      const ms = bySlot[t];
      const courtsUsed = ms.map(m => m.id_court);
      const dupCourt = courtsUsed.length !== new Set(courtsUsed).size;
      const pls = ms.flatMap(playersOf);
      const dupPlayer = [...new Set(pls)].filter(p => pls.filter(x=>x===p).length > 1);
      if (dupCourt || dupPlayer.length) problemas++;
      console.log(`    ${t} (${ms.length} jogo/s, ${courtsUsed.map(c=>cName[c]).join('+')})${(dupCourt||dupPlayer.length)?' <<< COLISAO':''}`);
      if (dupPlayer.length) console.log(`       jogador 2x: ${dupPlayer.map(p=>pName[p]).join(', ')}`);
      if (dupCourt) console.log(`       quadra 2x no mesmo horario`);
    }
  }
  console.log(`\n  >>> colisoes: ${problemas}`);

  if (!CONFIRM) { console.log('\n>>> DRY-RUN: nada gravado <<<'); process.exit(0); }
  if (problemas > 0) { console.error('\n!!! ABORTADO: colisoes. Nao gravo. !!!'); process.exit(1); }

  console.log('\n--- GRAVANDO ---');
  let r = await supabase.from('doubles').update({ id_round: MOVE.round }).eq('id_double', MOVE.dblA); ck(r,'dblA');
  r = await supabase.from('doubles').update({ id_round: MOVE.round }).eq('id_double', MOVE.dblB); ck(r,'dblB');
  r = await supabase.from('matches').update({ scheduled_at: MOVE.at+'+00:00', id_court: MOVE.court }).eq('id_match', MOVE.match); ck(r,'match');
  console.log(`  gravado #${MOVE.match} -> round ${MOVE.round}, ${MOVE.at}, court ${MOVE.court}`);
  console.log('>>> CONCLUIDO <<<');
  process.exit(0);
})();
