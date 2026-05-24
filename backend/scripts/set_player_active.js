// Script utilitario pra ativar/desativar atletas via flag `active`.
// Uso: ATLETA_ID=657 ACTIVE=false node backend/scripts/set_player_active.js
//      ATLETA_ID=657 ACTIVE=true  node backend/scripts/set_player_active.js
const supabase = require('../supabase');

(async () => {
  const id = parseInt(process.env.ATLETA_ID, 10);
  const active = String(process.env.ACTIVE || '').toLowerCase() === 'true';
  if (!id) { console.error('ATLETA_ID obrigatorio'); process.exit(1); }
  if (process.env.ACTIVE === undefined) { console.error('ACTIVE=true|false obrigatorio'); process.exit(1); }

  const { data: before, error: gErr } = await supabase
    .from('players').select('id_player, name, active').eq('id_player', id).single();
  if (gErr || !before) { console.error('atleta nao encontrado:', gErr?.message); process.exit(1); }
  console.log(`ANTES: id=${before.id_player} name="${before.name}" active=${before.active}`);

  const { error } = await supabase.from('players').update({ active }).eq('id_player', id);
  if (error) { console.error('erro update:', error.message); process.exit(1); }

  const { data: after } = await supabase
    .from('players').select('id_player, name, active').eq('id_player', id).single();
  console.log(`DEPOIS: id=${after.id_player} name="${after.name}" active=${after.active}`);
})();
