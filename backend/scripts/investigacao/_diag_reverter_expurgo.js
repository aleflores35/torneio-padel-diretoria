// READ-ONLY: diagnostico da correcao "anular so o desistente, preservar terceiros".
// Compara backup PRE-expurgo (rounds originais REGULAR) com o estado LIVE (rounds EXHIBITION 451-457).
// Lista os 9 jogos, marca desistentes (Marcio 657 / Alisson 670) x terceiros, e o delta de pontos
// que a REVERSAO (EXHIBITION->REGULAR) devolve a cada terceiro ATIVO. Nao altera nada.
const supabase = require('../../supabase');
const fs = require('fs');
const TID = 7;
const BK = 'C:/obralivre/clientes/parcerias/sociedade-rio-branco/ranking-srb-2026/backups/PRE_pivot_2026-07-08-01-15-31';
const EXPURGADOS = [657, 670]; // Marcio, Alisson (inativos)
const MATCHES9 = [1235,1261,1287,1260,1264,1285,1296,1311,1325];

(async () => {
  const load = f => JSON.parse(fs.readFileSync(`${BK}/${f}`,'utf-8'));
  const bkDbls = load('doubles.json');   const bkD={}; bkDbls.forEach(d=>bkD[d.id_double]=d);
  const bkRounds = load('rounds.json');  const bkR={}; bkRounds.forEach(r=>bkR[r.id_round]=r);

  // LIVE
  const { data: players } = await supabase.from('players').select('id_player,name,category_id,active').eq('id_tournament', TID);
  const P={}; players.forEach(p=>P[p.id_player]=p);
  const nm=id=>P[id]?P[id].name:id;
  const { data: rounds } = await supabase.from('rounds').select('*').eq('id_tournament', TID);
  const R={}; rounds.forEach(r=>R[r.id_round]=r);
  const { data: dbls } = await supabase.from('doubles').select('*').eq('id_tournament', TID);
  const D={}; dbls.forEach(d=>D[d.id_double]=d);
  const { data: matches } = await supabase.from('matches').select('*').in('id_match', MATCHES9);

  const delta = {}; // pid -> {v,d,pts}
  const add=(pid,res)=>{ if(!delta[pid])delta[pid]={v:0,d:0,pts:0}; if(res==='V'){delta[pid].v++;delta[pid].pts+=3;}else if(res==='D'){delta[pid].d++;delta[pid].pts+=1;} };

  console.log('=== 9 JOGOS EXPURGADOS (viraram EXHIBITION ontem) ===\n');
  for (const mid of MATCHES9){
    const m = matches.find(x=>x.id_match===mid);
    if(!m){ console.log(`#${mid} NAO ENCONTRADO no live`); continue; }
    const dA=D[m.id_double_a], dB=D[m.id_double_b];
    const roundLiveA = R[dA.id_round], roundLiveB = R[dB.id_round];
    const origA = bkD[m.id_double_a] ? bkD[m.id_double_a].id_round : '?';
    const origB = bkD[m.id_double_b] ? bkD[m.id_double_b].id_round : '?';
    const pA=[dA.id_player1,dA.id_player2].filter(Boolean), pB=[dB.id_player1,dB.id_player2].filter(Boolean);
    const gA=m.games_double_a??0, gB=m.games_double_b??0;
    const aWon = gA>gB, bWon = gB>gA;
    console.log(`#${mid} | ${(roundLiveA||{}).scheduled_date} | placar ${gA}x${gB}`);
    console.log(`   round LIVE: A=${dA.id_round}(${(roundLiveA||{}).round_type}) B=${dB.id_round}(${(roundLiveB||{}).round_type}) | round ORIGINAL(bk): A=${origA}(${(bkR[origA]||{}).round_type||'?'}) B=${origB}(${(bkR[origB]||{}).round_type||'?'})`);
    const showSide=(pids,won,lost)=>pids.map(p=>{
      const dead=EXPURGADOS.includes(p); const act=P[p]&&P[p].active;
      const res = won?'V':(lost?'D':'-');
      if(!dead && act) add(p,res);
      return `${nm(p)}(${p})${dead?' [DESISTENTE]':(act?'':' [inativo?]')}:${res}${(!dead&&act)?' (recupera)':''}`;
    }).join(' | ');
    console.log(`   A: ${showSide(pA,aWon,bWon)}`);
    console.log(`   B: ${showSide(pB,bWon,aWon)}`);
    console.log('');
  }

  console.log('=== DELTA por atleta (o que a REVERSAO devolve) ===');
  const rows=Object.entries(delta).sort((a,b)=>b[1].pts-a[1].pts);
  rows.forEach(([pid,d])=>console.log(`  ${nm(pid)} (${pid}, cat ${P[pid]?P[pid].category_id:'?'}): +${d.v}V +${d.d}D = +${d.pts} pts`));
  console.log(`\n  total atletas afetados: ${rows.length}`);

  // rounds-espelho a limpar
  const espelho = [...new Set(MATCHES9.map(mid=>{const m=matches.find(x=>x.id_match===mid);return m?D[m.id_double_a].id_round:null;}).filter(Boolean))];
  console.log(`\n  rounds-espelho EXHIBITION envolvidos (LIVE): ${espelho.join(', ')}`);
  console.log('  (reversao = mover as 18 duplas de volta ao round ORIGINAL do backup; depois checar se rounds-espelho ficam vazios p/ remover)');
  process.exit(0);
})();
