// #1416 (23/07 19:50 q16, Masc Inic, round 441): GUILHERME SANTOS (662) NAO COMPARECEU.
// Vitoria por WO da dupla B (Elder Rossi 655 / Nicolas Garcia 671) sobre a dupla A (Hilton 651 / Guilherme 662).
// Shape identico ao precedente #1391 (mesmo caso, mesmo atleta, 02/07): status FINISHED + games 9x0 no lado vencedor
// + absent_player_ids=[662]. O rankingService aplica a regra unificada:
//   Guilherme (faltou) -> 0 pts, wos++   |   Hilton (parceiro faltou, ele compareceu) -> +1
//   Elder + Nicolas (adversario com falta) -> +3 cada (win++). Games do WO NAO entram no saldo.
// DRY default; CONFIRM_EXECUTE=yes grava.
const supabase = require('../../supabase');
const ranking = require('../../services/rankingService');
const CONFIRM = process.env.CONFIRM_EXECUTE === 'yes';
const TID = 7, CAT = 1;
const MATCH = 1416, DBL_A = 3114, DBL_B = 3115;
const AUSENTE = 662;                       // Guilherme Santos
const GA = 0, GB = 9;                      // B (Elder/Nicolas) vence por WO
const ALVO = [651, 662, 655, 671];         // Hilton, Guilherme, Elder, Nicolas

const snap = async () => {
  const st = await ranking.getStandings(TID, CAT);
  const pos = {}; st.forEach((p, i) => pos[p.id_player] = { pos: i + 1, ...p });
  return pos;
};
const linha = (p) => p ? `${String(p.pos).padStart(2)}º ${p.name.padEnd(22)} ${String(p.points).padStart(2)} pts | ${p.wins}V ${p.losses}D ${p.wos}WO | ${p.matches_played} jogos` : '(fora do ranking)';

(async () => {
  const { data: m } = await supabase.from('matches')
    .select('id_match,status,id_double_a,id_double_b,games_double_a,games_double_b,absent_player_ids,scheduled_at')
    .eq('id_match', MATCH).single();
  if (!m) { console.error('ABORT: match nao existe'); process.exit(1); }
  console.log(`ANTES: #${MATCH} ${m.scheduled_at} | ${m.status} | ${m.games_double_a}x${m.games_double_b} | A=${m.id_double_a} B=${m.id_double_b} | absent ${JSON.stringify(m.absent_player_ids)}`);

  // guardas
  if (m.id_double_a !== DBL_A || m.id_double_b !== DBL_B) { console.error(`ABORT: orientacao A/B mudou (esperado A=${DBL_A} Hilton/Guilherme, B=${DBL_B} Elder/Nicolas)`); process.exit(1); }
  if (!['TO_PLAY', 'CALLING', 'IN_PROGRESS'].includes(m.status)) { console.error(`ABORT: status ${m.status} — jogo ja lancado`); process.exit(1); }
  if (Array.isArray(m.absent_player_ids) && m.absent_player_ids.length) { console.error(`ABORT: ja tem ausencia registrada ${JSON.stringify(m.absent_player_ids)}`); process.exit(1); }
  const { data: dA } = await supabase.from('doubles').select('id_player1,id_player2').eq('id_double', DBL_A).single();
  if (![dA.id_player1, dA.id_player2].includes(AUSENTE)) { console.error('ABORT: ausente nao esta na dupla A'); process.exit(1); }

  const antes = await snap();
  console.log('\n--- RANKING ANTES (Masc Inic) ---');
  ALVO.forEach(id => console.log('  ' + linha(antes[id])));

  if (!CONFIRM) {
    console.log(`\n>>> DRY: gravaria #${MATCH} status=FINISHED games ${GA}x${GB} absent_player_ids=[${AUSENTE}] <<<`);
    console.log('    efeito esperado: Guilherme 0 (wos+1) · Hilton +1 · Elder +3 (V) · Nicolas +3 (V)');
    process.exit(0);
  }

  const r = await supabase.from('matches')
    .update({ status: 'FINISHED', games_double_a: GA, games_double_b: GB, absent_player_ids: [AUSENTE] })
    .eq('id_match', MATCH);
  if (r.error) { console.error('ERRO', r.error.message); process.exit(1); }

  // asserts de re-leitura
  const { data: after } = await supabase.from('matches').select('status,games_double_a,games_double_b,absent_player_ids').eq('id_match', MATCH).single();
  const ok = after.status === 'FINISHED' && after.games_double_a === GA && after.games_double_b === GB
    && Array.isArray(after.absent_player_ids) && after.absent_player_ids.length === 1 && after.absent_player_ids[0] === AUSENTE;
  console.log(`\n>>> GRAVADO: #${MATCH} ${after.status} ${after.games_double_a}x${after.games_double_b} absent ${JSON.stringify(after.absent_player_ids)} — assert ${ok ? 'OK' : 'FALHOU'} <<<`);
  if (!ok) process.exit(1);

  const dep = await snap();
  console.log('\n--- RANKING DEPOIS (Masc Inic) ---');
  ALVO.forEach(id => {
    const a = antes[id], d = dep[id];
    const delta = d.points - a.points;
    console.log(`  ${linha(d)}   [${delta >= 0 ? '+' : ''}${delta} pt | ${a.pos}º -> ${d.pos}º]`);
  });
  process.exit(0);
})();
