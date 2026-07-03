/**
 * Detalhe do match 1287 — causa da assimetria de saldo na Cat1
 * READ-ONLY
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const supabase = require('../../supabase');

async function main() {
  const { data: m } = await supabase.from('matches').select('*').eq('id_match', 1287).single();
  console.log('Match 1287:', JSON.stringify(m, null, 2));

  const { data: dA } = await supabase.from('doubles').select('*').eq('id_double', m.id_double_a).single();
  const { data: dB } = await supabase.from('doubles').select('*').eq('id_double', m.id_double_b).single();
  console.log('Double A:', JSON.stringify(dA, null, 2));
  console.log('Double B:', JSON.stringify(dB, null, 2));

  const pids = [dA.id_player1, dA.id_player2, dB.id_player1, dB.id_player2].filter(Boolean);
  const { data: pls } = await supabase.from('players').select('*').in('id_player', pids);
  console.log('Players:', pls.map(p => `${p.id_player}:${p.name}(active=${p.active})`).join(', '));

  // Verificar round
  const { data: r } = await supabase.from('rounds').select('*').eq('id_round', dA.id_round).single();
  console.log('Round:', JSON.stringify(r, null, 2));
}

main().catch(e => { console.error(e); process.exit(1); });
