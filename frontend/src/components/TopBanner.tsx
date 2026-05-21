// Banner global no topo do app — anuncia a regra de cota mensal de ausências.
// Antes de 01/06/2026: anuncia a regra futura. Depois: lembrete permanente curto.

const VIGENCIA = new Date('2026-06-01T00:00:00');

export default function TopBanner() {
  const preVigencia = new Date() < VIGENCIA;
  const msg = preVigencia
    ? '📢 Nova regra a partir de 01/06: cada atleta pode declarar no máximo 1 ausência por mês. Problema de saúde — fale com a administração.'
    : 'Lembrete: cada atleta tem direito a 1 ausência declarada por mês. Acima disso, fale com a administração.';
  return (
    <div className="w-full bg-amber-500 text-black text-center text-[11px] font-bold px-4 py-1.5 leading-snug">
      {msg}
    </div>
  );
}
