// Confere schema da tabela partnerships pra modelar oppositions com mesmo padrão.
const supabase = require('./supabase');

async function main() {
  const { data, error } = await supabase.from('partnerships').select('*').limit(1);
  if (error) { console.error(error); process.exit(1); }
  console.log('Sample row:', data && data[0]);

  // Tenta ver se existe tabela "oppositions" já
  const { error: opErr } = await supabase.from('oppositions').select('*').limit(1);
  console.log('Tabela oppositions existe?', opErr ? `NÃO (${opErr.message})` : 'SIM');
}
main().catch(e => { console.error(e); process.exit(1); });
