import { useState, useEffect } from 'react';
import { useCategory } from '../context/CategoryContext';
import { useNavigate } from 'react-router-dom';
import API_URL, { TOURNAMENT_ID } from '../config';
import {
  Calendar, Users, Play, CheckCircle, AlertCircle,
  Shuffle, RefreshCw, ChevronDown, ChevronUp,
  X, AlertTriangle, MessageCircle
} from 'lucide-react';

// Abre WhatsApp com mensagem pré-pronta
const openWhatsApp = (phone: string | undefined, message: string) => {
  if (!phone) return;
  const digits = phone.replace(/\D/g, '');
  const num = digits.startsWith('55') ? digits : `55${digits}`;
  window.open(`https://wa.me/${num}?text=${encodeURIComponent(message)}`, '_blank');
};

interface Player {
  id_player: number;
  name: string;
  side: string;
  whatsapp?: string;
}

interface Double {
  id_double: number;
  id_player1: number;
  id_player2: number;
  display_name: string;
}

interface Round {
  id_round: number;
  id_tournament: number;
  id_category: number;
  round_number: number;
  scheduled_date: string;
  window_start: string;
  window_end: string;
  status: 'DRAFT' | 'AWAITING_CONFIRMATION' | 'CONFIRMED' | 'IN_PROGRESS' | 'FINISHED' | 'CANCELLED';
  round_type: 'REGULAR' | 'MAKEUP' | 'EXHIBITION';
  doubles?: Double[];
}

interface Attendance {
  id_player: number;
  status: 'CONFIRMED' | 'DECLINED' | 'NO_RESPONSE' | 'BYE';
}

interface MatchItem {
  id_match: number;
  id_round: number | null;
  double_a_name: string;
  double_b_name: string;
  court_name: string;
  scheduled_at: string | null;
  status: string;
  score_a: number | null;
  score_b: number | null;
}

const categories = [
  { id: 1, name: 'Masculino Iniciante / 6ª' },
  { id: 2, name: 'Masculino 4ª' },
  { id: 3, name: 'Feminino Iniciante' }
];

const statusColors: Record<string, string> = {
  DRAFT: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
  AWAITING_CONFIRMATION: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
  CONFIRMED: 'bg-premium-accent/20 text-premium-accent border border-premium-accent/30',
  IN_PROGRESS: 'bg-premium-accent/20 text-premium-accent border border-premium-accent/30',
  FINISHED: 'bg-green-500/20 text-green-400 border border-green-500/30',
  CANCELLED: 'bg-red-500/20 text-red-400 border border-red-500/30'
};

const statusLabels: Record<string, string> = {
  DRAFT: 'Rascunho',
  AWAITING_CONFIRMATION: 'Aguardando',
  CONFIRMED: 'Confirmada',
  IN_PROGRESS: 'Em Jogo',
  FINISHED: 'Finalizada',
  CANCELLED: 'Cancelada'
};

const nextThursday = () => {
  const d = new Date();
  const day = d.getDay();
  const diff = day <= 4 ? 4 - day : 11 - day;
  const thu = new Date(d);
  thu.setDate(d.getDate() + diff);
  return `${thu.getFullYear()}-${String(thu.getMonth()+1).padStart(2,'0')}-${String(thu.getDate()).padStart(2,'0')}`;
};

const formatTime = (iso: string | null): string => {
  if (!iso) return '';
  const t = iso.includes('T') ? iso.split('T')[1].substring(0, 5) : '';
  return t ? t.replace(':', 'h') : '';
};

