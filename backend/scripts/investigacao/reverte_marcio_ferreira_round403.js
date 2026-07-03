// Reverte a substituição da rodada 403 (Masc Iniciante, 21/05): tira Bernardo
// Goulart (654) e devolve Marcio Ferreira (657) na Dupla B do match 1287.
// Estado original: "Marcio Ferreira / Gustavo Bock" @ Quadra de Parede 19h10.
// Guard: CONFIRM_EXECUTE=yes
const supabase = require('../../supabase');
const svc = require('../../services/substitutionService');

const MATCH_ID = 1287;
const OUT_ID = 654; // Bernardo Goulart (entrou na substituição de 20/05)
const IN_ID  = 657; // Marcio Ferreira (jogador original)

const DRY = process.env.CONFIRM_EXECUTE !== 'yes';

async function main() {
  console.log(`MODE: ${DRY ? 'DRY' : '⚠️  EXECUTANDO'}`);

  const before = await svc.getMatchDetails(MATCH_ID);
  console.log('\n— Antes:');
  console.log('  A:', before.double_a.display_name);
  console.log('  B:', before.double_b.display_name, '(status match:', before.status + ')');

  if (DRY) {
    const cand = await svc.getSubstituteCandidates(MATCH_ID, OUT_ID);
    const marcio = cand.candidates.find(c => c.id_player === IN_ID);
    console.log('\n— Reversão planejada: substitutePlayer(1287, out=654 Bernardo, in=657 Marcio)');
    console.log('  parceiro mantido:', cand.partner.name, `(${cand.partner.side})`);
    console.log('  Marcio Ferreira elegível?', marcio ? `SIM (side ${marcio.side}, attendance ${marcio.attendance_status})` : '❌ NÃO ESTÁ NOS CANDIDATOS');
    console.log('\n💡 Rode com CONFIRM_EXECUTE=yes pra aplicar.');
    return;
  }

  const r = await svc.substitutePlayer(MATCH_ID, OUT_ID, IN_ID);
  console.log('\n✅ Substituição revertida:', JSON.stringify(r, null, 2));

  const after = await svc.getMatchDetails(MATCH_ID);
  console.log('\n— Depois:');
  console.log('  A:', after.double_a.display_name);
  console.log('  B:', after.double_b.display_name);
}
main().catch(e => { console.error('ERRO:', e); process.exit(1); });
