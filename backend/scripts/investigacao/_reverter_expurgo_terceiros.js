// CORRECAO (régua diretoria: anular SÓ o desistente, preservar terceiros).
// Reverte os 9 jogos jogados de EXHIBITION -> REGULAR (move as 18 duplas de volta ao round
// ORIGINAL do backup pré-expurgo). Marcio(657)/Alisson(670) seguem active=false -> continuam
// FORA do ranking, mas seus jogos voltam a contar pros TERCEIROS (rankingService).
// Backup PRE: PRE_pivot_2026-07-08-14-24-40 (+ faço fresco). DRY default; CONFIRM_EXECUTE=yes grava.
const supabase = require('../../supabase');
const fs = require('fs');
const CONFIRM = process.env.CONFIRM_EXECUTE === 'yes';
const TID = 7;
const ck = (r,w)=>{ if(r&&r.error){console.error('ERRO',w,r.error.message);process.exit(1);} };
const BK = 'C:/obralivre/clientes/parcerias/sociedade-rio-branco/ranking-srb-2026/backups/PRE_pivot_2026-07-08-01-15-31';
const MATCHES9 = [1235,1261,1287,1260,1264,1285,1296,1311,1325];
const ESPELHO = [451,452,453,454,455,456,457];

(async () => {
  const bkD = {}; JSON.parse(fs.readFileSync(`${BK}/doubles.json`,'utf-8')).forEach(d=>bkD[d.id_double]=d);

  const { data: players } = await supabase.from('players').select('*').eq('id_tournament', TID);
  const P={}; players.forEach(p=>P[p.id_player]=p);
  const nm=id=>P[id]?P[id].name:id;
  const { data: rounds } = await supabase.from('rounds').select('*').eq('id_tournament', TID);
  const { data: dbls } = await supabase.from('doubles').select('*').eq('id_tournament', TID);
  const D={}; dbls.forEach(d=>D[d.id_double]=d);
  const { data: fin } = await supabase.from('matches').select('*').eq('id_tournament', TID).eq('status','FINISHED');
  const { data: wo } = await supabase.from('matches').select('*').eq('id_tournament', TID).eq('status','WO');
  const allMatches = [...fin, ...wo];

  // duplas a mover: das 18 (2 por match), destino = round original do backup
  const moves = [];
  for (const mid of MATCHES9){
    const m = allMatches.find(x=>x.id_match===mid) || (await supabase.from('matches').select('*').eq('id_match',mid)).data[0];
    for (const dblId of [m.id_double_a, m.id_double_b]){
      const orig = bkD[dblId] && bkD[dblId].id_round;
      moves.push({ dbl: dblId, from: D[dblId].id_round, to: orig, match: mid });
    }
  }

  // ---- simulacao de ranking cat 1 (replica rankingService) ----
  function computeCat1(exhibitionRoundIds){
    const ativosCat1 = players.filter(p=>p.category_id===1 && p.active);
    const pids = new Set(ativosCat1.map(p=>p.id_player));
    const exhDblIds = new Set(dbls.filter(d=>d.id_round!=null && exhibitionRoundIds.has(d.id_round)).map(d=>d.id_double));
    const catDbls = dbls.filter(d=>pids.has(d.id_player1)||pids.has(d.id_player2));
    const dblIds = new Set(catDbls.map(d=>d.id_double));
    const dMap={}; catDbls.forEach(d=>dMap[d.id_double]=d);
    const catMatches = allMatches.filter(m=>dblIds.has(m.id_double_a)&&dblIds.has(m.id_double_b)&&!exhDblIds.has(m.id_double_a)&&!exhDblIds.has(m.id_double_b));
    const stats={}; ativosCat1.forEach(p=>stats[p.id_player]={points:0,wins:0,losses:0,wos:0,mp:0,gf:0,ga:0});
    for (const m of catMatches){
      const dA=dMap[m.id_double_a], dB=dMap[m.id_double_b]; if(!dA||!dB)continue;
      const absents=new Set(Array.isArray(m.absent_player_ids)?m.absent_player_ids:[]);
      const pA=[dA.id_player1,dA.id_player2].filter(Boolean), pB=[dB.id_player1,dB.id_player2].filter(Boolean);
      const aAbs=pA.some(p=>absents.has(p)), bAbs=pB.some(p=>absents.has(p));
      const gA=m.games_double_a??0, gB=m.games_double_b??0;
      const valid=(gA>0||gB>0)&&gA!==gB; const aWon=valid&&gA>gB, bWon=valid&&gB>gA;
      const proc=(pid,og,pg,ow,ourAbs,oppAbs)=>{ if(!stats[pid])return; stats[pid].mp++;
        if(absents.has(pid)){stats[pid].wos++;return;} if(ourAbs){stats[pid].points++;return;}
        if(oppAbs){stats[pid].wins++;stats[pid].points+=3;return;}
        if(valid){stats[pid].gf+=og;stats[pid].ga+=pg; if(ow){stats[pid].wins++;stats[pid].points+=3;}else{stats[pid].losses++;stats[pid].points++;}return;}
        stats[pid].points++; };
      for(const pid of pA) proc(pid,gA,gB,aWon,aAbs,bAbs);
      for(const pid of pB) proc(pid,gB,gA,bWon,bAbs,aAbs);
    }
    return ativosCat1.map(p=>({id:p.id_player,name:p.name,...stats[p.id_player],gb:stats[p.id_player].gf-stats[p.id_player].ga}))
      .sort((a,b)=>b.points-a.points||b.wins-a.wins||b.gb-a.gb||a.losses-b.losses||a.wos-b.wos);
  }

  const exhNow = new Set(rounds.filter(r=>(r.round_type)==='EXHIBITION').map(r=>r.id_round));
  const exhAfter = new Set([...exhNow].filter(id=>!ESPELHO.includes(id)));
  const antes = computeCat1(exhNow);
  const depois = computeCat1(exhAfter);
  const posAntes={}; antes.forEach((r,i)=>posAntes[r.id]=i+1);

  console.log('=== RANKING Masc Iniciante — ANTES -> DEPOIS (simulado) ===');
  console.log('pos | atleta | pts (Δ) | V-D | jogos');
  depois.forEach((r,i)=>{
    const a=antes.find(x=>x.id===r.id)||{points:0,wins:0,losses:0,mp:0};
    const dpts=r.points-a.points; const posA=posAntes[r.id];
    const seta = posA===(i+1)?'=':(posA>(i+1)?`↑${posA-(i+1)}`:`↓${(i+1)-posA}`);
    console.log(`  ${String(i+1).padStart(2)}º(${seta}) | ${r.name.padEnd(22)} | ${String(r.points).padStart(2)} (${dpts>0?'+'+dpts:dpts}) | ${r.wins}-${r.losses} | ${r.mp}${dpts>0?'  <<< recuperou':''}`);
  });
  console.log(`\n  Marcio(657)/Alisson(670) no ranking? ${depois.some(r=>[657,670].includes(r.id))?'SIM <<< ERRO':'NÃO ✅ (seguem fora)'}`);

  // validacao: ANTES bate com API prod? (Cristiano 12 pts)
  const cAntes = antes.find(r=>r.id===653);
  console.log(`  [validacao] Cristiano ANTES: ${cAntes.points} pts (API prod = 12) ${cAntes.points===12?'✅':'⚠️ DIVERGE'}`);

  console.log('\n=== MOVES (18 duplas EXHIBITION -> round REGULAR original) ===');
  moves.forEach(mv=>console.log(`  dbl ${mv.dbl} (#${mv.match}): round ${mv.from} -> ${mv.to}${mv.to?'':' <<< SEM ORIGINAL'}`));
  if (moves.some(mv=>!mv.to)){ console.error('!!! ABORTA: dupla sem round original no backup !!!'); process.exit(1); }

  if(!CONFIRM){ console.log('\n>>> DRY-RUN: nada gravado <<<'); process.exit(0); }

  console.log('\n--- GRAVANDO ---');
  for (const mv of moves){ const r=await supabase.from('doubles').update({id_round:mv.to}).eq('id_double',mv.dbl); ck(r,`dbl ${mv.dbl}`); }
  console.log(`  ${moves.length} duplas revertidas p/ rounds REGULAR`);
  // limpar rounds-espelho se vazios
  for (const rid of ESPELHO){
    const { data: rest } = await supabase.from('doubles').select('id_double').eq('id_round', rid);
    if ((rest||[]).length===0){ const r=await supabase.from('rounds').delete().eq('id_round', rid); ck(r,`del round ${rid}`); console.log(`  round-espelho ${rid} vazio -> removido`); }
    else console.log(`  round ${rid} ainda tem ${rest.length} duplas -> mantido`);
  }
  // assert pos
  const { data: chk } = await supabase.from('doubles').select('id_double,id_round').in('id_double', moves.map(m=>m.dbl));
  const okAll = chk.every(c=>{ const mv=moves.find(m=>m.dbl===c.id_double); return c.id_round===mv.to; });
  console.log(`\n  ASSERT reversao: ${okAll?'OK ✅':'FALHOU ❌'}`);
  if(!okAll)process.exit(1);
  console.log('>>> CONCLUIDO <<<');
  process.exit(0);
})();
