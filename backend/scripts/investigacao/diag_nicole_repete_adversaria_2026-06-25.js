// READ-ONLY · 22/06/2026 · Nicole Facchini reclamou que já jogou contra a adversária
// dela no sorteio de 25/06 (Feminino). Regra FORTE: não repetir adversário de MESMA
// POSIÇÃO (oppositions.diagonal_count > 0 entre jogadoras do mesmo side).
// Mostra: round cat3 de 25/06, os matches (duplas+lados), o jogo da Nicole, a
// adversária de mesma posição e o histórico de oposição; + candidatas de troca.
const supabase = require('../../supabase');
const T = 7, CAT = 3, DATE = '2026-06-25';

async function oppo(a, b) {
  const p1 = Math.min(a, b), p2 = Math.max(a, b);
  const { data } = await supabase.from('oppositions')
    .select('times_opposed, diagonal_count, last_round_id')
    .eq('id_tournament', T).eq('id_category', CAT)
    .eq('id_player1', p1).eq('id_player2', p2).maybeSingle();
  return data || { times_opposed: 0, diagonal_count: 0 };
}

async function run() {
  const { data: rounds } = await supabase.from('rounds')
    .select('id_round, round_number, status, round_type')
    .eq('id_tournament', T).eq('id_category', CAT).eq('scheduled_date', DATE);
  console.log('Rounds cat3 em', DATE, ':', JSON.stringify(rounds));
  if (!rounds || !rounds.length) { console.log('Nenhum round feminino em 25/06.'); return; }

  // players da categoria (id->{name,side})
  const { data: players } = await supabase.from('players').select('id_player,name,side').eq('id_tournament', T).eq('category_id', CAT);
  const P = {}; (players || []).forEach(p => { P[p.id_player] = p; });
  const nm = id => P[id] ? `${P[id].name}[${P[id].side?.[0]}]` : id;

  for (const r of rounds) {
    console.log(`\n=== round ${r.id_round} #${r.round_number} ${r.status} ${r.round_type} ===`);
    const { data: doubles } = await supabase.from('doubles').select('*').eq('id_round', r.id_round);
    const dById = {}; (doubles || []).forEach(d => { dById[d.id_double] = d; });
    const { data: matches } = await supabase.from('matches')
      .select('id_match, id_double_a, id_double_b, scheduled_at, status').in('id_double_a', (doubles||[]).map(d=>d.id_double));
    for (const m of matches || []) {
      const da = dById[m.id_double_a], db = dById[m.id_double_b];
      if (!da || !db) continue;
      const hora = m.scheduled_at ? m.scheduled_at.substring(11,16) : '—';
      console.log(`\n  match ${m.id_match} (${hora}) ${m.status}`);
      console.log(`    A: ${nm(da.id_player1)} / ${nm(da.id_player2)}`);
      console.log(`    B: ${nm(db.id_player1)} / ${nm(db.id_player2)}`);
      // confrontos de MESMA POSIÇÃO entre A e B
      const aP = [da.id_player1, da.id_player2], bP = [db.id_player1, db.id_player2];
      for (const pa of aP) for (const pb of bP) {
        if (!P[pa] || !P[pb]) continue;
        if (P[pa].side === P[pb].side && P[pa].side !== 'EITHER') {
          const o = await oppo(pa, pb);
          const flag = o.diagonal_count > 0 ? '  🔴 JÁ SE ENFRENTARAM (mesma posição)' : '  ✅ inédito';
          console.log(`      mesma-pos ${P[pa].side}: ${P[pa].name} × ${P[pb].name} → diag=${o.diagonal_count} total=${o.times_opposed}${flag}`);
        }
      }
    }
  }

  // Foco Nicole: candidatas de troca de mesma posição (não enfrentadas) entre quem joga hoje
  const nicole = (players || []).find(p => /nicole/i.test(p.name));
  if (nicole) {
    console.log(`\n--- Nicole = ${nicole.name} (id ${nicole.id_player}, ${nicole.side}) ---`);
    const dt = []; for (const r of rounds) { const { data } = await supabase.from('doubles').select('*').eq('id_round', r.id_round); dt.push(...(data||[])); }
    const jogandoHoje = new Set(); dt.forEach(d => { jogandoHoje.add(d.id_player1); jogandoHoje.add(d.id_player2); });
    console.log('Adversárias de MESMA POSIÇÃO já enfrentadas vs inéditas (entre quem joga hoje):');
    for (const p of players) {
      if (p.id_player === nicole.id_player || p.side !== nicole.side) continue;
      const o = await oppo(nicole.id_player, p.id_player);
      const hoje = jogandoHoje.has(p.id_player) ? 'JOGA HOJE' : 'fora hoje';
      console.log(`   ${p.name.padEnd(22)} diag=${o.diagonal_count} total=${o.times_opposed}  [${hoje}]  ${o.diagonal_count>0?'já enfrentou':'INÉDITA'}`);
    }
  }
}
run().catch(e => { console.error(e.message || e); process.exit(1); });
