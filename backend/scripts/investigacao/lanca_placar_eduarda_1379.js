// Lança o placar do match 1379 (round 420, 25/06, Fem. Iniciante) reportado pela
// Eduarda no WhatsApp: Eduarda/Paola 9 x Sabrina/Nicole 7.
// Orientado ao MATCH (como o admin grava via POST /api/matches/:id/status):
//   games_double_a = dupla A (Nicole/Sabrina) = 7
//   games_double_b = dupla B (Paola/Eduarda)  = 9
//   status = FINISHED
// DRY-RUN por padrão. Para gravar: CONFIRM_EXECUTE=yes
const supabase = require('../../supabase');

const MATCH_ID = 1379;
const SCORE_A = 7; // dupla A — Nicole Facchini / Sabrina Schutz
const SCORE_B = 9; // dupla B — Paola Brendler / Eduarda Lemos
const EXECUTE = process.env.CONFIRM_EXECUTE === 'yes';

async function nameOf(idDouble) {
  const { data } = await supabase.from('doubles').select('display_name').eq('id_double', idDouble).maybeSingle();
  return data?.display_name || `double ${idDouble}`;
}

async function main() {
  if (!supabase) { console.error('Supabase NÃO configurado.'); process.exit(1); }

  const { data: m, error } = await supabase.from('matches')
    .select('id_match,id_double_a,id_double_b,status,games_double_a,games_double_b,scheduled_at')
    .eq('id_match', MATCH_ID).maybeSingle();
  if (error || !m) { console.error('Match não encontrado:', error); process.exit(1); }

  const nameA = await nameOf(m.id_double_a);
  const nameB = await nameOf(m.id_double_b);
  console.log(`Match ${MATCH_ID} | ${m.scheduled_at} | status atual: ${m.status}`);
  console.log(`  Dupla A: ${nameA}  (games atuais: ${m.games_double_a ?? '-'})`);
  console.log(`  Dupla B: ${nameB}  (games atuais: ${m.games_double_b ?? '-'})`);

  // SANITY CHECK: confirma que é o confronto certo antes de gravar
  const aOk = /nicole/i.test(nameA) && /sabrina/i.test(nameA);
  const bOk = /paola/i.test(nameB) && /eduarda/i.test(nameB);
  if (!aOk || !bOk) {
    console.error('\n❌ ABORTADO: nomes das duplas não batem com o confronto esperado (Nicole/Sabrina x Paola/Eduarda).');
    console.error('   Verifique manualmente antes de gravar.');
    process.exit(1);
  }

  console.log(`\nVai gravar => games_double_a=${SCORE_A} (${nameA}) | games_double_b=${SCORE_B} (${nameB}) | status=FINISHED`);
  console.log(`Resultado: ${nameB} VENCE por ${SCORE_B} x ${SCORE_A}.`);

  if (!EXECUTE) {
    console.log('\n[DRY-RUN] Nada gravado. Rode com CONFIRM_EXECUTE=yes para aplicar.');
    return;
  }

  const { error: upErr } = await supabase.from('matches')
    .update({ games_double_a: SCORE_A, games_double_b: SCORE_B, status: 'FINISHED' })
    .eq('id_match', MATCH_ID);
  if (upErr) { console.error('Erro ao gravar:', upErr); process.exit(1); }

  const { data: after } = await supabase.from('matches')
    .select('id_match,status,games_double_a,games_double_b').eq('id_match', MATCH_ID).maybeSingle();
  console.log('\n✅ GRAVADO. Estado final:', JSON.stringify(after));
}
main().catch(e => { console.error(e); process.exit(1); });
