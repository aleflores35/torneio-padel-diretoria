// READ-ONLY — investiga substituição de Francine Rossi (parceira Tanise Cezimbra)
// e o histórico de parcerias da Tanise na categoria feminina.
const supabase = require('../../supabase');

async function main() {
  const names = ['Francine Rossi', 'Tanise Cezimbra', 'Amanda Oestreich', 'Catiane', 'Daniela Herzog'];
  const found = {};
  for (const n of names) {
    const { data } = await supabase.from('players')
      .select('id_player, name, side, category_id, id_tournament').ilike('name', `%${n}%`);
    console.log(`${n}:`, JSON.stringify(data));
    (data || []).forEach(p => { found[p.id_player] = p; });
  }

  // categoria feminina (a da Tanise)
  const tanise = Object.values(found).find(p => /tanise/i.test(p.name));
  if (!tanise) { console.log('Tanise não encontrada'); return; }
  const catId = tanise.category_id;
  console.log(`\n— Categoria feminina id=${catId}`);

  // partnerships da categoria — todas
  const { data: parts } = await supabase.from('partnerships')
    .select('id_partnership, id_player1, id_player2, times_paired, last_round_id')
    .eq('id_category', catId);
  const { data: catPlayers } = await supabase.from('players')
    .select('id_player, name').eq('category_id', catId);
  const nameOf = {}; (catPlayers || []).forEach(p => nameOf[p.id_player] = p.name);

  console.log('\n— Parcerias envolvendo Tanise:');
  (parts || []).filter(p => p.id_player1 === tanise.id_player || p.id_player2 === tanise.id_player)
    .forEach(p => {
      const partner = p.id_player1 === tanise.id_player ? p.id_player2 : p.id_player1;
      console.log(`   Tanise × ${nameOf[partner] || '#'+partner}  — times_paired=${p.times_paired} last_round=${p.last_round_id}`);
    });

  console.log('\n— Todas as parcerias da categoria:');
  console.table((parts || []).map(p => ({
    p1: nameOf[p.id_player1] || p.id_player1,
    p2: nameOf[p.id_player2] || p.id_player2,
    times: p.times_paired, last_round: p.last_round_id
  })));
}
main().catch(e => { console.error('ERRO:', e); process.exit(1); });
