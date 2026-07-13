// READ-ONLY: acha duplas órfãs (sem match) em todo o torneio + detalha a rodada 450.
const supabase = require('../../supabase');
const T = 7;
(async () => {
  const { data: players } = await supabase.from('players').select('id_player,name,category_id,active').eq('id_tournament', T);
  const nm={}; players.forEach(p=>nm[p.id_player]=p.name);
  const { data: rounds } = await supabase.from('rounds').select('*').eq('id_tournament', T);
  const rd={}; rounds.forEach(r=>rd[r.id_round]=r);
  const { data: dbls } = await supabase.from('doubles').select('*').eq('id_tournament', T);
  const dids = dbls.map(d=>d.id_double);
  async function fetchM(f){ let o=[]; for(let i=0;i<dids.length;i+=200){ const {data}=await supabase.from('matches').select('id_match,id_double_a,id_double_b,status').in(f,dids.slice(i,i+200)); o=o.concat(data||[]);} return o; }
  const ms=[...await fetchM('id_double_a'),...await fetchM('id_double_b')];
  const used = new Set(); ms.forEach(m=>{used.add(m.id_double_a);used.add(m.id_double_b);});

  const orphans = dbls.filter(d=>!used.has(d.id_double));
  console.log(`Total duplas: ${dbls.length} · usadas em match: ${used.size} · ÓRFÃS: ${orphans.length}`);
  // agrupa órfãs por round
  const byRound={};
  orphans.forEach(d=>{ (byRound[d.id_round]=byRound[d.id_round]||[]).push(d); });
  console.log(`\nÓrfãs por rodada:`);
  Object.entries(byRound).sort((a,b)=>a[0]-b[0]).forEach(([r,ds])=>{
    const rr=rd[r]||{};
    console.log(`  round ${r} (${rr.scheduled_date}, cat${rr.id_category}, ${rr.status}, ${rr.round_type}): ${ds.length} órfãs`);
    ds.forEach(d=>console.log(`      double ${d.id_double}: ${d.display_name}`));
  });

  // rodada 450 detalhe: duplas x matches
  console.log(`\n=== Rodada 450 (${rd[450]?.scheduled_date}, cat${rd[450]?.id_category}, ${rd[450]?.status}) ===`);
  const d450 = dbls.filter(d=>d.id_round===450);
  const m450 = ms.filter(m=>{ const da=dbls.find(x=>x.id_double===m.id_double_a); const db=dbls.find(x=>x.id_double===m.id_double_b); return (da&&da.id_round===450)||(db&&db.id_round===450); });
  const uniqM450 = [...new Map(m450.map(m=>[m.id_match,m])).values()];
  console.log(`  duplas na 450: ${d450.length} · matches na 450: ${uniqM450.length}`);
  d450.forEach(d=>console.log(`    double ${d.id_double} ${used.has(d.id_double)?'[tem match]':'[ÓRFÃ]'}: ${d.display_name}`));
  process.exit(0);
})();
