// Backfill da tabela oppositions a partir das rodadas REGULAR já confirmadas.
// Necessário pra que o algoritmo novo de pareamento dupla-vs-dupla "lembre" do
// histórico de adversários antes da migration. Idempotente: se já houver entries
// pra uma rodada, pula essa rodada (compara via last_round_id).
//
// Uso: node scripts/backfill_oppositions.js [--dry]

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const supabase = require('../supabase');

const DRY = process.argv.includes('--dry');

async function backfill() {
  // Pega TODAS as rodadas REGULAR confirmadas (CONFIRMED ou FINISHED)
  const { data: rounds, error: rErr } = await supabase
    .from('rounds')
    .select('id_round, id_tournament, id_category, round_number, scheduled_date, status, round_type')
    .in('status', ['CONFIRMED', 'FINISHED', 'IN_PROGRESS'])
    .eq('round_type', 'REGULAR')
    .order('id_round', { ascending: true });
  if (rErr) throw rErr;

  console.log(`Rodadas REGULAR a processar: ${rounds.length}`);

  // Já populadas?
  const { data: existing } = await supabase
    .from('oppositions')
    .select('last_round_id');
  const populatedRoundIds = new Set((existing || []).map(o => o.last_round_id).filter(Boolean));
  console.log(`Rodadas já presentes em oppositions: ${[...populatedRoundIds].sort((a,b)=>a-b).join(', ') || '(nenhuma)'}`);

  let totalInserts = 0;
  let totalUpdates = 0;

  for (const round of rounds) {
    if (populatedRoundIds.has(round.id_round)) {
      console.log(`  ⏭️  round ${round.id_round} (#${round.round_number}, ${round.scheduled_date}) já tem entries — pulando`);
      continue;
    }

    // Buscar duplas + matches da rodada
    const { data: doubles } = await supabase
      .from('doubles').select('*').eq('id_round', round.id_round);
    if (!doubles || doubles.length === 0) {
      console.log(`  ⚠️  round ${round.id_round} sem duplas — pulando`);
      continue;
    }
    const dIds = doubles.map(d => d.id_double);
    const dById = {};
    doubles.forEach(d => { dById[d.id_double] = d; });

    const [{ data: mA }, { data: mB }] = await Promise.all([
      supabase.from('matches').select('id_double_a, id_double_b, status').in('id_double_a', dIds),
      supabase.from('matches').select('id_double_a, id_double_b, status').in('id_double_b', dIds)
    ]);
    const seen = new Set();
    const matches = [];
    for (const m of [...(mA||[]), ...(mB||[])]) {
      const k = `${m.id_double_a}-${m.id_double_b}`;
      if (seen.has(k)) continue;
      seen.add(k);
      // Filtra: ambos os IDs precisam pertencer à rodada
      if (dById[m.id_double_a] && dById[m.id_double_b]) matches.push(m);
    }

    if (matches.length === 0) {
      console.log(`  ⚠️  round ${round.id_round} sem matches válidos — pulando`);
      continue;
    }

    // Lados dos jogadores
    const playerIds = new Set();
    doubles.forEach(d => { playerIds.add(d.id_player1); playerIds.add(d.id_player2); });
    const { data: ps } = await supabase.from('players').select('id_player, side').in('id_player', [...playerIds]);
    const sideById = {};
    (ps || []).forEach(p => { sideById[p.id_player] = p.side; });

    let inserts = 0;
    let updates = 0;

    for (const m of matches) {
      const da = dById[m.id_double_a];
      const db = dById[m.id_double_b];
      const aPlayers = [da.id_player1, da.id_player2];
      const bPlayers = [db.id_player1, db.id_player2];
      for (const pa of aPlayers) {
        for (const pb of bPlayers) {
          const p1 = Math.min(pa, pb);
          const p2 = Math.max(pa, pb);
          const sa = sideById[pa];
          const sb = sideById[pb];
          const isDiagonal = sa && sb && sa === sb && sa !== 'EITHER';

          if (DRY) { inserts++; continue; }

          const { data: existing } = await supabase
            .from('oppositions')
            .select('id_opposition, times_opposed, diagonal_count')
            .eq('id_tournament', round.id_tournament)
            .eq('id_category', round.id_category)
            .eq('id_player1', p1)
            .eq('id_player2', p2)
            .maybeSingle();
          if (existing) {
            await supabase.from('oppositions').update({
              times_opposed: existing.times_opposed + 1,
              diagonal_count: existing.diagonal_count + (isDiagonal ? 1 : 0),
              last_round_id: round.id_round
            }).eq('id_opposition', existing.id_opposition);
            updates++;
          } else {
            await supabase.from('oppositions').insert({
              id_tournament: round.id_tournament,
              id_category: round.id_category,
              id_player1: p1, id_player2: p2,
              times_opposed: 1,
              diagonal_count: isDiagonal ? 1 : 0,
              last_round_id: round.id_round
            });
            inserts++;
          }
        }
      }
    }
    console.log(`  ✓ round ${round.id_round} (#${round.round_number}, ${round.scheduled_date}, ${matches.length} matches): ${inserts} inserts + ${updates} updates`);
    totalInserts += inserts;
    totalUpdates += updates;
  }

  console.log(`\n${DRY ? '[DRY-RUN] ' : ''}Total: ${totalInserts} inserts + ${totalUpdates} updates`);
}

backfill().catch(e => { console.error(e); process.exit(1); });
