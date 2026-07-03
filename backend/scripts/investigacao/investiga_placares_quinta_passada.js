// Investigação: matches da rodada de quinta passada + admins ativos.
// Uso: node scripts/investigacao/investiga_placares_quinta_passada.js
//
// READ-ONLY — não atualiza nada.
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
const supabase = require('../../supabase');

async function listAdmins() {
  console.log('═══════════════════════════════════════════════════');
  console.log('1) ADMINS / SUPPORT no banco (auth + profiles)');
  console.log('═══════════════════════════════════════════════════');

  const { data: profiles, error: pErr } = await supabase
    .from('profiles')
    .select('id, email, full_name, role, created_at')
    .in('role', ['ADMIN', 'SUPPORT'])
    .order('created_at', { ascending: true });

  if (pErr) {
    console.log('  (profiles erro:', pErr.message, ')');
  } else if (!profiles?.length) {
    console.log('  Nenhum row em profiles com role ADMIN/SUPPORT.');
  } else {
    console.log(`  ${profiles.length} row(s) em profiles:`);
    for (const p of profiles) {
      console.log(`    [${p.role}] ${p.email}  (${p.full_name || '(s/ nome)'}, ${p.created_at})`);
    }
  }

  console.log('');
  console.log('  auth.users (todos):');
  const { data: authData, error: aErr } = await supabase.auth.admin.listUsers();
  if (aErr) {
    console.log('    erro:', aErr.message);
  } else {
    for (const u of authData?.users || []) {
      const role = u.user_metadata?.role || u.app_metadata?.role || '';
      console.log(`    - ${u.email}  meta.role=${role || '(nenhum)'}  id=${u.id.slice(0, 8)}…`);
    }
  }
}

async function listLastRounds() {
  console.log('');
  console.log('═══════════════════════════════════════════════════');
  console.log('2) ÚLTIMAS RODADAS');
  console.log('═══════════════════════════════════════════════════');

  const { data: rounds, error } = await supabase
    .from('rounds')
    .select('id_round, round_number, scheduled_date, status, id_category')
    .order('scheduled_date', { ascending: false })
    .limit(5);

  if (error) {
    console.log('  erro:', error.message);
    return [];
  }

  for (const r of rounds || []) {
    console.log(`  • round ${r.round_number}  ${r.scheduled_date}  status=${r.status}  id=${r.id_round}  cat=${r.id_category}`);
  }
  return rounds || [];
}

async function dumpRoundMatches(idRound, label) {
  console.log('');
  console.log('═══════════════════════════════════════════════════');
  console.log(`3) MATCHES da round id=${idRound}  (${label})`);
  console.log('═══════════════════════════════════════════════════');

  // Doubles desta round
  const { data: doubles, error: dErr } = await supabase
    .from('doubles')
    .select('id_double, id_player1, id_player2, display_name')
    .eq('id_round', idRound);

  if (dErr) { console.log('  doubles erro:', dErr.message); return; }

  const playerIds = new Set();
  for (const d of doubles || []) {
    if (d.id_player1) playerIds.add(d.id_player1);
    if (d.id_player2) playerIds.add(d.id_player2);
  }

  const { data: players } = await supabase
    .from('players')
    .select('id_player, name')
    .in('id_player', Array.from(playerIds));

  const playerName = new Map((players || []).map(p => [p.id_player, p.name]));
  const doubleLabel = new Map();
  for (const d of doubles || []) {
    const n1 = playerName.get(d.id_player1) || `?${d.id_player1}`;
    const n2 = playerName.get(d.id_player2) || `?${d.id_player2}`;
    doubleLabel.set(d.id_double, `${n1} / ${n2}`);
  }

  // Matches desta round (via doubles)
  const doubleIds = (doubles || []).map(d => d.id_double);
  if (!doubleIds.length) { console.log('  (sem duplas nessa round)'); return; }

  const { data: matches, error: mErr } = await supabase
    .from('matches')
    .select('id_match, id_double_a, id_double_b, status, games_double_a, games_double_b, scheduled_at, id_court')
    .or(`id_double_a.in.(${doubleIds.join(',')}),id_double_b.in.(${doubleIds.join(',')})`)
    .order('id_match', { ascending: true });

  if (mErr) { console.log('  matches erro:', mErr.message); return; }

  console.log(`  ${matches?.length || 0} match(es):`);
  console.log('');
  for (const m of matches || []) {
    const a = doubleLabel.get(m.id_double_a) || `dupla?${m.id_double_a}`;
    const b = doubleLabel.get(m.id_double_b) || `dupla?${m.id_double_b}`;
    const placar = `${m.games_double_a ?? 0} x ${m.games_double_b ?? 0}`;
    const flag = (m.games_double_a == null || m.games_double_b == null || (m.games_double_a === 0 && m.games_double_b === 0))
      ? '⚠️  SEM PLACAR'
      : '✓';
    console.log(`    [#${m.id_match}] ${flag}  ${a}  ${placar}  ${b}   status=${m.status}`);
  }
}

(async () => {
  try {
    await listAdmins();
    const rounds = await listLastRounds();
    if (rounds.length) {
      // Quinta passada = todas as rounds da data mais recente
      const mostRecent = rounds[0].scheduled_date;
      const targets = rounds.filter(r => r.scheduled_date === mostRecent);
      for (const t of targets) {
        await dumpRoundMatches(t.id_round, `round ${t.round_number} / ${t.scheduled_date} / cat=${t.id_category} / ${t.status}`);
      }
    }
    console.log('');
    console.log('Fim.');
  } catch (err) {
    console.error('❌ erro:', err);
    process.exit(1);
  }
})();
