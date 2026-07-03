// Sorteia Masc 4ª round 6 (quinta 21/05/2026) com 1 jogo FIXO:
//   Alessandro Flores (690, LEFT) + Pablo Severo (673, RIGHT)
//   ×
//   Ivan Bartmann (685, LEFT) + Marcio Delia (675, RIGHT)
//
// Os 4 fixos saem do pool de seleção. Os demais 14 elegíveis competem por 1 jogo
// sorteado (target = 1 extra). Total: 2 jogos masc 4ª na quinta. Round_type=REGULAR.
//
// DRY-RUN é o default. Pra escrever no banco:
//   CONFIRM_EXECUTE=yes node scripts/investigacao/sortear_masc4a_round6_com_fixo.js
//
// Replica a lógica interna do weeklyDrawService.js (selectPlayersForWeek + pairBySide
// + greedy) porque essas funções não são exportadas e eu preciso forçar par fixo.

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
const supabase = require('../../supabase');

// ── Constantes do plano ───────────────────────────────────────────────────────
const ID_TOURNAMENT = 7;
const ID_CATEGORY = 2;           // Masc 4ª
const SCHEDULED_DATE = '2026-05-21';
const FIXED_DOUBLE_A = { p1: 690, p2: 673 }; // Ale Flores (LEFT) + Pablo Severo (RIGHT)
const FIXED_DOUBLE_B = { p1: 685, p2: 675 }; // Ivan Bartmann (LEFT) + Marcio Delia (RIGHT)
const FIXED_PLAYERS = new Set([690, 673, 685, 675]);
const TARGET_EXTRA_MATCHES = 1;  // além do fixo

const EXECUTE = process.env.CONFIRM_EXECUTE === 'yes';

const TIME_SLOTS = ['18:30', '19:10', '19:50', '20:30', '21:10', '21:50'];

// ── Helpers (copiados de weeklyDrawService.js) ────────────────────────────────
function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function pairKey(a, b) { return a < b ? `${a}-${b}` : `${b}-${a}`; }

function buildPartnershipCost(partnerships) {
  const cost = {};
  (partnerships || []).forEach(p => {
    cost[pairKey(p.id_player1, p.id_player2)] = (p.times_paired || 1) * 100;
  });
  return cost;
}

function matchSidesGreedy(rights, lefts, partnershipCost, K = 200) {
  let bestPairs = null;
  let bestCost = Infinity;
  for (let attempt = 0; attempt < K; attempt++) {
    const R = shuffle([...rights]);
    const L = shuffle([...lefts]);
    const pairs = [];
    const usedL = new Set();
    let cost = 0;
    for (const r of R) {
      let bestIdx = -1, bestC = Infinity;
      for (let j = 0; j < L.length; j++) {
        if (usedL.has(j)) continue;
        const c = partnershipCost[pairKey(r.id_player, L[j].id_player)] || 0;
        if (c < bestC) { bestC = c; bestIdx = j; }
      }
      if (bestIdx >= 0) {
        pairs.push({ player1: r.id_player, player2: L[bestIdx].id_player });
        usedL.add(bestIdx);
        cost += bestC;
      }
    }
    if (cost < bestCost) { bestCost = cost; bestPairs = pairs; }
  }
  return bestPairs || [];
}

function pairBySide(activePlayers, partnerships) {
  const rights  = activePlayers.filter(p => p.side === 'RIGHT');
  const lefts   = activePlayers.filter(p => p.side === 'LEFT');
  const eithers = shuffle(activePlayers.filter(p => p.side === 'EITHER'));

  while (rights.length < lefts.length && eithers.length > 0) rights.push(eithers.pop());
  while (lefts.length  < rights.length && eithers.length > 0) lefts.push(eithers.pop());

  const eitherPairs = [];
  while (eithers.length >= 2) {
    eitherPairs.push({ player1: eithers.pop().id_player, player2: eithers.pop().id_player });
  }
  if (eithers.length === 1) {
    (rights.length <= lefts.length ? rights : lefts).push(eithers.pop());
  }

  const minSide = Math.min(rights.length, lefts.length);
  const unpaired = rights.length > lefts.length ? rights.splice(minSide)
    : lefts.length > rights.length ? lefts.splice(minSide) : [];

  const partnershipCost = buildPartnershipCost(partnerships);
  const pairs = matchSidesGreedy(rights, lefts, partnershipCost);
  pairs.push(...eitherPairs);
  return { pairs, unpaired };
}

