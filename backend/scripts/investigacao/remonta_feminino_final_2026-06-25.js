// Re-montagem FINAL do Feminino 25/06 (após corrigir a fonte oppositions e Nicole sair).
// Feminino saturado → só 1 jogo de ranking inédito possível.
//   RANKING  (round 420 REGULAR, 18:30 Q.Vidro): Mariele/Amanda × Luana/Sabrina
//            (mesma-pos Mariele×Luana e Amanda×Sabrina — inéditos pela fonte REAL)
//   AMISTOSO (round 421 EXHIBITION, 20:30 Q.Vidro): Paola/Daniela × Tanise/Nara (Nara ≥20:30)
//   Fora: Nicole (saiu, DECLINED) · Eduarda/Catiane (rodízio)
// DRY:  node scripts/investigacao/remonta_feminino_final_2026-06-25.js
// REAL: CONFIRM_EXECUTE=yes node ...
const supabase = require('../../supabase');
const T = 7, CAT = 3, R_RANK = 420, R_EXH = 421, COURT = 16, DATE = '2026-06-25';
const DRY = process.env.CONFIRM_EXECUTE !== 'yes';
const pk = (a, b) => a < b ? `${a}-${b}` : `${b}-${a}`;

async function main() {
  // ids por nome (robustez)
  const { data: pl } = await supabase.from('players').select('id_player,name,side').eq('id_tournament', T).eq('category_id', CAT);
  const byName = re => (pl.find(p => re.test(p.name)) || {});
  const P = {}; pl.forEach(p => P[p.id_player] = p);
  const M = byName(/mariele/i), AM = byName(/amanda/i), LU = byName(/luana/i), SA = byName(/sabrina/i),
        PA = byName(/paola/i), DA = byName(/daniela/i), TA = byName(/tanise/i), NA = byName(/nara/i), NI = byName(/nicole/i);
  const need = { M, AM, LU, SA, PA, DA, TA, NA };
  for (const [k, v] of Object.entries(need)) if (!v.id_player) throw new Error('não achei ' + k);

  // RANKING (420): Mariele(R)+Amanda(L) × Luana(R)+Sabrina(L)
  const rankPairs = [[M.id_player, AM.id_player], [LU.id_player, SA.id_player]];
  // AMISTOSO (421): Paola(R)+Daniela(L) × Tanise(R)+Nara(L)
  const exhPairs = [[PA.id_player, DA.id_player], [TA.id_player, NA.id_player]];

  const disp = id => `${P[id].name}(${P[id].side[0]})`;
  console.log(`== RE-MONTAGEM FEMININO · ${DRY ? 'DRY' : 'EXEC'} ==`);
  console.log(`RANKING 420 @18:30: ${disp(M.id_player)}/${disp(AM.id_player)} × ${disp(LU.id_player)}/${disp(SA.id_player)}`);
  console.log(`  mesma-pos: ${P[M.id_player].name}×${P[LU.id_player].name} (R) · ${P[AM.id_player].name}×${P[SA.id_player].name} (L)`);
  console.log(`AMISTOSO 421 @20:30: ${disp(PA.id_player)}/${disp(DA.id_player)} × ${disp(TA.id_player)}/${disp(NA.id_player)}`);
  console.log(`Nicole (${NI.id_player}) → fora (DECLINED)`);

  if (DRY) { console.log('\n[DRY] nada gravado.'); return; }

  // 1) reverte contadores dos 2 rounds
  for (const RID of [R_RANK, R_EXH]) {
    for (const tbl of ['partnerships', 'oppositions']) {
      const { data: rows } = await supabase.from(tbl).select('*').eq('id_tournament', T).eq('id_category', CAT).eq('last_round_id', RID);
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
  // 2) apaga matches/duplas/attendance dos 2 rounds
  for (const RID of [R_RANK, R_EXH]) {
    const { data: dd } = await supabase.from('doubles').select('id_double').eq('id_round', RID);
    if (dd && dd.length) await supabase.from('matches').delete().in('id_double_a', dd.map(d => d.id_double));
    await supabase.from('doubles').delete().eq('id_round', RID);
    await supabase.from('round_attendance').delete().eq('id_round', RID);
  }
  // garante round_type
  await supabase.from('rounds').update({ round_type: 'REGULAR' }).eq('id_round', R_RANK);
  await supabase.from('rounds').update({ round_type: 'EXHIBITION' }).eq('id_round', R_EXH);

  // 3) cria duplas + matches
  const mkDouble = async (RID, a, b) => {
    const { data } = await supabase.from('doubles').insert({ id_tournament: T, id_player1: a, id_player2: b, display_name: `${P[a].name} / ${P[b].name}`, id_round: RID }).select().single();
    return data.id_double;
  };
  const rA = await mkDouble(R_RANK, rankPairs[0][0], rankPairs[0][1]);
  const rB = await mkDouble(R_RANK, rankPairs[1][0], rankPairs[1][1]);
  await supabase.from('matches').insert({ id_tournament: T, id_double_a: rA, id_double_b: rB, id_court: COURT, scheduled_at: `${DATE}T18:30:00`, status: 'TO_PLAY' });
  const eA = await mkDouble(R_EXH, exhPairs[0][0], exhPairs[0][1]);
  const eB = await mkDouble(R_EXH, exhPairs[1][0], exhPairs[1][1]);
  await supabase.from('matches').insert({ id_tournament: T, id_double_a: eA, id_double_b: eB, id_court: COURT, scheduled_at: `${DATE}T20:30:00`, status: 'TO_PLAY' });

  // 4) attendance
  await supabase.from('round_attendance').insert([
    ...rankPairs.flat().map(id => ({ id_round: R_RANK, id_player: id, status: 'NO_RESPONSE' })),
    { id_round: R_RANK, id_player: NI.id_player, status: 'DECLINED', responded_by: 'ADMIN' },
  ]);
  await supabase.from('round_attendance').insert(exhPairs.flat().map(id => ({ id_round: R_EXH, id_player: id, status: 'NO_RESPONSE' })));

  // 5) carimba SÓ ranking (420)
  for (const [a, b] of rankPairs) {
    const p1 = Math.min(a, b), p2 = Math.max(a, b);
    const { data: ex } = await supabase.from('partnerships').select('id_partnership,times_paired').eq('id_tournament', T).eq('id_category', CAT).eq('id_player1', p1).eq('id_player2', p2).maybeSingle();
    if (ex) await supabase.from('partnerships').update({ times_paired: ex.times_paired + 1, last_round_id: R_RANK }).eq('id_partnership', ex.id_partnership);
    else await supabase.from('partnerships').insert({ id_tournament: T, id_category: CAT, id_player1: p1, id_player2: p2, times_paired: 1, last_round_id: R_RANK });
  }
  const [da, db] = [{ p1: rankPairs[0][0], p2: rankPairs[0][1] }, { p1: rankPairs[1][0], p2: rankPairs[1][1] }];
  for (const pa of [da.p1, da.p2]) for (const pb of [db.p1, db.p2]) {
    const p1 = Math.min(pa, pb), p2 = Math.max(pa, pb);
    const isDiag = P[pa].side === P[pb].side && P[pa].side !== 'EITHER';
    const { data: ex } = await supabase.from('oppositions').select('id_opposition,times_opposed,diagonal_count').eq('id_tournament', T).eq('id_category', CAT).eq('id_player1', p1).eq('id_player2', p2).maybeSingle();
    if (ex) await supabase.from('oppositions').update({ times_opposed: ex.times_opposed + 1, diagonal_count: ex.diagonal_count + (isDiag ? 1 : 0), last_round_id: R_RANK }).eq('id_opposition', ex.id_opposition);
    else await supabase.from('oppositions').insert({ id_tournament: T, id_category: CAT, id_player1: p1, id_player2: p2, times_opposed: 1, diagonal_count: isDiag ? 1 : 0, last_round_id: R_RANK });
  }
  console.log('\n✅ Feminino re-montado.');
}
main().catch(e => { console.error(e); process.exit(1); });
