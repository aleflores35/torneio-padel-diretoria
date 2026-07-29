// READ-ONLY parametrizavel: NAMES="elder,hilton" node _jogos_por_nome.js
// Lista TODOS os jogos (jogados + pendentes de placar + futuros) dos atletas cujo nome casa.
const supabase = require('../../supabase');
const TID = 7;
const HOJE = new Date().toISOString().slice(0, 10);
const NAMES = (process.env.NAMES || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

(async () => {
  if (!NAMES.length) { console.error('use NAMES="elder,hilton"'); process.exit(1); }
  const { data: players } = await supabase.from('players').select('*').eq('id_tournament', TID);
  const P = {}; players.forEach(p => P[p.id_player] = p);
  const nm = id => (P[id] ? P[id].name : id);
  const catName = c => c === 1 ? 'Masc Inic' : c === 2 ? 'Masc 4a' : c === 3 ? 'Fem' : 'cat' + c;

  const { data: rounds } = await supabase.from('rounds').select('*').eq('id_tournament', TID);
  const R = {}; rounds.forEach(r => R[r.id_round] = r);
  const { data: dbls } = await supabase.from('doubles').select('id_double,id_round,id_player1,id_player2,display_name').eq('id_tournament', TID);
  const D = {}; dbls.forEach(d => D[d.id_double] = d);
  const dids = dbls.map(d => d.id_double);
  async function mF(f) { let o = []; for (let i = 0; i < dids.length; i += 200) { const { data } = await supabase.from('matches').select('*').in(f, dids.slice(i, i + 200)); o = o.concat(data || []); } return o; }
  const byId = {}; [...await mF('id_double_a'), ...await mF('id_double_b')].forEach(m => byId[m.id_match] = m);
  const all = Object.values(byId);
  const roundOf = m => R[(D[m.id_double_a] || {}).id_round] || R[(D[m.id_double_b] || {}).id_round] || {};
  const dateOf = m => roundOf(m).scheduled_date;
  const typeOf = m => (roundOf(m).round_type || 'REGULAR');
  const hhmm = m => String(m.scheduled_at || '').slice(11, 16);
  const playersOf = m => { const a = D[m.id_double_a] || {}, b = D[m.id_double_b] || {}; return [a.id_player1, a.id_player2, b.id_player1, b.id_player2].filter(Boolean); };
  const score = m => (m.score_a != null || m.score_b != null) ? ` ${m.score_a}x${m.score_b}` : '';

  console.log(`HOJE = ${HOJE}\n`);
  for (const needle of NAMES) {
    const hits = players.filter(p => p.name.toLowerCase().includes(needle));
    if (!hits.length) { console.log(`### "${needle}": NENHUM atleta encontrado\n`); continue; }
    for (const p of hits) {
      const PID = p.id_player;
      const js = all.filter(m => playersOf(m).includes(PID) && typeOf(m) !== 'EXHIBITION')
        .sort((a, b) => String(a.scheduled_at || dateOf(a)).localeCompare(String(b.scheduled_at || dateOf(b))));
      const jogados = js.filter(m => ['FINISHED', 'WO'].includes(m.status));
      const pend = js.filter(m => !['FINISHED', 'WO'].includes(m.status) && dateOf(m) <= HOJE);
      const fut = js.filter(m => !['FINISHED', 'WO'].includes(m.status) && dateOf(m) > HOJE);
      console.log(`>>> ${p.name} (id ${PID}, ${catName(p.category_id)}, side ${p.side}, active ${p.active})`);
      console.log(`    jogados ${jogados.length} | PENDENTES de placar ${pend.length} | futuros ${fut.length} | total ${js.length}`);
      const show = (label, arr) => {
        if (!arr.length) return;
        console.log(`  -- ${label}`);
        for (const m of arr) {
          const a = D[m.id_double_a] || {}, b = D[m.id_double_b] || {};
          const dd = (a.id_player1 === PID || a.id_player2 === PID) ? a : b;
          const pid2 = dd.id_player1 === PID ? dd.id_player2 : dd.id_player1;
          console.log(`     #${m.id_match} | ${dateOf(m)} ${hhmm(m)} q${m.id_court} | ${m.status}${score(m)} | c/ ${nm(pid2)} | ${a.display_name} X ${b.display_name}`);
        }
      };
      show('PENDENTES DE PLACAR (data ja passou, sem resultado)', pend);
      show('FUTUROS', fut);
      show('JOGADOS', jogados);
      console.log('');
    }
  }
  process.exit(0);
})();
