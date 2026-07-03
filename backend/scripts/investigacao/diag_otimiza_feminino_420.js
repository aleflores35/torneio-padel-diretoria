// READ-ONLY · Otimiza os confrontos de MESMA POSIÇÃO do round 420 (Fem, 25/06).
// Confrontos mesma-posição num jogo = R×R e L×L. Com 4 direitas e 4 esquerdas em 2
// jogos, as repetições dependem só de COMO cada lado se particiona em 2 pares
// (independente do emparelhamento R+L das duplas). Enumera as 3 partições de cada
// lado e acha a que minimiza diagonal_count somado.
const supabase = require('../../supabase');
const T = 7, CAT = 3, ROUND = 420;

async function diag(a, b) {
  const p1 = Math.min(a, b), p2 = Math.max(a, b);
  const { data } = await supabase.from('oppositions').select('diagonal_count, times_opposed')
    .eq('id_tournament', T).eq('id_category', CAT).eq('id_player1', p1).eq('id_player2', p2).maybeSingle();
  return data ? data.diagonal_count : 0;
}

// 3 partições de 4 elementos em 2 pares
function partitions(x) {
  const [a,b,c,d] = x;
  return [
    { pairs: [[a,b],[c,d]] },
    { pairs: [[a,c],[b,d]] },
    { pairs: [[a,d],[b,c]] },
  ];
}

async function bestSide(ids, P) {
  const parts = partitions(ids);
  const scored = [];
  for (const pt of parts) {
    let sum = 0; const detail = [];
    for (const [x,y] of pt.pairs) { const d = await diag(x,y); sum += d; detail.push(`${P[x].name}×${P[y].name}=${d}`); }
    scored.push({ sum, detail });
  }
  scored.sort((m,n) => m.sum - n.sum);
  return scored;
}

async function run() {
  const { data: doubles } = await supabase.from('doubles').select('*').eq('id_round', ROUND);
  const ids = [...new Set((doubles||[]).flatMap(d => [d.id_player1, d.id_player2]))];
  const { data: pl } = await supabase.from('players').select('id_player,name,side').in('id_player', ids);
  const P = {}; (pl||[]).forEach(p => P[p.id_player] = p);
  const R = ids.filter(i => P[i].side === 'RIGHT');
  const L = ids.filter(i => P[i].side === 'LEFT');
  console.log('Direitas:', R.map(i=>P[i].name).join(', '));
  console.log('Esquerdas:', L.map(i=>P[i].name).join(', '));

  console.log('\n== Partições DIREITA (ordenadas da melhor=menos repetição) ==');
  (await bestSide(R, P)).forEach((s,i) => console.log(`  ${i===0?'➜':' '} soma=${s.sum}  ${s.detail.join('  ·  ')}`));
  console.log('\n== Partições ESQUERDA ==');
  (await bestSide(L, P)).forEach((s,i) => console.log(`  ${i===0?'➜':' '} soma=${s.sum}  ${s.detail.join('  ·  ')}`));

  console.log('\n(diag=0 = inédito; >0 = nº de vezes que já se enfrentaram na mesma posição)');
}
run().catch(e => { console.error(e.message||e); process.exit(1); });
