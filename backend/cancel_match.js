// Deleta um match específico da tabela matches (Supabase).
// Use quando admin identifica que um jogo não ocorreu e precisa ser removido.
//
// Uso: CONFIRM_DELETE=yes MATCH_ID=1234 node cancel_match.js

const supabase = require('./supabase');

async function cancelMatch() {
  const matchId = process.env.MATCH_ID;
  const confirm = process.env.CONFIRM_DELETE;

  if (!matchId) { console.error('❌ MATCH_ID obrigatório'); process.exit(1); }
  if (confirm !== 'yes') {
    console.log('⚠️  Pra deletar, rode com CONFIRM_DELETE=yes');
    process.exit(0);
  }

  // Preview do match + duplas envolvidas
  const { data: m, error: e1 } = await supabase.from('matches').select('*').eq('id_match', Number(matchId)).single();
  if (e1 || !m) { console.error('❌ Match não encontrado'); process.exit(1); }

  const { data: dA } = await supabase.from('doubles').select('display_name, id_player1, id_player2').eq('id_double', m.id_double_a).single();
  const { data: dB } = await supabase.from('doubles').select('display_name, id_player1, id_player2').eq('id_double', m.id_double_b).single();

  console.log(`Match ${matchId}: ${m.status} · score ${m.games_double_a}x${m.games_double_b} · ${m.scheduled_at}`);
  console.log(`  A: ${dA?.display_name || '?'}`);
  console.log(`  B: ${dB?.display_name || '?'}`);

  const { error } = await supabase.from('matches').delete().eq('id_match', Number(matchId));
  if (error) { console.error('❌', error.message); process.exit(1); }

  console.log(`✅ Match ${matchId} deletado`);
  console.log('   (Attendance das atletas NÃO foi mexida — elas continuam como "presente" na rodada.)');
  console.log('   (Ranking não afetado — match estava 0x0 IN_PROGRESS, não contribuía pontos.)');
}

cancelMatch().catch(err => { console.error(err); process.exit(1); });
