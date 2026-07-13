// Reverte #1421 pro original (round 443 = 30/07, 19:10, quadra 17). Tira a colisão em 16/07.
const supabase = require('../../supabase');
const DRY = process.env.CONFIRM_EXECUTE !== 'yes';
(async () => {
  const { data: m } = await supabase.from('matches').select('*').eq('id_match', 1421).single();
  console.log(`#1421 atual: round(via doubles) scheduled=${m.scheduled_at} court=${m.id_court} | ${DRY?'DRY':'EXEC'}`);
  const orig = { round: 443, sched: '2026-07-30T19:10:00+00:00', court: 17 };
  if (DRY) { console.log(`-> reverter p/ round ${orig.round}, ${orig.sched}, q${orig.court}`); return process.exit(0); }
  await supabase.from('doubles').update({ id_round: orig.round }).eq('id_double', m.id_double_a);
  await supabase.from('doubles').update({ id_round: orig.round }).eq('id_double', m.id_double_b);
  await supabase.from('matches').update({ scheduled_at: orig.sched, id_court: orig.court }).eq('id_match', 1421);
  console.log('✅ #1421 revertido p/ 30/07 19:10 q17.');
  process.exit(0);
})();
