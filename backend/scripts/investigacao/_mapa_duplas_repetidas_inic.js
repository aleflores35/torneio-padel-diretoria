/**
 * _mapa_duplas_repetidas_inic.js
 * Mapeamento DEFINITIVO read-only — parcerias repetidas Masculino Iniciante (id_category=1)
 * id_tournament=7, hoje=2026-06-26
 * NÃO grava nada no banco.
 */

const supabase = require('../../supabase');
const fs = require('fs');
const path = require('path');

const ID_CATEGORY = 1;
const ID_TOURNAMENT = 7;
const OUTPUT_PATH = 'C:/Users/aless/AppData/Local/Temp/claude/c--obralivre/9484ee84-3113-43fa-bba2-ad6b4cbae786/scratchpad/mapa_duplas.json';

async function main() {
  // ─── 1. Rounds da categoria 1 ────────────────────────────────────────────────
  const { data: rounds, error: errRounds } = await supabase
    .from('rounds')
    .select('id_round, round_number, scheduled_date, round_type, status')
    .eq('id_category', ID_CATEGORY);

  if (errRounds) throw new Error('rounds: ' + errRounds.message);

  const roundsRegular   = rounds.filter(r => r.round_type === 'REGULAR');
  const roundsExhibition = rounds.filter(r => r.round_type === 'EXHIBITION');
  const roundsMakeup    = rounds.filter(r => r.round_type === 'MAKEUP');

  const regularIds = new Set(roundsRegular.map(r => r.id_round));
  const roundById  = {};
  for (const r of rounds) roundById[r.id_round] = r;

  console.log(`Rounds cat1: ${rounds.length} total | REGULAR=${roundsRegular.length} | EXHIBITION=${roundsExhibition.length} | MAKEUP=${roundsMakeup.length}`);

  // ─── 2. Doubles da categoria 1 ───────────────────────────────────────────────
  const regularIdArr = [...regularIds];
  // Busca em lotes se necessário (até 1000)
  let allDoubles = [];
  const chunkSize = 100;
  for (let i = 0; i < regularIdArr.length; i += chunkSize) {
    const chunk = regularIdArr.slice(i, i + chunkSize);
    const { data, error } = await supabase
      .from('doubles')
      .select('id_double, id_player1, id_player2, id_round, display_name')
      .in('id_round', chunk);
    if (error) throw new Error('doubles: ' + error.message);
    allDoubles = allDoubles.concat(data || []);
  }

  const doubleById = {};
  for (const d of allDoubles) doubleById[d.id_double] = d;

  console.log(`Doubles em rounds REGULAR: ${allDoubles.length}`);

  // ─── 3. Matches dos rounds REGULAR ────────────────────────────────────────────
  // matches não tem id_round, então filtra pelos id_double presentes nesses rounds
  const doubleIdsInRegular = new Set(allDoubles.map(d => d.id_double));

  // Busca matches onde id_double_a ou id_double_b estão nos doubles REGULAR da cat1
  // Estratégia: buscar por id_double_a em lotes, depois id_double_b
  const doubleIdsArr = [...doubleIdsInRegular];
  let matchesA = [];
  let matchesB = [];

  for (let i = 0; i < doubleIdsArr.length; i += chunkSize) {
    const chunk = doubleIdsArr.slice(i, i + chunkSize);
    const { data, error } = await supabase
      .from('matches')
      .select('id_match, id_double_a, id_double_b, scheduled_at, status')
      .in('id_double_a', chunk);
    if (error) throw new Error('matches_a: ' + error.message);
    matchesA = matchesA.concat(data || []);
  }
  for (let i = 0; i < doubleIdsArr.length; i += chunkSize) {
    const chunk = doubleIdsArr.slice(i, i + chunkSize);
    const { data, error } = await supabase
      .from('matches')
      .select('id_match, id_double_a, id_double_b, scheduled_at, status')
      .in('id_double_b', chunk);
    if (error) throw new Error('matches_b: ' + error.message);
    matchesB = matchesB.concat(data || []);
  }

  // Unifica e deduplica por id_match
  const matchMap = {};
  for (const m of [...matchesA, ...matchesB]) {
    matchMap[m.id_match] = m;
  }

  // Filtra: só matches onde AMBAS as doubles pertencem a rounds REGULAR da cat1
  const allMatches = Object.values(matchMap).filter(m =>
    doubleIdsInRegular.has(m.id_double_a) && doubleIdsInRegular.has(m.id_double_b)
  );

  console.log(`Matches REGULAR cat1 (ambas duplas em rounds REGULAR): ${allMatches.length}`);

  // ─── 4. Jogadores ativos da cat1 ─────────────────────────────────────────────
  const { data: players, error: errPlayers } = await supabase
    .from('players')
    .select('id_player, name, side, category_id, active')
    .eq('category_id', ID_CATEGORY)
    .eq('active', true);

  if (errPlayers) throw new Error('players: ' + errPlayers.message);

  const rightPlayers = players.filter(p => p.side === 'RIGHT');
  const leftPlayers  = players.filter(p => p.side === 'LEFT');

  console.log(`Jogadores ativos cat1: RIGHT=${rightPlayers.length} LEFT=${leftPlayers.length}`);

  const playerById = {};
  for (const p of players) playerById[p.id_player] = p;

  // ─── 5. Expandir matches → parcerias (pares de jogadores) ────────────────────
  // Para cada match, obtemos os dois doubles e seus pares de jogadores
  // Uma "parceria" = par não-ordenado {id_player1, id_player2} de um double

  // Chave canônica de parceria: menor_id + '_' + maior_id
  function pairKey(a, b) {
    return a < b ? `${a}_${b}` : `${b}_${a}`;
  }

  // Para cada match, registramos as duplas A e B como parcerias
  // E o match em si
  const partnershipMatchList = {}; // pairKey → [{id_match, round_number, date, status, double_name}]

  for (const m of allMatches) {
    const dA = doubleById[m.id_double_a];
    const dB = doubleById[m.id_double_b];

    if (!dA || !dB) {
      console.warn(`Match ${m.id_match}: double não encontrado (dA=${m.id_double_a}, dB=${m.id_double_b})`);
      continue;
    }

    const roundA = roundById[dA.id_round];

    const matchInfo = {
      id_match: m.id_match,
      round_number: roundA ? roundA.round_number : null,
      date: roundA ? roundA.scheduled_date : null,
      status: m.status,
      scheduled_at: m.scheduled_at,
    };

    // Dupla A
    const kA = pairKey(dA.id_player1, dA.id_player2);
    if (!partnershipMatchList[kA]) partnershipMatchList[kA] = [];
    partnershipMatchList[kA].push({ ...matchInfo, double_name: dA.display_name, which: 'A', id_double: dA.id_double });

    // Dupla B
    const kB = pairKey(dB.id_player1, dB.id_player2);
    if (!partnershipMatchList[kB]) partnershipMatchList[kB] = [];
    partnershipMatchList[kB].push({ ...matchInfo, double_name: dB.display_name, which: 'B', id_double: dB.id_double });
  }

  // ─── 6. Parcerias repetidas (≥2 matches) ──────────────────────────────────────
  const partnershipRepeated = [];

  for (const [key, matchList] of Object.entries(partnershipMatchList)) {
    // Deduplica por id_match (um match pode aparecer como dupla A e B se partner consigo — improvável, mas seguro)
    const seen = new Set();
    const unique = matchList.filter(m => {
      if (seen.has(m.id_match)) return false;
      seen.add(m.id_match);
      return true;
    });

    if (unique.length >= 2) {
      const [idA, idB] = key.split('_').map(Number);
      const pA = playerById[idA];
      const pB = playerById[idB];
      const nameA = pA ? pA.name : `id=${idA}`;
      const nameB = pB ? pB.name : `id=${idB}`;

      const passado = unique.filter(m => m.status === 'FINISHED' || m.status === 'WO').length;
      const futuro  = unique.filter(m => m.status === 'TO_PLAY').length;

      partnershipRepeated.push({
        par: `${nameA} + ${nameB}`,
        id_player_a: idA,
        id_player_b: idB,
        vezes: unique.length,
        passado,
        futuro,
        matches: unique.sort((a, b) => (a.round_number || 0) - (b.round_number || 0)).map(m => ({
          id_match: m.id_match,
          round: m.round_number,
          data: m.date,
          status: m.status,
          double_name: m.double_name,
        })),
      });
    }
  }

  partnershipRepeated.sort((a, b) => b.vezes - a.vezes);

  console.log(`Parcerias repetidas (≥2 matches REGULAR): ${partnershipRepeated.length}`);
  console.log(`  Com ocorrência futura (futuro>0): ${partnershipRepeated.filter(p => p.futuro > 0).length}`);

  // ─── 7. Por jogador — excedente ───────────────────────────────────────────────
  // n_parceiros_distintos_possíveis = nº de jogadores ativos do lado oposto
  // Cada RIGHT joga com LEFT e vice-versa
  const n_R = rightPlayers.length;
  const n_L = leftPlayers.length;

  // Para cada jogador ativo, contar:
  // - matches REGULAR em que aparece
  // - parceiros distintos reais (com quem já formou/forma dupla em matches REGULAR)

  // Monta: id_player → Set de parceiros reais
  const playerPartners = {}; // id_player → Set<id_player>
  const playerMatchCount = {}; // id_player → count

  for (const p of players) {
    playerPartners[p.id_player] = new Set();
    playerMatchCount[p.id_player] = 0;
  }

  for (const m of allMatches) {
    const dA = doubleById[m.id_double_a];
    const dB = doubleById[m.id_double_b];
    if (!dA || !dB) continue;

    // Dupla A: player1 e player2 jogam juntos
    if (playerMatchCount[dA.id_player1] !== undefined) {
      playerMatchCount[dA.id_player1]++;
      playerPartners[dA.id_player1].add(dA.id_player2);
    }
    if (playerMatchCount[dA.id_player2] !== undefined) {
      playerMatchCount[dA.id_player2]++;
      playerPartners[dA.id_player2].add(dA.id_player1);
    }

    // Dupla B
    if (playerMatchCount[dB.id_player1] !== undefined) {
      playerMatchCount[dB.id_player1]++;
      playerPartners[dB.id_player1].add(dB.id_player2);
    }
    if (playerMatchCount[dB.id_player2] !== undefined) {
      playerMatchCount[dB.id_player2]++;
      playerPartners[dB.id_player2].add(dB.id_player1);
    }
  }

  const excessList = [];

  for (const p of players) {
    const lado = p.side;
    const n_possiveis = lado === 'RIGHT' ? n_L : n_R; // parceiros do lado oposto
    const n_reais = playerPartners[p.id_player].size;
    const n_jogos = playerMatchCount[p.id_player];
    const excedente = Math.max(0, n_jogos - n_possiveis);

    excessList.push({
      id_player: p.id_player,
      name: p.name,
      lado,
      n_jogos,
      parceiros_possiveis: n_possiveis,
      parceiros_reais: n_reais,
      excedente,
    });
  }

  excessList.sort((a, b) => b.excedente - a.excedente || b.n_jogos - a.n_jogos);

  const comExcedente = excessList.filter(e => e.excedente > 0);
  console.log(`Jogadores com excedente>0 (obrigados a repetir parceria): ${comExcedente.length}`);

  // ─── 8. Jogos futuros que forçam repetição de dupla ───────────────────────────
  // Matches TO_PLAY cuja dupla A ou B é parceria que já aparece em outro match (mesmo TO_PLAY ou FINISHED/WO)
  const repeatedPairKeys = new Set(
    partnershipRepeated.map(p => pairKey(p.id_player_a, p.id_player_b))
  );

  const futureRepeatMatches = [];

  for (const m of allMatches) {
    if (m.status !== 'TO_PLAY') continue;

    const dA = doubleById[m.id_double_a];
    const dB = doubleById[m.id_double_b];
    if (!dA || !dB) continue;

    const kA = pairKey(dA.id_player1, dA.id_player2);
    const kB = pairKey(dB.id_player1, dB.id_player2);

    const roundA = roundById[dA.id_round];

    const checkDouble = (k, d) => {
      if (!repeatedPairKeys.has(k)) return null;

      // Verifica se jogadores dessa dupla têm parceiro inédito disponível
      // Jogador1 do lado oposto: parceiro inédito = se n_reais < n_possiveis do lado oposto
      const p1 = playerById[d.id_player1];
      const p2 = playerById[d.id_player2];

      const ex1 = excessList.find(e => e.id_player === d.id_player1);
      const ex2 = excessList.find(e => e.id_player === d.id_player2);

      // Esgotado = parceiros_reais >= parceiros_possiveis
      const esgotado1 = ex1 ? ex1.parceiros_reais >= ex1.parceiros_possiveis : false;
      const esgotado2 = ex2 ? ex2.parceiros_reais >= ex2.parceiros_possiveis : false;
      const jogadores_esgotados = esgotado1 && esgotado2;

      return {
        id_match: m.id_match,
        date: roundA ? roundA.scheduled_date : null,
        dupla: d.display_name || `${p1 ? p1.name : d.id_player1} + ${p2 ? p2.name : d.id_player2}`,
        par_key: k,
        jogadores_esgotados,
        esgotado_detail: {
          [p1 ? p1.name : d.id_player1]: esgotado1,
          [p2 ? p2.name : d.id_player2]: esgotado2,
        },
      };
    };

    const resultA = checkDouble(kA, dA);
    if (resultA) futureRepeatMatches.push(resultA);

    const resultB = checkDouble(kB, dB);
    if (resultB) futureRepeatMatches.push(resultB);
  }

  // Deduplica por id_match + par_key
  const futureRepeatSeen = new Set();
  const futureRepeatUniq = futureRepeatMatches.filter(m => {
    const k = `${m.id_match}_${m.par_key}`;
    if (futureRepeatSeen.has(k)) return false;
    futureRepeatSeen.add(k);
    return true;
  });

  futureRepeatUniq.sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  console.log(`Jogos futuros que forçam repetição de dupla: ${futureRepeatUniq.length}`);

  // ─── 9. Jogadores escalados 2× na mesma noite ──────────────────────────────────
  // Para cada jogador, contar quantas vezes joga por data
  const playerDayCount = {}; // id_player → {date → count}

  for (const m of allMatches) {
    const dA = doubleById[m.id_double_a];
    const dB = doubleById[m.id_double_b];
    if (!dA || !dB) continue;

    const roundInfo = roundById[dA.id_round];
    const date = roundInfo ? roundInfo.scheduled_date : (m.scheduled_at ? m.scheduled_at.split('T')[0] : null);
    if (!date) continue;

    const registerPlayer = (id_player) => {
      if (!playerDayCount[id_player]) playerDayCount[id_player] = {};
      if (!playerDayCount[id_player][date]) playerDayCount[id_player][date] = 0;
      playerDayCount[id_player][date]++;
    };

    registerPlayer(dA.id_player1);
    registerPlayer(dA.id_player2);
    registerPlayer(dB.id_player1);
    registerPlayer(dB.id_player2);
  }

  const doublePlaysPerNight = [];
  for (const [id_player, dateCounts] of Object.entries(playerDayCount)) {
    const p = playerById[Number(id_player)];
    if (!p) continue;
    for (const [date, count] of Object.entries(dateCounts)) {
      if (count >= 2) {
        doublePlaysPerNight.push({
          id_player: Number(id_player),
          name: p.name,
          lado: p.side,
          date,
          n_jogos_no_dia: count,
          violacao: count > 2,
        });
      }
    }
  }

  doublePlaysPerNight.sort((a, b) => b.n_jogos_no_dia - a.n_jogos_no_dia || a.date.localeCompare(b.date));

  const violacoes = doublePlaysPerNight.filter(d => d.violacao);
  console.log(`Jogadores que jogam ≥2x numa noite: ${doublePlaysPerNight.length} entradas | Violações (>2x): ${violacoes.length}`);

  // ─── 10. Monta JSON de saída ────────────────────────────────────────────────────
  const output = {
    gerado_em: new Date().toISOString(),
    definicoes: {
      universo: 'Matches de rounds REGULAR da categoria 1 (id_category=1, id_tournament=7)',
      parceria: 'Par não-ordenado {id_player1, id_player2} de um double que aparece em pelo menos um match',
      excedente: 'max(0, n_jogos - n_parceiros_distintos_possíveis)',
      jogadores_esgotados: 'Ambos os jogadores da dupla têm parceiros_reais >= parceiros_possiveis',
    },
    contagem_rounds: {
      regular: roundsRegular.length,
      exhibition: roundsExhibition.length,
      makeup: roundsMakeup.length,
      total: rounds.length,
      excluidos: `${roundsExhibition.length} EXHIBITION + ${roundsMakeup.length} MAKEUP = ${roundsExhibition.length + roundsMakeup.length} rounds excluídos do universo`,
    },
    lados: {
      n_R: n_R,
      n_L: n_L,
      right: rightPlayers.map(p => ({ id: p.id_player, name: p.name })),
      left: leftPlayers.map(p => ({ id: p.id_player, name: p.name })),
    },
    total_matches_regular: allMatches.length,
    total_parcerias_distintas: Object.keys(partnershipMatchList).length,
    parcerias_repetidas: partnershipRepeated,
    excedente_por_jogador: excessList,
    jogos_futuros_repetem_dupla: futureRepeatUniq,
    jogadores_2x_noite: doublePlaysPerNight,
  };

  // Salva JSON
  const dir = path.dirname(OUTPUT_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2), 'utf8');
  console.log(`\nJSON salvo em: ${OUTPUT_PATH}`);

  // ─── 11. RESUMO PT-BR ────────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('RESUMO — Mapeamento parcerias repetidas Masculino Iniciante (cat1)');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`Universo: ${roundsRegular.length} rounds REGULAR | ${allMatches.length} matches`);
  console.log(`Excluídos: ${roundsExhibition.length} EXHIBITION + ${roundsMakeup.length} MAKEUP`);
  console.log(`Jogadores ativos: ${n_R} RIGHT (${rightPlayers.map(p=>p.name).join(', ')})`);
  console.log(`                  ${n_L} LEFT  (${leftPlayers.map(p=>p.name).join(', ')})`);
  console.log(`\nParcerias distintas: ${Object.keys(partnershipMatchList).length}`);
  console.log(`Parcerias REPETIDAS (≥2 matches): ${partnershipRepeated.length}`);
  console.log(`  Com ocorrência FUTURA acionável: ${partnershipRepeated.filter(p => p.futuro > 0).length}`);

  if (partnershipRepeated.length > 0) {
    console.log('\nLista de parcerias repetidas:');
    for (const p of partnershipRepeated) {
      console.log(`  ${p.par}: ${p.vezes}x (passado=${p.passado}, futuro=${p.futuro})`);
      for (const m of p.matches) {
        console.log(`    → match ${m.id_match} | R${m.round} | ${m.date} | ${m.status} | ${m.double_name}`);
      }
    }
  }

  console.log(`\nJogos futuros que forçam repetição de dupla: ${futureRepeatUniq.length}`);
  for (const j of futureRepeatUniq) {
    console.log(`  match ${j.id_match} | ${j.date} | ${j.dupla} | esgotados=${j.jogadores_esgotados}`);
  }

  console.log(`\nJogadores sem parceiro inédito (excedente>0 = obrigados a repetir):`);
  if (comExcedente.length === 0) {
    console.log('  Nenhum (todos ainda têm parceiros inéditos disponíveis)');
  } else {
    for (const e of comExcedente) {
      console.log(`  ${e.name} (${e.lado}): ${e.n_jogos} jogos, ${e.parceiros_possiveis} possíveis, ${e.parceiros_reais} reais, excedente=${e.excedente}`);
    }
  }

  console.log(`\nJogadores que jogam ≥2x numa mesma noite:`);
  if (doublePlaysPerNight.length === 0) {
    console.log('  Nenhum');
  } else {
    for (const d of doublePlaysPerNight) {
      const flag = d.violacao ? ' ⚠️ VIOLAÇÃO (>2x)' : '';
      console.log(`  ${d.name} | ${d.date} | ${d.n_jogos_no_dia}x${flag}`);
    }
  }

  const violacoesFinal = doublePlaysPerNight.filter(d => d.violacao);
  console.log(`\nViolações (>2x/dia): ${violacoesFinal.length === 0 ? 'Nenhuma' : violacoesFinal.map(v => `${v.name} ${v.date} ${v.n_jogos_no_dia}x`).join(', ')}`);
  console.log('═══════════════════════════════════════════════════════════════');
}

main().catch(err => {
  console.error('ERRO:', err);
  process.exit(1);
});
