// Testes da alocação de horários por prioridade de categoria (assignSlotsByCategoryPriority).
// Regra SRB: femininas (cat 3, 4, 5) nos primeiros horários, depois Masc 4ª (2), depois Masc Iniciante (1).
// A prioridade é garantida AUTOMATICAMENTE ao confirmar qualquer categoria da noite.
//
// Rodar: node backend/services/slotPriority.test.js

const assert = require('assert');
const { assignSlotsByCategoryPriority, categorySchedulePriority } = require('./weeklyDrawService');

// ── Helpers ────────────────────────────────────────────────────────────────────

// Gera slots no mesmo padrão de confirmRound: laço externo TIME_SLOTS, interno courts.
// Exemplo com 2 quadras e 3 horários:
//   18:30-q1, 18:30-q2, 19:10-q1, 19:10-q2, 19:50-q1, 19:50-q2
function makeSlots(times, courts) {
  const slots = [];
  for (const time of times) {
    for (const court of courts) {
      slots.push({ id_court: court.id_court, time, court_name: court.name });
    }
  }
  return slots;
}

const COURTS = [
  { id_court: 1, name: 'Quadra 1' },
  { id_court: 2, name: 'Quadra 2' },
];
const TIMES_3 = ['18:30', '19:10', '19:50'];
const TIMES_6 = ['18:30', '19:10', '19:50', '20:30', '21:10', '21:50'];

// ── Teste 1: feminina recebe horário anterior ao masculino ─────────────────────
// Entrada: masc iniciante (cat 1) primeiro na lista, fem iniciante (cat 3) segundo.
// Com 2 slots disponíveis (18:30-q1 e 18:30-q2), a fem deve pegar o índice 0 (18:30-q1)
// e o masc o índice 1 (18:30-q2).
(function testFemininaAntesDoMasculino() {
  const slots = makeSlots(['18:30', '19:10'], COURTS);
  // Slots: [18:30-q1, 18:30-q2, 19:10-q1, 19:10-q2]
  const reslottable = [
    { id_match: 10, id_category: 1, _order: 0 }, // Masc Iniciante — entra PRIMEIRO
    { id_match: 20, id_category: 3, _order: 1 }, // Fem Iniciante   — entra SEGUNDO
  ];
  const { assignments, overflow } = assignSlotsByCategoryPriority(reslottable, slots);

  assert.strictEqual(overflow.length, 0, 'Nenhum overflow esperado');
  assert.strictEqual(assignments.length, 2, 'Deve ter 2 assignments');

  const femAssignment = assignments.find(a => a.id_match === 20);
  const mascAssignment = assignments.find(a => a.id_match === 10);

  assert.ok(femAssignment, 'Fem Iniciante deve receber slot');
  assert.ok(mascAssignment, 'Masc Iniciante deve receber slot');

  // Fem deve ter slot de índice menor (horário mais cedo) que masc
  const femSlotIdx = slots.findIndex(s => s.id_court === femAssignment.id_court && s.time === femAssignment.time);
  const mascSlotIdx = slots.findIndex(s => s.id_court === mascAssignment.id_court && s.time === mascAssignment.time);
  assert.ok(femSlotIdx < mascSlotIdx,
    `Fem (slot idx ${femSlotIdx}) deve preceder Masc (slot idx ${mascSlotIdx})`);
  assert.strictEqual(femAssignment.time, '18:30', 'Fem deve receber 18:30');

  console.log('✓ teste 1: feminina recebe horário anterior ao masculino mesmo entrando depois na lista');
})();

// ── Teste 2: estabilidade dentro da mesma categoria ───────────────────────────
// Dois matches femininos (cat 3): o que tem menor _order deve pegar o slot de menor índice.
(function testEstabilidadeDentroDaCategoria() {
  const slots = makeSlots(['18:30', '19:10'], COURTS);
  // Slots: [18:30-q1, 18:30-q2, 19:10-q1, 19:10-q2]
  const reslottable = [
    { id_match: 30, id_category: 3, _order: 5 }, // Fem — entra "depois" (_order maior)
    { id_match: 31, id_category: 3, _order: 2 }, // Fem — entra "antes" (_order menor)
  ];
  const { assignments, overflow } = assignSlotsByCategoryPriority(reslottable, slots);

  assert.strictEqual(overflow.length, 0, 'Nenhum overflow');

  const a30 = assignments.find(a => a.id_match === 30);
  const a31 = assignments.find(a => a.id_match === 31);

  const idx30 = slots.findIndex(s => s.id_court === a30.id_court && s.time === a30.time);
  const idx31 = slots.findIndex(s => s.id_court === a31.id_court && s.time === a31.time);

  // match 31 (_order=2) deve ficar antes de match 30 (_order=5)
  assert.ok(idx31 < idx30,
    `Match 31 (_order 2) deve preceder match 30 (_order 5); índices: 31=${idx31}, 30=${idx30}`);

  console.log('✓ teste 2: estabilidade dentro da mesma categoria (ordem por _order)');
})();

