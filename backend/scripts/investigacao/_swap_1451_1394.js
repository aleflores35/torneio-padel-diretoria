// SWAP de datas #1451 <-> #1394 (Masc 4a) para colocar Daniel Staevie/Denilson em 09/07.
//   #1451 (Daniel/Denilson vs Eduardo/Ivan): 27/08 19:10 Vidro  -> 09/07 18:30 Parede (round 434)
//   #1394 (Eduardo/Alessandro vs Gabriel/D.Teixeira): 09/07 18:30 Parede -> 27/08 19:10 Vidro (round 449)
// Mecanismo (igual _remarca_pablo_agosto): move id_round das 2 duplas + scheduled_at + id_court do match.
// Verifica colisoes (mesmo horario por jogador / por quadra) nas datas 09/07 e 27/08 antes de gravar.
// DRY default; CONFIRM_EXECUTE=yes grava.
const supabase = require('../../supabase');
const CONFIRM = process.env.CONFIRM_EXECUTE === 'yes';
const TID = 7;
const ck = (r, w) => { if (r && r.error) { console.error('ERRO', w, r.error.message); process.exit(1); } };

const SWAP = [
  { match:1451, dblA:3184, dblB:3185, round:434, at:'2026-07-09T18:30:00', court:17, label:'Daniel Staevie/Denilson x Eduardo/Ivan  -> 09/07 18:30 Parede' },
  { match:1394, dblA:3070, dblB:3071, round:449, at:'2026-08-27T19:10:00', court:16, label:'Eduardo/Alessandro x Gabriel/D.Teixeira -> 27/08 19:10 Vidro'  },
];
const DATES = ['2026-07-09','2026-08-27'];

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

  // estado simulado (aplica swap em memoria)
  const sim = matches.map(m => ({ ...m }));
  const dSim = {}; dbls.forEach(d => dSim[d.id_double] = { ...d });
  for (const s of SWAP) {
    dSim[s.dblA].id_round = s.round; dSim[s.dblB].id_round = s.round;
    const mm = sim.find(m => m.id_match === s.match);
    mm.scheduled_at = s.at + '+00:00'; mm.id_court = s.court;
  }
  const dateOf = (m, useSim) => rDate[(useSim ? dSim : dMap)[m.id_double_a].id_round];
  const playersOf = (m) => [dMap[m.id_double_a], dMap[m.id_double_b]].flatMap(d => [d.id_player1, d.id_player2]).filter(Boolean);

  console.log('=== ANTES ===');
  for (const s of SWAP) {
    const m = matches.find(x => x.id_match === s.match);
    console.log(`  #${s.match}: ${dMap[m.id_double_a].display_name} X ${dMap[m.id_double_b].display_name}`);
    console.log(`     ${rDate[dMap[m.id_double_a].id_round]} ${(m.scheduled_at||'').slice(11,16)} ${cName[m.id_court]}`);
  }
  console.log('\n=== DEPOIS (simulado) ===');
  for (const s of SWAP) {
    const m = sim.find(x => x.id_match === s.match);
    console.log(`  #${s.match}: ${s.label}`);
    console.log(`     nova data ${dateOf(m,true)} ${(m.scheduled_at||'').slice(11,16)} ${cName[m.id_court]}`);
  }

  // verificacao de colisoes nas 2 datas
  console.log('\n=== VERIFICACAO (pos-swap) ===');
  let problemas = 0;
  for (const date of DATES) {
    const daySim = sim.filter(m => dateOf(m, true) === date);
    console.log(`\n  ${date}: ${daySim.length} jogos`);
    const bySlot = {};
    for (const m of daySim) {
      const t = (m.scheduled_at||'').slice(11,16);
      (bySlot[t] = bySlot[t] || []).push(m);
    }
    for (const t of Object.keys(bySlot).sort()) {
      const ms = bySlot[t];
      const courtsUsed = ms.map(m => m.id_court);
      const dupCourt = courtsUsed.length !== new Set(courtsUsed).size;
      const pls = ms.flatMap(playersOf);
      const dupPlayer = [...new Set(pls)].filter(p => pls.filter(x=>x===p).length > 1);
      const tag = (dupCourt || dupPlayer.length) ? ' <<< COLISAO' : '';
      if (dupCourt || dupPlayer.length) problemas++;
      console.log(`    ${t} (${ms.length} jogo/s, quadras ${courtsUsed.map(c=>cName[c]).join('+')})${tag}`);
      if (dupPlayer.length) console.log(`       jogador em 2 jogos: ${dupPlayer.map(p=>pName[p]).join(', ')}`);
      if (dupCourt) console.log(`       quadra usada 2x no mesmo horario`);
    }
  }
  console.log(`\n  >>> colisoes encontradas: ${problemas}`);

  if (!CONFIRM) { console.log('\n>>> DRY-RUN: nada gravado <<<'); process.exit(0); }
  if (problemas > 0) { console.error('\n!!! ABORTADO: ha colisoes. Nao gravo. !!!'); process.exit(1); }

  console.log('\n--- GRAVANDO ---');
  for (const s of SWAP) {
    let r = await supabase.from('doubles').update({ id_round: s.round }).eq('id_double', s.dblA); ck(r, 'dblA '+s.match);
    r = await supabase.from('doubles').update({ id_round: s.round }).eq('id_double', s.dblB); ck(r, 'dblB '+s.match);
    r = await supabase.from('matches').update({ scheduled_at: s.at+'+00:00', id_court: s.court }).eq('id_match', s.match); ck(r, 'match '+s.match);
    console.log(`  gravado #${s.match} -> round ${s.round}, ${s.at}, court ${s.court}`);
  }
  console.log('>>> CONCLUIDO <<<');
  process.exit(0);
})();
