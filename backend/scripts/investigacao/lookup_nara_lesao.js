// Busca alternativa pros 2 que não bateram no lookup principal.
const supabase = require('../../supabase');

async function search(label, q, col = 'name') {
  const { data } = await supabase.from('players').select('id_player, name, whatsapp, category_id').ilike(col, `%${q}%`);
  console.log(`\n[${label}] ilike ${col} %${q}% →`, data && data.length ? '' : 'nenhum');
  (data || []).forEach(p => console.log(`   id=${p.id_player} "${p.name}" (${p.whatsapp}) cat=${p.category_id}`));
}

async function run() {
  // Nara — tentar variações
  await search('Nara — name nara',  'nara');
  await search('Nara — name elenara','elenara');
  await search('Nara — name nunes', 'nunes');
  await search('Nara — phone 51996354374', '996354374', 'whatsapp');
  await search('Nara — phone 9635-4374',   '9635', 'whatsapp');

  // Lesão — tentar variações
  await search('Lesão — phone 51998177573', '998177573', 'whatsapp');
  await search('Lesão — phone 9817-7573',   '9817', 'whatsapp');
  await search('Lesão — phone 81775',       '81775', 'whatsapp');
}

run().catch(e => { console.error(e); process.exit(1); });
