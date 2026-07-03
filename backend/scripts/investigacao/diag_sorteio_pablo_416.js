// Read-only: o sorteio de 18/06 (round 416) repetiu parceiro/adversário do Pablo Mallmann (686)?
// Pablo no WhatsApp: "já joguei com o Delia e contra o Ivan". Sorteio novo: Delia+Pablo × Gabriel+Ivan.
// Rodar: node scripts/investigacao/diag_sorteio_pablo_416.js
const supabase = require('../../supabase');

const PABLO = 686, DELIA = 675, IVAN = 685, GABRIEL = 680, ZANENGA = 677;
const NAME = { 686: 'Pablo Mallmann', 675: 'Marcio Delia', 685: 'Ivan Bartmann', 680: 'Gabriel Steindorf', 677: 'Cassius Zanenga' };

async function main() {
  // schema
  const { data: p1 } = await supabase.from('partnerships').select('*').limit(1);
  console.log('partnerships cols:', p1 && p1[0] ? Object.keys(p1[0]).join(', ') : '(vazio)');
  const { data: o1 } = await supabase.from('oppositions').select('*').limit(1);
  console.log('oppositions cols:', o1 && o1[0] ? Object.keys(o1[0]).join(', ') : '(vazio)');

  const lo = Math.min, hi = Math.max;
  // PARCERIAS do Pablo (quem já foi dupla dele)
  console.log('\n=== PARCERIAS do Pablo (686) ===');
  const { data: parts } = await supabase.from('partnerships').select('*')
    .or(`id_player1.eq.${PABLO},id_player2.eq.${PABLO}`);
  for (const p of (parts || [])) {
    const other = p.id_player1 === PABLO ? p.id_player2 : p.id_player1;
    console.log(`  com ${NAME[other] || other}: times_paired=${p.times_paired} cat=${p.id_category} last_round=${p.last_round_id}`);
  }

  // OPOSIÇÕES do Pablo (quem já enfrentou)
  console.log('\n=== OPOSIÇÕES do Pablo (686) ===');
  const { data: opps } = await supabase.from('oppositions').select('*')
    .or(`id_player1.eq.${PABLO},id_player2.eq.${PABLO}`);
  for (const o of (opps || [])) {
    const other = o.id_player1 === PABLO ? o.id_player2 : o.id_player1;
    console.log(`  vs ${NAME[other] || other}: ${JSON.stringify(o)}`);
  }

  // foco: Pablo×Delia (parceria) e Pablo×Ivan / Pablo×Gabriel (oposição)
  console.log('\n=== FOCO no sorteio de 18/06 (Delia+Pablo × Gabriel+Ivan) ===');
  const pd = (parts || []).find(p => [p.id_player1, p.id_player2].includes(DELIA));
  console.log(`Pablo+Delia já foram dupla? ${pd ? 'SIM (times_paired=' + pd.times_paired + ', last_round=' + pd.last_round_id + ')' : 'NÃO (sem registro)'}`);
  const oi = (opps || []).find(o => [o.id_player1, o.id_player2].includes(IVAN));
  console.log(`Pablo já enfrentou Ivan? ${oi ? 'SIM (' + JSON.stringify(oi) + ')' : 'NÃO'}`);
  const og = (opps || []).find(o => [o.id_player1, o.id_player2].includes(GABRIEL));
  console.log(`Pablo já enfrentou Gabriel? ${og ? 'SIM (' + JSON.stringify(og) + ')' : 'NÃO'}`);
}
main().catch(e => { console.error(e); process.exit(1); });
