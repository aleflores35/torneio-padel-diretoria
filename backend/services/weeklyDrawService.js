// weeklyDrawService.js - Sorteio semanal com rotação balanceada
// Meta: todas as categorias terminam em ~27 semanas (outubro 2026)
// Slots: 2 quadras × 6 horários (18:00–21:20, 40min cada) = 12 jogos/quinta

const supabase = require('../supabase');

// ─── Constantes de agendamento ────────────────────────────────────────────────

const TIME_SLOTS = ['18:00', '18:40', '19:20', '20:00', '20:40', '21:20'];
const MATCH_DURATION_MIN = 40;

/**
 * Calcula o número de jogos-alvo por semana para cada categoria,
 * garantindo que todas terminam em ~27 semanas.
 *
 * Masc. Iniciante (28 jogadores): sempre 7
 * Masc. 4ª       (18 jogadores): rodadas ímpares=3, pares=2
 * Fem. Iniciante  (14 jogadores): rodadas 1-12=2,  13+=1
 */
function getTargetMatches(playerCount, roundNumber) {
  if (playerCount >= 24) return 7;           // categoria grande: sempre tudo
  if (playerCount >= 16) return roundNumber % 2 !== 0 ? 3 : 2;  // 18p: 3/2 alternado
  return roundNumber <= 12 ? 2 : 1;          // 14p: 2 nas primeiras 12 semanas, 1 depois
}

// ─── Algoritmo de sorteio ─────────────────────────────────────────────────────

function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function buildPartnershipCost(partnerships) {
  const cost = {};
  (partnerships || []).forEach(p => {
    const key = p.id_player1 < p.id_player2
      ? `${p.id_player1}-${p.id_player2}`
      : `${p.id_player2}-${p.id_player1}`;
    cost[key] = (p.times_paired || 1) * 100;
  });
  return cost;
}

// Empareja 1R + 1L minimizando repetição de parceiros (K shuffles + greedy).
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
      let bestIdx = -1;
      let bestPartnerCost = Infinity;
      for (let j = 0; j < L.length; j++) {
        if (usedL.has(j)) continue;
        const l = L[j];
        const key = r.id_player < l.id_player
          ? `${r.id_player}-${l.id_player}`
          : `${l.id_player}-${r.id_player}`;
        const c = partnershipCost[key] || 0;
        if (c < bestPartnerCost) { bestPartnerCost = c; bestIdx = j; }
      }
      if (bestIdx >= 0) {
        pairs.push({ player1: r.id_player, player2: L[bestIdx].id_player });
        usedL.add(bestIdx);
        cost += bestPartnerCost;
      }
    }
    if (cost < bestCost) { bestCost = cost; bestPairs = pairs; }
  }
  return bestPairs || [];
}

// Separa jogadores por lado e garante que toda dupla tenha lados compatíveis:
// 1R+1L, 1R+1E, 1L+1E ou 1E+1E. NUNCA 1R+1R ou 1L+1L.
// EITHER vira curinga. Jogadores sem par compatível ficam de fora (`unpaired`).
function pairBySide(activePlayers, partnerships) {
  const rights  = activePlayers.filter(p => p.side === 'RIGHT');
  const lefts   = activePlayers.filter(p => p.side === 'LEFT');
  const eithers = shuffle(activePlayers.filter(p => p.side === 'EITHER'));

  // EITHER preenche o lado minoritário para balancear.
  while (rights.length < lefts.length && eithers.length > 0) rights.push(eithers.pop());
  while (lefts.length  < rights.length && eithers.length > 0) lefts.push(eithers.pop());

  // EITHER restantes: pareiam entre si (1E+1E é permitido).
  const eitherPairs = [];
  while (eithers.length >= 2) {
    eitherPairs.push({ player1: eithers.pop().id_player, player2: eithers.pop().id_player });
  }
  // Se sobrar 1 EITHER ímpar, vai para o lado minoritário (mesmo desbalançando)
  if (eithers.length === 1) {
    (rights.length <= lefts.length ? rights : lefts).push(eithers.pop());
  }

  // Jogadores do lado majoritário que sobram ficam de fora (não podem parear mesmo-lado).
  const minSide = Math.min(rights.length, lefts.length);
  const unpaired = rights.length > lefts.length
    ? rights.splice(minSide)
    : lefts.length > rights.length
      ? lefts.splice(minSide)
      : [];

  const partnershipCost = buildPartnershipCost(partnerships);
  const pairs = matchSidesGreedy(rights, lefts, partnershipCost);
  pairs.push(...eitherPairs);

  return { pairs, unpaired };
}

