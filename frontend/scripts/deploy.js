import ftp from 'basic-ftp';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

// Carrega variáveis de ambiente
dotenv.config();

const { FTP_HOST, FTP_USER, FTP_PASSWORD, FTP_REMOTE_PATH } = process.env;


// Detecta a pasta de build automaticamente
function detectBuildFolder() {
  const possibleFolders = ['dist', 'build', 'out', '.next', 'public'];
  for (const folder of possibleFolders) {
    if (fs.existsSync(folder)) {
      return folder;
    }
  }
  console.error('❌ Nenhuma pasta de build encontrada (dist, build, out, .next, public)');
  console.error('   Execute o build primeiro: npm run build');
  process.exit(1);
}

async function deploy() {
  // Valida credenciais
  if (!FTP_HOST || !FTP_USER || !FTP_PASSWORD) {
    console.error('❌ Credenciais FTP não configuradas!');
    console.error('   Configure as variáveis no arquivo .env:');
    console.error('   - FTP_HOST');
    console.error('   - FTP_USER');
    console.error('   - FTP_PASSWORD');
    process.exit(1);
  }

  const buildFolder = detectBuildFolder();
  const remotePath = FTP_REMOTE_PATH || '/';

  // Copia HTMLs extras da raiz do projeto para o dist antes do upload
  const extraFiles = ['obrigado.html', 'apresentacao-atletas.html'];
  const projectRoot = path.resolve('..'); // frontend/../ = raiz do projeto
  for (const file of extraFiles) {
    const src = path.join(projectRoot, file);
    const dest = path.join(buildFolder, file);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest);
      console.log(`📋 Copiado: ${file} → ${buildFolder}/`);
    } else {
      console.warn(`⚠️  Não encontrado: ${file} (pulando)`);
    }
  }
  console.log('');

  console.log('🚀 Iniciando deploy para Hostinger...');
  console.log(`   Host: ${FTP_HOST}`);
  console.log(`   Usuário: ${FTP_USER}`);
  console.log(`   Pasta local: ${buildFolder}`);
  console.log(`   Pasta remota: ${remotePath}`);
  console.log('');

  const client = new ftp.Client();
  client.ftp.verbose = false;

  try {
    console.log('🔌 Conectando ao servidor FTP...');
    await client.access({
      host: FTP_HOST,
      user: FTP_USER,
      password: FTP_PASSWORD,
      secure: false
    });
    console.log('✅ Conectado!');

    console.log(`📁 Navegando para ${remotePath}...`);
    await client.ensureDir(remotePath);

    console.log('📤 Enviando arquivos...');
    await client.uploadFromDir(buildFolder);

    console.log('');
    console.log('🎉 Deploy concluído com sucesso!');
    console.log(`   Seu site está disponível em: https://obralivre.com.br/ranking-srb`);

  } catch (err) {
    console.error('');
    console.error('❌ Erro durante o deploy:');
    console.error(`   ${err.message}`);
    
    if (err.message.includes('Login incorrect')) {
      console.error('');
      console.error('💡 Dica: Verifique suas credenciais FTP no painel da Hostinger');
    }
    
    process.exit(1);
  } finally {
    client.close();
  }
}

deploy();
