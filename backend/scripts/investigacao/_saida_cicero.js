// SAÍDA Cicero Kommers (661), Masc Iniciante — mudou de cidade, sai do torneio.
// Régua desistência ≥50% (jogou 8/12 = 67%) + correção W40 (08/07): NÃO virar exhibition.
//   (1) FUTUROS -> DELETE match + suas 2 duplas (some da grade). NÃO toca nos jogados (seguem REGULAR).
//   (2) Cicero active=false (some do ranking; jogos jogados seguem pontuando os terceiros).
//   NÃO reverte partnerships/oppositions (deferido — motor de sorteio dormente; ver LOG).
// DRY:  node scripts/investigacao/_saida_cicero.js
// REAL: CONFIRM_EXECUTE=yes node scripts/investigacao/_saida_cicero.js
const supabase = require('../../supabase');
const T = 7;
const DRY = process.env.CONFIRM_EXECUTE !== 'yes';

const CICERO = 661;
const DEL_FUTURE = [1446, 1423, 1430, 1439]; // 4 futuros do Cicero

(async () => {
  if (!supabase) { console.error('SEM supabase'); process.exit(1); }
  console.log(DRY ? '*** DRY-RUN (nada gravado) ***\n' : '*** EXECUTANDO (CONFIRM) ***\n');

  const { data: rounds } = await supabase.from('rounds').select('*').eq('id_tournament', T);
  const rd = {}; rounds.forEach(r => rd[r.id_round] = r);
  const { data: allDbls } = await supabase.from('doubles').select('*').eq('id_tournament', T);
  const dm = {}; allDbls.forEach(d => dm[d.id_double] = d);
  const { data: ms } = await supabase.from('matches').select('*').in('id_match', DEL_FUTURE);
  const mById = {}; ms.forEach(m => mById[m.id_match] = m);

  // guarda: confirmar que Cicero está nos 4 e que são todos futuros
  console.log('=== (1) FUTUROS DO CICERO → DELETE ===');
  let erros = 0;
  for (const mid of DEL_FUTURE) {
    const m = mById[mid];
    if (!m) { console.log(`  #${mid} NAO ENCONTRADO`); erros++; continue; }
    const a = dm[m.id_double_a], b = dm[m.id_double_b];
    const players = [a.id_player1, a.id_player2, b.id_player1, b.id_player2];
    const r = rd[a.id_round];
    const temCicero = players.includes(CICERO);
    const ehFuturo = ['TO_PLAY', 'CALLING', 'IN_PROGRESS'].includes(m.status);
    if (!temCicero) { console.log(`  #${mid} ⚠ NAO tem Cicero — ABORTA`); erros++; continue; }
    if (!ehFuturo) { console.log(`  #${mid} ⚠ status ${m.status} (nao futuro) — ABORTA`); erros++; continue; }
    console.log(`  #${mid} ${r.scheduled_date} ${String(m.scheduled_at).slice(11,16)} q${m.id_court} | ${a.display_name} × ${b.display_name} [${m.status}] -> DELETE match + duplas ${m.id_double_a},${m.id_double_b}`);
    if (!DRY && !erros) {
      const e1 = await supabase.from('matches').delete().eq('id_match', mid);
      const e2 = await supabase.from('doubles').delete().eq('id_double', m.id_double_a);
      const e3 = await supabase.from('doubles').delete().eq('id_double', m.id_double_b);
      if (e1.error || e2.error || e3.error) console.log(`    [ERRO] ${e1.error?.message||''} ${e2.error?.message||''} ${e3.error?.message||''}`);
    }
  }

  if (erros) { console.log(`\n⛔ ${erros} problema(s) — nada gravado. Corrija antes.`); process.exit(1); }

  console.log('\n=== (2) INATIVAR CICERO ===');
  console.log(`  player ${CICERO} -> active=false`);
  if (!DRY) {
    const { error } = await supabase.from('players').update({ active: false }).eq('id_player', CICERO);
    if (error) console.log(`    [ERRO] ${error.message}`);
  }

  console.log(DRY
    ? `\n[DRY] pronto. ${DEL_FUTURE.length} futuros→delete, Cicero(661)→inativar. Rode c/ CONFIRM_EXECUTE=yes.`
    : `\n✅ EXECUTADO. ${DEL_FUTURE.length} futuros deletados, Cicero(661) inativado. Jogados intactos (REGULAR).`);
  process.exit(0);
})();
