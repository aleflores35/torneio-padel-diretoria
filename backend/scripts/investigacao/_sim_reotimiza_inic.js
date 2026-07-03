'use strict';
/**
 * SIMULACAO READ-ONLY -- Re-otimizacao do calendario de padel SRB
 * Categoria: Masculino Iniciante (id_category = 1)
 * id_tournament = 7
 *
 * NAO escreve nada no banco. Apenas le, calcula e salva JSON no scratchpad.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const supabase = require('../../supabase');
const fs = require('fs');

const ID_TOURNAMENT = 7;
const ID_CATEGORY   = 1;
const SCRATCHPAD    = 'C:/Users/aless/AppData/Local/Temp/claude/c--obralivre/9484ee84-3113-43fa-bba2-ad6b4cbae786/scratchpad';
const OUT_FILE      = path.join(SCRATCHPAD, 'sim_inic.json');

// ──────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────

function pairKey(a, b) {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

function canPlay(da, db) {
  return da.right !== db.right && da.left !== db.left &&
         da.right !== db.left  && da.left  !== db.right;
}

/**
 * Calcula custo total (repeticoes acima de 1) para um conjunto de jogos,
 * contando historico passado + os jogos fornecidos.
 * Retorna { repR, repL } onde cada um eh a soma de max(0, count-1) por par.
 */
function calcCost(games, doublesMap, hRight0, hLeft0) {
  // Clone do historico passado
  const totR = { ...hRight0 };
  const totL = { ...hLeft0 };

  for (const g of games) {
    const da = doublesMap[g.id_double_a];
    const db = doublesMap[g.id_double_b];
    if (!da || !db) continue;
    const kr = pairKey(da.right, db.right);
    const kl = pairKey(da.left,  db.left);
    totR[kr] = (totR[kr] || 0) + 1;
    totL[kl] = (totL[kl] || 0) + 1;
  }

  let repR = 0, repL = 0;
  for (const v of Object.values(totR)) if (v > 1) repR += (v - 1);
  for (const v of Object.values(totL)) if (v > 1) repL += (v - 1);
  return { repR, repL, total: repR + repL };
}

/**
 * Calcula custo somente nos jogos futuros fornecidos (sem historico passado).
 */
function calcFutureCost(games, doublesMap) {
  return calcCost(games, doublesMap, {}, {});
}

/**
 * Custo marginal de adicionar o jogo (da x db) ao acumulador corrente.
 * delta = +1 por lado que ja se encontrou (contando passado + pareamento atual).
 */
function marginalCost(da, db, accR, accL) {
  const kr = pairKey(da.right, db.right);
  const kl = pairKey(da.left,  db.left);
  const cR = (accR[kr] || 0) >= 1 ? 1 : 0;
  const cL = (accL[kl] || 0) >= 1 ? 1 : 0;
  return cR + cL;
}

// ──────────────────────────────────────────────────────────────────────────
// Greedy com acumulador dinamico
// ──────────────────────────────────────────────────────────────────────────

function greedyMatching(duplas, hRight0, hLeft0) {
  const unpaired = [...duplas];
  const games = [];

  // Acumulador: começa com historico passado e vai sendo atualizado
  const accR = { ...hRight0 };
  const accL = { ...hLeft0 };

  // Controle anti-loop para duplas sem adversario valido no momento
  let stuckCount = 0;
  const MAX_STUCK = unpaired.length;

  while (unpaired.length >= 2) {
    const da = unpaired.shift();
    let bestIdx  = -1;
    let bestCost = Infinity;

    for (let i = 0; i < unpaired.length; i++) {
      const db = unpaired[i];
      if (!canPlay(da, db)) continue;
      const c = marginalCost(da, db, accR, accL);
      if (c < bestCost) {
        bestCost = c;
        bestIdx  = i;
      }
    }

    if (bestIdx === -1) {
      // Nenhum adversario valido ainda -- volta para o final e tenta depois
      unpaired.push(da);
      stuckCount++;
      if (stuckCount > MAX_STUCK) {
        console.warn('AVISO: dupla nao conseguiu adversario valido, ficara como sobra:', da.display_name);
        break;
      }
      continue;
    }

    stuckCount = 0;
    const db = unpaired.splice(bestIdx, 1)[0];

    // Atualiza acumulador
    const kr = pairKey(da.right, db.right);
    const kl = pairKey(da.left,  db.left);
    accR[kr] = (accR[kr] || 0) + 1;
    accL[kl] = (accL[kl] || 0) + 1;

    games.push({ id_double_a: da.id_double, id_double_b: db.id_double });
  }

  return { games, leftover: unpaired };
}

