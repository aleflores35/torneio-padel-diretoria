// READ-ONLY: node _sim_vitoria_direta_cicero.js
// Simula "vitoria direta (+3) pra todos os jogos futuros do Cicero" (parceiro + adversarios),
// projetando sobre o ranking REAL de producao (cat 1 Iniciante). Nada e' gravado.
const supabase = require('../../supabase');
const axios = require('axios');
const TID = 7;
const CAT = 1;
const CICERO = 661;
const FUT = [1446, 1423, 1430, 1439]; // jogos futuros do Cicero
const BASE = 'https://ranking-padel-srb-2026.vercel.app';

(async () => {
  // 1) players (nomes)
  const { data: players } = await supabase.from('players').select('*').eq('id_tournament', TID);
  const P = {}; players.forEach(p => P[p.id_player] = p);
  const nm = id => P[id] ? P[id].name : id;

  // 2) matches futuros -> jogadores (exclui Cicero)
  const { data: matches } = await supabase.from('matches').select('*').in('id_match', FUT);
  const dids = [...new Set(matches.flatMap(m => [m.id_double_a, m.id_double_b]))];
  const { data: dbls } = await supabase.from('doubles').select('*').in('id_double', dids);
  const D = {}; dbls.forEach(d => D[d.id_double] = d);
  const windfall = {}; // playerId -> nº de +3
  const detalhe = [];
  for (const m of matches) {
    const a = D[m.id_double_a] || {}, b = D[m.id_double_b] || {};
    const ids = [a.id_player1, a.id_player2, b.id_player1, b.id_player2].filter(Boolean);
    const beneficiados = ids.filter(id => id !== CICERO);
    beneficiados.forEach(id => windfall[id] = (windfall[id] || 0) + 1);
    detalhe.push(`  #${m.id_match}: ${beneficiados.map(nm).join(', ')}`);
  }

  console.log('=== JOGOS FUTUROS DO CICERO (beneficiados por +3) ===');
  console.log(detalhe.join('\n'));
  console.log('\n=== +3 POR ATLETA ===');
  Object.entries(windfall).sort((a,b)=>b[1]-a[1]).forEach(([id,c]) =>
    console.log(`  ${nm(+id).padEnd(22)} ${c} jogo(s) -> +${3*c} pts, +${c} vitoria(s)`));

  // 3) ranking real de producao (cat 1)
  const { data: rk } = await axios.get(`${BASE}/api/tournaments/${TID}/ranking/${CAT}`);
  const rows = Array.isArray(rk) ? rk : (rk.ranking || rk.data || []);
  if (!rows.length) { console.log('\n[!] ranking vazio; shape:', JSON.stringify(rk).slice(0,300)); process.exit(0); }
  console.log('\n(shape 1a linha:', Object.keys(rows[0]).join(','), ')');

  const key = (r, ...ks) => { for (const k of ks) if (r[k] != null) return r[k]; return 0; };
  const pid = r => key(r, 'id_player', 'playerId', 'id');
  const enrich = r => {
    const c = windfall[pid(r)] || 0;
    const pts = key(r, 'points', 'pontos');
    const wins = key(r, 'wins', 'vitorias');
    const gb = key(r, 'games_balance', 'saldo', 'games_balance');
    return { name: r.name || nm(pid(r)), id: pid(r), pts, wins,
             losses: key(r,'losses','derrotas'), wos: key(r,'wos','walkovers'), gb,
             c, npts: pts + 3*c, nwins: wins + c };
  };
  const cur = rows.map(enrich);
  const sortBy = arr => [...arr].sort((a,b)=> b.npts-a.npts || b.nwins-a.nwins || b.gb-a.gb || a.losses-b.losses || a.wos-b.wos);
  const curSorted = [...cur].sort((a,b)=> b.pts-a.pts || b.wins-a.wins || b.gb-a.gb || a.losses-b.losses || a.wos-b.wos);
  const proj = sortBy(cur);
  const posCur = {}; curSorted.forEach((r,i)=>posCur[r.id]=i+1);

  console.log('\n=== RANKING INICIANTE: ATUAL -> PROJETADO (com vitoria direta) ===');
  console.log('pos | atleta                 | pts atual -> proj | mov');
  proj.forEach((r,i)=>{
    const np = i+1, op = posCur[r.id];
    const mov = op===np ? '=' : (op>np ? `↑${op-np}` : `↓${np-op}`);
    const flag = r.c>0 ? `  (+${3*r.c})` : '';
    console.log(`${String(np).padStart(2)}  | ${r.name.padEnd(22)} | ${String(r.pts).padStart(3)} -> ${String(r.npts).padStart(3)} | ${mov}${flag}`);
  });
  process.exit(0);
})();
