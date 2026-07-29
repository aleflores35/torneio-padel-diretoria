// READ-ONLY: lista TODOS os jogos vencidos (data <= hoje) que NAO estao FINISHED/WO.
// Uso:  node _vencidos_sem_placar.js
// Extra: IDS=1391,1416 node _vencidos_sem_placar.js  -> dump cru desses matches (p/ conferir shape de WO)
const supabase = require('../../supabase');
const T = 7;
const HOJE = new Date().toISOString().slice(0, 10);
const IDS = (process.env.IDS || '').split(',').map(s => parseInt(s, 10)).filter(Boolean);
const catName = c => c === 1 ? 'Masc Inic' : c === 2 ? 'Masc 4a' : c === 3 ? 'Fem' : 'cat' + c;

(async () => {
  const { data: players } = await supabase.from('players').select('id_player,name,category_id,side,active').eq('id_tournament', T);
  const pn = {}; players.forEach(p => pn[p.id_player] = p.name);
  const { data: rounds } = await supabase.from('rounds').select('*').eq('id_tournament', T);
  const R = {}; rounds.forEach(r => R[r.id_round] = r);
  const { data: dbls } = await supabase.from('doubles').select('*').eq('id_tournament', T);
  const D = {}; dbls.forEach(d => D[d.id_double] = d);
  const { data: allMs } = await supabase.from('matches').select('*').eq('id_tournament', T);

  const roundOf = m => R[(D[m.id_double_a] || {}).id_round] || R[(D[m.id_double_b] || {}).id_round] || {};
  const hhmm = m => String(m.scheduled_at || '').slice(11, 16);

  if (IDS.length) {
    console.log('=== DUMP CRU ===');
    for (const m of allMs.filter(x => IDS.includes(x.id_match))) {
      console.log(JSON.stringify(m));
      const a = D[m.id_double_a] || {}, b = D[m.id_double_b] || {};
      console.log(`   A dbl${m.id_double_a} = ${pn[a.id_player1]}(${a.id_player1}) / ${pn[a.id_player2]}(${a.id_player2}) | round ${a.id_round}`);
      console.log(`   B dbl${m.id_double_b} = ${pn[b.id_player1]}(${b.id_player1}) / ${pn[b.id_player2]}(${b.id_player2}) | round ${b.id_round}\n`);
    }
  }

  const venc = allMs
    .filter(m => !['FINISHED', 'WO'].includes(m.status))
    .filter(m => { const d = roundOf(m).scheduled_date; return d && d <= HOJE; })
    .filter(m => (roundOf(m).round_type || 'REGULAR') !== 'EXHIBITION')
    .sort((a, b) => String(roundOf(a).scheduled_date + hhmm(a)).localeCompare(String(roundOf(b).scheduled_date + hhmm(b))));

  console.log(`=== VENCIDOS SEM PLACAR (hoje ${HOJE}) — ${venc.length} jogos ===\n`);
  let lastDate = null;
  for (const m of venc) {
    const r = roundOf(m); const a = D[m.id_double_a] || {}, b = D[m.id_double_b] || {};
    if (r.scheduled_date !== lastDate) { console.log(`-- ${r.scheduled_date} (${catName(r.id_category)} e/ou outras)`); lastDate = r.scheduled_date; }
    const ausentes = (Array.isArray(m.absent_player_ids) ? m.absent_player_ids : []).map(id => pn[id]).join(', ');
    console.log(`   #${m.id_match} | ${hhmm(m)} q${m.id_court} | ${catName(r.id_category)} | ${m.status} | ${a.display_name} X ${b.display_name}${ausentes ? ' | AUSENTES: ' + ausentes : ''}`);
  }

  const byCat = {};
  venc.forEach(m => { const c = catName(roundOf(m).id_category); byCat[c] = (byCat[c] || 0) + 1; });
  console.log(`\nresumo por categoria:`, JSON.stringify(byCat));
  process.exit(0);
})();
