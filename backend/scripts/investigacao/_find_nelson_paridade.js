// READ-ONLY: reclamacao do Nelson Paiva (WhatsApp +55 51 9672-6191) 08/07.
// "Estou disponivel e nao sou chamado. Sid tem mais jogos que eu e joga de novo.
//  Pablo tambem tem mais jogos e continua jogando. Nesta semana, de novo, nao jogo."
// Objetivo: contar jogos (jogados que contam ranking + futuros agendados) de TODA a
// Masc 4a e checar paridade Nelson vs Sid(676) vs Pablo(s). Calendario futuro do Nelson.
const supabase = require('../../supabase');
const TID = 7;
const HOJE = '2026-07-08';

const norm = s => String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();

(async () => {
  if (!supabase) { console.error('SEM supabase'); process.exit(1); }

  // categorias
  const { data: cats } = await supabase.from('categories').select('*').eq('id_tournament', TID);
  console.log('=== CATEGORIAS ===');
  (cats||[]).forEach(c => console.log(`  cat ${c.id_category||c.id} : ${c.name||c.description||JSON.stringify(c)}`));

  const { data: players } = await supabase.from('players')
    .select('id_player,name,side,category_id,active').eq('id_tournament', TID);
  const P = {}; players.forEach(p => P[p.id_player] = p);
  const nm = id => (P[id] ? P[id].name : id);

  // achar Nelson, Sid(676), Pablos
  const nelson = players.filter(p => /nelson/.test(norm(p.name)));
  const pablos = players.filter(p => /pablo/.test(norm(p.name)));
  console.log('\n=== ATLETAS-CHAVE ===');
  console.log('Nelson:', nelson.map(p=>`${p.name} (id ${p.id_player}, side ${p.side}, cat ${p.category_id}, active ${p.active})`).join(' | ')||'(nenhum)');
  console.log('Sid(676):', P[676] ? `${P[676].name} (id 676, side ${P[676].side}, cat ${P[676].category_id}, active ${P[676].active})` : '(676 nao existe)');
  console.log('Pablos:', pablos.map(p=>`${p.name} (id ${p.id_player}, side ${p.side}, cat ${p.category_id}, active ${p.active})`).join(' | ')||'(nenhum)');

  const NELSON = nelson[0] && nelson[0].id_player;
  if (!NELSON) { console.error('Nelson nao encontrado'); process.exit(1); }
  const CAT = P[NELSON].category_id;
  console.log(`\n>>> FOCO: Nelson id ${NELSON}, cat ${CAT} <<<\n`);

  // rounds (com round_type e status pra distinguir EXHIBITION)
  const { data: rounds } = await supabase.from('rounds').select('*').eq('id_tournament', TID);
  const R = {}; rounds.forEach(r => R[r.id_round] = r);

  // doubles
  const { data: dbls } = await supabase.from('doubles')
    .select('id_double,id_round,id_player1,id_player2,display_name').eq('id_tournament', TID);
  const D = {}; dbls.forEach(d => D[d.id_double] = d);
  const dids = dbls.map(d => d.id_double);

  // matches em blocos
  async function mForField(field) {
    let out = [];
    for (let i=0;i<dids.length;i+=200) {
      const { data } = await supabase.from('matches').select('*').in(field, dids.slice(i,i+200));
      out = out.concat(data||[]);
    }
    return out;
  }
  const byId = {};
  [...await mForField('id_double_a'), ...await mForField('id_double_b')].forEach(m => byId[m.id_match]=m);
  const all = Object.values(byId);

  const roundOf = m => R[(D[m.id_double_a]||{}).id_round] || R[(D[m.id_double_b]||{}).id_round] || {};
  const dateOf  = m => roundOf(m).scheduled_date;
  const typeOf  = m => (roundOf(m).round_type || 'REGULAR');
  const hhmm    = m => String(m.scheduled_at||'').slice(11,16);
  const playersOf = m => {
    const a=D[m.id_double_a]||{}, b=D[m.id_double_b]||{};
    return [a.id_player1,a.id_player2,b.id_player1,b.id_player2].filter(Boolean);
  };
  const partnerOf = (m, pid) => {
    const a=D[m.id_double_a]||{}, b=D[m.id_double_b]||{};
    const dd = (a.id_player1===pid||a.id_player2===pid) ? a : b;
    return dd.id_player1===pid ? dd.id_player2 : dd.id_player1;
  };

  // jogos de um atleta, classificados
  function jogosDe(pid) {
    const meus = all.filter(m => playersOf(m).includes(pid));
    const reais = meus.filter(m => typeOf(m)!=='EXHIBITION' && ['FINISHED','WO'].includes(m.status));
    const futuros = meus.filter(m => typeOf(m)!=='EXHIBITION' && ['TO_PLAY','CALLING','IN_PROGRESS'].includes(m.status));
    const exhib = meus.filter(m => typeOf(m)==='EXHIBITION');
    return { meus, reais, futuros, exhib };
  }

  // ---- tabela de paridade de TODA a categoria (atletas ativos) ----
  const doCat = players.filter(p => p.category_id===CAT && p.active).sort((a,b)=>a.side-b.side || a.name.localeCompare(b.name));
  console.log(`=== PARIDADE — categoria ${CAT} (${doCat.length} atletas ativos) ===`);
  console.log('nome (id, side) | jogados(ranking) | futuros | TOTAL');
  const rows = [];
  for (const p of doCat) {
    const j = jogosDe(p.id_player);
    rows.push({ p, jog: j.reais.length, fut: j.futuros.length, tot: j.reais.length+j.futuros.length });
  }
  rows.sort((a,b)=> b.tot-a.tot || b.jog-a.jog);
  for (const r of rows) {
    const flag = [NELSON,676].includes(r.p.id_player) || /pablo/.test(norm(r.p.name)) ? '  <===' : '';
    console.log(`  ${r.p.name} (${r.p.id_player}, s${r.p.side}) | jogados ${r.jog} | futuros ${r.fut} | TOTAL ${r.tot}${flag}`);
  }

  // ---- detalhe Nelson vs Sid vs Pablos ----
  const focos = [NELSON, 676, ...pablos.map(p=>p.id_player)].filter((v,i,a)=>a.indexOf(v)===i);
  for (const pid of focos) {
    if (!P[pid]) continue;
    const j = jogosDe(pid);
    console.log(`\n===== ${nm(pid)} (id ${pid}, side ${P[pid].side}, cat ${P[pid].category_id}) =====`);
    console.log(`jogados(ranking) ${j.reais.length} | futuros ${j.futuros.length} | exhibition ${j.exhib.length} | TOTAL real ${j.reais.length+j.futuros.length}`);
    const ord = [...j.reais, ...j.futuros].sort((a,b)=>String(a.scheduled_at||dateOf(a)).localeCompare(String(b.scheduled_at||dateOf(b))));
    for (const m of ord) {
      const fut = ['TO_PLAY','CALLING','IN_PROGRESS'].includes(m.status);
      const tag = dateOf(m) > HOJE ? ' [FUTURO]' : '';
      console.log(`  #${m.id_match} | ${dateOf(m)} ${hhmm(m)} | q${m.id_court} | ${m.status}${typeOf(m)==='EXHIBITION'?' (AMISTOSO)':''} | c/ ${nm(partnerOf(m,pid))} | ${(D[m.id_double_a]||{}).display_name} X ${(D[m.id_double_b]||{}).display_name}${tag}`);
    }
    // ausencias
    const { data: abs } = await supabase.from('player_absences').select('*').eq('id_tournament', TID).eq('id_player', pid);
    console.log(`  ausencias: ${(abs||[]).map(a=>a.absence_date).join(', ')||'(nenhuma)'}`);
  }

  // ---- calendario futuro Masc 4a (o que ainda falta jogar, por data) ----
  console.log(`\n=== CALENDARIO FUTURO cat ${CAT} (TO_PLAY, ${HOJE}+) ===`);
  const futCat = all.filter(m => (roundOf(m).id_category===CAT) && ['TO_PLAY','CALLING'].includes(m.status) && dateOf(m) >= HOJE)
    .sort((a,b)=>String(a.scheduled_at||'').localeCompare(String(b.scheduled_at||'')));
  let curDate='';
  for (const m of futCat) {
    if (dateOf(m)!==curDate) { curDate=dateOf(m); console.log(`  --- ${curDate} ---`); }
    const tem = playersOf(m).includes(NELSON) ? '  <== NELSON' : '';
    console.log(`    #${m.id_match} ${hhmm(m)} q${m.id_court} | ${(D[m.id_double_a]||{}).display_name} X ${(D[m.id_double_b]||{}).display_name}${tem}`);
  }

  process.exit(0);
})();
