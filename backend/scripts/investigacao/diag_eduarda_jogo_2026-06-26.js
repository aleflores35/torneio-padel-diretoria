// READ-ONLY. Investiga o jogo da Eduarda (Fem. Iniciante) reportado via WhatsApp:
// "Eduarda/Paola 9 x Sabrina/Nicole 7". Acha a atleta, suas doubles, e os matches
// recentes com status/placar — pra entender o que existe no banco antes de lançar.
const supabase = require('../../supabase');

async function main() {
  if (!supabase) { console.error('Supabase NÃO configurado (.env ausente?).'); process.exit(1); }

  // 1) Eduardas
  const { data: eds, error: e1 } = await supabase.from('players')
    .select('id_player,name,side,category_id,id_tournament').ilike('name', '%eduarda%');
  if (e1) console.error('players err', e1);
  console.log('=== Jogadoras "Eduarda" ===');
  console.table((eds || []).map(p => ({ id: p.id_player, nome: p.name, side: p.side, cat: p.category_id, torneio: p.id_tournament })));

  const eduarda = (eds || []).find(p => /lemos/i.test(p.name)) || (eds || [])[0];
  if (!eduarda) { console.log('Eduarda não encontrada.'); return; }
  console.log(`\n>>> Eduarda escolhida: id=${eduarda.id_player} "${eduarda.name}" cat=${eduarda.category_id}\n`);

  // 2) Doubles dela
  const { data: dbls } = await supabase.from('doubles')
    .select('id_double,id_round,display_name,id_player1,id_player2')
    .or(`id_player1.eq.${eduarda.id_player},id_player2.eq.${eduarda.id_player}`);
  const rIds = [...new Set((dbls || []).map(d => d.id_round))];
  const { data: rounds } = await supabase.from('rounds')
    .select('id_round,scheduled_date,id_category,status,round_number')
    .in('id_round', rIds.length ? rIds : [-1]);
  const rmap = {}; (rounds || []).forEach(r => rmap[r.id_round] = r);
  console.log(`=== Doubles da Eduarda (${(dbls || []).length}) ===`);
  console.table((dbls || []).map(d => ({
    id_double: d.id_double, round: d.id_round,
    data: rmap[d.id_round]?.scheduled_date, round_status: rmap[d.id_round]?.status,
    nome: d.display_name,
  })));

  // 3) Matches dessas doubles
  const dIds = (dbls || []).map(d => d.id_double);
  if (!dIds.length) { console.log('Eduarda sem doubles.'); return; }
  const { data: mA } = await supabase.from('matches').select('*').in('id_double_a', dIds);
  const { data: mB } = await supabase.from('matches').select('*').in('id_double_b', dIds);
  const seen = new Set();
  const matches = [...(mA || []), ...(mB || [])].filter(m => { if (seen.has(m.id_match)) return false; seen.add(m.id_match); return true; });

  const allDIds = [...new Set(matches.flatMap(m => [m.id_double_a, m.id_double_b]))];
  const { data: allD } = await supabase.from('doubles').select('id_double,display_name,id_round').in('id_double', allDIds.length ? allDIds : [-1]);
  const dmap = {}; (allD || []).forEach(d => dmap[d.id_double] = d);

  console.log(`\n=== Matches que envolvem a Eduarda (${matches.length}) ===`);
  console.table(matches
    .sort((a, b) => (a.scheduled_at || '').localeCompare(b.scheduled_at || ''))
    .map(m => ({
      match: m.id_match,
      data: rmap[dmap[m.id_double_a]?.id_round]?.scheduled_date || rmap[dmap[m.id_double_b]?.id_round]?.scheduled_date,
      A: dmap[m.id_double_a]?.display_name,
      B: dmap[m.id_double_b]?.display_name,
      placar: `${m.score_a ?? '-'} x ${m.score_b ?? '-'}`,
      status: m.status,
      quando: m.scheduled_at,
    })));

  if (matches[0]) console.log('\nColunas da tabela matches:', Object.keys(matches[0]).join(', '));
}
main().catch(e => { console.error(e); process.exit(1); });
