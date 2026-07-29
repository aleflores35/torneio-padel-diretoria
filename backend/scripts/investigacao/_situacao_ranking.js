// READ-ONLY: situação atual do ranking (standings live + jogos restantes por categoria).
const supabase = require('../../supabase');
const axios = require('axios');
const T = 7;
const BASE = 'https://ranking-padel-srb-2026.vercel.app';
const catName = c => ({1:'Masc Iniciante',2:'Masc 4a',3:'Fem'}[c] || 'cat'+c);

(async () => {
  // 1) standings live (endpoint "all")
  const { data: all } = await axios.get(`${BASE}/api/tournaments/${T}/ranking`);
  const byCat = Array.isArray(all) ? {} : all;

  // 2) jogos futuros (TO_PLAY) por categoria + ultima data, via banco
  const { data: rounds } = await supabase.from('rounds').select('*').eq('id_tournament', T);
  const R = {}; rounds.forEach(r => R[r.id_round] = r);
  const { data: dbls } = await supabase.from('doubles').select('id_double,id_round').eq('id_tournament', T);
  const D = {}; dbls.forEach(d => D[d.id_double] = d);
  const dids = dbls.map(d => d.id_double);
  let ms = [];
  for (let i=0;i<dids.length;i+=200){ const {data}=await supabase.from('matches').select('id_match,id_double_a,status,scheduled_at').in('id_double_a',dids.slice(i,i+200)); ms=ms.concat(data||[]); }
  const futByCat = {}, lastDate = {};
  let totalFut = 0;
  ms.filter(m=>['TO_PLAY','CALLING','IN_PROGRESS'].includes(m.status)).forEach(m => {
    const r = R[(D[m.id_double_a]||{}).id_round]; if(!r || r.round_type==='EXHIBITION') return;
    const c = r.id_category;
    futByCat[c] = (futByCat[c]||0)+1; totalFut++;
    const d = r.scheduled_date;
    if (!lastDate[c] || d > lastDate[c]) lastDate[c] = d;
  });

  console.log(`=== SITUAÇÃO DO RANKING (torneio ${T}) — live ${new Date().toISOString().slice(0,16)} ===\n`);
  for (const c of Object.keys(byCat).sort()) {
    const rows = byCat[c] || [];
    console.log(`## ${catName(+c)} — ${rows.length} atletas | ${futByCat[c]||0} jogos a jogar${lastDate[c]?` (até ${lastDate[c]})`:''}`);
    rows.slice(0,6).forEach((r,i)=>console.log(`   ${String(i+1).padStart(2)}. ${r.name.padEnd(22)} ${String(r.points).padStart(3)} pts | ${r.wins}V ${r.losses}D | ${r.matches_played}j | saldo ${r.games_balance>=0?'+':''}${r.games_balance}`));
    console.log('');
  }
  console.log(`TOTAL jogos a jogar (todas cats): ${totalFut}`);
  process.exit(0);
})();
