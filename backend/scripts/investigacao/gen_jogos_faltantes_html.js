// Gera a página "Jogos que faltam para fechar o ranking" na RÉGUA DE PARCERIA (decisão 23/06):
// campeonato = round-robin de PARCERIA (cada direita joga 1x como dupla com cada esquerda).
// Regras: 1) nunca repetir parceira (todas as duplas abaixo são inéditas) · 2) todos terminam com
// o mesmo nº de jogos · 3) adversário de mesma posição evita repetir mas PODE (⚠️) · 4) diagonal fraco.
// Cada jogo = 2 parcerias inéditas (2 duplas). Inclui calendário por quinta (2x/noite p/ atrasados).
// Uso: node scripts/investigacao/gen_jogos_faltantes_html.js
const fs = require('fs');
const supabase = require('../../supabase');
const T = 7;
const key = (a, b) => a < b ? `${a}-${b}` : `${b}-${a}`;
const CATS = [{ c: 3, n: 'Feminino' }, { c: 2, n: 'Masc 4ª' }, { c: 1, n: 'Masc Iniciante' }];
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

async function analyze(cat) {
  const { data: pl } = await supabase.from('players').select('id_player,name,side,active').eq('id_tournament', T).eq('category_id', cat);
  const P = {}, side = {}; pl.forEach(p => { P[p.id_player] = p.name; side[p.id_player] = p.side; });
  const active = pl.filter(p => p.active !== false);
  const R = active.filter(p => p.side === 'RIGHT').map(p => p.id_player);
  const L = active.filter(p => p.side === 'LEFT').map(p => p.id_player);
  const inativos = pl.filter(p => p.active === false).map(p => p.name);
  const { data: rounds } = await supabase.from('rounds').select('id_round,round_type').eq('id_tournament', T).eq('id_category', cat);
  const regIds = rounds.filter(r => r.round_type !== 'EXHIBITION').map(r => r.id_round);
  const { data: dbl } = await supabase.from('doubles').select('id_double,id_player1,id_player2').in('id_round', regIds);
  const D = {}; dbl.forEach(d => D[d.id_double] = d);
  const { data: matches } = await supabase.from('matches').select('id_double_a,id_double_b,status,scheduled_at').in('id_double_a', dbl.map(d => d.id_double)).in('status', ['FINISHED', 'WO', 'TO_PLAY']);
  // parcerias usadas (R×L) + confrontos de mesma posição usados (p/ desempate adversário)
  const usedPart = new Set(), usedRR = new Set(), usedLL = new Set();
  for (const m of matches) {
    const da = D[m.id_double_a], db = D[m.id_double_b]; if (!da || !db) continue;
    for (const d of [da, db]) { const p1 = d.id_player1, p2 = d.id_player2;
      if ((side[p1] === 'RIGHT' && side[p2] === 'LEFT') || (side[p1] === 'LEFT' && side[p2] === 'RIGHT')) usedPart.add(key(p1, p2)); }
    for (const pa of [da.id_player1, da.id_player2]) for (const pb of [db.id_player1, db.id_player2])
      if (side[pa] === side[pb]) { if (side[pa] === 'RIGHT') usedRR.add(key(pa, pb)); else if (side[pa] === 'LEFT') usedLL.add(key(pa, pb)); }
  }
  // parcerias INÉDITAS R×L
  const fresh = [];
  for (const r of R) for (const l of L) if (!usedPart.has(key(r, l))) fresh.push([r, l]);
  // pareia parcerias inéditas em jogos (2 por jogo, jogadores distintos), minimizando repetição
  // de adversário de mesma posição (rule 3) como desempate fraco.
  const advRepOf = (a, b) => (usedRR.has(key(a[0], b[0])) ? 1 : 0) + (usedLL.has(key(a[1], b[1])) ? 1 : 0);
  // pareamento mais-restrito-primeiro: pareia a parceria do jogador com mais parcerias pendentes
  // com outra compatível (jogadores distintos), minimizando adversário repetido. Reduz "sobra".
  const items = fresh.map(p => ({ p, used: false }));
  const games = [], sobra = [];
  while (true) {
    const live = items.filter(e => !e.used);
    if (live.length < 2) break;
    const deg = {}; live.forEach(e => { deg[e.p[0]] = (deg[e.p[0]] || 0) + 1; deg[e.p[1]] = (deg[e.p[1]] || 0) + 1; });
    const md = e => Math.max(deg[e.p[0]], deg[e.p[1]]);
    live.sort((a, b) => md(b) - md(a));
    const e1 = live[0];
    let best = null, bc = [99, 99];
    for (const e2 of live) {
      if (e2 === e1) continue;
      if (e1.p[0] === e2.p[0] || e1.p[1] === e2.p[1]) continue; // jogador em comum → inválido
      const score = [advRepOf(e1.p, e2.p), -md(e2)];
      if (score[0] < bc[0] || (score[0] === bc[0] && score[1] < bc[1])) { best = e2; bc = score; }
    }
    if (!best) { e1.used = true; sobra.push(e1.p); continue; } // não há par compatível
    e1.used = best.used = true; games.push({ d: [e1.p, best.p], advRep: advRepOf(e1.p, best.p) });
  }
  items.filter(e => !e.used).forEach(e => sobra.push(e.p)); // parcerias que sobraram (paridade)
  // atrasados: TO_PLAY com data < 25/06 (a remarcar)
  const ordRL = da => { const p1 = da.id_player1, p2 = da.id_player2; return side[p1] === 'RIGHT' ? [p1, p2] : [p2, p1]; };
  const atrasados = matches.filter(m => m.status === 'TO_PLAY' && m.scheduled_at && m.scheduled_at.substring(0, 10) < '2026-06-25')
    .map(m => ({ d: [ordRL(D[m.id_double_a]), ordRL(D[m.id_double_b])], orig: m.scheduled_at.substring(8, 10) + '/' + m.scheduled_at.substring(5, 7) }));
  return { cat, P, side, R, L, inativos, fresh: fresh.length, games, sobra, atrasados, advRepTotal: games.filter(g => g.advRep > 0).length };
}

