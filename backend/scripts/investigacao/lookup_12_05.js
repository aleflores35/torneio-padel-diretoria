// Dry-run: identifica players pelos telefones/nomes dos prints do grupo 12/05.
// NÃO faz INSERT/DELETE — só lê e imprime quem é quem pra Alessandro validar.
// Uso: node scripts/investigacao/lookup_12_05.js
const supabase = require('../../supabase');

const ABSENCE_DATE = '2026-05-14';
const ID_TOURNAMENT = 7;

// Lista vinda dos prints do WhatsApp em 11-12/05.
// action: 'add' = lançar ausência. 'remove' = remover ausência (reconsiderou).
const TARGETS = [
  // ADD — declararam impedimento depois do bug-fix de fuso
  { action: 'add',    hint: 'joão felipe',     phone: '5199050619', note: 'avisou DM no número 9905-0619' },
  { action: 'add',    hint: 'nelson paiva',    phone: '5196726191', note: 'torneio Compadel — DM + grupo' },
  { action: 'add',    hint: null,              phone: '5198177573', note: 'LESÃO ~60 dias (foto da coxa); ver se precisa lançar +rodadas' },
  { action: 'add',    hint: 'alex severo',     phone: '5199135469', note: 'já lançado em 11/05 — upsert idempotente' },
  { action: 'add',    hint: 'alisson',         phone: null,         note: 'BSE - Alisson, mensagem no grupo "Nesta quinta nao estarei"' },
  { action: 'add',    hint: 'douglas peil',    phone: '5183397605', note: 'pediu pra não esquecer; provavelmente já está' },

  // REMOVE — tinham declarado, reconsideraram
  { action: 'remove', hint: null,              phone: '5196329322', note: 'DM — Alessandro confirmou "vou fazer por dentro"' },
  { action: 'remove', hint: 'sabrina schutz',  phone: '5199188962', note: 'sem jogo no Compadel, volta ao sorteio' },
  { action: 'remove', hint: 'tanise',          phone: null,         note: 'mencionada por Sabrina no grupo' },
  { action: 'remove', hint: 'elenara',         phone: '5196354374', note: 'Nara — volta ao sorteio; antes tinha declarado' },
];

async function findPlayer(hint, phone) {
  if (phone) {
    const { data: byPhone } = await supabase
      .from('players')
      .select('id_player, name, whatsapp, category_id')
      .ilike('whatsapp', `%${phone}%`);
    if (byPhone && byPhone.length === 1) return { match: byPhone[0], how: 'phone' };
    if (byPhone && byPhone.length > 1) return { match: null, how: 'phone-ambig', candidates: byPhone };
  }
  if (hint) {
    const { data: byName } = await supabase
      .from('players')
      .select('id_player, name, whatsapp, category_id')
      .ilike('name', `%${hint}%`);
    if (!byName || byName.length === 0) return { match: null, how: 'nomatch' };
    if (byName.length === 1) return { match: byName[0], how: 'name' };
    return { match: null, how: 'name-ambig', candidates: byName };
  }
  return { match: null, how: 'nomatch' };
}

async function existingAbsence(id_player) {
  const { data } = await supabase
    .from('player_absences')
    .select('id_player, absence_date')
    .eq('id_tournament', ID_TOURNAMENT)
    .eq('id_player', id_player)
    .eq('absence_date', ABSENCE_DATE);
  return data && data.length > 0;
}

async function run() {
  console.log(`\n=== Lookup ausências ${ABSENCE_DATE} (tournament=${ID_TOURNAMENT}) ===\n`);
  for (const t of TARGETS) {
    const r = await findPlayer(t.hint, t.phone);
    if (r.match) {
      const has = await existingAbsence(r.match.id_player);
      const status = t.action === 'add'
        ? (has ? '○ já tem ausência (nada a fazer)' : '+ vai INSERIR')
        : (has ? '- vai DELETAR' : '○ não tem ausência (nada a fazer)');
      console.log(`[${t.action.toUpperCase()}] "${t.hint || t.phone}" → id=${r.match.id_player} "${r.match.name}" (${r.match.whatsapp}) cat=${r.match.category_id} ${status}`);
      console.log(`         ${t.note}`);
    } else if (r.how === 'nomatch') {
      console.log(`[${t.action.toUpperCase()}] "${t.hint || t.phone}" → ✗ NENHUM player encontrado — ${t.note}`);
    } else {
      console.log(`[${t.action.toUpperCase()}] "${t.hint || t.phone}" → ⚠ AMBÍGUO (${r.candidates.length} candidatos):`);
      r.candidates.forEach(c => console.log(`           id=${c.id_player} "${c.name}" (${c.whatsapp}) cat=${c.category_id}`));
      console.log(`         ${t.note}`);
    }
  }
  console.log('\n(dry-run — nenhum INSERT ou DELETE foi executado)\n');
}

run().catch(e => { console.error(e); process.exit(1); });
