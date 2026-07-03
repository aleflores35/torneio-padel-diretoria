// TESTE ISOLADO do confirmRound com a REGRA FINAL (zero repetição + quem não tem jogo limpo
// fica de FORA). Cria round DESCARTÁVEL numa data distante (não toca produção), roda o
// confirmRound REAL e verifica: (1) todo jogo criado é 100% limpo (od pré==0); (2) jogos
// disjuntos; (3) leftover = present\jogando, marcado ROTATED, e == friendly_suggestions;
// (4) Nara(701) se jogar fica >=20:30; (5) nº de jogos == planCleanGames (integração bate
// com a função pura). Depois LIMPA tudo (revert contadores + delete round).
// Uso: node scripts/investigacao/test_confirmround_zero_fora.js
const assert = require('assert');
const supabase = require('../../supabase');
const { confirmRound, buildRealDiag, planCleanGames } = require('../../services/weeklyDrawService');
const T = 7, DATE = '2027-06-03', NARA = 701;
const CAT = Number(process.env.TEST_CAT || 3);
const key = (a, b) => a < b ? `${a}-${b}` : `${b}-${a}`;
// Default: 8 do Feminino (saturado → 0 jogos, todos fora). TEST_PAIRS força outro cenário.
// Set parcial (Masc Inic): TEST_CAT=1 TEST_PAIRS='[[647,671],[650,659],[651,670],[652,664]]' → 1 jogo + 4 fora.
const PAIRS0 = process.env.TEST_PAIRS ? JSON.parse(process.env.TEST_PAIRS) : [[707, 699], [697, 701], [692, 703], [695, 698]];

