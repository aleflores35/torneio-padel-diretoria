// READ-ONLY: acha o jogo Maria Luísa/Catiane X Nicole/Nara (Fem Iniciante, cat 3) pra lançar placar.
// Resultado informado: Nicole/Nara 9 x 3 Maria Luísa/Catiane.
const supabase = require('../../supabase');
const TID = 7;
(async () => {
  if (!supabase) { console.error('SEM supabase'); process.exit(1); }
  const { data: players } = await supabase.from('players').select('id_player,name,side,category_id,active').eq('id_tournament', TID);
  const byName = re => players.filter(p=>re.test(p.name));
  const P = {}; players.forEach(p=>P[p.id_player]=p);
  console.log('Maria Luísa:', byName(/maria l/i).map(p=>`${p.name} (${p.id_player}, cat ${p.category_id})`).join(' | '));
  console.log('Catiane:', byName(/catiane/i).map(p=>`${p.name} (${p.id_player}, cat ${p.category_id})`).join(' | '));
  console.log('Nicole:', byName(/nicole/i).map(p=>`${p.name} (${p.id_player}, cat ${p.category_id})`).join(' | '));
  console.log('Nara:', byName(/nara/i).map(p=>`${p.name} (${p.id_player}, cat ${p.category_id})`).join(' | '));

  const ML = (byName(/maria l/i)[0]||{}).id_player;
  const CAT = (byName(/catiane/i)[0]||{}).id_player;
  const NIC = (byName(/nicole/i)[0]||{}).id_player;
  const NAR = (byName(/nara/i)[0]||{}).id_player;
  const alvo = new Set([ML,CAT,NIC,NAR]);
  console.log(`\nAlvo ids: ML=${ML} Catiane=${CAT} Nicole=${NIC} Nara=${NAR}`);

  const { data: courts } = await supabase.from('courts').select('*').eq('id_tournament', TID);
  const courtName = {}; (courts||[]).forEach(c=>courtName[c.id_court]=c.name||c.court_name||JSON.stringify(c));
  console.log('Courts:', JSON.stringify(courts));

  const { data: rounds } = await supabase.from('rounds').select('id_round,scheduled_date,id_category,round_type').eq('id_tournament', TID);
  const rd = {}; rounds.forEach(r=>rd[r.id_round]=r);
  const { data: dbls } = await supabase.from('doubles').select('*').eq('id_tournament', TID);
  const dblById = {}; dbls.forEach(d=>dblById[d.id_double]=d);
  const dids = dbls.map(d=>d.id_double);
  async function mf(field){ let o=[]; for(let i=0;i<dids.length;i+=200){ const {data}=await supabase.from('matches').select('*').in(field,dids.slice(i,i+200)); o=o.concat(data||[]);} return o; }
  const all = Object.values(Object.fromEntries([...(await mf('id_double_a')),...(await mf('id_double_b'))].map(m=>[m.id_match,m])));
  function four(m){ const da=dblById[m.id_double_a],db=dblById[m.id_double_b]; return [da&&da.id_player1,da&&da.id_player2,db&&db.id_player1,db&&db.id_player2].filter(Boolean); }

  const hits = all.filter(m => { const f=four(m); return f.length===4 && f.every(id=>alvo.has(id)); });
  console.log(`\n=== JOGOS entre esses 4 (${hits.length}) ===`);
  for (const m of hits) {
    const da=dblById[m.id_double_a], db=dblById[m.id_double_b];
    const r = rd[da.id_round]||rd[db.id_round]||{};
    console.log(`\n#${m.id_match} | status ${m.status} | ${r.scheduled_date} ${String(m.scheduled_at||'').slice(11,16)} | quadra ${m.id_court} (${courtName[m.id_court]||'?'}) | round ${da.id_round} cat ${r.id_category} type ${r.round_type||'-'}`);
    console.log(`   id_double_a=${m.id_double_a}: ${da.display_name}  (p1=${da.id_player1} p2=${da.id_player2})`);
    console.log(`   id_double_b=${m.id_double_b}: ${db.display_name}  (p1=${db.id_player1} p2=${db.id_player2})`);
    console.log(`   games atuais: A=${m.games_double_a} B=${m.games_double_b} | submitted_by=${m.player_score_submitted_by} player_score_a/b=${m.player_score_a}/${m.player_score_b} | absent=${JSON.stringify(m.absent_player_ids)}`);
    // orientacao pro placar informado (Nicole/Nara=9, ML/Catiane=3)
    const aIsNicNara = [da.id_player1,da.id_player2].includes(NIC) && [da.id_player1,da.id_player2].includes(NAR);
    console.log(`   >>> Se gravar Nicole/Nara=9 x ML/Catiane=3: games_double_a=${aIsNicNara?9:3}, games_double_b=${aIsNicNara?3:9}`);
  }
  process.exit(0);
})();
