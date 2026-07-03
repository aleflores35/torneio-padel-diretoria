// Re-monta o Feminino de 25/06 sob a regra dura (zero repetição de adversário mesma pos).
// Único jogo de ranking 100% inédito possível hoje: Mariele×Luana (dir) + Amanda×Nara (esq).
// As outras 4 (Paola, Nicole, Daniela, Sabrina) só têm adversária repetida → AMISTOSO.
//
//   RANKING  (round 420 REGULAR, 20:30 Q.Vidro): Mariele/Amanda × Luana/Nara
//   AMISTOSO (round 421 EXHIBITION novo, 18:30 Q.Vidro): Paola/Daniela × Nicole/Sabrina
//
// Reusa as 4 duplas (reforma 2), os 2 matches (preserva quadra/slot), move attendance,
// reverte contadores do 420 e re-carimba SÓ o jogo de ranking.
// DRY:  node scripts/investigacao/remonta_feminino_420_regra_dura.js
// REAL: CONFIRM_EXECUTE=yes node scripts/investigacao/remonta_feminino_420_regra_dura.js
const supabase = require('../../supabase');
const T = 7, CAT = 3, R_RANK = 420;
const DRY = process.env.CONFIRM_EXECUTE !== 'yes';

// ids fixos (confirmados no diag): 707 Mariele,699 Amanda,697 Luana,701 Nara,692 Paola,703 Daniela,695 Nicole,698 Sabrina
const D = { d2946: 2946, d2947: 2947, d2948: 2948, d2949: 2949 };
const RANK_AMISTOSO = {
  rankA: { id: 2947, p1: 707, p2: 699 }, // Mariele(R) + Amanda(L)
  rankB: { id: 2948, p1: 697, p2: 701 }, // Luana(R) + Nara(L)  (inalterado)
  exhA:  { id: 2946, p1: 692, p2: 703 }, // Paola(R) + Daniela(L)
  exhB:  { id: 2949, p1: 695, p2: 698 }, // Nicole(R) + Sabrina(L) (inalterado)
};

