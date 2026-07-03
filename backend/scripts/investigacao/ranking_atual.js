// Panorama do ranking atual: por categoria, separado por LADO (direita/esquerda).
const supabase = require('../../supabase');
const { getStandings } = require('../../services/rankingService');

async function run() {
  // 1. Torneio ativo (assume o de maior id com rounds; confirma)
  const { data: tournaments } = await supabase.from('tournaments').select('*').order('id_tournament', { ascending: false });
  const t = (tournaments || [])[0];
  const ID_T = t ? t.id_tournament : 7;
  console.log(`=== TORNEIO: ${t ? t.name : '?'} (id=${ID_T}, status=${t ? t.status : '?'}) ===\n`);

  // 2. Categorias
  const { data: cats } = await supabase.from('categories').select('*').eq('id_tournament', ID_T).order('id_category');
  const catList = (cats && cats.length) ? cats : [{ id_category: 1, name: 'Cat 1' }, { id_category: 2, name: 'Cat 2' }, { id_category: 3, name: 'Cat 3' }];

  // 3. Panorama de rodadas e jogos
  const { data: rounds } = await supabase.from('rounds').select('id_round, status, id_category, round_type, round_number').eq('id_tournament', ID_T);
  const byStatus = {};
  (rounds || []).forEach(r => { byStatus[r.status] = (byStatus[r.status] || 0) + 1; });
  const { data: allMatches } = await supabase.from('matches').select('id_match, status').eq('id_tournament', ID_T);
  const mByStatus = {};
  (allMatches || []).forEach(m => { mByStatus[m.status] = (mByStatus[m.status] || 0) + 1; });
  console.log('Rodadas por status:', JSON.stringify(byStatus));
  console.log('Jogos por status: ', JSON.stringify(mByStatus));
  console.log('');

  // 4. Ranking por categoria x lado
  for (const c of catList) {
    const standings = await getStandings(ID_T, c.id_category);
    if (!standings.length) continue;
    const confRounds = (rounds || []).filter(r => r.id_category === c.id_category && ['CONFIRMED','FINISHED'].includes(r.status) && r.round_type !== 'EXHIBITION');
    console.log(`\n########## ${c.name || 'Cat '+c.id_category} (id=${c.id_category}) — ${confRounds.length} rodadas jogadas ##########`);
    for (const [sideKey, sideLabel] of [['RIGHT','DIREITA ▶'], ['LEFT','ESQUERDA ◀']]) {
      const list = standings.filter(p => p.side === sideKey);
      if (!list.length) continue;
      console.log(`\n  --- ${sideLabel} (${list.length} jogadores) ---`);
      console.log('  #  Jogador                  Pts   V   D  WO  J   saldo');
      list.forEach((p, i) => {
        console.log(
          `  ${String(i+1).padStart(2)}  ${p.name.padEnd(24)} ${String(p.points).padStart(3)}  ${String(p.wins).padStart(2)}  ${String(p.losses).padStart(2)}  ${String(p.wos).padStart(2)}  ${String(p.matches_played).padStart(2)}  ${p.games_balance >= 0 ? '+' : ''}${p.games_balance}`
        );
      });
    }
  }
}
run().catch(e => { console.error(e.message || e); process.exit(1); });
