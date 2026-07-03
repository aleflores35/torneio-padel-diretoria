// MATERIALIZA o calendário de fechamento no sistema (app dos atletas): cria as rodadas/jogos
// reais com data pra cada quinta de 02/07 em diante. 25/06 já está no sistema (não toca).
// Mesma lógica da página (pareamento de parcerias inéditas + distribuição por quinta + 2x p/ atrasados).
// Atrasados (jogos vencidos TO_PLAY) são RE-DATADOS pra sua quinta. Carimba contadores + attendance.
// DRY:  node scripts/investigacao/materializa_calendario.js
// REAL: CONFIRM_EXECUTE=yes node ...
const supabase = require('../../supabase');
const T = 7;
const key = (a, b) => a < b ? `${a}-${b}` : `${b}-${a}`;
const DRY = process.env.CONFIRM_EXECUTE !== 'yes';
const NARA = 701, MIN_NARA = '20:30';
const TIMES = ['18:30', '19:10', '19:50', '20:30', '21:10', '21:50'];
const CATS = [{ c: 3, n: 'Feminino' }, { c: 2, n: 'Masc 4ª' }, { c: 1, n: 'Masc Iniciante' }];
const die = (m, e) => { console.error('🔴', m, e ? JSON.stringify(e) : ''); process.exit(1); };
const ck = (r, w) => { if (r.error) die(w + ' falhou', r.error); return r; };

async function analyze(cat) {
  const { data: pl } = await supabase.from('players').select('id_player,name,side,active').eq('id_tournament', T).eq('category_id', cat);
  const P = {}, side = {}; pl.forEach(p => { P[p.id_player] = p.name; side[p.id_player] = p.side; });
  const active = pl.filter(p => p.active !== false);
  const R = active.filter(p => p.side === 'RIGHT').map(p => p.id_player);
  const L = active.filter(p => p.side === 'LEFT').map(p => p.id_player);
  const { data: rounds } = await supabase.from('rounds').select('id_round,round_type,scheduled_date').eq('id_tournament', T).eq('id_category', cat);
  const regIds = rounds.filter(r => r.round_type !== 'EXHIBITION').map(r => r.id_round);
  const { data: dbl } = await supabase.from('doubles').select('id_double,id_player1,id_player2,id_round').in('id_round', regIds);
  const D = {}; dbl.forEach(d => D[d.id_double] = d);
  const { data: matches } = await supabase.from('matches').select('id_match,id_double_a,id_double_b,status,scheduled_at').in('id_double_a', dbl.map(d => d.id_double)).in('status', ['FINISHED', 'WO', 'TO_PLAY']);
  const usedPart = new Set(), usedRR = new Set(), usedLL = new Set();
  for (const m of matches) { const da = D[m.id_double_a], db = D[m.id_double_b]; if (!da || !db) continue;
    for (const d of [da, db]) { const p1 = d.id_player1, p2 = d.id_player2; if ((side[p1] === 'RIGHT' && side[p2] === 'LEFT') || (side[p1] === 'LEFT' && side[p2] === 'RIGHT')) usedPart.add(key(p1, p2)); }
    for (const pa of [da.id_player1, da.id_player2]) for (const pb of [db.id_player1, db.id_player2]) if (side[pa] === side[pb]) { if (side[pa] === 'RIGHT') usedRR.add(key(pa, pb)); else if (side[pa] === 'LEFT') usedLL.add(key(pa, pb)); } }
  const fresh = []; for (const r of R) for (const l of L) if (!usedPart.has(key(r, l))) fresh.push([r, l]);
  const advRepOf = (a, b) => (usedRR.has(key(a[0], b[0])) ? 1 : 0) + (usedLL.has(key(a[1], b[1])) ? 1 : 0);
  const items = fresh.map(p => ({ p, used: false })); const games = []; const sobra = [];
  while (true) {
    const live = items.filter(e => !e.used); if (live.length < 2) break;
    const deg = {}; live.forEach(e => { deg[e.p[0]] = (deg[e.p[0]] || 0) + 1; deg[e.p[1]] = (deg[e.p[1]] || 0) + 1; });
    const md = e => Math.max(deg[e.p[0]], deg[e.p[1]]); live.sort((a, b) => md(b) - md(a));
    const e1 = live[0]; let best = null, bc = [99, 99];
    for (const e2 of live) { if (e2 === e1) continue; if (e1.p[0] === e2.p[0] || e1.p[1] === e2.p[1]) continue; const sc = [advRepOf(e1.p, e2.p), -md(e2)]; if (sc[0] < bc[0] || (sc[0] === bc[0] && sc[1] < bc[1])) { best = e2; bc = sc; } }
    if (!best) { e1.used = true; sobra.push(e1.p); continue; }
    e1.used = best.used = true; games.push({ d: [e1.p, best.p] });
  }
  items.filter(e => !e.used).forEach(e => sobra.push(e.p));
  // atrasados (TO_PLAY vencidos < 25/06) — guardar id_match p/ re-datar
  const ordRL = da => side[da.id_player1] === 'RIGHT' ? [da.id_player1, da.id_player2] : [da.id_player2, da.id_player1];
  const atrasados = matches.filter(m => m.status === 'TO_PLAY' && m.scheduled_at && m.scheduled_at.substring(0, 10) < '2026-06-25')
    .map(m => ({ id_match: m.id_match, d: [ordRL(D[m.id_double_a]), ordRL(D[m.id_double_b])] }));
  return { cat, P, side, games, sobra, atrasados };
}

