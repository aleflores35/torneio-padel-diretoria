// Antecipa os 4 jogos reais do Bernardo Goulart (654) — Opção B, a partir de 16/07.
// 09/07 NÃO é tocado. Move a PARTIDA inteira (id_round das 2 duplas + scheduled_at + id_court).
// NÃO re-pareia (duplas preservadas) → não mexe em partnerships/oppositions.
// DRY:  node scripts/investigacao/_move_bernardo_antecipa.js
// REAL: CONFIRM_EXECUTE=yes node scripts/investigacao/_move_bernardo_antecipa.js
const supabase = require('../../supabase');
const T = 7, CAT = 1;
const DRY = process.env.CONFIRM_EXECUTE !== 'yes';

// {match, date-alvo, slot HH:MM, court}
const MOVES = [
  { match: 1421, date: '2026-07-16', slot: '20:30', court: 16 },
  { match: 1429, date: '2026-07-16', slot: '21:50', court: 17 },
  { match: 1438, date: '2026-07-23', slot: '19:50', court: 17 },
  { match: 1446, date: '2026-07-23', slot: '21:10', court: 16 },
];

(async () => {
  if (!supabase) { console.error('SEM supabase'); process.exit(1); }
  console.log(DRY ? '*** DRY-RUN (nada gravado) ***\n' : '*** EXECUTANDO (CONFIRM) ***\n');

  // rounds cat 1 por data (hospedeiras)
  const { data: rounds } = await supabase.from('rounds').select('id_round,scheduled_date,id_category,status,round_type').eq('id_tournament', T);
  const catRoundByDate = {};
  rounds.filter(r => r.id_category===CAT && r.status!=='FINISHED' && r.round_type!=='EXHIBITION')
        .forEach(r => { if (!catRoundByDate[r.scheduled_date]) catRoundByDate[r.scheduled_date] = r; });

  const { data: players } = await supabase.from('players').select('id_player,name').eq('id_tournament', T);
  const nm = {}; players.forEach(p => nm[p.id_player]=p.name);

  const ok = [];
  for (const mv of MOVES) {
    const { data: m } = await supabase.from('matches').select('*').eq('id_match', mv.match).single();
    if (!m) { console.log(`#${mv.match} NAO ENCONTRADO`); continue; }
    const { data: dA } = await supabase.from('doubles').select('*').eq('id_double', m.id_double_a).single();
    const { data: dB } = await supabase.from('doubles').select('*').eq('id_double', m.id_double_b).single();
    const targetRound = catRoundByDate[mv.date];
    if (!targetRound) { console.log(`#${mv.match} SEM rodada cat1 em ${mv.date}`); continue; }

    const cur = String(m.scheduled_at || '');
    // preserva o "rabo" (segundos/timezone) do ISO atual, troca só data (0-10) e hora (11-16)
    const tail = cur.length > 16 ? cur.slice(16) : ':00';
    const newSched = `${mv.date}T${mv.slot}${tail}`;

    console.log(`#${m.id_match} | ${dA.display_name} × ${dB.display_name}`);
    console.log(`   round:      ${dA.id_round} (A) / ${dB.id_round} (B)  ->  ${targetRound.id_round}  (${mv.date}, cat1, ${targetRound.status})`);
    console.log(`   scheduled:  ${cur}  ->  ${newSched}`);
    console.log(`   court:      ${m.id_court}  ->  ${mv.court}`);
    if (DRY && ok.length===0) console.log(`   [match keys: ${Object.keys(m).join(', ')}]`);
    console.log('');

    if (!DRY) {
      const u1 = await supabase.from('doubles').update({ id_round: targetRound.id_round }).eq('id_double', dA.id_double);
      const u2 = await supabase.from('doubles').update({ id_round: targetRound.id_round }).eq('id_double', dB.id_double);
      const u3 = await supabase.from('matches').update({ scheduled_at: newSched, id_court: mv.court }).eq('id_match', m.id_match);
      if (u1.error||u2.error||u3.error) { console.log(`   [ERRO] ${u1.error?.message||''} ${u2.error?.message||''} ${u3.error?.message||''}`); }
      else console.log('   ✅ gravado\n');
    }
    ok.push(mv.match);
  }

  console.log(DRY ? `\n[DRY] ${ok.length} moves prontos. Rode com CONFIRM_EXECUTE=yes pra gravar.`
                  : `\n✅ ${ok.length} partidas movidas.`);
  process.exit(0);
})();
