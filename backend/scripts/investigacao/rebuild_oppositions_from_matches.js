// Reconstrói a tabela `oppositions` a partir dos JOGOS REAIS (fonte de verdade).
// Fonte: matches de rounds REGULAR (NÃO EXHIBITION), status FINISHED/WO/TO_PLAY
// (jogos já realizados + agendados). Para cada match, conta os 4 pares jogador-adversário:
//   times_opposed++ sempre; diagonal_count++ se mesma posição (não-EITHER).
//   last_round_id = maior id_round em que o par se enfrentou (mantém revert idempotente).
// O contador estava furado (jogos de abril nunca carimbados) → isso sincroniza tudo.
// DRY:  node scripts/investigacao/rebuild_oppositions_from_matches.js
// REAL: CONFIRM_EXECUTE=yes node scripts/investigacao/rebuild_oppositions_from_matches.js
const supabase = require('../../supabase');
const T = 7;
const DRY = process.env.CONFIRM_EXECUTE !== 'yes';
const key = (a, b) => a < b ? `${a}-${b}` : `${b}-${a}`;

async function main() {
  const { data: rounds } = await supabase.from('rounds').select('id_round, id_category, round_type').eq('id_tournament', T);
  const regCat = {}; // id_round -> id_category (só REGULAR)
  rounds.forEach(r => { if (r.round_type !== 'EXHIBITION') regCat[r.id_round] = r.id_category; });

  const { data: dbl } = await supabase.from('doubles').select('id_double, id_round, id_player1, id_player2');
  const D = {}; dbl.forEach(d => D[d.id_double] = d);
  const { data: pl } = await supabase.from('players').select('id_player, side');
  const P = {}; pl.forEach(p => P[p.id_player] = p.side);

  const { data: matches } = await supabase.from('matches')
    .select('id_double_a, id_double_b, status').eq('id_tournament', T).in('status', ['FINISHED', 'WO', 'TO_PLAY']);

  // acc[cat][pairKey] = { p1, p2, times, diag, lastRound }
  const acc = {};
  for (const m of matches) {
    const da = D[m.id_double_a], db = D[m.id_double_b];
    if (!da || !db) continue;
    const cat = regCat[da.id_round];
    if (!cat) continue; // ignora EXHIBITION
    acc[cat] = acc[cat] || {};
    for (const pa of [da.id_player1, da.id_player2]) for (const pb of [db.id_player1, db.id_player2]) {
      if (pa == null || pb == null || pa === pb) continue;
      const k = key(pa, pb);
      const p1 = Math.min(pa, pb), p2 = Math.max(pa, pb);
      const same = P[pa] && P[pb] && P[pa] === P[pb] && P[pa] !== 'EITHER';
      const e = acc[cat][k] || { p1, p2, times: 0, diag: 0, lastRound: 0 };
      e.times += 1; if (same) e.diag += 1;
      e.lastRound = Math.max(e.lastRound, da.id_round);
      acc[cat][k] = e;
    }
  }
  // cada par é contado 2x no laço (pa,pb) e (pb,pa)? Não: laço aPlayers×bPlayers gera cada par adversário 1x.
  // Mas como acc agrupa por key normalizada e cada match gera o par 1x, está correto (1 incremento por match).

  const { data: cur } = await supabase.from('oppositions').select('*').eq('id_tournament', T);
  console.log(`oppositions atuais: ${cur.length} · ${DRY ? 'DRY-RUN' : 'EXECUTANDO'}`);
  let totalNew = 0;
  for (const cat of Object.keys(acc)) {
    const n = Object.keys(acc[cat]).length;
    totalNew += n;
    console.log(`  cat ${cat}: ${n} confrontos reais (com diag>0: ${Object.values(acc[cat]).filter(e => e.diag > 0).length})`);
  }
  console.log(`total reconstruído: ${totalNew} (vs ${cur.length} atuais)`);

  if (DRY) { console.log('\n[DRY] nada gravado.'); return; }

  // Substitui: apaga todos do torneio e insere os recalculados
  await supabase.from('oppositions').delete().eq('id_tournament', T);
  const rows = [];
  for (const cat of Object.keys(acc)) {
    for (const e of Object.values(acc[cat])) {
      rows.push({ id_tournament: T, id_category: Number(cat), id_player1: e.p1, id_player2: e.p2,
        times_opposed: e.times, diagonal_count: e.diag, last_round_id: e.lastRound || null });
    }
  }
  // insere em lotes
  for (let i = 0; i < rows.length; i += 200) {
    const { error } = await supabase.from('oppositions').insert(rows.slice(i, i + 200));
    if (error) throw new Error('insert: ' + error.message);
  }
  console.log(`\n✅ oppositions reconstruído: ${rows.length} registros.`);
}
main().catch(e => { console.error(e); process.exit(1); });
