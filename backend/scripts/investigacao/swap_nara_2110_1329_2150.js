// Remaneja 18/06: Nara (match 1323) vai pras 21:10 (acompanhada do 1328 na outra quadra)
// e o jogo 1329 (William/Gustavo × Douglas/Cicero) desce pras 21:50. Ambos na Quadra de Parede (17).
// Motivo: Nara só joga após 20:30; 21:10 a deixa acompanhada em vez de sozinha às 21:50.
// Rodar DRY:  node scripts/investigacao/swap_nara_2110_1329_2150.js
// Rodar real: CONFIRM_EXECUTE=yes node scripts/investigacao/swap_nara_2110_1329_2150.js
const supabase = require('../../supabase');

const NARA = 1323, OTHER = 1329;
const T_2110 = '2026-06-18T21:10:00+00:00';
const T_2150 = '2026-06-18T21:50:00+00:00';

async function show(label) {
  const { data } = await supabase.from('matches')
    .select('id_match, id_court, scheduled_at, status').in('id_match', [NARA, OTHER]);
  console.log(label, JSON.stringify(data));
}

async function main() {
  await show('ANTES :');
  if (process.env.CONFIRM_EXECUTE !== 'yes') {
    console.log(`\n[DRY] match ${NARA} (Nara) -> ${T_2110} ; match ${OTHER} -> ${T_2150}`);
    return;
  }
  // sem unique constraint em (court, scheduled_at); aplica os dois e valida no fim
  let { error } = await supabase.from('matches').update({ scheduled_at: T_2110 }).eq('id_match', NARA);
  if (error) throw error;
  ({ error } = await supabase.from('matches').update({ scheduled_at: T_2150 }).eq('id_match', OTHER));
  if (error) throw error;
  await show('DEPOIS:');

  // validação: nenhum slot da noite com 2 jogos na mesma quadra/horário
  const { data: rounds } = await supabase.from('rounds').select('id_round').eq('scheduled_date', '2026-06-18');
  const { data: dbls } = await supabase.from('doubles').select('id_double').in('id_round', rounds.map(r => r.id_round));
  const dblIds = dbls.map(d => d.id_double);
  const orMatch = dblIds.map(id => `id_double_a.eq.${id}`).concat(dblIds.map(id => `id_double_b.eq.${id}`)).join(',');
  const { data: all } = await supabase.from('matches').select('id_match, id_court, scheduled_at').or(orMatch);
  const seen = {}; let dup = false;
  for (const m of all) { const k = `${m.id_court}|${m.scheduled_at}`; if (seen[k]) { console.log('⚠️ COLISÃO', k, seen[k], m.id_match); dup = true; } seen[k] = m.id_match; }
  console.log(dup ? '⚠️ HÁ COLISÃO — revisar!' : '✅ Sem colisões. Nara 21:10 (acompanhada), 1329 21:50.');
}
main().catch(e => { console.error(e); process.exit(1); });
