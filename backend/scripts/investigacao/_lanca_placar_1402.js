// Lanca placar do #1402 (Fem Iniciante, round 436, jogado adiantado): Nicole/Nara 9 x 3 Maria Luísa/Catiane.
// id_double_a = Maria Luísa/Catiane = 3 ; id_double_b = Nicole/Nara = 9. Sem ausencia -> placar normal.
// Atleta nao conseguiu lancar (jogo datado 16/07 = futuro, janela do atleta fechada). Admin lanca.
// DRY default; CONFIRM_EXECUTE=yes grava.
const supabase = require('../../supabase');
const CONFIRM = process.env.CONFIRM_EXECUTE === 'yes';
const MATCH = 1402, GA = 3, GB = 9; // A=ML/Catiane, B=Nicole/Nara
(async () => {
  const { data: m } = await supabase.from('matches').select('id_match,status,id_double_a,id_double_b,games_double_a,games_double_b,absent_player_ids').eq('id_match', MATCH).single();
  console.log('ANTES:', m.status, m.games_double_a, 'x', m.games_double_b, '| A=', m.id_double_a, 'B=', m.id_double_b, '| absent', JSON.stringify(m.absent_player_ids));
  if (m.id_double_a !== 3086 || m.id_double_b !== 3087) { console.error('ABORT: orientacao A/B mudou (esperado A=3086 ML/Catiane, B=3087 Nicole/Nara)'); process.exit(1); }
  if (GA === GB || GA < 0 || GB < 0 || GA > 9 || GB > 9) { console.error('placar invalido'); process.exit(1); }
  if (Array.isArray(m.absent_player_ids) && m.absent_player_ids.length) { console.error('ATENCAO: jogo tem ausencia — abortando'); process.exit(1); }
  if (!CONFIRM) { console.log('>>> DRY: gravaria FINISHED A=3 x B=9 (Nicole/Nara vence) <<<'); process.exit(0); }
  const r = await supabase.from('matches').update({ status: 'FINISHED', games_double_a: GA, games_double_b: GB }).eq('id_match', MATCH);
  if (r.error) { console.error('ERRO', r.error.message); process.exit(1); }
  const { data: after } = await supabase.from('matches').select('status,games_double_a,games_double_b').eq('id_match', MATCH).single();
  console.log('>>> GRAVADO: #1402', after.status, after.games_double_a, 'x', after.games_double_b, '(Nicole/Nara 9 x 3 Maria Luísa/Catiane) <<<');
  process.exit(0);
})();
