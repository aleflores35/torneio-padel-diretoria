// READ-ONLY parametrizavel: PID=<id> node _detalha_atleta.js
// Detalha jogos (jogados+futuros), parceiros, round-robin e ausencias de 1 atleta.
const supabase = require('../../supabase');
const TID = 7;
const HOJE = '2026-07-08';
const PID = parseInt(process.env.PID||'0',10);

(async () => {
  if(!PID){console.error('use PID=<id>');process.exit(1);}
  const { data: players } = await supabase.from('players').select('*').eq('id_tournament', TID);
  const P={}; players.forEach(p=>P[p.id_player]=p);
  const nm=id=>(P[id]?P[id].name:id);
  const catName=c=>c===1?'Masc Inic':c===2?'Masc 4a':c===3?'Fem':'cat'+c;
  const p=P[PID]; if(!p){console.error('id inexistente');process.exit(1);}

  const { data: rounds } = await supabase.from('rounds').select('*').eq('id_tournament', TID);
  const R={}; rounds.forEach(r=>R[r.id_round]=r);
  const { data: dbls } = await supabase.from('doubles').select('id_double,id_round,id_player1,id_player2,display_name').eq('id_tournament', TID);
  const D={}; dbls.forEach(d=>D[d.id_double]=d);
  const dids=dbls.map(d=>d.id_double);
  async function mF(f){let o=[];for(let i=0;i<dids.length;i+=200){const{data}=await supabase.from('matches').select('*').in(f,dids.slice(i,i+200));o=o.concat(data||[]);}return o;}
  const byId={}; [...await mF('id_double_a'),...await mF('id_double_b')].forEach(m=>byId[m.id_match]=m);
  const all=Object.values(byId);
  const roundOf=m=>R[(D[m.id_double_a]||{}).id_round]||R[(D[m.id_double_b]||{}).id_round]||{};
  const dateOf=m=>roundOf(m).scheduled_date;
  const typeOf=m=>(roundOf(m).round_type||'REGULAR');
  const hhmm=m=>String(m.scheduled_at||'').slice(11,16);
  const playersOf=m=>{const a=D[m.id_double_a]||{},b=D[m.id_double_b]||{};return [a.id_player1,a.id_player2,b.id_player1,b.id_player2].filter(Boolean);};

  console.log(`>>> ${p.name} (id ${PID}, ${catName(p.category_id)}, side ${p.side}, active ${p.active}) wpp ${p.whatsapp||'-'}`);
  const js=all.filter(m=>playersOf(m).includes(PID)&&typeOf(m)!=='EXHIBITION').sort((a,b)=>String(a.scheduled_at||dateOf(a)).localeCompare(String(b.scheduled_at||dateOf(b))));
  const jogados=js.filter(m=>['FINISHED','WO'].includes(m.status));
  const fut=js.filter(m=>['TO_PLAY','CALLING','IN_PROGRESS'].includes(m.status));
  console.log(`jogados ${jogados.length} | futuros ${fut.length} | TOTAL ${js.length}\n`);
  const parc=new Set();
  for(const m of js){
    const a=D[m.id_double_a]||{},b=D[m.id_double_b]||{};const dd=(a.id_player1===PID||a.id_player2===PID)?a:b;
    const pid2=dd.id_player1===PID?dd.id_player2:dd.id_player1; parc.add(pid2);
    console.log(`  #${m.id_match} | ${dateOf(m)} ${hhmm(m)} q${m.id_court} | ${m.status} | c/ ${nm(pid2)} | ${a.display_name} X ${b.display_name}${dateOf(m)>HOJE?' [FUTURO]':''}`);
  }
  const oppSide=p.side==='RIGHT'?'LEFT':'RIGHT';
  const possiveis=players.filter(x=>x.category_id===p.category_id&&x.side===oppSide&&x.active);
  const faltam=possiveis.filter(x=>!parc.has(x.id_player));
  console.log(`\nround-robin: jogou/vai jogar c/ ${parc.size} parceiros de ${possiveis.length} ${oppSide} ativos.`);
  console.log(`faltam parceiros:`, faltam.map(x=>`${x.name}(${x.id_player})`).join(', ')||'(nenhum — completo)');
  const { data: abs } = await supabase.from('player_absences').select('*').eq('id_tournament', TID).eq('id_player', PID);
  console.log(`ausencias:`, (abs||[]).map(a=>a.absence_date).join(', ')||'(nenhuma)');
  process.exit(0);
})();
