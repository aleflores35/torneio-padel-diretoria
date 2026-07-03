/**
 * _auditoria_futuros.js
 * Auditoria READ-ONLY dos jogos TO_PLAY (futuros) do torneio 7.
 * Verifica: parceria repetida, adversário mesma posição, adversário qualquer.
 * NÃO ESCREVE NO BANCO.
 */

const supabase = require('../../supabase');
const fs = require('fs');

const ID_TOURNAMENT = 7;
const OUTPUT_PATH = 'C:/Users/aless/AppData/Local/Temp/claude/c--obralivre/9484ee84-3113-43fa-bba2-ad6b4cbae786/scratchpad/audit_futuros.json';

function pairKey(a, b) {
  return [a, b].sort((x, y) => x - y).join('_');
}

async function main() {
  // 1. Buscar rounds REGULAR do torneio
  const { data: rounds, error: roundsErr } = await supabase
    .from('rounds')
    .select('id_round, id_category, round_number, scheduled_date, round_type, status')
    .eq('id_tournament', ID_TOURNAMENT)
    .eq('round_type', 'REGULAR');

  if (roundsErr) throw new Error('rounds: ' + roundsErr.message);
  console.log(`Rounds REGULAR encontrados: ${rounds.length}`);

  const roundIds = rounds.map(r => r.id_round);
  const roundMap = Object.fromEntries(rounds.map(r => [r.id_round, r]));

  // 2. Buscar doubles desses rounds
  const { data: doubles, error: doublesErr } = await supabase
    .from('doubles')
    .select('id_double, id_player1, id_player2, id_round, display_name')
    .in('id_round', roundIds);

  if (doublesErr) throw new Error('doubles: ' + doublesErr.message);
  console.log(`Doubles encontrados: ${doubles.length}`);

  const doubleMap = Object.fromEntries(doubles.map(d => [d.id_double, d]));

  // 3. Buscar matches dessas doubles (via id_double_a)
  const doubleIds = doubles.map(d => d.id_double);

  const { data: matches, error: matchesErr } = await supabase
    .from('matches')
    .select('id_match, id_double_a, id_double_b, scheduled_at, status')
    .in('id_double_a', doubleIds);

  if (matchesErr) throw new Error('matches: ' + matchesErr.message);
  console.log(`Matches encontrados (via id_double_a): ${matches.length}`);

  // 4. Buscar players
  const { data: players, error: playersErr } = await supabase
    .from('players')
    .select('id_player, name, side, category_id, active');

  if (playersErr) throw new Error('players: ' + playersErr.message);
  const playerMap = Object.fromEntries(players.map(p => [p.id_player, p]));

  // 5. Filtrar apenas matches onde AMBAS as doubles pertencem a rounds REGULAR do torneio
  const roundIdSet = new Set(roundIds);
  const validMatches = matches.filter(m => {
    const da = doubleMap[m.id_double_a];
    const db = doubleMap[m.id_double_b];
    if (!da || !db) return false;
    return roundIdSet.has(da.id_round) && roundIdSet.has(db.id_round);
  });

  console.log(`Matches válidos (ambas doubles em rounds REGULAR do torneio): ${validMatches.length}`);

  // Separar passado e futuro
  const pastMatches = validMatches.filter(m => m.status === 'FINISHED' || m.status === 'WO');
  const futureMatches = validMatches.filter(m => m.status === 'TO_PLAY');

  console.log(`  Passado (FINISHED/WO): ${pastMatches.length}`);
  console.log(`  Futuro (TO_PLAY): ${futureMatches.length}`);

  // Helper: obter categoria de um match
  function getCategoryId(match) {
    const da = doubleMap[match.id_double_a];
    if (!da) return null;
    const round = roundMap[da.id_round];
    return round ? round.id_category : null;
  }

  // Helper: obter players de um double
  function getPlayers(idDouble) {
    const d = doubleMap[idDouble];
    if (!d) return { right: null, left: null, displayName: '?' };
    return {
      right: d.id_player1,
      left: d.id_player2,
      displayName: d.display_name
    };
  }

  function playerName(id) {
    return playerMap[id] ? playerMap[id].name : `player_${id}`;
  }

  // ============================================================
  // ANÁLISE 1: PARCERIAS REPETIDAS
  // ============================================================
  // Uma dupla = parceria (right, left) — par não-ordenado de ids
  // Construir mapa: partnershipKey -> list of {id_match, data, tipo}

  const partnershipOccurrences = {}; // key -> [{id_match, data, tipo, id_double}]

  function addPartnership(idDouble, matchId, matchDate, tipo) {
    const d = doubleMap[idDouble];
    if (!d) return;
    const key = pairKey(d.id_player1, d.id_player2);
    if (!partnershipOccurrences[key]) partnershipOccurrences[key] = [];
    partnershipOccurrences[key].push({
      id_match: matchId,
      data: matchDate,
      tipo,
      id_double: idDouble,
      displayName: d.display_name
    });
  }

  for (const m of pastMatches) {
    addPartnership(m.id_double_a, m.id_match, m.scheduled_at, 'passado');
    addPartnership(m.id_double_b, m.id_match, m.scheduled_at, 'passado');
  }
  for (const m of futureMatches) {
    addPartnership(m.id_double_a, m.id_match, m.scheduled_at, 'futuro');
    addPartnership(m.id_double_b, m.id_match, m.scheduled_at, 'futuro');
  }

  // Para cada jogo futuro, verificar se alguma das duas duplas tem parceria que aparece em mais de 1 match total
  const parceriasRepetidasFuturo = [];

  for (const m of futureMatches) {
    const cat = getCategoryId(m);
    for (const idDouble of [m.id_double_a, m.id_double_b]) {
      const d = doubleMap[idDouble];
      if (!d) continue;
      const key = pairKey(d.id_player1, d.id_player2);
      const occs = partnershipOccurrences[key] || [];
      // Filtrar ocorrências que NÃO sejam este próprio match
      const outrasOccs = occs.filter(o => o.id_match !== m.id_match);
      if (outrasOccs.length > 0) {
        parceriasRepetidasFuturo.push({
          categoria: cat,
          dupla: `${playerName(d.id_player1)} / ${playerName(d.id_player2)}`,
          dupla_display: d.display_name,
          id_double: idDouble,
          id_match_futuro: m.id_match,
          data_futuro: m.scheduled_at,
          colide_com: outrasOccs.map(o => ({
            id_match: o.id_match,
            data: o.data,
            tipo: o.tipo
          }))
        });
      }
    }
  }

  // ============================================================
  // ANÁLISE 2: ADVERSÁRIO MESMA POSIÇÃO (RIGHT×RIGHT, LEFT×LEFT)
  // ============================================================
  // Confronto mesma posição: p1a × p1b (RIGHT) e p2a × p2b (LEFT)

  const samePosPairOccurrences = {}; // key("R:p1_p2") -> [{id_match, data, tipo}]

  function addSamePosConfrontation(m, tipo) {
    const pa = getPlayers(m.id_double_a);
    const pb = getPlayers(m.id_double_b);
    if (!pa.right || !pb.right) return;

    // RIGHT vs RIGHT
    const keyR = 'R:' + pairKey(pa.right, pb.right);
    if (!samePosPairOccurrences[keyR]) samePosPairOccurrences[keyR] = [];
    samePosPairOccurrences[keyR].push({
      id_match: m.id_match,
      data: m.scheduled_at,
      tipo,
      lado: 'RIGHT',
      p1: pa.right,
      p2: pb.right
    });

    // LEFT vs LEFT
    const keyL = 'L:' + pairKey(pa.left, pb.left);
    if (!samePosPairOccurrences[keyL]) samePosPairOccurrences[keyL] = [];
    samePosPairOccurrences[keyL].push({
      id_match: m.id_match,
      data: m.scheduled_at,
      tipo,
      lado: 'LEFT',
      p1: pa.left,
      p2: pb.left
    });
  }

  for (const m of pastMatches) addSamePosConfrontation(m, 'passado');
  for (const m of futureMatches) addSamePosConfrontation(m, 'futuro');

  const adversarioMesmaPosicaoFuturo = [];

  for (const m of futureMatches) {
    const cat = getCategoryId(m);
    const pa = getPlayers(m.id_double_a);
    const pb = getPlayers(m.id_double_b);

    for (const [lado, p1, p2] of [['RIGHT', pa.right, pb.right], ['LEFT', pa.left, pb.left]]) {
      if (!p1 || !p2) continue;
      const key = lado[0] + ':' + pairKey(p1, p2);
      const occs = samePosPairOccurrences[key] || [];
      const outrasOccs = occs.filter(o => o.id_match !== m.id_match);
      if (outrasOccs.length > 0) {
        adversarioMesmaPosicaoFuturo.push({
          categoria: cat,
          jogadores: `${playerName(p1)} vs ${playerName(p2)}`,
          lado,
          id_match_futuro: m.id_match,
          data_futuro: m.scheduled_at,
          ja_enfrentaram_em: outrasOccs.map(o => ({
            id_match: o.id_match,
            data: o.data,
            tipo: o.tipo
          }))
        });
      }
    }
  }

  // ============================================================
  // ANÁLISE 3: ADVERSÁRIO QUALQUER (todos os 4 cross-pairs)
  // ============================================================
  // Qualquer par entre {p1a, p2a} e {p1b, p2b}

  const anyPairOccurrences = {}; // key -> [{id_match, data, tipo, p1, p2}]

  function addAnyConfrontation(m, tipo) {
    const pa = getPlayers(m.id_double_a);
    const pb = getPlayers(m.id_double_b);
    const playersA = [pa.right, pa.left].filter(Boolean);
    const playersB = [pb.right, pb.left].filter(Boolean);
    for (const pa_player of playersA) {
      for (const pb_player of playersB) {
        const key = pairKey(pa_player, pb_player);
        if (!anyPairOccurrences[key]) anyPairOccurrences[key] = [];
        anyPairOccurrences[key].push({
          id_match: m.id_match,
          data: m.scheduled_at,
          tipo,
          p1: pa_player,
          p2: pb_player
        });
      }
    }
  }

  for (const m of pastMatches) addAnyConfrontation(m, 'passado');
  for (const m of futureMatches) addAnyConfrontation(m, 'futuro');

  const adversarioQualquerFuturo = [];

  for (const m of futureMatches) {
    const cat = getCategoryId(m);
    const pa = getPlayers(m.id_double_a);
    const pb = getPlayers(m.id_double_b);
    const playersA = [pa.right, pa.left].filter(Boolean);
    const playersB = [pb.right, pb.left].filter(Boolean);

    for (const pa_player of playersA) {
      for (const pb_player of playersB) {
        const key = pairKey(pa_player, pb_player);
        const occs = anyPairOccurrences[key] || [];
        const outrasOccs = occs.filter(o => o.id_match !== m.id_match);
        if (outrasOccs.length > 0) {
          // Verificar se já foi reportado para este match+par
          const jaReportado = adversarioQualquerFuturo.find(
            r => r.id_match_futuro === m.id_match && r.jogadores === `${playerName(pa_player)} vs ${playerName(pb_player)}`
          );
          if (!jaReportado) {
            adversarioQualquerFuturo.push({
              categoria: cat,
              jogadores: `${playerName(pa_player)} vs ${playerName(pb_player)}`,
              id_match_futuro: m.id_match,
              data_futuro: m.scheduled_at,
              ja_enfrentaram_em: outrasOccs.map(o => ({
                id_match: o.id_match,
                data: o.data,
                tipo: o.tipo
              }))
            });
          }
        }
      }
    }
  }

  // ============================================================
  // MONTAR JSON de saída
  // ============================================================

  // Contar por categoria
  const porCategoria = {};
  for (const m of futureMatches) {
    const cat = String(getCategoryId(m) || 'unknown');
    porCategoria[cat] = (porCategoria[cat] || 0) + 1;
  }

  // Deduplicar parcerias repetidas (pode ter dupla A e dupla B do mesmo match)
  // Manter como está — cada dupla é um entry separado, informativo

  const output = {
    totais: {
      jogos_passado_regular: pastMatches.length,
      jogos_futuros_regular: futureMatches.length,
      por_categoria: porCategoria
    },
    parcerias_repetidas_futuro: parceriasRepetidasFuturo,
    adversario_mesma_posicao_repetido_futuro: adversarioMesmaPosicaoFuturo,
    adversario_qualquer_repetido_futuro: adversarioQualquerFuturo,
    resumo: {
      parcerias_repetidas: parceriasRepetidasFuturo.length,
      mesma_pos_repetido: adversarioMesmaPosicaoFuturo.length,
      qualquer_repetido: adversarioQualquerFuturo.length
    }
  };

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2), 'utf8');
  console.log(`\nJSON salvo em: ${OUTPUT_PATH}`);

  // ============================================================
  // CONSOLE: resumo legível
  // ============================================================
  console.log('\n========== RESUMO ==========');
  console.log(`Jogos futuros REGULAR: ${futureMatches.length}`);
  console.log('Por categoria:', JSON.stringify(porCategoria));
  console.log(`\nParcerias repetidas no futuro: ${parceriasRepetidasFuturo.length}`);
  for (const p of parceriasRepetidasFuturo) {
    const tipos = p.colide_com.map(c => c.tipo).join(', ');
    console.log(`  Cat${p.categoria} | Dupla: ${p.dupla} | match_futuro=${p.id_match_futuro} (${p.data_futuro}) | colide com matches [${p.colide_com.map(c=>c.id_match).join(',')}] (${tipos})`);
  }

  console.log(`\nAdversário mesma posição repetido: ${adversarioMesmaPosicaoFuturo.length}`);
  for (const a of adversarioMesmaPosicaoFuturo) {
    const tipos = a.ja_enfrentaram_em.map(c => c.tipo).join(', ');
    console.log(`  Cat${a.categoria} | ${a.lado}: ${a.jogadores} | match_futuro=${a.id_match_futuro} (${a.data_futuro}) | já enfrentaram em [${a.ja_enfrentaram_em.map(c=>c.id_match).join(',')}] (${tipos})`);
  }

  console.log(`\nAdversário qualquer repetido: ${adversarioQualquerFuturo.length}`);
  for (const a of adversarioQualquerFuturo) {
    const tipos = a.ja_enfrentaram_em.map(c => c.tipo).join(', ');
    console.log(`  Cat${a.categoria} | ${a.jogadores} | match_futuro=${a.id_match_futuro} (${a.data_futuro}) | já enfrentaram em [${a.ja_enfrentaram_em.map(c=>c.id_match).join(',')}] (${tipos})`);
  }
}

main().catch(err => {
  console.error('ERRO:', err);
  process.exit(1);
});
