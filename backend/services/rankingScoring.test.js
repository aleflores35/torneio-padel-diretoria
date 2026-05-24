// Testes da regra de pontuacao do rankingService.
// Extraio o miolo do `for (const match...)` como funcao pura `scoreMatch`
// que recebe um match + duas duplas + stats em mutacao, sem tocar Supabase.
// Rodar: node backend/services/rankingScoring.test.js

const assert = require('assert');

// Replica do processamento de um match isolado, alinhado com rankingService.js.
function scoreMatch(match, dA, dB, stats) {
  const absents = new Set(Array.isArray(match.absent_player_ids) ? match.absent_player_ids : []);
  const playersA = [dA.id_player1, dA.id_player2].filter(Boolean);
  const playersB = [dB.id_player1, dB.id_player2].filter(Boolean);
  const aHasAbsent = playersA.some(p => absents.has(p));
  const bHasAbsent = playersB.some(p => absents.has(p));

  const gamesA = match.games_double_a ?? 0;
  const gamesB = match.games_double_b ?? 0;
  const hasValidScore = (gamesA > 0 || gamesB > 0) && gamesA !== gamesB;
  const aWonScore = hasValidScore && gamesA > gamesB;
  const bWonScore = hasValidScore && gamesB > gamesA;

  const processPlayer = (pid, ourGames, oppGames, ourWonScore, oppWonScore, ourSideAbsent, oppSideAbsent) => {
    if (!stats[pid]) return;
    stats[pid].matches_played++;
    if (absents.has(pid)) { stats[pid].wos++; return; }
    if (ourSideAbsent)    { stats[pid].points += 1; return; }
    if (oppSideAbsent)    { stats[pid].wins++; stats[pid].points += 3; return; }
    if (hasValidScore) {
      stats[pid].games_for     += ourGames;
      stats[pid].games_against += oppGames;
      if (ourWonScore)      { stats[pid].wins++;   stats[pid].points += 3; }
      else if (oppWonScore) { stats[pid].losses++; stats[pid].points += 1; }
      return;
    }
    stats[pid].points += 1;
  };

  for (const pid of playersA) processPlayer(pid, gamesA, gamesB, aWonScore, bWonScore, aHasAbsent, bHasAbsent);
  for (const pid of playersB) processPlayer(pid, gamesB, gamesA, bWonScore, aWonScore, bHasAbsent, aHasAbsent);
}

function emptyStats(ids) {
  const s = {};
  ids.forEach(id => { s[id] = { points:0, wins:0, losses:0, wos:0, matches_played:0, games_for:0, games_against:0 }; });
  return s;
}

const ALEX=1, FRANCISCO=2, MARCIO=3, GUSTAVO=4;
const dA = { id_player1: ALEX, id_player2: FRANCISCO };
const dB = { id_player1: MARCIO, id_player2: GUSTAVO };
const ALL = [ALEX, FRANCISCO, MARCIO, GUSTAVO];

// 1) Jogo normal sem faltas: A vence 6x3
{
  const s = emptyStats(ALL);
  scoreMatch({ games_double_a: 6, games_double_b: 3, absent_player_ids: [] }, dA, dB, s);
  assert.deepStrictEqual({p:s[ALEX].points, w:s[ALEX].wins, l:s[ALEX].losses, gf:s[ALEX].games_for, ga:s[ALEX].games_against, wo:s[ALEX].wos}, {p:3,w:1,l:0,gf:6,ga:3,wo:0}, 'C1 Alex');
  assert.deepStrictEqual({p:s[MARCIO].points, w:s[MARCIO].wins, l:s[MARCIO].losses, gf:s[MARCIO].games_for, ga:s[MARCIO].games_against, wo:s[MARCIO].wos}, {p:1,w:0,l:1,gf:3,ga:6,wo:0}, 'C1 Marcio');
}