function chooseBye(players, stats) {
  const statsMap = {};
  (stats || []).forEach(s => { statsMap[s.id_player] = s; });
  return [...players].sort((a, b) => {
    const sa = statsMap[a.id_player] || { byes: 0, games_played: 0 };
    const sb = statsMap[b.id_player] || { byes: 0, games_played: 0 };
    if (sa.byes !== sb.byes) return sa.byes - sb.byes;
    return sb.games_played - sa.games_played;
  })[0];
}

// ─── Selecionar jogadores para a semana (rotação por menos jogos) ─────────────

/**
 * Retorna `count` jogadores priorizando quem jogou menos,
 * excluindo ausentes e garantindo grupos de 4 (sem bye se possível).
 */
function selectPlayersForWeek(players, stats, excludedIds, targetMatches) {
  const statsMap = {};
  (stats || []).forEach(s => { statsMap[s.id_player] = s; });

  const available = players
    .filter(p => !excludedIds.includes(p.id_player))
    .sort((a, b) => {
      const ga = statsMap[a.id_player]?.games_played || 0;
      const gb = statsMap[b.id_player]?.games_played || 0;
      return ga - gb; // menos jogos primeiro
    });

  const needed = targetMatches * 4;

  if (available.length <= needed) return available; // todos entram

  let selected = available.slice(0, needed);

  while (selected.length % 4 !== 0 && selected.length < available.length) {
    selected.push(available[selected.length]);
  }
  if ((selected.length / 2) % 2 !== 0 && selected.length > 4) {
    selected = selected.slice(0, selected.length - 2);
  }

  // Balanço por lado: se a seleção ficou com mais de um lado que o outro,
  // trocar excedentes do lado majoritário por jogadores disponíveis do lado
  // minoritário (respeitando ordem de rotação — primeiros são candidatos a sair).
  const countByside = (arr, s) => arr.filter(p => p.side === s).length;
  const reserve = available.slice(selected.length);

  const tryRebalance = (majSide, minSide) => {
    while (countByside(selected, majSide) - countByside(selected, minSide) >= 2) {
      const minCandidate = reserve.find(p => p.side === minSide || p.side === 'EITHER');
      if (!minCandidate) break;
      const majIdx = [...selected].reverse().findIndex(p => p.side === majSide);
      if (majIdx < 0) break;
      const realIdx = selected.length - 1 - majIdx; // do mais recente para o mais antigo
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

// ─── Helper: próximo número de rodada ────────────────────────────────────────

async function getNextRoundNumber(id_tournament, id_category) {
  const { data } = await supabase
    .from('rounds')
    .select('round_number')
    .eq('id_tournament', id_tournament)
    .eq('id_category', id_category)
    .order('round_number', { ascending: false })
    .limit(1);
  return data && data.length > 0 ? data[0].round_number + 1 : 1;
}

// ─── Sorteio semanal ──────────────────────────────────────────────────────────

/**
 * Sorteia a rodada da semana para uma categoria.
 * Seleciona automaticamente quantos jogadores jogar com base na meta semanal.
 *
 * @param {object} [opts]
 * @param {boolean} [opts.markAsExhibition=false] Se true, cria round_type='EXHIBITION'
 *   (não conta pro ranking). Se false e sistema detectar insufficient_quorum, lança erro
 *   com code INSUFFICIENT_QUORUM pro frontend pedir confirmação.
 */
async function drawWeeklyRound(id_tournament, id_category, scheduled_date, excluded_player_ids = [], opts = {}) {
  const { markAsExhibition = false } = opts;
  // 1. Buscar todos os atletas da categoria
  const { data: allPlayers, error: pErr } = await supabase
    .from('players')
    .select('*')
    .eq('id_tournament', id_tournament)
    .eq('category_id', id_category);
  if (pErr) throw new Error('Busca de atletas: ' + pErr.message);

  // 2. Buscar histórico e stats
  const [{ data: partnerships }, { data: stats }] = await Promise.all([
    supabase.from('partnerships').select('*').eq('id_tournament', id_tournament).eq('id_category', id_category),
    supabase.from('player_stats').select('*').eq('id_tournament', id_tournament).eq('id_category', id_category)
  ]);

  // 2b. Recalcula games_played em runtime a partir de matches FINISHED/WO
  // (player_stats.games_played não é incrementado automaticamente — não confiar nele)
  const [{ data: tourDoubles }, { data: countedMatches }] = await Promise.all([
    supabase.from('doubles').select('id_double, id_player1, id_player2').eq('id_tournament', id_tournament),
    supabase.from('matches').select('id_double_a, id_double_b').eq('id_tournament', id_tournament).in('status', ['FINISHED', 'WO'])
  ]);
  const dToPlayers = {};
  for (const d of (tourDoubles || [])) dToPlayers[d.id_double] = [d.id_player1, d.id_player2];
  const gamesCount = {};
  for (const m of (countedMatches || [])) {
    for (const pid of [...(dToPlayers[m.id_double_a] || []), ...(dToPlayers[m.id_double_b] || [])]) {
      gamesCount[pid] = (gamesCount[pid] || 0) + 1;
    }
  }
  const statsCalc = [...(stats || []).map(s => ({ ...s, games_played: gamesCount[s.id_player] || 0 }))];
  const knownIds = new Set(statsCalc.map(s => s.id_player));
  for (const p of allPlayers) {
    if (!knownIds.has(p.id_player)) {
      statsCalc.push({ id_player: p.id_player, games_played: gamesCount[p.id_player] || 0, byes: 0, walkovers: 0 });
    }
  }

  // 3. Calcular rodada e meta desta semana
  const nextRoundNumber = await getNextRoundNumber(id_tournament, id_category);
  const targetMatches = getTargetMatches(allPlayers.length, nextRoundNumber);

  // 4. Selecionar jogadores por rotação (menos jogos primeiro)
  const selectedPlayers = selectPlayersForWeek(allPlayers, statsCalc, excluded_player_ids, targetMatches);

  if (selectedPlayers.length < 4) throw new Error('Mínimo 4 atletas disponíveis para sortear');

  // Nota: antes havia detecção automática de "quorum insuficiente" que transformava
  // a rodada em AMISTOSA. Removido — o fluxo correto é sortear oficial com quantos
  // jogos couberem (ex: 21 disponíveis → 5 jogos oficiais + 1 BYE) e completar a
  // noite via botão "Completar Noite · Amistosos" (Fase 2). Admin pode ainda
  // passar markAsExhibition=true explicitamente quando quiser forçar.

  // 5. Bye se número ímpar de selecionados
  let byePlayer = null;
  let activePlayers = [...selectedPlayers];
  if (selectedPlayers.length % 2 !== 0) {
    byePlayer = chooseBye(selectedPlayers, statsCalc);
    activePlayers = selectedPlayers.filter(p => p.id_player !== byePlayer.id_player);
  }

  // 6. Gerar duplas (separa por lado — nunca 1R+1R ou 1L+1L, salvo EITHER)
  const { pairs, unpaired } = pairBySide(activePlayers, partnerships || []);
  if (pairs.length === 0) throw new Error('Não foi possível gerar duplas');

  // Quando exatamente 1 jogador ficou sem par compatível:
  //   1. Lado oposto + nunca foram dupla → par extra de RANKING
  //   2. Lado oposto + já foram dupla    → par extra de EXHIBITION (amistoso)
  //   3. Nenhum candidato de lado oposto → ROTATED
  // Se sobrarem 2+, não há como resolver automaticamente — ficam ROTATED normalmente.
  let extraPair = null; // { player1, player2, type: 'REGULAR' | 'EXHIBITION' }
  if (unpaired.length === 1) {
    const lone = unpaired[0];
    const oppSide = lone.side === 'LEFT' ? 'RIGHT' : lone.side === 'RIGHT' ? 'LEFT' : null;
    const partnerCost = buildPartnershipCost(partnerships || []);
    const pairKey = (a, b) => a < b ? `${a}-${b}` : `${b}-${a}`;
    const byGames = (a, b) => (gamesCount[a.id_player] || 0) - (gamesCount[b.id_player] || 0);
    const sideOk = p => oppSide === null || p.side === oppSide || p.side === 'EITHER';

    const rankingCandidate = [...activePlayers]
      .filter(p => sideOk(p) && (partnerCost[pairKey(lone.id_player, p.id_player)] || 0) === 0)
      .sort(byGames)[0];

    const exhibitionCandidate = !rankingCandidate
      ? [...activePlayers].filter(sideOk).sort(byGames)[0]
      : null;

    const chosen = rankingCandidate || exhibitionCandidate;
    if (chosen) {
      extraPair = {
        player1: lone.id_player,
        player2: chosen.id_player,
        type: rankingCandidate ? 'REGULAR' : 'EXHIBITION'
      };
      unpaired.splice(0, 1); // lone jogará — sai de unpaired
    }
  }

  // Jogadores sem par compatível ficam de fora da semana (movidos para ROTATED)
  const unpairedIds = new Set(unpaired.map(p => p.id_player));
  activePlayers = activePlayers.filter(p => !unpairedIds.has(p.id_player));
  const selectedPlayersFiltered = selectedPlayers.filter(p => !unpairedIds.has(p.id_player));

  // Jogadores que ficam fora esta semana (não selecionados)
  const selectedIds = new Set(selectedPlayers.map(p => p.id_player));
  const rotatedOut = allPlayers.filter(p => !selectedIds.has(p.id_player) && !excluded_player_ids.includes(p.id_player));

  // 7. Deadline de confirmação (segunda-feira da semana do jogo, 18:00)
  const gameDate = new Date(scheduled_date + 'T12:00:00');
  const monday = new Date(gameDate);
  monday.setDate(gameDate.getDate() - 3); // quinta - 3 = segunda
  monday.setHours(18, 0, 0, 0);

  // 8. Criar rodada (DRAFT)
  const { data: roundData, error: rErr } = await supabase
    .from('rounds')
    .insert({
      id_tournament,
      id_category,
      round_number: nextRoundNumber,
      scheduled_date,
      window_start: '18:00',
      window_end: '21:00',
      status: 'DRAFT',
      round_type: markAsExhibition ? 'EXHIBITION' : 'REGULAR',
      confirmation_deadline: monday.toISOString()
    })
    .select()
    .single();
  if (rErr) throw new Error('Criar rodada: ' + rErr.message);

  const id_round = roundData.id_round;

  // 9. Bulk insert doubles
  const playerMap = {};
  allPlayers.forEach(p => { playerMap[p.id_player] = p; });

  // Par extra de RANKING entra na rodada principal; EXHIBITION vai em rodada separada abaixo.
  const rankingExtraPair = extraPair?.type === 'REGULAR' ? extraPair : null;
  const allPairs = rankingExtraPair ? [...pairs, rankingExtraPair] : pairs;
  const doublesToInsert = allPairs.map(pair => ({
    id_tournament,
    id_player1: pair.player1,
    id_player2: pair.player2,
    display_name: `${playerMap[pair.player1].name} / ${playerMap[pair.player2].name}`,
    id_round
  }));

  const { data: insertedDoubles, error: dErr } = await supabase
    .from('doubles')
    .insert(doublesToInsert)
    .select();
  if (dErr) throw new Error('Criar duplas: ' + dErr.message);

  // 10. Attendance: selecionados=NO_RESPONSE, bye=BYE, excluídos=DECLINED,
  //                 não selecionados=ROTATED, sem par compatível=ROTATED
  // O lone player entra como NO_RESPONSE se ganhou jogo (ranking ou exhibition).
  const extraLoneId = extraPair ? extraPair.player1 : null;
  const attendanceRows = [
    ...selectedPlayersFiltered.map(p => ({
      id_round,
      id_player: p.id_player,
      status: byePlayer && p.id_player === byePlayer.id_player ? 'BYE' : 'NO_RESPONSE'
    })),
    ...(extraLoneId ? [{ id_round, id_player: extraLoneId, status: 'NO_RESPONSE' }] : []),
    ...excluded_player_ids.map(pid => ({
      id_round, id_player: pid, status: 'DECLINED', responded_by: 'ADMIN'
    })),
    ...rotatedOut.map(p => ({
      id_round, id_player: p.id_player, status: 'ROTATED'
    })),
    ...unpaired.map(p => ({
      id_round, id_player: p.id_player, status: 'ROTATED'
    }))
  ];
  await supabase.from('round_attendance').insert(attendanceRows);

  // Par extra de EXHIBITION: cria rodada EXHIBITION separada para a dupla
  let extraExhibitionRound = null;
  if (extraPair?.type === 'EXHIBITION') {
    const { data: exRound } = await supabase.from('rounds').insert({
      id_tournament, id_category,
      round_number: 0,
      scheduled_date,
      window_start: '18:00', window_end: '22:00',
      status: 'DRAFT',
      round_type: 'EXHIBITION'
    }).select().single();
    if (exRound) {
      await supabase.from('doubles').insert([
        { id_tournament, id_player1: extraPair.player1, id_player2: extraPair.player2,
          display_name: `${playerMap[extraPair.player1].name} / ${playerMap[extraPair.player2].name}`,
          id_round: exRound.id_round }
      ]);
      extraExhibitionRound = exRound.id_round;
    }
  }

  const warnings = [];
  if (extraPair) {
    const lonePlayer = playerMap[extraPair.player1];
    const borrowed = playerMap[extraPair.player2];
    if (extraPair.type === 'REGULAR') {
      warnings.push(
        `${lonePlayer?.name} ficou sem par e foi encaixado(a) com ${borrowed?.name} (2º jogo de ranking desta noite).`
      );
    } else {
      warnings.push(
        `${lonePlayer?.name} ficou sem par novo — única opção disponível (${borrowed?.name}) já foi dupla antes. Encaixado(a) em amistoso.`
      );
    }
  }
  if (unpaired.length > 0) {
    const names = unpaired.map(p => `${p.name} (${p.side === 'RIGHT' ? 'DIR' : 'ESQ'})`).join(', ');
    warnings.push(
      `${unpaired.length} jogador(es) ficaram fora da semana por falta de parceiro do lado oposto: ${names}. Cadastre mais jogadores AMBOS ou do lado oposto para balancear.`
    );
  }
  if (markAsExhibition) {
    warnings.push('⚠️ Rodada AMISTOSA: não conta pontos no ranking (quórum insuficiente).');
  }

  return {
    id_round,
    doubles: insertedDoubles,
    bye: byePlayer,
    rotated_out: [...rotatedOut, ...unpaired],
    target_matches: targetMatches,
    round_number: nextRoundNumber,
    round_type: markAsExhibition ? 'EXHIBITION' : 'REGULAR',
    extra_exhibition_round: extraExhibitionRound,
    warnings
  };
}

// ─── Refazer sorteio ──────────────────────────────────────────────────────────

async function redrawRound(id_round, excluded_player_ids = [], opts = {}) {
  const { data: round, error } = await supabase.from('rounds').select('*').eq('id_round', id_round).single();
  if (error || !round) throw new Error('Rodada não encontrada');
  if (!['DRAFT', 'AWAITING_CONFIRMATION'].includes(round.status)) {
    throw new Error('Só é possível refazer rodadas em DRAFT ou AWAITING_CONFIRMATION');
  }

  await supabase.from('round_attendance').delete().eq('id_round', id_round);
  await supabase.from('doubles').delete().eq('id_round', id_round);
  await supabase.from('rounds').update({ status: 'DRAFT' }).eq('id_round', id_round);

  // Redraw preserva o tipo da rodada (EXHIBITION continua amistosa),
  // mas pode ser explicitamente sobrescrito via opts.markAsExhibition.
  const markAsExhibition = opts.markAsExhibition ?? (round.round_type === 'EXHIBITION');

  const result = await drawWeeklyRound(
    round.id_tournament,
    round.id_category,
    round.scheduled_date,
    excluded_player_ids,
    { markAsExhibition }
  );

  // Move dados para a rodada original (preservando o novo round_type)
  await supabase.from('doubles').update({ id_round }).in('id_round', [result.id_round]);
  await supabase.from('round_attendance').update({ id_round }).in('id_round', [result.id_round]);
  await supabase.from('rounds').delete().eq('id_round', result.id_round);
  await supabase.from('rounds').update({
    status: 'DRAFT',
    round_type: markAsExhibition ? 'EXHIBITION' : 'REGULAR'
  }).eq('id_round', id_round);

  return { ...result, id_round };
}

// ─── Confirmar rodada + atribuir quadras e horários ──────────────────────────

/**
 * Confirma a rodada e distribui os jogos nas quadras disponíveis.
 * Slots: 18:00, 18:40, 19:20, 20:00, 20:40, 21:20 por quadra.
 * Respeita slots já ocupados por outras categorias no mesmo dia.
 */
async function confirmRound(id_round) {
  const { data: round } = await supabase.from('rounds').select('*').eq('id_round', id_round).single();
  if (!round) throw new Error('Rodada não encontrada');
  if (!['DRAFT', 'AWAITING_CONFIRMATION', 'CONFIRMED'].includes(round.status)) {
    throw new Error('Rodada não pode ser confirmada neste status');
  }

  // Buscar duplas
  const { data: doubles } = await supabase.from('doubles').select('*').eq('id_round', id_round);
  if (!doubles || doubles.length < 2) throw new Error('Duplas insuficientes para gerar jogos');

  // Apagar matches existentes (reconfirmação)
  const doubleIds = doubles.map(d => d.id_double);
  await supabase.from('matches').delete().in('id_double_a', doubleIds);

  // ── Buscar quadras disponíveis ──────────────────────────────────────────
  const { data: courts } = await supabase
    .from('courts')
    .select('id_court, name, order_index')
    .eq('id_tournament', round.id_tournament)
    .order('order_index');

  if (!courts || courts.length === 0) {
    throw new Error('Nenhuma quadra cadastrada para o torneio');
  }

  // ── Verificar slots já ocupados nesta data ──────────────────────────────
  // Busca todos os matches já agendados para a mesma quinta-feira
  const datePrefix = round.scheduled_date; // YYYY-MM-DD
  const { data: existingMatches } = await supabase
    .from('matches')
    .select('id_court, scheduled_at')
    .eq('id_tournament', round.id_tournament)
    .not('scheduled_at', 'is', null)
    .gte('scheduled_at', `${datePrefix}T00:00:00`)
    .lte('scheduled_at', `${datePrefix}T23:59:59`);

  // Constrói mapa de slots ocupados { court_id: Set<'18:00', '18:40', ...> }
  const takenSlots = {};
  courts.forEach(c => { takenSlots[c.id_court] = new Set(); });
  (existingMatches || []).forEach(m => {
    if (!m.id_court || !m.scheduled_at) return;
    const time = m.scheduled_at.substring(11, 16); // HH:MM
    if (takenSlots[m.id_court]) takenSlots[m.id_court].add(time);
  });

  // ── Gerar lista de slots disponíveis ───────────────────────────────────
  // Ordem: distribui entre quadras (Court1-18:00, Court2-18:00, Court1-18:40, ...)
  const availableSlots = [];
  for (const time of TIME_SLOTS) {
    for (const court of courts) {
      if (!takenSlots[court.id_court]?.has(time)) {
        availableSlots.push({ id_court: court.id_court, time, court_name: court.name });
      }
    }
  }

  // ── Criar matches com slots atribuídos ─────────────────────────────────
  const shuffled = shuffle(doubles.map(d => d.id_double));
  const matchesToInsert = [];
  const overflow = []; // jogos que não couberem nos slots

  for (let k = 0; k + 1 < shuffled.length; k += 2) {
    const slot = availableSlots[matchesToInsert.length];
    if (slot) {
      matchesToInsert.push({
        id_tournament: round.id_tournament,
        id_double_a: shuffled[k],
        id_double_b: shuffled[k + 1],
        id_court: slot.id_court,
        status: 'TO_PLAY',
        scheduled_at: `${datePrefix}T${slot.time}:00`
      });
    } else {
      overflow.push({ double_a: shuffled[k], double_b: shuffled[k + 1] });
    }
  }

  if (matchesToInsert.length > 0) {
    const { error: mErr } = await supabase.from('matches').insert(matchesToInsert);
    if (mErr) throw new Error('Criar matches: ' + mErr.message);
  }

  // ── Atualizar parcerias (apenas em rodadas oficiais — amistosos não contam no histórico) ──
  if (round.round_type !== 'EXHIBITION') {
    for (const d of doubles) {
      const p1 = Math.min(d.id_player1, d.id_player2);
      const p2 = Math.max(d.id_player1, d.id_player2);
      const { data: existing } = await supabase
        .from('partnerships')
        .select('id_partnership, times_paired')
        .eq('id_tournament', round.id_tournament)
        .eq('id_category', round.id_category)
        .eq('id_player1', p1)
        .eq('id_player2', p2)
        .single();

      if (existing) {
        await supabase.from('partnerships').update({
          times_paired: existing.times_paired + 1,
          last_round_id: id_round
        }).eq('id_partnership', existing.id_partnership);
      } else {
        await supabase.from('partnerships').insert({
          id_tournament: round.id_tournament,
          id_category: round.id_category,
          id_player1: p1, id_player2: p2,
          times_paired: 1, last_round_id: id_round
        });
      }
    }
  }

  await supabase.from('rounds').update({ status: 'CONFIRMED' }).eq('id_round', id_round);

  // ── Resumo dos slots atribuídos ────────────────────────────────────────
  const schedule = matchesToInsert.map((m, i) => ({
    match: i + 1,
    court: availableSlots[i]?.court_name,
    time: availableSlots[i]?.time
  }));

  return {
    matches_created: matchesToInsert.length,
    overflow_count: overflow.length,
    overflow_warning: overflow.length > 0
      ? `${overflow.length} jogo(s) não couberem nos slots disponíveis esta quinta. Considere redistribuir.`
      : null,
    schedule
  };
}

// ─── Fechar rodada (WO) ───────────────────────────────────────────────────────

async function closeRound(id_round) {
  const { data: round } = await supabase.from('rounds').select('*').eq('id_round', id_round).single();
  if (!round) throw new Error('Rodada não encontrada');

  const { data: doubles } = await supabase.from('doubles').select('*').eq('id_round', id_round);
  const doubleIds = (doubles || []).map(d => d.id_double);

  const { data: matches } = await supabase.from('matches').select('*').in('id_double_a', doubleIds);
  const pendingMatches = (matches || []).filter(m => ['TO_PLAY', 'IN_PROGRESS'].includes(m.status));

  // Marca pendentes como WO. Se nenhum jogador foi marcado como ausente
  // durante a semana, assume que TODOS os 4 jogadores faltaram (fallback
  // penalizante — obriga admin a marcar ausências corretamente durante a semana).
  // O rankingService aplicará a pontuação individual a partir de absent_player_ids.
  for (const match of pendingMatches) {
    const doubleA = doubles.find(d => d.id_double === match.id_double_a);
    const doubleB = doubles.find(d => d.id_double === match.id_double_b);
    const allPlayers = [doubleA?.id_player1, doubleA?.id_player2, doubleB?.id_player1, doubleB?.id_player2].filter(Boolean);
    const existingAbsents = Array.isArray(match.absent_player_ids) ? match.absent_player_ids : [];
    const absentsToApply = existingAbsents.length > 0 ? existingAbsents : allPlayers;

    await supabase.from('matches').update({
      status: 'WO',
      games_double_a: 0,
      games_double_b: 0,
      score_a: 0,
      score_b: 0,
      absent_player_ids: absentsToApply
    }).eq('id_match', match.id_match);
  }

  // Byes — ainda incrementa contador de byes (não afeta pontuação)
  const { data: byes } = await supabase.from('round_attendance').select('id_player').eq('id_round', id_round).eq('status', 'BYE');
  for (const b of (byes || [])) {
    const { data: ps } = await supabase.from('player_stats').select('byes').eq('id_player', b.id_player).single();
    if (ps) {
      await supabase.from('player_stats').update({
        byes: ps.byes + 1,
        updated_at: new Date().toISOString()
      }).eq('id_player', b.id_player);
    }
  }

  await supabase.from('rounds').update({ status: 'FINISHED' }).eq('id_round', id_round);

  return { wos_applied: pendingMatches.length };
}

// ─── Amistosos (Fase 2) ──────────────────────────────────────────────────────
//
// Cria uma rodada EXHIBITION avulsa com N jogos, usando atletas disponíveis da
// categoria que não estão ainda alocados em matches daquela data.
// Sem regras de rotação / sem penalizar parcerias repetidas / sem contar no ranking.

async function getNightStatus(id_tournament, scheduled_date) {
  // Conta quantos matches já estão agendados (de qualquer round) naquela data
  const [{ data: existingMatches }, { data: roundsOnDate }] = await Promise.all([
    supabase
      .from('matches')
      .select('id_match, id_double_a, scheduled_at')
      .eq('id_tournament', id_tournament)
      .not('scheduled_at', 'is', null)
      .gte('scheduled_at', `${scheduled_date}T00:00:00`)
      .lte('scheduled_at', `${scheduled_date}T23:59:59`),
    supabase
      .from('rounds')
      .select('id_round, id_category, round_type, status')
      .eq('id_tournament', id_tournament)
      .eq('scheduled_date', scheduled_date),
  ]);

  const { data: courts } = await supabase
    .from('courts')
    .select('id_court')
    .eq('id_tournament', id_tournament);
  const courtCount = (courts || []).length || 2;
  const totalSlots = courtCount * TIME_SLOTS.length; // 2 × 6 = 12

  const matchesScheduled = (existingMatches || []).length;
  const slotsRemaining = Math.max(0, totalSlots - matchesScheduled);

  // Duplas das rodadas do dia (pra descobrir quem já está escalado)
  const roundIds = (roundsOnDate || []).map(r => r.id_round);
  let scheduledPlayerIds = new Set();
  if (roundIds.length) {
    const { data: drs } = await supabase
      .from('doubles')
      .select('id_player1, id_player2')
      .in('id_round', roundIds);
    for (const d of (drs || [])) {
      if (d.id_player1) scheduledPlayerIds.add(d.id_player1);
      if (d.id_player2) scheduledPlayerIds.add(d.id_player2);
    }
  }

  return {
    total_slots: totalSlots,
    matches_scheduled: matchesScheduled,
    slots_remaining: slotsRemaining,
    rounds_today: roundsOnDate || [],
    scheduled_player_ids: Array.from(scheduledPlayerIds),
  };
}

/**
 * Cria uma rodada EXHIBITION com `num_matches` jogos avulsos da categoria,
 * usando atletas disponíveis (não ausentes) que ainda não foram alocados
 * em nenhuma rodada daquele dia.
 *
 * @param {number} num_matches Quantos jogos criar (cada um = 4 atletas)
 * @param {number[]} [excluded_player_ids] Atletas ausentes (declararam ausência)
 * @returns { id_round, doubles, players_used, warnings }
 */
async function addExhibitionMatches(id_tournament, id_category, scheduled_date, num_matches, excluded_player_ids = []) {
  if (!num_matches || num_matches < 1) throw new Error('num_matches deve ser >= 1');

  // 1. Atletas da categoria
  const { data: allPlayers } = await supabase
    .from('players')
    .select('*')
    .eq('id_tournament', id_tournament)
    .eq('category_id', id_category);
  if (!allPlayers || allPlayers.length === 0) throw new Error('Categoria sem atletas');

  // 2. Status da noite — respeita teto de 12 jogos (atletas já escalados no oficial
  // TAMBÉM podem jogar amistoso — é "pra não perder a viagem")
  const night = await getNightStatus(id_tournament, scheduled_date);
  if (night.slots_remaining < num_matches) {
    throw new Error(`Apenas ${night.slots_remaining} vaga(s) livre(s) na noite (teto de ${night.total_slots} jogos). Pediu ${num_matches}.`);
  }

  // 3. Atletas elegíveis com prioridade:
  //    Prioridade 1 — disponíveis E sem jogo oficial esta noite ("ficaram sem jogo")
  //    Prioridade 2 — disponíveis E já escalados no oficial ("aproveitam a viagem")
  const scheduledSet = new Set(night.scheduled_player_ids);
  const priority1 = allPlayers.filter(p => !excluded_player_ids.includes(p.id_player) && !scheduledSet.has(p.id_player));
  const priority2 = allPlayers.filter(p => !excluded_player_ids.includes(p.id_player) && scheduledSet.has(p.id_player));

  const needed = num_matches * 4;
  const totalEligible = priority1.length + priority2.length;
  if (totalEligible < needed) {
    throw new Error(`Atletas disponíveis insuficientes na categoria: ${totalEligible} elegíveis, precisa ${needed} (${num_matches} jogo(s) × 4).`);
  }

  // 4. Pool com prioridade: p1 (sem jogo oficial) primeiro, p2 (já no oficial) só se necessário.
  const pool = [...shuffle(priority1), ...shuffle(priority2)].slice(0, needed);
  const pairs = [];
  const remaining = [...pool];
  while (remaining.length >= 2) {
    const a = remaining.shift();
    // Tenta achar alguém do lado oposto
    let partnerIdx = remaining.findIndex(p =>
      (a.side === 'RIGHT' && (p.side === 'LEFT' || p.side === 'EITHER')) ||
      (a.side === 'LEFT' && (p.side === 'RIGHT' || p.side === 'EITHER')) ||
      (a.side === 'EITHER')
    );
    if (partnerIdx === -1) continue; // sem parceiro do lado oposto — descarta, não duplica lado
    const b = remaining.splice(partnerIdx, 1)[0];
    pairs.push([a, b]);
  }

  // 5. Cria a rodada EXHIBITION
  const { data: roundData, error: rErr } = await supabase
    .from('rounds')
    .insert({
      id_tournament,
      id_category,
      round_number: 0, // amistoso — sem numeração no ranking
      scheduled_date,
      window_start: '18:00',
      window_end: '22:00',
      status: 'DRAFT',
      round_type: 'EXHIBITION',
    })
    .select()
    .single();
  if (rErr) throw new Error('Criar rodada amistosa: ' + rErr.message);

  const id_round = roundData.id_round;

  // 6. Bulk insert doubles
  const doublesToInsert = pairs.map(([a, b]) => ({
    id_tournament,
    id_player1: a.id_player,
    id_player2: b.id_player,
    display_name: `${a.name} / ${b.name}`,
    id_round,
  }));
  const { data: insertedDoubles, error: dErr } = await supabase
    .from('doubles')
    .insert(doublesToInsert)
    .select();
  if (dErr) throw new Error('Criar duplas amistosas: ' + dErr.message);

  // 7. Attendance — todos selecionados entram como NO_RESPONSE
  const attendanceRows = pool.map(p => ({
    id_round,
    id_player: p.id_player,
    status: 'NO_RESPONSE',
  }));
  await supabase.from('round_attendance').insert(attendanceRows);

  // 8. Confirma automaticamente — aloca quadra/horário sem passo manual
  const confirmResult = await confirmRound(id_round);

  return {
    id_round,
    round_type: 'EXHIBITION',
    doubles: insertedDoubles,
    num_matches,
    players_used: pool.map(p => ({ id_player: p.id_player, name: p.name })),
    schedule: confirmResult.schedule,
    warnings: [],
  };
}

module.exports = {
  drawWeeklyRound,
  redrawRound,
  confirmRound,
  closeRound,
  getNightStatus,
  addExhibitionMatches,
};
