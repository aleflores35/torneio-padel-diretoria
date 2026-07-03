// Sorteio da semana 2026-06-04 (rodada #8) — 3 categorias.
//
//   cat 1 Masc Iniciante : sorteio normal (motor real), excluindo impedidos
//   cat 2 Masc 4ª        : 1 dupla FIXA (Daniel Souza Staevie 676 + Daniel Teixeira 687)
//                          + duplas sorteadas até a meta da rodada. Daniels jogam contra
//                          a 1ª dupla sorteada. Total de duplas é mantido PAR.
//   cat 3 Feminino       : "todos os jogos possíveis" (motor real), excluindo impedidas
//
// Exclusões = player_absences(2026-06-04) [declaradas no app] ∪ IMPEDIDOS_MANUAIS.
//
// DRY-RUN é o default. Pra gravar:
//   CONFIRM_EXECUTE=yes node scripts/investigacao/sortear_semana_2026-06-04.js
// Só uma categoria:
//   ONLY_CAT=3 CONFIRM_EXECUTE=yes node scripts/investigacao/sortear_semana_2026-06-04.js

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
const supabase = require('../../supabase');
const weeklyDrawService = require('../../services/weeklyDrawService');

const ID_TOURNAMENT = 7;
const SCHEDULED_DATE = '2026-06-04';
const EXECUTE = process.env.CONFIRM_EXECUTE === 'yes';
const ONLY_CAT = process.env.ONLY_CAT ? Number(process.env.ONLY_CAT) : null;
const TIME_SLOTS = ['18:30', '19:10', '19:50', '20:30', '21:10', '21:50'];

const FIXO_A = 676; // Daniel Souza Staevie (RIGHT)
const FIXO_B = 687; // Daniel Teixeira (LEFT)

const IMPEDIDOS_MANUAIS = {
  1: [670, 659, 652, 668], // Alisson Boyink, Rodrigo Keller, Andre Hoppe, Diego Schutz
  2: [690, 688],           // Alessandro Flores, Hélisson Borges
  3: [698, 702],           // Sabrina Schutz, Francine Rossi
};

// ── Helpers copiados do weeklyDrawService ─────────────────────────────────────
function shuffle(a){const r=[...a];for(let i=r.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[r[i],r[j]]=[r[j],r[i]];}return r;}
function pairKey(a,b){return a<b?`${a}-${b}`:`${b}-${a}`;}
function buildPartnershipCost(ps){const c={};(ps||[]).forEach(p=>{c[pairKey(p.id_player1,p.id_player2)]=(p.times_paired||1)*100;});return c;}
function matchSidesGreedy(rights,lefts,pc,K=200){let bp=null,bc=Infinity;for(let t=0;t<K;t++){const R=shuffle([...rights]),L=shuffle([...lefts]),pairs=[],uL=new Set();let cost=0;for(const r of R){let bi=-1,bb=Infinity;for(let j=0;j<L.length;j++){if(uL.has(j))continue;const c=pc[pairKey(r.id_player,L[j].id_player)]||0;if(c<bb){bb=c;bi=j;}}if(bi>=0){pairs.push({player1:r.id_player,player2:L[bi].id_player});uL.add(bi);cost+=bb;}}if(cost<bc){bc=cost;bp=pairs;}}return bp||[];}
function pairBySide(active,ps){
  const rights=active.filter(p=>p.side==='RIGHT'),lefts=active.filter(p=>p.side==='LEFT'),eithers=shuffle(active.filter(p=>p.side==='EITHER'));
  while(rights.length<lefts.length&&eithers.length>0)rights.push(eithers.pop());
  while(lefts.length<rights.length&&eithers.length>0)lefts.push(eithers.pop());
  const eitherPairs=[];while(eithers.length>=2)eitherPairs.push({player1:eithers.pop().id_player,player2:eithers.pop().id_player});
  if(eithers.length===1)(rights.length<=lefts.length?rights:lefts).push(eithers.pop());
  const minSide=Math.min(rights.length,lefts.length);
  const unpaired=rights.length>lefts.length?rights.splice(minSide):lefts.length>rights.length?lefts.splice(minSide):[];
  const pairs=matchSidesGreedy(rights,lefts,buildPartnershipCost(ps));pairs.push(...eitherPairs);
  return {pairs,unpaired};
}
// Seleciona exatamente N jogadores (menos jogos primeiro) tentando balancear lados.
function selectN(pool,games,n){
  const available=[...pool].sort((a,b)=>(games[a.id_player]||0)-(games[b.id_player]||0));
  if(available.length<=n)return available.slice();
  let selected=available.slice(0,n);
  const cnt=(arr,s)=>arr.filter(p=>p.side===s).length;const reserve=available.slice(n);
  const reb=(maj,min)=>{while(cnt(selected,maj)-cnt(selected,min)>=2){const mc=reserve.find(p=>p.side===min||p.side==='EITHER');if(!mc)break;const mi=[...selected].reverse().findIndex(p=>p.side===maj);if(mi<0)break;const ri=selected.length-1-mi;const rm=selected.splice(ri,1)[0];selected.push(mc);reserve.splice(reserve.indexOf(mc),1);reserve.push(rm);}};
  reb('RIGHT','LEFT');reb('LEFT','RIGHT');return selected;
}
function getTargetMatches(n,round){if(n>=24)return 7;if(n>=16)return round%2!==0?3:2;return round<=12?2:1;}

