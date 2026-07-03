// AUDITORIA B — Sanidade dos Jogos (READ-ONLY)
// Dimensão B de auditoria do ranking SRB 2026
// Detecta anomalias em matches e doubles para id_tournament=7
// Data de referência: 2026-06-26

const supabase = require('../../supabase');
const fs = require('fs');
const path = require('path');

const ID_TOURNAMENT = 7;
const TODAY = '2026-06-26';
const OUTPUT_PATH = 'C:/Users/aless/AppData/Local/Temp/claude/c--obralivre/9484ee84-3113-43fa-bba2-ad6b4cbae786/scratchpad/audit_B.json';

async function main() {
  console.log('=== AUDITORIA B — Sanidade dos Jogos ===');
  console.log(`Torneio: ${ID_TOURNAMENT} | Data ref: ${TODAY}`);

  // ── 1. Carregar dados base ──────────────────────────────────────────────────
  console.log('\n[1/8] Carregando dados base...');

  // rounds do torneio
  const { data: rounds, error: errRounds } = await supabase
    .from('rounds')
    .select('id_round, id_category, round_number, scheduled_date, status, round_type')
    .eq('id_tournament', ID_TOURNAMENT);
  if (errRounds) throw new Error(`rounds: ${errRounds.message}`);
  console.log(`  rounds: ${rounds.length}`);

  const roundMap = {};
  const roundCatMap = {};
  for (const r of rounds) {
    roundMap[r.id_round] = r;
    roundCatMap[r.id_round] = r.id_category;
  }
  const roundIds = rounds.map(r => r.id_round);

  // doubles do torneio
  const { data: doubles, error: errDoubles } = await supabase
    .from('doubles')
    .select('id_double, id_player1, id_player2, id_round, display_name')
    .in('id_round', roundIds);
  if (errDoubles) throw new Error(`doubles: ${errDoubles.message}`);
  console.log(`  doubles: ${doubles.length}`);

  const doubleMap = {};
  for (const d of doubles) doubleMap[d.id_double] = d;
  const doubleIds = new Set(doubles.map(d => d.id_double));

  // players do torneio
  const { data: players, error: errPlayers } = await supabase
    .from('players')
    .select('id_player, name, side, category_id, active')
    .eq('id_tournament', ID_TOURNAMENT);
  if (errPlayers) throw new Error(`players: ${errPlayers.message}`);
  console.log(`  players: ${players.length}`);

  const playerMap = {};
  for (const p of players) playerMap[p.id_player] = p;

  // matches do torneio (via doubles que pertencem aos rounds do torneio)
  // Precisamos buscar matches cujos doubles pertençam ao torneio
  const doubleIdList = doubles.map(d => d.id_double);

  // Buscar matches em lotes (Supabase limita o .in() a 1000)
  let allMatches = [];
  const BATCH = 800;
  for (let i = 0; i < doubleIdList.length; i += BATCH) {
    const batch = doubleIdList.slice(i, i + BATCH);
    const { data: mBatch, error: mErr } = await supabase
      .from('matches')
      .select('id_match, id_double_a, id_double_b, id_court, scheduled_at, games_double_a, games_double_b, status, player_score_a, player_score_b, player_score_submitted_by, absent_player_ids, moderator_approved')
      .in('id_double_a', batch);
    if (mErr) throw new Error(`matches batch A: ${mErr.message}`);
    allMatches.push(...(mBatch || []));
  }
  // Dedup por id_match (um match pode aparecer 2x se ambas duplas estão no batch)
  const matchById = {};
  for (const m of allMatches) matchById[m.id_match] = m;

  // Também buscar pelo id_double_b para pegar matches que não apareceram pelo A
  let allMatchesB = [];
  for (let i = 0; i < doubleIdList.length; i += BATCH) {
    const batch = doubleIdList.slice(i, i + BATCH);
    const { data: mBatch, error: mErr } = await supabase
      .from('matches')
      .select('id_match, id_double_a, id_double_b, id_court, scheduled_at, games_double_a, games_double_b, status, player_score_a, player_score_b, player_score_submitted_by, absent_player_ids, moderator_approved')
      .in('id_double_b', batch);
    if (mErr) throw new Error(`matches batch B: ${mErr.message}`);
    allMatchesB.push(...(mBatch || []));
  }
  for (const m of allMatchesB) matchById[m.id_match] = m;

  const matches = Object.values(matchById);
  console.log(`  matches (dedup): ${matches.length}`);

  // Mapa double → categoria (via round)
  function getCat(doubleId) {
    const d = doubleMap[doubleId];
    if (!d) return 'DESCONHECIDA';
    const r = roundMap[d.id_round];
    return r ? String(r.id_category) : 'DESCONHECIDA';
  }

  function getDoubleDisplay(doubleId) {
    const d = doubleMap[doubleId];
    return d ? (d.display_name || `double#${doubleId}`) : `INEXISTENTE#${doubleId}`;
  }

  function getScheduledDate(match) {
    // Primeiro tenta scheduled_at do match
    if (match.scheduled_at) return match.scheduled_at.split('T')[0];
    // Fallback: scheduled_date do round via double_a
    const d = doubleMap[match.id_double_a];
    if (d) {
      const r = roundMap[d.id_round];
      if (r) return r.scheduled_date;
    }
    return null;
  }

  // ── 2. FINISHED com placar inválido ─────────────────────────────────────────
  console.log('\n[2/8] FINISHED com placar inválido...');
  const placar_invalido = [];
  for (const m of matches) {
    if (m.status !== 'FINISHED') continue;
    const a = m.games_double_a;
    const b = m.games_double_b;
    let motivo = null;
    if (a === b && a !== null) {
      motivo = `empate ${a}x${b}`;
    } else if ((a === null || a === 0) && (b === null || b === 0)) {
      motivo = `ambos null/0 (sem placar real)`;
    } else if (a === null && b === null) {
      motivo = `ambos null`;
    }
    if (motivo) {
      placar_invalido.push({
        id_match: m.id_match,
        categoria: getCat(m.id_double_a),
        duplaA: getDoubleDisplay(m.id_double_a),
        duplaB: getDoubleDisplay(m.id_double_b),
        games: `${a}x${b}`,
        motivo
      });
    }
  }
  console.log(`  → ${placar_invalido.length} casos`);

  // ── 3. IN_PROGRESS travados ──────────────────────────────────────────────────
  console.log('\n[3/8] IN_PROGRESS travados...');
  const in_progress = [];
  for (const m of matches) {
    if (m.status !== 'IN_PROGRESS') continue;
    in_progress.push({
      id_match: m.id_match,
      categoria: getCat(m.id_double_a),
      duplaA: getDoubleDisplay(m.id_double_a),
      duplaB: getDoubleDisplay(m.id_double_b),
      scheduled_at: m.scheduled_at,
      moderator_approved: m.moderator_approved
    });
  }
  console.log(`  → ${in_progress.length} casos`);

  // ── 4. TO_PLAY vencidos ──────────────────────────────────────────────────────
  console.log('\n[4/8] TO_PLAY vencidos...');
  const to_play_vencidos = [];
  for (const m of matches) {
    if (m.status !== 'TO_PLAY') continue;
    const dt = getScheduledDate(m);
    if (dt && dt < TODAY) {
      to_play_vencidos.push({
        id_match: m.id_match,
        categoria: getCat(m.id_double_a),
        data: dt,
        duplaA: getDoubleDisplay(m.id_double_a),
        duplaB: getDoubleDisplay(m.id_double_b),
        scheduled_at: m.scheduled_at
      });
    }
  }
  // Agrupar por categoria e data para o resumo
  to_play_vencidos.sort((a, b) => a.categoria.localeCompare(b.categoria) || a.data.localeCompare(b.data));
  console.log(`  → ${to_play_vencidos.length} casos`);

  // ── 5. WO ────────────────────────────────────────────────────────────────────
  console.log('\n[5/8] WO...');
  const wo = [];
  for (const m of matches) {
    if (m.status !== 'WO') continue;
    const absentOk = Array.isArray(m.absent_player_ids) && m.absent_player_ids.length > 0;
    wo.push({
      id_match: m.id_match,
      categoria: getCat(m.id_double_a),
      duplaA: getDoubleDisplay(m.id_double_a),
      duplaB: getDoubleDisplay(m.id_double_b),
      absent_player_ids: m.absent_player_ids,
      absent_preenchido: absentOk,
      games: `${m.games_double_a}x${m.games_double_b}`,
      scheduled_at: m.scheduled_at
    });
  }
  console.log(`  → ${wo.length} casos`);

  // ── 6. Placar do atleta divergente do oficial ────────────────────────────────
  console.log('\n[6/8] Placar atleta vs oficial...');
  const player_score_divergente = [];
  for (const m of matches) {
    const psa = m.player_score_a;
    const psb = m.player_score_b;
    const ga = m.games_double_a;
    const gb = m.games_double_b;
    // Só compara se pelo menos um dos lados tem player_score preenchido
    if (psa === null && psb === null) continue;
    const divA = psa !== null && psa !== ga;
    const divB = psb !== null && psb !== gb;
    if (divA || divB) {
      player_score_divergente.push({
        id_match: m.id_match,
        categoria: getCat(m.id_double_a),
        duplaA: getDoubleDisplay(m.id_double_a),
        duplaB: getDoubleDisplay(m.id_double_b),
        status: m.status,
        oficial: `${ga}x${gb}`,
        atleta: `${psa}x${psb}`,
        submitido_por: m.player_score_submitted_by
      });
    }
  }
  console.log(`  → ${player_score_divergente.length} casos`);

  // ── 7. Duplas órfãs ──────────────────────────────────────────────────────────
  console.log('\n[7/8] Duplas órfãs...');
  const usedDoubles = new Set();
  for (const m of matches) {
    usedDoubles.add(m.id_double_a);
    usedDoubles.add(m.id_double_b);
  }
  const orphanDoubles = doubles.filter(d => !usedDoubles.has(d.id_double));
  const doubles_orfas = {
    total: orphanDoubles.length,
    amostra: orphanDoubles.slice(0, 20).map(d => ({
      id_double: d.id_double,
      display_name: d.display_name,
      id_round: d.id_round,
      categoria: roundCatMap[d.id_round] || 'DESCONHECIDA',
      id_player1: d.id_player1,
      id_player2: d.id_player2
    }))
  };
  console.log(`  → ${orphanDoubles.length} duplas órfãs`);

  // ── 8. Integridade referencial ───────────────────────────────────────────────
  console.log('\n[8/8] Integridade referencial...');

  // 8a. matches cujo id_double_a ou id_double_b não existe em doubles
  const match_double_inexistente = [];
  for (const m of matches) {
    const missingA = !doubleIds.has(m.id_double_a);
    const missingB = !doubleIds.has(m.id_double_b);
    if (missingA || missingB) {
      match_double_inexistente.push({
        id_match: m.id_match,
        id_double_a: m.id_double_a,
        id_double_b: m.id_double_b,
        missing_a: missingA,
        missing_b: missingB,
        status: m.status
      });
    }
  }
  console.log(`  → match_double_inexistente: ${match_double_inexistente.length}`);

  // 8b. doubles cujo id_player1 ou id_player2 não existe ou está inativo
  const double_player_invalido = [];
  for (const d of doubles) {
    const p1 = playerMap[d.id_player1];
    const p2 = playerMap[d.id_player2];
    const issues = [];
    if (!p1) issues.push(`player1#${d.id_player1} não existe`);
    else if (!p1.active) issues.push(`player1#${d.id_player1} (${p1.name}) inativo`);
    if (!p2) issues.push(`player2#${d.id_player2} não existe`);
    else if (!p2.active) issues.push(`player2#${d.id_player2} (${p2.name}) inativo`);
    if (issues.length > 0) {
      double_player_invalido.push({
        id_double: d.id_double,
        display_name: d.display_name,
        id_round: d.id_round,
        categoria: roundCatMap[d.id_round] || 'DESCONHECIDA',
        problemas: issues
      });
    }
  }
  console.log(`  → double_player_invalido: ${double_player_invalido.length}`);

  // 8c. matches onde as duas duplas têm id_round diferente
  const match_rounds_divergentes = [];
  for (const m of matches) {
    const dA = doubleMap[m.id_double_a];
    const dB = doubleMap[m.id_double_b];
    if (!dA || !dB) continue; // já coberto acima
    if (dA.id_round !== dB.id_round) {
      match_rounds_divergentes.push({
        id_match: m.id_match,
        id_double_a: m.id_double_a,
        round_a: dA.id_round,
        id_double_b: m.id_double_b,
        round_b: dB.id_round,
        status: m.status,
        categoria_a: roundCatMap[dA.id_round] || '?',
        categoria_b: roundCatMap[dB.id_round] || '?'
      });
    }
  }
  console.log(`  → match_rounds_divergentes: ${match_rounds_divergentes.length}`);

  // ── 9. absent_player_ids com jogadores estranhos ─────────────────────────────
  console.log('\n[9/9] absent_player_ids estranhos...');
  const absent_ids_estranhos = [];
  for (const m of matches) {
    if (!Array.isArray(m.absent_player_ids) || m.absent_player_ids.length === 0) continue;
    const dA = doubleMap[m.id_double_a];
    const dB = doubleMap[m.id_double_b];
    const validPlayers = new Set();
    if (dA) { validPlayers.add(dA.id_player1); validPlayers.add(dA.id_player2); }
    if (dB) { validPlayers.add(dB.id_player1); validPlayers.add(dB.id_player2); }
    const strangers = m.absent_player_ids.filter(pid => !validPlayers.has(pid));
    if (strangers.length > 0) {
      const strangerNames = strangers.map(pid => {
        const p = playerMap[pid];
        return p ? `${pid}(${p.name})` : `${pid}(DESCONHECIDO)`;
      });
      absent_ids_estranhos.push({
        id_match: m.id_match,
        categoria: getCat(m.id_double_a),
        duplaA: getDoubleDisplay(m.id_double_a),
        duplaB: getDoubleDisplay(m.id_double_b),
        status: m.status,
        absent_player_ids: m.absent_player_ids,
        ids_estranhos: strangerNames
      });
    }
  }
  console.log(`  → ${absent_ids_estranhos.length} casos`);

  // ── Montar resultado ──────────────────────────────────────────────────────────
  const result = {
    _meta: {
      gerado_em: new Date().toISOString(),
      id_tournament: ID_TOURNAMENT,
      data_referencia: TODAY,
      total_rounds: rounds.length,
      total_doubles: doubles.length,
      total_matches: matches.length,
      total_players: players.length
    },
    placar_invalido,
    in_progress,
    to_play_vencidos,
    wo,
    player_score_divergente,
    doubles_orfas,
    integridade: {
      match_double_inexistente,
      double_player_invalido,
      match_rounds_divergentes
    },
    absent_ids_estranhos
  };

  // Garantir que o dir existe
  const outDir = path.dirname(OUTPUT_PATH);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(result, null, 2), 'utf-8');
  console.log(`\nJSON salvo em: ${OUTPUT_PATH}`);

  // ── Resumo ────────────────────────────────────────────────────────────────────
  console.log('\n========== RESUMO AUDITORIA B ==========');
  console.log(`Total matches analisados: ${matches.length}`);
  console.log(`\n1. FINISHED placar inválido: ${placar_invalido.length}`);
  if (placar_invalido.length > 0) placar_invalido.slice(0, 5).forEach(x => console.log(`   id=${x.id_match} cat=${x.categoria} ${x.duplaA} vs ${x.duplaB} — ${x.motivo}`));

  console.log(`\n2. IN_PROGRESS travados: ${in_progress.length}`);
  if (in_progress.length > 0) in_progress.forEach(x => console.log(`   id=${x.id_match} cat=${x.categoria} sched=${x.scheduled_at}`));

  console.log(`\n3. TO_PLAY vencidos: ${to_play_vencidos.length}`);
  // Agrupar por cat+data
  const tpvGroup = {};
  for (const x of to_play_vencidos) {
    const k = `cat${x.categoria}|${x.data}`;
    if (!tpvGroup[k]) tpvGroup[k] = 0;
    tpvGroup[k]++;
  }
  Object.entries(tpvGroup).forEach(([k, n]) => console.log(`   ${k}: ${n} jogos`));

  console.log(`\n4. WO: ${wo.length}`);
  const woSemAbsent = wo.filter(x => !x.absent_preenchido);
  console.log(`   Sem absent_player_ids: ${woSemAbsent.length}`);
  if (woSemAbsent.length > 0) woSemAbsent.forEach(x => console.log(`   id=${x.id_match} cat=${x.categoria}`));

  console.log(`\n5. Player score divergente: ${player_score_divergente.length}`);
  if (player_score_divergente.length > 0) player_score_divergente.slice(0, 5).forEach(x => console.log(`   id=${x.id_match} cat=${x.categoria} oficial=${x.oficial} atleta=${x.atleta} por=${x.submitido_por}`));

  console.log(`\n6. Duplas órfãs (sem nenhum match): ${doubles_orfas.total}`);
  if (doubles_orfas.amostra.length > 0) doubles_orfas.amostra.slice(0, 5).forEach(x => console.log(`   double#${x.id_double} cat=${x.categoria} round=${x.id_round} "${x.display_name}"`));

  console.log(`\n7. Integridade referencial:`);
  console.log(`   match_double_inexistente: ${match_double_inexistente.length}`);
  console.log(`   double_player_invalido: ${double_player_invalido.length}`);
  if (double_player_invalido.length > 0) double_player_invalido.slice(0, 5).forEach(x => console.log(`   double#${x.id_double} cat=${x.categoria} — ${x.problemas.join('; ')}`));
  console.log(`   match_rounds_divergentes: ${match_rounds_divergentes.length}`);
  if (match_rounds_divergentes.length > 0) match_rounds_divergentes.slice(0, 5).forEach(x => console.log(`   id=${x.id_match} roundA=${x.round_a} roundB=${x.round_b}`));

  console.log(`\n8. absent_ids estranhos: ${absent_ids_estranhos.length}`);
  if (absent_ids_estranhos.length > 0) absent_ids_estranhos.forEach(x => console.log(`   id=${x.id_match} estranhos=${x.ids_estranhos.join(',')}`));

  console.log('\n=========================================');
}

main().catch(err => {
  console.error('ERRO FATAL:', err);
  process.exit(1);
});
