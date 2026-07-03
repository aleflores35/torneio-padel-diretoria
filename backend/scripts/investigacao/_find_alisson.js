// READ-ONLY: localiza todos os jogos do Alisson Boyink no estado atual do banco.
const supabase = require('../../supabase');
const TID = 7;
(async () => {
  if (!supabase) { console.error('SEM supabase'); process.exit(1); }
  // confirma id do Alisson
  const { data: players } = await supabase.from('players').select('id_player,name,side,category_id').eq('id_tournament', TID);
  const alis = players.filter(p => /alisson/i.test(p.name));
  console.log('Jogadores "Alisson":', alis.map(p=>`${p.name} (id ${p.id_player}, side ${p.side}, cat ${p.category_id})`).join(' | '));
  const AID = (alis[0] && alis[0].id_player) || 670;

  // rounds + map de data/categoria
  const { data: rounds } = await supabase.from('rounds').select('id_round,scheduled_date,id_category').eq('id_tournament', TID);
  const rd = {}; rounds.forEach(r => rd[r.id_round] = r);

  // doubles do Alisson
  const { data: dbls } = await supabase.from('doubles').select('id_double,id_round,id_player1,id_player2,display_name').eq('id_tournament', TID);
  const nameById = {}; players.forEach(p => nameById[p.id_player] = p.name);
  const alisDbls = dbls.filter(d => d.id_player1 === AID || d.id_player2 === AID);
  const alisDblIds = new Set(alisDbls.map(d => d.id_double));

  // matches onde algum double do Alisson aparece (como A ou B)
  const dids = dbls.map(d => d.id_double);
  const { data: matchesA } = await supabase.from('matches').select('*').in('id_double_a', dids);
  const { data: matchesB } = await supabase.from('matches').select('*').in('id_double_b', dids);
  const byId = {}; [...(matchesA||[]), ...(matchesB||[])].forEach(m => byId[m.id_match] = m);
  const all = Object.values(byId);
  const dblById = {}; dbls.forEach(d => dblById[d.id_double] = d);

  const mine = all.filter(m => alisDblIds.has(m.id_double_a) || alisDblIds.has(m.id_double_b));
  mine.sort((a,b)=>String(a.scheduled_at||'').localeCompare(String(b.scheduled_at||'')));

  console.log(`\n=== JOGOS DO ALISSON (id ${AID}) — total ${mine.length} ===`);
  for (const m of mine) {
    const da = dblById[m.id_double_a], db = dblById[m.id_double_b];
    const r = rd[da && da.id_round] || rd[db && db.id_round] || {};
    console.log(`#${m.id_match} | ${r.scheduled_date||'?'} ${String(m.scheduled_at||'').slice(11,16)} | round ${da&&da.id_round} cat ${r.id_category} | status ${m.status}`);
    console.log(`     ${da&&da.display_name} X ${db&&db.display_name}`);
  }

  // ausencias do Alisson
  const { data: abs } = await supabase.from('player_absences').select('*').eq('id_tournament', TID).eq('id_player', AID);
  console.log(`\n=== AUSENCIAS registradas do Alisson === (${(abs||[]).length})`);
  (abs||[]).forEach(a => console.log(`  ${a.absence_date}`));
  process.exit(0);
})();
