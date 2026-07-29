// SESSÃO 27/07 — duas operações independentes:
//  (A) SAÍDA Cristiano Severo (653), Masc Iniciante RIGHT — lesão, pediu pra sair (definitivo).
//      Régua desistência ≥50% (8 jogados de 14 = 57%; 10/14=71% se os 2 de 23/07 tiverem rolado)
//      + correção W40: NÃO virar exhibition. Jogados seguem REGULAR pontuando terceiros.
//      → DELETE dos 4 futuros de AGOSTO (13/08 x2, 20/08 x2) + active=false.
//      → Os 2 de 23/07 (#1417, #1454) ficam INTOCADOS (pendentes de placar; Alessandro vai confirmar se rolaram).
//  (B) MOVE #1418 (Nelson Paiva/Alessandro Flores × Eduardo Horbach/Ivan Bartmann)
//      de 06/08 18:00 q16 → 13/08 18:30 q17 (Alessandro impossibilitado 30/07 e 06/08).
//      Move a PARTIDA INTEIRA (id_round das 2 duplas + scheduled_at + id_court). NÃO re-pareia.
//      ⚠️ NUNCA usar confirmRound pra isso — ele re-slota a noite inteira e re-sorteia adversários.
// DRY:  node scripts/investigacao/_saida_cristiano_e_move_1418.js
// REAL: CONFIRM_EXECUTE=yes node scripts/investigacao/_saida_cristiano_e_move_1418.js
const supabase = require('../../supabase');
const T = 7;
const DRY = process.env.CONFIRM_EXECUTE !== 'yes';

const CRISTIANO = 653;
const DEL_FUTURE = [1436, 1441, 1444, 1445];      // futuros de agosto do Cristiano
const MANTER = [1417, 1454];                       // 23/07 — não tocar nesta operação

const MOVE_ID = 1418;
const DEST_DATE = '2026-08-13';
const DEST_TIME = '18:30';
const DEST_COURT = 17;                             // Quadra de Parede
const CAT_MOVE = 2;                                // Masc 4ª (guarda)

