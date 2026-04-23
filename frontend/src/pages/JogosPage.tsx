import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  fetchMatches,
  updateMatchStatus,
  callMatch,
  fetchMatchDetails,
  fetchSubstituteCandidates,
  substitutePlayer,
  cancelExhibitionMatch,
  type Match,
  type MatchDetails,
  type CandidatesResponse,
} from '../api';
import API_URL, { TOURNAMENT_ID } from '../config';
import {
  Monitor,
  CheckCircle,
  Play,
  Smartphone,
  Calendar,
  Trophy,
  ArrowLeft,
  Sun,
  UserX,
  X,
  ArrowRight,
  AlertCircle,
  Trash2,
} from 'lucide-react';

// Returns the ISO date string (YYYY-MM-DD) for this week's Thursday (or today if Thu)
const thisWeekThursday = (): string => {
  const d = new Date();
  const day = d.getDay(); // 0=Sun,1=Mon,...,4=Thu
  const diff = day <= 4 ? 4 - day : 11 - day;
  const thu = new Date(d);
  thu.setDate(d.getDate() + diff);
  return `${thu.getFullYear()}-${String(thu.getMonth()+1).padStart(2,'0')}-${String(thu.getDate()).padStart(2,'0')}`;
};

// Extrai horário de string ISO sem conversão de timezone: "2026-04-16T18:00:00" → "18h00"
const extractTime = (scheduledAt?: string): string => {
  if (!scheduledAt) return '';
  if (scheduledAt.includes('T')) {
    const t = scheduledAt.split('T')[1]?.substring(0, 5);
    return t ? t.replace(':', 'h') : '';
  }
  if (/^\d{2}:\d{2}/.test(scheduledAt)) return scheduledAt.substring(0, 5).replace(':', 'h');
  return '';
};

