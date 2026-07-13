// READ-ONLY: schema + amostra de partnerships/oppositions p/ montar o revert do expurgo.
const supabase = require('../../supabase');
const T = 7;
(async () => {
  const { data: parts } = await supabase.from('partnerships').select('*').eq('id_tournament', T).limit(3);
  console.log('[partnerships] colunas:', Object.keys(parts[0]||{}).join(', '));
  console.log('[partnerships] amostra:', JSON.stringify(parts, null, 1));
  const { data: opps } = await supabase.from('oppositions').select('*').eq('id_tournament', T).limit(3);
  console.log('\n[oppositions] colunas:', Object.keys(opps[0]||{}).join(', '));
  console.log('[oppositions] amostra:', JSON.stringify(opps, null, 1));

  // rows envolvendo Alisson (670)
  const A = 670;
  const { data: pAll } = await supabase.from('partnerships').select('*').eq('id_tournament', T);
  const pA = pAll.filter(r => Object.values(r).includes(A));
  console.log(`\n[partnerships c/ Alisson ${A}]: ${pA.length}`);
  pA.forEach(r=>console.log('  ', JSON.stringify(r)));
  const { data: oAll } = await supabase.from('oppositions').select('*').eq('id_tournament', T);
  const oA = oAll.filter(r => Object.values(r).includes(A));
  console.log(`\n[oppositions c/ Alisson ${A}]: ${oA.length}`);
  oA.slice(0,6).forEach(r=>console.log('  ', JSON.stringify(r)));
  console.log(`  ... (total ${oA.length})`);
  process.exit(0);
})();
