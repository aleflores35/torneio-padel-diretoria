// Monta um CALENDÁRIO por quinta-feira pros 63 jogos que faltam, com redistribuição:
// base 4 Masc Iniciante + 3 Masc 4ª + 2 Feminino por quinta; quando uma categoria fecha,
// suas vagas vão pro Masc Iniciante (cap de 6/noite — cada pessoa joga 1x/noite, 27 ativos).
// Dentro de cada categoria/noite os jogos são player-disjuntos (ninguém joga 2x na mesma quinta).
// Uso: node scripts/investigacao/gen_calendario_fechamento.js   [--html]
const fs = require('fs');
const supabase = require('../../supabase');
const T = 7;
const key = (a, b) => a < b ? `${a}-${b}` : `${b}-${a}`;
const CATS = [{ c: 1, n: 'Masc Iniciante', base: 4, cap: 8 }, { c: 2, n: 'Masc 4ª', base: 3, cap: 4 }, { c: 3, n: 'Feminino', base: 2, cap: 3 }];
const MAX_PER_PLAYER = 2; // os mais atrasados podem jogar 2x na mesma noite (comprime a cauda)
const WANT_HTML = process.argv.includes('--html');

async function analyze(cat) {
  const { data: pl } = await supabase.from('players').select('id_player,name,side,active').eq('id_tournament', T).eq('category_id', cat);
  const P = {}, side = {}; pl.forEach(p => { P[p.id_player] = p.name; side[p.id_player] = p.side; });
  const active = pl.filter(p => p.active !== false);
  const R = active.filter(p => p.side === 'RIGHT').map(p => p.id_player);
  const L = active.filter(p => p.side === 'LEFT').map(p => p.id_player);
  const { data: rounds } = await supabase.from('rounds').select('id_round,round_type').eq('id_tournament', T).eq('id_category', cat);
  const regIds = rounds.filter(r => r.round_type !== 'EXHIBITION').map(r => r.id_round);
  const { data: dbl } = await supabase.from('doubles').select('id_double,id_player1,id_player2').in('id_round', regIds);
  const D = {}; dbl.forEach(d => D[d.id_double] = d);
  const { data: matches } = await supabase.from('matches').select('id_double_a,id_double_b,status').in('id_double_a', dbl.map(d => d.id_double)).in('status', ['FINISHED', 'WO', 'TO_PLAY']);
  const covRR = new Set(), covLL = new Set(), usedPart = new Set();
  for (const m of matches) {
    const da = D[m.id_double_a], db = D[m.id_double_b]; if (!da || !db) continue;
    usedPart.add(key(da.id_player1, da.id_player2)); usedPart.add(key(db.id_player1, db.id_player2));
    for (const pa of [da.id_player1, da.id_player2]) for (const pb of [db.id_player1, db.id_player2])
      if (side[pa] === side[pb]) { if (side[pa] === 'RIGHT') covRR.add(key(pa, pb)); else if (side[pa] === 'LEFT') covLL.add(key(pa, pb)); }
  }
  const missRR = [], missLL = [];
  for (let i = 0; i < R.length; i++) for (let j = i + 1; j < R.length; j++) if (!covRR.has(key(R[i], R[j]))) missRR.push([R[i], R[j]]);
  for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) if (!covLL.has(key(L[i], L[j]))) missLL.push([L[i], L[j]]);
  const isRep = (r, l) => usedPart.has(key(r, l)) ? 1 : 0;
  const orient = (rp, lp, ns) => { const [rA, rB] = rp, [lA, lB] = lp; const o = [];
    if (!ns.has(key(rA, lA)) && !ns.has(key(rB, lB))) o.push([[[rA, lA], [rB, lB]], isRep(rA, lA) + isRep(rB, lB)]);
    if (!ns.has(key(rA, lB)) && !ns.has(key(rB, lA))) o.push([[[rA, lB], [rB, lA]], isRep(rA, lB) + isRep(rB, lA)]);
    if (!o.length) return null; o.sort((a, b) => a[1] - b[1]); return o[0]; };
  const rDrive = missRR.length >= missLL.length;
  const driver = rDrive ? missRR : missLL, otherMiss = rDrive ? missLL : missRR;
  const OS = rDrive ? L : R; const Oall = []; for (let i = 0; i < OS.length; i++) for (let j = i + 1; j < OS.length; j++) Oall.push([OS[i], OS[j]]);
  const games = new Array(driver.length).fill(null); const ns = new Set();
  const fc = {}; for (const p of [...R, ...L]) { let c = 0; const oo = side[p] === 'RIGHT' ? L : R; for (const o of oo) if (!usedPart.has(key(p, o))) c++; fc[p] = c; }
  const ord = [...otherMiss].sort((a, b) => Math.min(fc[a[0]], fc[a[1]]) - Math.min(fc[b[0]], fc[b[1]]));
  const mk = (dp, op) => rDrive ? [dp, op] : [op, dp];
  for (const op of ord) { let bi = -1, bg = null, bc = 99;
    for (let i = 0; i < driver.length; i++) { if (games[i]) continue; const [rp, lp] = mk(driver[i], op); const g = orient(rp, lp, ns); if (g && g[1] < bc) { bc = g[1]; bi = i; bg = g; } }
    if (bi < 0) continue; const [rp, lp] = mk(driver[bi], op); games[bi] = { d: bg[0] }; bg[0].forEach(d => ns.add(key(d[0], d[1]))); }
  for (let i = 0; i < driver.length; i++) { if (games[i]) continue; let bg = null, bop = null, bc = 99;
    for (const op of Oall) { const [rp, lp] = mk(driver[i], op); const g = orient(rp, lp, ns); if (g && g[1] < bc) { bc = g[1]; bg = g; bop = op; } }
    games[i] = { d: bg[0] }; bg[0].forEach(d => ns.add(key(d[0], d[1]))); }
  // cada jogo: lista de 4 players + label
  return { cat, P, games: games.map(g => ({ players: [...g.d[0], ...g.d[1]], label: `${P[g.d[0][0]].split(' ')[0]}/${P[g.d[0][1]].split(' ')[0]} × ${P[g.d[1][0]].split(' ')[0]}/${P[g.d[1][1]].split(' ')[0]}` })) };
}