async function gamesPlayedMap(){
  const [{data:dbls},{data:cm}]=await Promise.all([
    supabase.from('doubles').select('id_double,id_player1,id_player2').eq('id_tournament',ID_TOURNAMENT),
    supabase.from('matches').select('id_double_a,id_double_b').eq('id_tournament',ID_TOURNAMENT).in('status',['FINISHED','WO']),
  ]);
  const dToP={};for(const d of dbls||[])dToP[d.id_double]=[d.id_player1,d.id_player2];
  const g={};for(const m of cm||[])for(const pid of [...(dToP[m.id_double_a]||[]),...(dToP[m.id_double_b]||[])])g[pid]=(g[pid]||0)+1;
  return g;
}
async function nextRoundNumber(cat){
  const {data}=await supabase.from('rounds').select('round_number').eq('id_tournament',ID_TOURNAMENT).eq('id_category',cat).order('round_number',{ascending:false}).limit(1);
  return (data?.[0]?.round_number||0)+1;
}
async function buildExclusions(){
  const {data:abs}=await supabase.from('player_absences').select('id_player').eq('id_tournament',ID_TOURNAMENT).eq('absence_date',SCHEDULED_DATE);
  const {data:players}=await supabase.from('players').select('id_player,category_id').eq('id_tournament',ID_TOURNAMENT);
  const catOf={};(players||[]).forEach(p=>catOf[p.id_player]=p.category_id);
  const excl={1:new Set(),2:new Set(),3:new Set()};const srcApp={1:new Set(),2:new Set(),3:new Set()};
  for(const a of abs||[]){const c=catOf[a.id_player];if(excl[c]){excl[c].add(a.id_player);srcApp[c].add(a.id_player);}}
  for(const c of [1,2,3])for(const pid of IMPEDIDOS_MANUAIS[c]||[])excl[c].add(pid);
  return {excl,srcApp};
}

// ── Plano da cat 2 (dupla fixa) — usado por preview E execução ─────────────────
async function buildCat2Plan(active,games,exclSet){
  const nextR=await nextRoundNumber(2);
  const target=getTargetMatches(active.length,nextR); // ex.: round par 18p → 2
  const {data:ps}=await supabase.from('partnerships').select('*').eq('id_tournament',ID_TOURNAMENT).eq('id_category',2);
  const excludedFixo=new Set([...exclSet,FIXO_A,FIXO_B]);
  const pool=active.filter(p=>!excludedFixo.has(p.id_player));
  const drawnDoublesNeeded=Math.max(1,target*2-1);       // fixo conta 1 dupla → faltam ímpar p/ ficar par
  const selected=selectN(pool,games,drawnDoublesNeeded*2);
  const {pairs}=pairBySide(selected,ps||[]);
  let drawn=pairs.slice(0,drawnDoublesNeeded);
  let allDoubles=[{p1:FIXO_A,p2:FIXO_B,tag:'FIXO'},...drawn.map((pr,i)=>({p1:pr.player1,p2:pr.player2,tag:'S'+i}))];
  // garante nº PAR de duplas (todas têm adversário)
  const droppedPlayers=[];
  if(allDoubles.length%2!==0){const d=allDoubles.pop();droppedPlayers.push(d.p1,d.p2);}
  const matchPlan=[];for(let i=0;i+1<allDoubles.length;i+=2)matchPlan.push([allDoubles[i],allDoubles[i+1]]);
  const inGame=new Set(allDoubles.flatMap(d=>[d.p1,d.p2]));
  const rotated=active.filter(p=>!inGame.has(p.id_player)&&!exclSet.has(p.id_player)).map(p=>p.id_player);
  return {nextR,target,allDoubles,matchPlan,rotated,inGame,ps};
}

