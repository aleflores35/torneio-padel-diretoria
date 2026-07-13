// READ-ONLY: acha slots candidatos pra REMARCAR o #1408 do Deivit (impedimento saúde 16/07).
// Deivit volta sáb 18/07 -> só datas depois disso. Slot valido = quadra livre + os 4 jogadores livres no horario.
const supabase = require('../../supabase');
const T = 7, CAT = 1, MATCH = 1408, MOVE_AFTER = '2026-07-18';
const SLOTS = ['18:00','18:30','19:10','19:50','20:30','21:10','21:50'];
const COURTS = [16, 17];

(async () => {
  const { data: players } = await supabase.from('players').select('*').eq('id_tournament', T);
  const P = {}; players.forEach(p => P[p.id_player] = p); const nm = id => P[id] ? P[id].name : id;
  const { data: rounds } = await supabase.from('rounds').select('*').eq('id_tournament', T);
  const R = {}; rounds.forEach(r => R[r.id_round] = r);
  const { data: dbls } = await supabase.from('doubles').select('*').eq('id_tournament', T);
  const D = {}; dbls.forEach(d => D[d.id_double] = d);
  const dids = dbls.map(d => d.id_double);
  let ms = [];
  for (let i = 0; i < dids.length; i += 200) {
    const { data: a } = await supabase.from('matches').select('*').in('id_double_a', dids.slice(i, i+200));
    const { data: b } = await supabase.from('matches').select('*').in('id_double_b', dids.slice(i, i+200));
    ms = ms.concat(a||[], b||[]);
  }
  const M = {}; ms.forEach(m => M[m.id_match] = m); const all = Object.values(M);
  const roundOfD = d => R[(d||{}).id_round] || {};
  const dateOf = m => (roundOfD(D[m.id_double_a]) || roundOfD(D[m.id_double_b]) || {}).scheduled_date;
  const roundIdOf = m => (D[m.id_double_a]||{}).id_round;
  const hhmm = m => String(m.scheduled_at||'').slice(11,16);
  const playersOf = m => { const a=D[m.id_double_a]||{}, b=D[m.id_double_b]||{}; return [a.id_player1,a.id_player2,b.id_player1,b.id_player2].filter(Boolean); };

  const target = playersOf(M[MATCH]);
  console.log(`#${MATCH} (${dateOf(M[MATCH])} ${hhmm(M[MATCH])} q${M[MATCH].id_court}) jogadores: ${target.map(nm).join(' · ')}`);

  // agenda futura de cada um dos 4
  console.log('\n=== agenda futura dos 4 (fora o #1408) ===');
  for (const id of target) {
    const js = all.filter(m => m.id_match!==MATCH && playersOf(m).includes(id) && ['TO_PLAY','CALLING','IN_PROGRESS'].includes(m.status))
      .sort((a,b)=>String(a.scheduled_at).localeCompare(String(b.scheduled_at)));
    console.log(`  ${nm(id).padEnd(20)}: ${js.map(m=>`${dateOf(m)} ${hhmm(m)}`).join(' | ')||'(livre)'}`);
  }

  // busy = date|time por jogador (só futuros contam p/ colisao)
  const busy = {}; target.forEach(id => busy[id] = new Set());
  all.filter(m=>['TO_PLAY','CALLING','IN_PROGRESS'].includes(m.status)).forEach(m => {
    const dt = dateOf(m); if(!dt) return; const k = `${dt}|${hhmm(m)}`;
    playersOf(m).forEach(id => { if (busy[id]) busy[id].add(k); });
  });

  const futRounds = rounds.filter(r => r.id_category===CAT && r.round_type!=='EXHIBITION' && r.scheduled_date > MOVE_AFTER)
    .sort((a,b)=>a.scheduled_date.localeCompare(b.scheduled_date));

  console.log('\n=== SLOTS CANDIDATOS (quadra livre + os 4 livres no horario) ===');
  for (const r of futRounds) {
    const rmatches = all.filter(m => roundIdOf(m)===r.id_round);
    const occ = {}; rmatches.forEach(m => occ[`${hhmm(m)}|${m.id_court}`]=m.id_match);
    const deivitN = rmatches.filter(m=>playersOf(m).includes(650)).length;
    const cand = [];
    for (const s of SLOTS) for (const c of COURTS) {
      if (occ[`${s}|${c}`]) continue;
      const conf = target.filter(id => busy[id].has(`${r.scheduled_date}|${s}`)).map(nm);
      if (conf.length) continue;
      cand.push(`${s} q${c}`);
    }
    if (cand.length) console.log(`  ${r.scheduled_date} (round ${r.id_round}, Deivit já tem ${deivitN}): ${cand.join(' · ')}`);
  }
  process.exit(0);
})();
