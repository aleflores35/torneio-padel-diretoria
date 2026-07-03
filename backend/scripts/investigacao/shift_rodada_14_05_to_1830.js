// Desloca início da rodada 14/05/2026 de 18:00 → 18:30 (e cascateia +30min).
// Afeta matches existentes 1270-1275 (masc cat 1 e 2) e atualiza window_start
// das rodadas 399, 400, 401 pra '18:30:00'.
// Os novos matches femininos (1278, 1279) já foram criados em 20:30 pelo script anterior.
// Guard: CONFIRM_EXECUTE=yes
const supabase = require('../../supabase');

const DATE = '2026-05-14';
const ROUND_IDS = [399, 400, 401];
const SHIFT = {
  '18:00': '18:30',
  '18:40': '19:10',
  '19:20': '19:50',
  '20:00': '20:30',
  '20:40': '21:10',
  '21:20': '21:50',
};

const DRY = process.env.CONFIRM_EXECUTE !== 'yes';

async function main() {
  console.log(`MODE: ${DRY ? 'DRY-RUN' : '⚠️  EXECUTANDO'}`);

  // 1) Atualizar window_start das rodadas
  console.log('\n— 1) Update rounds.window_start → 18:30:00');
  for (const id of ROUND_IDS) {
    const { data: r } = await supabase.from('rounds').select('id_round, window_start').eq('id_round', id).single();
    console.log(`   round ${id}: window_start atual=${r?.window_start}`);
    if (DRY) continue;
    const { error } = await supabase.from('rounds').update({ window_start: '18:30:00' }).eq('id_round', id);
    if (error) throw error;
  }

  // 2) Shift dos matches existentes em 14/05 (exceto os que já estão >=20:30 — feminino refeito)
  const { data: matches, error: eM } = await supabase
    .from('matches')
    .select('id_match, scheduled_at, id_court')
    .gte('scheduled_at', `${DATE}T00:00:00`)
    .lte('scheduled_at', `${DATE}T23:59:59`)
    .order('scheduled_at', { ascending: true });
  if (eM) throw eM;
  console.log(`\n— 2) Matches em ${DATE}: ${matches.length}`);

  for (const m of matches) {
    const time = m.scheduled_at.substring(11, 16); // HH:MM
    const newTime = SHIFT[time];
    if (!newTime) { console.log(`   id=${m.id_match} ${time} → sem mapeamento, skip`); continue; }
    if (time === newTime) { console.log(`   id=${m.id_match} ${time} → já no slot novo, skip`); continue; }
    const newSchedAt = `${DATE}T${newTime}:00+00:00`;
    console.log(`   id=${m.id_match} court=${m.id_court}  ${time} → ${newTime}`);
    if (DRY) continue;
    const { error } = await supabase.from('matches').update({ scheduled_at: newSchedAt }).eq('id_match', m.id_match);
    if (error) throw error;
  }

  console.log('\n✅ Concluído.');
  if (DRY) console.log('💡 Rode com CONFIRM_EXECUTE=yes pra aplicar.');
}

main().catch(e => { console.error('ERRO:', e); process.exit(1); });
