const supabase = require('./supabase');

const createUser = async () => {
  const email = 'marciovipveiculos@gmail.com';
  const password = '220275';

  console.log(`Criando usuário ADMIN: ${email}...`);

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role: 'ADMIN', name: 'Marcio Ferreira' }
  });

  if (error) {
    console.error("Erro ao criar usuário:", error.message);
    return;
  }

  console.log("Usuário criado — ID:", data.user.id);

  const { error: profileError } = await supabase
    .from('profiles')
    .update({ role: 'ADMIN' })
    .eq('id', data.user.id);

  if (profileError) {
    console.error("Erro ao atualizar perfil:", profileError.message);
  } else {
    console.log("Perfil ADMIN ativado para Marcio Ferreira.");
  }
};

createUser();
