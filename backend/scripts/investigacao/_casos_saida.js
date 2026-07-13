// READ-ONLY: mapeia casos de SAIDA/afastamento no torneio 7.
// (1) jogadores active=false; (2) Pablo Severo status; (3) jogos ja em exhibition; (4) quem tem muitas ausencias futuras.
const supabase = require('../../supabase');
const TID = 7;
(async () => {
  if (!supabase) { console.error('SEM supabase'); process.exit(1); }
  const { data: players } = await supabase.from('players').select('id_player,name,side,category_id,active').eq('id_tournament', TID);
  const P = {}; players.forEach(p=>P[p.id_player]=p);

  console.log('=== (1) Jogadores INATIVOS (active=false) ===');
  const inativos = players.filter(p=>p.active===false);
  if (!inativos.length) console.log('  (nenhum)');
  inativos.forEach(p=>console.log(`  ${p.name} (id ${p.id_player}, side ${p.side}, cat ${p.category_id})`));

  const { data: rounds } = await supabase.from('rounds').select('id_round,scheduled_date,id_category').eq('id_tournament', TID);
  const rd = {}; rounds.forEach(r=>rd[r.id_round]=r);
  const { data: dbls } = await supabase.from('doubles').select('*').eq('id_tournament', TID);
  const dblById = {}; dbls.forEach(d=>dblById[d.id_double]=d);
  const dids = dbls.map(d=>d.id_double);
  async function mf(field){ let o=[]; for(let i=0;i<dids.length;i+=200){ const {data}=await supabase.from('matches').select('*').in(field,dids.slice(i,i+200)); o=o.concat(data||[]);} return o; }
  const all = Object.values(Object.fromEntries([...(await mf('id_double_a')),...(await mf('id_double_b'))].map(m=>[m.id_match,m])));
  function roundOf(m){ const da=dblById[m.id_double_a],db=dblById[m.id_double_b]; return rd[da&&da.id_round]||rd[db&&db.id_round]||{}; }
  function four(m){ const da=dblById[m.id_double_a],db=dblById[m.id_double_b]; return [da&&da.id_player1,da&&da.id_player2,db&&db.id_player1,db&&db.id_player2].filter(Boolean); }
  function games(pid){ const ms=all.filter(m=>four(m).includes(pid)); return { total:ms.length, played:ms.filter(m=>m.status!=='TO_PLAY').length, future:ms.filter(m=>m.status==='TO_PLAY').length }; }

  console.log('\n=== (2) Casos de afastamento longo conhecidos ===');
  for (const [nome, id] of [['Pablo Severo',673],['Alisson Boyink',670]]) {
    const g = games(id); const pl=P[id];
    const { data: abs } = await supabase.from('player_absences').select('absence_date').eq('id_tournament', TID).eq('id_player', id);
    console.log(`  ${pl?pl.name:nome} (id ${id}) cat ${pl&&pl.category_id} active=${pl&&pl.active} | jogos: ${g.played} jogados / ${g.future} futuros / ${g.total} total (${g.total?Math.round(100*g.played/g.total):0}% jogado) | ausencias: ${(abs||[]).map(a=>a.absence_date).join(', ')||'-'}`);
  }
  // procura por outros com muitos jogos futuros TO_PLAY e zero recentes (possiveis afastados)
  console.log('\n=== (3) Jogos ja marcados como exhibition (stage/id_group) ===');
  const exib = all.filter(m => (m.stage && /exhib|amist/i.test(String(m.stage))) );
  if (!exib.length) console.log('  (nenhum via campo stage — checar manualmente converte_masc4a_419_exhibition.js)');
  exib.forEach(m=>{ const r=roundOf(m); console.log(`  #${m.id_match} ${r.scheduled_date} stage=${m.stage} ${dblById[m.id_double_a].display_name} X ${dblById[m.id_double_b].display_name}`); });
  // valores distintos de stage p/ inspecao
  const stages = [...new Set(all.map(m=>m.stage))];
  console.log('  valores distintos de stage:', JSON.stringify(stages));

  console.log('\n=== (4) Jogadores com >=3 ausencias registradas (possivel afastamento) ===');
  const { data: absAll } = await supabase.from('player_absences').select('id_player,absence_date').eq('id_tournament', TID);
  const cnt = {}; (absAll||[]).forEach(a=>cnt[a.id_player]=(cnt[a.id_player]||0)+1);
  Object.entries(cnt).filter(([id,n])=>n>=3).sort((a,b)=>b[1]-a[1]).forEach(([id,n])=>{
    const g=games(Number(id)); console.log(`  ${P[id]?P[id].name:id} (id ${id}) cat ${P[id]&&P[id].category_id} active=${P[id]&&P[id].active} | ${n} ausencias | ${g.played} jogados/${g.future} futuros`);
  });
  process.exit(0);
})();
