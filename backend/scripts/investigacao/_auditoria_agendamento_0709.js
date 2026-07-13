// READ-ONLY: varredura de TODAS as necessidades de agendamento na grade futura.
// Detecta: (1) jogador INATIVO escalado, (2) impedido (ausencia) escalado na data,
// (3) colisao de mesmo horario, (4) jogo TO_PLAY atrasado (data < hoje),
// (5) afastados = ativos com ausencia cobrindo varias datas futuras.
const supabase = require('../../supabase');
const TID = 7;
const HOJE = '2026-07-09';

(async () => {
  const { data: players } = await supabase.from('players').select('*').eq('id_tournament', TID);
  const P = {}; players.forEach(p => P[p.id_player] = p);
  const nm = id => (P[id] ? P[id].name : '?'+id);
  const catName = c => c===1?'Inic':c===2?'4a':c===3?'Fem':'c'+c;

  const { data: rounds } = await supabase.from('rounds').select('*').eq('id_tournament', TID);
  const R = {}; rounds.forEach(r => R[r.id_round] = r);
  const { data: dbls } = await supabase.from('doubles').select('id_double,id_round,id_player1,id_player2,display_name').eq('id_tournament', TID);
  const D = {}; dbls.forEach(d => D[d.id_double] = d);
  const dids = dbls.map(d => d.id_double);
  async function mF(f){let o=[];for(let i=0;i<dids.length;i+=200){const{data}=await supabase.from('matches').select('*').in(f,dids.slice(i,i+200));o=o.concat(data||[]);}return o;}
  const byId = {}; [...await mF('id_double_a'), ...await mF('id_double_b')].forEach(m => byId[m.id_match]=m);
  const all = Object.values(byId);
  const roundOf = m => R[(D[m.id_double_a]||{}).id_round] || R[(D[m.id_double_b]||{}).id_round] || {};
  const dateOf = m => roundOf(m).scheduled_date;
  const catOf = m => roundOf(m).id_category;
  const typeOf = m => (roundOf(m).round_type||'REGULAR');
  const atOf = m => String(m.scheduled_at||'');
  const hhmm = m => atOf(m).slice(11,16);
  const playersOf = m => { const a=D[m.id_double_a]||{}, b=D[m.id_double_b]||{}; return [a.id_player1,a.id_player2,b.id_player1,b.id_player2].filter(Boolean); };
  const desc = m => `#${m.id_match} ${dateOf(m)} ${hhmm(m)} q${m.id_court} ${catName(catOf(m))} | ${(D[m.id_double_a]||{}).display_name} X ${(D[m.id_double_b]||{}).display_name}`;

  const { data: absAll } = await supabase.from('player_absences').select('*').eq('id_tournament', TID);
  const absByPlayer = {}; (absAll||[]).forEach(a => (absByPlayer[a.id_player]=absByPlayer[a.id_player]||new Set()).add(a.absence_date));

  const futuros = all.filter(m => typeOf(m)!=='EXHIBITION' && ['TO_PLAY','CALLING','IN_PROGRESS'].includes(m.status));
  const futAgendaveis = futuros.filter(m => dateOf(m) >= HOJE);
  const atrasados = futuros.filter(m => dateOf(m) < HOJE);

  console.log(`Grade: ${all.length} matches | futuros(nao jogados) ${futuros.length} | agendaveis(>=hoje) ${futAgendaveis.length} | atrasados(<hoje) ${atrasados.length}\n`);

  console.log('=== (1) JOGADOR INATIVO escalado em jogo futuro ===');
  let n1=0;
  for (const m of futAgendaveis) for (const pid of playersOf(m)) if (P[pid] && P[pid].active===false) { console.log(`  ${nm(pid)}(${pid}) INATIVO em ${desc(m)}`); n1++; }
  if(!n1) console.log('  nenhum');

  console.log('\n=== (2) IMPEDIDO (ausencia) escalado na propria data ===');
  let n2=0;
  for (const m of futAgendaveis) for (const pid of playersOf(m)) if (absByPlayer[pid] && absByPlayer[pid].has(dateOf(m))) { console.log(`  ${nm(pid)}(${pid}) tem ausencia em ${dateOf(m)} mas escalado: ${desc(m)}`); n2++; }
  if(!n2) console.log('  nenhum');

  console.log('\n=== (3) COLISAO de mesmo horario (jogador em 2 jogos no mesmo scheduled_at) ===');
  const byPlayerSlot = {}; let n3=0;
  for (const m of futAgendaveis) for (const pid of playersOf(m)) { const k=pid+'@'+atOf(m); (byPlayerSlot[k]=byPlayerSlot[k]||[]).push(m); }
  for (const k in byPlayerSlot) if (byPlayerSlot[k].length>1) { const pid=k.split('@')[0]; console.log(`  ${nm(+pid)}(${pid}) @ ${k.split('@')[1]}: ${byPlayerSlot[k].map(m=>'#'+m.id_match).join(' + ')}`); n3++; }
  if(!n3) console.log('  nenhuma');

  console.log('\n=== (4) TO_PLAY ATRASADO (data < hoje, placar pendente) ===');
  if(!atrasados.length) console.log('  nenhum');
  atrasados.sort((a,b)=>String(dateOf(a)).localeCompare(String(dateOf(b)))).forEach(m => console.log(`  ${desc(m)} [${m.status}]`));

  console.log('\n=== (5) AFASTADOS provaveis (ativo, ausencia >=2 datas futuras OU cobrindo hoje+) ===');
  let n5=0;
  for (const p of players) {
    if (!p.active) continue;
    const fut = [...(absByPlayer[p.id_player]||[])].filter(d => d >= HOJE).sort();
    if (fut.length >= 2) { console.log(`  ${p.name}(${p.id_player}, ${catName(p.category_id)}): ausencias futuras ${fut.join(', ')}`); n5++; }
  }
  if(!n5) console.log('  nenhum com >=2 ausencias futuras registradas');

  console.log('\n=== (6) JOGOS por atleta ATIVO com futuros (visao geral quem tem jogo a jogar) ===');
  const futByPlayer = {};
  for (const m of futAgendaveis) for (const pid of playersOf(m)) futByPlayer[pid]=(futByPlayer[pid]||0)+1;
  const arr = Object.entries(futByPlayer).map(([pid,n])=>({pid:+pid,n})).filter(x=>P[x.pid]).sort((a,b)=>b.n-a.n);
  console.log('  (top 12 com mais jogos futuros)');
  arr.slice(0,12).forEach(x => console.log(`   ${nm(x.pid)}(${x.pid}, ${catName(P[x.pid].category_id)}) ${P[x.pid].active?'':'[INATIVO]'} : ${x.n} futuros`));

  process.exit(0);
})();
