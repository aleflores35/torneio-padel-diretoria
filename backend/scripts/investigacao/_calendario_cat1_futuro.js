// READ-ONLY: mapeia rodadas cat 1 (Masc Iniciante), datas, slots ocupados por noite,
// e confirma se setembro esta vazio. Base pra desenhar remarcacao do Anderson (667).
const supabase = require('../../supabase');
const TID = 7;
const CAT = 1;

(async () => {
  const { data: rounds } = await supabase.from('rounds').select('*').eq('id_tournament', TID);
  const R = {}; rounds.forEach(r => R[r.id_round] = r);
  const { data: dbls } = await supabase.from('doubles').select('id_double,id_round,id_player1,id_player2,display_name').eq('id_tournament', TID);
  const D = {}; dbls.forEach(d => D[d.id_double] = d);
  const dids = dbls.map(d => d.id_double);
  async function mF(f){let o=[];for(let i=0;i<dids.length;i+=200){const{data}=await supabase.from('matches').select('*').in(f,dids.slice(i,i+200));o=o.concat(data||[]);}return o;}
  const byId = {}; [...await mF('id_double_a'), ...await mF('id_double_b')].forEach(m => byId[m.id_match]=m);
  const all = Object.values(byId);
  const roundOf = m => R[(D[m.id_double_a]||{}).id_round] || R[(D[m.id_double_b]||{}).id_round] || {};
  const dateOf = m => roundOf(m).scheduled_date;
  const catOf = m => roundOf(m).id_category;
  const hhmm = m => String(m.scheduled_at||'').slice(11,16);

  // agrupa cat1 por data
  const cat1 = all.filter(m => catOf(m)===CAT && roundOf(m).round_type!=='EXHIBITION');
  const byDate = {};
  cat1.forEach(m => { const d=dateOf(m); (byDate[d]=byDate[d]||[]).push(m); });
  const dates = Object.keys(byDate).sort();
  console.log('=== RODADAS cat 1 (Masc Iniciante) por data ===');
  for (const d of dates) {
    const ms = byDate[d].sort((a,b)=>String(a.scheduled_at||'').localeCompare(String(b.scheduled_at||'')));
    const status = ms.map(m=>m.status);
    const nTO = status.filter(s=>['TO_PLAY','CALLING','IN_PROGRESS'].includes(s)).length;
    const nDone = status.filter(s=>['FINISHED','WO'].includes(s)).length;
    const slots = ms.map(m=>`${hhmm(m)}q${m.id_court}`).join(' ');
    console.log(`  ${d} | ${ms.length} jogos (${nDone} feitos, ${nTO} a jogar) | slots: ${slots}`);
  }

  console.log('\n=== SETEMBRO 2026 (qualquer categoria) ===');
  const setembro = all.filter(m => String(dateOf(m)||'').startsWith('2026-09'));
  console.log(setembro.length ? `${setembro.length} jogos em setembro` : 'VAZIO — nenhuma rodada em setembro');

  console.log('\n=== ultima data com jogo (torneio inteiro) ===');
  const maxDate = all.map(dateOf).filter(Boolean).sort().slice(-1)[0];
  console.log('  ', maxDate);
  process.exit(0);
})();
