// Remarca os 3 jogos do Pablo (impedido todo julho) pra agosto. Move match->round novo.
// 1395,1396 -> 06/08 (cat2) ; 1411 -> 27/08 (cat2). Horario final fica pro re-slot.
// DRY default; CONFIRM_EXECUTE=yes grava.
const supabase = require('../../supabase');
const CONFIRM = process.env.CONFIRM_EXECUTE === 'yes';
const ck=(r,w)=>{if(r&&r.error){console.error('ERRO',w,r.error.message);process.exit(1);}};
const PLAN = [
  { match:1395, date:'2026-08-06' },
  { match:1396, date:'2026-08-06' },
  { match:1411, date:'2026-08-27' },
];
(async()=>{
  // rounds cat2 alvo
  const {data:rounds}=await supabase.from('rounds').select('id_round,scheduled_date').eq('id_tournament',7).eq('id_category',2);
  const rByDate={}; rounds.forEach(r=>rByDate[r.scheduled_date]=r.id_round);
  console.log('Round 06/08 cat2 =', rByDate['2026-08-06'], '| 27/08 cat2 =', rByDate['2026-08-27']);
  for(const p of PLAN){
    const {data:m}=await supabase.from('matches').select('id_match,id_double_a,id_double_b,scheduled_at').eq('id_match',p.match).single();
    const {data:da}=await supabase.from('doubles').select('display_name').eq('id_double',m.id_double_a).single();
    const {data:db}=await supabase.from('doubles').select('display_name').eq('id_double',m.id_double_b).single();
    const time=(m.scheduled_at||'').slice(11,16)||'18:30';
    p._m=m; p._round=rByDate[p.date]; p._newAt=p.date+'T'+time+':00';
    console.log(`  #${p.match}: ${da.display_name} X ${db.display_name}`);
    console.log(`     ${(m.scheduled_at||'').slice(0,10)} -> ${p.date} (round ${p._round}); horario provisorio ${time} (re-slot ajusta)`);
  }
  if(!CONFIRM){console.log('\\n>>> DRY-RUN: nada gravado <<<');process.exit(0);}
  console.log('\\n--- GRAVANDO ---');
  for(const p of PLAN){
    let r=await supabase.from('doubles').update({id_round:p._round}).eq('id_double',p._m.id_double_a); ck(r,'dblA '+p.match);
    r=await supabase.from('doubles').update({id_round:p._round}).eq('id_double',p._m.id_double_b); ck(r,'dblB '+p.match);
    r=await supabase.from('matches').update({scheduled_at:p._newAt}).eq('id_match',p.match); ck(r,'match '+p.match);
    console.log(`  movido #${p.match} -> ${p.date}`);
  }
  // verificacao: Pablo agora tem 0 jogos em julho
  const {data:dbls}=await supabase.from('doubles').select('id_double,id_round,id_player1,id_player2').eq('id_tournament',7);
  const pabDbls=dbls.filter(d=>d.id_player1===673||d.id_player2===673).map(d=>d.id_double);
  const {data:rounds2}=await supabase.from('rounds').select('id_round,scheduled_date').eq('id_tournament',7);
  const rd={}; rounds2.forEach(r=>rd[r.id_round]=r.scheduled_date);
  const {data:ms}=await supabase.from('matches').select('id_double_a,id_double_b,status').in('id_double_a',pabDbls);
  const julho=(ms||[]).filter(m=>{const d=dbls.find(x=>x.id_double===m.id_double_a);return d&&rd[d.id_round]>='2026-07-01'&&rd[d.id_round]<'2026-08-01'&&m.status==='TO_PLAY';});
  console.log(`\\n  VERIFICA: jogos do Pablo em julho (TO_PLAY) agora = ${julho.length} (esperado 0)`);
  console.log('>>> CONCLUIDO <<<');
  process.exit(0);
})();
