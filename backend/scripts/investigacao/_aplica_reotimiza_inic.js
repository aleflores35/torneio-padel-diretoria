/**
 * _aplica_reotimiza_inic.js
 *
 * Aplica as 3 mudanças decididas pelo Alessandro no calendário
 * da Masculino Iniciante (id_category=1, id_tournament=7):
 *
 *   1. REMOVE o match 1452 (dupla repetida Alexandre/Diego em 27/08 — round 32).
 *      Se o double 3187 ficar órfão (sem outro match), deleta o double também.
 *   2. MOVE o match 1390 (Diego Pohlmann/Alisson × Andre Hoppe/Diego Schutz)
 *      de 02/07 (round 14) para 16/07 (round 20). Atualiza id_round dos doubles
 *      3062 e 3063 e o scheduled_at do match.
 *   3. RE-PAREIA por noite TODAS as noites futuras da cat 1.
 *      Minimiza repetição de mesma posição (RIGHT vs RIGHT, LEFT vs LEFT)
 *      processando as noites em ordem cronológica e acumulando o histórico
 *      (passado + noites já re-pareadas). Mantém cada dupla na sua noite e
 *      sem jogador no mesmo jogo 2× (duplas com jogador em comum não se enfrentam).
 *
 * Definição de "mesma posição" idêntica ao cand_pornoite.js:
 *   - RIGHT key = par ordenado {id_player1 da duplaA, id_player1 da duplaB}
 *   - LEFT  key = par ordenado {id_player2 da duplaA, id_player2 da duplaB}
 *   - convenção do schema: id_player1 = RIGHT, id_player2 = LEFT
 *   - cada match contribui 0/1/2 repetições. "só-futuro" = par cuja contagem no
 *     passado é 0 (a repetição nasceu inteiramente entre jogos futuros).
 *   - passado = matches FINISHED/WO; futuro = matches TO_PLAY.
 *
 * DRY-RUN por default. Para gravar: CONFIRM_EXECUTE=yes node script.js
 * Salva candidato em scratchpad/cand_final_inic.json.
 *
 * GRAVAÇÃO: além da remoção + swap, grava o re-pareamento de TODAS as noites
 * (cada match futuro cujo par mudou recebe UPDATE de id_double_a/id_double_b).
 */

'use strict';

const supabase = require('../../supabase');
const fs = require('fs');
const path = require('path');

const DRY_RUN = process.env.CONFIRM_EXECUTE !== 'yes';
const SCRATCHPAD = 'C:/Users/aless/AppData/Local/Temp/claude/c--obralivre/9484ee84-3113-43fa-bba2-ad6b4cbae786/scratchpad';

// IDs fixos decididos pelo Alessandro
const MATCH_REMOVER  = 1452; // dupla Alexandre/Diego repetida em 27/08
const DOUBLE_ORFA    = 3187; // double Alexandre/Diego do round 32 — deletar se órfão
const MATCH_MOVER    = 1390; // Diego Pohlmann/Alisson × Andre Hoppe/Diego Schutz
const ROUND_ORIGEM   = 432;  // round 14 / 02/07
const ROUND_DESTINO  = 438;  // round 20 / 16/07
const DATA_DESTINO   = '2026-07-16';
const DOUBLE_ALISSON = 3063; // Diego Pohlmann / Alisson Boyink
const DOUBLE_ANDRE   = 3062; // Andre Hoppe / Diego Schutz
const ID_CATEGORY    = 1;
const ID_TOURNAMENT  = 7;
const TODAY          = '2026-06-27';

// ─── Utilitários ─────────────────────────────────────────────────────────────

function buildIndex(arr, key) {
  const idx = {};
  for (const item of arr) idx[item[key]] = item;
  return idx;
}

// Chaves de posição — idênticas ao cand_pornoite.js (player1=RIGHT, player2=LEFT)
function rightKey(da, db) { return [da.id_player1, db.id_player1].sort((a, b) => a - b).join('|'); }
function leftKey(da, db)  { return [da.id_player2, db.id_player2].sort((a, b) => a - b).join('|'); }

// Duas duplas só podem se enfrentar se não têm jogador em comum
function duplasCompativeis(da, db) {
  const pa = new Set([da.id_player1, da.id_player2]);
  return ![db.id_player1, db.id_player2].some(p => pa.has(p));
}

// Custo de um matching = nº de pares de posição já vistos no acumulado
function custoMatching(matching, rightAcum, leftAcum) {
  let c = 0;
  for (const [da, db] of matching) {
    if ((rightAcum[rightKey(da, db)] || 0) > 0) c++;
    if ((leftAcum[leftKey(da, db)] || 0) > 0) c++;
  }
  return c;
}

