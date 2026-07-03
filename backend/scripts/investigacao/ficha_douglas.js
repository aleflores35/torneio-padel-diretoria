// READ-ONLY: ficha do Douglas Peil (645) — jogos (data/dupla/adversários) + quem falta enfrentar/ser dupla.
const supabase = require('../../supabase');
const ID_T = 7, EU = 645;
const key = (a, b) => a < b ? `${a}-${b}` : `${b}-${a}`;

async function run() {
  const [players, doubles, matches, rounds] = await Promise.all([
    supabase.from('players').select('id_player, name, side, category_id, active').eq('id_tournament', ID_T).then(r => r.data || []),
    supabase.from('doubles').select('id_double, id_player1, id_player2, id_round').eq('id_tournament', ID_T).then(r => r.data || []),
    supabase.from('matches').select('id_match, status, id_double_a, id_double_b, games_double_a, games_double_b, scheduled_at, absent_player_ids').eq('id_tournament', ID_T).then(r => r.data || []),
    supabase.from('rounds').select('id_round, round_number, round_type').eq('id_tournament', ID_T).then(r => r.data || []),
  ]);
  const pById = {}; players.forEach(p => pById[p.id_player] = p);
  const nm = id => pById[id] ? pById[id].name : '#' + id;
  const dMap = {}; doubles.forEach(d => dMap[d.id_double] = d);
  const rById = {}; rounds.forEach(r => rById[r.id_round] = r);
  const CAT = pById[EU].category_id;

  // duplas que contêm o Douglas
  const myDoubles = new Set(doubles.filter(d => d.id_player1 === EU || d.id_player2 === EU).map(d => d.id_double));
  const myMatches = matches.filter(m => myDoubles.has(m.id_double_a) || myDoubles.has(m.id_double_b))
    .filter(m => ['FINISHED', 'WO', 'IN_PROGRESS'].includes(m.status))
    .sort((a, b) => (a.scheduled_at || '').localeCompare(b.scheduled_at || ''));

  const faced = new Set(), partners = new Set();
  console.log(`FICHA — ${nm(EU)} (${pById[EU].side}, cat ${CAT})\n`);
  console.log('R# | data       | dupla (parceiro esq)        | adversários (dir / esq)              | placar  resultado');
  console.log('-'.repeat(104));
  for (const m of myMatches) {
    const myD = myDoubles.has(m.id_double_a) ? dMap[m.id_double_a] : dMap[m.id_double_b];
    const opD = myDoubles.has(m.id_double_a) ? dMap[m.id_double_b] : dMap[m.id_double_a];
    const myGames = myDoubles.has(m.id_double_a) ? m.games_double_a : m.games_double_b;
    const opGames = myDoubles.has(m.id_double_a) ? m.games_double_b : m.games_double_a;
    const parceiro = [myD.id_player1, myD.id_player2].find(x => x !== EU);
    const opRight = [opD.id_player1, opD.id_player2].find(x => pById[x] && pById[x].side === 'RIGHT');
    const opLeft = [opD.id_player1, opD.id_player2].find(x => pById[x] && pById[x].side === 'LEFT');
    if (parceiro) partners.add(parceiro);
    if (opRight) faced.add(opRight); // adversário do MESMO lado (direita) = o que conta no ranking
    const rN = rById[myD.id_round] ? rById[myD.id_round].round_number : '?';
    const res = (myGames > opGames) ? 'VITÓRIA' : (myGames < opGames ? 'derrota' : '—');
    const data = (m.scheduled_at || '').slice(0, 10);
    console.log(`${String(rN).padStart(2)} | ${data} | ${nm(parceiro).padEnd(27)} | ${(nm(opRight) + ' / ' + nm(opLeft)).padEnd(36)} | ${myGames}x${opGames}  ${res}${m.status === 'IN_PROGRESS' ? ' (em quadra)' : ''}`);
  }
  console.log(`\nTotal: ${myMatches.length} jogos · enfrentou ${faced.size} adversários de direita · foi dupla com ${partners.size} jogadores de esquerda\n`);

  // quem falta ENFRENTAR (direita, mesmo lado) e quem falta como PARCEIRO (esquerda)
  const dir = players.filter(p => p.category_id === CAT && p.active && p.side === 'RIGHT' && p.id_player !== EU);
  const esq = players.filter(p => p.category_id === CAT && p.active && p.side === 'LEFT');
  const faltaEnfrentar = dir.filter(p => !faced.has(p.id_player));
  const faltaParceiro = esq.filter(p => !partners.has(p.id_player));

  console.log(`FALTA ENFRENTAR (adversários de direita que ainda não jogaram contra ele) — ${faltaEnfrentar.length}:`);
  console.log('  ' + (faltaEnfrentar.map(p => p.name).join(', ') || '(nenhum — completou a direita!)'));
  console.log(`\nJÁ ENFRENTOU (${faced.size}): ${[...faced].map(nm).join(', ')}`);
  console.log(`\nFALTA SER DUPLA (esquerda com quem ainda não jogou) — ${faltaParceiro.length}:`);
  console.log('  ' + (faltaParceiro.map(p => p.name).join(', ') || '(nenhum)'));
}
run().catch(e => { console.error(e.message || e); process.exit(1); });
