/**
 * SIMULAÇÃO READ-ONLY — Re-otimização calendário Masculino 4ª (id_category = 2)
 * id_tournament = 7
 *
 * Definição de "confronto mesma posição":
 *   Match (dupla_A vs dupla_B) gera 2 confrontos de posição:
 *     - RIGHT_A (id_player1 de A) vs RIGHT_B (id_player1 de B) → ambos são lados RIGHT
 *     - LEFT_A  (id_player2 de A) vs LEFT_B  (id_player2 de B) → ambos são lados LEFT
 *
 *   Repetição: o mesmo par (RIGHT_x, RIGHT_y) ou (LEFT_x, LEFT_y) se enfrenta em 2+ matches.
 *
 * Re-pareamento: dentro de cada round futuro, re-emparelha as duplas (duplas = fixas).
 * O acumulador de histórico cresce com todos os passados e com os futuros já re-pareados.
 *
 * NÃO escreve no banco.
 */

const supabase = require('../../supabase');
const fs = require('fs');

const OUTPUT_PATH = 'C:/Users/aless/AppData/Local/Temp/claude/c--obralivre/9484ee84-3113-43fa-bba2-ad6b4cbae786/scratchpad/sim_masc4.json';

async function main() {
  console.log('=== SIMULAÇÃO RE-OTIMIZAÇÃO Masc 4ª (cat 2, tournament 7) ===\n');

  // 1. Rounds REGULAR cat 2
  const { data: rounds, error: eRounds } = await supabase
    .from('rounds')
    .select('id_round, id_category, round_type')
    .eq('id_category', 2)
    .eq('round_type', 'REGULAR');
  if (eRounds) throw new Error('rounds: ' + eRounds.message);
  const roundIds = rounds.map(r => r.id_round);
  console.log(`Rounds REGULAR cat 2: ${roundIds.length}`);

  // 2. Doubles
  const { data: doubles, error: eDoubles } = await supabase
    .from('doubles')
    .select('id_double, id_player1, id_player2, id_round, display_name')
    .in('id_round', roundIds);
  if (eDoubles) throw new Error('doubles: ' + eDoubles.message);
  const doubleMap = {};
  doubles.forEach(d => { doubleMap[d.id_double] = d; });
  const allDoubleIds = doubles.map(d => d.id_double);

  // 3. Matches
  const { data: mA } = await supabase.from('matches')
    .select('id_match, id_double_a, id_double_b, scheduled_at, status')
    .in('id_double_a', allDoubleIds);
  const { data: mB } = await supabase.from('matches')
    .select('id_match, id_double_a, id_double_b, scheduled_at, status')
    .in('id_double_b', allDoubleIds);
  const matchMap = {};
  [...(mA || []), ...(mB || [])].forEach(m => { matchMap[m.id_match] = m; });
  const allMatches = Object.values(matchMap);
  const doubleIdSet = new Set(allDoubleIds);
  const catMatches = allMatches.filter(m =>
    doubleIdSet.has(m.id_double_a) && doubleIdSet.has(m.id_double_b)
  );
  const pastMatches = catMatches.filter(m => m.status === 'FINISHED' || m.status === 'WO');
  const futureMatches = catMatches.filter(m => m.status === 'TO_PLAY');
  console.log(`Matches cat 2 REGULAR: ${catMatches.length} (${pastMatches.length} passados, ${futureMatches.length} futuros)`);

  // 4. Players
  const playerIds = [...new Set(doubles.flatMap(d => [d.id_player1, d.id_player2]))];
  const { data: players } = await supabase.from('players')
    .select('id_player, name, side')
    .in('id_player', playerIds);
  const playerMap = {};
  players.forEach(p => { playerMap[p.id_player] = p; });

  function playerName(id) { return playerMap[id]?.name || `p${id}`; }
  function doubleName(id) {
    const d = doubleMap[id];
    if (!d) return `#${id}`;
    if (d.display_name) return d.display_name;
    return `${playerName(d.id_player1)} / ${playerName(d.id_player2)}`;
  }

  // -----------------------------------------------------------------------
  // 5. Acumuladores de confronto de posição
  //
  //   H_right[pairKey(pA, pB)] = nº de vezes que RIGHT_pA enfrentou RIGHT_pB
  //   H_left [pairKey(pA, pB)] = nº de vezes que LEFT_pA  enfrentou LEFT_pB
  //
  //   Cada match (dA vs dB) contribui:
  //     H_right[ pairKey(dA.p1, dB.p1) ] += 1
  //     H_left [ pairKey(dA.p2, dB.p2) ] += 1
  // -----------------------------------------------------------------------

  function pairKey(a, b) { return `${Math.min(a, b)}_${Math.max(a, b)}`; }
  function inc(store, a, b) { const k = pairKey(a, b); store[k] = (store[k] || 0) + 1; }
  function get(store, a, b) { return store[pairKey(a, b)] || 0; }
  function cloneAcc(acc) { return Object.assign({}, acc); }

  // Acumulador dos passados (fixo)
  const H_right = {}, H_left = {};
  for (const m of pastMatches) {
    const a = doubleMap[m.id_double_a], b = doubleMap[m.id_double_b];
    if (!a || !b) continue;
    inc(H_right, a.id_player1, b.id_player1);
    inc(H_left, a.id_player2, b.id_player2);
  }

  console.log('\nHistórico passados (pares com >=1 encontro):');
  console.log('  RIGHT:', Object.entries(H_right).filter(([,v])=>v>=1).map(([k,v])=>`${k.split('_').map(id=>playerName(Number(id))).join('×')}=${v}`).join(', ') || 'nenhum');
  console.log('  LEFT:', Object.entries(H_left).filter(([,v])=>v>=1).map(([k,v])=>`${k.split('_').map(id=>playerName(Number(id))).join('×')}=${v}`).join(', ') || 'nenhum');

  // -----------------------------------------------------------------------
  // 6. Custo incremental de adicionar o match (dA vs dB) ao acumulador acc
  //
  //   Para cada par (RIGHT_dA.p1, RIGHT_dB.p1): se já há >= 1 encontro → custo ++
  //   Para cada par (LEFT_dA.p2, LEFT_dB.p2): se já há >= 1 encontro → custo ++
  //
  //   O custo é o número de NOVAS repetições adicionadas.
  // -----------------------------------------------------------------------

  function incrementalCost(dA, dB, accR, accL) {
    const a = doubleMap[dA], b = doubleMap[dB];
    if (!a || !b) return 9999;
    let cost = 0;
    if (get(accR, a.id_player1, b.id_player1) >= 1) cost++;
    if (get(accL, a.id_player2, b.id_player2) >= 1) cost++;
    return cost;
  }

  function applyMatch(dA, dB, accR, accL) {
    const a = doubleMap[dA], b = doubleMap[dB];
    if (!a || !b) return;
    inc(accR, a.id_player1, b.id_player1);
    inc(accL, a.id_player2, b.id_player2);
  }

  // -----------------------------------------------------------------------
  // 7. Validação: 4 jogadores distintos num jogo
  //    (duplas de rodízio americano: um jogador pode aparecer em 2 duplas do
  //     mesmo round, mas nunca em ambas do MESMO JOGO)
  // -----------------------------------------------------------------------

  function validGame(dA, dB) {
    const a = doubleMap[dA], b = doubleMap[dB];
    if (!a || !b) return false;
    const ps = [a.id_player1, a.id_player2, b.id_player1, b.id_player2];
    return new Set(ps).size === 4;
  }

  // -----------------------------------------------------------------------
  // 8. Perfect matching de um round (conjunto de duplas)
  //    Restrições: cada dupla aparece exatamente 1x; cada jogo tem 4 jogadores distintos.
  //    Em rodízio americano (6 duplas / round), um jogador aparece em 2 duplas —
  //    as 2 duplas desse jogador NÃO podem jogar no mesmo jogo.
  //    Garante-se via validGame.
  // -----------------------------------------------------------------------

  // Custo total de uma lista de pares sobre base
  function totalCostList(pairs, baseR, baseL) {
    const accR = cloneAcc(baseR), accL = cloneAcc(baseL);
    let cost = 0;
    for (const [dA, dB] of pairs) {
      cost += incrementalCost(dA, dB, accR, accL);
      applyMatch(dA, dB, accR, accL);
    }
    return cost;
  }

  // Enumerar todos os perfect matchings de um pool (exaustivo — OK para pools <= 8 duplas)
  // Retorna lista de matchings, cada um = array de [dA, dB]
  function enumPerfectMatchings(pool) {
    const results = [];
    if (pool.length === 0) { results.push([]); return results; }
    if (pool.length % 2 !== 0) return results; // pool ímpar não tem PM

    function backtrack(remaining, current) {
      if (remaining.length === 0) { results.push([...current]); return; }
      const first = remaining[0];
      for (let i = 1; i < remaining.length; i++) {
        if (!validGame(first, remaining[i])) continue;
        const next = remaining.slice(1).filter((_, idx) => idx !== i - 1);
        current.push([first, remaining[i]]);
        backtrack(next, current);
        current.pop();
      }
    }
    backtrack(pool, []);
    return results;
  }

  // Otimização: busca exaustiva de perfect matchings + escolha do de menor custo
  function optimalPairing(pool, baseR, baseL) {
    const pms = enumPerfectMatchings(pool);
    if (pms.length === 0) {
      // Fallback: guloso simples
      const remaining = [...pool];
      const pairs = [];
      const accR = cloneAcc(baseR), accL = cloneAcc(baseL);
      while (remaining.length >= 2) {
        const dA = remaining.shift();
        let bestB = null, bestCost = Infinity, bestIdx = -1;
        for (let i = 0; i < remaining.length; i++) {
          if (!validGame(dA, remaining[i])) continue;
          const c = incrementalCost(dA, remaining[i], accR, accL);
          if (c < bestCost) { bestCost = c; bestB = remaining[i]; bestIdx = i; }
        }
        if (bestB === null) break;
        pairs.push([dA, bestB]);
        applyMatch(dA, bestB, accR, accL);
        remaining.splice(bestIdx, 1);
      }
      return { pairs, bye: null };
    }

    let bestPairs = pms[0], bestCost = totalCostList(pms[0], baseR, baseL);
    for (let i = 1; i < pms.length; i++) {
      const c = totalCostList(pms[i], baseR, baseL);
      if (c < bestCost) { bestCost = c; bestPairs = pms[i]; }
    }
    return { pairs: bestPairs, bye: null, totalPMs: pms.length };
  }

  // -----------------------------------------------------------------------
  // 9. Processar rounds futuros
  // -----------------------------------------------------------------------

  // Agrupar futuros por round
  const futureByRound = {};
  for (const m of futureMatches) {
    const a = doubleMap[m.id_double_a];
    if (!a) continue;
    const rid = a.id_round;
    if (!futureByRound[rid]) futureByRound[rid] = { matches: [], doubles: new Set() };
    futureByRound[rid].matches.push(m);
    futureByRound[rid].doubles.add(m.id_double_a);
    futureByRound[rid].doubles.add(m.id_double_b);
  }
  const sortedFutureRids = Object.keys(futureByRound).map(Number).sort((a, b) => a - b);

  console.log(`\nRounds futuros: ${sortedFutureRids.length} → [${sortedFutureRids.join(', ')}]`);
  sortedFutureRids.forEach(rid => {
    const info = futureByRound[rid];
    console.log(`  Round ${rid}: ${info.doubles.size} duplas, ${info.matches.length} matches`);
  });

  // -----------------------------------------------------------------------
  // 10. Baseline ANTES: custo dos matches futuros conforme estão no banco
  // -----------------------------------------------------------------------
  let beforeRepRight = 0, beforeRepLeft = 0;
  const beforeAllPairs = [];
  {
    const tmpR = cloneAcc(H_right), tmpL = cloneAcc(H_left);
    for (const rid of sortedFutureRids) {
      for (const m of futureByRound[rid].matches) {
        const a = doubleMap[m.id_double_a], b = doubleMap[m.id_double_b];
        if (!a || !b) continue;
        if (get(tmpR, a.id_player1, b.id_player1) >= 1) beforeRepRight++;
        if (get(tmpL, a.id_player2, b.id_player2) >= 1) beforeRepLeft++;
        inc(tmpR, a.id_player1, b.id_player1);
        inc(tmpL, a.id_player2, b.id_player2);
        beforeAllPairs.push([m.id_double_a, m.id_double_b]);
      }
    }
  }

  // -----------------------------------------------------------------------
  // 11. Pré-computar todos os perfect matchings por round
  // -----------------------------------------------------------------------
  const roundPMs = {}; // rid → array de perfect matchings possíveis
  for (const rid of sortedFutureRids) {
    const pool = [...futureByRound[rid].doubles];
    if (pool.length % 2 === 0) {
      roundPMs[rid] = enumPerfectMatchings(pool);
    } else {
      // Pool ímpar: gerar PM para cada subpool com 1 bye
      const allPMsWithBye = [];
      for (const byeCandidate of pool) {
        const subPool = pool.filter(d => d !== byeCandidate);
        const pms = enumPerfectMatchings(subPool).map(pm => ({ pm, bye: byeCandidate }));
        allPMsWithBye.push(...pms);
      }
      roundPMs[rid] = allPMsWithBye; // {pm, bye}
    }
    console.log(`  Round ${rid}: ${roundPMs[rid].length} perfect matchings possíveis`);
  }

  // -----------------------------------------------------------------------
  // 12. Otimização global: busca exaustiva sobre todos os rounds
  //     Para rounds com 2 duplas: 1 PM. Para 6 duplas: até 7 PMs.
  //     Total: produto dos PMs por round — tipicamente 7^4 * 1^5 = 2401
  // -----------------------------------------------------------------------

  // Função recursiva: escolhe o PM de cada round e acumula custo
  let globalBestCost = Infinity;
  let globalBestAssignment = null; // [{ rid, pairs, bye }]

  function searchGlobal(ridIdx, accR, accL, currentAssignment, currentCost) {
    if (currentCost >= globalBestCost) return; // poda

    if (ridIdx === sortedFutureRids.length) {
      if (currentCost < globalBestCost) {
        globalBestCost = currentCost;
        globalBestAssignment = currentAssignment.map(x => ({ ...x, pairs: [...x.pairs] }));
      }
      return;
    }

    const rid = sortedFutureRids[ridIdx];
    const pmsForRound = roundPMs[rid];

    for (const pmEntry of pmsForRound) {
      // pmEntry pode ser um array de pares (pool par) ou {pm, bye} (pool ímpar)
      const pairs = Array.isArray(pmEntry) ? pmEntry : pmEntry.pm;
      const bye = Array.isArray(pmEntry) ? null : pmEntry.bye;

      // Custo deste round com o acumulador atual
      let roundCost = 0;
      const newAccR = cloneAcc(accR), newAccL = cloneAcc(accL);
      for (const [dA, dB] of pairs) {
        roundCost += incrementalCost(dA, dB, newAccR, newAccL);
        applyMatch(dA, dB, newAccR, newAccL);
      }

      currentAssignment.push({ rid, pairs, bye });
      searchGlobal(ridIdx + 1, newAccR, newAccL, currentAssignment, currentCost + roundCost);
      currentAssignment.pop();
    }
  }

  console.log('\nOtimização global iniciando...');
  searchGlobal(0, cloneAcc(H_right), cloneAcc(H_left), [], 0);
  console.log(`Custo global ótimo: ${globalBestCost}`);

  // -----------------------------------------------------------------------
  // 13. Calcular métricas do resultado otimizado
  // -----------------------------------------------------------------------
  const resultsByRound = {};
  const allOptimizedPairs = [];
  let afterRepRight = 0, afterRepLeft = 0;

  {
    const tmpR = cloneAcc(H_right), tmpL = cloneAcc(H_left);
    for (const { rid, pairs, bye } of globalBestAssignment) {
      let rndRepR = 0, rndRepL = 0;
      for (const [dA, dB] of pairs) {
        const a = doubleMap[dA], b = doubleMap[dB];
        if (!a || !b) continue;
        if (get(tmpR, a.id_player1, b.id_player1) >= 1) { rndRepR++; afterRepRight++; }
        if (get(tmpL, a.id_player2, b.id_player2) >= 1) { rndRepL++; afterRepLeft++; }
        applyMatch(dA, dB, tmpR, tmpL);
      }
      resultsByRound[rid] = {
        originalPairs: futureByRound[rid].matches.map(m => [m.id_double_a, m.id_double_b]),
        optimizedPairs: pairs,
        bye,
        repRight: rndRepR,
        repLeft: rndRepL,
      };
      allOptimizedPairs.push(...pairs);
      console.log(`  Round ${rid}: ${pairs.length} jogos, rep_dir=${rndRepR}, rep_esq=${rndRepL}${bye ? `, bye=${doubleName(bye)}` : ''}`);
    }
  }

  // -----------------------------------------------------------------------
  // 12. Total geral (passados + futuros)
  // -----------------------------------------------------------------------
  function totalGeralReps(futurePairs) {
    const tR = {}, tL = {};
    const all = [...pastMatches.map(m => [m.id_double_a, m.id_double_b]), ...futurePairs];
    for (const [dA, dB] of all) {
      const a = doubleMap[dA], b = doubleMap[dB];
      if (!a || !b) continue;
      inc(tR, a.id_player1, b.id_player1);
      inc(tL, a.id_player2, b.id_player2);
    }
    let rR = 0, rL = 0;
    for (const v of Object.values(tR)) if (v > 1) rR += v - 1;
    for (const v of Object.values(tL)) if (v > 1) rL += v - 1;
    return rR + rL;
  }

  const beforeTotalGeral = totalGeralReps(beforeAllPairs);
  const afterTotalGeral = totalGeralReps(allOptimizedPairs);

  // -----------------------------------------------------------------------
  // 13. Repetições remanescentes (futuros otimizados)
  // -----------------------------------------------------------------------
  const remanescentes = [];
  {
    const tmpR = cloneAcc(H_right), tmpL = cloneAcc(H_left);
    for (const [dA, dB] of allOptimizedPairs) {
      const a = doubleMap[dA], b = doubleMap[dB];
      if (!a || !b) continue;
      if (get(tmpR, a.id_player1, b.id_player1) >= 1) {
        remanescentes.push({
          lado: 'direita',
          par: `${playerName(a.id_player1)} × ${playerName(b.id_player1)}`,
          vezes: get(tmpR, a.id_player1, b.id_player1) + 1,
        });
      }
      inc(tmpR, a.id_player1, b.id_player1);
      if (get(tmpL, a.id_player2, b.id_player2) >= 1) {
        remanescentes.push({
          lado: 'esquerda',
          par: `${playerName(a.id_player2)} × ${playerName(b.id_player2)}`,
          vezes: get(tmpL, a.id_player2, b.id_player2) + 1,
        });
      }
      inc(tmpL, a.id_player2, b.id_player2);
    }
  }

  // -----------------------------------------------------------------------
  // 14. Novo pareamento global
  // -----------------------------------------------------------------------
  const novoPareamento = [];
  for (const rid of sortedFutureRids) {
    const { optimizedPairs, bye } = resultsByRound[rid];
    for (const [dA, dB] of optimizedPairs) {
      novoPareamento.push({ round: rid, duplaA: doubleName(dA), duplaB: doubleName(dB), id_double_a: dA, id_double_b: dB });
    }
    if (bye !== null) novoPareamento.push({ round: rid, bye: doubleName(bye), id_double_bye: bye });
  }

  // -----------------------------------------------------------------------
  // 15. Validação global
  // -----------------------------------------------------------------------
  const allUsed = allOptimizedPairs.flatMap(([a, b]) => [a, b]);
  const allUsedSet = new Set(allUsed);
  const byes = new Set(sortedFutureRids.map(rid => resultsByRound[rid].bye).filter(x => x !== null));
  const expectedSet = new Set(futureMatches.flatMap(m => [m.id_double_a, m.id_double_b]));
  const duplosIntactos = [...expectedSet].filter(d => !byes.has(d)).every(d => allUsedSet.has(d));
  const semJogadorRepetido = allOptimizedPairs.every(([a, b]) => validGame(a, b));
  const cada1x = allUsed.length === allUsedSet.size;

  // -----------------------------------------------------------------------
  // 16. Output
  // -----------------------------------------------------------------------
  console.log('\n=== RESULTADO FINAL ===');
  console.log(`ANTES  — futuro: dir=${beforeRepRight} esq=${beforeRepLeft} tot_futuro=${beforeRepRight + beforeRepLeft} tot_geral=${beforeTotalGeral}`);
  console.log(`DEPOIS — futuro: dir=${afterRepRight} esq=${afterRepLeft} tot_futuro=${afterRepRight + afterRepLeft} tot_geral=${afterTotalGeral}`);
  console.log(`Ganho nos futuros: ${(beforeRepRight + beforeRepLeft) - (afterRepRight + afterRepLeft)} repetições eliminadas`);
  console.log(`\nRemanescentes (${remanescentes.length}):`);
  remanescentes.forEach(r => console.log(`  [${r.lado}] ${r.par} — ${r.vezes}x`));
  console.log('\nNovo pareamento por round:');
  for (const rid of sortedFutureRids) {
    const { optimizedPairs, bye, repRight, repLeft } = resultsByRound[rid];
    console.log(`  --- Round ${rid} (dir=${repRight} esq=${repLeft}) ---`);
    optimizedPairs.forEach(([dA, dB]) => {
      const a = doubleMap[dA], b = doubleMap[dB];
      const rConflict = get(H_right, a?.id_player1, b?.id_player1) > 0 ? ' [R!]' : '';
      const lConflict = get(H_left, a?.id_player2, b?.id_player2) > 0 ? ' [L!]' : '';
      console.log(`    ${doubleName(dA)}  vs  ${doubleName(dB)}${rConflict}${lConflict}`);
    });
    if (bye) console.log(`    [BYE] ${doubleName(bye)}`);
  }
  console.log(`\nValidação: duplas_intactas=${duplosIntactos} sem_jogador_repetido=${semJogadorRepetido} cada_dupla_1x=${cada1x}`);

  const result = {
    n_duplas_futuras: expectedSet.size,
    n_jogos_futuros: futureMatches.length,
    antes: {
      rep_direita: beforeRepRight,
      rep_esquerda: beforeRepLeft,
      total_futuro: beforeRepRight + beforeRepLeft,
      total_geral: beforeTotalGeral,
    },
    depois: {
      rep_direita: afterRepRight,
      rep_esquerda: afterRepLeft,
      total_futuro: afterRepRight + afterRepLeft,
      total_geral: afterTotalGeral,
    },
    novo_pareamento: novoPareamento,
    repeticoes_remanescentes: remanescentes,
    validacao: { duplas_intactas: duplosIntactos, sem_jogador_repetido: semJogadorRepetido, cada_dupla_1x: cada1x },
    paridade: byes.size > 0 ? { byes: [...byes].map(b => ({ id: b, nome: doubleName(b) })) } : null,
  };

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(result, null, 2), 'utf8');
  console.log(`\nJSON salvo em: ${OUTPUT_PATH}`);
}

main().catch(err => { console.error('ERRO:', err); process.exit(1); });
