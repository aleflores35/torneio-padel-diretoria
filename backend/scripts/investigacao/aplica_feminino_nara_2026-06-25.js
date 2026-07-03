// Aplica o Feminino DEFINITIVO de 25/06 (round 420) — decisão Alessandro 23/06: "só jogo pelo ranking"
// → Nara DENTRO (parceria não afeta ranking). Arranjo que evita as parcerias Paola/Nara e Tanise/Sabrina
// (as que a Nicole apontou). 2 jogos 100% limpos (zero repetição de adversário, verificado por buildRealDiag).
//   18:30  Nicole/Sabrina × Tanise/Amanda
//   20:30  Luana/Catiane × Mariele/Nara   (Nara 701 >= 20:30)
//   fora:  Paola, Daniela, Eduarda
// CADA delete confere .error (o bug anterior: erro silenciosamente engolido → jogos antigos sobreviveram).
// DRY:  node scripts/investigacao/aplica_feminino_nara_2026-06-25.js
// REAL: CONFIRM_EXECUTE=yes node ...
const supabase = require('../../supabase');
const wd = require('../../services/weeklyDrawService');
const T = 7, CAT = 3, RID = 420, NARA = 701, MIN_NARA = '20:30';
const DRY = process.env.CONFIRM_EXECUTE !== 'yes';
const key = (a, b) => a < b ? `${a}-${b}` : `${b}-${a}`;
const die = (msg, e) => { console.error('🔴 ABORTOU:', msg, e ? JSON.stringify(e) : ''); process.exit(1); };
const ck = (r, what) => { if (r.error) die(`${what} falhou`, r.error); return r; };

async function main() {
  const { data: pl } = await supabase.from('players').select('id_player,name,side').eq('id_tournament', T).eq('category_id', CAT);
  const P = {}, S = {}; pl.forEach(p => { P[p.id_player] = p.name; S[p.id_player] = p.side; });
  const gg = re => { const f = pl.find(p => new RegExp(re, 'i').test(p.name)); if (!f) die(`jogadora não encontrada: ${re}`); return f.id_player; };
  // resolve por NOME (evita erro de id)
  const nicole = gg('nicole'), sabrina = gg('sabrina'), tanise = gg('tanise'), amanda = gg('amanda');
  const luana = gg('luana'), catiane = gg('catiane'), mariele = gg('mariele'), nara = gg('nara nunes|^nara');
  const paola = gg('paola'), daniela = gg('daniela'), eduarda = gg('eduarda');
  if (nara !== NARA) console.log(`⚠️ Nara resolvida como ${nara} (esperado ${NARA})`);

  // jogos: [direita, esquerda] cada dupla
  const games = [
    { a: [nicole, sabrina], b: [tanise, amanda], nara: false },
    { a: [luana, catiane], b: [mariele, nara], nara: true },
  ];
  const out = [paola, daniela, eduarda];

  // valida sides + limpeza (adversário inédito) via jogos reais
  const { oppMap } = await wd.buildRealDiag(T, CAT, { excludeRoundId: RID });
  const od = (a, b) => oppMap[key(a, b)] || 0;
  for (const g of games) {
    for (const [r, l] of [g.a, g.b]) { if (S[r] !== 'RIGHT') die(`${P[r]} não é RIGHT`); if (S[l] !== 'LEFT' && S[l] !== 'EITHER') die(`${P[l]} não é LEFT`); }
    let rep = 0; for (const pa of g.a) for (const pb of g.b) if (od(pa, pb) > 0) rep++;
    if (rep > 0) die(`jogo ${P[g.a[0]]}/${P[g.a[1]]} × ${P[g.b[0]]}/${P[g.b[1]]} tem ${rep} repetição de adversário`);
  }
  const allIn = games.flatMap(g => [...g.a, ...g.b]);
  if (new Set(allIn).size !== 8) die('jogador duplicado no arranjo');

  // slots atuais do round 420
  const { data: curDbl } = await supabase.from('doubles').select('id_double').eq('id_round', RID);
  const curIds = (curDbl || []).map(d => d.id_double);
  const { data: curM } = curIds.length ? await supabase.from('matches').select('id_match,id_double_a,id_double_b,scheduled_at,id_court').or(`id_double_a.in.(${curIds.join(',')}),id_double_b.in.(${curIds.join(',')})`) : { data: [] };
  const slots = (curM || []).filter(m => m.scheduled_at).map(m => ({ at: m.scheduled_at, court: m.id_court })).sort((a, b) => a.at.localeCompare(b.at));
  const late = slots.filter(s => s.at.substring(11, 16) >= MIN_NARA), early = slots.filter(s => s.at.substring(11, 16) < MIN_NARA);
  games.forEach(g => { g.slot = g.nara ? (late.shift() || slots[slots.length - 1]) : (early.shift() || slots[0]); });

  console.log(`== FEMININO Nara · ${DRY ? 'DRY' : 'EXEC'} ==`);
  games.forEach(g => console.log(`  ${g.slot ? g.slot.at.substring(11, 16) : '??'} Q${g.slot ? g.slot.court : '?'}  ${P[g.a[0]]}/${P[g.a[1]]} × ${P[g.b[0]]}/${P[g.b[1]]}  ✅ limpo`));
  console.log(`  fora: ${out.map(id => P[id]).join(', ')}`);
  console.log(`  duplas atuais a remover: ${curIds.length} (#${curIds.join(', #')}) · matches: ${(curM || []).length}`);

  if (DRY) { console.log('\n[DRY] nada gravado.'); return; }

  // 1) apaga matches atuais (por id_match, conferindo erro)
  for (const m of (curM || [])) ck(await supabase.from('matches').delete().eq('id_match', m.id_match), `delete match#${m.id_match}`);
  // 2) apaga doubles atuais (por id_double, conferindo erro)
  for (const id of curIds) ck(await supabase.from('doubles').delete().eq('id_double', id), `delete double#${id}`);
  // 3) confirma round 420 vazio antes de criar
  const { data: chk } = await supabase.from('doubles').select('id_double').eq('id_round', RID);
  if ((chk || []).length) die(`round ${RID} ainda tem ${chk.length} duplas após delete`);
  // 4) attendance limpa
  ck(await supabase.from('round_attendance').delete().eq('id_round', RID), 'delete attendance');

  // 5) cria duplas + matches
  for (const g of games) {
    const mk = async ([r, l]) => { const r2 = ck(await supabase.from('doubles').insert({ id_tournament: T, id_player1: r, id_player2: l, display_name: `${P[r]} / ${P[l]}`, id_round: RID }).select().single(), 'insert double'); return r2.data; };
    const da = await mk(g.a), db = await mk(g.b);
    ck(await supabase.from('matches').insert({ id_tournament: T, id_double_a: da.id_double, id_double_b: db.id_double, id_court: g.slot.court, scheduled_at: g.slot.at, status: 'TO_PLAY' }), 'insert match');
  }
  // 6) attendance: jogando NO_RESPONSE, fora ROTATED
  ck(await supabase.from('round_attendance').insert([
    ...allIn.map(id => ({ id_round: RID, id_player: id, status: 'NO_RESPONSE' })),
    ...out.map(id => ({ id_round: RID, id_player: id, status: 'ROTATED' })),
  ]), 'insert attendance');

  console.log('\n✅ aplicado. (rebuild do cache oppositions/partnerships roda em seguida)');
}
main().catch(e => die('exceção', e.message));
