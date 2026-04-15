/**
 * RANKING PADEL SRB 2026 — Google Apps Script
 *
 * Como usar:
 * 1. Abra uma planilha Google Sheets
 * 2. Clique em Extensões → Apps Script
 * 3. Cole este código, salve e execute "syncAll"
 * 4. Autorize os acessos quando pedido
 * 5. Para atualizar automaticamente: crie um Trigger → "syncAll" → por tempo → a cada hora
 *
 * Coloque a URL da sua API abaixo:
 */

const API_URL = 'https://ranking-padel-srb-2026.vercel.app'; // ajuste conforme necessário
const TOURNAMENT_ID = 1;

const CATEGORIES = [
  { id: 1, name: 'Masculino Iniciante' },
  { id: 2, name: 'Masculino 4ª' },
  { id: 3, name: 'Feminino Iniciante' },
  { id: 4, name: 'Feminino 6ª' },
  { id: 5, name: 'Feminino 4ª' },
];

function syncAll() {
  syncAtletas();
  syncRodadas();
  syncJogos();
  syncRanking();
  syncConciliador();
  SpreadsheetApp.getActive().toast('✅ Sincronizado com sucesso!', 'Ranking SRB', 5);
}

function getOrCreateSheet(name) {
  const ss = SpreadsheetApp.getActive();
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  sheet.clearContents();
  return sheet;
}

function fetchJson(path) {
  const res = UrlFetchApp.fetch(`${API_URL}${path}`, { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw new Error(`HTTP ${res.getResponseCode()} em ${path}`);
  return JSON.parse(res.getContentText());
}

function writeSheet(sheetName, headers, rows) {
  const sheet = getOrCreateSheet(sheetName);
  if (!rows.length) {
    sheet.appendRow(headers);
    return;
  }
  const data = [headers, ...rows.map(r => headers.map(h => r[h] ?? ''))];
  sheet.getRange(1, 1, data.length, headers.length).setValues(data);
  // Bold headers
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#1a1a2e').setFontColor('#99cc33');
}

function syncAtletas() {
  const players = fetchJson(`/api/players?id_tournament=${TOURNAMENT_ID}`);
  const catMap = {};
  CATEGORIES.forEach(c => { catMap[c.id] = c.name; });
  const headers = ['id_player', 'Nome', 'Categoria', 'Lado', 'WhatsApp', 'Sócio'];
  const rows = players.map(p => ({
    id_player: p.id_player,
    Nome: p.name,
    Categoria: catMap[p.category_id] || p.category_id,
    Lado: p.side,
    WhatsApp: p.whatsapp || '',
    Sócio: p.is_socio ? 'Sim' : 'Não',
  }));
  writeSheet('Atletas', headers, rows);
}

function syncRodadas() {
  const rounds = fetchJson(`/api/tournaments/${TOURNAMENT_ID}/rounds`);
  const catMap = {};
  CATEGORIES.forEach(c => { catMap[c.id] = c.name; });
  const headers = ['id_round', 'Rodada', 'Categoria', 'Data', 'Status'];
  const rows = rounds.map(r => ({
    id_round: r.id_round,
    Rodada: r.round_number,
    Categoria: catMap[r.id_category] || r.id_category,
    Data: r.scheduled_date,
    Status: r.status,
  }));
  writeSheet('Rodadas', headers, rows);
}

function syncJogos() {
  const matches = fetchJson(`/api/tournaments/${TOURNAMENT_ID}/matches`);
  const headers = ['id_match', 'Rodada', 'Data', 'Dupla A', 'Dupla B', 'Placar A', 'Placar B', 'Status', 'Atleta Placar A', 'Atleta Placar B'];
  const rows = (matches || []).map(m => ({
    id_match: m.id_match,
    Rodada: m.round_number || '',
    Data: m.scheduled_date || '',
    'Dupla A': m.double_a_name || '',
    'Dupla B': m.double_b_name || '',
    'Placar A': m.score_a ?? m.games_double_a ?? '',
    'Placar B': m.score_b ?? m.games_double_b ?? '',
    Status: m.status,
    'Atleta Placar A': m.player_score_a ?? '',
    'Atleta Placar B': m.player_score_b ?? '',
  }));
  writeSheet('Jogos', headers, rows);
}

function syncRanking() {
  const all = fetchJson(`/api/tournaments/${TOURNAMENT_ID}/ranking`);
  const sheet = getOrCreateSheet('Ranking');
  let row = 1;
  for (const cat of CATEGORIES) {
    const standings = all[cat.id] || [];
    if (!standings.length) continue;
    // Category header
    sheet.getRange(row, 1).setValue(cat.name).setFontWeight('bold').setBackground('#99cc33').setFontColor('#000000');
    sheet.getRange(row, 1, 1, 7).merge();
    row++;
    // Column headers
    const headers = ['#', 'Nome', 'Lado', 'Pontos', 'Vitórias', 'Derrotas', 'WOs'];
    sheet.getRange(row, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    row++;
    standings.forEach((p, idx) => {
      sheet.getRange(row, 1, 1, headers.length).setValues([[idx + 1, p.name, p.side, p.points, p.wins, p.losses, p.wo_count || 0]]);
      row++;
    });
    row++; // blank row between categories
  }
}

function syncConciliador() {
  const [rounds, players, all] = [
    fetchJson(`/api/tournaments/${TOURNAMENT_ID}/rounds`),
    fetchJson(`/api/players?id_tournament=${TOURNAMENT_ID}`),
    fetchJson(`/api/tournaments/${TOURNAMENT_ID}/ranking`),
  ];
  const matches = fetchJson(`/api/tournaments/${TOURNAMENT_ID}/matches`);
  const finishedRounds = rounds.filter(r => r.status === 'FINISHED' || r.status === 'CONFIRMED').sort((a, b) => a.round_number - b.round_number);

  // Build player points per round from matches (approximation)
  // For a true conciliador we need per-match data — use the ranking service's breakdown
  // Here we create a pivot sheet with columns per round
  const sheet = getOrCreateSheet('Conciliador');
  const roundCols = finishedRounds.map(r => `R${r.round_number}\n${r.scheduled_date || ''}`);

  let row = 1;
  for (const cat of CATEGORIES) {
    const catPlayers = players.filter(p => p.category_id === cat.id);
    if (!catPlayers.length) continue;

    // Category header
    sheet.getRange(row, 1).setValue(cat.name).setFontWeight('bold').setBackground('#99cc33').setFontColor('#000000');
    sheet.getRange(row, 1, 1, roundCols.length + 3).merge();
    row++;

    // Column headers: Nome | Lado | R1 | R2 | ... | Total
    const headers = ['Nome', 'Lado', ...roundCols, 'Total'];
    sheet.getRange(row, 1, 1, headers.length).setValues([headers]).setFontWeight('bold').setWrap(true);
    row++;

    // For now show total points per player (round-by-round breakdown needs server-side data)
    const standings = all[cat.id] || [];
    const standingMap = {};
    standings.forEach(s => { standingMap[s.id_player] = s; });

    catPlayers.forEach(p => {
      const s = standingMap[p.id_player] || {};
      const dataRow = [p.name, p.side, ...finishedRounds.map(() => ''), s.points || 0];
      sheet.getRange(row, 1, 1, dataRow.length).setValues([dataRow]);
      row++;
    });
    row++;
  }
}
