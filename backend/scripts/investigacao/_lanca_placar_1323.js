// Lanca placar do #1323 (18/06 Fem, atrasado): Mariele/Nara 9 x 2 Maria Luisa/Daniela.
// double_a = Mariele/Nara = 9 ; double_b = Maria Luisa/Daniela = 2. Sem ausencia -> placar normal.
// DRY default; CONFIRM_EXECUTE=yes grava.
const supabase = require('../../supabase');
const CONFIRM = process.env.CONFIRM_EXECUTE === 'yes';
const MATCH = 1323, GA = 9, GB = 2;
(async () => {
  const { data: m } = await supabase.from('matches').select('id_match,status,games_double_a,games_double_b,absent_player_ids').eq('id_match', MATCH).single();
  console.log('ANTES:', m.status, m.games_double_a, 'x', m.games_double_b, '| absent', m.absent_player_ids);
  if (GA === GB || GA < 0 || GB < 0 || GA > 9 || GB > 9) { console.error('placar invalido'); process.exit(1); }
  if (Array.isArray(m.absent_player_ids) && m.absent_player_ids.length) { console.error('ATENCAO: jogo tem ausencia — abortando (nao era esperado)'); process.exit(1); }
  if (!CONFIRM) { console.log('>>> DRY: gravaria FINISHED', GA, 'x', GB, '(Mariele/Nara vence) <<<'); process.exit(0); }
  const r = await supabase.from('matches').update({ status: 'FINISHED', games_double_a: GA, games_double_b: GB }).eq('id_match', MATCH);
  if (r.error) { console.error('ERRO', r.error.message); process.exit(1); }
  console.log('>>> GRAVADO: #1323 FINISHED', GA, 'x', GB, '<<<');
  process.exit(0);
})();
