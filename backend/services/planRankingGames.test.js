// Testes de planRankingGames — regra zero-repetição de adversário de mesma posição.
// Spec: docs/superpowers/specs/2026-06-22-regra-zero-repeticao-motor-design.md
//
// Rodar: node services/planRankingGames.test.js   (a partir de backend/)

const assert = require('assert');
const { planRankingGames } = require('./weeklyDrawService');

// ── Helper ─────────────────────────────────────────────────────────────────────

/**
 * Constrói uma função diag() a partir de um dicionário { "menorId-maiorId": n }.
 * Chave normalizada (menor id primeiro). Ausente = 0 (inédito).
 */
function makeDiag(map) {
  return function diag(a, b) {
    const key = a < b ? `${a}-${b}` : `${b}-${a}`;
    return map[key] || 0;
  };
}

/** Converte array de {id_player} ou números em array de objetos {id_player}. */
function P(ids) {
  return ids.map(id => ({ id_player: id }));
}

// ── Teste 1: todos inéditos ────────────────────────────────────────────────────
// rights [1,2], lefts [3,4], diag sempre 0 → 1 jogo, leftover vazio.
(function testTodosIneditos() {
  const diag = makeDiag({});
  const { rankingGames, leftover } = planRankingGames(P([1, 2]), P([3, 4]), diag);

  assert.strictEqual(rankingGames.length, 1, 'Deve haver 1 jogo de ranking');
  assert.deepStrictEqual(rankingGames[0].right.slice().sort(), [1, 2]);
  assert.deepStrictEqual(rankingGames[0].left.slice().sort(),  [3, 4]);
  assert.deepStrictEqual(leftover.rights, [], 'Sem leftover de direitas');
  assert.deepStrictEqual(leftover.lefts,  [], 'Sem leftover de esquerdas');

  console.log('✓ teste 1: todos inéditos → 1 jogo, leftover vazio');
})();

// ── Teste 2: ninguém inédito ───────────────────────────────────────────────────
// rights [1,2], lefts [3,4]; diag(1,2)=1 e diag(3,4)=1 → nenhum par inédito.
// rankingGames: [], leftover: {rights:[1,2], lefts:[3,4]}
(function testNinguemInedito() {
  const diag = makeDiag({ '1-2': 1, '3-4': 1 });
  const { rankingGames, leftover } = planRankingGames(P([1, 2]), P([3, 4]), diag);

  assert.strictEqual(rankingGames.length, 0, 'Nenhum jogo de ranking');
  assert.deepStrictEqual(leftover.rights.slice().sort((a, b) => a - b), [1, 2]);
  assert.deepStrictEqual(leftover.lefts.slice().sort((a, b) => a - b),  [3, 4]);

  console.log('✓ teste 2: ninguém inédito → rankingGames vazio, todos no leftover');
})();

// ── Teste 3: parcial (caso real) ───────────────────────────────────────────────
// rights [1,2,3,4]: só o par 1×2 é inédito (todos os outros pares de direita têm diag≥1).
// lefts  [5,6,7,8]: só o par 5×6 é inédito (todos os outros pares de esquerda têm diag≥1).
// → 1 jogo {right:[1,2], left:[5,6]}, leftover {rights:[3,4], lefts:[7,8]}.
(function testParcial() {
  // Direitas: 1×3, 1×4, 2×3, 2×4, 3×4 = repetidos; só 1×2 = inédito
  // Esquerdas: 5×7, 5×8, 6×7, 6×8, 7×8 = repetidos; só 5×6 = inédito
  const diag = makeDiag({
    '1-3': 1, '1-4': 1, '2-3': 1, '2-4': 1, '3-4': 1,
    '5-7': 1, '5-8': 1, '6-7': 1, '6-8': 1, '7-8': 1,
  });
  const { rankingGames, leftover } = planRankingGames(P([1, 2, 3, 4]), P([5, 6, 7, 8]), diag);

  assert.strictEqual(rankingGames.length, 1, '1 jogo de ranking');
  assert.deepStrictEqual(rankingGames[0].right.slice().sort((a, b) => a - b), [1, 2]);
  assert.deepStrictEqual(rankingGames[0].left.slice().sort((a, b) => a - b),  [5, 6]);
  assert.deepStrictEqual(leftover.rights.slice().sort((a, b) => a - b), [3, 4]);
  assert.deepStrictEqual(leftover.lefts.slice().sort((a, b) => a - b),  [7, 8]);

  console.log('✓ teste 3: parcial → 1 jogo correto, leftover correto');
})();

