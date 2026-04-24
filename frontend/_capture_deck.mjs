import { chromium } from 'playwright';
import { mkdirSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, 'public', 'screenshots', 'ranking-obralivre');
mkdirSync(OUTPUT_DIR, { recursive: true });

const BASE = 'https://obralivre.com.br/ranking-srb';

const PAGES = [
  { name: '01-landing',   url: `${BASE}/`,              admin: false, label: 'Landing pública' },
  { name: '02-semana',    url: `${BASE}/semana`,        admin: false, label: 'Agenda da semana' },
  { name: '03-ranking',   url: `${BASE}/ranking`,       admin: false, label: 'Ranking por categoria' },
  { name: '10-dashboard', url: `${BASE}/admin`,         admin: true,  label: 'Dashboard admin' },
  { name: '11-atletas',   url: `${BASE}/admin/atletas`, admin: true,  label: 'Gestão de atletas' },
  { name: '12-rodadas',   url: `${BASE}/rodadas`,       admin: true,  label: 'Sorteio de rodadas' },
  { name: '13-jogos',     url: `${BASE}/jogos`,         admin: true,  label: 'Lançamento de jogos' },
];

async function main() {
  console.log('[capture] launching chromium headless...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });

  await context.addInitScript(() => {
    try { localStorage.setItem('userRole', 'ADMIN'); } catch {}
  });

  const page = await context.newPage();

  const results = [];
  for (const p of PAGES) {
    const outPath = join(OUTPUT_DIR, `${p.name}.png`);
    console.log(`[capture] ${p.name} → ${p.url}`);
    try {
      await page.goto(p.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      try {
        await page.waitForLoadState('networkidle', { timeout: 15000 });
      } catch {}
      await page.waitForTimeout(2500);
      await page.screenshot({ path: outPath, fullPage: false });
      console.log(`   ok → ${outPath}`);
      results.push({ ...p, ok: true, path: outPath });
    } catch (e) {
      console.error(`   FAIL: ${e.message}`);
      results.push({ ...p, ok: false, error: e.message });
    }
  }

  await browser.close();

  console.log('\n=== summary ===');
  for (const r of results) {
    console.log(`${r.ok ? '✓' : '✗'} ${r.name.padEnd(18)} ${r.label}`);
  }
  console.log(`\nOutput dir: ${OUTPUT_DIR}`);
}

main().catch(err => { console.error('[fatal]', err); process.exit(1); });
