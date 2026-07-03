// Gera a página do CALENDÁRIO OFICIAL (lê o schedule REAL do banco — tudo já agendado no app).
// Substitui o "jogos que faltam": agora o campeonato inteiro está materializado (25/06 → 27/08).
// Mesma identidade visual (azul=direita, laranja=esquerda). Sobe pro mesmo arquivo jogos-faltantes.html.
// Uso: node scripts/investigacao/gen_calendario_oficial_html.js
const fs = require('fs');
const supabase = require('../../supabase');
const T = 7;
const CN = { 1: 'Masc Iniciante', 2: 'Masc 4ª', 3: 'Feminino' };
const CORDER = [3, 2, 1];
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const sn = n => esc((n || '').split(' ')[0]);

(async () => {
  const { data: pl } = await supabase.from('players').select('id_player,name,side,category_id').eq('id_tournament', T);
  const P = {}, S = {}, Cat = {}; pl.forEach(p => { P[p.id_player] = p.name; S[p.id_player] = p.side; Cat[p.id_player] = p.category_id; });
  const { data: rounds } = await supabase.from('rounds').select('id_round,id_category,round_type').eq('id_tournament', T);
  const regRounds = (rounds || []).filter(r => r.round_type !== 'EXHIBITION');
  const catByRound = {}; regRounds.forEach(r => catByRound[r.id_round] = r.id_category);
  const { data: dbl } = await supabase.from('doubles').select('id_double,id_player1,id_player2,id_round').in('id_round', regRounds.map(r => r.id_round));
  const D = {}; (dbl || []).forEach(d => D[d.id_double] = d);
  const { data: matches } = await supabase.from('matches').select('id_double_a,id_double_b,scheduled_at,status').in('id_double_a', (dbl || []).map(d => d.id_double));
  // só do campeonato corrente (>= 25/06)
  const sched = (matches || []).filter(m => m.scheduled_at && m.scheduled_at.substring(0, 10) >= '2026-06-25');
  // ordena dupla [direita, esquerda]
  const ord = d => S[d.id_player1] === 'RIGHT' ? [d.id_player1, d.id_player2] : [d.id_player2, d.id_player1];
  const dup = d => { const [r, l] = ord(d); return `<span class="r">${sn(P[r])}</span><span class="sl">/</span><span class="l">${sn(P[l])}</span>`; };
  // agrupa por data → categoria
  const byDate = {};
  for (const m of sched) {
    const da = D[m.id_double_a], db = D[m.id_double_b]; if (!da || !db) continue;
    const date = m.scheduled_at.substring(0, 10), time = m.scheduled_at.substring(11, 16);
    const cat = catByRound[da.id_round]; if (!cat) continue;
    (byDate[date] = byDate[date] || {});
    (byDate[date][cat] = byDate[date][cat] || []).push({ time, a: da, b: db });
  }
  const dates = Object.keys(byDate).sort();
  const total = sched.length;
  const fmt = d => `${d.substring(8)}/${d.substring(5, 7)}`;

  let rows = '';
  for (const date of dates) {
    const isThis = date === '2026-06-25';
    const tot = CORDER.reduce((s, c) => s + ((byDate[date][c] || []).length), 0);
    const cell = c => ((byDate[date][c] || []).sort((a, b) => a.time.localeCompare(b.time))
      .map(g => `<div class="cg">${dup(g.a)}<span class="vs">×</span>${dup(g.b)}</div>`).join('') || '<span class="cempty">—</span>');
    rows += `<tr${isThis ? ' class="thisweek"' : ''}><td class="wkc"><b>${isThis ? '📍 ' : ''}${fmt(date)}</b><span class="dt">${isThis ? 'esta quinta' : 'quinta'}</span><span class="tt">${tot} jogos</span></td><td>${cell(1)}</td><td>${cell(2)}</td><td>${cell(3)}</td></tr>`;
  }

  const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#060d1a">
<title>Calendário Oficial — Ranking SRB 2026</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Russo+One&family=Chakra+Petch:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
:root{--bg:#060d1a;--bg-2:#0a1628;--card:#0d1e38;--card-2:#132040;--blue:#2563eb;--blue-bright:#3b82f6;--blue-glow:rgba(37,99,235,.4);--orange:#f97316;--orange-bright:#fb923c;--gold:#fbbf24;--gold-glow:rgba(251,191,36,.4);--green:#22c55e;--text:#f8fafc;--sub:#94a3b8;--muted:#475569;--line:rgba(255,255,255,.08);--fd:'Russo One',sans-serif;--fb:'Chakra Petch',sans-serif;--maxw:1080px}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--text);font-family:var(--fb);line-height:1.5;-webkit-font-smoothing:antialiased;overflow-x:hidden}
body::before{content:'';position:fixed;inset:0;background-image:linear-gradient(rgba(255,255,255,.03) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.03) 1px,transparent 1px);background-size:54px 54px;mask-image:radial-gradient(circle at 50% 20%,#000,transparent 80%);pointer-events:none;z-index:0}
.wrap{position:relative;z-index:1;max-width:var(--maxw);margin:0 auto;padding:0 clamp(16px,4vw,32px)}
header.hero{padding:clamp(48px,9vw,90px) 0 clamp(20px,4vw,34px)}
.eyebrow{font-family:var(--fd);font-size:clamp(.62rem,1.6vw,.76rem);letter-spacing:.26em;text-transform:uppercase;color:var(--orange-bright)}
h1{font-family:var(--fd);font-size:clamp(2rem,7vw,3.6rem);line-height:1.02;letter-spacing:-.01em;margin:.3em 0 .25em}
h1 .accent{color:transparent;-webkit-text-stroke:1.4px var(--orange);text-stroke:1.4px var(--orange)}
.lede{color:var(--sub);max-width:64ch;font-size:clamp(.92rem,2.2vw,1.05rem)}
.legend{display:flex;flex-wrap:wrap;gap:.5em .9em;margin-top:1.2em;font-size:.82rem;color:var(--sub)}
.legend b{font-family:var(--fd);font-weight:400}.legend .r{color:var(--blue-bright)}.legend .l{color:var(--orange-bright)}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:14px;margin:clamp(18px,4vw,30px) 0}
.stat{background:linear-gradient(160deg,var(--card),var(--bg-2));border:1px solid var(--line);border-radius:16px;padding:clamp(16px,3vw,24px);position:relative;overflow:hidden}
.stat::after{content:'';position:absolute;top:-40%;right:-20%;width:110px;height:110px;border-radius:50%;background:var(--blue-glow);filter:blur(40px);opacity:.5}
.stat .n{font-family:var(--fd);font-size:clamp(1.9rem,6vw,3rem);line-height:1;color:var(--blue-bright)}
.stat.g .n{color:var(--gold)}.stat.g::after{background:var(--gold-glow)}
.stat .l{color:var(--sub);font-size:clamp(.72rem,1.8vw,.84rem);margin-top:.5em;font-weight:600}
.card{background:linear-gradient(160deg,var(--card),var(--bg-2));border:1px solid var(--line);border-radius:18px;padding:clamp(14px,3vw,22px)}
.tablewrap{overflow-x:auto;-webkit-overflow-scrolling:touch}
table{width:100%;border-collapse:collapse;font-size:clamp(.8rem,1.9vw,.92rem);min-width:680px}
th{text-align:left;font-family:var(--fd);font-weight:400;font-size:.66rem;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);padding:.6em .7em;border-bottom:1px solid var(--line)}
td{padding:.6em .7em;border-bottom:1px solid rgba(255,255,255,.06);vertical-align:top}
tr.thisweek td{background:rgba(34,197,94,.07)}.thisweek .wkc b{color:var(--green)}
.wkc{white-space:nowrap}.wkc b{font-family:var(--fd);color:var(--gold);font-size:1.05rem}.wkc .dt{display:block;color:var(--sub);font-size:.76rem}.wkc .tt{display:block;color:var(--muted);font-size:.72rem}
.cg{padding:.2em 0;font-size:.82rem;white-space:nowrap}
.cg .r{color:var(--blue-bright);font-weight:600}.cg .l{color:var(--orange-bright);font-weight:600}.cg .sl{color:var(--muted);margin:0 .05em}
.cg .vs{color:var(--text);font-family:var(--fd);font-size:.72rem;margin:0 .3em;opacity:.6}
.cempty{color:var(--muted)}
.note{background:rgba(13,30,56,.5);border:1px solid var(--line);border-left:3px solid var(--orange);border-radius:10px;padding:13px 16px;color:var(--sub);font-size:.85rem;margin:16px 0}
.note b{color:var(--text);font-family:var(--fd);font-weight:400}
footer{text-align:center;color:var(--muted);font-size:.78rem;padding:clamp(30px,6vw,60px) 0 40px;border-top:1px solid var(--line);margin-top:26px}
footer .ol b{color:var(--orange-bright);font-family:var(--fd);font-weight:400}
</style>
</head>
<body>
<div class="wrap">
<header class="hero">
<div class="eyebrow">Ranking SRB 2026</div>
<h1>Calendário <span class="accent">oficial</span> do campeonato</h1>
<p class="lede">Todos os jogos já estão <b>agendados no app</b> — do dia ${dates.length ? fmt(dates[0]) : ''} ao ${dates.length ? fmt(dates[dates.length - 1]) : ''}. É um <b>round-robin de parceria</b>: cada um joga uma vez como dupla com cada parceiro do outro lado, e todos terminam com o mesmo nº de jogos por categoria.</p>
<div class="legend"><span><b class="r">Azul</b> = direita</span><span><b class="l">Laranja</b> = esquerda</span><span>📍 = esta quinta</span></div>
</header>
<div class="stats">
<div class="stat g"><div class="n">${total}</div><div class="l">jogos no total</div></div>
<div class="stat"><div class="n">${dates.length}</div><div class="l">quintas</div></div>
<div class="stat"><div class="n">${dates.length ? fmt(dates[dates.length - 1]) : '—'}</div><div class="l">última rodada</div></div>
</div>
<div class="note">Todas as duplas são <b>inéditas</b> (ninguém repete parceira) — exceto 1 jogo de fechamento por categoria, inevitável pelo nº ímpar de parcerias, pra que <b>todos joguem o mesmo total</b>.</div>
<div class="card"><div class="tablewrap"><table><thead><tr><th>Quinta</th><th>Masc Iniciante</th><th>Masc 4ª</th><th>Feminino</th></tr></thead><tbody>${rows}</tbody></table></div></div>
<footer><div>Snapshot ${'23/06/2026'} — agenda oficial no app dos atletas.</div><div style="margin-top:.6em">Sistema de ranking e automação por <b class="ol">Obralivre</b></div></footer>
</div>
</body>
</html>`;
  const path = 'C:/obralivre/clientes/parcerias/sociedade-rio-branco/ranking-srb-2026/jogos-faltantes.html';
  fs.writeFileSync(path, html, 'utf8');
  console.log('✅ Calendário oficial gerado:', '(' + html.length + ' bytes) ·', total, 'jogos em', dates.length, 'quintas:', dates.map(fmt).join(', '));
})().catch(e => { console.error('ERR', e.message, e.stack); process.exit(1); });
