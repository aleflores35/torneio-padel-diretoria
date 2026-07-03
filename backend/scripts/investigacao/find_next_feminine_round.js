// Identifica próxima rodada feminina (após 2026-05-07) e matches já agendados nela.
// Rodada 398 é a anterior (07/05) que tinha o jogo Catiane+Michele × Luana+Sabrina.
// Uso: node scripts/investigacao/find_next_feminine_round.js
const supabase = require('../../supabase');

async function run() {
  // Pegar a rodada 398 pra descobrir id_category
  const { data: r398 } = await supabase.from('rounds').select('*').eq('id_round', 398).single();
  console.log('Rodada 398 (referência):', r398);
  const catId = r398.id_category;
  console.log(`\nCategoria: ${catId}`);

  // Listar todas as rodadas dessa categoria, ordenadas
  const { data: rounds } = await supabase
    .from('rounds')
    .select('*')
    .eq('id_category', catId)
    .order('round_number', { ascending: true });
  console.log(`\nRodadas da categoria ${catId}:`);
  for (const r of rounds) {
    console.log(`  num=${r.round_number} id=${r.id_round} data=${r.scheduled_date} status=${r.status}`);
  }

  // Próxima rodada após a 398
  const next = rounds.find(r => r.round_number > r398.round_number);
  if (!next) { console.log('\n❌ Não há próxima rodada criada pra essa categoria.'); return; }
  console.log(`\n✅ Próxima rodada: id=${next.id_round} num=${next.round_number} data=${next.scheduled_date} status=${next.status}`);

  // Matches já agendados na próxima rodada
  const { data: nextMatches } = await supabase
    .from('matches')
    .select('id_match, status, scheduled_at, id_court, id_double_a, id_double_b')
    .eq('id_round', next.id_round)
    .order('scheduled_at', { ascending: true });
  console.log(`\nMatches já na rodada ${next.id_round} (${nextMatches.length}):`);
  for (const m of nextMatches) {
    console.log(`  id_match=${m.id_match} ${m.scheduled_at} court=${m.id_court} A=${m.id_double_a} B=${m.id_double_b} ${m.status}`);
  }

  // Verificar se as 4 atletas (Catiane 704, Michele 693, Luana 697, Sabrina 698)
  // já têm jogos nessa próxima rodada (constraint 1 jogo/pessoa/dia)
  const PLAYER_IDS = [704, 693, 697, 698];
  const doubleIds = [...new Set(nextMatches.flatMap(m => [m.id_double_a, m.id_double_b]))];
  if (doubleIds.length) {
    const { data: doubles } = await supabase.from('doubles').select('*').in('id_double', doubleIds);
    const conflicts = [];
    for (const m of nextMatches) {
      const dA = doubles.find(d => d.id_double === m.id_double_a);
      const dB = doubles.find(d => d.id_double === m.id_double_b);
      const playersInMatch = [dA?.id_player1, dA?.id_player2, dB?.id_player1, dB?.id_player2];
      const overlap = PLAYER_IDS.filter(p => playersInMatch.includes(p));
      if (overlap.length) {
        const names = { 704:'Catiane', 693:'Michele', 697:'Luana', 698:'Sabrina' };
        conflicts.push(`  ⚠️ match ${m.id_match} (${m.scheduled_at}): conflito com ${overlap.map(p=>names[p]).join(', ')}`);
      }
    }
    console.log(`\nConflitos com Catiane/Michele/Luana/Sabrina na próxima rodada:`);
    if (conflicts.length === 0) console.log('  ✅ Nenhuma das 4 tem outro jogo nesse dia.');
    else conflicts.forEach(c => console.log(c));
  }
}

run().catch(e => { console.error(e); process.exit(1); });