async function slotsForDate(){
  const {data:courts}=await supabase.from('courts').select('id_court,name,order_index').eq('id_tournament',ID_TOURNAMENT).order('order_index');
  const {data:exist}=await supabase.from('matches').select('id_court,scheduled_at').eq('id_tournament',ID_TOURNAMENT).not('scheduled_at','is',null).gte('scheduled_at',`${SCHEDULED_DATE}T00:00:00`).lte('scheduled_at',`${SCHEDULED_DATE}T23:59:59`);
  const taken={};(courts||[]).forEach(c=>taken[c.id_court]=new Set());(exist||[]).forEach(m=>{if(m.id_court&&m.scheduled_at)taken[m.id_court]?.add(m.scheduled_at.substring(11,16));});
  const slots=[];for(const t of TIME_SLOTS)for(const c of courts||[])if(!taken[c.id_court]?.has(t))slots.push({id_court:c.id_court,time:t,court_name:c.name});
  return slots;
}

// ── Preview por categoria ─────────────────────────────────────────────────────
async function previewCat(cat,allPlayers,games,exclSet,srcApp,nameById){
  const active=allPlayers.filter(p=>p.category_id===cat&&p.active);
  console.log(`\n━━━ CAT ${cat} · ${active.length} ativos ━━━`);
  console.log(`Impedidos (${exclSet.size}): ${[...exclSet].map(id=>`${id} ${nameById[id]||'?'}${srcApp.has(id)?'[app]':'[manual]'}`).join(', ')}`);

  if(cat===2){
    const plan=await buildCat2Plan(active,games,exclSet);
    console.log(`rodada #${plan.nextR} · meta ${plan.target} jogos · DUPLA FIXA: ${nameById[FIXO_A]}(R) + ${nameById[FIXO_B]}(L)`);
    plan.matchPlan.forEach((m,i)=>console.log(`   Jogo ${i+1}: ${nameById[m[0].p1]}+${nameById[m[0].p2]} × ${nameById[m[1].p1]}+${nameById[m[1].p2]}${m[0].tag==='FIXO'?' [FIXO]':''}`));
    console.log(`   ROTATED (${plan.rotated.length}): ${plan.rotated.map(id=>nameById[id]).join(', ')||'—'}`);
    return plan.matchPlan.length;
  }
  // cat 1 e 3: replica seleção do motor pra preview
  const nextR=await nextRoundNumber(cat);
  const target=getTargetMatches(active.length,nextR);
  const {data:ps}=await supabase.from('partnerships').select('*').eq('id_tournament',ID_TOURNAMENT).eq('id_category',cat);
  const selected=selectPlayersForWeek(active,games,exclSet,target);
  const {pairs,unpaired}=pairBySide(selected,ps||[]);
  const matches=Math.floor(pairs.length/2);
  console.log(`rodada #${nextR} · disponíveis ${active.filter(p=>!exclSet.has(p.id_player)).length} · meta ${target} · ~${matches} jogos`);
  for(let i=0;i+1<pairs.length;i+=2)console.log(`   Jogo ${i/2+1}: ${nameById[pairs[i].player1]}+${nameById[pairs[i].player2]} × ${nameById[pairs[i+1].player1]}+${nameById[pairs[i+1].player2]}`);
  if(unpaired.length)console.log(`   ⚠️ sem par: ${unpaired.map(u=>`${nameById[u.id_player]}(${u.side})`).join(', ')}`);
  return matches;
}
function selectPlayersForWeek(players,games,excluded,target){
  const available=players.filter(p=>!excluded.has(p.id_player)).sort((a,b)=>(games[a.id_player]||0)-(games[b.id_player]||0));
  const needed=target*4;if(available.length<=needed)return available;
  let selected=available.slice(0,needed);const cnt=(arr,s)=>arr.filter(p=>p.side===s).length;const reserve=available.slice(needed);
  const reb=(maj,min)=>{while(cnt(selected,maj)-cnt(selected,min)>=2){const mc=reserve.find(p=>p.side===min||p.side==='EITHER');if(!mc)break;const mi=[...selected].reverse().findIndex(p=>p.side===maj);if(mi<0)break;const ri=selected.length-1-mi;const rm=selected.splice(ri,1)[0];selected.push(mc);reserve.splice(reserve.indexOf(mc),1);reserve.push(rm);}};
  reb('RIGHT','LEFT');reb('LEFT','RIGHT');return selected;
}