// seleciona até `budget` jogos da fila, permitindo até MAX_PER_PLAYER jogos por pessoa na noite
function pickNight(queue, budget) {
  const chosen = [], cnt = {}, rest = [];
  for (const g of queue) {
    if (chosen.length < budget && g.players.every(p => (cnt[p] || 0) < MAX_PER_PLAYER)) {
      chosen.push(g); g.players.forEach(p => cnt[p] = (cnt[p] || 0) + 1);
    } else rest.push(g);
  }
  // quem jogou 2x nesta noite (os atrasados)
  const doubled = Object.keys(cnt).filter(p => cnt[p] >= 2).map(Number);
  return { chosen, rest, doubled };
}

function thursday(base, weeksAhead) {
  const d = new Date(base.getTime() + weeksAhead * 7 * 86400000);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

(async () => {
  const data = {}; for (const { c } of CATS) data[c] = await analyze(c);
  const queue = {}; for (const { c } of CATS) queue[c] = [...data[c].games];
  const base = new Date(2026, 6, 2); // primeira quinta livre: 02/07/2026 (25/06 já está sorteado)
  const weeks = [];
  let w = 0;
  while (CATS.some(({ c }) => queue[c].length) && w < 40) {
    // budget desta quinta: base + vagas redistribuídas das categorias já fechadas → Masc Inic (cap)
    let freed = 0;
    for (const { c, base: b } of CATS) if (c !== 1 && queue[c].length === 0) freed += b;
    const budget = { 1: Math.min(CATS[0].cap, CATS[0].base + freed), 2: CATS[1].base, 3: CATS[2].base };
    const night = {}, doubled = {};
    for (const { c } of CATS) { const r = pickNight(queue[c], budget[c]); night[c] = r.chosen; queue[c] = r.rest; doubled[c] = r.doubled.map(id => data[c].P[id].split(' ')[0]); }
    if (!CATS.some(({ c }) => night[c].length)) break;
    weeks.push({ date: thursday(base, w), night, doubled });
    w++;
  }

  // saída texto
  console.log(`=== CALENDÁRIO DE FECHAMENTO — ${weeks.length} quintas (a partir de 02/07/2026) ===\n`);
  for (let i = 0; i < weeks.length; i++) {
    const wk = weeks[i]; const tot = CATS.reduce((s, { c }) => s + wk.night[c].length, 0);
    console.log(`📅 Quinta ${i + 1} — ${wk.date}  (${tot} jogos)`);
    for (const { c, n } of CATS) { if (!wk.night[c].length) continue;
      console.log(`   ${n} (${wk.night[c].length}):`);
      wk.night[c].forEach(g => console.log(`      • ${g.label}`));
    }
    const dbl = CATS.flatMap(({ c }) => wk.doubled[c]);
    if (dbl.length) console.log(`   ↳ jogam 2x: ${[...new Set(dbl)].join(', ')}`);
    console.log('');
  }
  const fin = {}; CATS.forEach(({ c, n }) => { let last = 0; weeks.forEach((wk, i) => { if (wk.night[c].length) last = i + 1; }); fin[n] = last; });
  console.log('Fecha em: ' + CATS.map(({ n }) => `${n}=quinta ${fin[n]}`).join(' · '));

  if (WANT_HTML) {
    const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    let rows = '';
    for (let i = 0; i < weeks.length; i++) { const wk = weeks[i]; const tot = CATS.reduce((s, { c }) => s + wk.night[c].length, 0);
      let cell = c => wk.night[c].map(g => `<div class="g">${esc(g.label)}</div>`).join('') || '<span class="empty">—</span>';
      rows += `<tr><td class="wk"><b>Q${i + 1}</b><span>${wk.date}</span></td><td>${cell(1)}</td><td>${cell(2)}</td><td>${cell(3)}</td><td class="tot">${tot}</td></tr>`;
    }
    fs.writeFileSync('C:/obralivre/clientes/parcerias/sociedade-rio-branco/ranking-srb-2026/_calendario_rows.html', rows, 'utf8');
    console.log('\n[--html] linhas da tabela salvas em _calendario_rows.html');
  }
})().catch(e => { console.error('ERR', e.message, e.stack); process.exit(1); });