// Gera matchings exaustivos (todas as duplas pareadas, sem jogador em comum no jogo)
function gerarMatchings(duplas) {
  if (duplas.length < 2) return [[]];
  const matchings = [];
  const nJogos = Math.floor(duplas.length / 2);
  function backtrack(remaining, current) {
    if (current.length === nJogos) { matchings.push([...current]); return; }
    if (remaining.length < 2) return;
    const first = remaining[0];
    const rest = remaining.slice(1);
    for (let i = 0; i < rest.length; i++) {
      const partner = rest[i];
      if (!duplasCompativeis(first, partner)) continue;
      const newRemaining = rest.filter((_, idx) => idx !== i);
      current.push([first, partner]);
      backtrack(newRemaining, current);
      current.pop();
    }
  }
  backtrack(duplas, []);
  return matchings.length > 0 ? matchings : [[]];
}

// Greedy para noites grandes (>12 duplas — exaustivo inviável)
function gerarMatchingGreedy(duplas, rightAcum, leftAcum) {
  const remaining = [...duplas];
  const matching = [];
  while (remaining.length >= 2) {
    const first = remaining.shift();
    let bestIdx = -1, bestCost = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const partner = remaining[i];
      if (!duplasCompativeis(first, partner)) continue;
      const c = ((rightAcum[rightKey(first, partner)] || 0) > 0 ? 1 : 0) +
                ((leftAcum[leftKey(first, partner)] || 0) > 0 ? 1 : 0);
      if (c < bestCost) { bestCost = c; bestIdx = i; }
    }
    if (bestIdx >= 0) matching.push([first, remaining.splice(bestIdx, 1)[0]]);
  }
  return matching;
}

// ─── Carregamento do banco ────────────────────────────────────────────────────