(async () => {
  const res = {}; for (const { c } of CATS) res[c] = await analyze(c);
  const sn = (id, P) => esc(P[id].split(' ')[0]);
  const dupHtml = (d, r) => `<span class="r">${sn(d[0], r.P)}</span><span class="sl">/</span><span class="l">${sn(d[1], r.P)}</span>`;
  const total = CATS.reduce((s, { c }) => s + res[c].games.length, 0);
  const wk = { 3: 7, 2: 9, 1: 14 }; // jogos por pessoa no fim (direita)

  let cards = '', sections = '';
  for (const { c, n } of CATS) {
    const r = res[c];
    cards += `<div class="stat"><div class="n">${r.games.length}</div><div class="l">${esc(n)}</div></div>`;
    let rows = '';
    r.games.forEach((g, i) => {
      const flag = g.advRep > 0 ? `<span class="tag tc">⚠️ adversário mesma posição repete</span>` : '';
      rows += `<tr${g.advRep > 0 ? ' class="warn"' : ''}><td class="num">${i + 1}</td>`
        + `<td class="jogo">${dupHtml(g.d[0], r)} <span class="vs">×</span> ${dupHtml(g.d[1], r)}</td>`
        + `<td class="obs">${flag || '<span class="ok">✓ limpo</span>'}</td></tr>`;
    });
    const sobraTxt = r.sobra.length ? ` · ⚠️ ${r.sobra.length} parceria sem par (paridade — fecha com 1 dupla repetida)` : '';
    sections += `<section class="catcard"><div class="cathead"><h3>${esc(n)}</h3>`
      + `<span class="catmeta">${r.games.length} jogos · ${r.R.length} direitas × ${r.L.length} esquerdas · todas as duplas INÉDITAS · ${r.advRepTotal} com adversário repetido${sobraTxt}</span></div>`
      + `<div class="tablewrap"><table><thead><tr><th>#</th><th>Jogo (dupla nova × dupla nova)</th><th>Obs.</th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
  }

  // ===== Calendário (2x/noite p/ atrasados; balanceia participação) =====
  const MAX2 = 2;
  const pickNight = (q, budget) => { const chosen = [], cnt = {}, rest = [];
    for (const g of q) { if (chosen.length < budget && g.pl.every(p => (cnt[p] || 0) < MAX2)) { chosen.push(g); g.pl.forEach(p => cnt[p] = (cnt[p] || 0) + 1); } else rest.push(g); }
    return { chosen, rest, doubled: Object.keys(cnt).filter(p => cnt[p] >= 2).map(Number) }; };
  const thu = wa => { const d = new Date(2026, 6, 2 + wa * 7); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`; };
  const queue = {};
  for (const { c } of CATS) {
    const atr = (res[c].atrasados || []).map(g => ({ pl: [g.d[0][0], g.d[0][1], g.d[1][0], g.d[1][1]], a: g.d[0], b: g.d[1], atrasado: true, orig: g.orig }));
    const miss = res[c].games.map(g => ({ pl: [g.d[0][0], g.d[0][1], g.d[1][0], g.d[1][1]], a: g.d[0], b: g.d[1] }));
    queue[c] = [...atr, ...miss];
  }
  const totalAtr = CATS.reduce((s, { c }) => s + (res[c].atrasados || []).length, 0);
  const weeks = []; let wkn = 0;
  while (CATS.some(({ c }) => queue[c].length) && wkn < 40) {
    let freed = 0; const baseB = { 1: 4, 2: 3, 3: 2 };
    for (const c of [2, 3]) if (queue[c].length === 0) freed += baseB[c];
    const budget = { 1: Math.min(8, 4 + freed), 2: 3, 3: 2 };
    const night = {}, dbl = {};
    for (const { c } of CATS) { const r = pickNight(queue[c], budget[c]); night[c] = r.chosen; queue[c] = r.rest; dbl[c] = r.doubled.map(id => sn(id, res[c].P)); }
    if (!CATS.some(({ c }) => night[c].length)) break;
    weeks.push({ date: thu(wkn), night, dbl }); wkn++;
  }
  const finWk = {}; CATS.forEach(({ c }) => { let last = 0; weeks.forEach((w, i) => { if (w.night[c].length) last = i + 1; }); finWk[c] = last; });
  // linha "ESTA QUINTA" (25/06) — jogos reais já sorteados na régua de parceria
  const ridByCat = { 3: 420, 2: 419, 1: 418 };
  const t25 = {};
  for (const { c } of CATS) {
    const { data: t25dbl } = await supabase.from('doubles').select('id_double, id_player1, id_player2').eq('id_round', ridByCat[c]);
    const TD = {}; (t25dbl || []).forEach(d => TD[d.id_double] = d);
    const { data: t25m } = (t25dbl && t25dbl.length) ? await supabase.from('matches').select('id_double_a, id_double_b, scheduled_at').in('id_double_a', t25dbl.map(d => d.id_double)) : { data: [] };
    const ordC = d => res[c].side[d.id_player1] === 'RIGHT' ? [d.id_player1, d.id_player2] : [d.id_player2, d.id_player1];
    t25[c] = (t25m || []).sort((a, b) => (a.scheduled_at || '').localeCompare(b.scheduled_at || '')).map(x => ({ a: ordC(TD[x.id_double_a]), b: ordC(TD[x.id_double_b]) }));
  }
  const cell25 = c => (t25[c] || []).map(g => `<div class="cg">${dupHtml(g.a, res[c])}<span class="vs">×</span>${dupHtml(g.b, res[c])}</div>`).join('') || '<span class="cempty">—</span>';
  const tot25 = CATS.reduce((s, { c }) => s + (t25[c] || []).length, 0);
  let calRows = `<tr class="thisweek"><td class="wkc"><b>📍 25/06</b><span class="dt">esta quinta</span><span class="tt">${tot25} jogos · já sorteado</span></td><td>${cell25(1)}</td><td>${cell25(2)}</td><td>${cell25(3)}</td></tr>`;
  for (let i = 0; i < weeks.length; i++) { const w = weeks[i]; const tot = CATS.reduce((s, { c }) => s + w.night[c].length, 0);
    const cell = c => w.night[c].map(g => `<div class="cg${g.atrasado ? ' atr' : ''}">${g.atrasado ? `<span class="atrtag">⏰ era ${g.orig}</span> ` : ''}${dupHtml(g.a, res[c])}<span class="vs">×</span>${dupHtml(g.b, res[c])}</div>`).join('') || '<span class="cempty">—</span>';
    calRows += `<tr><td class="wkc"><b>Q${i + 1}</b><span class="dt">${w.date}</span><span class="tt">${tot} jogos</span></td><td>${cell(1)}</td><td>${cell(2)}</td><td>${cell(3)}</td></tr>`;
    const dd = [...new Set(CATS.flatMap(({ c }) => w.dbl[c]))];
    if (dd.length) calRows += `<tr class="dblr"><td></td><td colspan="3"><span class="d2">⚡ jogam 2x:</span> ${dd.map(esc).join(', ')}</td></tr>`;
  }
  const calSection = `<section class="catcard cal"><div class="cathead"><h3>📅 Calendário sugerido de fechamento</h3>`
    + `<span class="catmeta">Começa nesta quinta (📍 25/06, já sorteado) + ${weeks.length} quintas (02/07 → ${weeks[weeks.length - 1].date}). Base 4 Masc Iniciante + 3 Masc 4ª + 2 Feminino; quando uma categoria fecha, as vagas vão pro Masc Iniciante. Atrasados (⏰) com prioridade; mais atrasados em jogos jogam 2x (⚡).</span></div>`
    + `<div class="milestones">Feminino fecha na Quinta ${finWk[3]} · Masc 4ª na Quinta ${finWk[2]} · Masc Iniciante na Quinta ${finWk[1]} (${weeks[finWk[1] - 1].date}).</div>`
    + `<div class="tablewrap"><table class="caltbl"><thead><tr><th>Quinta</th><th>Masc Iniciante</th><th>Masc 4ª</th><th>Feminino</th></tr></thead><tbody>${calRows}</tbody></table></div></section>`;

  const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#060d1a">
<title>Jogos que faltam — Ranking SRB 2026</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Russo+One&family=Chakra+Petch:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
:root{--bg:#060d1a;--bg-2:#0a1628;--card:#0d1e38;--card-2:#132040;--blue:#2563eb;--blue-bright:#3b82f6;--blue-glow:rgba(37,99,235,.4);--orange:#f97316;--orange-bright:#fb923c;--orange-glow:rgba(249,115,22,.4);--gold:#fbbf24;--gold-glow:rgba(251,191,36,.4);--green:#22c55e;--red:#ef4444;--text:#f8fafc;--sub:#94a3b8;--muted:#475569;--line:rgba(255,255,255,.08);--fd:'Russo One',sans-serif;--fb:'Chakra Petch',sans-serif;--maxw:1080px}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--text);font-family:var(--fb);line-height:1.5;-webkit-font-smoothing:antialiased;overflow-x:hidden}
body::before{content:'';position:fixed;inset:0;background-image:linear-gradient(rgba(255,255,255,.03) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.03) 1px,transparent 1px);background-size:54px 54px;mask-image:radial-gradient(circle at 50% 20%,#000,transparent 80%);pointer-events:none;z-index:0}
.wrap{position:relative;z-index:1;max-width:var(--maxw);margin:0 auto;padding:0 clamp(16px,4vw,32px)}
header.hero{padding:clamp(48px,9vw,90px) 0 clamp(24px,5vw,40px)}
.eyebrow{font-family:var(--fd);font-size:clamp(.62rem,1.6vw,.76rem);letter-spacing:.26em;text-transform:uppercase;color:var(--orange-bright)}
h1{font-family:var(--fd);font-size:clamp(2rem,7vw,3.6rem);line-height:1.02;letter-spacing:-.01em;margin:.3em 0 .25em}
h1 .accent{color:transparent;-webkit-text-stroke:1.4px var(--orange);text-stroke:1.4px var(--orange)}
.lede{color:var(--sub);max-width:64ch;font-size:clamp(.92rem,2.2vw,1.05rem)}
.legend{display:flex;flex-wrap:wrap;gap:.5em .9em;margin-top:1.2em;font-size:.82rem;color:var(--sub)}
.legend b{font-family:var(--fd);font-weight:400}.legend .r{color:var(--blue-bright)}.legend .l{color:var(--orange-bright)}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:14px;margin:clamp(20px,4vw,34px) 0}
.stat{background:linear-gradient(160deg,var(--card),var(--bg-2));border:1px solid var(--line);border-radius:16px;padding:clamp(16px,3vw,24px);position:relative;overflow:hidden}
.stat::after{content:'';position:absolute;top:-40%;right:-20%;width:110px;height:110px;border-radius:50%;background:var(--blue-glow);filter:blur(40px);opacity:.5}
.stat .n{font-family:var(--fd);font-size:clamp(1.9rem,6vw,3rem);line-height:1;color:var(--blue-bright)}
.stat .l{color:var(--sub);font-size:clamp(.72rem,1.8vw,.84rem);margin-top:.5em;font-weight:600}
.stat.total .n{color:var(--gold)}.stat.total::after{background:var(--gold-glow)}
.catcard{background:linear-gradient(160deg,var(--card),var(--bg-2));border:1px solid var(--line);border-radius:18px;padding:clamp(16px,3vw,26px);margin-bottom:22px}
.cathead{display:flex;flex-wrap:wrap;align-items:baseline;gap:.4em .9em;margin-bottom:1em;padding-bottom:.8em;border-bottom:1px solid var(--line)}
.cathead h3{font-family:var(--fd);font-size:clamp(1.15rem,3.4vw,1.7rem);letter-spacing:-.01em}
.catmeta{color:var(--sub);font-size:.8rem}
.tablewrap{overflow-x:auto;-webkit-overflow-scrolling:touch}
table{width:100%;border-collapse:collapse;font-size:clamp(.8rem,1.9vw,.92rem);min-width:540px}
th{text-align:left;font-family:var(--fd);font-weight:400;font-size:.66rem;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);padding:.5em .7em;border-bottom:1px solid var(--line)}
td{padding:.62em .7em;border-bottom:1px solid rgba(255,255,255,.05);vertical-align:middle}
tr.warn td{background:rgba(249,115,22,.05)}
.num{font-family:var(--fd);color:var(--muted);font-size:.8rem;width:2.2em}
.jogo .r{color:var(--blue-bright);font-weight:600}.jogo .l{color:var(--orange-bright);font-weight:600}
.jogo .sl{color:var(--muted);margin:0 .1em}.jogo .vs{color:var(--text);font-family:var(--fd);font-size:.78rem;margin:0 .35em;opacity:.7}
.tag{display:inline-block;font-size:.66rem;padding:.18em .55em;border-radius:100px;border:1px solid var(--line);white-space:nowrap}
.tag.tc{color:var(--orange-bright);border-color:rgba(249,115,22,.35);background:rgba(249,115,22,.08)}
.ok{color:var(--green);font-size:.74rem}
.note{background:rgba(13,30,56,.5);border:1px solid var(--line);border-left:3px solid var(--orange);border-radius:10px;padding:14px 16px;color:var(--sub);font-size:.86rem;margin:18px 0}
.note b{color:var(--text);font-family:var(--fd);font-weight:400}
footer{text-align:center;color:var(--muted);font-size:.78rem;padding:clamp(30px,6vw,60px) 0 40px;border-top:1px solid var(--line);margin-top:30px}
footer .ol{color:var(--sub)}footer .ol b{color:var(--orange-bright);font-family:var(--fd);font-weight:400}
.cal .cathead h3{color:var(--gold)}
.milestones{background:rgba(251,191,36,.08);border:1px solid rgba(251,191,36,.25);border-radius:10px;padding:10px 14px;color:var(--text);font-size:.84rem;margin-bottom:14px;font-family:var(--fd);font-weight:400;line-height:1.6}
.caltbl{min-width:680px}.caltbl td{vertical-align:top}
.wkc{white-space:nowrap}.wkc b{font-family:var(--fd);color:var(--gold);font-size:1rem}.wkc .dt{display:block;color:var(--sub);font-size:.78rem}.wkc .tt{display:block;color:var(--muted);font-size:.72rem}
.cg{padding:.18em 0;font-size:.82rem;white-space:nowrap}
.cg .r{color:var(--blue-bright);font-weight:600}.cg .l{color:var(--orange-bright);font-weight:600}.cg .sl{color:var(--muted);margin:0 .05em}
.cg .vs{color:var(--text);font-family:var(--fd);font-size:.72rem;margin:0 .3em;opacity:.6}
.cempty{color:var(--muted)}
.dblr td{padding-top:0;color:var(--sub);font-size:.78rem}.d2{color:var(--gold);font-size:.74rem;font-family:var(--fd)}
.thisweek td{background:rgba(34,197,94,.07)}.thisweek .wkc b{color:var(--green)}
.cg.atr{padding-left:.5em;border-left:2px solid var(--red)}
.atrtag{display:inline-block;font-size:.64rem;color:var(--red);border:1px solid rgba(239,68,68,.4);background:rgba(239,68,68,.1);border-radius:100px;padding:.05em .5em;font-family:var(--fd);margin-right:.3em}
</style>
</head>
<body>
<div class="wrap">
<header class="hero">
<div class="eyebrow">Ranking SRB 2026 · Fechamento</div>
<h1>Jogos que faltam para <span class="accent">fechar o ranking</span></h1>
<p class="lede">O campeonato é um <b>round-robin de parceria</b>: cada jogador joga uma vez como dupla com cada parceiro do outro lado. Cada jogo abaixo forma <b>duas duplas inéditas</b>. Regras: <b>nunca repetir parceira</b> · <b>todos terminam com o mesmo nº de jogos</b> · adversário de mesma posição evita repetir, mas pode (⚠️) quando necessário.</p>
<div class="legend">
<span><b class="r">Azul</b> = direita</span><span><b class="l">Laranja</b> = esquerda</span>
<span>✓ = jogo limpo</span><span>⚠️ = adversário de mesma posição repete</span>
</div>
</header>
<div class="stats">
${cards}
<div class="stat total"><div class="n">${total}</div><div class="l">Total de jogos pra fechar</div></div>
</div>
<div class="note">Todas as duplas listadas são <b>inéditas</b> (ninguém repete parceira). O que pode repetir é o <b>adversário</b> de mesma posição (⚠️) — e só quando não há outro jeito de formar as duplas novas. Ao fim: Feminino ${wk[3]} jogos/atleta · Masc 4ª ${wk[2]} · Masc Iniciante 14 (direita) / 13 (esquerda).</div>
${sections}
${calSection}
<footer>
<div>Gerado em 23 · Junho · 2026 — snapshot do estado atual do campeonato.</div>
<div class="ol" style="margin-top:.6em">Sistema de ranking e automação por <b>Obralivre</b></div>
</footer>
</div>
</body>
</html>`;

  const path = 'C:/obralivre/clientes/parcerias/sociedade-rio-branco/ranking-srb-2026/jogos-faltantes.html';
  fs.writeFileSync(path, html, 'utf8');
  console.log('✅ HTML gerado:', path, '(' + html.length + ' bytes)');
  console.log('Jogos (parceria):', CATS.map(({ c, n }) => `${n}=${res[c].games.length}${res[c].sobra.length ? '+' + res[c].sobra.length + 'sobra' : ''}`).join(' · '), '· total', total);
  console.log('Calendário:', weeks.length, 'quintas · atrasados incluídos:', totalAtr);
})().catch(e => { console.error('ERR', e.message, e.stack); process.exit(1); });
