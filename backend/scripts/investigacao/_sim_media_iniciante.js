// READ-ONLY: node _sim_media_iniciante.js
// Compara ranking Iniciante por SOMA (atual) vs MEDIA (pts/jogo). Nada gravado.
const axios = require('axios');
const TID = 7, CAT = 1;
const BASE = 'https://ranking-padel-srb-2026.vercel.app';

(async () => {
  const { data: rk } = await axios.get(`${BASE}/api/tournaments/${TID}/ranking/${CAT}`);
  const rows = Array.isArray(rk) ? rk : (rk.ranking || rk.data || []);
  const R = rows.map(r => {
    const g = r.matches_played || 0;
    return { name: r.name, pts: r.points||0, g, w: r.wins||0, l: r.losses||0, wo: r.wos||0,
             gb: r.games_balance||0, media: g ? (r.points||0)/g : 0 };
  });
  const bySoma = [...R].sort((a,b)=> b.pts-a.pts || b.w-a.w || b.gb-a.gb || a.l-b.l || a.wo-b.wo);
  const byMedia = [...R].sort((a,b)=> b.media-a.media || b.g-a.g || b.gb-a.gb || a.wo-b.wo);
  const posSoma = {}; bySoma.forEach((r,i)=>posSoma[r.name]=i+1);

  console.log('RANKING POR MEDIA (pts/jogo) vs posicao atual por SOMA');
  console.log('novo| atleta                 | jogos | pts | media | pos atual | mov');
  byMedia.forEach((r,i)=>{
    const np=i+1, op=posSoma[r.name];
    const mov = op===np?'=':(op>np?`↑${op-np}`:`↓${np-op}`);
    const flag = r.g<=4 ? '  ⚠poucos jogos' : '';
    console.log(`${String(np).padStart(2)}  | ${r.name.padEnd(22)} | ${String(r.g).padStart(4)}  | ${String(r.pts).padStart(3)} | ${r.media.toFixed(2)} |   ${String(op).padStart(2)}      | ${mov}${flag}`);
  });

  const gs = R.map(r=>r.g);
  console.log(`\njogos por atleta: min ${Math.min(...gs)} / max ${Math.max(...gs)} (spread ${Math.max(...gs)-Math.min(...gs)}) — a desigualdade que a media neutraliza`);
  process.exit(0);
})();
