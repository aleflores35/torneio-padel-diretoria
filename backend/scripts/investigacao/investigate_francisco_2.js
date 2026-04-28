// Investiga matches completos das rodadas 377 (semana passada) e 393 (semana atual).
// Quer descobrir: o que repetiu pro Francisco? Parceiro? Adversário?

const supabase = require('./supabase');

async function dumpRound(id_round) {
  console.log(`\n========== ROUND ${id_round} ==========`);
  const { data: round } = await supabase.from('rounds').select('*').eq('id_round', id_round).single();
  console.log(`date=${round.scheduled_date} · status=${round.status} · type=${round.round_type} · num=${round.round_number}`);

  const { data: doubles } = await supabase
    .from('doubles').select('*').eq('id_round', id_round);
  console.log(`\nDuplas (${(doubles||[]).length}):`);
  for (const d of doubles||[]) {
    console.log(`  double=${d.id_double} · ${d.display_name} (p1=${d.id_player1} p2=${d.id_player2})`);
  }

  const dIds = (doubles||[]).map(d => d.id_double);
  const { data: matches } = await supabase
    .from('matches')
    .select('id_match, id_double_a, id_double_b, scheduled_at, status, score_a, score_b')
    .or(`id_double_a.in.(${dIds.join(',')}),id_double_b.in.(${dIds.join(',')})`);

  const dMap = {};
  for (const d of doubles||[]) dMap[d.id_double] = d.display_name;

  console.log(`\nMatches (${(matches||[]).length}):`);
  for (const m of matches||[]) {
    console.log(`  match=${m.id_match} · ${dMap[m.id_double_a]} VS ${dMap[m.id_double_b]} · @${m.scheduled_at} · ${m.status} ${m.score_a||0}-${m.score_b||0}`);
  }
}

async function main() {
  await dumpRound(377);
  await dumpRound(393);

  console.log('\n\n========== FOCO NO FRANCISCO (663) ==========');
  // Round 377: parceiro era 653 Cristiano. Quem foi adversário?
  // Round 393: parceiro é 658 Flavio. Adversário Cristiano (653) + Anderson Dalmolin

  const ids = [658, 653, 652, 654, 655, 664]; // todos que aparecem em partnerships dele
  const { data: players } = await supabase
    .from('players')
    .select('id_player, name, side')
    .in('id_player', ids);
  console.log('\nIDs relevantes:');
  for (const p of players||[]) console.log(`  ${p.id_player} = ${p.name} (${p.side})`);
}

main().catch(e => { console.error(e); process.exit(1); });
