// Read-only: simula o motor ATUAL (pós-commit c3b1746) no round 416 real.
// Pergunta: o motor com SAME_POSITION_REPEAT_COST ainda casa Pablo×Ivan (mesma posição)?
// Reconstrói as oposições ANTES do 416 (reverte a contribuição do próprio 416) e roda pairDoublesGreedy.
// Rodar: node scripts/investigacao/sim_motor_416.js
const supabase = require('../../supabase');
const { computeMatchCost, pairDoublesGreedy } = require('../../services/weeklyDrawService');

const TOUR = 7, CAT = 2, ROUND = 416;
const NAME = {};

async function main() {
  // 1) duplas do round 416
  const { data: doubles } = await supabase.from('doubles')
    .select('id_double, display_name, id_player1, id_player2').eq('id_round', ROUND);
  const playerIds = new Set();
  doubles.forEach(d => { playerIds.add(d.id_player1); playerIds.add(d.id_player2); });

  // 2) jogadores + lados
  const { data: players } = await supabase.from('players')
    .select('id_player, name, side').in('id_player', [...playerIds]);
  const sideById = {};
  players.forEach(p => { sideById[p.id_player] = p.side; NAME[p.id_player] = p.name; });
  console.log('=== Jogadores (lado) ===');
  console.table(players.map(p => ({ id: p.id_player, nome: p.name, lado: p.side })));
  console.log('\n=== Duplas round 416 ===');
  console.table(doubles.map(d => ({ id: d.id_double, dupla: d.display_name, p1: `${NAME[d.id_player1]}(${sideById[d.id_player1]})`, p2: `${NAME[d.id_player2]}(${sideById[d.id_player2]})` })));

  // 3) matches LIVE do 416 (pareamento atual + created_at)
  const dblIds = doubles.map(d => d.id_double);
  const dblName = {}; doubles.forEach(d => { dblName[d.id_double] = d.display_name; });
  const orM = dblIds.map(id => `id_double_a.eq.${id}`).concat(dblIds.map(id => `id_double_b.eq.${id}`)).join(',');
  const { data: liveMatches } = await supabase.from('matches')
    .select('id_match, id_double_a, id_double_b, created_at, status').or(orM);
  console.log('\n=== Pareamento LIVE (atual) ===');
  liveMatches.forEach(m => console.log(`  match ${m.id_match} [${m.status}] criado ${m.created_at}: ${dblName[m.id_double_a]} × ${dblName[m.id_double_b]}`));

  // 4) oposições LIVE (cat 2) entre esses jogadores
  const { data: opps } = await supabase.from('oppositions').select('*')
    .eq('id_tournament', TOUR).eq('id_category', CAT);
  const key = (a, b) => (a < b ? `${a}-${b}` : `${b}-${a}`);
  const liveOpp = {}, liveDiag = {};
  opps.forEach(o => { liveOpp[key(o.id_player1, o.id_player2)] = o.times_opposed || 0; liveDiag[key(o.id_player1, o.id_player2)] = o.diagonal_count || 0; });

  // 5) reconstrói PRÉ-416: reverte a contribuição dos matches atuais do 416
  const preOpp = { ...liveOpp }, preDiag = { ...liveDiag };
  for (const m of liveMatches) {
    const A = doubles.find(d => d.id_double === m.id_double_a);
    const B = doubles.find(d => d.id_double === m.id_double_b);
    if (!A || !B) continue;
    for (const pa of [A.id_player1, A.id_player2]) {
      for (const pb of [B.id_player1, B.id_player2]) {
        const k = key(pa, pb);
        preOpp[k] = Math.max(0, (preOpp[k] || 0) - 1);
        if (sideById[pa] && sideById[pa] === sideById[pb] && sideById[pa] !== 'EITHER') {
          preDiag[k] = Math.max(0, (preDiag[k] || 0) - 1);
        }
      }
    }
  }

  // converte contagens pré-416 em custos (mesmos pesos do buildOppositionCost: opp×100, diag×200)
  const oppCost = {}, diagCost = {};
  Object.keys(preOpp).forEach(k => { oppCost[k] = preOpp[k] * 100; });
  Object.keys(preDiag).forEach(k => { diagCost[k] = preDiag[k] * 200; });

  // 6) mostra diag pré-416 relevante (Pablo 686)
  console.log('\n=== diagonal_count PRÉ-416 envolvendo Pablo(686) ===');
  [...playerIds].filter(p => p !== 686).forEach(p => {
    const k = key(686, p);
    if ((preDiag[k] || 0) > 0 || (preOpp[k] || 0) > 0) console.log(`  Pablo × ${NAME[p]}: opp=${preOpp[k] || 0} diag=${preDiag[k] || 0}`);
  });

  // 7) custo de TODAS as 3 partições possíveis (4 duplas → 2 jogos)
  const [d1, d2, d3, d4] = doubles;
  const partitions = [
    [[d1, d2], [d3, d4]],
    [[d1, d3], [d2, d4]],
    [[d1, d4], [d2, d3]],
  ];
  console.log('\n=== Custo das 3 partições (motor atual, pré-416) ===');
  partitions.forEach((part, i) => {
    let total = 0; const desc = [];
    part.forEach(([a, b]) => {
      const c = computeMatchCost(a, b, oppCost, diagCost, sideById);
      total += c;
      desc.push(`${dblName[a.id_double]} × ${dblName[b.id_double]} (custo ${c})`);
    });
    const dominant = total >= 1_000_000 ? '  ⚠️ contém repeat de MESMA POSIÇÃO' : '  ✅ sem repeat de mesma posição';
    console.log(`  Partição ${i + 1}: custo TOTAL ${total}${dominant}`);
    desc.forEach(d => console.log(`      ${d}`));
  });

  // 8) o que o motor atual escolheria
  const chosen = pairDoublesGreedy(doubles, oppCost, diagCost, sideById, 500);
  console.log('\n=== Pareamento que o MOTOR ATUAL escolheria (pairDoublesGreedy) ===');
  chosen.forEach(([a, b]) => console.log(`  ${dblName[a.id_double]} × ${dblName[b.id_double]}`));
}
main().catch(e => { console.error(e); process.exit(1); });
