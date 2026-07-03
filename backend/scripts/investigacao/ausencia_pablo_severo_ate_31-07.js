// Ausência do Pablo Severo (id 673) em todas as rodadas (quintas) até 31/07/2026.
// Uso: node scripts/investigacao/ausencia_pablo_severo_ate_31-07.js            (dry-run)
//      CONFIRM_EXECUTE=yes node ... (grava)
const supabase = require('../../supabase');

const ID_TOURNAMENT = 7;
const ID_PLAYER = 673; // Pablo Severo
const DATES = [
  '2026-06-11', '2026-06-18', '2026-06-25',
  '2026-07-02', '2026-07-09', '2026-07-16', '2026-07-23', '2026-07-30',
];

async function run() {
  const execute = process.env.CONFIRM_EXECUTE === 'yes';
  console.log(`Pablo Severo (id ${ID_PLAYER}) · tournament ${ID_TOURNAMENT} · ${execute ? 'EXECUTANDO' : 'DRY-RUN'}\n`);
  for (const d of DATES) {
    if (!execute) { console.log(`(dry) ausência: ${d}`); continue; }
    const { error } = await supabase
      .from('player_absences')
      .upsert(
        { id_tournament: ID_TOURNAMENT, id_player: ID_PLAYER, absence_date: d },
        { onConflict: 'id_tournament,id_player,absence_date' }
      );
    if (error) console.log(`✗ falhou ${d}: ${error.message}`);
    else console.log(`✓ ausência registrada: ${d}`);
  }
}
run().catch(e => { console.error(e); process.exit(1); });
