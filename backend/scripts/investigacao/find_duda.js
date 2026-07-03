const supabase = require('../../supabase');
async function run() {
  const { data: all } = await supabase
    .from('players')
    .select('id_player, name, category_id, id_tournament')
    .or('name.ilike.%uda%,name.ilike.%rownie%,name.ilike.%Eduarda%');
  console.log('Candidatas a Duda:');
  for (const p of all || []) console.log(`  id=${p.id_player} cat=${p.category_id} tour=${p.id_tournament}  ${p.name}`);
}
run().catch(e => { console.error(e); process.exit(1); });
