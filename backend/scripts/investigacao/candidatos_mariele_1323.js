// Lista candidatos a substituir a Mariele (707) no match 1323, usando o serviço de produção
const { getMatchDetails, getSubstituteCandidates } = require('../../services/substitutionService');

const ID_MATCH = 1323;
const OUT_PLAYER = 707; // Mariele

async function run() {
  const det = await getMatchDetails(ID_MATCH);
  console.log('=== JOGO ===');
  console.log(`match ${det.id_match} · status ${det.status} · ${det.scheduled_at} · rodada ${det.id_round} (${det.round_status}, cat ${det.id_category})`);
  console.log(`A: ${det.double_a.players.map(p => `${p.name}[${p.id_player}/${p.side}]`).join(' + ')}`);
  console.log(`B: ${det.double_b.players.map(p => `${p.name}[${p.id_player}/${p.side}]`).join(' + ')}`);
  console.log('');

  const res = await getSubstituteCandidates(ID_MATCH, OUT_PLAYER);
  console.log('=== SAINDO ===', res.out_player.name);
  console.log('=== PARCEIRA (fica) ===', `${res.partner.name} [${res.partner.id_player}/${res.partner.side}]`);
  console.log('');
  console.log(`=== CANDIDATAS (${res.candidates.length}) — ordenadas por prioridade ===`);
  for (const c of res.candidates) {
    const flag = c.paired_with_partner ? ' ⛔ JÁ FOI DUPLA DA PARCEIRA (bloqueada)' : '';
    console.log(`  - ${c.name} [id=${c.id_player}/${c.side}] · presença=${c.attendance_status}${flag}`);
  }
}
run().catch(e => { console.error(e.message || e); process.exit(1); });
