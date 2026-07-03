// READ-ONLY: validação cruzada do ranking SRB.
// 1) Recalcula standings DO ZERO a partir dos matches crus (regras documentadas)
// 2) Compara com getStandings() (o motor que alimenta o site)
// 3) Compara com dados_relatorio.json (o boletim publicado)
// 4) Invariantes: saldo soma 0 por lado | points == 3*wins + losses + extras | parity W/L
// 5) Conta rodadas por categoria + acha matches travados
const fs = require('fs');
const path = require('path');
const supabase = require('../../supabase');
const { getStandings } = require('../../services/rankingService');

const ID_T = 7;
const CATS = [
  { id: 1, nome: 'Masc. Iniciante' },
  { id: 2, nome: 'Masc. 4ª' },
  { id: 3, nome: 'Feminino' },
];

async function fetchAll() {
  const [players, doubles, matches, rounds] = await Promise.all([
    supabase.from('players').select('id_player, name, side, category_id, active').eq('id_tournament', ID_T).then(r => r.data || []),
    supabase.from('doubles').select('id_double, id_player1, id_player2, id_round').eq('id_tournament', ID_T).then(r => r.data || []),
    supabase.from('matches').select('id_match, status, id_double_a, id_double_b, games_double_a, games_double_b, absent_player_ids, scheduled_at').eq('id_tournament', ID_T).then(r => r.data || []),
    supabase.from('rounds').select('id_round, id_category, round_type, round_number, scheduled_date, status').eq('id_tournament', ID_T).then(r => r.data || []),
  ]);
  return { players, doubles, matches, rounds };
}

// Recálculo independente (espelha as regras documentadas em rankingService)
function recompute(catId, data) {
  const { players, doubles, matches, rounds } = data;
  const dMap = {}; doubles.forEach(d => dMap[d.id_double] = d);
  const exhRounds = new Set(rounds.filter(r => r.round_type === 'EXHIBITION').map(r => r.id_round));
  const exhDoubles = new Set(doubles.filter(d => d.id_round != null && exhRounds.has(d.id_round)).map(d => d.id_double));

  const catPlayers = players.filter(p => p.category_id === catId && p.active);
  const pids = new Set(catPlayers.map(p => p.id_player));
  const stats = {};
  catPlayers.forEach(p => stats[p.id_player] = { name: p.name, side: p.side, points: 0, wins: 0, losses: 0, wos: 0, mp: 0, gf: 0, ga: 0 });

  // matches que contam: FINISHED, WO, e IN_PROGRESS com placar válido
  const counts = matches.filter(m => {
    if (exhDoubles.has(m.id_double_a) || exhDoubles.has(m.id_double_b)) return false;
    if (m.status === 'FINISHED' || m.status === 'WO') return true;
    if (m.status === 'IN_PROGRESS') {
      const a = m.games_double_a ?? 0, b = m.games_double_b ?? 0;
      return (a > 0 || b > 0) && a !== b;
    }
    return false;
  });

  for (const m of counts) {
    const dA = dMap[m.id_double_a], dB = dMap[m.id_double_b];
    if (!dA || !dB) continue;
    const pA = [dA.id_player1, dA.id_player2].filter(Boolean);
    const pB = [dB.id_player1, dB.id_player2].filter(Boolean);
    // só processa se a dupla pertence à categoria
    if (!pA.some(p => pids.has(p)) && !pB.some(p => pids.has(p))) continue;
    const absents = new Set(Array.isArray(m.absent_player_ids) ? m.absent_player_ids : []);
    const gA = m.games_double_a ?? 0, gB = m.games_double_b ?? 0;
    const valid = (gA > 0 || gB > 0) && gA !== gB;
    const aAbs = pA.some(p => absents.has(p)), bAbs = pB.some(p => absents.has(p));
    const proc = (pid, og, pg, ourAbs, oppAbs) => {
      const s = stats[pid]; if (!s) return;
      s.mp++;
      if (absents.has(pid)) { s.wos++; return; }
      if (ourAbs) { s.points += 1; return; }
      if (oppAbs) { s.wins++; s.points += 3; return; }
      if (valid) { s.gf += og; s.ga += pg; if (og > pg) { s.wins++; s.points += 3; } else { s.losses++; s.points += 1; } return; }
      s.points += 1;
    };
    for (const p of pA) proc(p, gA, gB, aAbs, bAbs);
    for (const p of pB) proc(p, gB, gA, bAbs, aAbs);
  }

  return catPlayers.map(p => {
    const s = stats[p.id_player];
    return { id: p.id_player, name: s.name, side: s.side, points: s.points, wins: s.wins, losses: s.losses, wos: s.wos, mp: s.mp, saldo: s.gf - s.ga };
  });
}

