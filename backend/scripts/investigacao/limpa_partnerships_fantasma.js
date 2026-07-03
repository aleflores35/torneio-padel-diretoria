// Remove partnerships fantasma: registros sem nenhuma dupla real (double em
// rodada CONFIRMED/FINISHED). Recomputa o veredito na hora — não usa lista fixa.
// Guard: CONFIRM_EXECUTE=yes
const supabase = require('../../supabase');

const DRY = process.env.CONFIRM_EXECUTE !== 'yes';

async function main() {
  console.log(`MODE: ${DRY ? 'DRY' : '⚠️  EXECUTANDO'}\n`);

  const { data: parts } = await supabase.from('partnerships')
    .select('id_partnership, id_category, id_player1, id_player2, last_round_id');
  const { data: rounds } = await supabase.from('rounds').select('id_round, status');
  const realRoundIds = new Set((rounds || [])
    .filter(r => ['CONFIRMED', 'FINISHED'].includes(r.status)).map(r => r.id_round));
  const { data: doubles } = await supabase.from('doubles').select('id_player1, id_player2, id_round');
  const realPairs = new Set();
  (doubles || []).forEach(d => {
    if (!realRoundIds.has(d.id_round) || !d.id_player1 || !d.id_player2) return;
    realPairs.add(`${Math.min(d.id_player1, d.id_player2)}-${Math.max(d.id_player1, d.id_player2)}`);
  });

  const fantasmas = (parts || []).filter(p => {
    const key = `${Math.min(p.id_player1, p.id_player2)}-${Math.max(p.id_player1, p.id_player2)}`;
    return !realPairs.has(key);
  });

  // salvaguarda: toda fantasma esperada tem last_round_id null — aborta se não bater
  const comLastRound = fantasmas.filter(f => f.last_round_id != null);
  console.log(`Total partnerships: ${parts.length}  ·  fantasmas detectadas: ${fantasmas.length}`);
  if (comLastRound.length) {
    console.log(`⚠️  ${comLastRound.length} fantasma(s) com last_round preenchido — revisar antes:`,
      JSON.stringify(comLastRound));
    console.log('Abortando por segurança.');
    return;
  }
  console.log('Todas as fantasmas têm last_round vazio (padrão de seed). OK.\n');
  const ids = fantasmas.map(f => f.id_partnership);
  console.log(`IDs a remover (${ids.length}):`, ids.join(', '));

  if (!DRY) {
    const { error } = await supabase.from('partnerships').delete().in('id_partnership', ids);
    if (error) throw error;
    const { count } = await supabase.from('partnerships').select('*', { count: 'exact', head: true });
    console.log(`\n✅ ${ids.length} fantasmas removidas. Partnerships restantes: ${count}`);
  } else {
    console.log('\n💡 Rode com CONFIRM_EXECUTE=yes pra aplicar.');
  }
}
main().catch(e => { console.error('ERRO:', e); process.exit(1); });
