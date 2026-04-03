import ftp from 'basic-ftp';
import dotenv from 'dotenv';
dotenv.config();

const { FTP_HOST, FTP_USER, FTP_PASSWORD, FTP_REMOTE_PATH } = process.env;

async function debug() {
  const client = new ftp.Client();
  try {
    await client.access({
      host: FTP_HOST,
      user: FTP_USER,
      password: FTP_PASSWORD,
      secure: false
    });
    console.log("Conectado!");
    
    console.log("Lendo diretório /public_html/diretoria-padel : ");
    const listDir = await client.list("/public_html/diretoria-padel");
    console.log(listDir.map(f => f.name + (f.isDirectory ? '/' : '')));

  } catch (err) {
    console.log("Erro:", err.message);
  } finally {
    client.close();
  }
}

debug();
