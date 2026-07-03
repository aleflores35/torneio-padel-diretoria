// Re-sorteia um ROUND sob a regra dura, usando planRankingGames (testado).
//   Regra 1 (inviolável): direita×direita e esquerda×esquerda NUNCA repetem.
//   Regra 2 (flexível): parceria preferencialmente inédita (desempate).
// Jogos 100% inéditos viram ranking (REGULAR); quem sobra (leftover) sai do ranking
// e vira ROTATED + é reportado pra sugerir AMISTOSO (admin cria se quiser).
// Reusa os slots (scheduled_at/id_court) dos matches atuais do round (não re-sloteia
// a noite → não toca nas outras categorias). Reverte e recarimba contadores.
//
// DRY:  node scripts/investigacao/resorteia_regra_dura.js <id_round>
// REAL: CONFIRM_EXECUTE=yes node scripts/investigacao/resorteia_regra_dura.js <id_round>
const supabase = require('../../supabase');
const { planRankingGames } = require('../../services/weeklyDrawService');

const ROUND = Number(process.argv[2]);
const DRY = process.env.CONFIRM_EXECUTE !== 'yes';
const key = (a, b) => (a < b ? `${a}-${b}` : `${b}-${a}`);

async function main() {
  if (!ROUND) throw new Error('uso: node resorteia_regra_dura.js <id_round>');
  const { data: round } = await supabase.from('rounds').select('*').eq('id_round', ROUND).single();
  if (!round) throw new Error('round não encontrado');
  const T = round.id_tournament, CAT = round.id_category;

  const { data: dbl } = await supabase.from('doubles').select('*').eq('id_round', ROUND);
  const { data: matches } = await supabase.from('matches')
    .select('id_match,id_double_a,id_double_b,scheduled_at,id_court,status').in('id_double_a', dbl.map(d => d.id_double));
  const dById = {}; dbl.forEach(d => dById[d.id_double] = d);

  // jogadores presentes (das duplas), com side/name
  const pids = [...new Set(dbl.flatMap(d => [d.id_player1, d.id_player2]))];
  const { data: pl } = await supabase.from('players').select('id_player,name,side').in('id_player', pids);
  const P = {}; pl.forEach(p => P[p.id_player] = p);

  // confrontos mesma-posição ATUAIS (carimbados por este round) e parcerias atuais (p/ desconto)
  const confrontoAtual = new Set();
  const parceriaAtual = new Set();
  for (const m of matches) {
    const a = dById[m.id_double_a], b = dById[m.id_double_b];
    parceriaAtual.add(key(a.id_player1, a.id_player2));
    parceriaAtual.add(key(b.id_player1, b.id_player2));
    for (const pa of [a.id_player1, a.id_player2]) for (const pb of [b.id_player1, b.id_player2])
      if (P[pa].side === P[pb].side && P[pa].side !== 'EITHER') confrontoAtual.add(key(pa, pb));
  }

  // diag pré-jogo (desconta carimbo deste round)
  const oppCache = {};
  async function oppRow(a, b) {
    const p1 = Math.min(a, b), p2 = Math.max(a, b), k = `${p1}-${p2}`;
    if (oppCache[k] !== undefined) return oppCache[k];
    const { data } = await supabase.from('oppositions').select('diagonal_count')
      .eq('id_tournament', T).eq('id_category', CAT).eq('id_player1', p1).eq('id_player2', p2).maybeSingle();
    return (oppCache[k] = data ? data.diagonal_count : 0);
  }
  // pré-carrega diag de todos os pares mesma-posição
  const rights = pids.filter(i => P[i].side === 'RIGHT').map(i => ({ id_player: i, name: P[i].name }));
  const lefts  = pids.filter(i => P[i].side === 'LEFT').map(i => ({ id_player: i, name: P[i].name }));
  const diagMap = {};
  for (const arr of [rights, lefts]) for (let i = 0; i < arr.length; i++) for (let j = i + 1; j < arr.length; j++) {
    const a = arr[i].id_player, b = arr[j].id_player;
    let d = await oppRow(a, b);
    if (confrontoAtual.has(key(a, b))) d = Math.max(0, d - 1); // desconta este round
    diagMap[key(a, b)] = d;
  }
  const diag = (a, b) => diagMap[key(a, b)] ?? 0;

  // parceria pré-jogo (p/ regra 2)
  async function pairedPre(a, b) {
    const p1 = Math.min(a, b), p2 = Math.max(a, b);
    const { data } = await supabase.from('partnerships').select('times_paired')
      .eq('id_tournament', T).eq('id_category', CAT).eq('id_player1', p1).eq('id_player2', p2).maybeSingle();
    let v = data ? data.times_paired : 0;
    if (parceriaAtual.has(key(a, b))) v = Math.max(0, v - 1);
    return v;
  }

  // ── plano de jogos de ranking (Regra 1) ───────────────────────────────────
  const plan = planRankingGames(rights, lefts, diag);

  // ── duplas por jogo minimizando parceria (Regra 2) ────────────────────────
  const games = [];
  for (const g of plan.rankingGames) {
    const [r1, r2] = g.right, [l1, l2] = g.left;
    const costX = (await pairedPre(r1, l1)) + (await pairedPre(r2, l2));
    const costY = (await pairedPre(r1, l2)) + (await pairedPre(r2, l1));
    const duplas = costX <= costY
      ? [{ p1: r1, p2: l1 }, { p1: r2, p2: l2 }]
      : [{ p1: r1, p2: l2 }, { p1: r2, p2: l1 }];
    games.push(duplas);
  }

  // slots reusados dos matches atuais (ordenados por hora)
  const slots = matches.filter(m => m.scheduled_at).map(m => ({ scheduled_at: m.scheduled_at, id_court: m.id_court }))
    .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));

  const leftoverIds = [...plan.leftover.rights, ...plan.leftover.lefts];

  // ── relatório ──────────────────────────────────────────────────────────────
  const nm = id => `${P[id].name}[${P[id].side[0]}]`;
  console.log(`\n=== RE-SORTEIO round ${ROUND} (cat ${CAT}) · ${DRY ? 'DRY-RUN' : 'EXECUTANDO'} ===`);
  console.log(`presentes: ${rights.length} dir · ${lefts.length} esq · slots reusáveis: ${slots.length}`);
  console.log(`\nJOGOS DE RANKING (100% inéditos): ${games.length}`);
  games.forEach((g, i) => {
    const s = slots[i];
    console.log(`  ${s ? s.scheduled_at.substring(11,16) : '⚠ SEM SLOT'} · ${nm(g[0].p1)}/${nm(g[0].p2)} × ${nm(g[1].p1)}/${nm(g[1].p2)}`);
  });
  console.log(`\nSEM ADVERSÁRIO INÉDITO (→ ROTATED, sugerir amistoso): ${leftoverIds.length}`);
  leftoverIds.forEach(id => console.log(`  ${nm(id)}`));
  if (games.length > slots.length) console.log('\n⚠️ mais jogos que slots reusáveis — abortaria; revisar.');

  if (DRY) { console.log('\n[DRY] nada gravado.'); return; }
  if (games.length > slots.length) throw new Error('jogos > slots; abortado por segurança');

  // ── EXECUÇÃO ────────────────────────────────────────────────────────────────
  // 1) reverte contadores carimbados neste round
  for (const tbl of ['partnerships', 'oppositions']) {
    const { data: rows } = await supabase.from(tbl).select('*').eq('id_tournament', T).eq('id_category', CAT).eq('last_round_id', ROUND);
    for (const r of rows || []) {
      if (tbl === 'partnerships') {
        if (r.times_paired <= 1) await supabase.from(tbl).delete().eq('id_partnership', r.id_partnership);
        else await supabase.from(tbl).update({ times_paired: r.times_paired - 1, last_round_id: null }).eq('id_partnership', r.id_partnership);
      } else {
        if (r.times_opposed <= 1) await supabase.from(tbl).delete().eq('id_opposition', r.id_opposition);
        else await supabase.from(tbl).update({ times_opposed: r.times_opposed - 1, diagonal_count: Math.max(0, (r.diagonal_count || 0) - 1), last_round_id: null }).eq('id_opposition', r.id_opposition);
      }
    }
  }
  // 2) apaga matches e duplas antigas do round
  await supabase.from('matches').delete().in('id_double_a', dbl.map(d => d.id_double));
  await supabase.from('doubles').delete().eq('id_round', ROUND);

  // 3) cria duplas novas + matches REGULAR nos slots reusados
  for (let i = 0; i < games.length; i++) {
    const g = games[i], s = slots[i];
    const mk = async (p) => {
      const { data } = await supabase.from('doubles').insert({
        id_tournament: T, id_player1: p.p1, id_player2: p.p2,
        display_name: `${P[p.p1].name} / ${P[p.p2].name}`, id_round: ROUND,
      }).select().single();
      return data.id_double;
    };
    const da = await mk(g[0]), db = await mk(g[1]);
    await supabase.from('matches').insert({
      id_tournament: T, id_double_a: da, id_double_b: db,
      id_court: s.id_court, scheduled_at: s.scheduled_at, status: 'TO_PLAY',
    });
  }

  // 4) attendance: ranking → NO_RESPONSE; leftover → ROTATED (não toca ausentes/rotated originais externos)
  const rankingIds = games.flatMap(g => [g[0].p1, g[0].p2, g[1].p1, g[1].p2]);
  await supabase.from('round_attendance').delete().eq('id_round', ROUND).in('id_player', pids);
  const att = [
    ...rankingIds.map(id => ({ id_round: ROUND, id_player: id, status: 'NO_RESPONSE' })),
    ...leftoverIds.map(id => ({ id_round: ROUND, id_player: id, status: 'ROTATED' })),
  ];
  await supabase.from('round_attendance').insert(att);

  // 5) recarimba contadores só do ranking
  for (let i = 0; i < games.length; i++) {
    const g = games[i];
    for (const d of g) {
      const p1 = Math.min(d.p1, d.p2), p2 = Math.max(d.p1, d.p2);
      const { data: ex } = await supabase.from('partnerships').select('id_partnership,times_paired').eq('id_tournament', T).eq('id_category', CAT).eq('id_player1', p1).eq('id_player2', p2).maybeSingle();
      if (ex) await supabase.from('partnerships').update({ times_paired: ex.times_paired + 1, last_round_id: ROUND }).eq('id_partnership', ex.id_partnership);
      else await supabase.from('partnerships').insert({ id_tournament: T, id_category: CAT, id_player1: p1, id_player2: p2, times_paired: 1, last_round_id: ROUND });
    }
    const [da, db] = g;
    for (const pa of [da.p1, da.p2]) for (const pb of [db.p1, db.p2]) {
      const p1 = Math.min(pa, pb), p2 = Math.max(pa, pb);
      const isDiag = P[pa].side === P[pb].side && P[pa].side !== 'EITHER';
      const { data: ex } = await supabase.from('oppositions').select('id_opposition,times_opposed,diagonal_count').eq('id_tournament', T).eq('id_category', CAT).eq('id_player1', p1).eq('id_player2', p2).maybeSingle();
      if (ex) await supabase.from('oppositions').update({ times_opposed: ex.times_opposed + 1, diagonal_count: ex.diagonal_count + (isDiag ? 1 : 0), last_round_id: ROUND }).eq('id_opposition', ex.id_opposition);
      else await supabase.from('oppositions').insert({ id_tournament: T, id_category: CAT, id_player1: p1, id_player2: p2, times_opposed: 1, diagonal_count: isDiag ? 1 : 0, last_round_id: ROUND });
    }
  }
  console.log('\n✅ aplicado.');
}
main().catch(e => { console.error(e); process.exit(1); });
