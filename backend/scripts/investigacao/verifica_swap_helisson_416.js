// Read-only: PROVA que trocar Ivan(685)→Hélisson(688) no round 416 chega a 0 repeat de mesma posição,
// com as duplas propostas. Usa computeMatchCost (motor atual) com o histórico real.
// Proposta:
//   Match A (19:10): Dinho/Alessandro × Zanenga/Hélisson
//   Match B (19:10): Delia/João     × Gabriel/Pablo
// Rodar: node scripts/investigacao/verifica_swap_helisson_416.js
const supabase = require('../../supabase');
const { computeMatchCost } = require('../../services/weeklyDrawService');

const TOUR = 7, CAT = 2;
const P = { Dinho: 678, Alessandro: 690, Zanenga: 677, Helisson: 688, Delia: 675, Joao: 682, Gabriel: 680, Pablo: 686 };

async function main() {
  const { data: players } = await supabase.from('players').select('id_player, name, side').in('id_player', Object.values(P));
  const sideById = {}; players.forEach(p => { sideById[p.id_player] = p.side; });

  const { data: opps } = await supabase.from('oppositions').select('*').eq('id_tournament', TOUR).eq('id_category', CAT);
  const key = (a, b) => (a < b ? `${a}-${b}` : `${b}-${a}`);
  // contagens PRÉ-416: parte do live e reverte a contribuição dos matches atuais do 416
  // (confirmRound faz exatamente isso via revertCountersForRound antes de re-parear).
  const preOpp = {}, preDiag = {};
  opps.forEach(o => { const k = key(o.id_player1, o.id_player2); preOpp[k] = o.times_opposed || 0; preDiag[k] = o.diagonal_count || 0; });
  const { data: dbl416 } = await supabase.from('doubles').select('id_double, id_player1, id_player2').eq('id_round', 416);
  const allSides = {}; (await supabase.from('players').select('id_player, side').in('id_player', dbl416.flatMap(d => [d.id_player1, d.id_player2]))).data.forEach(p => { allSides[p.id_player] = p.side; });
  const dblIds = dbl416.map(d => d.id_double);
  const orM = dblIds.map(id => `id_double_a.eq.${id}`).concat(dblIds.map(id => `id_double_b.eq.${id}`)).join(',');
  const { data: m416 } = await supabase.from('matches').select('id_double_a, id_double_b').or(orM);
  for (const m of m416) {
    const A = dbl416.find(d => d.id_double === m.id_double_a), B = dbl416.find(d => d.id_double === m.id_double_b);
    if (!A || !B) continue;
    for (const pa of [A.id_player1, A.id_player2]) for (const pb of [B.id_player1, B.id_player2]) {
      const k = key(pa, pb); preOpp[k] = Math.max(0, (preOpp[k] || 0) - 1);
      if (allSides[pa] && allSides[pa] === allSides[pb] && allSides[pa] !== 'EITHER') preDiag[k] = Math.max(0, (preDiag[k] || 0) - 1);
    }
  }
  const oppCost = {}, diagCost = {};
  Object.keys(preOpp).forEach(k => { oppCost[k] = preOpp[k] * 100; });
  Object.keys(preDiag).forEach(k => { diagCost[k] = preDiag[k] * 200; });

  const D = {
    DinhoAlessandro: { id_player1: P.Dinho, id_player2: P.Alessandro },
    ZanengaHelisson: { id_player1: P.Zanenga, id_player2: P.Helisson },
    DeliaJoao: { id_player1: P.Delia, id_player2: P.Joao },
    GabrielPablo: { id_player1: P.Gabriel, id_player2: P.Pablo },
  };

  const matchA = computeMatchCost(D.DinhoAlessandro, D.ZanengaHelisson, oppCost, diagCost, sideById);
  const matchB = computeMatchCost(D.DeliaJoao, D.GabrielPablo, oppCost, diagCost, sideById);
  console.log('Match A: Dinho/Alessandro × Zanenga/Hélisson → custo', matchA, matchA >= 1_000_000 ? '⚠️ tem repeat de mesma posição' : '✅ sem repeat de mesma posição');
  console.log('Match B: Delia/João     × Gabriel/Pablo     → custo', matchB, matchB >= 1_000_000 ? '⚠️ tem repeat de mesma posição' : '✅ sem repeat de mesma posição');
  console.log('TOTAL same-position repeats:', (matchA >= 1_000_000 ? Math.floor(matchA / 1_000_000) : 0) + (matchB >= 1_000_000 ? Math.floor(matchB / 1_000_000) : 0));

  // detalhe dos duelos de mesma posição
  console.log('\nDuelos de mesma posição (devem ter diag=0):');
  const duels = [['Alessandro', 'Helisson'], ['Dinho', 'Zanenga'], ['Joao', 'Pablo'], ['Delia', 'Gabriel']];
  duels.forEach(([a, b]) => {
    const k = key(P[a], P[b]);
    console.log(`  ${a}(${sideById[P[a]]}) × ${b}(${sideById[P[b]]}): diag=${(diagCost[k] || 0) / 200}  opp=${(oppCost[k] || 0) / 100}`);
  });
}
main().catch(e => { console.error(e); process.exit(1); });
