// READ-ONLY: como fica a Masc. Iniciante (cat 1) SEM o Diego Schutz (668) — laggard da esquerda.
const supabase = require('../../supabase');
const ID_T = 7, CAT = 1, EXCLUIR = 668; // Diego Schutz
const key = (a, b) => a < b ? `${a}-${b}` : `${b}-${a}`;
const allPairs = (arr) => { const o = []; for (let i = 0; i < arr.length; i++) for (let j = i + 1; j < arr.length; j++) o.push(key(arr[i], arr[j])); return o; };

function buildSchedule(R, L, needRset, needLset) {
  const cap = Math.floor(Math.min(R.length, L.length) / 2);
  const greedyMatch = (s, n) => { const u = new Set(), o = []; for (const k of s) { if (o.length >= n) break; const [a, b] = k.split('-').map(Number); if (u.has(a) || u.has(b)) continue; o.push(k); u.add(a); u.add(b); } return { pairs: o, used: u }; };
  const fill = (pl, used, c) => { const o = [], free = pl.filter(p => !used.has(p)); for (let i = 0; i + 1 < free.length && o.length < c; i += 2) o.push(key(free[i], free[i + 1])); return o; };
  const rounds = []; let nGames = 0, g = 0;
  while ((needRset.size || needLset.size) && g++ < 500) {
    const mR = greedyMatch(needRset, cap), mL = greedyMatch(needLset, cap);
    let m = Math.min(cap, Math.max(mR.pairs.length, mL.pairs.length)); if (!m) break;
    let rP = mR.pairs.slice(), lP = mL.pairs.slice();
    if (rP.length < m) rP = rP.concat(fill(R, mR.used, m - rP.length));
    if (lP.length < m) lP = lP.concat(fill(L, mL.used, m - lP.length));
    m = Math.min(rP.length, lP.length);
    for (let i = 0; i < m; i++) { needRset.delete(rP[i]); needLset.delete(lP[i]); }
    nGames += m; rounds.push(m);
  }
  return { nRounds: rounds.length, nGames };
}

async function run() {
  const [players, doubles, matches, rounds] = await Promise.all([
    supabase.from('players').select('id_player, name, side, category_id, active').eq('id_tournament', ID_T).then(r => r.data || []),
    supabase.from('doubles').select('id_double, id_player1, id_player2, id_round').eq('id_tournament', ID_T).then(r => r.data || []),
    supabase.from('matches').select('id_match, status, id_double_a, id_double_b').eq('id_tournament', ID_T).then(r => r.data || []),
    supabase.from('rounds').select('id_round, round_type').eq('id_tournament', ID_T).then(r => r.data || []),
  ]);
  const pById = {}; players.forEach(p => pById[p.id_player] = p);
  const nm = id => pById[id] ? pById[id].name : '#' + id;
  const dMap = {}; doubles.forEach(d => dMap[d.id_double] = d);
  const dRound = {}; doubles.forEach(d => dRound[d.id_double] = d.id_round);
  const exh = new Set(rounds.filter(r => r.round_type === 'EXHIBITION').map(r => r.id_round));

  const playedRight = new Set(), playedLeft = new Set();
  for (const m of matches) {
    if (!['FINISHED', 'WO', 'IN_PROGRESS'].includes(m.status)) continue;
    if (exh.has(dRound[m.id_double_a])) continue;
    const dA = dMap[m.id_double_a], dB = dMap[m.id_double_b]; if (!dA || !dB) continue;
    const side = s => x => pById[x] && pById[x].active && x !== EXCLUIR && pById[x].side === s;
    const Ra = [dA.id_player1, dA.id_player2].find(side('RIGHT')), Rb = [dB.id_player1, dB.id_player2].find(side('RIGHT'));
    const La = [dA.id_player1, dA.id_player2].find(side('LEFT')), Lb = [dB.id_player1, dB.id_player2].find(side('LEFT'));
    if (Ra && Rb) playedRight.add(key(Ra, Rb));
    if (La && Lb) playedLeft.add(key(La, Lb));
  }
  const R = players.filter(p => p.category_id === CAT && p.active && p.side === 'RIGHT' && p.id_player !== EXCLUIR).map(p => p.id_player);
  const L = players.filter(p => p.category_id === CAT && p.active && p.side === 'LEFT' && p.id_player !== EXCLUIR).map(p => p.id_player);
  const needR = new Set(allPairs(R).filter(k => !playedRight.has(k)));
  const needL = new Set(allPairs(L).filter(k => !playedLeft.has(k)));
  // piso
  const rem = {}; [...R, ...L].forEach(p => rem[p] = 0);
  needR.forEach(k => k.split('-').forEach(p => rem[p]++));
  needL.forEach(k => k.split('-').forEach(p => rem[p]++));
  let piso = 0, pisoId = null; Object.entries(rem).forEach(([p, n]) => { if (n > piso) { piso = n; pisoId = p; } });
  const nfR = needR.size, nfL = needL.size;
  const { nRounds, nGames } = buildSchedule(R, L, needR, needL);

  console.log(`MASC. INICIANTE sem o ${nm(EXCLUIR)}:`);
  console.log(`  roster: ${R.length} direita × ${L.length} esquerda ${R.length === L.length ? '(EQUILIBRADO ✓)' : ''}`);
  console.log(`  confrontos faltam: ${nfR} direita + ${nfL} esquerda`);
  console.log(`  plano: ${nRounds} rodadas / ${nGames} jogos`);
  console.log(`  piso de semanas: ${piso} (${nm(pisoId)})`);
  // top 3 mais atrasados
  const top = Object.entries(rem).sort((a, b) => b[1] - a[1]).slice(0, 4);
  console.log(`  mais atrasados: ${top.map(([p, n]) => `${nm(Number(p))} (${n})`).join(', ')}`);
}
run().catch(e => { console.error(e.message || e); process.exit(1); });
