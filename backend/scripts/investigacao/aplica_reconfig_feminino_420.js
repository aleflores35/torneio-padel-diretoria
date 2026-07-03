// Reconfigura o round 420 (Fem, 25/06) p/ minimizar repetição de mesma posição.
// Mesmas 4 duplas — só re-empareja qual dupla enfrenta qual (preserva horários/Nara 20:30).
//   ANTES:  1337(18:30) Mariele+Daniela × Paola+Amanda  |  1338(20:30) Luana+Nara × Nicole+Sabrina
//   DEPOIS: 1337(18:30) Mariele+Daniela × Nicole+Sabrina |  1338(20:30) Luana+Nara × Paola+Amanda
//   → Nicole passa a enfrentar Mariele (1×) em vez de Luana (2×); repetições da noite 6→3.
// Contadores: reverte oposições/parcerias do round 420 + re-aplica (parcerias idênticas).
// DRY:  node scripts/investigacao/aplica_reconfig_feminino_420.js
// REAL: CONFIRM_EXECUTE=yes node scripts/investigacao/aplica_reconfig_feminino_420.js
const supabase = require('../../supabase');
const TOUR = 7, CAT = 3, ROUND = 420, M1 = 1337, M2 = 1338;
const DRY = process.env.CONFIRM_EXECUTE !== 'yes';

async function diag(a, b) {
  const p1 = Math.min(a, b), p2 = Math.max(a, b);
  const { data } = await supabase.from('oppositions').select('times_opposed,diagonal_count')
    .eq('id_tournament', TOUR).eq('id_category', CAT).eq('id_player1', p1).eq('id_player2', p2).maybeSingle();
  return data || { times_opposed: 0, diagonal_count: 0 };
}

