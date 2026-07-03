// READ-ONLY — quadro completo da rodada feminina (cat 3) p/ planejar
// alteração: A = Tanise + Paula  ×  B = Paola + Amanda.
const supabase = require('../../supabase');

async function main() {
  // players candidatos por nome
  for (const n of ['Paula', 'Paola', 'Amanda', 'Tanise', 'Francine']) {
    const { data } = await supabase.from('players')
      .select('id_player, name, side, category_id').ilike('name', `%${n}%`);
    console.log(`${n}:`, JSON.stringify(data));
  }

  // rodadas recentes cat 3
  const { data: rounds } = await supabase.from('rounds')
    .select('id_round, round_number, status, scheduled_date, round_type')
    .eq('id_category', 3).order('id_round', { ascending: false }).limit(4);
  console.log('\n— Rodadas recentes cat 3:'); console.table(rounds || []);

  // players cat 3 (mapa nome)
  const { data: catPlayers } = await supabase.from('players')
    .select('id_player, name, side').eq('category_id', 3);
  const nameOf = {}; (catPlayers || []).forEach(p => nameOf[p.id_player] = `${p.name} [${p.side}]`);

  for (const r of (rounds || []).slice(0, 2)) {
    console.log(`\n=== Rodada ${r.id_round} (#${r.round_number} ${r.status} ${r.scheduled_date} ${r.round_type}) ===`);
    const { data: doubles } = await supabase.from('doubles')
      .select('id_double, display_name, id_player1, id_player2').eq('id_round', r.id_round);
    const { data: matches } = await supabase.from('matches')
      .select('id_match, id_double_a, id_double_b, status, scheduled_at, id_court')
      .in('id_double_a', (doubles || []).map(d => d.id_double));
    const dById = {}; (doubles || []).forEach(d => dById[d.id_double] = d);
    console.log('matches:');
    (matches || []).forEach(m => {
      const a = dById[m.id_double_a], b = dById[m.id_double_b];
      console.log(`  match ${m.id_match} [${m.status}] ${m.scheduled_at} court=${m.id_court}`);
      console.log(`     A(${m.id_double_a}): ${a?.display_name}`);
      console.log(`     B(${m.id_double_b}): ${b?.display_name}`);
    });
    console.log('doubles:'); console.table((doubles || []).map(d => ({
      id_double: d.id_double, display_name: d.display_name,
      p1: nameOf[d.id_player1], p2: nameOf[d.id_player2],
    })));
    const { data: att } = await supabase.from('round_attendance')
      .select('id_player, status, notes').eq('id_round', r.id_round);
    console.log('attendance:'); console.table((att || []).map(a => ({
      player: nameOf[a.id_player] || a.id_player, status: a.status, notes: a.notes,
    })));
  }
}
main().catch(e => { console.error('ERRO:', e); process.exit(1); });
