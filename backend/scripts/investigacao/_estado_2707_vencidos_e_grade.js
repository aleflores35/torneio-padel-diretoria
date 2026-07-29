// READ-ONLY: matches vencidos ainda TO_PLAY + grade das noites 30/07 e 06/08
const supabase = require('../../supabase');
const TID = 7, HOJE = '2026-07-27';
(async () => {
  const { data: players } = await supabase.from('players').select('*').eq('id_tournament', TID);
  const P={}; players.forEach(p=>P[p.id_player]=p);
  const catName=c=>c===1?'Inic':c===2?'4a':c===3?'Fem':'c'+c;
  const { data: rounds } = await supabase.from('rounds').select('*').eq('id_tournament', TID);
  const R={}; rounds.forEach(r=>R[r.id_round]=r);
  const { data: dbls } = await supabase.from('doubles').select('*').eq('id_tournament', TID);
  const D={}; dbls.forEach(d=>D[d.id_double]=d);
  const dids=dbls.map(d=>d.id_double);
  async function mF(f){let o=[];for(let i=0;i<dids.length;i+=200){const{data}=await supabase.from('matches').select('*').in(f,dids.slice(i,i+200));o=o.concat(data||[]);}return o;}
  const byId={}; [...await mF('id_double_a'),...await mF('id_double_b')].forEach(m=>byId[m.id_match]=m);
  const all=Object.values(byId);
  const rd=m=>R[(D[m.id_double_a]||{}).id_round]||R[(D[m.id_double_b]||{}).id_round]||{};
  const dt=m=>rd(m).scheduled_date, tp=m=>(rd(m).round_type||'REGULAR');
  const hh=m=>String(m.scheduled_at||'').slice(11,16);
  const cat=m=>{const a=D[m.id_double_a]||{};return (P[a.id_player1]||{}).category_id;};
  const line=m=>`#${m.id_match} ${dt(m)} ${hh(m)} q${m.id_court} [${catName(cat(m))}] ${m.status} | ${(D[m.id_double_a]||{}).display_name} X ${(D[m.id_double_b]||{}).display_name}`;
  const pend=all.filter(m=>tp(m)!=='EXHIBITION'&&['TO_PLAY','CALLING','IN_PROGRESS'].includes(m.status)&&dt(m)<HOJE).sort((a,b)=>String(dt(a)).localeCompare(String(dt(b))));
  console.log(`=== VENCIDOS ainda pendentes (${pend.length}) ===`); pend.forEach(m=>console.log('  '+line(m)));
  console.log(`\n=== NOITES FUTURAS (TO_PLAY por data) ===`);
  const fut=all.filter(m=>tp(m)!=='EXHIBITION'&&['TO_PLAY','CALLING'].includes(m.status)&&dt(m)>=HOJE);
  const byD={}; fut.forEach(m=>{(byD[dt(m)]=byD[dt(m)]||[]).push(m);});
  Object.keys(byD).sort().forEach(d=>{
    console.log(`\n-- ${d} (${byD[d].length} jogos)`);
    byD[d].sort((a,b)=>hh(a).localeCompare(hh(b))).forEach(m=>console.log('   '+line(m)));
  });
  process.exit(0);
})();
