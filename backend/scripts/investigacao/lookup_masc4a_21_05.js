// LEITURA APENAS — identifica players por nome e mostra categoria + side + games_played
// Uso: node scripts/investigacao/lookup_masc4a_21_05.js
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
const supabase = require('../../supabase');

const TARGETS = [
  'Alessandro', 'Pablo', 'Bartmann', 'Ivan', 'Delia', 'Marcio', 'Márcio',
  'Michele', 'Maria Luisa', 'Maria Luísa', 'Maria Luiza', 'Hilton', 'Franceschi'
];

async function run() {
  // 1. Categorias (pk = id, não id_category)
  const { data: cats } = await supabase
    .from('categories')
    .select('id, name')
    .order('id');
  console.log('=== Categorias ===');
  for (const c of cats || []) console.log(`  id=${c.id} · ${c.name}`);

  // 2. Players com matches dos nomes
  const { data: players } = await supabase
    .from('players')
    .select('id_player, name, category_id, side, id_tournament');
  const catName = {};
  (cats || []).forEach(c => { catName[c.id] = c.name; });

  // 3. games_played calculado em runtime
  const [{ data: dbls }, { data: ms }] = await Promise.all([
    supabase.from('doubles').select('id_double, id_player1, id_player2'),
    supabase.from('matches').select('id_double_a, id_double_b').in('status', ['FINISHED', 'WO'])
  ]);
  const dToP = {};
  for (const d of dbls || []) dToP[d.id_double] = [d.id_player1, d.id_player2];
  const games = {};
  for (const m of ms || []) {
    for (const pid of [...(dToP[m.id_double_a] || []), ...(dToP[m.id_double_b] || [])]) {
      games[pid] = (games[pid] || 0) + 1;
    }
  }

  console.log('\n=== Players encontrados ===');
  for (const t of TARGETS) {
    const matches = (players || []).filter(p => p.name && p.name.toLowerCase().includes(t.toLowerCase()));
    if (!matches.length) { console.log(`  "${t}": (nenhum)`); continue; }
    for (const p of matches) {
      console.log(`  id=${p.id_player} · ${p.name} · cat=${catName[p.category_id] || '?'} (id=${p.category_id}) · side=${p.side} · games=${games[p.id_player] || 0}`);
    }
  }

  // 4. Quadras (col = name, não court_name)
  const { data: courts } = await supabase
    .from('courts')
    .select('id_court, name, order_index')
    .order('order_index');
  console.log('\n=== Quadras ===');
  for (const q of courts || []) console.log(`  id=${q.id_court} · ${q.name} · order=${q.order_index}`);

  // 5. Pool masc 4ª completa
  const masc4a = (players || []).filter(p => p.category_id === 2);
  console.log(`\n=== Masc 4ª — pool completa (${masc4a.length} players) ===`);
  masc4a
    .map(p => ({ ...p, g: games[p.id_player] || 0 }))
    .sort((a, b) => a.g - b.g || a.name.localeCompare(b.name))
    .forEach(p => {
      console.log(`  id=${p.id_player} · ${p.name} · side=${p.side} · games=${p.g}`);
    });

  // 5. Últimas rodadas (qualquer categoria) pra confirmar próxima quinta
  const { data: rounds } = await supabase
    .from('rounds')
    .select('id_round, id_category, round_number, scheduled_date, status, round_type')
    .order('scheduled_date', { ascending: false })
    .limit(15);
  console.log('\n=== Últimas 15 rodadas ===');
  for (const r of rounds || []) {
    console.log(`  id_round=${r.id_round} · ${catName[r.id_category] || '?'} · #${r.round_number} · ${r.scheduled_date} · ${r.status} · ${r.round_type}`);
  }

  // 6. Tournament ativo
  const { data: t } = await supabase.from('tournaments').select('id_tournament, name').limit(5);
  console.log('\n=== Tournaments ===');
  for (const x of t || []) console.log(`  id=${x.id_tournament} · ${x.name}`);
}

run().catch(e => { console.error(e); process.exit(1); });
