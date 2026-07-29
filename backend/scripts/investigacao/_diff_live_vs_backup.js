// READ-ONLY: diff banco LIVE vs snapshot de backup (matches + doubles + rounds)
// uso: BK=PRE_pivot_2026-07-13-13-47-07 node _diff_live_vs_backup.js
const fs = require('fs'), path = require('path');
const supabase = require('../../supabase');
const TID = 7;
const BK = process.env.BK || 'PRE_pivot_2026-07-13-13-47-07';
const DIR = path.join(__dirname, '../../../backups', BK);
const J = f => JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));

(async () => {
  const bM = J('matches.json'), bD = J('doubles.json'), bR = J('rounds.json');
  const { data: players } = await supabase.from('players').select('*').eq('id_tournament', TID);
  const P = {}; players.forEach(p => P[p.id_player] = p);
  const { data: lD } = await supabase.from('doubles').select('*').eq('id_tournament', TID);
  const { data: lR } = await supabase.from('rounds').select('*').eq('id_tournament', TID);
  const dids = lD.map(d => d.id_double);
  async function mF(f) { let o = []; for (let i = 0; i < dids.length; i += 200) { const { data } = await supabase.from('matches').select('*').in(f, dids.slice(i, i + 200)); o = o.concat(data || []); } return o; }
  const lMo = {}; [...await mF('id_double_a'), ...await mF('id_double_b')].forEach(m => lMo[m.id_match] = m);
  const lM = Object.values(lMo);

  const idx = a => { const o = {}; a.forEach(x => o[x.id_match ?? x.id_double ?? x.id_round] = x); return o; };
  const BM = idx(bM), LM = idx(lM), BD = idx(bD), LD = idx(lD), BR = idx(bR), LR = idx(lR);
  const nm = (d, DD) => d ? `${(P[d.id_player1]||{}).name||d.id_player1} + ${(P[d.id_player2]||{}).name||d.id_player2}` : '?';
  const dateOf = (m, DD, RR) => { const d = DD[m.id_double_a] || DD[m.id_double_b] || {}; return ((RR[d.id_round]||{}).scheduled_date) || '?'; };
  const sig = m => `${String(m.scheduled_at).slice(0,16)}|q${m.id_court}|${m.status}|A${m.id_double_a}|B${m.id_double_b}`;

  console.log(`backup ${BK}: ${bM.length} matches / ${bD.length} doubles / ${bR.length} rounds`);
  console.log(`LIVE          : ${lM.length} matches / ${lD.length} doubles / ${lR.length} rounds\n`);

  const novos = lM.filter(m => !BM[m.id_match]);
  console.log(`=== MATCHES NOVOS (${novos.length}) — criados depois do backup ===`);
  novos.sort((a,b)=>a.id_match-b.id_match).forEach(m => console.log(`  #${m.id_match} ${dateOf(m,LD,LR)} ${String(m.scheduled_at).slice(11,16)} q${m.id_court} ${m.status} | ${nm(LD[m.id_double_a])} X ${nm(LD[m.id_double_b])}`));

  const sumidos = bM.filter(m => !LM[m.id_match]);
  console.log(`\n=== MATCHES SUMIDOS (${sumidos.length}) — existiam no backup, nao existem mais ===`);
  sumidos.sort((a,b)=>a.id_match-b.id_match).forEach(m => console.log(`  #${m.id_match} ${dateOf(m,BD,BR)} ${String(m.scheduled_at).slice(11,16)} q${m.id_court} ${m.status} | ${nm(BD[m.id_double_a])} X ${nm(BD[m.id_double_b])}`));

  const mudados = lM.filter(m => BM[m.id_match] && sig(m) !== sig(BM[m.id_match]));
  console.log(`\n=== MATCHES ALTERADOS (${mudados.length}) ===`);
  mudados.sort((a,b)=>a.id_match-b.id_match).forEach(m => {
    const b = BM[m.id_match];
    console.log(`  #${m.id_match} ${dateOf(m,LD,LR)}`);
    if (String(b.scheduled_at).slice(0,16) !== String(m.scheduled_at).slice(0,16)) console.log(`      horario: ${String(b.scheduled_at).slice(0,16)} -> ${String(m.scheduled_at).slice(0,16)}`);
    if (b.id_court !== m.id_court) console.log(`      quadra : q${b.id_court} -> q${m.id_court}`);
    if (b.status !== m.status) console.log(`      status : ${b.status} -> ${m.status}`);
    if (b.id_double_a !== m.id_double_a || b.id_double_b !== m.id_double_b) {
      console.log(`      DUPLAS : [${nm(BD[b.id_double_a])} X ${nm(BD[b.id_double_b])}] -> [${nm(LD[m.id_double_a])} X ${nm(LD[m.id_double_b])}]`);
    }
  });

  const dNovos = lD.filter(d => !BD[d.id_double]);
  const dSumidos = bD.filter(d => !LD[d.id_double]);
  console.log(`\n=== DOUBLES: novos ${dNovos.length} | sumidos ${dSumidos.length} ===`);
  dNovos.forEach(d => console.log(`  + dbl ${d.id_double} round ${d.id_round} | ${nm(d)}`));
  dSumidos.forEach(d => console.log(`  - dbl ${d.id_double} round ${d.id_round} | ${nm(d)}`));
  const dMud = lD.filter(d => BD[d.id_double] && (BD[d.id_double].id_round !== d.id_round || BD[d.id_double].id_player1 !== d.id_player1 || BD[d.id_double].id_player2 !== d.id_player2));
  console.log(`\n=== DOUBLES ALTERADOS (${dMud.length}) ===`);
  dMud.forEach(d => { const b = BD[d.id_double]; console.log(`  dbl ${d.id_double}: round ${b.id_round}->${d.id_round} | ${nm(b)} -> ${nm(d)}`); });

  const rNovos = lR.filter(r => !BR[r.id_round]), rSum = bR.filter(r => !LR[r.id_round]);
  console.log(`\n=== ROUNDS: novos ${rNovos.length} | sumidos ${rSum.length} ===`);
  rNovos.forEach(r => console.log(`  + round ${r.id_round} ${r.scheduled_date} ${r.status} ${r.round_type||'REGULAR'}`));
  rSum.forEach(r => console.log(`  - round ${r.id_round} ${r.scheduled_date} ${r.status} ${r.round_type||'REGULAR'}`));
  const rMud = lR.filter(r => BR[r.id_round] && BR[r.id_round].status !== r.status);
  rMud.forEach(r => console.log(`  ~ round ${r.id_round} ${r.scheduled_date}: ${BR[r.id_round].status} -> ${r.status}`));
  process.exit(0);
})();
