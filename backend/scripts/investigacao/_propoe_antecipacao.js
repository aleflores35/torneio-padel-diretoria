// READ-ONLY (DRY): propoe antecipar jogos futuros de atletas-alvo pra quintas mais cedo.
// Regras: move PARTIDA INTEIRA (nao re-pareia) · destino precisa ter round da MESMA categoria ·
// slot livre = (horario) sem colisao p/ os 4 jogadores + (quadra,horario) livre na noite (TODAS cats
// compartilham quadra) · CONTA matches FINISHED/WO ainda datados na noite (licao W24/W25).
// Nao altera nada. Parametros no topo.
const supabase = require('../../supabase');
const TID = 7;
const HOJE = '2026-07-08';
const MIN_DEST = '2026-07-16';        // pula 09/07 (amanha, arriscado avisar)
const ALVOS = [681, 653];             // Nelson, Cristiano
const MAX_POR_NOITE = 2;              // nao criar 3o jogo na mesma noite p/ um atleta

(async () => {
  const { data: players } = await supabase.from('players').select('*').eq('id_tournament', TID);
  const P={}; players.forEach(p=>P[p.id_player]=p);
  const nm=id=>(P[id]?P[id].name:id);
  const catName=c=>c===1?'Masc Inic':c===2?'Masc 4a':c===3?'Fem':'cat'+c;

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
  const catOf=m=>roundOf(m).id_category;
  const hhmm=m=>String(m.scheduled_at||'').slice(11,16);
  const playersOf=m=>{const a=D[m.id_double_a]||{},b=D[m.id_double_b]||{};return [a.id_player1,a.id_player2,b.id_player1,b.id_player2].filter(Boolean);};

  const { data: absAll } = await supabase.from('player_absences').select('*').eq('id_tournament', TID);
  const absBy={}; (absAll||[]).forEach(a=>{(absBy[a.id_player]=absBy[a.id_player]||new Set()).add(a.absence_date);});

  // grade real: horarios e quadras usados
  const horarios=[...new Set(all.map(hhmm).filter(Boolean))].sort();
  const quadras=[...new Set(all.map(m=>m.id_court).filter(Boolean))].sort((a,b)=>a-b);
  const quintas=[...new Set(rounds.map(r=>r.scheduled_date).filter(Boolean))].sort();
  console.log('grade: horarios', horarios.join(','), '| quadras', quadras.join(','));

  // round da categoria por data
  const roundByCatDate={}; rounds.forEach(r=>{ if(r.scheduled_date) roundByCatDate[`${r.id_category}|${r.scheduled_date}`]=r.id_round; });

  // ocupacao: matches ativos+datados por (data) — conta FINISHED/WO/TO_PLAY/etc, exclui EXHIBITION
  const noite={}; // data -> [matches]
  all.forEach(m=>{ if(typeOf(m)==='EXHIBITION')return; const d=dateOf(m); if(!d)return; (noite[d]=noite[d]||[]).push(m); });

  function jogadorOcupado(pid, data, hh, ignoreMatchId){
    return (noite[data]||[]).some(m=> m.id_match!==ignoreMatchId && hhmm(m)===hh && playersOf(m).includes(pid));
  }
  function quadraOcupada(court, data, hh, ignoreMatchId){
    return (noite[data]||[]).some(m=> m.id_match!==ignoreMatchId && hhmm(m)===hh && m.id_court===court);
  }
  function jogosDoAtletaNaNoite(pid, data, ignoreMatchId){
    return (noite[data]||[]).filter(m=> m.id_match!==ignoreMatchId && playersOf(m).includes(pid)).length;
  }

  for (const AID of ALVOS){
    const p=P[AID];
    console.log(`\n\n======== ${p.name} (${AID}, ${catName(p.category_id)}) ========`);
    const futuros=all.filter(m=>playersOf(m).includes(AID)&&typeOf(m)!=='EXHIBITION'&&['TO_PLAY','CALLING','IN_PROGRESS'].includes(m.status)&&dateOf(m)>HOJE)
      .sort((a,b)=>String(a.scheduled_at).localeCompare(String(b.scheduled_at)));
    console.log(`futuros: ${futuros.map(m=>`#${m.id_match}(${dateOf(m)} ${hhmm(m)})`).join(', ')}`);

    for (const m of futuros){
      const cat=catOf(m); const four=playersOf(m);
      const origem=dateOf(m);
      // destinos: quintas com round da MESMA cat, entre MIN_DEST e origem (exclusivo), mais cedo primeiro
      const dests=quintas.filter(q=> q>=MIN_DEST && q<origem && roundByCatDate[`${cat}|${q}`]);
      let achou=null;
      for (const dq of dests){
        // algum dos 4 impedido (ausencia) na data destino? pula
        if (four.some(pid => (absBy[pid]||new Set()).has(dq))) continue;
        // nao criar 3o jogo/noite p/ nenhum dos 4
        if (four.some(pid => jogosDoAtletaNaNoite(pid, dq, m.id_match) >= MAX_POR_NOITE)) continue;
        // procura slot (horario, quadra) livre
        for (const hh of horarios){
          if (four.some(pid => jogadorOcupado(pid, dq, hh, m.id_match))) continue;
          const court=quadras.find(c => !quadraOcupada(c, dq, hh, m.id_match));
          if (!court) continue;
          achou={dq, hh, court}; break;
        }
        if (achou) break;
      }
      const desc=`${(D[m.id_double_a]||{}).display_name} X ${(D[m.id_double_b]||{}).display_name}`;
      if (achou){
        console.log(`  ✅ #${m.id_match} ${origem} ${hhmm(m)} → PODE IR PRA ${achou.dq} ${achou.hh} q${achou.court}`);
        console.log(`       ${desc}`);
        console.log(`       (mover round p/ ${roundByCatDate[`${cat}|${achou.dq}`]}; avisar: ${four.map(nm).join(', ')})`);
      } else {
        console.log(`  ❌ #${m.id_match} ${origem} ${hhmm(m)} — sem encaixe em [${dests.join(', ')||'nenhuma quinta anterior c/ round da cat'}]`);
        console.log(`       ${desc}`);
      }
    }
  }
  console.log('\n(DRY — nada alterado)');
  process.exit(0);
})();
