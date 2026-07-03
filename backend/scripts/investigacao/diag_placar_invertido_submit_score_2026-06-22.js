// READ-ONLY · 22/06/2026 · Mede impacto do bug do placar invertido no app do atleta.
// Causa raiz: POST /api/matches/:id/submit-score grava score_a→games_double_a direto,
// sem reorientar pela dupla do jogador. O AtletaPage envia orientado ao jogador
// ("Sua dupla"=score_a). Logo, quando o SUBMITTER pertence à dupla B do match, o
// placar entra invertido (vitória vira derrota no ranking).
// Heurística de detecção de jogo corrompido:
//   - status FINISHED, player_score_submitted_by != null
//   - submitter ∈ id_double_b  (estava na dupla B)
//   - games_double_* == player_score_*  (último write foi o submit do atleta, sem
//     override posterior do admin que pudesse já ter corrigido)
// Uso: node scripts/investigacao/diag_placar_invertido_submit_score_2026-06-22.js
const supabase = require('../../supabase');
const ID_TOURNAMENT = 7;

async function run() {
  const { data: matches } = await supabase
    .from('matches')
    .select('id_match, id_double_a, id_double_b, games_double_a, games_double_b, status, player_score_a, player_score_b, player_score_submitted_by, player_score_submitted_at, scheduled_at')
    .eq('id_tournament', ID_TOURNAMENT)
    .not('player_score_submitted_by', 'is', null);

  if (!matches || !matches.length) { console.log('Nenhum match com player_score_submitted_by.'); return; }

  const doubleIds = [...new Set(matches.flatMap(m => [m.id_double_a, m.id_double_b]).filter(Boolean))];
  const { data: doubles } = await supabase
    .from('doubles').select('id_double, id_player1, id_player2, display_name, id_round').in('id_double', doubleIds);
  const dMap = {}; (doubles || []).forEach(d => { dMap[d.id_double] = d; });

  const roundIds = [...new Set((doubles || []).map(d => d.id_round).filter(Boolean))];
  const { data: rounds } = await supabase.from('rounds').select('id_round, id_category, scheduled_date, round_type').in('id_round', roundIds);
  const rMap = {}; (rounds || []).forEach(r => { rMap[r.id_round] = r; });

  const playerIds = [...new Set(matches.map(m => m.player_score_submitted_by).filter(Boolean))];
  const { data: players } = await supabase.from('players').select('id_player, name').in('id_player', playerIds);
  const pMap = {}; (players || []).forEach(p => { pMap[p.id_player] = p.name; });

  let total = 0, inverted = 0, adminOverrode = 0;
  const rows = [];
  for (const m of matches) {
    if (m.status !== 'FINISHED') continue;
    total++;
    const dB = dMap[m.id_double_b];
    const submitter = m.player_score_submitted_by;
    const submitterInB = dB && (dB.id_player1 === submitter || dB.id_player2 === submitter);
    const matchesPlayerScore = m.games_double_a === m.player_score_a && m.games_double_b === m.player_score_b;
    if (!matchesPlayerScore) { adminOverrode++; continue; } // admin regravou diferente → não confiar na heurística
    if (submitterInB) {
      inverted++;
      const da = dMap[m.id_double_a], rd = rMap[(dMap[m.id_double_a]||{}).id_round] || {};
      rows.push({
        id_match: m.id_match,
        cat: rd.id_category, date: rd.scheduled_date, type: rd.round_type,
        submitter: pMap[submitter] || submitter,
        A: da?.display_name, B: dB?.display_name,
        atual: `${m.games_double_a}×${m.games_double_b}`,
        correto: `${m.games_double_b}×${m.games_double_a}`,
      });
    }
  }

  console.log(`\n== IMPACTO bug placar invertido (tournament ${ID_TOURNAMENT}) ==`);
  console.log(`Matches FINISHED com placar enviado por atleta: ${total}`);
  console.log(`  · admin regravou depois (heurística não se aplica): ${adminOverrode}`);
  console.log(`  · 🔴 INVERTIDOS (submitter na dupla B, sem override): ${inverted}\n`);
  rows.sort((a,b) => (a.date||'').localeCompare(b.date||'') || a.id_match-b.id_match);
  for (const r of rows) {
    console.log(`  match ${r.id_match} · ${r.date} · cat ${r.cat} · ${r.type}`);
    console.log(`     A: ${r.A}`);
    console.log(`     B: ${r.B}   ← enviou: ${r.submitter}`);
    console.log(`     placar GRAVADO ${r.atual}  →  CORRETO ${r.correto}`);
  }
  console.log('\n(heurística — admin pode ter validado alguns manualmente; revisar antes de corrigir)');
}
run().catch(e => { console.error(e); process.exit(1); });