async function main() {
  const { data: dbl } = await supabase.from('doubles').select('*').eq('id_round', ROUND);
  const { data: pl } = await supabase.from('players').select('id_player,name,side')
    .in('id_player', dbl.flatMap(d => [d.id_player1, d.id_player2]));
  const NAME = {}, SIDE = {}; pl.forEach(p => { NAME[p.id_player] = p.name; SIDE[p.id_player] = p.side; });
  const has = (d, re) => re.test(NAME[d.id_player1]) || re.test(NAME[d.id_player2]);
  const find = re => dbl.find(d => has(d, re));
  const dMD = find(/mariele/i);   // Mariele + Daniela
  const dPA = find(/paola/i);     // Paola + Amanda
  const dLN = find(/luana/i);     // Luana + Nara
  const dNS = find(/nicole/i);    // Nicole + Sabrina
  for (const [k,d] of Object.entries({dMD,dPA,dLN,dNS})) if (!d) throw new Error(`dupla ${k} não encontrada`);

  const { data: before } = await supabase.from('matches').select('id_match,id_double_a,id_double_b,scheduled_at').in('id_match',[M1,M2]);
  const dn = d => `${NAME[d.id_player1]}/${NAME[d.id_player2]}`;
  const dById = {}; dbl.forEach(d => dById[d.id_double] = d);
  console.log('=== ANTES ===');
  before.forEach(m => console.log(`  ${m.id_match} @${m.scheduled_at?.substring(11,16)}: ${dn(dById[m.id_double_a])} × ${dn(dById[m.id_double_b])}`));

  // PLANO: 1337 = dMD × dNS (mantém 18:30) ; 1338 = dLN × dPA (mantém 20:30, Nara em dLN)
  const PLAN = [
    { id_match: M1, a: dMD.id_double, b: dNS.id_double },
    { id_match: M2, a: dLN.id_double, b: dPA.id_double },
  ];
  console.log('\n=== DEPOIS (plano) ===');
  for (const p of PLAN) console.log(`  ${p.id_match}: ${dn(dById[p.a])} × ${dn(dById[p.b])}`);
  // confrontos mesma-posição resultantes
  console.log('\n=== confrontos mesma-posição resultantes ===');
  for (const p of PLAN) {
    const a = dById[p.a], b = dById[p.b];
    for (const pa of [a.id_player1,a.id_player2]) for (const pb of [b.id_player1,b.id_player2]) {
      if (SIDE[pa] === SIDE[pb] && SIDE[pa] !== 'EITHER') {
        const o = await diag(pa, pb);
        console.log(`  ${SIDE[pa]}: ${NAME[pa]} × ${NAME[pb]} → era diag=${o.diagonal_count}; vira ${o.diagonal_count+1} ${o.diagonal_count===0?'(INÉDITO até agora)':''}`);
      }
    }
  }

  if (DRY) { console.log('\n[DRY] nada gravado. CONFIRM_EXECUTE=yes pra aplicar.'); return; }

  // 1) re-empareja os matches (duplas inalteradas, horários inalterados)
  for (const p of PLAN) await supabase.from('matches').update({ id_double_a: p.a, id_double_b: p.b }).eq('id_match', p.id_match);

  // 2) reverte contadores do round 420
  for (const tbl of ['partnerships','oppositions']) {
    const { data: rows } = await supabase.from(tbl).select('*').eq('id_tournament',TOUR).eq('id_category',CAT).eq('last_round_id',ROUND);
    for (const r of rows || []) {
      if (tbl === 'partnerships') {
        if (r.times_paired <= 1) await supabase.from(tbl).delete().eq('id_partnership', r.id_partnership);
        else await supabase.from(tbl).update({ times_paired: r.times_paired-1, last_round_id: null }).eq('id_partnership', r.id_partnership);
      } else {
        if (r.times_opposed <= 1) await supabase.from(tbl).delete().eq('id_opposition', r.id_opposition);
        else await supabase.from(tbl).update({ times_opposed: r.times_opposed-1, diagonal_count: Math.max(0,(r.diagonal_count||0)-1), last_round_id: null }).eq('id_opposition', r.id_opposition);
      }
    }
  }
  // 3) re-aplica parcerias (mesmas 4 duplas)
  for (const d of [dMD,dPA,dLN,dNS]) {
    const p1 = Math.min(d.id_player1,d.id_player2), p2 = Math.max(d.id_player1,d.id_player2);
    const { data: ex } = await supabase.from('partnerships').select('id_partnership,times_paired').eq('id_tournament',TOUR).eq('id_category',CAT).eq('id_player1',p1).eq('id_player2',p2).maybeSingle();
    if (ex) await supabase.from('partnerships').update({ times_paired: ex.times_paired+1, last_round_id: ROUND }).eq('id_partnership', ex.id_partnership);
    else await supabase.from('partnerships').insert({ id_tournament:TOUR, id_category:CAT, id_player1:p1, id_player2:p2, times_paired:1, last_round_id:ROUND });
  }
  // 4) re-aplica oposições (novos pareamentos)
  for (const p of PLAN) {
    const a = dById[p.a], b = dById[p.b];
    for (const pa of [a.id_player1,a.id_player2]) for (const pb of [b.id_player1,b.id_player2]) {
      const p1 = Math.min(pa,pb), p2 = Math.max(pa,pb);
      const isDiag = SIDE[pa] && SIDE[pa] === SIDE[pb] && SIDE[pa] !== 'EITHER';
      const { data: ex } = await supabase.from('oppositions').select('id_opposition,times_opposed,diagonal_count').eq('id_tournament',TOUR).eq('id_category',CAT).eq('id_player1',p1).eq('id_player2',p2).maybeSingle();
      if (ex) await supabase.from('oppositions').update({ times_opposed: ex.times_opposed+1, diagonal_count: ex.diagonal_count+(isDiag?1:0), last_round_id: ROUND }).eq('id_opposition', ex.id_opposition);
      else await supabase.from('oppositions').insert({ id_tournament:TOUR, id_category:CAT, id_player1:p1, id_player2:p2, times_opposed:1, diagonal_count:isDiag?1:0, last_round_id:ROUND });
    }
  }

  const { data: after } = await supabase.from('matches').select('id_match,id_double_a,id_double_b,scheduled_at').in('id_match',[M1,M2]);
  console.log('\n=== GRAVADO ===');
  after.forEach(m => console.log(`  ${m.id_match} @${m.scheduled_at?.substring(11,16)}: ${dn(dById[m.id_double_a])} × ${dn(dById[m.id_double_b])}`));
  console.log('  ✅ aplicado.');
}
main().catch(e => { console.error(e); process.exit(1); });
