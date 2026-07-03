// RESTAURA o estado pre-pivo a partir de PRE_pivot_2026-06-30-13-38-04:
// reinsere rodadas/doubles/matches futuros apagados + restaura partnerships/oppositions.
// NAO mexe em jogos passados, 02/07, nem player_absences (Tanise fica). DRY por padrao; CONFIRM_EXECUTE=yes grava.
const supabase = require('../../supabase');
const fs = require('fs'); const path = require('path');
const TID = 7;
const PRE = 'C:/obralivre/clientes/parcerias/sociedade-rio-branco/ranking-srb-2026/backups/PRE_pivot_2026-06-30-13-38-04';
const CONFIRM = process.env.CONFIRM_EXECUTE === 'yes';
const load = f => JSON.parse(fs.readFileSync(path.join(PRE, f), 'utf-8'));
const ck = (r, what) => { if (r && r.error) { console.error('ERRO', what, r.error.message); process.exit(1); } };

(async () => {
  if (!supabase) { console.error('SEM supabase'); process.exit(1); }
  const preRounds = load('rounds.json'), preDoubles = load('doubles.json'), preMatches = load('matches.json');
  const prePart = load('partnerships.json'), preOpp = load('oppositions.json');

  // estado atual
  const { data: curRounds } = await supabase.from('rounds').select('id_round').eq('id_tournament', TID);
  const curRoundIds = new Set((curRounds||[]).map(r=>r.id_round));
  const { data: curDbls } = await supabase.from('doubles').select('id_double').eq('id_tournament', TID);
  const curDblIds = new Set((curDbls||[]).map(d=>d.id_double));
  const allCurDblIds = (curDbls||[]).map(d=>d.id_double);
  let curMatchIds = new Set();
  for (let i=0;i<allCurDblIds.length;i+=100){
    const { data } = await supabase.from('matches').select('id_match').in('id_double_a', allCurDblIds.slice(i,i+100));
    (data||[]).forEach(m=>curMatchIds.add(m.id_match));
  }

  const roundsToAdd = preRounds.filter(r=>!curRoundIds.has(r.id_round));
  const dblsToAdd   = preDoubles.filter(d=>!curDblIds.has(d.id_double));
  const matchesToAdd= preMatches.filter(m=>!curMatchIds.has(m.id_match));

  console.log('=== RESTORE — o que falta reinserir ===');
  console.log(`rounds a reinserir: ${roundsToAdd.length}  [${roundsToAdd.map(r=>r.id_round).sort((a,b)=>a-b).join(',')}]`);
  console.log(`doubles a reinserir: ${dblsToAdd.length}`);
  console.log(`matches a reinserir: ${matchesToAdd.length}`);
  console.log(`partnerships: atual -> ${prePart.length} (PRE) | oppositions: atual -> ${preOpp.length} (PRE)`);
  console.log('CONFIRM_EXECUTE =', CONFIRM ? 'SIM (grava)' : 'nao (dry-run)');
  if (!CONFIRM) { console.log('\n>>> DRY-RUN: nada gravado <<<'); process.exit(0); }

  console.log('\n--- EXECUTANDO RESTORE ---');
  // 1. rounds (PK explicito)
  for (let i=0;i<roundsToAdd.length;i+=100){ const r=await supabase.from('rounds').insert(roundsToAdd.slice(i,i+100)); ck(r,'rounds'); }
  console.log(`reinseridas ${roundsToAdd.length} rounds`);
  // 2. doubles
  for (let i=0;i<dblsToAdd.length;i+=100){ const r=await supabase.from('doubles').insert(dblsToAdd.slice(i,i+100)); ck(r,'doubles'); }
  console.log(`reinseridos ${dblsToAdd.length} doubles`);
  // 3. matches
  for (let i=0;i<matchesToAdd.length;i+=100){ const r=await supabase.from('matches').insert(matchesToAdd.slice(i,i+100)); ck(r,'matches'); }
  console.log(`reinseridos ${matchesToAdd.length} matches`);
  // 4. partnerships/oppositions: limpa e restaura PRE (sem PK, mantem last_round_id)
  let r=await supabase.from('partnerships').delete().eq('id_tournament', TID); ck(r,'del part');
  r=await supabase.from('oppositions').delete().eq('id_tournament', TID); ck(r,'del opp');
  const partRows = prePart.map(({id_partnership, ...rest})=>rest);
  const oppRows  = preOpp.map(({id_opposition, ...rest})=>rest);
  for (let i=0;i<partRows.length;i+=200){ const x=await supabase.from('partnerships').insert(partRows.slice(i,i+200)); ck(x,'ins part'); }
  for (let i=0;i<oppRows.length;i+=200){ const x=await supabase.from('oppositions').insert(oppRows.slice(i,i+200)); ck(x,'ins opp'); }
  console.log(`restauradas ${partRows.length} partnerships, ${oppRows.length} oppositions`);

  // verificacao
  const { data: vr } = await supabase.from('rounds').select('id_round').eq('id_tournament', TID);
  const { data: vp } = await supabase.from('partnerships').select('id_partnership').eq('id_tournament', TID);
  const { data: vo } = await supabase.from('oppositions').select('id_opposition').eq('id_tournament', TID);
  console.log(`\nVERIFICA: rounds=${vr.length} (esperado 55) | partnerships=${vp.length} (317) | oppositions=${vo.length} (459)`);
  console.log('>>> RESTORE CONCLUIDO <<<');
  process.exit(0);
})();
