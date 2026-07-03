// READ-ONLY. Sampleia 1 row + count de cada tabela relevante p/ a auditoria,
// pra confirmar nomes de colunas antes de escrever as validações.
const supabase = require('../../supabase');
const TABLES = ['categories', 'players', 'rounds', 'doubles', 'matches', 'courts',
  'oppositions', 'partnerships', 'player_absences', 'round_attendance'];

async function main() {
  if (!supabase) { console.error('Supabase NÃO configurado.'); process.exit(1); }
  for (const t of TABLES) {
    const { data, error, count } = await supabase.from(t).select('*', { count: 'exact' }).limit(1);
    if (error) { console.log(`\n### ${t}: ERRO — ${error.message}`); continue; }
    console.log(`\n### ${t}  (count=${count})`);
    console.log('colunas:', data && data[0] ? Object.keys(data[0]).join(', ') : '(vazia)');
    if (data && data[0]) console.log('sample:', JSON.stringify(data[0]));
  }
}
main().catch(e => { console.error(e); process.exit(1); });