// ── Execução cat 1 e 3 (motor real) ───────────────────────────────────────────
async function executeNormalCat(cat,exclSet){
  console.log(`\n🚀 cat ${cat}: drawWeeklyRound + confirmRound (motor real)...`);
  const draw=await weeklyDrawService.drawWeeklyRound(ID_TOURNAMENT,cat,SCHEDULED_DATE,[...exclSet]);
  console.log(`   round #${draw.round_number} id=${draw.id_round} · duplas=${draw.doubles.length} · bye=${draw.bye?draw.bye.name:'—'}`);
  (draw.warnings||[]).forEach(w=>console.log(`   ⚠️ ${w}`));
  const conf=await weeklyDrawService.confirmRound(draw.id_round);
  console.log(`   ✅ CONFIRMED · ${conf.matches_created} jogos${conf.overflow_warning?` · ⚠️ ${conf.overflow_warning}`:''}`);
  (conf.schedule||[]).forEach(s=>console.log(`      ${s.court} ${s.time}`));
  return draw.id_round;
}

// ── Execução cat 2 (dupla fixa, escrita manual) ───────────────────────────────
async function executeFixoCat2(exclSet,allPlayers,games,nameById){
  console.log(`\n🚀 cat 2 (FIXO Daniels): escrita manual...`);
  const active=allPlayers.filter(p=>p.category_id===2&&p.active);
  const plan=await buildCat2Plan(active,games,exclSet);
  const sideById={};active.forEach(p=>sideById[p.id_player]=p.side);
  const slots=await slotsForDate();
  if(slots.length<plan.matchPlan.length)throw new Error(`Slots insuficientes p/ cat 2: ${slots.length} < ${plan.matchPlan.length}`);

  const monday=new Date(SCHEDULED_DATE+'T12:00:00');monday.setDate(monday.getDate()-3);monday.setHours(18,0,0,0);
  const {data:round,error:rErr}=await supabase.from('rounds').insert({id_tournament:ID_TOURNAMENT,id_category:2,round_number:plan.nextR,scheduled_date:SCHEDULED_DATE,window_start:'18:30',window_end:'22:00',status:'DRAFT',round_type:'REGULAR',confirmation_deadline:monday.toISOString()}).select().single();
  if(rErr)throw new Error('round: '+rErr.message);

  const dIns=plan.allDoubles.map(d=>({id_tournament:ID_TOURNAMENT,id_player1:d.p1,id_player2:d.p2,display_name:`${nameById[d.p1]} / ${nameById[d.p2]}`,id_round:round.id_round}));
  const {data:insD,error:dErr}=await supabase.from('doubles').insert(dIns).select();
  if(dErr)throw new Error('doubles: '+dErr.message);
  const tagToId={};insD.forEach((d,i)=>tagToId[plan.allDoubles[i].tag]=d.id_double);

  const mIns=plan.matchPlan.map((m,i)=>({id_tournament:ID_TOURNAMENT,id_double_a:tagToId[m[0].tag],id_double_b:tagToId[m[1].tag],id_court:slots[i].id_court,status:'TO_PLAY',scheduled_at:`${SCHEDULED_DATE}T${slots[i].time}:00`}));
  if(mIns.length){const {error:mErr}=await supabase.from('matches').insert(mIns);if(mErr)throw new Error('matches: '+mErr.message);}

  const att=[
    ...[...plan.inGame].map(pid=>({id_round:round.id_round,id_player:pid,status:'NO_RESPONSE'})),
    ...[...exclSet].map(pid=>({id_round:round.id_round,id_player:pid,status:'DECLINED',responded_by:'ADMIN'})),
    ...plan.rotated.map(pid=>({id_round:round.id_round,id_player:pid,status:'ROTATED'})),
  ];
  await supabase.from('round_attendance').insert(att);

  for(const d of plan.allDoubles){const p1=Math.min(d.p1,d.p2),p2=Math.max(d.p1,d.p2);const {data:ex}=await supabase.from('partnerships').select('id_partnership,times_paired').eq('id_tournament',ID_TOURNAMENT).eq('id_category',2).eq('id_player1',p1).eq('id_player2',p2).maybeSingle();if(ex)await supabase.from('partnerships').update({times_paired:ex.times_paired+1,last_round_id:round.id_round}).eq('id_partnership',ex.id_partnership);else await supabase.from('partnerships').insert({id_tournament:ID_TOURNAMENT,id_category:2,id_player1:p1,id_player2:p2,times_paired:1,last_round_id:round.id_round});}
  for(const m of plan.matchPlan){const A=[m[0].p1,m[0].p2],B=[m[1].p1,m[1].p2];for(const pa of A)for(const pb of B){const p1=Math.min(pa,pb),p2=Math.max(pa,pb);const isDiag=sideById[pa]&&sideById[pb]&&sideById[pa]===sideById[pb]&&sideById[pa]!=='EITHER';const {data:ex}=await supabase.from('oppositions').select('id_opposition,times_opposed,diagonal_count').eq('id_tournament',ID_TOURNAMENT).eq('id_category',2).eq('id_player1',p1).eq('id_player2',p2).maybeSingle();if(ex)await supabase.from('oppositions').update({times_opposed:ex.times_opposed+1,diagonal_count:ex.diagonal_count+(isDiag?1:0),last_round_id:round.id_round}).eq('id_opposition',ex.id_opposition);else await supabase.from('oppositions').insert({id_tournament:ID_TOURNAMENT,id_category:2,id_player1:p1,id_player2:p2,times_opposed:1,diagonal_count:isDiag?1:0,last_round_id:round.id_round});}}
  await supabase.from('rounds').update({status:'CONFIRMED'}).eq('id_round',round.id_round);
  console.log(`   ✅ cat 2 CONFIRMED round=${round.id_round} · ${mIns.length} jogos (Daniels fixos no jogo 1)`);
  return round.id_round;
}