async function main() {
  const ids = [707,699,697,701,692,703,695,698];
  const { data: pl } = await supabase.from('players').select('id_player,name,side').in('id_player', ids);
  const NAME={}, SIDE={}; pl.forEach(p=>{NAME[p.id_player]=p.name;SIDE[p.id_player]=p.side;});
  const disp=(a,b)=>`${NAME[a]} / ${NAME[b]}`;

  console.log('=== PLANO ===');
  console.log(`RANKING  (round ${R_RANK}, 20:30): ${disp(707,699)}  ×  ${disp(697,701)}`);
  console.log(`AMISTOSO (round novo EXHIBITION, 18:30): ${disp(692,703)}  ×  ${disp(695,698)}`);
  console.log('confrontos ranking mesma-pos: Mariele×Luana(R) e Amanda×Nara(L) — ambos inéditos');

  if (DRY) { console.log('\n[DRY] nada gravado. CONFIRM_EXECUTE=yes pra aplicar.'); return; }

  // 1) round EXHIBITION novo
  const { data: exRound, error: exErr } = await supabase.from('rounds').insert({
    id_tournament: T, id_category: CAT, round_number: 0, scheduled_date: '2026-06-25',
    window_start: '18:30', window_end: '22:00', status: 'CONFIRMED', round_type: 'EXHIBITION',
  }).select().single();
  if (exErr) throw new Error('criar round exhibition: ' + exErr.message);
  const R_EXH = exRound.id_round;
  console.log(`round EXHIBITION criado: ${R_EXH}`);

  // 2) reforma duplas + atribui rounds
  await supabase.from('doubles').update({ id_player1: 707, id_player2: 699, display_name: disp(707,699), id_round: R_RANK }).eq('id_double', 2947); // Mariele+Amanda
  await supabase.from('doubles').update({ id_round: R_RANK }).eq('id_double', 2948); // Luana+Nara
  await supabase.from('doubles').update({ id_player1: 692, id_player2: 703, display_name: disp(692,703), id_round: R_EXH }).eq('id_double', 2946); // Paola+Daniela
  await supabase.from('doubles').update({ id_round: R_EXH }).eq('id_double', 2949); // Nicole+Sabrina

  // 3) matches (preserva quadra/slot): 1338=ranking 20:30 (Nara), 1337=amistoso 18:30
  await supabase.from('matches').update({ id_double_a: 2947, id_double_b: 2948 }).eq('id_match', 1338);
  await supabase.from('matches').update({ id_double_a: 2946, id_double_b: 2949 }).eq('id_match', 1337);

  // 4) attendance: as 4 do amistoso saem do 420 e entram no 421
  await supabase.from('round_attendance').delete().eq('id_round', R_RANK).in('id_player', [692,695,698,703]);
  await supabase.from('round_attendance').insert([692,695,698,703].map(p=>({ id_round: R_EXH, id_player: p, status: 'NO_RESPONSE' })));

  // 5) reverte contadores carimbados no round 420 (da reconfig anterior)
  for (const tbl of ['partnerships','oppositions']) {
    const { data: rows } = await supabase.from(tbl).select('*').eq('id_tournament',T).eq('id_category',CAT).eq('last_round_id',R_RANK);
    for (const r of rows || []) {
      if (tbl==='partnerships') {
        if (r.times_paired<=1) await supabase.from(tbl).delete().eq('id_partnership', r.id_partnership);
        else await supabase.from(tbl).update({ times_paired:r.times_paired-1, last_round_id:null }).eq('id_partnership', r.id_partnership);
      } else {
        if (r.times_opposed<=1) await supabase.from(tbl).delete().eq('id_opposition', r.id_opposition);
        else await supabase.from(tbl).update({ times_opposed:r.times_opposed-1, diagonal_count:Math.max(0,(r.diagonal_count||0)-1), last_round_id:null }).eq('id_opposition', r.id_opposition);
      }
    }
  }

  // 6) re-aplica SÓ o jogo de ranking (round 420): parcerias + oposições. Amistoso não conta.
  for (const [a,b] of [[707,699],[697,701]]) {
    const p1=Math.min(a,b),p2=Math.max(a,b);
    const { data: ex } = await supabase.from('partnerships').select('id_partnership,times_paired').eq('id_tournament',T).eq('id_category',CAT).eq('id_player1',p1).eq('id_player2',p2).maybeSingle();
    if (ex) await supabase.from('partnerships').update({ times_paired:ex.times_paired+1, last_round_id:R_RANK }).eq('id_partnership', ex.id_partnership);
    else await supabase.from('partnerships').insert({ id_tournament:T,id_category:CAT,id_player1:p1,id_player2:p2,times_paired:1,last_round_id:R_RANK });
  }
  for (const pa of [707,699]) for (const pb of [697,701]) {
    const p1=Math.min(pa,pb),p2=Math.max(pa,pb);
    const isDiag = SIDE[pa]===SIDE[pb] && SIDE[pa]!=='EITHER';
    const { data: ex } = await supabase.from('oppositions').select('id_opposition,times_opposed,diagonal_count').eq('id_tournament',T).eq('id_category',CAT).eq('id_player1',p1).eq('id_player2',p2).maybeSingle();
    if (ex) await supabase.from('oppositions').update({ times_opposed:ex.times_opposed+1, diagonal_count:ex.diagonal_count+(isDiag?1:0), last_round_id:R_RANK }).eq('id_opposition', ex.id_opposition);
    else await supabase.from('oppositions').insert({ id_tournament:T,id_category:CAT,id_player1:p1,id_player2:p2,times_opposed:1,diagonal_count:isDiag?1:0,last_round_id:R_RANK });
  }

  // 7) verificação
  const { data: mr } = await supabase.from('matches').select('id_match,id_double_a,id_double_b,scheduled_at').in('id_match',[1337,1338]);
  const { data: dd } = await supabase.from('doubles').select('id_double,display_name,id_round').in('id_double',[2946,2947,2948,2949]);
  const dn={}; dd.forEach(d=>dn[d.id_double]=`${d.display_name} (r${d.id_round})`);
  console.log('\n=== GRAVADO ===');
  mr.sort((a,b)=>(a.scheduled_at||'').localeCompare(b.scheduled_at||'')).forEach(m=>console.log(`  match ${m.id_match} @${m.scheduled_at.substring(11,16)}: ${dn[m.id_double_a]} × ${dn[m.id_double_b]}`));
  console.log('  ✅ aplicado.');
}
main().catch(e=>{console.error(e);process.exit(1);});
