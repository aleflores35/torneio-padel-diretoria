// Acha o match Catiane+Michele × Luana+Sabrina (jogo cancelado por falta de luz, 08/05).
// Uso: node scripts/investigacao/find_match_catiane_luana.js
const supabase = require('../../supabase');

const PLAYER_IDS = { catiane: 704, michele: 693, luana: 697, sabrina: 698 };

async function run() {
  // 1) Achar duplas que contém qualquer dessas jogadoras
  const ids = Object.values(PLAYER_IDS);
  const { data: doubles, error: e1 } = await supabase
    .from('doubles')
    .select('*')
    .or(ids.map(id => `id_player1.eq.${id},id_player2.eq.${id}`).join(','));
  if (e1) { console.error(e1); process.exit(1); }

  // Filtra duplas que sejam Catiane+Michele OU Luana+Sabrina
  const dupCM = doubles.filter(d => {
    const ps = [d.id_player1, d.id_player2].sort((a,b)=>a-b);
    return ps[0] === Math.min(693, 704) && ps[1] === Math.max(693, 704);
  });
  const dupLS = doubles.filter(d => {
    const ps = [d.id_player1, d.id_player2].sort((a,b)=>a-b);
    return ps[0] === Math.min(697, 698) && ps[1] === Math.max(697, 698);
  });

  console.log(`Duplas Catiane+Michele encontradas: ${dupCM.length}`);
  for (const d of dupCM) console.log(`  id_double=${d.id_double} round=${d.id_round} cat=${d.id_category} "${d.display_name || d.name || '?'}"`);
  console.log(`Duplas Luana+Sabrina encontradas: ${dupLS.length}`);
  for (const d of dupLS) console.log(`  id_double=${d.id_double} round=${d.id_round} cat=${d.id_category} "${d.display_name || d.name || '?'}"`);

  // 2) Achar matches entre essas duplas
  const idsCM = dupCM.map(d => d.id_double);
  const idsLS = dupLS.map(d => d.id_double);
  if (idsCM.length === 0 || idsLS.length === 0) { console.log('\nNão achei matches — uma das duplas não existe.'); return; }

  const { data: matches, error: e2 } = await supabase
    .from('matches')
    .select('*')
    .or(`and(id_double_a.in.(${idsCM.join(',')}),id_double_b.in.(${idsLS.join(',')})),and(id_double_a.in.(${idsLS.join(',')}),id_double_b.in.(${idsCM.join(',')}))`);
  if (e2) { console.error(e2); process.exit(1); }

  console.log(`\nMatches Catiane+Michele × Luana+Sabrina: ${matches.length}`);
  for (const m of matches) {
    console.log(`  id_match=${m.id_match} status=${m.status} scheduled=${m.scheduled_at} round=${m.id_round}`);
    console.log(`    score: ${m.games_double_a ?? m.score_a}x${m.games_double_b ?? m.score_b}`);
    console.log(`    A=${m.id_double_a}  B=${m.id_double_b}`);
  }

  // 3) Pegar info da rodada
  const roundIds = [...new Set(matches.map(m => m.id_round).filter(Boolean))];
  if (roundIds.length) {
    const { data: rounds } = await supabase.from('rounds').select('*').in('id_round', roundIds);
    console.log('\nRodadas envolvidas:');
    for (const r of rounds) console.log(`  id_round=${r.id_round} num=${r.round_number} cat=${r.id_category} data=${r.scheduled_date} status=${r.status}`);
  }
}

run().catch(e => { console.error(e); process.exit(1); });
