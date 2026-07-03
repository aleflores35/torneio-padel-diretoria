// Exporta dados completos pro relatório marketeiro -> dados_relatorio.json
const fs = require('fs');
const path = require('path');
const supabase = require('../../supabase');
const { getStandings } = require('../../services/rankingService');

const ID_T = 7;
const CATS = [
  { id: 1, nome: 'Masculino Iniciante / 6ª', short: 'Masc. Iniciante', cor: 'blue' },
  { id: 2, nome: 'Masculino 4ª', short: 'Masc. 4ª', cor: 'blue' },
  { id: 3, nome: 'Feminino Iniciante', short: 'Feminino', cor: 'orange' },
];

async function jogosPorCat() {
  const { data: matches } = await supabase.from('matches').select('id_match, status, id_double_a').eq('id_tournament', ID_T);
  const dIds = [...new Set((matches || []).map(m => m.id_double_a).filter(Boolean))];
  const { data: dbls } = await supabase.from('doubles').select('id_double, id_round').in('id_double', dIds);
  const dRound = {}; (dbls || []).forEach(d => dRound[d.id_double] = d.id_round);
  const { data: rounds } = await supabase.from('rounds').select('id_round, id_category, round_type').in('id_round', [...new Set(Object.values(dRound))]);
  const rCat = {}, rType = {}; (rounds || []).forEach(r => { rCat[r.id_round] = r.id_category; rType[r.id_round] = r.round_type; });
  const out = {};
  for (const m of (matches || [])) {
    const rid = dRound[m.id_double_a]; if (rType[rid] === 'EXHIBITION') continue;
    const cat = rCat[rid]; if (cat == null) continue;
    out[cat] = out[cat] || { jogados: 0, faltam: 0, andamento: 0 };
    if (['FINISHED', 'WO'].includes(m.status)) out[cat].jogados++;
    else if (m.status === 'IN_PROGRESS') { out[cat].andamento++; out[cat].faltam++; }
    else if (m.status === 'TO_PLAY') out[cat].faltam++;
  }
  return out;
}

// Completude rumo ao "todos contra todos" por LADO (round-robin). Confronto = par do mesmo lado que se enfrentou.
async function completudeRR() {
  const [players, doubles, matches, rounds] = await Promise.all([
    supabase.from('players').select('id_player, side, category_id, active').eq('id_tournament', ID_T).then(r => r.data || []),
    supabase.from('doubles').select('id_double, id_player1, id_player2, id_round').eq('id_tournament', ID_T).then(r => r.data || []),
    supabase.from('matches').select('id_match, status, id_double_a, id_double_b').eq('id_tournament', ID_T).then(r => r.data || []),
    supabase.from('rounds').select('id_round, round_type').eq('id_tournament', ID_T).then(r => r.data || []),
  ]);
  const pById = {}; players.forEach(p => pById[p.id_player] = p);
  const dMap = {}; doubles.forEach(d => dMap[d.id_double] = d);
  const dRound = {}; doubles.forEach(d => dRound[d.id_double] = d.id_round);
  const exh = new Set(rounds.filter(r => r.round_type === 'EXHIBITION').map(r => r.id_round));
  const key = (a, b) => a < b ? `${a}-${b}` : `${b}-${a}`;
  const met = {};
  for (const m of matches) {
    if (!['FINISHED', 'WO', 'IN_PROGRESS'].includes(m.status)) continue;
    if (exh.has(dRound[m.id_double_a])) continue;
    const dA = dMap[m.id_double_a], dB = dMap[m.id_double_b]; if (!dA || !dB) continue;
    const all = [dA.id_player1, dA.id_player2, dB.id_player1, dB.id_player2].filter(Boolean);
    const cat = all.map(id => pById[id] && pById[id].category_id).find(c => c != null); if (cat == null) continue;
    met[cat] = met[cat] || { RIGHT: new Set(), LEFT: new Set() };
    // só conta confronto entre jogadores ATIVOS (desistente não faz parte do round-robin ativo)
    const side = s => x => pById[x] && pById[x].active && pById[x].side === s;
    const Ra = [dA.id_player1, dA.id_player2].find(side('RIGHT')), Rb = [dB.id_player1, dB.id_player2].find(side('RIGHT'));
    const La = [dA.id_player1, dA.id_player2].find(side('LEFT')), Lb = [dB.id_player1, dB.id_player2].find(side('LEFT'));
    if (Ra && Rb) met[cat].RIGHT.add(key(Ra, Rb));
    if (La && Lb) met[cat].LEFT.add(key(La, Lb));
  }
  const out = {};
  for (const cat of [1, 2, 3]) {
    const nD = players.filter(p => p.category_id === cat && p.active && p.side === 'RIGHT').length;
    const nE = players.filter(p => p.category_id === cat && p.active && p.side === 'LEFT').length;
    const total = nD * (nD - 1) / 2 + nE * (nE - 1) / 2;
    const m = met[cat] || { RIGHT: new Set(), LEFT: new Set() };
    const feitos = m.RIGHT.size + m.LEFT.size;
    out[cat] = { feitos, total, faltam: total - feitos, pct: total ? Math.round(100 * feitos / total) : 0 };
  }
  return out;
}

