// Refaz a rodada 5 feminina (id_round=401, 14/05/2026):
//  1) Registra impedimento Mariele (id 707) pra 14/05
//  2) Deleta matches 1276, 1277
//  3) Deleta doubles 2822, 2823, 2824, 2825
//  4) Reverte contadores partnerships/oppositions carimbados em last_round_id=401
//  5) Sorteia 4 atletas entre Amanda(699), Paola(692), Nara(701), Nicole(695), Tanise(694)
//     — 1 fica como suplente (random)
//  6) Cria 4 duplas novas:
//       FIXO A: Michele(693) + Catiane(704)
//       FIXO B: Luana(697) + Sabrina(698)
//       SORT C: random_4[0] + random_4[1]
//       SORT D: random_4[2] + random_4[3]
//  7) Cria 2 matches às 20:00:
//       match A × B (court 16) — JOGO PENDENTE REMARCADO
//       match C × D (court 17) — sorteado
//  8) Re-incrementa partnerships e oppositions com last_round_id=401
//
// Guard: CONFIRM_EXECUTE=yes pra rodar de verdade. Sem isso, faz DRY-RUN.
// Uso: CONFIRM_EXECUTE=yes node scripts/investigacao/refaz_feminino_401_com_fixo.js

const crypto = require('crypto');
const supabase = require('../../supabase');

const TOURNAMENT = 7;
const CATEGORY  = 3;
const ROUND     = 401;
const DATE      = '2026-05-14';

const FIXO_CM = [693, 704]; // Michele, Catiane
const FIXO_LS = [697, 698]; // Luana, Sabrina

const SORT_POOL = [
  { id: 699, name: 'Amanda Oestreich' },
  { id: 692, name: 'Paola Brendler' },
  { id: 701, name: 'Nara Nunes' },
  { id: 695, name: 'Nicole Facchini' },
  { id: 694, name: 'Tanise Cezimbra' },
];

const MATCHES_TO_DELETE = [1276, 1277];
const DOUBLES_TO_DELETE = [2822, 2823, 2824, 2825];

const MARIELE_ID = 707;

const SLOT_TIME = '20:30'; // shift +30min: rodada agora começa 18:30 (slot 4 = 20:30)
const COURT_FIXO = 16;
const COURT_SORT = 17;

const DRY = process.env.CONFIRM_EXECUTE !== 'yes';

