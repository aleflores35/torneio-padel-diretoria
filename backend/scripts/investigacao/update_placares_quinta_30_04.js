// UPDATE placares confirmados pelo Alessandro (sessão 02/05).
// Round 3 / 30-04-2026 — categoria 1.
// Match #1257: Flavio/Francisco 9 x 6 Andre/Nicolas (origem: print +55 51 9601-8572)
// Match #1258: William/Luis  9 x 3 Lucas/Rodrigo  (origem: print William Ellwanger)
//
// Uso: node scripts/investigacao/update_placares_quinta_30_04.js
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
const supabase = require('../../supabase');

const updates = [
  { id_match: 1257, games_double_a: 9, games_double_b: 6, label: 'Flavio/Francisco 9 x 6 Andre/Nicolas' },
  { id_match: 1258, games_double_a: 9, games_double_b: 3, label: 'William/Luis 9 x 3 Lucas/Rodrigo' }
];

(async () => {
  for (const u of updates) {
    // Lê before
    const { data: before, error: bErr } = await supabase
      .from('matches')
      .select('id_match, games_double_a, games_double_b, status')
      .eq('id_match', u.id_match)
      .single();

    if (bErr) { console.log(`❌ #${u.id_match} read:`, bErr.message); continue; }
    console.log(`#${u.id_match} antes: ${before.games_double_a} x ${before.games_double_b} status=${before.status}`);

    const { error: uErr } = await supabase
      .from('matches')
      .update({
        games_double_a: u.games_double_a,
        games_double_b: u.games_double_b,
        status: 'FINISHED'
      })
      .eq('id_match', u.id_match);

    if (uErr) { console.log(`❌ #${u.id_match} update:`, uErr.message); continue; }

    const { data: after } = await supabase
      .from('matches')
      .select('games_double_a, games_double_b, status')
      .eq('id_match', u.id_match)
      .single();

    console.log(`#${u.id_match} depois: ${after.games_double_a} x ${after.games_double_b} status=${after.status}  → ${u.label}`);
    console.log('');
  }
  console.log('Fim.');
})().catch(e => { console.error('❌', e); process.exit(1); });
