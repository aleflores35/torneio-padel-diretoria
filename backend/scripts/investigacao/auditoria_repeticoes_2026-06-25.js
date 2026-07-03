// READ-ONLY · Audita TODAS as categorias do sorteio de 25/06 sob a regra dura:
// ranking não pode repetir adversário de mesma posição. Como a confirmação de hoje
// carimbou +1 nas oppositions, no estado atual: diag>=2 = REPETIDO (viola), diag==1
// = foi a 1ª vez (ok). Lista por match os confrontos mesma-posição e flag de violação.
const supabase = require('../../supabase');
const T = 7, DATE = '2026-06-25';
const catN = { 1: 'Masc Inic', 2: 'Masc 4ª', 3: 'Feminino' };

async function run() {
  const { data: rounds } = await supabase.from('rounds')
    .select('id_round, id_category, round_type, status').eq('id_tournament', T).eq('scheduled_date', DATE);
  let viol = 0, ok = 0;
  for (const r of (rounds || []).sort((a,b)=>a.id_category-b.id_category)) {
    const { data: dbl } = await supabase.from('doubles').select('*').eq('id_round', r.id_round);
    const ids = [...new Set(dbl.flatMap(d=>[d.id_player1,d.id_player2]))];
    const { data: pl } = await supabase.from('players').select('id_player,name,side').in('id_player', ids);
    const P={}; pl.forEach(p=>P[p.id_player]=p);
    const dById={}; dbl.forEach(d=>dById[d.id_double]=d);
    const { data: matches } = await supabase.from('matches').select('id_match,id_double_a,id_double_b,scheduled_at,status').in('id_double_a', dbl.map(d=>d.id_double));
    console.log(`\n### ${catN[r.id_category]||r.id_category} · round ${r.id_round} ${r.round_type} ${r.status} ###`);
    for (const m of (matches||[]).sort((a,b)=>(a.scheduled_at||'').localeCompare(b.scheduled_at||''))) {
      const a=dById[m.id_double_a], b=dById[m.id_double_b]; if(!a||!b) continue;
      const hora=m.scheduled_at?m.scheduled_at.substring(11,16):'—';
      const confrontos=[];
      for(const pa of [a.id_player1,a.id_player2]) for(const pb of [b.id_player1,b.id_player2]){
        if(P[pa]&&P[pb]&&P[pa].side===P[pb].side&&P[pa].side!=='EITHER'){
          const p1=Math.min(pa,pb),p2=Math.max(pa,pb);
          const {data:o}=await supabase.from('oppositions').select('diagonal_count').eq('id_tournament',T).eq('id_category',r.id_category).eq('id_player1',p1).eq('id_player2',p2).maybeSingle();
          const dg=o?o.diagonal_count:0;
          const rep = dg>=2;
          if(rep) viol++; else ok++;
          confrontos.push(`${P[pa].side} ${P[pa].name}×${P[pb].name} ${rep?`🔴 REPETIDO (já ${dg-1}x antes)`:'✅ inédito'}`);
        }
      }
      console.log(`  ${hora} ${a.display_name||''} × ${b.display_name||''}`);
      confrontos.forEach(c=>console.log(`       ${c}`));
    }
  }
  console.log(`\n== RESUMO: ${viol} confronto(s) REPETIDO(s) · ${ok} inédito(s) ==`);
}
run().catch(e=>{console.error(e);process.exit(1);});
