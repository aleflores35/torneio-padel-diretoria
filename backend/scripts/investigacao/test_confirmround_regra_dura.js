// TESTE ISOLADO do confirmRound com a regra dura. Cria um round DESCARTÁVEL numa data
// sem outros jogos (não toca produção), roda confirmRound real, verifica que cada jogo
// criado é 100% inédito (diag pré==0) + friendly_suggestions, e LIMPA tudo (revert + delete).
// Uso: node scripts/investigacao/test_confirmround_regra_dura.js
const supabase = require('../../supabase');
const { confirmRound } = require('../../services/weeklyDrawService');
const T = 7, CAT = 3, DATE = '2027-06-03'; // data distante, sem outros rounds
const key = (a, b) => a < b ? `${a}-${b}` : `${b}-${a}`;

// 8 do Feminino (4R+4L) — duplas iniciais arbitrárias (confirmRound re-compõe)
const PAIRS0 = [[707, 699], [697, 701], [692, 703], [695, 698]];

async function diagPre(a, b) {
  const p1 = Math.min(a, b), p2 = Math.max(a, b);
  const { data } = await supabase.from('oppositions').select('diagonal_count')
    .eq('id_tournament', T).eq('id_category', CAT).eq('id_player1', p1).eq('id_player2', p2).maybeSingle();
  return data ? data.diagonal_count : 0;
}

async function run() {
  let roundId = null;
  try {
    // snapshot dos diags pré (pra checar inédito depois, sem o carimbo do teste)
    const ids = PAIRS0.flat();
    const { data: pl } = await supabase.from('players').select('id_player,name,side').in('id_player', ids);
    const P = {}; pl.forEach(p => P[p.id_player] = p);
    const preDiag = {};
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++)
      if (P[ids[i]].side === P[ids[j]].side) preDiag[key(ids[i], ids[j])] = await diagPre(ids[i], ids[j]);

    // cria round DRAFT
    const { data: r } = await supabase.from('rounds').insert({
      id_tournament: T, id_category: CAT, round_number: 999, scheduled_date: DATE,
      window_start: '18:30', window_end: '22:00', status: 'DRAFT', round_type: 'REGULAR',
    }).select().single();
    roundId = r.id_round;
    console.log('round de teste criado:', roundId);

    // duplas + attendance
    for (const [a, b] of PAIRS0) {
      await supabase.from('doubles').insert({ id_tournament: T, id_player1: a, id_player2: b, display_name: `${P[a].name} / ${P[b].name}`, id_round: roundId });
    }
    await supabase.from('round_attendance').insert(ids.map(id => ({ id_round: roundId, id_player: id, status: 'NO_RESPONSE' })));

    // ── roda confirmRound REAL ──
    const result = await confirmRound(roundId);
    console.log('\nconfirmRound OK. friendly_suggestions:', JSON.stringify(result.friendly_suggestions));
    console.log('matches_created:', result.matches_created);

    // Critério novo (23/06): minimiza repetição (sempre joga). Verifica:
    //  (1) criou jogos pra TODAS as 8 (sem leftover/amistoso por saturação);
    //  (2) o nº de repetições mesma-posição é o MÍNIMO possível entre os pareamentos das duplas.
    const { data: dbl } = await supabase.from('doubles').select('*').eq('id_round', roundId);
    const dById = {}; dbl.forEach(d => dById[d.id_double] = d);
    const { data: matches } = await supabase.from('matches').select('id_double_a,id_double_b').in('id_double_a', dbl.map(d => d.id_double));
    const samePosReps = (da, db) => {
      let n = 0;
      for (const pa of [da.id_player1, da.id_player2]) for (const pb of [db.id_player1, db.id_player2])
        if (P[pa].side === P[pb].side && (preDiag[key(pa, pb)] ?? 0) > 0) n++;
      return n;
    };
    let viol = 0;
    for (const m of matches) viol += samePosReps(dById[m.id_double_a], dById[m.id_double_b]);
    // mínimo teórico: enumera os 3 pareamentos das 4 duplas
    const ds = dbl;
    const partitions = [[[0,1],[2,3]],[[0,2],[1,3]],[[0,3],[1,2]]];
    const custos = partitions.map(pt => pt.reduce((s,[i,j]) => s + samePosReps(ds[i], ds[j]), 0));
    const minRep = Math.min(...custos);
    const playersInGames = new Set(matches.flatMap(m => [dById[m.id_double_a], dById[m.id_double_b]].flatMap(d => [d.id_player1, d.id_player2])));
    console.log(`\nmatches: ${matches.length} · jogadoras escaladas: ${playersInGames.size}/8 · repetições mesma-pos: ${viol} (mínimo possível: ${minRep})`);
    const ok = matches.length === 2 && playersInGames.size === 8 && viol === minRep;
    console.log(ok ? '✅ OK (todas jogam + repetição = mínimo possível)' : '❌ FALHOU');
  } finally {
    // cleanup: reverte contadores do round teste + deleta tudo
    if (roundId) {
      for (const tbl of ['partnerships', 'oppositions']) {
        const { data: rows } = await supabase.from(tbl).select('*').eq('id_tournament', T).eq('id_category', CAT).eq('last_round_id', roundId);
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
      const { data: dbl } = await supabase.from('doubles').select('id_double').eq('id_round', roundId);
      if (dbl && dbl.length) await supabase.from('matches').delete().in('id_double_a', dbl.map(d => d.id_double));
      await supabase.from('doubles').delete().eq('id_round', roundId);
      await supabase.from('round_attendance').delete().eq('id_round', roundId);
      await supabase.from('rounds').delete().eq('id_round', roundId);
      console.log('\n🧹 cleanup feito (round de teste removido).');
    }
  }
}
run().catch(e => { console.error('ERRO:', e.message); process.exit(1); });
