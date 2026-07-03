// READ-ONLY — detalhe da substituição Marcio Ferreira ⇄ Bernardo Goulart, rodada 403.
const supabase = require('../../supabase');

async function main() {
  // courts
  const { data: courts } = await supabase.from('courts').select('id_court, name');
  console.log('— Courts:'); console.table(courts || []);

  // attendance completo dos 5 envolvidos na rodada 403
  const ids = [654, 657, 660]; // Bernardo, Marcio, Gustavo
  const { data: att } = await supabase.from('round_attendance')
    .select('id_player, status, responded_by, notes, responded_at')
    .eq('id_round', 403).in('id_player', ids);
  console.log('\n— Attendance rodada 403 (Bernardo 654 / Marcio 657 / Gustavo 660):');
  console.table(att || []);

  // partnerships envolvendo Gustavo Bock na categoria 1
  const { data: parts } = await supabase.from('partnerships')
    .select('id_partnership, id_player1, id_player2, times_paired, last_round_id')
    .eq('id_category', 1)
    .or('id_player1.eq.660,id_player2.eq.660');
  console.log('\n— Partnerships com Gustavo Bock (660), categoria 1:');
  console.table(parts || []);

  // match 1287 estado atual
  const { data: m } = await supabase.from('matches')
    .select('*').eq('id_match', 1287).single();
  console.log('\n— Match 1287:', JSON.stringify(m));
}
main().catch(e => { console.error('ERRO:', e); process.exit(1); });
