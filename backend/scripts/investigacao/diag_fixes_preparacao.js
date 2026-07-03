// READ-ONLY: levanta fatos pra preparar os 3 fixes (não escreve nada).
const supabase = require('../../supabase');
const ID_T = 7;
const EDUARDO = 679, MARCIO = 657, MATCH_TRAVADO = 1228;

async function run() {
  const [players, doubles, matches, rounds] = await Promise.all([
    supabase.from('players').select('id_player, name, side, category_id, active').eq('id_tournament', ID_T).then(r => r.data || []),
    supabase.from('doubles').select('id_double, id_player1, id_player2, id_round').eq('id_tournament', ID_T).then(r => r.data || []),
    supabase.from('matches').select('id_match, status, id_double_a, id_double_b, games_double_a, games_double_b, scheduled_at, absent_player_ids').eq('id_tournament', ID_T).then(r => r.data || []),
    supabase.from('rounds').select('id_round, id_category, round_number, scheduled_date').eq('id_tournament', ID_T).then(r => r.data || []),
  ]);
  const pById = {}; players.forEach(p => pById[p.id_player] = p);
  const dById = {}; doubles.forEach(d => dById[d.id_double] = d);
  const rById = {}; rounds.forEach(r => rById[r.id_round] = r);
  const nm = id => pById[id] ? `${pById[id].name} (${pById[id].side})` : `#${id}`;

  // (0) convenção: id_player1 é sempre RIGHT? amostra
  let p1right = 0, p1left = 0, mixed = 0;
  for (const d of doubles) {
    const s1 = pById[d.id_player1]?.side, s2 = pById[d.id_player2]?.side;
    if (s1 === 'RIGHT' && s2 === 'LEFT') p1right++;
    else if (s1 === 'LEFT' && s2 === 'RIGHT') p1left++;
    else mixed++;
  }
  console.log(`=== Convenção doubles: id_player1=RIGHT em ${p1right} duplas | id_player1=LEFT em ${p1left} | outras ${mixed}`);

  // (1) EDUARDO — inferir lado pelos parceiros (dupla = 1R+1L → parceiro oposto)
  console.log(`\n=== Eduardo Horbach (#${EDUARDO}) — inferência de lado ===`);
  const eduDoubles = doubles.filter(d => d.id_player1 === EDUARDO || d.id_player2 === EDUARDO);
  const eduMatchIds = new Set();
  matches.forEach(m => { if (eduDoubles.some(d => d.id_double === m.id_double_a || d.id_double === m.id_double_b)) eduMatchIds.add(m.id_match); });
  const partnerSides = {};
  for (const d of eduDoubles) {
    const slot = d.id_player1 === EDUARDO ? 'player1' : 'player2';
    const partner = d.id_player1 === EDUARDO ? d.id_player2 : d.id_player1;
    const ps = pById[partner]?.side || '?';
    partnerSides[ps] = (partnerSides[ps] || 0) + 1;
    console.log(`  dupla ${d.id_double} (round ${rById[d.id_round]?.round_number ?? '?'}) Eduardo em ${slot} · parceiro ${nm(partner)}`);
  }
  console.log(`  → parceiros por lado: ${JSON.stringify(partnerSides)}  (se parceiros são todos LEFT → Eduardo joga RIGHT, e vice-versa)`);
  console.log(`  → jogos do Eduardo: ${eduMatchIds.size}`);

  // (2) MARCIO — status, jogos, ausências
  console.log(`\n=== Marcio Ferreira (#${MARCIO}) — contexto da desativação ===`);
  console.log(`  active=${pById[MARCIO]?.active} · cat=${pById[MARCIO]?.category_id} · side=${pById[MARCIO]?.side}`);
  const marDoubles = doubles.filter(d => d.id_player1 === MARCIO || d.id_player2 === MARCIO);
  const marMatches = matches.filter(m => marDoubles.some(d => d.id_double === m.id_double_a || d.id_double === m.id_double_b));
  console.log(`  duplas: ${marDoubles.length} · matches: ${marMatches.length}`);
  marMatches.sort((a, b) => (a.scheduled_at || '').localeCompare(b.scheduled_at || '')).forEach(m => {
    const rN = rById[dById[m.id_double_a]?.id_round]?.round_number ?? '?';
    const abs = (m.absent_player_ids || []).includes(MARCIO) ? ' [FALTOU]' : '';
    console.log(`    match ${m.id_match} R${rN} ${m.scheduled_at?.slice(0,10)} ${m.status} ${m.games_double_a}x${m.games_double_b}${abs}`);
  });

  // (3) MATCH TRAVADO 1228
  console.log(`\n=== Match travado #${MATCH_TRAVADO} ===`);
  const mt = matches.find(m => m.id_match === MATCH_TRAVADO);
  if (mt) {
    const dA = dById[mt.id_double_a], dB = dById[mt.id_double_b];
    const rN = rById[dA?.id_round]?.round_number ?? '?';
    console.log(`  R${rN} ${mt.scheduled_at} status=${mt.status} placar ${mt.games_double_a}x${mt.games_double_b}`);
    console.log(`  dupla A: ${nm(dA?.id_player1)} + ${nm(dA?.id_player2)}`);
    console.log(`  dupla B: ${nm(dB?.id_player1)} + ${nm(dB?.id_player2)}`);
    console.log(`  ausentes: ${JSON.stringify(mt.absent_player_ids || [])}`);
  }
}
run().catch(e => { console.error(e.message || e); process.exit(1); });
