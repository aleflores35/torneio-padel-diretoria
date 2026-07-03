// Lista as rounds recentes de Feminino Iniciante (cat=3, tournament=7)
// pra ver se Catiane+Michele × Luana+Sabrina foi remarcado em rodada posterior à 398.
const supabase = require('../../supabase');

const ID_TOURNAMENT = 7;
const ID_CATEGORY = 3;

async function run() {
  const { data: rounds } = await supabase
    .from('rounds')
    .select('*')
    .eq('id_tournament', ID_TOURNAMENT)
    .eq('id_category', ID_CATEGORY)
    .order('scheduled_date', { ascending: false })
    .limit(10);

  console.log(`\nRounds recentes Feminino Iniciante (cat=${ID_CATEGORY}):\n`);
  for (const r of rounds || []) {
    const { data: matches } = await supabase
      .from('matches').select('id_match,id_double_a,id_double_b,games_double_a,games_double_b,status,scheduled_at')
      .eq('id_round', r.id_round);
    console.log(`Round ${r.id_round} num=${r.round_number} ${r.scheduled_date} status=${r.status} matches=${matches?.length ?? 0}`);
    for (const m of matches || []) {
      const { data: doubles } = await supabase
        .from('doubles').select('id_double,display_name,id_player1,id_player2')
        .in('id_double', [m.id_double_a, m.id_double_b]);
      const dA = doubles.find(d => d.id_double === m.id_double_a);
      const dB = doubles.find(d => d.id_double === m.id_double_b);
      const playerSet = new Set([dA?.id_player1, dA?.id_player2, dB?.id_player1, dB?.id_player2]);
      const TARGETS = new Set([693, 704, 697, 698]); // Michele Catiane Luana Sabrina
      const targetHits = [...playerSet].filter(p => TARGETS.has(p)).length;
      const flag = targetHits === 4 ? ' ← JOGO PROCURADO' : (targetHits >= 2 ? '  (contém alguma das 4)' : '');
      console.log(`   m=${m.id_match} ${m.status} ${m.scheduled_at} ${m.games_double_a ?? '-'}x${m.games_double_b ?? '-'} :: ${dA?.display_name} × ${dB?.display_name}${flag}`);
    }
  }
}

run().catch(e => { console.error(e); process.exit(1); });