// ── Teste 3: ordem completa Fem < Masc4ª < MascIni ───────────────────────────
// 3 matches: Masc Iniciante (cat 1), Masc 4ª (cat 2), Fem 4ª (cat 5).
// Esperado: Fem 4ª no slot 0, Masc 4ª no slot 1, Masc Iniciante no slot 2.
(function testOrdemCompletaDeTresCategorias() {
  const slots = makeSlots(TIMES_3, [COURTS[0]]); // 1 quadra × 3 horários = 3 slots
  // Slots: [18:30-q1, 19:10-q1, 19:50-q1]
  const reslottable = [
    { id_match: 100, id_category: 1, _order: 0 }, // Masc Iniciante
    { id_match: 101, id_category: 2, _order: 1 }, // Masc 4ª
    { id_match: 102, id_category: 5, _order: 2 }, // Fem 4ª
  ];
  const { assignments, overflow } = assignSlotsByCategoryPriority(reslottable, slots);

  assert.strictEqual(overflow.length, 0, 'Nenhum overflow');
  assert.strictEqual(assignments.length, 3, '3 assignments');

  const byMatch = {};
  assignments.forEach(a => { byMatch[a.id_match] = a; });

  const tFem4 = byMatch[102].time;
  const tMasc4 = byMatch[101].time;
  const tMascIni = byMatch[100].time;

  assert.ok(tFem4 < tMasc4, `Fem 4ª (${tFem4}) deve ser antes de Masc 4ª (${tMasc4})`);
  assert.ok(tMasc4 < tMascIni, `Masc 4ª (${tMasc4}) deve ser antes de Masc Ini (${tMascIni})`);

  assert.strictEqual(tFem4, '18:30', 'Fem 4ª deve receber 18:30');
  assert.strictEqual(tMasc4, '19:10', 'Masc 4ª deve receber 19:10');
  assert.strictEqual(tMascIni, '19:50', 'Masc Ini deve receber 19:50');

  console.log('✓ teste 3: ordem completa Fem(5) < Masc4ª(2) < MascIni(1) respeitada');
})();

// ── Teste 4: overflow cai nos de MENOR prioridade (Masc Iniciante) ────────────
// 4 matches mas apenas 3 slots: o Masc Iniciante deve ficar no overflow.
(function testOverflowCaiNaMenorPrioridade() {
  const slots = makeSlots(TIMES_3, [COURTS[0]]); // 3 slots apenas
  const reslottable = [
    { id_match: 200, id_category: 1, _order: 0 }, // Masc Iniciante — menor prioridade
    { id_match: 201, id_category: 3, _order: 1 }, // Fem Iniciante
    { id_match: 202, id_category: 4, _order: 2 }, // Fem 6ª
    { id_match: 203, id_category: 5, _order: 3 }, // Fem 4ª
  ];
  const { assignments, overflow } = assignSlotsByCategoryPriority(reslottable, slots);

  assert.strictEqual(assignments.length, 3, '3 assignments (todos os slots usados)');
  assert.strictEqual(overflow.length, 1, '1 match em overflow');
  assert.strictEqual(overflow[0], 200, 'Masc Iniciante (id_match=200) deve estar no overflow');

  // Confirma que todos os femininos receberam slot
  const assignedIds = new Set(assignments.map(a => a.id_match));
  assert.ok(assignedIds.has(201), 'Fem Iniciante deve ter slot');
  assert.ok(assignedIds.has(202), 'Fem 6ª deve ter slot');
  assert.ok(assignedIds.has(203), 'Fem 4ª deve ter slot');

  console.log('✓ teste 4: overflow cai no(s) match(es) de MENOR prioridade (Masc Iniciante)');
})();

// ── Teste 5: categorySchedulePriority — valores e categoria desconhecida ──────
(function testCategorySchedulePriority() {
  const { categorySchedulePriority } = require('./weeklyDrawService');

  // Femininas têm prioridade mais alta (menor número)
  const pFemIni  = categorySchedulePriority(3); // Fem Iniciante
  const pFem6    = categorySchedulePriority(4); // Fem 6ª
  const pFem4    = categorySchedulePriority(5); // Fem 4ª
  const pMasc4   = categorySchedulePriority(2); // Masc 4ª
  const pMascIni = categorySchedulePriority(1); // Masc Iniciante

  // Todas as femininas têm prioridade menor que Masc 4ª
  assert.ok(pFemIni < pMasc4,  `Fem Ini (${pFemIni}) deve ter menor número que Masc 4ª (${pMasc4})`);
  assert.ok(pFem6   < pMasc4,  `Fem 6ª (${pFem6}) deve ter menor número que Masc 4ª (${pMasc4})`);
  assert.ok(pFem4   < pMasc4,  `Fem 4ª (${pFem4}) deve ter menor número que Masc 4ª (${pMasc4})`);

  // Masc 4ª tem prioridade menor que Masc Iniciante
  assert.ok(pMasc4 < pMascIni, `Masc 4ª (${pMasc4}) deve ter menor número que Masc Ini (${pMascIni})`);

  // Categoria desconhecida vai por último (valor 50)
  const pDesconhecida = categorySchedulePriority(99);
  assert.strictEqual(pDesconhecida, 50, `Categoria desconhecida deve ter prioridade 50, mas foi ${pDesconhecida}`);
  assert.ok(pDesconhecida > pMascIni, 'Categoria desconhecida deve ter prioridade MENOR que Masc Iniciante');

  console.log('✓ teste 5: categorySchedulePriority — Fem < Masc4ª < MascIni, desconhecida=50');
})();

// ── Teste 6: lista vazia não quebra ───────────────────────────────────────────
(function testListaVaziaNaoQuebra() {
  const { assignments, overflow } = assignSlotsByCategoryPriority([], []);
  assert.strictEqual(assignments.length, 0, 'assignments deve ser []');
  assert.strictEqual(overflow.length, 0, 'overflow deve ser []');

  const slots = makeSlots(['18:30'], COURTS);
  const r2 = assignSlotsByCategoryPriority([], slots);
  assert.strictEqual(r2.assignments.length, 0, 'assignments vazio com reslottable vazio');
  assert.strictEqual(r2.overflow.length, 0, 'overflow vazio com reslottable vazio');

  console.log('✓ teste 6: lista vazia não quebra');
})();

console.log('\n✅ Todos os testes de prioridade de slots passaram.');
