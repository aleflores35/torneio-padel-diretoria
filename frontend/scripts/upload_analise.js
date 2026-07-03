// Upload CIRÚRGICO de 1 arquivo (análise pontos×rating) pro /ranking-srb na Hostinger.
// NÃO rebuilda nem re-deploya o app React — só adiciona analise-ranking.html.
// Uso: node scripts/upload_analise.js  (rodar de dentro de frontend/)
import ftp from 'basic-ftp';
import dotenv from 'dotenv';
import path from 'path';
dotenv.config();

const { FTP_HOST, FTP_USER, FTP_PASSWORD, FTP_REMOTE_PATH } = process.env;
const LOCAL = 'C:/obralivre/clientes/parcerias/sociedade-rio-branco/Analise_Ranking_Pontos_vs_Rating_2026-06-25.html';
const REMOTE_NAME = 'analise-ranking.html';

const client = new ftp.Client();
client.ftp.verbose = false;
try {
  await client.access({ host: FTP_HOST, user: FTP_USER, password: FTP_PASSWORD, secure: false });
  console.log('✅ Conectado a', FTP_HOST, '->', FTP_REMOTE_PATH);

  console.log('\n=== Conteúdo ATUAL de', FTP_REMOTE_PATH, '===');
  const before = await client.list(FTP_REMOTE_PATH);
  before.forEach(f => console.log(`  ${f.isDirectory ? 'D' : 'f'} ${f.name} (${f.size}b)`));
  const collide = before.find(f => f.name === REMOTE_NAME);
  console.log(collide ? `\n⚠️  ${REMOTE_NAME} JÁ existe (${collide.size}b) — será substituído` : `\n${REMOTE_NAME} é arquivo NOVO (não colide com o app nem com o boletim)`);

  await client.cd(FTP_REMOTE_PATH);
  await client.uploadFrom(LOCAL, REMOTE_NAME);
  console.log(`\n📤 Enviado: ${LOCAL}\n          -> ${FTP_REMOTE_PATH}/${REMOTE_NAME}`);

  const after = await client.list(FTP_REMOTE_PATH);
  const up = after.find(f => f.name === REMOTE_NAME);
  console.log(`\n✅ Confirmado no servidor: ${REMOTE_NAME} = ${up ? up.size + 'b' : 'NÃO ENCONTRADO'}`);
  console.log('🌐 URL: https://obralivre.com.br/ranking-srb/analise-ranking.html');
} catch (e) {
  console.error('❌', e.message);
  process.exit(1);
} finally {
  client.close();
}
