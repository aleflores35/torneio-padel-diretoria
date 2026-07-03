/**
 * _cand_pornoite_inic.js
 * READ-ONLY: candidato de re-pareamento POR NOITE para Masculino Iniciante (id_category=1)
 * NÃO escreve no banco. id_tournament=7
 *
 * Critério de "repetição de mesma posição":
 *   - Par RIGHT (p1a, p1b ordenado) já se enfrentou antes → conta como 1 repetição
 *   - Par LEFT  (p2a, p2b ordenado) já se enfrentou antes → conta como 1 repetição
 *   - Um match pode contribuir com 0, 1 ou 2 repetições (RIGHT, LEFT, ou ambos)
 *
 * Passado = matches FINISHED/WO (rounds 1-11)
 * Futuro  = matches TO_PLAY   (rounds 14-32)
 *
 * Estratégia de re-pareamento:
 *   - Por-noite: mantém o conjunto de doubles de cada noite fixo
 *   - Dentro de cada noite, busca o matching que minimiza repetições de posição acumuladas
 *   - Processa noites em ordem cronológica, acumulando o histórico
 */

const supabase = require('../../supabase');
const fs = require('fs');

const OUTPUT_PATH = 'C:/Users/aless/AppData/Local/Temp/claude/c--obralivre/9484ee84-3113-43fa-bba2-ad6b4cbae786/scratchpad/cand_pornoite.json';

