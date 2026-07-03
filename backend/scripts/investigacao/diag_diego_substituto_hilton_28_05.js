// READ-ONLY. Por que Diego Pohlmann não apareceu como candidato a substituir
// Hilton De Francheschi (parceiro Sérgio Coelho) no jogo Masc Iniciante de 28/05?
// Reproduz exatamente os 4 filtros de getSubstituteCandidates e imprime o veredito p/ Diego.
// Roda: node scripts/investigacao/diag_diego_substituto_hilton_28_05.js   (cwd = backend/)
const supabase = require('../../supabase');
const svc = require('../../services/substitutionService');

function sidesCompatible(a, b) {
  if (a === 'EITHER' || b === 'EITHER') return true;
  return a !== b;
}

async function findPlayers(like) {
  const { data } = await supabase.from('players')
    .select('id_player, name, side, category_id, id_tournament, active')
    .ilike('name', `%${like}%`);
  return data || [];
}

async function main() {
  console.log('=== 1) Jogadores envolvidos ===');
  const names = ['hilton', 'sérgio coelho', 'sergio coelho', 'william ellw', 'alisson boy', 'diego pohlmann', 'pohlmann'];
  const seen = {};
  for (const n of names) {
    const ppl = await findPlayers(n);
    ppl.forEach(p => { seen[p.id_player] = p; });
  }
  console.table(Object.values(seen).map(p => ({
    id: p.id_player, nome: p.name, side: p.side, cat: p.category_id, torneio: p.id_tournament, active: p.active
  })));

  const find = (frag) => Object.values(seen).find(p => p.name.toLowerCase().includes(frag));
  const hilton = find('hilton');
  const sergio = find('sérgio coelho') || find('sergio coelho') || Object.values(seen).find(p => /s[eé]rgio.*coelho/i.test(p.name));
  const diego = find('pohlmann');
  if (!hilton) return console.log('!! Hilton não encontrado');
  if (!diego)  return console.log('!! Diego Pohlmann não encontrado');

  // 2) Achar a rodada/jogo: dupla Hilton+Sérgio vs William+Alisson, mais recente
  console.log('\n=== 2) Duplas recentes do Hilton ===');
  const { data: hiltonDoubles } = await supabase.from('doubles')
    .select('id_double, id_round, id_player1, id_player2, display_name')
    .or(`id_player1.eq.${hilton.id_player},id_player2.eq.${hilton.id_player}`)
    .order('id_double', { ascending: false })
    .limit(10);
  for (const d of (hiltonDoubles || [])) {
    const { data: r } = await supabase.from('rounds')
      .select('id_round, scheduled_date, status, id_category, round_type').eq('id_round', d.id_round).maybeSingle();
    const { data: mA } = await supabase.from('matches').select('id_match, id_double_a, id_double_b, status, score_a, score_b, scheduled_at').eq('id_double_a', d.id_double);
    const { data: mB } = await supabase.from('matches').select('id_match, id_double_a, id_double_b, status, score_a, score_b, scheduled_at').eq('id_double_b', d.id_double);
    const matches = [...(mA||[]), ...(mB||[])];
    console.log(`\n double ${d.id_double} (round ${d.id_round} ${r?.scheduled_date} ${r?.status} cat=${r?.id_category}): ${d.display_name}`);
    for (const m of matches) {
      const otherId = m.id_double_a === d.id_double ? m.id_double_b : m.id_double_a;
      const { data: other } = await supabase.from('doubles').select('display_name').eq('id_double', otherId).maybeSingle();
      console.log(`     match ${m.id_match} [${m.status}] ${m.score_a}x${m.score_b}  vs ${other?.display_name}  @${m.scheduled_at}`);
    }
  }

  // 3) Diagnóstico do Diego contra os 4 filtros, p/ a categoria do Hilton
  console.log('\n=== 3) Diagnóstico de elegibilidade do Diego ===');
  console.log(`Hilton: cat=${hilton.category_id} torneio=${hilton.id_tournament}`);
  console.log(`Diego : cat=${diego.category_id} torneio=${diego.id_tournament} side=${diego.side} active=${diego.active}`);
  console.log(`Sérgio (parceiro): ${sergio ? `cat=${sergio.category_id} side=${sergio.side}` : 'NÃO ENCONTRADO p/ nome'}`);
  console.log('\n Filtros de getSubstituteCandidates (catPlayers exige category_id == round.id_category E id_tournament == round.id_tournament):');
  console.log(`  [A] mesma categoria do jogo?  Diego.cat(${diego.category_id}) == Hilton.cat(${hilton.category_id}) ? ${diego.category_id === hilton.category_id ? 'SIM' : '❌ NÃO → some da lista'}`);
  console.log(`  [B] mesmo torneio?            Diego.torn(${diego.id_tournament}) == Hilton.torn(${hilton.id_tournament}) ? ${diego.id_tournament === hilton.id_tournament ? 'SIM' : '❌ NÃO → some da lista'}`);
  if (sergio) {
    console.log(`  [C] side compatível c/ Sérgio? sidesCompatible(Diego ${diego.side}, Sérgio ${sergio.side}) ? ${sidesCompatible(diego.side, sergio.side) ? 'SIM' : '❌ NÃO → some da lista'}`);
  }
  console.log(`  [D] active != false?          Diego.active=${diego.active} (false → soft-deleted, some)`);

  console.log('\n💡 Para o filtro [busy] preciso do match exato — copie o MATCH_ID do passo 2 e me passe, ou rode getSubstituteCandidates abaixo.');
}

main().catch(e => { console.error('ERRO:', e); process.exit(1); });