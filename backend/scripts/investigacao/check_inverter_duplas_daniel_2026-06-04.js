// Contexto: atleta pediu no grupo pra "inverter as duplas e jogar mais um jogo do ranking"
// na quinta 04/06 19h50. Jogo base: Daniel Souza Staevie + Daniel Teixeira  ×  Cassius Zanenga + Pablo Mallmann.
// Este script verifica, entre esses 4: (a) lados (LEFT/RIGHT) -> quais inversoes sao fisicamente possiveis;
// (b) parcerias ja jogadas (regra petrea); (c) confrontos passados e se foi "na mesma posicao".
// Rodar:  node scripts/investigacao/check_inverter_duplas_daniel_2026-06-04.js
const supabase = require('../../supabase');

const NAME_HINTS = ['Souza Staevie', 'Daniel Teixeira', 'Cassius', 'Mallmann'];

async function findPlayers() {
  const found = {};
  for (const hint of NAME_HINTS) {
    const { data, error } = await supabase
      .from('players')
      .select('id_player, name, side, active')
      .ilike('name', `%${hint}%`);
    if (error) { console.error(`erro buscando "${hint}":`, error.message); continue; }
    found[hint] = data || [];
  }
  return found;
}

function sideTag(s) {
  if (!s) return '??';
  const u = String(s).toUpperCase();
  if (u.startsWith('L') || u === 'ESQUERDA') return 'LEFT';
  if (u.startsWith('R') || u === 'DIREITA') return 'RIGHT';
  if (u.startsWith('E') || u === 'EITHER' || u === 'AMBOS') return 'EITHER';
  return u;
}

async function doublesOf(playerIds) {
  // todas as doubles que contem qualquer um dos 4
  const [{ data: a }, { data: b }] = await Promise.all([
    supabase.from('doubles').select('*').in('id_player1', playerIds),
    supabase.from('doubles').select('*').in('id_player2', playerIds),
  ]);
  const seen = new Set();
  const out = [];
  for (const d of [...(a || []), ...(b || [])]) {
    if (!seen.has(d.id_double)) { seen.add(d.id_double); out.push(d); }
  }
  return out;
}

async function roundsMap(ids) {
  if (!ids.length) return {};
  const { data } = await supabase.from('rounds').select('id_round, scheduled_date, status, round_number').in('id_round', ids);
  const m = {};
  for (const r of data || []) m[r.id_round] = r;
  return m;
}

async function matchesForDoubles(dIds) {
  if (!dIds.length) return [];
  const [{ data: a }, { data: b }] = await Promise.all([
    supabase.from('matches').select('*').in('id_double_a', dIds),
    supabase.from('matches').select('*').in('id_double_b', dIds),
  ]);
  const seen = new Set();
  const out = [];
  for (const m of [...(a || []), ...(b || [])]) {
    if (!seen.has(m.id_match)) { seen.add(m.id_match); out.push(m); }
  }
  return out;
}

