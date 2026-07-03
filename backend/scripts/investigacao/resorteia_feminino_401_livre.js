// RE-SORTEIO LIVRE feminino rodada 401 (14/05).
// Cancela TUDO (incl. makeup) e refaz sorteio respeitando sides:
//  - Pool: 12 femininas disponíveis (14 - Maria Luísa - Mariele)
//  - Pick 4 RIGHT + 4 LEFT por TIER DE games_played
//    (menos jogos primeiro; shuffle dentro do mesmo tier de jogos)
//  - Pair R+L → 4 duplas
//  - Chama confirmRound(401) → pareia duplas em 2 matches via Berger + slot allocation
// Guard: CONFIRM_EXECUTE=yes
//
// IMPORTANTE: se reusar este script como template pra outra rodada/categoria,
//   atualizar TOURNAMENT, CATEGORY, ROUND, DATE, MATCHES_TO_DELETE, DOUBLES_TO_DELETE.
//
// HISTÓRICO DO BUG (12/05/2026):
//   Versão anterior fazia shuffle puro em rights/lefts, ignorando games_played.
//   Resultado: re-sorteio aleatório quebrou a rotação por menos-jogos
//   (Tanise/Duda no fem cat 3 caíram fora 2-4 rodadas seguidas).
//   Fix: pickFairByGames() — agrupa por games_played, shuffle dentro do tier,
//   concatena do menor pro maior. Mesmo critério que selectPlayersForWeek
//   usa no sorteio oficial (weeklyDrawService.js).
const crypto = require('crypto');
const supabase = require('../../supabase');
const draw = require('../../services/weeklyDrawService');

const TOURNAMENT = 7;
const CATEGORY  = 3;
const ROUND     = 401;
const DATE      = '2026-05-14';

const MATCHES_TO_DELETE = [1278, 1279];
const DOUBLES_TO_DELETE = [2826, 2827, 2828, 2829];

const DRY = process.env.CONFIRM_EXECUTE !== 'yes';

