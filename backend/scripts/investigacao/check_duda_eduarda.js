const supabase = require('../../supabase');
const TOURNAMENT = 7;
const CATEGORY = 3;
const IDS = [700, 694]; // Eduarda + Tanise

async function run() {
  const { data: rounds } = await supabase
    .from('rounds').select('id_round, round_number, scheduled_date, round_type, status')
    .eq('id_tournament', TOURNAMENT).eq('id_category', CATEGORY)
    .order('round_number', { ascending: false }).limit(8);
  const roundIds = (rounds || []).map(r => r.id_round);

  const { data: att } = await supabase
    .from('round_attendance').select('id_round, id_player, status, responded_by')
    .in('id_round', roundIds).in('id_player', IDS);

  const { data: dbls } = await supabase
    .from('doubles').select('id_round, id_player1, id_player2')
    .in('id_round', roundIds);
  const playedByRound = {};
  for (const d of dbls || []) {
    if (!playedByRound[d.id_round]) playedByRound[d.id_round] = new Set();
    playedByRound[d.id_round].add(d.id_player1);
    playedByRound[d.id_round].add(d.id_player2);
  }

  const { data: abs } = await supabase
    .from('player_absences').select('id_player, absence_date')
    .eq('id_tournament', TOURNAMENT).in('id_player', IDS)
    .order('absence_date', { ascending: false });

  const { data: players } = await supabase
    .from('players').select('id_player, name, side').in('id_player', IDS);

  for (const p of players || []) {
    console.log(`\n=== ${p.name} (id=${p.id_player}, side=${p.side}) ===`);
    for (const r of rounds || []) {
      const rec = (att || []).find(a => a.id_round === r.id_round && a.id_player === p.id_player);
      const played = playedByRound[r.id_round]?.has(p.id_player) ? '🎾 JOGOU' : '🚫 não jogou';
      const status = rec ? rec.status + (rec.responded_by ? ` (by:${rec.responded_by})` : '') : '—';
      console.log(`  r#${r.round_number} ${r.scheduled_date}: ${played} | attendance: ${status}`);
    }
    const impedidas = (abs || []).filter(x => x.id_player === p.id_player);
    if (impedidas.length) {
      console.log('  Impedimentos cadastrados:');
      for (const a of impedidas) console.log(`    ${a.absence_date}`);
    } else {
      console.log('  Impedimentos: NENHUM');
    }
  }
}
run().catch(e => { console.error(e); process.exit(1); });
