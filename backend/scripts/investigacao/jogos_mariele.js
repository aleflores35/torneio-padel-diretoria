// Acha duplas e matches futuros/agendados da Mariele (id 707)
const supabase = require('../../supabase');

const PLAYER = 707;

async function run() {
  // Duplas da Mariele
  const { data: dbls, error: dErr } = await supabase
    .from('doubles')
    .select('id_double, display_name, id_round, id_player1, id_player2')
    .or(`id_player1.eq.${PLAYER},id_player2.eq.${PLAYER}`);
  if (dErr) { console.error(dErr); process.exit(1); }
  if (!dbls || !dbls.length) { console.log('Sem duplas pra player', PLAYER); return; }

  const dIds = dbls.map(d => d.id_double);

  // Matches dessas duplas
  const [{ data: mA }, { data: mB }] = await Promise.all([
    supabase.from('matches').select('id_match, status, scheduled_at, id_court, id_double_a, id_double_b').in('id_double_a', dIds),
    supabase.from('matches').select('id_match, status, scheduled_at, id_court, id_double_a, id_double_b').in('id_double_b', dIds),
  ]);
  const matches = [...(mA || []), ...(mB || [])];
  // dedupe
  const seen = new Set();
  const uniq = matches.filter(m => { if (seen.has(m.id_match)) return false; seen.add(m.id_match); return true; });

  // Carrega display_name de todas as duplas envolvidas + rodada/categoria
  const allDoubleIds = [...new Set(uniq.flatMap(m => [m.id_double_a, m.id_double_b]))];
  const { data: allD } = await supabase.from('doubles').select('id_double, display_name, id_round').in('id_double', allDoubleIds);
  const dMap = {}; (allD || []).forEach(d => dMap[d.id_double] = d);
  const roundIds = [...new Set((allD || []).map(d => d.id_round))];
  const { data: rounds } = await supabase.from('rounds').select('id_round, status, id_category, round_type, round_number').in('id_round', roundIds);
  const rMap = {}; (rounds || []).forEach(r => rMap[r.id_round] = r);

  uniq.sort((a, b) => (b.scheduled_at || '').localeCompare(a.scheduled_at || ''));

  console.log(`Mariele (707) — ${uniq.length} matches:\n`);
  for (const m of uniq) {
    const r = rMap[dMap[m.id_double_a]?.id_round] || rMap[dMap[m.id_double_b]?.id_round] || {};
    console.log(`id_match=${m.id_match} · status=${m.status} · ${m.scheduled_at} · court=${m.id_court}`);
    console.log(`   round=${dMap[m.id_double_a]?.id_round} (status=${r.status}, cat=${r.id_category}, tipo=${r.round_type}, n=${r.round_number})`);
    console.log(`   A: ${dMap[m.id_double_a]?.display_name} (id_double=${m.id_double_a})`);
    console.log(`   B: ${dMap[m.id_double_b]?.display_name} (id_double=${m.id_double_b})`);
    console.log('');
  }
}
run().catch(e => { console.error(e); process.exit(1); });
