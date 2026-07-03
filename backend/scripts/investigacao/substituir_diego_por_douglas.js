// Substitui Diego Pohlmann (647) por Douglas Peil (645) no match 1272 (rodada 399).
// Também ajusta round_attendance: Diego→DECLINED (depto médico), Douglas+Alex→NO_RESPONSE (cancelaram impedimento).
// Guard: CONFIRM_EXECUTE=yes
const supabase = require('../../supabase');
const svc = require('../../services/substitutionService');

const ROUND_ID = 399;
const MATCH_ID = 1272;
const OUT_ID  = 647; // Diego Pohlmann
const IN_ID   = 645; // Douglas Peil
const ALEX_ID = 646; // Alex Severo (também voltou)

const DRY = process.env.CONFIRM_EXECUTE !== 'yes';

async function main() {
  console.log(`MODE: ${DRY ? 'DRY' : '⚠️  EXECUTANDO'}`);
  const now = new Date().toISOString();

  // 1) round_attendance updates
  const updates = [
    { id_round: ROUND_ID, id_player: OUT_ID,  status: 'DECLINED',    responded_by: 'ADMIN', notes: 'Depto médico ainda não liberou (declarado 12/05)', responded_at: now },
    { id_round: ROUND_ID, id_player: IN_ID,   status: 'NO_RESPONSE', responded_by: 'ADMIN', notes: 'Cancelou impedimento — voltou pro sorteio',         responded_at: now },
    { id_round: ROUND_ID, id_player: ALEX_ID, status: 'NO_RESPONSE', responded_by: 'ADMIN', notes: 'Cancelou impedimento — voltou pro sorteio',         responded_at: now },
  ];
  console.log('\n— 1) Atualizar round_attendance:');
  for (const u of updates) console.log(`   player=${u.id_player} → ${u.status}  notes="${u.notes}"`);
  if (!DRY) {
    const { error } = await supabase.from('round_attendance').upsert(updates, { onConflict: 'id_round,id_player' });
    if (error) throw error;
    console.log('   ✅ atendances upserted');
  }

  // 2) substituir Diego por Douglas
  console.log('\n— 2) Substituir Diego (647) por Douglas (645) no match 1272:');
  if (DRY) {
    const r = await svc.getSubstituteCandidates(MATCH_ID, OUT_ID);
    console.log('   would call substitutePlayer(1272, 647, 645)  partner=', r.partner.name);
  } else {
    const r = await svc.substitutePlayer(MATCH_ID, OUT_ID, IN_ID);
    console.log('   ✅', r);
  }

  console.log('\n✅ Concluído.');
  if (DRY) console.log('💡 Rode com CONFIRM_EXECUTE=yes pra aplicar.');
}

main().catch(e => { console.error('ERRO:', e); process.exit(1); });
