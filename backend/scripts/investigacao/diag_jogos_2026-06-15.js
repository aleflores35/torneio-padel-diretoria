// Diagnóstico read-only (2026-06-15) — schedule COMPLETO da noite de 18/06 (2 quadras, cat 1/2/3)
// Objetivo: achar slot livre APÓS 20:30 pra remarcar o jogo da Nara (match 1323).
// Rodar: node scripts/investigacao/diag_jogos_2026-06-15.js
const supabase = require('../../supabase');

async function main() {
  const DATE = '2026-06-18';
  const { data: rounds } = await supabase.from('rounds')
    .select('id_round, id_category, status').eq('scheduled_date', DATE);
  const roundIds = (rounds || []).map(r => r.id_round);
  const catByRound = {}; (rounds || []).forEach(r => { catByRound[r.id_round] = r.id_category; });

  const { data: dbls } = await supabase.from('doubles')
    .select('id_double, id_round, display_name').in('id_round', roundIds);
  const dblName = {}; const dblRound = {};
  (dbls || []).forEach(d => { dblName[d.id_double] = d.display_name; dblRound[d.id_double] = d.id_round; });
  const dblIds = (dbls || []).map(d => d.id_double);

  const orMatch = dblIds.map(id => `id_double_a.eq.${id}`).concat(dblIds.map(id => `id_double_b.eq.${id}`)).join(',');
  const { data: matches } = await supabase.from('matches').select('*').or(orMatch);

  const { data: courts } = await supabase.from('courts').select('id_court, name, order_index');
  const courtName = {}; (courts || []).forEach(c => { courtName[c.id_court] = c.name; });

  console.log(`=== QUADRAS ===`);
  console.table((courts || []).map(c => ({ id: c.id_court, nome: c.name, ord: c.order_index })));

  console.log(`\n=== SCHEDULE 18/06 (ordenado por horário, depois quadra) ===`);
  const rows = (matches || []).map(m => {
    const round = dblRound[m.id_double_a] ?? dblRound[m.id_double_b];
    return {
      match: m.id_match,
      hora: m.scheduled_at ? m.scheduled_at.split('T')[1]?.substring(0, 5) : '—',
      quadra: courtName[m.id_court] || m.id_court,
      cat: catByRound[round],
      jogo: `${dblName[m.id_double_a]} × ${dblName[m.id_double_b]}`,
      status: m.status,
    };
  }).sort((a, b) => (a.hora + a.quadra).localeCompare(b.hora + b.quadra));
  console.table(rows);

  // grade de ocupação por (hora × quadra)
  console.log(`\n=== GRADE ocupação (hora × quadra) — vazio = LIVRE ===`);
  const slots = ['18:30', '19:10', '19:50', '20:30', '21:10', '21:50'];
  const courtsList = (courts || []).map(c => c.name);
  const grid = {};
  rows.forEach(r => { grid[`${r.hora}|${r.quadra}`] = r.match; });
  for (const s of slots) {
    const line = courtsList.map(c => `${c}: ${grid[`${s}|${c}`] ? 'match ' + grid[`${s}|${c}`] : '— LIVRE'}`).join('   ||   ');
    console.log(`  ${s}  ${s >= '20:30' ? '✅' : '  '}  ${line}`);
  }
}
main().catch(e => { console.error(e); process.exit(1); });
