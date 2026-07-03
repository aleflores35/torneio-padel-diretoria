// Ajuste de ausências da quinta 25/06/2026 (pedido Alessandro, 22/06):
//   ADD  João Felipe Pereira (id 682, Masc 4ª) — fora essa semana
//   ADD  Hilton De Francheschi (id 651, Masc Inic) — fora essa semana
//   DEL  Helio Garcia (id 689) — ausência de 25/06 era engano; ele JOGA (vai recuperar atraso)
// Sorteio de 25/06 ainda não foi feito → ausências entram direto no sorteio (RondasPage).
// Uso: node scripts/investigacao/ajuste_ausencias_2026-06-25.js            (dry-run)
//      CONFIRM_EXECUTE=yes node scripts/investigacao/ajuste_ausencias_2026-06-25.js  (grava)
const supabase = require('../../supabase');

const ID_TOURNAMENT = 7;
const DATE = '2026-06-25';
const ADDS = [
  { id: 682, name: 'João Felipe Pereira' },
  { id: 651, name: 'Hilton De Francheschi' },
];
const DELS = [
  { id: 689, name: 'Helio Garcia' },
];

async function run() {
  const execute = process.env.CONFIRM_EXECUTE === 'yes';
  console.log(`quinta ${DATE} · tournament ${ID_TOURNAMENT} · ${execute ? 'EXECUTANDO' : 'DRY-RUN'}\n`);

  for (const a of ADDS) {
    if (!execute) { console.log(`(dry) ADD ausência: ${a.name} (id=${a.id})`); continue; }
    const { error } = await supabase
      .from('player_absences')
      .upsert(
        { id_tournament: ID_TOURNAMENT, id_player: a.id, absence_date: DATE },
        { onConflict: 'id_tournament,id_player,absence_date' }
      );
    console.log(error ? `✗ ADD falhou ${a.name}: ${error.message}` : `✓ ADD ausência: ${a.name} (id=${a.id})`);
  }

  for (const d of DELS) {
    if (!execute) { console.log(`(dry) DEL ausência: ${d.name} (id=${d.id})`); continue; }
    const { error } = await supabase
      .from('player_absences')
      .delete()
      .eq('id_tournament', ID_TOURNAMENT)
      .eq('id_player', d.id)
      .eq('absence_date', DATE);
    console.log(error ? `✗ DEL falhou ${d.name}: ${error.message}` : `✓ DEL ausência: ${d.name} (id=${d.id})`);
  }
}
run().catch(e => { console.error(e); process.exit(1); });
