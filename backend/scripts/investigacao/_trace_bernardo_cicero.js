// READ-ONLY: rastreia a dupla Bernardo(654)+Cicero(661) no backup pré-hoje vs LIVE.
const supabase = require('../../supabase');
const fs = require('fs');
const BK = 'C:/obralivre/clientes/parcerias/sociedade-rio-branco/ranking-srb-2026/backups/PRE_pivot_2026-07-08-00-59-22';
const B=654, C=661;

const isBC = d => (d.id_player1===B&&d.id_player2===C)||(d.id_player1===C&&d.id_player2===B);

(async () => {
  // ---- BACKUP ----
  const bd = JSON.parse(fs.readFileSync(BK+'/doubles.json','utf-8'));
  const bm = JSON.parse(fs.readFileSync(BK+'/matches.json','utf-8'));
  const brd = JSON.parse(fs.readFileSync(BK+'/rounds.json','utf-8'));
  const brdById={}; brd.forEach(r=>brdById[r.id_round]=r);
  const bcDbls = bd.filter(isBC);
  console.log(`[BACKUP 00:59] duplas Bernardo+Cicero: ${bcDbls.length}`);
  for (const d of bcDbls) {
    const r = brdById[d.id_round]||{};
    const mm = bm.filter(m=>m.id_double_a===d.id_double||m.id_double_b===d.id_double);
    console.log(`  double ${d.id_double} "${d.display_name}" round ${d.id_round} (${r.scheduled_date}, type ${r.round_type})`);
    for (const m of mm) {
      const opp = m.id_double_a===d.id_double ? m.id_double_b : m.id_double_a;
      const od = bd.find(x=>x.id_double===opp);
      console.log(`     match #${m.id_match} status ${m.status} sched ${m.scheduled_at} court ${m.id_court} × ${od?od.display_name:opp}`);
    }
  }

  // ---- LIVE ----
  const { data: ld } = await supabase.from('doubles').select('*').eq('id_tournament',7);
  const liveBC = ld.filter(isBC);
  console.log(`\n[LIVE] duplas Bernardo+Cicero: ${liveBC.length}`);
  for (const d of liveBC) {
    const { data: rr } = await supabase.from('rounds').select('*').eq('id_round',d.id_round).single();
    console.log(`  double ${d.id_double} round ${d.id_round} (${rr?.scheduled_date}, type ${rr?.round_type})`);
  }

  // se sumiu, o(s) id(s) de double do backup ainda existem live?
  for (const d of bcDbls) {
    const { data: still } = await supabase.from('doubles').select('id_double,id_round,id_player1,id_player2').eq('id_double', d.id_double);
    const ex = still&&still.length;
    console.log(`\n  double ${d.id_double}: ${ex?`AINDA EXISTE live (round ${still[0].id_round}, players ${still[0].id_player1}/${still[0].id_player2})`:'FOI DELETADO live'}`);
    // e o match dele?
    const mm = bm.filter(m=>m.id_double_a===d.id_double||m.id_double_b===d.id_double);
    for (const m of mm) {
      const { data: lm } = await supabase.from('matches').select('id_match,status,scheduled_at').eq('id_match', m.id_match);
      console.log(`    match #${m.id_match}: ${lm&&lm.length?`existe (status ${lm[0].status})`:'DELETADO'}`);
    }
  }
  process.exit(0);
})();
