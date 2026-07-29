// Troca a senha de UMA conta admin no Supabase Auth. Mantém o role.
// A senha NUNCA é hardcoded aqui — vem por env var (não entra no git, não fica no arquivo).
// DRY:  EMAIL=x@y.com NEW_PW='...' node scripts/investigacao/_troca_senha_admin.js
// REAL: EMAIL=x@y.com NEW_PW='...' CONFIRM_EXECUTE=yes node scripts/investigacao/_troca_senha_admin.js
const supabase = require('../../supabase');
const CONFIRM = process.env.CONFIRM_EXECUTE === 'yes';
const EMAIL = process.env.EMAIL || '';
const NEW_PW = process.env.NEW_PW || '';

(async () => {
  if (!supabase) { console.error('SEM supabase'); process.exit(1); }
  if (!EMAIL || !NEW_PW) { console.error('use EMAIL=<email> NEW_PW=<senha>'); process.exit(1); }
  if (NEW_PW.length < 6) { console.error('senha curta demais (Supabase exige >=6)'); process.exit(1); }

  const { data: list, error: eL } = await supabase.auth.admin.listUsers();
  if (eL) { console.error('ERRO listUsers:', eL.message); process.exit(1); }
  const u = (list?.users || []).find(x => x.email?.toLowerCase() === EMAIL.toLowerCase());
  if (!u) { console.error(`conta ${EMAIL} NAO existe no Supabase Auth — ABORTA`); process.exit(1); }

  const { data: prof } = await supabase.from('profiles').select('role').eq('id', u.id);
  const role = (prof || [])[0]?.role || u.user_metadata?.role || '(sem role)';
  console.log(`conta: ${EMAIL} (id ${u.id}) | role ${role}`);
  console.log(`senha nova: ${NEW_PW.length} chars, começa com "${NEW_PW.slice(0, 2)}…" (não ecoada por inteiro)`);

  if (!CONFIRM) { console.log('\n>>> DRY-RUN: nada gravado. CONFIRM_EXECUTE=yes pra aplicar. <<<'); process.exit(0); }

  const { error } = await supabase.auth.admin.updateUserById(u.id, { password: NEW_PW });
  if (error) { console.error('ERRO update:', error.message); process.exit(1); }

  // assert: role preservado
  const { data: prof2 } = await supabase.from('profiles').select('role').eq('id', u.id);
  const role2 = (prof2 || [])[0]?.role;
  console.log(`\n✅ senha trocada. role segue: ${role2}${role2 === role ? ' (preservado)' : ' ⚠️ MUDOU'}`);
  process.exit(0);
})();