async function main(){
  console.log(`\n=== SORTEIO SEMANA ${SCHEDULED_DATE} ${EXECUTE?'[EXECUTE]':'[DRY-RUN]'} ${ONLY_CAT?`(só cat ${ONLY_CAT})`:''} ===`);
  const {excl,srcApp}=await buildExclusions();
  const {data:allPlayers}=await supabase.from('players').select('id_player,name,side,category_id,active').eq('id_tournament',ID_TOURNAMENT);
  const nameById={};(allPlayers||[]).forEach(p=>nameById[p.id_player]=p.name);
  const games=await gamesPlayedMap();

  const {data:existing}=await supabase.from('rounds').select('id_round,id_category').eq('id_tournament',ID_TOURNAMENT).eq('scheduled_date',SCHEDULED_DATE);
  if(existing&&existing.length){console.log(`\n⚠️ JÁ EXISTEM rodadas em ${SCHEDULED_DATE}: ${existing.map(r=>`cat${r.id_category}(id${r.id_round})`).join(', ')}.`);if(EXECUTE){console.log('Abortando p/ não duplicar. Apague as rodadas antes de re-executar.');return;}}

  const cats=ONLY_CAT?[ONLY_CAT]:[1,2,3];
  let total=0;
  for(const cat of cats)total+=await previewCat(cat,allPlayers,games,excl[cat],srcApp[cat],nameById);
  console.log(`\n≈ total de jogos na noite: ~${total} (teto 12 slots)`);

  if(!EXECUTE){console.log(`\n🔍 DRY-RUN. Pra gravar: CONFIRM_EXECUTE=yes node scripts/investigacao/sortear_semana_2026-06-04.js`);return;}

  console.log(`\n════ EXECUTANDO ════`);
  for(const cat of cats){
    if(cat===2)await executeFixoCat2(excl[2],allPlayers,games,nameById);
    else await executeNormalCat(cat,excl[cat]);
  }
  console.log(`\n✅ Semana ${SCHEDULED_DATE} sorteada.`);
}
main().catch(e=>{console.error('💥',e);process.exit(1);});