const JogosPage = () => {
  const navigate = useNavigate();
  const [matches, setMatches] = useState<Match[]>([]);
  const [categories, setCategories] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [notifying, setNotifying] = useState<number | null>(null);
  const [saving, setSaving] = useState<number | null>(null);
  const [editScores, setEditScores] = useState<Record<number, { a: number; b: number }>>({});
  const [savedFeedback, setSavedFeedback] = useState<number | null>(null);

  // Substituição
  const [subMatch, setSubMatch] = useState<MatchDetails | null>(null);
  const [subStep, setSubStep] = useState<'pick-out' | 'pick-in'>('pick-out');
  const [subOutPlayer, setSubOutPlayer] = useState<{ id_player: number; name: string } | null>(null);
  const [subCandidates, setSubCandidates] = useState<CandidatesResponse | null>(null);
  const [subLoading, setSubLoading] = useState(false);
  const [subError, setSubError] = useState<string | null>(null);

  // Ausências por jogador no match (state local sincronizado com absent_player_ids)
  const [absentsByMatch, setAbsentsByMatch] = useState<Record<number, number[]>>({});
  const [absenceSaving, setAbsenceSaving] = useState<string | null>(null); // `${matchId}-${playerId}`

  // Modal "Completar a Noite · Amistosos"
  const [exhibitionModal, setExhibitionModal] = useState(false);
  const [exhibitionDate, setExhibitionDate] = useState<string>('');
  const [nightStatus, setNightStatus] = useState<{ total_slots: number; matches_scheduled: number; slots_remaining: number; scheduled_player_ids: number[] } | null>(null);
  const [addingExhibition, setAddingExhibition] = useState<number | null>(null);
  const [numMatchesByCat, setNumMatchesByCat] = useState<Record<number, number>>({ 1: 1, 2: 1, 3: 1 });
  const [allPlayersByCat, setAllPlayersByCat] = useState<Record<number, { id_player: number; name: string }[]>>({});
  const [absencesByDate, setAbsencesByDate] = useState<Record<string, number[]>>({});

  const toggleAbsence = async (matchId: number, playerId: number, absent: boolean) => {
    const key = `${matchId}-${playerId}`;
    setAbsenceSaving(key);
    // Optimistic update
    setAbsentsByMatch(prev => {
      const current = prev[matchId] || [];
      const next = absent
        ? (current.includes(playerId) ? current : [...current, playerId])
        : current.filter(p => p !== playerId);
      return { ...prev, [matchId]: next };
    });
    try {
      const res = await fetch(`${API_URL}/api/matches/${matchId}/absence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_player: playerId, absent })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Erro ao marcar ausência');
      setAbsentsByMatch(prev => ({ ...prev, [matchId]: data.absent_player_ids || [] }));
    } catch (err: any) {
      alert(err.message || 'Erro ao marcar ausência');
      // Revert on error
      await loadMatches();
    } finally {
      setAbsenceSaving(null);
    }
  };

  const todayThursday = thisWeekThursday();

  const loadMatches = async () => {
    setLoading(true);
    try {
      const data = await fetchMatches(TOURNAMENT_ID);
      setMatches(data);
      // Popula o estado de ausências a partir do response do backend
      const absMap: Record<number, number[]> = {};
      (data as any[]).forEach(m => {
        if (Array.isArray(m.absent_player_ids)) absMap[m.id_match] = m.absent_player_ids;
      });
      setAbsentsByMatch(absMap);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMatches();
    fetch(`${API_URL}/api/tournaments/${TOURNAMENT_ID}/categories`)
      .then(r => r.ok ? r.json() : [])
      .then((cats: { id: number; name: string }[]) => {
        const map: Record<number, string> = {};
        cats.forEach(c => { map[c.id] = c.name; });
        setCategories(map);
      })
      .catch(() => {});
    // pré-carrega atletas por categoria (usado no modal de amistosos)
    [1, 2, 3].forEach(cid => {
      fetch(`${API_URL}/api/tournaments/${TOURNAMENT_ID}/players?category=${cid}`)
        .then(r => r.ok ? r.json() : [])
        .then(list => setAllPlayersByCat(prev => ({ ...prev, [cid]: list })))
        .catch(() => {});
    });
  }, []);

  const openExhibitionModal = async (date?: string) => {
    const thu = date || todayThursday;
    setExhibitionDate(thu);
    setExhibitionModal(true);
    setNightStatus(null);
    try {
      const [nsRes, absRes] = await Promise.all([
        fetch(`${API_URL}/api/tournaments/${TOURNAMENT_ID}/night-status?date=${thu}`),
        fetch(`${API_URL}/api/tournaments/${TOURNAMENT_ID}/absences?date=${thu}`)
      ]);
      if (nsRes.ok) setNightStatus(await nsRes.json());
      if (absRes.ok) {
        const abs = await absRes.json();
        setAbsencesByDate(prev => ({ ...prev, [thu]: abs.map((a: any) => a.id_player) }));
      }
    } catch {}
  };

  const handleAddExhibition = async (catId: number) => {
    setAddingExhibition(catId);
    try {
      const absences = absencesByDate[exhibitionDate] || [];
      const numMatches = Math.max(1, numMatchesByCat[catId] || 1);
      const res = await fetch(`${API_URL}/api/tournaments/${TOURNAMENT_ID}/categories/${catId}/add-exhibition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scheduled_date: exhibitionDate,
          num_matches: numMatches,
          excluded_player_ids: absences,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao criar amistoso');
      // refresh matches + night status
      await loadMatches();
      const nsRes = await fetch(`${API_URL}/api/tournaments/${TOURNAMENT_ID}/night-status?date=${exhibitionDate}`);
      if (nsRes.ok) setNightStatus(await nsRes.json());
      const scheduleLines = (data.schedule || []).map((s: any) => `  Jogo ${s.match}: ${s.court} · ${s.time}`).join('\n');
      alert(`✅ ${numMatches} jogo(s) amistoso(s) criados e já alocados!\n\n${scheduleLines}`);
    } catch (err: any) {
      alert(err.message);
    } finally { setAddingExhibition(null); }
  };

  const handleStartMatch = async (matchId: number) => {
    try {
      await updateMatchStatus(matchId, 'IN_PROGRESS');
      loadMatches();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao iniciar jogo');
    }
  };

  const handleRegisterResult = async (match: Match) => {
    const scores = editScores[match.id_match] || { a: match.games_double_a, b: match.games_double_b };
    const { a, b } = scores;
    if (a < 0 || b < 0 || a > 9 || b > 9) {
      alert('Placar inválido. Use valores entre 0 e 9.');
      return;
    }
    if (a === 0 && b === 0) {
      if (!confirm('Ambos os placares são 0. Deseja registrar como WO?')) return;
    }
    if (a === b && a > 0) {
      alert('Empate não é permitido no padel. Informe o placar correto.');
      return;
    }
    setSaving(match.id_match);
    try {
      await updateMatchStatus(match.id_match, 'FINISHED', a, b);
      setEditScores(prev => { const next = { ...prev }; delete next[match.id_match]; return next; });
      setSavedFeedback(match.id_match);
      setTimeout(() => setSavedFeedback(null), 2000);
      loadMatches();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao registrar resultado');
    } finally {
      setSaving(null);
    }
  };

  const handleNotify = async (matchId: number) => {
    setNotifying(matchId);
    try {
      await callMatch(matchId);
      loadMatches();
    } finally {
      setNotifying(null);
    }
  };

  const openSubstitute = async (matchId: number) => {
    setSubLoading(true);
    setSubError(null);
    setSubStep('pick-out');
    setSubOutPlayer(null);
    setSubCandidates(null);
    try {
      const details = await fetchMatchDetails(matchId);
      setSubMatch(details);
    } catch (err: any) {
      alert(err?.response?.data?.error || err.message || 'Erro ao carregar jogo');
    } finally {
      setSubLoading(false);
    }
  };

  const pickOutPlayer = async (p: { id_player: number; name: string }) => {
    if (!subMatch) return;
    setSubLoading(true);
    setSubError(null);
    setSubOutPlayer(p);
    try {
      const result = await fetchSubstituteCandidates(subMatch.id_match, p.id_player);
      setSubCandidates(result);
      setSubStep('pick-in');
    } catch (err: any) {
      setSubError(err?.response?.data?.error || err.message || 'Erro ao buscar candidatos');
    } finally {
      setSubLoading(false);
    }
  };

  const confirmSubstitute = async (inPlayerId: number) => {
    if (!subMatch || !subOutPlayer) return;
    setSubLoading(true);
    setSubError(null);
    try {
      await substitutePlayer(subMatch.id_match, subOutPlayer.id_player, inPlayerId);
      setSubMatch(null);
      setSubCandidates(null);
      setSubOutPlayer(null);
      loadMatches();
    } catch (err: any) {
      setSubError(err?.response?.data?.error || err.message || 'Erro ao substituir');
    } finally {
      setSubLoading(false);
    }
  };

  const closeSubstitute = () => {
    setSubMatch(null);
    setSubCandidates(null);
    setSubOutPlayer(null);
    setSubError(null);
  };

  const [cancellingMatch, setCancellingMatch] = useState<number | null>(null);
  const handleCancelExhibition = async (matchId: number, displayA: string, displayB: string) => {
    if (!window.confirm(`Cancelar amistoso "${displayA} × ${displayB}"?\n\nEle some da agenda da noite.`)) return;
    setCancellingMatch(matchId);
    try {
      await cancelExhibitionMatch(matchId);
      await loadMatches();
    } catch (err: any) {
      alert(err?.response?.data?.error || err.message || 'Erro ao cancelar amistoso');
    } finally {
      setCancellingMatch(null);
    }
  };

  const setScore = (matchId: number, side: 'a' | 'b', value: number) => {
    setEditScores(prev => ({
      ...prev,
      [matchId]: {
        a: side === 'a' ? value : (prev[matchId]?.a ?? 0),
        b: side === 'b' ? value : (prev[matchId]?.b ?? 0),
      }
    }));
  };

  const statusColors: Record<string, string> = {
    FINISHED: 'bg-green-500/20 text-green-400 border border-green-500/30',
    IN_PROGRESS: 'bg-premium-accent/20 text-premium-accent border border-premium-accent/30',
    LIVE: 'bg-premium-accent/20 text-premium-accent border border-premium-accent/30',
    CALLING: 'bg-amber-500/20 text-amber-500 border border-amber-500/30 animate-pulse',
    TO_PLAY: 'bg-white/5 text-zinc-400 border border-white/10',
    WO: 'bg-red-500/20 text-red-400 border border-red-500/30',
  };

  const translateStatus = (status: string): string => {
    const map: Record<string, string> = {
      FINISHED: 'Finalizado', IN_PROGRESS: 'Em Jogo', LIVE: 'Em Jogo',
      CALLING: 'Chamando', TO_PLAY: 'Aguardando', WO: 'WO',
    };
    return map[status] || status;
  };

  // ---------- grouping by date ----------
  // All dates present in matches, sorted upcoming first
  const allDates = [...new Set(matches.map(m => (m as any).scheduled_date).filter(Boolean))].sort();
  const upcomingDates = allDates.filter(d => d >= todayThursday);
  const pastDates = allDates.filter(d => d < todayThursday).reverse();
  const orderedDates = [...upcomingDates, ...pastDates];

  const thisThursdayMatches = matches.filter(m => (m as any).scheduled_date === todayThursday);
  const hasThisThursday = thisThursdayMatches.length > 0;

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-1000">

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/5 border border-white/10 rounded-full text-[10px] font-black text-zinc-500 uppercase tracking-widest leading-none">
            <Calendar size={12} />
            Ranking SRB - Quinta 18h-23h
          </div>
          <h2 className="text-5xl font-black italic uppercase tracking-tighter leading-none">
            Jogos &<br /><span className="text-premium-accent">Placar</span>
          </h2>
          <p className="text-zinc-500 text-sm max-w-md">
            Inicie o jogo, informe o placar e finalize. Os pontos são calculados automaticamente no Ranking.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => navigate('/rodadas')}
            className="bg-white/5 hover:bg-white/10 border border-white/10 px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all inline-flex items-center gap-2"
          >
            <ArrowLeft size={14} /> Rodadas
          </button>
          <button
            onClick={() => openExhibitionModal()}
            className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all inline-flex items-center gap-2"
          >
            ⚠ Completar Noite · Amistosos
          </button>
          <button
            onClick={() => navigate('/ranking')}
            className="bg-premium-accent/20 hover:bg-premium-accent/30 text-premium-accent border border-premium-accent/30 px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all inline-flex items-center gap-2"
          >
            <Trophy size={14} /> Ver Ranking
          </button>
        </div>
      </div>

      {/* Flow indicator */}
      <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-zinc-600">
        <span className="bg-white/5 px-3 py-1.5 rounded-lg border border-white/10 cursor-pointer hover:text-white transition-all" onClick={() => navigate('/rodadas')}>Rodadas</span>
        <span>→</span>
        <span className="bg-premium-accent/20 text-premium-accent px-3 py-1.5 rounded-lg border border-premium-accent/30">Jogos & Placar</span>
        <span>→</span>
        <span className="bg-white/5 px-3 py-1.5 rounded-lg border border-white/10 cursor-pointer hover:text-white transition-all" onClick={() => navigate('/ranking')}>Ranking</span>
      </div>

      {/* Status bar */}
      {!loading && hasThisThursday && (
        <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest">
          <Sun size={12} className="text-premium-accent" />
          <span className="text-zinc-400">Esta quinta</span>
          <span className="text-premium-accent font-black">{new Date(todayThursday + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}</span>
          <span className="text-zinc-600">·</span>
          <span className="text-zinc-500">{thisThursdayMatches.length} jogos</span>
        </div>
      )}

      {/* Matches */}
      <div className="space-y-12">
        {loading ? (
          <div className="py-20 text-center animate-pulse text-zinc-500 font-black uppercase tracking-widest text-xs">
            Sincronizando jogos...
          </div>
        ) : orderedDates.length === 0 ? (
          <div className="py-20 text-center text-zinc-600 font-black uppercase tracking-widest text-xs space-y-2">
            <Sun size={32} className="mx-auto text-zinc-700 mb-4" />
            <p>Nenhum jogo agendado ainda</p>
            <p className="text-zinc-700 font-bold normal-case text-[11px]">Vá em Rodadas & Duplas para sortear a semana</p>
          </div>
        ) : (
          <>
            {orderedDates.map((date) => {
              const dateMatches = matches.filter(m => (m as any).scheduled_date === date);
              const isThisThursday = date === todayThursday;
              const isPast = date < todayThursday;
              const dateLabel = new Date(date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
              return (
                <div key={date} className={`space-y-6 ${isPast ? 'opacity-50' : ''}`}>
                  <div className="flex items-center gap-4">
                    <div className="h-px flex-1 bg-white/5" />
                    <h3 className={`text-sm font-black uppercase tracking-[0.2em] px-6 py-2 rounded-full border flex items-center gap-2 ${
                      isThisThursday
                        ? 'bg-premium-accent/10 text-premium-accent border-premium-accent/30'
                        : 'text-zinc-500 bg-black/40 border-white/5'
                    }`}>
                      {isThisThursday && <Sun size={12} />}
                      {!isThisThursday && <Calendar size={12} />}
                      {dateLabel}
                      {isThisThursday && <span className="text-[9px] bg-premium-accent text-black px-2 py-0.5 rounded-full font-black">ESTA QUINTA</span>}
                    </h3>
                    <div className="h-px flex-1 bg-white/5" />
                  </div>
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    {dateMatches.map((match) => renderMatchCard(match))}
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>

      {/* Modal de Substituição */}
      {/* Modal: Completar a Noite (Amistosos) */}
      {exhibitionModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-amber-500/30 rounded-3xl p-6 w-full max-w-2xl max-h-[90vh] flex flex-col gap-5">
            <div className="flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-xl font-black uppercase tracking-tight text-amber-300">⚠ Completar a Noite</h3>
                <p className="text-[11px] text-zinc-500 mt-1">Jogos AMISTOSOS. Não contam pontos no ranking. Atletas que já jogam oficial podem entrar também.</p>
              </div>
              <button onClick={() => setExhibitionModal(false)} className="text-zinc-500 hover:text-white"><X size={20} /></button>
            </div>

            <div className="shrink-0 space-y-1.5">
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Data da Quinta</label>
              <input type="date" value={exhibitionDate}
                onChange={e => { setExhibitionDate(e.target.value); openExhibitionModal(e.target.value); }}
                className="w-full h-12 bg-white/5 border border-white/10 text-white rounded-xl px-4 focus:border-amber-500 outline-none text-sm font-bold"
              />
            </div>

            {nightStatus ? (
              <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-4 grid grid-cols-3 gap-3 text-center shrink-0">
                <div>
                  <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1">Capacidade</p>
                  <p className="text-2xl font-black text-white">{nightStatus.total_slots}</p>
                </div>
                <div>
                  <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1">Agendados</p>
                  <p className="text-2xl font-black text-premium-accent">{nightStatus.matches_scheduled}</p>
                </div>
                <div>
                  <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1">Vagas Livres</p>
                  <p className={`text-2xl font-black ${nightStatus.slots_remaining > 0 ? 'text-amber-300' : 'text-zinc-600'}`}>{nightStatus.slots_remaining}</p>
                </div>
              </div>
            ) : (
              <div className="text-center text-sm text-zinc-500 py-8 shrink-0">Carregando…</div>
            )}

            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {[1, 2, 3].map(catId => {
                const catName = categories[catId] || `Categoria ${catId}`;
                const absent = absencesByDate[exhibitionDate] || [];
                const catPlayers = allPlayersByCat[catId] || [];
                const eligible = catPlayers.filter(p => !absent.includes(p.id_player));
                const maxMatches = Math.min(
                  Math.floor(eligible.length / 4),
                  nightStatus?.slots_remaining ?? 0
                );
                const n = numMatchesByCat[catId] || 1;
                const canAdd = maxMatches >= 1 && !addingExhibition;

                return (
                  <div key={catId} className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 space-y-3">
                    <div className="flex justify-between items-center">
                      <p className="text-sm font-black text-white">{catName}</p>
                      <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                        {eligible.length} disponíveis · até {maxMatches} amistoso(s)
                      </span>
                    </div>
                    {maxMatches >= 1 ? (
                      <div className="flex items-center gap-3">
                        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Jogos:</label>
                        <select
                          value={Math.min(n, maxMatches)}
                          onChange={e => setNumMatchesByCat(prev => ({ ...prev, [catId]: Number(e.target.value) }))}
                          className="bg-white/5 border border-white/10 text-white rounded-lg px-3 py-1.5 text-sm font-bold"
                        >
                          {Array.from({ length: maxMatches }, (_, i) => i + 1).map(v => (
                            <option key={v} value={v}>{v}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => handleAddExhibition(catId)}
                          disabled={!canAdd}
                          className="flex-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all disabled:opacity-40"
                        >
                          {addingExhibition === catId ? 'Criando…' : `+ Amistoso · ${Math.min(n, maxMatches)} jogo(s)`}
                        </button>
                      </div>
                    ) : (
                      <p className="text-[11px] text-zinc-600">
                        {eligible.length < 4 ? 'Atletas disponíveis insuficientes (mínimo 4).' : 'Sem vagas livres na noite.'}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="shrink-0 text-[11px] text-zinc-500 border-t border-white/5 pt-3">
              Os jogos amistosos são criados e alocados automaticamente. Aparecem aqui logo em seguida.
            </div>
          </div>
        </div>
      )}

      {subMatch && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
             onClick={closeSubstitute}>
          <div className="premium-card !p-0 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
               onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="p-6 border-b border-white/10 flex items-center justify-between">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-500/10 border border-amber-500/30 rounded-full text-[10px] font-black text-amber-400 uppercase tracking-widest">
                  <UserX size={12} /> Substituir Jogador
                </div>
                <h3 className="text-2xl font-black italic uppercase tracking-tighter mt-2">
                  {subStep === 'pick-out' ? 'Quem saiu?' : 'Escolha o substituto'}
                </h3>
                <p className="text-[11px] text-zinc-500 mt-1">
                  {subStep === 'pick-out'
                    ? 'Clique no jogador que não poderá jogar'
                    : `Substituindo ${subOutPlayer?.name} · parceiro ${subCandidates?.partner.name} (${subCandidates?.partner.side === 'RIGHT' ? 'DIR' : subCandidates?.partner.side === 'LEFT' ? 'ESQ' : 'AMBOS'})`}
                </p>
              </div>
              <button onClick={closeSubstitute} className="p-2 text-zinc-500 hover:text-white hover:bg-white/5 rounded-xl transition-all">
                <X size={18} />
              </button>
            </div>

            {/* Error */}
            {subError && (
              <div className="m-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-3">
                <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
                <p className="text-[12px] text-red-400 font-bold">{subError}</p>
              </div>
            )}

            {/* Body */}
            <div className="p-6">
              {subLoading && (
                <div className="py-10 text-center text-zinc-500 font-black uppercase tracking-widest text-xs animate-pulse">
                  Carregando...
                </div>
              )}

              {!subLoading && subStep === 'pick-out' && subMatch && (
                <div className="space-y-4">
                  {[subMatch.double_a, subMatch.double_b].map((dbl, i) => (
                    <div key={dbl.id_double} className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
                      <p className="text-[9px] font-black uppercase tracking-widest text-zinc-600 mb-3">Dupla {i === 0 ? 'A' : 'B'}</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {dbl.players.map((p) => (
                          <button key={p.id_player} onClick={() => pickOutPlayer(p)}
                            className="flex items-center justify-between gap-3 px-4 py-3 bg-white/5 hover:bg-amber-500/20 border border-white/5 hover:border-amber-500/50 rounded-xl transition-all text-left group">
                            <div>
                              <p className="text-sm font-black italic uppercase text-white group-hover:text-amber-400">{p.name}</p>
                              <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mt-0.5">
                                {p.side === 'RIGHT' ? 'Direita' : p.side === 'LEFT' ? 'Esquerda' : 'Ambos'}
                              </p>
                            </div>
                            <ArrowRight size={14} className="text-zinc-600 group-hover:text-amber-400" />
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {!subLoading && subStep === 'pick-in' && subCandidates && (
                <div className="space-y-4">
                  {subCandidates.candidates.length === 0 ? (
                    <div className="py-10 text-center text-zinc-500 space-y-2">
                      <AlertCircle size={32} className="mx-auto text-zinc-700 mb-2" />
                      <p className="font-black uppercase tracking-widest text-xs">Nenhum substituto disponível</p>
                      <p className="text-[11px] text-zinc-600 normal-case">
                        Não há jogadores livres com lado compatível com {subCandidates.partner.name}.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500 flex items-center gap-2">
                        <span>{subCandidates.candidates.length} candidato(s)</span>
                        <span className="text-zinc-700">·</span>
                        <span>Prioridade: disponíveis &gt; ausentes</span>
                      </div>
                      <div className="grid grid-cols-1 gap-2">
                        {subCandidates.candidates.map((c) => {
                          const isAvailable = ['ROTATED', 'NOT_SELECTED', 'BYE'].includes(c.attendance_status);
                          const statusLabel = isAvailable ? 'Disponível'
                            : c.attendance_status === 'DECLINED' ? 'Ausente'
                            : 'Selecionado';
                          const statusColor = isAvailable
                            ? 'bg-green-500/20 text-green-400 border-green-500/30'
                            : c.attendance_status === 'DECLINED'
                            ? 'bg-red-500/20 text-red-400 border-red-500/30'
                            : 'bg-white/5 text-zinc-400 border-white/10';
                          return (
                            <button key={c.id_player} onClick={() => confirmSubstitute(c.id_player)}
                              disabled={subLoading}
                              className="flex items-center justify-between gap-3 px-4 py-3 bg-white/5 hover:bg-premium-accent/20 border border-white/5 hover:border-premium-accent/50 rounded-xl transition-all text-left group disabled:opacity-50">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-black italic uppercase text-white group-hover:text-premium-accent truncate">{c.name}</p>
                                <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mt-0.5">
                                  {c.side === 'RIGHT' ? 'Direita' : c.side === 'LEFT' ? 'Esquerda' : 'Ambos'}
                                </p>
                              </div>
                              <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${statusColor}`}>
                                {statusLabel}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}

                  <button onClick={() => { setSubStep('pick-out'); setSubOutPlayer(null); setSubCandidates(null); setSubError(null); }}
                    className="w-full mt-4 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-zinc-400 transition-all flex items-center justify-center gap-2">
                    <ArrowLeft size={12} /> Trocar jogador que sai
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  function renderMatchCard(match: Match) {
    const m = match as any;
    const scores = editScores[match.id_match];
    const scoreA = scores?.a ?? match.games_double_a;
    const scoreB = scores?.b ?? match.games_double_b;
    const isFinished = match.status === 'FINISHED';
    const isWO = match.status === 'WO';
    const isEditable = !isWO; // admin can register/edit score anytime except WO
    const hasUnsavedChanges = scores && (scores.a !== match.games_double_a || scores.b !== match.games_double_b);
    const time = extractTime(match.scheduled_at);
    const catName = m.id_category ? (categories[m.id_category] || null) : null;

    const isExhibition = match.round_type === 'EXHIBITION';

    return (
      <div key={match.id_match} className={`premium-card !p-0 overflow-hidden transition-all duration-500 ${isExhibition ? 'border-amber-500/40' : isFinished ? 'border-green-500/20 opacity-75' : isWO ? 'border-red-500/20 opacity-60' : 'border-white/5 hover:border-premium-accent/50'}`}>
        {/* Banner Amistoso */}
        {isExhibition && (
          <div className="px-4 py-2 bg-amber-500/15 border-b border-amber-500/30 flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-[0.15em] text-amber-300">
              ⚠ Amistoso · Não conta pro ranking
            </span>
          </div>
        )}
        {/* Categoria em evidência */}
        {catName && (
          <div className="px-4 pt-3 pb-0">
            <span className="inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.15em] text-premium-accent bg-premium-accent/10 border border-premium-accent/25 px-3 py-1 rounded-full">
              <Trophy size={9} />
              {catName}
            </span>
          </div>
        )}
        {/* Header */}
        <div className="p-4 border-b border-white/5 flex justify-between items-center bg-white/[0.01]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/5 rounded-xl text-zinc-500">
              <Monitor size={14} />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{m.court_name}</span>
              {time && <span className="text-[10px] font-black text-premium-accent/70 ml-2 bg-premium-accent/10 px-2 py-0.5 rounded-full">{time}</span>}
            </div>
          </div>
          <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${statusColors[match.status] || ''}`}>
            {translateStatus(match.status)}
          </span>
        </div>

        {/* Teams and Score — stacked on mobile, row on desktop */}
        <div className="p-4 sm:p-6">
          {/* Mobile layout: team A / score / team B stacked */}
          <div className="flex flex-col gap-2 sm:hidden">
            <div className="flex items-center justify-between gap-2">
              <p className={`text-sm font-black italic uppercase leading-tight flex-1 min-w-0 truncate ${isFinished && scoreA > scoreB ? 'text-green-400' : 'text-white'}`}>
                {m.double_a_name}
              </p>
              {isEditable ? (
                <input type="number" min="0" max="9"
                  className="w-12 h-10 bg-white/5 border-2 border-premium-accent/50 rounded-xl text-center text-xl font-black italic text-white focus:border-premium-accent outline-none"
                  value={scoreA}
                  onChange={(e) => setScore(match.id_match, 'a', Math.max(0, Math.min(9, parseInt(e.target.value) || 0)))}
                />
              ) : (
                <div className={`w-12 h-10 bg-white/5 rounded-xl flex items-center justify-center text-xl font-black italic ${isFinished && scoreA > scoreB ? 'text-green-400 border border-green-500/30' : 'text-white border border-white/10'}`}>
                  {isWO ? '—' : scoreA}
                </div>
              )}
            </div>
            <div className="text-center text-zinc-700 font-black text-xs tracking-widest">× VS ×</div>
            <div className="flex items-center justify-between gap-2">
              <p className={`text-sm font-black italic uppercase leading-tight flex-1 min-w-0 truncate ${isFinished && scoreB > scoreA ? 'text-green-400' : 'text-white'}`}>
                {m.double_b_name}
              </p>
              {isEditable ? (
                <input type="number" min="0" max="9"
                  className="w-12 h-10 bg-white/5 border-2 border-premium-accent/50 rounded-xl text-center text-xl font-black italic text-white focus:border-premium-accent outline-none"
                  value={scoreB}
                  onChange={(e) => setScore(match.id_match, 'b', Math.max(0, Math.min(9, parseInt(e.target.value) || 0)))}
                />
              ) : (
                <div className={`w-12 h-10 bg-white/5 rounded-xl flex items-center justify-center text-xl font-black italic ${isFinished && scoreB > scoreA ? 'text-green-400 border border-green-500/30' : 'text-white border border-white/10'}`}>
                  {isWO ? '—' : scoreB}
                </div>
              )}
            </div>
          </div>

          {/* Desktop layout: row */}
          <div className="hidden sm:flex items-center justify-between gap-4">
            <div className="flex-1 text-right min-w-0">
              <p className={`text-lg font-black italic uppercase leading-tight truncate ${isFinished && scoreA > scoreB ? 'text-green-400' : ''}`}>
                {m.double_a_name}
              </p>
              <p className="text-[9px] text-zinc-600 font-bold tracking-widest uppercase mt-1">Dupla A</p>
            </div>
            <div className="flex items-center gap-3 shrink-0 px-2">
              {isEditable ? (
                <>
                  <input type="number" min="0" max="9"
                    className="w-14 h-14 bg-white/5 border-2 border-premium-accent/50 rounded-2xl text-center text-2xl font-black italic text-white focus:border-premium-accent outline-none transition-all"
                    value={scoreA}
                    onChange={(e) => setScore(match.id_match, 'a', Math.max(0, Math.min(9, parseInt(e.target.value) || 0)))}
                  />
                  <div className="text-zinc-600 font-black text-lg">×</div>
                  <input type="number" min="0" max="9"
                    className="w-14 h-14 bg-white/5 border-2 border-premium-accent/50 rounded-2xl text-center text-2xl font-black italic text-white focus:border-premium-accent outline-none transition-all"
                    value={scoreB}
                    onChange={(e) => setScore(match.id_match, 'b', Math.max(0, Math.min(9, parseInt(e.target.value) || 0)))}
                  />
                </>
              ) : (
                <>
                  <div className={`w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center text-2xl font-black italic ${isFinished && scoreA > scoreB ? 'text-green-400 border border-green-500/30' : 'text-white border border-white/10'}`}>
                    {isWO ? '—' : scoreA}
                  </div>
                  <div className="text-zinc-700 font-black text-lg">×</div>
                  <div className={`w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center text-2xl font-black italic ${isFinished && scoreB > scoreA ? 'text-green-400 border border-green-500/30' : 'text-white border border-white/10'}`}>
                    {isWO ? '—' : scoreB}
                  </div>
                </>
              )}
            </div>
            <div className="flex-1 text-left min-w-0">
              <p className={`text-lg font-black italic uppercase leading-tight truncate ${isFinished && scoreB > scoreA ? 'text-green-400' : ''}`}>
                {m.double_b_name}
              </p>
              <p className="text-[9px] text-zinc-600 font-bold tracking-widest uppercase mt-1">Dupla B</p>
            </div>
          </div>
        </div>

        {/* Marcar faltas — 1 toggle por jogador. Oculto em jogos FINISHED com placar real. */}
        {(() => {
          const absents = absentsByMatch[match.id_match] || [];
          const dAPlayers: { id_player: number; name: string }[] = m.double_a_players || [];
          const dBPlayers: { id_player: number; name: string }[] = m.double_b_players || [];
          const allPlayers = [...dAPlayers, ...dBPlayers];
          if (allPlayers.length === 0) return null;
          const hideToggles = isFinished && scoreA > 0 && scoreB > 0;
          if (hideToggles) return null;
          return (
            <div className="px-4 pb-3 pt-0 border-t border-white/5">
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-600 mb-2 flex items-center gap-1.5">
                <UserX size={10} /> Marcar Faltas (WO individual)
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {allPlayers.map(p => {
                  const isAbsent = absents.includes(p.id_player);
                  const saving = absenceSaving === `${match.id_match}-${p.id_player}`;
                  return (
                    <button key={p.id_player}
                      onClick={() => toggleAbsence(match.id_match, p.id_player, !isAbsent)}
                      disabled={saving}
                      className={`text-[10px] font-black uppercase tracking-widest px-2 py-1.5 rounded-lg border transition-all flex items-center justify-between gap-1.5 disabled:opacity-50 ${
                        isAbsent
                          ? 'bg-red-500/15 text-red-400 border-red-500/30'
                          : 'bg-white/5 text-zinc-400 border-white/10 hover:bg-white/10'
                      }`}>
                      <span className={`truncate ${isAbsent ? 'line-through' : ''}`}>{p.name}</span>
                      <span className="text-[8px] shrink-0">{isAbsent ? 'FALTOU' : 'PRESENTE'}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* Actions */}
        <div className="p-4 bg-white/[0.02] border-t border-white/5 flex flex-wrap gap-2 items-center justify-between">
          <div className="flex gap-2 flex-wrap">
            {match.status === 'TO_PLAY' && (
              <>
                <button onClick={() => handleStartMatch(match.id_match)}
                  className="flex items-center gap-2 px-4 py-2 bg-premium-accent text-black rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all">
                  <Play size={14} fill="currentColor" /> Iniciar Jogo
                </button>
                <button onClick={() => handleNotify(match.id_match)} disabled={notifying === match.id_match}
                  className="flex items-center gap-2 px-4 py-2 bg-white/5 text-zinc-500 rounded-xl text-[10px] font-black uppercase tracking-widest border border-white/10 hover:bg-white/10 transition-all">
                  <Smartphone size={14} className={notifying === match.id_match ? 'animate-bounce' : ''} />
                  {notifying === match.id_match ? 'Enviando...' : 'Notificar'}
                </button>
                <button onClick={() => openSubstitute(match.id_match)}
                  className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 text-amber-400 rounded-xl text-[10px] font-black uppercase tracking-widest border border-amber-500/30 hover:bg-amber-500/20 transition-all">
                  <UserX size={14} /> Substituir
                </button>
              </>
            )}

            {match.status === 'CALLING' && (
              <>
                <button onClick={() => handleStartMatch(match.id_match)}
                  className="flex items-center gap-2 px-4 py-2 bg-premium-accent text-black rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all">
                  <Play size={14} fill="currentColor" /> Iniciar Jogo
                </button>
                <button onClick={() => openSubstitute(match.id_match)}
                  className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 text-amber-400 rounded-xl text-[10px] font-black uppercase tracking-widest border border-amber-500/30 hover:bg-amber-500/20 transition-all">
                  <UserX size={14} /> Substituir
                </button>
              </>
            )}

            {isEditable && (scoreA > 0 || scoreB > 0 || hasUnsavedChanges) && (
              <button onClick={() => handleRegisterResult(match)} disabled={saving === match.id_match}
                className="flex items-center gap-2 px-4 py-2 bg-green-500/20 text-green-400 rounded-xl text-[10px] font-black uppercase tracking-widest border border-green-500/30 hover:bg-green-500/30 transition-all disabled:opacity-50">
                <CheckCircle size={14} /> {saving === match.id_match ? 'Registrando...' : (isFinished ? 'Atualizar Placar' : 'Registrar Resultado')}
              </button>
            )}
            {savedFeedback === match.id_match && (
              <span className="text-green-400 text-[10px] font-black uppercase tracking-widest animate-pulse">✓ Salvo!</span>
            )}

            {isFinished && !hasUnsavedChanges && (
              <span className="text-[10px] font-black uppercase tracking-widest text-green-400 flex items-center gap-2">
                <CheckCircle size={14} />
                {scoreA > scoreB ? m.double_a_name : scoreB > scoreA ? m.double_b_name : 'WO'} venceu • +3 pts
              </span>
            )}

            {isWO && (
              <span className="text-[10px] font-black uppercase tracking-widest text-red-400">
                W.O. — sem resultado até domingo
              </span>
            )}

            {isExhibition && !isFinished && match.status !== 'IN_PROGRESS' && (
              <button onClick={() => handleCancelExhibition(match.id_match, m.double_a_name, m.double_b_name)}
                disabled={cancellingMatch === match.id_match}
                className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-400 rounded-xl text-[10px] font-black uppercase tracking-widest border border-red-500/30 hover:bg-red-500/20 transition-all disabled:opacity-50">
                <Trash2 size={14} />
                {cancellingMatch === match.id_match ? 'Cancelando…' : 'Cancelar amistoso'}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }
};

export default JogosPage;
