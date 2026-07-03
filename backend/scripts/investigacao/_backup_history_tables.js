// READ-ONLY: faz backup das tabelas de historico (partnerships/oppositions) e mede
// contaminacao pela grade pre-gerada (entries com last_round_id em rodada futura).
// NAO escreve nada. Uso: node backend/scripts/investigacao/_backup_history_tables.js
const supabase = require('../../supabase');
const fs = require('fs');
const path = require('path');

const TID = 7;
const TODAY = '2026-06-30';
const SNAP = 'C:/obralivre/clientes/parcerias/sociedade-rio-branco/ranking-srb-2026/backups/snapshot_2026-06-30_095504';

(async () => {
  if (!supabase) { console.error('SEM supabase (.env nao carregou)'); process.exit(1); }
  const { data: parts, error: e1 } = await supabase.from('partnerships').select('*').eq('id_tournament', TID);
  const { data: opps, error: e2 } = await supabase.from('oppositions').select('*').eq('id_tournament', TID);
  if (e1 || e2) { console.error('erro:', e1 || e2); process.exit(1); }

  fs.writeFileSync(path.join(SNAP, 'partnerships.json'), JSON.stringify(parts, null, 2), 'utf-8');
  fs.writeFileSync(path.join(SNAP, 'oppositions.json'), JSON.stringify(opps, null, 2), 'utf-8');
  console.log(`[backup] partnerships: ${parts.length}  oppositions: ${opps.length}  -> salvos no snapshot`);

  // classifica rodadas
  const rounds = JSON.parse(fs.readFileSync(path.join(SNAP, 'rounds.json'), 'utf-8'));
  const matches = JSON.parse(fs.readFileSync(path.join(SNAP, 'matches.json'), 'utf-8'));
  const futureRoundIds = new Set(rounds.filter(r => r.scheduled_date >= TODAY).map(r => r.id_round));
  const playedRoundIds = new Set(rounds.filter(r => r.scheduled_date < TODAY).map(r => r.id_round));

  // contaminacao: entries cujo last_round_id aponta pra rodada futura
  const pContam = parts.filter(p => futureRoundIds.has(p.last_round_id)).length;
  const oContam = opps.filter(o => futureRoundIds.has(o.last_round_id)).length;
  const pNull = parts.filter(p => !p.last_round_id).length;
  const oNull = opps.filter(o => !o.last_round_id).length;

  // expected: recomputa oppositions/partnerships SO de jogos jogados (FINISHED/WO)
  const playedMatches = matches.filter(m => ['FINISHED', 'WO'].includes(m.status));
  const expOpp = new Set(), expPart = new Set();
  let expOppCount = 0, expPartCount = 0;
  const okey = (a,b) => [a,b].sort((x,y)=>x-y).join('-');
  for (const m of playedMatches) {
    const da = (m.double_a_players||[]).map(p=>p.id_player);
    const db = (m.double_b_players||[]).map(p=>p.id_player);
    if (da.length===2) { expPartCount++; }
    if (db.length===2) { expPartCount++; }
    for (const a of da) for (const b of db) expOppCount++;
  }
  const sumOpp = opps.reduce((s,o)=>s+(o.times_opposed||0),0);
  const sumPart = parts.reduce((s,p)=>s+(p.times_paired||0),0);

  console.log('\n=== CONTAMINACAO ===');
  console.log(`rodadas futuras (>=${TODAY}): ${futureRoundIds.size} | jogadas (<${TODAY}): ${playedRoundIds.size}`);
  console.log(`jogos REALMENTE jogados (FINISHED/WO): ${playedMatches.length}`);
  console.log(`partnerships: ${parts.length} entries | last_round_id em rodada FUTURA: ${pContam} | null: ${pNull}`);
  console.log(`  soma times_paired (atual): ${sumPart}  vs  duplas de jogos jogados (esperado): ${expPartCount}`);
  console.log(`oppositions: ${opps.length} entries | last_round_id em rodada FUTURA: ${oContam} | null: ${oNull}`);
  console.log(`  soma times_opposed (atual): ${sumOpp}  vs  pares-oponente de jogos jogados (esperado): ${expOppCount}`);
  console.log('\n>>> Se "atual" >> "esperado", o historico esta inflado pela grade pre-gerada. <<<');
  console.log('>>> NADA foi escrito. <<<');
  process.exit(0);
})();
