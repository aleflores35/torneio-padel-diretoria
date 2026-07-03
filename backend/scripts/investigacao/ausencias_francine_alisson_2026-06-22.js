// Pedido do Alessandro (22/06/2026): tirar Francine do sorteio "dessa semana"
// e Alisson "essa e a outra semana". Sorteios de 25/06 e 02/07 ainda não foram
// feitos → registrar em player_absences basta (RondasPage exclui no sorteio).
//   Francine Rossi (id 702, cat 3 Fem)  → 2026-06-25
//   Alisson Boyink (id 670, cat 1 Masc) → 2026-06-25 e 2026-07-02
// Uso: node scripts/investigacao/ausencias_francine_alisson_2026-06-22.js            (dry-run)
//      CONFIRM_EXECUTE=yes node scripts/investigacao/ausencias_francine_alisson_2026-06-22.js  (grava)
const supabase = require('../../supabase');

const ID_TOURNAMENT = 7;
const ABSENCES = [
  { id: 702, name: 'Francine Rossi', date: '2026-06-25' },
  { id: 670, name: 'Alisson Boyink', date: '2026-06-25' },
  { id: 670, name: 'Alisson Boyink', date: '2026-07-02' },
];

async function run() {
  const execute = process.env.CONFIRM_EXECUTE === 'yes';
  console.log(`tournament ${ID_TOURNAMENT} · ${execute ? 'EXECUTANDO' : 'DRY-RUN'}\n`);
  for (const a of ABSENCES) {
    if (!execute) { console.log(`(dry) ausência: ${a.name} (id=${a.id}) em ${a.date}`); continue; }
    const { error } = await supabase
      .from('player_absences')
      .upsert(
        { id_tournament: ID_TOURNAMENT, id_player: a.id, absence_date: a.date },
        { onConflict: 'id_tournament,id_player,absence_date' }
      );
    if (error) console.log(`✗ falhou ${a.name} ${a.date}: ${error.message}`);
    else console.log(`✓ ausência registrada: ${a.name} (id=${a.id}) em ${a.date}`);
  }
}
run().catch(e => { console.error(e); process.exit(1); });
