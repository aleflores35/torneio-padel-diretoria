// READ-ONLY: quando o campeonato termina no calendario ATUAL (sem remarcacoes).
// Ultima data com jogo TO_PLAY por categoria + contagem por quinta.
const supabase = require('../../supabase');
const TID = 7;
const HOJE = '2026-07-09';

(async () => {
  const { data: rounds } = await supabase.from('rounds').select('*').eq('id_tournament', TID);
  const R = {}; rounds.forEach(r => R[r.id_round] = r);
  const { data: dbls } = await supabase.from('doubles').select('id_double,id_round').eq('id_tournament', TID);
  const D = {}; dbls.forEach(d => D[d.id_double] = d);
  const dids = dbls.map(d => d.id_double);
  async function mF(f){let o=[];for(let i=0;i<dids.length;i+=200){const{data}=await supabase.from('matches').select('*').in(f,dids.slice(i,i+200));o=o.concat(data||[]);}return o;}
  const byId = {}; [...await mF('id_double_a'), ...await mF('id_double_b')].forEach(m => byId[m.id_match]=m);
  const all = Object.values(byId);
  const roundOf = m => R[(D[m.id_double_a]||{}).id_round] || R[(D[m.id_double_b]||{}).id_round] || {};
  const dateOf = m => roundOf(m).scheduled_date;
  const catOf = m => roundOf(m).id_category;
  const typeOf = m => (roundOf(m).round_type||'REGULAR');
  const catName = c => c===1?'Masc Iniciante':c===2?'Masc 4a':c===3?'Feminino':'cat'+c;

  const futuros = all.filter(m => typeOf(m)!=='EXHIBITION' && ['TO_PLAY','CALLING','IN_PROGRESS'].includes(m.status) && dateOf(m) >= HOJE);

  console.log('=== JOGOS A JOGAR por quinta e categoria (calendario ATUAL) ===');
  const dates = [...new Set(futuros.map(dateOf))].sort();
  for (const d of dates) {
    const ms = futuros.filter(m => dateOf(m)===d);
    const porCat = {}; ms.forEach(m => porCat[catOf(m)]=(porCat[catOf(m)]||0)+1);
    const resumo = Object.entries(porCat).map(([c,n])=>`${catName(+c)}:${n}`).join('  ');
    console.log(`  ${d} | ${ms.length} jogos | ${resumo}`);
  }

  console.log('\n=== ULTIMA data com jogo por categoria ===');
  for (const c of [1,2,3]) {
    const ds = futuros.filter(m => catOf(m)===c).map(dateOf).sort();
    console.log(`  ${catName(c)}: ${ds.length? ds[ds.length-1] : '(sem jogos futuros — ja terminou)'} (${ds.length} jogos a jogar)`);
  }
  const maxAll = futuros.map(dateOf).sort().slice(-1)[0];
  console.log(`\n>>> CAMPEONATO termina (calendario atual, sem remarcar): ${maxAll}`);
  process.exit(0);
})();
