// READ-ONLY: quantos/quais jogadores inativos existem (que hoje vazam pro ranking).
const supabase = require('../../supabase');
const ID_T = 7;
const CATN = { 1: 'Masc.Inic', 2: 'Masc.4ª', 3: 'Feminino' };
async function run() {
  const { data: players } = await supabase.from('players')
    .select('id_player, name, side, category_id, active').eq('id_tournament', ID_T);
  const inativos = players.filter(p => !p.active);
  console.log(`Total jogadores: ${players.length} · ativos: ${players.filter(p=>p.active).length} · INATIVOS: ${inativos.length}\n`);
  console.log('Inativos (hoje aparecem no ranking por causa do bug):');
  inativos.sort((a,b)=>a.category_id-b.category_id).forEach(p =>
    console.log(`  ${p.id_player} ${p.name.padEnd(24)} ${CATN[p.category_id]||('cat'+p.category_id)} ${p.side}`));
}
run().catch(e => { console.error(e.message || e); process.exit(1); });
