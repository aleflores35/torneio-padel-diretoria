// Injeta o jogo FIXO no Masc 4ª round 6 DEPOIS que Alessandro rodar o sorteio pela UI.
//
// Pré-requisito: sortear Masc 4ª pela UI admin marcando os 4 fixos como impossibilitados:
//   - Alessandro Flores (690)
//   - Pablo Severo (673)
//   - Ivan Bartmann (685)
//   - Marcio Delia (675)
//
// O que o script faz:
//   1. Acha o último round Masc 4ª (esperado: status DRAFT/AWAITING/CONFIRMED, round 6)
//   2. Confere que os 4 fixos estão DECLINED nesse round
//   3. Cria 2 doubles fixos (Ale+Pablo Severo, Ivan+Marcio Delia) com id_round
//   4. Cria 1 match fixo no slot escolhido (default: Vidro 19:50, fallback Parede 19:50)
//   5. Atualiza attendance: 4 fixos passam DECLINED → NO_RESPONSE
//   6. Incrementa partnerships (2 novas) + oppositions (4 entries do match)
//
// DRY-RUN por padrão. Pra executar: CONFIRM_EXECUTE=yes node ...
// Override slot: SLOT_TIME=20:30 SLOT_COURT=Parede node ...

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
const supabase = require('../../supabase');

const ID_TOURNAMENT = 7;
const ID_CATEGORY = 2; // Masc 4ª
const EXPECTED_ROUND_NUMBER = 6;
const FIXED_DOUBLE_A = { p1: 690, p2: 673 }; // Ale Flores LEFT + Pablo Severo RIGHT
const FIXED_DOUBLE_B = { p1: 685, p2: 675 }; // Ivan Bartmann LEFT + Marcio Delia RIGHT
const FIXED_PLAYERS = [690, 673, 685, 675];

const SLOT_TIME = process.env.SLOT_TIME || '19:50';
const SLOT_COURT_NAME = process.env.SLOT_COURT || 'Quadra de Vidro';
const EXECUTE = process.env.CONFIRM_EXECUTE === 'yes';

function pairKey(a, b) { return a < b ? `${a}-${b}` : `${b}-${a}`; }

