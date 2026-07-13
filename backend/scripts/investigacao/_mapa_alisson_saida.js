// READ-ONLY: mapa dos jogos futuros do Alisson (670) apos saida do ranking.
// Pra cada jogo TO_PLAY dele: data/hora/quadra/cat, PARCEIRO (perde parceiro), ADVERSARIOS (beneficiarios de WO),
// e se o parceiro tem OUTRO jogo na mesma noite (removendo, fica sem jogo?).
const supabase = require('../../supabase');
const TID = 7, ALISSON = 670;

(async () => {
  if (!supabase) { console.error('SEM supabase'); process.exit(1); }
  const { data: players } = await supabase.from('players').select('id_player,name,side,category_id,active').eq('id_tournament', TID);
  const P = {}; players.forEach(p => P[p.id_player]=p);
  const alis = players.find(p=>p.id_player===ALISSON) || players.find(p=>/alisson/i.test(p.name));
  console.log(`Alisson = ${alis.name} (id ${alis.id_player}, side ${alis.side}, cat ${alis.category_id}, active ${alis.active})`);

  const { data: rounds } = await supabase.from('rounds').select('id_round,scheduled_date,id_category').eq('id_tournament', TID);
  const rd = {}; rounds.forEach(r => rd[r.id_round]=r);
  const { data: dbls } = await supabase.from('doubles').select('id_double,id_round,id_player1,id_player2,display_name').eq('id_tournament', TID);
  const dblById = {}; dbls.forEach(d => dblById[d.id_double]=d);
  const dids = dbls.map(d=>d.id_double);
  async function mf(field){ let o=[]; for(let i=0;i<dids.length;i+=200){ const {data}=await supabase.from('matches').select('*').in(field,dids.slice(i,i+200)); o=o.concat(data||[]);} return o; }
  const all = Object.values(Object.fromEntries([...(await mf('id_double_a')),...(await mf('id_double_b'))].map(m=>[m.id_match,m])));
  function roundOf(m){ const da=dblById[m.id_double_a],db=dblById[m.id_double_b]; return rd[da&&da.id_round]||rd[db&&db.id_round]||{}; }
  function hhmm(m){ return String(m.scheduled_at||'').slice(11,16); }
  function four(m){ const da=dblById[m.id_double_a],db=dblById[m.id_double_b]; return [da&&da.id_player1,da&&da.id_player2,db&&db.id_player1,db&&db.id_player2].filter(Boolean); }

  const alisDblIds = new Set(dbls.filter(d=>d.id_player1===ALISSON||d.id_player2===ALISSON).map(d=>d.id_double));
  const mine = all.filter(m=>alisDblIds.has(m.id_double_a)||alisDblIds.has(m.id_double_b))
    .sort((a,b)=>String(a.scheduled_at||'').localeCompare(String(b.scheduled_at||'')));

  const toplay = mine.filter(m=>m.status==='TO_PLAY');
  const finished = mine.filter(m=>m.status!=='TO_PLAY');
  console.log(`\nTotal jogos Alisson: ${mine.length} | JA JOGADOS/outros: ${finished.length} | TO_PLAY (a decidir): ${toplay.length}`);

  console.log(`\n=== JOGOS TO_PLAY do Alisson (a decidir destino) ===`);
  for (const m of toplay) {
    const r = roundOf(m);
    const da=dblById[m.id_double_a], db=dblById[m.id_double_b];
    const alisNoA = (da.id_player1===ALISSON||da.id_player2===ALISSON);
    const meuDbl = alisNoA?da:db, advDbl = alisNoA?db:da;
    const parceiroId = meuDbl.id_player1===ALISSON?meuDbl.id_player2:meuDbl.id_player1;
    const advNomes = advDbl.display_name;
    // parceiro tem outro jogo na mesma noite?
    const noite = all.filter(x=>roundOf(x).scheduled_date===r.scheduled_date && x.id_match!==m.id_match);
    const parceiroOutros = noite.filter(x=>four(x).includes(parceiroId)).map(x=>`${hhmm(x)}#${x.id_match}`);
    console.log(`\n#${m.id_match} | ${r.scheduled_date} ${hhmm(m)} | q${m.id_court} | cat ${r.id_category} | ${m.status}`);
    console.log(`   ${da.display_name} X ${db.display_name}`);
    console.log(`   Parceiro do Alisson: ${P[parceiroId].name} (id ${parceiroId}) ${parceiroOutros.length?`— tem outro(s) jogo(s) na noite: ${parceiroOutros.join(', ')}`:'— SEM outro jogo nessa noite (ficaria sem jogo se remover)'}`);
    console.log(`   Adversários (ganhariam WO): ${advNomes}`);
  }

  const { data: abs } = await supabase.from('player_absences').select('absence_date').eq('id_tournament', TID).eq('id_player', ALISSON);
  console.log(`\n=== Ausências já registradas do Alisson (${(abs||[]).length}) ===`, (abs||[]).map(a=>a.absence_date).join(', ') || '(nenhuma)');
  process.exit(0);
})();
