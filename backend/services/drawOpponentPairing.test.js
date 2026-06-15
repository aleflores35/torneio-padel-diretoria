// Testes do pareamento de adversários (pairDoublesGreedy).
// Regra reforçada: NÃO repetir adversário da MESMA POSIÇÃO (direita×direita /
// esquerda×esquerda) enquanto houver adversário inédito daquela posição — mesmo
// que isso custe mais oposição genérica. É o confronto que define o ranking por lado.
//
// Rodar: node backend/services/drawOpponentPairing.test.js

const assert = require('assert');
const { buildOppositionCost, pairDoublesGreedy, computeMatchCost } = require('./weeklyDrawService');

// 4 duplas, todas RIGHT+LEFT.
//   D1 = R1(1) + L1(2)
//   D2 = R2(3) + L2(4)
//   D3 = R3(5) + L3(6)
//   D4 = R4(7) + L4(8)
const sideById = { 1: 'RIGHT', 2: 'LEFT', 3: 'RIGHT', 4: 'LEFT', 5: 'RIGHT', 6: 'LEFT', 7: 'RIGHT', 8: 'LEFT' };
const D1 = { id_double: 1, id_player1: 1, id_player2: 2 };
const D2 = { id_double: 2, id_player1: 3, id_player2: 4 };
const D3 = { id_double: 3, id_player1: 5, id_player2: 6 };
const D4 = { id_double: 4, id_player1: 7, id_player2: 8 };
const doubles = [D1, D2, D3, D4];

function opponentOf(pairs, idDouble) {
  const m = pairs.find(([a, b]) => a.id_double === idDouble || b.id_double === idDouble);
  if (!m) return null;
  return m[0].id_double === idDouble ? m[1].id_double : m[0].id_double;
}

// ── Teste 1: evita repetir adversário de mesma posição mesmo com oposição genérica cara ──
(function testEvitaRepetirMesmaPosicao() {
  // R1(1) JÁ enfrentou R2(3) na mesma posição (direita) → diagonal_count=1.
  // Pra tentar empurrar o algoritmo de volta pra D2, tornamos D1×D3 e D1×D4 caríssimos
  // em oposição GENÉRICA (lado oposto) — mas isso não pode vencer a regra de posição.
  const oppositions = [
    { id_player1: 1, id_player2: 3, times_opposed: 1, diagonal_count: 1 }, // R1×R2 mesma posição → EVITAR
    { id_player1: 1, id_player2: 6, times_opposed: 9, diagonal_count: 0 }, // R1×L3 genérico caro
    { id_player1: 1, id_player2: 8, times_opposed: 9, diagonal_count: 0 }, // R1×L4 genérico caro
    { id_player1: 2, id_player2: 5, times_opposed: 9, diagonal_count: 0 }, // L1×R3 genérico caro
    { id_player1: 2, id_player2: 7, times_opposed: 9, diagonal_count: 0 }, // L1×R4 genérico caro
  ];
  const { opp, diag } = buildOppositionCost(oppositions);
  const pairs = pairDoublesGreedy(doubles, opp, diag, sideById, 500);
  const adv = opponentOf(pairs, 1);
  assert.notStrictEqual(adv, 2,
    `D1 não deve repetir o adversário de mesma posição (D2/R2), mesmo custando mais oposição genérica. Pareou com D${adv}.`);
  console.log('✓ teste 1: evita repetir adversário da mesma posição (prioridade dominante)');
})();

// ── Teste 2: quando TODOS os adversários de mesma posição já foram enfrentados, ──
//    o algoritmo escolhe o de MENOR repetição (menor diagonal_count), sem quebrar.
(function testRepeteMenosEnfrentado() {
  // R1 já enfrentou R2 1×, R3 3×, R4 5× (na mesma posição). Só sobram repetições.
  // Deve preferir o menos enfrentado: R2 (D2).
  const oppositions = [
    { id_player1: 1, id_player2: 3, times_opposed: 1, diagonal_count: 1 }, // R1×R2 1×
    { id_player1: 1, id_player2: 5, times_opposed: 3, diagonal_count: 3 }, // R1×R3 3×
    { id_player1: 1, id_player2: 7, times_opposed: 5, diagonal_count: 5 }, // R1×R4 5×
  ];
  const { opp, diag } = buildOppositionCost(oppositions);
  const pairs = pairDoublesGreedy(doubles, opp, diag, sideById, 500);
  const adv = opponentOf(pairs, 1);
  assert.strictEqual(adv, 2,
    `Quando só há repetição possível, D1 deve pegar o adversário de posição MENOS enfrentado (D2/R2 1×). Pegou D${adv}.`);
  console.log('✓ teste 2: ao ter que repetir, escolhe o adversário de mesma posição menos enfrentado');
})();

// ── Teste 3: sem histórico, qualquer pareamento é válido (custo zero, não quebra) ──
(function testSemHistorico() {
  const { opp, diag } = buildOppositionCost([]);
  const pairs = pairDoublesGreedy(doubles, opp, diag, sideById, 50);
  assert.strictEqual(pairs.length, 2, 'Deve formar 2 jogos com 4 duplas');
  console.log('✓ teste 3: sem histórico forma os jogos normalmente');
})();

console.log('\n✅ Todos os testes de pareamento de adversário passaram.');