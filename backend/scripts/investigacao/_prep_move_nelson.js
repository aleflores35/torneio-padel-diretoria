// READ-ONLY prep p/ Opcao 2 (Nelson): confirma duplas de #1418/#1427, courts, e acha slot livre.
// M1: #1418 (30/07) -> 23/07 round 440   [4: Nelson 681, Alessandro 690, Eduardo 679, Ivan 685]
// M2: #1427 (06/08) -> 16/07 round 437   [4: Cassius 677, Helisson 688, Nelson 681, Helio 689]
const supabase = require('../../supabase');
const TID = 7;

(async () => {
  const { data: rounds } = await supabase.from('rounds').select('*').eq('id_tournament', TID);
  const R={}; rounds.forEach(r=>R[r.id_round]=r);
  const { data: players } = await supabase.from('players').select('id_player,name').eq('id_tournament', TID);
  const nm={}; players.forEach(p=>nm[p.id_player]=p.name);
  const { data: courts } = await supabase.from('courts').select('*');
  console.log('COURTS:', courts.map(c=>`${c.id_court}=${c.name}`).join(' | '));
  const { data: dbls } = await supabase.from('doubles').select('*').eq('id_tournament', TID);
  const D={}; dbls.forEach(d=>D[d.id_double]=d);
  const dids=dbls.map(d=>d.id_double);
  async function mF(f){let o=[];for(let i=0;i<dids.length;i+=200){const{data}=await supabase.from('matches').select('*').in(f,dids.slice(i,i+200));o=o.concat(data||[]);}return o;}
  const byId={}; [...await mF('id_double_a'),...await mF('id_double_b')].forEach(m=>byId[m.id_match]=m);
  const all=Object.values(byId);
  const roundOf=m=>R[(D[m.id_double_a]||{}).id_round]||R[(D[m.id_double_b]||{}).id_round]||{};
  const dateOf=m=>roundOf(m).scheduled_date;
  const typeOf=m=>(roundOf(m).round_type||'REG');
  const hhmm=m=>String(m.scheduled_at||'').slice(11,16);
  const four=m=>{const a=D[m.id_double_a]||{},b=D[m.id_double_b]||{};return [a.id_player1,a.id_player2,b.id_player1,b.id_player2].filter(Boolean);};

  for (const id of [1418,1427]){
    const m=byId[id];
    console.log(`\n#${id}: dblA ${m.id_double_a} (${D[m.id_double_a].display_name}) | dblB ${m.id_double_b} (${D[m.id_double_b].display_name})`);
    console.log(`   status ${m.status} | ${dateOf(m)} ${hhmm(m)} court ${m.id_court} | round atual ${(D[m.id_double_a]||{}).id_round}`);
    console.log(`   4 jogadores: ${four(m).map(p=>nm[p]+'('+p+')').join(', ')}`);
  }
  // rounds destino
  for (const [cat,date] of [[2,'2026-07-23'],[2,'2026-07-16']]){
    const r=rounds.find(x=>x.id_category===cat&&x.scheduled_date===date);
    console.log(`\nround cat ${cat} ${date}: ${r?r.id_round:'(NAO EXISTE)'} type=${r?(r.round_type||'REG'):'-'}`);
  }

  const horarios=['18:00','18:30','18:40','19:10','19:20','19:50','20:00','20:30','20:40','21:10','21:50'];
  const quadras=[...new Set(all.map(m=>m.id_court).filter(Boolean))].sort((a,b)=>a-b);

  function analisaNoite(date, moverMatchId, quatro){
    console.log(`\n===== ${date} (destino) — grade atual (exclui #${moverMatchId}) =====`);
    const noite=all.filter(m=>dateOf(m)===date&&typeOf(m)!=='EXHIBITION'&&m.id_match!==moverMatchId);
    const bySlot={}; noite.forEach(m=>{const t=hhmm(m);(bySlot[t]=bySlot[t]||[]).push(m);});
    for (const t of horarios){
      const ms=bySlot[t]||[];
      const courtsUsed=ms.map(m=>m.id_court);
      const quadraLivre=quadras.find(c=>!courtsUsed.includes(c));
      const conflita=quatro.filter(pid=>ms.some(m=>four(m).includes(pid))).map(pid=>nm[pid]);
      const jaJoga=quatro.filter(pid=>noite.some(m=>four(m).includes(pid))).map(pid=>nm[pid]);
      const ok = quadraLivre && conflita.length===0;
      console.log(`  ${t} | ocup q[${courtsUsed.join(',')||'-'}] livre q${quadraLivre||'NENHUMA'} | dos4 nesse horario: ${conflita.join(',')||'-'} | ${ok?'✅ CABE':'—'}`);
    }
    const jaNaNoite=quatro.filter(pid=>noite.some(m=>four(m).includes(pid))).map(pid=>nm[pid]);
    console.log(`  (dos 4, ja jogam nesta noite: ${jaNaNoite.join(', ')||'nenhum'})`);
  }
  analisaNoite('2026-07-23', 1418, [681,690,679,685]); // M1
  analisaNoite('2026-07-16', 1427, [677,688,681,689]); // M2
  process.exit(0);
})();
