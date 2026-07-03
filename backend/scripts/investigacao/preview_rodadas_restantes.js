// READ-ONLY / PREVIEW: monta as rodadas que faltam pra fechar o round-robin (todos x todos por lado).
// Não grava no banco. Resumo no console + arquivo PREVIEW_RODADAS_RESTANTES.md na raiz.
// Estratégia (perto do mínimo): nº de jogos = max(confrontos faltando dir, esq).
//  - zipa 1 confronto fresco da direita + 1 da esquerda por jogo (cada jogo cobre 2 confrontos novos)
//  - quando um lado acaba os frescos, o outro continua com par repetido do lado menor
//  - empacota cada rodada com o MÁXIMO de jogos sem ninguém jogar 2x
//  - escolhe orientação das duplas evitando repetir parceria
const fs = require('fs');
const path = require('path');
const supabase = require('../../supabase');
const ID_T = 7;
const CATS = { 1: 'Masc. Iniciante', 2: 'Masc. 4ª', 3: 'Feminino' };
const key = (a, b) => a < b ? `${a}-${b}` : `${b}-${a}`;
const allPairs = (arr) => { const o = []; for (let i = 0; i < arr.length; i++) for (let j = i + 1; j < arr.length; j++) o.push(key(arr[i], arr[j])); return o; };

function buildSchedule(R, L, needRset, needLset, partner) {
  const cap = Math.floor(Math.min(R.length, L.length) / 2); // jogos máx por rodada
  // emparelhamento guloso de pares FRESCOS (disjuntos) num lado
  const greedyMatch = (needSet, n) => {
    const used = new Set(), out = [];
    for (const k of needSet) {
      if (out.length >= n) break;
      const [a, b] = k.split('-').map(Number);
      if (used.has(a) || used.has(b)) continue;
      out.push(k); used.add(a); used.add(b);
    }
    return { pairs: out, used };
  };
  // completa com pares REPETIDOS entre jogadores livres até `count`
  const fill = (players, used, count) => {
    const out = [], free = players.filter(p => !used.has(p));
    for (let i = 0; i + 1 < free.length && out.length < count; i += 2) out.push(key(free[i], free[i + 1]));
    return out;
  };
  const rounds = [];
  let nGames = 0, guard = 0;
  while ((needRset.size > 0 || needLset.size > 0) && guard++ < 500) {
    const mR = greedyMatch(needRset, cap);
    const mL = greedyMatch(needLset, cap);
    let m = Math.min(cap, Math.max(mR.pairs.length, mL.pairs.length));
    if (m === 0) break;
    let rPairs = mR.pairs.slice(), lPairs = mL.pairs.slice();
    if (rPairs.length < m) rPairs = rPairs.concat(fill(R, mR.used, m - rPairs.length));
    if (lPairs.length < m) lPairs = lPairs.concat(fill(L, mL.used, m - lPairs.length));
    m = Math.min(rPairs.length, lPairs.length);
    const round = [];
    for (let i = 0; i < m; i++) {
      const [ra, rb] = rPairs[i].split('-').map(Number);
      const [la, lb] = lPairs[i].split('-').map(Number);
      needRset.delete(rPairs[i]); needLset.delete(lPairs[i]);
      const optA = (partner.has(key(ra, la)) ? 1 : 0) + (partner.has(key(rb, lb)) ? 1 : 0);
      const optB = (partner.has(key(ra, lb)) ? 1 : 0) + (partner.has(key(rb, la)) ? 1 : 0);
      const dup = optA <= optB ? [[ra, la], [rb, lb]] : [[ra, lb], [rb, la]];
      partner.add(key(dup[0][0], dup[0][1])); partner.add(key(dup[1][0], dup[1][1]));
      round.push({ duplas: dup });
    }
    if (!round.length) break;
    nGames += round.length;
    rounds.push(round);
  }
  return { rounds, nGames };
}