async function carregarEstado() {
  const { data: rounds, error: eR } = await supabase
    .from('rounds')
    .select('id_round, id_category, round_number, scheduled_date, round_type, status')
    .eq('id_tournament', ID_TOURNAMENT)
    .eq('id_category', ID_CATEGORY)
    .eq('round_type', 'REGULAR')
    .order('round_number');
  if (eR) throw new Error('rounds: ' + eR.message);

  const roundIds = rounds.map(r => r.id_round);

  const { data: doubles, error: eD } = await supabase
    .from('doubles')
    .select('id_double, id_player1, id_player2, id_round, display_name')
    .in('id_round', roundIds);
  if (eD) throw new Error('doubles: ' + eD.message);

  const doubleIds = doubles.map(d => d.id_double);

  // Matches via id_double_a (mesma convenção do cand_pornoite)
  const { data: matches, error: eM } = await supabase
    .from('matches')
    .select('id_match, id_double_a, id_double_b, id_court, scheduled_at, status')
    .in('id_double_a', doubleIds)
    .order('id_match');
  if (eM) throw new Error('matches: ' + eM.message);

  const { data: players, error: eP } = await supabase
    .from('players')
    .select('id_player, name, side, category_id, active')
    .eq('category_id', ID_CATEGORY);
  if (eP) throw new Error('players: ' + eP.message);

  const playerIds = players.map(p => p.id_player);
  const { data: absences, error: eA } = await supabase
    .from('player_absences')
    .select('id_player, absence_date')
    .in('id_player', playerIds);
  if (eA) throw new Error('absences: ' + eA.message);

  return { rounds, doubles, matches, players, absences: absences || [] };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  _aplica_reotimiza_inic.js — ${DRY_RUN ? 'DRY-RUN' : '*** GRAVAÇÃO REAL ***'}`);
  console.log(`${'='.repeat(60)}\n`);

  console.log('=== CARREGANDO ESTADO DO BANCO ===\n');
  const { rounds, doubles, matches, players, absences } = await carregarEstado();
  console.log(`  Rounds REGULAR: ${rounds.length}`);
  console.log(`  Doubles: ${doubles.length}`);
  console.log(`  Matches (via double_a): ${matches.length}`);
  console.log(`  Players: ${players.length}`);
  console.log(`  Ausências: ${absences.length}`);

  const roundIdx  = buildIndex(rounds, 'id_round');
  const playerIdx = buildIndex(players, 'id_player');

  // Clonar para trabalho em memória
  let doublesM = doubles.map(d => ({ ...d }));
  let matchesM = matches.map(m => ({ ...m }));
  const doubleMap = () => buildIndex(doublesM, 'id_double');

  // Classificação passado/futuro pelo STATUS DO MATCH (igual ao cand_pornoite)
  const PAST_STATUSES = ['FINISHED', 'WO'];

  // ── Mudança 1: REMOVER match 1452 ──────────────────────────────────────────
  console.log('\n--- MUDANÇA 1: REMOVER match 1452 ---');
  const m1452 = matchesM.find(m => m.id_match === MATCH_REMOVER);
  if (!m1452) throw new Error(`match ${MATCH_REMOVER} não encontrado`);
  console.log(`  Match 1452: double_a=${m1452.id_double_a}, double_b=${m1452.id_double_b}`);
  matchesM = matchesM.filter(m => m.id_match !== MATCH_REMOVER);

  const double3187Orfao = !matchesM.some(m => m.id_double_a === DOUBLE_ORFA || m.id_double_b === DOUBLE_ORFA);
  console.log(`  Double 3187 órfão após remoção: ${double3187Orfao}`);
  if (double3187Orfao) {
    doublesM = doublesM.filter(d => d.id_double !== DOUBLE_ORFA);
    console.log(`  → Double 3187 marcado para DELETE`);
  }

  // ── Mudança 2: MOVER match 1390 para round 20 ─────────────────────────────
  console.log('\n--- MUDANÇA 2: MOVER match 1390 para 16/07 ---');
  const m1390 = matchesM.find(m => m.id_match === MATCH_MOVER);
  if (!m1390) throw new Error(`match ${MATCH_MOVER} não encontrado`);
  console.log(`  Match 1390: double_a=${m1390.id_double_a}, double_b=${m1390.id_double_b}, at=${m1390.scheduled_at}`);

  const dAlisson = doublesM.find(d => d.id_double === DOUBLE_ALISSON);
  const dAndre   = doublesM.find(d => d.id_double === DOUBLE_ANDRE);
  if (!dAlisson) throw new Error(`double ${DOUBLE_ALISSON} não encontrado`);
  if (!dAndre)   throw new Error(`double ${DOUBLE_ANDRE} não encontrado`);

  dAlisson.id_round = ROUND_DESTINO;
  dAndre.id_round   = ROUND_DESTINO;

  const hora = m1390.scheduled_at.includes('T') ? m1390.scheduled_at.split('T')[1] : '20:30:00+00:00';
  const novoScheduledAt = `${DATA_DESTINO}T${hora}`;
  m1390.scheduled_at = novoScheduledAt;
  console.log(`  → scheduled_at novo: ${novoScheduledAt}`);
  console.log(`  → Doubles ${DOUBLE_ALISSON} e ${DOUBLE_ANDRE} → round=${ROUND_DESTINO}`);

  // Capacidade 16/07: nenhum dos 4 atletas pode ter >2 jogos no dia
  const doubles20 = doublesM.filter(d => d.id_round === ROUND_DESTINO);
  const matches20 = matchesM.filter(m => doubles20.some(d => d.id_double === m.id_double_a || d.id_double === m.id_double_b));
  const jogosP16 = {};
  for (const m of matches20) {
    for (const did of [m.id_double_a, m.id_double_b]) {
      const d = doublesM.find(x => x.id_double === did);
      if (d) for (const pid of [d.id_player1, d.id_player2]) jogosP16[pid] = (jogosP16[pid] || 0) + 1;
    }
  }
  const atletas1390 = [dAlisson.id_player1, dAlisson.id_player2, dAndre.id_player1, dAndre.id_player2];
  const sobrecarga16 = atletas1390.filter(pid => (jogosP16[pid] || 0) > 2);
  if (sobrecarga16.length > 0) {
    throw new Error(`BLOQUEIO SWAP: atletas com >2 jogos em 16/07: ${sobrecarga16.map(pid => (playerIdx[pid] || {}).name || pid).join(', ')}`);
  }
  console.log(`  → Capacidade 16/07: OK`);

  // ── Histórico do passado (matches FINISHED/WO) ─────────────────────────────
  const rightPassado = {};
  const leftPassado  = {};
  const dm0 = doubleMap();
  for (const m of matchesM) {
    if (!PAST_STATUSES.includes(m.status)) continue;
    const da = dm0[m.id_double_a], db = dm0[m.id_double_b];
    if (!da || !db) continue;
    rightPassado[rightKey(da, db)] = (rightPassado[rightKey(da, db)] || 0) + 1;
    leftPassado[leftKey(da, db)]   = (leftPassado[leftKey(da, db)]   || 0) + 1;
  }

  // ── Rounds futuros (com matches TO_PLAY), ordenados por data ───────────────
  const futureMatches = matchesM.filter(m => m.status === 'TO_PLAY');
  const futureByRound = {};
  for (const m of futureMatches) {
    const da = doubleMap()[m.id_double_a];
    if (!da) continue;
    (futureByRound[da.id_round] = futureByRound[da.id_round] || []).push(m);
  }
  const futureRounds = rounds
    .filter(r => futureByRound[r.id_round])
    .sort((a, b) => new Date(a.scheduled_date) - new Date(b.scheduled_date));

  console.log(`\n  Matches futuros (TO_PLAY): ${futureMatches.length}`);
  console.log(`  Rounds futuros: ${futureRounds.length}`);

  // ── MÉTRICAS ANTES (pareamento atual, após mudanças 1+2, sem re-parear) ────
  let antes_total = 0, antes_right = 0, antes_left = 0;
  let antes_fut = 0, antes_fut_right = 0, antes_fut_left = 0;
  {
    const rAcum = { ...rightPassado };
    const lAcum = { ...leftPassado };
    const dm = doubleMap();
    for (const r of futureRounds) {
      for (const m of (futureByRound[r.id_round] || [])) {
        const da = dm[m.id_double_a], db = dm[m.id_double_b];
        if (!da || !db) continue;
        const rk = rightKey(da, db), lk = leftKey(da, db);
        const rSeen = rAcum[rk] || 0, lSeen = lAcum[lk] || 0;
        const rPas = rightPassado[rk] || 0, lPas = leftPassado[lk] || 0;
        if (rSeen > 0) { antes_right++; antes_total++; if (rPas === 0) { antes_fut_right++; antes_fut++; } }
        if (lSeen > 0) { antes_left++;  antes_total++; if (lPas === 0) { antes_fut_left++;  antes_fut++; } }
        rAcum[rk] = rSeen + 1; lAcum[lk] = lSeen + 1;
      }
    }
  }

  // ── Mudança 3: RE-PAREAR TODAS as noites futuras ──────────────────────────
  console.log('\n--- MUDANÇA 3: RE-PAREAR TODAS as noites futuras ---');

  const rightDepois = { ...rightPassado };
  const leftDepois  = { ...leftPassado };
  let depois_total = 0, depois_right = 0, depois_left = 0;
  let depois_fut = 0, depois_fut_right = 0, depois_fut_left = 0;

  // Repareacoes a gravar: para cada noite, mapeamos os matches existentes para novos pares
  const repareacoes = []; // {id_match, antes:{dA,dB}, depois:{dA,dB}, data, round_number, duplaA_nome, duplaB_nome}

  for (const r of futureRounds) {
    const matchesNoite = futureByRound[r.id_round] || [];
    if (matchesNoite.length === 0) continue;
    const dm = doubleMap();

    // Conjunto fixo de duplas da noite
    const idsSet = new Set();
    for (const m of matchesNoite) { idsSet.add(m.id_double_a); idsSet.add(m.id_double_b); }
    const duplas = [...idsSet].map(id => dm[id]).filter(Boolean);

    // Escolher melhor matching
    let melhor = null, melhorCusto = Infinity;
    if (duplas.length > 12) {
      melhor = gerarMatchingGreedy(duplas, rightDepois, leftDepois);
      melhorCusto = custoMatching(melhor, rightDepois, leftDepois);
      console.log(`  ${r.scheduled_date} (round ${r.round_number}): ${duplas.length} duplas — greedy, custo=${melhorCusto}`);
    } else {
      const matchings = gerarMatchings(duplas);
      for (const mm of matchings) {
        if (mm.length === 0) continue;
        const c = custoMatching(mm, rightDepois, leftDepois);
        if (c < melhorCusto) { melhorCusto = c; melhor = mm; }
      }
      console.log(`  ${r.scheduled_date} (round ${r.round_number}): ${duplas.length} duplas, ${matchings.length} matchings — custo=${melhorCusto}`);
    }

    if (!melhor || melhor.length === 0) {
      console.log(`    sem matching possível (${duplas.length} duplas) — pular`);
      continue;
    }

    // Aplicar matching: mapear sobre os matches existentes da noite
    const nPares = melhor.length;
    if (matchesNoite.length !== nPares) {
      console.log(`    AVISO: ${matchesNoite.length} matches para ${nPares} pares — usar os ${Math.min(matchesNoite.length, nPares)} primeiros`);
    }
    const lim = Math.min(matchesNoite.length, nPares);
    for (let i = 0; i < lim; i++) {
      const [da, db] = melhor[i];
      const matchAlvo = matchesNoite[i];
      const antes = { dA: matchAlvo.id_double_a, dB: matchAlvo.id_double_b };
      const depois = { dA: da.id_double, dB: db.id_double };
      if (antes.dA !== depois.dA || antes.dB !== depois.dB) {
        repareacoes.push({
          id_match: matchAlvo.id_match, data: r.scheduled_date, round_number: r.round_number,
          antes, depois, duplaA_nome: da.display_name, duplaB_nome: db.display_name,
        });
        matchAlvo.id_double_a = da.id_double;
        matchAlvo.id_double_b = db.id_double;
      }
    }

    // Atualizar acumuladores + métricas depois
    for (const [da, db] of melhor) {
      const rk = rightKey(da, db), lk = leftKey(da, db);
      const rSeen = rightDepois[rk] || 0, lSeen = leftDepois[lk] || 0;
      const rPas = rightPassado[rk] || 0, lPas = leftPassado[lk] || 0;
      if (rSeen > 0) { depois_right++; depois_total++; if (rPas === 0) { depois_fut_right++; depois_fut++; } }
      if (lSeen > 0) { depois_left++;  depois_total++; if (lPas === 0) { depois_fut_left++;  depois_fut++; } }
      rightDepois[rk] = rSeen + 1; leftDepois[lk] = lSeen + 1;
    }
  }

  console.log(`\n  Matches re-pareados (par mudou): ${repareacoes.length}`);

  // ── VALIDAÇÕES ──────────────────────────────────────────────────────────────
  console.log('\n=== VALIDAÇÕES ===\n');
  const erros = [];
  const dmF = doubleMap();

  // (a) Alexandre/Diego (656/668 como dupla) 1× no futuro
  const ehAD = d => [d.id_player1, d.id_player2].includes(656) && [d.id_player1, d.id_player2].includes(668);
  const alexDiegoFut = matchesM.filter(m => {
    if (m.status !== 'TO_PLAY') return false;
    const da = dmF[m.id_double_a], db = dmF[m.id_double_b];
    if (!da || !db) return false;
    return ehAD(da) || ehAD(db);
  });
  if (alexDiegoFut.length === 1) console.log(`  [OK] (a) Alexandre/Diego: 1× no futuro (match ${alexDiegoFut[0].id_match})`);
  else erros.push(`(a) Alexandre/Diego aparece ${alexDiegoFut.length}× no futuro, esperado 1×`);

  // (b) Nenhuma dupla repetida no futuro
  const parcFut = {};
  for (const m of matchesM) {
    if (m.status !== 'TO_PLAY') continue;
    const da = dmF[m.id_double_a], db = dmF[m.id_double_b];
    if (!da || !db) continue;
    const r = roundIdx[da.id_round];
    for (const d of [da, db]) {
      const key = [d.id_player1, d.id_player2].sort((a, b) => a - b).join('_');
      (parcFut[key] = parcFut[key] || []).push({ data: r ? r.scheduled_date : '?', nome: d.display_name });
    }
  }
  const dupRep = Object.entries(parcFut).filter(([, v]) => v.length > 1);
  if (dupRep.length === 0) console.log(`  [OK] (b) Nenhuma dupla repetida no futuro`);
  else for (const [, oc] of dupRep) erros.push(`(b) DUPLA REPETIDA: "${oc[0].nome}" em ${oc.map(o => o.data).join(', ')}`);

  // (c) Ninguém >2 jogos/dia no futuro
  const jogosJ = {};
  for (const m of matchesM) {
    if (m.status !== 'TO_PLAY') continue;
    const da = dmF[m.id_double_a], db = dmF[m.id_double_b];
    if (!da || !db) continue;
    const r = roundIdx[da.id_round];
    const data = r ? r.scheduled_date : '?';
    for (const d of [da, db]) for (const pid of [d.id_player1, d.id_player2]) {
      const k = `${pid}@${data}`; jogosJ[k] = (jogosJ[k] || 0) + 1;
    }
  }
  const sobre = Object.entries(jogosJ).filter(([, v]) => v > 2);
  if (sobre.length === 0) console.log(`  [OK] (c) Ninguém com >2 jogos/dia`);
  else for (const [k, n] of sobre) {
    const [pid, data] = k.split('@');
    erros.push(`(c) SOBRECARGA: ${(playerIdx[pid] || {}).name || pid} tem ${n} jogos em ${data}`);
  }

  // (d) Ninguém escalado em data de ausência (futura)
  for (const abs of absences) {
    if (abs.absence_date < TODAY) continue;
    for (const d of doublesM) {
      const r = roundIdx[d.id_round];
      if (!r || r.scheduled_date !== abs.absence_date) continue;
      if (d.id_player1 !== abs.id_player && d.id_player2 !== abs.id_player) continue;
      const temMatch = matchesM.some(m => m.status === 'TO_PLAY' && (m.id_double_a === d.id_double || m.id_double_b === d.id_double));
      if (temMatch) {
        const nome = (playerIdx[abs.id_player] || {}).name || abs.id_player;
        erros.push(`(d) AUSÊNCIA: ${nome} escalado em ${abs.absence_date} (double=${d.id_double})`);
      }
    }
  }
  if (!erros.some(e => e.startsWith('(d)'))) console.log(`  [OK] (d) Ninguém escalado em data de ausência`);

  // (e) Cada double aparece 1× nos matches
  const dCount = {};
  for (const m of matchesM) for (const did of [m.id_double_a, m.id_double_b]) dCount[did] = (dCount[did] || 0) + 1;
  const dRep = Object.entries(dCount).filter(([, v]) => v > 1);
  if (dRep.length === 0) console.log(`  [OK] (e) Cada double aparece 1× nos matches`);
  else for (const [did, n] of dRep) erros.push(`(e) DOUBLE REPETIDO: id_double=${did} (${(dmF[did] || {}).display_name || '?'}) ${n}×`);

  // (f) Match 1452 removido
  if (!matchesM.find(m => m.id_match === MATCH_REMOVER)) console.log(`  [OK] (f) Match 1452 removido`);
  else erros.push(`(f) Match 1452 ainda presente!`);

  // (g) Match 1390 em 16/07
  const m1390fin = matchesM.find(m => m.id_match === MATCH_MOVER);
  if (m1390fin) {
    const dblA = dmF[m1390fin.id_double_a];
    const rDest = dblA ? roundIdx[dblA.id_round] : null;
    if (m1390fin.scheduled_at && m1390fin.scheduled_at.startsWith(DATA_DESTINO) && rDest && rDest.scheduled_date === DATA_DESTINO)
      console.log(`  [OK] (g) Match 1390 em 16/07 (round ${rDest.round_number})`);
    else erros.push(`(g) Match 1390: at=${m1390fin.scheduled_at}, round_data=${rDest ? rDest.scheduled_date : '?'}`);
  } else erros.push(`(g) Match 1390 não encontrado`);

  // ── Resultado validações ────────────────────────────────────────────────────
  console.log('\n=== RESULTADO DAS VALIDAÇÕES ===');
  if (erros.length === 0) console.log('\n  TODAS AS VALIDAÇÕES PASSARAM\n');
  else { console.log('\n  FALHAS:'); for (const e of erros) console.log(`    - ${e}`); console.log(''); }

  // ── Calendário candidato final ─────────────────────────────────────────────
  console.log('\n=== CALENDÁRIO CANDIDATO FINAL (jogos futuros) ===\n');
  const calendarioFinal = [];
  for (const r of futureRounds) {
    const matchesNoite = futureByRound[r.id_round] || [];
    for (const m of matchesNoite) {
      const da = dmF[m.id_double_a], db = dmF[m.id_double_b];
      const jogo = {
        data: r.scheduled_date, round_number: r.round_number, id_match: m.id_match, quadra: m.id_court || null,
        duplaA: da ? da.display_name : `d${m.id_double_a}`, duplaB: db ? db.display_name : `d${m.id_double_b}`,
        id_double_a: m.id_double_a, id_double_b: m.id_double_b, status: m.status,
      };
      calendarioFinal.push(jogo);
      console.log(`  ${jogo.data} R${String(jogo.round_number).padStart(2)} | ${jogo.duplaA.padEnd(42)} × ${jogo.duplaB}`);
    }
  }

  // ── Métricas ───────────────────────────────────────────────────────────────
  const metricas = {
    // Definição idêntica ao cand_pornoite: separa total (com passado) e só-futuro
    mesma_pos_total_antes: antes_total,    mesma_pos_total_depois: depois_total,
    mesma_pos_futuro_antes: antes_fut,     mesma_pos_futuro_depois: depois_fut,
    mesma_pos_futuro_right_antes: antes_fut_right,  mesma_pos_futuro_right_depois: depois_fut_right,
    mesma_pos_futuro_left_antes:  antes_fut_left,   mesma_pos_futuro_left_depois:  depois_fut_left,
    matches_repareados: repareacoes.length,
    matches_removidos: 1, matches_movidos: 1,
    doubles_deletados: double3187Orfao ? [DOUBLE_ORFA] : [],
  };

  console.log('\n=== MÉTRICAS (mesma definição do cand_pornoite) ===');
  console.log(`  Mesma posição TOTAL  (c/ passado) — antes: ${antes_total}  depois: ${depois_total}`);
  console.log(`  Mesma posição FUTURO (só-futuro)  — antes: ${antes_fut}  depois: ${depois_fut}`);
  console.log(`    futuro RIGHT: ${antes_fut_right} → ${depois_fut_right} | futuro LEFT: ${antes_fut_left} → ${depois_fut_left}`);
  console.log(`  Matches re-pareados: ${metricas.matches_repareados}`);
  console.log(`  Matches removidos:   ${metricas.matches_removidos} (id=${MATCH_REMOVER})`);
  console.log(`  Matches movidos:     ${metricas.matches_movidos} (id=${MATCH_MOVER} → ${DATA_DESTINO})`);
  console.log(`  Doubles deletados:   ${metricas.doubles_deletados.join(', ') || 'nenhum'}`);

  // ── Salvar candidato ────────────────────────────────────────────────────────
  const mudancas = [
    { tipo: 'removido', id_match: MATCH_REMOVER,
      descricao: 'Match 1452 removido (Alexandre Gonzaga/Diego Schutz repetido em 27/08)',
      doubles_deletados: double3187Orfao ? [DOUBLE_ORFA] : [] },
    { tipo: 'movido', id_match: MATCH_MOVER,
      antes: { round: 14, data: '2026-07-02', id_round: ROUND_ORIGEM },
      depois: { round: 20, data: DATA_DESTINO, id_round: ROUND_DESTINO, scheduled_at: novoScheduledAt },
      doubles_migrados: [DOUBLE_ALISSON, DOUBLE_ANDRE],
      descricao: 'Match 1390 (Diego Pohlmann/Alisson × Andre Hoppe/Diego Schutz) movido 02/07 → 16/07' },
    ...repareacoes.map(r => ({ tipo: 'repareado', ...r })),
  ];

  const candidato = {
    gerado_em: new Date().toISOString(),
    dry_run: DRY_RUN,
    validacao: { todas_passaram: erros.length === 0, erros, avisos: [] },
    metricas,
    mudancas,
    calendario_final: calendarioFinal,
  };

  fs.mkdirSync(SCRATCHPAD, { recursive: true });
  const outPath = path.join(SCRATCHPAD, 'cand_final_inic.json');
  fs.writeFileSync(outPath, JSON.stringify(candidato, null, 2), 'utf8');
  console.log(`\n  Candidato salvo em: ${outPath}`);

  if (erros.length > 0) {
    console.log('\n  VALIDACOES FALHARAM — nao grave ate resolver os erros\n');
    process.exit(1);
  }

  // ── Gravação real ──────────────────────────────────────────────────────────
  if (DRY_RUN) {
    console.log('\n  [DRY-RUN] Nada foi gravado. Rode com CONFIRM_EXECUTE=yes para gravar.\n');
    return;
  }

  function ck(label, result) {
    if (result.error) throw new Error(`[ERRO ${label}] ${result.error.message}`);
    return result.data;
  }

  console.log('\n=== GRAVANDO NO BANCO ===\n');

  // 1. DELETE match 1452
  console.log(`  DELETE match ${MATCH_REMOVER}...`);
  ck('DELETE match 1452', await supabase.from('matches').delete().eq('id_match', MATCH_REMOVER));
  if (double3187Orfao) {
    console.log(`  DELETE double ${DOUBLE_ORFA}...`);
    ck('DELETE double 3187', await supabase.from('doubles').delete().eq('id_double', DOUBLE_ORFA));
  }

  // 2. UPDATE doubles → round 20 + scheduled_at do match 1390
  console.log(`  UPDATE double ${DOUBLE_ALISSON} → round ${ROUND_DESTINO}...`);
  ck('UPDATE double 3063', await supabase.from('doubles').update({ id_round: ROUND_DESTINO }).eq('id_double', DOUBLE_ALISSON));
  console.log(`  UPDATE double ${DOUBLE_ANDRE} → round ${ROUND_DESTINO}...`);
  ck('UPDATE double 3062', await supabase.from('doubles').update({ id_round: ROUND_DESTINO }).eq('id_double', DOUBLE_ANDRE));
  console.log(`  UPDATE match ${MATCH_MOVER} → scheduled_at=${novoScheduledAt}...`);
  ck('UPDATE match 1390', await supabase.from('matches').update({ scheduled_at: novoScheduledAt }).eq('id_match', MATCH_MOVER));

  // 3. Re-parear TODAS as noites — UPDATE de cada match cujo par mudou
  console.log(`\n  Gravando ${repareacoes.length} re-pareamentos...`);
  for (const r of repareacoes) {
    ck(`UPDATE match ${r.id_match}`, await supabase
      .from('matches')
      .update({ id_double_a: r.depois.dA, id_double_b: r.depois.dB })
      .eq('id_match', r.id_match));
  }
  console.log(`  OK`);

  // ── Asserts pós-gravação ───────────────────────────────────────────────────
  console.log('\n=== ASSERTS POS-GRAVACAO ===');

  const estadoR = await carregarEstado();
  const rR = estadoR.rounds, dR = estadoR.doubles, mR = estadoR.matches;
  const dIdxR = buildIndex(dR, 'id_double');

  // 1452 ausente
  if (mR.some(m => m.id_match === MATCH_REMOVER)) throw new Error('ASSERT FALHOU: match 1452 ainda existe');
  console.log('  [OK] match 1452 ausente');

  // 1390 em 16/07
  const m1390R = mR.find(m => m.id_match === MATCH_MOVER);
  if (!m1390R || !m1390R.scheduled_at.startsWith(DATA_DESTINO)) throw new Error(`ASSERT FALHOU: 1390 at=${m1390R ? m1390R.scheduled_at : 'ausente'}`);
  console.log('  [OK] match 1390 em 16/07');

  // 0 duplas repetidas no futuro
  const parcR = {};
  for (const m of mR) {
    if (m.status !== 'TO_PLAY') continue;
    for (const did of [m.id_double_a, m.id_double_b]) {
      const d = dIdxR[did]; if (!d) continue;
      const key = [d.id_player1, d.id_player2].sort((a, b) => a - b).join('_');
      parcR[key] = (parcR[key] || 0) + 1;
    }
  }
  const repRep = Object.entries(parcR).filter(([, v]) => v > 1);
  if (repRep.length > 0) throw new Error(`ASSERT FALHOU: ${repRep.length} duplas repetidas no futuro`);
  console.log('  [OK] 0 duplas repetidas no futuro');

  // re-contar mesma-posição futuro == esperado (depois_fut)
  const rPas = {}, lPas = {};
  for (const m of mR) {
    if (!PAST_STATUSES.includes(m.status)) continue;
    const da = dIdxR[m.id_double_a], db = dIdxR[m.id_double_b];
    if (!da || !db) continue;
    rPas[rightKey(da, db)] = (rPas[rightKey(da, db)] || 0) + 1;
    lPas[leftKey(da, db)]  = (lPas[leftKey(da, db)]  || 0) + 1;
  }
  const rAcc = { ...rPas }, lAcc = { ...lPas };
  const futRoundsR = rR.filter(r => mR.some(m => m.status === 'TO_PLAY' && dIdxR[m.id_double_a] && dIdxR[m.id_double_a].id_round === r.id_round))
                       .sort((a, b) => new Date(a.scheduled_date) - new Date(b.scheduled_date));
  let futR = 0;
  for (const r of futRoundsR) {
    const ms = mR.filter(m => m.status === 'TO_PLAY' && dIdxR[m.id_double_a] && dIdxR[m.id_double_a].id_round === r.id_round);
    for (const m of ms) {
      const da = dIdxR[m.id_double_a], db = dIdxR[m.id_double_b];
      if (!da || !db) continue;
      const rk = rightKey(da, db), lk = leftKey(da, db);
      if ((rAcc[rk] || 0) > 0 && (rPas[rk] || 0) === 0) futR++;
      if ((lAcc[lk] || 0) > 0 && (lPas[lk] || 0) === 0) futR++;
      rAcc[rk] = (rAcc[rk] || 0) + 1; lAcc[lk] = (lAcc[lk] || 0) + 1;
    }
  }
  if (futR !== depois_fut) throw new Error(`ASSERT FALHOU: mesma-posição futuro pós-gravação=${futR}, esperado=${depois_fut}`);
  console.log(`  [OK] mesma-posição futuro pós-gravação = ${futR} (esperado ${depois_fut})`);

  // Alexandre/Diego ≤1 no futuro
  const adR = mR.filter(m => {
    if (m.status !== 'TO_PLAY') return false;
    const da = dIdxR[m.id_double_a], db = dIdxR[m.id_double_b];
    if (!da || !db) return false;
    const isAD = d => [d.id_player1, d.id_player2].includes(656) && [d.id_player1, d.id_player2].includes(668);
    return isAD(da) || isAD(db);
  }).length;
  if (adR > 1) throw new Error(`ASSERT FALHOU: Alexandre/Diego ${adR}× no futuro`);
  console.log(`  [OK] Alexandre/Diego: ${adR}× no futuro`);

  console.log('\n  Todos os asserts passaram. Gravacao concluida.\n');
}

main().catch(err => {
  console.error('\n[FATAL]', err.message);
  process.exit(1);
});
