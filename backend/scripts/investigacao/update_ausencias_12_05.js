// Atualiza ausências da rodada 14/05 (tournament=7) conforme prints WhatsApp 12/05.
// 4 INSERTs (+ 2 já existentes, idempotente) e 3 DELETEs.
// Helio Garcia (lesão ~60d) está lançado APENAS pra 14/05 — gelo prolongado fica pra
// rodada à parte se Alessandro quiser.
// Uso: node scripts/investigacao/update_ausencias_12_05.js [--dry]
const supabase = require('../../supabase');

const ID_TOURNAMENT = 7;
const DATE = '2026-05-14';

const ADDS = [
  { id_player: 682, name: 'João Felipe Pereira' },
  { id_player: 681, name: 'Nelson Paiva' },
  { id_player: 689, name: 'Helio Garcia (lesão)' },
  { id_player: 670, name: 'Alisson Boyink' },
  // idempotentes — já estão lançados, upsert não duplica:
  { id_player: 646, name: 'Alex Severo (já existia)' },
  { id_player: 645, name: 'Douglas Peil (já existia)' },
];

const REMOVES = [
  { id_player: 694, name: 'Tanise Cezimbra' },
  { id_player: 698, name: 'Sabrina Schutz' },
  { id_player: 701, name: 'Nara Nunes' },
];

async function run() {
  const dry = process.argv.includes('--dry');
  console.log(`\n=== Update ausências ${DATE} (tournament=${ID_TOURNAMENT}) ${dry ? '[DRY-RUN]' : ''} ===\n`);

  console.log('— Upserts (ADD ausência) —');
  for (const p of ADDS) {
    if (dry) { console.log(`  (dry) + ${p.name} id=${p.id_player}`); continue; }
    const { error } = await supabase
      .from('player_absences')
      .upsert(
        { id_tournament: ID_TOURNAMENT, id_player: p.id_player, absence_date: DATE },
        { onConflict: 'id_tournament,id_player,absence_date' }
      );
    console.log(`  ${error ? '✗' : '✓'} ${p.name} (id=${p.id_player}) ${error ? '→ ' + error.message : ''}`);
  }

  console.log('\n— Deletes (REMOVE ausência) —');
  for (const p of REMOVES) {
    if (dry) { console.log(`  (dry) - ${p.name} id=${p.id_player}`); continue; }
    const { error, count } = await supabase
      .from('player_absences')
      .delete({ count: 'exact' })
      .eq('id_tournament', ID_TOURNAMENT)
      .eq('id_player', p.id_player)
      .eq('absence_date', DATE);
    console.log(`  ${error ? '✗' : '✓'} ${p.name} (id=${p.id_player}) ${error ? '→ ' + error.message : `(rows=${count ?? 0})`}`);
  }

  console.log('\n— Estado final em player_absences pra 14/05 —');
  const { data: finalRows } = await supabase
    .from('player_absences')
    .select('id_player, players(name, category_id)')
    .eq('id_tournament', ID_TOURNAMENT)
    .eq('absence_date', DATE)
    .order('id_player');
  (finalRows || []).forEach(r => {
    const p = Array.isArray(r.players) ? r.players[0] : r.players;
    console.log(`  id=${r.id_player} cat=${p?.category_id} ${p?.name}`);
  });
  console.log(`\nTotal: ${finalRows?.length ?? 0} ausências registradas pra ${DATE}.\n`);
}

run().catch(e => { console.error(e); process.exit(1); });
