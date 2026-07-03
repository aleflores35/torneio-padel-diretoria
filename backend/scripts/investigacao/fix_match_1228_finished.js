// FIX guardado: match 1228 IN_PROGRESS(0x9) → FINISHED. Não altera placar nem pontos.
// Só aplica se o estado atual ainda for exatamente o esperado (guarda contra mexida paralela).
const supabase = require('../../supabase');
const ID_T = 7, MATCH = 1228;

async function run() {
  const { data: rows, error } = await supabase.from('matches')
    .select('id_match, status, games_double_a, games_double_b, id_tournament')
    .eq('id_match', MATCH);
  if (error) { console.error('read err:', error.message); process.exit(1); }
  const m = rows && rows[0];
  if (!m) { console.error('match não encontrado'); process.exit(1); }
  console.log(`antes: status=${m.status} placar ${m.games_double_a}x${m.games_double_b}`);

  if (m.id_tournament !== ID_T) { console.error('torneio inesperado, abortando'); process.exit(1); }
  if (m.status !== 'IN_PROGRESS') { console.log('⚠️  status já não é IN_PROGRESS — alguém mexeu. NADA feito.'); return; }
  if (Number(m.games_double_a) !== 0 || Number(m.games_double_b) !== 9) { console.log('⚠️  placar diferente de 0x9 — abortando por segurança. NADA feito.'); return; }

  const { error: upErr } = await supabase.from('matches').update({ status: 'FINISHED' }).eq('id_match', MATCH).eq('status', 'IN_PROGRESS');
  if (upErr) { console.error('update err:', upErr.message); process.exit(1); }

  const { data: after } = await supabase.from('matches').select('status, games_double_a, games_double_b').eq('id_match', MATCH);
  console.log(`depois: status=${after[0].status} placar ${after[0].games_double_a}x${after[0].games_double_b}`);
  console.log('✓ OK — placar e pontos intactos, só o rótulo de status mudou.');
}
run().catch(e => { console.error(e.message || e); process.exit(1); });
