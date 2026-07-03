// Provisiona contas ADMIN no Supabase Auth + tabela profiles.
// - alessandro.flores16@gmail.com : promove SUPPORT -> ADMIN + reset senha (senha atual vazada)
// - marialuisabonitzio@gmail.com  : cria como ADMIN
// Backup ANTES de escrever. DRY-RUN default; CONFIRM_EXECUTE=yes grava.
const supabase = require('../../supabase');
const crypto = require('crypto');
const fs = require('fs'); const path = require('path');
const CONFIRM = process.env.CONFIRM_EXECUTE === 'yes';

const ALE = 'alessandro.flores16@gmail.com';
const MARIA = 'marialuisabonitzio@gmail.com';

// senha forte: 16 chars alfanum + símbolos garantidos, sem caracteres ambíguos
function strongPw() {
  const raw = crypto.randomBytes(18).toString('base64').replace(/[+/=lIO0]/g, '');
  return raw.slice(0, 14) + 'Rk7!'; // garante maiúscula, dígito e símbolo
}

(async () => {
  if (!supabase) { console.error('SEM supabase'); process.exit(1); }

  // ---- BACKUP antes de qualquer escrita ----
  const ts = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
  const dir = path.join('C:/obralivre/clientes/parcerias/sociedade-rio-branco/ranking-srb-2026/backups', `PRE_admins_${ts}`);
  const { data: profsBefore } = await supabase.from('profiles').select('*');
  const { data: usersBefore } = await supabase.auth.admin.listUsers();
  if (CONFIRM) {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'profiles.json'), JSON.stringify(profsBefore, null, 2));
    fs.writeFileSync(path.join(dir, 'auth_users.json'), JSON.stringify((usersBefore?.users || []).map(u => ({ id: u.id, email: u.email, role: u.user_metadata?.role })), null, 2));
    console.log('backup PRÉ salvo:', dir);
  }

  const findUser = (email) => (usersBefore?.users || []).find(u => u.email?.toLowerCase() === email.toLowerCase());
  const aleUser = findUser(ALE);
  const mariaUser = findUser(MARIA);
  const pwAle = strongPw();
  const pwMaria = strongPw();

  console.log(`\n=== PLANO ${CONFIRM ? '(EXECUTANDO)' : '(DRY-RUN)'} ===`);
  console.log(`1) ${ALE}: ${aleUser ? `existe (id ${aleUser.id}, role ${aleUser.user_metadata?.role}) -> promover ADMIN + reset senha` : 'NÃO existe -> criar ADMIN'}`);
  console.log(`2) ${MARIA}: ${mariaUser ? `JÁ existe (id ${mariaUser.id}) -> só garantir ADMIN + reset senha` : 'não existe -> criar ADMIN'}`);

  if (!CONFIRM) { console.log('\n>>> DRY-RUN: nada gravado. CONFIRM_EXECUTE=yes pra aplicar. <<<'); process.exit(0); }

  console.log('\n--- GRAVANDO ---');

  // 1) Alessandro: promover + reset senha
  if (aleUser) {
    const { error: e1 } = await supabase.auth.admin.updateUserById(aleUser.id, {
      password: pwAle, user_metadata: { ...aleUser.user_metadata, role: 'ADMIN' },
    });
    if (e1) { console.error('ERRO update Ale auth:', e1.message); process.exit(1); }
    const { error: e2 } = await supabase.from('profiles').update({ role: 'ADMIN' }).eq('id', aleUser.id);
    if (e2) { console.error('ERRO update Ale profile:', e2.message); process.exit(1); }
    console.log(`  ${ALE}: role ADMIN + senha resetada`);
  }

  // 2) Maria: criar (ou reusar) + garantir ADMIN + profiles row
  let mariaId = mariaUser?.id;
  if (!mariaUser) {
    const { data: created, error: e3 } = await supabase.auth.admin.createUser({
      email: MARIA, password: pwMaria, email_confirm: true, user_metadata: { role: 'ADMIN' },
    });
    if (e3) { console.error('ERRO criar Maria:', e3.message); process.exit(1); }
    mariaId = created.user.id;
    console.log(`  ${MARIA}: criada (id ${mariaId})`);
  } else {
    const { error: e3b } = await supabase.auth.admin.updateUserById(mariaId, {
      password: pwMaria, user_metadata: { ...mariaUser.user_metadata, role: 'ADMIN' },
    });
    if (e3b) { console.error('ERRO update Maria auth:', e3b.message); process.exit(1); }
    console.log(`  ${MARIA}: senha resetada + role ADMIN (já existia)`);
  }
  // profiles row da Maria (upsert)
  const { error: e4 } = await supabase.from('profiles').upsert({ id: mariaId, email: MARIA, role: 'ADMIN' }, { onConflict: 'id' });
  if (e4) { console.error('ERRO profiles Maria:', e4.message); process.exit(1); }
  console.log(`  ${MARIA}: profiles role ADMIN`);

  // ---- VERIFICAÇÃO ----
  const { data: profsAfter } = await supabase.from('profiles').select('id,email,role');
  console.log('\n=== profiles depois ===');
  (profsAfter || []).forEach(p => console.log('  ', p.email, '->', p.role));

  console.log('\n================= SENHAS NOVAS (guardar!) =================');
  console.log(`  ${ALE}  ->  ${pwAle}`);
  console.log(`  ${MARIA}  ->  ${pwMaria}`);
  console.log('===========================================================');
  process.exit(0);
})();
