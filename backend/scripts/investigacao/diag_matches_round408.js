// Matches reais da rodada 408 — Mariele/Daniela jogam de fato hoje? Read-only.
const supabase = require('../../supabase');

async function main() {
  const ROUND = 408;
  const { data: round } = await supabase.from('rounds').select('*').eq('id_round', ROUND).single();
  console.log('Rodada 408:', { status: round.status, data: round.scheduled_date, cat: round.id_category });

  const { data: doubles } = await supabase.from('doubles')
    .select('id_double, id_player1, id_player2, display_name').eq('id_round', ROUND);
  const dmap = {}; (doubles||[]).forEach(d => dmap[d.id_double]=d.display_name);
  console.log('\n=== Duplas da rodada ===');
  console.table((doubles||[]).map(d => ({ id_double: d.id_double, dupla: d.display_name })));

  // Matches que referenciam duplas desta rodada
  const dIds = (doubles||[]).map(d => d.id_double);
  const { data: matches } = await supabase.from('matches')
    .select('id_match, id_double_a, id_double_b, status, scheduled_at, court')
    .or(dIds.map(id => `id_double_a.eq.${id}`).join(',') + ',' + dIds.map(id => `id_double_b.eq.${id}`).join(','));
  console.log('\n=== Matches envolvendo duplas da rodada 408 ===');
  console.table((matches||[]).map(m => ({
    id_match: m.id_match,
    A: dmap[m.id_double_a] || m.id_double_a,
    B: dmap[m.id_double_b] || m.id_double_b,
    status: m.status,
    quando: m.scheduled_at,
    quadra: m.court,
  })));

  // Quais duplas NÃO estão em nenhum match (resíduo)?
  const inMatch = new Set();
  (matches||[]).forEach(m => { inMatch.add(m.id_double_a); inMatch.add(m.id_double_b); });
  const orfas = (doubles||[]).filter(d => !inMatch.has(d.id_double));
  console.log('\n=== Duplas SEM match (resíduo) ===');
  console.table(orfas.map(d => ({ id_double: d.id_double, dupla: d.display_name })));
}
main().catch(e => { console.error(e); process.exit(1); });