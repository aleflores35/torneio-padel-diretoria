// READ-ONLY · 22/06/2026 · Diagnóstico p/ pedido do Alessandro:
//   - tirar Francine do sorteio "dessa semana"
//   - Alisson fora "essa e a outra semana"
// Descobre: ids/categoria/side dos dois, quintas-alvo, estado dos rounds dessas
// datas (já sorteado?) e ausências já gravadas. NÃO grava nada.
// Uso: node scripts/investigacao/diag_ausencias_francine_alisson_2026-06-22.js
const supabase = require('../../supabase');

const ID_TOURNAMENT = 7;
const DATAS = ['2026-06-25', '2026-07-02']; // próxima quinta e a seguinte

async function run() {
  console.log(`== DIAGNÓSTICO (read-only) · tournament ${ID_TOURNAMENT} ==\n`);

  // 1. Achar Francine e Alisson (fuzzy por nome)
  const { data: players } = await supabase
    .from('players')
    .select('id_player, name, category_id, side, active')
    .eq('id_tournament', ID_TOURNAMENT);

  const alvo = (players || []).filter(p =>
    /francine/i.test(p.name) || /alisson/i.test(p.name) || /alison/i.test(p.name)
  );
  console.log('-- Jogadores correspondentes (Francine / Alisson) --');
  for (const p of alvo) {
    console.log(`  id=${p.id_player} · ${p.name} · cat=${p.category_id} · side=${p.side} · active=${p.active}`);
  }
  const alisson = alvo.find(p => /aliss?on/i.test(p.name));
  const francine = alvo.find(p => /francine/i.test(p.name));

  // 2. Categorias (nome)
  const { data: cats } = await supabase
    .from('categories').select('id_category, name').eq('id_tournament', ID_TOURNAMENT);
  const catName = {};
  (cats || []).forEach(c => { catName[c.id_category] = c.name; });
  console.log('\n-- Categorias --');
  (cats || []).forEach(c => console.log(`  ${c.id_category} = ${c.name}`));

  // 3. Rounds nas datas-alvo
  console.log('\n-- Rounds nas datas-alvo --');
  for (const d of DATAS) {
    const { data: rounds } = await supabase
      .from('rounds')
      .select('id_round, id_category, round_number, status, round_type, scheduled_date')
      .eq('id_tournament', ID_TOURNAMENT)
      .eq('scheduled_date', d);
    if (!rounds || rounds.length === 0) {
      console.log(`  ${d}: NENHUM round criado ainda (sorteio não feito).`);
      continue;
    }
    for (const r of rounds) {
      console.log(`  ${d}: round ${r.id_round} · cat=${r.id_category}(${catName[r.id_category] || '?'}) · #${r.round_number} · ${r.status} · ${r.round_type}`);
      // attendance dos alvos nesse round
      const ids = [alisson, francine].filter(Boolean).map(p => p.id_player);
      if (ids.length) {
        const { data: att } = await supabase
          .from('round_attendance').select('id_player, status').eq('id_round', r.id_round).in('id_player', ids);
        (att || []).forEach(a => {
          const nm = (alvo.find(p => p.id_player === a.id_player) || {}).name;
          console.log(`        attendance: ${nm} → ${a.status}`);
        });
      }
    }
  }

  // 4. Ausências já gravadas nessas datas
  console.log('\n-- player_absences nas datas-alvo --');
  for (const d of DATAS) {
    const { data: abs } = await supabase
      .from('player_absences')
      .select('id_player, absence_date, players(name)')
      .eq('id_tournament', ID_TOURNAMENT)
      .eq('absence_date', d);
    if (!abs || abs.length === 0) { console.log(`  ${d}: (nenhuma)`); continue; }
    abs.forEach(a => console.log(`  ${d}: id=${a.id_player} ${a.players?.name || ''}`));
  }

  // 5. Ausências do mês p/ cota (Francine junho, Alisson junho+julho)
  console.log('\n-- Ausências já existentes (cota mensal) p/ os alvos --');
  for (const p of [francine, alisson].filter(Boolean)) {
    const { data: all } = await supabase
      .from('player_absences')
      .select('absence_date')
      .eq('id_tournament', ID_TOURNAMENT)
      .eq('id_player', p.id_player)
      .order('absence_date');
    console.log(`  ${p.name} (id=${p.id_player}): [${(all || []).map(a => a.absence_date).join(', ')}]`);
  }

  console.log('\n== fim diagnóstico ==');
}
run().catch(e => { console.error(e); process.exit(1); });
