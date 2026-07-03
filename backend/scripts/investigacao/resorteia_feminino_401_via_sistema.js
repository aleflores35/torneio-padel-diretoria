// RE-SORTEIO FEMININO ROUND 401 via algoritmo NATIVO do sistema:
//   1) limpa matches + doubles + counters da rodada 401
//   2) baixa status pra DRAFT
//   3) chama redrawRound (que usa drawWeeklyRound: selectPlayersForWeek com rotação +
//      pairBySide com custo de partnership history)
//   4) chama confirmRound (pareia duplas em matches via oppositions cost + aloca slots)
//
// Diferença pro script anterior (que caiu repetindo Luana+Daniela e Francine+Nicole):
// agora usa o algoritmo do próprio sistema, que consulta partnerships e oppositions.
//
// Guard: CONFIRM_EXECUTE=yes
const supabase = require('../../supabase');
const draw = require('../../services/weeklyDrawService');

const ROUND = 401;
const TOURNAMENT = 7;
const CATEGORY = 3;
const EXCLUDED = [691, 707]; // Maria Luísa, Mariele Schiefelbein

const MATCHES_TO_DELETE = [1280, 1281];

const DRY = process.env.CONFIRM_EXECUTE !== 'yes';

async function revertCountersForRound(t, c, r) {
  const { data: parts } = await supabase.from('partnerships')
    .select('id_partnership, times_paired')
    .eq('id_tournament', t).eq('id_category', c).eq('last_round_id', r);
  for (const x of parts || []) {
    if (x.times_paired <= 1) {
      await supabase.from('partnerships').delete().eq('id_partnership', x.id_partnership);
    } else {
      await supabase.from('partnerships').update({ times_paired: x.times_paired - 1, last_round_id: null }).eq('id_partnership', x.id_partnership);
    }
  }
  const { data: opps } = await supabase.from('oppositions')
    .select('id_opposition, times_opposed, diagonal_count')
    .eq('id_tournament', t).eq('id_category', c).eq('last_round_id', r);
  for (const x of opps || []) {
    if (x.times_opposed <= 1) {
      await supabase.from('oppositions').delete().eq('id_opposition', x.id_opposition);
    } else {
      await supabase.from('oppositions').update({
        times_opposed: x.times_opposed - 1,
        diagonal_count: Math.max(0, (x.diagonal_count || 0) - 1),
        last_round_id: null,
      }).eq('id_opposition', x.id_opposition);
    }
  }
}

async function main() {
  console.log(`MODE: ${DRY ? 'DRY' : '⚠️  EXECUTANDO'}`);

  // 1) limpa matches
  console.log(`\n— 1) Delete matches ${MATCHES_TO_DELETE.join(', ')}`);
  if (!DRY) await supabase.from('matches').delete().in('id_match', MATCHES_TO_DELETE);
  console.log(DRY ? '   (DRY)' : '   ✅');

  // 2) revert counters
  console.log(`\n— 2) Revert counters last_round_id=${ROUND}`);
  if (!DRY) await revertCountersForRound(TOURNAMENT, CATEGORY, ROUND);
  console.log(DRY ? '   (DRY)' : '   ✅');

  // 3) status → DRAFT
  console.log(`\n— 3) Round ${ROUND} status → DRAFT`);
  if (!DRY) await supabase.from('rounds').update({ status: 'DRAFT' }).eq('id_round', ROUND);
  console.log(DRY ? '   (DRY)' : '   ✅');

  // 4) redrawRound — usa selectPlayersForWeek + pairBySide do sistema
  console.log(`\n— 4) redrawRound(${ROUND}, excluded=${JSON.stringify(EXCLUDED)})`);
  if (DRY) {
    console.log('   (DRY) would call redrawRound');
  } else {
    const r = await draw.redrawRound(ROUND, EXCLUDED);
    console.log('   ✅ redraw:', JSON.stringify(r, null, 2));
  }

  // 5) confirmRound — pareia duplas em matches + slots
  console.log(`\n— 5) confirmRound(${ROUND})`);
  if (DRY) {
    console.log('   (DRY) would call confirmRound');
  } else {
    const r = await draw.confirmRound(ROUND);
    console.log('   ✅ confirm:', JSON.stringify(r, null, 2));
  }

  // 6) listar resultado
  if (!DRY) {
    const { data: doubles } = await supabase.from('doubles')
      .select('id_double, display_name, id_player1, id_player2').eq('id_round', ROUND);
    const dIds = doubles.map(d => d.id_double);
    const { data: matches } = await supabase.from('matches')
      .select('id_match, scheduled_at, id_court, id_double_a, id_double_b')
      .or(dIds.map(id => 'id_double_a.eq.' + id + ',id_double_b.eq.' + id).join(','))
      .order('scheduled_at');
    const dById = Object.fromEntries(doubles.map(d=>[d.id_double, d]));
    console.log(`\n=== Feminino rodada ${ROUND} (final) ===`);
    for (const m of matches) {
      console.log(`  ${m.scheduled_at.substring(11,16)}  court=${m.id_court}  ${dById[m.id_double_a].display_name}  ×  ${dById[m.id_double_b].display_name}`);
    }
  }

  console.log('\n✅ Concluído.');
  if (DRY) console.log('💡 Rode com CONFIRM_EXECUTE=yes pra aplicar.');
}

main().catch(e => { console.error('ERRO:', e); process.exit(1); });
