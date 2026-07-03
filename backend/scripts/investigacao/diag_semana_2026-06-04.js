// READ-ONLY: diagnóstico da semana 2026-06-04 (quinta).
// Levanta: categorias, os 2 Daniels (cat 4), os 5 impedimentos, rodadas já
// existentes na data, e disponíveis do feminino. NÃO escreve nada.
//
//   node scripts/investigacao/diag_semana_2026-06-04.js

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
const supabase = require('../../supabase');

const ID_TOURNAMENT = 7;
const DATE = '2026-06-04';

const NAMES_OF_INTEREST = [
  'daniel souza staevie',
  'daniel teixeira',
  'alisson',
  'alessandro flores',
  'rodrigo',
  'helisson', // Hélisson Borges (sem acento p/ match)
  'andre dos santos hoppe',
];

function norm(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

async function main() {
  // 1. Categorias
  const { data: cats } = await supabase.from('categories').select('id, name, active').order('id');
  console.log('=== CATEGORIAS ===');
  for (const c of cats || []) console.log(`  id=${c.id} · ${c.name} · active=${c.active}`);

  // 2. Todos os players ativos
  const { data: players } = await supabase
    .from('players')
    .select('id_player, name, side, category_id, active, whatsapp')
    .eq('id_tournament', ID_TOURNAMENT);

  const byCat = {};
  for (const p of players || []) {
    if (!p.active) continue;
    byCat[p.category_id] = byCat[p.category_id] || [];
    byCat[p.category_id].push(p);
  }
  console.log('\n=== CONTAGEM ATIVOS POR CATEGORIA ===');
  for (const cid of Object.keys(byCat)) {
    console.log(`  cat ${cid}: ${byCat[cid].length} ativos`);
  }

  // 3. Players de interesse (match por substring normalizada)
  console.log('\n=== PLAYERS DE INTERESSE (busca por nome) ===');
  for (const term of NAMES_OF_INTEREST) {
    const hits = (players || []).filter(p => norm(p.name).includes(term));
    console.log(`\n  "${term}" → ${hits.length} hit(s):`);
    for (const h of hits) {
      console.log(`    id=${h.id_player} · ${h.name} · side=${h.side} · cat=${h.category_id} · active=${h.active} · wpp=${h.whatsapp || '—'}`);
    }
  }

  // 4. Rodadas já existentes na data (todas categorias)
  const { data: rounds } = await supabase
    .from('rounds')
    .select('id_round, id_category, round_number, status, round_type, scheduled_date')
    .eq('id_tournament', ID_TOURNAMENT)
    .eq('scheduled_date', DATE);
  console.log(`\n=== RODADAS EM ${DATE} ===`);
  if (!rounds || rounds.length === 0) console.log('  (nenhuma — semana ainda não sorteada)');
  for (const r of rounds || []) {
    console.log(`  round id=${r.id_round} · cat=${r.id_category} · #${r.round_number} · ${r.status} · ${r.round_type}`);
  }

  // 4b. Último round por categoria (pra saber o número da próxima)
  console.log('\n=== ÚLTIMO ROUND POR CATEGORIA ===');
  for (const cid of [1, 2, 3]) {
    const { data: last } = await supabase
      .from('rounds')
      .select('round_number, scheduled_date, status')
      .eq('id_tournament', ID_TOURNAMENT).eq('id_category', cid)
      .order('round_number', { ascending: false }).limit(1);
    const l = last?.[0];
    console.log(`  cat ${cid}: ${l ? `#${l.round_number} (${l.scheduled_date}, ${l.status})` : 'nenhum'}`);
  }

  // 5. Slots/quadras + matches já agendados na data
  const { data: courts } = await supabase
    .from('courts').select('id_court, name, order_index')
    .eq('id_tournament', ID_TOURNAMENT).order('order_index');
  const { data: existingMatches } = await supabase
    .from('matches').select('id_court, scheduled_at, status')
    .eq('id_tournament', ID_TOURNAMENT)
    .not('scheduled_at', 'is', null)
    .gte('scheduled_at', `${DATE}T00:00:00`).lte('scheduled_at', `${DATE}T23:59:59`);
  console.log(`\n=== QUADRAS: ${(courts || []).length} · MATCHES já em ${DATE}: ${(existingMatches || []).length} ===`);
  for (const m of existingMatches || []) console.log(`    court=${m.id_court} · ${m.scheduled_at?.substring(11,16)} · ${m.status}`);

  // 6. Feminino (cat 3): ativos + games_played calculado
  const fem = (byCat[3] || []);
  const { data: allDoubles } = await supabase.from('doubles').select('id_double, id_player1, id_player2').eq('id_tournament', ID_TOURNAMENT);
  const { data: counted } = await supabase.from('matches').select('id_double_a, id_double_b').eq('id_tournament', ID_TOURNAMENT).in('status', ['FINISHED', 'WO']);
  const dToP = {}; for (const d of allDoubles || []) dToP[d.id_double] = [d.id_player1, d.id_player2];
  const games = {}; for (const m of counted || []) for (const pid of [...(dToP[m.id_double_a]||[]), ...(dToP[m.id_double_b]||[])]) games[pid] = (games[pid]||0)+1;
  console.log(`\n=== FEMININO (cat 3) — ${fem.length} ativas (games_played) ===`);
  const sideCount = { RIGHT: 0, LEFT: 0, EITHER: 0 };
  for (const p of fem.sort((a,b)=>(games[a.id_player]||0)-(games[b.id_player]||0))) {
    sideCount[p.side] = (sideCount[p.side]||0)+1;
    console.log(`  id=${p.id_player} · ${p.name} · ${p.side} · games=${games[p.id_player]||0}`);
  }
  console.log(`  sides: RIGHT=${sideCount.RIGHT} LEFT=${sideCount.LEFT} EITHER=${sideCount.EITHER}`);
}

main().catch(e => { console.error('💥', e); process.exit(1); });