// READ-ONLY: situação do Hélisson Borges (Masc 4a) — jogos, sides, e checagem de regra
// (dupla com Eduardo Horbach = sides opostos? já enfrentou Helio Garcia na mesma posição?).
const supabase = require('../../supabase');
const T = 7;

(async () => {
  const { data: players } = await supabase.from('players').select('*').eq('id_tournament', T);
  const P = {}; players.forEach(p => P[p.id_player] = p);
  const nm = id => P[id] ? P[id].name : id;
  const sd = id => P[id] ? P[id].side : '?';
  const HEL = players.find(p => /borges/i.test(p.name || '') || /h[eé]lisson/i.test(p.name || ''));
  if (!HEL) { console.log('Helisson nao encontrado'); process.exit(1); }
  const HID = HEL.id_player;
  console.log(`>>> ${HEL.name} (id ${HID}, cat ${HEL.category_id}, side ${HEL.side}, active ${HEL.active})\n`);

  const { data: rounds } = await supabase.from('rounds').select('*').eq('id_tournament', T);
  const R = {}; rounds.forEach(r => R[r.id_round] = r);
  const { data: dbls } = await supabase.from('doubles').select('*').eq('id_tournament', T);
  const D = {}; dbls.forEach(d => D[d.id_double] = d);
  const myD = new Set(dbls.filter(d => d.id_player1 === HID || d.id_player2 === HID).map(d => d.id_double));
  const dids = dbls.map(d => d.id_double);
  let ms = [];
  for (let i=0;i<dids.length;i+=200){const{data:a}=await supabase.from('matches').select('*').in('id_double_a',dids.slice(i,i+200));const{data:b}=await supabase.from('matches').select('*').in('id_double_b',dids.slice(i,i+200));ms=ms.concat(a||[],b||[]);}
  const uniq={}; ms.forEach(m=>uniq[m.id_match]=m);
  const dateOf=m=>{const d=D[m.id_double_a]||D[m.id_double_b]||{};return (R[d.id_round]||{}).scheduled_date;};
  const hh=m=>String(m.scheduled_at||'').slice(11,16);
  const isExh=m=>{const d=D[m.id_double_a]||{};return (R[d.id_round]||{}).round_type==='EXHIBITION';};
  const mine=Object.values(uniq).filter(m=>(myD.has(m.id_double_a)||myD.has(m.id_double_b))&&!isExh(m)).sort((a,b)=>String(dateOf(a)+hh(a)).localeCompare(String(dateOf(b)+hh(b))));

  console.log('=== JOGOS DO HELISSON ===');
  for(const m of mine){
    const myside=myD.has(m.id_double_a)?'a':'b';
    const mineD=myside==='a'?D[m.id_double_a]:D[m.id_double_b];
    const oppD=myside==='a'?D[m.id_double_b]:D[m.id_double_a];
    const partnerId=mineD.id_player1===HID?mineD.id_player2:mineD.id_player1;
    const o1=oppD.id_player1,o2=oppD.id_player2;
    console.log(`  #${m.id_match} | ${dateOf(m)} ${hh(m)} | ${m.status} | c/ ${nm(partnerId)}(${sd(partnerId)}) × ${nm(o1)}(${sd(o1)})/${nm(o2)}(${sd(o2)})`);
  }

  // checagem regra forte: adversario da MESMA posicao do Helisson nos jogos futuros
  console.log(`\n=== CHECAGEM REGRA (Helisson e' side ${HEL.side}) ===`);
  const { data: opps } = await supabase.from('oppositions').select('*').eq('id_tournament', T).eq('id_category', HEL.category_id);
  const oppKey = (a,b) => a<b ? `${a}-${b}` : `${b}-${a}`;
  const oppMap = {}; opps.forEach(o => oppMap[oppKey(o.id_player1,o.id_player2)] = o);
  const fut = mine.filter(m=>['TO_PLAY','CALLING','IN_PROGRESS'].includes(m.status));
  for(const m of fut){
    const myside=myD.has(m.id_double_a)?'a':'b';
    const oppD=myside==='a'?D[m.id_double_b]:D[m.id_double_a];
    const sameSideOpp=[oppD.id_player1,oppD.id_player2].find(id=>sd(id)===HEL.side);
    if(!sameSideOpp){ console.log(`  #${m.id_match} ${dateOf(m)}: nenhum adversario do mesmo lado (${HEL.side}) — sem confronto de posicao`); continue; }
    const o=oppMap[oppKey(HID,sameSideOpp)];
    const diag=o?o.diagonal_count:0, tot=o?o.times_opposed:0;
    console.log(`  #${m.id_match} ${dateOf(m)}: adversario mesma posicao = ${nm(sameSideOpp)}(${sd(sameSideOpp)}) | ja enfrentou mesma posicao? diagonal=${diag} (times_opposed=${tot}) ${diag>0?'<<< REPETE mesma posicao':'OK'}`);
  }
  process.exit(0);
})();
