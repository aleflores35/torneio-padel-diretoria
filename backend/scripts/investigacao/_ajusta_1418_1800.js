// AJUSTE de horario (pedido Nelson via Alessandro): #1418 em 06/08 -> 18:00 (jantar Diretoria 20h).
// So muda scheduled_at (18:30 -> 18:00); mantem round 444, quadra 16 (Vidro), duplas.
// Backup PRE: PRE_pivot_2026-07-08-14-23-47. DRY default; CONFIRM_EXECUTE=yes grava.
const supabase = require('../../supabase');
const CONFIRM = process.env.CONFIRM_EXECUTE === 'yes';
const TID = 7;
const ck = (r, w) => { if (r && r.error) { console.error('ERRO', w, r.error.message); process.exit(1); } };
const MATCH = 1418, NEW_AT = '2026-08-06T18:00:00', DATE = '2026-08-06';

(async () => {
  const { data: rounds } = await supabase.from('rounds').select('id_round,scheduled_date,round_type').eq('id_tournament', TID);
  const R={}; rounds.forEach(r=>R[r.id_round]=r);
  const { data: players } = await supabase.from('players').select('id_player,name').eq('id_tournament', TID);
  const nm={}; players.forEach(p=>nm[p.id_player]=p.name);
  const { data: courts } = await supabase.from('courts').select('id_court,name');
  const cN={}; courts.forEach(c=>cN[c.id_court]=c.name);
  const { data: dbls } = await supabase.from('doubles').select('*').eq('id_tournament', TID);
  const D={}; dbls.forEach(d=>D[d.id_double]=d);
  const dids=dbls.map(d=>d.id_double);
  async function mF(f){let o=[];for(let i=0;i<dids.length;i+=200){const{data}=await supabase.from('matches').select('*').in(f,dids.slice(i,i+200));o=o.concat(data||[]);}return o;}
  const byId={}; [...await mF('id_double_a'),...await mF('id_double_b')].forEach(m=>byId[m.id_match]=m);
  const all=Object.values(byId);
  const dOf=m=>(R[(D[m.id_double_a]||{}).id_round]||R[(D[m.id_double_b]||{}).id_round]||{}).scheduled_date;
  const tOf=m=>((R[(D[m.id_double_a]||{}).id_round]||R[(D[m.id_double_b]||{}).id_round]||{}).round_type)||'REGULAR';
  const hh=m=>String(m.scheduled_at||'').slice(11,16);
  const four=m=>{const a=D[m.id_double_a]||{},b=D[m.id_double_b]||{};return[a.id_player1,a.id_player2,b.id_player1,b.id_player2].filter(Boolean);};

  const m0 = byId[MATCH];
  console.log(`#${MATCH}: ${D[m0.id_double_a].display_name} X ${D[m0.id_double_b].display_name}`);
  console.log(`  ANTES:  ${dOf(m0)} ${hh(m0)} ${cN[m0.id_court]}`);
  console.log(`  DEPOIS: ${DATE} ${NEW_AT.slice(11,16)} ${cN[m0.id_court]} (so muda horario)`);

  // verificar noite 06/08 pos-ajuste
  const sim = all.map(m=>m.id_match===MATCH?{...m,scheduled_at:NEW_AT+'+00:00'}:m);
  const noite = sim.filter(m=>dOf(m)===DATE && tOf(m)!=='EXHIBITION');
  const bySlot={}; noite.forEach(m=>{(bySlot[hh(m)]=bySlot[hh(m)]||[]).push(m);});
  let prob=0;
  console.log(`\n=== 06/08 pos-ajuste (${noite.length} jogos) ===`);
  for (const t of Object.keys(bySlot).sort()){
    const ms=bySlot[t]; const cu=ms.map(m=>m.id_court);
    const dupC=cu.length!==new Set(cu).size;
    const pls=ms.flatMap(four); const dupP=[...new Set(pls)].filter(p=>pls.filter(x=>x===p).length>1);
    if(dupC||dupP.length)prob++;
    console.log(`  ${t} (${ms.length}x q[${cu.join(',')}])${(dupC||dupP.length)?' <<< COLISAO':''}`);
    if(dupP.length)console.log(`     jogador 2x: ${dupP.map(p=>nm[p]).join(', ')}`);
  }
  console.log(`  colisoes: ${prob}`);

  if(!CONFIRM){ console.log('\n>>> DRY: nada gravado <<<'); process.exit(0); }
  if(prob>0){ console.error('!!! ABORTADO: colisao !!!'); process.exit(1); }
  let r = await supabase.from('matches').update({ scheduled_at: NEW_AT+'+00:00' }).eq('id_match', MATCH); ck(r,'update horario');
  const { data: chk } = await supabase.from('matches').select('scheduled_at,id_court').eq('id_match', MATCH);
  const ok = chk[0].scheduled_at.slice(0,16)===NEW_AT.slice(0,16);
  console.log(`\n>>> GRAVADO. re-leitura: ${chk[0].scheduled_at} q${chk[0].id_court} — ${ok?'OK':'FALHOU'}`);
  if(!ok)process.exit(1);
  process.exit(0);
})();
