// OPCAO 2 (Nelson Paiva, aprovada 08/07). Move 2 partidas INTEIRAS (nao re-pareia).
// M1: #1418 (Nelson/Alessandro x Eduardo/Ivan) 30/07 18:30 -> 06/08 18:30 Vidro (round 444)
// M2: #1427 (Cassius/Helisson x Nelson/Helio) 06/08 18:30 -> 16/07 20:30 Parede (round 437)
// Efeito p/ Nelson: joga 16/07 + 23/07 + 06/08 (1/noite), LIVRE 30/07 (torneio do clube dia 31).
// Backup PRE: PRE_pivot_2026-07-08-13-44-41. DRY default; CONFIRM_EXECUTE=yes grava.
const supabase = require('../../supabase');
const CONFIRM = process.env.CONFIRM_EXECUTE === 'yes';
const TID = 7;
const ck = (r, w) => { if (r && r.error) { console.error('ERRO', w, r.error.message); process.exit(1); } };

const MOVES = [
  { match:1418, dblA:3118, dblB:3119, round:444, at:'2026-08-06T18:30:00', court:16, label:'#1418 Nelson/Alessandro x Eduardo/Ivan: 30/07 -> 06/08 18:30 Vidro' },
  { match:1427, dblA:3136, dblB:3137, round:437, at:'2026-07-16T20:30:00', court:17, label:'#1427 Cassius/Helisson x Nelson/Helio: 06/08 -> 16/07 20:30 Parede' },
];
const DATES = ['2026-07-16','2026-07-23','2026-07-30','2026-08-06'];