async function main() {
  console.log(`\n=== Injetar FIXO Masc 4ª round ${EXPECTED_ROUND_NUMBER} ${EXECUTE ? '[EXECUTE]' : '[DRY-RUN]'} ===\n`);

  // 1. Achar último round Masc 4ª
  const { data: rounds } = await supabase
    .from('rounds')
    .select('*')
    .eq('id_tournament', ID_TOURNAMENT)
    .eq('id_category', ID_CATEGORY)
    .order('round_number', { ascending: false })
    .limit(3);
  if (!rounds || rounds.length === 0) throw new Error('Nenhum round Masc 4ª encontrado');
  const round = rounds[0];
  console.log(`Round encontrado: id=${round.id_round} #${round.round_number} ${round.scheduled_date} status=${round.status} type=${round.round_type}`);
  if (round.round_number !== EXPECTED_ROUND_NUMBER) {
    console.log(`⚠️  Esperava round #${EXPECTED_ROUND_NUMBER}, achei #${round.round_number}. Confira se você já sorteou pela UI.`);
  }

  // 2. Conferir attendance dos 4 fixos
  const { data: attendance } = await supabase
    .from('round_attendance')
    .select('id_player, status')
    .eq('id_round', round.id_round)
    .in('id_player', FIXED_PLAYERS);
  const { data: playersInfo } = await supabase
    .from('players').select('id_player, name, side').in('id_player', FIXED_PLAYERS);
  const nameById = {}; const sideById = {};
  for (const p of playersInfo) { nameById[p.id_player] = p.name; sideById[p.id_player] = p.side; }

  console.log(`\nAttendance dos 4 fixos no round ${round.id_round}:`);
  const statusMap = {};
  for (const a of attendance || []) statusMap[a.id_player] = a.status;
  let allDeclined = true;
  for (const pid of FIXED_PLAYERS) {
    const s = statusMap[pid] || 'AUSENTE';
    console.log(`  ${pid} · ${nameById[pid]} (${sideById[pid]}) → ${s}`);
    if (s !== 'DECLINED') allDeclined = false;
  }
  if (!allDeclined) {
    console.log(`\n❌ ABORT: nem todos os 4 fixos estão DECLINED. Marque-os como impossibilitados pela UI antes de rodar.`);
    if (!EXECUTE) console.log(`   (DRY-RUN — continuo só pra mostrar o plano, mas o execute vai abortar)`);
    if (EXECUTE) process.exit(1);
  }

  // 3. Conferir slot disponível
  const { data: courts } = await supabase
    .from('courts').select('id_court, name').eq('id_tournament', ID_TOURNAMENT);
  const targetCourt = courts.find(c => c.name === SLOT_COURT_NAME);
  if (!targetCourt) throw new Error(`Quadra "${SLOT_COURT_NAME}" não encontrada. Disponíveis: ${courts.map(c => c.name).join(', ')}`);

  const { data: existingAtSlot } = await supabase
    .from('matches')
    .select('id_match, id_double_a, id_double_b, scheduled_at')
    .eq('id_tournament', ID_TOURNAMENT)
    .eq('id_court', targetCourt.id_court)
    .eq('scheduled_at', `${round.scheduled_date}T${SLOT_TIME}:00`);
  if (existingAtSlot && existingAtSlot.length > 0) {
    console.log(`\n⚠️  Slot ${SLOT_COURT_NAME} ${SLOT_TIME} JÁ ESTÁ OCUPADO por match=${existingAtSlot[0].id_match}`);
    console.log(`   Outras opções: rode com SLOT_TIME=... SLOT_COURT=... pra trocar.`);
    if (EXECUTE) process.exit(1);
  } else {
    console.log(`\n✓ Slot livre: ${SLOT_COURT_NAME} ${SLOT_TIME} (id_court=${targetCourt.id_court})`);
  }

  // 4. Plano
  console.log(`\n=== PLANO ===`);
  console.log(`  Match FIXO: ${nameById[FIXED_DOUBLE_A.p1]} + ${nameById[FIXED_DOUBLE_A.p2]} × ${nameById[FIXED_DOUBLE_B.p1]} + ${nameById[FIXED_DOUBLE_B.p2]}`);
  console.log(`              @ ${SLOT_COURT_NAME} ${SLOT_TIME}, ${round.scheduled_date}, round_id=${round.id_round}`);
  console.log(`  Doubles novos: 2`);
  console.log(`  Match novo: 1`);
  console.log(`  Attendance updates: 4 (DECLINED → NO_RESPONSE)`);
  console.log(`  Partnerships +1×2 = 2 entries`);
  console.log(`  Oppositions +1×4 = 4 entries`);

  if (!EXECUTE) {
    console.log(`\n🔍 DRY-RUN finalizado. Pra escrever: CONFIRM_EXECUTE=yes node scripts/investigacao/injetar_fixo_masc4a_round6.js`);
    return;
  }

  // ════════════════════════════════════════════════════════════════════════
  console.log(`\n🚀 EXECUTANDO...`);

  // (a) Cria 2 doubles
  const doublesToInsert = [
    { id_tournament: ID_TOURNAMENT, id_player1: FIXED_DOUBLE_A.p1, id_player2: FIXED_DOUBLE_A.p2,
      display_name: `${nameById[FIXED_DOUBLE_A.p1]} / ${nameById[FIXED_DOUBLE_A.p2]}`, id_round: round.id_round },
    { id_tournament: ID_TOURNAMENT, id_player1: FIXED_DOUBLE_B.p1, id_player2: FIXED_DOUBLE_B.p2,
      display_name: `${nameById[FIXED_DOUBLE_B.p1]} / ${nameById[FIXED_DOUBLE_B.p2]}`, id_round: round.id_round }
  ];
  const { data: insertedDoubles, error: dErr } = await supabase.from('doubles').insert(doublesToInsert).select();
  if (dErr) throw new Error('Doubles insert: ' + dErr.message);
  console.log(`  ✓ Doubles: id=${insertedDoubles[0].id_double}, ${insertedDoubles[1].id_double}`);

  // (b) Cria 1 match
  const { data: insertedMatch, error: mErr } = await supabase.from('matches').insert({
    id_tournament: ID_TOURNAMENT,
    id_double_a: insertedDoubles[0].id_double,
    id_double_b: insertedDoubles[1].id_double,
    id_court: targetCourt.id_court,
    status: 'TO_PLAY',
    scheduled_at: `${round.scheduled_date}T${SLOT_TIME}:00`
  }).select().single();
  if (mErr) throw new Error('Match insert: ' + mErr.message);
  console.log(`  ✓ Match criado id=${insertedMatch.id_match} @ ${SLOT_COURT_NAME} ${SLOT_TIME}`);

  // (c) Attendance update: DECLINED → NO_RESPONSE
  const { error: aErr } = await supabase
    .from('round_attendance')
    .update({ status: 'NO_RESPONSE', responded_by: null })
    .eq('id_round', round.id_round)
    .in('id_player', FIXED_PLAYERS);
  if (aErr) throw new Error('Attendance update: ' + aErr.message);
  console.log(`  ✓ Attendance: 4 rows atualizadas pra NO_RESPONSE`);

  // (d) Partnerships
  for (const pair of [FIXED_DOUBLE_A, FIXED_DOUBLE_B]) {
    const p1 = Math.min(pair.p1, pair.p2), p2 = Math.max(pair.p1, pair.p2);
    const { data: existing } = await supabase.from('partnerships')
      .select('id_partnership, times_paired')
      .eq('id_tournament', ID_TOURNAMENT).eq('id_category', ID_CATEGORY)
      .eq('id_player1', p1).eq('id_player2', p2)
      .maybeSingle();
    if (existing) {
      await supabase.from('partnerships').update({
        times_paired: existing.times_paired + 1, last_round_id: round.id_round
      }).eq('id_partnership', existing.id_partnership);
    } else {
      await supabase.from('partnerships').insert({
        id_tournament: ID_TOURNAMENT, id_category: ID_CATEGORY,
        id_player1: p1, id_player2: p2,
        times_paired: 1, last_round_id: round.id_round
      });
    }
  }
  console.log(`  ✓ Partnerships incrementadas`);

  // (e) Oppositions (4 entries pro match: cada jogador A vs cada jogador B)
  const aPlayers = [FIXED_DOUBLE_A.p1, FIXED_DOUBLE_A.p2];
  const bPlayers = [FIXED_DOUBLE_B.p1, FIXED_DOUBLE_B.p2];
  for (const pa of aPlayers) {
    for (const pb of bPlayers) {
      const p1 = Math.min(pa, pb), p2 = Math.max(pa, pb);
      const sa = sideById[pa], sb = sideById[pb];
      const isDiagonal = sa && sb && sa === sb && sa !== 'EITHER';
      const { data: existing } = await supabase.from('oppositions')
        .select('id_opposition, times_opposed, diagonal_count')
        .eq('id_tournament', ID_TOURNAMENT).eq('id_category', ID_CATEGORY)
        .eq('id_player1', p1).eq('id_player2', p2)
        .maybeSingle();
      if (existing) {
        await supabase.from('oppositions').update({
          times_opposed: existing.times_opposed + 1,
          diagonal_count: existing.diagonal_count + (isDiagonal ? 1 : 0),
          last_round_id: round.id_round
        }).eq('id_opposition', existing.id_opposition);
      } else {
        await supabase.from('oppositions').insert({
          id_tournament: ID_TOURNAMENT, id_category: ID_CATEGORY,
          id_player1: p1, id_player2: p2,
          times_opposed: 1, diagonal_count: isDiagonal ? 1 : 0,
          last_round_id: round.id_round
        });
      }
    }
  }
  console.log(`  ✓ Oppositions atualizadas (4 entries)`);

  console.log(`\n✅ Jogo fixo inserido com sucesso no round ${round.id_round}.`);
  console.log(`   Confere no admin: /diretoria-padel/jogos?round=${round.id_round}`);
}

main().catch(e => { console.error('💥', e); process.exit(1); });
