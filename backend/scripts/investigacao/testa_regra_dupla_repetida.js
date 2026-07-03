// READ-ONLY — testa a regra "não repetir dupla" no getSubstituteCandidates.
// Acha o jogo da Francine Rossi (parceira Tanise) e lista candidatos marcados.
const supabase = require('../../supabase');
const svc = require('../../services/substitutionService');

async function main() {
  // dupla Francine (702) — procura em doubles
  const { data: dbls } = await supabase.from('doubles')
    .select('id_double, id_round, display_name, id_player1, id_player2')
    .or('id_player1.eq.702,id_player2.eq.702');
  console.log('— Duplas da Francine:'); console.table(dbls || []);

  for (const d of (dbls || [])) {
    const { data: ms } = await supabase.from('matches')
      .select('id_match, id_double_a, id_double_b, status')
      .or(`id_double_a.eq.${d.id_double},id_double_b.eq.${d.id_double}`);
    for (const m of (ms || [])) {
      if (['FINISHED', 'WO'].includes(m.status)) continue;
      console.log(`\n=== Match ${m.id_match} (${m.status}) — dupla ${d.display_name} ===`);
      try {
        const r = await svc.getSubstituteCandidates(m.id_match, 702);
        console.log(`Substituindo Francine · parceiro ${r.partner.name} (${r.partner.side})`);
        console.table(r.candidates.map(c => ({
          name: c.name, side: c.side, attendance: c.attendance_status,
          paired_with_partner: c.paired_with_partner,
        })));
      } catch (e) { console.log('  (getSubstituteCandidates:', e.message + ')'); }
    }
  }
}
main().catch(e => { console.error('ERRO:', e); process.exit(1); });
