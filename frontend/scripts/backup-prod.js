import ftp from 'basic-ftp';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const { FTP_HOST, FTP_USER, FTP_PASSWORD, FTP_REMOTE_PATH } = process.env;

// Default: save outside the project (at C:/obralivre/_backups-deploys/ranking-srb/)
// so deploy snapshots don't pollute the repo and get ignored by robocopy/git.
function defaultBackupDir() {
  const stamp = new Date().toISOString().replace(/[-T:]/g, '').slice(0, 12); // YYYYMMDDHHMM
  return path.resolve('../../../../_backups-deploys/ranking-srb', `backup-prod-${stamp.slice(0,8)}-${stamp.slice(8,12)}`);
}

const BACKUP_DIR = process.argv[2] || defaultBackupDir();
fs.mkdirSync(BACKUP_DIR, { recursive: true });

const client = new ftp.Client();
try {
  await client.access({
    host: FTP_HOST,
    user: FTP_USER,
    password: FTP_PASSWORD,
    secure: false,
  });
  console.log(`Downloading ${FTP_REMOTE_PATH} → ${BACKUP_DIR}`);
  await client.downloadToDir(BACKUP_DIR, FTP_REMOTE_PATH);
  console.log('Backup complete.');
} catch (e) {
  console.error('Error:', e.message);
  process.exit(1);
} finally {
  client.close();
}