function shuffleCrypto(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Conta games_played por jogador no torneio inteiro a partir de matches
// FINISHED/WO. Mesma lógica que weeklyDrawService.drawWeeklyRound usa em runtime
// (não confia em player_stats.games_played que não é atualizado automaticamente).
async function fetchGamesCount(id_tournament) {
  const [{ data: tourDoubles }, { data: countedMatches }] = await Promise.all([
    supabase.from('doubles').select('id_double, id_player1, id_player2').eq('id_tournament', id_tournament),
    supabase.from('matches').select('id_double_a, id_double_b').eq('id_tournament', id_tournament).in('status', ['FINISHED', 'WO']),
  ]);
  const dToPlayers = {};
  for (const d of tourDoubles || []) dToPlayers[d.id_double] = [d.id_player1, d.id_player2];
  const gamesCount = {};
  for (const m of countedMatches || []) {
    for (const pid of [...(dToPlayers[m.id_double_a] || []), ...(dToPlayers[m.id_double_b] || [])]) {
      gamesCount[pid] = (gamesCount[pid] || 0) + 1;
    }
  }
  return gamesCount;
}

// Seleciona N jogadores de `players` priorizando menos jogos.
// Agrupa por games_played, shuffle dentro do tier, concatena do menor pro maior.
// Sem isso, jogadores empatados em jogos teriam preferência fixa por ordem do BD.
function pickFairByGames(players, gamesCount, n) {
  const tiers = {};
  for (const p of players) {
    const g = gamesCount[p.id_player] || 0;
    (tiers[g] = tiers[g] || []).push(p);
  }
  const tierKeys = Object.keys(tiers).map(Number).sort((a, b) => a - b);
  const ordered = [];
  for (const k of tierKeys) ordered.push(...shuffleCrypto(tiers[k]));
  return { picks: ordered.slice(0, n), suplentes: ordered.slice(n) };
}

async function revertCountersForRound(id_tournament, id_category, id_round) {
  // Mesmo algoritmo do weeklyDrawService.revertCountersForRound (privado)
  const { data: parts } = await supabase.from('partnerships')
    .select('id_partnership, times_paired')
    .eq('id_tournament', id_tournament).eq('id_category', id_category).eq('last_round_id', id_round);
  for (const r of parts || []) {
    if (r.times_paired <= 1) {
      await supabase.from('partnerships').delete().eq('id_partnership', r.id_partnership);
    } else {
      await supabase.from('partnerships').update({ times_paired: r.times_paired - 1, last_round_id: null }).eq('id_partnership', r.id_partnership);
    }
  }
  const { data: opps } = await supabase.from('oppositions')
    .select('id_opposition, times_opposed, diagonal_count')
    .eq('id_tournament', id_tournament).eq('id_category', id_category).eq('last_round_id', id_round);
  for (const r of opps || []) {
    if (r.times_opposed <= 1) {
      await supabase.from('oppositions').delete().eq('id_opposition', r.id_opposition);
    } else {
      await supabase.from('oppositions').update({
        times_opposed: r.times_opposed - 1,
        diagonal_count: Math.max(0, (r.diagonal_count || 0) - 1),
        last_round_id: null,
      }).eq('id_opposition', r.id_opposition);
    }
  }
}

async function main() {
  console.log(`MODE: ${DRY ? 'DRY' : '⚠️  EXECUTANDO'}`);

  // 1) buscar disponíveis (femininas - impedidas)
  const { data: allFem } = await supabase.from('players')
    .select('id_player, name, side')
    .eq('id_tournament', TOURNAMENT).eq('category_id', CATEGORY);
  const { data: abs } = await supabase.from('player_absences')
    .select('id_player').eq('id_tournament', TOURNAMENT).eq('absence_date', DATE);
  const absentIds = new Set((abs || []).map(a => a.id_player));
  const available = allFem.filter(p => !absentIds.has(p.id_player));
  const rights = available.filter(p => p.side === 'RIGHT');
  const lefts  = available.filter(p => p.side === 'LEFT');
  const eithers = available.filter(p => p.side === 'EITHER');
  console.log(`\n— Disponíveis: ${available.length} (R=${rights.length} L=${lefts.length} E=${eithers.length})`);

  // 2) Pick 4R + 4L priorizando menos jogos (tier-based fair shuffle)
  const gamesCount = await fetchGamesCount(TOURNAMENT);
  const fmt = p => `${p.name}(${gamesCount[p.id_player] || 0}j)`;
  const { picks: picksR, suplentes: suplR } = pickFairByGames(rights, gamesCount, 4);
  const { picks: picksL, suplentes: suplL } = pickFairByGames(lefts, gamesCount, 4);

  console.log(`\n— Sorteio (n jogos no torneio entre parênteses):`);
  console.log(`  Jogam (R):`, picksR.map(fmt).join(', '));
  console.log(`  Jogam (L):`, picksL.map(fmt).join(', '));
  console.log(`  Suplentes:`, [...suplR, ...suplL].map(p => `${fmt(p)}/${p.side[0]}`).join(', '));

  // 3) pair R with L (random — shuffle L sequence)
  const lForPair = shuffleCrypto(picksL);
  const duplas = picksR.map((r, i) => ({
    id_tournament: TOURNAMENT,
    id_round: ROUND,
    id_player1: r.id_player,   // RIGHT
    id_player2: lForPair[i].id_player, // LEFT
    display_name: `${r.name.split(' ')[0]} + ${lForPair[i].name.split(' ')[0]}`,
  }));
  console.log(`\n— Duplas:`);
  for (const d of duplas) console.log(`  ${d.display_name}  (R:${d.id_player1} + L:${d.id_player2})`);

  // 4) Cancelar matches + duplas existentes + counters
  console.log(`\n— Cancelar estado atual rodada ${ROUND}:`);
  console.log(`  delete matches: ${MATCHES_TO_DELETE.join(', ')}`);
  console.log(`  delete doubles: ${DOUBLES_TO_DELETE.join(', ')}`);
  if (DRY) {
    console.log(`  (DRY) would revert counters last_round_id=${ROUND}`);
  } else {
    await supabase.from('matches').delete().in('id_match', MATCHES_TO_DELETE);
    await supabase.from('doubles').delete().in('id_double', DOUBLES_TO_DELETE);
    await revertCountersForRound(TOURNAMENT, CATEGORY, ROUND);
    console.log(`  ✅ cancelado`);
  }

  // 5) Inserir novas duplas
  console.log(`\n— Inserir 4 duplas em rodada ${ROUND}`);
  if (DRY) {
    console.log(`  (DRY) would insert 4 doubles`);
  } else {
    const { error } = await supabase.from('doubles').insert(duplas);
    if (error) throw error;
    console.log(`  ✅ duplas inseridas`);
  }

  // 6) Chamar confirmRound → pareia duplas em matches via Berger + slots
  console.log(`\n— confirmRound(${ROUND}) — pareia via Berger e aloca slots`);
  if (DRY) {
    console.log(`  (DRY) would call confirmRound(${ROUND})`);
  } else {
    const result = await draw.confirmRound(ROUND);
    console.log(`  ✅ confirmRound:`, JSON.stringify(result, null, 2));
  }

  console.log('\n✅ Concluído.');
  if (DRY) console.log('💡 Rode com CONFIRM_EXECUTE=yes pra aplicar.');
}

main().catch(e => { console.error('ERRO:', e); process.exit(1); });
