/**
 * AUDITORIA D — Consistência de Fonte e Dados
 * READ-ONLY. Não escreve no banco.
 * Dimensão D: verifica se caches (partnerships / oppositions) batem com matches reais.
 */

const supabase = require('../../supabase');
const fs = require('fs');
const path = require('path');

const OUTPUT_PATH = 'C:/Users/aless/AppData/Local/Temp/claude/c--obralivre/9484ee84-3113-43fa-bba2-ad6b4cbae786/scratchpad/audit_D.json';

async function fetchAll(table, select = '*', filters = []) {
  let allRows = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    let query = supabase.from(table).select(select).range(from, from + pageSize - 1);
    for (const [col, op, val] of filters) {
      if (op === 'eq') query = query.eq(col, val);
      else if (op === 'neq') query = query.neq(col, val);
      else if (op === 'in') query = query.in(col, val);
    }
    const { data, error } = await query;
    if (error) throw new Error(`fetchAll(${table}): ${error.message}`);
    if (!data || data.length === 0) break;
    allRows = allRows.concat(data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return allRows;
}

async function main() {
  console.log('=== AUDITORIA D — Consistência de Fonte e Dados ===');

  // ---- Fetch base tables ----
  console.log('Carregando dados...');
  const players   = await fetchAll('players',   'id_player, name, side, category_id, active, payment_status');
  const rounds    = await fetchAll('rounds',    'id_round, id_category, round_number, scheduled_date, status, round_type');
  const doubles   = await fetchAll('doubles',   'id_double, id_player1, id_player2, id_round, display_name');
  const matches   = await fetchAll('matches',   'id_match, id_double_a, id_double_b, status, games_double_a, games_double_b');
  const partners  = await fetchAll('partnerships',  'id_player1, id_player2, id_category, times_paired, last_round_id');
  const opps      = await fetchAll('oppositions',   'id_player1, id_player2, id_category, times_opposed, diagonal_count, last_round_id');
  const absences  = await fetchAll('player_absences', 'id_player, absence_date, declared_at');

  console.log(`players=${players.length}, rounds=${rounds.length}, doubles=${doubles.length}, matches=${matches.length}`);
  console.log(`partnerships cache=${partners.length}, oppositions cache=${opps.length}, absences=${absences.length}`);

  // ---- Build index maps ----
  const roundById   = Object.fromEntries(rounds.map(r => [r.id_round, r]));
  const doubleById  = Object.fromEntries(doubles.map(d => [d.id_double, d]));
  const playerById  = Object.fromEntries(players.map(p => [p.id_player, p]));

  // REGULAR rounds set
  const regularRoundIds = new Set(rounds.filter(r => r.round_type === 'REGULAR').map(r => r.id_round));

  // double → category (via its round)
  function doubleCategory(id_double) {
    const d = doubleById[id_double];
    if (!d) return null;
    const r = roundById[d.id_round];
    return r ? r.id_category : null;
  }

  function doubleIsRegular(id_double) {
    const d = doubleById[id_double];
    if (!d) return false;
    return regularRoundIds.has(d.id_round);
  }

  // ---- D1: partnerships cache vs real ----
  console.log('\n[D1] Calculando parcerias reais dos matches REGULAR...');

  // For each double in a REGULAR round, count how many times (p1, p2) paired, per category
  // Key: `${minId}_${maxId}_${cat}`
  const realPairs = {}; // key -> count

  for (const d of doubles) {
    if (!regularRoundIds.has(d.id_round)) continue;
    const cat = doubleCategory(d.id_double);
    if (!cat) continue;
    const p1 = Math.min(d.id_player1, d.id_player2);
    const p2 = Math.max(d.id_player1, d.id_player2);
    const key = `${p1}_${p2}_${cat}`;
    realPairs[key] = (realPairs[key] || 0) + 1;
  }

  // Build cache partnerships map
  const cachePartners = {}; // key -> times_paired
  for (const p of partners) {
    const p1 = Math.min(p.id_player1, p.id_player2);
    const p2 = Math.max(p.id_player1, p.id_player2);
    const key = `${p1}_${p2}_${p.id_category}`;
    cachePartners[key] = p.times_paired;
  }

  // Compare
  const allPartnershipKeys = new Set([...Object.keys(realPairs), ...Object.keys(cachePartners)]);
  const partnershipDivs = [];

  for (const key of allPartnershipKeys) {
    const real = realPairs[key] || 0;
    const cache = cachePartners[key] || 0;
    if (real !== cache) {
      const [p1str, p2str, catStr] = key.split('_');
      const p1name = playerById[p1str]?.name || p1str;
      const p2name = playerById[p2str]?.name || p2str;
      partnershipDivs.push({
        categoria: parseInt(catStr),
        par: `${p1name} + ${p2name}`,
        id_player1: parseInt(p1str),
        id_player2: parseInt(p2str),
        real,
        cache
      });
    }
  }
  partnershipDivs.sort((a, b) => Math.abs(b.real - b.cache) - Math.abs(a.real - a.cache));
  console.log(`  -> ${partnershipDivs.length} divergências de parcerias`);

  // ---- D2: oppositions cache vs real ----
  console.log('[D2] Calculando oposições reais dos matches REGULAR...');

  // For each REGULAR match, find the 4 players and count oppositions + diagonals
  // diagonal = RIGHT vs RIGHT OR LEFT vs LEFT
  const realOpp = {};   // key `${minId}_${maxId}_${cat}` -> {times, diag}
  const realDiag = {};

  for (const m of matches) {
    const dA = doubleById[m.id_double_a];
    const dB = doubleById[m.id_double_b];
    if (!dA || !dB) continue;
    if (!regularRoundIds.has(dA.id_round)) continue;

    const cat = doubleCategory(m.id_double_a);
    if (!cat) continue;

    // dA: id_player1=RIGHT, id_player2=LEFT
    // dB: id_player1=RIGHT, id_player2=LEFT
    // Pairs that opposed each other: (dA.p1 vs dB.p1), (dA.p1 vs dB.p2), (dA.p2 vs dB.p1), (dA.p2 vs dB.p2)
    const pairs = [
      { a: dA.id_player1, b: dB.id_player1, diag: true  }, // RIGHT vs RIGHT
      { a: dA.id_player1, b: dB.id_player2, diag: false }, // RIGHT vs LEFT
      { a: dA.id_player2, b: dB.id_player1, diag: false }, // LEFT vs RIGHT
      { a: dA.id_player2, b: dB.id_player2, diag: true  }, // LEFT vs LEFT
    ];

    for (const { a, b, diag } of pairs) {
      if (!a || !b) continue;
      const lo = Math.min(a, b);
      const hi = Math.max(a, b);
      const key = `${lo}_${hi}_${cat}`;
      realOpp[key]  = (realOpp[key]  || 0) + 1;
      if (diag) realDiag[key] = (realDiag[key] || 0) + 1;
    }
  }

  // Build cache oppositions map
  const cacheOpp  = {}; // key -> times_opposed
  const cacheDiag = {}; // key -> diagonal_count
  for (const o of opps) {
    const lo = Math.min(o.id_player1, o.id_player2);
    const hi = Math.max(o.id_player1, o.id_player2);
    const key = `${lo}_${hi}_${o.id_category}`;
    cacheOpp[key]  = o.times_opposed;
    cacheDiag[key] = o.diagonal_count || 0;
  }

  const allOppKeys = new Set([...Object.keys(realOpp), ...Object.keys(cacheOpp)]);
  const oppDivs = [];

  for (const key of allOppKeys) {
    const rt = realOpp[key]  || 0;
    const ct = cacheOpp[key] || 0;
    const rd = realDiag[key] || 0;
    const cd = cacheDiag[key] || 0;
    if (rt !== ct || rd !== cd) {
      const [p1str, p2str, catStr] = key.split('_');
      const p1name = playerById[p1str]?.name || p1str;
      const p2name = playerById[p2str]?.name || p2str;
      oppDivs.push({
        categoria: parseInt(catStr),
        par: `${p1name} vs ${p2name}`,
        id_player1: parseInt(p1str),
        id_player2: parseInt(p2str),
        real_times: rt,
        cache_times: ct,
        real_diag: rd,
        cache_diag: cd
      });
    }
  }
  // Sort by biggest discrepancy
  oppDivs.sort((a, b) => Math.abs(b.real_times - b.cache_times) - Math.abs(a.real_times - a.cache_times));
  console.log(`  -> ${oppDivs.length} divergências de oposições`);

  // ---- D3: EITHER players ----
  console.log('[D3] Players com side=EITHER...');
  const eitherPlayers = players.filter(p => p.side === 'EITHER' && p.active).map(p => ({
    id_player: p.id_player,
    name: p.name,
    categoria: p.category_id
  }));
  console.log(`  -> ${eitherPlayers.length} jogadores EITHER ativos`);

  // ---- D4: Inativos em matches ----
  console.log('[D4] Jogadores inativos em matches...');
  const inativePlayers = players.filter(p => !p.active);

  // Map players to doubles
  const playerToDoubles = {}; // id_player -> [id_double]
  for (const d of doubles) {
    if (!playerToDoubles[d.id_player1]) playerToDoubles[d.id_player1] = [];
    if (!playerToDoubles[d.id_player2]) playerToDoubles[d.id_player2] = [];
    playerToDoubles[d.id_player1].push(d.id_double);
    playerToDoubles[d.id_player2].push(d.id_double);
  }

  // Map doubles to matches
  const doubleToMatches = {};
  for (const m of matches) {
    if (!doubleToMatches[m.id_double_a]) doubleToMatches[m.id_double_a] = [];
    if (!doubleToMatches[m.id_double_b]) doubleToMatches[m.id_double_b] = [];
    doubleToMatches[m.id_double_a].push(m.id_match);
    doubleToMatches[m.id_double_b].push(m.id_match);
  }

  const inativoResult = inativePlayers.map(p => {
    const myDoubles = playerToDoubles[p.id_player] || [];
    const myMatchIds = [];
    for (const did of myDoubles) {
      const ms = doubleToMatches[did] || [];
      myMatchIds.push(...ms);
    }
    const uniqueMatchIds = [...new Set(myMatchIds)];
    const aparece = uniqueMatchIds.length > 0;
    let detalhe = null;
    if (aparece) {
      // Find rounds/dates for these doubles
      const roundDates = myDoubles.map(did => {
        const d = doubleById[did];
        if (!d) return null;
        const r = roundById[d.id_round];
        return r ? `round #${r.round_number} (${r.scheduled_date})` : null;
      }).filter(Boolean);
      detalhe = `aparece em ${uniqueMatchIds.length} match(es), rounds: ${[...new Set(roundDates)].join(', ')}`;
    }
    return {
      id_player: p.id_player,
      name: p.name,
      categoria: p.category_id,
      aparece_em_matches: aparece,
      detalhe: detalhe || 'não aparece em matches'
    };
  });
  const inativosComMatch = inativoResult.filter(i => i.aparece_em_matches).length;
  console.log(`  -> ${inativePlayers.length} inativos; ${inativosComMatch} aparecem em matches`);

  // ---- D5: Cota mensal de ausência ----
  console.log('[D5] Cota mensal de ausência...');
  const absencesByPlayerMonth = {};
  for (const a of absences) {
    const mes = a.absence_date ? a.absence_date.slice(0, 7) : 'desconhecido';
    const key = `${a.id_player}_${mes}`;
    if (!absencesByPlayerMonth[key]) absencesByPlayerMonth[key] = { id_player: a.id_player, mes, qtd: 0 };
    absencesByPlayerMonth[key].qtd++;
  }
  const cotaExcedida = Object.values(absencesByPlayerMonth)
    .filter(x => x.qtd > 1)
    .map(x => ({
      id_player: x.id_player,
      name: playerById[x.id_player]?.name || String(x.id_player),
      mes: x.mes,
      qtd: x.qtd
    }))
    .sort((a, b) => b.qtd - a.qtd);
  console.log(`  -> ${cotaExcedida.length} casos de excesso de ausência no mesmo mês`);

  // ---- D6: Higiene geral ----
  console.log('[D6] Higiene geral...');

  // Players sem category_id
  const semCategoria = players
    .filter(p => !p.category_id)
    .map(p => ({ id_player: p.id_player, name: p.name, active: p.active }));

  // Doubles com jogadores de categorias diferentes
  const doubleCategoriasMistas = [];
  for (const d of doubles) {
    const p1 = playerById[d.id_player1];
    const p2 = playerById[d.id_player2];
    if (!p1 || !p2) continue;
    if (p1.category_id && p2.category_id && p1.category_id !== p2.category_id) {
      doubleCategoriasMistas.push({
        id_double: d.id_double,
        display_name: d.display_name,
        id_player1: d.id_player1, cat_p1: p1.category_id,
        id_player2: d.id_player2, cat_p2: p2.category_id
      });
    }
  }

  // Players não pagos em matches
  const unpaidPlayerIds = new Set(
    players.filter(p => p.payment_status !== 'PAID').map(p => p.id_player)
  );

  const naoPagoEmMatch = [];
  for (const d of doubles) {
    const inMatch = (doubleToMatches[d.id_double] || []).length > 0;
    if (!inMatch) continue;
    for (const pid of [d.id_player1, d.id_player2]) {
      if (unpaidPlayerIds.has(pid) && !naoPagoEmMatch.find(x => x.id_player === pid)) {
        const p = playerById[pid];
        naoPagoEmMatch.push({
          id_player: pid,
          name: p?.name || pid,
          payment_status: p?.payment_status || 'unknown',
          categoria: p?.category_id
        });
      }
    }
  }

  console.log(`  -> sem_categoria=${semCategoria.length}, categorias_mistas=${doubleCategoriasMistas.length}, nao_pago_em_match=${naoPagoEmMatch.length}`);

  // ---- Montar resultado ----
  const result = {
    gerado_em: new Date().toISOString(),
    partnerships_cache_vs_real: {
      divergencias_total: partnershipDivs.length,
      amostra: partnershipDivs.slice(0, 30)
    },
    oppositions_cache_vs_real: {
      divergencias_total: oppDivs.length,
      amostra: oppDivs.slice(0, 30)
    },
    side_either: eitherPlayers,
    inativos: inativoResult,
    cota_ausencia_excedida: cotaExcedida,
    higiene: {
      sem_categoria: semCategoria,
      double_categorias_mistas: doubleCategoriasMistas,
      nao_pago_em_match: naoPagoEmMatch
    },
    _stats: {
      total_players: players.length,
      total_rounds: rounds.length,
      total_doubles: doubles.length,
      total_matches: matches.length,
      regular_rounds: regularRoundIds.size,
      partnerships_cache_entries: partners.length,
      oppositions_cache_entries: opps.length,
      absences_total: absences.length
    }
  };

  // Garantir que o diretório existe
  const outDir = path.dirname(OUTPUT_PATH);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(result, null, 2), 'utf8');
  console.log(`\nJSON salvo em: ${OUTPUT_PATH}`);

  // ---- Resumo ----
  console.log('\n========== RESUMO DIMENSÃO D ==========');
  console.log(`Partnerships (cache vs real): ${partnershipDivs.length} divergências em ${Object.keys(allPartnershipKeys).length} pares únicos checados`);
  console.log(`Oppositions  (cache vs real): ${oppDivs.length} divergências em ${allOppKeys.size} pares únicos checados`);
  console.log(`Side=EITHER ativos: ${eitherPlayers.length}`);
  console.log(`Inativos totais: ${inativePlayers.length} (${inativosComMatch} aparecem em matches)`);
  console.log(`Excesso cota ausência mensal (>1/mês): ${cotaExcedida.length} casos`);
  console.log(`Higiene — sem_categoria: ${semCategoria.length} | categorias_mistas: ${doubleCategoriasMistas.length} | nao_pago_em_match: ${naoPagoEmMatch.length}`);

  return result;
}

main().catch(err => {
  console.error('ERRO FATAL:', err);
  process.exit(1);
});
