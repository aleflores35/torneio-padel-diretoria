// READ-ONLY: situação da Paola Brendler (692, Fem) — jogos, resultados, posição, round-robin.
const supabase = require('../../supabase');
const axios = require('axios');
const T = 7, CAT = 3, PAOLA = 692;
const BASE = 'https://ranking-padel-srb-2026.vercel.app';

(async () => {
  const { data: players } = await supabase.from('players').select('*').eq('id_tournament', T);
  const P = {}; players.forEach(p => P[p.id_player] = p); const nm = id => P[id] ? P[id].name : id;
  const pa = P[PAOLA];

  // ranking Fem
  const { data: rk } = await axios.get(`${BASE}/api/tournaments/${T}/ranking/${CAT}`);
  const idx = rk.findIndex(r => (r.id_player) === PAOLA);
  const me = rk[idx];
  console.log(`>>> ${pa.name} (id ${PAOLA}, Fem, side ${pa.side}, active ${pa.active})`);
  console.log(`POSIÇÃO: ${idx+1}º de ${rk.length} | ${me.points} pts | ${me.wins}V ${me.losses}D | ${me.matches_played} jogos | saldo ${me.games_balance>=0?'+':''}${me.games_balance}\n`);
  console.log('Top Fem:');
  rk.slice(0,6).forEach((r,i)=>console.log(`  ${i+1}. ${r.name.padEnd(20)} ${r.points} pts (${r.wins}V ${r.losses}D, ${r.matches_played}j)`));

  // jogos da Paola
  const { data: rounds } = await supabase.from('rounds').select('*').eq('id_tournament', T);
  const R = {}; rounds.forEach(r => R[r.id_round] = r);
  const { data: dbls } = await supabase.from('doubles').select('*').eq('id_tournament', T);
  const D = {}; dbls.forEach(d => D[d.id_double] = d);
  const myD = new Set(dbls.filter(d=>d.id_player1===PAOLA||d.id_player2===PAOLA).map(d=>d.id_double));
  const dids = dbls.map(d=>d.id_double);
  let ms=[]; for(let i=0;i<dids.length;i+=200){const{data:a}=await supabase.from('matches').select('*').in('id_double_a',dids.slice(i,i+200));const{data:b}=await supabase.from('matches').select('*').in('id_double_b',dids.slice(i,i+200));ms=ms.concat(a||[],b||[]);}
  const uniq={}; ms.forEach(m=>uniq[m.id_match]=m);
  const dateOf=m=>{const d=D[m.id_double_a]||D[m.id_double_b]||{};return (R[d.id_round]||{}).scheduled_date;};
  const isExh=m=>{const d=D[m.id_double_a]||{};return (R[d.id_round]||{}).round_type==='EXHIBITION';};
  const mine=Object.values(uniq).filter(m=>(myD.has(m.id_double_a)||myD.has(m.id_double_b))&&!isExh(m)).sort((a,b)=>String(dateOf(a)).localeCompare(String(dateOf(b))));

  const partners=new Set();
  console.log('\n=== JOGOS DA PAOLA ===');
  for(const m of mine){
    const myside = myD.has(m.id_double_a)?'a':'b';
    const mineD = myside==='a'?D[m.id_double_a]:D[m.id_double_b];
    const oppD = myside==='a'?D[m.id_double_b]:D[m.id_double_a];
    const partnerId = mineD.id_player1===PAOLA?mineD.id_player2:mineD.id_player1;
    partners.add(partnerId);
    let res='';
    if(['FINISHED','WO'].includes(m.status)){
      const my=myside==='a'?m.games_double_a:m.games_double_b, ot=myside==='a'?m.games_double_b:m.games_double_a;
      res = `${m.status==='WO'?'WO ':''}${my}×${ot} ${my>ot?'✅ VITÓRIA':'❌ derrota'}`;
    } else res=`[${m.status} — a jogar]`;
    console.log(`  ${dateOf(m)} | c/ ${nm(partnerId)} × ${nm(oppD.id_player1)}/${nm(oppD.id_player2)} | ${res}`);
  }
  const jogados=mine.filter(m=>['FINISHED','WO'].includes(m.status)).length;
  const fut=mine.filter(m=>['TO_PLAY','CALLING','IN_PROGRESS'].includes(m.status)).length;
  const lefts=players.filter(x=>x.category_id===CAT&&x.side!==pa.side&&x.active);
  console.log(`\njogados ${jogados} | a jogar ${fut}`);
  console.log(`round-robin: ${partners.size} parceiras de ${lefts.length} ${pa.side==='RIGHT'?'LEFT':'RIGHT'} ativas.`);
  const faltam=lefts.filter(x=>!partners.has(x.id_player));
  console.log(`faltam parceiras:`, faltam.map(x=>x.name).join(', ')||'(nenhuma — round-robin completo)');
  process.exit(0);
})();
