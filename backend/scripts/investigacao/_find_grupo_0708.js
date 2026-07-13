// READ-ONLY: 3 mensagens do grupo 08/07.
// (A) "Gerente de Negocios": 2a semana sem jogo, sem impedimento, a disposicao -> QUEM E?
// (B) Paola Brendler (51 9930-2992): quer impedimento essa semana -> tem jogo 09/07?
// (C) Kako MTM (55 9952-1914): ve 2 jogos marcados mas nao aparecem na pagina inicial -> quais?
const supabase = require('../../supabase');
const TID = 7;
const HOJE = '2026-07-08';
const norm = s => String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
const digits = s => String(s||'').replace(/\D/g,'');

(async () => {
  if (!supabase) { console.error('SEM supabase'); process.exit(1); }

  // schema players (todas colunas de 1 registro)
  const { data: sample } = await supabase.from('players').select('*').eq('id_tournament', TID).limit(1);
  console.log('=== COLUNAS players ===', Object.keys(sample[0]||{}).join(', '));

  const { data: players } = await supabase.from('players').select('*').eq('id_tournament', TID);
  const P = {}; players.forEach(p => P[p.id_player]=p);
  const nm = id => (P[id]?P[id].name:id);
  // achar campo de telefone
  const phoneKey = Object.keys(sample[0]||{}).find(k => /phone|tel|whats|cel|contato/i.test(k));
  console.log('campo telefone detectado:', phoneKey||'(nenhum)');

  const { data: rounds } = await supabase.from('rounds').select('*').eq('id_tournament', TID);
  const R = {}; rounds.forEach(r => R[r.id_round]=r);
  const { data: dbls } = await supabase.from('doubles').select('id_double,id_round,id_player1,id_player2,display_name').eq('id_tournament', TID);
  const D = {}; dbls.forEach(d => D[d.id_double]=d);
  const dids = dbls.map(d=>d.id_double);
  async function mF(f){ let o=[]; for(let i=0;i<dids.length;i+=200){ const {data}=await supabase.from('matches').select('*').in(f,dids.slice(i,i+200)); o=o.concat(data||[]);} return o; }
  const byId={}; [...await mF('id_double_a'),...await mF('id_double_b')].forEach(m=>byId[m.id_match]=m);
  const all=Object.values(byId);
  const roundOf=m=>R[(D[m.id_double_a]||{}).id_round]||R[(D[m.id_double_b]||{}).id_round]||{};
  const dateOf=m=>roundOf(m).scheduled_date;
  const typeOf=m=>(roundOf(m).round_type||'REGULAR');
  const catOf=m=>roundOf(m).id_category;
  const hhmm=m=>String(m.scheduled_at||'').slice(11,16);
  const playersOf=m=>{const a=D[m.id_double_a]||{},b=D[m.id_double_b]||{};return [a.id_player1,a.id_player2,b.id_player1,b.id_player2].filter(Boolean);};

  // quintas (datas distintas de rounds)
  const quintas=[...new Set(rounds.map(r=>r.scheduled_date).filter(Boolean))].sort();
  console.log('\n=== QUINTAS no torneio ===', quintas.join(' | '));

  // ausencias
  const { data: absAll } = await supabase.from('player_absences').select('*').eq('id_tournament', TID);
  const absByPlayer={}; (absAll||[]).forEach(a=>{(absByPlayer[a.id_player]=absByPlayer[a.id_player]||[]).push(a.absence_date);});

  function jogosDe(pid){
    const meus=all.filter(m=>playersOf(m).includes(pid) && typeOf(m)!=='EXHIBITION');
    return meus.sort((a,b)=>String(a.scheduled_at||dateOf(a)).localeCompare(String(b.scheduled_at||dateOf(b))));
  }
  function catName(c){ return c===1?'Masc Inic':c===2?'Masc 4a':c===3?'Fem':'cat'+c; }

  // ================= (A) GAP: quem esta ha mais tempo sem jogo =================
  console.log('\n\n========== (A) ATLETAS ATIVOS — ultimo jogo x proximo (gap de semanas) ==========');
  const jogaveis = quintas.filter(q=>q<=HOJE); // quintas ja realizadas/vigentes
  const rows=[];
  for (const p of players.filter(x=>x.active)) {
    const js=jogosDe(p.id_player);
    const jogados=js.filter(m=>['FINISHED','WO'].includes(m.status));
    const futuros=js.filter(m=>['TO_PLAY','CALLING','IN_PROGRESS'].includes(m.status));
    const ultimo=jogados.length?dateOf(jogados[jogados.length-1]):null;
    const prox=futuros.length?dateOf(futuros[0]):null;
    // quintas passadas (<=hoje, apos o ultimo jogo) em que NAO jogou e NAO tinha impedimento
    const abs=absByPlayer[p.id_player]||[];
    const semJogoRecente = quintas.filter(q=> q>(ultimo||'0000') && q<='2026-07-09' && !abs.includes(q));
    rows.push({p, jogados:jogados.length, futuros:futuros.length, ultimo, prox, gap:semJogoRecente, abs});
  }
  // ordena por maior gap (mais semanas seguidas sem jogo ate 09/07)
  rows.sort((a,b)=> b.gap.length-a.gap.length || String(a.ultimo).localeCompare(String(b.ultimo)));
  for (const r of rows.slice(0,14)) {
    console.log(`  ${r.p.name} (${r.p.id_player}, ${catName(r.p.category_id)}, s${r.p.side}) | ult ${r.ultimo||'-'} | prox ${r.prox||'-'} | sem jogo em: [${r.gap.join(', ')||'-'}] | abs:[${r.abs.join(',')||'-'}]${phoneKey?' | tel '+(r.p[phoneKey]||''):''}`);
  }

  // ================= (B) e (C) por telefone =================
  function acha(fragTel, fragNome){
    const fd=digits(fragTel);
    let hits=players.filter(p=> phoneKey && digits(p[phoneKey]).includes(fd));
    if(!hits.length && fragNome) hits=players.filter(p=>norm(p.name).includes(norm(fragNome)));
    return hits;
  }
  function detalha(pid){
    const p=P[pid]; if(!p){console.log('  (id',pid,'inexistente)');return;}
    console.log(`\n  >>> ${p.name} (id ${pid}, ${catName(p.category_id)}, s${p.side}, active ${p.active})${phoneKey?' tel '+(p[phoneKey]||''):''}`);
    console.log('  ausencias:', (absByPlayer[pid]||[]).join(', ')||'(nenhuma)');
    const js=jogosDe(pid);
    for(const m of js){
      const parc=(()=>{const a=D[m.id_double_a]||{},b=D[m.id_double_b]||{};const dd=(a.id_player1===pid||a.id_player2===pid)?a:b;return dd.id_player1===pid?dd.id_player2:dd.id_player1;})();
      const tag=dateOf(m)>HOJE?' [FUTURO]':'';
      console.log(`    #${m.id_match} | ${dateOf(m)} ${hhmm(m)} q${m.id_court} | ${m.status}${typeOf(m)==='EXHIBITION'?' AMISTOSO':''} | c/ ${nm(parc)} | ${(D[m.id_double_a]||{}).display_name} X ${(D[m.id_double_b]||{}).display_name}${tag}`);
    }
  }

  console.log('\n\n========== (B) PAOLA BRENDLER — 51 9930-2992 (impedimento essa semana?) ==========');
  acha('99302992','paola').forEach(p=>detalha(p.id_player));

  console.log('\n\n========== (C) KAKO MTM — 55 9952-1914 (2 jogos que nao aparecem) ==========');
  let kako=acha('99521914','kako');
  if(!kako.length){ console.log('  telefone/nome nao casou; tentando apelidos comuns (ricardo/carlos/ricky)...');
    kako=players.filter(p=>/ricardo|carlos|ricky|caco|kako/.test(norm(p.name))); }
  kako.forEach(p=>detalha(p.id_player));

  process.exit(0);
})();
