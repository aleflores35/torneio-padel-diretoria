// Origem/limpeza da dupla órfã 2873 (Mariele/Daniela) na rodada 408. Read-only.
const supabase = require('../../supabase');

async function main() {
  const ROUND = 408, TOURN = 7, CAT = 3;
  const MARIELE = 707, DANIELA = 703, PAOLA = 692, CATIANE = 704;

  // 1. Estrutura da dupla 2873 (colunas, created_at?)
  const { data: d2873 } = await supabase.from('doubles').select('*').eq('id_double', 2873).single();
  console.log('=== Dupla 2873 (raw) ==='); console.log(d2873);

  // 2. Attendance completa da rodada 408
  const { data: att } = await supabase.from('round_attendance')
    .select('id_player, status, notes, responded_by').eq('id_round', ROUND);
  const { data: pls } = await supabase.from('players').select('id_player,name').eq('id_tournament', TOURN).eq('category_id', CAT);
  const nm = {}; (pls||[]).forEach(p => nm[p.id_player]=p.name);
  console.log('\n=== Attendance rodada 408 ===');
  console.table((att||[]).map(a => ({ jogadora: nm[a.id_player]||a.id_player, status: a.status, by: a.responded_by, notes: a.notes })));

  // 3. Partnerships envolvendo Mariele e Daniela neste torneio/cat
  const { data: parts } = await supabase.from('partnerships')
    .select('*').eq('id_tournament', TOURN).eq('id_category', CAT);
  const rel = (parts||[]).filter(p =>
    [MARIELE,DANIELA,PAOLA,CATIANE].includes(p.id_player1) || [MARIELE,DANIELA,PAOLA,CATIANE].includes(p.id_player2));
  console.log('\n=== Partnerships relevantes (Mariele/Daniela/Paola/Catiane) ===');
  console.table(rel.map(p => ({
    p1: nm[p.id_player1]||p.id_player1, p2: nm[p.id_player2]||p.id_player2,
    times_paired: p.times_paired, last_round_id: p.last_round_id
  })));

  // 4. Mariele e Daniela têm match em QUALQUER rodada hoje (2026-05-28)?
  const { data: todayRounds } = await supabase.from('rounds')
    .select('id_round, id_category, status, round_type').eq('scheduled_date', '2026-05-28');
  console.log('\n=== Rodadas de hoje (todas categorias) ===');
  console.table((todayRounds||[]).map(r => ({ id_round: r.id_round, cat: r.id_category, status: r.status, tipo: r.round_type })));

  // 5. Daniela está em outra dupla/match hoje fora a 2873?
  const { data: dDbls } = await supabase.from('doubles')
    .select('id_double, id_round, display_name')
    .or(`id_player1.eq.${DANIELA},id_player2.eq.${DANIELA}`);
  console.log('\n=== Todas as duplas da Daniela (703) ===');
  console.table((dDbls||[]).map(d => ({ id_double: d.id_double, id_round: d.id_round, dupla: d.display_name })));

  // 6. Mariele já jogou (CONFIRMED/FINISHED) com Catiane? (regra pétrea)
  const { data: catRounds } = await supabase.from('rounds').select('id_round')
    .eq('id_tournament', TOURN).eq('id_category', CAT).in('status', ['CONFIRMED','FINISHED']);
  const rIds = (catRounds||[]).map(r => r.id_round);
  let jogou = false;
  if (rIds.length) {
    const { data: pd } = await supabase.from('doubles').select('id_player1,id_player2,id_round')
      .in('id_round', rIds).or(`id_player1.eq.${CATIANE},id_player2.eq.${CATIANE}`);
    jogou = (pd||[]).some(d => d.id_player1===MARIELE || d.id_player2===MARIELE);
  }
  console.log('\nMariele já jogou em dupla CONFIRMED/FINISHED com Catiane?', jogou ? 'SIM (bloquearia)' : 'NÃO (ok)');
}
main().catch(e => { console.error(e); process.exit(1); });