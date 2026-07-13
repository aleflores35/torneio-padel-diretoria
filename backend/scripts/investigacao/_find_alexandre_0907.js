// READ-ONLY: situação do Alexandre Gonzaga na quinta 09/07 + mapa da noite.
// Contexto: atleta quer jogar o das 19:50 e (a) adiantar o 20:30 -> 19:10, ou (b) ser substituído, ou (c) adiar.
const supabase = require('../../supabase');
const TID = 7;
const ALVO_DATA = '2026-07-09';

(async () => {
  if (!supabase) { console.error('SEM supabase'); process.exit(1); }

  const { data: players } = await supabase.from('players')
    .select('id_player,name,side,category_id,active').eq('id_tournament', TID);
  const nameById = {}; const sideById = {}; const catById = {}; const activeById = {};
  players.forEach(p => { nameById[p.id_player] = p.name; sideById[p.id_player] = p.side; catById[p.id_player] = p.category_id; activeById[p.id_player] = p.active; });

  const alex = players.filter(p => /alexandre/i.test(p.name) && /gonzaga/i.test(p.name));
  const alexAny = players.filter(p => /alexandre/i.test(p.name));
  console.log('Match "Alexandre Gonzaga":', alex.map(p=>`${p.name} (id ${p.id_player}, side ${p.side}, cat ${p.category_id}, active ${p.active})`).join(' | ') || '(nenhum)');
  console.log('Todos "Alexandre":', alexAny.map(p=>`${p.name} (id ${p.id_player}, cat ${p.category_id})`).join(' | '));
  const AID = (alex[0] && alex[0].id_player) || (alexAny[0] && alexAny[0].id_player);
  if (!AID) { console.error('Alexandre nao encontrado'); process.exit(1); }
  const CAT = catById[AID];
  console.log(`\n>>> Alexandre id ${AID}, side ${sideById[AID]}, categoria ${CAT}\n`);

  const { data: rounds } = await supabase.from('rounds')
    .select('id_round,scheduled_date,id_category').eq('id_tournament', TID);
  const rd = {}; rounds.forEach(r => rd[r.id_round] = r);

  const { data: dbls } = await supabase.from('doubles')
    .select('id_double,id_round,id_player1,id_player2,display_name').eq('id_tournament', TID);
  const dblById = {}; dbls.forEach(d => dblById[d.id_double] = d);

  const dids = dbls.map(d => d.id_double);
  // pega matches em blocos pra evitar limite
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
  const byId = {}; [...mA, ...mB].forEach(m => byId[m.id_match] = m);
  const all = Object.values(byId);

  function roundOf(m){ const da=dblById[m.id_double_a], db=dblById[m.id_double_b]; return rd[da&&da.id_round] || rd[db&&db.id_round] || {}; }
  function dateOf(m){ return roundOf(m).scheduled_date; }
  function hhmm(m){ return String(m.scheduled_at||'').slice(11,16); }
  function fourNames(m){ const da=dblById[m.id_double_a], db=dblById[m.id_double_b];
    return { a: da, b: db,
      players: [da&&da.id_player1, da&&da.id_player2, db&&db.id_player1, db&&db.id_player2].filter(Boolean) }; }

  // ---- jogos do Alexandre (todos, com foco 09/07) ----
  const alexDblIds = new Set(dbls.filter(d => d.id_player1===AID || d.id_player2===AID).map(d=>d.id_double));
  const alexMatches = all.filter(m => alexDblIds.has(m.id_double_a) || alexDblIds.has(m.id_double_b))
    .sort((a,b)=>String(a.scheduled_at||'').localeCompare(String(b.scheduled_at||'')));
  console.log(`=== TODOS os jogos do Alexandre (${alexMatches.length}) ===`);
  for (const m of alexMatches) {
    const r = roundOf(m); const f = fourNames(m);
    const partnerDbl = (dblById[m.id_double_a] && (dblById[m.id_double_a].id_player1===AID||dblById[m.id_double_a].id_player2===AID)) ? dblById[m.id_double_a] : dblById[m.id_double_b];
    const partnerId = partnerDbl.id_player1===AID ? partnerDbl.id_player2 : partnerDbl.id_player1;
    const flag = r.scheduled_date===ALVO_DATA ? '  <== QUINTA 09/07' : '';
    console.log(`#${m.id_match} | ${r.scheduled_date} ${hhmm(m)} | quadra ${m.id_court} | cat ${r.id_category} | ${m.status} | parceiro: ${nameById[partnerId]||partnerId}${flag}`);
    console.log(`     ${f.a&&f.a.display_name} X ${f.b&&f.b.display_name}`);
  }

  // ---- ausencias do Alexandre ----
  const { data: abs } = await supabase.from('player_absences').select('*').eq('id_tournament', TID).eq('id_player', AID);
  console.log(`\n=== Ausencias do Alexandre (${(abs||[]).length}) ===`, (abs||[]).map(a=>a.absence_date).join(', '));

  // ---- mapa da noite 09/07 (todas categorias) ----
  const noite = all.filter(m => dateOf(m)===ALVO_DATA).sort((a,b)=>String(a.scheduled_at||'').localeCompare(String(b.scheduled_at||'')));
  console.log(`\n=== GRADE COMPLETA 09/07 (${noite.length} jogos) ===`);
  const porSlot = {};
  for (const m of noite) {
    const r = roundOf(m);
    const key = hhmm(m);
    (porSlot[key] = porSlot[key]||[]).push(m);
    console.log(`#${m.id_match} | ${key} | quadra ${m.id_court} | cat ${r.id_category} | ${m.status} | ${dblById[m.id_double_a].display_name} X ${dblById[m.id_double_b].display_name}`);
  }

  // ---- foco: o jogo das 20:30 do Alexandre + viabilidade de 19:10 ----
  const jogo2030 = alexMatches.find(m => dateOf(m)===ALVO_DATA && hhmm(m)==='20:30');
  const jogo1950 = alexMatches.find(m => dateOf(m)===ALVO_DATA && hhmm(m)==='19:50');
  console.log(`\n=== ANALISE DO PEDIDO ===`);
  console.log(`Jogo 19:50 (fica): ${jogo1950? '#'+jogo1950.id_match+' quadra '+jogo1950.id_court+' | '+dblById[jogo1950.id_double_a].display_name+' X '+dblById[jogo1950.id_double_b].display_name : 'NAO ACHADO'}`);
  console.log(`Jogo 20:30 (mover/subst): ${jogo2030? '#'+jogo2030.id_match+' quadra '+jogo2030.id_court+' | '+dblById[jogo2030.id_double_a].display_name+' X '+dblById[jogo2030.id_double_b].display_name : 'NAO ACHADO'}`);

  if (jogo2030) {
    const f = fourNames(jogo2030);
    console.log(`\n-- Os 4 do jogo 20:30 e o que cada um joga em 09/07 --`);
    for (const pid of f.players) {
      const jogosNoite = noite.filter(m => { const ff=fourNames(m); return ff.players.includes(pid); })
        .map(m => `${hhmm(m)}(q${m.id_court} #${m.id_match})`);
      console.log(`  ${nameById[pid]} (id ${pid}, side ${sideById[pid]}, cat ${catById[pid]}) -> ${jogosNoite.join(', ')}`);
    }
    // quem ocupa o slot 19:10 e quais quadras usadas
    const slot1910 = porSlot['19:10']||[];
    console.log(`\n-- Slot 19:10 em 09/07 --`);
    console.log(`  jogos: ${slot1910.length}; quadras ocupadas: ${slot1910.map(m=>m.id_court).join(', ') || '(nenhuma)'}`);
    console.log(`  detalhe: ${slot1910.map(m=>`q${m.id_court} ${dblById[m.id_double_a].display_name} X ${dblById[m.id_double_b].display_name}`).join(' | ')}`);
    // algum dos 4 ja joga 19:10?
    const conflito1910 = f.players.filter(pid => slot1910.some(m => fourNames(m).players.includes(pid)));
    console.log(`  DOS 4, ja escalados 19:10 (=colisao se mover): ${conflito1910.map(pid=>nameById[pid]).join(', ') || 'NENHUM (mover pra 19:10 nao colide p/ ninguem do jogo)'}`);
  }

  process.exit(0);
})();
