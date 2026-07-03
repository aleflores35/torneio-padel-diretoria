// Masc 4ª (round 419) — decisão Alessandro 23/06: zero repetição de adversário, quem não tem jogo
// limpo fica FORA. Categoria saturada: só cabe 1 jogo 100% limpo. Remove o jogo repetido, banca 4.
//   MANTÉM:  Gabriel/Alessandro × Marcos/Daniel  (limpo)
//   REMOVE:  Nelson/Pablo × Dinho/Helio          (3 repetições)
//   FORA:    Nelson, Pablo, Dinho, Helio
// Reverte os contadores das duplas removidas + delete conferindo .error + rebuild de oppositions depois.
// DRY:  node scripts/investigacao/aplica_masc4a_zero_2026-06-25.js
// REAL: CONFIRM_EXECUTE=yes node ...
const supabase = require('../../supabase');
const wd = require('../../services/weeklyDrawService');
const T = 7, CAT = 2, RID = 419;
const DRY = process.env.CONFIRM_EXECUTE !== 'yes';
const key = (a, b) => a < b ? `${a}-${b}` : `${b}-${a}`;
const die = (msg, e) => { console.error('🔴 ABORTOU:', msg, e ? JSON.stringify(e) : ''); process.exit(1); };
const ck = (r, what) => { if (r.error) die(`${what} falhou`, r.error); return r; };

async function main() {
  const { data: pl } = await supabase.from('players').select('id_player,name,side').eq('id_tournament', T).eq('category_id', CAT);
  const P = {}; pl.forEach(p => P[p.id_player] = p.name);
  const gg = re => { const f = pl.find(p => new RegExp(re, 'i').test(p.name)); if (!f) die(`não achei: ${re}`); return f.id_player; };
  const nelson = gg('nelson'), pablo = gg('pablo mallmann'), dinho = gg('dinho'), helio = gg('helio');
  const outSet = new Set([nelson, pablo, dinho, helio]);

  const { data: dbl } = await supabase.from('doubles').select('id_double,display_name,id_player1,id_player2').eq('id_round', RID);
  const { data: m } = await supabase.from('matches').select('id_match,id_double_a,id_double_b').in('id_double_a', dbl.map(d => d.id_double));
  const D = {}; dbl.forEach(d => D[d.id_double] = d);
  // duplas a remover = as que contêm SÓ jogadores do outSet
  const badDoubles = dbl.filter(d => outSet.has(d.id_player1) && outSet.has(d.id_player2));
  const badIds = new Set(badDoubles.map(d => d.id_double));
  const badMatches = m.filter(x => badIds.has(x.id_double_a) || badIds.has(x.id_double_b));
  // sanity: o que sobra deve ser 1 jogo limpo
  const keepMatches = m.filter(x => !badIds.has(x.id_double_a) && !badIds.has(x.id_double_b));

  console.log(`== MASC 4ª zero-repetição · ${DRY ? 'DRY' : 'EXEC'} ==`);
  console.log('REMOVER:'); badMatches.forEach(x => console.log(`  ${D[x.id_double_a].display_name} × ${D[x.id_double_b].display_name}  (match#${x.id_match})`));
  console.log('MANTER:'); keepMatches.forEach(x => console.log(`  ${D[x.id_double_a].display_name} × ${D[x.id_double_b].display_name}  (match#${x.id_match})`));
  console.log('FORA (ROTATED):', [...outSet].map(i => P[i]).join(', '));
  if (badDoubles.length !== 2 || keepMatches.length !== 1) die(`esperava 2 duplas removidas e 1 jogo mantido, achei ${badDoubles.length} duplas / ${keepMatches.length} mantidos`);

  if (DRY) { console.log('\n[DRY] nada gravado.'); return; }

  // 1) reverte contadores das 2 duplas removidas (pares de jogadores entre as duas duplas + parceria de cada dupla)
  const a = badDoubles[0], b = badDoubles[1];
  // parcerias das duplas removidas
  for (const d of [a, b]) {
    const p1 = Math.min(d.id_player1, d.id_player2), p2 = Math.max(d.id_player1, d.id_player2);
    const { data: ex } = await supabase.from('partnerships').select('id_partnership,times_paired').eq('id_tournament', T).eq('id_category', CAT).eq('id_player1', p1).eq('id_player2', p2).maybeSingle();
    if (ex) { if (ex.times_paired <= 1) ck(await supabase.from('partnerships').delete().eq('id_partnership', ex.id_partnership), 'revert partnership del'); else ck(await supabase.from('partnerships').update({ times_paired: ex.times_paired - 1, last_round_id: null }).eq('id_partnership', ex.id_partnership), 'revert partnership upd'); }
  }
  // 2) delete match(es) + duplas removidas (conferindo erro)
  for (const x of badMatches) ck(await supabase.from('matches').delete().eq('id_match', x.id_match), `delete match#${x.id_match}`);
  for (const id of badIds) ck(await supabase.from('doubles').delete().eq('id_double', id), `delete double#${id}`);
  // 3) os 4 viram ROTATED (remove qualquer attendance antiga deles antes)
  ck(await supabase.from('round_attendance').delete().eq('id_round', RID).in('id_player', [...outSet]), 'del attendance out');
  ck(await supabase.from('round_attendance').insert([...outSet].map(id => ({ id_round: RID, id_player: id, status: 'ROTATED' }))), 'insert ROTATED');

  console.log('\n✅ aplicado. (oppositions será reconstruído em seguida)');
}
main().catch(e => die('exceção', e.message));
