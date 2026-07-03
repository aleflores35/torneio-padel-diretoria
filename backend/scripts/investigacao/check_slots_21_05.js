// Mostra todos os matches agendados em 2026-05-21 e os slots livres
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
const supabase = require('../../supabase');

const DATE = '2026-05-21';
const TIME_SLOTS = ['18:30', '19:10', '19:50', '20:30', '21:10', '21:50'];

async function run() {
  const { data: courts } = await supabase
    .from('courts').select('id_court, name, order_index')
    .eq('id_tournament', 7).order('order_index');
  const { data: matches } = await supabase
    .from('matches')
    .select('id_match, id_court, scheduled_at, id_double_a, id_double_b, status, doubleA:id_double_a(display_name), doubleB:id_double_b(display_name)')
    .eq('id_tournament', 7)
    .not('scheduled_at', 'is', null)
    .gte('scheduled_at', `${DATE}T00:00:00`)
    .lte('scheduled_at', `${DATE}T23:59:59`)
    .order('scheduled_at');

  const courtName = {};
  courts.forEach(c => { courtName[c.id_court] = c.name; });

  // Mapa slot → match
  const slotMap = {};
  for (const c of courts) for (const t of TIME_SLOTS) slotMap[`${c.id_court}|${t}`] = null;
  for (const m of matches || []) {
    const t = m.scheduled_at.substring(11, 16);
    slotMap[`${m.id_court}|${t}`] = m;
  }

  console.log(`\n=== Slots em ${DATE} ===\n`);
  console.log(`Horário    | ${courts.map(c => c.name.padEnd(22)).join(' | ')}`);
  console.log(`-----------+${courts.map(() => '-'.repeat(24)).join('+')}`);
  for (const t of TIME_SLOTS) {
    const cells = courts.map(c => {
      const m = slotMap[`${c.id_court}|${t}`];
      if (!m) return '🟢 LIVRE'.padEnd(22);
      const a = m.doubleA?.display_name || '?';
      const b = m.doubleB?.display_name || '?';
      return `${a.split(' / ')[0].slice(0,9)}+${a.split(' / ')[1]?.slice(0,9) || ''} × ${b.split(' / ')[0]?.slice(0,5) || ''}`.padEnd(22);
    });
    console.log(`${t}      | ${cells.join(' | ')}`);
  }

  console.log(`\n=== Detalhe matches já marcados ===`);
  for (const m of matches || []) {
    console.log(`  m=${m.id_match} @ ${courtName[m.id_court]} ${m.scheduled_at.substring(11,16)} · ${m.doubleA?.display_name || '?'} × ${m.doubleB?.display_name || '?'} · ${m.status}`);
  }

  const livres = Object.entries(slotMap).filter(([_, v]) => v === null).map(([k]) => {
    const [cid, t] = k.split('|');
    return `${courtName[cid]} ${t}`;
  });
  console.log(`\n=== Slots LIVRES (${livres.length}) ===`);
  for (const s of livres) console.log(`  🟢 ${s}`);
}

run().catch(e => { console.error(e); process.exit(1); });
