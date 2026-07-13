// READ-ONLY: candidatos a substituir Alexandre (656, RIGHT) no #1399 (09/07 20:30 cat1)
// + checagem de rodada cat1 em 16/07 (opcao "adiar 1 semana").
// Regra FORTE: substituto RIGHT nao pode ter enfrentado Flavio Justo (658, RIGHT) na mesma posicao (diagonal_count>0).
// Regra MENOR (desempate): nao repetir parceria com Francisco Neto (663, LEFT).
const supabase = require('../../supabase');
const TID = 7, CAT = 1;
const ALEX = 656, FRANCISCO = 663, FLAVIO = 658;
const DATA = '2026-07-09', SLOT = '20:30';

(async () => {
  if (!supabase) { console.error('SEM supabase'); process.exit(1); }
  const { data: players } = await supabase.from('players')
    .select('id_player,name,side,category_id,active').eq('id_tournament', TID);
  const P = {}; players.forEach(p => P[p.id_player]=p);
  const cat1Right = players.filter(p => p.category_id===CAT && p.side==='RIGHT' && p.active);

  const { data: rounds } = await supabase.from('rounds').select('id_round,scheduled_date,id_category').eq('id_tournament', TID);
  const rd = {}; rounds.forEach(r => rd[r.id_round]=r);
  const { data: dbls } = await supabase.from('doubles').select('id_double,id_round,id_player1,id_player2,display_name').eq('id_tournament', TID);
  const dblById = {}; dbls.forEach(d => dblById[d.id_double]=d);
  const dids = dbls.map(d=>d.id_double);
  async function mf(field){ let o=[]; for(let i=0;i<dids.length;i+=200){ const {data}=await supabase.from('matches').select('*').in(field,dids.slice(i,i+200)); o=o.concat(data||[]);} return o; }
  const all = Object.values(Object.fromEntries([...(await mf('id_double_a')),...(await mf('id_double_b'))].map(m=>[m.id_match,m])));
  function roundOf(m){ const da=dblById[m.id_double_a],db=dblById[m.id_double_b]; return rd[da&&da.id_round]||rd[db&&db.id_round]||{}; }
  function hhmm(m){ return String(m.scheduled_at||'').slice(11,16); }
  function four(m){ const da=dblById[m.id_double_a],db=dblById[m.id_double_b]; return [da&&da.id_player1,da&&da.id_player2,db&&db.id_player1,db&&db.id_player2].filter(Boolean); }

  // quem esta ocupado no slot 20:30 de 09/07
  const noite = all.filter(m => roundOf(m).scheduled_date===DATA);
  const ocupados2030 = new Set();
  noite.filter(m=>hhmm(m)===SLOT).forEach(m=>four(m).forEach(pid=>ocupados2030.add(pid)));
  // quadras livres no slot 20:30
  const quadras2030 = noite.filter(m=>hhmm(m)===SLOT).map(m=>m.id_court);
  console.log(`Slot 20:30 09/07 -> jogos: ${noite.filter(m=>hhmm(m)===SLOT).length}, quadras ocupadas: ${quadras2030.join(',')}`);

  // ausencias em 09/07
  const { data: abs } = await supabase.from('player_absences').select('id_player,absence_date').eq('id_tournament', TID).eq('absence_date', DATA);
  const ausentes = new Set((abs||[]).map(a=>a.id_player));

  // oppositions: diagonal vs Flavio Justo (658)
  const { data: opps } = await supabase.from('oppositions').select('*').eq('id_tournament', TID).eq('id_category', CAT);
  function diagVsFlavio(pid){
    const a=Math.min(pid,FLAVIO), b=Math.max(pid,FLAVIO);
    const row=(opps||[]).find(o=>o.id_player1===a && o.id_player2===b);
    return row ? (row.diagonal_count||0) : 0;
  }
  // partnerships: ja jogou de dupla com Francisco (663)?
  const { data: parts } = await supabase.from('partnerships').select('*').eq('id_tournament', TID);
  function jaDuplaFrancisco(pid){
    const a=Math.min(pid,FRANCISCO), b=Math.max(pid,FRANCISCO);
    return (parts||[]).some(pt=>{ const x=Math.min(pt.id_player1,pt.id_player2), y=Math.max(pt.id_player1,pt.id_player2); return x===a&&y===b; });
  }

  console.log(`\n=== CANDIDATOS cat1 RIGHT (substituir Alexandre no #1399, parceiro Francisco Neto vs Flavio Justo) ===`);
  console.log(`(regra FORTE: diag vs Flavio=0 OK / >0 VIOLA. regra MENOR: dupla-Francisco = so desempate)\n`);
  const linhas = [];
  for (const c of cat1Right) {
    if (c.id_player===ALEX) continue;
    const ocupado = ocupados2030.has(c.id_player);
    const ausente = ausentes.has(c.id_player);
    const diag = diagVsFlavio(c.id_player);
    const dupFran = jaDuplaFrancisco(c.id_player);
    linhas.push({ nome:c.name, id:c.id_player, ocupado, ausente, diag, dupFran });
  }
  // ordena: livre+forteOK+naoRepeteDupla primeiro
  linhas.sort((a,b)=> (a.ocupado-b.ocupado) || (a.ausente-b.ausente) || (a.diag-b.diag) || (a.dupFran-b.dupFran) || a.nome.localeCompare(b.nome));
  for (const l of linhas) {
    const status = [];
    if (l.ocupado) status.push('JA JOGA 20:30');
    if (l.ausente) status.push('AUSENTE 09/07');
    status.push(l.diag>0 ? `VIOLA FORTE (diag ${l.diag} vs Flavio)` : 'forte OK');
    status.push(l.dupFran ? 'ja foi dupla c/ Francisco (menor)' : 'nunca dupla c/ Francisco');
    const veredito = (!l.ocupado && !l.ausente && l.diag===0) ? (l.dupFran?'>> ELEGIVEL (repete dupla)':'>>> IDEAL') : '   x';
    console.log(`${veredito}  ${l.nome} (id ${l.id}) | ${status.join(' | ')}`);
  }

  // opcao adiar: rodada cat1 em 16/07?
  const r1607 = rounds.filter(r=>r.scheduled_date==='2026-07-16');
  console.log(`\n=== Rodadas em 16/07 ===`);
  r1607.forEach(r=>console.log(`  round ${r.id_round} cat ${r.id_category}`));
  console.log(`  cat1 (Masc Iniciante) em 16/07? ${r1607.some(r=>r.id_category===CAT)?'SIM':'NAO (precisaria criar rodada)'}`);
  // jogos ja marcados 16/07 cat1 e slots livres
  const n1607 = all.filter(m=>roundOf(m).scheduled_date==='2026-07-16');
  console.log(`  jogos totais 16/07: ${n1607.length}`);
  n1607.sort((a,b)=>String(a.scheduled_at).localeCompare(String(b.scheduled_at))).forEach(m=>{
    console.log(`    ${hhmm(m)} q${m.id_court} cat${roundOf(m).id_category} ${dblById[m.id_double_a].display_name} X ${dblById[m.id_double_b].display_name}`);
  });

  process.exit(0);
})();
