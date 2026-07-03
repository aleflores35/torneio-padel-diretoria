// Lança ausências da rodada 2026-06-11 (quinta) para 3 atletas.
// Uso: node scripts/investigacao/ausencias_2026-06-11.js            (dry-run)
//      CONFIRM_EXECUTE=yes node scripts/investigacao/ausencias_2026-06-11.js  (grava)
const supabase = require('../../supabase');

const ID_TOURNAMENT = 7;
const ABSENCE_DATE = '2026-06-11';
const TARGETS = [
  { id: 699, name: 'Amanda Oestreich' },
  { id: 707, name: 'Mariele Schiefelbein' },
  { id: 668, name: 'Diego Schutz' },
];

async function run() {
  const execute = process.env.CONFIRM_EXECUTE === 'yes';
  console.log(`Rodada ${ABSENCE_DATE} · tournament ${ID_TOURNAMENT} · ${execute ? 'EXECUTANDO' : 'DRY-RUN'}\n`);
  for (const t of TARGETS) {
    if (!execute) { console.log(`(dry) ausência: ${t.name} (id=${t.id})`); continue; }
    const { error } = await supabase
      .from('player_absences')
      .upsert(
        { id_tournament: ID_TOURNAMENT, id_player: t.id, absence_date: ABSENCE_DATE },
        { onConflict: 'id_tournament,id_player,absence_date' }
      );
    if (error) console.log(`✗ falhou ${t.name}: ${error.message}`);
    else console.log(`✓ ausência registrada: ${t.name} (id=${t.id})`);
  }
}
run().catch(e => { console.error(e); process.exit(1); });