// Read-only: com os 8 jogadores do round 416, é POSSÍVEL chegar a 0 repeat de mesma posição
// re-sorteando (reorganizando duplas)? Ou está forçado pelo histórico do pool?
// Mostra a matriz de "já se enfrentaram na MESMA posição" (diag pré-416) entre os LEFTs e entre os RIGHTs,
// e a melhor partição possível de cada lado.
// Rodar: node scripts/investigacao/sim_resorteio_416.js
const supabase = require('../../supabase');

const TOUR = 7, CAT = 2, ROUND = 416;

async function main() {
  const { data: doubles } = await supabase.from('doubles')
    .select('id_double, id_player1, id_player2').eq('id_round', ROUND);
  const playerIds = new Set();
  doubles.forEach(d => { playerIds.add(d.id_player1); playerIds.add(d.id_player2); });

  const { data: players } = await supabase.from('players')
    .select('id_player, name, side').in('id_player', [...playerIds]);
  const sideById = {}, NAME = {};
  players.forEach(p => { sideById[p.id_player] = p.side; NAME[p.id_player] = p.name.split(' ')[0]; });

  // oposições live (cat 2)
  const { data: opps } = await supabase.from('oppositions').select('*')
    .eq('id_tournament', TOUR).eq('id_category', CAT);
  const key = (a, b) => (a < b ? `${a}-${b}` : `${b}-${a}`);
  const liveDiag = {}, liveOpp = {};
  opps.forEach(o => { liveDiag[key(o.id_player1, o.id_player2)] = o.diagonal_count || 0; liveOpp[key(o.id_player1, o.id_player2)] = o.times_opposed || 0; });

  // reverte contribuição do 416 (matches atuais)
  const dblIds = doubles.map(d => d.id_double);
  const orM = dblIds.map(id => `id_double_a.eq.${id}`).concat(dblIds.map(id => `id_double_b.eq.${id}`)).join(',');
  const { data: liveMatches } = await supabase.from('matches').select('id_double_a, id_double_b').or(orM);
  const preDiag = { ...liveDiag };
  for (const m of liveMatches) {
    const A = doubles.find(d => d.id_double === m.id_double_a), B = doubles.find(d => d.id_double === m.id_double_b);
    if (!A || !B) continue;
    for (const pa of [A.id_player1, A.id_player2]) for (const pb of [B.id_player1, B.id_player2]) {
      if (sideById[pa] && sideById[pa] === sideById[pb] && sideById[pa] !== 'EITHER') {
        const k = key(pa, pb); preDiag[k] = Math.max(0, (preDiag[k] || 0) - 1);
      }
    }
  }

  const lefts = players.filter(p => p.side === 'LEFT').map(p => p.id_player);
  const rights = players.filter(p => p.side === 'RIGHT').map(p => p.id_player);

  function matrix(ids, label) {
    console.log(`\n=== ${label} — já se enfrentaram na MESMA posição (diag pré-416) ===`);
    for (const a of ids) {
      const row = ids.filter(b => b !== a).map(b => `${NAME[b]}:${preDiag[key(a, b)] || 0}`).join('  ');
      console.log(`  ${NAME[a]}: ${row}`);
    }
  }
  matrix(lefts, 'LEFTs');
  matrix(rights, 'RIGHTs');

  // 3 partições de 4 jogadores em 2 duelos; acha a de menos repeats (diag>0)
  function bestPartition(ids, label) {
    if (ids.length !== 4) { console.log(`${label}: pool != 4 (${ids.length}), pulo`); return; }
    const [a, b, c, d] = ids;
    const parts = [[[a, b], [c, d]], [[a, c], [b, d]], [[a, d], [b, c]]];
    console.log(`\n=== Melhor partição de duelos — ${label} ===`);
    let best = Infinity;
    parts.forEach(pt => {
      const reps = pt.filter(([x, y]) => (preDiag[key(x, y)] || 0) > 0).length;
      best = Math.min(best, reps);
      console.log(`  ${pt.map(([x, y]) => `${NAME[x]}×${NAME[y]}`).join('  |  ')}  → ${reps} repeat(s)`);
    });
    console.log(`  >>> mínimo de repeats possível em ${label}: ${best}`);
    return best;
  }
  const bl = bestPartition(lefts, 'LEFTs');
  const br = bestPartition(rights, 'RIGHTs');
  console.log(`\n================ VEREDITO ================`);
  console.log(`Mínimo total de repeats de mesma posição alcançável com estes 8 (re-sorteando duplas) = ${(bl || 0) + (br || 0)}`);
  console.log(`(LEFT-duels e RIGHT-duels podem ser escolhidos independentemente via partilha de parceiros)`);
}
main().catch(e => { console.error(e); process.exit(1); });
