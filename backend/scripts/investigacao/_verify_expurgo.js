// READ-ONLY: verifica o expurgo. Usa o rankingService REAL (mesma lógica do app).
const ranking = require('../../services/rankingService');
const supabase = require('../../supabase');
const T = 7, CAT = 1, MARCIO = 657, ALISSON = 670;

(async () => {
  // 1) players ativos + status Alisson/Marcio
  const { data: pl } = await supabase.from('players').select('id_player,name,active').eq('id_tournament', T).in('id_player', [MARCIO, ALISSON]);
  console.log('Status quitters:', pl.map(p=>`${p.name} active=${p.active}`).join(' | '));

  // 2) rounds exhibition
  const { data: exh } = await supabase.from('rounds').select('id_round,scheduled_date').eq('id_tournament', T).eq('round_type','EXHIBITION');
  console.log(`Rounds EXHIBITION: ${exh.length} -> ${exh.map(r=>r.id_round+'('+r.scheduled_date+')').join(', ')}`);

  // 3) jogos futuros restantes com Alisson (deve ser 0)
  const { data: dbls } = await supabase.from('doubles').select('id_double,id_player1,id_player2').eq('id_tournament', T);
  const alDbls = new Set(dbls.filter(d=>d.id_player1===ALISSON||d.id_player2===ALISSON).map(d=>d.id_double));
  const dids = dbls.map(d=>d.id_double);
  let fut=[]; for(let i=0;i<dids.length;i+=200){ const {data}=await supabase.from('matches').select('id_match,id_double_a,id_double_b,status').in('id_double_a',dids.slice(i,i+200)); fut=fut.concat((data||[]));}
  for(let i=0;i<dids.length;i+=200){ const {data}=await supabase.from('matches').select('id_match,id_double_a,id_double_b,status').in('id_double_b',dids.slice(i,i+200)); fut=fut.concat((data||[]));}
  const alFuture = [...new Map(fut.map(m=>[m.id_match,m])).values()].filter(m=>(m.status==='TO_PLAY'||m.status==='CALLING')&&(alDbls.has(m.id_double_a)||alDbls.has(m.id_double_b)));
  console.log(`Jogos futuros restantes com Alisson: ${alFuture.length} ${alFuture.map(m=>'#'+m.id_match).join(', ')}`);

  // 4) ranking REAL cat 1
  const st = await ranking.getStandings(T, CAT);
  console.log(`\n=== RANKING REAL Masc Iniciante (${st.length} atletas) ===`);
  st.forEach((p,i)=>console.log(`${String(i+1).padStart(2)}. ${p.name.padEnd(22)} ${p.points}pt ${p.wins}V/${p.losses}D wo${p.wos} bal${p.games_balance>=0?'+':''}${p.games_balance} · ${p.matches_played}j`));
  const marcioIn = st.find(p=>p.id_player===MARCIO), alissonIn = st.find(p=>p.id_player===ALISSON);
  console.log(`\nMarcio no ranking? ${marcioIn?'SIM (ERRO)':'não (ok)'} · Alisson no ranking? ${alissonIn?'SIM (ERRO)':'não (ok)'}`);
  const mp = st.map(p=>p.matches_played);
  console.log(`Paridade jogos/atleta: ${Math.min(...mp)}–${Math.max(...mp)} (spread ${Math.max(...mp)-Math.min(...mp)})`);
  process.exit(0);
})();
