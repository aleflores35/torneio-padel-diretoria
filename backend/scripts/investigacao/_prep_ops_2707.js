// READ-ONLY: rounds por data + quadras + slots livres em 13/08 + duplas dos jogos-alvo
const supabase = require('../../supabase');
const TID = 7;
const ALVO_DEL = [1436,1441,1444,1445];      // futuros Cristiano (13/08 x2, 20/08 x2)
const ALVO_MOVE = 1418;                       // Alessandro/Nelson -> 13/08
(async () => {
  const { data: courts } = await supabase.from('courts').select('*');
  console.log('=== COURTS ==='); (courts||[]).forEach(c=>console.log(`  ${c.id_court} | ${c.name||c.court_name||JSON.stringify(c)}`));
  const { data: rounds } = await supabase.from('rounds').select('*').eq('id_tournament', TID).order('scheduled_date');
  console.log('\n=== ROUNDS >= 2026-08-06 ===');
  (rounds||[]).filter(r=>String(r.scheduled_date)>='2026-08-06').forEach(r=>console.log(`  round ${r.id_round} | ${r.scheduled_date} | ${r.status} | type ${r.round_type||'REGULAR'} | cat ${r.category_id ?? '-'} | num ${r.round_number ?? '-'}`));
  const { data: dbls } = await supabase.from('doubles').select('*').eq('id_tournament', TID);
  const D={}; dbls.forEach(d=>D[d.id_double]=d);
  const { data: ms } = await supabase.from('matches').select('*').in('id_match', [...ALVO_DEL, ALVO_MOVE]);
  console.log('\n=== JOGOS-ALVO (detalhe) ===');
  (ms||[]).forEach(m=>{
    const a=D[m.id_double_a]||{}, b=D[m.id_double_b]||{};
    console.log(`  #${m.id_match} | ${m.scheduled_at} | q${m.id_court} | ${m.status} | dblA ${m.id_double_a}(round ${a.id_round}) "${a.display_name}" | dblB ${m.id_double_b}(round ${b.id_round}) "${b.display_name}"`);
  });
  // ocupacao 13/08
  const r1308 = (rounds||[]).filter(r=>r.scheduled_date==='2026-08-13').map(r=>r.id_round);
  const dl = dbls.filter(d=>r1308.includes(d.id_round)).map(d=>d.id_double);
  let occ=[]; for(const f of ['id_double_a','id_double_b']){ const {data}=await supabase.from('matches').select('*').in(f, dl); occ=occ.concat(data||[]); }
  const uniq={}; occ.forEach(m=>uniq[m.id_match]=m);
  console.log('\n=== OCUPACAO 13/08 ===');
  Object.values(uniq).sort((a,b)=>String(a.scheduled_at).localeCompare(String(b.scheduled_at)))
    .forEach(m=>console.log(`  #${m.id_match} ${String(m.scheduled_at).slice(11,16)} q${m.id_court} ${m.status}`));
  process.exit(0);
})();
