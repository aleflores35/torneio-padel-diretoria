// READ-ONLY — audita a tabela partnerships: marca cada parceria como REAL
// (existe double numa rodada CONFIRMED/FINISHED com os 2 juntos) ou FANTASMA.
const supabase = require('../../supabase');

async function main() {
  const { data: parts } = await supabase.from('partnerships')
    .select('id_partnership, id_tournament, id_category, id_player1, id_player2, times_paired, last_round_id');
  const { data: players } = await supabase.from('players').select('id_player, name, category_id');
  const nameOf = {}; (players || []).forEach(p => nameOf[p.id_player] = p.name);

  // rodadas reais (CONFIRMED/FINISHED) por categoria
  const { data: rounds } = await supabase.from('rounds')
    .select('id_round, id_category, status');
  const realRoundIds = new Set((rounds || []).filter(r => ['CONFIRMED', 'FINISHED'].includes(r.status)).map(r => r.id_round));

  // doubles reais → set de pares "min-max"
  const { data: doubles } = await supabase.from('doubles')
    .select('id_player1, id_player2, id_round');
  const realPairs = new Set();
  (doubles || []).forEach(d => {
    if (!realRoundIds.has(d.id_round)) return;
    if (!d.id_player1 || !d.id_player2) return;
    realPairs.add(`${Math.min(d.id_player1, d.id_player2)}-${Math.max(d.id_player1, d.id_player2)}`);
  });

  const rows = (parts || []).map(p => {
    const key = `${Math.min(p.id_player1, p.id_player2)}-${Math.max(p.id_player1, p.id_player2)}`;
    const real = realPairs.has(key);
    return {
      id: p.id_partnership, cat: p.id_category,
      dupla: `${nameOf[p.id_player1] || p.id_player1} + ${nameOf[p.id_player2] || p.id_player2}`,
      times_paired: p.times_paired, last_round: p.last_round_id,
      veredito: real ? 'REAL' : 'FANTASMA',
    };
  });

  console.log(`\n— Total partnerships: ${rows.length}`);
  const fantasmas = rows.filter(r => r.veredito === 'FANTASMA');
  console.log(`— REAIS: ${rows.length - fantasmas.length}  ·  FANTASMAS: ${fantasmas.length}\n`);
  console.log('=== FANTASMAS (partnership sem jogo real) ===');
  console.table(fantasmas.sort((a, b) => a.cat - b.cat || a.id - b.id));
}
main().catch(e => { console.error('ERRO:', e); process.exit(1); });
