// READ-ONLY: auditoria de completude do round-robin de PARCERIA na Masc Iniciante (cat 1).
// Cada dupla = 1 RIGHT + 1 LEFT (verifica). Reporta: pares faltando (0 jogos), repetidos (>1),
// e a lista de parceiros que faltam pra CADA atleta ativo. Foco extra no Bernardo (654) × Cicero.
// Também confere no backup PRÉ-hoje se o par Bernardo+Cicero algum dia existiu.
const supabase = require('../../supabase');
const fs = require('fs');
const T = 7, CAT = 1;

(async () => {
  const { data: players } = await supabase.from('players').select('id_player,name,side,active').eq('id_tournament', T).eq('category_id', CAT);
  const nm = {}, side = {}, active = {};
  players.forEach(p => { nm[p.id_player]=p.name; side[p.id_player]=p.side; active[p.id_player]=p.active; });
  const act = players.filter(p => p.active);
  const R = act.filter(p => p.side==='RIGHT').map(p=>p.id_player);
  const L = act.filter(p => p.side==='LEFT').map(p=>p.id_player);
  const E = act.filter(p => p.side!=='RIGHT' && p.side!=='LEFT').map(p=>p.id_player);
  console.log(`Ativos cat1: ${act.length} · RIGHT ${R.length} · LEFT ${L.length} · EITHER/outro ${E.length}`);
  const cicero = players.find(p=>/cicero/i.test(p.name)); const CIC = cicero?.id_player;
  console.log(`Bernardo=654 (${side[654]}) · Cicero=${CIC} (${side[CIC]})`);

  const { data: rounds } = await supabase.from('rounds').select('id_round,round_type').eq('id_tournament', T);
  const exhR = new Set(rounds.filter(r=>r.round_type==='EXHIBITION').map(r=>r.id_round));
  const { data: dbls } = await supabase.from('doubles').select('*').eq('id_tournament', T);
  const dm = {}; dbls.forEach(d=>dm[d.id_double]=d);
  const dids = dbls.map(d=>d.id_double);
  async function fetchM(f){ let o=[]; for(let i=0;i<dids.length;i+=200){ const {data}=await supabase.from('matches').select('id_match,id_double_a,id_double_b,status').in(f,dids.slice(i,i+200)); o=o.concat(data||[]);} return o; }
  const byId={}; [...await fetchM('id_double_a'),...await fetchM('id_double_b')].forEach(m=>byId[m.id_match]=m);
  const all=Object.values(byId).filter(m=>['FINISHED','WO','TO_PLAY','CALLING','IN_PROGRESS'].includes(m.status));

  // pares de parceria (só duplas de jogos NÃO-exhibition, e cujos 2 jogadores são ativos cat1)
  const key=(a,b)=>[a,b].sort((x,y)=>x-y).join('-');
  const pairCount = {};
  const addDbl = (d) => {
    if (!d) return; const p1=d.id_player1, p2=d.id_player2; if(!p1||!p2) return;
    if (exhR.has(d.id_round)) return;                       // pareceria anulada não conta
    if (!active[p1]||!active[p2]) return;                   // ignora inativos (Marcio/Alisson)
    if (side[p1]===undefined||side[p2]===undefined) return; // fora da cat1
    pairCount[key(p1,p2)] = (pairCount[key(p1,p2)]||0)+1;
  };
  for (const m of all) { addDbl(dm[m.id_double_a]); addDbl(dm[m.id_double_b]); }

  // intended = todo RIGHT × todo LEFT (o desenho da categoria)
  const intended = [];
  for (const r of R) for (const l of L) intended.push(key(r,l));
  const missing = intended.filter(k => !pairCount[k]);
  const dup = Object.entries(pairCount).filter(([k,c])=>c>1);
  const sameSide = Object.keys(pairCount).filter(k=>{ const [a,b]=k.split('-').map(Number); return side[a]===side[b]; });

  console.log(`\nPares intended (RIGHT×LEFT ativos): ${intended.length}`);
  console.log(`FALTANDO (0 jogos): ${missing.length}`);
  console.log(`REPETIDOS (>1): ${dup.length} ${dup.map(([k,c])=>k+'x'+c).join(', ')}`);
  console.log(`Parcerias same-side (fora do padrão RIGHT×LEFT): ${sameSide.length} ${sameSide.map(k=>{const[a,b]=k.split('-').map(Number);return nm[a]+'/'+nm[b];}).join(', ')||'-'}`);

  console.log(`\n=== Pares FALTANDO (${missing.length}) ===`);
  missing.forEach(k=>{ const[a,b]=k.split('-').map(Number); console.log(`  ${nm[a]} (${side[a]}) + ${nm[b]} (${side[b]})`); });

  // foco Bernardo
  const bMissing = missing.filter(k=>k.split('-').map(Number).includes(654));
  console.log(`\n=== Bernardo (654) — parceiros que faltam: ${bMissing.length} ===`);
  bMissing.forEach(k=>{ const[a,b]=k.split('-').map(Number); const other=a===654?b:a; console.log(`  falta: Bernardo + ${nm[other]} (${side[other]})`); });
  console.log(`Bernardo × Cicero (${CIC}) existe? ${pairCount[key(654,CIC)]?('SIM x'+pairCount[key(654,CIC)]):'NÃO'}`);

  // conferir backup PRÉ-hoje (antes de qualquer escrita minha)
  try {
    const bkDir='C:/obralivre/clientes/parcerias/sociedade-rio-branco/ranking-srb-2026/backups/PRE_pivot_2026-07-08-00-59-22';
    const bd=JSON.parse(fs.readFileSync(bkDir+'/doubles.json','utf-8'));
    const had=bd.some(d=>(d.id_player1===654&&d.id_player2===CIC)||(d.id_player1===CIC&&d.id_player2===654));
    console.log(`\n[backup pré-hoje 00:59] tinha dupla Bernardo+Cicero? ${had?'SIM':'NÃO'} (prova se é erro de hoje ou pré-existente)`);
  } catch(e){ console.log('  (backup não lido:', e.message, ')'); }
  process.exit(0);
})();
