// Lança ausências do dia 14/05 pras 6 pessoas que se manifestaram no grupo
// e bateram no bug de fuso (servidor UTC fechava prazo 3h cedo, às 15h BRT).
// Uso: node scripts/investigacao/lanca_ausencias_11_05.js
const supabase = require('../../supabase');

const ID_TOURNAMENT = 7;
const ABSENCE_DATE = '2026-05-14';

// Lookup por substring case-insensitive no name (em players).
// Telefones do screenshot WhatsApp servem de cross-check, mas o match é por nome.
const TARGETS = [
  { hint: 'alex severo',       phone: '5199135469' },
  { hint: 'dani',              phone: '5198101212', strictName: null }, // confirmar
  { hint: 'douglas costa',     phone: '5183397605' },
  { hint: 'denilson magalhães', phone: '5197493063' },
  { hint: 'marcio ferreira',   phone: null }, // Diretoria Padle (interno)
  { hint: 'lucas',             phone: '5491488995' }, // pode ser ambíguo
];

async function findPlayer(hint, phone) {
  // 1) Tenta por telefone (mais preciso)
  if (phone) {
    const { data: byPhone } = await supabase
      .from('players')
      .select('id_player, name, whatsapp, category_id')
      .ilike('whatsapp', `%${phone}%`);
    if (byPhone && byPhone.length === 1) return { match: byPhone[0], how: 'phone' };
    if (byPhone && byPhone.length > 1) return { match: null, how: 'phone-ambig', candidates: byPhone };
  }
  // 2) Fallback por nome
  const { data: byName } = await supabase
    .from('players')
    .select('id_player, name, whatsapp, category_id')
    .ilike('name', `%${hint}%`);
  if (!byName || byName.length === 0) return { match: null, how: 'nomatch' };
  if (byName.length === 1) return { match: byName[0], how: 'name' };
  return { match: null, how: 'name-ambig', candidates: byName };
}

async function run() {
  console.log(`\n=== Lookup dos 6 atletas (rodada quinta ${ABSENCE_DATE}) ===\n`);
  const resolved = [];
  for (const t of TARGETS) {
    const r = await findPlayer(t.hint, t.phone);
    if (r.match) {
      console.log(`✓ "${t.hint}" → id=${r.match.id_player} "${r.match.name}" (${r.match.whatsapp}) [via ${r.how}]`);
      resolved.push({ ...t, player: r.match });
    } else if (r.how === 'nomatch') {
      console.log(`✗ "${t.hint}" → NENHUM player encontrado`);
    } else {
      console.log(`⚠ "${t.hint}" → AMBÍGUO (${r.candidates.length} candidatos):`);
      r.candidates.forEach(c => console.log(`    id=${c.id_player} "${c.name}" (${c.whatsapp})`));
    }
  }

  console.log(`\n=== Inserção de ausências ===\n`);
  const dryRun = process.argv.includes('--dry');
  if (dryRun) {
    console.log('(dry-run, nada será inserido)');
    return;
  }

  for (const { player } of resolved) {
    const { error } = await supabase
      .from('player_absences')
      .upsert(
        { id_tournament: ID_TOURNAMENT, id_player: player.id_player, absence_date: ABSENCE_DATE },
        { onConflict: 'id_tournament,id_player,absence_date' }
      );
    if (error) console.log(`✗ upsert falhou pra ${player.name}: ${error.message}`);
    else      console.log(`✓ ausência registrada: ${player.name} (id=${player.id_player})`);
  }
}

run().catch(e => { console.error(e); process.exit(1); });
