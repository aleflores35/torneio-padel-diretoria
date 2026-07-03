/**
 * _cand_calendario_inic.js  — READ-ONLY
 * Constrói candidato de calendário para Masculino Iniciante (id_category=1, id_tournament=7)
 * usando o pareamento otimizado de sim_inic.json.
 * NÃO escreve no banco.
 *
 * Saída: cand_inic.json no scratchpad
 */

'use strict';
const supabase = require('../../supabase');
const fs = require('fs');

const ID_TOURNAMENT = 7;
const ID_CATEGORY   = 1;
const TODAY         = '2026-06-26'; // hoje (não inclui como futuro)

const SIM_PATH  = 'C:/Users/aless/AppData/Local/Temp/claude/c--obralivre/9484ee84-3113-43fa-bba2-ad6b4cbae786/scratchpad/sim_inic.json';
const OUT_PATH  = 'C:/Users/aless/AppData/Local/Temp/claude/c--obralivre/9484ee84-3113-43fa-bba2-ad6b4cbae786/scratchpad/cand_inic.json';

// ─────────────────────────────────────────────────────────────────────────────
// UTIL
// ─────────────────────────────────────────────────────────────────────────────
function toDate(val) {
  if (!val) return null;
  // scheduled_at pode ser ISO, scheduled_date é YYYY-MM-DD
  return String(val).slice(0, 10);
}

