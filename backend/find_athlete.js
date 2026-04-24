// Busca atletas por email OU nome parcial (case-insensitive).
// Uso: SEARCH=cstelder node find_athlete.js

const supabase = require('./supabase');

async function find() {
  const search = process.env.SEARCH;
  if (!search) { console.error('Use SEARCH=termo'); process.exit(1); }

  const { data, error } = await supabase
    .from('players')
    .select('id_player, name, email, whatsapp, category_id')
    .or(`email.ilike.%${search}%,name.ilike.%${search}%`);

  if (error) { console.error(error); process.exit(1); }
  if (!data || data.length === 0) { console.log('Nenhum atleta encontrado'); return; }

  console.log(`Encontrados ${data.length}:`);
  for (const p of data) {
    console.log(`  - id=${p.id_player} · ${p.name} · ${p.email || 'sem email'} · whatsapp=${p.whatsapp || 'sem'}`);
  }
}

find().catch((e) => { console.error(e); process.exit(1); });
