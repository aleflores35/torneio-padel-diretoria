// READ-ONLY: confirma a causa das 3 bandeiras + mede distância de um round-robin completo.
const supabase = require('../../supabase');
const ID_T = 7;

async function run() {
  const [players, doubles, matches, rounds] = await Promise.all([
    supabase.from('players').select('id_player, name, side, category_id, active').eq('id_tournament', ID_T).then(r => r.data || []),
    supabase.from('doubles').select('id_double, id_player1, id_player2, id_round').eq('id_tournament', ID_T).then(r => r.data || []),
    supabase.from('matches').select('id_match, status, id_double_a, id_double_b').eq('id_tournament', ID_T).then(r => r.data || []),
    supabase.from('rounds').select('id_round, id_category, round_type, round_number').eq('id_tournament', ID_T).then(r => r.data || []),
  ]);

  // (1) cat 1 direita: quem está inativo?
  console.log('=== cat 1 — players direita (active?) ===');
  players.filter(p => p.category_id === 1 && p.side === 'RIGHT')
    .forEach(p => console.log(`  ${String(p.id_player).padStart(3)} ${p.name.padEnd(24)} active=${p.active}`));

  // (2) Eduardo Horbach / lados estranhos no cat 2
  console.log('\n=== cat 2 — todos os players (lado) ===');
  players.filter(p => p.category_id === 2)
    .forEach(p => console.log(`  ${String(p.id_player).padStart(3)} ${p.name.padEnd(24)} side=${p.side} active=${p.active}`));

  // (3) Round-robin: quantos PARCEIROS distintos e ADVERSÁRIOS distintos cada um teve (cat 1, jogos contados)
  const dMap = {}; doubles.forEach(d => dMap[d.id_double] = d);
  const dRound = {}; doubles.forEach(d => dRound[d.id_double] = d.id_round);
  const exhRounds = new Set(rounds.filter(r => r.round_type === 'EXHIBITION').map(r => r.id_round));
  const cat1pids = new Set(players.filter(p => p.category_id === 1 && p.active).map(p => p.id_player));
  const nameOf = {}; players.forEach(p => nameOf[p.id_player] = p.name);

  const partners = {}, opponents = {};
  cat1pids.forEach(p => { partners[p] = new Set(); opponents[p] = new Set(); });

  for (const m of matches) {
    if (!['FINISHED', 'WO', 'IN_PROGRESS'].includes(m.status)) continue;
    const rid = dRound[m.id_double_a];
    if (exhRounds.has(rid)) continue;
    const dA = dMap[m.id_double_a], dB = dMap[m.id_double_b];
    if (!dA || !dB) continue;
    const A = [dA.id_player1, dA.id_player2].filter(x => cat1pids.has(x));
    const B = [dB.id_player1, dB.id_player2].filter(x => cat1pids.has(x));
    if (!A.length && !B.length) continue;
    // parceiros
    if (A.length === 2) { partners[A[0]].add(A[1]); partners[A[1]].add(A[0]); }
    if (B.length === 2) { partners[B[0]].add(B[1]); partners[B[1]].add(B[0]); }
    // adversários (mesmo lado: R x R, L x L)
    for (const a of A) for (const b of B) {
      const pa = players.find(p => p.id_player === a), pb = players.find(p => p.id_player === b);
      if (pa && pb && pa.side === pb.side) { opponents[a].add(b); opponents[b].add(a); }
    }
  }

  console.log('\n=== cat 1 — round-robin: parceiros e adversários distintos por atleta ===');
  console.log('(p/ round-robin COMPLETO de 14/lado: ~13 adversários do mesmo lado, ~14 parceiros do outro lado)\n');
  [...cat1pids].sort((a, b) => opponents[b].size - opponents[a].size).forEach(p => {
    console.log(`  ${nameOf[p].padEnd(24)} parceiros distintos: ${String(partners[p].size).padStart(2)} | adversários(mesmo lado): ${String(opponents[p].size).padStart(2)}`);
  });

  // resumo rodadas por categoria
  console.log('\n=== rodadas geradas por categoria (não-exibição) ===');
  [1, 2, 3].forEach(c => {
    const n = rounds.filter(r => r.id_category === c && r.round_type !== 'EXHIBITION').length;
    console.log(`  cat ${c}: ${n} rodadas`);
  });
}
run().catch(e => { console.error(e.message || e); process.exit(1); });
