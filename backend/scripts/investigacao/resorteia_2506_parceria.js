// Re-sorteia 25/06 (rounds 418/419/420) na RÉGUA DE PARCERIA: duplas INÉDITAS, adversário pode
// repetir, equilibra por jogos jogados. Pool = quem já estava jogando + quem o sorteio antigo
// bancou (ROTATED) — os ausentes de verdade ficam fora. Reusa o grid de 12 slots (2 quadras × 6
// horários), Feminino cedo, Nara 701 >= 20:30. DRY mostra; CONFIRM_EXECUTE=yes aplica.
const supabase = require('../../supabase');
const wd = require('../../services/weeklyDrawService');
const T = 7;
const key = (a, b) => a < b ? `${a}-${b}` : `${b}-${a}`;
const DRY = process.env.CONFIRM_EXECUTE !== 'yes';
const NARA = 701, MIN_NARA = '20:30';
const TIMES = ['18:30', '19:10', '19:50', '20:30', '21:10', '21:50'];
const CATS = [{ c: 3, rid: 420, n: 'Feminino', max: 3 }, { c: 2, rid: 419, n: 'Masc 4ª', max: 3 }, { c: 1, rid: 418, n: 'Masc Iniciante', max: 4 }];
const die = (m, e) => { console.error('🔴', m, e ? JSON.stringify(e) : ''); process.exit(1); };
const ck = (r, w) => { if (r.error) die(w + ' falhou', r.error); return r; };