async function main() {
  const found = await findPlayers();
  console.log('========== BUSCA POR NOME ==========');
  for (const hint of NAME_HINTS) {
    const list = found[hint] || [];
    if (!list.length) { console.log(`  "${hint}": NENHUM`); continue; }
    for (const p of list) {
      console.log(`  "${hint}" -> id=${p.id_player} | ${p.name} | side=${sideTag(p.side)} (raw=${p.side}) | active=${p.active}`);
    }
  }

  // Escolhe 1 id por hint (se houver ambiguidade, mostra e pega o ativo)
  const chosen = {};
  for (const hint of NAME_HINTS) {
    const list = found[hint] || [];
    if (!list.length) continue;
    chosen[hint] = list.find(p => p.active) || list[0];
  }
  const players = Object.values(chosen);
  const ids = players.map(p => p.id_player);
  if (ids.length < 4) {
    console.log('\n!! Nao encontrei os 4 jogadores. Resolva a busca acima antes de concluir.');
    return;
  }
  const byId = {};
  for (const p of players) byId[p.id_player] = p;

  console.log('\n========== OS 4 (escolhidos) ==========');
  for (const p of players) console.log(`  ${p.id_player} | ${p.name} | ${sideTag(p.side)}`);

  // ---- Lados / inversoes possiveis ----
  const D1 = chosen['Souza Staevie'], D2 = chosen['Daniel Teixeira'], C = chosen['Cassius'], P = chosen['Mallmann'];
  function canPair(x, y) {
    const sx = sideTag(x.side), sy = sideTag(y.side);
    if (sx === 'EITHER' || sy === 'EITHER') return true;
    return sx !== sy; // precisa 1 LEFT + 1 RIGHT
  }
  const arranjos = [
    ['ATUAL', [D1, D2], [C, P]],
    ['INVERSAO 1', [D1, C], [D2, P]],
    ['INVERSAO 2', [D1, P], [D2, C]],
  ];
  console.log('\n========== VIABILIDADE POR LADO (cada dupla precisa 1 LEFT + 1 RIGHT) ==========');
  for (const [label, da, db] of arranjos) {
    const okA = canPair(da[0], da[1]);
    const okB = canPair(db[0], db[1]);
    const nm = (d) => `${d[0].name.split(' ')[0]}(${sideTag(d[0].side)})+${d[1].name.split(' ')[0]}(${sideTag(d[1].side)})`;
    console.log(`  ${label}: ${nm(da)} ${okA ? 'OK' : 'XX'}  ×  ${nm(db)} ${okB ? 'OK' : 'XX'}  => ${okA && okB ? 'VIAVEL' : 'PROIBIDO (lados)'}`);
  }

  // ---- Parcerias ja jogadas entre os 4 ----
  const allDoubles = await doublesOf(ids);
  const idset = new Set(ids);
  const partnerHits = [];
  for (const d of allDoubles) {
    if (idset.has(d.id_player1) && idset.has(d.id_player2)) {
      partnerHits.push(d);
    }
  }
  const rIds = [...new Set(partnerHits.map(d => d.id_round).filter(Boolean))];
  const rMap = await roundsMap(rIds);
  console.log('\n========== PARCERIAS JA JOGADAS ENTRE OS 4 (doubles reais) ==========');
  if (!partnerHits.length) {
    console.log('  NENHUMA dupla entre os 4 nunca foi formada (todas as inversoes sao parcerias ineditas).');
  } else {
    for (const d of partnerHits) {
      const r = rMap[d.id_round] || {};
      console.log(`  ${byId[d.id_player1]?.name} + ${byId[d.id_player2]?.name}  | round=${d.id_round} (${r.scheduled_date || '?'}, ${r.status || '?'}) | double=${d.id_double}`);
    }
  }

  // ---- Confrontos passados entre os 4 (mesma posicao = mesmo side em duplas opostas) ----
  const allDIds = allDoubles.map(d => d.id_double);
  const dInfo = {}; for (const d of allDoubles) dInfo[d.id_double] = d;
  const matches = await matchesForDoubles(allDIds);
  console.log('\n========== CONFRONTOS PASSADOS ENTRE OS 4 ==========');
  let anyVs = false;
  for (const m of matches) {
    const da = dInfo[m.id_double_a], db = dInfo[m.id_double_b];
    if (!da || !db) continue;
    const aPlayers = [da.id_player1, da.id_player2].filter(x => idset.has(x));
    const bPlayers = [db.id_player1, db.id_player2].filter(x => idset.has(x));
    if (!aPlayers.length || !bPlayers.length) continue; // precisa ter os nossos dos dois lados
    anyVs = true;
    const r = rMap[m.id_round] || {};
    console.log(`\n  match=${m.id_match} | round=${m.id_round} (${r.scheduled_date || '?'}) | ${m.status} ${m.score_a ?? ''}-${m.score_b ?? ''}`);
    console.log(`    Dupla A: ${da.display_name}`);
    console.log(`    Dupla B: ${db.display_name}`);
    // pares oponentes entre os nossos 4 + se "mesma posicao" (mesmo side)
    for (const ax of aPlayers) for (const bx of bPlayers) {
      const sa = sideTag(byId[ax]?.side), sb = sideTag(byId[bx]?.side);
      const mesma = (sa === sb && sa !== 'EITHER');
      console.log(`    >> ${byId[ax]?.name}(${sa}) enfrentou ${byId[bx]?.name}(${sb}) ${mesma ? '== MESMA POSICAO (confronto direto no mesmo lado)' : '(posicoes diferentes / diagonal)'}`);
    }
  }
  if (!anyVs) console.log('  Nenhum confronto passado entre quaisquer dois dos 4 (todos confrontos seriam ineditos).');

  console.log('\n========== FIM ==========');
}

main().catch(e => { console.error(e); process.exit(1); });