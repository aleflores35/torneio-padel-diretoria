// READ-ONLY: getStandings inclui inativos? estado vivo do Marcio e do cat1.
const supabase = require('../../supabase');
const { getStandings } = require('../../services/rankingService');
const ID_T = 7;

async function run() {
  // estado bruto do Marcio e contagem de ativos na direita cat1
  const { data: cat1right } = await supabase.from('players')
    .select('id_player, name, side, active').eq('id_tournament', ID_T).eq('category_id', 1).eq('side', 'RIGHT');
  console.log('=== players cat1 RIGHT (banco) ===');
  cat1right.sort((a,b)=>a.id_player-b.id_player).forEach(p => console.log(`  ${p.id_player} ${p.name.padEnd(22)} active=${p.active}`));
  console.log(`  ativos na direita: ${cat1right.filter(p=>p.active).length} / total ${cat1right.length}`);

  // getStandings inclui inativos?
  const st = await getStandings(ID_T, 1);
  const right = st.filter(p => p.side === 'RIGHT');
  console.log(`\n=== getStandings(7,1) → ${st.length} atletas (${right.length} direita) ===`);
  const marcio = st.find(p => p.id_player === 657);
  console.log(marcio ? `  ⚠️  Marcio (657) ESTÁ no standings: ${marcio.points}pt ${marcio.wins}-${marcio.losses}` : '  ✓ Marcio (657) FORA do standings');
  // saldo por lado agora
  const sD = right.reduce((a,p)=>a+p.games_balance,0);
  const sE = st.filter(p=>p.side==='LEFT').reduce((a,p)=>a+p.games_balance,0);
  console.log(`  saldo dir=${sD} esq=${sE} (0/0 = consistente)`);
}
run().catch(e => { console.error(e.message || e); process.exit(1); });