async function main() {
  // 1) descobre courts
  const { data: courts } = await supabase.from('courts').select('id_court,name').eq('id_tournament', T).order('order_index');
  const slotGrid = []; for (const t of TIMES) for (const co of courts) slotGrid.push({ at: `2026-06-25T${t}:00`, time: t, court: co.id_court });

  const plan = [];
  for (const { c, rid, n, max } of CATS) {
    const { data: pl } = await supabase.from('players').select('id_player,name,side').eq('id_tournament', T).eq('category_id', c);
    const P = {}, S = {}; pl.forEach(p => { P[p.id_player] = p.name; S[p.id_player] = p.side; });
    // pool disponível = jogando agora + ROTATED (bancado pelo sorteio antigo)
    const { data: curDbl } = await supabase.from('doubles').select('id_double,id_player1,id_player2').eq('id_round', rid);
    const playing = [...new Set((curDbl || []).flatMap(d => [d.id_player1, d.id_player2]))];
    const { data: att } = await supabase.from('round_attendance').select('id_player,status').eq('id_round', rid);
    const rotated = (att || []).filter(a => a.status === 'ROTATED').map(a => a.id_player);
    const avail = [...new Set([...playing, ...rotated])];
    const rights = avail.filter(i => S[i] === 'RIGHT'), lefts = avail.filter(i => S[i] === 'LEFT');
    // fp (parceria inédita) e gp (jogos JOGADOS) do histórico real, exceto este round
    const { data: rounds } = await supabase.from('rounds').select('id_round,round_type').eq('id_tournament', T).eq('id_category', c);
    const histIds = rounds.filter(r => r.round_type !== 'EXHIBITION' && r.id_round !== rid).map(r => r.id_round);
    const usedPart = new Set(); const gpMap = {};
    if (histIds.length) {
      const { data: hDbl } = await supabase.from('doubles').select('id_double,id_player1,id_player2').in('id_round', histIds);
      const hD = {}; (hDbl || []).forEach(d => { hD[d.id_double] = d; usedPart.add(key(d.id_player1, d.id_player2)); });
      if (hDbl && hDbl.length) {
        const { data: hM } = await supabase.from('matches').select('id_double_a,id_double_b,status').in('id_double_a', hDbl.map(d => d.id_double)).in('status', ['FINISHED', 'WO']);
        for (const m of (hM || [])) { const da = hD[m.id_double_a], db = hD[m.id_double_b]; if (!da || !db) continue; for (const p of [da.id_player1, da.id_player2, db.id_player1, db.id_player2]) gpMap[p] = (gpMap[p] || 0) + 1; }
      }
    }
    const fp = (r, l) => !usedPart.has(key(r, l));
    const gp = p => gpMap[p] || 0;
    const res = wd.planPartnerNight(rights, lefts, fp, gp, max);
    plan.push({ c, rid, n, P, S, games: res.games, benched: res.benched, avail });
  }

  // 2) slotting night-wide: por prioridade de categoria (Fem cedo); Nara >= 20:30
  const catPrio = { 3: 0, 2: 1, 1: 2 };
  const flat = [];
  for (const cp of plan) for (const g of cp.games) flat.push({ cp, g, nara: [...g.a, ...g.b].includes(NARA) });
  flat.sort((a, b) => catPrio[a.cp.c] - catPrio[b.cp.c]);
  const usedSlot = new Array(slotGrid.length).fill(false);
  for (const item of flat) {
    let idx = -1;
    for (let s = 0; s < slotGrid.length; s++) { if (usedSlot[s]) continue; if (item.nara && slotGrid[s].time < MIN_NARA) continue; idx = s; break; }
    if (idx < 0) die(`sem slot pra jogo (${item.cp.n})`);
    usedSlot[idx] = true; item.slot = slotGrid[idx];
  }

  // 3) imprime
  console.log(`== RE-SORTEIO 25/06 · RÉGUA DE PARCERIA · ${DRY ? 'DRY' : 'EXEC'} ==`);
  for (const cp of plan) {
    console.log(`\n### ${cp.n} — ${cp.games.length} jogos · banco: ${cp.benched.map(i => cp.P[i]).join(', ') || '(ninguém)'}`);
    for (const it of flat.filter(f => f.cp === cp)) {
      const g = it.g;
      console.log(`  ${it.slot.time} ${cp.P[g.a[0]]}/${cp.P[g.a[1]]} × ${cp.P[g.b[0]]}/${cp.P[g.b[1]]}`);
    }
  }
  console.log(`\nTotal: ${flat.length} jogos (grid de ${slotGrid.length} slots).`);

  if (DRY) { console.log('\n[DRY] nada gravado.'); return; }

  // 4) EXEC — por categoria: reverte contadores, apaga, recria duplas+matches, attendance, carimba
  for (const cp of plan) {
    const { c, rid, P, S } = cp;
    for (const tbl of ['partnerships', 'oppositions']) {
      const { data: rows } = await supabase.from(tbl).select('*').eq('id_tournament', T).eq('id_category', c).eq('last_round_id', rid);
      for (const r of rows || []) {
        if (tbl === 'partnerships') { if (r.times_paired <= 1) await supabase.from(tbl).delete().eq('id_partnership', r.id_partnership); else await supabase.from(tbl).update({ times_paired: r.times_paired - 1, last_round_id: null }).eq('id_partnership', r.id_partnership); }
        else { if (r.times_opposed <= 1) await supabase.from(tbl).delete().eq('id_opposition', r.id_opposition); else await supabase.from(tbl).update({ times_opposed: r.times_opposed - 1, diagonal_count: Math.max(0, (r.diagonal_count || 0) - 1), last_round_id: null }).eq('id_opposition', r.id_opposition); }
      }
    }
    const { data: oldD } = await supabase.from('doubles').select('id_double').eq('id_round', rid);
    if (oldD && oldD.length) for (const d of oldD) ck(await supabase.from('matches').delete().eq('id_double_a', d.id_double), 'del match a'), ck(await supabase.from('matches').delete().eq('id_double_b', d.id_double), 'del match b');
    ck(await supabase.from('doubles').delete().eq('id_round', rid), 'del doubles');
    ck(await supabase.from('round_attendance').delete().eq('id_round', rid), 'del att');
    const playing = [];
    for (const it of flat.filter(f => f.cp === cp)) {
      const g = it.g;
      const mk = async ([r, l]) => { const { data } = ck(await supabase.from('doubles').insert({ id_tournament: T, id_player1: r, id_player2: l, display_name: `${P[r]} / ${P[l]}`, id_round: rid }).select().single(), 'ins double'); return data; };
      const da = await mk(g.a), db = await mk(g.b);
      ck(await supabase.from('matches').insert({ id_tournament: T, id_double_a: da.id_double, id_double_b: db.id_double, id_court: it.slot.court, scheduled_at: it.slot.at, status: 'TO_PLAY' }), 'ins match');
      playing.push(...g.a, ...g.b);
      for (const d of [g.a, g.b]) { const p1 = Math.min(d[0], d[1]), p2 = Math.max(d[0], d[1]); const { data: ex } = await supabase.from('partnerships').select('id_partnership,times_paired').eq('id_tournament', T).eq('id_category', c).eq('id_player1', p1).eq('id_player2', p2).maybeSingle(); if (ex) await supabase.from('partnerships').update({ times_paired: ex.times_paired + 1, last_round_id: rid }).eq('id_partnership', ex.id_partnership); else await supabase.from('partnerships').insert({ id_tournament: T, id_category: c, id_player1: p1, id_player2: p2, times_paired: 1, last_round_id: rid }); }
      for (const pa of g.a) for (const pb of g.b) { const p1 = Math.min(pa, pb), p2 = Math.max(pa, pb); const isD = S[pa] === S[pb] && S[pa] !== 'EITHER'; const { data: ex } = await supabase.from('oppositions').select('id_opposition,times_opposed,diagonal_count').eq('id_tournament', T).eq('id_category', c).eq('id_player1', p1).eq('id_player2', p2).maybeSingle(); if (ex) await supabase.from('oppositions').update({ times_opposed: ex.times_opposed + 1, diagonal_count: ex.diagonal_count + (isD ? 1 : 0), last_round_id: rid }).eq('id_opposition', ex.id_opposition); else await supabase.from('oppositions').insert({ id_tournament: T, id_category: c, id_player1: p1, id_player2: p2, times_opposed: 1, diagonal_count: isD ? 1 : 0, last_round_id: rid }); }
    }
    const playSet = new Set(playing);
    const rows = [...playSet].map(id => ({ id_round: rid, id_player: id, status: 'NO_RESPONSE' })).concat(cp.benched.filter(b => !playSet.has(b)).map(id => ({ id_round: rid, id_player: id, status: 'ROTATED' })));
    ck(await supabase.from('round_attendance').insert(rows), 'ins att');
  }
  console.log('\n✅ aplicado (25/06 re-sorteado na régua de parceria).');
}
main().catch(e => die('exceção', e.message));
