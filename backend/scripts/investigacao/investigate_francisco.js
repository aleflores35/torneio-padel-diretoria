// Investigação ad-hoc: por que Francisco Neto recebeu Flavio Justo de novo no sorteio?
// Roda: node investigate_francisco.js

const supabase = require('./supabase');

async function main() {
  // 1. Achar Francisco Neto
  const { data: francisco } = await supabase
    .from('players')
    .select('id_player, name, side, category_id, id_tournament')
    .ilike('name', '%francisco%neto%');
  console.log('=== Francisco Neto ===');
  console.log(francisco);

  if (!francisco || francisco.length === 0) return;
  const f = francisco[0];

  // 2. Achar Flavio Justo
  const { data: flavio } = await supabase
    .from('players')
    .select('id_player, name, side, category_id')
    .ilike('name', '%flavio%justo%');
  console.log('\n=== Flavio Justo ===');
  console.log(flavio);

  // 3. Histórico de duplas do Francisco (TODAS as rodadas)
  const { data: doubles } = await supabase
    .from('doubles')
    .select('id_double, id_player1, id_player2, id_round, display_name')
    .or(`id_player1.eq.${f.id_player},id_player2.eq.${f.id_player}`)
    .order('id_round', { ascending: true });
  console.log(`\n=== Duplas do Francisco (id=${f.id_player}) ===`);
  for (const d of doubles || []) {
    const partnerId = d.id_player1 === f.id_player ? d.id_player2 : d.id_player1;
    console.log(`  round=${d.id_round} · double=${d.id_double} · "${d.display_name}" · partner=${partnerId}`);
  }

  // 4. Tabela partnerships - todos os pares envolvendo Francisco
  const { data: partnerships } = await supabase
    .from('partnerships')
    .select('*')
    .or(`id_player1.eq.${f.id_player},id_player2.eq.${f.id_player}`);
  console.log(`\n=== Partnerships do Francisco (${(partnerships||[]).length}) ===`);
  for (const p of partnerships || []) {
    const partnerId = p.id_player1 === f.id_player ? p.id_player2 : p.id_player1;
    console.log(`  partner=${partnerId} · times_paired=${p.times_paired} · last_round=${p.last_round_id} · cat=${p.id_category}`);
  }

  // 5. Status de TODAS as rodadas dessa categoria
  const { data: rounds } = await supabase
    .from('rounds')
    .select('id_round, round_number, scheduled_date, status, round_type')
    .eq('id_tournament', f.id_tournament)
    .eq('id_category', f.category_id)
    .order('round_number', { ascending: true });
  console.log(`\n=== Rounds da categoria ${f.category_id} ===`);
  for (const r of rounds || []) {
    console.log(`  round_number=${r.round_number} · id=${r.id_round} · date=${r.scheduled_date} · status=${r.status} · type=${r.round_type}`);
  }

  // 6. CONTAGEM: Quantos partnerships totais existem nessa categoria?
  const { data: allPart, count } = await supabase
    .from('partnerships')
    .select('*', { count: 'exact', head: false })
    .eq('id_tournament', f.id_tournament)
    .eq('id_category', f.category_id);
  console.log(`\n=== Total partnerships na categoria do Francisco: ${count || (allPart||[]).length} ===`);
}

main().catch(e => { console.error(e); process.exit(1); });
