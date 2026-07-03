// Re-sorteia 25/06 no MÍNIMO ABSOLUTO de repetição (decisão 23/06: todos valendo, sem amistoso).
// Busca exaustiva: testa todas as formações de duplas (R↔L) × pareamentos e pega a de menor
// custo. Hierarquia: repetir mesma posição (peso 1000) >> lado oposto (1) > parceria (0.001).
// Re-FORMA as duplas (não só re-pareia). Fonte = jogos reais. Reusa slots (Nara 701 >= 20:30).
// DRY:  node scripts/investigacao/resorteia_minimo_2026-06-25.js
// REAL: CONFIRM_EXECUTE=yes node ...
const supabase = require('../../supabase');
const wd = require('../../services/weeklyDrawService');
const T = 7, DATE = '2026-06-25', NARA = 701, MIN_NARA = '20:30';
const DRY = process.env.CONFIRM_EXECUTE !== 'yes';
const key = (a, b) => a < b ? `${a}-${b}` : `${b}-${a}`;
const W_SAME = 1000, W_OPP = 1, W_PARC = 0.001;
const CATS = [{ cat: 1, principal: 418 }, { cat: 2, principal: 419 }, { cat: 3, principal: 420 }];

function perms(a) { if (a.length <= 1) return [a]; const r = []; a.forEach((x, i) => { for (const p of perms(a.slice(0, i).concat(a.slice(i + 1)))) r.push([x, ...p]); }); return r; }
// perfect matchings de índices [0..n-1] (n par): lista de pares
function matchings(idx) {
  if (idx.length === 0) return [[]];
  const [first, ...rest] = idx, out = [];
  for (let k = 0; k < rest.length; k++) {
    const pair = [first, rest[k]];
    const remaining = rest.filter((_, i) => i !== k);
    for (const m of matchings(remaining)) out.push([pair, ...m]);
  }
  return out;
}

function bestLineup(R, L, od, dd, pd, side) {
  if (R.length !== L.length) return null; // fallback tratado fora
  const n = R.length;
  let best = { cost: Infinity };
  const mts = matchings([...Array(n).keys()]);
  for (const lp of perms(L)) {
    const D = R.map((r, i) => [r, lp[i]]); // n duplas [r,l]
    let parc = 0; for (const [r, l] of D) parc += pd(r, l) * W_PARC;
    for (const mt of mts) {
      let cost = parc, rep = 0;
      for (const [i, j] of mt) {
        const A = D[i], B = D[j];
        for (const pa of A) for (const pb of B) {
          const n2 = od(pa, pb);
          if (n2 > 0) { cost += (side[pa] === side[pb] ? W_SAME : W_OPP) * n2; rep++; }
        }
      }
      if (cost < best.cost) best = { cost, rep, D: D.map(d => [...d]), mt };
    }
  }
  return best;
}

async function revert(roundId, cat) {
  for (const tbl of ['partnerships', 'oppositions']) {
    const { data: rows } = await supabase.from(tbl).select('*').eq('id_tournament', T).eq('id_category', cat).eq('last_round_id', roundId);
    for (const r of rows || []) {
      if (tbl === 'partnerships') { if (r.times_paired <= 1) await supabase.from(tbl).delete().eq('id_partnership', r.id_partnership); else await supabase.from(tbl).update({ times_paired: r.times_paired - 1, last_round_id: null }).eq('id_partnership', r.id_partnership); }
      else { if (r.times_opposed <= 1) await supabase.from(tbl).delete().eq('id_opposition', r.id_opposition); else await supabase.from(tbl).update({ times_opposed: r.times_opposed - 1, diagonal_count: Math.max(0, (r.diagonal_count || 0) - 1), last_round_id: null }).eq('id_opposition', r.id_opposition); }
    }
  }
}

