// Altera o match 1290 (rodada feminina 405, Quadra de Vidro 20h30) para:
//   A: Tanise Cezimbra / Nara Nunes      (era Tanise / Francine)
//   B: Paola Brendler / Amanda Oestreich (era Paola / Nara)
// Sai da rodada: Francine Rossi. Entra: Amanda Oestreich (estava ROTATED).
// Guard: CONFIRM_EXECUTE=yes
const supabase = require('../../supabase');
const svc = require('../../services/substitutionService');

const MATCH = 1290;
const NARA = 701, AMANDA = 699, FRANCINE = 702;
const PHANTOM_PARTNERSHIP = 54; // Tanise+Nara fantasma (seed, sem jogo real)

const DRY = process.env.CONFIRM_EXECUTE !== 'yes';

async function main() {
  console.log(`MODE: ${DRY ? 'DRY' : '⚠️  EXECUTANDO'}\n`);

  const before = await svc.getMatchDetails(MATCH);
  console.log('— Antes:');
  console.log('  A:', before.double_a.display_name);
  console.log('  B:', before.double_b.display_name, `(match ${before.status}, round ${before.round_status})`);

  // 1) Apagar partnership fantasma Tanise+Nara (id 54) — não há jogo real
  const { data: ph } = await supabase.from('partnerships')
    .select('id_partnership, id_player1, id_player2, times_paired, last_round_id')
    .eq('id_partnership', PHANTOM_PARTNERSHIP).maybeSingle();
  console.log('\n— 1) Partnership fantasma a remover:', JSON.stringify(ph));
  if (!DRY && ph) {
    const { error } = await supabase.from('partnerships').delete().eq('id_partnership', PHANTOM_PARTNERSHIP);
    if (error) throw error;
    console.log('   ✅ removida');
  }

  // 2) Nara -> Amanda na dupla da Paola
  console.log('\n— 2) substitutePlayer(1290, out=Nara 701, in=Amanda 699)');
  if (DRY) {
    const c = await svc.getSubstituteCandidates(MATCH, NARA);
    const amanda = c.candidates.find(x => x.id_player === AMANDA);
    console.log('   parceiro:', c.partner.name, '| Amanda elegível?',
      amanda ? `SIM (side ${amanda.side}, paired_with_partner=${amanda.paired_with_partner})` : '❌ NÃO');
  } else {
    console.log('   ✅', JSON.stringify(await svc.substitutePlayer(MATCH, NARA, AMANDA)));
  }

  // 3) Francine -> Nara na dupla da Tanise (só após o passo 2 liberar a Nara)
  console.log('\n— 3) substitutePlayer(1290, out=Francine 702, in=Nara 701)');
  if (DRY) {
    console.log('   (validável só após o passo 2 — Nara está ocupada na dupla da Paola agora)');
    console.log('   pré-checagem: Nara LEFT × Tanise RIGHT = compatível; Nara não é mate real de Tanise');
  } else {
    console.log('   ✅', JSON.stringify(await svc.substitutePlayer(MATCH, FRANCINE, NARA)));
  }

  if (!DRY) {
    const after = await svc.getMatchDetails(MATCH);
    console.log('\n— Depois:');
    console.log('  A:', after.double_a.display_name);
    console.log('  B:', after.double_b.display_name);
  }
  if (DRY) console.log('\n💡 Rode com CONFIRM_EXECUTE=yes pra aplicar.');
}
main().catch(e => { console.error('ERRO:', e); process.exit(1); });
