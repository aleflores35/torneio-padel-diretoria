// Substitui Alisson (670) no #1390 por melhor LEFT disponivel (mais atrasado + nao enfrentou
// o LEFT adversario Diego Schutz). Usa substitutionService (mesma logica do app).
const supabase = require('../../supabase');
const svc = require('../../services/substitutionService');
const CONFIRM = process.env.CONFIRM_EXECUTE === 'yes';
(async () => {
  // id do Diego Schutz
  const { data: ps } = await supabase.from('players').select('id_player,name,side').eq('id_tournament',7).eq('category_id',1);
  const schutz = ps.find(p=>p.name==='Diego Schutz');
  // candidatos (ordem de preferencia = mais atrasado primeiro, do que vimos)
  const pref = [667,660,661,663]; // Anderson, Gustavo Bock, Cicero, Francisco Neto
  // oppositions cat1 envolvendo schutz
  const { data: opps } = await supabase.from('oppositions').select('id_player1,id_player2').eq('id_tournament',7).eq('id_category',1);
  const facedSchutz = new Set();
  for (const o of opps) { if(o.id_player1===schutz.id_player) facedSchutz.add(o.id_player2); if(o.id_player2===schutz.id_player) facedSchutz.add(o.id_player1); }
  const chosen = pref.find(id=>!facedSchutz.has(id)) || pref[0];
  const nm = ps.find(p=>p.id_player===chosen)?.name;
  console.log(`Diego Schutz(${schutz.id_player}) ja enfrentou (mesma cat): ${[...facedSchutz].join(',')}`);
  console.log(`Substituto escolhido: ${nm} (${chosen}) ${facedSchutz.has(chosen)?'(JA enfrentou Schutz)':'(inedito vs Schutz)'}`);
  if (!CONFIRM) { console.log('DRY-RUN. CONFIRM_EXECUTE=yes pra aplicar.'); process.exit(0); }
  const r = await svc.substitutePlayer(1390, 670, chosen);
  console.log('Resultado substituicao:', JSON.stringify(r).slice(0,300));
  // mostra #1390 atualizado
  const { data: d } = await supabase.from('doubles').select('display_name,id_round').eq('id_round',432);
  process.exit(0);
})();
