// Regenera round_attendance das 18 rodadas futuras restauradas (estava ausente no backup).
// Escalado (em doubles) -> NO_RESPONSE ; demais ativos da categoria -> ROTATED. CONFIRM_EXECUTE=yes grava.
const supabase = require('../../supabase');
const TID = 7;
const CONFIRM = process.env.CONFIRM_EXECUTE === 'yes';
const ck=(r,w)=>{if(r&&r.error){console.error('ERRO',w,r.error.message);process.exit(1);}};
(async()=>{
  const {data:rounds}=await supabase.from('rounds').select('id_round,id_category,scheduled_date').eq('id_tournament',TID);
  const fut=rounds.filter(r=>r.scheduled_date>='2026-07-09');
  const {data:players}=await supabase.from('players').select('id_player,category_id').eq('id_tournament',TID).eq('active',true);
  const activeByCat={}; players.forEach(p=>{(activeByCat[p.category_id]=activeByCat[p.category_id]||[]).push(p.id_player);});
  let rows=[];
  for(const r of fut){
    const {data:dbls}=await supabase.from('doubles').select('id_player1,id_player2').eq('id_round',r.id_round);
    const sched=new Set(); (dbls||[]).forEach(d=>{if(d.id_player1)sched.add(d.id_player1);if(d.id_player2)sched.add(d.id_player2);});
    for(const pid of sched) rows.push({id_round:r.id_round,id_player:pid,status:'NO_RESPONSE'});
    for(const pid of (activeByCat[r.id_category]||[])) if(!sched.has(pid)) rows.push({id_round:r.id_round,id_player:pid,status:'ROTATED'});
  }
  console.log(`rodadas: ${fut.length} | linhas de attendance a inserir: ${rows.length}`);
  console.log('CONFIRM_EXECUTE =', CONFIRM?'SIM':'nao (dry-run)');
  if(!CONFIRM){console.log('>>> DRY-RUN <<<');process.exit(0);}
  for(let i=0;i<rows.length;i+=200){const x=await supabase.from('round_attendance').insert(rows.slice(i,i+200));ck(x,'att');}
  const {data:chk}=await supabase.from('round_attendance').select('id_round').in('id_round',fut.map(r=>r.id_round));
  console.log(`inseridas. round_attendance nas futuras agora: ${(chk||[]).length}`);
  process.exit(0);
})();
