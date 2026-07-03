// Conta jogos por CATEGORIA x status (aconteceram vs faltam).
// match -> dupla A -> id_round -> round.id_category
const supabase = require('../../supabase');

const ID_T = 7;

async function run() {
  const { data: cats } = await supabase.from('categories').select('id_category, name').eq('id_tournament', ID_T).order('id_category');
  const catName = {}; (cats || []).forEach(c => catName[c.id_category] = c.name);

  const { data: matches, error: mErr } = await supabase.from('matches')
    .select('id_match, status, id_double_a').eq('id_tournament', ID_T);
  if (mErr) { console.error('matches err:', mErr.message); process.exit(1); }
  console.log(`(debug) matches lidos: ${(matches || []).length}\n`);
  const doubleIds = [...new Set((matches || []).map(m => m.id_double_a).filter(Boolean))];

  // duplas -> round
  const { data: dbls } = await supabase.from('doubles').select('id_double, id_round').in('id_double', doubleIds);
  const dRound = {}; (dbls || []).forEach(d => dRound[d.id_double] = d.id_round);
  const roundIds = [...new Set(Object.values(dRound))];
  const { data: rounds } = await supabase.from('rounds').select('id_round, id_category, round_type').in('id_round', roundIds);
  const rCat = {}, rType = {}; (rounds || []).forEach(r => { rCat[r.id_round] = r.id_category; rType[r.id_round] = r.round_type; });

  // agrega: cat -> {oficial: {status:count}, exhibition: {status:count}}
  const agg = {};
  for (const m of (matches || [])) {
    const rid = dRound[m.id_double_a];
    const cat = rCat[rid] ?? '??';
    const isExh = rType[rid] === 'EXHIBITION';
    agg[cat] = agg[cat] || { oficial: {}, amistoso: {}, total: 0 };
    const bucket = isExh ? agg[cat].amistoso : agg[cat].oficial;
    bucket[m.status] = (bucket[m.status] || 0) + 1;
    agg[cat].total++;
  }

  const fmt = (o) => {
    const fin = o['FINISHED'] || 0;
    const wo = o['WO'] || 0;
    const prog = o['IN_PROGRESS'] || 0;
    const toPlay = o['TO_PLAY'] || 0;
    const canc = o['CANCELLED'] || 0;
    const jogados = fin + wo;
    const faltam = toPlay + prog;
    return { fin, wo, prog, toPlay, canc, jogados, faltam, totalProg: jogados + faltam };
  };

  let gJog = 0, gFalt = 0;
  console.log('JOGOS OFICIAIS por categoria (exclui amistosos):\n');
  console.log('Categoria          | Jogados | A jogar | Em and. | (W.O.) | Total prog. | % concluído');
  console.log('-'.repeat(92));
  for (const cat of Object.keys(agg).sort()) {
    const o = fmt(agg[cat].oficial);
    gJog += o.jogados; gFalt += o.faltam;
    const pct = o.totalProg ? Math.round(100 * o.jogados / o.totalProg) : 0;
    console.log(
      `${(catName[cat] || ('Cat ' + cat)).padEnd(18)} | ${String(o.jogados).padStart(7)} | ${String(o.toPlay).padStart(7)} | ${String(o.prog).padStart(7)} | ${String(o.wo).padStart(6)} | ${String(o.totalProg).padStart(11)} | ${pct}%`
    );
  }
  console.log('-'.repeat(92));
  console.log(`${'TOTAL'.padEnd(18)} | ${String(gJog).padStart(7)} | ${String(gFalt).padStart(7)} |`);

  // amistosos, se houver
  const exhLines = Object.keys(agg).filter(cat => Object.keys(agg[cat].amistoso).length);
  if (exhLines.length) {
    console.log('\nAmistosos (EXHIBITION, não contam no ranking):');
    for (const cat of exhLines.sort()) {
      const a = fmt(agg[cat].amistoso);
      console.log(`  ${(catName[cat] || ('Cat ' + cat))}: jogados ${a.jogados}, a jogar ${a.toPlay}, em and. ${a.prog}`);
    }
  }
}
run().catch(e => { console.error(e.message || e); process.exit(1); });
