// PIVO: (1) reconstroi historico partnerships/oppositions do zero a partir de jogos
// jogados (FINISHED/WO) + a rodada vigente 02/07 (mantida); (2) apaga rodadas futuras
// 09/07+. DRY-RUN por padrao. Para gravar: CONFIRM_EXECUTE=yes
// NAO mexe nos jogos de 02/07 nem nos jogos passados.
const supabase = require('../../supabase');
const TID = 7;
const KEEP_DATE = '2026-07-02';      // rodada vigente: mantida e CONTA no historico
const DELETE_FROM = '2026-07-09';    // apaga desta data em diante
const CONFIRM = process.env.CONFIRM_EXECUTE === 'yes';

const sideOf = {};
const okey = (a,b)=>a<b?[a,b]:[b,a];

(async () => {
  if (!supabase) { console.error('SEM supabase'); process.exit(1); }
  // dados
  const { data: players } = await supabase.from('players').select('id_player, side, category_id').eq('id_tournament', TID);
  players.forEach(p=>{ sideOf[p.id_player]=p.side; });
  const { data: rounds } = await supabase.from('rounds').select('*').eq('id_tournament', TID);
  const roundCat = {}; rounds.forEach(r=>roundCat[r.id_round]=r.id_category);
  const { data: doubles } = await supabase.from('doubles').select('id_double, id_player1, id_player2, id_round').eq('id_tournament', TID);
  const dPlayers = {}, dRound = {}; doubles.forEach(d=>{ dPlayers[d.id_double]=[d.id_player1,d.id_player2]; dRound[d.id_double]=d.id_round; });
  const dids = doubles.map(d=>d.id_double);
  const { data: matches } = await supabase.from('matches').select('id_match, id_double_a, id_double_b, status, scheduled_at').in('id_double_a', dids);

  // data de cada match via round do double_a
  const matchDate = {};
  rounds.forEach(r=>{}); // noop
  const roundDate = {}; rounds.forEach(r=>roundDate[r.id_round]=r.scheduled_date);
  matches.forEach(m=>{ matchDate[m.id_match] = roundDate[dRound[m.id_double_a]]; });

  // ---- (1) recomputa historico a partir de jogos que CONTAM: FINISHED/WO  OU  data == 02/07 ----
  const counts = ['FINISHED','WO'];
  const part = {}, opp = {};
  let nPlayed=0;
  for (const m of matches) {
    const conta = counts.includes(m.status) || matchDate[m.id_match] === KEEP_DATE;
    if (!conta) continue;
    nPlayed++;
    const cat = roundCat[dRound[m.id_double_a]];
    const rid = dRound[m.id_double_a];
    const da = dPlayers[m.id_double_a]||[], db = dPlayers[m.id_double_b]||[];
    const addPart = (pair)=>{ const [a,b]=okey(pair[0],pair[1]); const k=`${cat}|${a}|${b}`; if(!part[k])part[k]={id_category:cat,id_player1:a,id_player2:b,times_paired:0,last_round_id:rid}; part[k].times_paired++; part[k].last_round_id=rid; };
    if (da.length===2) addPart(da);
    if (db.length===2) addPart(db);
    for (const a of da) for (const b of db) {
      const [x,y]=okey(a,b); const k=`${cat}|${x}|${y}`;
      const diag = sideOf[a] && sideOf[a]===sideOf[b] && sideOf[a]!=='EITHER' ? 1 : 0;
      if(!opp[k])opp[k]={id_category:cat,id_player1:x,id_player2:y,times_opposed:0,diagonal_count:0,last_round_id:rid};
      opp[k].times_opposed++; opp[k].diagonal_count+=diag; opp[k].last_round_id=rid;
    }
  }
  const partRows = Object.values(part).map(r=>({id_tournament:TID, ...r}));
  const oppRows  = Object.values(opp).map(r=>({id_tournament:TID, ...r}));

  // ---- (2) rodadas futuras a apagar ----
  const futRounds = rounds.filter(r=>r.scheduled_date >= DELETE_FROM);
  const futRoundIds = futRounds.map(r=>r.id_round);
  const futDoubles = doubles.filter(d=>futRoundIds.includes(d.id_round));
  const futDoubleIds = futDoubles.map(d=>d.id_double);
  const futMatches = matches.filter(m=>futDoubleIds.includes(m.id_double_a) || futDoubleIds.includes(m.id_double_b));

  console.log('================ PLANO ================');
  console.log(`Jogos que CONTAM no historico (FINISHED/WO + 02/07): ${nPlayed}`);
  console.log(`Historico novo: partnerships=${partRows.length}  oppositions=${oppRows.length}`);
  console.log(`  (antes: partnerships=317 oppositions=459)`);
  console.log(`Rodadas futuras a APAGAR (>=${DELETE_FROM}): ${futRounds.length}  [${futRoundIds.join(',')}]`);
  console.log(`  matches a apagar: ${futMatches.length} | doubles: ${futDoubles.length}`);
  console.log(`02/07 (mantida intacta): ${matches.filter(m=>matchDate[m.id_match]===KEEP_DATE).length} jogos`);
  console.log('CONFIRM_EXECUTE =', CONFIRM ? 'SIM (vai gravar)' : 'nao (dry-run)');

  if (!CONFIRM) { console.log('\n>>> DRY-RUN: nada gravado. <<<'); process.exit(0); }

  console.log('\n--- EXECUTANDO ---');
  // (2) apaga futuras: matches -> round_attendance -> doubles -> rounds
  if (futMatches.length) {
    const ids = futMatches.map(m=>m.id_match);
    for (let i=0;i<ids.length;i+=100){ await supabase.from('matches').delete().in('id_match', ids.slice(i,i+100)); }
    console.log(`apagados ${ids.length} matches`);
  }
  if (futRoundIds.length) {
    await supabase.from('round_attendance').delete().in('id_round', futRoundIds);
    console.log('apagado round_attendance das futuras');
  }
  if (futDoubleIds.length) {
    for (let i=0;i<futDoubleIds.length;i+=100){ await supabase.from('doubles').delete().in('id_double', futDoubleIds.slice(i,i+100)); }
    console.log(`apagados ${futDoubleIds.length} doubles`);
  }
  if (futRoundIds.length) {
    await supabase.from('rounds').delete().in('id_round', futRoundIds);
    console.log(`apagadas ${futRoundIds.length} rounds`);
  }
  // (1) rebuild historico
  await supabase.from('partnerships').delete().eq('id_tournament', TID);
  await supabase.from('oppositions').delete().eq('id_tournament', TID);
  console.log('limpas partnerships/oppositions antigas');
  for (let i=0;i<partRows.length;i+=200){ const {error}=await supabase.from('partnerships').insert(partRows.slice(i,i+200)); if(error)console.log('ERRO part:',error.message); }
  for (let i=0;i<oppRows.length;i+=200){ const {error}=await supabase.from('oppositions').insert(oppRows.slice(i,i+200)); if(error)console.log('ERRO opp:',error.message); }
  console.log(`inseridos ${partRows.length} partnerships, ${oppRows.length} oppositions`);
  console.log('\n>>> EXECUCAO CONCLUIDA <<<');
  process.exit(0);
})();
