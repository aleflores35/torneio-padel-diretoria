// RE-SLOT final: reatribui (horario, quadra) dos jogos futuros TO_PLAY pra que nenhum
// jogador fique em 2 jogos no MESMO horario. NAO re-pareia (mantem duplas/adversarios).
// Regras: prioridade de categoria (femininas cedo), Nara(701)>=20:30. DRY; CONFIRM_EXECUTE=yes grava.
const supabase = require('../../supabase');
const CONFIRM = process.env.CONFIRM_EXECUTE === 'yes';
const TODAY = '2026-07-02';
const TIME_SLOTS = ['18:30','19:10','19:50','20:30','21:10','21:50'];
const CAT_PRIO = {3:10,4:11,5:12,2:20,1:30};
const MINTIME = {701:'20:30'};
const ck=(r,w)=>{if(r&&r.error){console.error('ERRO',w,r.error.message);process.exit(1);}};
(async()=>{
  const {data:courts}=await supabase.from('courts').select('id_court,name,order_index').eq('id_tournament',7).order('order_index');
  const {data:rounds}=await supabase.from('rounds').select('id_round,id_category,scheduled_date').eq('id_tournament',7);
  const rmap={}; rounds.forEach(r=>rmap[r.id_round]=r);
  const {data:dbls}=await supabase.from('doubles').select('id_double,id_round,id_player1,id_player2').eq('id_tournament',7);
  const dById={}; dbls.forEach(d=>dById[d.id_double]=d);
  const dids=dbls.map(d=>d.id_double);
  let ms=[];
  for(let i=0;i<dids.length;i+=100){const {data}=await supabase.from('matches').select('id_match,id_double_a,id_double_b,scheduled_at,id_court,status').in('id_double_a',dids.slice(i,i+100)); ms=ms.concat(data||[]);}
  // agrupa por data (futuro TO_PLAY)
  const byDate={};
  for(const m of ms){
    const d=dById[m.id_double_a]; if(!d) continue;
    const r=rmap[d.id_round]; if(!r||r.scheduled_date<TODAY||m.status!=='TO_PLAY') continue;
    (byDate[r.scheduled_date]=byDate[r.scheduled_date]||[]).push(m);
  }
  const minTimeOf=m=>{const d1=dById[m.id_double_a],d2=dById[m.id_double_b];const ps=[d1&&d1.id_player1,d1&&d1.id_player2,d2&&d2.id_player1,d2&&d2.id_player2].filter(Boolean);const t=ps.map(p=>MINTIME[p]).filter(Boolean);return t.length?t.sort().pop():'00:00';};
  const playersOf=m=>{const d1=dById[m.id_double_a],d2=dById[m.id_double_b];return [d1&&d1.id_player1,d1&&d1.id_player2,d2&&d2.id_player1,d2&&d2.id_player2].filter(Boolean);};
  const catOf=m=>rmap[dById[m.id_double_a].id_round].id_category;
  const hhmm=s=>(s||'').slice(11,16);
  let totalChanges=0, collisionsBefore=0; const updates=[];
  for(const date of Object.keys(byDate).sort()){
    const night=byDate[date];
    // detecta colisao antes
    const byT={}; for(const m of night){const t=hhmm(m.scheduled_at);for(const p of playersOf(m)){(byT[t]=byT[t]||{})[p]=(byT[t][p]||0)+1;}}
    const coll=Object.values(byT).some(o=>Object.values(o).some(c=>c>1));
    if(coll) collisionsBefore++;
    // re-slot: ordena por prioridade cat + horario atual
    const ordered=[...night].sort((a,b)=>(CAT_PRIO[catOf(a)]||50)-(CAT_PRIO[catOf(b)]||50) || hhmm(a.scheduled_at).localeCompare(hhmm(b.scheduled_at)));
    const taken={}; const ptime={}; // (time|court)->1 ; time->Set
    const plan={};
    for(const m of ordered){
      const mn=minTimeOf(m), ps=playersOf(m);
      const ot=hhmm(m.scheduled_at), oc=m.id_court;
      let placed=false;
      const order=[[ot,oc]]; for(const t of TIME_SLOTS)for(const c of courts)if(!(t===ot&&c.id_court===oc))order.push([t,c.id_court]);
      for(const [t,c] of order){
        if(t<mn) continue;
        if(taken[t+'|'+c]) continue;
        if(ps.some(p=>ptime[t]&&ptime[t].has(p))) continue;
        taken[t+'|'+c]=1; ptime[t]=ptime[t]||new Set(); ps.forEach(p=>ptime[t].add(p));
        plan[m.id_match]={t,c,chg:(t!==ot||c!==oc)}; placed=true; break;
      }
      if(!placed) plan[m.id_match]={t:'SEMSLOT',c:null,chg:true};
    }
    const changed=Object.entries(plan).filter(([,v])=>v.chg);
    if(changed.length){
      const cn={}; courts.forEach(c=>cn[c.id_court]=c.name);
      console.log(`  ${date}: ${changed.length} jogos re-slotados ${coll?'(tinha COLISAO)':''}`);
      for(const [mid,v] of changed){ updates.push({id_match:Number(mid), scheduled_at:date+'T'+v.t+':00', id_court:v.c, court_name:cn[v.c]}); }
      totalChanges+=changed.length;
    }
  }
  console.log(`\\nNoites com colisao (antes): ${collisionsBefore} | jogos a re-slotar: ${totalChanges}`);
  if(!CONFIRM){console.log('>>> DRY-RUN: nada gravado <<<');process.exit(0);}
  console.log('--- GRAVANDO ---');
  for(const u of updates){const r=await supabase.from('matches').update({scheduled_at:u.scheduled_at,id_court:u.id_court}).eq('id_match',u.id_match);ck(r,'reslot '+u.id_match);}
  console.log(`gravados ${updates.length} re-slots`);
  // verifica 0 colisao
  const {data:ms2}=await supabase.from('matches').select('id_match,id_double_a,scheduled_at,status').in('id_double_a',dids.slice(0,1)); // dummy
  console.log('>>> CONCLUIDO — rode a verificacao de colisoes a seguir <<<');
  process.exit(0);
})();
