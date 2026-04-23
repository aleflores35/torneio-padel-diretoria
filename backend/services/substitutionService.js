// substitutionService.js — substituição de jogador em jogo já confirmado
const supabase = require('../supabase');

function sidesCompatible(a, b) {
  if (a === 'EITHER' || b === 'EITHER') return true;
  return a !== b; // não pode ter 1R+1R nem 1L+1L
}

// Carrega contexto completo de um match: duplas + jogadores + rodada
async function loadMatchContext(id_match) {
  const { data: match, error: mErr } = await supabase.from('matches').select('*').eq('id_match', id_match).single();
  if (mErr || !match) throw new Error('Jogo não encontrado');

  const { data: doubles, error: dErr } = await supabase
    .from('doubles').select('*').in('id_double', [match.id_double_a, match.id_double_b]);
  if (dErr || !doubles || doubles.length !== 2) throw new Error('Duplas do jogo não encontradas');

  const id_round = doubles[0].id_round;
  const { data: round } = await supabase.from('rounds').select('*').eq('id_round', id_round).single();
  if (!round) throw new Error('Rodada não encontrada');

  const playerIds = [...new Set(doubles.flatMap(d => [d.id_player1, d.id_player2]).filter(Boolean))];
  const { data: players } = await supabase
    .from('players').select('id_player, name, side, category_id').in('id_player', playerIds);
  const playerMap = {};
  (players || []).forEach(p => { playerMap[p.id_player] = p; });

  return { match, doubles, round, playerMap };
}

// GET /api/matches/:id/details — retorna duplas com IDs e lados dos jogadores
async function getMatchDetails(id_match) {
  const { match, doubles, round, playerMap } = await loadMatchContext(id_match);

  const enrichDouble = (d) => ({
    id_double: d.id_double,
    display_name: d.display_name,
    players: [d.id_player1, d.id_player2].map(pid => ({
      id_player: pid,
      name: playerMap[pid]?.name || `#${pid}`,
      side: playerMap[pid]?.side || 'EITHER',
    })),
  });

  const doubleA = doubles.find(d => d.id_double === match.id_double_a);
  const doubleB = doubles.find(d => d.id_double === match.id_double_b);

  return {
    id_match,
    status: match.status,
    id_round: round.id_round,
    round_status: round.status,
    id_category: round.id_category,
    id_tournament: round.id_tournament,
    scheduled_at: match.scheduled_at,
    double_a: enrichDouble(doubleA),
    double_b: enrichDouble(doubleB),
  };
}

// GET /api/matches/:id/substitute-candidates?out_player_id=X
// Retorna candidatos ordenados por prioridade (ROTATED/BYE primeiro)
async function getSubstituteCandidates(id_match, outPlayerId) {
  const { match, doubles, round, playerMap } = await loadMatchContext(id_match);

  const outDouble = doubles.find(d => d.id_player1 === outPlayerId || d.id_player2 === outPlayerId);
  if (!outDouble) throw new Error('Jogador não encontrado neste jogo');
  const partnerId = outDouble.id_player1 === outPlayerId ? outDouble.id_player2 : outDouble.id_player1;
  const partner = playerMap[partnerId];
  if (!partner) throw new Error('Parceiro não encontrado');

  // 1. Jogadores da mesma categoria
  const { data: catPlayers } = await supabase
    .from('players').select('id_player, name, side, category_id')
    .eq('id_tournament', round.id_tournament)
    .eq('category_id', round.id_category);

  // 2. Jogadores já em duplas desta rodada (excluídos — salvo o out)
  const { data: roundDoubles } = await supabase
    .from('doubles').select('id_player1, id_player2').eq('id_round', round.id_round);
  const busyIds = new Set();
  (roundDoubles || []).forEach(d => {
    busyIds.add(d.id_player1);
    busyIds.add(d.id_player2);
  });

  // 3. Attendance da rodada (pra priorizar ROTATED/BYE)
  const { data: attendance } = await supabase
    .from('round_attendance').select('id_player, status').eq('id_round', round.id_round);
  const attMap = {};
  (attendance || []).forEach(a => { attMap[a.id_player] = a.status; });

  // 4. Filtrar candidatos: mesma categoria, não o próprio out, não está ocupado, lado compatível com parceiro
  const candidates = (catPlayers || [])
    .filter(p => p.id_player !== outPlayerId)
    .filter(p => !busyIds.has(p.id_player))
    .filter(p => sidesCompatible(p.side, partner.side))
    .map(p => ({
      id_player: p.id_player,
      name: p.name,
      side: p.side,
      attendance_status: attMap[p.id_player] || 'NOT_SELECTED',
    }));

  // 5. Ordenar: disponíveis (ROTATED/BYE/NOT_SELECTED) > DECLINED > NO_RESPONSE, depois nome
  const priority = (s) => {
    if (s === 'ROTATED' || s === 'NOT_SELECTED' || s === 'BYE') return 0;
    if (s === 'DECLINED') return 1;
    return 2;
  };
  candidates.sort((a, b) => {
    const pa = priority(a.attendance_status);
    const pb = priority(b.attendance_status);
    if (pa !== pb) return pa - pb;
    return a.name.localeCompare(b.name);
  });

  return {
    partner: { id_player: partner.id_player, name: partner.name, side: partner.side },
    out_player: { id_player: outPlayerId, name: playerMap[outPlayerId]?.name || '?' },
    candidates,
  };
}

