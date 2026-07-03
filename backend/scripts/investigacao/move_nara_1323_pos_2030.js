// Move o jogo da Nara (match 1323, rodada 417 feminina, 18/06) de 18:30 -> 21:50.
// Motivo: Nara só pode jogar após 20:30 (pedido WhatsApp). 21:50 é o único slot
// após 20:30 com as duas quadras livres na noite de 18/06 (20:30 e 21:10 estão
// ocupados por jogos da cat 1). Mantém a Quadra de Parede (id_court 17).
// Rodar DRY:  node scripts/investigacao/move_nara_1323_pos_2030.js
// Rodar real: CONFIRM_EXECUTE=yes node scripts/investigacao/move_nara_1323_pos_2030.js
const supabase = require('../../supabase');

const MATCH_ID = 1323;
const NEW_AT = '2026-06-18T21:50:00+00:00';

async function main() {
  const { data: before, error: e1 } = await supabase.from('matches')
    .select('id_match, id_double_a, id_double_b, id_court, scheduled_at, status').eq('id_match', MATCH_ID).single();
  if (e1) throw e1;
  console.log('ANTES :', JSON.stringify(before));

  // checagem de colisão: nenhum outro match na mesma quadra/horário em 18/06
  const { data: collide } = await supabase.from('matches')
    .select('id_match, id_court, scheduled_at, status')
    .eq('id_court', before.id_court).eq('scheduled_at', NEW_AT).neq('id_match', MATCH_ID);
  console.log('Colisões no slot alvo (quadra', before.id_court, '@', NEW_AT, '):', (collide || []).length, JSON.stringify(collide || []));
  if ((collide || []).length) { console.log('⚠️ ABORTA: slot ocupado.'); return; }

  if (process.env.CONFIRM_EXECUTE !== 'yes') {
    console.log('\n[DRY] Faria: UPDATE matches SET scheduled_at =', NEW_AT, 'WHERE id_match =', MATCH_ID);
    console.log('Para executar: CONFIRM_EXECUTE=yes node scripts/investigacao/move_nara_1323_pos_2030.js');
    return;
  }

  const { error: e2 } = await supabase.from('matches').update({ scheduled_at: NEW_AT }).eq('id_match', MATCH_ID);
  if (e2) throw e2;
  const { data: after } = await supabase.from('matches')
    .select('id_match, id_court, scheduled_at, status').eq('id_match', MATCH_ID).single();
  console.log('DEPOIS:', JSON.stringify(after));
  console.log('✅ Jogo da Nara movido para 21:50 (Quadra de Parede).');
}
main().catch(e => { console.error(e); process.exit(1); });
