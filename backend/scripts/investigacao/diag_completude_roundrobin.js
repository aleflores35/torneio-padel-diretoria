// READ-ONLY: % de completude rumo a "todos enfrentam todos" (round-robin por lado).
// Em cada match: dupla A (1 dir + 1 esq) vs dupla B (1 dir + 1 esq).
// → o par de DIREITA (R_a, R_b) se enfrenta, e o par de ESQUERDA (L_a, L_b) se enfrenta.
// Completude = pares do mesmo lado que já se enfrentaram / pares possíveis C(n,2).
const supabase = require('../../supabase');
const ID_T = 7;
const CATS = { 1: 'Masc. Iniciante', 2: 'Masc. 4ª', 3: 'Feminino' };

async function run() {
  const [players, doubles, matches, rounds] = await Promise.all([
    supabase.from('players').select('id_player, name, side, category_id, active').eq('id_tournament', ID_T).then(r => r.data || []),
    supabase.from('doubles').select('id_double, id_player1, id_player2, id_round').eq('id_tournament', ID_T).then(r => r.data || []),
    supabase.from('matches').select('id_match, status, id_double_a, id_double_b').eq('id_tournament', ID_T).then(r => r.data || []),
    supabase.from('rounds').select('id_round, round_type').eq('id_tournament', ID_T).then(r => r.data || []),
  ]);

  const dMap = {}; doubles.forEach(d => dMap[d.id_double] = d);
  const dRound = {}; doubles.forEach(d => dRound[d.id_double] = d.id_round);
  const exhRounds = new Set(rounds.filter(r => r.round_type === 'EXHIBITION').map(r => r.id_round));
  const pById = {}; players.forEach(p => pById[p.id_player] = p);
  const key = (a, b) => a < b ? `${a}-${b}` : `${b}-${a}`;

  // coleta confrontos do mesmo lado (apenas jogos que aconteceram)
  const metByCat = {}; // cat -> { RIGHT:Set, LEFT:Set }
  for (const m of matches) {
    if (!['FINISHED', 'WO', 'IN_PROGRESS'].includes(m.status)) continue;
    if (exhRounds.has(dRound[m.id_double_a])) continue;
    const dA = dMap[m.id_double_a], dB = dMap[m.id_double_b];
    if (!dA || !dB) continue;
    const all = [dA.id_player1, dA.id_player2, dB.id_player1, dB.id_player2].filter(Boolean);
    const cat = all.map(id => pById[id]?.category_id).find(c => c != null);
    if (cat == null) continue;
    metByCat[cat] = metByCat[cat] || { RIGHT: new Set(), LEFT: new Set() };
    const Ra = [dA.id_player1, dA.id_player2].find(x => pById[x]?.side === 'RIGHT');
    const Rb = [dB.id_player1, dB.id_player2].find(x => pById[x]?.side === 'RIGHT');
    const La = [dA.id_player1, dA.id_player2].find(x => pById[x]?.side === 'LEFT');
    const Lb = [dB.id_player1, dB.id_player2].find(x => pById[x]?.side === 'LEFT');
    if (Ra && Rb) metByCat[cat].RIGHT.add(key(Ra, Rb));
    if (La && Lb) metByCat[cat].LEFT.add(key(La, Lb));
  }

  let gReq = 0, gMet = 0;
  for (const cat of Object.keys(CATS)) {
    const c = Number(cat);
    const dir = players.filter(p => p.category_id === c && p.active && p.side === 'RIGHT');
    const esq = players.filter(p => p.category_id === c && p.active && p.side === 'LEFT');
    const other = players.filter(p => p.category_id === c && p.active && p.side !== 'RIGHT' && p.side !== 'LEFT');
    const reqD = dir.length * (dir.length - 1) / 2;
    const reqE = esq.length * (esq.length - 1) / 2;
    const met = metByCat[c] || { RIGHT: new Set(), LEFT: new Set() };
    const metD = met.RIGHT.size, metE = met.LEFT.size;
    const req = reqD + reqE, mtot = metD + metE;
    gReq += req; gMet += mtot;

    console.log(`\n=== ${CATS[cat]} ===`);
    console.log(`  Direita: ${dir.length} atletas → confrontos possíveis ${reqD}, já feitos ${metD}, FALTAM ${reqD - metD}`);
    console.log(`  Esquerda: ${esq.length} atletas → confrontos possíveis ${reqE}, já feitos ${metE}, FALTAM ${reqE - metE}`);
    if (other.length) console.log(`  ⚠️  ${other.length} atleta(s) com lado indefinido (EITHER/null): ${other.map(p => p.name).join(', ')}`);
    if (dir.length !== esq.length) console.log(`  ⚠️  lados desbalanceados (${dir.length} dir × ${esq.length} esq) — round-robin limpo precisa de lados iguais`);
    const pct = req ? Math.round(100 * mtot / req) : 0;
    console.log(`  → COMPLETUDE round-robin: ${mtot}/${req} confrontos = ${pct}%  | faltam ${req - mtot} confrontos`);
  }

  console.log(`\n${'='.repeat(54)}`);
  console.log(`TOTAL rumo a "todos contra todos": ${gMet}/${gReq} = ${Math.round(100 * gMet / gReq)}%  | faltam ${gReq - gMet} confrontos`);
  console.log(`(compare com o boletim, que mede 85% sobre os jogos AGENDADOS, não sobre o round-robin completo)`);
}
run().catch(e => { console.error(e.message || e); process.exit(1); });
