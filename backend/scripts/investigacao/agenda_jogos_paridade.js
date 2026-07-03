// Agenda os 3 jogos de PARIDADE (1 por categoria): a dupla inédita que sobrou joga contra uma
// dupla REPETIDA (decisão Alessandro: "joga com adversário repetido" → todos completam o nº de jogos).
// Rodada de fechamento em 27/08. Escolhe adversário = par completo que já jogou junto (repetida),
// preferindo quem JOGOU MENOS (FINISHED) pra distribuir o "+1" de forma justa.
// DRY:  node scripts/investigacao/agenda_jogos_paridade.js
// REAL: CONFIRM_EXECUTE=yes node ...
const supabase = require('../../supabase');
const T = 7, DATE = '2026-08-27';
const key = (a, b) => a < b ? `${a}-${b}` : `${b}-${a}`;
const DRY = process.env.CONFIRM_EXECUTE !== 'yes';
const NARA = 701;
const CATS = [{ c: 3, n: 'Feminino', time: '18:30' }, { c: 2, n: 'Masc 4ª', time: '19:10' }, { c: 1, n: 'Masc Iniciante', time: '19:50' }];
const die = (m, e) => { console.error('🔴', m, e ? JSON.stringify(e) : ''); process.exit(1); };
const ck = (r, w) => { if (r.error) die(w + ' falhou', r.error); return r; };

async function main() {
  const { data: courts } = await supabase.from('courts').select('id_court,name').eq('id_tournament', T).order('order_index');
  const plans = [];
  for (const { c, n, time } of CATS) {
    const { data: pl } = await supabase.from('players').select('id_player,name,side,active').eq('id_tournament', T).eq('category_id', c);
    const P = {}, S = {}; pl.forEach(p => { P[p.id_player] = p.name; S[p.id_player] = p.side; });
    const active = pl.filter(p => p.active !== false);
    const R = active.filter(p => p.side === 'RIGHT').map(p => p.id_player), L = active.filter(p => p.side === 'LEFT').map(p => p.id_player);
    const { data: rounds } = await supabase.from('rounds').select('id_round,round_type').eq('id_tournament', T).eq('id_category', c);
    const regIds = rounds.filter(r => r.round_type !== 'EXHIBITION').map(r => r.id_round);
    const { data: dbl } = await supabase.from('doubles').select('id_double,id_player1,id_player2').in('id_round', regIds);
    const D = {}; (dbl || []).forEach(d => D[d.id_double] = d);
    const part = {}; active.forEach(p => part[p.id_player] = new Set());
    (dbl || []).forEach(d => { const a = d.id_player1, b = d.id_player2; if ((S[a] === 'RIGHT' && S[b] === 'LEFT') || (S[a] === 'LEFT' && S[b] === 'RIGHT')) { part[a] && part[a].add(b); part[b] && part[b].add(a); } });
    // FINISHED por jogador (pra escolher adversário menos rodado)
    const { data: fm } = await supabase.from('matches').select('id_double_a,id_double_b').in('id_double_a', (dbl || []).map(d => d.id_double)).eq('status', 'FINISHED');
    const fin = {}; for (const m of (fm || [])) { const da = D[m.id_double_a], db = D[m.id_double_b]; if (!da || !db) continue; for (const p of [da.id_player1, da.id_player2, db.id_player1, db.id_player2]) fin[p] = (fin[p] || 0) + 1; }
    // sobra = incompletos
    const Rs = R.find(r => part[r].size < L.length), Ls = L.find(l => part[l].size < R.length);
    if (!Rs || !Ls) { console.log(`${n}: sem sobra (já completo) — pulo`); continue; }
    // adversário: par (Ro,Lo) completo, que JÁ jogou junto (repetida), ≠ sobra, menos FINISHED
    let best = null;
    for (const Ro of R) for (const Lo of L) {
      if (Ro === Rs || Lo === Ls) continue;
      if (part[Ro].size < L.length || part[Lo].size < R.length) continue; // tem que estar completo
      if (!part[Ro].has(Lo)) continue; // tem que ser dupla REPETIDA (já jogaram)
      const load = (fin[Ro] || 0) + (fin[Lo] || 0);
      if (!best || load < best.load) best = { Ro, Lo, load };
    }
    if (!best) die(`${n}: não achei adversário de dupla repetida completo`);
    plans.push({ c, n, time, P, S, Rs, Ls, Ro: best.Ro, Lo: best.Lo });
  }

  console.log(`== JOGOS DE PARIDADE (27/08) · ${DRY ? 'DRY' : 'EXEC'} ==`);
  for (const p of plans) console.log(`  ${p.n}: ${p.time}  ${p.P[p.Rs]}/${p.P[p.Ls]} (inédita) × ${p.P[p.Ro]}/${p.P[p.Lo]} (🔁 repetida — esses 2 jogam +1)`);

  if (DRY) { console.log('\n[DRY] nada gravado.'); return; }

  const { data: maxr } = await supabase.from('rounds').select('round_number').eq('id_tournament', T).order('round_number', { ascending: false }).limit(1);
  let rn = (maxr && maxr[0] ? maxr[0].round_number : 0) + 1;
  for (const p of plans) {
    const { data: rd } = ck(await supabase.from('rounds').insert({ id_tournament: T, id_category: p.c, round_number: rn++, scheduled_date: DATE, window_start: '18:30', window_end: '22:00', status: 'CONFIRMED', round_type: 'REGULAR' }).select().single(), 'cria round');
    const rid = rd.id_round;
    const mk = async (r, l) => { const { data } = ck(await supabase.from('doubles').insert({ id_tournament: T, id_player1: r, id_player2: l, display_name: `${p.P[r]} / ${p.P[l]}`, id_round: rid }).select().single(), 'ins double'); return data; };
    const da = await mk(p.Rs, p.Ls), db = await mk(p.Ro, p.Lo);
    const court = p.time >= '20:30' && [p.Rs, p.Ls, p.Ro, p.Lo].includes(NARA) ? courts[0].id_court : courts[0].id_court;
    ck(await supabase.from('matches').insert({ id_tournament: T, id_double_a: da.id_double, id_double_b: db.id_double, id_court: court, scheduled_at: `${DATE}T${p.time}:00`, status: 'TO_PLAY' }), 'ins match');
    // carimba (dupla inédita Rs/Ls nova; Ro/Lo repetida → times_paired+1)
    for (const [a, b] of [[p.Rs, p.Ls], [p.Ro, p.Lo]]) { const p1 = Math.min(a, b), p2 = Math.max(a, b); const { data: ex } = await supabase.from('partnerships').select('id_partnership,times_paired').eq('id_tournament', T).eq('id_category', p.c).eq('id_player1', p1).eq('id_player2', p2).maybeSingle(); if (ex) await supabase.from('partnerships').update({ times_paired: ex.times_paired + 1, last_round_id: rid }).eq('id_partnership', ex.id_partnership); else await supabase.from('partnerships').insert({ id_tournament: T, id_category: p.c, id_player1: p1, id_player2: p2, times_paired: 1, last_round_id: rid }); }
    ck(await supabase.from('round_attendance').insert([p.Rs, p.Ls, p.Ro, p.Lo].map(id => ({ id_round: rid, id_player: id, status: 'NO_RESPONSE' }))), 'ins att');
  }
  console.log('\n✅ jogos de paridade agendados (27/08).');
}
main().catch(e => die('exceção', e.message));