function destaquesDoLado(list) {
  // invicto = losses 0 e wins>=1; melhor saldo; disputa topo (dif pts 1º-2º)
  const invictos = list.filter(p => p.wins >= 1 && p.losses === 0 && p.wos === 0);
  return invictos;
}

async function run() {
  const jpc = await jogosPorCat();
  const rr = await completudeRR();
  const categorias = [];
  let gJog = 0, gFalt = 0;

  for (const c of CATS) {
    const standings = await getStandings(ID_T, c.id);
    const mk = (p, i) => ({
      pos: i + 1, id: p.id_player, nome: p.name, pts: p.points,
      v: p.wins, d: p.losses, wo: p.wos, j: p.matches_played, saldo: p.games_balance,
      invicto: p.wins >= 1 && p.losses === 0 && p.wos === 0,
    });
    const dir = standings.filter(p => p.side === 'RIGHT').map(mk);
    const esq = standings.filter(p => p.side === 'LEFT').map(mk);
    const j = jpc[c.id] || { jogados: 0, faltam: 0, andamento: 0 };
    gJog += j.jogados; gFalt += j.faltam;
    const total = j.jogados + j.faltam;
    categorias.push({
      id: c.id, nome: c.nome, short: c.short, cor: c.cor,
      atletas: dir.length + esq.length,
      jogos: { jogados: j.jogados, faltam: j.faltam, andamento: j.andamento, total, pct: total ? Math.round(100 * j.jogados / total) : 0 },
      rr: rr[c.id] || { feitos: 0, total: 0, faltam: 0, pct: 0 },
      direita: dir, esquerda: esq,
      lider_dir: dir[0] || null, lider_esq: esq[0] || null,
      // disputa = diferença de pts entre 1º e 2º de cada lado
      gap_dir: dir.length > 1 ? dir[0].pts - dir[1].pts : null,
      gap_esq: esq.length > 1 ? esq[0].pts - esq[1].pts : null,
    });
  }

  // destaques globais
  const todos = categorias.flatMap(c => [...c.direita.map(p => ({ ...p, cat: c.short, lado: 'Direita' })), ...c.esquerda.map(p => ({ ...p, cat: c.short, lado: 'Esquerda' }))]);
  const invictos = todos.filter(p => p.invicto).sort((a, b) => b.v - a.v || b.saldo - a.saldo);
  const maioresSaldos = [...todos].sort((a, b) => b.saldo - a.saldo).slice(0, 5);
  const totalPrev = gJog + gFalt;
  const rrFeitos = categorias.reduce((a, c) => a + c.rr.feitos, 0);
  const rrTotal = categorias.reduce((a, c) => a + c.rr.total, 0);

  const data = {
    torneio: 'Ranking Padel SRB 2026',
    geradoEm: '2026-06-17',
    resumo: {
      jogados: gJog, faltam: gFalt, total: totalPrev,
      pct: totalPrev ? Math.round(100 * gJog / totalPrev) : 0,
      rr_feitos: rrFeitos, rr_total: rrTotal, rr_faltam: rrTotal - rrFeitos,
      rr_pct: rrTotal ? Math.round(100 * rrFeitos / rrTotal) : 0,
      atletas: todos.length, categorias: categorias.length,
      titulos_em_disputa: categorias.length * 2, // por lado
    },
    categorias,
    destaques: { invictos, maioresSaldos },
  };

  const outPath = path.join(__dirname, 'dados_relatorio.json');
  fs.writeFileSync(outPath, JSON.stringify(data, null, 2), 'utf8');
  console.log('OK ->', outPath);
  console.log(`Resumo: ${gJog} jogados / ${gFalt} faltam / ${totalPrev} total (${data.resumo.pct}%) · ${todos.length} atletas`);
  console.log(`Invictos: ${invictos.map(p => `${p.nome}(${p.v}-0)`).join(', ')}`);
}
run().catch(e => { console.error(e.message || e); process.exit(1); });
