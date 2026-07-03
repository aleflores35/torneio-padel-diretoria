// Re-sorteia 25/06 INTEIRO com o critério novo (23/06): TUDO ranking, SEM amistosos.
// Minimiza repetição de QUALQUER adversário (pairDoublesGreedy + jogos reais).
// Por categoria: consolida num round REGULAR, re-pareia minimizando, reusa slots
// (jogo da Nara 701 sempre em slot >= 20:30), deleta rounds EXHIBITION, recarimba.
// DRY:  node scripts/investigacao/resorteia_tudo_ranking_2026-06-25.js
// REAL: CONFIRM_EXECUTE=yes node ...
const supabase = require('../../supabase');
const wd = require('../../services/weeklyDrawService');
const T = 7, DATE = '2026-06-25';
const DRY = process.env.CONFIRM_EXECUTE !== 'yes';
const NARA = 701, MIN_NARA = '20:30';
const OPP = 1000, DIAG = 200;
const key = (a, b) => a < b ? `${a}-${b}` : `${b}-${a}`;
const CATS = [{ cat: 1, principal: 418 }, { cat: 2, principal: 419 }, { cat: 3, principal: 420 }];

async function revert(roundId, cat) {
  for (const tbl of ['partnerships', 'oppositions']) {
    const { data: rows } = await supabase.from(tbl).select('*').eq('id_tournament', T).eq('id_category', cat).eq('last_round_id', roundId);
    for (const r of rows || []) {
      if (tbl === 'partnerships') {
        if (r.times_paired <= 1) await supabase.from(tbl).delete().eq('id_partnership', r.id_partnership);
        else await supabase.from(tbl).update({ times_paired: r.times_paired - 1, last_round_id: null }).eq('id_partnership', r.id_partnership);
      } else {
        if (r.times_opposed <= 1) await supabase.from(tbl).delete().eq('id_opposition', r.id_opposition);
        else await supabase.from(tbl).update({ times_opposed: r.times_opposed - 1, diagonal_count: Math.max(0, (r.diagonal_count || 0) - 1), last_round_id: null }).eq('id_opposition', r.id_opposition);
      }
    }
  }
}

