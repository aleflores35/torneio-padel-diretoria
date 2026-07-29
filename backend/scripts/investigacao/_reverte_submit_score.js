// Reverte um match para "sem placar" (TO_PLAY 0x0, campos de submissao nulos).
// Uso: MATCH=1409 CONFIRM_EXECUTE=yes node _reverte_submit_score.js
// Criado p/ desfazer o teste end-to-end da pagina placares-pendentes.html (29/07).
// Guarda: só reverte se o placar tiver vindo do fluxo do ATLETA (player_score_submitted_by preenchido)
// — evita apagar placar lancado por admin sem rastro. Use FORCE=yes p/ ignorar essa guarda.
const supabase = require('../../supabase');
const MATCH = parseInt(process.env.MATCH || '0', 10);
const CONFIRM = process.env.CONFIRM_EXECUTE === 'yes';
const FORCE = process.env.FORCE === 'yes';

(async () => {
  if (!MATCH) { console.error('use MATCH=<id>'); process.exit(1); }
  const { data: m } = await supabase.from('matches')
    .select('id_match,status,games_double_a,games_double_b,player_score_a,player_score_b,player_score_submitted_by,player_score_submitted_at,absent_player_ids')
    .eq('id_match', MATCH).single();
  if (!m) { console.error('ABORT: match nao existe'); process.exit(1); }
  console.log('ANTES:', JSON.stringify(m));
  if ((m.absent_player_ids || []).length) { console.error('ABORT: match tem ausencia registrada — nao mexer'); process.exit(1); }
  if (!m.player_score_submitted_by && !FORCE) { console.error('ABORT: placar nao veio do fluxo do atleta (use FORCE=yes se for mesmo isso)'); process.exit(1); }
  if (!CONFIRM) { console.log('>>> DRY: gravaria TO_PLAY 0x0 + player_score_* = null <<<'); process.exit(0); }

  const r = await supabase.from('matches').update({
    status: 'TO_PLAY', games_double_a: 0, games_double_b: 0,
    player_score_a: null, player_score_b: null,
    player_score_submitted_by: null, player_score_submitted_at: null,
  }).eq('id_match', MATCH);
  if (r.error) { console.error('ERRO', r.error.message); process.exit(1); }
  const { data: a } = await supabase.from('matches')
    .select('status,games_double_a,games_double_b,player_score_a,player_score_submitted_by').eq('id_match', MATCH).single();
  const ok = a.status === 'TO_PLAY' && a.games_double_a === 0 && a.games_double_b === 0 && a.player_score_a === null && a.player_score_submitted_by === null;
  console.log('DEPOIS:', JSON.stringify(a), '| assert', ok ? 'OK' : 'FALHOU');
  process.exit(ok ? 0 : 1);
})();
