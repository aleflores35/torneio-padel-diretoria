// READ-ONLY: estado dos placares atrasados #1288, #1307, #1380.
const supabase = require('../../supabase');
const T = 7;
const ALVO = [1288, 1307, 1380];
const catName = c => c===1?'Masc Inic':c===2?'Masc 4a':c===3?'Fem':'cat'+c;

(async () => {
  const { data: players } = await supabase.from('players').select('id_player,name').eq('id_tournament', T);
  const pn = {}; players.forEach(p => pn[p.id_player]=p.name);
  const { data: rounds } = await supabase.from('rounds').select('*').eq('id_tournament', T);
  const R = {}; rounds.forEach(r => R[r.id_round]=r);
  const { data: dbls } = await supabase.from('doubles').select('*').eq('id_tournament', T);
  const D = {}; dbls.forEach(d => D[d.id_double]=d);
  const { data: ms } = await supabase.from('matches').select('*').in('id_match', ALVO);
  const { data: abs } = await supabase.from('player_absences').select('*').eq('id_tournament', T);

  for (const m of ms) {
    const a = D[m.id_double_a], b = D[m.id_double_b];
    const r = R[a.id_round];
    const pls = [a.id_player1,a.id_player2,b.id_player1,b.id_player2];
    const absDay = abs.filter(x => x.absence_date===r.scheduled_date && pls.includes(x.id_player)).map(x=>pn[x.id_player]);
    console.log(`#${m.id_match} | ${r.scheduled_date} ${String(m.scheduled_at||'').slice(11,16)} | ${catName(r.id_category)} | status ${m.status} | placar ${m.score_a ?? '-'}×${m.score_b ?? '-'}`);
    console.log(`   A (dbl ${m.id_double_a}): ${pn[a.id_player1]} / ${pn[a.id_player2]}`);
    console.log(`   B (dbl ${m.id_double_b}): ${pn[b.id_player1]} / ${pn[b.id_player2]}`);
    console.log(`   ausências nesse dia entre os 4: ${absDay.join(', ')||'(nenhuma)'}\n`);
  }
  process.exit(0);
})();