async function main() {
  console.log(`== RE-SORTEIO MÍNIMO 25/06 · ${DRY ? 'DRY' : 'EXEC'} ==`);
  for (const { cat, principal } of CATS) {
    const { data: rounds } = await supabase.from('rounds').select('id_round').eq('id_tournament', T).eq('id_category', cat).eq('scheduled_date', DATE);
    const roundIds = rounds.map(r => r.id_round);
    const { data: dbl } = await supabase.from('doubles').select('*').in('id_round', roundIds);
    const { data: matches } = await supabase.from('matches').select('id_double_a,scheduled_at,id_court').in('id_double_a', dbl.map(d => d.id_double));
    const slots = matches.filter(m => m.scheduled_at).map(m => ({ at: m.scheduled_at, court: m.id_court })).sort((a, b) => a.at.localeCompare(b.at));
    const pres = [...new Set(dbl.flatMap(d => [d.id_player1, d.id_player2]))];
    const { data: pl } = await supabase.from('players').select('id_player,name,side').in('id_player', pres);
    const P = {}, side = {}; pl.forEach(p => { P[p.id_player] = p.name; side[p.id_player] = p.side; });
    const R = pres.filter(i => side[i] === 'RIGHT'), Lf = pres.filter(i => side[i] === 'LEFT');

    const { oppMap, diagMap } = await wd.buildRealDiag(T, cat, { excludeRoundId: principal });
    const { data: parts } = await supabase.from('partnerships').select('id_player1,id_player2,times_paired').eq('id_tournament', T).eq('id_category', cat);
    const pdMap = {}; (parts || []).forEach(p => pdMap[key(p.id_player1, p.id_player2)] = p.times_paired || 0);
    const od = (a, b) => oppMap[key(a, b)] || 0, dd = (a, b) => diagMap[key(a, b)] || 0, pd = (a, b) => pdMap[key(a, b)] || 0;

    const lineup = bestLineup(R, Lf, od, dd, pd, side);
    const catN = { 1: 'Masc Inic', 2: 'Masc 4ª', 3: 'Feminino' }[cat];
    if (!lineup) { console.log(`\n### ${catN}: lados desiguais (${R.length}R×${Lf.length}L) — pulei (tratar à mão)`); continue; }

    // monta jogos com duplas
    const games = lineup.mt.map(([i, j]) => ({ A: lineup.D[i], B: lineup.D[j] }));
    games.forEach(g => g.hasNara = [...g.A, ...g.B].includes(NARA));
    // slots: Nara >= 20:30
    const late = slots.filter(s => s.at.substring(11, 16) >= MIN_NARA), early = slots.filter(s => s.at.substring(11, 16) < MIN_NARA);
    games.forEach(g => { const pool = g.hasNara ? late : (early.length ? early : late); g.slot = pool.shift() || late.shift() || early.shift(); });

    console.log(`\n### ${catN} (round ${principal}) — ${games.length} jogos · repetições: ${lineup.rep} ###`);
    for (const g of games) {
      const reps = [];
      for (const pa of g.A) for (const pb of g.B) if (od(pa, pb) > 0) reps.push(`${P[pa]}×${P[pb]}(${side[pa] === side[pb] ? 'mesma' : 'op'})`);
      console.log(`  ${g.slot ? g.slot.at.substring(11, 16) : '??'} ${P[g.A[0]]}/${P[g.A[1]]} × ${P[g.B[0]]}/${P[g.B[1]]}${reps.length ? '  ⚠️ ' + reps.join(', ') : '  ✅'}`);
    }

    if (DRY) continue;
    // EXEC
    for (const rid of roundIds) await revert(rid, cat);
    await supabase.from('matches').delete().in('id_double_a', dbl.map(d => d.id_double));
    await supabase.from('doubles').delete().in('id_round', roundIds);
    await supabase.from('rounds').update({ round_type: 'REGULAR' }).eq('id_round', principal);
    for (const rid of roundIds) if (rid !== principal) { await supabase.from('round_attendance').delete().eq('id_round', rid); await supabase.from('rounds').delete().eq('id_round', rid); }
    for (const g of games) {
      const mk = async ([r, l]) => { const { data } = await supabase.from('doubles').insert({ id_tournament: T, id_player1: r, id_player2: l, display_name: `${P[r]} / ${P[l]}`, id_round: principal }).select().single(); return data; };
      const da = await mk(g.A), db = await mk(g.B);
      await supabase.from('matches').insert({ id_tournament: T, id_double_a: da.id_double, id_double_b: db.id_double, id_court: g.slot.court, scheduled_at: g.slot.at, status: 'TO_PLAY' });
      // carimba
      for (const d of [g.A, g.B]) { const p1 = Math.min(d[0], d[1]), p2 = Math.max(d[0], d[1]); const { data: ex } = await supabase.from('partnerships').select('id_partnership,times_paired').eq('id_tournament', T).eq('id_category', cat).eq('id_player1', p1).eq('id_player2', p2).maybeSingle(); if (ex) await supabase.from('partnerships').update({ times_paired: ex.times_paired + 1, last_round_id: principal }).eq('id_partnership', ex.id_partnership); else await supabase.from('partnerships').insert({ id_tournament: T, id_category: cat, id_player1: p1, id_player2: p2, times_paired: 1, last_round_id: principal }); }
      for (const pa of g.A) for (const pb of g.B) { const p1 = Math.min(pa, pb), p2 = Math.max(pa, pb); const isD = side[pa] === side[pb] && side[pa] !== 'EITHER'; const { data: ex } = await supabase.from('oppositions').select('id_opposition,times_opposed,diagonal_count').eq('id_tournament', T).eq('id_category', cat).eq('id_player1', p1).eq('id_player2', p2).maybeSingle(); if (ex) await supabase.from('oppositions').update({ times_opposed: ex.times_opposed + 1, diagonal_count: ex.diagonal_count + (isD ? 1 : 0), last_round_id: principal }).eq('id_opposition', ex.id_opposition); else await supabase.from('oppositions').insert({ id_tournament: T, id_category: cat, id_player1: p1, id_player2: p2, times_opposed: 1, diagonal_count: isD ? 1 : 0, last_round_id: principal }); }
    }
    await supabase.from('round_attendance').delete().eq('id_round', principal).in('id_player', pres);
    await supabase.from('round_attendance').insert(pres.map(id => ({ id_round: principal, id_player: id, status: 'NO_RESPONSE' })));
  }
  console.log(DRY ? '\n[DRY] nada gravado.' : '\n✅ aplicado.');
}
main().catch(e => { console.error(e); process.exit(1); });
