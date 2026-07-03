// READ-ONLY: quantas rodadas existem na Masc. Iniciante (cat 1) e quantas estão concluídas.
const supabase = require('../../supabase');
const ID_T = 7;
const CAT = 1;

async function run() {
  const { data: rounds, error } = await supabase
    .from('rounds')
    .select('*')
    .eq('id_tournament', ID_T)
    .eq('id_category', CAT);
  if (error) { console.error('rounds err:', error.message); process.exit(1); }

  rounds.sort((a, b) => (a.round_number || 0) - (b.round_number || 0));
  console.log(`Rodadas da categoria ${CAT}: ${rounds.length}\n`);

  // matches por rodada (via doubles)
  const { data: dbls } = await supabase.from('doubles')
    .select('id_double, id_round').eq('id_tournament', ID_T);
  const dRound = {}; (dbls || []).forEach(d => dRound[d.id_double] = d.id_round);

  const { data: matches } = await supabase.from('matches')
    .select('id_match, status, id_double_a').eq('id_tournament', ID_T);

  const perRound = {};
  for (const m of (matches || [])) {
    const rid = dRound[m.id_double_a];
    if (!rid) continue;
    perRound[rid] = perRound[rid] || { FINISHED: 0, WO: 0, IN_PROGRESS: 0, TO_PLAY: 0, CANCELLED: 0, total: 0 };
    perRound[rid][m.status] = (perRound[rid][m.status] || 0) + 1;
    perRound[rid].total++;
  }

  console.log('R# | id_round | tipo        | status     | data        | jogos (fin/wo/prog/toplay)');
  console.log('-'.repeat(92));
  for (const r of rounds) {
    const p = perRound[r.id_round] || {};
    const j = `${p.FINISHED || 0}/${p.WO || 0}/${p.IN_PROGRESS || 0}/${p.TO_PLAY || 0}`;
    console.log(
      `${String(r.round_number ?? '?').padStart(2)} | ${String(r.id_round).padStart(8)} | ${String(r.round_type || '-').padEnd(11)} | ${String(r.status || '-').padEnd(10)} | ${String(r.scheduled_date || '-').padEnd(11)} | ${j}  (tot ${p.total || 0})`
    );
  }

  // resumo
  const oficiais = rounds.filter(r => r.round_type !== 'EXHIBITION');
  const totMatches = Object.entries(perRound)
    .filter(([rid]) => oficiais.some(r => String(r.id_round) === String(rid)))
    .reduce((acc, [, p]) => {
      acc.jogados += (p.FINISHED || 0) + (p.WO || 0);
      acc.faltam += (p.TO_PLAY || 0) + (p.IN_PROGRESS || 0);
      return acc;
    }, { jogados: 0, faltam: 0 });

  console.log('-'.repeat(92));
  console.log(`Rodadas oficiais (não-exibição): ${oficiais.length}`);
  console.log(`Jogos oficiais: ${totMatches.jogados} jogados + ${totMatches.faltam} a jogar = ${totMatches.jogados + totMatches.faltam}`);
  console.log(`\nReferência: round-robin Berger p/ 14 jogadores/lado = 13 rodadas completas.`);
}
run().catch(e => { console.error(e.message || e); process.exit(1); });
