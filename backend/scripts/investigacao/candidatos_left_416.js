// Read-only: candidatos a substituir o Ivan (685) no round 416 (cat 2) — canhotos disponíveis,
// rotação (menos jogos) e frescor de mesma posição vs Pablo(686)/Alessandro(690)/João(682).
// Rodar: node scripts/investigacao/candidatos_left_416.js
const supabase = require('../../supabase');

const TOUR = 7, CAT = 2, ROUND = 416;
const NO_GROUP = [686, 690, 682]; // canhotos que ficam (precisa ser inédito vs estes); 685 Ivan sai
const NAME = {};

async function main() {
  // schemas relevantes
  const { data: ps1 } = await supabase.from('player_stats').select('*').limit(1);
  console.log('player_stats cols:', ps1 && ps1[0] ? Object.keys(ps1[0]).join(', ') : '(vazio)');
  const { data: ra1 } = await supabase.from('round_attendance').select('*').limit(1);
  console.log('round_attendance cols:', ra1 && ra1[0] ? Object.keys(ra1[0]).join(', ') : '(vazio)');

  // jogadores cat 2 ativos
  const { data: players } = await supabase.from('players')
    .select('id_player, name, side, active').eq('id_tournament', TOUR).eq('category_id', CAT);
  players.forEach(p => { NAME[p.id_player] = p.name; });
  const lefts = players.filter(p => p.side === 'LEFT' && p.active !== false);

  // attendance da rodada 416 (quem está selecionado / rotacionado / declinado)
  const { data: att } = await supabase.from('round_attendance').select('*').eq('id_round', ROUND);
  const attById = {}; (att || []).forEach(a => { attById[a.id_player] = a.status; });

  // games_played (player_stats cat 2)
  const { data: stats } = await supabase.from('player_stats').select('*').eq('id_tournament', TOUR).eq('id_category', CAT);
  const gamesById = {}; (stats || []).forEach(s => { gamesById[s.id_player] = s.games_played; });

  // oposições (diag) cat 2
  const { data: opps } = await supabase.from('oppositions').select('*').eq('id_tournament', TOUR).eq('id_category', CAT);
  const key = (a, b) => (a < b ? `${a}-${b}` : `${b}-${a}`);
  const diag = {}; (opps || []).forEach(o => { diag[key(o.id_player1, o.id_player2)] = o.diagonal_count || 0; });
  // NB: inclui contribuição do 416. Pra "vs grupo que fica" isso não distorce (Ivan sai; grupo fica).

  const inRound416 = new Set([685, 686, 682, 690]);
  console.log(`\n=== CANHOTOS cat 2 (lado LEFT) ===`);
  const rows = lefts.map(p => {
    const fresh = NO_GROUP.map(g => `${NAME[g].split(' ')[0]}:${diag[key(p.id_player, g)] || 0}`).join(' ');
    const totalDiagVsGroup = NO_GROUP.reduce((s, g) => s + (diag[key(p.id_player, g)] || 0), 0);
    return {
      id: p.id_player,
      nome: p.name,
      no_416: inRound416.has(p.id_player) ? 'SIM' : '',
      attend_416: attById[p.id_player] || '(sem registro)',
      jogos: gamesById[p.id_player] ?? '?',
      vs_grupo: fresh,
      diag_total_vs_grupo: totalDiagVsGroup,
    };
  }).sort((a, b) => (a.jogos ?? 99) - (b.jogos ?? 99));
  console.table(rows);

  console.log('\n=== CANDIDATOS IDEAIS (fora do 416, não-DECLINED, INÉDITO vs grupo, menos jogos) ===');
  const cand = rows.filter(r => r.no_416 !== 'SIM' && r.attend_416 !== 'DECLINED' && r.diag_total_vs_grupo === 0);
  if (!cand.length) console.log('  Nenhum 100% inédito. Mostrando os de MENOR diag vs grupo:');
  const fallback = cand.length ? cand : rows.filter(r => r.no_416 !== 'SIM' && r.attend_416 !== 'DECLINED').sort((a, b) => a.diag_total_vs_grupo - b.diag_total_vs_grupo);
  console.table(fallback);
}
main().catch(e => { console.error(e); process.exit(1); });
