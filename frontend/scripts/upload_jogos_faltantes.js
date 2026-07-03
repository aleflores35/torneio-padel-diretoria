// Upload CIRÚRGICO de 1 arquivo (página "jogos que faltam") pro /ranking-srb na Hostinger.
// NÃO rebuilda nem re-deploya o app React nem o boletim — só adiciona jogos-faltantes.html.
import ftp from 'basic-ftp';
import dotenv from 'dotenv';
import path from 'path';
dotenv.config();

const { FTP_HOST, FTP_USER, FTP_PASSWORD, FTP_REMOTE_PATH } = process.env;
const LOCAL = path.resolve('..', 'jogos-faltantes.html');
const REMOTE_NAME = 'jogos-faltantes.html';

const client = new ftp.Client();
client.ftp.verbose = false;
try {
  await client.access({ host: FTP_HOST, user: FTP_USER, password: FTP_PASSWORD, secure: false });
  console.log('✅ Conectado a', FTP_HOST, '->', FTP_REMOTE_PATH);

  const before = await client.list(FTP_REMOTE_PATH);
  const collide = before.find(f => f.name === REMOTE_NAME);
  console.log(collide ? `⚠️  ${REMOTE_NAME} JÁ existe (${collide.size}b) — substituindo` : `${REMOTE_NAME} é arquivo NOVO (não colide com app/boletim)`);

  await client.cd(FTP_REMOTE_PATH);
  await client.uploadFrom(LOCAL, REMOTE_NAME);

  const after = await client.list(FTP_REMOTE_PATH);
  const up = after.find(f => f.name === REMOTE_NAME);
  console.log(`📤 Enviado: ${LOCAL} -> ${FTP_REMOTE_PATH}/${REMOTE_NAME}`);
  console.log(`✅ Confirmado no servidor: ${up ? up.size + 'b' : 'NÃO ENCONTRADO'}`);
  console.log('🌐 URL: https://obralivre.com.br/ranking-srb/jogos-faltantes.html');
} catch (e) {
  console.error('❌', e.message);
  process.exit(1);
} finally {
  client.close();
}
