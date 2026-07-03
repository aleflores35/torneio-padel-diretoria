// READ-ONLY · Para um ROUND, computa o estado PRÉ-jogo (desconta o carimbo do próprio
// round) e busca, por lado, uma re-partição dos jogadores em pares 100% INÉDITOS
// (diagonal_count pré == 0). Mantém as direitas/esquerdas que JÁ jogam (não traz de fora).
// Uso: node scripts/investigacao/diag_reparticao_inedita.js <id_round>
const supabase = require('../../supabase');
const T = 7;
const ROUND = Number(process.argv[2]);

async function main() {
  const { data: round } = await supabase.from('rounds').select('*').eq('id_round', ROUND).single();
  const CAT = round.id_category;
  const { data: dbl } = await supabase.from('doubles').select('*').eq('id_round', ROUND);
  const { data: matches } = await supabase.from('matches').select('id_match,id_double_a,id_double_b').in('id_double_a', dbl.map(d=>d.id_double));
  const dById={}; dbl.forEach(d=>dById[d.id_double]=d);
  const ids=[...new Set(dbl.flatMap(d=>[d.id_player1,d.id_player2]))];
  const { data: pl } = await supabase.from('players').select('id_player,name,side').in('id_player', ids);
  const P={}; pl.forEach(p=>P[p.id_player]=p);

  // confrontos mesma-posição ATUAIS (carimbados pelo round) → p/ descontar
  const carimbado = new Set();
  for (const m of matches) {
    const a=dById[m.id_double_a], b=dById[m.id_double_b];
    for (const pa of [a.id_player1,a.id_player2]) for (const pb of [b.id_player1,b.id_player2])
      if (P[pa].side===P[pb].side && P[pa].side!=='EITHER') carimbado.add(pa<pb?`${pa}-${pb}`:`${pb}-${pa}`);
  }

  async function diagPre(a,b){
    const p1=Math.min(a,b),p2=Math.max(a,b);
    const {data}=await supabase.from('oppositions').select('diagonal_count').eq('id_tournament',T).eq('id_category',CAT).eq('id_player1',p1).eq('id_player2',p2).maybeSingle();
    let d=data?data.diagonal_count:0;
    if (carimbado.has(`${p1}-${p2}`)) d-=1; // desconta este round
    return Math.max(0,d);
  }

  // backtracking: particiona lista em pares todos com diagPre==0
  async function findInedita(players){
    const pre={};
    for (let i=0;i<players.length;i++) for (let j=i+1;j<players.length;j++){ pre[`${players[i]}-${players[j]}`]=await diagPre(players[i],players[j]); }
    const key=(a,b)=>a<b?`${a}-${b}`:`${b}-${a}`;
    let sol=null;
    (function bt(rem,acc){
      if (sol) return;
      if (rem.length===0){ sol=[...acc]; return; }
      const a=rem[0];
      for (let k=1;k<rem.length;k++){
        const b=rem[k];
        if (pre[key(a,b)]===0){ bt(rem.filter((_,i)=>i!==0&&i!==k), [...acc,[a,b]]); if(sol)return; }
      }
    })(players,[]);
    return { sol, pre };
  }

  for (const side of ['RIGHT','LEFT']) {
    const players = ids.filter(i=>P[i].side===side);
    console.log(`\n=== ${side} (${players.map(i=>P[i].name).join(', ')}) ===`);
    if (players.length%2!==0){ console.log('  (nº ímpar — bye envolvido, análise parcial)'); }
    const { sol } = await findInedita(players);
    if (sol) {
      console.log('  ✅ existe partição 100% INÉDITA:');
      sol.forEach(([a,b])=>console.log(`     ${P[a].name} × ${P[b].name}`));
    } else {
      console.log('  ❌ NÃO existe partição 100% inédita entre os presentes (repetição inevitável ou precisa amistoso).');
    }
  }
}
main().catch(e=>{console.error(e);process.exit(1);});