async function main() {
  // 1. Buscar todos os rounds REGULAR da categoria 1, tournament 7
  const { data: rounds, error: rErr } = await supabase
    .from('rounds')
    .select('id_round, id_category, round_number, scheduled_date, round_type, status')
    .eq('id_tournament', 7)
    .eq('id_category', 1)
    .eq('round_type', 'REGULAR')
    .order('round_number', { ascending: true });

  if (rErr) throw new Error('Erro rounds: ' + rErr.message);

  const roundIds = rounds.map(r => r.id_round);
  console.log(`Rounds cat1 encontrados: ${rounds.length}`);

  // 2. Buscar todas as doubles desses rounds
  const { data: allDoubles, error: dErr } = await supabase
    .from('doubles')
    .select('id_double, id_round, display_name, id_player1, id_player2')
    .in('id_round', roundIds);

  if (dErr) throw new Error('Erro doubles: ' + dErr.message);

  const doubleMap = {};
  for (const d of allDoubles) doubleMap[d.id_double] = d;

  // 3. Buscar todos os matches via double_a
  const doubleIds = allDoubles.map(d => d.id_double);
  const { data: allMatches, error: mErr } = await supabase
    .from('matches')
    .select('id_match, id_double_a, id_double_b, status, scheduled_at, id_court')
    .in('id_double_a', doubleIds);

  if (mErr) throw new Error('Erro matches: ' + mErr.message);

  console.log(`Total matches cat1: ${allMatches.length}`);

  // 4. Separar passado e futuro pelo STATUS DO MATCH
  const pastStatuses = ['FINISHED', 'WO'];
  const pastMatches = allMatches.filter(m => pastStatuses.includes(m.status));
  const futureMatches = allMatches.filter(m => m.status === 'TO_PLAY');

  console.log(`Matches passados: ${pastMatches.length}, futuros: ${futureMatches.length}`);

  // 5. Agrupar matches futuros por round
  const futureByRound = {};
  for (const m of futureMatches) {
    const da = doubleMap[m.id_double_a];
    if (!da) continue;
    const rid = da.id_round;
    if (!futureByRound[rid]) futureByRound[rid] = [];
    futureByRound[rid].push(m);
  }

  const futureRoundIds = Object.keys(futureByRound).map(Number);
  const futureRounds = rounds
    .filter(r => futureRoundIds.includes(r.id_round))
    .sort((a, b) => new Date(a.scheduled_date) - new Date(b.scheduled_date));

  console.log(`Rounds futuros com TO_PLAY: ${futureRounds.length}`);

  // 6. Funções de confronto por posição
  function getRightKey(da, db) {
    return [da.id_player1, db.id_player1].sort().join('|');
  }
  function getLeftKey(da, db) {
    return [da.id_player2, db.id_player2].sort().join('|');
  }

  // 7. Construir histórico de confrontos passados
  const rightPassado = {};
  const leftPassado = {};

  for (const m of pastMatches) {
    const da = doubleMap[m.id_double_a];
    const db = doubleMap[m.id_double_b];
    if (!da || !db) continue;
    const rk = getRightKey(da, db);
    const lk = getLeftKey(da, db);
    rightPassado[rk] = (rightPassado[rk] || 0) + 1;
    leftPassado[lk] = (leftPassado[lk] || 0) + 1;
  }

  // 8. Calcular métricas ANTES (pareamento atual nos rounds futuros)
  // Uma "repetição" = RIGHT pair já visto OU LEFT pair já visto (cada um conta separado)
  let mesma_pos_antes_right = 0;
  let mesma_pos_antes_left = 0;
  let mesma_pos_antes_total = 0;
  let mesma_pos_antes_futuro_right = 0;
  let mesma_pos_antes_futuro_left = 0;
  let mesma_pos_antes_futuro = 0;

  const rightAntes = { ...rightPassado };
  const leftAntes = { ...leftPassado };

  for (const r of futureRounds) {
    const matches = futureByRound[r.id_round] || [];
    for (const m of matches) {
      const da = doubleMap[m.id_double_a];
      const db = doubleMap[m.id_double_b];
      if (!da || !db) continue;

      const rk = getRightKey(da, db);
      const lk = getLeftKey(da, db);
      const rSeen = rightAntes[rk] || 0;
      const lSeen = leftAntes[lk] || 0;
      const rPassado = rightPassado[rk] || 0;
      const lPassado = leftPassado[lk] || 0;

      if (rSeen > 0) {
        mesma_pos_antes_right++;
        mesma_pos_antes_total++;
        if (rPassado === 0) { mesma_pos_antes_futuro_right++; mesma_pos_antes_futuro++; }
      }
      if (lSeen > 0) {
        mesma_pos_antes_left++;
        mesma_pos_antes_total++;
        if (lPassado === 0) { mesma_pos_antes_futuro_left++; mesma_pos_antes_futuro++; }
      }

      rightAntes[rk] = rSeen + 1;
      leftAntes[lk] = lSeen + 1;
    }
  }

  console.log(`ANTES → total: ${mesma_pos_antes_total} (right:${mesma_pos_antes_right} + left:${mesma_pos_antes_left}), só-futuro: ${mesma_pos_antes_futuro} (right:${mesma_pos_antes_futuro_right} + left:${mesma_pos_antes_futuro_left})`);

  // 9. Re-pareamento por noite
  // Custo de um matching = nº de repetições de posição (right+left contados separadamente)
  function custo(matching, rightAcum, leftAcum) {
    let c = 0;
    for (const [da, db] of matching) {
      const rk = getRightKey(da, db);
      const lk = getLeftKey(da, db);
      if ((rightAcum[rk] || 0) > 0) c++;
      if ((leftAcum[lk] || 0) > 0) c++;
    }
    return c;
  }

  // Gerar todos os matchings possíveis de um conjunto de doubles
  // Restrição REAL: duas doubles não podem ter jogador em comum no mesmo match
  // (um jogador pode aparecer em 2 doubles na noite, mas cada double só joga 1 match;
  //  se as 2 doubles do jogador ficassem no mesmo match, ele jogaria contra si mesmo)
  // O design SRB rotacional faz um jogador jogar 2x/noite, mas sempre em doubles DIFERENTES e em matches DIFERENTES.

  function doublasCompativel(da, db) {
    // Duas doubles só podem se enfrentar se não têm jogador em comum
    const pa = new Set([da.id_player1, da.id_player2]);
    return ![db.id_player1, db.id_player2].some(p => pa.has(p));
  }

  function gerarMatchings(duplas) {
    if (duplas.length === 0) return [[]];
    if (duplas.length === 1) return [[]]; // sem como parear

    const matchings = [];
    const nJogos = Math.floor(duplas.length / 2);

    function backtrack(remaining, current) {
      if (current.length === nJogos) {
        // Matching completo com todos os jogos necessários
        matchings.push([...current]);
        return;
      }
      if (remaining.length < 2) {
        // Não tem duplas suficientes para completar
        return;
      }

      const first = remaining[0];
      const rest = remaining.slice(1);

      for (let i = 0; i < rest.length; i++) {
        const partner = rest[i];
        if (!doublasCompativel(first, partner)) continue;
        const newRemaining = rest.filter((_, idx) => idx !== i);
        current.push([first, partner]);
        backtrack(newRemaining, current);
        current.pop();
      }
    }

    backtrack(duplas, []);

    // Se não encontrou nenhum matching completo, aceitar parciais
    if (matchings.length === 0) {
      function backtrackPartial(remaining, current) {
        if (remaining.length === 0 || remaining.length === 1) {
          matchings.push([...current]);
          return;
        }
        const first = remaining[0];
        const rest = remaining.slice(1);
        let foundAny = false;
        for (let i = 0; i < rest.length; i++) {
          const partner = rest[i];
          if (!doublasCompativel(first, partner)) continue;
          foundAny = true;
          const newRemaining = rest.filter((_, idx) => idx !== i);
          current.push([first, partner]);
          backtrackPartial(newRemaining, current);
          current.pop();
        }
        if (!foundAny) matchings.push([...current]);
      }
      backtrackPartial(duplas, []);
    }

    return matchings.length > 0 ? matchings : [[]];
  }

  // Acumuladores para o DEPOIS
  const rightDepois = { ...rightPassado };
  const leftDepois = { ...leftPassado };
  let mesma_pos_depois_total = 0;
  let mesma_pos_depois_futuro = 0;
  let mesma_pos_depois_right = 0;
  let mesma_pos_depois_left = 0;
  let mesma_pos_depois_futuro_right = 0;
  let mesma_pos_depois_futuro_left = 0;

  const porNoite = [];

  for (const r of futureRounds) {
    const matches = futureByRound[r.id_round] || [];
    if (matches.length === 0) continue;

    // Coletar doubles desta noite (conjunto fixo)
    const duplasIdsSet = new Set();
    for (const m of matches) {
      duplasIdsSet.add(m.id_double_a);
      duplasIdsSet.add(m.id_double_b);
    }
    const duplas = [...duplasIdsSet].map(id => doubleMap[id]).filter(Boolean);

    // Guardar conjunto original
    const duplasIdsBefore = new Set([...duplasIdsSet]);

    // Limitar busca exaustiva para noites grandes (>12 duplas = número de matchings explosivo)
    let matchings;
    if (duplas.length > 12) {
      // Usar greedy para noites muito grandes (28 e 29)
      console.log(`Noite ${r.scheduled_date}: ${duplas.length} duplas — usando greedy (busca exaustiva inviável)`);
      matchings = [gerarMatchingGreedy(duplas, rightDepois, leftDepois)];
    } else {
      matchings = gerarMatchings(duplas);
      console.log(`Noite ${r.scheduled_date} (round ${r.round_number}): ${duplas.length} duplas, ${matchings.length} matchings`);
    }

    // Escolher matching com menor custo
    let melhorMatching = null;
    let melhorCusto = Infinity;

    for (const matching of matchings) {
      if (matching.length === 0) continue;
      const c = custo(matching, rightDepois, leftDepois);
      if (c < melhorCusto) {
        melhorCusto = c;
        melhorMatching = matching;
      }
    }

    if (!melhorMatching || melhorMatching.length === 0) {
      console.warn(`Noite ${r.scheduled_date}: nenhum matching encontrado`);
      continue;
    }

    // Construir jogos da noite
    const jogos = [];
    for (const [da, db] of melhorMatching) {
      const rk = getRightKey(da, db);
      const lk = getLeftKey(da, db);
      const rSeen = rightDepois[rk] || 0;
      const lSeen = leftDepois[lk] || 0;
      const rPassado = rightPassado[rk] || 0;
      const lPassado = leftPassado[lk] || 0;

      const rightRepete = rSeen > 0;
      const leftRepete = lSeen > 0;
      const mesmaPos = rightRepete || leftRepete;

      if (rightRepete) {
        mesma_pos_depois_total++;
        mesma_pos_depois_right++;
        if (rPassado === 0) { mesma_pos_depois_futuro++; mesma_pos_depois_futuro_right++; }
      }
      if (leftRepete) {
        mesma_pos_depois_total++;
        mesma_pos_depois_left++;
        if (lPassado === 0) { mesma_pos_depois_futuro++; mesma_pos_depois_futuro_left++; }
      }

      let detalhe = null;
      if (mesmaPos) {
        const partes = [];
        if (rightRepete) partes.push(`RIGHT par ${rk} visto ${rSeen}x (${rPassado > 0 ? 'herança passado' : 'só futuro'})`);
        if (leftRepete)  partes.push(`LEFT par ${lk} visto ${lSeen}x (${lPassado > 0 ? 'herança passado' : 'só futuro'})`);
        detalhe = partes.join(' | ');
      }

      jogos.push({
        duplaA: da.display_name,
        duplaB: db.display_name,
        id_double_a: da.id_double,
        id_double_b: db.id_double,
        mesma_pos_repete: mesmaPos,
        right_repete: rightRepete,
        left_repete: leftRepete,
        detalhe,
      });

      rightDepois[rk] = rSeen + 1;
      leftDepois[lk] = lSeen + 1;
    }

    // Validação: conjunto de doubles idêntico ao original
    const duplasIdsAfter = new Set(melhorMatching.flatMap(([da, db]) => [da.id_double, db.id_double]));
    const conjuntoIgual =
      duplasIdsBefore.size === duplasIdsAfter.size &&
      [...duplasIdsBefore].every(id => duplasIdsAfter.has(id));

    porNoite.push({
      data: r.scheduled_date,
      round_number: r.round_number,
      n_duplas: duplas.length,
      n_jogos: jogos.length,
      custo_mesma_pos: melhorCusto,
      conjunto_identico: conjuntoIgual,
      jogos,
    });
  }

  // Greedy helper (para noites >12 duplas) — respeita compatibilidade
  function gerarMatchingGreedy(duplas, rightAcum, leftAcum) {
    const remaining = [...duplas];
    const matching = [];

    while (remaining.length >= 2) {
      const first = remaining.shift();
      let bestIdx = -1;
      let bestCost = Infinity;

      for (let i = 0; i < remaining.length; i++) {
        const partner = remaining[i];
        if (!doublasCompativel(first, partner)) continue; // restrição: sem jogador em comum
        const rk = getRightKey(first, partner);
        const lk = getLeftKey(first, partner);
        const c = ((rightAcum[rk] || 0) > 0 ? 1 : 0) + ((leftAcum[lk] || 0) > 0 ? 1 : 0);
        if (c < bestCost) { bestCost = c; bestIdx = i; }
      }

      if (bestIdx >= 0) {
        const partner = remaining.splice(bestIdx, 1)[0];
        matching.push([first, partner]);
      }
      // Se nenhum parceiro compatível encontrado, 'first' fica sem par (não deveria acontecer nos dados SRB)
    }

    return matching;
  }

  // 10. Validações globais
  const duplas_mesma_noite = porNoite.every(n => n.conjunto_identico);
  const sem_parceria_nova = true; // garantido pela construção

  // Nenhum jogador em 2 jogos na mesma noite — NÃO é uma restrição do SRB (design rotacional)
  // Mas vamos registrar para informação
  let ninguem_2x_noite_info = {};
  for (const noite of porNoite) {
    const jogCounts = {};
    for (const j of noite.jogos) {
      const da = doubleMap[j.id_double_a];
      const db = doubleMap[j.id_double_b];
      for (const pid of [da.id_player1, da.id_player2, db.id_player1, db.id_player2]) {
        jogCounts[pid] = (jogCounts[pid] || 0) + 1;
      }
    }
    const duplos = Object.entries(jogCounts).filter(([, c]) => c > 1).map(([id]) => Number(id));
    if (duplos.length > 0) ninguem_2x_noite_info[noite.data] = duplos;
  }

  let cada_dupla_1x = true;
  for (const noite of porNoite) {
    const ids = noite.jogos.flatMap(j => [j.id_double_a, j.id_double_b]);
    if (new Set(ids).size !== ids.length) cada_dupla_1x = false;
  }

  const validacao = {
    duplas_mesma_noite,
    sem_parceria_nova,
    // SRB tem design rotacional: jogadores podem jogar 2x numa noite — registrado mas não é erro
    design_rotacional_confirmado: Object.keys(ninguem_2x_noite_info).length > 0,
    cada_dupla_1x,
  };

  // 11. Repetições remanescentes
  const repeticoesRem = [];
  const vistasRight = {};
  const vistasLeft = {};

  const rightRemAcum = { ...rightPassado };
  const leftRemAcum = { ...leftPassado };

  for (const noite of porNoite) {
    for (const j of noite.jogos) {
      const da = doubleMap[j.id_double_a];
      const db = doubleMap[j.id_double_b];
      const rk = getRightKey(da, db);
      const lk = getLeftKey(da, db);
      const rSeen = rightRemAcum[rk] || 0;
      const lSeen = leftRemAcum[lk] || 0;
      const rPassado = rightPassado[rk] || 0;
      const lPassado = leftPassado[lk] || 0;

      if (rSeen > 0 && !vistasRight[rk]) {
        vistasRight[rk] = true;
        repeticoesRem.push({
          lado: 'RIGHT',
          par_key: rk,
          vezes: rSeen + 1,
          heranca_passado: rPassado > 0,
        });
      }
      if (lSeen > 0 && !vistasLeft[lk]) {
        vistasLeft[lk] = true;
        repeticoesRem.push({
          lado: 'LEFT',
          par_key: lk,
          vezes: lSeen + 1,
          heranca_passado: lPassado > 0,
        });
      }

      rightRemAcum[rk] = rSeen + 1;
      leftRemAcum[lk] = lSeen + 1;
    }
  }

  // Enriquecer com nomes
  const todosPlayerIds = new Set();
  for (const r of repeticoesRem) {
    r.par_key.split('|').forEach(id => todosPlayerIds.add(Number(id)));
  }
  let playerNames = {};
  if (todosPlayerIds.size > 0) {
    const { data: pls } = await supabase
      .from('players')
      .select('id_player, name')
      .in('id_player', [...todosPlayerIds]);
    if (pls) for (const p of pls) playerNames[p.id_player] = p.name;
  }

  const repeticoesRemFinal = repeticoesRem.map(r => ({
    lado: r.lado,
    par: r.par_key.split('|').map(id => playerNames[Number(id)] || id).join(' vs '),
    vezes: r.vezes,
    heranca_passado: r.heranca_passado,
  }));

  // 12. Output
  const output = {
    por_noite: porNoite,
    metricas: {
      mesma_pos_antes_total,
      mesma_pos_antes_right,
      mesma_pos_antes_left,
      mesma_pos_antes_futuro,
      mesma_pos_antes_futuro_right,
      mesma_pos_antes_futuro_left,
      mesma_pos_depois_total,
      mesma_pos_depois_right,
      mesma_pos_depois_left,
      mesma_pos_depois_futuro,
      mesma_pos_depois_futuro_right,
      mesma_pos_depois_futuro_left,
    },
    validacao,
    repeticoes_remanescentes: repeticoesRemFinal,
  };

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2), 'utf-8');

  // 13. Impressão final
  console.log('\n=== RESULTADO FINAL ===');
  console.log(`Métricas ANTES  → total: ${mesma_pos_antes_total} (right:${mesma_pos_antes_right} + left:${mesma_pos_antes_left}), só-futuro: ${mesma_pos_antes_futuro}`);
  console.log(`Métricas DEPOIS → total: ${mesma_pos_depois_total} (right:${mesma_pos_depois_right} + left:${mesma_pos_depois_left}), só-futuro: ${mesma_pos_depois_futuro}`);
  console.log(`Ganho total: ${mesma_pos_antes_total - mesma_pos_depois_total}`);
  console.log(`Ganho só-futuro: ${mesma_pos_antes_futuro - mesma_pos_depois_futuro}`);
  console.log(`\nValidações:`, JSON.stringify(validacao, null, 2));
  console.log(`\nNoites processadas: ${porNoite.length}`);

  for (const n of porNoite) {
    const repetes = n.jogos.filter(j => j.mesma_pos_repete).length;
    console.log(`\n  ${n.data} (round ${n.round_number}): ${n.n_duplas} duplas → ${n.n_jogos} jogos, custo=${n.custo_mesma_pos} mesma_pos`);
    for (const j of n.jogos) {
      const flag = j.mesma_pos_repete ? ' *** REPETE' : '';
      console.log(`    ${j.duplaA} × ${j.duplaB}${flag}`);
      if (j.detalhe) console.log(`      ${j.detalhe}`);
    }
  }

  console.log(`\nRepetições remanescentes (${repeticoesRemFinal.length}):`);
  for (const r of repeticoesRemFinal) {
    const tipo = r.heranca_passado ? 'PASSADO' : 'FUTURO';
    console.log(`  [${tipo}] ${r.lado}: ${r.par} (${r.vezes}×)`);
  }

  console.log(`\nJSON salvo em: ${OUTPUT_PATH}`);
}

main().catch(e => {
  console.error('ERRO:', e);
  process.exit(1);
});
