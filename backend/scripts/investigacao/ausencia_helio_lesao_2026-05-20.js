// Registra ausência prolongada do Helio Garcia (id=689 · Masculino 4ª · LEFT)
// por lesão — informado por Alessandro em 20/05: "fora por mais uns 40 dias".
// Cobre 6 quintas-feiras: 21/05, 28/05, 04/06, 11/06, 18/06, 25/06.
// Idempotente (upsert) — pode rodar de novo sem duplicar.
// Continuação do update_ausencias_12_05.js (que já lançou 14/05 e comentou
// que "gelo prolongado fica pra rodada à parte se Alessandro quiser").
// Uso: node scripts/investigacao/ausencia_helio_lesao_2026-05-20.js [--dry]
const supabase = require('../../supabase');

const ID_TOURNAMENT = 7;
const PLAYER = { id_player: 689, name: 'Helio Garcia (lesão)' };
const DATES = [
  '2026-05-21',
  '2026-05-28',
  '2026-06-04',
  '2026-06-11',
  '2026-06-18',
  '2026-06-25',
];

async function run() {
  const dry = process.argv.includes('--dry');
  console.log(`\n=== Ausência prolongada Helio Garcia (id=${PLAYER.id_player}) ${dry ? '[DRY-RUN]' : ''} ===`);
  console.log(`Tournament=${ID_TOURNAMENT} · ${DATES.length} quintas (${DATES[0]} → ${DATES[DATES.length - 1]})\n`);

  for (const date of DATES) {
    if (dry) { console.log(`  (dry) + ${PLAYER.name} em ${date}`); continue; }
    const { error } = await supabase
      .from('player_absences')
      .upsert(
        { id_tournament: ID_TOURNAMENT, id_player: PLAYER.id_player, absence_date: date },
        { onConflict: 'id_tournament,id_player,absence_date' }
      );
    console.log(`  ${error ? '✗' : '✓'} ${date}${error ? ' → ' + error.message : ''}`);
  }

  console.log('\n— Estado final em player_absences pro Helio (todas as datas) —');
  const { data: finalRows } = await supabase
    .from('player_absences')
    .select('absence_date')
    .eq('id_tournament', ID_TOURNAMENT)
    .eq('id_player', PLAYER.id_player)
    .order('absence_date');
  (finalRows || []).forEach(r => console.log(`  ${r.absence_date}`));
  console.log(`\nTotal: ${finalRows?.length ?? 0} ausências registradas pro Helio.\n`);
}

run().catch(e => { console.error(e); process.exit(1); });
