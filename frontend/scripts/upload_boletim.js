// Upload CIRÚRGICO de 1 arquivo (boletim do campeonato) pro /ranking-srb na Hostinger.
// NÃO rebuilda nem re-deploya o app React — só adiciona boletim.html.
import ftp from 'basic-ftp';
import dotenv from 'dotenv';
import path from 'path';
dotenv.config();

const { FTP_HOST, FTP_USER, FTP_PASSWORD, FTP_REMOTE_PATH } = process.env;
const LOCAL = path.resolve('..', 'relatorio-campeonato-srb-2026.html');
const REMOTE_NAME = 'boletim.html';

const client = new ftp.Client();
client.ftp.verbose = false;
try {
  await client.access({ host: FTP_HOST, user: FTP_USER, password: FTP_PASSWORD, secure: false });
  console.log('✅ Conectado a', FTP_HOST, '->', FTP_REMOTE_PATH);

  console.log('\n=== Conteúdo ATUAL de', FTP_REMOTE_PATH, '===');
  const before = await client.list(FTP_REMOTE_PATH);
  before.forEach(f => console.log(`  ${f.isDirectory ? 'D' : 'f'} ${f.name} (${f.size}b)`));
  const collide = before.find(f => f.name === REMOTE_NAME);
  console.log(collide ? `\n⚠️  ${REMOTE_NAME} JÁ existe (${collide.size}b) — será substituído pela nova versão` : `\n${REMOTE_NAME} é arquivo NOVO (não colide com o app)`);

  await client.cd(FTP_REMOTE_PATH);
  await client.uploadFrom(LOCAL, REMOTE_NAME);
  console.log(`\n📤 Enviado: ${LOCAL}\n          -> ${FTP_REMOTE_PATH}/${REMOTE_NAME}`);

  const after = await client.list(FTP_REMOTE_PATH);
  const up = after.find(f => f.name === REMOTE_NAME);
  console.log(`\n✅ Confirmado no servidor: ${REMOTE_NAME} = ${up ? up.size + 'b' : 'NÃO ENCONTRADO'}`);
  console.log('🌐 URL: https://obralivre.com.br/ranking-srb/boletim.html');
} catch (e) {
  console.error('❌', e.message);
  process.exit(1);
} finally {
  client.close();
}
