// Candidatos pra jogar com Cristiano Severo hoje (2026-05-07)
// — incluindo quem já tem jogo nesta rodada (relaxa filtro busyIds)
// Roda: node scripts/investigacao/candidatos_cristiano_hoje.js  (cwd = backend/)

const supabase = require('../../supabase');

function sidesCompatible(a, b) {
  if (a === 'EITHER' || b === 'EITHER') return true;
  return a !== b;
}

async function main() {
  // 1. Cristiano Severo
  const { data: ppl } = await supabase
    .from('players')
    .select('id_player, name, side, category_id, id_tournament')
    .ilike('name', '%cristiano%severo%');
  if (!ppl || ppl.length === 0) { console.log('Cristiano não encontrado'); return; }
  const cris = ppl[0];
  console.log('=== Cristiano ===');
  console.log(cris);

  // 2. Rodada CONFIRMED/AWAITING mais recente da categoria de Cristiano
  const { data: rounds } = await supabase
    .from('rounds')
    .select('id_round, scheduled_date, status, id_category, id_tournament, round_type')
    .eq('id_tournament', cris.id_tournament)
    .eq('id_category', cris.category_id)
    .order('scheduled_date', { ascending: false })
    .limit(5);
  console.log('\n=== Últimas rodadas da categoria ===');
  console.log(rounds);

  // Pega a rodada de hoje (2026-05-07) ou a mais próxima futura
  const today = '2026-05-07';
  let round = (rounds || []).find(r => r.scheduled_date === today)
           || (rounds || []).find(r => r.scheduled_date >= today)
           || (rounds || [])[0];
  if (!round) { console.log('Nenhuma rodada encontrada'); return; }
  console.log('\n=== Rodada-alvo ===', round);

  // 3. Match de Cristiano nessa rodada
  const { data: doubles } = await supabase
    .from('doubles')
    .select('id_double, id_player1, id_player2, display_name')
    .eq('id_round', round.id_round);
  const meuDouble = (doubles || []).find(d => d.id_player1 === cris.id_player || d.id_player2 === cris.id_player);
  if (!meuDouble) { console.log('Cristiano não está em dupla nesta rodada'); return; }
  const partnerId = meuDouble.id_player1 === cris.id_player ? meuDouble.id_player2 : meuDouble.id_player1;
  const { data: partnerArr } = await supabase
    .from('players').select('id_player, name, side').eq('id_player', partnerId);
  const partner = partnerArr?.[0];
  console.log('\n=== Dupla atual ===', meuDouble.display_name, '| parceiro=', partner?.name, partner?.side);

  // Cenário A: Alisson sai → substituto joga COM Cristiano (side compatível com Cristiano)
  // Cenário B: Cristiano sai → substituto joga com Alisson (side compatível com Alisson)
  // O usuário pediu "atletas que podem jogar COM Cristiano" → Cenário A.
  console.log('\nCristiano side =', cris.side, '— substituto precisa side compatível com Cristiano (≠ ou EITHER)');

  // 4. Players da mesma categoria
  const { data: catPlayers } = await supabase
    .from('players')
    .select('id_player, name, side')
    .eq('id_tournament', cris.id_tournament)
    .eq('category_id', cris.category_id);

  // 5. Quem está ocupado nesta rodada
  const busyIds = new Set();
  (doubles || []).forEach(d => { busyIds.add(d.id_player1); busyIds.add(d.id_player2); });

  // 6. Attendance pra mostrar status
  const { data: att } = await supabase
    .from('round_attendance').select('id_player, status').eq('id_round', round.id_round);
  const attMap = {};
  (att || []).forEach(a => { attMap[a.id_player] = a.status; });

  // 7. Filtrar: mesma categoria, ≠ Cristiano, side compatível com Cristiano
  //    INCLUI quem já tem jogo (relaxando o filtro busy)
  const candidates = (catPlayers || [])
    .filter(p => p.id_player !== cris.id_player)
    .filter(p => sidesCompatible(p.side, cris.side))
    .map(p => ({
      id: p.id_player,
      nome: p.name,
      side: p.side,
      ja_joga_hoje: busyIds.has(p.id_player) ? 'SIM' : 'não',
      attendance: attMap[p.id_player] || 'NOT_SELECTED',
    }))
    .sort((a, b) => {
      if (a.ja_joga_hoje !== b.ja_joga_hoje) return a.ja_joga_hoje === 'não' ? -1 : 1;
      return a.nome.localeCompare(b.nome);
    });

  console.log('\n=== Candidatos pra jogar COM Cristiano (mesmo já tendo jogo) ===');
  console.table(candidates);

  // Quebra disponíveis vs ocupados
  const livres = candidates.filter(c => c.ja_joga_hoje === 'não');
  const ocupados = candidates.filter(c => c.ja_joga_hoje === 'SIM');
  console.log(`\nLivres: ${livres.length} | Já jogando hoje: ${ocupados.length}`);
}

main().catch(e => { console.error(e); process.exit(1); });
