// Seta a senha de um atleta específico (tabela players) manualmente.
// Opcionalmente também seta o email (pra permitir login por email).
// Uso quando WhatsApp/Email não estão operacionais e admin precisa
// definir credenciais escolhidas em vez da senha aleatória do reset.
//
// Uso:
//   CONFIRM_SET=yes ATHLETE_ID=655 EMAIL_TO_SET=x@y.com NEW_PASSWORD=abc node set_athlete_password.js
//   CONFIRM_SET=yes ATHLETE_EMAIL=x@y.com NEW_PASSWORD=abc node set_athlete_password.js

const bcrypt = require('bcryptjs');
const supabase = require('./supabase');

async function setPassword() {
  const athleteId = process.env.ATHLETE_ID;
  const emailToSet = process.env.EMAIL_TO_SET; // opcional — pra atualizar email do atleta
  const athleteEmail = process.env.ATHLETE_EMAIL; // alternativa: lookup por email
  const newPassword = process.env.NEW_PASSWORD;
  const confirm = process.env.CONFIRM_SET;

  if (!newPassword) {
    console.error('❌ Falta NEW_PASSWORD');
    process.exit(1);
  }
  if (!athleteId && !athleteEmail) {
    console.error('❌ Precisa ATHLETE_ID ou ATHLETE_EMAIL');
    process.exit(1);
  }

  if (confirm !== 'yes') {
    console.log('⚠️  Pra executar, rode com CONFIRM_SET=yes');
    process.exit(0);
  }

  let query = supabase.from('players').select('id_player, name, email');
  if (athleteId) query = query.eq('id_player', Number(athleteId));
  else query = query.eq('email', athleteEmail);

  const { data: player, error } = await query.single();
  if (error || !player) {
    console.error(`❌ Atleta não encontrado`);
    if (error) console.error('   Erro:', error.message);
    process.exit(1);
  }

  console.log(`Encontrado: ${player.name} (id=${player.id_player}) · email atual: ${player.email || 'vazio'}`);

  const hash = await bcrypt.hash(newPassword, 10);
  const update = { password_hash: hash };
  if (emailToSet) update.email = emailToSet;

  const { error: updateError } = await supabase
    .from('players')
    .update(update)
    .eq('id_player', player.id_player);

  if (updateError) {
    console.error('❌ Erro ao atualizar:', updateError.message);
    process.exit(1);
  }

  console.log(`✅ Senha atualizada pra ${player.name}`);
  if (emailToSet) console.log(`✅ Email atualizado pra ${emailToSet}`);
  console.log(`   Atleta pode logar em obralivre.com.br/ranking-srb/atleta`);
  console.log(`   (usar email ${emailToSet || player.email || 'cadastrado'} + senha nova)`);
}

setPassword().catch((err) => {
  console.error('❌ Falha:', err);
  process.exit(1);
});
