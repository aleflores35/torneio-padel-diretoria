// Busca matches por critérios combinados. Default: jogos IN_PROGRESS hoje.
// Uso: DATE=2026-04-24 CATEGORY=Feminino node find_match.js
//      ATHLETE=Mara node find_match.js  (busca por nome de atleta)

const supabase = require('./supabase');

async function find() {
  const date = process.env.DATE;
  const categoryFilter = process.env.CATEGORY;
  const athleteFilter = process.env.ATHLETE;

  let query = supabase
    .from('matches')
    .select(`
      id_match,
      status,
      match_type,
      scheduled_at,
      score_a,
      score_b,
      id_court,
      id_round,
      round_type,
      doubleA:id_double_a(id_double, name, id_category),
      doubleB:id_double_b(id_double, name, id_category)
    `)
    .order('scheduled_at', { ascending: false })
    .limit(20);

  const { data, error } = await query;
  if (error) { console.error(error); process.exit(1); }

  let filtered = data || [];

  if (athleteFilter) {
    filtered = filtered.filter(m =>
      (m.doubleA?.name || '').toLowerCase().includes(athleteFilter.toLowerCase()) ||
      (m.doubleB?.name || '').toLowerCase().includes(athleteFilter.toLowerCase())
    );
  }

  if (date) {
    filtered = filtered.filter(m => (m.scheduled_at || '').startsWith(date));
  }

  console.log(`Encontrados ${filtered.length} matches:\n`);
  for (const m of filtered) {
    console.log(`id_match=${m.id_match} · status=${m.status} · ${m.match_type || 'tipo?'} · round_type=${m.round_type || '?'}`);
    console.log(`  scheduled: ${m.scheduled_at} · score ${m.score_a}x${m.score_b} · court=${m.id_court} · round=${m.id_round}`);
    console.log(`  A: ${m.doubleA?.name || 'N/A'} (id_double=${m.doubleA?.id_double})`);
    console.log(`  B: ${m.doubleB?.name || 'N/A'} (id_double=${m.doubleB?.id_double})`);
    console.log('');
  }
}

find().catch(e => { console.error(e); process.exit(1); });
