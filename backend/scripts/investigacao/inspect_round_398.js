// Inspeciona round 398 (Feminino Iniciante) — entender por que NÃO existe match
// Michele+Catiane × Luana+Sabrina (duplas existem como 2804/2805 mas zero match).
// Uso: node scripts/investigacao/inspect_round_398.js
const supabase = require('../../supabase');

const ID_ROUND = 398;

async function run() {
  console.log(`\n=== Inspect round ${ID_ROUND} ===\n`);

  const { data: round, error: e0 } = await supabase
    .from('rounds').select('*').eq('id_round', ID_ROUND).single();
  if (e0) { console.error(e0); process.exit(1); }
  console.log('Round:', {
    id_round: round.id_round, num: round.round_number, status: round.status,
    scheduled_date: round.scheduled_date, id_category: round.id_category,
    id_tournament: round.id_tournament,
  });

  const { data: doubles } = await supabase
    .from('doubles').select('*').eq('id_round', ID_ROUND).order('id_double');
  console.log(`\nDoubles (${doubles?.length ?? 0}):`);
  (doubles || []).forEach(d => console.log(`  id=${d.id_double} "${d.display_name}" p1=${d.id_player1} p2=${d.id_player2}`));

  const { data: matches } = await supabase
    .from('matches').select('*').eq('id_round', ID_ROUND).order('id_match');
  console.log(`\nMatches (${matches?.length ?? 0}):`);
  for (const m of matches || []) {
    const dA = doubles.find(d => d.id_double === m.id_double_a);
    const dB = doubles.find(d => d.id_double === m.id_double_b);
    console.log(`  id=${m.id_match} status=${m.status} ${m.scheduled_at}`);
    console.log(`    A=${m.id_double_a} "${dA?.display_name}"  ×  B=${m.id_double_b} "${dB?.display_name}"`);
    console.log(`    score: ${m.games_double_a ?? '-'} x ${m.games_double_b ?? '-'}  court=${m.id_court}`);
  }

  // Quais combinações de duplas EXISTEM como match e quais não?
  if (doubles && doubles.length === 4 && matches) {
    console.log('\n— Matriz de confrontos esperados (4 duplas = 6 confrontos possíveis) —');
    const ids = doubles.map(d => d.id_double).sort((a,b)=>a-b);
    const playedSet = new Set();
    for (const m of matches) {
      const k = [m.id_double_a, m.id_double_b].sort((a,b)=>a-b).join('-');
      playedSet.add(k);
    }
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const k = `${ids[i]}-${ids[j]}`;
        const dI = doubles.find(d => d.id_double === ids[i]);
        const dJ = doubles.find(d => d.id_double === ids[j]);
        const has = playedSet.has(k);
        console.log(`  ${has ? '✓' : '✗ FALTA'}  ${dI.display_name}  ×  ${dJ.display_name}`);
      }
    }
  }

  const { data: attendance } = await supabase
    .from('round_attendance').select('*').eq('id_round', ID_ROUND);
  console.log(`\nAttendance (${attendance?.length ?? 0}) — agrupado por status:`);
  const byStatus = {};
  (attendance || []).forEach(a => {
    byStatus[a.status] = (byStatus[a.status] || 0) + 1;
  });
  console.log('  ', byStatus);
}

run().catch(e => { console.error(e); process.exit(1); });
