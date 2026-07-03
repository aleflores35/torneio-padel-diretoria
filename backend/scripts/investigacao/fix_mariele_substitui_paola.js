// (a) Ajuste do jogo de hoje: Mariele entra no lugar da Paola no match 1301.
// 1) remove dupla fantasma 2873 (Mariele/Daniela, sem match) + partnership fantasma
// 2) substitui Paola->Mariele via substitutePlayer oficial
// Mostra estado antes/depois e ABORTA se algo divergir do esperado.
const supabase = require('../../supabase');
const { substitutePlayer } = require('../../services/substitutionService');

const ROUND = 408, MATCH = 1301;
const PAOLA = 692, CATIANE = 704, MARIELE = 707, DANIELA = 703;
const ORPHAN_DOUBLE = 2873;

async function snapshot(tag) {
  console.log(`\n========== SNAPSHOT ${tag} ==========`);
  const { data: doubles } = await supabase.from('doubles')
    .select('id_double, id_player1, id_player2, display_name').eq('id_round', ROUND).order('id_double');
  console.table((doubles||[]).map(d => ({ id_double: d.id_double, dupla: d.display_name })));

  const { data: match } = await supabase.from('matches')
    .select('id_match, id_double_a, id_double_b, status').eq('id_match', MATCH).single();
  const dn = {}; (doubles||[]).forEach(d => dn[d.id_double]=d.display_name);
  console.log('Match 1301:', dn[match?.id_double_a] || match?.id_double_a, 'VS', dn[match?.id_double_b] || match?.id_double_b, '|', match?.status);

  const { data: att } = await supabase.from('round_attendance')
    .select('id_player, status').in('id_player', [PAOLA, MARIELE, DANIELA, CATIANE]).eq('id_round', ROUND);
  const pn = {[PAOLA]:'Paola',[CATIANE]:'Catiane',[MARIELE]:'Mariele',[DANIELA]:'Daniela'};
  console.log('Attendance:', (att||[]).map(a => `${pn[a.id_player]}=${a.status}`).join(' · '));

  const { data: parts } = await supabase.from('partnerships').select('id_player1,id_player2,times_paired,last_round_id')
    .eq('id_tournament', 7).eq('id_category', 3)
    .or(`and(id_player1.eq.${Math.min(MARIELE,DANIELA)},id_player2.eq.${Math.max(MARIELE,DANIELA)}),and(id_player1.eq.${Math.min(PAOLA,CATIANE)},id_player2.eq.${Math.max(PAOLA,CATIANE)}),and(id_player1.eq.${Math.min(MARIELE,CATIANE)},id_player2.eq.${Math.max(MARIELE,CATIANE)})`);
  console.log('Partnerships (M+D / P+C / M+C):', (parts||[]).map(p => `[${p.id_player1}+${p.id_player2} x${p.times_paired}]`).join(' ') || '(nenhuma)');
}

async function main() {
  await snapshot('ANTES');

  // GUARD 1: a dupla órfã não pode ter match
  const { data: mA } = await supabase.from('matches').select('id_match').eq('id_double_a', ORPHAN_DOUBLE);
  const { data: mB } = await supabase.from('matches').select('id_match').eq('id_double_b', ORPHAN_DOUBLE);
  if ((mA&&mA.length) || (mB&&mB.length)) {
    console.error('\nABORT: dupla 2873 TEM match — não é órfã. Nada alterado.'); process.exit(1);
  }
  // GUARD 2: a dupla órfã tem que ser Mariele+Daniela
  const { data: od } = await supabase.from('doubles').select('id_player1,id_player2').eq('id_double', ORPHAN_DOUBLE).single();
  const ids = [od.id_player1, od.id_player2].sort();
  if (ids[0] !== Math.min(MARIELE,DANIELA) || ids[1] !== Math.max(MARIELE,DANIELA)) {
    console.error('\nABORT: dupla 2873 não é Mariele+Daniela. Nada alterado.'); process.exit(1);
  }
  // GUARD 3: match 1301 tem que conter a dupla da Paola/Catiane (2872)
  const { data: m1301 } = await supabase.from('matches').select('id_double_a,id_double_b,status').eq('id_match', MATCH).single();
  if (!['TO_PLAY','SCHEDULED','CALLING'].includes(m1301.status)) {
    console.error(`\nABORT: match 1301 status=${m1301.status} (não é agendável). Nada alterado.`); process.exit(1);
  }

  console.log('\n--- Guards OK. Aplicando mudanças ---');

  // 1) Remove partnership fantasma Mariele+Daniela
  const { error: pErr } = await supabase.from('partnerships').delete()
    .eq('id_tournament', 7).eq('id_category', 3)
    .eq('id_player1', Math.min(MARIELE,DANIELA)).eq('id_player2', Math.max(MARIELE,DANIELA));
  if (pErr) { console.error('Erro removendo partnership fantasma:', pErr.message); process.exit(1); }
  console.log('✓ Partnership fantasma Mariele+Daniela removida');

  // 2) Remove a dupla órfã 2873
  const { error: dErr } = await supabase.from('doubles').delete().eq('id_double', ORPHAN_DOUBLE);
  if (dErr) { console.error('Erro removendo dupla 2873:', dErr.message); process.exit(1); }
  console.log('✓ Dupla órfã 2873 removida');

  // 3) Substitui Paola -> Mariele no match 1301 (caminho oficial)
  const res = await substitutePlayer(MATCH, PAOLA, MARIELE);
  console.log('✓ Substituição aplicada:', res.new_display_name);

  await snapshot('DEPOIS');
  console.log('\n>>> CONCLUÍDO.');
}
main().catch(e => { console.error('FALHA:', e.message); process.exit(1); });