// ──────────────────────────────────────────────────────────────────────────
// 2-opt com custo total real (nao marginal)
// ──────────────────────────────────────────────────────────────────────────

function twoOptImprove(games, doublesMap, hRight0, hLeft0) {
  games = games.map(g => ({ ...g }));
  let improved = true;
  let iters = 0;

  while (improved && iters < 2000) {
    improved = false;
    iters++;

    for (let i = 0; i < games.length; i++) {
      for (let j = i + 1; j < games.length; j++) {
        const g1 = games[i];
        const g2 = games[j];
        const d1a = doublesMap[g1.id_double_a];
        const d1b = doublesMap[g1.id_double_b];
        const d2a = doublesMap[g2.id_double_a];
        const d2b = doublesMap[g2.id_double_b];

        const curCost = calcCost(games, doublesMap, hRight0, hLeft0).total;

        // Alt1: (d1a x d2a) + (d1b x d2b)
        if (canPlay(d1a, d2a) && canPlay(d1b, d2b)) {
          const alt = [...games];
          alt[i] = { id_double_a: d1a.id_double, id_double_b: d2a.id_double };
          alt[j] = { id_double_a: d1b.id_double, id_double_b: d2b.id_double };
          if (calcCost(alt, doublesMap, hRight0, hLeft0).total < curCost) {
            games[i] = alt[i];
            games[j] = alt[j];
            improved = true;
            continue;
          }
        }

        // Alt2: (d1a x d2b) + (d1b x d2a)
        if (canPlay(d1a, d2b) && canPlay(d1b, d2a)) {
          const alt = [...games];
          alt[i] = { id_double_a: d1a.id_double, id_double_b: d2b.id_double };
          alt[j] = { id_double_a: d1b.id_double, id_double_b: d2a.id_double };
          if (calcCost(alt, doublesMap, hRight0, hLeft0).total < curCost) {
            games[i] = alt[i];
            games[j] = alt[j];
            improved = true;
            continue;
          }
        }
      }
    }
  }

  console.log(`  2-opt: ${iters} iteracoes`);
  return games;
}

