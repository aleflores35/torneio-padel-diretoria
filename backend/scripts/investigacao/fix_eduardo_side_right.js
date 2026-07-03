// FIX guardado: Eduardo Horbach (679) side EITHER → RIGHT. Só aplica se ainda for EITHER.
const supabase = require('../../supabase');
const ID_T = 7, EDU = 679;

async function run() {
  const { data: rows, error } = await supabase.from('players')
    .select('id_player, name, side, category_id, id_tournament').eq('id_player', EDU);
  if (error) { console.error('read err:', error.message); process.exit(1); }
  const p = rows && rows[0];
  if (!p) { console.error('player não encontrado'); process.exit(1); }
  console.log(`antes: ${p.name} side=${p.side} cat=${p.category_id}`);
  if (p.id_tournament !== ID_T) { console.error('torneio inesperado, abortando'); process.exit(1); }
  if (p.side !== 'EITHER') { console.log(`⚠️  side já é ${p.side} — alguém mexeu. NADA feito.`); return; }

  const { error: upErr } = await supabase.from('players').update({ side: 'RIGHT' }).eq('id_player', EDU).eq('side', 'EITHER');
  if (upErr) { console.error('update err:', upErr.message); process.exit(1); }
  const { data: after } = await supabase.from('players').select('name, side').eq('id_player', EDU);
  console.log(`depois: ${after[0].name} side=${after[0].side}`);
  console.log('✓ OK');
}
run().catch(e => { console.error(e.message || e); process.exit(1); });
