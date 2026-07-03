// Aplica a troca Ivan(685)→Hélisson(688) no round 416 (cat 2), chegando a 0 repeat de mesma posição.
// CIRÚRGICO: atualiza duplas in-place, re-pareia os 2 matches PRESERVANDO horário/quadra (19:10),
// ajusta presença (Ivan→ROTATED, Hélisson→NO_RESPONSE) e corrige contadores (reverte 416 + re-aplica).
// NÃO re-slota a noite (Nara segue 21:10).
// DRY:  node scripts/investigacao/aplica_swap_helisson_416.js
// REAL: CONFIRM_EXECUTE=yes node scripts/investigacao/aplica_swap_helisson_416.js
const supabase = require('../../supabase');

const TOUR = 7, CAT = 2, ROUND = 416;
const DRY = process.env.CONFIRM_EXECUTE !== 'yes';

// duplas alvo (id_player1 = RIGHT, id_player2 = LEFT)
const TARGET_DOUBLES = {
  2927: { p1: 678, p2: 690 }, // Dinho / Alessandro  (inalterado)
  2928: { p1: 677, p2: 688 }, // Cassius Zanenga / Hélisson Borges  (era /João)
  2929: { p1: 680, p2: 686 }, // Gabriel / Pablo  (era /Ivan)
  2930: { p1: 675, p2: 682 }, // Marcio Delia / João Felipe  (era /Pablo)
};
// pareamento alvo (preserva matches existentes + horários): A=2927×2928, B=2930×2929
const TARGET_MATCHES = { A: { da: 2927, db: 2928 }, B: { da: 2930, db: 2929 } };

const key = (a, b) => (a < b ? `${a}-${b}` : `${b}-${a}`);

