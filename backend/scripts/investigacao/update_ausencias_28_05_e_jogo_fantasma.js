// Ações da sessão 25/05 (segunda) baseadas em mensagens WhatsApp dos atletas:
//
// 1) Ausências rodada 28/05 (tournament=7):
//    ADD: Sabrina Schutz (698), Rodrigo Keller "Automóveis" (659), Diego Schutz (668)
//    Lucas Jardim (648) JÁ tem ausência registrada — upsert é idempotente.
//    REMOVE: Maria Luísa (691) — "Essa semana eu não tenho mais impedimento"
//
// 2) Match retroativa round 398 (07/05, fem rodada 4):
//    Sabrina (Luana+Sabrina d=2805) 9 x 1 Catiane (Michele+Catiane d=2804) FINISHED
//    Reportado pela Sabrina: "aconteceu um jogo que não está no sistema".
//    Análise: única rodada onde essa formação existe é 398 (07/05). Confirmado
//    com Alessandro.
//
// Uso: node scripts/investigacao/update_ausencias_28_05_e_jogo_fantasma.js [--dry]

const supabase = require('../../supabase');

const ID_TOURNAMENT = 7;
const DATE_ABSENCE = '2026-05-28';

const ADDS = [
  { id_player: 698, name: 'Sabrina Schutz' },
  { id_player: 659, name: 'Rodrigo Keller (Automóveis)' },
  { id_player: 668, name: 'Diego Schutz (dos Santos)' },
  // idempotente — já existe:
  { id_player: 648, name: 'Lucas Jardim (já existia)' },
];

const REMOVES = [
  { id_player: 691, name: 'Maria Luísa' },
];

const MATCH = {
  id_tournament: 7,
  id_group: null,
  stage: 'GROUP',
  id_double_a: 2805, // Luana Bock / Sabrina Schutz (round 398)
  id_double_b: 2804, // Michele Fontoura / Catiane (round 398)
  id_court: 17,
  scheduled_at: '2026-05-07T20:30:00+00:00',
  planned_duration_min: 30,
  games_double_a: 9,
  games_double_b: 1,
  status: 'FINISHED',
  moderator_approved: 0,
  absent_player_ids: [],
};

async function run() {
  const dry = process.argv.includes('--dry');
  console.log(`\n=== Update 28/05 + jogo retroativo round 398 ${dry ? '[DRY-RUN]' : ''} ===\n`);

  console.log(`— Ausências ADD ${DATE_ABSENCE} (upsert) —`);
  for (const p of ADDS) {
    if (dry) { console.log(`  (dry) + ${p.name} id=${p.id_player}`); continue; }
    const { error } = await supabase
      .from('player_absences')
      .upsert(
        { id_tournament: ID_TOURNAMENT, id_player: p.id_player, absence_date: DATE_ABSENCE },
        { onConflict: 'id_tournament,id_player,absence_date' }
      );
    console.log(`  ${error ? '✗' : '✓'} ${p.name} (id=${p.id_player})${error ? ' → ' + error.message : ''}`);
  }

  console.log(`\n— Ausências REMOVE ${DATE_ABSENCE} —`);
  for (const p of REMOVES) {
    if (dry) { console.log(`  (dry) - ${p.name} id=${p.id_player}`); continue; }
    const { error, count } = await supabase
      .from('player_absences')
      .delete({ count: 'exact' })
      .eq('id_tournament', ID_TOURNAMENT)
      .eq('id_player', p.id_player)
      .eq('absence_date', DATE_ABSENCE);
    console.log(`  ${error ? '✗' : '✓'} ${p.name} (id=${p.id_player})${error ? ' → ' + error.message : ` (rows=${count ?? 0})`}`);
  }

  console.log(`\n— Estado final ausências ${DATE_ABSENCE} —`);
  const { data: finalRows } = await supabase
    .from('player_absences')
    .select('id_player, players(name, category_id)')
    .eq('id_tournament', ID_TOURNAMENT)
    .eq('absence_date', DATE_ABSENCE)
    .order('id_player');
  (finalRows || []).forEach(r => {
    const p = Array.isArray(r.players) ? r.players[0] : r.players;
    console.log(`  id=${r.id_player} cat=${p?.category_id} ${p?.name}`);
  });
  console.log(`  total: ${finalRows?.length ?? 0}`);

  console.log(`\n— Match retroativa round 398 (07/05) —`);
  // Idempotência: confere se já existe match entre essas duas duplas em qualquer ordem
  const { data: existing } = await supabase
    .from('matches')
    .select('id_match, games_double_a, games_double_b, status')
    .or(`and(id_double_a.eq.${MATCH.id_double_a},id_double_b.eq.${MATCH.id_double_b}),and(id_double_a.eq.${MATCH.id_double_b},id_double_b.eq.${MATCH.id_double_a})`);
  if (existing && existing.length > 0) {
    console.log(`  ⚠️  Já existe match dessas duplas — pulando insert.`);
    existing.forEach(m => console.log(`     m=${m.id_match} ${m.status} ${m.games_double_a}x${m.games_double_b}`));
  } else if (dry) {
    console.log(`  (dry) + INSERT match d=${MATCH.id_double_a} x d=${MATCH.id_double_b} ${MATCH.games_double_a}x${MATCH.games_double_b} ${MATCH.status} ${MATCH.scheduled_at}`);
  } else {
    const { data: inserted, error } = await supabase
      .from('matches')
      .insert(MATCH)
      .select('id_match');
    if (error) console.log(`  ✗ erro insert: ${error.message}`);
    else console.log(`  ✓ match criada id=${inserted[0]?.id_match} (Luana+Sabrina 9 x 1 Michele+Catiane)`);
  }
}

run().catch(e => { console.error(e); process.exit(1); });
