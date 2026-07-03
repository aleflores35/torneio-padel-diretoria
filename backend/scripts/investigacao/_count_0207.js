// READ-ONLY: quantos jogos previstos para 2026-07-02 (amanhã), por categoria e status.
const supabase = require('../../supabase');
const TID = 7, DATE = '2026-07-02';
(async () => {
  const { data: rounds } = await supabase.from('rounds').select('id_round,id_category,scheduled_date').eq('id_tournament', TID).eq('scheduled_date', DATE);
  const rids = rounds.map(r => r.id_round);
  const catOf = {}; rounds.forEach(r => catOf[r.id_round] = r.id_category);
  const { data: cats } = await supabase.from('categories').select('id_category,name').eq('id_tournament', TID);
  const catName = {}; (cats||[]).forEach(c => catName[c.id_category] = c.name);
  const { data: dbls } = await supabase.from('doubles').select('id_double,id_round,display_name').in('id_round', rids);
  const dblRound = {}, dblName = {}; dbls.forEach(d => { dblRound[d.id_double] = d.id_round; dblName[d.id_double] = d.display_name; });
  const { data: matches } = await supabase.from('matches').select('id_match,id_double_a,id_double_b,status,scheduled_at').in('id_double_a', dbls.map(d=>d.id_double));
  console.log(`=== Jogos previstos para ${DATE} (amanhã) ===`);
  console.log(`Rodadas: ${rounds.length} | Jogos: ${matches.length}`);
  const byCat = {};
  matches.sort((a,b)=>String(a.scheduled_at).localeCompare(String(b.scheduled_at)));
  for (const m of matches) {
    const cat = catName[catOf[dblRound[m.id_double_a]]] || '?';
    byCat[cat] = (byCat[cat]||0)+1;
    console.log(`  #${m.id_match} ${String(m.scheduled_at||'').slice(11,16)} [${cat}] ${m.status} — ${dblName[m.id_double_a]} X ${dblName[m.id_double_b]}`);
  }
  console.log('\nPor categoria:', JSON.stringify(byCat));
  process.exit(0);
})();
