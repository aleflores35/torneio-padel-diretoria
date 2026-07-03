// Replica o HANDLER COMPLETO do GET /api/tournaments/:id/matches (server.js:235-287)
// e verifica se match 1283 sai enriched com scheduled_date/id_category corretos.
// Esse é o payload exato que JogosPage recebe.
const db = require('../../database');

const ID_TOURNAMENT = 7;
const TARGET = 1283;

const dbAll = (sql, params) => new Promise((resolve, reject) =>
  db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows || []))
);

async function run() {
  const [matches, doubles, courts, rounds, allPlayers] = await Promise.all([
    dbAll('SELECT * FROM matches WHERE id_tournament = ? ORDER BY scheduled_at', [ID_TOURNAMENT]),
    dbAll('SELECT * FROM doubles WHERE id_tournament = ?', [ID_TOURNAMENT]),
    dbAll('SELECT * FROM courts WHERE id_tournament = ?', [ID_TOURNAMENT]),
    dbAll('SELECT * FROM rounds WHERE id_tournament = ?', [ID_TOURNAMENT]),
    dbAll('SELECT * FROM players WHERE id_tournament = ?', [ID_TOURNAMENT]),
  ]);

  console.log(`\nCounts:`);
  console.log(`  matches: ${matches.length}`);
  console.log(`  doubles: ${doubles.length}`);
  console.log(`  courts: ${courts.length}`);
  console.log(`  rounds: ${rounds.length}`);
  console.log(`  players: ${allPlayers.length}`);

  const doublesMap = {}; doubles.forEach(d => { doublesMap[d.id_double] = d; });
  const roundsMap = {}; rounds.forEach(r => { roundsMap[r.id_round] = r; });

  const target = matches.find(m => m.id_match === TARGET);
  if (!target) { console.log(`\n✗ Match ${TARGET} não está em matches[]`); return; }

  const dA = doublesMap[target.id_double_a];
  const dB = doublesMap[target.id_double_b];
  console.log(`\nMatch ${TARGET}:`);
  console.log(`  id_double_a=${target.id_double_a} → ${dA ? `existe (id_round=${dA.id_round})` : '✗ NÃO no doublesMap'}`);
  console.log(`  id_double_b=${target.id_double_b} → ${dB ? `existe (id_round=${dB.id_round})` : '✗ NÃO no doublesMap'}`);

  const roundId = dA?.id_round || null;
  const round = roundsMap[roundId] || {};
  console.log(`  roundId=${roundId} → ${roundsMap[roundId] ? `existe (date=${round.scheduled_date}, cat=${round.id_category})` : '✗ NÃO no roundsMap'}`);

  // Enriched payload final como o handler entrega
  const enriched = {
    ...target,
    id_round: roundId,
    round_number: round.round_number || null,
    scheduled_date: round.scheduled_date || null,
    id_category: round.id_category || null,
    round_type: round.round_type || 'REGULAR',
  };
  console.log(`\nEnriched (o que JogosPage RECEBE):`);
  console.log(JSON.stringify({
    id_match: enriched.id_match,
    status: enriched.status,
    scheduled_at: enriched.scheduled_at,
    scheduled_date: enriched.scheduled_date,
    id_round: enriched.id_round,
    id_category: enriched.id_category,
    round_number: enriched.round_number,
    games_double_a: enriched.games_double_a,
    games_double_b: enriched.games_double_b,
  }, null, 2));

  // Diagnóstico de paginação: total de doubles/rounds esperado
  console.log(`\nIDs máximos retornados:`);
  console.log(`  max id_double: ${Math.max(...doubles.map(d => d.id_double || 0))}`);
  console.log(`  max id_round: ${Math.max(...rounds.map(r => r.id_round || 0))}`);
}

run().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