const RondasPage = () => {
  const { selectedCategory } = useCategory();
  const navigate = useNavigate();
  const [rounds, setRounds] = useState<Round[]>([]);
  const [players, setPlayers] = useState<Record<number, Player[]>>({});
  const [loading, setLoading] = useState(true);
  const [expandedRound, setExpandedRound] = useState<number | null>(null);
  const [attendanceMap, setAttendanceMap] = useState<Record<number, Attendance[]>>({});

  // Ausências declaradas { date: playerId[] }
  const [absenceMap, setAbsenceMap] = useState<Record<string, number[]>>({});

  // Modal de sorteio
  const [drawModal, setDrawModal] = useState<{ catId: number; catName: string } | null>(null);
  const [drawDate, setDrawDate] = useState(nextThursday());
  const [excluded, setExcluded] = useState<number[]>([]);
  const [drawing, setDrawing] = useState(false);

  // Modal de refazer sorteio
  const [redrawModal, setRedrawModal] = useState<Round | null>(null);
  const [redrawExcluded, setRedrawExcluded] = useState<number[]>([]);
  const [redrawing, setRedrawing] = useState(false);

  // Modal "Sortear Todas as Categorias"
  const [allCatsModal, setAllCatsModal] = useState(false);
  const [allCatsDate, setAllCatsDate] = useState(nextThursday());
  const [allCatsExcluded, setAllCatsExcluded] = useState<Record<number, number[]>>({});
  const [allCatsProgress, setAllCatsProgress] = useState<Record<number, 'pending' | 'ok' | 'error'>>({});
  const [drawingAll, setDrawingAll] = useState(false);


  // Loading states por rodada
  const [confirming, setConfirming] = useState<number | null>(null);
  const [closing, setClosing] = useState<number | null>(null);
  const [roundMatchesMap, setRoundMatchesMap] = useState<Record<number, MatchItem[]>>({});

  const loadRounds = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/tournaments/${TOURNAMENT_ID}/rounds`);
      const data = res.ok ? await res.json() : [];
      setRounds(data);
    } catch { setRounds([]); }
    finally { setLoading(false); }
  };

  const loadPlayers = async (catId: number) => {
    if (players[catId]) return;
    try {
      const res = await fetch(`${API_URL}/api/tournaments/${TOURNAMENT_ID}/players?category=${catId}`);
      const data = res.ok ? await res.json() : [];
      setPlayers(prev => ({ ...prev, [catId]: data }));
    } catch {}
  };

  const loadAbsences = async (date: string) => {
    if (absenceMap[date]) return absenceMap[date];
    try {
      const res = await fetch(`${API_URL}/api/tournaments/${TOURNAMENT_ID}/absences?date=${date}`);
      const data = res.ok ? await res.json() : [];
      const ids = data.map((a: any) => a.id_player);
      setAbsenceMap(prev => ({ ...prev, [date]: ids }));
      return ids;
    } catch { return []; }
  };

  const loadAttendance = async (roundId: number) => {
    try {
      const res = await fetch(`${API_URL}/api/rounds/${roundId}/attendance`);
      const data = res.ok ? await res.json() : [];
      setAttendanceMap(prev => ({ ...prev, [roundId]: data }));
    } catch {}
  };

  const loadRoundDoubles = async (round: Round) => {
    if (expandedRound === round.id_round) { setExpandedRound(null); return; }
    try {
      // Para rodadas confirmadas, carrega os jogos com quadra/horário
      if (['CONFIRMED', 'IN_PROGRESS', 'FINISHED'].includes(round.status)) {
        const mRes = await fetch(`${API_URL}/api/rounds/${round.id_round}/matches`);
        if (mRes.ok) {
          const items: MatchItem[] = await mRes.json();
          setRoundMatchesMap(prev => ({ ...prev, [round.id_round]: items }));
        }
      }
      // Para rascunhos, carrega as duplas do calendar + ausências declaradas
      if (['DRAFT', 'AWAITING_CONFIRMATION'].includes(round.status)) {
        const res = await fetch(`${API_URL}/api/tournaments/${TOURNAMENT_ID}/rounds/${round.id_category}/calendar`);
        const calendar = res.ok ? await res.json() : [];
        const roundData = calendar.find((r: any) => r.id_round === round.id_round);
        if (roundData?.doubles) {
          setRounds(prev => prev.map(r => r.id_round === round.id_round ? { ...r, doubles: roundData.doubles } : r));
        }
        await loadAbsences(round.scheduled_date);
      }
      await loadAttendance(round.id_round);
    } catch {}
    setExpandedRound(round.id_round);
  };

  useEffect(() => { loadRounds(); }, []);

  useEffect(() => {
    categories.forEach(c => loadPlayers(c.id));
  }, []);

  const handleDraw = async () => {
    if (!drawModal) return;
    setDrawing(true);
    try {
      const res = await fetch(`${API_URL}/api/tournaments/${TOURNAMENT_ID}/categories/${drawModal.catId}/draw-week`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scheduled_date: drawDate,
          excluded_player_ids: excluded,
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao sortear');
      setDrawModal(null);
      setExcluded([]);
      await loadRounds();
      if (Array.isArray(data.warnings) && data.warnings.length > 0) {
        alert('Sorteio realizado com avisos:\n\n• ' + data.warnings.join('\n• '));
      }
    } catch (err: any) {
      alert(err.message);
    } finally { setDrawing(false); }
  };

  const openAllCatsModal = async (date?: string) => {
    const thu = date || nextThursday();
    setAllCatsDate(thu);
    setAllCatsProgress({});
    // Load absences for the date, distribute per category
    const absenceIds = await loadAbsences(thu);
    const excl: Record<number, number[]> = {};
    categories.forEach(cat => {
      const catPlayers = players[cat.id] || [];
      excl[cat.id] = catPlayers.filter(p => absenceIds.includes(p.id_player)).map(p => p.id_player);
    });
    setAllCatsExcluded(excl);
    setAllCatsModal(true);
  };

  const handleDrawAll = async () => {
    setDrawingAll(true);
    const progress: Record<number, 'pending' | 'ok' | 'error'> = {};
    categories.forEach(c => { progress[c.id] = 'pending'; });
    setAllCatsProgress({ ...progress });

    for (const cat of categories) {
      try {
        const res = await fetch(`${API_URL}/api/tournaments/${TOURNAMENT_ID}/categories/${cat.id}/draw-week`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            scheduled_date: allCatsDate,
            excluded_player_ids: allCatsExcluded[cat.id] || [],
          }),
        });
        progress[cat.id] = res.ok ? 'ok' : 'error';
      } catch {
        progress[cat.id] = 'error';
      }
      setAllCatsProgress({ ...progress });
    }

    setDrawingAll(false);
    await loadRounds();
    if (Object.values(progress).every(s => s === 'ok')) setAllCatsModal(false);
  };

  const handleRedraw = async () => {
    if (!redrawModal) return;
    setRedrawing(true);
    try {
      const res = await fetch(`${API_URL}/api/rounds/${redrawModal.id_round}/redraw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ excluded_player_ids: redrawExcluded })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao refazer sorteio');
      setRedrawModal(null);
      setRedrawExcluded([]);
      await loadRounds();
      if (Array.isArray(data.warnings) && data.warnings.length > 0) {
        alert('Sorteio refeito com avisos:\n\n• ' + data.warnings.join('\n• '));
      }
    } catch (err: any) {
      alert(err.message);
    } finally { setRedrawing(false); }
  };


  const handleConfirm = async (roundId: number) => {
    setConfirming(roundId);
    try {
      const res = await fetch(`${API_URL}/api/rounds/${roundId}/confirm`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao confirmar');
      await loadRounds();
    } catch (err: any) { alert(err.message); }
    finally { setConfirming(null); }
  };

  const handleClose = async (roundId: number) => {
    if (!confirm('Fechar rodada e aplicar WO nos jogos não realizados?')) return;
    setClosing(roundId);
    try {
      const res = await fetch(`${API_URL}/api/rounds/${roundId}/close`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao fechar');
      await loadRounds();
    } catch (err: any) { alert(err.message); }
    finally { setClosing(null); }
  };

  const handleAttendance = async (roundId: number, playerId: number, status: string) => {
    try {
      await fetch(`${API_URL}/api/rounds/${roundId}/attendance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_player: playerId, status })
      });
      await loadAttendance(roundId);
    } catch {}
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T12:00:00');
    return date.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
  };

  const filteredCategories = selectedCategory
    ? categories.filter(c => c.id === selectedCategory)
    : categories;

  if (loading) {
    return <div className="py-20 text-center animate-pulse text-zinc-500 font-black uppercase tracking-widest text-xs">Carregando...</div>;
  }

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-1000">

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/5 border border-white/10 rounded-full text-[10px] font-black text-zinc-500 uppercase tracking-widest">
            <Calendar size={12} /> Ranking SRB · Qui→Dom
          </div>
          <h2 className="text-5xl font-black italic uppercase tracking-tighter leading-none">
            Rodadas &<br /><span className="text-premium-accent">Duplas</span>
          </h2>
          <p className="text-zinc-500 text-sm max-w-md">
            Sorteio semanal. Admin sorteia qui–dom, atletas confirmam até terça, jogos acontecem qui–dom.
          </p>
        </div>
        <div className="flex gap-3 flex-wrap">
          <button
            onClick={() => openAllCatsModal()}
            className="bg-yellow-400/20 hover:bg-yellow-400/30 text-yellow-400 border border-yellow-400/30 px-6 py-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all inline-flex items-center gap-2"
          >
            <Shuffle size={14} /> Sortear Todas as Categorias
          </button>
          <button onClick={loadRounds} className="bg-white/5 hover:bg-white/10 border border-white/10 px-5 py-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all inline-flex items-center gap-2">
            <RefreshCw size={14} /> Atualizar
          </button>
        </div>
      </div>

      {/* Painel de Programação do Campeonato */}
      <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5 space-y-4">
        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 flex items-center gap-2">
          <Calendar size={11} /> Programação do campeonato · Abril → Outubro 2026
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { cat: 'Masc. Iniciante', total: 189, perWeek: '7 fixo', weeks: 27, color: 'text-premium-accent' },
            { cat: 'Masc. 4ª', total: 68, perWeek: '3 / 2 alternado', weeks: 27, color: 'text-blue-400' },
            { cat: 'Fem. Iniciante', total: 39, perWeek: '2 (sem.1-12) / 1 (sem.13+)', weeks: 27, color: 'text-pink-400' },
          ].map(item => (
            <div key={item.cat} className="bg-white/5 rounded-xl p-3 space-y-1.5">
              <p className={`text-[10px] font-black uppercase tracking-widest ${item.color}`}>{item.cat}</p>
              <p className="text-xs font-bold text-white">{item.perWeek} <span className="text-zinc-600">jogos/semana</span></p>
              <p className="text-[10px] text-zinc-500">{item.total} jogos · {item.weeks} semanas</p>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-4 text-[10px] font-bold text-zinc-500 border-t border-white/5 pt-3">
          <span>📅 2 quadras × 6 horários = <span className="text-white">12 slots/quinta</span></span>
          <span>⏱ 40min por jogo · 18h–21h40</span>
          <span>⚠️ Prazo de ausência: <span className="text-yellow-400">segunda 18h</span></span>
          <span>❌ Não avisou + não jogou = <span className="text-red-400">WO</span></span>
        </div>
      </div>

      {/* Fluxo */}
      <div className="flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-widest text-zinc-600">
        <span className="bg-yellow-500/10 text-yellow-500 px-3 py-1.5 rounded-lg border border-yellow-500/20">1. Sortear</span>
        <span>→</span>
        <span className="bg-premium-accent/10 text-premium-accent px-3 py-1.5 rounded-lg border border-premium-accent/20">2. Verificar e Confirmar</span>
        <span>→</span>
        <span className="bg-white/5 px-3 py-1.5 rounded-lg border border-white/10">3. Jogar (quinta)</span>
        <span>→</span>
        <span className="bg-premium-accent/20 text-premium-accent px-3 py-1.5 rounded-lg border border-premium-accent/30">4. Ranking</span>
      </div>

      {/* Por categoria */}
      <div className="space-y-12">
        {filteredCategories.map(cat => {
          const catRounds = rounds
            .filter(r => r.id_category === cat.id)
            .sort((a, b) => b.round_number - a.round_number);

          const hasActiveDraft = catRounds.some(r => ['DRAFT', 'AWAITING_CONFIRMATION'].includes(r.status));

          return (
            <div key={cat.id} className="space-y-6">
              {/* Header da categoria */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="h-px w-12 bg-white/5" />
                  <h3 className="text-lg font-black uppercase tracking-[0.2em] text-white flex items-center gap-3">
                    <Users size={16} className="text-premium-accent" />
                    {cat.name}
                    <span className="text-xs text-zinc-500 font-bold">({catRounds.length} rodadas)</span>
                  </h3>
                </div>

                {/* Botão sortear semana */}
                {!hasActiveDraft && (
                  <button
                    onClick={async () => {
                      const thu = nextThursday();
                      setDrawModal({ catId: cat.id, catName: cat.name });
                      setDrawDate(thu);
                      const absenceIds = await loadAbsences(thu);
                      const catPlayers = players[cat.id] || [];
                      setExcluded(catPlayers.filter(p => absenceIds.includes(p.id_player)).map(p => p.id_player));
                    }}
                    className="bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 border border-yellow-500/30 px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all inline-flex items-center gap-2"
                  >
                    <Shuffle size={12} /> Sortear Semana
                  </button>
                )}
              </div>

              {/* Lista de rodadas */}
              {catRounds.length === 0 ? (
                <div className="premium-card p-12 text-center">
                  <AlertCircle size={24} className="mx-auto text-zinc-600 mb-3" />
                  <p className="text-zinc-500 font-bold uppercase tracking-widest text-xs">Nenhuma rodada ainda</p>
                  <p className="text-zinc-600 text-xs mt-2">Clique em "Sortear Semana" para gerar o sorteio desta semana</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {catRounds.map(round => {
                    const attendance = attendanceMap[round.id_round] || [];

                    return (
                      <div key={round.id_round} className="premium-card !p-0 overflow-hidden border-white/5 hover:border-white/10 transition-all">
                        {/* Row principal */}
                        <div className="flex items-center justify-between p-4 gap-4">
                          <div className="flex items-center gap-4 flex-1 min-w-0">
                            <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-sm font-black text-premium-accent shrink-0">
                              {round.round_number}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-black uppercase tracking-wide text-white">Rodada {round.round_number}</p>
                              <p className="text-[10px] text-zinc-500 font-bold">
                                {formatDate(round.scheduled_date)} · {(round.window_start || '18:00').substring(0, 5)}–{(round.window_end || '23:00').substring(0, 5)}
                              </p>
                            </div>
                          </div>

                          <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest shrink-0 ${statusColors[round.status] || ''}`}>
                            {statusLabels[round.status] || round.status}
                          </span>
                          {round.round_type === 'EXHIBITION' && (
                            <span
                              title="Rodada amistosa — não conta pro ranking"
                              className="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest shrink-0 bg-amber-500/20 text-amber-300 border border-amber-500/40"
                            >
                              ⚠ Amistoso · s/ ranking
                            </span>
                          )}

                          <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                            {/* Ver duplas */}
                            <button
                              onClick={() => loadRoundDoubles(round)}
                              className="flex items-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-zinc-400 transition-all border border-white/10"
                            >
                              <Users size={12} />
                              Duplas
                              {expandedRound === round.id_round ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                            </button>

                            {/* Ações por status */}
                            {(round.status === 'DRAFT' || round.status === 'AWAITING_CONFIRMATION') && (
                              <>
                                <button
                                  onClick={async () => {
                                    setRedrawModal(round);
                                    const absenceIds = await loadAbsences(round.scheduled_date);
                                    const catPlayers = players[round.id_category] || [];
                                    setRedrawExcluded(catPlayers.filter(p => absenceIds.includes(p.id_player)).map(p => p.id_player));
                                  }}
                                  className="flex items-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-zinc-400 transition-all border border-white/10"
                                >
                                  <RefreshCw size={12} /> Refazer
                                </button>
                                <button
                                  onClick={() => handleConfirm(round.id_round)}
                                  disabled={confirming === round.id_round}
                                  className="flex items-center gap-1.5 px-3 py-2 bg-premium-accent/20 text-premium-accent rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-premium-accent/30 transition-all border border-premium-accent/30 disabled:opacity-50"
                                >
                                  {confirming === round.id_round ? <RefreshCw size={12} className="animate-spin" /> : <CheckCircle size={12} />}
                                  Confirmar
                                </button>
                              </>
                            )}

                            {round.status === 'CONFIRMED' && (
                              <>
                                <button
                                  onClick={() => navigate('/jogos')}
                                  className="flex items-center gap-1.5 px-3 py-2 bg-premium-accent text-black rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all"
                                >
                                  <Play size={12} fill="currentColor" /> Ver Jogos
                                </button>
                                <button
                                  onClick={() => handleClose(round.id_round)}
                                  disabled={closing === round.id_round}
                                  className="flex items-center gap-1.5 px-3 py-2 bg-red-500/20 text-red-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-500/30 transition-all border border-red-500/30 disabled:opacity-50"
                                >
                                  {closing === round.id_round ? <RefreshCw size={12} className="animate-spin" /> : <X size={12} />}
                                  Fechar
                                </button>
                              </>
                            )}

                            {round.status === 'FINISHED' && (
                              <button
                                onClick={() => navigate('/jogos')}
                                className="flex items-center gap-1.5 px-3 py-2 bg-zinc-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-zinc-600 transition-all"
                              >
                                <CheckCircle size={12} /> Resultados
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Painel expandido */}
                        {expandedRound === round.id_round && (
                          <div className="border-t border-white/5 bg-white/[0.02] p-4 space-y-4">

                            {/* JOGOS — rodadas confirmadas/em jogo/finalizadas */}
                            {['CONFIRMED', 'IN_PROGRESS', 'FINISHED'].includes(round.status) && (() => {
                              const roundMatches = roundMatchesMap[round.id_round] || [];
                              if (roundMatches.length === 0) return (
                                <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest py-2">Sem jogos agendados ainda.</p>
                              );
                              return (
                                <div>
                                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-3 flex items-center gap-2">
                                    <Play size={10} /> Jogos · {formatDate(round.scheduled_date)}
                                  </p>
                                  <div className="space-y-2">
                                    {roundMatches.map((m, i) => {
                                      const time = formatTime(m.scheduled_at);
                                      const isFinished = m.status === 'FINISHED';
                                      const isWo = m.status === 'WO';
                                      return (
                                        <div key={m.id_match} className={`rounded-xl p-3 border ${isFinished ? 'border-white/5 opacity-60' : 'border-white/10 bg-white/5'}`}>
                                          {/* Quadra + Horário */}
                                          <div className="flex items-center gap-2 mb-2">
                                            <span className="text-[9px] font-black text-white/30 uppercase">{i + 1}</span>
                                            {time && (
                                              <span className="text-[10px] font-black bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full border border-blue-500/30">
                                                {time}
                                              </span>
                                            )}
                                            <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex-1">{m.court_name}</span>
                                            {isFinished && m.score_a != null && (
                                              <span className="text-sm font-black text-white">{m.score_a} <span className="text-zinc-600">×</span> {m.score_b}</span>
                                            )}
                                            {isWo && (
                                              <span className="text-[9px] font-black text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/20">WO</span>
                                            )}
                                          </div>
                                          {/* Duplas */}
                                          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                                            <span className="text-sm font-bold text-white truncate">{m.double_a_name}</span>
                                            <span className="text-[10px] font-black text-zinc-600">VS</span>
                                            <span className="text-sm font-bold text-white truncate text-right">{m.double_b_name}</span>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })()}

                            {/* DUPLAS — apenas para rascunhos */}
                            {['DRAFT', 'AWAITING_CONFIRMATION'].includes(round.status) && (() => {
                              const catPlayers = players[round.id_category] || [];

                              // Quem está nas duplas = está jogando
                              const inDoubles = new Set<number>();
                              (round.doubles || []).forEach(d => {
                                if (d.id_player1) inDoubles.add(d.id_player1);
                                if (d.id_player2) inDoubles.add(d.id_player2);
                              });

                              // Quem não está em nenhuma dupla
                              const outsidePlayers = catPlayers.filter(p => !inDoubles.has(p.id_player));

                              // Classifica usando attendance da rodada (registrado no momento do sorteio)
                              // Fallback para absenceMap se attendance ainda não carregou
                              const formalAbsentIds = absenceMap[round.scheduled_date] || [];
                              const declinedIds = new Set(attendance.filter(a => a.status === 'DECLINED').map(a => a.id_player));
                              const hasAttendanceData = attendance.length > 0;

                              // AUSENTES: excluídos do sorteio (declararam ausência ou foram excluídos pelo admin)
                              // Usa DECLINED da attendance; fallback: absenceMap
                              const absentOutIds = new Set(
                                hasAttendanceData
                                  ? outsidePlayers.filter(p => declinedIds.has(p.id_player)).map(p => p.id_player)
                                  : outsidePlayers.filter(p => formalAbsentIds.includes(p.id_player)).map(p => p.id_player)
                              );
                              const absentOut = outsidePlayers.filter(p => absentOutIds.has(p.id_player));

                              // PREJUDICADOS: estavam disponíveis mas ficaram sem jogo por causa das ausências
                              // Mutuamente exclusivo com ausentes — não pode aparecer nos dois
                              const byeOut = outsidePlayers.filter(p => !absentOutIds.has(p.id_player));

                              const totalPlaying = inDoubles.size;

                              return (
                                <div className="space-y-4">

                                  {/* Barra de resumo */}
                                  <div className="flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-widest">
                                    <span className="px-3 py-1.5 bg-premium-accent/10 text-premium-accent rounded-lg border border-premium-accent/20">
                                      {(round.doubles || []).length} duplas · {totalPlaying} jogadores
                                    </span>
                                    {absentOut.length > 0 && (
                                      <span className="px-3 py-1.5 bg-yellow-500/10 text-yellow-400 rounded-lg border border-yellow-500/20">
                                        {absentOut.length} ausente{absentOut.length > 1 ? 's' : ''}
                                      </span>
                                    )}
                                    {byeOut.length > 0 && (
                                      <span className="px-3 py-1.5 bg-orange-500/10 text-orange-400 rounded-lg border border-orange-500/20">
                                        {byeOut.length} sem jogo (bye)
                                      </span>
                                    )}
                                  </div>

                                  {/* Grade de duplas */}
                                  {round.doubles && round.doubles.length > 0 && (
                                    <div>
                                      <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-3 flex items-center gap-2">
                                        <Users size={10} /> {round.doubles.length} duplas sorteadas
                                      </p>
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {round.doubles.map((d, i) => {
                                          const p1 = catPlayers.find(p => p.id_player === d.id_player1);
                                          const p2 = catPlayers.find(p => p.id_player === d.id_player2);
                                          const dateLabel = formatDate(round.scheduled_date);
                                          const msgP1 = p1 && p2
                                            ? `Olá ${p1.name}! 🎾 Seu sorteio do Ranking Padel SRB está pronto!\n\nSua dupla nessa semana: *${p1.name} / ${p2.name}*\nData: *${dateLabel}* (18h–21h)\n\nQualquer dúvida é só falar!`
                                            : '';
                                          const msgP2 = p1 && p2
                                            ? `Olá ${p2.name}! 🎾 Seu sorteio do Ranking Padel SRB está pronto!\n\nSua dupla nessa semana: *${p1.name} / ${p2.name}*\nData: *${dateLabel}* (18h–21h)\n\nQualquer dúvida é só falar!`
                                            : '';
                                          return (
                                            <div key={d.id_double} className="bg-white/5 rounded-xl p-3 border border-white/5 space-y-2">
                                              <div className="flex items-center gap-2">
                                                <div className="w-5 h-5 bg-premium-accent/20 rounded-md flex items-center justify-center text-[9px] font-black text-premium-accent shrink-0">{i + 1}</div>
                                                <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider truncate">{d.display_name}</p>
                                              </div>
                                              <div className="space-y-1">
                                                {[{ player: p1, msg: msgP1 }, { player: p2, msg: msgP2 }].map(({ player, msg }) =>
                                                  player ? (
                                                    <div key={player.id_player} className="flex items-center justify-between gap-2">
                                                      <span className="text-xs font-bold text-white truncate">{player.name}</span>
                                                      {player.whatsapp ? (
                                                        <button
                                                          onClick={() => openWhatsApp(player.whatsapp, msg)}
                                                          title={`WhatsApp: ${player.whatsapp}`}
                                                          className="shrink-0 p-1.5 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg transition-all border border-green-500/20"
                                                        >
                                                          <MessageCircle size={11} />
                                                        </button>
                                                      ) : (
                                                        <span className="text-[9px] text-zinc-600 shrink-0">sem tel.</span>
                                                      )}
                                                    </div>
                                                  ) : null
                                                )}
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}
                                  {/* ── Não jogam esta rodada ── */}
                                  {(absentOut.length > 0 || byeOut.length > 0) && (() => {
                                    const sideLabel = (s: string) =>
                                      s === 'RIGHT' ? 'DIR' : s === 'LEFT' ? 'ESQ' : s || '—';

                                    // Lado dos BYE players (quem realmente ficou sem par)
                                    const byeRight = byeOut.filter(p => p.side === 'RIGHT').length;
                                    const byeLeft  = byeOut.filter(p => p.side === 'LEFT').length;
                                    // Lado predominante dos BYE (o lado que ficou sobrando)
                                    const byeSide     = byeRight > byeLeft ? 'DIR' : byeLeft > byeRight ? 'ESQ' : null;
                                    // Lado do par que faltou (oposto)
                                    const neededSide  = byeRight > byeLeft ? 'ESQ' : byeLeft > byeRight ? 'DIR' : null;

                                    // Lado predominante dos ausentes (para o alerta)
                                    const absentRight = absentOut.filter(p => p.side === 'RIGHT').length;
                                    const absentLeft  = absentOut.filter(p => p.side === 'LEFT').length;
                                    const moreAbsent  = absentRight > absentLeft ? 'DIR' : absentLeft > absentRight ? 'ESQ' : null;

                                    return (
                                      <div className="border-t border-white/5 pt-4 space-y-3">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 flex items-center gap-2">
                                          <AlertTriangle size={10} className="text-zinc-600" />
                                          Não jogam esta rodada
                                        </p>

                                        {/* Alerta de impacto — usa byeOut.length e lados reais dos BYE */}
                                        {byeOut.length > 0 && (
                                          <div className="bg-red-500/5 border border-red-500/15 rounded-xl px-3 py-2.5 space-y-1.5">
                                            <div className="flex items-start gap-2">
                                              <AlertTriangle size={12} className="text-red-400 shrink-0 mt-0.5" />
                                              <p className="text-[10px] font-bold text-red-300 leading-snug">
                                                {absentOut.length > 0
                                                  ? <>{absentOut.length} ausente{absentOut.length > 1 ? 's' : ''}{moreAbsent ? ` (lado ${moreAbsent})` : ''}{' '}
                                                      causou{absentOut.length > 1 ? 'ram' : ''} impacto em{' '}
                                                      <span className="font-black text-red-200">{byeOut.length} jogador{byeOut.length > 1 ? 'es' : ''}{byeSide ? ` do lado ${byeSide}` : ''}</span>
                                                      {neededSide ? ` sem par ${neededSide}` : ''} para jogar:</>
                                                  : <><span className="font-black text-red-200">{byeOut.length} jogador{byeOut.length > 1 ? 'es' : ''}{byeSide ? ` do lado ${byeSide}` : ''}</span>
                                                      {' '}ficaram sem jogo (número ímpar):</>
                                                }
                                              </p>
                                            </div>
                                            <div className="flex flex-wrap gap-1.5 pl-5">
                                              {byeOut.map(p => (
                                                <span key={p.id_player} className="text-[10px] font-black text-red-300 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-lg">
                                                  {p.name.split(' ')[0]} {p.name.split(' ').slice(-1)[0]}
                                                </span>
                                              ))}
                                            </div>
                                          </div>
                                        )}

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                          {/* Ausentes (amarelo) */}
                                          {absentOut.map(p => (
                                            <div key={p.id_player} className="flex items-center gap-3 px-3 py-2.5 bg-yellow-500/5 border border-yellow-500/15 rounded-xl">
                                              <div className="w-8 h-8 rounded-lg bg-yellow-500/10 flex items-center justify-center shrink-0">
                                                <X size={14} className="text-yellow-500" />
                                              </div>
                                              <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-1.5 mb-0.5">
                                                  <p className="text-xs font-black text-yellow-300 truncate leading-none">{p.name}</p>
                                                  <span className="text-[8px] font-black text-yellow-600 bg-yellow-500/10 px-1.5 py-0.5 rounded border border-yellow-500/20 shrink-0">
                                                    {sideLabel(p.side)}
                                                  </span>
                                                </div>
                                                <p className="text-[9px] font-bold text-yellow-700 uppercase tracking-wide">
                                                  Ausente — excluído do sorteio
                                                </p>
                                              </div>
                                            </div>
                                          ))}

                                          {/* Prejudicados (laranja) */}
                                          {byeOut.map(p => {
                                            const pSide = p.side === 'RIGHT' ? 'DIR' : 'ESQ';
                                            const neededPair = p.side === 'RIGHT' ? 'ESQ' : 'DIR';
                                            const motivo = absentOut.length > 0
                                              ? `Sem par ${neededPair} — impactado pela ausência`
                                              : `Sem jogo — número ímpar nesta rodada`;
                                            return (
                                              <div key={p.id_player} className="flex items-center gap-3 px-3 py-2.5 bg-orange-500/5 border border-orange-500/15 rounded-xl">
                                                <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center shrink-0">
                                                  <span className="text-[9px] font-black text-orange-500">BYE</span>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                  <div className="flex items-center gap-1.5 mb-0.5">
                                                    <p className="text-xs font-black text-orange-300 truncate leading-none">{p.name}</p>
                                                    <span className="text-[8px] font-black text-orange-600 bg-orange-500/10 px-1.5 py-0.5 rounded border border-orange-500/20 shrink-0">
                                                      {pSide}
                                                    </span>
                                                  </div>
                                                  <p className="text-[9px] font-bold text-orange-700 uppercase tracking-wide">{motivo}</p>
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    );
                                  })()}
                                </div>
                              );
                            })()}

                            {/* Controle de presenças — marque quem FALTOU, o resto jogou */}
                            {['CONFIRMED', 'FINISHED'].includes(round.status) && attendance.length > 0 && (
                              <WoPanel
                                roundId={round.id_round}
                                attendance={attendance}
                                players={players[round.id_category] || []}
                                onSave={async (woIds) => {
                                  const allActive = attendance.filter(a => a.status !== 'BYE');
                                  await Promise.all(allActive.map(a =>
                                    handleAttendance(round.id_round, a.id_player, woIds.includes(a.id_player) ? 'DECLINED' : 'CONFIRMED')
                                  ));
                                  await loadAttendance(round.id_round);
                                }}
                              />
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Modal: Sortear Semana */}
      {drawModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-white/10 rounded-3xl p-4 sm:p-8 w-full max-w-lg space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-black uppercase tracking-tight text-white">Sortear Semana</h3>
              <button onClick={() => setDrawModal(null)} className="text-zinc-500 hover:text-white"><X size={20} /></button>
            </div>
            <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest">{drawModal.catName}</p>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Data da Quinta-feira</label>
              <input
                type="date"
                value={drawDate}
                onChange={async e => {
                  const d = e.target.value;
                  const catPlayerIds = new Set((players[drawModal.catId] || []).map(p => p.id_player));
                  const prevAbsenceIdsForCat = (absenceMap[drawDate] || []).filter(id => catPlayerIds.has(id));
                  setDrawDate(d);
                  const absenceIds: number[] = await loadAbsences(d);
                  const newAbsenceIdsForCat = absenceIds.filter((id: number) => catPlayerIds.has(id));
                  // mantém exclusões manuais (não originadas de ausência) + adiciona ausências da nova data (filtradas pela categoria)
                  setExcluded(prev => [...new Set([...prev.filter(id => !prevAbsenceIdsForCat.includes(id)), ...newAbsenceIdsForCat])]);
                }}
                className="w-full h-12 bg-white/5 border border-white/10 text-white rounded-xl px-4 focus:border-premium-accent outline-none text-sm font-bold"
              />
            </div>

            {/* Ausentes */}
            <div className="space-y-3">
              {(() => {
                const absentInCat = (players[drawModal.catId] || []).filter(p =>
                  (absenceMap[drawDate] || []).includes(p.id_player)
                ).length;
                return (
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Excluir do sorteio</label>
                    {absentInCat > 0 && (
                      <span className="text-[9px] font-black text-yellow-400 bg-yellow-500/10 px-2 py-0.5 rounded-full border border-yellow-500/20">
                        {absentInCat} declararam ausência
                      </span>
                    )}
                  </div>
                );
              })()}
              <div className="max-h-52 overflow-y-auto space-y-1">
                {(players[drawModal.catId] || []).map(p => {
                  const declaredAbsent = (absenceMap[drawDate] || []).includes(p.id_player);
                  const isExcluded = excluded.includes(p.id_player);
                  return (
                    <label key={p.id_player} className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all ${isExcluded ? 'bg-red-500/10 border border-red-500/20' : 'bg-white/5 border border-transparent hover:bg-white/8'}`}>
                      <input type="checkbox" checked={isExcluded}
                        onChange={e => setExcluded(prev => e.target.checked ? [...prev, p.id_player] : prev.filter(id => id !== p.id_player))}
                        className="sr-only" />
                      <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${isExcluded ? 'bg-red-500 border-red-500' : 'border-white/20'}`}>
                        {isExcluded && <X size={10} className="text-white" />}
                      </div>
                      <span className="text-sm font-bold text-white flex-1">{p.name}</span>
                      {declaredAbsent && (
                        <span className="text-[8px] font-black text-yellow-400 uppercase bg-yellow-500/10 px-1.5 py-0.5 rounded shrink-0">declarou ausência</span>
                      )}
                      <span className="text-[10px] text-zinc-600 shrink-0">{p.side}</span>
                    </label>
                  );
                })}
              </div>
              {excluded.length > 0 && (
                <p className={`text-[10px] font-black uppercase tracking-widest ${excluded.length % 2 !== 0 ? 'text-yellow-400' : 'text-zinc-500'}`}>
                  {excluded.length} excluídos {excluded.length % 2 !== 0 ? '— número ímpar, haverá 1 bye' : ''}
                </p>
              )}
            </div>

            <button onClick={() => handleDraw()} disabled={drawing}
              className="w-full h-12 bg-yellow-400 hover:bg-yellow-300 text-black font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50">
              {drawing ? <><RefreshCw size={14} className="animate-spin" /> Sorteando...</> : <><Shuffle size={14} /> Sortear Duplas</>}
            </button>
          </div>
        </div>
      )}

      {/* Modal: Refazer Sorteio */}
      {redrawModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-white/10 rounded-3xl p-4 sm:p-8 w-full max-w-lg space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-black uppercase tracking-tight text-white">Refazer Sorteio</h3>
              <button onClick={() => setRedrawModal(null)} className="text-zinc-500 hover:text-white"><X size={20} /></button>
            </div>
            <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest">
              Rodada {redrawModal.round_number} · {formatDate(redrawModal.scheduled_date)}
            </p>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Excluir do novo sorteio</label>
                {redrawExcluded.length > 0 && (
                  <span className={`text-[9px] font-black ${redrawExcluded.length % 2 !== 0 ? 'text-amber-400' : 'text-red-400'}`}>
                    {redrawExcluded.length} excluídos {redrawExcluded.length % 2 !== 0 ? '— ímpar, haverá 1 bye' : ''}
                  </span>
                )}
              </div>
              <div className="max-h-52 overflow-y-auto space-y-1">
                {(players[redrawModal.id_category] || []).map(p => {
                  const isExcluded = redrawExcluded.includes(p.id_player);
                  const declaredAbsent = (absenceMap[redrawModal.scheduled_date] || []).includes(p.id_player);
                  return (
                    <label key={p.id_player} className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all select-none ${isExcluded ? 'bg-red-500/10 border border-red-500/20' : 'bg-white/5 border border-transparent hover:bg-white/8'}`}>
                      <input type="checkbox" checked={isExcluded}
                        onChange={e => setRedrawExcluded(prev => e.target.checked ? [...prev, p.id_player] : prev.filter(id => id !== p.id_player))}
                        className="sr-only" />
                      <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${isExcluded ? 'bg-red-500 border-red-500' : 'border-white/20'}`}>
                        {isExcluded && <X size={10} className="text-white" />}
                      </div>
                      <span className={`text-sm font-bold flex-1 ${isExcluded ? 'text-red-400 line-through' : 'text-white'}`}>{p.name}</span>
                      {declaredAbsent && <span className="text-[8px] font-black text-yellow-400 bg-yellow-500/10 px-1.5 py-0.5 rounded shrink-0">declarou ausência</span>}
                    </label>
                  );
                })}
              </div>
            </div>

            <button onClick={() => handleRedraw()} disabled={redrawing}
              className="w-full h-12 bg-white/10 hover:bg-white/15 text-white font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50">
              {redrawing ? <><RefreshCw size={14} className="animate-spin" /> Sorteando...</> : <><RefreshCw size={14} /> Refazer Sorteio</>}
            </button>
          </div>
        </div>
      )}

      {/* Modal: Sortear Todas as Categorias */}
      {allCatsModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-white/10 rounded-3xl p-6 w-full max-w-2xl max-h-[90vh] flex flex-col gap-5">
            <div className="flex items-center justify-between shrink-0">
              <h3 className="text-xl font-black uppercase tracking-tight text-white">Sortear Todas as Categorias</h3>
              <button onClick={() => setAllCatsModal(false)} className="text-zinc-500 hover:text-white"><X size={20} /></button>
            </div>

            {/* Date picker */}
            <div className="shrink-0 space-y-1.5">
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Data da Quinta-feira</label>
              <input type="date" value={allCatsDate} disabled={drawingAll}
                onChange={async e => {
                  const d = e.target.value;
                  setAllCatsDate(d);
                  const ids = await loadAbsences(d);
                  const excl: Record<number, number[]> = {};
                  categories.forEach(cat => {
                    const catPlayers = players[cat.id] || [];
                    excl[cat.id] = catPlayers.filter(p => ids.includes(p.id_player)).map(p => p.id_player);
                  });
                  setAllCatsExcluded(excl);
                }}
                className="w-full h-12 bg-white/5 border border-white/10 text-white rounded-xl px-4 focus:border-premium-accent outline-none text-sm font-bold disabled:opacity-50"
              />
            </div>

            {/* Per-category exclusion lists */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {Object.keys(allCatsProgress).length > 0 ? (
                // Show progress when drawing
                <div className="space-y-2">
                  {categories.map(cat => {
                    const status = allCatsProgress[cat.id];
                    return (
                      <div key={cat.id} className="flex items-center justify-between text-sm font-bold px-4 py-3 rounded-xl bg-white/5">
                        <span className="text-zinc-300">{cat.name}</span>
                        <span>
                          {status === 'pending' && <RefreshCw size={14} className="text-yellow-400 animate-spin" />}
                          {status === 'ok' && <span className="text-green-400 font-black">✓ Sorteado</span>}
                          {status === 'error' && <span className="text-red-400 font-black">✗ Erro</span>}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                // Show exclusion lists per category
                categories.map(cat => {
                  const catPlayers = players[cat.id] || [];
                  const excl = allCatsExcluded[cat.id] || [];
                  const absenceIds = absenceMap[allCatsDate] || [];
                  return (
                    <div key={cat.id} className="border border-white/5 rounded-2xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] font-black text-premium-accent uppercase tracking-widest">{cat.name}</p>
                        <div className="flex items-center gap-2 text-[9px] font-black">
                          {absenceIds.filter(id => catPlayers.some(p => p.id_player === id)).length > 0 && (
                            <span className="text-yellow-400 bg-yellow-500/10 px-2 py-0.5 rounded-full border border-yellow-500/20">
                              {absenceIds.filter(id => catPlayers.some(p => p.id_player === id)).length} declararam ausência
                            </span>
                          )}
                          {excl.length > 0 && (
                            <span className="text-red-400">{excl.length} excluídos</span>
                          )}
                          {excl.length % 2 !== 0 && excl.length > 0 && (
                            <span className="text-amber-400">⚠ ímpar → 1 bye</span>
                          )}
                        </div>
                      </div>
                      {catPlayers.length === 0 ? (
                        <p className="text-[10px] text-zinc-600">Carregando atletas...</p>
                      ) : (
                        <div className="grid grid-cols-2 gap-1 max-h-36 overflow-y-auto">
                          {catPlayers.map(p => {
                            const isExcluded = excl.includes(p.id_player);
                            const declaredAbsent = absenceIds.includes(p.id_player);
                            return (
                              <label key={p.id_player} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-all select-none ${isExcluded ? 'bg-red-500/10 border border-red-500/20' : 'hover:bg-white/5 border border-transparent'}`}>
                                <input type="checkbox" checked={isExcluded} className="sr-only"
                                  onChange={e => setAllCatsExcluded(prev => ({
                                    ...prev,
                                    [cat.id]: e.target.checked
                                      ? [...(prev[cat.id] || []), p.id_player]
                                      : (prev[cat.id] || []).filter(id => id !== p.id_player)
                                  }))} />
                                <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${isExcluded ? 'bg-red-500 border-red-500' : 'border-white/20'}`}>
                                  {isExcluded && <X size={9} className="text-white" />}
                                </div>
                                <span className={`text-xs font-bold truncate flex-1 ${isExcluded ? 'text-red-400 line-through' : 'text-white'}`}>{p.name}</span>
                                {declaredAbsent && <span className="text-[8px] font-black text-yellow-400 shrink-0">ausente</span>}
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <button onClick={handleDrawAll} disabled={drawingAll} className="shrink-0 w-full h-12 bg-yellow-400 hover:bg-yellow-300 text-black font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50">
              {drawingAll
                ? <><RefreshCw size={14} className="animate-spin" /> Sorteando...</>
                : <><Shuffle size={14} /> Sortear Todas</>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

/* ─── WoPanel ─────────────────────────────────────────────────────────────── */

interface WoPanelProps {
  roundId: number;
  attendance: Attendance[];
  players: Player[];
  onSave: (woIds: number[]) => Promise<void>;
}

function WoPanel({ attendance, players, onSave }: WoPanelProps) {
  const active = attendance.filter(a => a.status !== 'BYE');
  const [woIds, setWoIds] = useState<number[]>(
    attendance.filter(a => a.status === 'DECLINED').map(a => a.id_player)
  );
  const [saving, setSaving] = useState(false);

  const toggle = (id: number) =>
    setWoIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const present = active.length - woIds.length;
  const absent = woIds.length;

  return (
    <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 flex items-center gap-2">
          <AlertTriangle size={11} className="text-yellow-400" />
          Marque quem não apareceu — o restante será confirmado como presente
        </p>
        <span className="text-[10px] font-black text-zinc-500">
          <span className="text-green-400">{present} presentes</span>
          {absent > 0 && <> · <span className="text-red-400">{absent} faltaram</span></>}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {active.map(a => {
          const player = players.find(p => p.id_player === a.id_player);
          const isWo = woIds.includes(a.id_player);
          return (
            <label
              key={a.id_player}
              className={`flex items-center gap-2 p-2.5 rounded-xl cursor-pointer transition-all select-none ${isWo ? 'bg-red-500/15 border border-red-500/30' : 'bg-white/5 border border-white/5 hover:border-white/15'}`}
            >
              <input type="checkbox" checked={isWo} onChange={() => toggle(a.id_player)} className="sr-only" />
              <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${isWo ? 'bg-red-500 border-red-500' : 'border-white/20'}`}>
                {isWo && <X size={10} className="text-white" />}
              </div>
              <span className={`text-xs font-bold truncate ${isWo ? 'text-red-400 line-through' : 'text-white'}`}>
                {player?.name ?? `#${a.id_player}`}
              </span>
            </label>
          );
        })}
      </div>

      <button
        onClick={async () => { setSaving(true); try { await onSave(woIds); } finally { setSaving(false); } }}
        disabled={saving}
        className="flex items-center gap-2 px-5 py-2.5 bg-premium-accent/20 text-premium-accent border border-premium-accent/30 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-premium-accent/30 transition-all disabled:opacity-50"
      >
        {saving ? <><RefreshCw size={12} className="animate-spin" /> Salvando...</> : <><CheckCircle size={12} /> Salvar Presenças</>}
      </button>
    </div>
  );
}

export default RondasPage;