// ── Teste 4: maximum matching importa (não pode ser guloso ingênuo) ────────────
// rights [1,2,3,4]:
//   diag(1,2)=0, diag(3,4)=0 → 2 pares inéditos se escolher certo
//   diag(1,3)=0, diag(1,4)=1, diag(2,3)=1, diag(2,4)=0
//   Algoritmo guloso simples (pega 1×2 primeiro) já acha 2 pares: {1,2} e {3,4} ✓
//   Mas também testamos que NÃO retorna apenas 1 par quando há 2 possíveis.
// lefts [5,6,7,8]:
//   diag(5,6)=0, diag(7,8)=0, todos os outros = 1 → 2 pares inéditos
// → 2 jogos de ranking, leftover vazio.
(function testMaximumMatchingImporta() {
  const diag = makeDiag({
    // direitas: 1×4 e 2×3 bloqueados, mas {1,2}+{3,4} ou {1,3}+{2,4} são possíveis
    '1-4': 1,
    '2-3': 1,
    // esquerdas: todos os pares não-(5,6) e não-(7,8) bloqueados
    '5-7': 1, '5-8': 1, '6-7': 1, '6-8': 1,
  });
  const { rankingGames, leftover } = planRankingGames(P([1, 2, 3, 4]), P([5, 6, 7, 8]), diag);

  assert.strictEqual(rankingGames.length, 2, 'Deve haver 2 jogos (não 1 por matching guloso ruim)');
  assert.deepStrictEqual(leftover.rights, [], 'Sem leftover de direitas');
  assert.deepStrictEqual(leftover.lefts,  [], 'Sem leftover de esquerdas');

  // Verifica que cada jogo tem um par de direitas e um par de esquerdas válidos (inéditos)
  for (const g of rankingGames) {
    const [r1, r2] = g.right;
    const [l1, l2] = g.left;
    assert.strictEqual(diag(r1, r2), 0, `Par de direita ${r1}×${r2} deve ser inédito`);
    assert.strictEqual(diag(l1, l2), 0, `Par de esquerda ${l1}×${l2} deve ser inédito`);
  }

  console.log('✓ teste 4: maximum matching → 2 jogos (não para no primeiro matching subótimo)');
})();

// ── Teste 5: número ímpar de jogadores por lado ────────────────────────────────
// rights [1,2,3] todos inéditos entre si, lefts [4,5] inéditos
// → min(1 par de esquerda, 1 par de direita) = 1 jogo; leftover.rights tem o id que sobrou.
(function testImpar() {
  const diag = makeDiag({}); // todos inéditos
  const { rankingGames, leftover } = planRankingGames(P([1, 2, 3]), P([4, 5]), diag);

  assert.strictEqual(rankingGames.length, 1, '1 jogo de ranking');
  // O par de esquerdas usado é [4,5]; o par de direitas é qualquer par inédito entre 1,2,3
  const [l1, l2] = rankingGames[0].left;
  assert.deepStrictEqual([l1, l2].slice().sort((a, b) => a - b), [4, 5]);
  // leftover.rights: o id de direita que não entrou no par vencedor
  assert.strictEqual(leftover.rights.length, 1, 'leftover.rights tem exatamente 1 id');
  assert.deepStrictEqual(leftover.lefts, [], 'Sem leftover de esquerdas');
  // O id no leftover deve ser diferente dos dois que jogaram
  const usedR = new Set(rankingGames[0].right);
  assert.ok(!usedR.has(leftover.rights[0]), 'leftover.rights contém o que não jogou');

  console.log('✓ teste 5: ímpar → 1 jogo, 1 id no leftover.rights, leftover.lefts vazio');
})();

// ── Teste 6: desbalanceado (mais pares inéditos em direitas que em esquerdas) ───
// rights [1,2,3,4] com 2 pares inéditos: {1,2} e {3,4}
// lefts  [5,6] com 1 par inédito: {5,6}
// → 1 jogo; leftover.rights = [3,4] (o par excedente)
(function testDesbalanceado() {
  // Direitas: só 1×2 e 3×4 são inéditos; os outros pares têm diag≥1
  const diag = makeDiag({
    '1-3': 1, '1-4': 1, '2-3': 1, '2-4': 1,
    // 1-2 e 3-4 ausentes = inéditos (diag 0)
  });
  const { rankingGames, leftover } = planRankingGames(P([1, 2, 3, 4]), P([5, 6]), diag);

  assert.strictEqual(rankingGames.length, 1, '1 jogo de ranking (limitado pelo lado menor)');
  // O jogo criado usa um par de direitas e [5,6]
  assert.deepStrictEqual(rankingGames[0].left.slice().sort((a, b) => a - b), [5, 6]);
  // leftover.rights: os 2 ids do par-direita excedente
  assert.strictEqual(leftover.rights.length, 2, 'leftover.rights tem 2 ids (par excedente)');
  assert.deepStrictEqual(leftover.lefts, [], 'Sem leftover de esquerdas');
  // Os ids no leftover devem ser um dos pares inéditos: {1,2} ou {3,4}
  const usedR = new Set(rankingGames[0].right);
  for (const id of leftover.rights) {
    assert.ok(!usedR.has(id), `leftover id ${id} não deve estar no jogo`);
  }

  console.log('✓ teste 6: desbalanceado → 1 jogo, par excedente de direitas no leftover');
})();

console.log('\n✅ Todos os testes de planRankingGames passaram.');
