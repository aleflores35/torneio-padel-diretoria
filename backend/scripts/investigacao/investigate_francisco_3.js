const supabase = require('./supabase');

async function dumpRoundMatches(id_round) {
  console.log(`\n========== ROUND ${id_round} ==========`);
  const { data: round } = await supabase.from('rounds').select('*').eq('id_round', id_round).single();
  console.log(`date=${round.scheduled_date} · status=${round.status} · type=${round.round_type} · num=${round.round_number}`);

  const { data: doubles } = await supabase.from('doubles').select('*').eq('id_round', id_round);
  const dMap = {};
  for (const d of doubles||[]) dMap[d.id_double] = d.display_name;

  const dIds = (doubles||[]).map(d => d.id_double);

  // Buscar matches via 2 queries separadas (in com OR não rola)
  const [{ data: matchesA }, { data: matchesB }] = await Promise.all([
    supabase.from('matches').select('*').in('id_double_a', dIds),
    supabase.from('matches').select('*').in('id_double_b', dIds)
  ]);
  const seen = new Set();
  const allMatches = [];
  for (const m of [...(matchesA||[]), ...(matchesB||[])]) {
    if (!seen.has(m.id_match)) { seen.add(m.id_match); allMatches.push(m); }
  }
  allMatches.sort((a,b) => (a.scheduled_at||'').localeCompare(b.scheduled_at||''));

  console.log(`\nMatches (${allMatches.length}):`);
  for (const m of allMatches) {
    const time = (m.scheduled_at||'').substring(11,16);
    console.log(`  match=${m.id_match} · ${time} · ${dMap[m.id_double_a]||'?'} VS ${dMap[m.id_double_b]||'?'} · ${m.status} ${m.score_a||0}-${m.score_b||0}`);
  }
  return { round, doubles, allMatches, dMap };
}

async function main() {
  const r377 = await dumpRoundMatches(377);
  const r393 = await dumpRoundMatches(393);

  console.log('\n========== FRANCISCO (663) - ENCONTROS ==========');

  for (const r of [r377, r393]) {
    const myDouble = r.doubles.find(d => d.id_player1 === 663 || d.id_player2 === 663);
    if (!myDouble) { console.log(`Round ${r.round.id_round}: Francisco fora`); continue; }
    const partnerId = myDouble.id_player1 === 663 ? myDouble.id_player2 : myDouble.id_player1;
    const myMatch = r.allMatches.find(m => m.id_double_a === myDouble.id_double || m.id_double_b === myDouble.id_double);
    const oppDoubleId = myMatch ? (myMatch.id_double_a === myDouble.id_double ? myMatch.id_double_b : myMatch.id_double_a) : null;
    const oppDouble = r.doubles.find(d => d.id_double === oppDoubleId);
    console.log(`\nRound ${r.round.id_round} (${r.round.scheduled_date}):`);
    console.log(`  Francisco com: ${myDouble.display_name} (parceiro id=${partnerId})`);
    if (oppDouble) {
      console.log(`  Adversários: ${oppDouble.display_name} (p1=${oppDouble.id_player1} p2=${oppDouble.id_player2})`);
    } else {
      console.log(`  Sem match adversário (matches=${r.allMatches.length}, double=${myDouble.id_double})`);
    }
  }

  // Nomes dos adversários novos
  const ids = [653, 667, 658, 663];
  const { data: players } = await supabase.from('players').select('id_player, name, side').in('id_player', ids);
  console.log('\nLados:');
  for (const p of players||[]) console.log(`  ${p.id_player} ${p.name} = ${p.side}`);
}

main().catch(e => { console.error(e); process.exit(1); });
