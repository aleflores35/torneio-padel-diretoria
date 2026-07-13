// READ-ONLY: todos os jogos do Bernardo Goulart (foco nos futuros TO_PLAY = "jogos previstos").
// Rodar: node scripts/investigacao/_find_bernardo.js  (de dentro de backend/)
const supabase = require('../../supabase');
const TID = 7;

(async () => {
  if (!supabase) { console.error('SEM supabase'); process.exit(1); }

  const { data: players } = await supabase.from('players')
    .select('id_player,name,side,category_id,active').eq('id_tournament', TID);
  const nameById = {}, sideById = {}, catById = {};
  players.forEach(p => { nameById[p.id_player]=p.name; sideById[p.id_player]=p.side; catById[p.id_player]=p.category_id; });

  const hits = players.filter(p => /bernardo/i.test(p.name));
  console.log('Jogadores "Bernardo":', hits.map(p=>`${p.name} (id ${p.id_player}, side ${p.side}, cat ${p.category_id}, active ${p.active})`).join(' | ') || '(nenhum)');
  const B = hits[0];
  if (!B) { console.error('Bernardo nao encontrado'); process.exit(1); }
  const BID = B.id_player;

  const { data: cats } = await supabase.from('categories').select('id_category,name').eq('id_tournament', TID);
  const catName = {}; (cats||[]).forEach(c => catName[c.id_category]=c.name);
  console.log(`\n>>> ${B.name} | id ${BID} | side ${B.side} | cat ${B.category_id} (${catName[B.category_id]||''}) | active ${B.active}\n`);

  const { data: rounds } = await supabase.from('rounds')
    .select('id_round,scheduled_date,id_category,status').eq('id_tournament', TID);
  const rd = {}; rounds.forEach(r => rd[r.id_round]=r);

  const { data: dbls } = await supabase.from('doubles')
    .select('id_double,id_round,id_player1,id_player2,display_name').eq('id_tournament', TID);
  const dblById = {}; dbls.forEach(d => dblById[d.id_double]=d);
  const dids = dbls.map(d => d.id_double);

  async function matchesForDoubles(field) {
    let out = [];
    for (let i=0;i<dids.length;i+=200) {
      const { data } = await supabase.from('matches').select('*').in(field, dids.slice(i,i+200));
      out = out.concat(data||[]);
    }
    return out;
  }
  const mA = await matchesForDoubles('id_double_a');
  const mB = await matchesForDoubles('id_double_b');
  const byId = {}; [...mA, ...mB].forEach(m => byId[m.id_match]=m);
  const all = Object.values(byId);

  function roundOf(m){ const da=dblById[m.id_double_a], db=dblById[m.id_double_b]; return rd[da&&da.id_round] || rd[db&&db.id_round] || {}; }
  function hhmm(m){ return String(m.scheduled_at||'').slice(11,16); }

  const bDblIds = new Set(dbls.filter(d => d.id_player1===BID || d.id_player2===BID).map(d=>d.id_double));
  const bMatches = all.filter(m => bDblIds.has(m.id_double_a) || bDblIds.has(m.id_double_b))
    .sort((a,b)=>String(roundOf(a).scheduled_date+ (a.scheduled_at||'')).localeCompare(String(roundOf(b).scheduled_date+(b.scheduled_at||''))));

  function partnerAndOpp(m){
    const meDbl = (dblById[m.id_double_a] && (dblById[m.id_double_a].id_player1===BID||dblById[m.id_double_a].id_player2===BID)) ? dblById[m.id_double_a] : dblById[m.id_double_b];
    const oppDbl = meDbl.id_double===m.id_double_a ? dblById[m.id_double_b] : dblById[m.id_double_a];
    const partnerId = meDbl.id_player1===BID ? meDbl.id_player2 : meDbl.id_player1;
    return { partner: nameById[partnerId]||partnerId, opp: oppDbl&&oppDbl.display_name };
  }

  const futuros = bMatches.filter(m => m.status==='TO_PLAY' || m.status==='CALLING');
  const jogados = bMatches.filter(m => m.status==='FINISHED' || m.status==='WO');

  console.log(`=== JOGOS PREVISTOS (a jogar) do ${B.name}: ${futuros.length} ===`);
  for (const m of futuros) {
    const r = roundOf(m); const pa = partnerAndOpp(m);
    console.log(`#${m.id_match} | ${r.scheduled_date} ${hhmm(m)} | quadra ${m.id_court} | cat ${r.id_category} | ${m.status}`);
    console.log(`     dupla: ${B.name} / ${pa.partner}   ×   ${pa.opp}`);
  }

  console.log(`\n=== JA JOGADOS: ${jogados.length} ===`);
  for (const m of jogados) {
    const r = roundOf(m); const pa = partnerAndOpp(m);
    console.log(`#${m.id_match} | ${r.scheduled_date} ${hhmm(m)} | ${m.status} | placar ${m.score_a}x${m.score_b} | ${B.name}/${pa.partner} × ${pa.opp}`);
  }

  const { data: abs } = await supabase.from('player_absences').select('*').eq('id_tournament', TID).eq('id_player', BID);
  console.log(`\n=== Ausencias registradas: ${(abs||[]).length} ===`, (abs||[]).map(a=>a.absence_date).join(', ') || '(nenhuma)');

  process.exit(0);
})();
