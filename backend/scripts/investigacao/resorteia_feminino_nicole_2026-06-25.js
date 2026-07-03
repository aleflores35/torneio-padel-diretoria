// Re-sorteia o Feminino (round 420) com a NICOLE de volta (ela só recusou amistoso, não ranking).
// Regra definitiva: adversário NUNCA repete (2 jogos 100% limpos); parceria só repete em último
// caso (desempate); quem não entra em jogo limpo fica de FORA. Nara 701 sempre >= 20:30.
// DRY:  node scripts/investigacao/resorteia_feminino_nicole_2026-06-25.js
// REAL: CONFIRM_EXECUTE=yes node ...
const supabase = require('../../supabase');
const wd = require('../../services/weeklyDrawService');
const T = 7, CAT = 3, RID = 420, NARA = 701, MIN_NARA = '20:30';
const DRY = process.env.CONFIRM_EXECUTE !== 'yes';
const key = (a, b) => a < b ? `${a}-${b}` : `${b}-${a}`;

async function main() {
  const { data: pl } = await supabase.from('players').select('id_player,name,side').eq('id_tournament', T).eq('category_id', CAT);
  const P = {}, S = {}; pl.forEach(p => { P[p.id_player] = p.name; S[p.id_player] = p.side; });
  const gg = re => pl.find(p => new RegExp(re, 'i').test(p.name)).id_player;
  const aus = new Set([gg('francine'), gg('maria'), gg('michele')]);
  const disp = pl.filter(p => !aus.has(p.id_player));
  const R = disp.filter(p => S[p.id_player] === 'RIGHT').map(p => p.id_player);
  const L = disp.filter(p => S[p.id_player] === 'LEFT').map(p => p.id_player);

  const { oppMap } = await wd.buildRealDiag(T, CAT, { excludeRoundId: RID });
  const od = (a, b) => oppMap[key(a, b)] || 0;
  const { data: rounds } = await supabase.from('rounds').select('id_round,round_type').eq('id_tournament', T).eq('id_category', CAT);
  const regIds = rounds.filter(r => r.round_type !== 'EXHIBITION' && r.id_round !== RID).map(r => r.id_round);
  const { data: adbl } = await supabase.from('doubles').select('id_player1,id_player2').in('id_round', regIds);
  const pdMap = {}; (adbl || []).forEach(d => { const k = key(d.id_player1, d.id_player2); pdMap[k] = (pdMap[k] || 0) + 1; });
  const pd = (a, b) => pdMap[key(a, b)] || 0;

  // candidatos: jogo 100% limpo (2R+2L, 4 confrontos inéditos) + custo de parceria
  const clean = (r1, l1, r2, l2) => od(r1, r2) === 0 && od(l1, l2) === 0 && od(r1, l2) === 0 && od(r2, l1) === 0;
  const cands = [];
  for (let i = 0; i < R.length; i++) for (let j = i + 1; j < R.length; j++) for (let a = 0; a < L.length; a++) for (let b = a + 1; b < L.length; b++) {
    if (clean(R[i], L[a], R[j], L[b])) cands.push({ a: [R[i], L[a]], b: [R[j], L[b]], parc: (pd(R[i], L[a]) > 0 ? 1 : 0) + (pd(R[j], L[b]) > 0 ? 1 : 0) });
    if (clean(R[i], L[b], R[j], L[a])) cands.push({ a: [R[i], L[b]], b: [R[j], L[a]], parc: (pd(R[i], L[b]) > 0 ? 1 : 0) + (pd(R[j], L[a]) > 0 ? 1 : 0) });
  }
  // backtracking: max jogos disjuntos; empate -> min parceria repetida
  let best = { n: -1, parc: Infinity, set: [] };
  (function bt(start, used, acc, parc) {
    if (acc.length > best.n || (acc.length === best.n && parc < best.parc)) best = { n: acc.length, parc, set: [...acc] };
    for (let k = start; k < cands.length; k++) {
      const c = cands[k], ps = [...c.a, ...c.b];
      if (ps.some(p => used.has(p))) continue;
      bt(k + 1, new Set([...used, ...ps]), [...acc, c], parc + c.parc);
    }
  })(0, new Set(), [], 0);

  const games = best.set;
  games.forEach(g => g.hasNara = [...g.a, ...g.b].includes(NARA));
  const used = new Set(games.flatMap(g => [...g.a, ...g.b]));
  const out = disp.filter(p => !used.has(p.id_player)).map(p => p.id_player);

  // slots do round 420
  const { data: curDbl } = await supabase.from('doubles').select('id_double').eq('id_round', RID);
  const { data: curM } = await supabase.from('matches').select('scheduled_at,id_court').in('id_double_a', curDbl.map(d => d.id_double)).not('scheduled_at', 'is', null);
  const slots = curM.map(m => ({ at: m.scheduled_at, court: m.id_court })).sort((a, b) => a.at.localeCompare(b.at));
  const late = slots.filter(s => s.at.substring(11, 16) >= MIN_NARA), early = slots.filter(s => s.at.substring(11, 16) < MIN_NARA);
  games.forEach(g => { g.slot = g.hasNara ? (late.shift() || slots[0]) : (early.shift() || slots[slots.length - 1]); });

  console.log(`== FEMININO com Nicole · ${DRY ? 'DRY' : 'EXEC'} ==`);
  console.log(`jogos limpos: ${games.length} · parcerias repetidas: ${best.parc}`);
  games.forEach(g => console.log(`  ${g.slot ? g.slot.at.substring(11, 16) : '??'} ${P[g.a[0]]}/${P[g.a[1]]} × ${P[g.b[0]]}/${P[g.b[1]]}`));
  console.log(`  fora: ${out.map(id => P[id]).join(', ')}`);

  if (DRY) { console.log('\n[DRY] nada gravado.'); return; }

  // EXEC: reverte contadores 420, apaga, recria
  for (const tbl of ['partnerships', 'oppositions']) {
    const { data: rows } = await supabase.from(tbl).select('*').eq('id_tournament', T).eq('id_category', CAT).eq('last_round_id', RID);
    for (const r of rows || []) {
      if (tbl === 'partnerships') { if (r.times_paired <= 1) await supabase.from(tbl).delete().eq('id_partnership', r.id_partnership); else await supabase.from(tbl).update({ times_paired: r.times_paired - 1, last_round_id: null }).eq('id_partnership', r.id_partnership); }
      else { if (r.times_opposed <= 1) await supabase.from(tbl).delete().eq('id_opposition', r.id_opposition); else await supabase.from(tbl).update({ times_opposed: r.times_opposed - 1, diagonal_count: Math.max(0, (r.diagonal_count || 0) - 1), last_round_id: null }).eq('id_opposition', r.id_opposition); }
    }
  }
  await supabase.from('matches').delete().in('id_double_a', curDbl.map(d => d.id_double));
  await supabase.from('doubles').delete().eq('id_round', RID);
  await supabase.from('round_attendance').delete().eq('id_round', RID);
  for (const g of games) {
    const mk = async ([r, l]) => { const { data } = await supabase.from('doubles').insert({ id_tournament: T, id_player1: r, id_player2: l, display_name: `${P[r]} / ${P[l]}`, id_round: RID }).select().single(); return data; };
    const da = await mk(g.a), db = await mk(g.b);
    await supabase.from('matches').insert({ id_tournament: T, id_double_a: da.id_double, id_double_b: db.id_double, id_court: g.slot.court, scheduled_at: g.slot.at, status: 'TO_PLAY' });
    for (const d of [g.a, g.b]) { const p1 = Math.min(d[0], d[1]), p2 = Math.max(d[0], d[1]); const { data: ex } = await supabase.from('partnerships').select('id_partnership,times_paired').eq('id_tournament', T).eq('id_category', CAT).eq('id_player1', p1).eq('id_player2', p2).maybeSingle(); if (ex) await supabase.from('partnerships').update({ times_paired: ex.times_paired + 1, last_round_id: RID }).eq('id_partnership', ex.id_partnership); else await supabase.from('partnerships').insert({ id_tournament: T, id_category: CAT, id_player1: p1, id_player2: p2, times_paired: 1, last_round_id: RID }); }
    for (const pa of g.a) for (const pb of g.b) { const p1 = Math.min(pa, pb), p2 = Math.max(pa, pb); const isD = S[pa] === S[pb] && S[pa] !== 'EITHER'; const { data: ex } = await supabase.from('oppositions').select('id_opposition,times_opposed,diagonal_count').eq('id_tournament', T).eq('id_category', CAT).eq('id_player1', p1).eq('id_player2', p2).maybeSingle(); if (ex) await supabase.from('oppositions').update({ times_opposed: ex.times_opposed + 1, diagonal_count: ex.diagonal_count + (isD ? 1 : 0), last_round_id: RID }).eq('id_opposition', ex.id_opposition); else await supabase.from('oppositions').insert({ id_tournament: T, id_category: CAT, id_player1: p1, id_player2: p2, times_opposed: 1, diagonal_count: isD ? 1 : 0, last_round_id: RID }); }
  }
  await supabase.from('round_attendance').insert([
    ...[...used].map(id => ({ id_round: RID, id_player: id, status: 'NO_RESPONSE' })),
    ...out.map(id => ({ id_round: RID, id_player: id, status: 'ROTATED' })),
  ]);
  console.log('\n✅ aplicado.');
}
main().catch(e => { console.error(e.message); process.exit(1); });
