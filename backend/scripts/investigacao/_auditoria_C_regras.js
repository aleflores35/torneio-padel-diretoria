// _auditoria_C_regras.js — Auditoria Dimensao C: Validacao contra Regras de Formato
// READ-ONLY — nao escreve no banco
// id_tournament = 7

const supabase = require('../../supabase');
const fs = require('fs');

const OUTPUT_PATH = 'C:/Users/aless/AppData/Local/Temp/claude/c--obralivre/9484ee84-3113-43fa-bba2-ad6b4cbae786/scratchpad/audit_C.json';
const ID_NARA = 701;

async function fetchAll(table, query) {
  let allData = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await query(table, from, from + pageSize - 1);
    if (error) throw new Error(`Erro ao buscar ${table}: ${error.message}`);
    if (!data || data.length === 0) break;
    allData = allData.concat(data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return allData;
}

async function main() {
  console.log('Iniciando auditoria C...');

  // 1. Buscar categorias
  const { data: categories, error: catErr } = await supabase
    .from('categories')
    .select('id, name');
  if (catErr) throw catErr;
  console.log('Categorias:', categories.map(c => `${c.id}=${c.name}`).join(', '));

  // 2. Buscar rounds (apenas REGULAR)
  const rounds = await fetchAll('rounds', (t, from, to) =>
    supabase.from(t).select('id_round, id_category, round_number, scheduled_date, status, round_type').range(from, to)
  );
  const regularRounds = rounds.filter(r => r.round_type === 'REGULAR');
  const regularRoundIds = new Set(regularRounds.map(r => r.id_round));
  console.log(`Rounds total: ${rounds.length}, REGULAR: ${regularRounds.length}`);

  // 3. Buscar doubles
  const doubles = await fetchAll('doubles', (t, from, to) =>
    supabase.from(t).select('id_double, id_player1, id_player2, id_round, display_name').range(from, to)
  );
  // Filtrar doubles pertencentes a rounds REGULAR
  const regularDoubles = doubles.filter(d => regularRoundIds.has(d.id_round));
  const doubleById = {};
  doubles.forEach(d => { doubleById[d.id_double] = d; });
  console.log(`Doubles total: ${doubles.length}, em rounds REGULAR: ${regularDoubles.length}`);

  // 4. Buscar matches
  const matches = await fetchAll('matches', (t, from, to) =>
    supabase.from(t).select('id_match, id_double_a, id_double_b, scheduled_at, status, games_double_a, games_double_b').range(from, to)
  );
  console.log(`Matches total: ${matches.length}`);

  // Filtrar matches cujas duplas pertencam a rounds REGULAR
  // Um match e REGULAR se ambas as duplas sao de rounds REGULAR
  const regularDoubleIds = new Set(regularDoubles.map(d => d.id_double));

  const regularMatches = matches.filter(m =>
    regularDoubleIds.has(m.id_double_a) && regularDoubleIds.has(m.id_double_b)
  );
  console.log(`Matches REGULAR (ambas duplas em round REGULAR): ${regularMatches.length}`);

  // Status validos para contar como "jogo"
  const VALID_STATUS = new Set(['FINISHED', 'WO', 'TO_PLAY']);

  // 5. Buscar players
  const players = await fetchAll('players', (t, from, to) =>
    supabase.from(t).select('id_player, name, side, category_id, active').range(from, to)
  );
  const activePlayers = players.filter(p => p.active);
  console.log(`Players total: ${players.length}, ativos: ${activePlayers.length}`);

  // Mapa: id_player -> player
  const playerById = {};
  players.forEach(p => { playerById[p.id_player] = p; });

  // Mapa: round -> category
  const roundCatMap = {};
  rounds.forEach(r => { roundCatMap[r.id_round] = r.id_category; });

  // Para cada match REGULAR, derivar categoria via id_double_a -> id_round -> id_category
  function getMatchCategory(match) {
    const da = doubleById[match.id_double_a];
    if (!da) return null;
    return roundCatMap[da.id_round] || null;
  }

  // Resultado por categoria
  const result = {
    por_categoria: [],
    nara_antes_2030: [],
    resumo_violacoes: {
      parcerias_repetidas_total: 0,
      mesma_pos_repetido_total: 0,
      adversario_qualquer_repetido_total: 0,
    }
  };

  // 6. Checar Nara Nunes - matches com horario antes de 20:30
  // Encontrar todos matches onde Nara participa (em qualquer double)
  // Precisamos encontrar quais doubles tem Nara
  const naraDoubles = doubles.filter(d => d.id_player1 === ID_NARA || d.id_player2 === ID_NARA);
  const naraDoubleIds = new Set(naraDoubles.map(d => d.id_double));

  const naraMatches = matches.filter(m =>
    naraDoubleIds.has(m.id_double_a) || naraDoubleIds.has(m.id_double_b)
  );

  for (const m of naraMatches) {
    if (!m.scheduled_at) continue;
    // O banco grava horario local (BRT) mas retorna com offset +00:00
    // Isso e um padrao conhecido: o frontend passa datetime local sem ajuste UTC
    // Portanto: "20:30:00+00:00" = 20:30 horario de Brasilia (nao fazer conversao UTC-3)
    // Extrair hora/minuto direto do string para evitar confusao de timezone
    // Formato: "2026-05-14T20:30:00+00:00"
    const timePart = m.scheduled_at.substring(11, 16); // "HH:MM"
    const [hStr, mStr] = timePart.split(':');
    const hourLocal = parseInt(hStr, 10);
    const minuteLocal = parseInt(mStr, 10);
    // Antes de 20:30 = antes das 20h30 horario local
    if (hourLocal < 20 || (hourLocal === 20 && minuteLocal < 30)) {
      result.nara_antes_2030.push({
        id_match: m.id_match,
        scheduled_at: m.scheduled_at,
        hora_local: timePart
      });
    }
  }
  console.log(`Matches da Nara total: ${naraMatches.length}, antes 20:30: ${result.nara_antes_2030.length}`);

  // 7. Por categoria
  for (const cat of categories) {
    console.log(`\n--- Categoria ${cat.id}: ${cat.name} ---`);

    // Players ativos desta categoria
    const catActivePlayers = activePlayers.filter(p => p.category_id === cat.id);
    const rightPlayers = catActivePlayers.filter(p => p.side === 'RIGHT' || p.side === 'EITHER');
    const leftPlayers = catActivePlayers.filter(p => p.side === 'LEFT' || p.side === 'EITHER');
    const rightIds = new Set(rightPlayers.map(p => p.id_player));
    const leftIds = new Set(leftPlayers.map(p => p.id_player));

    // Players que podem jogar RIGHT (RIGHT ou EITHER)
    const pureRight = catActivePlayers.filter(p => p.side === 'RIGHT');
    const pureLeft = catActivePlayers.filter(p => p.side === 'LEFT');
    const eitherPlayers = catActivePlayers.filter(p => p.side === 'EITHER');

    console.log(`  Ativos: ${catActivePlayers.length} (RIGHT puro: ${pureRight.length}, LEFT puro: ${pureLeft.length}, EITHER: ${eitherPlayers.length})`);

    // Matches REGULAR desta categoria
    const catMatches = regularMatches.filter(m => getMatchCategory(m) === cat.id && VALID_STATUS.has(m.status));
    console.log(`  Matches REGULAR validos: ${catMatches.length}`);

    // Construir lista de parcerias e confrontos a partir dos matches reais
    // Parceria: (p1, p2) de uma mesma dupla que jogou um match
    // key: menor_id + '_' + maior_id para deduplicar
    const partnershipMap = {}; // key -> { p1, p2, matches: [] }
    const samePosMap = {}; // key "RIGHT:pA_pB" -> { jogadores, matches }
    const anyPosMap = {}; // key "pA_pB" -> { jogadores, matches }

    // Jogos por jogador
    const jogosPorJogador = {}; // id_player -> count

    for (const m of catMatches) {
      const da = doubleById[m.id_double_a];
      const db = doubleById[m.id_double_b];
      if (!da || !db) continue;

      // Jogadores
      const p1a = da.id_player1; // RIGHT da dupla A
      const p2a = da.id_player2; // LEFT da dupla A
      const p1b = db.id_player1; // RIGHT da dupla B
      const p2b = db.id_player2; // LEFT da dupla B

      // Contar jogos por jogador
      [p1a, p2a, p1b, p2b].forEach(pid => {
        if (pid) jogosPorJogador[pid] = (jogosPorJogador[pid] || 0) + 1;
      });

      // Parceria dupla A
      if (p1a && p2a) {
        const key = `${Math.min(p1a,p2a)}_${Math.max(p1a,p2a)}`;
        if (!partnershipMap[key]) partnershipMap[key] = { p1: p1a, p2: p2a, matches: [] };
        partnershipMap[key].matches.push(m.id_match);
      }

      // Parceria dupla B
      if (p1b && p2b) {
        const key = `${Math.min(p1b,p2b)}_${Math.max(p1b,p2b)}`;
        if (!partnershipMap[key]) partnershipMap[key] = { p1: p1b, p2: p2b, matches: [] };
        partnershipMap[key].matches.push(m.id_match);
      }

      // Confronto mesma posicao: RIGHT vs RIGHT (p1a x p1b), LEFT vs LEFT (p2a x p2b)
      if (p1a && p1b) {
        const key = `RIGHT:${Math.min(p1a,p1b)}_${Math.max(p1a,p1b)}`;
        if (!samePosMap[key]) samePosMap[key] = { lado: 'RIGHT', jogadores: [p1a, p1b], matches: [] };
        samePosMap[key].matches.push(m.id_match);
      }
      if (p2a && p2b) {
        const key = `LEFT:${Math.min(p2a,p2b)}_${Math.max(p2a,p2b)}`;
        if (!samePosMap[key]) samePosMap[key] = { lado: 'LEFT', jogadores: [p2a, p2b], matches: [] };
        samePosMap[key].matches.push(m.id_match);
      }

      // Adversario qualquer: todos os 4 cross-pairs
      const crossPairs = [
        [p1a, p1b], [p1a, p2b],
        [p2a, p1b], [p2a, p2b]
      ];
      for (const [pa, pb] of crossPairs) {
        if (!pa || !pb) continue;
        const key = `${Math.min(pa,pb)}_${Math.max(pa,pb)}`;
        if (!anyPosMap[key]) anyPosMap[key] = { jogadores: [pa, pb], matches: [] };
        // Adicionar match se ainda nao esta
        if (!anyPosMap[key].matches.includes(m.id_match)) {
          anyPosMap[key].matches.push(m.id_match);
        }
      }
    }

    // --- Regra 1: Round-robin de parceria ---
    // Parcerias possiveis: cada RIGHT pode jogar com cada LEFT
    // Usando a lista de ativos desta categoria (side RIGHT ou EITHER como RIGHT, LEFT ou EITHER como LEFT)
    // Para simplicidade: possiveis = rightPlayers x leftPlayers
    const possiblePartnerships = rightPlayers.length * leftPlayers.length;

    // Parcerias realizadas (unicas)
    const realizedPartnerships = new Set(Object.keys(partnershipMap));
    const realizedCount = realizedPartnerships.size;
    const pct = possiblePartnerships > 0 ? (realizedCount / possiblePartnerships * 100).toFixed(1) : 0;

    // Parcerias faltantes: RIGHT x LEFT que nao aparecem em partnershipMap
    const faltantes = [];
    for (const rp of rightPlayers) {
      for (const lp of leftPlayers) {
        const key = `${Math.min(rp.id_player,lp.id_player)}_${Math.max(rp.id_player,lp.id_player)}`;
        if (!partnershipMap[key]) {
          faltantes.push(`${rp.name} + ${lp.name}`);
        }
      }
    }

    // Parcerias repetidas (mesma dupla jogou > 1 match)
    const repParcerias = Object.values(partnershipMap).filter(v => v.matches.length > 1).map(v => ({
      dupla: `${playerById[v.p1]?.name || v.p1} + ${playerById[v.p2]?.name || v.p2}`,
      p1: v.p1, p2: v.p2,
      vezes: v.matches.length,
      matches: v.matches
    }));

    // --- Regra 2: Adversario nao repete ---
    // Mesma posicao repetido
    const samePosRep = Object.values(samePosMap).filter(v => v.matches.length > 1).map(v => ({
      lado: v.lado,
      jogadores: v.jogadores.map(id => playerById[id]?.name || id),
      ids: v.jogadores,
      vezes: v.matches.length,
      matches: v.matches
    }));

    // Adversario qualquer repetido
    const anyPosRep = Object.values(anyPosMap).filter(v => v.matches.length > 1).map(v => ({
      jogadores: v.jogadores.map(id => playerById[id]?.name || id),
      ids: v.jogadores,
      vezes: v.matches.length,
      matches: v.matches
    }));

    // --- Regra 3: Equilibrio de jogos ---
    const jogosList = catActivePlayers.map(p => ({
      id: p.id_player,
      name: p.name,
      jogos: jogosPorJogador[p.id_player] || 0
    }));
    const jogosVals = jogosList.map(j => j.jogos);
    const minJogos = Math.min(...jogosVals);
    const maxJogos = Math.max(...jogosVals);
    const avgJogos = jogosVals.length > 0 ? (jogosVals.reduce((a,b)=>a+b,0)/jogosVals.length).toFixed(1) : 0;
    const avgNum = parseFloat(avgJogos);
    const threshold = Math.max(2, avgNum * 0.4); // outlier se difere > 40% da media ou mais de 2 jogos
    const outliers = jogosList.filter(j => Math.abs(j.jogos - avgNum) > threshold).sort((a,b)=>b.jogos-a.jogos);

    console.log(`  Parcerias possiveis: ${possiblePartnerships}, realizadas: ${realizedCount} (${pct}%)`);
    console.log(`  Parcerias repetidas: ${repParcerias.length}`);
    console.log(`  Confronto mesma posicao repetido: ${samePosRep.length}`);
    console.log(`  Adversario qualquer repetido: ${anyPosRep.length}`);
    console.log(`  Jogos por jogador: min=${minJogos}, max=${maxJogos}, media=${avgJogos}`);

    result.por_categoria.push({
      id: cat.id,
      name: cat.name,
      right_ativos: rightPlayers.length,
      left_ativos: leftPlayers.length,
      parcerias: {
        possiveis: possiblePartnerships,
        realizadas: realizedCount,
        pct: parseFloat(pct),
        faltantes_amostra: faltantes.slice(0, 30), // max 30 exemplos
        faltantes_total: faltantes.length,
        repetidas: repParcerias
      },
      adversario_mesma_posicao_repetido: samePosRep,
      adversario_qualquer_repetido: anyPosRep,
      jogos_por_jogador: {
        min: minJogos,
        max: maxJogos,
        media: parseFloat(avgJogos),
        lista: jogosList.sort((a,b)=>b.jogos-a.jogos),
        outliers: outliers
      }
    });

    result.resumo_violacoes.parcerias_repetidas_total += repParcerias.length;
    result.resumo_violacoes.mesma_pos_repetido_total += samePosRep.length;
    result.resumo_violacoes.adversario_qualquer_repetido_total += anyPosRep.length;
  }

  // Salvar JSON
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(result, null, 2), 'utf8');
  console.log(`\nJSON salvo em: ${OUTPUT_PATH}`);

  // Imprimir resumo
  console.log('\n========= RESUMO AUDITORIA C =========');
  for (const cat of result.por_categoria) {
    console.log(`\n[${cat.name}]`);
    console.log(`  RIGHT ativos: ${cat.right_ativos}, LEFT ativos: ${cat.left_ativos}`);
    console.log(`  Parcerias: ${cat.parcerias.realizadas}/${cat.parcerias.possiveis} (${cat.parcerias.pct}%) - ${cat.parcerias.faltantes_total} faltando`);
    if (cat.parcerias.repetidas.length > 0) {
      console.log(`  PARCERIAS REPETIDAS (${cat.parcerias.repetidas.length}):`);
      cat.parcerias.repetidas.forEach(r => console.log(`    - ${r.dupla}: ${r.vezes}x matches ${r.matches.join(',')}`));
    }
    if (cat.adversario_mesma_posicao_repetido.length > 0) {
      console.log(`  ADVERSARIO MESMA POSICAO REPETIDO (${cat.adversario_mesma_posicao_repetido.length}):`);
      cat.adversario_mesma_posicao_repetido.slice(0,10).forEach(r =>
        console.log(`    - [${r.lado}] ${r.jogadores.join(' vs ')}: ${r.vezes}x matches ${r.matches.join(',')}`));
    }
    if (cat.adversario_qualquer_repetido.length > 0) {
      console.log(`  ADVERSARIO QUALQUER REPETIDO (${cat.adversario_qualquer_repetido.length}):`);
      cat.adversario_qualquer_repetido.slice(0,10).forEach(r =>
        console.log(`    - ${r.jogadores.join(' vs ')}: ${r.vezes}x matches ${r.matches.join(',')}`));
    }
    console.log(`  Jogos por jogador: min=${cat.jogos_por_jogador.min}, max=${cat.jogos_por_jogador.max}, media=${cat.jogos_por_jogador.media}`);
    if (cat.jogos_por_jogador.outliers.length > 0) {
      console.log(`  Outliers: ${cat.jogos_por_jogador.outliers.map(o => `${o.name}(${o.jogos})`).join(', ')}`);
    }
  }
  console.log(`\nNara (id ${ID_NARA}) - matches antes 20:30: ${result.nara_antes_2030.length}`);
  if (result.nara_antes_2030.length > 0) {
    result.nara_antes_2030.forEach(m => console.log(`  match ${m.id_match}: ${m.scheduled_at} (hora ${m.hora_local})`));
  } else {
    // Listar todos os matches da Nara com seus horarios para conferencia
    console.log(`  (todos os ${naraMatches.length} matches da Nara estao em horario valido >= 20:30)`);
    naraMatches.forEach(m => {
      const tp = m.scheduled_at ? m.scheduled_at.substring(11,16) : 'sem hora';
      console.log(`  match ${m.id_match}: ${tp}`);
    });
  }
  console.log(`\nVIOLACOES TOTAIS:`);
  console.log(`  Parcerias repetidas: ${result.resumo_violacoes.parcerias_repetidas_total}`);
  console.log(`  Adversario mesma posicao repetido: ${result.resumo_violacoes.mesma_pos_repetido_total}`);
  console.log(`  Adversario qualquer repetido: ${result.resumo_violacoes.adversario_qualquer_repetido_total}`);
}

main().catch(err => {
  console.error('ERRO FATAL:', err);
  process.exit(1);
});
