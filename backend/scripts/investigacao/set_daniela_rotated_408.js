// Marca Daniela Herzog (703) como ROTATED na rodada 408 (sem jogo hoje).
const supabase = require('../../supabase');
const ROUND = 408, DANIELA = 703;

async function show(tag) {
  const { data } = await supabase.from('round_attendance')
    .select('status, responded_by, notes').eq('id_round', ROUND).eq('id_player', DANIELA).maybeSingle();
  console.log(`[${tag}] Daniela@408:`, data);
}

async function main() {
  await show('ANTES');
  const { error } = await supabase.from('round_attendance').upsert([{
    id_round: ROUND, id_player: DANIELA, status: 'ROTATED',
    responded_by: 'ADMIN', notes: 'Sem jogo na rodada (dupla fantasma removida) — prioridade no próximo sorteio',
    responded_at: new Date().toISOString(),
  }], { onConflict: 'id_round,id_player' });
  if (error) { console.error('Erro:', error.message); process.exit(1); }
  console.log('✓ Daniela marcada ROTATED');
  await show('DEPOIS');
}
main().catch(e => { console.error(e); process.exit(1); });
