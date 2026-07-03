// Lista todas femininas (players.category_id=3) do torneio 7 e cruza com:
// - impedimentos pra 2026-05-14
// - duplas já criadas na rodada 401
const supabase = require('../../supabase');

const TOURNAMENT_ID = 7;
const ROUND_ID = 401;
const CATEGORY_FEM = 3;
const ROUND_DATE = '2026-05-14';

async function run() {
  // 1) Femininas do torneio
  const { data: fems, error: eF } = await supabase
    .from('players')
    .select('id_player, name, whatsapp, category_id, payment_status')
    .eq('id_tournament', TOURNAMENT_ID)
    .eq('category_id', CATEGORY_FEM)
    .order('name', { ascending: true });
  if (eF) { console.error('Erro players:', eF); process.exit(1); }
  console.log(`Femininas torneio ${TOURNAMENT_ID} cat ${CATEGORY_FEM}: ${fems.length}`);

  // 2) Impedimentos pra data 2026-05-14
  const { data: abs } = await supabase
    .from('player_absences')
    .select('id_player, absence_date')
    .eq('id_tournament', TOURNAMENT_ID)
    .eq('absence_date', ROUND_DATE);
  const absentIds = new Set((abs || []).map(a => a.id_player));
  console.log(`Impedimentos em ${ROUND_DATE}: ${abs?.length ?? 0}`);

  // 3) Duplas da rodada 401
  const { data: doubles } = await supabase
    .from('doubles')
    .select('id_double, id_player1, id_player2')
    .eq('id_round', ROUND_ID);
  const inDoubleIds = new Set();
  const doubleByPlayer = {};
  for (const d of doubles || []) {
    inDoubleIds.add(d.id_player1);
    inDoubleIds.add(d.id_player2);
    doubleByPlayer[d.id_player1] = d.id_double;
    doubleByPlayer[d.id_player2] = d.id_double;
  }

  // 4) Tabela final
  console.log(`\n=== STATUS FEMININO RODADA 401 (${ROUND_DATE}) ===`);
  for (const p of fems) {
    const abs = absentIds.has(p.id_player);
    const inD = inDoubleIds.has(p.id_player);
    let status;
    if (abs) status = '⛔ IMPEDIDA';
    else if (inD) status = `✅ em dupla ${doubleByPlayer[p.id_player]}`;
    else status = '🟡 disponível (não sorteada)';
    console.log(`  ${p.name.padEnd(35)} (id=${p.id_player})  ${status}`);
  }

  // 5) Tanise específico em qualquer cat
  const { data: tanise } = await supabase
    .from('players')
    .select('id_player, name, category_id, id_tournament, payment_status')
    .ilike('name', '%Tanise%');
  console.log('\nMatches "Tanise":', tanise);
}

run().catch(e => { console.error(e); process.exit(1); });
