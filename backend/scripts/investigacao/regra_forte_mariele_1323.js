// Avalia as candidatas a substituir a Mariele (707, RIGHT) no match 1323 pela REGRA FORTE:
// não repetir adversário de MESMA POSIÇÃO (diagonal_count > 0 com a adversária do mesmo lado).
// Dupla B: Maria Luísa[691/RIGHT] + Daniela Herzog[703/LEFT].
// A substituta entra como RIGHT -> adversária de mesma posição = Maria Luísa (691, RIGHT).
const supabase = require('../../supabase');

const CANDIDATAS = [
  { id: 697, name: 'Luana Bock', side: 'RIGHT' },
  { id: 695, name: 'Nicole Facchini', side: 'RIGHT' },
  { id: 692, name: 'Paola Brendler', side: 'RIGHT' },
];
const ADV_MESMA_POS = { id: 691, name: 'Maria Luísa', side: 'RIGHT' }; // adversária RIGHT da dupla B
const ADV_DIAGONAL  = { id: 703, name: 'Daniela Herzog', side: 'LEFT' }; // lado oposto (só ajuste fino)
const NARA = { id: 701, name: 'Nara Nunes', side: 'LEFT' }; // parceira (fica)

let ID_TOURNAMENT = 7; // setado dinamicamente via round 417 em run()
const ID_CATEGORY = 3;

async function oppositionBetween(a, b) {
  const p1 = Math.min(a, b), p2 = Math.max(a, b);
  const { data } = await supabase.from('oppositions')
    .select('times_opposed, diagonal_count, last_round_id')
    .eq('id_tournament', ID_TOURNAMENT).eq('id_category', ID_CATEGORY)
    .eq('id_player1', p1).eq('id_player2', p2).maybeSingle();
  return data || { times_opposed: 0, diagonal_count: 0, last_round_id: null };
}

async function realMatesOfNara() {
  // já jogou de DUPLA com a Nara? (regra menor — só desempate)
  const { data: rounds } = await supabase.from('rounds')
    .select('id_round').eq('id_tournament', ID_TOURNAMENT).eq('id_category', ID_CATEGORY)
    .in('status', ['CONFIRMED', 'FINISHED']);
  const rids = (rounds || []).map(r => r.id_round);
  const { data: dbls } = await supabase.from('doubles')
    .select('id_player1, id_player2').in('id_round', rids)
    .or(`id_player1.eq.${NARA.id},id_player2.eq.${NARA.id}`);
  const mates = new Set();
  (dbls || []).forEach(d => { const m = d.id_player1 === NARA.id ? d.id_player2 : d.id_player1; if (m) mates.add(m); });
  return mates;
}

async function run() {
  // confirma id_tournament do round 417
  const { data: r } = await supabase.from('rounds').select('id_tournament, id_category').eq('id_round', 417).single();
  ID_TOURNAMENT = r.id_tournament;
  console.log(`round 417 -> tournament=${r.id_tournament}, category=${r.id_category} (usando tournament=${ID_TOURNAMENT})\n`);

  const naraMates = await realMatesOfNara();

  console.log('Substituta entra como RIGHT (lugar da Mariele). Adversária de MESMA POSIÇÃO = Maria Luísa (691, RIGHT).\n');
  console.log('Candidata           | vs MariaLuísa(691) mesma-pos | vs Daniela(703) oposto | já dupla Nara?');
  console.log('-'.repeat(95));
  for (const c of CANDIDATAS) {
    const oMaria = await oppositionBetween(c.id, ADV_MESMA_POS.id);
    const oDani  = await oppositionBetween(c.id, ADV_DIAGONAL.id);
    const violaForte = oMaria.diagonal_count > 0; // mesma posição já enfrentada
    const jaDuplaNara = naraMates.has(c.id);
    const veredito = violaForte ? '❌ VIOLA REGRA FORTE' : '✅ ok';
    console.log(
      `${(c.name).padEnd(19)} | diag=${oMaria.diagonal_count} total=${oMaria.times_opposed} (lastR=${oMaria.last_round_id})`.padEnd(58) +
      `| diag=${oDani.diagonal_count} total=${oDani.times_opposed}`.padEnd(25) +
      `| ${jaDuplaNara ? 'sim' : 'não'}   ${veredito}`
    );
  }
}
run().catch(e => { console.error(e.message || e); process.exit(1); });
