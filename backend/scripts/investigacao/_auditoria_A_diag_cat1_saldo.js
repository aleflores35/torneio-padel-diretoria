/**
 * Diagnóstico do saldo GF≠GA na Categoria 1 (Masculino Iniciante)
 * READ-ONLY
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const supabase = require('../../supabase');

const ID_TOURNAMENT = 7;
const CAT_ID = 1;

async function main() {
  const [
    { data: players },
    { data: rounds },
    { data: doubles },
    { data: allMatches },
  ] = await Promise.all([
    supabase.from('players').select('*').eq('id_tournament', ID_TOURNAMENT).eq('category_id', CAT_ID).eq('active', true),
    supabase.from('rounds').select('*').eq('id_tournament', ID_TOURNAMENT),
    supabase.from('doubles').select('*').eq('id_tournament', ID_TOURNAMENT),
    supabase.from('matches').select('*').eq('id_tournament', ID_TOURNAMENT),
  ]);

  const roundMap = {};
  rounds.forEach(r => { roundMap[r.id_round] = r; });

  const exhibitionRoundIds = new Set(rounds.filter(r => r.round_type === 'EXHIBITION').map(r => r.id_round));
  const exhibitionDoubleIds = new Set(doubles.filter(d => exhibitionRoundIds.has(d.id_round)).map(d => d.id_double));

  const playerIds = new Set(players.map(p => p.id_player));
  const catDoubles = doubles.filter(d => playerIds.has(d.id_player1) || playerIds.has(d.id_player2));
  const catDoubleIds = new Set(catDoubles.map(d => d.id_double));

  const catMatches = allMatches.filter(m =>
    (m.status === 'FINISHED' || m.status === 'WO') &&
    catDoubleIds.has(m.id_double_a) && catDoubleIds.has(m.id_double_b) &&
    !exhibitionDoubleIds.has(m.id_double_a) && !exhibitionDoubleIds.has(m.id_double_b)
  );

  console.log(`Total matches Cat1 no cálculo: ${catMatches.length}`);
  console.log(`WO matches: ${catMatches.filter(m => m.status === 'WO').length}`);
  console.log(`FINISHED: ${catMatches.filter(m => m.status === 'FINISHED').length}\n`);

  // Para matches FINISHED, gf total deve = ga total (simétrico)
  // Para matches com placares assimétricos (ex: jogadores de categorias diferentes no mesmo match), pode haver divergência
  // Verificar matches onde um double é da cat1 mas o outro não
  let crossCatMatches = 0;
  for (const m of catMatches) {
    const aCat = catDoubleIds.has(m.id_double_a);
    const bCat = catDoubleIds.has(m.id_double_b);
    if (aCat !== bCat) {
      console.log(`CROSS-CAT match: id=${m.id_match} doubleA=${m.id_double_a}(cat1:${aCat}) doubleB=${m.id_double_b}(cat1:${bCat}) gA=${m.games_double_a} gB=${m.games_double_b}`);
      crossCatMatches++;
    }
  }
  console.log(`Cross-category matches: ${crossCatMatches}`);

  // Verificar matches onde absent_player_ids tem alguém -> games NÃO são somados para quem faltou
  let totalGFdirect = 0, totalGAdirect = 0;
  for (const m of catMatches) {
    if (m.status !== 'FINISHED') continue;
    const absents = new Set(Array.isArray(m.absent_player_ids) ? m.absent_player_ids : []);
    if (absents.size > 0) {
      console.log(`Match FINISHED com ausentes: id=${m.id_match} absents=[${[...absents]}] gA=${m.games_double_a} gB=${m.games_double_b}`);
    }
    totalGFdirect += (m.games_double_a || 0) + (m.games_double_b || 0);
    totalGAdirect += (m.games_double_a || 0) + (m.games_double_b || 0);
  }

  // O saldo individual pode diferir do par-de-matches porque ausentes não somam games
  // Vamos calcular: para cada match FINISHED sem WO, gf e ga dos jogadores devem ser
  // apenas games do lado que eles jogaram (não do lado ausente)

  const doubleMap = {};
  catDoubles.forEach(d => { doubleMap[d.id_double] = d; });

  let totalIndivGF = 0, totalIndivGA = 0;
  for (const m of catMatches) {
    if (m.status !== 'FINISHED') continue;
    const dA = doubleMap[m.id_double_a];
    const dB = doubleMap[m.id_double_b];
    if (!dA || !dB) continue;

    const absents = new Set(Array.isArray(m.absent_player_ids) ? m.absent_player_ids : []);
    const playersA = [dA.id_player1, dA.id_player2].filter(p => p && playerIds.has(p));
    const playersB = [dB.id_player1, dB.id_player2].filter(p => p && playerIds.has(p));
    const aHasAbsent = [dA.id_player1, dA.id_player2].filter(Boolean).some(p => absents.has(p));
    const bHasAbsent = [dB.id_player1, dB.id_player2].filter(Boolean).some(p => absents.has(p));

    const gA = m.games_double_a ?? 0;
    const gB = m.games_double_b ?? 0;
    const hasValidScore = (gA > 0 || gB > 0) && gA !== gB;

    if (!hasValidScore) continue;
    if (aHasAbsent || bHasAbsent) {
      // Games não são somados por processPlayer quando há ausente
      console.log(`Match com ausente e placar: id=${m.id_match} aAbsent=${aHasAbsent} bAbsent=${bHasAbsent} gA=${gA} gB=${gB} -> games NÃO entram no saldo individual`);
      continue;
    }

    // Somar games por jogador presente
    for (const pid of playersA) {
      if (!absents.has(pid)) {
        totalIndivGF += gA;
        totalIndivGA += gB;
      }
    }
    for (const pid of playersB) {
      if (!absents.has(pid)) {
        totalIndivGF += gB;
        totalIndivGA += gA;
      }
    }
  }

  console.log(`\nSoma individual GF=${totalIndivGF} GA=${totalIndivGA} diff=${totalIndivGF - totalIndivGA}`);
  console.log('(Esperado: GF == GA pois cada match contribui games A para lado A e games B para lado B)');

  // Verificar se algum match tem dupla de cat1 vs dupla de outra cat (cruzamento)
  console.log('\nVerificando matches onde double_a ou double_b pertence a round de outra categoria...');
  let anomalias = 0;
  for (const m of catMatches) {
    const dA = doubleMap[m.id_double_a];
    const dB = doubleMap[m.id_double_b];
    const roundA = dA ? roundMap[dA.id_round] : null;
    const roundB = dB ? roundMap[dB.id_round] : null;
    if (roundA && roundB && roundA.id_category !== roundB.id_category) {
      console.log(`  CROSS-CATEGORY ROUND: match=${m.id_match} roundA.cat=${roundA.id_category} roundB.cat=${roundB.id_category}`);
      anomalias++;
    }
  }
  console.log(`Total cross-category round matches: ${anomalias}`);

  // Verificar matches onde os players não são todos da catId esperada
  console.log('\nVerificando players em doubles que pertencem a outra categoria...');
  const allPlayers = (await supabase.from('players').select('*').eq('id_tournament', ID_TOURNAMENT)).data;
  const playerCatMap = {};
  allPlayers.forEach(p => { playerCatMap[p.id_player] = p.category_id; });

  for (const m of catMatches) {
    const dA = doubleMap[m.id_double_a];
    const dB = doubleMap[m.id_double_b];
    if (!dA || !dB) continue;
    const allPids = [dA.id_player1, dA.id_player2, dB.id_player1, dB.id_player2].filter(Boolean);
    const cats = allPids.map(pid => playerCatMap[pid]);
    const uniqueCats = [...new Set(cats)];
    if (uniqueCats.length > 1) {
      console.log(`  Match ${m.id_match}: players de cats=[${uniqueCats}] pids=[${allPids}]`);
    }
  }
}

main().catch(e => { console.error(e); process.exit(1); });
