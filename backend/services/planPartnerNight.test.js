// Testes de planPartnerNight — RÉGUA DE PARCERIA (decisão 23/06).
// Forma duplas INÉDITAS (nunca repete parceira), pareia em jogos (adversário pode repetir),
// e equilibra participação: quem JOGOU MENOS entra primeiro; surplus/sem-parceiro-inédito sai.
// Cada jogo = 2 duplas inéditas. Robusto a lados desiguais.
// Rodar: node services/planPartnerNight.test.js   (a partir de backend/)
const assert = require('assert');
const { planPartnerNight } = require('./weeklyDrawService');

const key = (a, b) => a < b ? `${a}-${b}` : `${b}-${a}`;
// fp a partir de set de parcerias JÁ usadas (fresh = não usada)
const makeFp = usedArr => { const u = new Set(usedArr.map(([a, b]) => key(a, b))); return (r, l) => !u.has(key(r, l)); };
const makeGp = map => p => map[p] || 0;
const all = (rights, lefts) => [...rights, ...lefts];
function clean(games) { // todas as duplas distintas em jogadores, jogos disjuntos
  const seen = new Set();
  for (const g of games) for (const p of [...g.a, ...g.b]) { if (seen.has(p)) return false; seen.add(p); }
  return true;
}

// t1: 2R+2L tudo inédito → 1 jogo, ninguém fora
(function t1() {
  const R = [1, 2], L = [3, 4];
  const { games, benched } = planPartnerNight(R, L, makeFp([]), makeGp({}), 6);
  assert.strictEqual(games.length, 1);
  assert.ok(clean(games));
  assert.deepStrictEqual(benched.slice().sort((a, b) => a - b), []);
  console.log('✓ t1: 2R+2L inédito → 1 jogo, 0 fora');
})();

// t2: 4R+4L tudo inédito → 2 jogos, 0 fora
(function t2() {
  const R = [1, 2, 3, 4], L = [5, 6, 7, 8];
  const { games, benched } = planPartnerNight(R, L, makeFp([]), makeGp({}), 6);
  assert.strictEqual(games.length, 2);
  assert.ok(clean(games));
  assert.strictEqual(benched.length, 0);
  console.log('✓ t2: 4R+4L inédito → 2 jogos, 0 fora');
})();

// t3: parceira saturada → quem não tem parceira inédita não joga
// r1 já jogou com l3 e l4 (sem parceira nova). r2 tem l3/l4 livres, mas só dá 1 dupla → 0 jogos.
(function t3() {
  const R = [1, 2], L = [3, 4];
  const fp = makeFp([[1, 3], [1, 4]]); // 1 saturado
  const { games, benched } = planPartnerNight(R, L, fp, makeGp({}), 6);
  assert.strictEqual(games.length, 0, '1 dupla só não fecha jogo');
  assert.deepStrictEqual(benched.slice().sort((a, b) => a - b), [1, 2, 3, 4]);
  console.log('✓ t3: parceira saturada (1 dupla só) → 0 jogos, todos fora');
})();

// t4: equilíbrio — quem JOGOU MAIS sai quando há surplus.
// 3R+3L inédito, maxGames=1 → 1 jogo (2 duplas); jogador 1 tem gp alto → fica de fora.
(function t4() {
  const R = [1, 2, 3], L = [4, 5, 6];
  const { games, benched } = planPartnerNight(R, L, makeFp([]), makeGp({ 1: 10 }), 1);
  assert.strictEqual(games.length, 1);
  assert.ok(clean(games));
  assert.ok(benched.includes(1), 'quem mais jogou (1) deve ficar de fora');
  assert.strictEqual(benched.length, 2, '1 direita + 1 esquerda fora (surplus)');
  console.log('✓ t4: equilíbrio → quem mais jogou fica de fora no surplus');
})();

// t5: teto de slots — 4R+4L inédito, maxGames=1 → só 1 jogo, 4 fora
(function t5() {
  const R = [1, 2, 3, 4], L = [5, 6, 7, 8];
  const { games, benched } = planPartnerNight(R, L, makeFp([]), makeGp({}), 1);
  assert.strictEqual(games.length, 1);
  assert.strictEqual(benched.length, 4);
  console.log('✓ t5: teto de slots → respeita maxGames');
})();

// t6: lados desiguais 3R+2L inédito → 1 jogo (usa 2R+2L), sobra 1 direita fora
(function t6() {
  const R = [1, 2, 3], L = [4, 5];
  const { games, benched } = planPartnerNight(R, L, makeFp([]), makeGp({}), 6);
  assert.strictEqual(games.length, 1);
  assert.ok(clean(games));
  assert.strictEqual(benched.length, 1);
  assert.ok([1, 2, 3].includes(benched[0]), 'sobra uma direita');
  console.log('✓ t6: lados desiguais 3R+2L → 1 jogo, 1 direita fora');
})();

// t7: nunca repete parceira — toda dupla formada é inédita
(function t7() {
  const R = [1, 2, 3, 4], L = [5, 6, 7, 8];
  const used = [[1, 5], [2, 6]]; // essas parcerias não podem reaparecer
  const fp = makeFp(used);
  const { games } = planPartnerNight(R, L, fp, makeGp({}), 6);
  for (const g of games) for (const d of [g.a, g.b]) assert.ok(fp(d[0], d[1]), `dupla ${d} deveria ser inédita`);
  console.log('✓ t7: todas as duplas formadas são inéditas');
})();

console.log('\n✅ Todos os testes de planPartnerNight passaram.');
