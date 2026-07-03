// Injeta dados_relatorio.json no bloco `const DATA = {...}` do boletim HTML.
// Brace-matching consciente de strings (robusto). Não toca em mais nada do arquivo.
const fs = require('fs');
const path = require('path');

const data = require('./dados_relatorio.json');
const htmlPath = path.resolve(__dirname, '../../../relatorio-campeonato-srb-2026.html');
let html = fs.readFileSync(htmlPath, 'utf8');

const anchor = 'const DATA = ';
const start = html.indexOf(anchor);
if (start < 0) { console.error('âncora "const DATA = " não encontrada'); process.exit(1); }
const objStart = html.indexOf('{', start);

let depth = 0, inStr = false, esc = false, end = -1;
for (let i = objStart; i < html.length; i++) {
  const ch = html[i];
  if (inStr) {
    if (esc) esc = false;
    else if (ch === '\\') esc = true;
    else if (ch === '"') inStr = false;
  } else {
    if (ch === '"') inStr = true;
    else if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) { end = i; break; } }
  }
}
if (end < 0) { console.error('fim do objeto DATA não encontrado'); process.exit(1); }

const before = html.slice(0, start);
const after = html.slice(end + 1); // começa em ';'
const newBlock = anchor + JSON.stringify(data, null, 2);
const newHtml = before + newBlock + after;

// sanity: o ';' logo após e o tamanho mudou de forma plausível
if (after[0] !== ';') { console.error('esperava ";" após o objeto, achei:', JSON.stringify(after.slice(0,5))); process.exit(1); }
fs.writeFileSync(htmlPath, newHtml, 'utf8');
console.log(`✓ injetado. resumo: ${data.resumo.jogados}/${data.resumo.faltam}/${data.resumo.total} (${data.resumo.pct}%) · ${data.resumo.atletas} atletas · geradoEm ${data.geradoEm}`);
console.log(`  HTML: ${(newHtml.length/1024).toFixed(1)}kb`);
