// TESTE ao vivo do confirmRound na RÉGUA DE PARCERIA. Round DESCARTÁVEL (data distante),
// roda confirmRound real, verifica: (1) TODA dupla criada é INÉDITA (parceria nunca usada em
// outro round REGULAR); (2) jogos disjuntos (ninguém 2x na noite); (3) banco = present - jogando,
// marcado ROTATED + friendly_suggestions; (4) jogos criados/slotados. Limpa tudo no fim.
// Uso: node scripts/investigacao/test_confirmround_parceria.js
const assert = require('assert');
const supabase = require('../../supabase');
const { confirmRound } = require('../../services/weeklyDrawService');
const T = 7, CAT = 3, DATE = '2027-06-03';
const key = (a, b) => a < b ? `${a}-${b}` : `${b}-${a}`;
const PAIRS0 = [[707, 699], [697, 701], [692, 703], [695, 698]]; // 8 do Feminino (4R+4L)

async function run() {
  let roundId = null;
  try {
    const ids = PAIRS0.flat();
    const { data: pl } = await supabase.from('players').select('id_player,name,side').in('id_player', ids);
    const P = {}; pl.forEach(p => P[p.id_player] = p.name);
    // parcerias JÁ usadas (rounds REGULAR existentes — antes do round de teste)
    const { data: rounds } = await supabase.from('rounds').select('id_round,round_type').eq('id_tournament', T).eq('id_category', CAT);
    const regIds = rounds.filter(r => r.round_type !== 'EXHIBITION').map(r => r.id_round);
    const { data: histDbl } = await supabase.from('doubles').select('id_player1,id_player2').in('id_round', regIds);
    const usedBefore = new Set((histDbl || []).map(d => key(d.id_player1, d.id_player2)));

    const { data: r } = await supabase.from('rounds').insert({
      id_tournament: T, id_category: CAT, round_number: 998, scheduled_date: DATE,
      window_start: '18:30', window_end: '22:00', status: 'DRAFT', round_type: 'REGULAR',
    }).select().single();
    roundId = r.id_round;
    console.log('round de teste:', roundId);
    for (const [a, b] of PAIRS0)
      await supabase.from('doubles').insert({ id_tournament: T, id_player1: a, id_player2: b, display_name: `${P[a]} / ${P[b]}`, id_round: roundId });
    await supabase.from('round_attendance').insert(ids.map(id => ({ id_round: roundId, id_player: id, status: 'NO_RESPONSE' })));

    const result = await confirmRound(roundId);
    console.log('matches_created:', result.matches_created, '· banco:', (result.friendly_suggestions || []).map(f => f.name).join(', ') || '(ninguém)');

    const { data: dbl } = await supabase.from('doubles').select('*').eq('id_round', roundId);
    const D = {}; dbl.forEach(d => D[d.id_double] = d);
    const { data: matches } = await supabase.from('matches').select('id_double_a,id_double_b,scheduled_at').in('id_double_a', dbl.map(d => d.id_double));
    const playing = new Set();
    let stalePart = 0;
    matches.sort((a, b) => (a.scheduled_at || '').localeCompare(b.scheduled_at || ''));
    for (const m of matches) {
      const da = D[m.id_double_a], db = D[m.id_double_b];
      [da.id_player1, da.id_player2, db.id_player1, db.id_player2].forEach(p => playing.add(p));
      for (const d of [da, db]) if (usedBefore.has(key(d.id_player1, d.id_player2))) stalePart++;
      console.log(`  ${(m.scheduled_at || '').substring(11, 16)} ${da.display_name} × ${db.display_name}`);
    }
    const benched = ids.filter(p => !playing.has(p));
    console.log(`  fora: ${benched.map(i => P[i]).join(', ') || '(ninguém)'}`);
    const { data: att } = await supabase.from('round_attendance').select('id_player,status').eq('id_round', roundId);
    const rotated = (att || []).filter(a => a.status === 'ROTATED').map(a => a.id_player).sort((x, y) => x - y);
    const fsIds = (result.friendly_suggestions || []).map(f => f.id_player).sort((x, y) => x - y);

    // asserts
    assert.strictEqual(stalePart, 0, `🔴 ${stalePart} dupla(s) REPETIDA(s) — regra de parceria quebrada`);
    const flat = matches.flatMap(m => [D[m.id_double_a].id_player1, D[m.id_double_a].id_player2, D[m.id_double_b].id_player1, D[m.id_double_b].id_player2]);
    assert.strictEqual(flat.length, new Set(flat).size, 'ninguém joga 2x na noite');
    assert.strictEqual(playing.size + benched.length, ids.length, 'todos contabilizados');
    assert.deepStrictEqual(rotated, benched.slice().sort((x, y) => x - y), 'banco == ROTATED no banco');
    assert.deepStrictEqual(fsIds, benched.slice().sort((x, y) => x - y), 'banco == friendly_suggestions');
    assert.strictEqual(matches.length, result.matches_created, 'matches_created confere');
    console.log('\n✅ confirmRound (régua de parceria) OK: toda dupla INÉDITA · jogos disjuntos · banco ROTATED+aviso.');
  } finally {
    if (roundId) {
      for (const tbl of ['partnerships', 'oppositions']) {
        const { data: rows } = await supabase.from(tbl).select('*').eq('id_tournament', T).eq('id_category', CAT).eq('last_round_id', roundId);
        for (const row of rows || []) {
          if (tbl === 'partnerships') { if (row.times_paired <= 1) await supabase.from(tbl).delete().eq('id_partnership', row.id_partnership); else await supabase.from(tbl).update({ times_paired: row.times_paired - 1, last_round_id: null }).eq('id_partnership', row.id_partnership); }
          else { if (row.times_opposed <= 1) await supabase.from(tbl).delete().eq('id_opposition', row.id_opposition); else await supabase.from(tbl).update({ times_opposed: row.times_opposed - 1, diagonal_count: Math.max(0, (row.diagonal_count || 0) - 1), last_round_id: null }).eq('id_opposition', row.id_opposition); }
        }
      }
      const { data: dbl } = await supabase.from('doubles').select('id_double').eq('id_round', roundId);
      if (dbl && dbl.length) await supabase.from('matches').delete().in('id_double_a', dbl.map(d => d.id_double));
      await supabase.from('doubles').delete().eq('id_round', roundId);
      await supabase.from('round_attendance').delete().eq('id_round', roundId);
      await supabase.from('rounds').delete().eq('id_round', roundId);
      console.log('🧹 cleanup feito.');
    }
  }
}
run().catch(e => { console.error('ERRO:', e.message); process.exit(1); });
