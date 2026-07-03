// Diagnóstico round 408 (Paola/Catiane) — por que Mariele não apareceu. Read-only.
const supabase = require('../../supabase');
function sidesCompatible(a, b) { if (a === 'EITHER' || b === 'EITHER') return true; return a !== b; }

async function main() {
  const ROUND = 408;
  const PAOLA = 692, CATIANE = 704, MARIELE = 707;

  const { data: round } = await supabase.from('rounds').select('*').eq('id_round', ROUND).single();
  console.log('Rodada:', { id_round: round.id_round, status: round.status, data: round.scheduled_date, cat: round.id_category, torneio: round.id_tournament, tipo: round.round_type });

  // Duplas da rodada 408
  const { data: roundDoubles } = await supabase.from('doubles')
    .select('id_double, id_player1, id_player2, display_name').eq('id_round', ROUND);
  console.log('\n=== Duplas da rodada 408 ===');
  console.table((roundDoubles||[]).map(d => ({ id_double: d.id_double, p1: d.id_player1, p2: d.id_player2, dupla: d.display_name })));

  const busy = new Set();
  (roundDoubles||[]).forEach(d => { busy.add(d.id_player1); busy.add(d.id_player2); });

  // Mariele está ocupada?
  console.log('\nMariele(707) está em alguma dupla da rodada 408 (busy)?', busy.has(MARIELE) ? 'SIM' : 'não');
  if (busy.has(MARIELE)) {
    const dd = (roundDoubles||[]).find(d => d.id_player1===MARIELE||d.id_player2===MARIELE);
    console.log('  -> dupla da Mariele nesta rodada:', dd.display_name, '(id_double', dd.id_double + ')');
  }

  // attendance da Mariele nesta rodada
  const { data: att } = await supabase.from('round_attendance').select('id_player, status, notes').eq('id_round', ROUND).eq('id_player', MARIELE);
  console.log('Attendance Mariele round 408:', att);

  // Reproduz getSubstituteCandidates(match da Paola/Catiane na 408, out=Paola)
  const partnerId = CATIANE;
  const { data: partnerArr } = await supabase.from('players').select('id_player,name,side').eq('id_player', partnerId);
  const partner = partnerArr[0];

  const { data: catPlayers } = await supabase.from('players')
    .select('id_player, name, side, category_id')
    .eq('id_tournament', round.id_tournament).eq('category_id', round.id_category);

  const lista = (catPlayers||[])
    .filter(p => p.id_player !== PAOLA)
    .filter(p => !busy.has(p.id_player))
    .filter(p => sidesCompatible(p.side, partner.side))
    .map(p => ({ id: p.id_player, nome: p.name, side: p.side }));
  console.log('\n=== Candidatos que o sistema mostra na rodada 408 ===');
  console.table(lista);

  const marieleNaLista = lista.some(p => p.id === MARIELE);
  console.log('Mariele aparece?', marieleNaLista ? 'SIM' : 'NÃO');

  // Por que não? mostra cada filtro
  const m = (catPlayers||[]).find(p => p.id_player===MARIELE);
  if (m) {
    console.log('\n--- Filtros Mariele na 408 ---');
    console.log('categoria/torneio OK?', m.category_id===round.id_category);
    console.log('busy?', busy.has(MARIELE));
    console.log('side compat?', sidesCompatible(m.side, partner.side), `(M=${m.side} vs Catiane=${partner.side})`);
  } else {
    console.log('Mariele NÃO está na categoria 3 do torneio 7?!');
  }
}
main().catch(e => { console.error(e); process.exit(1); });