async function run() {
  let roundId = null;
  try {
    const ids = PAIRS0.flat();
    const { data: pl } = await supabase.from('players').select('id_player,name,side').in('id_player', ids);
    const P = {}, S = {}; pl.forEach(p => { P[p.id_player] = p.name; S[p.id_player] = p.side; });

    const { data: r } = await supabase.from('rounds').insert({
      id_tournament: T, id_category: CAT, round_number: 999, scheduled_date: DATE,
      window_start: '18:30', window_end: '22:00', status: 'DRAFT', round_type: 'REGULAR',
    }).select().single();
    roundId = r.id_round;
    console.log('round de teste:', roundId);

    for (const [a, b] of PAIRS0)
      await supabase.from('doubles').insert({ id_tournament: T, id_player1: a, id_player2: b, display_name: `${P[a]} / ${P[b]}`, id_round: roundId });
    await supabase.from('round_attendance').insert(ids.map(id => ({ id_round: roundId, id_player: id, status: 'NO_RESPONSE' })));

    // ── confirmRound REAL ──
    const result = await confirmRound(roundId);
    console.log('matches_created:', result.matches_created, '· friendly_suggestions:', (result.friendly_suggestions || []).map(f => f.name).join(', ') || '(nenhum)');

    // estado pós + od pré (excluindo o round de teste)
    const { data: dbl } = await supabase.from('doubles').select('*').eq('id_round', roundId);
    const D = {}; dbl.forEach(d => D[d.id_double] = d);
    const { data: matches } = await supabase.from('matches').select('id_double_a,id_double_b,scheduled_at').in('id_double_a', dbl.map(d => d.id_double));
    const { oppMap } = await buildRealDiag(T, CAT, { excludeRoundId: roundId });
    const od = (a, b) => oppMap[key(a, b)] || 0;

    const present = ids;
    const playing = new Set();
    let cleanViol = 0;
    for (const m of matches) {
      const a = D[m.id_double_a], b = D[m.id_double_b];
      [a.id_player1, a.id_player2, b.id_player1, b.id_player2].forEach(p => playing.add(p));
      for (const pa of [a.id_player1, a.id_player2]) for (const pb of [b.id_player1, b.id_player2]) if (od(pa, pb) > 0) cleanViol++;
      console.log(`  ${(m.scheduled_at || '').substring(11, 16)} ${a.display_name} × ${b.display_name}`);
    }
    const benched = present.filter(p => !playing.has(p));
    console.log(`  fora: ${benched.map(i => P[i]).join(', ') || '(ninguém)'}`);

    // ROTATED no banco
    const { data: att } = await supabase.from('round_attendance').select('id_player,status').eq('id_round', roundId);
    const rotated = (att || []).filter(a => a.status === 'ROTATED').map(a => a.id_player).sort((x, y) => x - y);
    const fsIds = (result.friendly_suggestions || []).map(f => f.id_player).sort((x, y) => x - y);

    // referência: a função pura com os mesmos inputs
    const rights = present.filter(i => S[i] === 'RIGHT'), lefts = present.filter(i => S[i] === 'LEFT');
    const { data: parts } = await supabase.from('partnerships').select('id_player1,id_player2,times_paired').eq('id_tournament', T).eq('id_category', CAT);
    const pdMap = {}; (parts || []).forEach(p => pdMap[key(p.id_player1, p.id_player2)] = p.times_paired || 0);
    const expected = planCleanGames(rights, lefts, od, (a, b) => pdMap[key(a, b)] || 0, S);

    // ── asserts ──
    assert.strictEqual(cleanViol, 0, `🔴 ${cleanViol} confronto(s) repetido(s) — regra zero quebrada`);
    assert.strictEqual(matches.length, result.matches_created, 'matches_created bate com o banco');
    assert.strictEqual(playing.size + benched.length, present.length, 'todos contabilizados (jogando + fora)');
    assert.deepStrictEqual(rotated, benched.slice().sort((x, y) => x - y), 'leftover == ROTATED no banco');
    assert.deepStrictEqual(fsIds, benched.slice().sort((x, y) => x - y), 'leftover == friendly_suggestions');
    assert.strictEqual(matches.length, expected.rankingGames.length, 'nº de jogos == planCleanGames (integração bate com função pura)');
    // disjunto: nenhum jogador em 2 jogos
    const flat = matches.flatMap(m => [D[m.id_double_a].id_player1, D[m.id_double_a].id_player2, D[m.id_double_b].id_player1, D[m.id_double_b].id_player2]);
    assert.strictEqual(flat.length, new Set(flat).size, 'nenhum jogador em 2 jogos');
    // Nara >= 20:30 se jogar
    if (playing.has(NARA)) {
      const nm = matches.find(m => [D[m.id_double_a].id_player1, D[m.id_double_a].id_player2, D[m.id_double_b].id_player1, D[m.id_double_b].id_player2].includes(NARA));
      assert.ok((nm.scheduled_at || '').substring(11, 16) >= '20:30', `🔴 Nara em ${(nm.scheduled_at || '').substring(11, 16)} (<20:30)`);
    }
    console.log('\n✅ confirmRound (regra final) OK: zero repetição · leftover fora/ROTATED · friendly_suggestions · Nara>=20:30 · bate com planCleanGames.');
  } finally {
    if (roundId) {
      for (const tbl of ['partnerships', 'oppositions']) {
        const { data: rows } = await supabase.from(tbl).select('*').eq('id_tournament', T).eq('id_category', CAT).eq('last_round_id', roundId);
        for (const row of rows || []) {
          if (tbl === 'partnerships') {
            if (row.times_paired <= 1) await supabase.from(tbl).delete().eq('id_partnership', row.id_partnership);
            else await supabase.from(tbl).update({ times_paired: row.times_paired - 1, last_round_id: null }).eq('id_partnership', row.id_partnership);
          } else {
            if (row.times_opposed <= 1) await supabase.from(tbl).delete().eq('id_opposition', row.id_opposition);
            else await supabase.from(tbl).update({ times_opposed: row.times_opposed - 1, diagonal_count: Math.max(0, (row.diagonal_count || 0) - 1), last_round_id: null }).eq('id_opposition', row.id_opposition);
          }
        }
      }
      const { data: dbl } = await supabase.from('doubles').select('id_double').eq('id_round', roundId);
      if (dbl && dbl.length) await supabase.from('matches').delete().in('id_double_a', dbl.map(d => d.id_double));
      await supabase.from('doubles').delete().eq('id_round', roundId);
      await supabase.from('round_attendance').delete().eq('id_round', roundId);
      await supabase.from('rounds').delete().eq('id_round', roundId);
      console.log('🧹 cleanup feito (round de teste removido).');
    }
  }
}
run().catch(e => { console.error('ERRO:', e.message); process.exit(1); });
