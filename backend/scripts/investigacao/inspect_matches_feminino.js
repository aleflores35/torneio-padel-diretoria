// Procura matches do Feminino Iniciante (cat=3, tournament=7) por DUPLAS,
// ignorando id_round (que parece estar NULL em todas as rounds).
const supabase = require('../../supabase');

const ID_TOURNAMENT = 7;
const PLAYER_IDS = [693, 704, 697, 698, 695, 702, 692, 703];

async function run() {
  // 1. Achar TODAS as duplas dessas jogadoras no torneio
  const { data: doubles } = await supabase
    .from('doubles')
    .select('id_double,id_player1,id_player2,display_name,id_round,id_tournament')
    .eq('id_tournament', ID_TOURNAMENT)
    .or(PLAYER_IDS.map(id => `id_player1.eq.${id},id_player2.eq.${id}`).join(','));
  console.log(`\nDuplas envolvendo essas 8 jogadoras: ${doubles?.length ?? 0}`);
  for (const d of doubles || []) {
    console.log(`  id=${d.id_double} round=${d.id_round} "${d.display_name}"`);
  }

  // 2. Procurar matches que envolvam qualquer dessas duplas
  const dIds = (doubles || []).map(d => d.id_double);
  if (!dIds.length) { console.log('Sem duplas pra procurar.'); return; }

  const { data: matches } = await supabase
    .from('matches')
    .select('*')
    .or(`id_double_a.in.(${dIds.join(',')}),id_double_b.in.(${dIds.join(',')})`);
  console.log(`\nMatches encontrados envolvendo essas duplas: ${matches?.length ?? 0}`);

  for (const m of matches || []) {
    const dA = doubles.find(d => d.id_double === m.id_double_a);
    const dB = doubles.find(d => d.id_double === m.id_double_b);
    console.log(`  id_match=${m.id_match} round_field=${m.id_round} status=${m.status} ${m.scheduled_at}`);
    console.log(`    score: ${m.games_double_a ?? '-'} x ${m.games_double_b ?? '-'}`);
    console.log(`    A=${m.id_double_a} "${dA?.display_name}"  ×  B=${m.id_double_b} "${dB?.display_name}"`);
  }

  // 3. Inspecionar colunas reais da tabela matches (pegar uma row qualquer)
  const { data: sample } = await supabase
    .from('matches').select('*').eq('id_tournament', ID_TOURNAMENT).limit(1);
  if (sample?.length) {
    console.log('\nSchema matches (chaves):', Object.keys(sample[0]).join(', '));
  }

  // 4. Contar matches por round_number/id_round pra entender se há padrão
  const { data: countByRound } = await supabase
    .from('matches').select('id_round').eq('id_tournament', ID_TOURNAMENT);
  const cnt = {};
  (countByRound || []).forEach(m => {
    const k = m.id_round ?? 'NULL';
    cnt[k] = (cnt[k] || 0) + 1;
  });
  console.log('\nMatches por id_round (tournament 7):');
  Object.entries(cnt).sort().forEach(([k, v]) => console.log(`  id_round=${k}: ${v} matches`));
}

run().catch(e => { console.error(e); process.exit(1); });
