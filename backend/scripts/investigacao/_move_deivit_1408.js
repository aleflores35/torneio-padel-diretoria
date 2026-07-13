// REMARCAR #1408 (Deivit/Luis Herzog x William Ellwanger/Alessandro Bianchi), Masc Iniciante.
// Impedimento saúde do Deivit (volta sáb 18/07). Move partida INTEIRA (nao re-pareia):
//   16/07 21:10 q16  ->  06/08 19:10 q16 (Vidro), round 445.
// Move id_round das 2 duplas + scheduled_at + id_court. DRY default; CONFIRM_EXECUTE=yes grava.
const supabase = require('../../supabase');
const CONFIRM = process.env.CONFIRM_EXECUTE === 'yes';
const TID = 7, CAT = 1;
const MATCH = 1408, DEST_ROUND = 445, AT = '2026-08-06T19:10:00', COURT = 16;
const DEST_DATE = '2026-08-06';
const ck = (r, w) => { if (r && r.error) { console.error('ERRO', w, r.error.message); process.exit(1); } };

(async () => {
  if (!supabase) { console.error('SEM supabase'); process.exit(1); }
  const { data: rounds } = await supabase.from('rounds').select('*').eq('id_tournament', TID);
  const rDate = {}, rType = {}, rCat = {};
  rounds.forEach(r => { rDate[r.id_round]=r.scheduled_date; rType[r.id_round]=r.round_type||'REGULAR'; rCat[r.id_round]=r.id_category; });
  const { data: dbls } = await supabase.from('doubles').select('*').eq('id_tournament', TID);
  const dMap = {}; dbls.forEach(d => dMap[d.id_double]=d);
  const { data: players } = await supabase.from('players').select('id_player,name').eq('id_tournament', TID);
  const pName = {}; players.forEach(p => pName[p.id_player]=p.name);
  const { data: courts } = await supabase.from('courts').select('id_court,name');
  const cName = {}; courts.forEach(c => cName[c.id_court]=c.name);
  let matches = [];
  for (let i=0;i<dbls.length;i+=200){ const {data}=await supabase.from('matches').select('id_match,id_double_a,id_double_b,id_court,scheduled_at,status').in('id_double_a', dbls.slice(i,i+200).map(d=>d.id_double)); matches=matches.concat(data||[]); }

  const m0 = matches.find(m => m.id_match === MATCH);
  if (!m0) { console.error(`#${MATCH} NAO ENCONTRADO`); process.exit(1); }
  const DA = m0.id_double_a, DB = m0.id_double_b;

  // guardas
  if (rCat[DEST_ROUND] !== CAT) { console.error(`round ${DEST_ROUND} nao e' cat ${CAT}`); process.exit(1); }
  if (rDate[DEST_ROUND] !== DEST_DATE) { console.error(`round ${DEST_ROUND} nao e' ${DEST_DATE} (e' ${rDate[DEST_ROUND]})`); process.exit(1); }

  const hh = m => (m.scheduled_at||'').slice(11,16);
  const playersOf = m => [dMap[m.id_double_a], dMap[m.id_double_b]].flatMap(d=>[d.id_player1,d.id_player2]).filter(Boolean);

  console.log('=== MOVE #1408 ===');
  console.log(`  ANTES:  ${rDate[dMap[DA].id_round]} ${hh(m0)} ${cName[m0.id_court]} | ${dMap[DA].display_name} × ${dMap[DB].display_name} (status ${m0.status})`);
  console.log(`  DEPOIS: ${DEST_DATE} 19:10 ${cName[COURT]} (round ${DEST_ROUND})`);

  // simulacao
  const dSim = {}; dbls.forEach(d => dSim[d.id_double] = { ...d });
  dSim[DA].id_round = DEST_ROUND; dSim[DB].id_round = DEST_ROUND;
  const sim = matches.map(m => m.id_match===MATCH ? { ...m, scheduled_at: AT+'+00:00', id_court: COURT } : { ...m });
  const dateOfSim = m => rDate[dSim[m.id_double_a].id_round];
  const isExh = m => rType[dSim[m.id_double_a].id_round] === 'EXHIBITION';

  // colisao na noite de destino (conta FINISHED datados, exclui EXHIBITION)
  console.log(`\n=== COLISAO em ${DEST_DATE} (pos-move) ===`);
  const day = sim.filter(m => dateOfSim(m)===DEST_DATE && !isExh(m));
  const bySlot = {}; day.forEach(m => { const t=hh(m); (bySlot[t]=bySlot[t]||[]).push(m); });
  let problemas = 0;
  for (const t of Object.keys(bySlot).sort()) {
    const ms = bySlot[t];
    const courtsUsed = ms.map(m=>m.id_court);
    const dupCourt = courtsUsed.length !== new Set(courtsUsed).size;
    const pls = ms.flatMap(playersOf);
    const dupPlayer = [...new Set(pls)].filter(p => pls.filter(x=>x===p).length>1);
    if (dupCourt || dupPlayer.length) problemas++;
    console.log(`  ${t} (${ms.length}x ${courtsUsed.map(c=>cName[c]).join('+')})${(dupCourt||dupPlayer.length)?' <<< COLISAO':''}`);
    if (dupPlayer.length) console.log(`     jogador 2x: ${dupPlayer.map(p=>pName[p]).join(', ')}`);
    if (dupCourt) console.log('     quadra 2x');
  }
  console.log(`  >>> colisoes: ${problemas}`);

  // agenda final dos 4 (simulada)
  console.log('\n=== AGENDA FINAL dos 4 (simulada, futuros) ===');
  const alvo = playersOf(m0);
  for (const id of alvo) {
    const dset = new Set(dbls.filter(d=>d.id_player1===id||d.id_player2===id).map(d=>d.id_double));
    const js = sim.filter(m => (dset.has(m.id_double_a)||dset.has(m.id_double_b)) && !isExh(m) && ['TO_PLAY','CALLING','IN_PROGRESS'].includes(m.status))
      .sort((a,b)=>String(dateOfSim(a)+hh(a)).localeCompare(String(dateOfSim(b)+hh(b))));
    console.log(`  ${pName[id].padEnd(20)}: ${js.map(m=>`${dateOfSim(m)} ${hh(m)}`).join(' | ')}`);
  }

  if (!CONFIRM) { console.log('\n>>> DRY-RUN: nada gravado <<<'); process.exit(0); }
  if (problemas > 0) { console.error('\n!!! ABORTADO: colisao !!!'); process.exit(1); }

  console.log('\n--- GRAVANDO ---');
  let r = await supabase.from('doubles').update({ id_round: DEST_ROUND }).eq('id_double', DA); ck(r,'dblA');
  r = await supabase.from('doubles').update({ id_round: DEST_ROUND }).eq('id_double', DB); ck(r,'dblB');
  r = await supabase.from('matches').update({ scheduled_at: AT+'+00:00', id_court: COURT }).eq('id_match', MATCH); ck(r,'match');

  console.log('--- ASSERT POS-GRAVACAO (re-leitura) ---');
  const { data: dd } = await supabase.from('doubles').select('id_round').in('id_double',[DA,DB]);
  const { data: mm } = await supabase.from('matches').select('scheduled_at,id_court').eq('id_match', MATCH);
  const okR = dd.every(x=>x.id_round===DEST_ROUND);
  const okM = mm[0].scheduled_at.slice(0,16)===AT.slice(0,16) && mm[0].id_court===COURT;
  console.log(`  #${MATCH}: round ${okR?'OK':'FALHOU'} | slot ${okM?'OK':'FALHOU'} (${mm[0].scheduled_at} q${mm[0].id_court})`);
  if(!okR||!okM){ console.error('!!! ASSERT FALHOU !!!'); process.exit(1); }
  console.log('\n>>> CONCLUIDO — #1408 remarcado 16/07 -> 06/08 19:10 Vidro <<<');
  process.exit(0);
})();