async function main() {
  console.log(`== RE-SORTEIO 25/06 (tudo ranking) · ${DRY ? 'DRY' : 'EXEC'} ==`);
  for (const { cat, principal } of CATS) {
    const { data: rounds } = await supabase.from('rounds').select('id_round, round_type').eq('id_tournament', T).eq('id_category', cat).eq('scheduled_date', DATE);
    const roundIds = rounds.map(r => r.id_round);
    const { data: dbl } = await supabase.from('doubles').select('*').in('id_round', roundIds);
    const { data: matches } = await supabase.from('matches').select('id_match,id_double_a,id_double_b,scheduled_at,id_court').in('id_double_a', dbl.map(d => d.id_double));
    const slots = matches.filter(m => m.scheduled_at).map(m => ({ at: m.scheduled_at, court: m.id_court })).sort((a, b) => a.at.localeCompare(b.at));
    const pids = [...new Set(dbl.flatMap(d => [d.id_player1, d.id_player2]))];
    const { data: pl } = await supabase.from('players').select('id_player,name,side').in('id_player', pids);
    const P = {}, side = {}; pl.forEach(p => { P[p.id_player] = p.name; side[p.id_player] = p.side; });

    const { oppMap, diagMap } = await wd.buildRealDiag(T, cat, { excludeRoundId: principal });
    const opp = {}, diag = {};
    for (const k in oppMap) opp[k] = oppMap[k] * OPP;
    for (const k in diagMap) diag[k] = diagMap[k] * DIAG;
    const matchPairs = wd.pairDoublesGreedy(dbl, opp, diag, side);

    // atribui slots: jogo com a Nara vai pro 1º slot >= 20:30
    const games = matchPairs.map(([a, b]) => ({ a, b, hasNara: [a.id_player1, a.id_player2, b.id_player1, b.id_player2].includes(NARA) }));
    const slotsLate = slots.filter(s => s.at.substring(11, 16) >= MIN_NARA);
    const slotsEarly = slots.filter(s => s.at.substring(11, 16) < MIN_NARA);
    const assign = [];
    for (const g of games) {
      const pool = g.hasNara ? slotsLate : slotsEarly.length ? slotsEarly : slotsLate;
      const s = pool.shift() || slots.shift();
      assign.push({ ...g, slot: s });
      [slotsEarly, slotsLate].forEach(arr => { const i = arr.indexOf(s); if (i >= 0) arr.splice(i, 1); });
    }

    const catN = { 1: 'Masc Inic', 2: 'Masc 4ª', 3: 'Feminino' }[cat];
    console.log(`\n### ${catN} (round ${principal}) — ${games.length} jogos ###`);
    let rep = 0;
    for (const g of assign) {
      const cf = [];
      for (const pa of [g.a.id_player1, g.a.id_player2]) for (const pb of [g.b.id_player1, g.b.id_player2]) { const n = oppMap[key(pa, pb)] || 0; if (n > 0) { cf.push(`${P[pa]}×${P[pb]}(${side[pa] === side[pb] ? 'mesma' : 'oposto'})`); rep++; } }
      console.log(`  ${g.slot ? g.slot.at.substring(11, 16) : '??'} ${P[g.a.id_player1]}/${P[g.a.id_player2]} × ${P[g.b.id_player1]}/${P[g.b.id_player2]}${cf.length ? '  ⚠️ ' + cf.join(', ') : '  ✅'}`);
    }
    console.log(`  repetições: ${rep}`);

    if (DRY) continue;

    // EXEC
    for (const rid of roundIds) await revert(rid, cat);
    await supabase.from('matches').delete().in('id_double_a', dbl.map(d => d.id_double));
    // consolida: todas as duplas no round principal; converte principal p/ REGULAR; deleta outros rounds
    await supabase.from('doubles').update({ id_round: principal }).in('id_double', dbl.map(d => d.id_double));
    await supabase.from('rounds').update({ round_type: 'REGULAR' }).eq('id_round', principal);
    for (const rid of roundIds) if (rid !== principal) {
      await supabase.from('round_attendance').delete().eq('id_round', rid);
      await supabase.from('rounds').delete().eq('id_round', rid);
    }
    // matches
    for (const g of assign) {
      await supabase.from('matches').insert({ id_tournament: T, id_double_a: g.a.id_double, id_double_b: g.b.id_double, id_court: g.slot.court, scheduled_at: g.slot.at, status: 'TO_PLAY' });
    }
    // attendance: todos os jogadores das duplas NO_RESPONSE (preserva DECLINED/ROTATED externos)
    await supabase.from('round_attendance').delete().eq('id_round', principal).in('id_player', pids);
    await supabase.from('round_attendance').insert(pids.map(id => ({ id_round: principal, id_player: id, status: 'NO_RESPONSE' })));
    // carimba ranking
    for (const [a, b] of matchPairs) {
      for (const d of [a, b]) {
        const p1 = Math.min(d.id_player1, d.id_player2), p2 = Math.max(d.id_player1, d.id_player2);
        const { data: ex } = await supabase.from('partnerships').select('id_partnership,times_paired').eq('id_tournament', T).eq('id_category', cat).eq('id_player1', p1).eq('id_player2', p2).maybeSingle();
        if (ex) await supabase.from('partnerships').update({ times_paired: ex.times_paired + 1, last_round_id: principal }).eq('id_partnership', ex.id_partnership);
        else await supabase.from('partnerships').insert({ id_tournament: T, id_category: cat, id_player1: p1, id_player2: p2, times_paired: 1, last_round_id: principal });
      }
      for (const pa of [a.id_player1, a.id_player2]) for (const pb of [b.id_player1, b.id_player2]) {
        const p1 = Math.min(pa, pb), p2 = Math.max(pa, pb);
        const isDiag = side[pa] === side[pb] && side[pa] !== 'EITHER';
        const { data: ex } = await supabase.from('oppositions').select('id_opposition,times_opposed,diagonal_count').eq('id_tournament', T).eq('id_category', cat).eq('id_player1', p1).eq('id_player2', p2).maybeSingle();
        if (ex) await supabase.from('oppositions').update({ times_opposed: ex.times_opposed + 1, diagonal_count: ex.diagonal_count + (isDiag ? 1 : 0), last_round_id: principal }).eq('id_opposition', ex.id_opposition);
        else await supabase.from('oppositions').insert({ id_tournament: T, id_category: cat, id_player1: p1, id_player2: p2, times_opposed: 1, diagonal_count: isDiag ? 1 : 0, last_round_id: principal });
      }
    }
  }
  console.log(DRY ? '\n[DRY] nada gravado.' : '\n✅ aplicado.');
}
main().catch(e => { console.error(e); process.exit(1); });
