// Testes da lógica pura de cota mensal de ausência. Rodar: node backend/lib/absenceQuota.test.js
const assert = require('assert');
const { monthRange, quotaCheck, quotaStatus } = require('./absenceQuota');

// monthRange — range do mês-calendário
let r = monthRange('2026-06-11');
assert.strictEqual(r.start, '2026-06-01', 'monthRange start');
assert.strictEqual(r.nextStart, '2026-07-01', 'monthRange nextStart');
assert.strictEqual(r.label, 'junho/2026', 'monthRange label');

r = monthRange('2026-12-31');
assert.strictEqual(r.nextStart, '2027-01-01', 'monthRange virada de ano');

// quotaCheck — primeira ausência do mês: permitido
assert.strictEqual(quotaCheck([], '2026-06-11').allowed, true, 'primeira ausência');

// quotaCheck — segunda ausência no mesmo mês: bloqueado
let q = quotaCheck(['2026-06-04'], '2026-06-11');
assert.strictEqual(q.allowed, false, 'segunda ausência bloqueada');
assert.strictEqual(q.reason, 'quota-esgotada', 'reason quota-esgotada');

// quotaCheck — re-declarar a MESMA data: idempotente, permitido
assert.strictEqual(quotaCheck(['2026-06-11'], '2026-06-11').allowed, true, 're-declarar mesma data');

// quotaCheck — ausência em outro mês não conta
assert.strictEqual(quotaCheck(['2026-05-28'], '2026-06-11').allowed, true, 'mês anterior não conta');
assert.strictEqual(quotaCheck(['2026-07-02'], '2026-06-11').allowed, true, 'mês seguinte não conta');

// quotaCheck — data antes da vigência: sempre permitido
let pre = quotaCheck(['2026-05-07'], '2026-05-14');
assert.strictEqual(pre.allowed, true, 'pré-vigência permitido');
assert.strictEqual(pre.reason, 'pre-vigencia', 'reason pre-vigencia');

// quotaStatus — atleta com 1 ausência no mês: cota esgotada
let s = quotaStatus(['2026-06-04'], '2026-06-11');
assert.strictEqual(s.used, 1, 'status used');
assert.strictEqual(s.remaining, 0, 'status remaining 0');
assert.strictEqual(s.month, 'junho/2026', 'status month');

// quotaStatus — atleta sem ausência: cota disponível
s = quotaStatus([], '2026-06-11');
assert.strictEqual(s.remaining, 1, 'status remaining 1');

console.log('✅ absenceQuota: todos os testes passaram');
