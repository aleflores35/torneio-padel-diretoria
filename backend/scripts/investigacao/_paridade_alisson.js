// READ-ONLY: analisa o impacto da saida do Alisson (670) na PARIDADE de jogos da Masc Iniciante (cat 1).
// Round-robin de PARCERIA: cada RIGHT deve jogar de dupla com cada LEFT (e vice) 1x.
// Pergunta: quem ja "gastou" o jogo-com-Alisson (pontuou) vs quem nunca vai jogar.
const supabase = require('../../supabase');
const TID = 7, CAT = 1, ALISSON = 670;

(async () => {
  if (!supabase) { console.error('SEM supabase'); process.exit(1); }
  const { data: players } = await supabase.from('players').select('id_player,name,side,category_id,active').eq('id_tournament', TID);
  const P = {}; players.forEach(p=>P[p.id_player]=p);
  const cat1 = players.filter(p=>p.category_id===CAT);

  const { data: rounds } = await supabase.from('rounds').select('id_round,scheduled_date,id_category').eq('id_tournament', TID);
  const rd = {}; rounds.forEach(r=>rd[r.id_round]=r);
  const { data: dbls } = await supabase.from('doubles').select('*').eq('id_tournament', TID);
  const dblById = {}; dbls.forEach(d=>dblById[d.id_double]=d);
  const dids = dbls.map(d=>d.id_double);
  async function mf(field){ let o=[]; for(let i=0;i<dids.length;i+=200){ const {data}=await supabase.from('matches').select('*').in(field,dids.slice(i,i+200)); o=o.concat(data||[]);} return o; }
  const all = Object.values(Object.fromEntries([...(await mf('id_double_a')),...(await mf('id_double_b'))].map(m=>[m.id_match,m])));
  console.log('Campos de matches:', Object.keys(all[0]).join(', '));

  function roundOf(m){ const da=dblById[m.id_double_a],db=dblById[m.id_double_b]; return rd[da&&da.id_round]||rd[db&&db.id_round]||{}; }
  function isCat1(m){ return roundOf(m).id_category===CAT; }
  function four(m){ const da=dblById[m.id_double_a],db=dblById[m.id_double_b]; return {da,db,ids:[da&&da.id_player1,da&&da.id_player2,db&&db.id_player1,db&&db.id_player2].filter(Boolean)}; }
  const cat1matches = all.filter(isCat1);

  // ---- jogos do Alisson ----
  const alisMatches = cat1matches.filter(m=>four(m).ids.includes(ALISSON))
    .sort((a,b)=>String(a.scheduled_at).localeCompare(String(b.scheduled_at)));
  console.log(`\n=== Jogos do Alisson na cat1: ${alisMatches.length} ===`);
  const played = [], future = [];
  for (const m of alisMatches) {
    const f=four(m); const r=roundOf(m);
    const meu = (f.da.id_player1===ALISSON||f.da.id_player2===ALISSON)?f.da:f.db;
    const adv = meu===f.da?f.db:f.da;
    const parc = meu.id_player1===ALISSON?meu.id_player2:meu.id_player1;
    const line = `#${m.id_match} ${r.scheduled_date} ${String(m.scheduled_at).slice(11,16)} | ${m.status} | parceiro ${P[parc].name} | vs ${adv.display_name} | score ${m.score_a ?? m.games_a ?? '-'}x${m.score_b ?? m.games_b ?? '-'} | winner ${m.id_winner_double ?? m.winner ?? '-'}`;
    if (m.status==='TO_PLAY') future.push({m,parc,line}); else played.push({m,parc,line});
  }
  console.log('\n-- JA JOGADOS (pontos reais em jogo) --'); played.forEach(x=>console.log('  '+x.line));
  console.log('\n-- FUTUROS (nao vao acontecer) --'); future.forEach(x=>console.log('  '+x.line));

  // parceiros que JA jogaram com Alisson vs que NUNCA vao
  const parceirosJogaram = played.map(x=>x.parc);
  const parceirosFuturo = future.map(x=>x.parc);
  console.log(`\n=== RIGHTs que JA gastaram o jogo-com-Alisson (${parceirosJogaram.length}): ${parceirosJogaram.map(id=>P[id].name).join(', ')}`);
  console.log(`=== RIGHTs que NUNCA vao jogar com Alisson (${parceirosFuturo.length}): ${parceirosFuturo.map(id=>P[id].name).join(', ')}`);

  // ---- paridade: contagem de jogos por atleta cat1 sob 3 cenarios ----
  const alisMatchIds = new Set(alisMatches.map(m=>m.id_match));
  const alisFutureIds = new Set(future.map(x=>x.m.id_match));
  function countGames(pid, excludeIds){
    return cat1matches.filter(m=>!excludeIds.has(m.id_match) && four(m).ids.includes(pid)).length;
  }
  console.log(`\n=== PARIDADE — nro de jogos por atleta cat1 ===`);
  console.log(`(A) full atual | (B) removendo SO os 7 futuros do Alisson | (C) expurgando TODOS os jogos do Alisson (jogados+futuros)`);
  const rows = cat1.filter(p=>p.id_player!==ALISSON).map(p=>({
    nome:P[p.id_player].name, side:p.side,
    A: countGames(p.id_player, new Set()),
    B: countGames(p.id_player, alisFutureIds),
    C: countGames(p.id_player, alisMatchIds),
  })).sort((a,b)=> a.side.localeCompare(b.side) || a.nome.localeCompare(b.nome));
  rows.forEach(r=>console.log(`  ${r.side.padEnd(6)} ${r.nome.padEnd(24)} A=${r.A}  B=${r.B}  C=${r.C}`));
  const spread = arr => { const v=arr.map(r=>r[arr._k]); }; // noop
  for (const k of ['A','B','C']) {
    const vals = rows.map(r=>r[k]); const min=Math.min(...vals), max=Math.max(...vals);
    console.log(`  cenario ${k}: min ${min} max ${max} spread ${max-min}`);
  }
  console.log(`\nAlisson: active=${P[ALISSON].active}. Jogados=${played.length} Futuros=${future.length}.`);
  process.exit(0);
})();
