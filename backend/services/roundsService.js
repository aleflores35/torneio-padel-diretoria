// roundsService.js - Geração de rodadas com algoritmo Berger (round-robin)
// Usa bulk inserts no Supabase para evitar timeout no Vercel

const db = require('../database');
const supabase = require('../supabase');

function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function generateBergerRounds(playerIds) {
  const n = playerIds.length;
  if (n < 2) return [];

  const numRounds = n % 2 === 0 ? n - 1 : n;
  let players = n % 2 === 0 ? [...playerIds] : [...playerIds, null];
  const rounds = [];

  for (let round = 0; round < numRounds; round++) {
    const roundPairs = [];
    for (let i = 0; i < players.length / 2; i++) {
      const p1 = players[i];
      const p2 = players[players.length - 1 - i];
      if (p1 !== null && p2 !== null) {
        roundPairs.push({ player1: p1, player2: p2 });
      }
    }
    rounds.push(roundPairs);

    if (round < numRounds - 1) {
      const first = players[0];
      const rest = players.slice(1);
      const last = rest.pop();
      players = [first, last, ...rest];
    }
  }
  return rounds;
}

async function gerarRodas(id_tournament, id_category, startDate) {
  const dbAll = (sql, params) => new Promise((res, rej) =>
    db.all(sql, params, (err, rows) => err ? rej(err) : res(rows || []))
  );

  // 1. Busca jogadores da categoria
  const players = await dbAll(
    'SELECT * FROM players WHERE id_tournament = ? AND category_id = ? ORDER BY id_player',
    [id_tournament, id_category]
  );

  if (!players || players.length < 2) {
    throw new Error('Mínimo 2 jogadores necessário');
  }

  const playerIds = players.map(p => p.id_player);
  const playerMap = {};
  players.forEach(p => { playerMap[p.id_player] = p; });

  // 2. Gera estrutura Berger em memória
  const bergerRounds = generateBergerRounds(playerIds);
  if (bergerRounds.length === 0) throw new Error('Erro ao gerar rodadas');

  // 3. BULK INSERT de rounds
  let currentDate = new Date(startDate);
  const roundsToInsert = bergerRounds.map((_, idx) => {
    const date = new Date(currentDate);
    currentDate.setDate(currentDate.getDate() + 7);
    return {
      id_tournament,
      id_category,
      round_number: idx + 1,
      scheduled_date: date.toISOString().split('T')[0],
      window_start: '18:00',
      window_end: '21:00',
      status: 'PENDING'
    };
  });

  const { data: insertedRounds, error: roundErr } = await supabase
    .from('rounds')
    .insert(roundsToInsert)
    .select();
  if (roundErr) throw new Error('Rounds insert: ' + roundErr.message);

  // Mapeia round_number → id_round
  const roundIdMap = {};
  insertedRounds.forEach(r => { roundIdMap[r.round_number] = r.id_round; });

  // 4. BULK INSERT de doubles
  const doublesToInsert = [];
  bergerRounds.forEach((roundPairs, idx) => {
    const roundId = roundIdMap[idx + 1];
    roundPairs.forEach(pair => {
      const p1 = playerMap[pair.player1];
      const p2 = playerMap[pair.player2];
      doublesToInsert.push({
        id_tournament,
        id_player1: pair.player1,
        id_player2: pair.player2,
        display_name: `${p1.name} / ${p2.name}`,
        id_round: roundId
      });
    });
  });

  const { data: insertedDoubles, error: doubleErr } = await supabase
    .from('doubles')
    .insert(doublesToInsert)
    .select();
  if (doubleErr) throw new Error('Doubles insert: ' + doubleErr.message);

  // Agrupa doubles por id_round
  const doublesByRound = {};
  insertedDoubles.forEach(d => {
    if (!doublesByRound[d.id_round]) doublesByRound[d.id_round] = [];
    doublesByRound[d.id_round].push(d.id_double);
  });

  // 5. BULK INSERT de matches
  const matchesToInsert = [];
  Object.values(doublesByRound).forEach(doubleIds => {
    const shuffled = shuffle(doubleIds);
    for (let k = 0; k + 1 < shuffled.length; k += 2) {
      matchesToInsert.push({
        id_tournament,
        id_double_a: shuffled[k],
        id_double_b: shuffled[k + 1],
        status: 'TO_PLAY'
      });
    }
  });

  const { error: matchErr } = await supabase
    .from('matches')
    .insert(matchesToInsert);
  if (matchErr) throw new Error('Matches insert: ' + matchErr.message);

  return {
    status: 'success',
    rounds_created: insertedRounds.length,
    doubles_created: insertedDoubles.length,
    matches_created: matchesToInsert.length,
    total_rounds: bergerRounds.length
  };
}

async function getCalendario(id_tournament, id_category) {
  const dbAll = (sql, params) => new Promise((res, rej) =>
    db.all(sql, params, (err, rows) => err ? rej(err) : res(rows || []))
  );

  const [rounds, allDoubles] = await Promise.all([
    dbAll('SELECT * FROM rounds WHERE id_tournament = ? AND id_category = ? ORDER BY round_number', [id_tournament, id_category]),
    dbAll('SELECT * FROM doubles WHERE id_tournament = ? ORDER BY id_double', [id_tournament]),
  ]);

  if (!rounds.length) return [];

  const doublesByRound = {};
  allDoubles.forEach(d => {
    if (!doublesByRound[d.id_round]) doublesByRound[d.id_round] = [];
    doublesByRound[d.id_round].push(d);
  });

  return rounds.map(r => ({
    id_round: r.id_round,
    round_number: r.round_number,
    scheduled_date: r.scheduled_date,
    window_start: r.window_start,
    window_end: r.window_end,
    status: r.status,
    doubles: doublesByRound[r.id_round] || [],
    total_doubles: (doublesByRound[r.id_round] || []).length
  }));
}

async function getProximasRodadas(id_tournament) {
  const dbAll = (sql, params) => new Promise((res, rej) =>
    db.all(sql, params, (err, rows) => err ? rej(err) : res(rows || []))
  );

  const [rounds, allDoubles] = await Promise.all([
    dbAll('SELECT * FROM rounds WHERE id_tournament = ? ORDER BY scheduled_date', [id_tournament]),
    dbAll('SELECT * FROM doubles WHERE id_tournament = ?', [id_tournament])
  ]);

  const pending = rounds.filter(r => r.status === 'PENDING' || r.status === 'IN_PROGRESS').slice(0, 5);

  const doubleCountByRound = {};
  allDoubles.forEach(d => {
    doubleCountByRound[d.id_round] = (doubleCountByRound[d.id_round] || 0) + 1;
  });

  return pending.map(r => ({
    id_round: r.id_round,
    round_number: r.round_number,
    id_category: r.id_category,
    scheduled_date: r.scheduled_date,
    status: r.status,
    total_doubles: doubleCountByRound[r.id_round] || 0
  }));
}

module.exports = {
  gerarRodas,
  getCalendario,
  getProximasRodadas,
  generateBergerRounds
};
