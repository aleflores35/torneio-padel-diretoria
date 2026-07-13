// READ-ONLY: simula o ranking da Masc Iniciante (cat 1) ANTES x DEPOIS de expurgar
// Marcio Ferreira (657) e Alisson Boyink (670). Nada é gravado.
// Replica a lógica de rankingService.getStandings (Win+3/Loss+1/WO0) lendo Supabase.
const supabase = require('../../supabase');
const T = 7, CAT = 1;
const QUITTERS = new Set([657, 670]);

const pts = (matches, doubleMap, statsPlayers, excludeQuitters) => {
  const stats = {};
  statsPlayers.forEach(p => { stats[p.id_player] = { points:0,wins:0,losses:0,wos:0,mp:0,gf:0,ga:0 }; });
  for (const match of matches) {
    const dA = doubleMap[match.id_double_a], dB = doubleMap[match.id_double_b];
    if (!dA || !dB) continue;
    const pA = [dA.id_player1, dA.id_player2].filter(Boolean);
    const pB = [dB.id_player1, dB.id_player2].filter(Boolean);
    if (excludeQuitters && [...pA, ...pB].some(p => QUITTERS.has(p))) continue; // jogo some p/ todos
    const absents = new Set(Array.isArray(match.absent_player_ids) ? match.absent_player_ids : []);
    const aAbs = pA.some(p => absents.has(p)), bAbs = pB.some(p => absents.has(p));
    const gA = match.games_double_a ?? 0, gB = match.games_double_b ?? 0;
    const valid = (gA > 0 || gB > 0) && gA !== gB;
    const aWon = valid && gA > gB, bWon = valid && gB > gA;
    const proc = (pid, og, pg, ow, ourAbs, oppAbs) => {
      if (!stats[pid]) return;
      stats[pid].mp++;
      if (absents.has(pid)) { stats[pid].wos++; return; }
      if (ourAbs) { stats[pid].points += 1; return; }
      if (oppAbs) { stats[pid].wins++; stats[pid].points += 3; return; }
      if (valid) { stats[pid].gf+=og; stats[pid].ga+=pg; if (ow){stats[pid].wins++;stats[pid].points+=3;} else {stats[pid].losses++;stats[pid].points+=1;} return; }
      stats[pid].points += 1;
    };
    for (const pid of pA) proc(pid, gA, gB, aWon, aAbs, bAbs);
    for (const pid of pB) proc(pid, gB, gA, bWon, bAbs, aAbs);
  }
  return stats;
};

const rank = (players, stats) => players
  .map(p => ({ id:p.id_player, name:p.name, side:p.side, ...stats[p.id_player], bal: stats[p.id_player].gf - stats[p.id_player].ga }))
  .sort((a,b) => b.points-a.points || b.wins-a.wins || b.bal-a.bal || a.losses-b.losses || a.wos-b.wos);

(async () => {
  const { data: allPlayers } = await supabase.from('players').select('id_player,name,side,category_id,active').eq('id_tournament', T);
  const nameById = {}; allPlayers.forEach(p => nameById[p.id_player]=p.name);
  // ranking mostra só ativos da categoria (mesma regra do serviço)
  const catActive = allPlayers.filter(p => p.category_id===CAT && p.active);
  const catActiveIds = new Set(catActive.map(p=>p.id_player));

  const { data: dbls } = await supabase.from('doubles').select('id_double,id_round,id_player1,id_player2,display_name').eq('id_tournament', T);
  const doubleMap = {}; dbls.forEach(d => doubleMap[d.id_double]=d);

  // rounds EXHIBITION já existentes → excluir (como o serviço faz)
  const { data: exRounds } = await supabase.from('rounds').select('id_round').eq('id_tournament', T).eq('round_type','EXHIBITION');
  const exRoundIds = new Set((exRounds||[]).map(r=>r.id_round));
  const exDoubleIds = new Set(dbls.filter(d => d.id_round!=null && exRoundIds.has(d.id_round)).map(d=>d.id_double));

  // matches FINISHED + WO
  const dids = dbls.map(d=>d.id_double);
  async function fetch(field, status){ let out=[]; for(let i=0;i<dids.length;i+=200){ const {data}=await supabase.from('matches').select('*').in(field, dids.slice(i,i+200)).eq('status',status); out=out.concat(data||[]);} return out; }
  const fin = [...await fetch('id_double_a','FINISHED'), ...await fetch('id_double_b','FINISHED')];
  const wo  = [...await fetch('id_double_a','WO'), ...await fetch('id_double_b','WO')];
  const byId={}; [...fin,...wo].forEach(m=>byId[m.id_match]=m);
  const catDoubleIds = new Set(dbls.filter(d => catActiveIds.has(d.id_player1)||catActiveIds.has(d.id_player2)).map(d=>d.id_double));
  const catMatches = Object.values(byId).filter(m =>
    catDoubleIds.has(m.id_double_a) && catDoubleIds.has(m.id_double_b) &&
    !exDoubleIds.has(m.id_double_a) && !exDoubleIds.has(m.id_double_b));

  const before = rank(catActive, pts(catMatches, doubleMap, catActive, false));
  const after  = rank(catActive, pts(catMatches, doubleMap, catActive, true));
  const posAfter = {}; after.forEach((p,i)=>posAfter[p.id]=i+1);

  console.log(`\n=== Masc Iniciante (cat 1) — ${catActive.length} ativos · ${catMatches.length} jogos de ranking ===`);
  console.log('\nANTES (atual):');
  before.forEach((p,i)=>console.log(`${String(i+1).padStart(2)}. ${p.name.padEnd(22)} ${p.points}pt ${p.wins}V/${p.losses}D wo${p.wos} bal${p.bal>=0?'+':''}${p.bal} · ${p.mp}j`));

  console.log('\nDEPOIS (expurga 657 Marcio + 670 Alisson — jogos com/contra eles somem p/ todos):');
  after.forEach((p,i)=>{
    const b = before.findIndex(x=>x.id===p.id)+1;
    const mv = b===i+1 ? '  ' : (b>i+1 ? `▲${b-(i+1)}` : `▼${(i+1)-b}`);
    console.log(`${String(i+1).padStart(2)}. ${mv} ${p.name.padEnd(22)} ${p.points}pt ${p.wins}V/${p.losses}D wo${p.wos} bal${p.bal>=0?'+':''}${p.bal} · ${p.mp}j`);
  });

  // spread de jogos por atleta (paridade)
  const mpB = before.map(p=>p.mp), mpA = after.map(p=>p.mp);
  const sp = a => `${Math.min(...a)}–${Math.max(...a)} (spread ${Math.max(...a)-Math.min(...a)})`;
  console.log(`\nParidade jogos/atleta — ANTES: ${sp(mpB)} · DEPOIS: ${sp(mpA)}`);

  // quantos jogos de cada quitter
  for (const q of QUITTERS) {
    const qGames = catMatches.filter(m => { const a=doubleMap[m.id_double_a], b=doubleMap[m.id_double_b]; return [a.id_player1,a.id_player2,b.id_player1,b.id_player2].includes(q); });
    console.log(`  ${nameById[q]} (${q}): ${qGames.length} jogos de ranking a anular (exhibition)`);
  }
  process.exit(0);
})();