async function main() {
  // nomes + lados
  const allIds = [...new Set(Object.values(TARGET_DOUBLES).flatMap(d => [d.p1, d.p2]).concat([685]))];
  const { data: players } = await supabase.from('players').select('id_player, name, side').in('id_player', allIds);
  const NAME = {}, SIDE = {}; players.forEach(p => { NAME[p.id_player] = p.name; SIDE[p.id_player] = p.side; });
  const disp = (p1, p2) => `${NAME[p1]} / ${NAME[p2]}`;

  // estado atual
  const { data: curDbl } = await supabase.from('doubles').select('*').eq('id_round', ROUND).order('id_double');
  const { data: curMatches } = await supabase.from('matches').select('id_match, id_double_a, id_double_b, scheduled_at, id_court').in('id_match', [1330, 1331]);
  console.log('=== DUPLAS ANTES ===');
  curDbl.forEach(d => console.log(`  ${d.id_double}: ${d.display_name} (p1=${d.id_player1} p2=${d.id_player2})`));
  console.log('=== MATCHES ANTES ===');
  curMatches.forEach(m => console.log(`  ${m.id_match} @${m.scheduled_at} court ${m.id_court}: A=${m.id_double_a} B=${m.id_double_b}`));

  console.log('\n=== PLANO ===');
  Object.entries(TARGET_DOUBLES).forEach(([id, d]) => console.log(`  dupla ${id} -> ${disp(d.p1, d.p2)} (p1=${d.p1} p2=${d.p2})`));
  console.log(`  match 1330 -> A=${TARGET_MATCHES.A.da} (${disp(TARGET_DOUBLES[2927].p1, TARGET_DOUBLES[2927].p2)})  B=${TARGET_MATCHES.A.db} (${disp(TARGET_DOUBLES[2928].p1, TARGET_DOUBLES[2928].p2)})  [19:10 preservado]`);
  console.log(`  match 1331 -> A=${TARGET_MATCHES.B.da} (${disp(TARGET_DOUBLES[2930].p1, TARGET_DOUBLES[2930].p2)})  B=${TARGET_MATCHES.B.db} (${disp(TARGET_DOUBLES[2929].p1, TARGET_DOUBLES[2929].p2)})  [19:10 preservado]`);
  console.log('  presença: 685 Ivan -> ROTATED ; 688 Hélisson -> NO_RESPONSE');
  console.log('  contadores: reverte round 416 + re-aplica parcerias/oposições do novo pareamento');

  if (DRY) { console.log('\n[DRY] nada gravado. Rode com CONFIRM_EXECUTE=yes pra aplicar.'); return; }

  // 1) duplas
  for (const [id, d] of Object.entries(TARGET_DOUBLES)) {
    await supabase.from('doubles').update({ id_player1: d.p1, id_player2: d.p2, display_name: disp(d.p1, d.p2) }).eq('id_double', Number(id));
  }
  // 2) matches (re-pareia, preserva scheduled_at/id_court)
  await supabase.from('matches').update({ id_double_a: TARGET_MATCHES.A.da, id_double_b: TARGET_MATCHES.A.db }).eq('id_match', 1330);
  await supabase.from('matches').update({ id_double_a: TARGET_MATCHES.B.da, id_double_b: TARGET_MATCHES.B.db }).eq('id_match', 1331);
  // 3) presença
  await supabase.from('round_attendance').update({ status: 'ROTATED' }).eq('id_round', ROUND).eq('id_player', 685);
  await supabase.from('round_attendance').upsert({ id_round: ROUND, id_player: 688, status: 'NO_RESPONSE' }, { onConflict: 'id_round,id_player' });

  // 4) contadores — reverte 416 (replica revertCountersForRound)
  for (const tbl of ['partnerships', 'oppositions']) {
    const { data: rows } = await supabase.from(tbl).select('*').eq('id_tournament', TOUR).eq('id_category', CAT).eq('last_round_id', ROUND);
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
  // re-aplica parcerias (4 duplas novas)
  for (const d of Object.values(TARGET_DOUBLES)) {
    const p1 = Math.min(d.p1, d.p2), p2 = Math.max(d.p1, d.p2);
    const { data: ex } = await supabase.from('partnerships').select('id_partnership, times_paired').eq('id_tournament', TOUR).eq('id_category', CAT).eq('id_player1', p1).eq('id_player2', p2).maybeSingle();
    if (ex) await supabase.from('partnerships').update({ times_paired: ex.times_paired + 1, last_round_id: ROUND }).eq('id_partnership', ex.id_partnership);
    else await supabase.from('partnerships').insert({ id_tournament: TOUR, id_category: CAT, id_player1: p1, id_player2: p2, times_paired: 1, last_round_id: ROUND });
  }
  // re-aplica oposições (2 matches novos)
  const matchPairs = [[TARGET_DOUBLES[2927], TARGET_DOUBLES[2928]], [TARGET_DOUBLES[2930], TARGET_DOUBLES[2929]]];
  for (const [da, db] of matchPairs) {
    for (const pa of [da.p1, da.p2]) for (const pb of [db.p1, db.p2]) {
      const p1 = Math.min(pa, pb), p2 = Math.max(pa, pb);
      const isDiag = SIDE[pa] && SIDE[pa] === SIDE[pb] && SIDE[pa] !== 'EITHER';
      const { data: ex } = await supabase.from('oppositions').select('id_opposition, times_opposed, diagonal_count').eq('id_tournament', TOUR).eq('id_category', CAT).eq('id_player1', p1).eq('id_player2', p2).maybeSingle();
      if (ex) await supabase.from('oppositions').update({ times_opposed: ex.times_opposed + 1, diagonal_count: ex.diagonal_count + (isDiag ? 1 : 0), last_round_id: ROUND }).eq('id_opposition', ex.id_opposition);
      else await supabase.from('oppositions').insert({ id_tournament: TOUR, id_category: CAT, id_player1: p1, id_player2: p2, times_opposed: 1, diagonal_count: isDiag ? 1 : 0, last_round_id: ROUND });
    }
  }

  // 5) verificação
  console.log('\n=== DEPOIS ===');
  const { data: aft } = await supabase.from('matches').select('id_match, id_double_a, id_double_b, scheduled_at').in('id_match', [1330, 1331]);
  const { data: aftDbl } = await supabase.from('doubles').select('id_double, display_name').eq('id_round', ROUND);
  const dn = {}; aftDbl.forEach(d => { dn[d.id_double] = d.display_name; });
  aft.forEach(m => console.log(`  match ${m.id_match} @${m.scheduled_at}: ${dn[m.id_double_a]} × ${dn[m.id_double_b]}`));
  const { data: pi } = await supabase.from('oppositions').select('times_opposed, diagonal_count, last_round_id').eq('id_tournament', TOUR).eq('id_category', CAT).eq('id_player1', Math.min(685, 686)).eq('id_player2', Math.max(685, 686)).maybeSingle();
  console.log(`  Pablo×Ivan oposição agora: ${JSON.stringify(pi)} (esperado times=1 diag=1, só do round 413)`);
  console.log('  ✅ aplicado.');
}
main().catch(e => { console.error(e); process.exit(1); });
