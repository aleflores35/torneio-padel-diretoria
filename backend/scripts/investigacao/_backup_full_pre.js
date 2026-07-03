// READ-ONLY: backup completo PRE-execucao de TODAS as tabelas relevantes do torneio 7.
// NAO escreve nada. Cria pasta backups/PRE_pivot_<ts>/ e dumpa cada tabela em JSON.
const supabase = require('../../supabase');
const fs = require('fs');
const path = require('path');

const TID = 7;
(async () => {
  if (!supabase) { console.error('SEM supabase'); process.exit(1); }
  const now = new Date();
  const ts = now.toISOString().replace(/[:T]/g,'-').slice(0,19);
  const dir = path.join('C:/obralivre/clientes/parcerias/sociedade-rio-branco/ranking-srb-2026/backups', `PRE_pivot_${ts}`);
  fs.mkdirSync(dir, { recursive: true });

  const dump = async (table, query) => {
    const { data, error } = await query;
    if (error) { console.log(`  [ERRO] ${table}: ${error.message}`); return; }
    fs.writeFileSync(path.join(dir, `${table}.json`), JSON.stringify(data, null, 2), 'utf-8');
    console.log(`  [ok] ${table}: ${data.length}`);
  };

  console.log(`PRE-backup -> ${dir}`);
  await dump('tournaments', supabase.from('tournaments').select('*').eq('id_tournament', TID));
  await dump('rounds', supabase.from('rounds').select('*').eq('id_tournament', TID));
  // matches/doubles via id_round das rounds do torneio
  const { data: rounds } = await supabase.from('rounds').select('id_round').eq('id_tournament', TID);
  const rids = (rounds||[]).map(r=>r.id_round);
  await dump('doubles', supabase.from('doubles').select('*').in('id_round', rids));
  // matches: pega via id_double_a in doubles do torneio
  const { data: dbls } = await supabase.from('doubles').select('id_double').in('id_round', rids);
  const dids = (dbls||[]).map(d=>d.id_double);
  await dump('matches', supabase.from('matches').select('*').in('id_double_a', dids));
  await dump('partnerships', supabase.from('partnerships').select('*').eq('id_tournament', TID));
  await dump('oppositions', supabase.from('oppositions').select('*').eq('id_tournament', TID));
  await dump('player_absences', supabase.from('player_absences').select('*').eq('id_tournament', TID));
  await dump('players', supabase.from('players').select('*').eq('id_tournament', TID));
  await dump('courts', supabase.from('courts').select('*').eq('id_tournament', TID));
  console.log('PRE-backup completo. >>> NADA escrito. <<<');
  console.log('DIR='+dir);
  process.exit(0);
})();
