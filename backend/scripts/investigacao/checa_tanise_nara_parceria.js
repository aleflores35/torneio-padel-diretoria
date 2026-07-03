// READ-ONLY — verifica se Tanise (694) e Nara já jogaram juntas de verdade,
// e se Paola (692) + Amanda (699) já foram dupla. Decide se "Tanise+Nara"
// bate na regra pétrea de não-repetir-parceria.
const supabase = require('../../supabase');

async function pairHistory(label, idA, idB) {
  // partnership row
  const lo = Math.min(idA, idB), hi = Math.max(idA, idB);
  const { data: part } = await supabase.from('partnerships')
    .select('id_partnership, times_paired, last_round_id, id_category')
    .eq('id_player1', lo).eq('id_player2', hi);
  // doubles reais com os 2 juntos
  const { data: dblsA } = await supabase.from('doubles')
    .select('id_double, id_round, display_name, id_player1, id_player2')
    .or(`id_player1.eq.${idA},id_player2.eq.${idA}`);
  const together = (dblsA || []).filter(d => d.id_player1 === idB || d.id_player2 === idB);
  console.log(`\n=== ${label} ===`);
  console.log('partnership row:', JSON.stringify(part));
  if (together.length === 0) {
    console.log('doubles juntas: NENHUMA');
  } else {
    for (const d of together) {
      const { data: ms } = await supabase.from('matches')
        .select('id_match, status').or(`id_double_a.eq.${d.id_double},id_double_b.eq.${d.id_double}`);
      const { data: rd } = await supabase.from('rounds')
        .select('round_number, status, scheduled_date').eq('id_round', d.id_round).single();
      console.log(`  double ${d.id_double} round=${d.id_round} (#${rd?.round_number} ${rd?.status} ${rd?.scheduled_date}) "${d.display_name}"`);
      console.log(`    matches:`, JSON.stringify(ms));
    }
  }
}

async function main() {
  const { data: nara } = await supabase.from('players')
    .select('id_player, name, side').ilike('name', '%nara%').eq('category_id', 3);
  console.log('Nara:', JSON.stringify(nara));
  const naraId = (nara || [])[0]?.id_player;
  if (!naraId) { console.log('Nara não encontrada'); return; }

  await pairHistory(`Tanise (694) + Nara (${naraId})`, 694, naraId);
  await pairHistory('Paola (692) + Amanda (699)', 692, 699);
}
main().catch(e => { console.error('ERRO:', e); process.exit(1); });