// POST /api/matches/:id/substitute { outPlayerId, inPlayerId }
async function substitutePlayer(id_match, outPlayerId, inPlayerId) {
  if (outPlayerId === inPlayerId) throw new Error('Substituto deve ser diferente do jogador atual');

  const { match, doubles, round, playerMap } = await loadMatchContext(id_match);

  if (['FINISHED', 'WO', 'IN_PROGRESS', 'LIVE'].includes(match.status)) {
    throw new Error('Não é possível substituir em jogo finalizado ou em andamento');
  }
  if (round.status === 'FINISHED') {
    throw new Error('Rodada já finalizada — substituição não permitida');
  }

  const outDouble = doubles.find(d => d.id_player1 === outPlayerId || d.id_player2 === outPlayerId);
  if (!outDouble) throw new Error('Jogador não encontrado neste jogo');
  const partnerId = outDouble.id_player1 === outPlayerId ? outDouble.id_player2 : outDouble.id_player1;

  // Buscar dados do substituto (pode não estar no playerMap do match)
  const { data: inPlayer } = await supabase
    .from('players').select('id_player, name, side, category_id').eq('id_player', inPlayerId).single();
  if (!inPlayer) throw new Error('Substituto não encontrado');

  const outPlayer = playerMap[outPlayerId];
  const partner = playerMap[partnerId];

  if (inPlayer.category_id !== outPlayer.category_id) {
    throw new Error('Substituto deve ser da mesma categoria');
  }
  if (!sidesCompatible(inPlayer.side, partner.side)) {
    throw new Error(`Substituto (${inPlayer.side}) incompatível com parceiro ${partner.name} (${partner.side})`);
  }

  // Validar que o substituto não está em outra dupla da mesma rodada
  const { data: roundDoubles } = await supabase
    .from('doubles').select('id_double, id_player1, id_player2').eq('id_round', round.id_round);
  const alreadyPlaying = (roundDoubles || []).some(d =>
    d.id_double !== outDouble.id_double && (d.id_player1 === inPlayerId || d.id_player2 === inPlayerId)
  );
  if (alreadyPlaying) throw new Error('Substituto já está jogando em outra dupla desta rodada');

  // 1. Atualizar dupla
  const newId1 = outDouble.id_player1 === outPlayerId ? inPlayerId : outDouble.id_player1;
  const newId2 = outDouble.id_player2 === outPlayerId ? inPlayerId : outDouble.id_player2;
  const name1 = newId1 === partnerId ? partner.name : inPlayer.name;
  const name2 = newId2 === partnerId ? partner.name : inPlayer.name;
  const new_display_name = `${name1} / ${name2}`;

  const { error: upErr } = await supabase.from('doubles')
    .update({ id_player1: newId1, id_player2: newId2, display_name: new_display_name })
    .eq('id_double', outDouble.id_double);
  if (upErr) throw new Error('Atualizar dupla: ' + upErr.message);

  // 2. Attendance: out → DECLINED, in → NO_RESPONSE
  const now = new Date().toISOString();
  await supabase.from('round_attendance').upsert([
    {
      id_round: round.id_round, id_player: outPlayerId, status: 'DECLINED',
      responded_by: 'ADMIN', notes: `Substituído por ${inPlayer.name}`, responded_at: now
    },
    {
      id_round: round.id_round, id_player: inPlayerId, status: 'NO_RESPONSE',
      responded_by: 'ADMIN', notes: `Substituiu ${outPlayer.name}`, responded_at: now
    },
  ], { onConflict: 'id_round,id_player' });

  // 3. Partnerships: reverter (out+partner), incrementar (in+partner)
  const outPair = [Math.min(outPlayerId, partnerId), Math.max(outPlayerId, partnerId)];
  const { data: oldP } = await supabase.from('partnerships')
    .select('*')
    .eq('id_tournament', round.id_tournament).eq('id_category', round.id_category)
    .eq('id_player1', outPair[0]).eq('id_player2', outPair[1])
    .maybeSingle();
  if (oldP) {
    if (oldP.times_paired > 1) {
      await supabase.from('partnerships').update({ times_paired: oldP.times_paired - 1 })
        .eq('id_partnership', oldP.id_partnership);
    } else {
      await supabase.from('partnerships').delete().eq('id_partnership', oldP.id_partnership);
    }
  }

  const inPair = [Math.min(inPlayerId, partnerId), Math.max(inPlayerId, partnerId)];
  const { data: newP } = await supabase.from('partnerships')
    .select('*')
    .eq('id_tournament', round.id_tournament).eq('id_category', round.id_category)
    .eq('id_player1', inPair[0]).eq('id_player2', inPair[1])
    .maybeSingle();
  if (newP) {
    await supabase.from('partnerships').update({
      times_paired: newP.times_paired + 1, last_round_id: round.id_round
    }).eq('id_partnership', newP.id_partnership);
  } else {
    await supabase.from('partnerships').insert({
      id_tournament: round.id_tournament, id_category: round.id_category,
      id_player1: inPair[0], id_player2: inPair[1],
      times_paired: 1, last_round_id: round.id_round
    });
  }

  return {
    ok: true,
    id_match,
    out_player: { id_player: outPlayerId, name: outPlayer.name },
    in_player: { id_player: inPlayerId, name: inPlayer.name },
    partner: { id_player: partnerId, name: partner.name },
    new_display_name,
  };
}

