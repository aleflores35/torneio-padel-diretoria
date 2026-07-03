// Matches da rodada 408 via .in() — robusto. Read-only.
const supabase = require('../../supabase');

async function main() {
  const ROUND = 408;
  const { data: doubles } = await supabase.from('doubles')
    .select('id_double, display_name').eq('id_round', ROUND);
  const dmap = {}; (doubles||[]).forEach(d => dmap[d.id_double]=d.display_name);
  const dIds = (doubles||[]).map(d => d.id_double);
  console.log('Duplas 408:', dIds);

  const { data: mA } = await supabase.from('matches').select('*').in('id_double_a', dIds);
  const { data: mB } = await supabase.from('matches').select('*').in('id_double_b', dIds);
  const all = {};
  [...(mA||[]), ...(mB||[])].forEach(m => { all[m.id_match] = m; });
  const matches = Object.values(all);

  console.log('\n=== Matches envolvendo duplas da 408 ===');
  console.table(matches.map(m => ({
    id_match: m.id_match,
    A: dmap[m.id_double_a] || m.id_double_a,
    B: dmap[m.id_double_b] || m.id_double_b,
    status: m.status,
    quando: m.scheduled_at,
  })));

  const inMatch = new Set();
  matches.forEach(m => { inMatch.add(m.id_double_a); inMatch.add(m.id_double_b); });
  const orfas = (doubles||[]).filter(d => !inMatch.has(d.id_double));
  console.log('\n=== Duplas SEM match (resíduo / não jogam) ===');
  console.table(orfas.map(d => ({ id_double: d.id_double, dupla: d.display_name })));
}
main().catch(e => { console.error(e); process.exit(1); });