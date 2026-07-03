// READ-ONLY: verifica contas no Supabase Auth + tabela profiles (roles).
const supabase = require('../../supabase');
(async () => {
  if (!supabase) { console.error('SEM supabase'); process.exit(1); }

  // 1) profiles table existe? quais roles?
  console.log('=== tabela profiles ===');
  const { data: profs, error: pErr } = await supabase.from('profiles').select('*');
  if (pErr) console.log('  profiles ERRO/inexistente:', pErr.message);
  else {
    console.log(`  ${profs.length} linhas`);
    profs.forEach(p => console.log('  ', JSON.stringify(p)));
  }

  // 2) usuarios no Supabase Auth (precisa service role)
  console.log('\n=== Supabase Auth (auth.users) ===');
  try {
    const { data, error } = await supabase.auth.admin.listUsers();
    if (error) { console.log('  listUsers ERRO:', error.message); }
    else {
      console.log(`  ${data.users.length} usuarios`);
      data.users.forEach(u => console.log(`   ${u.email} | id ${u.id} | role_meta ${u.user_metadata?.role || '-'} | confirmed ${!!u.email_confirmed_at}`));
    }
  } catch (e) { console.log('  listUsers exception:', e.message); }
  process.exit(0);
})();