function shuffleCrypto(arr) {
  // Fisher–Yates com crypto.randomInt
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function step(label, fn) {
  console.log(`\n— ${label} ${DRY ? '(DRY)' : ''}`);
  await fn();
}

async function main() {
  console.log(`MODE: ${DRY ? 'DRY-RUN (sem mexer no banco)' : '⚠️  EXECUTANDO de verdade'}`);

  // 0) lookup nomes (pra display_name)
  const allIds = [...FIXO_CM, ...FIXO_LS, ...SORT_POOL.map(p => p.id)];
  const { data: players } = await supabase.from('players').select('id_player, name, side').in('id_player', allIds);
  const playerById = Object.fromEntries((players || []).map(p => [p.id_player, p]));
  console.log('Lookup atletas:', Object.values(playerById).map(p => `${p.id_player}=${p.name}(${p.side || '?'})`).join(' · '));

  // 1) Impedimento Mariele
  await step(`1) Registrar impedimento Mariele (${MARIELE_ID}) em ${DATE}`, async () => {
    const { data: exist } = await supabase
      .from('player_absences')
      .select('id')
      .eq('id_tournament', TOURNAMENT)
      .eq('id_player', MARIELE_ID)
      .eq('absence_date', DATE);
    if (exist && exist.length) { console.log('   já existe → skip'); return; }
    if (DRY) { console.log('   would insert absence'); return; }
    const { error } = await supabase.from('player_absences').insert({
      id_tournament: TOURNAMENT,
      id_player: MARIELE_ID,
      absence_date: DATE,
    });
    if (error) throw error;
    console.log('   ✅ absence inserida');
  });

  // 2) Deletar matches 1276, 1277
  await step(`2) Deletar matches ${MATCHES_TO_DELETE.join(', ')}`, async () => {
    if (DRY) { console.log(`   would delete matches ${MATCHES_TO_DELETE.join(', ')}`); return; }
    const { error } = await supabase.from('matches').delete().in('id_match', MATCHES_TO_DELETE);
    if (error) throw error;
    console.log(`   ✅ deletados`);
  });

  // 3) Deletar duplas 2822-2825
  await step(`3) Deletar doubles ${DOUBLES_TO_DELETE.join(', ')}`, async () => {
    if (DRY) { console.log(`   would delete doubles ${DOUBLES_TO_DELETE.join(', ')}`); return; }
    const { error } = await supabase.from('doubles').delete().in('id_double', DOUBLES_TO_DELETE);
    if (error) throw error;
    console.log(`   ✅ deletados`);
  });

  // 4) Reverter contadores
  await step(`4) Reverter partnerships+oppositions carimbados em last_round_id=${ROUND}`, async () => {
    const { data: parts } = await supabase
      .from('partnerships')
      .select('id_partnership, times_paired, id_player1, id_player2')
      .eq('id_tournament', TOURNAMENT).eq('id_category', CATEGORY).eq('last_round_id', ROUND);
    console.log(`   partnerships a reverter: ${parts?.length ?? 0}`);
    for (const r of parts || []) {
      const op = r.times_paired <= 1 ? 'DELETE' : `UPDATE times=${r.times_paired - 1}`;
      console.log(`     ${op}  p1=${r.id_player1} p2=${r.id_player2}`);
      if (DRY) continue;
      if (r.times_paired <= 1) {
        await supabase.from('partnerships').delete().eq('id_partnership', r.id_partnership);
      } else {
        await supabase.from('partnerships').update({ times_paired: r.times_paired - 1, last_round_id: null }).eq('id_partnership', r.id_partnership);
      }
    }
    const { data: opps } = await supabase
      .from('oppositions')
      .select('id_opposition, times_opposed, diagonal_count, id_player1, id_player2')
      .eq('id_tournament', TOURNAMENT).eq('id_category', CATEGORY).eq('last_round_id', ROUND);
    console.log(`   oppositions a reverter: ${opps?.length ?? 0}`);
    for (const r of opps || []) {
      const op = r.times_opposed <= 1 ? 'DELETE' : `UPDATE times=${r.times_opposed - 1} diag=${Math.max(0, (r.diagonal_count || 0) - 1)}`;
      console.log(`     ${op}  p1=${r.id_player1} p2=${r.id_player2}`);
      if (DRY) continue;
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
  });

  // 5) Sortear
  const shuffled = shuffleCrypto(SORT_POOL);
  const sortJogam = shuffled.slice(0, 4);
  const sortSuplente = shuffled[4];
  console.log('\n— 5) Sorteio:');
  console.log('   Jogam (4):', sortJogam.map(p => `${p.name}(${p.id})`).join(', '));
  console.log('   Suplente :', `${sortSuplente.name}(${sortSuplente.id})`);

  // 6) Criar 4 duplas
  function mkDouble(idP1, idP2) {
    const a = playerById[idP1]; const b = playerById[idP2];
    return {
      id_tournament: TOURNAMENT,
      id_round: ROUND,
      id_player1: idP1,
      id_player2: idP2,
      display_name: `${a.name.split(' ')[0]} + ${b.name.split(' ')[0]}`,
    };
  }
  const dToInsert = [
    mkDouble(FIXO_CM[0], FIXO_CM[1]), // Michele + Catiane
    mkDouble(FIXO_LS[0], FIXO_LS[1]), // Luana + Sabrina
    mkDouble(sortJogam[0].id, sortJogam[1].id),
    mkDouble(sortJogam[2].id, sortJogam[3].id),
  ];
  console.log('\n— 6) Criar 4 duplas:');
  for (const d of dToInsert) console.log(`   ${d.display_name}  (p1=${d.id_player1} p2=${d.id_player2})`);

  let inserted;
  if (DRY) {
    console.log('   (DRY) would insert 4 doubles');
    inserted = dToInsert.map((d, i) => ({ ...d, id_double: 90000 + i }));
  } else {
    const { data, error } = await supabase.from('doubles').insert(dToInsert).select();
    if (error) throw error;
    inserted = data;
    console.log('   ✅ duplas criadas:', inserted.map(d => `${d.id_double}=${d.display_name}`).join(' · '));
  }
  const dCM = inserted.find(d => d.id_player1 === FIXO_CM[0] && d.id_player2 === FIXO_CM[1]) || inserted[0];
  const dLS = inserted.find(d => d.id_player1 === FIXO_LS[0] && d.id_player2 === FIXO_LS[1]) || inserted[1];
  const dC  = inserted[2];
  const dD  = inserted[3];

  // 7) Criar 2 matches
  const matchesToInsert = [
    {
      id_tournament: TOURNAMENT,
      id_double_a: dCM.id_double,
      id_double_b: dLS.id_double,
      id_court: COURT_FIXO,
      status: 'TO_PLAY',
      scheduled_at: `${DATE}T${SLOT_TIME}:00`,
    },
    {
      id_tournament: TOURNAMENT,
      id_double_a: dC.id_double,
      id_double_b: dD.id_double,
      id_court: COURT_SORT,
      status: 'TO_PLAY',
      scheduled_at: `${DATE}T${SLOT_TIME}:00`,
    },
  ];
  console.log('\n— 7) Criar 2 matches:');
  console.log(`   FIXO   court=${COURT_FIXO} ${SLOT_TIME}: ${dCM.display_name} × ${dLS.display_name}`);
  console.log(`   SORT   court=${COURT_SORT} ${SLOT_TIME}: ${dC.display_name} × ${dD.display_name}`);

  if (DRY) {
    console.log('   (DRY) would insert 2 matches');
  } else {
    const { error } = await supabase.from('matches').insert(matchesToInsert);
    if (error) throw error;
    console.log('   ✅ matches criados');
  }

  // 8) Atualizar partnerships e oppositions
  console.log('\n— 8) Re-incrementar partnerships e oppositions:');

  // partnerships: 1 por dupla
  for (const d of inserted) {
    const p1 = Math.min(d.id_player1, d.id_player2);
    const p2 = Math.max(d.id_player1, d.id_player2);
    if (DRY) {
      console.log(`   partnership p1=${p1} p2=${p2} → +1`);
      continue;
    }
    const { data: existing } = await supabase
      .from('partnerships').select('id_partnership, times_paired')
      .eq('id_tournament', TOURNAMENT).eq('id_category', CATEGORY)
      .eq('id_player1', p1).eq('id_player2', p2).maybeSingle();
    if (existing) {
      await supabase.from('partnerships').update({
        times_paired: existing.times_paired + 1, last_round_id: ROUND,
      }).eq('id_partnership', existing.id_partnership);
    } else {
      await supabase.from('partnerships').insert({
        id_tournament: TOURNAMENT, id_category: CATEGORY,
        id_player1: p1, id_player2: p2,
        times_paired: 1, last_round_id: ROUND,
      });
    }
  }

  // oppositions: 4 cross-pairs por match
  const pairsByMatch = [[dCM, dLS], [dC, dD]];
  for (const [da, db] of pairsByMatch) {
    const aPlayers = [da.id_player1, da.id_player2];
    const bPlayers = [db.id_player1, db.id_player2];
    for (const pa of aPlayers) {
      for (const pb of bPlayers) {
        const p1 = Math.min(pa, pb);
        const p2 = Math.max(pa, pb);
        const sa = playerById[pa]?.side;
        const sb = playerById[pb]?.side;
        const isDiagonal = sa && sb && sa === sb && sa !== 'EITHER';
        if (DRY) {
          console.log(`   opposition p1=${p1} p2=${p2} diag=${isDiagonal ? 1 : 0}`);
          continue;
        }
        const { data: existing } = await supabase
          .from('oppositions').select('id_opposition, times_opposed, diagonal_count')
          .eq('id_tournament', TOURNAMENT).eq('id_category', CATEGORY)
          .eq('id_player1', p1).eq('id_player2', p2).maybeSingle();
        if (existing) {
          await supabase.from('oppositions').update({
            times_opposed: existing.times_opposed + 1,
            diagonal_count: existing.diagonal_count + (isDiagonal ? 1 : 0),
            last_round_id: ROUND,
          }).eq('id_opposition', existing.id_opposition);
        } else {
          await supabase.from('oppositions').insert({
            id_tournament: TOURNAMENT, id_category: CATEGORY,
            id_player1: p1, id_player2: p2,
            times_opposed: 1, diagonal_count: isDiagonal ? 1 : 0,
            last_round_id: ROUND,
          });
        }
      }
    }
  }

  console.log('\n✅ Concluído.');
  if (DRY) console.log('💡 Rode com CONFIRM_EXECUTE=yes pra aplicar de verdade.');
}

main().catch(e => { console.error('ERRO:', e); process.exit(1); });
