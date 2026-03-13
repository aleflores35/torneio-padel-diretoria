const supabase = require('./supabase');

const createSupportUser = async () => {
  const email = 'alessandro.flores16@gmail.com';
  const password = 'Padelsuper@2026'; // Senha temporária recomendada

  console.log(`Criando usuário Suporte: ${email}...`);

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role: 'SUPPORT' }
  });

  if (error) {
    console.error("Erro ao criar usuário:", error.message);
  } else {
    console.log("Usuário criado com sucesso ID:", data.user.id);
    
    // Atualizar role na tabela profiles (o trigger handle_new_user deve fazer isso, mas garantimos aqui)
    await supabase.from('profiles').update({ role: 'SUPPORT' }).eq('id', data.user.id);
    console.log("Perfil de SUPORTE ativado.");
  }
};

createSupportUser();
