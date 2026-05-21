// Lógica pura de cota mensal de ausências — sem I/O, testável com `node`.
// Regra: cada atleta declara no máximo 1 ausência por mês-calendário.
// Vigência: 2026-06-01. Ausências com data anterior não entram na cota.

const QUOTA_VIGENCIA = '2026-06-01'; // primeira candidateDate sujeita à cota (inclusivo)
const QUOTA_LIMIT = 1;
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

// 'YYYY-MM-DD' -> { start, nextStart, label }
// start = primeiro dia do mês; nextStart = primeiro dia do mês seguinte (exclusivo).
function monthRange(dateStr) {
  const [y, m] = dateStr.split('-').map(Number);
  const start = `${y}-${String(m).padStart(2, '0')}-01`;
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  const nextStart = `${ny}-${String(nm).padStart(2, '0')}-01`;
  return { start, nextStart, label: `${MESES[m - 1]}/${y}` };
}

// existingDates: array de 'YYYY-MM-DD' já em player_absences (mesmo atleta+torneio).
// candidateDate: data da ausência que o atleta quer declarar agora.
// -> { allowed, reason, used, label }
function quotaCheck(existingDates, candidateDate, vigencia = QUOTA_VIGENCIA) {
  const { start, nextStart, label } = monthRange(candidateDate);
  // Re-declarar a MESMA data é idempotente — não conta como nova ausência.
  const otherDatesInMonth = existingDates.filter(
    d => d >= start && d < nextStart && d !== candidateDate
  );
  const used = otherDatesInMonth.length;
  if (candidateDate < vigencia) {
    return { allowed: true, reason: 'pre-vigencia', used: 0, label };
  }
  if (used >= QUOTA_LIMIT) {
    return { allowed: false, reason: 'quota-esgotada', used, label };
  }
  return { allowed: true, reason: 'ok', used, label };
}

// Status da cota no mês de refDate -> { month, limit, used, remaining, dates }
function quotaStatus(existingDates, refDate) {
  const { start, nextStart, label } = monthRange(refDate);
  const datesInMonth = existingDates.filter(d => d >= start && d < nextStart);
  const used = datesInMonth.length;
  return {
    month: label,
    limit: QUOTA_LIMIT,
    used,
    remaining: Math.max(0, QUOTA_LIMIT - used),
    dates: datesInMonth.sort(),
  };
}

module.exports = { monthRange, quotaCheck, quotaStatus, QUOTA_VIGENCIA, QUOTA_LIMIT };
