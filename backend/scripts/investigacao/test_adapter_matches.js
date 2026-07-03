// Replica EXATAMENTE o que GET /api/tournaments/:id/matches faz (server.js:235),
// via db.all() adapter contra Supabase. Verifica se o match 1283 aparece no payload.
// Uso: node scripts/investigacao/test_adapter_matches.js
const db = require('../../database');

const ID_TOURNAMENT = 7;
const TARGET_MATCH = 1283;

const dbAll = (sql, params) => new Promise((resolve, reject) =>
  db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows || []))
);

async function run() {
  console.log(`\n=== Adapter test: GET /api/tournaments/${ID_TOURNAMENT}/matches ===\n`);

  const matches = await dbAll('SELECT * FROM matches WHERE id_tournament = ? ORDER BY scheduled_at', [ID_TOURNAMENT]);
  console.log(`Adapter retornou ${matches.length} matches.`);

  const target = matches.find(m => m.id_match === TARGET_MATCH);
  console.log(`\nMatch ${TARGET_MATCH} encontrado pelo adapter? ${target ? 'SIM ✓' : 'NÃO ✗'}`);
  if (target) {
    console.log('  ', JSON.stringify({
      id_match: target.id_match,
      status: target.status,
      scheduled_at: target.scheduled_at,
      games_double_a: target.games_double_a,
      games_double_b: target.games_double_b,
      id_double_a: target.id_double_a,
      id_double_b: target.id_double_b,
    }));
  }

  // Counts por status
  const byStatus = {};
  matches.forEach(m => { byStatus[m.status] = (byStatus[m.status] || 0) + 1; });
  console.log('\nMatches por status:', byStatus);

  // Lista IDs mais recentes pra ver se o adapter trunca em algum ponto
  const sorted = [...matches].sort((a, b) => (b.id_match || 0) - (a.id_match || 0));
  console.log('\nTop 15 matches por id_match (decrescente):');
  sorted.slice(0, 15).forEach(m => console.log(`  id=${m.id_match} status=${m.status} ${m.scheduled_at}`));
}

run().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
