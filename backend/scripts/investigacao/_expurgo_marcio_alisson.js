// EXPURGO régua desistência <50% — Marcio Ferreira (657) + Alisson Boyink (670), Masc Iniciante.
// Ratificado pela diretoria (07/07). Régua: [[feedback_srb_regua_padrao_desistencia_meio_temporada]].
//  (1) JOGADOS -> EXHIBITION: move as 2 duplas do jogo p/ uma rodada-espelho EXHIBITION da MESMA data
//      (rankingService exclui matches de round EXHIBITION → param de pontuar; scheduled_at preserva a data).
//  (2) FUTUROS (só Alisson) -> DELETE match + suas 2 duplas (some da grade).
//  (3) Alisson active=false (Marcio já é false).
//  NÃO reverte partnerships/oppositions (deferido — motor de sorteio dormente; ver LOG).
// DRY:  node scripts/investigacao/_expurgo_marcio_alisson.js
// REAL: CONFIRM_EXECUTE=yes node scripts/investigacao/_expurgo_marcio_alisson.js
const supabase = require('../../supabase');
const T = 7, CAT = 1;
const DRY = process.env.CONFIRM_EXECUTE !== 'yes';

const EXH_PLAYED = [1235,1261,1287, 1260,1264,1285,1296,1311,1325]; // 3 Marcio + 6 Alisson
const DEL_FUTURE  = [1399,1407,1390,1422,1432,1443,1448];            // 7 Alisson
const INACTIVATE  = [670];

(async () => {
  if (!supabase) { console.error('SEM supabase'); process.exit(1); }
  console.log(DRY ? '*** DRY-RUN (nada gravado) ***\n' : '*** EXECUTANDO (CONFIRM) ***\n');

  const { data: rounds } = await supabase.from('rounds').select('*').eq('id_tournament', T);
  const rd = {}; rounds.forEach(r => rd[r.id_round]=r);
  const { data: allDbls } = await supabase.from('doubles').select('*').eq('id_tournament', T);
  const dm = {}; allDbls.forEach(d => dm[d.id_double]=d);
  const ids = [...EXH_PLAYED, ...DEL_FUTURE];
  const { data: ms } = await supabase.from('matches').select('*').in('id_match', ids);
  const mById = {}; ms.forEach(m => mById[m.id_match]=m);

  // ---------- (1) EXHIBITION ----------
  console.log('=== (1) JOGADOS → EXHIBITION ===');
  const mirrorByOrig = {}; // id_round original -> id_round exhibition (novo)
  for (const mid of EXH_PLAYED) {
    const m = mById[mid]; if (!m) { console.log(`  #${mid} NAO ENCONTRADO`); continue; }
    const origRoundId = dm[m.id_double_a].id_round;
    const orig = rd[origRoundId];
    let mirrorId = mirrorByOrig[origRoundId];
    if (!mirrorId) {
      const payload = {
        id_tournament: T, id_category: CAT, round_number: 900 + Object.keys(mirrorByOrig).length,
        scheduled_date: orig.scheduled_date, window_start: orig.window_start, window_end: orig.window_end,
        status: 'FINISHED', round_type: 'EXHIBITION',
        notes: 'Expurgo desistência <50% (Marcio 657 + Alisson 670) — ratificado diretoria 07/07',
      };
      if (DRY) { mirrorId = `NEW(orig ${origRoundId}, ${orig.scheduled_date})`; }
      else {
        const { data: ins, error } = await supabase.from('rounds').insert(payload).select().single();
        if (error) { console.log(`  [ERRO criar round exhibition] ${error.message}`); continue; }
        mirrorId = ins.id_round;
      }
      mirrorByOrig[origRoundId] = mirrorId;
      console.log(`  + rodada EXHIBITION criada p/ data ${orig.scheduled_date} (orig r${origRoundId}) -> ${mirrorId}`);
    }
    console.log(`  #${mid} ${orig.scheduled_date} | ${dm[m.id_double_a].display_name} × ${dm[m.id_double_b].display_name}  ->  duplas ${m.id_double_a}+${m.id_double_b} p/ round ${mirrorId}`);
    if (!DRY) {
      await supabase.from('doubles').update({ id_round: mirrorId }).eq('id_double', m.id_double_a);
      await supabase.from('doubles').update({ id_round: mirrorId }).eq('id_double', m.id_double_b);
    }
  }

  // ---------- (2) DELETE FUTUROS ----------
  console.log('\n=== (2) FUTUROS (Alisson) → DELETE ===');
  for (const mid of DEL_FUTURE) {
    const m = mById[mid]; if (!m) { console.log(`  #${mid} NAO ENCONTRADO`); continue; }
    const r = rd[dm[m.id_double_a].id_round];
    console.log(`  #${mid} ${r.scheduled_date} ${String(m.scheduled_at).slice(11,16)} | ${dm[m.id_double_a].display_name} × ${dm[m.id_double_b].display_name}  ->  DELETE match + duplas ${m.id_double_a},${m.id_double_b}`);
    if (!DRY) {
      await supabase.from('matches').delete().eq('id_match', mid);
      await supabase.from('doubles').delete().eq('id_double', m.id_double_a);
      await supabase.from('doubles').delete().eq('id_double', m.id_double_b);
    }
  }

  // ---------- (3) INATIVAR ----------
  console.log('\n=== (3) INATIVAR ===');
  for (const pid of INACTIVATE) {
    console.log(`  player ${pid} -> active=false`);
    if (!DRY) await supabase.from('players').update({ active: false }).eq('id_player', pid);
  }

  console.log(DRY ? `\n[DRY] pronto. ${EXH_PLAYED.length} jogos→exhibition, ${DEL_FUTURE.length} futuros→delete, ${INACTIVATE.length} inativado(s). Rode c/ CONFIRM_EXECUTE=yes.`
                  : `\n✅ EXECUTADO. ${EXH_PLAYED.length} exhibition, ${DEL_FUTURE.length} deletados, Alisson inativado.`);
  process.exit(0);
})();
