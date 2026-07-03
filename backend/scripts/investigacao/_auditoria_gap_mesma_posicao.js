/**
 * _auditoria_gap_mesma_posicao.js
 * Análise READ-ONLY: repetição de adversário de mesma posição no ranking SRB 2026
 * id_tournament = 7
 * NÃO escreve no banco.
 */

const supabase = require('../../supabase');
const fs = require('fs');

const OUTPUT_PATH = 'C:/Users/aless/AppData/Local/Temp/claude/c--obralivre/9484ee84-3113-43fa-bba2-ad6b4cbae786/scratchpad/audit_gap.json';
const ID_TOURNAMENT = 7;

const CAT_NAMES = { 1: 'Masc Iniciante', 2: 'Masc 4ª', 3: 'Feminino' };

async function main() {
  // ── 1. Buscar rounds REGULAR do torneio ──
  const { data: rounds, error: eRounds } = await supabase
    .from('rounds')
    .select('id_round, id_category, round_type, id_tournament')
    .eq('id_tournament', ID_TOURNAMENT)
    .eq('round_type', 'REGULAR');

  if (eRounds) throw new Error('rounds: ' + JSON.stringify(eRounds));

  const regularRoundIds = rounds.map(r => r.id_round);
  const roundById = Object.fromEntries(rounds.map(r => [r.id_round, r]));

  console.log(`Rounds REGULAR encontrados: ${regularRoundIds.length}`);
  console.log('Rounds:', rounds.map(r => `id=${r.id_round} cat=${r.id_category}`).join(', '));

  // ── 2. Buscar doubles dos rounds REGULAR ──
  const { data: doubles, error: eDbl } = await supabase
    .from('doubles')
    .select('id_double, id_player1, id_player2, id_round, display_name')
    .in('id_round', regularRoundIds);

  if (eDbl) throw new Error('doubles: ' + JSON.stringify(eDbl));

  const doubleById = Object.fromEntries(doubles.map(d => [d.id_double, d]));
  const doubleIds = doubles.map(d => d.id_double);

  console.log(`Doubles em rounds REGULAR: ${doubleIds.length}`);

  // ── 3. Buscar matches envolvendo essas doubles ──
  // matches onde id_double_a OU id_double_b está nos doubles REGULAR
  const { data: matchesA, error: eMa } = await supabase
    .from('matches')
    .select('id_match, id_double_a, id_double_b, scheduled_at, status')
    .in('id_double_a', doubleIds);

  const { data: matchesB, error: eMb } = await supabase
    .from('matches')
    .select('id_match, id_double_a, id_double_b, scheduled_at, status')
    .in('id_double_b', doubleIds);

  if (eMa) throw new Error('matches A: ' + JSON.stringify(eMa));
  if (eMb) throw new Error('matches B: ' + JSON.stringify(eMb));

  // Unir e dedup
  const allMatchMap = {};
  for (const m of [...(matchesA || []), ...(matchesB || [])]) {
    allMatchMap[m.id_match] = m;
  }
  const allMatches = Object.values(allMatchMap);

  // Filtrar: apenas matches onde AMBAS as doubles são REGULAR
  const regularMatches = allMatches.filter(m =>
    doubleById[m.id_double_a] && doubleById[m.id_double_b]
  );

  // Filtrar status relevante
  const VALID_STATUSES = ['FINISHED', 'WO', 'TO_PLAY', 'IN_PROGRESS'];
  const matches = regularMatches.filter(m => VALID_STATUSES.includes(m.status));

  console.log(`Matches REGULAR (ambas duplas em round REGULAR): ${matches.length}`);

  // ── 4. Buscar jogadores ativos ──
  const { data: players, error: ePlayers } = await supabase
    .from('players')
    .select('id_player, name, side, category_id, active')
    .eq('active', true)
    .eq('id_tournament', ID_TOURNAMENT);

  // Se id_tournament não existir em players, busca sem filtro
  let playersData = players;
  if (ePlayers || !players || players.length === 0) {
    const { data: p2, error: e2 } = await supabase
      .from('players')
      .select('id_player, name, side, category_id, active')
      .eq('active', true);
    if (e2) throw new Error('players: ' + JSON.stringify(e2));
    playersData = p2;
  }

  console.log(`Jogadores ativos: ${playersData.length}`);

  // Mapear jogador por id
  const playerById = Object.fromEntries(playersData.map(p => [p.id_player, p]));

  // ── 5. Para cada match REGULAR, extrair confrontos de mesma posição ──
  // Confrontos: (p1a RIGHT vs p1b RIGHT) e (p2a LEFT vs p2b LEFT)
  // p1 = RIGHT (id_player1), p2 = LEFT (id_player2)

  // Estrutura: por categoria e lado, registrar confrontos
  // cat → lado → Map<"idA_idB" (sorted), [{id_match, status}]>
  const confrontos = {}; // cat → lado → { par: [...matches] }

  // Também: por cat → lado → Set de jogadores participantes
  const jogadoresAtivos = {}; // cat → lado → Set<id_player>

  for (const m of matches) {
    const da = doubleById[m.id_double_a];
    const db = doubleById[m.id_double_b];
    if (!da || !db) continue;

    const roundA = roundById[da.id_round];
    const cat = roundA?.id_category;
    if (!cat) continue;

    if (!confrontos[cat]) confrontos[cat] = { RIGHT: {}, LEFT: {} };
    if (!jogadoresAtivos[cat]) jogadoresAtivos[cat] = { RIGHT: new Set(), LEFT: new Set() };

    // RIGHT: p1a vs p1b
    const p1a = da.id_player1;
    const p1b = db.id_player1;
    if (p1a && p1b) {
      const key = [p1a, p1b].sort((a, b) => a - b).join('_');
      if (!confrontos[cat].RIGHT[key]) confrontos[cat].RIGHT[key] = [];
      confrontos[cat].RIGHT[key].push({ id_match: m.id_match, status: m.status });
      jogadoresAtivos[cat].RIGHT.add(p1a);
      jogadoresAtivos[cat].RIGHT.add(p1b);
    }

    // LEFT: p2a vs p2b
    const p2a = da.id_player2;
    const p2b = db.id_player2;
    if (p2a && p2b) {
      const key = [p2a, p2b].sort((a, b) => a - b).join('_');
      if (!confrontos[cat].LEFT[key]) confrontos[cat].LEFT[key] = [];
      confrontos[cat].LEFT[key].push({ id_match: m.id_match, status: m.status });
      jogadoresAtivos[cat].LEFT.add(p2a);
      jogadoresAtivos[cat].LEFT.add(p2b);
    }
  }

  // ── 6. Calcular estatísticas por categoria/lado ──
  const PAST_STATUSES = new Set(['FINISHED', 'WO', 'IN_PROGRESS']);
  const FUTURE_STATUSES = new Set(['TO_PLAY']);

  const por_cat_lado = [];
  const alerta_inevitaveis = [];
  const piores_ofensores = [];

  // Para alerta: por jogador, nº de jogos e adversários distintos
  // Jogos de um jogador: matches em que aparece no right ou left
  // Adversários distintos: outros jogadores do mesmo lado/cat que já enfrentou

  // Para cada cat, calcular total_confrontos_lado = nº de matches REGULAR nessa cat
  const matchesPorCat = {};
  for (const m of matches) {
    const da = doubleById[m.id_double_a];
    if (!da) continue;
    const roundA = roundById[da.id_round];
    const cat = roundA?.id_category;
    if (!cat) continue;
    if (!matchesPorCat[cat]) matchesPorCat[cat] = [];
    matchesPorCat[cat].push(m);
  }

  for (const cat of Object.keys(confrontos).sort()) {
    for (const lado of ['RIGHT', 'LEFT']) {
      const pares = confrontos[cat][lado] || {};
      const jogSet = jogadoresAtivos[cat]?.[lado] || new Set();
      const n = jogSet.size;
      const total_confrontos = matchesPorCat[cat]?.length || 0; // cada match = 1 confronto por lado
      const pares_possiveis = n * (n - 1) / 2;

      let excedente_atual = 0;
      let excedente_passado = 0;
      let excedente_futuro = 0;

      for (const [key, mlist] of Object.entries(pares)) {
        const vezes = mlist.length;
        if (vezes > 1) {
          excedente_atual += vezes - 1;
          // passado: jogos já terminados; futuro: envolve TO_PLAY
          const pastGames = mlist.filter(x => PAST_STATUSES.has(x.status));
          const futureGames = mlist.filter(x => FUTURE_STATUSES.has(x.status));
          // Excedente passado: vezes_past - 1 (se >=2) ou 0
          if (pastGames.length > 1) excedente_passado += pastGames.length - 1;
          // Excedente futuro: todos os jogos TO_PLAY que formam repetição
          // Um par é "futuro" se tem pelo menos 1 jogo passado + 1 futuro, ou 2+ futuros
          if (futureGames.length > 0 && (pastGames.length >= 1 || futureGames.length > 1)) {
            // Quantas repetições do futuro?
            const totalVezes = vezes;
            const passoExcedente = pastGames.length > 1 ? pastGames.length - 1 : 0;
            excedente_futuro += (vezes - 1) - passoExcedente;
          }
        }
      }

      const minimo_estrutural = Math.max(0, total_confrontos - pares_possiveis);
      const evitavel = Math.max(0, excedente_atual - minimo_estrutural);

      por_cat_lado.push({
        categoria: parseInt(cat),
        name: CAT_NAMES[cat] || `Cat ${cat}`,
        lado,
        n_jogadores: n,
        total_confrontos,
        pares_possiveis,
        excedente_atual,
        minimo_estrutural,
        evitavel,
        excedente_passado,
        excedente_futuro,
      });

      // ── Alerta inevitáveis por jogador ──
      // Por jogador: nº de jogos REGULAR (past+future) e adversários distintos enfrentados/possíveis
      // n_jogos_jog = quantos matches o jogador participou
      // adversarios_distintos_possiveis = n - 1
      const jogosPorJogador = {};
      const adversariosPorJogador = {};
      for (const jid of jogSet) {
        jogosPorJogador[jid] = 0;
        adversariosPorJogador[jid] = new Set();
      }
      for (const m2 of (matchesPorCat[cat] || [])) {
        const da2 = doubleById[m2.id_double_a];
        const db2 = doubleById[m2.id_double_b];
        if (!da2 || !db2) continue;
        let pa, pb;
        if (lado === 'RIGHT') {
          pa = da2.id_player1;
          pb = db2.id_player1;
        } else {
          pa = da2.id_player2;
          pb = db2.id_player2;
        }
        if (pa && jogSet.has(pa)) {
          jogosPorJogador[pa] = (jogosPorJogador[pa] || 0) + 1;
          if (pb) adversariosPorJogador[pa].add(pb);
        }
        if (pb && jogSet.has(pb)) {
          jogosPorJogador[pb] = (jogosPorJogador[pb] || 0) + 1;
          if (pa) adversariosPorJogador[pb].add(pa);
        }
      }

      for (const jid of jogSet) {
        const njogos = jogosPorJogador[jid] || 0;
        const adv_distintos_possiveis = n - 1;
        const repeticoes_forcadas = Math.max(0, njogos - adv_distintos_possiveis);
        if (repeticoes_forcadas > 0) {
          const pl = playerById[jid];
          alerta_inevitaveis.push({
            categoria: parseInt(cat),
            lado,
            id_player: jid,
            name: pl?.name || `Player ${jid}`,
            n_jogos: njogos,
            adversarios_distintos_possiveis: adv_distintos_possiveis,
            repeticoes_forcadas,
          });
        }
      }

      // ── Piores ofensores (3+ vezes) ──
      for (const [key, mlist] of Object.entries(pares)) {
        if (mlist.length >= 3) {
          const [idA, idB] = key.split('_').map(Number);
          const plA = playerById[idA];
          const plB = playerById[idB];
          piores_ofensores.push({
            categoria: parseInt(cat),
            lado,
            par: `${plA?.name || idA} × ${plB?.name || idB}`,
            id_player_a: idA,
            id_player_b: idB,
            vezes: mlist.length,
            id_matches: mlist.map(x => x.id_match),
            status_matches: mlist.map(x => x.status),
          });
        }
      }
    }
  }

  // ── 7. Parcerias repetidas (doubles com mesmos jogadores em múltiplos rounds) ──
  // Dupla = (id_player1, id_player2). Se aparecer em 2+ rounds = parceria repetida.
  const dupласKey = {};
  for (const d of doubles) {
    const key = `${d.id_player1}_${d.id_player2}`;
    if (!dupласKey[key]) dupласKey[key] = [];
    dupласKey[key].push(d);
  }

  const parcerias_repetidas_nao_paridade = [];
  for (const [key, dlist] of Object.entries(dupласKey)) {
    if (dlist.length > 1) {
      // Verificar se é jogo de paridade de 27/08 (convenção: round_type EXHIBITION ou outra marcação)
      // Aqui só temos REGULAR, então todos são potencialmente repetidos
      const [p1, p2] = key.split('_').map(Number);
      const pl1 = playerById[p1];
      const pl2 = playerById[p2];
      parcerias_repetidas_nao_paridade.push({
        id_player1: p1,
        name_player1: pl1?.name || p1,
        id_player2: p2,
        name_player2: pl2?.name || p2,
        vezes: dlist.length,
        rounds: dlist.map(d => ({ id_double: d.id_double, id_round: d.id_round, display_name: d.display_name })),
      });
    }
  }

  // ── 8. Montar JSON e salvar ──
  const output = {
    gerado_em: new Date().toISOString(),
    id_tournament: ID_TOURNAMENT,
    por_cat_lado: por_cat_lado.sort((a, b) => a.categoria - b.categoria || a.lado.localeCompare(b.lado)),
    alerta_inevitaveis: alerta_inevitaveis.sort((a, b) => b.repeticoes_forcadas - a.repeticoes_forcadas),
    piores_ofensores: piores_ofensores.sort((a, b) => b.vezes - a.vezes),
    parcerias_repetidas_nao_paridade: parcerias_repetidas_nao_paridade.sort((a, b) => b.vezes - a.vezes),
  };

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2), 'utf8');
  console.log(`\nJSON salvo em: ${OUTPUT_PATH}`);

  // ── 9. Resumo PT-BR no console ──
  console.log('\n' + '='.repeat(70));
  console.log('RESUMO — Auditoria de Repetições de Mesma Posição (torneio 7)');
  console.log('='.repeat(70));

  let total_excedente = 0, total_minimo = 0, total_evitavel = 0, total_futuro = 0;
  for (const row of output.por_cat_lado) {
    total_excedente += row.excedente_atual;
    total_minimo += row.minimo_estrutural;
    total_evitavel += row.evitavel;
    total_futuro += row.excedente_futuro;
    console.log(`\n[${row.name} | ${row.lado}] n=${row.n_jogadores} jogadores`);
    console.log(`  Confrontos totais (REGULAR): ${row.total_confrontos} | Pares possíveis: ${row.pares_possiveis}`);
    console.log(`  Excedente atual: ${row.excedente_atual} | Mínimo estrutural (inevitável): ${row.minimo_estrutural} | Evitável: ${row.evitavel}`);
    console.log(`  Excedente passado (congelado): ${row.excedente_passado} | Excedente futuro (re-otimizável): ${row.excedente_futuro}`);
  }

  console.log('\n' + '-'.repeat(70));
  console.log(`TOTAIS: excedente_atual=${total_excedente} | minimo_estrutural=${total_minimo} | evitavel=${total_evitavel} | futuro_reotimizavel=${total_futuro}`);

  if (output.alerta_inevitaveis.length > 0) {
    console.log('\nALERTA — Jogadores com repetição matematicamente forçada:');
    for (const a of output.alerta_inevitaveis) {
      console.log(`  ${a.name} (${CAT_NAMES[a.categoria]}, ${a.lado}): ${a.n_jogos} jogos, ${a.adversarios_distintos_possiveis} adv. disponíveis → ${a.repeticoes_forcadas} repetição(ões) forçada(s)`);
    }
  } else {
    console.log('\nNenhum jogador com repetição matematicamente forçada.');
  }

  if (output.piores_ofensores.length > 0) {
    console.log('\nPIORES OFENSORES (3+ confrontos de mesma posição):');
    for (const p of output.piores_ofensores) {
      console.log(`  ${p.par} (${CAT_NAMES[p.categoria]}, ${p.lado}): ${p.vezes}x — matches ${p.id_matches.join(', ')}`);
    }
  } else {
    console.log('\nNenhum par com 3+ confrontos de mesma posição.');
  }

  if (output.parcerias_repetidas_nao_paridade.length > 0) {
    console.log('\nPARCERIAS REPETIDAS (mesma dupla em múltiplos rounds REGULAR):');
    for (const p of output.parcerias_repetidas_nao_paridade) {
      console.log(`  ${p.name_player1} + ${p.name_player2}: ${p.vezes}x (rounds: ${p.rounds.map(r => r.id_round).join(', ')})`);
    }
  } else {
    console.log('\nNenhuma parceria repetida em rounds REGULAR.');
  }

  console.log('\n' + '='.repeat(70));
}

main().catch(e => { console.error('ERRO:', e); process.exit(1); });