(async () => {
  if (!supabase) { console.error('SEM supabase'); process.exit(1); }
  const { data: rounds } = await supabase.from('rounds').select('id_round,scheduled_date,id_category,round_type').eq('id_tournament', TID);
  const rDate = {}; rounds.forEach(r => rDate[r.id_round] = r.scheduled_date);
  const rType = {}; rounds.forEach(r => rType[r.id_round] = r.round_type||'REGULAR');
  const { data: dbls } = await supabase.from('doubles').select('id_double,id_round,id_player1,id_player2,display_name').in('id_round', rounds.map(r=>r.id_round));
  const dMap = {}; dbls.forEach(d => dMap[d.id_double] = d);
  const { data: players } = await supabase.from('players').select('id_player,name').eq('id_tournament', TID);
  const pName = {}; players.forEach(p => pName[p.id_player] = p.name);
  const { data: courts } = await supabase.from('courts').select('id_court,name');
  const cName = {}; courts.forEach(c => cName[c.id_court] = c.name);
  let matches = [];
  for (let i=0;i<dbls.length;i+=200){ const {data}=await supabase.from('matches').select('id_match,id_double_a,id_double_b,id_court,scheduled_at,status').in('id_double_a', dbls.slice(i,i+200).map(d=>d.id_double)); matches=matches.concat(data||[]); }

  // simulacao: aplica os 2 moves
  const sim = matches.map(m => ({ ...m }));
  const dSim = {}; dbls.forEach(d => dSim[d.id_double] = { ...d });
  for (const MV of MOVES){
    dSim[MV.dblA].id_round = MV.round; dSim[MV.dblB].id_round = MV.round;
    const mm = sim.find(m => m.id_match === MV.match);
    mm.scheduled_at = MV.at + '+00:00'; mm.id_court = MV.court;
  }
  const dateOfSim = (m) => rDate[dSim[m.id_double_a].id_round];
  const isExh = (m, useSim) => (rType[(useSim?dSim:dMap)[m.id_double_a].id_round]) === 'EXHIBITION';
  const playersOf = (m) => [dMap[m.id_double_a], dMap[m.id_double_b]].flatMap(d => [d.id_player1, d.id_player2]).filter(Boolean);
  const hh = (m) => (m.scheduled_at||'').slice(11,16);

  console.log('=== MOVES ===');
  for (const MV of MOVES){
    const m0 = matches.find(x => x.id_match === MV.match);
    console.log(`  ${MV.label}`);
    console.log(`     ANTES:  ${rDate[dMap[m0.id_double_a].id_round]} ${hh(m0)} ${cName[m0.id_court]} (status ${m0.status})`);
    const mm = sim.find(x => x.id_match === MV.match);
    console.log(`     DEPOIS: ${dateOfSim(mm)} ${hh(mm)} ${cName[mm.id_court]}`);
  }

  console.log('\n=== VERIFICACAO colisao (pos-move, conta FINISHED datados, exclui EXHIBITION) ===');
  let problemas = 0;
  for (const date of DATES) {
    const daySim = sim.filter(m => dateOfSim(m) === date && !isExh(m, true));
    const bySlot = {};
    for (const m of daySim) { const t=hh(m); (bySlot[t]=bySlot[t]||[]).push(m); }
    console.log(`\n  ${date}: ${daySim.length} jogos`);
    for (const t of Object.keys(bySlot).sort()) {
      const ms = bySlot[t];
      const courtsUsed = ms.map(m => m.id_court);
      const dupCourt = courtsUsed.length !== new Set(courtsUsed).size;
      const pls = ms.flatMap(playersOf);
      const dupPlayer = [...new Set(pls)].filter(p => pls.filter(x=>x===p).length > 1);
      if (dupCourt || dupPlayer.length) problemas++;
      console.log(`    ${t} (${ms.length}x, ${courtsUsed.map(c=>cName[c]).join('+')})${(dupCourt||dupPlayer.length)?' <<< COLISAO':''}`);
      if (dupPlayer.length) console.log(`       jogador 2x mesmo horario: ${dupPlayer.map(p=>pName[p]).join(', ')}`);
      if (dupCourt) console.log(`       quadra 2x mesmo horario`);
    }
  }
  console.log(`\n  >>> colisoes: ${problemas}`);

  // assert: agenda final do Nelson (681)
  const nelsonDbls = new Set(dbls.filter(d=>d.id_player1===681||d.id_player2===681).map(d=>d.id_double));
  const nelsonMatches = sim.filter(m=>nelsonDbls.has(m.id_double_a)||nelsonDbls.has(m.id_double_b)).filter(m=>!isExh(m,true))
    .sort((a,b)=>String(dateOfSim(a)+hh(a)).localeCompare(String(dateOfSim(b)+hh(b))));
  console.log('\n=== AGENDA FINAL do Nelson (simulada) ===');
  nelsonMatches.forEach(m=>console.log(`  #${m.id_match} ${dateOfSim(m)} ${hh(m)} ${cName[m.id_court]}`));
  const joga30 = nelsonMatches.some(m=>dateOfSim(m)==='2026-07-30');
  console.log(`  Nelson joga 30/07? ${joga30?'SIM <<< ERRO':'NAO ✅'} | total jogos: ${nelsonMatches.length}`);

  if (!CONFIRM) { console.log('\n>>> DRY-RUN: nada gravado <<<'); process.exit(0); }
  if (problemas > 0) { console.error('\n!!! ABORTADO: colisoes !!!'); process.exit(1); }
  if (joga30) { console.error('\n!!! ABORTADO: Nelson ainda joga 30/07 !!!'); process.exit(1); }
  if (nelsonMatches.length !== 9) { console.error(`\n!!! ABORTADO: Nelson deveria manter 9 jogos totais, tem ${nelsonMatches.length} !!!`); process.exit(1); }

  console.log('\n--- GRAVANDO ---');
  for (const MV of MOVES){
    let r = await supabase.from('doubles').update({ id_round: MV.round }).eq('id_double', MV.dblA); ck(r,`dblA ${MV.match}`);
    r = await supabase.from('doubles').update({ id_round: MV.round }).eq('id_double', MV.dblB); ck(r,`dblB ${MV.match}`);
    r = await supabase.from('matches').update({ scheduled_at: MV.at+'+00:00', id_court: MV.court }).eq('id_match', MV.match); ck(r,`match ${MV.match}`);
    console.log(`  gravado ${MV.label}`);
  }

  // assert pos-gravacao (re-leitura do banco)
  console.log('\n--- ASSERT POS-GRAVACAO (re-leitura) ---');
  for (const MV of MOVES){
    const { data: dd } = await supabase.from('doubles').select('id_round').in('id_double',[MV.dblA,MV.dblB]);
    const { data: mm } = await supabase.from('matches').select('scheduled_at,id_court').eq('id_match', MV.match);
    const okR = dd.every(x=>x.id_round===MV.round);
    const okM = mm[0].scheduled_at.slice(0,16)===MV.at.slice(0,16) && mm[0].id_court===MV.court;
    console.log(`  #${MV.match}: round ${okR?'OK':'FALHOU'} | slot ${okM?'OK':'FALHOU'} (${mm[0].scheduled_at} q${mm[0].id_court})`);
    if(!okR||!okM){ console.error('!!! ASSERT FALHOU !!!'); process.exit(1); }
  }
  console.log('\n>>> CONCLUIDO — 2 moves aplicados e verificados <<<');
  process.exit(0);
})();
