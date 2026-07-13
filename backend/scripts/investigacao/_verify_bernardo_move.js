// READ-ONLY: verifica pós-move do Bernardo. (1) nova agenda dele; (2) colisões nas noites 16/07 e 23/07.
const supabase = require('../../supabase');
const T = 7, BID = 654;
const NIGHTS = ['2026-07-16','2026-07-23'];

(async () => {
  const { data: players } = await supabase.from('players').select('id_player,name').eq('id_tournament', T);
  const nm = {}; players.forEach(p=>nm[p.id_player]=p.name);
  const { data: rounds } = await supabase.from('rounds').select('id_round,scheduled_date,id_category').eq('id_tournament', T);
  const rd = {}; rounds.forEach(r=>rd[r.id_round]=r);
  const { data: dbls } = await supabase.from('doubles').select('*').eq('id_tournament', T);
  const dm = {}; dbls.forEach(d=>dm[d.id_double]=d);
  const dids = dbls.map(d=>d.id_double);
  async function fetchM(f){ let o=[]; for(let i=0;i<dids.length;i+=200){ const {data}=await supabase.from('matches').select('*').in(f,dids.slice(i,i+200)); o=o.concat(data||[]);} return o; }
  const byId={}; [...await fetchM('id_double_a'),...await fetchM('id_double_b')].forEach(m=>byId[m.id_match]=m);
  const all=Object.values(byId);
  const roundOf=m=>rd[(dm[m.id_double_a]||{}).id_round]||rd[(dm[m.id_double_b]||{}).id_round]||{};
  const dateOf=m=>roundOf(m).scheduled_date; const hhmm=m=>String(m.scheduled_at||'').slice(11,16);
  const four=m=>{const a=dm[m.id_double_a],b=dm[m.id_double_b];return [a.id_player1,a.id_player2,b.id_player1,b.id_player2].filter(Boolean);};

  const bFut = all.filter(m=>(m.status==='TO_PLAY'||m.status==='CALLING')&&four(m).includes(BID))
    .sort((a,b)=>String(dateOf(a)+hhmm(a)).localeCompare(dateOf(b)+hhmm(b)));
  console.log(`=== Agenda futura do Bernardo agora (${bFut.length}) ===`);
  bFut.forEach(m=>console.log(`  #${m.id_match} ${dateOf(m)} ${hhmm(m)} q${m.id_court} | ${dm[m.id_double_a].display_name} × ${dm[m.id_double_b].display_name} [${m.status}]`));

  let problemas=0;
  for (const d of NIGHTS) {
    const noite = all.filter(m=>dateOf(m)===d && (m.status==='TO_PLAY'||m.status==='CALLING'||m.status==='FINISHED'||m.status==='WO'))
      .sort((a,b)=>hhmm(a).localeCompare(hhmm(b)));
    console.log(`\n=== ${d} (${noite.length} jogos) ===`);
    const slotPlayers={}, slotCourts={};
    for (const m of noite) {
      const s=hhmm(m);
      console.log(`  ${s} q${m.id_court} cat${roundOf(m).id_category} | ${dm[m.id_double_a].display_name} × ${dm[m.id_double_b].display_name}`);
      const pl=slotPlayers[s]=slotPlayers[s]||{}; four(m).forEach(p=>{ if(pl[p]) { console.log(`   ⛔ COLISAO horario: ${nm[p]} em 2 jogos ${s}`); problemas++; } pl[p]=true; });
      const co=slotCourts[s]=slotCourts[s]||{}; if(co[m.id_court]){ console.log(`   ⛔ COLISAO quadra: q${m.id_court} 2x em ${s}`); problemas++; } co[m.id_court]=true;
    }
  }
  console.log(problemas===0 ? '\n✅ 0 colisões nas noites verificadas.' : `\n⚠️ ${problemas} problema(s).`);
  process.exit(0);
})();
