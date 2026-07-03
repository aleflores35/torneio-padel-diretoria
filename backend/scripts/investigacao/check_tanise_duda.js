const supabase = require('../../supabase');

const TOURNAMENT = 7;
const CATEGORY = 3;

async function run() {
  // 1) Acha Tanise e Duda
  const { data: ladies } = await supabase
    .from('players')
    .select('id_player, name, side')
    .eq('id_tournament', TOURNAMENT)
    .eq('category_id', CATEGORY)
    .or('name.ilike.%Tanise%,name.ilike.%Duda%,name.ilike.%Brownie%');
  console.log('Encontradas:', ladies);

  if (!ladies?.length) return;
  const ids = ladies.map(l => l.id_player);

  // 2) Histórico de attendance nas últimas rodadas
  const { data: rounds } = await supabase
    .from('rounds')
    .select('id_round, round_number, scheduled_date, round_type, status')
    .eq('id_tournament', TOURNAMENT)
    .eq('id_category', CATEGORY)
    .order('round_number', { ascending: false })
    .limit(8);
  console.log('\nÚltimas rodadas Fem:');
  for (const r of rounds || []) console.log(`  r=${r.id_round} #${r.round_number} ${r.scheduled_date} ${r.round_type} ${r.status}`);

  const roundIds = (rounds || []).map(r => r.id_round);

  // 3) Attendance por jogadora nessas rodadas
  const { data: att } = await supabase
    .from('round_attendance')
    .select('id_round, id_player, status, responded_by')
    .in('id_round', roundIds)
    .in('id_player', ids);

  // 4) Quem jogou (doubles) nessas rodadas
  const { data: dbls } = await supabase
    .from('doubles')
    .select('id_round, id_player1, id_player2')
    .in('id_round', roundIds);
  const playedByRound = {};
  for (const d of dbls || []) {
    if (!playedByRound[d.id_round]) playedByRound[d.id_round] = new Set();
    playedByRound[d.id_round].add(d.id_player1);
    playedByRound[d.id_round].add(d.id_player2);
  }

  // 5) Impedimentos cadastrados
  const { data: abs } = await supabase
    .from('player_absences')
    .select('id_player, absence_date')
    .eq('id_tournament', TOURNAMENT)
    .in('id_player', ids)
    .order('absence_date', { ascending: false })
    .limit(20);

  for (const lady of ladies) {
    console.log(`\n=== ${lady.name} (id=${lady.id_player}, side=${lady.side}) ===`);
    for (const r of rounds || []) {
      const rec = (att || []).find(a => a.id_round === r.id_round && a.id_player === lady.id_player);
      const played = playedByRound[r.id_round]?.has(lady.id_player) ? '🎾 JOGOU' : '🚫 não jogou';
      const status = rec ? rec.status + (rec.responded_by ? ` (by:${rec.responded_by})` : '') : '—';
      console.log(`  r#${r.round_number} ${r.scheduled_date}: ${played} | attendance: ${status}`);
    }
    console.log('  Impedimentos cadastrados:');
    for (const a of (abs || []).filter(x => x.id_player === lady.id_player)) {
      console.log(`    ${a.absence_date}`);
    }
  }

  // 6) games_played atual (calc real, como o algoritmo faz)
  const { data: tourDoubles } = await supabase
    .from('doubles')
    .select('id_double, id_player1, id_player2')
    .eq('id_tournament', TOURNAMENT);
  const { data: countedMatches } = await supabase
    .from('matches')
    .select('id_double_a, id_double_b')
    .eq('id_tournament', TOURNAMENT)
    .in('status', ['FINISHED', 'WO']);
  const dToPlayers = {};
  for (const d of tourDoubles || []) dToPlayers[d.id_double] = [d.id_player1, d.id_player2];
  const gamesCount = {};
  for (const m of countedMatches || []) {
    for (const pid of [...(dToPlayers[m.id_double_a] || []), ...(dToPlayers[m.id_double_b] || [])]) {
      gamesCount[pid] = (gamesCount[pid] || 0) + 1;
    }
  }
  // 7) games_played de TODAS as femininas pra contexto
  const { data: allFem } = await supabase
    .from('players')
    .select('id_player, name, side')
    .eq('id_tournament', TOURNAMENT)
    .eq('category_id', CATEGORY);
  console.log('\n=== games_played (FINISHED/WO) — todas as femininas (ordem do sorteio: menos primeiro) ===');
  const ranked = (allFem || [])
    .map(p => ({ ...p, games: gamesCount[p.id_player] || 0 }))
    .sort((a, b) => a.games - b.games);
  for (const r of ranked) {
    const mark = ids.includes(r.id_player) ? ' ⭐' : '';
    console.log(`  ${String(r.games).padStart(2)} jogos  ${r.name.padEnd(28)} (id=${r.id_player}, side=${r.side})${mark}`);
  }
}

run().catch(e => { console.error('ERRO:', e); process.exit(1); });
