// TROCA POR AUSÊNCIA (campeonato pré-sorteado). Quando um atleta avisa que não joga numa semana
// e está escalado num jogo dela, troca 1-por-1: traz um jogo da MESMA categoria de uma semana
// POSTERIOR (cujos 4 jogadores estão livres na semana do ausente, e cujo destino não cria conflito)
// pra o lugar do jogo afetado; o jogo do ausente vai pra a semana de onde veio o substituto.
// Sem candidato elegível → o jogo do ausente FICA ADIADO (nada muda, reencaixar manualmente).
// Uso:  PLAYER="nome ou regex" DATE=2026-07-09 node scripts/investigacao/troca_por_ausencia.js
// REAL: ...mesmo... CONFIRM_EXECUTE=yes node ...
const supabase = require('../../supabase');
const T = 7;
const DRY = process.env.CONFIRM_EXECUTE !== 'yes';
const QPLAYER = process.env.PLAYER || '';
const QDATE = process.env.DATE || '';
const die = (m, e) => { console.error('🔴', m, e ? JSON.stringify(e) : ''); process.exit(1); };
const ck = (r, w) => { if (r.error) die(w + ' falhou', r.error); return r; };

async function main() {
  if (!QPLAYER || !QDATE) die('faltou PLAYER e/ou DATE (ex: PLAYER="Alex Severo" DATE=2026-07-09)');
  const { data: players } = await supabase.from('players').select('id_player,name,category_id').eq('id_tournament', T);
  const Pn = {}, Cat = {}; players.forEach(p => { Pn[p.id_player] = p.name; Cat[p.id_player] = p.category_id; });
  const found = players.filter(p => new RegExp(QPLAYER, 'i').test(p.name));
  if (found.length !== 1) die(`PLAYER casou ${found.length} jogadores: ${found.map(f => f.name).join(', ') || '(nenhum)'} — seja específico`);
  const X = found[0].id_player;
  console.log(`Ausente: ${Pn[X]} · não joga em ${QDATE}`);

  // schedule completo (rounds REGULAR, matches TO_PLAY) com categoria por round
  const { data: rounds } = await supabase.from('rounds').select('id_round,id_category,round_type').eq('id_tournament', T);
  const reg = rounds.filter(r => r.round_type !== 'EXHIBITION');
  const catByRound = {}; reg.forEach(r => catByRound[r.id_round] = r.id_category);
  const { data: dbl } = await supabase.from('doubles').select('id_double,id_player1,id_player2,id_round').in('id_round', reg.map(r => r.id_round));
  const D = {}; dbl.forEach(d => D[d.id_double] = d);
  const { data: matches } = await supabase.from('matches').select('id_match,id_double_a,id_double_b,scheduled_at,id_court,status').in('id_double_a', dbl.map(d => d.id_double)).eq('status', 'TO_PLAY');
  const games = matches.map(m => { const a = D[m.id_double_a], b = D[m.id_double_b]; return { id_match: m.id_match, da: m.id_double_a, db: m.id_double_b, at: m.scheduled_at, court: m.id_court, date: (m.scheduled_at || '').substring(0, 10), cat: catByRound[a.id_round], players: [a.id_player1, a.id_player2, b.id_player1, b.id_player2], label: `${Pn[a.id_player1]}/${Pn[a.id_player2]} × ${Pn[b.id_player1]}/${Pn[b.id_player2]}` }; }).filter(g => g.cat);
  // quem joga em cada data
  const byDate = {}; games.forEach(g => { (byDate[g.date] = byDate[g.date] || []).push(g); });
  const playsOn = (pid, date, exceptMatch) => (byDate[date] || []).some(g => g.id_match !== exceptMatch && g.players.includes(pid));

  // jogos do ausente na DATE
  const affected = games.filter(g => g.date === QDATE && g.players.includes(X));
  if (!affected.length) { console.log(`${Pn[X]} NÃO tem jogo em ${QDATE} — nada a fazer.`); return; }

  const swaps = [];
  for (const A of affected) {
    // candidatos B: mesma categoria, data > QDATE, NÃO contém o ausente,
    // B livre na QDATE (4 jogadores sem outro jogo na QDATE) e A livre na data de B (sem outro jogo lá)
    const cands = games.filter(B => B.cat === A.cat && B.date > QDATE && !B.players.includes(X)
      && B.players.every(p => !playsOn(p, QDATE, null))          // B pode vir pra QDATE
      && A.players.every(p => !playsOn(p, B.date, A.id_match)));  // A pode ir pra data de B
    cands.sort((a, b) => a.date.localeCompare(b.date)); // mais cedo possível
    const B = cands[0];
    if (!B) { swaps.push({ A, B: null }); continue; }
    swaps.push({ A, B });
    // marca ocupação pra não reusar o mesmo B em 2 trocas
    B.date = '___used'; // hack: tira da elegibilidade de candidatos seguintes
  }

  console.log(`\n== TROCA POR AUSÊNCIA · ${DRY ? 'DRY' : 'EXEC'} ==`);
  for (const s of swaps) {
    const A = s.A;
    if (!s.B) { console.log(`  ⏸️ ADIADO (sem substituto elegível): ${A.date.replace('___used', QDATE)} ${A.label} — fica como está, reencaixar depois.`); continue; }
    const B = games.find(g => g.id_match === s.B.id_match);
    console.log(`  🔁 ${QDATE}: SAI "${A.label}" → entra "${B.label}" (vinha de ${B.at.substring(0, 10)})`);
    console.log(`     "${A.label}" vai pra ${B.at.substring(0, 10)} (mesma quadra/horário do que veio)`);
  }

  if (DRY) { console.log('\n[DRY] nada gravado. Rode com CONFIRM_EXECUTE=yes pra aplicar.'); return; }

  for (const s of swaps) {
    if (!s.B) continue;
    const A = s.A, B = s.B;
    // troca scheduled_at + court entre A e B
    const aAt = A.at, aCourt = A.court, bAt = B.at, bCourt = B.court;
    ck(await supabase.from('matches').update({ scheduled_at: bAt, id_court: bCourt }).eq('id_match', A.id_match), 'move A');
    ck(await supabase.from('matches').update({ scheduled_at: aAt, id_court: aCourt }).eq('id_match', B.id_match), 'move B');
  }
  console.log('\n✅ troca(s) aplicada(s). (rode o gerador da página pra atualizar o calendário)');
}
main().catch(e => die('exceção', e.message));
