// Jogo do Alessandro hoje (2026-05-28). Read-only.
const supabase = require('../../supabase');

async function main() {
  const { data: ppl } = await supabase.from('players')
    .select('id_player, name, side, category_id, id_tournament')
    .or('name.ilike.%alessandro%,name.ilike.%flores%');
  console.log('=== Jogadores Alessandro/Flores ===');
  console.table((ppl||[]).map(p => ({ id: p.id_player, nome: p.name, side: p.side, cat: p.category_id, torneio: p.id_tournament })));
  if (!ppl || !ppl.length) { console.log('Nenhum jogador Alessandro/Flores encontrado.'); return; }

  for (const me of ppl) {
    // duplas do jogador hoje
    const { data: rounds } = await supabase.from('rounds')
      .select('id_round, scheduled_date, id_category, status').eq('scheduled_date', '2026-05-28');
    const rIds = (rounds||[]).map(r => r.id_round);
    if (!rIds.length) { console.log(`\n[${me.name}] sem rodadas hoje`); continue; }

    const { data: dbls } = await supabase.from('doubles')
      .select('id_double, id_round, display_name')
      .in('id_round', rIds)
      .or(`id_player1.eq.${me.id_player},id_player2.eq.${me.id_player}`);
    if (!dbls || !dbls.length) { console.log(`\n[${me.name}] não está em nenhuma dupla hoje`); continue; }

    for (const d of dbls) {
      const { data: mA } = await supabase.from('matches').select('*').eq('id_double_a', d.id_double);
      const { data: mB } = await supabase.from('matches').select('*').eq('id_double_b', d.id_double);
      const matches = [...(mA||[]), ...(mB||[])];
      for (const m of matches) {
        const otherId = m.id_double_a === d.id_double ? m.id_double_b : m.id_double_a;
        const { data: other } = await supabase.from('doubles').select('display_name').eq('id_double', otherId).single();
        let court = '';
        if (m.id_court) { const { data: c } = await supabase.from('courts').select('name').eq('id_court', m.id_court).maybeSingle(); court = c?.name || `quadra ${m.id_court}`; }
        console.log(`\n[${me.name}] match ${m.id_match}: ${d.display_name} VS ${other?.display_name}`);
        console.log(`   quando: ${m.scheduled_at}  | status: ${m.status} ${court ? '| '+court : ''}`);
      }
      if (!matches.length) console.log(`\n[${me.name}] dupla ${d.display_name} (round ${d.id_round}) — SEM match agendado`);
    }
  }
}
main().catch(e => { console.error(e); process.exit(1); });
