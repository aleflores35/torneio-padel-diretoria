// READ-ONLY: mapa completo p/ expurgo de Marcio Ferreira (657) e Alisson Boyink (670).
// Lista jogados (→ exhibition) e futuros (→ remover) com match/double/round ids.
// Inspeciona schema de rounds + rounds EXHIBITION existentes + counters a reverter.
const supabase = require('../../supabase');
const T = 7;
const QUITTERS = { 657: 'Marcio Ferreira', 670: 'Alisson Boyink' };

(async () => {
  const { data: players } = await supabase.from('players').select('id_player,name,side,category_id,active').eq('id_tournament', T);
  const nm = {}; players.forEach(p => nm[p.id_player]=p.name);
  for (const q of Object.keys(QUITTERS)) {
    const p = players.find(x=>x.id_player==q);
    console.log(`${QUITTERS[q]} (${q}): side ${p?.side} · cat ${p?.category_id} · active ${p?.active}`);
  }

  const { data: rounds } = await supabase.from('rounds').select('*').eq('id_tournament', T);
  const rd = {}; rounds.forEach(r => rd[r.id_round]=r);
  console.log(`\n[schema rounds] colunas: ${Object.keys(rounds[0]).join(', ')}`);
  console.log(`[rounds EXHIBITION existentes]: ${rounds.filter(r=>r.round_type==='EXHIBITION').map(r=>`${r.id_round}(${r.scheduled_date},cat${r.id_category})`).join(', ')||'(nenhuma)'}`);
  // exemplo de round pra ver defaults
  const ex = rounds.find(r=>r.id_category===1);
  console.log(`[exemplo round cat1] ${JSON.stringify(ex)}`);

  const { data: dbls } = await supabase.from('doubles').select('*').eq('id_tournament', T);
  const dm = {}; dbls.forEach(d => dm[d.id_double]=d);
  const dids = dbls.map(d=>d.id_double);
  async function fetchM(f){ let o=[]; for(let i=0;i<dids.length;i+=200){ const {data}=await supabase.from('matches').select('*').in(f,dids.slice(i,i+200)); o=o.concat(data||[]);} return o; }
  const byId={}; [...await fetchM('id_double_a'),...await fetchM('id_double_b')].forEach(m=>byId[m.id_match]=m);
  const all=Object.values(byId);
  const roundOf=m=>rd[(dm[m.id_double_a]||{}).id_round]||rd[(dm[m.id_double_b]||{}).id_round]||{};
  const four=m=>{const a=dm[m.id_double_a],b=dm[m.id_double_b];return [a.id_player1,a.id_player2,b.id_player1,b.id_player2].filter(Boolean);};
  const hhmm=m=>String(m.scheduled_at||'').slice(11,16);

  for (const q of Object.keys(QUITTERS).map(Number)) {
    const games = all.filter(m=>four(m).includes(q))
      .sort((a,b)=>String(roundOf(a).scheduled_date+hhmm(a)).localeCompare(roundOf(b).scheduled_date+hhmm(b)));
    const played = games.filter(m=>m.status==='FINISHED'||m.status==='WO');
    const future = games.filter(m=>m.status==='TO_PLAY'||m.status==='CALLING');
    console.log(`\n===== ${QUITTERS[q]} (${q}) — ${games.length} jogos (${played.length} jogados, ${future.length} futuros) =====`);
    console.log(`-- JOGADOS (→ exhibition) --`);
    played.forEach(m=>{ const r=roundOf(m); console.log(`  #${m.id_match} r${r.id_round} ${r.scheduled_date} ${hhmm(m)} ${m.status} | dA${m.id_double_a} ${dm[m.id_double_a].display_name} × dB${m.id_double_b} ${dm[m.id_double_b].display_name}`); });
    console.log(`-- FUTUROS (→ remover) --`);
    future.forEach(m=>{ const r=roundOf(m); console.log(`  #${m.id_match} r${r.id_round} ${r.scheduled_date} ${hhmm(m)} ${m.status} | dA${m.id_double_a} ${dm[m.id_double_a].display_name} × dB${m.id_double_b} ${dm[m.id_double_b].display_name}`); });
    // counters stamped nos rounds futuros deste quitter
    const futRounds = [...new Set(future.map(m=>roundOf(m).id_round))];
    console.log(`  rounds dos futuros: ${futRounds.join(', ')||'(nenhum)'}`);
  }
  process.exit(0);
})();