async function main() {
  const { data: courts } = await supabase.from('courts').select('id_court,name').eq('id_tournament', T).order('order_index');
  const res = {}; for (const { c } of CATS) res[c] = await analyze(c);
  // fila por categoria: atrasados primeiro, depois jogos novos
  const queue = {};
  for (const { c } of CATS) {
    const atr = res[c].atrasados.map(g => ({ pl: [g.d[0][0], g.d[0][1], g.d[1][0], g.d[1][1]], a: g.d[0], b: g.d[1], atrasado: true, id_match: g.id_match }));
    const nv = res[c].games.map(g => ({ pl: [g.d[0][0], g.d[0][1], g.d[1][0], g.d[1][1]], a: g.d[0], b: g.d[1], atrasado: false }));
    queue[c] = [...atr, ...nv];
  }
  const MAX2 = 2;
  const pickNight = (q, budget) => { const chosen = [], cnt = {}, rest = []; for (const g of q) { if (chosen.length < budget && g.pl.every(p => (cnt[p] || 0) < MAX2)) { chosen.push(g); g.pl.forEach(p => cnt[p] = (cnt[p] || 0) + 1); } else rest.push(g); } return { chosen, rest }; };
  const dpart = wa => { const d = new Date(2026, 6, 2 + wa * 7); return `2026-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const weeks = []; let wkn = 0;
  while (CATS.some(({ c }) => queue[c].length) && wkn < 40) {
    let freed = 0; const baseB = { 1: 4, 2: 3, 3: 2 };
    for (const c of [2, 3]) if (queue[c].length === 0) freed += baseB[c];
    const budget = { 1: Math.min(8, 4 + freed), 2: 3, 3: 2 };
    const night = {}; for (const { c } of CATS) { const r = pickNight(queue[c], budget[c]); night[c] = r.chosen; queue[c] = r.rest; }
    if (!CATS.some(({ c }) => night[c].length)) break;
    weeks.push({ date: dpart(wkn), night }); wkn++;
  }

  // slotting por semana (grid 12, prioridade Fem cedo, Nara >= 20:30)
  const catPrio = { 3: 0, 2: 1, 1: 2 };
  for (const wk of weeks) {
    const grid = []; for (const t of TIMES) for (const co of courts) grid.push({ time: t, court: co.id_court, at: `${wk.date}T${t}:00`, used: false });
    const flat = []; for (const { c } of CATS) for (const g of wk.night[c]) flat.push({ c, g, nara: [...g.a, ...g.b].includes(NARA) });
    flat.sort((a, b) => catPrio[a.c] - catPrio[b.c]);
    for (const it of flat) { let s = grid.find(x => !x.used && (!it.nara || x.time >= MIN_NARA)); if (!s) die(`sem slot ${wk.date} ${it.c}`); s.used = true; it.slot = s; }
    wk.flat = flat;
  }

  // resumo
  console.log(`== MATERIALIZAR CALENDÁRIO · ${DRY ? 'DRY' : 'EXEC'} == (25/06 já no sistema, não toca)`);
  let totNew = 0, totAtr = 0;
  for (const wk of weeks) {
    const nNew = wk.flat.filter(f => !f.g.atrasado).length, nAtr = wk.flat.filter(f => f.g.atrasado).length;
    totNew += nNew; totAtr += nAtr;
    console.log(`\n📅 ${wk.date.substring(8)}/${wk.date.substring(5, 7)} — ${wk.flat.length} jogos${nAtr ? ` (${nAtr} atrasado re-datado)` : ''}`);
    for (const { c, n } of CATS) { const fs = wk.flat.filter(f => f.c === c); if (!fs.length) continue;
      console.log(`   ${n}: ${fs.map(f => `${f.slot.time} ${res[c].P[f.g.a[0]].split(' ')[0]}/${res[c].P[f.g.a[1]].split(' ')[0]}×${res[c].P[f.g.b[0]].split(' ')[0]}/${res[c].P[f.g.b[1]].split(' ')[0]}${f.g.atrasado ? '⏰' : ''}`).join(' · ')}`); }
  }
  console.log(`\nTotal: ${weeks.length} quintas · ${totNew} jogos novos a criar · ${totAtr} atrasados a re-datar`);
  for (const { c, n } of CATS) if (res[c].sobra.length) console.log(`  ⚠️ ${n}: ${res[c].sobra.length} parceria de paridade fica fora (precisa decisão à parte).`);

  if (DRY) { console.log('\n[DRY] nada gravado.'); return; }

  // EXEC
  const { data: maxr } = await supabase.from('rounds').select('round_number').eq('id_tournament', T).order('round_number', { ascending: false }).limit(1);
  let rn = (maxr && maxr[0] ? maxr[0].round_number : 0) + 1;
  for (const wk of weeks) {
    for (const { c } of CATS) {
      const fs = wk.flat.filter(f => f.c === c); if (!fs.length) continue;
      const novos = fs.filter(f => !f.g.atrasado), atr = fs.filter(f => f.g.atrasado);
      // re-data atrasados (update match)
      for (const f of atr) ck(await supabase.from('matches').update({ scheduled_at: f.slot.at, id_court: f.slot.court }).eq('id_match', f.g.id_match), 're-data atrasado');
      if (!novos.length) continue;
      const { data: rd } = ck(await supabase.from('rounds').insert({ id_tournament: T, id_category: c, round_number: rn++, scheduled_date: wk.date, window_start: '18:30', window_end: '22:00', status: 'CONFIRMED', round_type: 'REGULAR' }).select().single(), 'cria round');
      const rid = rd.id_round; const P = res[c].P, S = res[c].side; const playing = new Set();
      for (const f of novos) { const g = f.g;
        const mk = async ([r, l]) => { const { data } = ck(await supabase.from('doubles').insert({ id_tournament: T, id_player1: r, id_player2: l, display_name: `${P[r]} / ${P[l]}`, id_round: rid }).select().single(), 'ins double'); return data; };
        const da = await mk(g.a), db = await mk(g.b);
        ck(await supabase.from('matches').insert({ id_tournament: T, id_double_a: da.id_double, id_double_b: db.id_double, id_court: f.slot.court, scheduled_at: f.slot.at, status: 'TO_PLAY' }), 'ins match');
        [g.a[0], g.a[1], g.b[0], g.b[1]].forEach(p => playing.add(p));
        for (const d of [g.a, g.b]) { const p1 = Math.min(d[0], d[1]), p2 = Math.max(d[0], d[1]); const { data: ex } = await supabase.from('partnerships').select('id_partnership,times_paired').eq('id_tournament', T).eq('id_category', c).eq('id_player1', p1).eq('id_player2', p2).maybeSingle(); if (ex) await supabase.from('partnerships').update({ times_paired: ex.times_paired + 1, last_round_id: rid }).eq('id_partnership', ex.id_partnership); else await supabase.from('partnerships').insert({ id_tournament: T, id_category: c, id_player1: p1, id_player2: p2, times_paired: 1, last_round_id: rid }); }
        for (const pa of g.a) for (const pb of g.b) { const p1 = Math.min(pa, pb), p2 = Math.max(pa, pb); const isD = S[pa] === S[pb] && S[pa] !== 'EITHER'; const { data: ex } = await supabase.from('oppositions').select('id_opposition,times_opposed,diagonal_count').eq('id_tournament', T).eq('id_category', c).eq('id_player1', p1).eq('id_player2', p2).maybeSingle(); if (ex) await supabase.from('oppositions').update({ times_opposed: ex.times_opposed + 1, diagonal_count: ex.diagonal_count + (isD ? 1 : 0), last_round_id: rid }).eq('id_opposition', ex.id_opposition); else await supabase.from('oppositions').insert({ id_tournament: T, id_category: c, id_player1: p1, id_player2: p2, times_opposed: 1, diagonal_count: isD ? 1 : 0, last_round_id: rid }); }
      }
      ck(await supabase.from('round_attendance').insert([...playing].map(id => ({ id_round: rid, id_player: id, status: 'NO_RESPONSE' }))), 'ins att');
    }
  }
  console.log('\n✅ calendário materializado no sistema.');
}
main().catch(e => die('exceção', e.message));
