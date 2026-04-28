// Verifica se a round 393 (após reapply) tem alguma diagonal direta repetida
// das rounds anteriores (370, 377). Imprime cada match com flag de qualidade.

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const supabase = require('../supabase');

async function main() {
  const ID_ROUND = 393;
  const ID_TOURNAMENT = 7;
  const ID_CATEGORY = 1;

  // Duplas e matches da round 393
  const { data: doubles } = await supabase.from('doubles').select('*').eq('id_round', ID_ROUND);
  const dById = {};
  doubles.forEach(d => { dById[d.id_double] = d; });
  const dIds = doubles.map(d => d.id_double);

  const [{ data: mA }, { data: mB }] = await Promise.all([
    supabase.from('matches').select('*').in('id_double_a', dIds),
    supabase.from('matches').select('*').in('id_double_b', dIds)
  ]);
  const seen = new Set();
  const matches = [];
  for (const m of [...(mA||[]), ...(mB||[])]) {
    if (seen.has(m.id_match)) continue;
    seen.add(m.id_match);
    matches.push(m);
  }

  // Lados
  const playerIds = new Set();
  doubles.forEach(d => { playerIds.add(d.id_player1); playerIds.add(d.id_player2); });
  const { data: ps } = await supabase.from('players').select('id_player, name, side').in('id_player', [...playerIds]);
  const pById = {};
  ps.forEach(p => { pById[p.id_player] = p; });

  // Oppositions globais (após reapply)
  const { data: opps, error: oppErr } = await supabase
    .from('oppositions').select('*')
    .eq('id_tournament', ID_TOURNAMENT).eq('id_category', ID_CATEGORY);
  if (oppErr) { console.error('Erro buscando oppositions:', oppErr); process.exit(1); }
  const oppMap = {};
  (opps || []).forEach(o => {
    const k = `${o.id_player1}-${o.id_player2}`;
    oppMap[k] = o;
  });
  console.log(`(${(opps||[]).length} oppositions na categoria)\n`);

  console.log('=== Round 393 — análise por match ===\n');
  for (const m of matches) {
    const da = dById[m.id_double_a];
    const db = dById[m.id_double_b];
    console.log(`Match ${m.id_match} @${m.scheduled_at?.substring(11,16)}`);
    console.log(`  ${da.display_name}  vs  ${db.display_name}`);
    const aP = [da.id_player1, da.id_player2];
    const bP = [db.id_player1, db.id_player2];
    let warns = 0;
    for (const pa of aP) {
      for (const pb of bP) {
        const p1 = Math.min(pa, pb);
        const p2 = Math.max(pa, pb);
        const key = `${p1}-${p2}`;
        const o = oppMap[key];
        if (!o) continue;
        const sa = pById[pa].side;
        const sb = pById[pb].side;
        const isDiag = sa === sb && sa !== 'EITHER';
        const flag = (o.times_opposed > 1 || o.diagonal_count > 1) ? ' ⚠️' : '';
        if (flag) warns++;
        console.log(`    ${pById[pa].name} (${sa}) × ${pById[pb].name} (${sb}) — opposed=${o.times_opposed} diag=${o.diagonal_count}${isDiag?' [diagonal]':''}${flag}`);
      }
    }
    if (warns === 0) console.log(`    ✓ sem repetições`);
    console.log();
  }

  // Quem ficou de fora
  const playingDoubleIds = new Set();
  matches.forEach(m => { playingDoubleIds.add(m.id_double_a); playingDoubleIds.add(m.id_double_b); });
  const out = doubles.filter(d => !playingDoubleIds.has(d.id_double));
  console.log(`Duplas fora desta noite (${out.length}):`);
  for (const d of out) console.log(`  - ${d.display_name}`);
}

main().catch(e => { console.error(e); process.exit(1); });