// 2) Dupla B inteira faltou, sem placar
{
  const s = emptyStats(ALL);
  scoreMatch({ games_double_a: 0, games_double_b: 0, absent_player_ids: [MARCIO, GUSTAVO] }, dA, dB, s);
  assert.strictEqual(s[ALEX].points, 3, 'C2 Alex +3');
  assert.strictEqual(s[ALEX].wins, 1, 'C2 Alex win');
  assert.strictEqual(s[FRANCISCO].points, 3, 'C2 Francisco +3');
  assert.strictEqual(s[MARCIO].points, 0, 'C2 Marcio 0');
  assert.strictEqual(s[MARCIO].wos, 1, 'C2 Marcio wo++');
  assert.strictEqual(s[GUSTAVO].wos, 1, 'C2 Gustavo wo++');
}

// 3) CASO DO PRINT: Marcio falta, placar 9x0 lancado
{
  const s = emptyStats(ALL);
  scoreMatch({ games_double_a: 9, games_double_b: 0, absent_player_ids: [MARCIO] }, dA, dB, s);
  assert.strictEqual(s[ALEX].points, 3, 'C3 Alex +3 (WO win)');
  assert.strictEqual(s[ALEX].wins, 1, 'C3 Alex win++');
  assert.strictEqual(s[ALEX].games_for, 0, 'C3 Alex NAO soma games (WO ignora placar)');
  assert.strictEqual(s[FRANCISCO].points, 3, 'C3 Francisco +3');
  assert.strictEqual(s[MARCIO].points, 0, 'C3 Marcio 0 (WO)');
  assert.strictEqual(s[MARCIO].wos, 1, 'C3 Marcio wo++');
  assert.strictEqual(s[MARCIO].losses, 0, 'C3 Marcio NAO conta loss');
  assert.strictEqual(s[GUSTAVO].points, 1, 'C3 Gustavo +1 (compareceu, parceiro furou)');
  assert.strictEqual(s[GUSTAVO].wos, 0, 'C3 Gustavo NAO wo (esteve presente)');
}

// 4) Bilateral: Alex falta E Marcio falta
{
  const s = emptyStats(ALL);
  scoreMatch({ games_double_a: 0, games_double_b: 0, absent_player_ids: [ALEX, MARCIO] }, dA, dB, s);
  assert.strictEqual(s[ALEX].wos, 1, 'C4 Alex wo');
  assert.strictEqual(s[ALEX].points, 0, 'C4 Alex 0');
  assert.strictEqual(s[FRANCISCO].points, 1, 'C4 Francisco +1');
  assert.strictEqual(s[FRANCISCO].wins, 0, 'C4 Francisco sem win');
  assert.strictEqual(s[MARCIO].wos, 1, 'C4 Marcio wo');
  assert.strictEqual(s[GUSTAVO].points, 1, 'C4 Gustavo +1');
}

// 5) Sem placar e sem faltas (raro: status WO sem absent_ids ou IN_PROGRESS 0x0)
{
  const s = emptyStats(ALL);
  scoreMatch({ games_double_a: 0, games_double_b: 0, absent_player_ids: [] }, dA, dB, s);
  ALL.forEach(p => assert.strictEqual(s[p].points, 1, `C5 ${p} +1 fallback`));
}

// 6) Marcio falta, SEM placar lancado (cenario pre-fechamento)
{
  const s = emptyStats(ALL);
  scoreMatch({ games_double_a: 0, games_double_b: 0, absent_player_ids: [MARCIO] }, dA, dB, s);
  assert.strictEqual(s[ALEX].points, 3, 'C6 Alex +3');
  assert.strictEqual(s[FRANCISCO].points, 3, 'C6 Francisco +3');
  assert.strictEqual(s[MARCIO].wos, 1, 'C6 Marcio wo');
  assert.strictEqual(s[GUSTAVO].points, 1, 'C6 Gustavo +1');
}

// 7) matches_played sempre incrementa
{
  const s = emptyStats(ALL);
  scoreMatch({ games_double_a: 9, games_double_b: 0, absent_player_ids: [MARCIO] }, dA, dB, s);
  ALL.forEach(p => assert.strictEqual(s[p].matches_played, 1, `C7 ${p} matches_played`));
}

console.log('Todos os testes do rankingService passaram.');