// DELETE /api/matches/:id — cancela jogo amistoso (EXHIBITION).
// Não permitido para rodadas oficiais (REGULAR/MAKEUP). Limpa duplas órfãs e,
// se a rodada amistosa ficar vazia, remove a rodada e suas presenças.
async function cancelExhibitionMatch(id_match) {
  const { match, doubles, round } = await loadMatchContext(id_match);

  if (round.round_type !== 'EXHIBITION') {
    throw new Error('Apenas jogos amistosos podem ser cancelados por aqui');
  }
  if (['IN_PROGRESS', 'FINISHED'].includes(match.status)) {
    throw new Error('Jogo em andamento ou finalizado não pode ser cancelado');
  }

  // 1. Deleta o match
  const { error: delMatchErr } = await supabase.from('matches').delete().eq('id_match', id_match);
  if (delMatchErr) throw new Error('Cancelar match: ' + delMatchErr.message);

  // 2. Deleta duplas órfãs (não referenciadas em outros matches)
  const doubleIds = [match.id_double_a, match.id_double_b].filter(Boolean);
  for (const id_double of doubleIds) {
    const { data: refs } = await supabase
      .from('matches').select('id_match').or(`id_double_a.eq.${id_double},id_double_b.eq.${id_double}`).limit(1);
    if (!refs || refs.length === 0) {
      await supabase.from('doubles').delete().eq('id_double', id_double);
    }
  }

  // 3. Se a rodada exhibition ficou vazia, remove a rodada e suas presenças
  const { data: remainingDoubles } = await supabase
    .from('doubles').select('id_double').eq('id_round', round.id_round).limit(1);
  if (!remainingDoubles || remainingDoubles.length === 0) {
    await supabase.from('round_attendance').delete().eq('id_round', round.id_round);
    await supabase.from('rounds').delete().eq('id_round', round.id_round);
  }

  return {
    ok: true,
    id_match,
    deleted_doubles: doubleIds,
    round_deleted: !remainingDoubles || remainingDoubles.length === 0,
  };
}

module.exports = { getMatchDetails, getSubstituteCandidates, substitutePlayer, cancelExhibitionMatch };
