// _lev_correcoes_inic.js — Levantamento READ-ONLY cat Masculino Iniciante (id_category=1)
// NÃO escreve no banco. Apenas lê e gera relatório.

const supabase = require('../../supabase');
const fs = require('fs');

const ID_CATEGORY = 1;
const ID_TOURNAMENT = 7;
const TODAY = '2026-06-26';
const OUTPUT_PATH = 'C:/Users/aless/AppData/Local/Temp/claude/c--obralivre/9484ee84-3113-43fa-bba2-ad6b4cbae786/scratchpad/lev_correcoes.json';

async function main() {
  const result = {};

  // ─────────────────────────────────────────────
  // 1. Carrega rounds REGULAR da cat 1
  // ─────────────────────────────────────────────
  const { data: rounds, error: roundsErr } = await supabase
    .from('rounds')
    .select('id_round, round_number, scheduled_date, round_type, status')
    .eq('id_category', ID_CATEGORY)
    .eq('round_type', 'REGULAR')
    .order('scheduled_date', { ascending: true });

  if (roundsErr) throw new Error('rounds: ' + roundsErr.message);
  const roundIds = rounds.map(r => r.id_round);
  const roundMap = Object.fromEntries(rounds.map(r => [r.id_round, r]));

  console.log(`Rounds REGULAR cat 1: ${rounds.length}`);
  rounds.forEach(r => console.log(`  round ${r.id_round} (${r.round_number}) — ${r.scheduled_date} [${r.status}]`));

  // ─────────────────────────────────────────────
  // 2. Carrega doubles desses rounds
  // ─────────────────────────────────────────────
  const { data: doubles, error: doublesErr } = await supabase
    .from('doubles')
    .select('id_double, id_player1, id_player2, id_round, display_name')
    .in('id_round', roundIds);

  if (doublesErr) throw new Error('doubles: ' + doublesErr.message);
  const doubleIds = doubles.map(d => d.id_double);
  console.log(`\nDoubles carregados: ${doubles.length}`);

  // ─────────────────────────────────────────────
  // 3. Carrega matches desses doubles
  // ─────────────────────────────────────────────
  const { data: matchesA, error: mErrA } = await supabase
    .from('matches')
    .select('id_match, id_double_a, id_double_b, scheduled_at, status')
    .in('id_double_a', doubleIds);

  const { data: matchesB, error: mErrB } = await supabase
    .from('matches')
    .select('id_match, id_double_a, id_double_b, scheduled_at, status')
    .in('id_double_b', doubleIds);

  if (mErrA) throw new Error('matchesA: ' + mErrA.message);
  if (mErrB) throw new Error('matchesB: ' + mErrB.message);

  // Dedup por id_match
  const allMatchesMap = {};
  [...(matchesA || []), ...(matchesB || [])].forEach(m => { allMatchesMap[m.id_match] = m; });
  const allMatches = Object.values(allMatchesMap);
  console.log(`Matches carregados: ${allMatches.length}`);

  // ─────────────────────────────────────────────
  // 4. Carrega players ativos da cat 1
  // ─────────────────────────────────────────────
  const { data: players, error: playersErr } = await supabase
    .from('players')
    .select('id_player, name, side, category_id, active')
    .eq('category_id', ID_CATEGORY)
    .eq('active', true);

  if (playersErr) throw new Error('players: ' + playersErr.message);
  const playerMap = Object.fromEntries(players.map(p => [p.id_player, p]));
  console.log(`Players ativos cat 1: ${players.length}`);

  // ─────────────────────────────────────────────
  // 5. Carrega player_absences
  // ─────────────────────────────────────────────
  const playerIds = players.map(p => p.id_player);
  const { data: absences, error: absErr } = await supabase
    .from('player_absences')
    .select('id_player, absence_date')
    .in('id_player', playerIds);

  if (absErr) throw new Error('absences: ' + absErr.message);
  console.log(`Ausências carregadas: ${absences.length}`);

  // ─────────────────────────────────────────────
  // Helper: encontra double pelo id_round + players
  // ─────────────────────────────────────────────
  const doubleMap = Object.fromEntries(doubles.map(d => [d.id_double, d]));

  function getDoubleRound(id_double) {
    const d = doubleMap[id_double];
    return d ? roundMap[d.id_round] : null;
  }

  function getMatchDate(match) {
    if (match.scheduled_at) return match.scheduled_at.slice(0, 10);
    // Derive da round
    const dA = doubleMap[match.id_double_a];
    if (dA) {
      const r = roundMap[dA.id_round];
      if (r) return r.scheduled_date;
    }
    return null;
  }

  // ─────────────────────────────────────────────
  // PARTE A — Alexandre Gonzaga / Diego Schutz
  // ─────────────────────────────────────────────
  console.log('\n═══ PARTE A — Alexandre Gonzaga / Diego Schutz ═══');

  // Acha ids
  const alexandre = players.find(p => p.name.toLowerCase().includes('alexandre gonzaga'));
  const diego = players.find(p => p.name.toLowerCase().includes('diego schutz'));

  if (!alexandre) {
    console.log('ATENÇÃO: Alexandre Gonzaga não encontrado nos players ativos');
  }
  if (!diego) {
    console.log('ATENÇÃO: Diego Schutz não encontrado nos players ativos');
  }

  console.log('\nAlexandre:', alexandre);
  console.log('Diego:', diego);

  // Função: qual side o player é? RIGHT=id_player1, LEFT=id_player2
  // Encontra todas as doubles que contêm ambos
  let ocorrenciasDupla = [];
  if (alexandre && diego) {
    // Eles só podem jogar juntos se um é RIGHT e outro é LEFT
    doubles.forEach(d => {
      const jogadores = [d.id_player1, d.id_player2];
      if (jogadores.includes(alexandre.id_player) && jogadores.includes(diego.id_player)) {
        // Achou uma dupla com ambos
        const round = roundMap[d.id_round];
        // Acha o match desta double
        const match = allMatches.find(m => m.id_double_a === d.id_double || m.id_double_b === d.id_double);
        const matchDate = match ? getMatchDate(match) : round?.scheduled_date;
        const isFuturo = matchDate ? matchDate > TODAY : null;

        ocorrenciasDupla.push({
          id_double: d.id_double,
          display_name: d.display_name,
          id_round: d.id_round,
          round_number: round?.round_number,
          scheduled_date: round?.scheduled_date,
          match_date: matchDate,
          id_match: match?.id_match,
          match_status: match?.status,
          double_status: round?.status,
          futuro: isFuturo,
          alexandre_side: d.id_player1 === alexandre.id_player ? 'RIGHT(player1)' : 'LEFT(player2)',
          diego_side: d.id_player1 === diego.id_player ? 'RIGHT(player1)' : 'LEFT(player2)',
        });
      }
    });
  }

  console.log(`\nOcorrências Alexandre+Diego como dupla: ${ocorrenciasDupla.length}`);
  ocorrenciasDupla.forEach(o => {
    console.log(`  id_double=${o.id_double} | round ${o.round_number} | ${o.scheduled_date} | match=${o.id_match} | futuro=${o.futuro}`);
  });

  result.ocorrencias_dupla = ocorrenciasDupla;

  // ─────────────────────────────────────────────
  // Parcerias de Alexandre: com quem já jogou (além de Diego)
  // ─────────────────────────────────────────────
  function parceriasJaFeitas(playerId, playerSide) {
    // Dado o player e seu side, acha todos os parceiros do lado oposto
    const parceiros = [];
    doubles.forEach(d => {
      const round = roundMap[d.id_round];
      if (!round) return; // não é round da cat 1

      let parceirId = null;
      if (playerSide === 'RIGHT' && d.id_player1 === playerId) {
        parceirId = d.id_player2; // parceiro é LEFT
      } else if (playerSide === 'LEFT' && d.id_player2 === playerId) {
        parceirId = d.id_player1; // parceiro é RIGHT
      }

      if (parceirId) {
        const match = allMatches.find(m => m.id_double_a === d.id_double || m.id_double_b === d.id_double);
        const matchDate = match ? getMatchDate(match) : round?.scheduled_date;
        parceiros.push({
          id_double: d.id_double,
          id_parceiro: parceirId,
          nome_parceiro: playerMap[parceirId]?.name || `id=${parceirId}`,
          id_round: d.id_round,
          round_number: round.round_number,
          scheduled_date: round.scheduled_date,
          match_date: matchDate,
          futuro: matchDate ? matchDate > TODAY : null,
        });
      }
    });
    return parceiros;
  }

  let alexandreParcerias = [];
  let alexandreSide = null;
  let diegoParcerias = [];
  let diegoSide = null;

  if (alexandre) {
    alexandreSide = alexandre.side; // do campo side no players
    alexandreParcerias = parceriasJaFeitas(alexandre.id_player, alexandreSide);
    console.log(`\nParcerias de Alexandre (side=${alexandreSide}): ${alexandreParcerias.length} doubles`);
    alexandreParcerias.forEach(p => {
      console.log(`  ${p.nome_parceiro} | round ${p.round_number} | ${p.scheduled_date} | futuro=${p.futuro}`);
    });
  }

  if (diego) {
    diegoSide = diego.side;
    diegoParcerias = parceriasJaFeitas(diego.id_player, diegoSide);
    console.log(`\nParcerias de Diego (side=${diegoSide}): ${diegoParcerias.length} doubles`);
    diegoParcerias.forEach(p => {
      console.log(`  ${p.nome_parceiro} | round ${p.round_number} | ${p.scheduled_date} | futuro=${p.futuro}`);
    });
  }

  // Inéditos: players do lado oposto com quem ainda NÃO formou dupla
  function parceirosIneditos(playerId, playerSide, parceriasJaFeitas) {
    const ladoOposto = playerSide === 'RIGHT' ? 'LEFT' : 'RIGHT';
    const jaJogouCom = new Set(parceriasJaFeitas.map(p => p.id_parceiro));
    return players.filter(p => p.side === ladoOposto && !jaJogouCom.has(p.id_player) && p.id_player !== playerId);
  }

  let alexandreIneditos = [];
  let diegoIneditos = [];

  if (alexandre && alexandreSide) {
    alexandreIneditos = parceirosIneditos(alexandre.id_player, alexandreSide, alexandreParcerias);
    console.log(`\nInéditos disponíveis para Alexandre: ${alexandreIneditos.length}`);
    alexandreIneditos.forEach(p => console.log(`  ${p.name} (id=${p.id_player}, side=${p.side})`));
  }

  if (diego && diegoSide) {
    diegoIneditos = parceirosIneditos(diego.id_player, diegoSide, diegoParcerias);
    console.log(`\nInéditos disponíveis para Diego: ${diegoIneditos.length}`);
    diegoIneditos.forEach(p => console.log(`  ${p.name} (id=${p.id_player}, side=${p.side})`));
  }

  result.alexandre_parcerias = alexandreParcerias;
  result.alexandre_ineditos = alexandreIneditos;
  result.diego_parcerias = diegoParcerias;
  result.diego_ineditos = diegoIneditos;

  // ─────────────────────────────────────────────
  // Opções de reforma: para cada ocorrência FUTURA extra (além de 1)
  // quais jogadores do lado oposto a cada um estão presentes naquela noite
  // e seriam parceiros INÉDITOS?
  // ─────────────────────────────────────────────
  const ocorrenciasFuturas = ocorrenciasDupla.filter(o => o.futuro === true);
  console.log(`\nOcorrências FUTURAS de Alexandre+Diego: ${ocorrenciasFuturas.length}`);

  // A 1a pode ficar, as demais são "extras"
  const ocorrenciasExtras = ocorrenciasFuturas.slice(1);

  const opcoes_reforma = [];

  for (const extra of ocorrenciasExtras) {
    const roundId = extra.id_round;
    const roundData = roundMap[roundId];
    const data = extra.scheduled_date;

    // Quais doubles jogam nessa noite?
    const doublesNaNoite = doubles.filter(d => d.id_round === roundId);
    const playersNaNoite = new Set();
    doublesNaNoite.forEach(d => {
      if (d.id_player1) playersNaNoite.add(d.id_player1);
      if (d.id_player2) playersNaNoite.add(d.id_player2);
    });

    // Lado de Alexandre
    const alexandreLadoOposto = alexandreSide === 'RIGHT' ? 'LEFT' : 'RIGHT';
    const alexandreJaJogouCom = new Set(alexandreParcerias.map(p => p.id_parceiro));
    const inEditosAlexandreNaNoite = [...playersNaNoite]
      .filter(pid => {
        const p = playerMap[pid];
        return p && p.side === alexandreLadoOposto && !alexandreJaJogouCom.has(pid) && pid !== alexandre?.id_player && pid !== diego?.id_player;
      })
      .map(pid => ({ id_player: pid, name: playerMap[pid].name, side: playerMap[pid].side }));

    // Lado de Diego
    const diegoLadoOposto = diegoSide === 'RIGHT' ? 'LEFT' : 'RIGHT';
    const diegoJaJogouCom = new Set(diegoParcerias.map(p => p.id_parceiro));
    const inEditosDiegoNaNoite = [...playersNaNoite]
      .filter(pid => {
        const p = playerMap[pid];
        return p && p.side === diegoLadoOposto && !diegoJaJogouCom.has(pid) && pid !== alexandre?.id_player && pid !== diego?.id_player;
      })
      .map(pid => ({ id_player: pid, name: playerMap[pid].name, side: playerMap[pid].side }));

    opcoes_reforma.push({
      ocorrencia_extra: extra,
      round: roundData,
      data,
      players_na_noite: [...playersNaNoite].map(pid => ({ id: pid, name: playerMap[pid]?.name, side: playerMap[pid]?.side })),
      ineditos_para_alexandre_nessa_noite: inEditosAlexandreNaNoite,
      ineditos_para_diego_nessa_noite: inEditosDiegoNaNoite,
      nota: 'Para desfazer a dupla repetida, Alexandre e Diego precisariam ser separados — cada um joga com um inédito da lista acima (se ambos aparecerem nessa noite)'
    });

    console.log(`\nOcorrência extra: round ${extra.round_number} (${data})`);
    console.log(`  Inéditos para Alexandre nessa noite: ${inEditosAlexandreNaNoite.map(p => p.name).join(', ') || 'nenhum'}`);
    console.log(`  Inéditos para Diego nessa noite: ${inEditosDiegoNaNoite.map(p => p.name).join(', ') || 'nenhum'}`);
  }

  result.opcoes_reforma = opcoes_reforma;

  // ─────────────────────────────────────────────
  // PARTE B — Alisson Boyink
  // ─────────────────────────────────────────────
  console.log('\n═══ PARTE B — Alisson Boyink ═══');

  const alisson = players.find(p => p.name.toLowerCase().includes('alisson boyink') || p.name.toLowerCase().includes('boyink'));
  console.log('\nAlisson:', alisson);

  let alissonAusencias = [];
  let alissonJogo0207 = null;
  let datasViaveisAlisson = [];
  let opcoes_swap = [];

  if (alisson) {
    alissonAusencias = absences.filter(a => a.id_player === alisson.id_player);
    console.log(`\nAusências de Alisson: ${alissonAusencias.length}`);
    alissonAusencias.forEach(a => console.log(`  ${a.absence_date}`));

    const ausenciaDatas = new Set(alissonAusencias.map(a => a.absence_date));
    const ausente0207 = ausenciaDatas.has('2026-07-02');
    console.log(`Ausente em 02/07: ${ausente0207}`);

    // Rounds futuros
    const roundsFuturos = rounds.filter(r => r.scheduled_date > TODAY);
    console.log(`\nRounds REGULAR futuros: ${roundsFuturos.length}`);

    // Datas viáveis (Alisson não tem ausência)
    datasViaveisAlisson = roundsFuturos
      .filter(r => !ausenciaDatas.has(r.scheduled_date))
      .map(r => ({ id_round: r.id_round, round_number: r.round_number, scheduled_date: r.scheduled_date, status: r.status }));

    console.log(`\nDatas viáveis para Alisson (sem ausência declarada):`);
    datasViaveisAlisson.forEach(r => console.log(`  round ${r.round_number} — ${r.scheduled_date}`));

    // Jogo de Alisson em 02/07
    // Acha o round de 02/07
    const round0207 = rounds.find(r => r.scheduled_date === '2026-07-02');
    if (round0207) {
      // Acha a double de Alisson nesse round
      const doubleAlisson0207 = doubles.find(d =>
        d.id_round === round0207.id_round &&
        (d.id_player1 === alisson.id_player || d.id_player2 === alisson.id_player)
      );

      if (doubleAlisson0207) {
        // Acha o match
        const match0207 = allMatches.find(m =>
          m.id_double_a === doubleAlisson0207.id_double || m.id_double_b === doubleAlisson0207.id_double
        );

        if (match0207) {
          const doubleAdv = doubleMap[match0207.id_double_a === doubleAlisson0207.id_double ? match0207.id_double_b : match0207.id_double_a];
          alissonJogo0207 = {
            id_match: match0207.id_match,
            scheduled_at: match0207.scheduled_at,
            status: match0207.status,
            dupla_alisson: {
              id_double: doubleAlisson0207.id_double,
              display_name: doubleAlisson0207.display_name,
              id_player1: doubleAlisson0207.id_player1,
              name_player1: playerMap[doubleAlisson0207.id_player1]?.name,
              id_player2: doubleAlisson0207.id_player2,
              name_player2: playerMap[doubleAlisson0207.id_player2]?.name,
            },
            adversarios: doubleAdv ? {
              id_double: doubleAdv.id_double,
              display_name: doubleAdv.display_name,
              id_player1: doubleAdv.id_player1,
              name_player1: playerMap[doubleAdv.id_player1]?.name,
              id_player2: doubleAdv.id_player2,
              name_player2: playerMap[doubleAdv.id_player2]?.name,
            } : null,
            round: round0207,
          };
          console.log('\nJogo de Alisson em 02/07:');
          console.log('  Dupla:', alissonJogo0207.dupla_alisson.display_name);
          console.log('  Adversários:', alissonJogo0207.adversarios?.display_name);
          console.log('  Status:', alissonJogo0207.status);
        } else {
          console.log('Double encontrada mas sem match associado em 02/07');
          alissonJogo0207 = { double: doubleAlisson0207, round: round0207, match: null };
        }
      } else {
        console.log('Alisson não tem double escalado no round de 02/07');
        alissonJogo0207 = { round: round0207, double: null };
      }
    } else {
      console.log('Não existe round em 02/07');
    }

    // ─────────────────────────────────────────────
    // Opções de SWAP
    // Contar jogos por player por data (para checar max 2/dia)
    // ─────────────────────────────────────────────

    // Monta mapa: data → lista de players com quantos jogos
    const jogosPorDataPorPlayer = {};

    allMatches.forEach(m => {
      const dA = doubleMap[m.id_double_a];
      const dB = doubleMap[m.id_double_b];
      const date = getMatchDate(m);
      if (!date) return;

      if (!jogosPorDataPorPlayer[date]) jogosPorDataPorPlayer[date] = {};

      [dA, dB].forEach(d => {
        if (!d) return;
        [d.id_player1, d.id_player2].forEach(pid => {
          if (!pid) return;
          jogosPorDataPorPlayer[date][pid] = (jogosPorDataPorPlayer[date][pid] || 0) + 1;
        });
      });
    });

    if (alissonJogo0207 && alissonJogo0207.id_match) {
      const { dupla_alisson, adversarios } = alissonJogo0207;
      // 4 atletas envolvidos no jogo de Alisson
      const atletasJogo = [dupla_alisson.id_player1, dupla_alisson.id_player2, adversarios?.id_player1, adversarios?.id_player2].filter(Boolean);

      console.log('\nAtletas no jogo de Alisson em 02/07:', atletasJogo.map(id => playerMap[id]?.name));

      // Para cada data viável de Alisson, verifica se mover o jogo é possível
      // (nenhum dos 4 já tem 2 jogos nessa data)
      for (const roundDestino of datasViaveisAlisson) {
        const dataDestino = roundDestino.scheduled_date;
        const jogosDia = jogosPorDataPorPlayer[dataDestino] || {};

        const bloqueados = atletasJogo.filter(pid => (jogosDia[pid] || 0) >= 2);
        const quaseBloqueados = atletasJogo.filter(pid => (jogosDia[pid] || 0) === 1);

        opcoes_swap.push({
          data_destino: dataDestino,
          round_destino: roundDestino,
          bloqueados: bloqueados.map(pid => ({ id: pid, name: playerMap[pid]?.name, jogos_dia: jogosDia[pid] })),
          quase_bloqueados: quaseBloqueados.map(pid => ({ id: pid, name: playerMap[pid]?.name, jogos_dia: jogosDia[pid] })),
          viavel: bloqueados.length === 0,
          nota: bloqueados.length === 0
            ? 'Nenhum dos 4 atletas teria 2+ jogos — SWAP VIÁVEL'
            : `Bloqueio: ${bloqueados.map(pid => playerMap[pid]?.name).join(', ')} já teria 2 jogos nessa data`
        });
      }

      const swapsViaveis = opcoes_swap.filter(s => s.viavel);
      console.log(`\nSwaps viáveis (max 2/dia respeitado): ${swapsViaveis.length}`);
      swapsViaveis.slice(0, 3).forEach(s => {
        console.log(`  → ${s.data_destino} (round ${s.round_destino.round_number}): VIÁVEL`);
      });
      const swapsInviaveis = opcoes_swap.filter(s => !s.viavel);
      swapsInviaveis.forEach(s => {
        console.log(`  → ${s.data_destino}: bloqueado por ${s.bloqueados.map(b => b.name).join(', ')}`);
      });
    }
  }

  result.alisson_ausencias = alissonAusencias;
  result.alisson_jogo_0207 = alissonJogo0207;
  result.datas_viaveis_alisson = datasViaveisAlisson;
  result.opcoes_swap = opcoes_swap;

  // ─────────────────────────────────────────────
  // Salva JSON
  // ─────────────────────────────────────────────
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(result, null, 2), 'utf8');
  console.log(`\n✓ JSON salvo em ${OUTPUT_PATH}`);

  // ─────────────────────────────────────────────
  // Resumo final no console
  // ─────────────────────────────────────────────
  console.log('\n' + '═'.repeat(60));
  console.log('RESUMO FINAL');
  console.log('═'.repeat(60));

  console.log('\n[A] Alexandre Gonzaga / Diego Schutz');
  console.log(`  Total de vezes como dupla: ${ocorrenciasDupla.length}`);
  console.log(`  Futuras: ${ocorrenciasFuturas.length}`);
  if (ocorrenciasExtras.length > 0) {
    console.log(`  Extras a resolver: ${ocorrenciasExtras.length}`);
    opcoes_reforma.forEach((op, i) => {
      console.log(`  Extra ${i + 1}: round ${op.ocorrencia_extra.round_number} (${op.data})`);
      if (op.ineditos_para_alexandre_nessa_noite.length > 0) {
        console.log(`    Alexandre pode jogar com: ${op.ineditos_para_alexandre_nessa_noite.map(p => p.name).join(', ')}`);
      } else {
        console.log(`    Alexandre: sem inéditos nessa noite`);
      }
      if (op.ineditos_para_diego_nessa_noite.length > 0) {
        console.log(`    Diego pode jogar com: ${op.ineditos_para_diego_nessa_noite.map(p => p.name).join(', ')}`);
      } else {
        console.log(`    Diego: sem inéditos nessa noite`);
      }
    });
  }

  console.log('\n[B] Alisson Boyink');
  if (alisson) {
    console.log(`  Side: ${alisson.side}`);
    console.log(`  Ausências: ${alissonAusencias.map(a => a.absence_date).join(', ')}`);
    if (alissonJogo0207?.id_match) {
      console.log(`  Jogo em 02/07: ${alissonJogo0207.dupla_alisson?.display_name} vs ${alissonJogo0207.adversarios?.display_name} (match ${alissonJogo0207.id_match})`);
    }
    const swapsViaveis = opcoes_swap.filter(s => s.viavel);
    if (swapsViaveis.length > 0) {
      console.log(`  Swaps viáveis: ${swapsViaveis.slice(0, 2).map(s => s.data_destino + ' (round ' + s.round_destino.round_number + ')').join(' | ')}`);
    } else {
      console.log('  Nenhum swap totalmente viável encontrado (todos têm algum bloqueio de 2x/dia)');
    }
  }
}

main().catch(err => {
  console.error('ERRO:', err);
  process.exit(1);
});