function selectPlayersForWeek(players, gamesPlayed, excludedIds, targetMatches) {
  const available = players
    .filter(p => !excludedIds.has(p.id_player))
    .sort((a, b) => (gamesPlayed[a.id_player] || 0) - (gamesPlayed[b.id_player] || 0));
  const needed = targetMatches * 4;
  if (available.length <= needed) return available;
  let selected = available.slice(0, needed);
  // Mesma lógica de balanço de side (LEFT vs RIGHT) do service
  const countByside = (arr, s) => arr.filter(p => p.side === s).length;
  const reserve = available.slice(selected.length);
  const tryRebalance = (majSide, minSide) => {
    while (countByside(selected, majSide) - countByside(selected, minSide) >= 2) {
      const minCandidate = reserve.find(p => p.side === minSide || p.side === 'EITHER');
      if (!minCandidate) break;
      const majIdx = [...selected].reverse().findIndex(p => p.side === majSide);
      if (majIdx < 0) break;
      const realIdx = selected.length - 1 - majIdx;
      const removed = selected.splice(realIdx, 1)[0];
      selected.push(minCandidate);
      reserve.splice(reserve.indexOf(minCandidate), 1);
      reserve.push(removed);
    }
  };
  tryRebalance('RIGHT', 'LEFT');
  tryRebalance('LEFT', 'RIGHT');
  return selected;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n=== Sorteio Masc 4ª round 6 — ${SCHEDULED_DATE} ${EXECUTE ? '[EXECUTE]' : '[DRY-RUN]'} ===\n`);

  // 1. Players da categoria
  const { data: allPlayers } = await supabase
    .from('players')
    .select('id_player, name, side')
    .eq('id_tournament', ID_TOURNAMENT)
    .eq('category_id', ID_CATEGORY);

  // 2. Partnerships + games_played calculado
  const [{ data: partnerships }, { data: oppositions }, { data: allDoubles }, { data: countedMatches }] = await Promise.all([
    supabase.from('partnerships').select('*').eq('id_tournament', ID_TOURNAMENT).eq('id_category', ID_CATEGORY),
    supabase.from('oppositions').select('*').eq('id_tournament', ID_TOURNAMENT).eq('id_category', ID_CATEGORY),
    supabase.from('doubles').select('id_double, id_player1, id_player2').eq('id_tournament', ID_TOURNAMENT),
    supabase.from('matches').select('id_double_a, id_double_b').eq('id_tournament', ID_TOURNAMENT).in('status', ['FINISHED', 'WO'])
  ]);
  const dToP = {};
  for (const d of allDoubles || []) dToP[d.id_double] = [d.id_player1, d.id_player2];
  const games = {};
  for (const m of countedMatches || []) {
    for (const pid of [...(dToP[m.id_double_a] || []), ...(dToP[m.id_double_b] || [])]) {
      games[pid] = (games[pid] || 0) + 1;
    }
  }

  // 3. Próximo round_number
  const { data: lastRound } = await supabase
    .from('rounds')
    .select('round_number')
    .eq('id_tournament', ID_TOURNAMENT)
    .eq('id_category', ID_CATEGORY)
    .order('round_number', { ascending: false })
    .limit(1);
  const nextRoundNumber = (lastRound?.[0]?.round_number || 0) + 1;
  console.log(`Próxima rodada: #${nextRoundNumber}`);

  // 4. Selecionar players sorteados (excluir 4 fixos)
  const selectedExtra = selectPlayersForWeek(allPlayers, games, FIXED_PLAYERS, TARGET_EXTRA_MATCHES);
  console.log(`\nElegíveis (pool livre, sem fixos): ${allPlayers.length - FIXED_PLAYERS.size} · selecionados para 1 jogo extra: ${selectedExtra.length}`);
  for (const p of selectedExtra) {
    console.log(`  ${p.id_player} · ${p.name} · ${p.side} · games=${games[p.id_player] || 0}`);
  }

  // 5. Pareamento por side dos sorteados
  const { pairs: extraPairs, unpaired } = pairBySide(selectedExtra, partnerships || []);
  console.log(`\nPares sorteados (${extraPairs.length}) — unpaired=${unpaired.length}:`);
  const nameById = {};
  for (const p of allPlayers) nameById[p.id_player] = p.name;
  for (const pair of extraPairs) {
    console.log(`  ${nameById[pair.player1]} + ${nameById[pair.player2]}`);
  }
  if (unpaired.length > 0) {
    console.log(`  ⚠️  Unpaired (vão pra ROTATED):`);
    for (const u of unpaired) console.log(`     ${u.id_player} · ${u.name} (${u.side})`);
  }

  // 6. Slots disponíveis na data (considera outras categorias)
  const { data: courts } = await supabase
    .from('courts')
    .select('id_court, name, order_index')
    .eq('id_tournament', ID_TOURNAMENT)
    .order('order_index');
  const { data: existingMatches } = await supabase
    .from('matches')
    .select('id_court, scheduled_at')
    .eq('id_tournament', ID_TOURNAMENT)
    .not('scheduled_at', 'is', null)
    .gte('scheduled_at', `${SCHEDULED_DATE}T00:00:00`)
    .lte('scheduled_at', `${SCHEDULED_DATE}T23:59:59`);
  const taken = {};
  courts.forEach(c => { taken[c.id_court] = new Set(); });
  (existingMatches || []).forEach(m => {
    if (m.id_court && m.scheduled_at) {
      taken[m.id_court]?.add(m.scheduled_at.substring(11, 16));
    }
  });
  const availableSlots = [];
  for (const t of TIME_SLOTS) {
    for (const c of courts) {
      if (!taken[c.id_court]?.has(t)) availableSlots.push({ id_court: c.id_court, time: t, court_name: c.name });
    }
  }
  console.log(`\nSlots disponíveis: ${availableSlots.length} (em ${courts.length} quadras × ${TIME_SLOTS.length} horários)`);

  // 7. Plano final: 2 matches (1 fixo + 1 sorteado)
  const allDoublesPlan = [
    { tag: 'FIXO-A', p1: FIXED_DOUBLE_A.p1, p2: FIXED_DOUBLE_A.p2 },
    { tag: 'FIXO-B', p1: FIXED_DOUBLE_B.p1, p2: FIXED_DOUBLE_B.p2 },
    ...extraPairs.map((pair, i) => ({ tag: `SORTEIO-${i}`, p1: pair.player1, p2: pair.player2 }))
  ];
  // Match pairs forçados: FIXO-A × FIXO-B, e os sorteados entre si
  const matchPlan = [
    { a: 0, b: 1 } // fixo
  ];
  if (extraPairs.length >= 2) {
    matchPlan.push({ a: 2, b: 3 }); // sorteado (2 duplas extras)
  } else if (extraPairs.length === 1) {
    console.log(`  ⚠️ Só 1 dupla sorteada — vai virar BYE/ROTATED. Revisar.`);
  }

  console.log(`\n=== PLANO DE MATCHES ===`);
  matchPlan.forEach((m, i) => {
    const da = allDoublesPlan[m.a], db = allDoublesPlan[m.b];
    const slot = availableSlots[i];
    const slotStr = slot ? `${slot.court_name} ${slot.time}` : 'SEM SLOT';
    console.log(`  Match ${i + 1} (${slotStr}): ${nameById[da.p1]} + ${nameById[da.p2]} × ${nameById[db.p1]} + ${nameById[db.p2]}`);
  });

  // 8. Attendance plan
  const selectedExtraIds = new Set(selectedExtra.map(p => p.id_player));
  const allInGame = new Set([...FIXED_PLAYERS, ...selectedExtraIds]);
  const unpairedIds = new Set(unpaired.map(p => p.id_player));
  const rotatedOut = allPlayers.filter(p => !allInGame.has(p.id_player) && !unpairedIds.has(p.id_player));

  console.log(`\n=== ATTENDANCE PLAN ===`);
  console.log(`  NO_RESPONSE (vão jogar): ${allInGame.size}`);
  for (const pid of allInGame) console.log(`    ${pid} · ${nameById[pid]}${FIXED_PLAYERS.has(pid) ? ' [FIXO]' : ''}`);
  console.log(`  ROTATED (não selecionados nesta semana): ${rotatedOut.length}`);
  for (const p of rotatedOut) console.log(`    ${p.id_player} · ${p.name} · games=${games[p.id_player] || 0}`);
  if (unpaired.length > 0) {
    console.log(`  ROTATED por unpaired (side incompatível): ${unpaired.length}`);
    for (const u of unpaired) console.log(`    ${u.id_player} · ${u.name}`);
  }

  // 9. Partnerships+oppositions delta
  console.log(`\n=== PARTNERSHIPS QUE SERÃO CRIADAS/INCREMENTADAS ===`);
  const allPairs = allDoublesPlan;
  for (const d of allPairs) {
    const k = pairKey(d.p1, d.p2);
    const exists = (partnerships || []).find(p => pairKey(p.id_player1, p.id_player2) === k);
    console.log(`  ${nameById[d.p1]} + ${nameById[d.p2]} ${exists ? `(já ${exists.times_paired}× → +1)` : '(novo)'}`);
  }
  console.log(`\n=== OPPOSITIONS DELTA (4 entries/match × ${matchPlan.length} matches = ${matchPlan.length * 4}) ===`);

  if (!EXECUTE) {
    console.log(`\n🔍 DRY-RUN finalizado. Pra escrever: CONFIRM_EXECUTE=yes node scripts/investigacao/sortear_masc4a_round6_com_fixo.js`);
    return;
  }

  // ════════════════════════════════════════════════════════════════════════
  // EXECUTE block — escreve no banco
  // ════════════════════════════════════════════════════════════════════════
  console.log(`\n🚀 EXECUTANDO escrita no Supabase...`);

  // (a) Cria round DRAFT
  const monday = new Date(SCHEDULED_DATE + 'T12:00:00');
  monday.setDate(monday.getDate() - 3);
  monday.setHours(18, 0, 0, 0);
  const { data: round, error: rErr } = await supabase
    .from('rounds')
    .insert({
      id_tournament: ID_TOURNAMENT,
      id_category: ID_CATEGORY,
      round_number: nextRoundNumber,
      scheduled_date: SCHEDULED_DATE,
      window_start: '18:30',
      window_end: '22:00',
      status: 'DRAFT',
      round_type: 'REGULAR',
      confirmation_deadline: monday.toISOString()
    }).select().single();
  if (rErr) throw new Error('Round insert: ' + rErr.message);
  console.log(`  ✓ Round criado id=${round.id_round} #${round.round_number}`);

  // (b) Cria doubles
  const doublesToInsert = allDoublesPlan.map(d => ({
    id_tournament: ID_TOURNAMENT,
    id_player1: d.p1,
    id_player2: d.p2,
    display_name: `${nameById[d.p1]} / ${nameById[d.p2]}`,
    id_round: round.id_round
  }));
  const { data: insertedDoubles, error: dErr } = await supabase
    .from('doubles').insert(doublesToInsert).select();
  if (dErr) throw new Error('Doubles insert: ' + dErr.message);
  console.log(`  ✓ Doubles criados: ${insertedDoubles.length}`);

  // mapa tag→id_double
  const tagToDouble = {};
  insertedDoubles.forEach((d, i) => { tagToDouble[allDoublesPlan[i].tag] = d; });

  // (c) Cria matches
  const matchesToInsert = matchPlan.map((m, i) => {
    const slot = availableSlots[i];
    if (!slot) throw new Error(`Slot indisponível para match ${i + 1}`);
    return {
      id_tournament: ID_TOURNAMENT,
      id_double_a: insertedDoubles[m.a].id_double,
      id_double_b: insertedDoubles[m.b].id_double,
      id_court: slot.id_court,
      status: 'TO_PLAY',
      scheduled_at: `${SCHEDULED_DATE}T${slot.time}:00`
    };
  });
  const { error: mErr } = await supabase.from('matches').insert(matchesToInsert);
  if (mErr) throw new Error('Matches insert: ' + mErr.message);
  console.log(`  ✓ Matches criados: ${matchesToInsert.length}`);

  // (d) Attendance
  const attendanceRows = [
    ...[...allInGame].map(pid => ({ id_round: round.id_round, id_player: pid, status: 'NO_RESPONSE' })),
    ...rotatedOut.map(p => ({ id_round: round.id_round, id_player: p.id_player, status: 'ROTATED' })),
    ...unpaired.map(p => ({ id_round: round.id_round, id_player: p.id_player, status: 'ROTATED' }))
  ];
  const { error: aErr } = await supabase.from('round_attendance').insert(attendanceRows);
  if (aErr) throw new Error('Attendance insert: ' + aErr.message);
  console.log(`  ✓ Attendance: ${attendanceRows.length} rows`);

  // (e) Partnerships
  for (const d of allDoublesPlan) {
    const p1 = Math.min(d.p1, d.p2), p2 = Math.max(d.p1, d.p2);
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
  console.log(`  ✓ Partnerships atualizadas`);

  // (f) Oppositions
  const sideById = {};
  allPlayers.forEach(p => { sideById[p.id_player] = p.side; });
  for (const m of matchPlan) {
    const da = allDoublesPlan[m.a], db = allDoublesPlan[m.b];
    const aPlayers = [da.p1, da.p2], bPlayers = [db.p1, db.p2];
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
  }
  console.log(`  ✓ Oppositions atualizadas`);

  // (g) Status CONFIRMED
  await supabase.from('rounds').update({ status: 'CONFIRMED' }).eq('id_round', round.id_round);
  console.log(`\n✅ Round ${round.id_round} CONFIRMED · ${matchesToInsert.length} matches criados.`);
}

main().catch(e => { console.error('💥', e); process.exit(1); });
