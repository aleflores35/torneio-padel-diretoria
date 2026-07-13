// READ-ONLY: TODOS os jogos do Cristiano Severo (653), inclusive EXHIBITION, com placar e V/D.
// Reconciliar: ele diz 3V+6D=9 jogados; contagem ranking deu 6. Ver o que virou amistoso.
const supabase = require('../../supabase');
const TID = 7;
const PID = 653;

(async () => {
  const { data: sample } = await supabase.from('matches').select('*').limit(1);
  console.log('COLUNAS matches:', Object.keys(sample[0]||{}).join(', '), '\n');

  const { data: players } = await supabase.from('players').select('id_player,name').eq('id_tournament', TID);
  const nm={}; players.forEach(p=>nm[p.id_player]=p.name);
  const { data: rounds } = await supabase.from('rounds').select('*').eq('id_tournament', TID);
  const R={}; rounds.forEach(r=>R[r.id_round]=r);
  const { data: dbls } = await supabase.from('doubles').select('*').eq('id_tournament', TID);
  const D={}; dbls.forEach(d=>D[d.id_double]=d);
  const dids=dbls.map(d=>d.id_double);
  async function mF(f){let o=[];for(let i=0;i<dids.length;i+=200){const{data}=await supabase.from('matches').select('*').in(f,dids.slice(i,i+200));o=o.concat(data||[]);}return o;}
  const byId={}; [...await mF('id_double_a'),...await mF('id_double_b')].forEach(m=>byId[m.id_match]=m);
  const all=Object.values(byId);
  const rOf=m=>R[(D[m.id_double_a]||{}).id_round]||R[(D[m.id_double_b]||{}).id_round]||{};
  const dateOf=m=>rOf(m).scheduled_date, typeOf=m=>(rOf(m).round_type||'REGULAR'), hhmm=m=>String(m.scheduled_at||'').slice(11,16);

  const meus=all.filter(m=>{const a=D[m.id_double_a]||{},b=D[m.id_double_b]||{};return [a.id_player1,a.id_player2,b.id_player1,b.id_player2].includes(PID);})
    .sort((a,b)=>String(a.scheduled_at||dateOf(a)).localeCompare(String(b.scheduled_at||dateOf(b))));

  // detectar campos de placar
  const scoreKeys = Object.keys(sample[0]||{}).filter(k=>/score|game|set|point|result|winner/i.test(k));
  console.log('campos de placar/resultado detectados:', scoreKeys.join(', ')||'(nenhum)');
  console.log(`\n=== TODOS os jogos do Cristiano (653): ${meus.length} ===`);
  let V=0,Der=0,fin=0,finReg=0,exh=0,toplay=0;
  for (const m of meus){
    const a=D[m.id_double_a]||{}, b=D[m.id_double_b]||{};
    const meuLadoA = (a.id_player1===PID||a.id_player2===PID);
    const t=typeOf(m);
    const scoreStr = scoreKeys.map(k=>`${k}=${m[k]}`).join(' ');
    let vd='';
    if (m.status==='FINISHED'){
      fin++;
      if (t!=='EXHIBITION') finReg++; else exh++;
      // tenta achar vencedor por winner ou por games
      let winA=null;
      if (m.winner_double_id!=null) winA = (m.winner_double_id===m.id_double_a);
      else if (m.id_winner!=null) winA = (m.id_winner===m.id_double_a);
      else if (m.score_a!=null && m.score_b!=null) winA = (m.score_a>m.score_b);
      else if (m.games_a!=null && m.games_b!=null) winA = (m.games_a>m.games_b);
      if (winA!==null){ const meuGanhou = (winA===meuLadoA); if(meuGanhou){V++;vd='VITORIA';}else{Der++;vd='DERROTA';} }
    } else if (m.status==='WO'){ fin++; if(t!=='EXHIBITION')finReg++; vd='WO'; }
    else { toplay++; vd=m.status; }
    console.log(`  #${m.id_match} | ${dateOf(m)} ${hhmm(m)} | ${m.status}${t==='EXHIBITION'?' [AMISTOSO]':''} | ${vd} | ${scoreStr}`);
    console.log(`       ${a.display_name} X ${b.display_name}`);
  }
  console.log(`\n=== RESUMO Cristiano ===`);
  console.log(`FINISHED total (inclui amistoso): ${fin} | REGULAR (conta ranking): ${finReg} | AMISTOSO: ${exh} | TO_PLAY/futuro: ${toplay}`);
  console.log(`Vitorias: ${V} | Derrotas: ${Der}  (o atleta relatou 3V + 6D = 9)`);

  // quais jogos dele viraram EXHIBITION e por quem (Marcio 657 / Alisson 670?)
  console.log(`\n=== jogos do Cristiano que sao EXHIBITION (anulados do ranking) ===`);
  const exhMatches = meus.filter(m=>typeOf(m)==='EXHIBITION');
  for (const m of exhMatches){
    const a=D[m.id_double_a]||{}, b=D[m.id_double_b]||{};
    const quatro=[a.id_player1,a.id_player2,b.id_player1,b.id_player2].filter(Boolean);
    const temExpurgado = quatro.filter(p=>[657,670].includes(p)).map(p=>nm[p]);
    console.log(`  #${m.id_match} ${dateOf(m)} | ${a.display_name} X ${b.display_name} | expurgado no jogo: ${temExpurgado.join(',')||'(nenhum — vira exhibition por outro motivo)'}`);
  }
  process.exit(0);
})();
