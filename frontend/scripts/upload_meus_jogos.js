// Upload CIRÚRGICO de meus-jogos.html pro /ranking-srb na Hostinger (não toca no app nem nas outras páginas).
import ftp from 'basic-ftp';
import dotenv from 'dotenv';
import path from 'path';
dotenv.config();
const { FTP_HOST, FTP_USER, FTP_PASSWORD, FTP_REMOTE_PATH } = process.env;
const LOCAL = path.resolve('..', 'meus-jogos.html');
const REMOTE_NAME = 'meus-jogos.html';
const client = new ftp.Client();
client.ftp.verbose = false;
try {
  await client.access({ host: FTP_HOST, user: FTP_USER, password: FTP_PASSWORD, secure: false });
  const before = await client.list(FTP_REMOTE_PATH);
  const collide = before.find(f => f.name === REMOTE_NAME);
  console.log(collide ? `⚠️ ${REMOTE_NAME} JÁ existe (${collide.size}b) — substituindo` : `${REMOTE_NAME} é arquivo NOVO`);
  await client.cd(FTP_REMOTE_PATH);
  await client.uploadFrom(LOCAL, REMOTE_NAME);
  const after = await client.list(FTP_REMOTE_PATH);
  const up = after.find(f => f.name === REMOTE_NAME);
  console.log(`✅ ${REMOTE_NAME} = ${up ? up.size + 'b' : 'NÃO ENCONTRADO'}`);
  console.log('🌐 https://obralivre.com.br/ranking-srb/meus-jogos.html');
} catch (e) { console.error('❌', e.message); process.exit(1); } finally { client.close(); }
