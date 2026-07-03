/**
 * AUDITORIA A — Ranking & Pontuação (integridade matemática)
 * READ-ONLY: apenas SELECT. Nenhum insert/update/delete.
 * Torneio: id_tournament = 7
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const supabase = require('../../supabase');
const fs = require('fs');
const https = require('https');
const http = require('http');

const ID_TOURNAMENT = 7;
const API_BASE = 'https://ranking-padel-srb-2026.vercel.app/api/tournaments/7/ranking';
const OUTPUT_PATH = 'C:/Users/aless/AppData/Local/Temp/claude/c--obralivre/9484ee84-3113-43fa-bba2-ad6b4cbae786/scratchpad/audit_A.json';

// Helper: fetch JSON from URL
function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    lib.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch (e) { resolve({ status: res.statusCode, body: null, raw: data, error: e.message }); }
      });
    }).on('error', (e) => resolve({ status: null, error: e.message }));
  });
}

async function main() {
  console.log('=== AUDITORIA A — Ranking & Pontuação ===\n');

  // 1. Buscar todos os dados necessários
  console.log('Buscando dados do Supabase...');

  const [
    { data: categories, error: errCat },
    { data: players, error: errPl },
    { data: rounds, error: errRo },
    { data: doubles, error: errDo },
    { data: allMatches, error: errMa },
  ] = await Promise.all([
    supabase.from('categories').select('*'),
    supabase.from('players').select('*').eq('id_tournament', ID_TOURNAMENT),
    supabase.from('rounds').select('*').eq('id_tournament', ID_TOURNAMENT),
    supabase.from('doubles').select('*').eq('id_tournament', ID_TOURNAMENT),
    supabase.from('matches').select('*').eq('id_tournament', ID_TOURNAMENT),
  ]);

  if (errCat || errPl || errRo || errDo || errMa) {
    console.error('Erros Supabase:', { errCat, errPl, errRo, errDo, errMa });
    process.exit(1);
  }

  console.log(`Categories: ${categories.length} | Players: ${players.length} | Rounds: ${rounds.length} | Doubles: ${doubles.length} | Matches: ${allMatches.length}\n`);

  // 2. Mapas auxiliares
  const roundMap = {};
  rounds.forEach(r => { roundMap[r.id_round] = r; });

  const doubleMap = {};
  doubles.forEach(d => { doubleMap[d.id_double] = d; });

  // Mapa: id_double -> id_category (via rounds)
  const doubleToCategory = {};
  doubles.forEach(d => {
    const r = roundMap[d.id_round];
    if (r) doubleToCategory[d.id_double] = r.id_category;
  });

  // Exhibition round ids
  const exhibitionRoundIds = new Set(rounds.filter(r => r.round_type === 'EXHIBITION').map(r => r.id_round));
  const exhibitionDoubleIds = new Set(doubles.filter(d => exhibitionRoundIds.has(d.id_round)).map(d => d.id_double));

  // 3. Contagens de matches por status e categoria
  const matchesByStatus = {};
  const matchesByCategory = {};
  allMatches.forEach(m => {
    matchesByStatus[m.status] = (matchesByStatus[m.status] || 0) + 1;
    // Derivar categoria pelo double_a
    const catA = doubleToCategory[m.id_double_a];
    const catB = doubleToCategory[m.id_double_b];
    const cat = catA || catB || 'unknown';
    if (!matchesByCategory[cat]) matchesByCategory[cat] = {};
    matchesByCategory[cat][m.status] = (matchesByCategory[cat][m.status] || 0) + 1;
  });

  console.log('Contagem de matches por status:', matchesByStatus);

  // 4. Matches que entram no cálculo (FINISHED + WO, excluindo EXHIBITION)
  const calcMatches = allMatches.filter(m =>
    (m.status === 'FINISHED' || m.status === 'WO') &&
    !exhibitionDoubleIds.has(m.id_double_a) &&
    !exhibitionDoubleIds.has(m.id_double_b)
  );
  console.log(`Matches no cálculo (FINISHED+WO, sem EXHIBITION): ${calcMatches.length}\n`);

  // Nota: o rankingService também inclui IN_PROGRESS com placar válido e sem empate
  const inProgressScored = allMatches.filter(m => {
    if (m.status !== 'IN_PROGRESS') return false;
    if (exhibitionDoubleIds.has(m.id_double_a) || exhibitionDoubleIds.has(m.id_double_b)) return false;
    const a = m.games_double_a ?? 0;
    const b = m.games_double_b ?? 0;
    return (a > 0 || b > 0) && a !== b;
  });
  console.log(`IN_PROGRESS com placar válido (incluídos pelo sistema): ${inProgressScored.length}`);
  const calcMatchesWithInProgress = [...calcMatches, ...inProgressScored.map(m => ({ ...m, status: 'FINISHED' }))];

  // 5. Identificar categorias com jogadores ativos
  const activePlayers = players.filter(p => p.active === true);
  const inactivePlayers = players.filter(p => p.active !== true);
  const catIds = [...new Set(activePlayers.map(p => p.category_id).filter(Boolean))].sort();
  console.log(`Categorias com jogadores ativos: ${catIds.join(', ')}`);
  console.log(`Jogadores ativos: ${activePlayers.length}, inativos: ${inactivePlayers.length}\n`);

  // Mapa category id -> name
  const catNameMap = {};
  categories.forEach(c => { catNameMap[c.id] = c.name; });

  // 6. Recalcular standings por categoria (lógica fiel ao rankingService)
  const perCategoriaResult = [];

  for (const catId of catIds) {
    const catPlayers = activePlayers.filter(p => p.category_id === catId);
    const playerIds = new Set(catPlayers.map(p => p.id_player));

    const catDoubles = doubles.filter(d =>
      playerIds.has(d.id_player1) || playerIds.has(d.id_player2)
    );
    const catDoubleIds = new Set(catDoubles.map(d => d.id_double));
    const catDoubleMap = {};
    catDoubles.forEach(d => { catDoubleMap[d.id_double] = d; });

    const catMatches = calcMatchesWithInProgress.filter(m =>
      catDoubleIds.has(m.id_double_a) && catDoubleIds.has(m.id_double_b) &&
      !exhibitionDoubleIds.has(m.id_double_a) && !exhibitionDoubleIds.has(m.id_double_b)
    );

    // Inicializar stats
    const stats = {};
    catPlayers.forEach(p => {
      stats[p.id_player] = { points: 0, wins: 0, losses: 0, wos: 0, matches_played: 0, games_for: 0, games_against: 0 };
    });

    for (const match of catMatches) {
      const dA = catDoubleMap[match.id_double_a];
      const dB = catDoubleMap[match.id_double_b];
      if (!dA || !dB) continue;

      const absents = new Set(Array.isArray(match.absent_player_ids) ? match.absent_player_ids : []);
      const playersA = [dA.id_player1, dA.id_player2].filter(Boolean);
      const playersB = [dB.id_player1, dB.id_player2].filter(Boolean);
      const aHasAbsent = playersA.some(p => absents.has(p));
      const bHasAbsent = playersB.some(p => absents.has(p));

      const gamesA = match.games_double_a ?? 0;
      const gamesB = match.games_double_b ?? 0;
      const hasValidScore = (gamesA > 0 || gamesB > 0) && gamesA !== gamesB;
      const aWonScore = hasValidScore && gamesA > gamesB;
      const bWonScore = hasValidScore && gamesB > gamesA;

      const processPlayer = (pid, ourGames, oppGames, ourWonScore, oppWonScore, ourSideAbsent, oppSideAbsent) => {
        if (!stats[pid]) return;
        stats[pid].matches_played++;
        if (absents.has(pid)) { stats[pid].wos++; return; }
        if (ourSideAbsent)    { stats[pid].points += 1; return; }
        if (oppSideAbsent)    { stats[pid].wins++; stats[pid].points += 3; return; }
        if (hasValidScore) {
          stats[pid].games_for     += ourGames;
          stats[pid].games_against += oppGames;
          if (ourWonScore)      { stats[pid].wins++;   stats[pid].points += 3; }
          else if (oppWonScore) { stats[pid].losses++; stats[pid].points += 1; }
          return;
        }
        stats[pid].points += 1;
      };

      for (const pid of playersA) processPlayer(pid, gamesA, gamesB, aWonScore, bWonScore, aHasAbsent, bHasAbsent);
      for (const pid of playersB) processPlayer(pid, gamesB, gamesA, bWonScore, aWonScore, bHasAbsent, aHasAbsent);
    }

    const standingsRecalc = catPlayers.map(p => ({
      id_player: p.id_player,
      name: p.name,
      side: p.side,
      pts: stats[p.id_player].points,
      v: stats[p.id_player].wins,
      d: stats[p.id_player].losses,
      wo: stats[p.id_player].wos,
      mp: stats[p.id_player].matches_played,
      gf: stats[p.id_player].games_for,
      ga: stats[p.id_player].games_against,
      saldo: stats[p.id_player].games_for - stats[p.id_player].games_against,
    })).sort((a, b) =>
      b.pts - a.pts
      || b.v - a.v
      || b.saldo - a.saldo
      || a.d - b.d
      || a.wo - b.wo
    );

    const totalGF = standingsRecalc.reduce((s, p) => s + p.gf, 0);
    const totalGA = standingsRecalc.reduce((s, p) => s + p.ga, 0);

    console.log(`\nCategoria ${catId} (${catNameMap[catId] || '?'}):`);
    console.log(`  Jogadores: ${catPlayers.length} | Matches usados: ${catMatches.length}`);
    console.log(`  Saldo total gf=${totalGF} ga=${totalGA} fecha_zero=${totalGF === totalGA}`);
    standingsRecalc.forEach((p, i) => {
      console.log(`  ${i+1}. ${p.name} (${p.side}) pts=${p.pts} v=${p.v} d=${p.d} wo=${p.wo} gf=${p.gf} ga=${p.ga} saldo=${p.saldo}`);
    });

    perCategoriaResult.push({
      id: catId,
      name: catNameMap[catId] || `Cat ${catId}`,
      matches_usados: catMatches.length,
      standings_recalc: standingsRecalc,
      saldo_total_fecha_zero: totalGF === totalGA,
      saldo_total_gf: totalGF,
      saldo_total_ga: totalGA,
    });
  }

  // 7. Buscar dados da API e comparar
  console.log('\n\n=== COMPARAÇÃO COM API ===');
  const divergenciasApi = [];
  const inativosNoRanking = [];
  const ordemViolada = [];

  const inactivePlayerIds = new Set(inactivePlayers.map(p => p.id_player));

  for (const cat of perCategoriaResult) {
    console.log(`\nFetchando API categoria ${cat.id}...`);
    const apiResp = await fetchJson(`${API_BASE}/${cat.id}`);

    if (!apiResp || apiResp.error || !apiResp.body) {
      console.log(`  API ERRO: ${apiResp?.error || 'sem resposta'}`);
      divergenciasApi.push({
        categoria: cat.id,
        id_player: null,
        name: 'N/A',
        campo: 'API_ERROR',
        recalc: null,
        api: apiResp?.error || 'sem resposta'
      });
      continue;
    }

    // A API pode retornar array diretamente ou dentro de um campo
    let apiList = apiResp.body;
    if (Array.isArray(apiResp.body)) {
      apiList = apiResp.body;
    } else if (apiResp.body.standings) {
      apiList = apiResp.body.standings;
    } else if (apiResp.body.data) {
      apiList = apiResp.body.data;
    } else if (apiResp.body.players) {
      apiList = apiResp.body.players;
    } else {
      // Tentar pegar qualquer array
      const vals = Object.values(apiResp.body);
      const arr = vals.find(v => Array.isArray(v));
      if (arr) apiList = arr;
      else {
        console.log(`  API retornou formato inesperado:`, JSON.stringify(apiResp.body).substring(0, 200));
        divergenciasApi.push({
          categoria: cat.id,
          id_player: null,
          name: 'N/A',
          campo: 'FORMAT_INESPERADO',
          recalc: null,
          api: JSON.stringify(apiResp.body).substring(0, 200)
        });
        continue;
      }
    }

    console.log(`  API retornou ${apiList.length} jogadores`);

    // Checar inativos no ranking da API
    for (const apiP of apiList) {
      const pid = apiP.id_player;
      if (pid && inactivePlayerIds.has(pid)) {
        inativosNoRanking.push({ categoria: cat.id, id_player: pid, name: apiP.name });
        console.log(`  ⚠️ INATIVO no ranking API: ${apiP.name} (${pid})`);
      }
    }

    // Mapa recalc por id_player
    const recalcMap = {};
    cat.standings_recalc.forEach(p => { recalcMap[p.id_player] = p; });

    // Mapa API por id_player
    const apiMap = {};
    apiList.forEach(p => { if (p.id_player) apiMap[p.id_player] = p; });

    // Comparar campos para jogadores presentes em ambos
    const campos = [
      { recalcKey: 'pts', apiKey: 'points', label: 'points' },
      { recalcKey: 'v', apiKey: 'wins', label: 'wins' },
      { recalcKey: 'd', apiKey: 'losses', label: 'losses' },
      { recalcKey: 'wo', apiKey: 'wos', label: 'wos' },
      { recalcKey: 'gf', apiKey: 'games_for', label: 'games_for' },
      { recalcKey: 'ga', apiKey: 'games_against', label: 'games_against' },
      { recalcKey: 'saldo', apiKey: 'games_balance', label: 'games_balance' },
    ];

    for (const p of cat.standings_recalc) {
      const apiP = apiMap[p.id_player];
      if (!apiP) {
        console.log(`  ⚠️ Jogador ${p.name} (${p.id_player}) no recalc mas AUSENTE na API`);
        divergenciasApi.push({
          categoria: cat.id, id_player: p.id_player, name: p.name,
          campo: 'AUSENTE_NA_API', recalc: p, api: null
        });
        continue;
      }
      for (const c of campos) {
        const rv = p[c.recalcKey];
        const av = apiP[c.apiKey];
        if (rv !== av && rv !== undefined && av !== undefined) {
          console.log(`  ❌ DIVERGÊNCIA ${p.name} ${c.label}: recalc=${rv} api=${av}`);
          divergenciasApi.push({
            categoria: cat.id, id_player: p.id_player, name: p.name,
            campo: c.label, recalc: rv, api: av
          });
        }
      }
    }

    // Jogadores na API mas não no recalc
    for (const apiP of apiList) {
      if (apiP.id_player && !recalcMap[apiP.id_player]) {
        console.log(`  ⚠️ Jogador ${apiP.name} (${apiP.id_player}) na API mas AUSENTE no recalc`);
        divergenciasApi.push({
          categoria: cat.id, id_player: apiP.id_player, name: apiP.name,
          campo: 'AUSENTE_NO_RECALC', recalc: null, api: apiP
        });
      }
    }

    // Verificar ordem de desempate na API (par a par)
    for (let i = 0; i < apiList.length - 1; i++) {
      const a = apiList[i];
      const b = apiList[i + 1];
      const ptsA = a.points ?? 0, ptsB = b.points ?? 0;
      const winsA = a.wins ?? 0, winsB = b.wins ?? 0;
      const balA = a.games_balance ?? 0, balB = b.games_balance ?? 0;
      const lossA = a.losses ?? 0, lossB = b.losses ?? 0;
      const woA = a.wos ?? 0, woB = b.wos ?? 0;

      // a deve ser >= b em todos os critérios em ordem
      let violacao = null;
      if (ptsA < ptsB) violacao = `pts: ${a.name}(${ptsA}) < ${b.name}(${ptsB})`;
      else if (ptsA === ptsB && winsA < winsB) violacao = `pts iguais; wins: ${a.name}(${winsA}) < ${b.name}(${winsB})`;
      else if (ptsA === ptsB && winsA === winsB && balA < balB) violacao = `pts/wins iguais; saldo: ${a.name}(${balA}) < ${b.name}(${balB})`;
      else if (ptsA === ptsB && winsA === winsB && balA === balB && lossA > lossB) violacao = `pts/wins/saldo iguais; losses: ${a.name}(${lossA}) > ${b.name}(${lossB})`;
      else if (ptsA === ptsB && winsA === winsB && balA === balB && lossA === lossB && woA > woB) violacao = `tudo igual exceto wos: ${a.name}(${woA}) > ${b.name}(${woB})`;

      if (violacao) {
        console.log(`  ⚠️ ORDEM VIOLADA pos ${i+1}-${i+2}: ${violacao}`);
        ordemViolada.push({ categoria: cat.id, posicao: `${i+1}-${i+2}`, jogadorA: a.name, jogadorB: b.name, motivo: violacao });
      }
    }
  }

  // 8. Análise da fórmula implementada vs régua
  const formulaAnalysis = {
    resumo: [
      'Win: +3 pontos por jogador na dupla vencedora.',
      'Loss: +1 ponto por jogador na dupla perdedora.',
      'WO (o próprio faltou): 0 pontos, wos++.',
      'WO (parceiro faltou, eu compareci): +1 ponto (mas NÃO contabiliza games).',
      'WO adversário (ambos adversários ausentes): +3 pts por cada jogador presente, wins++.',
      'IN_PROGRESS com placar válido (a>0 ou b>0 e a≠b): tratado como FINISHED.',
      'EXHIBITION excluído do cálculo.',
      'Desempate: pts > wins > games_balance > losses > wos.',
      'Só jogadores active=true entram.'
    ].join(' | '),
    divergencias_vs_regua: []
  };

  // Verificar divergências entre implementação e régua documentada
  // Régua diz: WO = 0 pro lado que levou WO. Implementação: quem faltou = 0, parceiro = 1, adversário = +3.
  // A régua original diz apenas "WO: 0 pro lado que levou WO" sem detalhar jogador-a-jogador.
  // A implementação é mais granular. Anota divergência de interpretação:
  formulaAnalysis.divergencias_vs_regua.push({
    tipo: 'INTERPRETACAO_WO_GRANULAR',
    descricao: 'A régua diz apenas "WO: 0 pro lado que levou WO". A implementação distingue: (a) o faltante = 0; (b) parceiro do faltante presente = +1; (c) qualquer ausência do adversário = +3 vitória. Isso é mais granular que a régua documentada e pode gerar comportamento inesperado quando apenas 1 de 2 jogadores falta.',
    impacto: 'Médio — afeta jogadores que comparecem mas seu parceiro falta.'
  });
  formulaAnalysis.divergencias_vs_regua.push({
    tipo: 'IN_PROGRESS_INCLUIDO',
    descricao: 'A régua documenta que só FINISHED e WO contam. A implementação também inclui IN_PROGRESS com placar válido (pelo menos 1 game marcado, sem empate), normalizando como FINISHED.',
    impacto: `Baixo — ${inProgressScored.length} matches IN_PROGRESS com placar válido encontrados.`
  });

  // 9. Montar resultado final
  const auditResult = {
    gerado_em: new Date().toISOString(),
    tournament_id: ID_TOURNAMENT,
    formula_implementada: formulaAnalysis,
    por_categoria: perCategoriaResult.map(c => ({
      id: c.id,
      name: c.name,
      matches_usados: c.matches_usados,
      standings_recalc: c.standings_recalc,
      saldo_total_fecha_zero: c.saldo_total_fecha_zero,
      saldo_total_gf: c.saldo_total_gf,
      saldo_total_ga: c.saldo_total_ga,
    })),
    divergencias_api: divergenciasApi,
    inativos_no_ranking: inativosNoRanking,
    ordem_desempate_violada: ordemViolada,
    contagens: {
      matches_por_status: matchesByStatus,
      matches_por_categoria: matchesByCategory,
      matches_finished_no_calculo: calcMatches.filter(m => m.status === 'FINISHED').length,
      matches_wo_no_calculo: calcMatches.filter(m => m.status === 'WO').length,
      matches_in_progress_scored: inProgressScored.length,
      total_no_calculo: calcMatchesWithInProgress.length,
    }
  };

  // Salvar JSON
  fs.mkdirSync(require('path').dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(auditResult, null, 2), 'utf8');
  console.log(`\n✅ JSON salvo em: ${OUTPUT_PATH}`);

  // Resumo final
  console.log('\n========== RESUMO FINAL ==========');
  console.log(`Total matches: ${allMatches.length}`);
  console.log(`Matches no cálculo (FINISHED+WO+IN_PROGRESS_scored): ${calcMatchesWithInProgress.length}`);
  console.log(`Categorias processadas: ${catIds.length}`);
  console.log(`Divergências vs API: ${divergenciasApi.length}`);
  console.log(`Inativos no ranking API: ${inativosNoRanking.length}`);
  console.log(`Violações de ordem desempate: ${ordemViolada.length}`);
  const saldosOk = perCategoriaResult.filter(c => c.saldo_total_fecha_zero).length;
  console.log(`Saldo GF=GA por categoria: ${saldosOk}/${perCategoriaResult.length} fecham zero`);

  return auditResult;
}

main().catch(e => {
  console.error('ERRO FATAL:', e);
  process.exit(1);
});
