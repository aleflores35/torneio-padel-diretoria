// Revoga o acesso admin do Marcio Ferreira no Supabase auth.
//
// Contexto: em 23/04/2026, o usuário marciovipveiculos@gmail.com foi
// adicionado como ADMIN no Supabase via script create_marcio_user.js
// sem autorização explícita do Alessandro. O admin hardcoded no
// frontend (LoginPage.tsx) foi removido no commit subsequente.
// Este script finaliza a remoção removendo o usuário de auth.users.
//
// Efeito: Marcio perde acesso admin ao sistema. Continua como atleta
// normal (tabela `players` intacta — rows de auth.users e players são
// independentes no schema).
//
// Uso: node revoke_marcio_admin.js

const supabase = require('./supabase');

const TARGET_EMAIL = 'marciovipveiculos@gmail.com';

async function revokeMarcio() {
  console.log(`Buscando usuário ${TARGET_EMAIL} em auth.users...`);

  const { data, error } = await supabase.auth.admin.listUsers();
  if (error) {
    console.error('❌ Erro ao listar usuários:', error.message);
    process.exit(1);
  }

  const user = data?.users?.find((u) => u.email === TARGET_EMAIL);

  if (!user) {
    console.log(`✅ ${TARGET_EMAIL} não existe em auth.users — nada a fazer.`);
    return;
  }

  console.log(
    `Encontrado: id=${user.id}, role_metadata=${user.user_metadata?.role || 'N/A'}`
  );

  const confirm = process.env.CONFIRM_DELETE === 'yes';
  if (!confirm) {
    console.log('');
    console.log('⚠️  Pra executar a deleção, rode com:');
    console.log('    CONFIRM_DELETE=yes node revoke_marcio_admin.js');
    console.log('');
    console.log('Por segurança, este script não deleta sem confirmação explícita.');
    return;
  }

  console.log('Deletando de auth.users...');
  const { error: delError } = await supabase.auth.admin.deleteUser(user.id);
  if (delError) {
    console.error('❌ Erro ao deletar:', delError.message);
    process.exit(1);
  }

  console.log('✅ Marcio removido de auth.users.');
  console.log('   Continua como atleta normal (tabela players intacta).');
  console.log('   Admin hardcoded do frontend já foi removido em commit anterior.');
}

revokeMarcio().catch((err) => {
  console.error('❌ Falha:', err);
  process.exit(1);
});
