const supabase = require('./supabase');

// Senha NUNCA hardcoded (repositório público) — vem por env var:
//   EMAIL=x@y.com NEW_PW='<senha forte>' node create_support_user.js
const createSupportUser = async () => {
  const email = process.env.EMAIL;
  const password = process.env.NEW_PW;
  if (!email || !password) {
    console.error('use EMAIL=<email> NEW_PW=<senha> node create_support_user.js');
    process.exit(1);
  }

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