function sortedKey(a, b) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  // ── 0. Carregar sim_inic.json ──────────────────────────────────────────────
  if (!fs.existsSync(SIM_PATH)) throw new Error('sim_inic.json não encontrado em ' + SIM_PATH);
  const sim = JSON.parse(fs.readFileSync(SIM_PATH, 'utf8'));
  const novoPareamento = sim.novo_pareamento; // [{duplaA, duplaB, id_double_a, id_double_b}]
  console.log(`Pareamento otimizado: ${novoPareamento.length} jogos`);

  // ── 1a. Rounds REGULAR da cat 1 ───────────────────────────────────────────
  const { data: allRounds, error: eR } = await supabase
    .from('rounds')
    .select('id_round, id_category, round_number, scheduled_date, window_start, window_end, status, round_type')
    .eq('id_tournament', ID_TOURNAMENT)
    .eq('id_category', ID_CATEGORY)
    .eq('round_type', 'REGULAR');
  if (eR) throw new Error('rounds: ' + JSON.stringify(eR));

  allRounds.sort((a, b) => (a.round_number || 0) - (b.round_number || 0));

  const PAST_STATUS = new Set(['FINISHED', 'WO']);
  const FUTURE_STATUS = new Set(['TO_PLAY', 'IN_PROGRESS']);

  const roundById = Object.fromEntries(allRounds.map(r => [r.id_round, r]));
  // Rounds futuros: scheduled_date > hoje (status dos rounds é sempre CONFIRMED neste sistema)
  const futureRounds = allRounds.filter(r => r.scheduled_date && r.scheduled_date > TODAY);
  const pastRounds   = allRounds.filter(r => r.scheduled_date && r.scheduled_date <= TODAY);

  console.log(`Rounds REGULAR cat1: ${allRounds.length} (${pastRounds.length} passados, ${futureRounds.length} futuros)`);
  console.log('Rounds futuros:', futureRounds.map(r => `id=${r.id_round} data=${r.scheduled_date} status=${r.status}`).join(', '));

  const allRoundIds    = allRounds.map(r => r.id_round);
  const futureRoundIds = futureRounds.map(r => r.id_round);

  // ── 1b. Doubles de todos os rounds REGULAR cat1 ───────────────────────────
  let allDoubles = [];
  if (allRoundIds.length > 0) {
    const { data: d, error: eD } = await supabase
      .from('doubles')
      .select('id_double, id_player1, id_player2, id_round, display_name')
      .in('id_round', allRoundIds);
    if (eD) throw new Error('doubles: ' + JSON.stringify(eD));
    allDoubles = d || [];
  }

  const doubleById = Object.fromEntries(allDoubles.map(d => [d.id_double, d]));
  const allDoubleIds = allDoubles.map(d => d.id_double);
  const futureDoubleIds = allDoubles.filter(d => futureRoundIds.includes(d.id_round)).map(d => d.id_double);

  console.log(`Doubles cat1 total: ${allDoubles.length} (futuros: ${futureDoubleIds.length})`);

  // ── 1c. Matches de todos os doubles cat1 ──────────────────────────────────
  let allMatches = [];
  if (allDoubleIds.length > 0) {
    const { data: mA } = await supabase.from('matches')
      .select('id_match, id_double_a, id_double_b, id_court, scheduled_at, status')
      .in('id_double_a', allDoubleIds);
    const { data: mB } = await supabase.from('matches')
      .select('id_match, id_double_a, id_double_b, id_court, scheduled_at, status')
      .in('id_double_b', allDoubleIds);
    const map = {};
    for (const m of [...(mA || []), ...(mB || [])]) map[m.id_match] = m;
    // Filtrar: ambas duplas pertencem à cat1
    allMatches = Object.values(map).filter(m => doubleById[m.id_double_a] && doubleById[m.id_double_b]);
  }

  const futureMatches = allMatches.filter(m => FUTURE_STATUS.has(m.status));
  const pastMatches   = allMatches.filter(m => PAST_STATUS.has(m.status));
  // Validação cruzada: matches em rounds futuros deveriam ser TO_PLAY
  const matchesRoundFuturo = allMatches.filter(m => {
    const da = doubleById[m.id_double_a];
    return da && futureRoundIds.includes(da.id_round);
  });
  console.log(`Cross-check: matches em rounds futuros = ${matchesRoundFuturo.length} (${matchesRoundFuturo.filter(m => FUTURE_STATUS.has(m.status)).length} TO_PLAY)`);

  console.log(`Matches cat1 total: ${allMatches.length} (${pastMatches.length} passados, ${futureMatches.length} futuros)`);

  // ── 1d. Jogadores ativos cat1 ─────────────────────────────────────────────
  const { data: playersRaw, error: eP } = await supabase
    .from('players')
    .select('id_player, name, side, category_id, active')
    .eq('active', true)
    .eq('category_id', ID_CATEGORY);
  if (eP) throw new Error('players: ' + JSON.stringify(eP));
  const players = playersRaw || [];
  const playerById = Object.fromEntries(players.map(p => [p.id_player, p]));
  const rightPlayers = players.filter(p => p.side === 'RIGHT');
  const leftPlayers  = players.filter(p => p.side === 'LEFT');
  console.log(`Jogadores ativos cat1: ${players.length} (${rightPlayers.length} RIGHT, ${leftPlayers.length} LEFT)`);

  // ── 1e. Quadras ───────────────────────────────────────────────────────────
  const { data: courtsRaw } = await supabase.from('courts').select('id_court, name').eq('id_tournament', ID_TOURNAMENT);
  const courts = courtsRaw || [];
  const courtById = Object.fromEntries(courts.map(c => [c.id_court, c]));
  console.log(`Quadras: ${courts.map(c => `${c.id_court}=${c.name}`).join(', ')}`);

  // ── 1f. Ausências futuras (apenas jogadores cat1) ─────────────────────────
  const playerIds = players.map(p => p.id_player);
  let ausencias = [];
  if (playerIds.length > 0) {
    const { data: absRaw, error: eAbs } = await supabase
      .from('player_absences')
      .select('id_player, absence_date')
      .in('id_player', playerIds)
      .gt('absence_date', TODAY);
    if (eAbs) throw new Error('player_absences: ' + JSON.stringify(eAbs));
    ausencias = absRaw || [];
  }

  // Agrupar ausências por jogador
  const ausenciasByPlayer = {};
  for (const a of ausencias) {
    if (!ausenciasByPlayer[a.id_player]) ausenciasByPlayer[a.id_player] = [];
    ausenciasByPlayer[a.id_player].push(a.absence_date);
  }

  // Ausências em datas de rounds futuros
  const futureDatas = [...new Set(futureRounds.map(r => r.scheduled_date).filter(Boolean))];
  const ausenciasFutInic = players
    .filter(p => ausenciasByPlayer[p.id_player])
    .map(p => ({
      id_player: p.id_player,
      name: p.name,
      datas: ausenciasByPlayer[p.id_player].filter(d => futureDatas.includes(d)).sort()
    }))
    .filter(x => x.datas.length > 0);

  console.log(`Ausências futuras em datas de rounds futuros: ${ausenciasFutInic.length} jogadores`);
  for (const a of ausenciasFutInic) {
    console.log(`  ${a.name}: ${a.datas.join(', ')}`);
  }

  // Set de ausência por player×data para lookup rápido
  const ausenciaSet = new Set();
  for (const a of ausencias) {
    for (const d of (ausenciasByPlayer[a.id_player] || [])) {
      ausenciaSet.add(`${a.id_player}|${d}`);
    }
  }
  function estaAusente(idPlayer, data) {
    return ausenciaSet.has(`${idPlayer}|${data}`);
  }

  // ── 2. Estrutura das noites futuras ──────────────────────────────────────
  // Agrupar matches futuros por data (via scheduled_at ou round.scheduled_date)
  // e contar slots observados
  const noiteMap = {}; // data -> {capacidade, matches}
  for (const r of futureRounds) {
    const data = r.scheduled_date;
    if (!data) continue;
    if (!noiteMap[data]) noiteMap[data] = { data, round_ids: [], matches_atuais: [] };
    noiteMap[data].round_ids.push(r.id_round);
  }

  // Associar matches futuros a noites via round
  for (const m of futureMatches) {
    const da = doubleById[m.id_double_a];
    if (!da) continue;
    const round = roundById[da.id_round];
    if (!round || !round.scheduled_date) continue;
    const data = round.scheduled_date;
    if (noiteMap[data]) noiteMap[data].matches_atuais.push(m);
  }

  // Capacidade = nº de quadras × 2 (2 jogos por noite por quadra em paralelo?
  // Na prática: observar a capacidade REAL = max(matches numa noite passada) ou
  // usar quadras×slots. Aqui usamos: capacidade observada = nº de matches que
  // já estão alocados hoje nessa noite (já que é o que o sistema permite).
  // Se a noite ainda está vazia, usamos courts.length como limite por segurança.
  // Regra conservadora: capacidade = nº quadras (1 jogo por quadra por vez)
  // mas nas noites vemos múltiplos rounds => capacidade = total de matches que
  // existem hoje nessa noite.

  // Capacidade observada por noite passada (para calibrar)
  const noitePassadaMap = {};
  for (const m of pastMatches) {
    const da = doubleById[m.id_double_a];
    if (!da) continue;
    const round = roundById[da.id_round];
    if (!round || !round.scheduled_date) continue;
    const data = round.scheduled_date;
    if (!noitePassadaMap[data]) noitePassadaMap[data] = 0;
    noitePassadaMap[data]++;
  }

  // A capacidade de cada noite futura: vamos usar o número de jogos que JÁ ESTÃO
  // alocados nela hoje (n_jogos_hoje). Se for 0, usaremos courts.length como mínimo.
  // O candidato não deve ter mais jogos do que a capacidade.
  const noites = Object.values(noiteMap).sort((a, b) => a.data.localeCompare(b.data));
  for (const n of noites) {
    n.n_jogos_hoje = n.matches_atuais.length;
    // Capacidade = max entre o atual e o mínimo de 1 jogo
    // Se não há jogos hoje (round vazio), estimamos pelo número de rodadas nessa data × 1 jogo/round
    // Mas como não sabemos a capacidade real sem jogos, usamos round_ids.length como proxy
    n.capacidade = n.n_jogos_hoje > 0 ? n.n_jogos_hoje : Math.max(courts.length || 2, n.round_ids.length);
    n.n_jogos_candidato = 0; // será preenchido
  }

  console.log('\nEstrutura de noites futuras:');
  for (const n of noites) {
    console.log(`  ${n.data}: ${n.n_jogos_hoje} jogos hoje, capacidade=${n.capacidade}`);
  }

  // ── 3. Identificar duplas repetidas (histórico passado + futuros atuais) ──
  // Parceria = (id_player1, id_player2) do double — mesma parceria em 2+ doubles REGULAR cat1
  const parceriasMap = {}; // "p1|p2" -> [{id_double, id_round, display_name}]
  for (const d of allDoubles) {
    if (!d.id_player1 || !d.id_player2) continue;
    const key = `${d.id_player1}|${d.id_player2}`;
    if (!parceriasMap[key]) parceriasMap[key] = [];
    parceriasMap[key].push({ id_double: d.id_double, id_round: d.id_round, display_name: d.display_name });
  }

  const duplasRepetidas = [];
  for (const [key, dlist] of Object.entries(parceriasMap)) {
    if (dlist.length > 1) {
      const [p1, p2] = key.split('|').map(Number);
      const pl1 = playerById[p1];
      const pl2 = playerById[p2];

      // Encontrar matches dessas doubles
      const doubleIdsRep = dlist.map(d => d.id_double);
      const matchesRep = allMatches.filter(m =>
        doubleIdsRep.includes(m.id_double_a) || doubleIdsRep.includes(m.id_double_b)
      );

      duplasRepetidas.push({
        dupla: `${pl1?.name || p1} / ${pl2?.name || p2}`,
        id_player1: p1,
        id_player2: p2,
        vezes: dlist.length,
        doubles: dlist,
        matches_ids: matchesRep.map(m => m.id_match),
        paridade_ok: dlist.length <= 2 // 1 repetição tolerada ("paridade")
      });
    }
  }

  console.log(`\nParcerias repetidas encontradas: ${duplasRepetidas.length}`);
  for (const dr of duplasRepetidas) {
    console.log(`  ${dr.dupla}: ${dr.vezes}x (paridade_ok=${dr.paridade_ok})`);
  }

  // ── 4. Levantamento de jogos FUTUROS ATUAIS (antes do candidato) ──────────
  // Cada jogo futuro atual: id_match, duplas, round, data, quadra, horário
  const jogosFuturosAtuais = futureMatches.map(m => {
    const da = doubleById[m.id_double_a];
    const db = doubleById[m.id_double_b];
    const round = roundById[da?.id_round];
    return {
      id_match: m.id_match,
      id_double_a: m.id_double_a,
      id_double_b: m.id_double_b,
      display_a: da?.display_name || String(m.id_double_a),
      display_b: db?.display_name || String(m.id_double_b),
      id_round: da?.id_round,
      data: round?.scheduled_date || toDate(m.scheduled_at),
      id_court: m.id_court,
      quadra: courtById[m.id_court]?.name || String(m.id_court),
      scheduled_at: m.scheduled_at,
      horario: m.scheduled_at ? String(m.scheduled_at).slice(11, 16) : null,
    };
  });

  // Map id_double -> data do jogo atual (para comparar com o candidato)
  const doubleDataAtual = {};
  for (const j of jogosFuturosAtuais) {
    doubleDataAtual[j.id_double_a] = j.data;
    doubleDataAtual[j.id_double_b] = j.data;
  }

  // ── 5. Mapa de confrontos históricos de mesma posição (ANTES) ─────────────
  // Para calcular métrica antes/depois
  function buildConfrontosMesmaPos(matchList, doubleById) {
    const right = {}; // "idA|idB" -> vezes
    const left  = {};
    for (const m of matchList) {
      const da = doubleById[m.id_double_a];
      const db = doubleById[m.id_double_b];
      if (!da || !db) continue;
      // RIGHT: p1 de da vs p1 de db
      if (da.id_player1 && db.id_player1) {
        const k = sortedKey(da.id_player1, db.id_player1);
        right[k] = (right[k] || 0) + 1;
      }
      // LEFT: p2 de da vs p2 de db
      if (da.id_player2 && db.id_player2) {
        const k = sortedKey(da.id_player2, db.id_player2);
        left[k] = (left[k] || 0) + 1;
      }
    }
    let rep = 0;
    for (const v of Object.values(right)) if (v > 1) rep += v - 1;
    for (const v of Object.values(left))  if (v > 1) rep += v - 1;
    return { right, left, rep };
  }

  const confHistPast   = buildConfrontosMesmaPos(pastMatches, doubleById);
  const confHistFuture = buildConfrontosMesmaPos(futureMatches, doubleById);
  // Total "antes" = passado + futuro atual
  function mergeConfs(a, b) {
    const right = { ...a.right };
    const left  = { ...a.left };
    for (const [k, v] of Object.entries(b.right)) right[k] = (right[k] || 0) + v;
    for (const [k, v] of Object.entries(b.left))  left[k]  = (left[k]  || 0) + v;
    let rep = 0;
    for (const v of Object.values(right)) if (v > 1) rep += v - 1;
    for (const v of Object.values(left))  if (v > 1) rep += v - 1;
    return { right, left, rep };
  }
  const confAntesFuturo = confHistFuture;
  const confAntesTotal  = mergeConfs(confHistPast, confHistFuture);

  console.log(`\nMétricas ANTES — mesma posição:`);
  console.log(`  Total (passado+futuro_atual): ${confAntesTotal.rep}`);
  console.log(`  Só futuro atual: ${confAntesFuturo.rep}`);

  // ── 6. Alocar o candidato nas noites ──────────────────────────────────────
  // Estratégia: primeiro fixar same-round (sem escolha de data), depois
  // backtracking nos cross-round (22 jogos) com MRV dinâmico.

  // Mapa double -> data do seu round
  function getDataDouble(idDouble) {
    const d = doubleById[idDouble];
    if (!d) return null;
    const r = roundById[d.id_round];
    return r?.scheduled_date || null;
  }

  function jogadoresDouble(id_double) {
    const d = doubleById[id_double];
    if (!d) return [];
    return [d.id_player1, d.id_player2].filter(Boolean);
  }

  // Verificações de parceria
  const parceriasExistentes = new Set(allDoubles.map(d => `${d.id_player1}|${d.id_player2}`));
  let sem_parceria_nova = true;
  for (const j of novoPareamento) {
    for (const idD of [j.id_double_a, j.id_double_b]) {
      const d = doubleById[idD];
      if (!d) { sem_parceria_nova = false; continue; }
      if (!parceriasExistentes.has(`${d.id_player1}|${d.id_player2}`)) sem_parceria_nova = false;
    }
  }

  const doublesCandidato = novoPareamento.flatMap(j => [j.id_double_a, j.id_double_b]);
  const contaDouble = {};
  for (const id of doublesCandidato) contaDouble[id] = (contaDouble[id] || 0) + 1;
  const cadaDupla1xStrict = Object.values(contaDouble).every(v => v === 1);

  const datas_noites = noites.map(n => n.data);

  // Classificar same-round e cross-round
  const jogosSR = [], jogosCR = [];
  for (const j of novoPareamento) {
    const da = doubleById[j.id_double_a], db = doubleById[j.id_double_b];
    const dataA = getDataDouble(j.id_double_a);
    const dataB = getDataDouble(j.id_double_b);
    const pids = [...jogadoresDouble(j.id_double_a), ...jogadoresDouble(j.id_double_b)];
    if (dataA === dataB) {
      jogosSR.push({ ...j, data: dataA, dataOriginal: dataA, pids });
    } else {
      jogosCR.push({ ...j, dataOriginal: dataA, pids,
        prefs: [...new Set([dataA, dataB, ...datas_noites].filter(Boolean))],
      });
    }
  }

  console.log(`\nClassificação: ${jogosSR.length} same-round + ${jogosCR.length} cross-round`);

  // Estado
  const capRestante = {};
  const jogNaNoite  = {};
  for (const n of noites) { capRestante[n.data] = n.capacidade; jogNaNoite[n.data] = new Set(); }

  // Alocar same-round (fixo — sem escolha)
  const sameRoundAlocados = [];
  for (const j of jogosSR) {
    if (!j.data || (capRestante[j.data] || 0) <= 0) {
      console.warn(`  AVISO same-round sem cap: ${j.duplaA} vs ${j.duplaB} em ${j.data}`);
      continue;
    }
    if (j.pids.some(pid => estaAusente(pid, j.data))) {
      console.warn(`  AVISO same-round ausência: ${j.duplaA} vs ${j.duplaB} em ${j.data}`);
    }
    capRestante[j.data]--;
    for (const pid of j.pids) jogNaNoite[j.data].add(pid);
    sameRoundAlocados.push(j);
  }

  console.log('Slots restantes após same-round:',
    Object.entries(capRestante).filter(([,v])=>v>0).map(([d,v])=>`${d}:${v}`).join(' | '));

  // Backtracking nos cross-round (MRV dinâmico + recursão limitada)
  function datasValidasCR(j) {
    return j.prefs.filter(data =>
      (capRestante[data] || 0) > 0 &&
      !j.pids.some(pid => estaAusente(pid, data)) &&
      !j.pids.some(pid => jogNaNoite[data].has(pid))
    );
  }

  let btIter = 0;
  const MAX_BT = 1000000;
  const btResult = []; // {jogo, data}

  function btCross(pendentes) {
    if (pendentes.length === 0) return true;
    btIter++;
    if (btIter > MAX_BT) return false;

    // MRV dinâmico: escolher o mais restrito
    let melhorIdx = 0, melhorN = Infinity;
    for (let i = 0; i < pendentes.length; i++) {
      const dv = datasValidasCR(pendentes[i]);
      if (dv.length < melhorN) { melhorN = dv.length; melhorIdx = i; }
    }
    if (melhorN === 0) return false; // sem saída

    const j = pendentes[melhorIdx];
    const dv = datasValidasCR(j);
    const resto = [...pendentes.slice(0, melhorIdx), ...pendentes.slice(melhorIdx + 1)];

    for (const data of dv) {
      btIter++;
      if (btIter > MAX_BT) return false;
      capRestante[data]--;
      for (const pid of j.pids) jogNaNoite[data].add(pid);
      btResult.push({ j, data });
      if (btCross(resto)) return true;
      btResult.pop();
      capRestante[data]++;
      for (const pid of j.pids) jogNaNoite[data].delete(pid);
    }
    return false;
  }

  console.log('\nRodando backtracking em cross-round...');
  const btOk = btCross([...jogosCR]);
  console.log(`Backtracking cross-round: ${btIter} iterações, ${btOk ? 'SOLUÇÃO' : 'IMPOSSÍVEL'}`);

  const candidatoJogos = [];
  const naoAlocados = [];
  const bloqueioEstrutural = !btOk;

  // Montar same-round alocados
  for (const j of sameRoundAlocados) {
    const da = doubleById[j.id_double_a], db = doubleById[j.id_double_b];
    candidatoJogos.push({
      data: j.data, data_original: j.dataOriginal, quadra: null, horario: null,
      duplaA: j.duplaA, duplaB: j.duplaB,
      id_double_a: j.id_double_a, id_double_b: j.id_double_b,
      mudou_de_noite: false,
      id_player1_a: da?.id_player1, id_player2_a: da?.id_player2,
      id_player1_b: db?.id_player1, id_player2_b: db?.id_player2,
      key_right: da?.id_player1 && db?.id_player1 ? sortedKey(da.id_player1, db.id_player1) : null,
      key_left:  da?.id_player2 && db?.id_player2 ? sortedKey(da.id_player2, db.id_player2) : null,
    });
  }

  if (btOk) {
    for (const { j, data } of btResult) {
      const da = doubleById[j.id_double_a], db = doubleById[j.id_double_b];
      candidatoJogos.push({
        data, data_original: j.dataOriginal, quadra: null, horario: null,
        duplaA: j.duplaA, duplaB: j.duplaB,
        id_double_a: j.id_double_a, id_double_b: j.id_double_b,
        mudou_de_noite: data !== j.dataOriginal,
        id_player1_a: da?.id_player1, id_player2_a: da?.id_player2,
        id_player1_b: db?.id_player1, id_player2_b: db?.id_player2,
        key_right: da?.id_player1 && db?.id_player1 ? sortedKey(da.id_player1, db.id_player1) : null,
        key_left:  da?.id_player2 && db?.id_player2 ? sortedKey(da.id_player2, db.id_player2) : null,
      });
    }
  } else {
    // Fallback: alocar o máximo possível de cross-round (para diagnosticar)
    // Re-inicializar estado pós same-round
    const capF = {}; const jogF = {};
    for (const n of noites) { capF[n.data] = n.capacidade; jogF[n.data] = new Set(); }
    for (const j of sameRoundAlocados) {
      capF[j.data]--;
      for (const pid of j.pids) jogF[j.data].add(pid);
    }
    // Ordenar cross-round por datas válidas ascendente (guloso)
    const crOrd = jogosCR.map(j => ({
      ...j,
      dv: j.prefs.filter(d => (capF[d]||0)>0 && !j.pids.some(p=>estaAusente(p,d)) && !j.pids.some(p=>jogF[d].has(p)))
    })).sort((a,b)=>a.dv.length-b.dv.length);
    for (const j of crOrd) {
      const datas = j.prefs.filter(d=>(capF[d]||0)>0&&!j.pids.some(p=>estaAusente(p,d))&&!j.pids.some(p=>jogF[d].has(p)));
      if (datas.length > 0) {
        const data = datas[0];
        capF[data]--; for (const pid of j.pids) jogF[data].add(pid);
        const da=doubleById[j.id_double_a],db=doubleById[j.id_double_b];
        candidatoJogos.push({
          data, data_original: j.dataOriginal, quadra:null, horario:null,
          duplaA:j.duplaA, duplaB:j.duplaB,
          id_double_a:j.id_double_a, id_double_b:j.id_double_b,
          mudou_de_noite: data!==j.dataOriginal,
          id_player1_a:da?.id_player1, id_player2_a:da?.id_player2,
          id_player1_b:db?.id_player1, id_player2_b:db?.id_player2,
          key_right: da?.id_player1&&db?.id_player1?sortedKey(da.id_player1,db.id_player1):null,
          key_left:  da?.id_player2&&db?.id_player2?sortedKey(da.id_player2,db.id_player2):null,
        });
      } else {
        naoAlocados.push({ ...j, motivo: 'bloqueio estrutural — Gustavo Bock aparece em 3 jogos com apenas {07/23, 08/27} disponíveis' });
      }
    }
  }

  candidatoJogos.sort((a, b) => a.data.localeCompare(b.data));

  // (candidatoJogos e naoAlocados montados)

  // Atualizar n_jogos_candidato nas noites
  for (const j of candidatoJogos) {
    const noite = noites.find(n => n.data === j.data);
    if (noite) noite.n_jogos_candidato++;
  }

  // ── 7. Calcular mesma_pos_repete por jogo do candidato ────────────────────
  // Construir mapa de confrontos do candidato (incluindo passado)
  const confCandRight = { ...confHistPast.right };
  const confCandLeft  = { ...confHistPast.left };

  for (const j of candidatoJogos) {
    if (j.key_right) confCandRight[j.key_right] = (confCandRight[j.key_right] || 0) + 1;
    if (j.key_left)  confCandLeft[j.key_left]   = (confCandLeft[j.key_left]   || 0) + 1;
  }

  // Marcar em cada jogo se a posição se repete no total (candidato + passado)
  // Reconstruir em ordem para detectar 1ª vez vs repetição
  const tempRight = { ...confHistPast.right };
  const tempLeft  = { ...confHistPast.left };

  for (const j of candidatoJogos) {
    let repPos = false;
    if (j.key_right) {
      if ((tempRight[j.key_right] || 0) >= 1) repPos = true;
      tempRight[j.key_right] = (tempRight[j.key_right] || 0) + 1;
    }
    if (j.key_left) {
      if ((tempLeft[j.key_left] || 0) >= 1) repPos = true;
      tempLeft[j.key_left] = (tempLeft[j.key_left] || 0) + 1;
    }
    j.mesma_pos_repete = repPos;
  }

  // Métricas DEPOIS
  let mesmaPosCandFuturo = 0;
  for (const j of candidatoJogos) if (j.mesma_pos_repete) mesmaPosCandFuturo++;

  // Total (passado + candidato)
  let mesmaPosCandTotal = 0;
  for (const v of Object.values(confCandRight)) if (v > 1) mesmaPosCandTotal += v - 1;
  for (const v of Object.values(confCandLeft))  if (v > 1) mesmaPosCandTotal += v - 1;

  // Métricas ANTES futuro (baseado em sim_inic.json)
  const mesmaPosFuturoAntes = sim.antes?.total_futuro ?? confAntesFuturo.rep;
  const mesmaPosTotalAntes  = sim.antes ? (sim.antes.rep_direita + sim.antes.rep_esquerda) : confAntesTotal.rep;
  // Nota: sim_inic usa números ligeiramente diferentes (total_geral inclui HISTORICAL)
  // Usar confAntesTotal.rep como base real do banco

  console.log(`\nMétricas DEPOIS — mesma posição:`);
  console.log(`  Total (passado+candidato): ${mesmaPosCandTotal}`);
  console.log(`  Só candidato futuro: ${mesmaPosCandFuturo}`);

  const jogosRemanejados = candidatoJogos.filter(j => j.mudou_de_noite).length;
  console.log(`Jogos remanejados de noite: ${jogosRemanejados}`);
  console.log(`Jogos não alocados: ${naoAlocados.length}`);
  if (naoAlocados.length > 0) {
    for (const na of naoAlocados) {
      console.log(`  NAO ALOCADO: ${na.duplaA} vs ${na.duplaB} | motivo: ${na.motivo}`);
    }
  }

  // ── 8. Validações ─────────────────────────────────────────────────────────
  const violacoes = [];

  // (a) nenhuma parceria nova
  if (!sem_parceria_nova) violacoes.push('Parceria nova detectada (double não encontrado no banco)');

  // (b) sem dupla repetida NOVA além das já existentes
  // Duplas repetidas no candidato = doubles que aparecem >1x
  const doublesEmJogos = candidatoJogos.flatMap(j => [j.id_double_a, j.id_double_b]);
  const contaDoublesJogos = {};
  for (const id of doublesEmJogos) contaDoublesJogos[id] = (contaDoublesJogos[id] || 0) + 1;
  const dupRepNova = Object.entries(contaDoublesJogos).filter(([, v]) => v > 1);
  const sem_dupla_repetida_nova = dupRepNova.length === 0;
  if (!sem_dupla_repetida_nova) {
    for (const [id, v] of dupRepNova) {
      const d = doubleById[id];
      violacoes.push(`Double ${id} (${d?.display_name}) aparece ${v}x no candidato`);
    }
  }

  // (c) ninguém 2× na mesma noite
  // Verificar no candidato: por noite, listar todos os jogadores
  const noiteJogChek = {};
  for (const j of candidatoJogos) {
    if (!noiteJogChek[j.data]) noiteJogChek[j.data] = [];
    noiteJogChek[j.data].push(...[j.id_player1_a, j.id_player2_a, j.id_player1_b, j.id_player2_b].filter(Boolean));
  }
  let ninguem2xNoite = true;
  for (const [data, pids] of Object.entries(noiteJogChek)) {
    const contaPid = {};
    for (const pid of pids) contaPid[pid] = (contaPid[pid] || 0) + 1;
    for (const [pid, cnt] of Object.entries(contaPid)) {
      if (cnt > 1) {
        ninguem2xNoite = false;
        const pl = playerById[pid];
        violacoes.push(`${pl?.name || pid} aparece ${cnt}x na noite ${data}`);
      }
    }
  }

  // (d) ninguém escalado em data de ausência
  let ninguemEmAusencia = true;
  for (const j of candidatoJogos) {
    const pids = [j.id_player1_a, j.id_player2_a, j.id_player1_b, j.id_player2_b].filter(Boolean);
    for (const pid of pids) {
      if (estaAusente(pid, j.data)) {
        ninguemEmAusencia = false;
        const pl = playerById[pid];
        violacoes.push(`${pl?.name || pid} escalado em ${j.data} mas tem ausência declarada`);
      }
    }
  }

  // (e) cada dupla futura aparece 1×
  const eachDupla1x = cadaDupla1xStrict && naoAlocados.length === 0;
  if (!cadaDupla1xStrict) violacoes.push('Algum double aparece mais de 1× no novo_pareamento');
  if (naoAlocados.length > 0) violacoes.push(`${naoAlocados.length} jogo(s) não alocado(s): ` + naoAlocados.map(n => `${n.duplaA} vs ${n.duplaB}`).join('; '));

  // (f) capacidade respeitada
  let capacidadeOk = true;
  for (const n of noites) {
    if (n.n_jogos_candidato > n.capacidade) {
      capacidadeOk = false;
      violacoes.push(`Noite ${n.data}: candidato tem ${n.n_jogos_candidato} jogos mas capacidade é ${n.capacidade}`);
    }
  }

  // ── 9. Montar JSON de saída ────────────────────────────────────────────────
  const output = {
    gerado_em: new Date().toISOString(),
    id_tournament: ID_TOURNAMENT,
    id_category: ID_CATEGORY,
    noites_futuras: noites.map(n => ({
      data: n.data,
      capacidade: n.capacidade,
      n_jogos_hoje: n.n_jogos_hoje,
      n_jogos_candidato: n.n_jogos_candidato,
      round_ids: n.round_ids,
    })),
    ausencias_futuras_inic: ausenciasFutInic,
    duplas_repetidas: duplasRepetidas.map(dr => ({
      dupla: dr.dupla,
      vezes: dr.vezes,
      matches: dr.matches_ids,
      doubles: dr.doubles.map(d => d.id_double),
      paridade_ok: dr.paridade_ok,
    })),
    nao_alocados: naoAlocados.map(n => ({
      duplaA: n.duplaA,
      duplaB: n.duplaB,
      id_double_a: n.id_double_a,
      id_double_b: n.id_double_b,
      data_original: n.dataOriginal,
      motivo: n.motivo,
    })),
    candidato_jogos: candidatoJogos.map(j => ({
      data: j.data,
      data_original: j.data_original,
      quadra: j.quadra,
      horario: j.horario,
      duplaA: j.duplaA,
      duplaB: j.duplaB,
      id_double_a: j.id_double_a,
      id_double_b: j.id_double_b,
      mudou_de_noite: j.mudou_de_noite,
      mesma_pos_repete: j.mesma_pos_repete,
    })),
    metricas: {
      mesma_pos_antes_total: confAntesTotal.rep,
      mesma_pos_depois_total: mesmaPosCandTotal,
      mesma_pos_antes_futuro: confAntesFuturo.rep,
      mesma_pos_depois_futuro: mesmaPosCandFuturo,
      jogos_remanejados: jogosRemanejados,
      jogos_nao_alocados: naoAlocados.length,
    },
    validacao: {
      sem_parceria_nova,
      sem_dupla_repetida_nova,
      ninguem_2x_noite: ninguem2xNoite,
      ninguem_em_ausencia: ninguemEmAusencia,
      cada_dupla_1x: eachDupla1x,
      capacidade_ok: capacidadeOk,
      violacoes,
    }
  };

  fs.writeFileSync(OUT_PATH, JSON.stringify(output, null, 2), 'utf8');
  console.log(`\nJSON salvo em: ${OUT_PATH}`);

  // ── 10. Resumo PT-BR ──────────────────────────────────────────────────────
  const valOk = violacoes.length === 0;
  console.log('\n' + '='.repeat(72));
  console.log('RESUMO — Candidato de Calendário Masculino Iniciante (cat 1)');
  console.log('='.repeat(72));
  console.log(`Status geral: ${valOk ? 'VÁLIDO (todas as validações passaram)' : 'INVÁLIDO — ver violações abaixo'}`);
  console.log(`\nMétricas de repetição de mesma posição:`);
  console.log(`  Total (passado+futuro) ANTES:  ${confAntesTotal.rep}`);
  console.log(`  Total (passado+futuro) DEPOIS: ${mesmaPosCandTotal}`);
  console.log(`  Só futuro ANTES:  ${confAntesFuturo.rep}`);
  console.log(`  Só futuro DEPOIS: ${mesmaPosCandFuturo}`);
  console.log(`  Ganho total: -${confAntesTotal.rep - mesmaPosCandTotal} repetições`);
  console.log(`\nJogos remanejados de noite: ${jogosRemanejados}`);
  console.log(`Jogos não alocados: ${naoAlocados.length}`);
  if (naoAlocados.length > 0) {
    console.log('  ATENÇÃO — jogos que não couberam em nenhuma noite:');
    for (const na of naoAlocados) {
      console.log(`    ${na.duplaA} vs ${na.duplaB} | motivo: ${na.motivo}`);
    }
  }
  console.log(`\nParceria(s) repetida(s) encontrada(s): ${duplasRepetidas.length}`);
  for (const dr of duplasRepetidas) {
    console.log(`  ${dr.dupla}: ${dr.vezes}x | paridade_ok=${dr.paridade_ok} (matches: ${dr.matches_ids.join(', ')})`);
  }
  console.log(`\nAusências futuras (em datas de rounds futuros): ${ausenciasFutInic.length} jogador(es)`);
  for (const a of ausenciasFutInic) {
    console.log(`  ${a.name}: ${a.datas.join(', ')}`);
  }
  console.log('\nNoites futuras (candidato):');
  for (const n of noites) {
    const status = n.n_jogos_candidato > n.capacidade ? ' ESTOURO!' : '';
    console.log(`  ${n.data}: ${n.n_jogos_candidato}/${n.capacidade} jogos${status}`);
  }
  console.log('\nValidações:');
  console.log(`  sem_parceria_nova:       ${sem_parceria_nova}`);
  console.log(`  sem_dupla_repetida_nova: ${sem_dupla_repetida_nova}`);
  console.log(`  ninguem_2x_noite:        ${ninguem2xNoite}`);
  console.log(`  ninguem_em_ausencia:     ${ninguemEmAusencia}`);
  console.log(`  cada_dupla_1x:           ${eachDupla1x}`);
  console.log(`  capacidade_ok:           ${capacidadeOk}`);
  if (violacoes.length > 0) {
    console.log('\nVIOLAÇÕES:');
    for (const v of violacoes) console.log('  - ' + v);
  }
  console.log('='.repeat(72));
}

main().catch(e => { console.error('ERRO:', e.message || e); process.exit(1); });
