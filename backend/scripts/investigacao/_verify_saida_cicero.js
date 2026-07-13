// READ-ONLY: verificação pós-saída do Cicero (661).
const supabase = require('../../supabase');
const axios = require('axios');
const T = 7, CAT = 1, CICERO = 661;
const BASE = 'https://ranking-padel-srb-2026.vercel.app';

(async () => {
  const { data: p } = await supabase.from('players').select('*').eq('id_player', CICERO).single();
  console.log(`Cicero (661): active=${p.active}`);

  const { data: dbls } = await supabase.from('doubles').select('*').eq('id_tournament', T)
    .or(`id_player1.eq.${CICERO},id_player2.eq.${CICERO}`);
  const dids = dbls.map(d => d.id_double);
  let ms = [];
  for (let i = 0; i < dids.length; i += 200) {
    const { data: a } = await supabase.from('matches').select('*').in('id_double_a', dids.slice(i, i+200));
    const { data: b } = await supabase.from('matches').select('*').in('id_double_b', dids.slice(i, i+200));
    ms = ms.concat(a||[], b||[]);
  }
  const uniq = {}; ms.forEach(m => uniq[m.id_match] = m);
  const fut = Object.values(uniq).filter(m => ['TO_PLAY','CALLING','IN_PROGRESS'].includes(m.status));
  const jog = Object.values(uniq).filter(m => ['FINISHED','WO'].includes(m.status));
  console.log(`  jogos do Cicero no banco: ${jog.length} jogados | ${fut.length} futuros (esperado futuros=0)`);

  const { data: rk } = await axios.get(`${BASE}/api/tournaments/${T}/ranking/${CAT}`);
  const rows = Array.isArray(rk) ? rk : (rk.ranking || rk.data || []);
  const temCicero = rows.some(r => (r.id_player||r.playerId||r.id) === CICERO);
  console.log(`  ranking Iniciante (live): ${rows.length} atletas | Cicero presente? ${temCicero ? 'SIM ⚠' : 'NAO ✅'}`);
  console.log('  top 5:', rows.slice(0,5).map(r=>`${r.name}(${r.points})`).join(' · '));
  process.exit(0);
})();
