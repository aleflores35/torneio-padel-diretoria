// Re-aplica confirmRound na rodada 393 (Masc Iniciante, quinta 30/04) usando o
// algoritmo NOVO de pareamento dupla-vs-dupla (oposições + duelo diagonal).
//
// Procedimento:
//   1. Reverte partnerships/oppositions com last_round_id=393 (idempotência)
//   2. Volta status da rodada pra DRAFT
//   3. Chama confirmRound(393) — que vai rodar pairDoublesGreedy e re-criar matches
//
// Pré-requisito: tabela oppositions já criada (migration 002) e backfill rodado.
//
// Uso: node scripts/reapply_round_393.js

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const supabase = require('../supabase');
const { confirmRound } = require('../services/weeklyDrawService');

const ID_ROUND = 393;

async function main() {
  // Snapshot ANTES — pra comparar
  const { data: before } = await supabase
    .from('matches')
    .select('id_match, id_double_a, id_double_b, scheduled_at, status')
    .or('id_double_a.in.(2773,2774,2775,2776,2777,2778,2779,2780,2781),id_double_b.in.(2773,2774,2775,2776,2777,2778,2779,2780,2781)')
    .order('scheduled_at', { ascending: true });
  console.log('=== Matches ANTES ===');
  for (const m of before || []) console.log(`  m=${m.id_match} ${m.id_double_a} VS ${m.id_double_b} @${m.scheduled_at} ${m.status}`);

  // 1. Voltar status pra DRAFT
  await supabase.from('rounds').update({ status: 'DRAFT' }).eq('id_round', ID_ROUND);
  console.log(`\n[1/3] Round ${ID_ROUND} → status DRAFT`);

  // 2. Re-rodar confirmRound (que internamente reverte counters via revertCountersForRound)
  console.log(`[2/3] Chamando confirmRound(${ID_ROUND})...`);
  const result = await confirmRound(ID_ROUND);
  console.log(`  → ${result.matches_created} matches criados, overflow=${result.overflow_count}`);
  console.log(`  → schedule:`, result.schedule);

  // 3. Snapshot DEPOIS
  const { data: after } = await supabase
    .from('matches')
    .select('id_match, id_double_a, id_double_b, scheduled_at, status')
    .or('id_double_a.in.(2773,2774,2775,2776,2777,2778,2779,2780,2781),id_double_b.in.(2773,2774,2775,2776,2777,2778,2779,2780,2781)')
    .order('scheduled_at', { ascending: true });
  console.log('\n=== Matches DEPOIS ===');

  // Buscar nomes pra ficar legível
  const dIds = new Set();
  (after || []).forEach(m => { dIds.add(m.id_double_a); dIds.add(m.id_double_b); });
  const { data: doubles } = await supabase.from('doubles').select('id_double, display_name').in('id_double', [...dIds]);
  const dn = {};
  (doubles || []).forEach(d => { dn[d.id_double] = d.display_name; });

  for (const m of after || []) {
    console.log(`  m=${m.id_match} ${dn[m.id_double_a]} VS ${dn[m.id_double_b]} @${m.scheduled_at} ${m.status}`);
  }

  // 4. Confere o caso Francisco — quem é o adversário dele agora?
  const franciscoDouble = (doubles || []).find(d => d.display_name && d.display_name.includes('Francisco Neto'));
  if (franciscoDouble) {
    const matchF = (after || []).find(m => m.id_double_a === franciscoDouble.id_double || m.id_double_b === franciscoDouble.id_double);
    if (matchF) {
      const oppId = matchF.id_double_a === franciscoDouble.id_double ? matchF.id_double_b : matchF.id_double_a;
      console.log(`\n=== FRANCISCO NETO ===`);
      console.log(`  Dupla: ${franciscoDouble.display_name}`);
      console.log(`  Adversário: ${dn[oppId]}`);
      console.log(`  Horário: ${matchF.scheduled_at}`);
    }
  }
}

main().catch(e => { console.error(e); process.exit(1); });