(async () => {
  if (!supabase) { console.error('SEM supabase'); process.exit(1); }
  console.log(DRY ? '*** DRY-RUN (nada gravado) ***\n' : '*** EXECUTANDO (CONFIRM) ***\n');

  const { data: players } = await supabase.from('players').select('*').eq('id_tournament', T);
  const P = {}; players.forEach(p => P[p.id_player] = p);
  const { data: rounds } = await supabase.from('rounds').select('*').eq('id_tournament', T);
  const rd = {}; rounds.forEach(r => rd[r.id_round] = r);
  const { data: allDbls } = await supabase.from('doubles').select('*').eq('id_tournament', T);
  const dm = {}; allDbls.forEach(d => dm[d.id_double] = d);
  const nm = id => (P[id] ? P[id].name : id);

  let erros = 0;

  // ---------------- (A) SAÍDA CRISTIANO ----------------
  const { data: msDel } = await supabase.from('matches').select('*').in('id_match', DEL_FUTURE);
  const delById = {}; (msDel || []).forEach(m => delById[m.id_match] = m);

  console.log('=== (A1) FUTUROS DE AGOSTO DO CRISTIANO → DELETE ===');
  const afetados = new Set();
  for (const mid of DEL_FUTURE) {
    const m = delById[mid];
    if (!m) { console.log(`  #${mid} NAO ENCONTRADO — ABORTA`); erros++; continue; }
    const a = dm[m.id_double_a], b = dm[m.id_double_b];
    if (!a || !b) { console.log(`  #${mid} duplas ausentes — ABORTA`); erros++; continue; }
    const pl = [a.id_player1, a.id_player2, b.id_player1, b.id_player2];
    const r = rd[a.id_round] || {};
    if (!pl.includes(CRISTIANO)) { console.log(`  #${mid} ⚠ NAO tem Cristiano — ABORTA`); erros++; continue; }
    if (!['TO_PLAY', 'CALLING', 'IN_PROGRESS'].includes(m.status)) { console.log(`  #${mid} ⚠ status ${m.status} (nao futuro) — ABORTA`); erros++; continue; }
    if (!(String(r.scheduled_date) > '2026-07-27')) { console.log(`  #${mid} ⚠ data ${r.scheduled_date} nao e futura — ABORTA`); erros++; continue; }
    pl.filter(x => x !== CRISTIANO).forEach(x => afetados.add(x));
    console.log(`  #${mid} ${r.scheduled_date} ${String(m.scheduled_at).slice(11, 16)} q${m.id_court} | ${a.display_name} × ${b.display_name} → DELETE match + duplas ${m.id_double_a},${m.id_double_b}`);
  }
  console.log(`  MANTIDOS (23/07, pendentes de placar): ${MANTER.map(x => '#' + x).join(', ')}`);
  console.log(`  perdem 1 jogo: ${[...afetados].map(nm).sort().join(' · ')}`);

  // ---------------- (B) MOVE #1418 ----------------
  console.log('\n=== (B) MOVE #1418 → 13/08 18:30 Parede ===');
  const { data: msMv } = await supabase.from('matches').select('*').eq('id_match', MOVE_ID);
  const mv = (msMv || [])[0];
  let destRound = null, mvA = null, mvB = null;
  if (!mv) { console.log(`  #${MOVE_ID} NAO ENCONTRADO — ABORTA`); erros++; }
  else {
    mvA = dm[mv.id_double_a]; mvB = dm[mv.id_double_b];
    const pl = [mvA.id_player1, mvA.id_player2, mvB.id_player1, mvB.id_player2];
    const cats = new Set(pl.map(x => (P[x] || {}).category_id));
    const rOrig = rd[mvA.id_round] || {};
    // round destino: mesma data, REGULAR, CONFIRMED
    const cands = rounds.filter(r => r.scheduled_date === DEST_DATE && (r.round_type || 'REGULAR') === 'REGULAR');
    destRound = cands[0];
    if (mv.status !== 'TO_PLAY') { console.log(`  ⚠ status ${mv.status} != TO_PLAY — ABORTA`); erros++; }
    if (cats.size !== 1 || !cats.has(CAT_MOVE)) { console.log(`  ⚠ categorias ${[...cats]} != [${CAT_MOVE}] — ABORTA`); erros++; }
    if (mvA.id_round !== mvB.id_round) { console.log(`  ⚠ duplas em rounds diferentes (${mvA.id_round}/${mvB.id_round}) — ABORTA`); erros++; }
    if (!destRound) { console.log(`  ⚠ nenhum round REGULAR em ${DEST_DATE} — ABORTA`); erros++; }
    else console.log(`  origem: round ${mvA.id_round} (${rOrig.scheduled_date} ${String(mv.scheduled_at).slice(11, 16)} q${mv.id_court}) → destino: round ${destRound.id_round} (${DEST_DATE} ${DEST_TIME} q${DEST_COURT})`);
    console.log(`  jogo: ${mvA.display_name} × ${mvB.display_name}`);
    console.log(`  avisar da nova data: ${[...pl].filter(x => x !== 690).map(nm).join(' · ')}`);

    // colisão no destino (considerando os deletes de (A) já aplicados)
    if (destRound) {
      const destRoundIds = rounds.filter(r => r.scheduled_date === DEST_DATE).map(r => r.id_round);
      const dl = allDbls.filter(d => destRoundIds.includes(d.id_round)).map(d => d.id_double);
      let occ = [];
      for (const f of ['id_double_a', 'id_double_b']) {
        for (let i = 0; i < dl.length; i += 200) {
          const { data } = await supabase.from('matches').select('*').in(f, dl.slice(i, i + 200));
          occ = occ.concat(data || []);
        }
      }
      const uniq = {}; occ.forEach(m => uniq[m.id_match] = m);
      const vivos = Object.values(uniq).filter(m => !DEL_FUTURE.includes(m.id_match) && m.id_match !== MOVE_ID);
      const conflito = vivos.filter(m => String(m.scheduled_at).slice(11, 16) === DEST_TIME && m.id_court === DEST_COURT);
      console.log(`  ocupação ${DEST_DATE} pós-delete (${vivos.length} jogos): ` + vivos
        .sort((a, b) => String(a.scheduled_at).localeCompare(String(b.scheduled_at)))
        .map(m => `${String(m.scheduled_at).slice(11, 16)}/q${m.id_court}`).join(' '));
      if (conflito.length) { console.log(`  ⛔ COLISÃO em ${DEST_TIME} q${DEST_COURT}: ${conflito.map(m => '#' + m.id_match).join(',')} — ABORTA`); erros++; }
      else console.log(`  ✅ slot ${DEST_TIME} q${DEST_COURT} livre`);
      // conflito de atleta na noite (2 jogos no mesmo horário)
      for (const m of vivos) {
        const a = dm[m.id_double_a] || {}, b = dm[m.id_double_b] || {};
        const pls = [a.id_player1, a.id_player2, b.id_player1, b.id_player2];
        const inter = pl.filter(x => pls.includes(x));
        if (inter.length) console.log(`  ℹ️ ${inter.map(nm).join(',')} já joga #${m.id_match} ${String(m.scheduled_at).slice(11, 16)} nessa noite`);
      }
    }
  }

  if (erros) { console.log(`\n⛔ ${erros} problema(s) — NADA gravado.`); process.exit(1); }

  if (DRY) {
    console.log(`\n[DRY] OK. Rode com CONFIRM_EXECUTE=yes pra gravar.`);
    process.exit(0);
  }

  // ---- escrita ----
  for (const mid of DEL_FUTURE) {
    const m = delById[mid];
    const e1 = await supabase.from('matches').delete().eq('id_match', mid);
    const e2 = await supabase.from('doubles').delete().eq('id_double', m.id_double_a);
    const e3 = await supabase.from('doubles').delete().eq('id_double', m.id_double_b);
    if (e1.error || e2.error || e3.error) { console.log(`  [ERRO #${mid}] ${e1.error?.message || ''} ${e2.error?.message || ''} ${e3.error?.message || ''}`); process.exit(1); }
  }
  const eA = await supabase.from('players').update({ active: false }).eq('id_player', CRISTIANO);
  if (eA.error) { console.log(`  [ERRO inativar] ${eA.error.message}`); process.exit(1); }

  for (const did of [mv.id_double_a, mv.id_double_b]) {
    const e = await supabase.from('doubles').update({ id_round: destRound.id_round }).eq('id_double', did);
    if (e.error) { console.log(`  [ERRO dbl ${did}] ${e.error.message}`); process.exit(1); }
  }
  const eM = await supabase.from('matches')
    .update({ scheduled_at: `${DEST_DATE}T${DEST_TIME}:00+00:00`, id_court: DEST_COURT })
    .eq('id_match', MOVE_ID);
  if (eM.error) { console.log(`  [ERRO move] ${eM.error.message}`); process.exit(1); }

  // ---- asserts de re-leitura ----
  const { data: chk } = await supabase.from('matches').select('*').in('id_match', [...DEL_FUTURE, MOVE_ID]);
  const chkById = {}; (chk || []).forEach(m => chkById[m.id_match] = m);
  let ok = true;
  for (const mid of DEL_FUTURE) if (chkById[mid]) { console.log(`  ⚠ assert: #${mid} AINDA existe`); ok = false; }
  const m2 = chkById[MOVE_ID];
  if (!m2 || String(m2.scheduled_at).slice(0, 16) !== `${DEST_DATE}T${DEST_TIME}` || m2.id_court !== DEST_COURT) { console.log(`  ⚠ assert: #${MOVE_ID} nao bateu (${m2 && m2.scheduled_at} q${m2 && m2.id_court})`); ok = false; }
  const { data: d2 } = await supabase.from('doubles').select('*').in('id_double', [mv.id_double_a, mv.id_double_b]);
  (d2 || []).forEach(d => { if (d.id_round !== destRound.id_round) { console.log(`  ⚠ assert: dbl ${d.id_double} round ${d.id_round} != ${destRound.id_round}`); ok = false; } });
  const { data: p2 } = await supabase.from('players').select('active').eq('id_player', CRISTIANO);
  if ((p2 || [])[0] && (p2[0].active !== false)) { console.log(`  ⚠ assert: Cristiano ainda active`); ok = false; }

  console.log(ok
    ? `\n✅ EXECUTADO + asserts OK. 4 futuros deletados · Cristiano(653) inativado · #1418 → 13/08 18:30 Parede.`
    : `\n⚠️ EXECUTADO com asserts falhando — CONFERIR (backup disponível).`);
  process.exit(0);
})();
