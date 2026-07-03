// Diagnóstico rodada 401 (feminina 14/05)
// matches.id_group -> groups -> ? (groups não tem id_round na query, ver)
// doubles.id_round = 401 → pega duplas, aí matches via id_double_a/b
const supabase = require('../../supabase');

async function run() {
  const ROUND_ID = 401;
  const PLAYER_IDS = { 704:'Catiane', 693:'Michele', 697:'Luana', 698:'Sabrina' };

  // duplas da rodada via doubles.id_round
  const { data: doubles, error: eD } = await supabase
    .from('doubles')
    .select('*')
    .eq('id_round', ROUND_ID);
  if (eD) { console.error('Erro doubles:', eD); process.exit(1); }
  console.log(`Duplas na rodada ${ROUND_ID}: ${doubles?.length ?? 0}`);

  // achar nomes dos players via tabela players (ou athletes)
  const allPlayerIds = [...new Set((doubles || []).flatMap(d => [d.id_player1, d.id_player2]))];
  const { data: players } = await supabase
    .from('players')
    .select('id_player, name')
    .in('id_player', allPlayerIds);
  const nameById = {};
  for (const p of players || []) nameById[p.id_player] = p.name;

  for (const d of doubles || []) {
    const p1 = PLAYER_IDS[d.id_player1] || nameById[d.id_player1] || `p${d.id_player1}`;
    const p2 = PLAYER_IDS[d.id_player2] || nameById[d.id_player2] || `p${d.id_player2}`;
    const flag = (PLAYER_IDS[d.id_player1] || PLAYER_IDS[d.id_player2]) ? ' ⚠️' : '';
    console.log(`  id_double=${d.id_double} ${p1} + ${p2}${flag}`);
  }

  // matches que referenciam essas duplas
  const doubleIds = (doubles || []).map(d => d.id_double);
  if (!doubleIds.length) { console.log('Sem duplas → sem matches'); return; }

  const { data: matches, error: eM } = await supabase
    .from('matches')
    .select('*')
    .or(`id_double_a.in.(${doubleIds.join(',')}),id_double_b.in.(${doubleIds.join(',')})`);
  if (eM) { console.error('Erro matches:', eM); process.exit(1); }

  console.log(`\nMatches envolvendo duplas da rodada ${ROUND_ID}: ${matches?.length ?? 0}`);
  for (const m of matches || []) {
    const dA = (doubles || []).find(d => d.id_double === m.id_double_a);
    const dB = (doubles || []).find(d => d.id_double === m.id_double_b);
    const nm = (d) => d ? `${PLAYER_IDS[d.id_player1] || nameById[d.id_player1] || d.id_player1}+${PLAYER_IDS[d.id_player2] || nameById[d.id_player2] || d.id_player2}` : '?';
    console.log(`  id_match=${m.id_match} status=${m.status} ${m.scheduled_at} court=${m.id_court}  ${nm(dA)} × ${nm(dB)}  games=${m.games_double_a}x${m.games_double_b}  group=${m.id_group}`);
  }

  // verifica as 4 atletas
  console.log(`\nPresença das 4 atletas:`);
  for (const pid of Object.keys(PLAYER_IDS)) {
    const id = Number(pid);
    const inDouble = (doubles || []).find(d => d.id_player1 === id || d.id_player2 === id);
    if (inDouble) {
      const partner = inDouble.id_player1 === id ? inDouble.id_player2 : inDouble.id_player1;
      const partnerName = PLAYER_IDS[partner] || nameById[partner] || `p${partner}`;
      console.log(`  ✅ ${PLAYER_IDS[pid]} (${pid}) em dupla ${inDouble.id_double} com ${partnerName} (${partner})`);
    } else {
      console.log(`  ❌ ${PLAYER_IDS[pid]} (${pid}) não está em dupla nesta rodada`);
    }
  }
}

run().catch(e => { console.error(e); process.exit(1); });
