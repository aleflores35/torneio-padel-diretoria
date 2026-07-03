// Masc 4ª (round 419, 25/06) está saturada: nenhum jogo de ranking sem repetir.
// Decisão Alessandro (22/06): 0 ranking + amistoso. Em vez de esvaziar, CONVERTE o
// round inteiro em EXHIBITION — os 2 jogos já montados viram amistosos (todos os 8
// jogam, inclusive Helio), e como amistoso não conta, a repetição deixa de importar.
// Reverte os contadores (partnerships/oppositions) que o sorteio original carimbou
// (last_round_id=419), pois amistoso não pontua histórico.
// DRY:  node scripts/investigacao/converte_masc4a_419_exhibition.js
// REAL: CONFIRM_EXECUTE=yes node scripts/investigacao/converte_masc4a_419_exhibition.js
const supabase = require('../../supabase');
const T = 7, CAT = 2, ROUND = 419;
const DRY = process.env.CONFIRM_EXECUTE !== 'yes';

async function main() {
  const { data: round } = await supabase.from('rounds').select('*').eq('id_round', ROUND).single();
  console.log(`round ${ROUND} · type atual=${round.round_type} · ${DRY ? 'DRY-RUN' : 'EXECUTANDO'}`);
  const { data: parts } = await supabase.from('partnerships').select('id_partnership').eq('id_tournament', T).eq('id_category', CAT).eq('last_round_id', ROUND);
  const { data: opps } = await supabase.from('oppositions').select('id_opposition').eq('id_tournament', T).eq('id_category', CAT).eq('last_round_id', ROUND);
  console.log(`a reverter: ${(parts||[]).length} parcerias + ${(opps||[]).length} oposições carimbadas no round`);
  console.log('→ round_type vira EXHIBITION; os 2 jogos viram amistosos (não contam).');

  if (DRY) { console.log('\n[DRY] nada gravado.'); return; }

  // reverte contadores do round (amistoso não conta)
  for (const tbl of ['partnerships', 'oppositions']) {
    const { data: rows } = await supabase.from(tbl).select('*').eq('id_tournament', T).eq('id_category', CAT).eq('last_round_id', ROUND);
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
  await supabase.from('rounds').update({ round_type: 'EXHIBITION' }).eq('id_round', ROUND);
  console.log('✅ round 419 convertido em EXHIBITION (amistoso) + contadores revertidos.');
}
main().catch(e => { console.error(e); process.exit(1); });