// ──────────────────────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== SIM RE-OTIMIZACAO MASCULINO INICIANTE (cat 1, torneio 7) ===\n');

  // 1. Rounds REGULAR da categoria 1 / torneio 7
  const { data: rounds, error: eR } = await supabase
    .from('rounds')
    .select('id_round, id_category, round_type')
    .eq('id_category', ID_CATEGORY)
    .eq('id_tournament', ID_TOURNAMENT)
    .eq('round_type', 'REGULAR');

  if (eR) throw new Error('Erro ao buscar rounds: ' + eR.message);

  const roundIds = rounds.map(r => r.id_round);
  console.log(`Rounds REGULAR cat 1: ${roundIds.join(', ')}`);

  if (roundIds.length === 0) {
    console.log('Nenhum round encontrado.');
    process.exit(0);
  }

  // 2. Doubles destes rounds
  const { data: doubles, error: eD } = await supabase
    .from('doubles')
    .select('id_double, id_player1, id_player2, id_round, display_name')
    .in('id_round', roundIds);

  if (eD) throw new Error('Erro ao buscar doubles: ' + eD.message);

  // id_player1 = RIGHT, id_player2 = LEFT
  const doublesMap = {};
  for (const d of doubles) {
    doublesMap[d.id_double] = {
      id_double:    d.id_double,
      right:        d.id_player1,
      left:         d.id_player2,
      id_round:     d.id_round,
      display_name: d.display_name,
    };
  }

  console.log(`Doubles encontrados: ${doubles.length}`);

  // 3. Matches cujas duplas pertencem a estes rounds
  const doubleIds = doubles.map(d => d.id_double);
  const doubleIdSet = new Set(doubleIds);

  const { data: matchesRaw, error: eM } = await supabase
    .from('matches')
    .select('id_match, id_double_a, id_double_b, scheduled_at, status')
    .or(`id_double_a.in.(${doubleIds.join(',')}),id_double_b.in.(${doubleIds.join(',')})`);

  if (eM) throw new Error('Erro ao buscar matches: ' + eM.message);

  const matches = matchesRaw.filter(m =>
    doubleIdSet.has(m.id_double_a) && doubleIdSet.has(m.id_double_b)
  );

  const pastMatches   = matches.filter(m => m.status === 'FINISHED' || m.status === 'WO');
  const futureMatches = matches.filter(m => m.status === 'TO_PLAY');

  console.log(`Matches cat 1: ${matches.length} | Passado: ${pastMatches.length} | Futuro: ${futureMatches.length}`);

  // 4. Historico passado (fixo)
  const hRight0 = {};
  const hLeft0  = {};

  for (const m of pastMatches) {
    const da = doublesMap[m.id_double_a];
    const db = doublesMap[m.id_double_b];
    if (!da || !db) continue;
    const kr = pairKey(da.right, db.right);
    const kl = pairKey(da.left,  db.left);
    hRight0[kr] = (hRight0[kr] || 0) + 1;
    hLeft0[kl]  = (hLeft0[kl]  || 0) + 1;
  }

  // 5. Duplas dos jogos futuros
  const futureDuplaIds = new Set();
  for (const m of futureMatches) {
    futureDuplaIds.add(m.id_double_a);
    futureDuplaIds.add(m.id_double_b);
  }
  const futureDuplas = [...futureDuplaIds].map(id => doublesMap[id]).filter(Boolean);

  console.log(`Duplas nos jogos futuros: ${futureDuplas.length}`);

  // 6. Custo ANTES (pareamento atual do banco)
  const beforeFut = calcFutureCost(futureMatches, doublesMap);
  const beforeAll = calcCost(futureMatches, doublesMap, hRight0, hLeft0);

  console.log(`\nANTES:`);
  console.log(`  Rep direita (futuro):  ${beforeFut.repR}`);
  console.log(`  Rep esquerda (futuro): ${beforeFut.repL}`);
  console.log(`  Total futuro:  ${beforeFut.total}`);
  console.log(`  Total geral:   ${beforeAll.total}`);

  // 7. Otimizacao
  console.log('\n--- Otimizando... ---');
  const { games: greedyGames, leftover } = greedyMatching(futureDuplas, hRight0, hLeft0);
  console.log(`  Greedy: ${greedyGames.length} jogos, ${leftover.length} duplas sobrando`);

  const optimized = twoOptImprove(greedyGames, doublesMap, hRight0, hLeft0);

  // 8. Custo DEPOIS
  const afterFut = calcFutureCost(optimized, doublesMap);
  const afterAll = calcCost(optimized, doublesMap, hRight0, hLeft0);

  console.log(`\nDEPOIS:`);
  console.log(`  Rep direita (futuro):  ${afterFut.repR}`);
  console.log(`  Rep esquerda (futuro): ${afterFut.repL}`);
  console.log(`  Total futuro:  ${afterFut.total}`);
  console.log(`  Total geral:   ${afterAll.total}`);
  console.log(`  Ganho geral:   ${beforeAll.total - afterAll.total}`);

  // 9. Validacao
  const countByDupla = {};
  for (const g of optimized) {
    countByDupla[g.id_double_a] = (countByDupla[g.id_double_a] || 0) + 1;
    countByDupla[g.id_double_b] = (countByDupla[g.id_double_b] || 0) + 1;
  }
  const cada1x = futureDuplas.every(d => countByDupla[d.id_double] === 1);
  let semRepetido = true;
  for (const g of optimized) {
    const da = doublesMap[g.id_double_a];
    const db = doublesMap[g.id_double_b];
    if (!da || !db || !canPlay(da, db)) { semRepetido = false; break; }
  }
  const duplasIntactas = optimized.every(g => doublesMap[g.id_double_a] && doublesMap[g.id_double_b]);

  console.log(`\nValidacao:`);
  console.log(`  Duplas intactas:      ${duplasIntactas}`);
  console.log(`  Sem jogador repetido: ${semRepetido}`);
  console.log(`  Cada dupla 1x:        ${cada1x}`);

  // 10. Repeticoes remanescentes (passado + futuro otimizado)
  const totRFinal = { ...hRight0 };
  const totLFinal = { ...hLeft0 };
  for (const g of optimized) {
    const da = doublesMap[g.id_double_a];
    const db = doublesMap[g.id_double_b];
    if (!da || !db) continue;
    const kr = pairKey(da.right, db.right);
    const kl = pairKey(da.left,  db.left);
    totRFinal[kr] = (totRFinal[kr] || 0) + 1;
    totLFinal[kl] = (totLFinal[kl] || 0) + 1;
  }

  // Nomes dos jogadores
  const playerIds = new Set();
  for (const m of matches) {
    const da = doublesMap[m.id_double_a];
    const db = doublesMap[m.id_double_b];
    if (da) { playerIds.add(da.right); playerIds.add(da.left); }
    if (db) { playerIds.add(db.right); playerIds.add(db.left); }
  }

  const { data: players, error: eP } = await supabase
    .from('players')
    .select('id_player, name')
    .in('id_player', [...playerIds]);

  if (eP) throw new Error('Erro ao buscar players: ' + eP.message);

  const playerName = {};
  for (const p of players) playerName[p.id_player] = p.name;

  const repeticoesRemanescentes = [];
  for (const [k, v] of Object.entries(totRFinal)) {
    if (v > 1) {
      const [a, b] = k.split(':').map(Number);
      repeticoesRemanescentes.push({ lado: 'direita', par: `${playerName[a] || a} vs ${playerName[b] || b}`, vezes: v });
    }
  }
  for (const [k, v] of Object.entries(totLFinal)) {
    if (v > 1) {
      const [a, b] = k.split(':').map(Number);
      repeticoesRemanescentes.push({ lado: 'esquerda', par: `${playerName[a] || a} vs ${playerName[b] || b}`, vezes: v });
    }
  }
  repeticoesRemanescentes.sort((a, b) => b.vezes - a.vezes || a.lado.localeCompare(b.lado));

  console.log(`\nRepeticoes remanescentes (passado + futuro otimizado): ${repeticoesRemanescentes.length}`);
  for (const r of repeticoesRemanescentes) {
    console.log(`  [${r.lado}] ${r.par}: ${r.vezes}x`);
  }

  // 11. Pareamento final com nomes
  const novoPareamento = optimized.map(g => ({
    duplaA:      doublesMap[g.id_double_a]?.display_name || `double ${g.id_double_a}`,
    duplaB:      doublesMap[g.id_double_b]?.display_name || `double ${g.id_double_b}`,
    id_double_a: g.id_double_a,
    id_double_b: g.id_double_b,
  }));

  console.log('\nNovo pareamento otimizado:');
  for (const g of novoPareamento) {
    console.log(`  ${g.duplaA}  x  ${g.duplaB}`);
  }

  // 12. Paridade
  let paridade = 'Nenhuma -- numero par de duplas, todas pareadas';
  if (leftover.length > 0) {
    paridade = `Dupla(s) sem adversario valido: ${leftover.map(d => d.display_name || d.id_double).join(', ')}`;
  }

  // 13. JSON final
  const result = {
    n_duplas_futuras: futureDuplas.length,
    n_jogos_futuros:  optimized.length,
    antes: {
      rep_direita:  beforeFut.repR,
      rep_esquerda: beforeFut.repL,
      total_futuro: beforeFut.total,
      total_geral:  beforeAll.total,
    },
    depois: {
      rep_direita:  afterFut.repR,
      rep_esquerda: afterFut.repL,
      total_futuro: afterFut.total,
      total_geral:  afterAll.total,
    },
    ganho_geral: beforeAll.total - afterAll.total,
    novo_pareamento:          novoPareamento,
    repeticoes_remanescentes: repeticoesRemanescentes,
    validacao: {
      duplas_intactas:      duplasIntactas,
      sem_jogador_repetido: semRepetido,
      cada_dupla_1x:        cada1x,
    },
    paridade,
  };

  fs.mkdirSync(SCRATCHPAD, { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(result, null, 2), 'utf-8');
  console.log(`\nJSON salvo em: ${OUT_FILE}`);

  return result;
}

main().catch(err => {
  console.error('ERRO:', err);
  process.exit(1);
});