async function run() {
  const [players, doubles, matches, rounds] = await Promise.all([
    supabase.from('players').select('id_player, name, side, category_id, active').eq('id_tournament', ID_T).then(r => r.data || []),
    supabase.from('doubles').select('id_double, id_player1, id_player2, id_round').eq('id_tournament', ID_T).then(r => r.data || []),
    supabase.from('matches').select('id_match, status, id_double_a, id_double_b').eq('id_tournament', ID_T).then(r => r.data || []),
    supabase.from('rounds').select('id_round, round_type').eq('id_tournament', ID_T).then(r => r.data || []),
  ]);
  const pById = {}; players.forEach(p => pById[p.id_player] = p);
  const nm = id => pById[id] ? pById[id].name : ('#' + id);
  const dMap = {}; doubles.forEach(d => dMap[d.id_double] = d);
  const dRound = {}; doubles.forEach(d => dRound[d.id_double] = d.id_round);
  const exh = new Set(rounds.filter(r => r.round_type === 'EXHIBITION').map(r => r.id_round));

  const playedRight = {}, playedLeft = {}, partner = {};
  [1, 2, 3].forEach(c => { playedRight[c] = new Set(); playedLeft[c] = new Set(); partner[c] = new Set(); });
  for (const d of doubles) {
    if (!d.id_player1 || !d.id_player2) continue;
    const cat = pById[d.id_player1] && pById[d.id_player1].category_id;
    if (cat != null && partner[cat]) partner[cat].add(key(d.id_player1, d.id_player2));
  }
  for (const m of matches) {
    if (!['FINISHED', 'WO', 'IN_PROGRESS'].includes(m.status)) continue;
    if (exh.has(dRound[m.id_double_a])) continue;
    const dA = dMap[m.id_double_a], dB = dMap[m.id_double_b]; if (!dA || !dB) continue;
    const all = [dA.id_player1, dA.id_player2, dB.id_player1, dB.id_player2].filter(Boolean);
    const cat = all.map(id => pById[id] && pById[id].category_id).find(c => c != null); if (cat == null) continue;
    const side = s => x => pById[x] && pById[x].active && pById[x].side === s;
    const Ra = [dA.id_player1, dA.id_player2].find(side('RIGHT')), Rb = [dB.id_player1, dB.id_player2].find(side('RIGHT'));
    const La = [dA.id_player1, dA.id_player2].find(side('LEFT')), Lb = [dB.id_player1, dB.id_player2].find(side('LEFT'));
    if (Ra && Rb) playedRight[cat].add(key(Ra, Rb));
    if (La && Lb) playedLeft[cat].add(key(La, Lb));
  }

  let md = `# Prévia — rodadas que faltam para fechar o round-robin\n\n> PRÉVIA (nada gravado no banco). Gerado 17/06/2026. Roster ativo atual.\n> Cada jogo = dupla (dir+esq) ✕ dupla (dir+esq). nº de jogos ≈ mínimo teórico = maior lado de confrontos faltando.\n\n`;
  let totGames = 0, totRounds = 0;

  for (const cat of [1, 2, 3]) {
    const R = players.filter(p => p.category_id === cat && p.active && p.side === 'RIGHT').map(p => p.id_player);
    const L = players.filter(p => p.category_id === cat && p.active && p.side === 'LEFT').map(p => p.id_player);
    const needRset = new Set(allPairs(R).filter(k => !playedRight[cat].has(k)));
    const needLset = new Set(allPairs(L).filter(k => !playedLeft[cat].has(k)));
    const nfR = needRset.size, nfL = needLset.size;
    // piso de rodadas = jogador com mais adversários restantes (joga 1x por rodada)
    const rem = {}; [...R, ...L].forEach(p => rem[p] = 0);
    needRset.forEach(k => k.split('-').forEach(p => rem[p]++));
    needLset.forEach(k => k.split('-').forEach(p => rem[p]++));
    let pisoId = null, piso = 0; Object.entries(rem).forEach(([p, n]) => { if (n > piso) { piso = n; pisoId = p; } });
    const { rounds: sched, nGames } = buildSchedule(R, L, needRset, needLset, partner[cat]);
    totGames += nGames; totRounds += sched.length;
    const cap = Math.floor(Math.min(R.length, L.length) / 2);

    md += `## ${CATS[cat]} — ${R.length} dir × ${L.length} esq\n\n`;
    md += `- Confrontos que faltam: **${nfR} na direita · ${nfL} na esquerda**\n`;
    md += `- Plano: **${sched.length} rodadas / ${nGames} jogos** (até ${cap} jogos por quinta)\n`;
    md += `- Piso de semanas = **${piso}** (o ${nm(pisoId)} ainda tem ${piso} adversários a enfrentar, joga 1×/rodada)\n`;
    if (R.length !== L.length) md += `- ⚠️ lados desiguais (${R.length}×${L.length}): o lado menor repete ${Math.abs(nfR - nfL)} confronto(s) no fim\n`;
    md += `\n`;
    sched.forEach((rd, i) => {
      md += `**Rodada +${i + 1}** (${rd.length} jogos)\n\n`;
      rd.forEach(m => {
        const [[ra, la], [rb, lb]] = m.duplas;
        md += `- ${nm(ra)} / ${nm(la)}  ✕  ${nm(rb)} / ${nm(lb)}\n`;
      });
      md += `\n`;
    });
    console.log(`${CATS[cat]}: faltam ${nfR}dir+${nfL}esq → ${sched.length} rodadas / ${nGames} jogos (cap ${cap}/rodada · piso ${piso} sem, ${nm(pisoId)})`);
  }

  md += `---\n\n**TOTAL: ${totRounds} rodadas / ${totGames} jogos** para fechar as 3 categorias.\n`;
  console.log(`\nTOTAL: ${totRounds} rodadas / ${totGames} jogos`);
  const outPath = path.resolve(__dirname, '../../../PREVIEW_RODADAS_RESTANTES.md');
  fs.writeFileSync(outPath, md, 'utf8');
  console.log('Prévia salva em:', outPath);
}
run().catch(e => { console.error(e.message || e); process.exit(1); });
