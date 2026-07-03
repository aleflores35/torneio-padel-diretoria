// Diagnóstico: por que Mariele não apareceu como substituta da Paola Brendler
// (dupla Paola Brendler / Catiane). Read-only.
// Roda: node scripts/investigacao/diag_mariele_substituta.js  (cwd = backend/)
const supabase = require('../../supabase');

function sidesCompatible(a, b) {
  if (a === 'EITHER' || b === 'EITHER') return true;
  return a !== b;
}

async function findPlayer(like) {
  const { data } = await supabase
    .from('players')
    .select('id_player, name, side, category_id, id_tournament')
    .ilike('name', like);
  return data || [];
}

async function main() {
  const paolas = await findPlayer('%paola%brendler%');
  const catianes = await findPlayer('%catiane%');
  const marieles = await findPlayer('%mariele%');

  console.log('=== Paola(s) ==='); console.table(paolas);
  console.log('=== Catiane(s) ==='); console.table(catianes);
  console.log('=== Mariele(s) ==='); console.table(marieles);

  const paola = paolas[0];
  if (!paola) { console.log('Paola não encontrada'); return; }

  // Acha a dupla da Paola com a Catiane na rodada mais recente CONFIRMED/AWAITING
  const { data: dbls } = await supabase
    .from('doubles')
    .select('id_double, id_round, id_player1, id_player2, display_name')
    .or(`id_player1.eq.${paola.id_player},id_player2.eq.${paola.id_player}`);
  console.log('\n=== Duplas da Paola ===');
  console.table((dbls || []).map(d => ({ id_double: d.id_double, id_round: d.id_round, dupla: d.display_name })));

  // pega a dupla cujo display_name menciona Catiane
  const dupla = (dbls || []).find(d => /catiane/i.test(d.display_name || '')) || (dbls || [])[(dbls||[]).length-1];
  if (!dupla) { console.log('Dupla Paola/Catiane não encontrada'); return; }
  console.log('\n=== Dupla-alvo ===', dupla.display_name, '| id_round=', dupla.id_round);

  const partnerId = dupla.id_player1 === paola.id_player ? dupla.id_player2 : dupla.id_player1;
  const { data: partnerArr } = await supabase.from('players').select('id_player, name, side, category_id, id_tournament').eq('id_player', partnerId);
  const partner = partnerArr[0];
  console.log('Parceiro (fica) =', partner.name, '| side =', partner.side);

  const { data: round } = await supabase.from('rounds').select('*').eq('id_round', dupla.id_round).single();
  console.log('Rodada:', { id_round: round.id_round, status: round.status, data: round.scheduled_date, cat: round.id_category });

  // Mariele candidata?
  const mariele = marieles[0];
  if (!mariele) { console.log('\nMariele não encontrada no banco!'); return; }

  console.log('\n================ CHECAGEM DOS FILTROS PARA MARIELE ================');
  // Filtro categoria
  const catOk = mariele.category_id === round.id_category && mariele.id_tournament === round.id_tournament;
  console.log(`1) Mesma categoria/torneio? cat Mariele=${mariele.category_id} vs rodada=${round.id_category}; torneio M=${mariele.id_tournament} vs ${round.id_tournament} -> ${catOk ? 'OK' : 'FALHOU (some da lista)'}`);

  // Filtro busy
  const { data: roundDoubles } = await supabase.from('doubles').select('id_player1, id_player2, display_name').eq('id_round', round.id_round);
  const busy = new Set();
  (roundDoubles || []).forEach(d => { busy.add(d.id_player1); busy.add(d.id_player2); });
  const isBusy = busy.has(mariele.id_player);
  console.log(`2) Já está em dupla nesta rodada (busy)? ${isBusy ? 'SIM (some da lista)' : 'não'}`);
  if (isBusy) {
    const dd = (roundDoubles||[]).find(d => d.id_player1===mariele.id_player||d.id_player2===mariele.id_player);
    console.log(`   -> está na dupla: ${dd?.display_name}`);
  }

  // Filtro side
  const sideOk = sidesCompatible(mariele.side, partner.side);
  console.log(`3) Lado compatível com parceiro? Mariele.side=${mariele.side} vs ${partner.name}.side=${partner.side} -> ${sideOk ? 'OK' : 'INCOMPATÍVEL (some da lista)'}`);

  console.log('\n>>> Mariele apareceria na lista?', (catOk && !isBusy && sideOk) ? 'SIM' : 'NÃO');

  // Regra "já jogaram juntas" (NÃO esconde — só ordena pro fim). Verifica mesmo assim:
  const { data: catRounds } = await supabase.from('rounds').select('id_round')
    .eq('id_tournament', round.id_tournament).eq('id_category', round.id_category)
    .in('status', ['CONFIRMED', 'FINISHED']);
  const rIds = (catRounds || []).map(r => r.id_round);
  let jogaramJuntas = false;
  if (rIds.length) {
    const { data: pd } = await supabase.from('doubles').select('id_player1,id_player2,id_round')
      .in('id_round', rIds).or(`id_player1.eq.${partnerId},id_player2.eq.${partnerId}`);
    jogaramJuntas = (pd || []).some(d => d.id_player1 === mariele.id_player || d.id_player2 === mariele.id_player);
  }
  console.log(`(extra) Mariele já jogou em dupla REAL com ${partner.name}? ${jogaramJuntas ? 'SIM' : 'NÃO'} — (essa regra só joga pro fim da lista, não esconde)`);

  // Mostra a lista REAL de candidatos que o sistema geraria
  const { data: catPlayers } = await supabase.from('players')
    .select('id_player, name, side, category_id')
    .eq('id_tournament', round.id_tournament).eq('category_id', round.id_category);
  const lista = (catPlayers || [])
    .filter(p => p.id_player !== paola.id_player)
    .filter(p => !busy.has(p.id_player))
    .filter(p => sidesCompatible(p.side, partner.side))
    .map(p => ({ nome: p.name, side: p.side }));
  console.log('\n=== Lista de candidatos que o sistema mostra (filtro real) ===');
  console.table(lista);

  // E quem foi excluído por lado:
  const excluidosPorLado = (catPlayers || [])
    .filter(p => p.id_player !== paola.id_player)
    .filter(p => !busy.has(p.id_player))
    .filter(p => !sidesCompatible(p.side, partner.side))
    .map(p => ({ nome: p.name, side: p.side }));
  console.log('\n=== Excluídos SÓ por lado incompatível ===');
  console.table(excluidosPorLado);
}

main().catch(e => { console.error(e); process.exit(1); });