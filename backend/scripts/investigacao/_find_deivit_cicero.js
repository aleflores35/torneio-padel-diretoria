// READ-ONLY: node _find_deivit_cicero.js
// Busca atletas por nome (deivit / cicero) e imprime id, categoria, side, active, whatsapp.
const supabase = require('../../supabase');
const TID = 7;
const ALVOS = ['deivit', 'cicero', 'kommers'];
const catName = c => c===1?'Masc Inic':c===2?'Masc 4a':c===3?'Fem':'cat'+c;

(async () => {
  const { data: players, error } = await supabase.from('players').select('*').eq('id_tournament', TID);
  if (error) { console.error('ERRO', error); process.exit(1); }
  const hit = players.filter(p => ALVOS.some(a => (p.name||'').toLowerCase().includes(a)));
  if (!hit.length) { console.log('nenhum atleta bate com', ALVOS.join('/')); }
  hit.forEach(p => {
    console.log(`id ${p.id_player} | ${p.name} | ${catName(p.category_id)} | side ${p.side} | active ${p.active} | wpp ${p.whatsapp||'-'}`);
  });
  console.log(`\n(total de atletas no torneio ${TID}: ${players.length})`);
  process.exit(0);
})();