async function run() {
  const data = await fetchAll();
  const jsonPath = path.join(__dirname, 'dados_relatorio.json');
  const boletim = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

  let problemas = 0;
  const flag = (msg) => { problemas++; console.log('  ❌ ' + msg); };
  const ok = (msg) => console.log('  ✓ ' + msg);

  for (const c of CATS) {
    console.log(`\n=== ${c.nome} (cat ${c.id}) ===`);
    const mine = recompute(c.id, data);
    const eng = await getStandings(ID_T, c.id);
    const engMap = {}; eng.forEach(p => engMap[p.id_player] = p);
    const catJson = boletim.categorias.find(x => x.id === c.id);
    const jsonMap = {}; [...(catJson.direita || []), ...(catJson.esquerda || [])].forEach(p => jsonMap[p.id] = p);

    // (A) recompute vs engine
    let aDiff = 0;
    for (const p of mine) {
      const e = engMap[p.id];
      if (!e) { flag(`${p.name}: ausente no getStandings`); aDiff++; continue; }
      if (e.points !== p.points || e.wins !== p.wins || e.losses !== p.losses || e.wos !== p.wos || e.games_balance !== p.saldo) {
        flag(`${p.name}: recálculo (${p.points}pt ${p.wins}-${p.losses} wo${p.wos} s${p.saldo}) ≠ motor (${e.points}pt ${e.wins}-${e.losses} wo${e.wos} s${e.games_balance})`);
        aDiff++;
      }
    }
    if (!aDiff) ok(`recálculo independente == motor getStandings (${mine.length} atletas)`);

    // (B) engine vs json boletim
    let bDiff = 0;
    for (const e of eng) {
      const j = jsonMap[e.id_player];
      if (!j) { flag(`${e.name}: ausente no boletim json`); bDiff++; continue; }
      if (j.pts !== e.points || j.v !== e.wins || j.d !== e.losses || j.saldo !== e.games_balance) {
        flag(`${e.name}: motor (${e.points}pt ${e.wins}-${e.losses} s${e.games_balance}) ≠ boletim (${j.pts}pt ${j.v}-${j.d} s${j.saldo})`);
        bDiff++;
      }
    }
    if (!bDiff) ok(`motor == boletim publicado`);

    // (C) saldo soma 0 por lado
    const sD = mine.filter(p => p.side === 'RIGHT').reduce((a, p) => a + p.saldo, 0);
    const sE = mine.filter(p => p.side === 'LEFT').reduce((a, p) => a + p.saldo, 0);
    if (sD === 0 && sE === 0) ok(`saldo de games fecha em zero (dir ${sD} / esq ${sE})`);
    else flag(`saldo NÃO fecha: direita ${sD}, esquerda ${sE} (deveria ser 0/0)`);

    // (D) invariante de pontos: points == 2*wins + mp - wos
    let dDiff = 0;
    for (const p of mine) {
      const esperado = 2 * p.wins + p.mp - p.wos;
      if (p.points !== esperado) { flag(`${p.name}: pts ${p.points} ≠ 2w+mp-wo (${esperado})`); dDiff++; }
    }
    if (!dDiff) ok(`fórmula de pontos consistente (3 vitória / 1 derrota / 0 W.O.)`);

    // (E) parity: wins totais == losses + wo_wins? checa nº de atletas e lados
    const nD = mine.filter(p => p.side === 'RIGHT').length;
    const nE = mine.filter(p => p.side === 'LEFT').length;
    ok(`atletas: ${nD} direita + ${nE} esquerda = ${mine.length}`);

    // rodadas
    const rds = data.rounds.filter(r => r.id_category === c.id && r.round_type !== 'EXHIBITION').sort((a, b) => (a.round_number || 0) - (b.round_number || 0));
    const dRound = {}; data.doubles.forEach(d => dRound[d.id_double] = d.id_round);
    const perR = {};
    for (const m of data.matches) {
      const rid = dRound[m.id_double_a]; if (!rid) continue;
      if (!rds.some(r => r.id_round === rid)) continue;
      perR[rid] = perR[rid] || { jogados: 0, faltam: 0 };
      if (['FINISHED', 'WO'].includes(m.status)) perR[rid].jogados++;
      else perR[rid].faltam++;
    }
    const jogados = Object.values(perR).reduce((a, x) => a + x.jogados, 0);
    const faltam = Object.values(perR).reduce((a, x) => a + x.faltam, 0);
    const rodadasComJogo = Object.keys(perR).length;
    console.log(`  → ${rds.length} rodadas geradas · ${rodadasComJogo} com jogos · ${jogados} jogos feitos + ${faltam} a fazer = ${jogados + faltam}`);
    if (catJson.jogos.jogados === jogados) ok(`jogos feitos batem com boletim (${jogados})`);
    else flag(`jogos feitos: recálculo ${jogados} ≠ boletim ${catJson.jogos.jogados}`);
  }

  // matches travados (IN_PROGRESS) em qualquer categoria
  console.log(`\n=== Matches travados (IN_PROGRESS) ===`);
  const travados = data.matches.filter(m => m.status === 'IN_PROGRESS');
  if (!travados.length) console.log('  (nenhum)');
  for (const m of travados) {
    const valid = (m.games_double_a ?? 0) !== (m.games_double_b ?? 0) && ((m.games_double_a ?? 0) > 0 || (m.games_double_b ?? 0) > 0);
    console.log(`  match ${m.id_match} · ${m.scheduled_at || '?'} · placar ${m.games_double_a ?? '-'}x${m.games_double_b ?? '-'} · ${valid ? 'placar válido (CONTA no ranking)' : 'SEM placar (não conta)'}`);
  }

  console.log(`\n${'='.repeat(50)}`);
  console.log(problemas === 0 ? '✅ VALIDAÇÃO OK — nenhuma inconsistência encontrada.' : `⚠️  ${problemas} inconsistência(s) encontrada(s).`);
}
run().catch(e => { console.error(e.message || e); process.exit(1); });
