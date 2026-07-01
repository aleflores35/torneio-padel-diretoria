// Testes de planCleanGames — REGRA FINAL (23/06): adversário NUNCA repete; maximiza o nº de
// jogos 100% limpos; quem não entra em jogo limpo fica de FORA; parceria repetida é só desempate.
// Spec: feedback_srb_zero_repeticao_ou_amistoso (memória). Robusto a lados DESIGUAIS e nº ÍMPAR
// de jogadores (o que o planCleanGames antigo quebrava: exigia lados iguais + nº par de duplas).
//
// Rodar: node services/planCleanGames.test.js   (a partir de backend/)

const assert = require('assert');
const { planCleanGames } = require('./weeklyDrawService');

// ── Helpers ──────────────────────────────────────────────────────────────────
const key = (a, b) => a < b ? `${a}-${b}` : `${b}-${a}`;
const makeFn = map => (a, b) => map[key(a, b)] || 0;
const zero = () => 0;
function sideMap(rights, lefts) { const s = {}; rights.forEach(i => s[i] = 'RIGHT'); lefts.forEach(i => s[i] = 'LEFT'); return s; }

// game = { a:[right,left], b:[right,left] }. Limpo = nenhum dos 4 confrontos repete (od==0).
function isClean(g, od) {
  for (const pa of g.a) for (const pb of g.b) if (od(pa, pb) > 0) return false;
  return true;
}
function usedPlayers(games) { return games.flatMap(g => [...g.a, ...g.b]); }
// acha o parceiro do jogador p dentro dos jogos (ou null)
function partnerOf(p, games) {
  for (const g of games) for (const d of [g.a, g.b]) if (d.includes(p)) return d.find(x => x !== p);
  return null;
}

// ── Teste 1: todos limpos, lados iguais (2R+2L) → 1 jogo, ninguém fora ────────
(function t1() {
  const R = [1, 2], L = [3, 4];
  const { rankingGames, outPlayers } = planCleanGames(R, L, zero, zero, sideMap(R, L));
  assert.strictEqual(rankingGames.length, 1, '1 jogo limpo');
  assert.ok(isClean(rankingGames[0], zero), 'jogo deve ser limpo');
  assert.deepStrictEqual(outPlayers.slice().sort((a, b) => a - b), [], 'ninguém fora');
  console.log('✓ t1: todos limpos 2R+2L → 1 jogo, 0 fora');
})();

// ── Teste 2: LADOS DESIGUAIS 2R+3L (quebrava no antigo) → 1 jogo, 1 esquerda fora ─
(function t2() {
  const R = [1, 2], L = [3, 4, 5];
  const { rankingGames, outPlayers } = planCleanGames(R, L, zero, zero, sideMap(R, L));
  assert.strictEqual(rankingGames.length, 1, '1 jogo (2R+2L; sobra 1 esquerda)');
  assert.ok(isClean(rankingGames[0], zero));
  assert.strictEqual(outPlayers.length, 1, 'exatamente 1 jogador fora');
  assert.ok([3, 4, 5].includes(outPlayers[0]), 'o que sobra é uma esquerda');
  assert.strictEqual(usedPlayers(rankingGames).includes(outPlayers[0]), false, 'quem está fora não joga');
  console.log('✓ t2: lados desiguais 2R+3L → 1 jogo, 1 fora (BUG antigo)');
})();

// ── Teste 3: saturado tipo Masc 4ª (4R+4L, só 1 jogo limpo) → banca 4 ─────────
// Único jogo limpo possível: [1,5]×[2,6]. Todo o resto repetido.
(function t3() {
  const R = [1, 2, 3, 4], L = [5, 6, 7, 8];
  const clean0 = new Set([key(1, 2), key(5, 6), key(1, 6), key(2, 5)]); // 4 confrontos de [1,5]×[2,6]
  const map = {};
  for (const x of [...R, ...L]) for (const y of [...R, ...L]) if (x < y && !clean0.has(key(x, y))) map[key(x, y)] = 1;
  const od = makeFn(map);
  const { rankingGames, outPlayers } = planCleanGames(R, L, od, zero, sideMap(R, L));
  assert.strictEqual(rankingGames.length, 1, 'só 1 jogo limpo possível');
  assert.ok(isClean(rankingGames[0], od));
  assert.deepStrictEqual(outPlayers.slice().sort((a, b) => a - b), [3, 4, 7, 8], 'banca os 4 sem jogo limpo');
  console.log('✓ t3: saturado 4R+4L (1 jogo) → banca 4');
})();

