// Verifica estado pos-pivo + registra ausencia da Tanise (02/07) + backup POS.
const supabase = require('../../supabase');
const fs = require('fs'); const path = require('path');
const TID = 7;
(async () => {
  if (!supabase) { console.error('SEM supabase'); process.exit(1); }
  const { data: rounds } = await supabase.from('rounds').select('*').eq('id_tournament', TID);
  const fut = rounds.filter(r => r.scheduled_date >= '2026-07-09');
  const { data: parts } = await supabase.from('partnerships').select('id_partnership').eq('id_tournament', TID);
  const { data: opps } = await supabase.from('oppositions').select('id_opposition').eq('id_tournament', TID);
  const { data: rd0207 } = await supabase.from('rounds').select('id_round').eq('id_tournament', TID).eq('scheduled_date','2026-07-02');

  console.log('=== VERIFICACAO POS-PIVO ===');
  console.log(`rounds totais: ${rounds.length} (esperado ~37)`);
  console.log(`rounds futuras >=09/07: ${fut.length} (esperado 0)`);
  console.log(`rounds de 02/07: ${rd0207.length} (esperado 3)`);
  console.log(`partnerships: ${parts.length} (esperado 190) | oppositions: ${opps.length} (esperado 331)`);

  // registra Tanise (694) ausente 02/07 se nao existir
  const { data: ex } = await supabase.from('player_absences').select('id')
    .eq('id_tournament', TID).eq('id_player', 694).eq('absence_date', '2026-07-02');
  if (ex && ex.length) {
    console.log('Tanise: ausencia 02/07 JA existia.');
  } else {
    const { error } = await supabase.from('player_absences').insert({
      id_tournament: TID, id_player: 694, absence_date: '2026-07-02',
      declared_at: new Date().toISOString()
    });
    console.log(error ? ('Tanise insert ERRO: '+error.message) : 'Tanise: ausencia 02/07 REGISTRADA.');
  }

  // backup POS
  const ts = new Date().toISOString().replace(/[:T]/g,'-').slice(0,19);
  const dir = path.join('C:/obralivre/clientes/parcerias/sociedade-rio-branco/ranking-srb-2026/backups', `POS_pivot_${ts}`);
  fs.mkdirSync(dir, { recursive: true });
  const { data: rounds2 } = await supabase.from('rounds').select('*').eq('id_tournament', TID);
  const rids = rounds2.map(r=>r.id_round);
  const { data: dbls } = await supabase.from('doubles').select('*').in('id_round', rids);
  const dids = dbls.map(d=>d.id_double);
  const { data: mts } = await supabase.from('matches').select('*').in('id_double_a', dids);
  const { data: p2 } = await supabase.from('partnerships').select('*').eq('id_tournament', TID);
  const { data: o2 } = await supabase.from('oppositions').select('*').eq('id_tournament', TID);
  const { data: a2 } = await supabase.from('player_absences').select('*').eq('id_tournament', TID);
  fs.writeFileSync(path.join(dir,'rounds.json'), JSON.stringify(rounds2,null,2));
  fs.writeFileSync(path.join(dir,'doubles.json'), JSON.stringify(dbls,null,2));
  fs.writeFileSync(path.join(dir,'matches.json'), JSON.stringify(mts,null,2));
  fs.writeFileSync(path.join(dir,'partnerships.json'), JSON.stringify(p2,null,2));
  fs.writeFileSync(path.join(dir,'oppositions.json'), JSON.stringify(o2,null,2));
  fs.writeFileSync(path.join(dir,'player_absences.json'), JSON.stringify(a2,null,2));
  console.log(`\nbackup POS salvo: ${dir} (matches=${mts.length})`);
  process.exit(0);
})();
