// Troca Hélisson(688) -> Helio Garcia(689) no round 416 (cat 2). Helio voltou de lesão (apto).
// Mesmo frescor que o Hélisson -> segue 0 repeat de mesma posição (Helio enfrenta Alessandro = inédito).
// Atualiza dupla 2928, presença (688->ROTATED, 689->NO_RESPONSE) e RECONSTRÓI contadores do 416
// (reverte tudo do round 416 e re-aplica a partir das duplas/matches ATUAIS). Preserva horários.
// DRY:  node scripts/investigacao/swap_helisson_para_helio_416.js
// REAL: CONFIRM_EXECUTE=yes node scripts/investigacao/swap_helisson_para_helio_416.js
const supabase = require('../../supabase');
const TOUR = 7, CAT = 2, ROUND = 416, DUPLA = 2928, OUT = 688, IN = 689, ZANENGA = 677;
const DRY = process.env.CONFIRM_EXECUTE !== 'yes';

async function main() {
  const { data: pl } = await supabase.from('players').select('id_player,name,side').in('id_player', [IN, OUT, ZANENGA]);
  const NAME = {}; pl.forEach(p => NAME[p.id_player] = p.name);
  const newName = `${NAME[ZANENGA]} / ${NAME[IN]}`;
  console.log(`Plano: dupla ${DUPLA} -> ${newName} (p2 ${OUT}→${IN}); presença ${OUT}→ROTATED, ${IN}→NO_RESPONSE; rebuild contadores 416.`);
  if (DRY) { console.log('[DRY] nada gravado.'); return; }

  // 1) dupla
  await supabase.from('doubles').update({ id_player2: IN, display_name: newName }).eq('id_double', DUPLA);
  // 2) presença
  await supabase.from('round_attendance').upsert({ id_round: ROUND, id_player: OUT, status: 'ROTATED' }, { onConflict: 'id_round,id_player' });
  await supabase.from('round_attendance').upsert({ id_round: ROUND, id_player: IN, status: 'NO_RESPONSE' }, { onConflict: 'id_round,id_player' });

  // 3) revert contadores do round 416
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

  // 4) re-aplica a partir das duplas/matches ATUAIS do 416
  const { data: dbls } = await supabase.from('doubles').select('*').eq('id_round', ROUND);
  const byId = {}; dbls.forEach(d => byId[d.id_double] = d);
  const allP = [...new Set(dbls.flatMap(d => [d.id_player1, d.id_player2]))];
  const { data: pls } = await supabase.from('players').select('id_player,side').in('id_player', allP);
  const SIDE = {}; pls.forEach(p => SIDE[p.id_player] = p.side);
  // parcerias
  for (const d of dbls) {
    const p1 = Math.min(d.id_player1, d.id_player2), p2 = Math.max(d.id_player1, d.id_player2);
    const { data: ex } = await supabase.from('partnerships').select('id_partnership,times_paired').eq('id_tournament', TOUR).eq('id_category', CAT).eq('id_player1', p1).eq('id_player2', p2).maybeSingle();
    if (ex) await supabase.from('partnerships').update({ times_paired: ex.times_paired + 1, last_round_id: ROUND }).eq('id_partnership', ex.id_partnership);
    else await supabase.from('partnerships').insert({ id_tournament: TOUR, id_category: CAT, id_player1: p1, id_player2: p2, times_paired: 1, last_round_id: ROUND });
  }
  // oposições (a partir dos matches do 416)
  const dblIds = dbls.map(d => d.id_double);
  const orM = dblIds.map(i => `id_double_a.eq.${i}`).concat(dblIds.map(i => `id_double_b.eq.${i}`)).join(',');
  const { data: ms } = await supabase.from('matches').select('id_double_a,id_double_b').or(orM);
  for (const m of ms) {
    const A = byId[m.id_double_a], B = byId[m.id_double_b]; if (!A || !B) continue;
    for (const pa of [A.id_player1, A.id_player2]) for (const pb of [B.id_player1, B.id_player2]) {
      const p1 = Math.min(pa, pb), p2 = Math.max(pa, pb);
      const isDiag = SIDE[pa] && SIDE[pa] === SIDE[pb] && SIDE[pa] !== 'EITHER';
      const { data: ex } = await supabase.from('oppositions').select('id_opposition,times_opposed,diagonal_count').eq('id_tournament', TOUR).eq('id_category', CAT).eq('id_player1', p1).eq('id_player2', p2).maybeSingle();
      if (ex) await supabase.from('oppositions').update({ times_opposed: ex.times_opposed + 1, diagonal_count: ex.diagonal_count + (isDiag ? 1 : 0), last_round_id: ROUND }).eq('id_opposition', ex.id_opposition);
      else await supabase.from('oppositions').insert({ id_tournament: TOUR, id_category: CAT, id_player1: p1, id_player2: p2, times_opposed: 1, diagonal_count: isDiag ? 1 : 0, last_round_id: ROUND });
    }
  }

  // 5) verificação
  const { data: aft } = await supabase.from('matches').select('id_match,id_double_a,id_double_b,scheduled_at').in('id_match', [1330, 1331]);
  const dn = {}; (await supabase.from('doubles').select('id_double,display_name').eq('id_round', ROUND)).data.forEach(d => dn[d.id_double] = d.display_name);
  console.log('=== DEPOIS ===');
  aft.forEach(m => console.log(`  match ${m.id_match} @${m.scheduled_at}: ${dn[m.id_double_a]} × ${dn[m.id_double_b]}`));
  const helioAlessandro = await supabase.from('oppositions').select('times_opposed,diagonal_count').eq('id_tournament', TOUR).eq('id_category', CAT).eq('id_player1', Math.min(689, 690)).eq('id_player2', Math.max(689, 690)).maybeSingle();
  console.log('  Helio×Alessandro (mesma posição):', JSON.stringify(helioAlessandro.data), '(esperado times=1 diag=1 — 1ª vez, sem repeat)');
  console.log('  ✅ aplicado.');
}
main().catch(e => { console.error(e); process.exit(1); });
