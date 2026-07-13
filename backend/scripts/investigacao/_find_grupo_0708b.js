// READ-ONLY parte 2.
// (A) Lista de ativos que NAO jogam 02/07 NEM 09/07 e SEM impedimento nessas datas (candidatos "Gerente de Negocios").
// (B) Paola (692, Fem RIGHT): com quais LEFTS ativas do Feminino ela ainda NAO jogou (buraco round-robin?).
const supabase = require('../../supabase');
const TID = 7;
const S1='2026-07-02', S2='2026-07-09';

(async () => {
  const { data: players } = await supabase.from('players').select('*').eq('id_tournament', TID);
  const P={}; players.forEach(p=>P[p.id_player]=p);
  const nm=id=>(P[id]?P[id].name:id);
  const catName=c=>c===1?'Masc Inic':c===2?'Masc 4a':c===3?'Fem':'cat'+c;

  const { data: rounds } = await supabase.from('rounds').select('*').eq('id_tournament', TID);
  const R={}; rounds.forEach(r=>R[r.id_round]=r);
  const { data: dbls } = await supabase.from('doubles').select('id_double,id_round,id_player1,id_player2').eq('id_tournament', TID);
  const D={}; dbls.forEach(d=>D[d.id_double]=d);
  const dids=dbls.map(d=>d.id_double);
  async function mF(f){let o=[];for(let i=0;i<dids.length;i+=200){const {data}=await supabase.from('matches').select('*').in(f,dids.slice(i,i+200));o=o.concat(data||[]);}return o;}
  const byId={}; [...await mF('id_double_a'),...await mF('id_double_b')].forEach(m=>byId[m.id_match]=m);
  const all=Object.values(byId);
  const roundOf=m=>R[(D[m.id_double_a]||{}).id_round]||R[(D[m.id_double_b]||{}).id_round]||{};
  const dateOf=m=>roundOf(m).scheduled_date;
  const typeOf=m=>(roundOf(m).round_type||'REGULAR');
  const playersOf=m=>{const a=D[m.id_double_a]||{},b=D[m.id_double_b]||{};return [a.id_player1,a.id_player2,b.id_player1,b.id_player2].filter(Boolean);};

  const { data: absAll } = await supabase.from('player_absences').select('*').eq('id_tournament', TID);
  const absBy={}; (absAll||[]).forEach(a=>{(absBy[a.id_player]=absBy[a.id_player]||new Set()).add(a.absence_date);});

  function jogosDe(pid){return all.filter(m=>playersOf(m).includes(pid)&&typeOf(m)!=='EXHIBITION').sort((a,b)=>String(a.scheduled_at||dateOf(a)).localeCompare(String(b.scheduled_at||dateOf(b))));}
  function jogaEm(pid,data){return all.some(m=>dateOf(m)===data&&typeOf(m)!=='EXHIBITION'&&playersOf(m).includes(pid));}

  console.log('=== (A) ATIVOS SEM JOGO em 02/07 E 09/07, e SEM impedimento nessas 2 datas ===');
  console.log('(candidatos a "2a semana sem jogo, a disposicao")\n');
  const cand=[];
  for(const p of players.filter(x=>x.active)){
    if(jogaEm(p.id_player,S1)||jogaEm(p.id_player,S2)) continue;
    const abs=absBy[p.id_player]||new Set();
    if(abs.has(S1)||abs.has(S2)) continue; // colocou impedimento -> nao reclama "a disposicao"
    const js=jogosDe(p.id_player);
    const jogados=js.filter(m=>['FINISHED','WO'].includes(m.status));
    const fut=js.filter(m=>['TO_PLAY','CALLING','IN_PROGRESS'].includes(m.status));
    const ult=jogados.length?dateOf(jogados[jogados.length-1]):'-';
    const prox=fut.length?dateOf(fut[0]):'-';
    cand.push({p,ult,prox,tot:jogados.length+fut.length});
  }
  cand.sort((a,b)=>String(a.prox).localeCompare(String(b.prox))||String(a.ult).localeCompare(String(b.ult)));
  for(const c of cand){
    console.log(`  ${c.p.name} (${c.p.id_player}, ${catName(c.p.category_id)}, s${c.p.side}) | ult ${c.ult} | PROX ${c.prox} | total ${c.tot} | wpp ${c.p.whatsapp||'-'}`);
  }

  console.log('\n\n=== (B) PAOLA (692, Fem RIGHT) — round-robin ===');
  const femLefts=players.filter(p=>p.category_id===3&&p.side==='LEFT'&&p.active);
  const femRights=players.filter(p=>p.category_id===3&&p.side==='RIGHT'&&p.active);
  console.log(`Feminino ativos: ${femRights.length} RIGHT x ${femLefts.length} LEFT`);
  const paolaJogos=jogosDe(692);
  const parceiras=new Set();
  paolaJogos.forEach(m=>{const a=D[m.id_double_a]||{},b=D[m.id_double_b]||{};const dd=(a.id_player1===692||a.id_player2===692)?a:b;parceiras.add(dd.id_player1===692?dd.id_player2:dd.id_player1);});
  console.log(`Paola jogou ${paolaJogos.length} jogos, com ${parceiras.size} parceiras distintas:`, [...parceiras].map(nm).join(', '));
  const faltam=femLefts.filter(l=>!parceiras.has(l.id_player));
  console.log(`LEFTS ativas com quem a Paola AINDA NAO jogou (${faltam.length}):`, faltam.map(l=>`${l.name}(${l.id_player})`).join(', ')||'(nenhuma — round-robin completo)');
  console.log('Paola tem jogo futuro agendado?', paolaJogos.some(m=>['TO_PLAY','CALLING','IN_PROGRESS'].includes(m.status))?'SIM':'NAO');

  process.exit(0);
})();