// ── Teste 4: MAXIMIZA jogos limpos (ótimo = 2) ───────────────────────────────
// Dois jogos limpos disjuntos: [1,5]×[2,6] e [3,7]×[4,8]. Resto repetido.
(function t4() {
  const R = [1, 2, 3, 4], L = [5, 6, 7, 8];
  const clean0 = new Set([
    key(1, 2), key(5, 6), key(1, 6), key(2, 5), // jogo 1
    key(3, 4), key(7, 8), key(3, 8), key(4, 7), // jogo 2
  ]);
  const map = {};
  for (const x of [...R, ...L]) for (const y of [...R, ...L]) if (x < y && !clean0.has(key(x, y))) map[key(x, y)] = 1;
  const od = makeFn(map);
  const { rankingGames, outPlayers } = planCleanGames(R, L, od, zero, sideMap(R, L));
  assert.strictEqual(rankingGames.length, 2, 'deve achar os 2 jogos limpos (não parar em 1)');
  rankingGames.forEach(g => assert.ok(isClean(g, od)));
  assert.strictEqual(new Set(usedPlayers(rankingGames)).size, 8, 'sem jogador repetido entre jogos');
  assert.deepStrictEqual(outPlayers, [], 'ninguém fora');
  console.log('✓ t4: maximiza → 2 jogos limpos, 0 fora');
})();

// ── Teste 5: desempate por PARCERIA (mesmo nº de jogos limpos, menos parceria) ─
// 2R+2L, tudo limpo (od=0) → 1 jogo das duas formas; pd(1,3)=1 (repetida), resto 0.
// Deve escolher o arranjo SEM a parceria repetida → jogador 1 pareia com 4 (não 3).
(function t5() {
  const R = [1, 2], L = [3, 4];
  const pd = makeFn({ '1-3': 1 });
  const { rankingGames } = planCleanGames(R, L, zero, pd, sideMap(R, L));
  assert.strictEqual(rankingGames.length, 1);
  assert.strictEqual(partnerOf(1, rankingGames), 4, 'desempate: 1 deve parear com 4 (evita parceria repetida 1-3)');
  console.log('✓ t5: desempate por parceria → evita parceria repetida');
})();

// ── Teste 6: totalmente saturado → 0 jogos, todos fora ───────────────────────
(function t6() {
  const R = [1, 2], L = [3, 4];
  const od = makeFn({ '1-2': 1, '3-4': 1, '1-3': 1, '1-4': 1, '2-3': 1, '2-4': 1 });
  const { rankingGames, outPlayers } = planCleanGames(R, L, od, zero, sideMap(R, L));
  assert.strictEqual(rankingGames.length, 0, 'nenhum jogo limpo');
  assert.deepStrictEqual(outPlayers.slice().sort((a, b) => a - b), [1, 2, 3, 4], 'todos fora');
  console.log('✓ t6: saturado total → 0 jogos, todos fora');
})();

// ── Teste 7: nº ÍMPAR de duplas 3R+3L todos limpos (quebrava no antigo) ───────
// 6 jogadores; 1 jogo usa 2R+2L; sobra 1R+1L (não fecha 2º jogo) → 1 jogo, 2 fora.
(function t7() {
  const R = [1, 2, 3], L = [4, 5, 6];
  const { rankingGames, outPlayers } = planCleanGames(R, L, zero, zero, sideMap(R, L));
  assert.strictEqual(rankingGames.length, 1, '1 jogo (sobra 1R+1L que não fecha 2º)');
  assert.ok(isClean(rankingGames[0], zero));
  assert.strictEqual(outPlayers.length, 2, '2 jogadores fora (1 direita + 1 esquerda)');
  const outR = outPlayers.filter(p => R.includes(p)), outL = outPlayers.filter(p => L.includes(p));
  assert.strictEqual(outR.length, 1, '1 direita fora');
  assert.strictEqual(outL.length, 1, '1 esquerda fora');
  console.log('✓ t7: ímpar 3R+3L → 1 jogo, 2 fora (BUG antigo)');
})();

// ── Teste 8: degenerado (lados sem par possível) → 0 jogos, todos fora ────────
// 1R+3L: impossível formar jogo (precisa 2R). Não pode quebrar.
(function t8() {
  const R = [1], L = [2, 3, 4];
  const { rankingGames, outPlayers } = planCleanGames(R, L, zero, zero, sideMap(R, L));
  assert.strictEqual(rankingGames.length, 0, '0 jogos (só 1 direita)');
  assert.deepStrictEqual(outPlayers.slice().sort((a, b) => a - b), [1, 2, 3, 4], 'todos fora');
  console.log('✓ t8: 1R+3L → 0 jogos, todos fora');
})();

console.log('\n✅ Todos os testes de planCleanGames passaram.');
