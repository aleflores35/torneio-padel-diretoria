// READ-ONLY: proposta de ANTECIPAR ao máximo os jogos futuros do Bernardo Goulart (654).
// Move o jogo inteiro (4 atletas) pra a noite mais cedo possível, sem colisão de
// horário p/ nenhum dos 4, respeitando quadra livre + ausências + rodada da categoria.
// Nada é gravado.
const supabase = require('../../supabase');
const T = 7, BID = 654, CAT = 1;
const ALISSON = 670; // saiu do ranking — jogos com ele não podem ser agendados
const MIN_DATE = process.env.MIN_DATE || '2026-07-09'; // piso de data (09/07 fica intocada → usar 2026-07-16)
const MAX_PER_NIGHT = parseInt(process.env.MAX_PER_NIGHT || '1', 10); // jogos do Bernardo por noite

(async () => {
  const { data: players } = await supabase.from('players').select('id_player,name,side,category_id,active').eq('id_tournament', T);
  const nm = {}; players.forEach(p => nm[p.id_player]=p.name);

  const { data: rounds } = await supabase.from('rounds').select('id_round,scheduled_date,id_category,status,round_type').eq('id_tournament', T);
  const rd = {}; rounds.forEach(r => rd[r.id_round]=r);

  const { data: dbls } = await supabase.from('doubles').select('id_double,id_round,id_player1,id_player2,display_name').eq('id_tournament', T);
  const dm = {}; dbls.forEach(d => dm[d.id_double]=d);
  const dids = dbls.map(d=>d.id_double);

  async function fetchM(field){ let out=[]; for(let i=0;i<dids.length;i+=200){ const {data}=await supabase.from('matches').select('*').in(field, dids.slice(i,i+200)); out=out.concat(data||[]);} return out; }
  const byId={}; [...await fetchM('id_double_a'), ...await fetchM('id_double_b')].forEach(m=>byId[m.id_match]=m);
  const all = Object.values(byId);

  const roundOf = m => rd[(dm[m.id_double_a]||{}).id_round] || rd[(dm[m.id_double_b]||{}).id_round] || {};
  const dateOf = m => roundOf(m).scheduled_date;
  const hhmm = m => String(m.scheduled_at||'').slice(11,16);
  const fourOf = m => { const a=dm[m.id_double_a], b=dm[m.id_double_b]; return [a.id_player1,a.id_player2,b.id_player1,b.id_player2].filter(Boolean); };

  const future = all.filter(m => (m.status==='TO_PLAY'||m.status==='CALLING') && dateOf(m));

  const { data: abs } = await supabase.from('player_absences').select('*').eq('id_tournament', T);
  const absSet = new Set((abs||[]).map(a => `${a.id_player}|${a.absence_date}`));

  // --- occupancy global (todas as categorias compartilham 2 quadras/noite) ---
  const courtBusy = {};   // `${date}|${slot}` -> Set(courts)
  const playerBusy = {};  // `${date}|${slot}` -> Set(players)
  const slotsByDate = {}; // date -> Set(slot)
  const catRoundByDate = {}; // date -> id_round da rodada cat 1 (hospeda jogo da Iniciante)
  for (const m of future) {
    const d = dateOf(m), s = hhmm(m); if (!d||!s) continue;
    (courtBusy[`${d}|${s}`] = courtBusy[`${d}|${s}`]||new Set()).add(m.id_court);
    const pb = playerBusy[`${d}|${s}`] = playerBusy[`${d}|${s}`]||new Set();
    fourOf(m).forEach(p=>pb.add(p));
    (slotsByDate[d] = slotsByDate[d]||new Set()).add(s);
  }
  rounds.filter(r=>r.id_category===CAT && (r.status!=='FINISHED') && r.round_type!=='EXHIBITION').forEach(r=>{ if(!catRoundByDate[r.scheduled_date]) catRoundByDate[r.scheduled_date]=r.id_round; });

  const COURTS = [16,17];
  const SLOTS = ['18:30','19:10','19:50','20:30','21:10','21:50'];
  const datesAsc = [...new Set(future.map(dateOf))].filter(Boolean).sort();
  // só datas que têm rodada da Iniciante pra hospedar E de hoje em diante
  const hostDates = datesAsc.filter(d => catRoundByDate[d] && d >= MIN_DATE);

  // jogos futuros do Bernardo, em ordem atual
  const bGames = future.filter(m => fourOf(m).includes(BID))
    .sort((a,b)=>String(dateOf(a)+hhmm(a)).localeCompare(String(dateOf(b)+hhmm(b))));

  console.log(`\nDatas-quinta com rodada Iniciante (hospedam jogo): ${hostDates.join(', ')}`);
  console.log(`\nJogos futuros do Bernardo (${bGames.length}) — ordem atual:`);
  bGames.forEach(m => console.log(`  #${m.id_match} ${dateOf(m)} ${hhmm(m)} q${m.id_court} | ${dm[m.id_double_a].display_name} × ${dm[m.id_double_b].display_name}`));

  // --- greedy: antecipa cada jogo pra o (date,slot,court) mais cedo viável ---
  // trabalhamos numa cópia da ocupação, liberando o slot atual do jogo antes de reencaixar
  const rel = (m) => { const d=dateOf(m), s=hhmm(m); courtBusy[`${d}|${s}`]?.delete(m.id_court); fourOf(m).forEach(p=>playerBusy[`${d}|${s}`]?.delete(p)); };
  const occupy = (d,s,court,four) => { (courtBusy[`${d}|${s}`]=courtBusy[`${d}|${s}`]||new Set()).add(court); const pb=playerBusy[`${d}|${s}`]=playerBusy[`${d}|${s}`]||new Set(); four.forEach(p=>pb.add(p)); };

  console.log(`\n=== PROPOSTA (antecipar ao máximo · ${MAX_PER_NIGHT} jogo(s)/noite p/ Bernardo) ===`);
  const plan = [];
  const bNights = {}; // date -> quantos jogos do Bernardo já nessa noite
  for (const m of bGames) {
    const four = fourOf(m);
    if (four.includes(ALISSON)) {
      console.log(`  #${m.id_match} ${dateOf(m)} ${hhmm(m)} → ⛔ BLOQUEADO (tem ${nm[ALISSON]}, que saiu do ranking). Precisa substituto ou anular. Não antecipável como está.`);
      continue;
    }
    rel(m); // libera slot atual
    let placed = null;
    for (const d of hostDates) {
      if ((bNights[d]||0) >= MAX_PER_NIGHT) continue;        // Bernardo já lotou a noite
      if (four.some(p => absSet.has(`${p}|${d}`))) continue; // alguém ausente nessa data
      for (const s of SLOTS) {
        const pb = playerBusy[`${d}|${s}`] || new Set();
        if (four.some(p => pb.has(p))) continue;           // colisão de horário p/ um dos 4
        const cb = courtBusy[`${d}|${s}`] || new Set();
        const court = COURTS.find(c => !cb.has(c));
        if (!court) continue;                              // sem quadra livre nesse slot
        placed = { d, s, court }; break;
      }
      if (placed) break;
    }
    if (placed) {
      occupy(placed.d, placed.s, placed.court, four);
      bNights[placed.d] = (bNights[placed.d]||0) + 1;
      const same = placed.d===dateOf(m) && placed.s===hhmm(m);
      plan.push({ m, ...placed });
      console.log(`  #${m.id_match} ${dm[m.id_double_a].display_name} × ${dm[m.id_double_b].display_name}`);
      console.log(`     de ${dateOf(m)} ${hhmm(m)} q${m.id_court}  →  ${placed.d} ${placed.s} q${placed.court} ${same?'(sem mudança)':'✅ ANTECIPADO'}`);
    } else {
      occupy(dateOf(m), hhmm(m), m.id_court, four); // re-ocupa original
      console.log(`  #${m.id_match} → ⚠️ sem encaixe mais cedo viável; mantém ${dateOf(m)} ${hhmm(m)}`);
    }
  }

  console.log(`\n=== Resumo Bernardo (proposta) ===`);
  plan.sort((a,b)=>String(a.d+a.s).localeCompare(b.d+b.s)).forEach(p =>
    console.log(`  ${p.d} ${p.s} q${p.court} | ${dm[p.m.id_double_a].display_name} × ${dm[p.m.id_double_b].display_name}`));
  process.exit(0);
})();
