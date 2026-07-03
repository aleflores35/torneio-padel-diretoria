// Adiciona 1 jogo oficial extra na Masc 4ª (round 410, quinta 04/06):
//   18:00 · Quadra de Vidro (16)
//   Pablo Severo (673,R) + João Felipe Pereira (682,L)
//     × Marcos Ribeiro Ferreira (674,R) + Cláudio Dias (683,L)
// Os 4 estão ROTATED → viram NO_RESPONSE. Conta pro ranking.
//
// DRY-RUN default. Gravar: CONFIRM_EXECUTE=yes node scripts/investigacao/add_jogo_pablo_severo_round410.js

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
const supabase = require('../../supabase');

const EXECUTE = process.env.CONFIRM_EXECUTE === 'yes';
const ID_TOURNAMENT = 7, ID_CATEGORY = 2, ID_ROUND = 410;
const COURT = 16, TIME = '18:00', DATE = '2026-06-04';
const PA = { p1: 673, p2: 682 }; // Pablo Severo (R) + João Felipe (L)
const PB = { p1: 674, p2: 683 }; // Marcos Ribeiro (R) + Cláudio Dias (L)

async function main() {
  const { data: players } = await supabase.from('players').select('id_player,name,side').in('id_player', [673, 682, 674, 683]);
  const byId = {}; (players || []).forEach(p => byId[p.id_player] = p);
  const nm = id => byId[id]?.name;

  // valida slot livre
  const { data: clash } = await supabase.from('matches').select('id_match').eq('id_tournament', ID_TOURNAMENT).eq('id_court', COURT).eq('scheduled_at', `${DATE}T${TIME}:00`);
  console.log(`Slot ${TIME} Quadra Vidro: ${clash && clash.length ? '⚠️ OCUPADO' : '✅ livre'}`);
  console.log(`Jogo: ${nm(PA.p1)} + ${nm(PA.p2)} × ${nm(PB.p1)} + ${nm(PB.p2)} @ ${TIME}`);

  if (!EXECUTE) { console.log('\n🔍 DRY-RUN. Gravar: CONFIRM_EXECUTE=yes ...'); return; }
  if (clash && clash.length) throw new Error('Slot ocupado, abortando.');

  // doubles
  const { data: dbls, error: dErr } = await supabase.from('doubles').insert([
    { id_tournament: ID_TOURNAMENT, id_player1: PA.p1, id_player2: PA.p2, display_name: `${nm(PA.p1)} / ${nm(PA.p2)}`, id_round: ID_ROUND },
    { id_tournament: ID_TOURNAMENT, id_player1: PB.p1, id_player2: PB.p2, display_name: `${nm(PB.p1)} / ${nm(PB.p2)}`, id_round: ID_ROUND },
  ]).select();
  if (dErr) throw new Error('doubles: ' + dErr.message);
  const [da, db] = dbls;

  // match
  const { error: mErr } = await supabase.from('matches').insert({
    id_tournament: ID_TOURNAMENT, id_double_a: da.id_double, id_double_b: db.id_double,
    id_court: COURT, status: 'TO_PLAY', scheduled_at: `${DATE}T${TIME}:00`,
  });
  if (mErr) throw new Error('match: ' + mErr.message);

  // attendance ROTATED → NO_RESPONSE
  for (const pid of [673, 682, 674, 683]) {
    await supabase.from('round_attendance').update({ status: 'NO_RESPONSE' }).eq('id_round', ID_ROUND).eq('id_player', pid);
  }

  // partnerships
  for (const d of [PA, PB]) {
    const p1 = Math.min(d.p1, d.p2), p2 = Math.max(d.p1, d.p2);
    const { data: ex } = await supabase.from('partnerships').select('id_partnership,times_paired').eq('id_tournament', ID_TOURNAMENT).eq('id_category', ID_CATEGORY).eq('id_player1', p1).eq('id_player2', p2).maybeSingle();
    if (ex) await supabase.from('partnerships').update({ times_paired: ex.times_paired + 1, last_round_id: ID_ROUND }).eq('id_partnership', ex.id_partnership);
    else await supabase.from('partnerships').insert({ id_tournament: ID_TOURNAMENT, id_category: ID_CATEGORY, id_player1: p1, id_player2: p2, times_paired: 1, last_round_id: ID_ROUND });
  }

  // oppositions (4)
  const sideById = {}; (players || []).forEach(p => sideById[p.id_player] = p.side);
  for (const pa of [PA.p1, PA.p2]) for (const pb of [PB.p1, PB.p2]) {
    const p1 = Math.min(pa, pb), p2 = Math.max(pa, pb);
    const isDiag = sideById[pa] === sideById[pb] && sideById[pa] !== 'EITHER';
    const { data: ex } = await supabase.from('oppositions').select('id_opposition,times_opposed,diagonal_count').eq('id_tournament', ID_TOURNAMENT).eq('id_category', ID_CATEGORY).eq('id_player1', p1).eq('id_player2', p2).maybeSingle();
    if (ex) await supabase.from('oppositions').update({ times_opposed: ex.times_opposed + 1, diagonal_count: ex.diagonal_count + (isDiag ? 1 : 0), last_round_id: ID_ROUND }).eq('id_opposition', ex.id_opposition);
    else await supabase.from('oppositions').insert({ id_tournament: ID_TOURNAMENT, id_category: ID_CATEGORY, id_player1: p1, id_player2: p2, times_opposed: 1, diagonal_count: isDiag ? 1 : 0, last_round_id: ID_ROUND });
  }

  console.log(`\n✅ Jogo adicionado · round ${ID_ROUND} · ${TIME} Quadra de Vidro · 4 atletas NO_RESPONSE.`);
}
main().catch(e => { console.error('💥', e); process.exit(1); });
