import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  fetchMatches,
  updateMatchStatus,
  callMatch,
  type Match
} from '../api';
import {
  Monitor,
  CheckCircle,
  Play,
  Smartphone,
  Calendar,
  Trophy,
  Save,
  ArrowLeft
} from 'lucide-react';

const JogosPage = () => {
  const navigate = useNavigate();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [notifying, setNotifying] = useState<number | null>(null);
  const [saving, setSaving] = useState<number | null>(null);
  const [editScores, setEditScores] = useState<Record<number, { a: number; b: number }>>({});
  const [savedFeedback, setSavedFeedback] = useState<number | null>(null);

  const loadMatches = async () => {
    setLoading(true);
    try {
      const data = await fetchMatches(1);
      setMatches(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMatches();
  }, []);

  const handleStartMatch = async (matchId: number) => {
    try {
      await updateMatchStatus(matchId, 'IN_PROGRESS');
      loadMatches();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao iniciar jogo');
    }
  };

  const handleSaveScore = async (match: Match) => {
    const scores = editScores[match.id_match];
    if (!scores) return;

    const { a, b } = scores;
    if (a < 0 || b < 0 || a > 7 || b > 7) {
      alert('Placar inválido. Use valores entre 0 e 7.');
      return;
    }

    setSaving(match.id_match);
    try {
      await updateMatchStatus(match.id_match, 'IN_PROGRESS', a, b);
      setSavedFeedback(match.id_match);
      setTimeout(() => setSavedFeedback(null), 2000);
      loadMatches();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao salvar placar');
    } finally {
      setSaving(null);
    }
  };

  const handleFinishMatch = async (match: Match) => {
    const scores = editScores[match.id_match] || { a: match.games_double_a, b: match.games_double_b };
    if (scores.a === 0 && scores.b === 0) {
      if (!confirm('Ambos os placares são 0. Deseja finalizar como WO?')) return;
    }
    if (scores.a === scores.b && scores.a > 0) {
      alert('Empate não é permitido no padel. Informe o placar correto.');
      return;
    }

    setSaving(match.id_match);
    try {
      await updateMatchStatus(match.id_match, 'FINISHED', scores.a, scores.b);
      setEditScores(prev => { const next = { ...prev }; delete next[match.id_match]; return next; });
      loadMatches();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao finalizar jogo');
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
  };

  const translateStatus = (status: string): string => {
    const map: Record<string, string> = {
      FINISHED: 'Finalizado',
      IN_PROGRESS: 'Em Jogo',
      LIVE: 'Em Jogo',
      CALLING: 'Chamando',
      TO_PLAY: 'Aguardando',
    };
    return map[status] || status;
  };

  // Group by round
  const roundIds = [...new Set(matches.map(m => m.id_round))].filter(Boolean).sort((a, b) => (a ?? 0) - (b ?? 0));
  const matchesWithoutRound = matches.filter(m => !m.id_round);

  const roundDates = new Map<number | undefined, string>();
  matches.forEach(m => {
    if (m.id_round && !roundDates.has(m.id_round) && m.scheduled_at) {
      const d = new Date(m.scheduled_at);
      roundDates.set(m.id_round, d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }));
    }
  });

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

      {/* Matches by Round */}
      <div className="space-y-12">
        {loading ? (
          <div className="py-20 text-center animate-pulse text-zinc-500 font-black uppercase tracking-widest text-xs">
            Sincronizando jogos...
          </div>
        ) : (roundIds.length === 0 && matchesWithoutRound.length === 0) ? (
          <div className="py-20 text-center text-zinc-600 font-black uppercase tracking-widest text-xs">
            Nenhum jogo agendado. Vá em Rodadas para agendar.
          </div>
        ) : (
          <>
            {roundIds.map((roundId, idx) => {
              const roundMatches = matches.filter(m => m.id_round === roundId);
              return (
                <div key={roundId} className="space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="h-px flex-1 bg-white/5" />
                    <h3 className="text-sm font-black uppercase tracking-[0.2em] text-zinc-500 bg-black/40 px-6 py-2 rounded-full border border-white/5 flex items-center gap-2">
                      <Calendar size={14} />
                      Rodada <span className="text-premium-accent">{idx + 1}</span> • {roundDates.get(roundId) || ''}
                    </h3>
                    <div className="h-px flex-1 bg-white/5" />
                  </div>

                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    {roundMatches.map((match) => renderMatchCard(match))}
                  </div>
                </div>
              );
            })}
            {matchesWithoutRound.length > 0 && (
              <div className="space-y-6">
                <h3 className="text-sm font-black uppercase tracking-[0.2em] text-zinc-500">Outros Jogos</h3>
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  {matchesWithoutRound.map(match => renderMatchCard(match))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );

  function renderMatchCard(match: Match) {
    const scores = editScores[match.id_match];
    const scoreA = scores?.a ?? match.games_double_a;
    const scoreB = scores?.b ?? match.games_double_b;
    const isEditable = match.status === 'IN_PROGRESS' || match.status === 'LIVE';
    const isFinished = match.status === 'FINISHED';
    const hasUnsavedChanges = scores && (scores.a !== match.games_double_a || scores.b !== match.games_double_b);
    const time = match.scheduled_at ? new Date(match.scheduled_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';

    return (
      <div key={match.id_match} className={`premium-card !p-0 overflow-hidden transition-all duration-500 ${isFinished ? 'border-green-500/20 opacity-75' : 'border-white/5 hover:border-premium-accent/50'}`}>
        {/* Match header */}
        <div className="p-4 border-b border-white/5 flex justify-between items-center bg-white/[0.01]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/5 rounded-xl text-zinc-500">
              <Monitor size={14} />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{match.court_name}</span>
              {time && <span className="text-[10px] text-zinc-600 ml-2">{time}</span>}
            </div>
          </div>
          <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${statusColors[match.status] || ''}`}>
            {translateStatus(match.status)}
          </span>
        </div>

        {/* Teams and Score */}
        <div className="p-6 flex items-center justify-between gap-4">
          <div className="flex-1 text-right min-w-0">
            <p className={`text-lg font-black italic uppercase leading-tight truncate ${isFinished && scoreA > scoreB ? 'text-green-400' : ''}`}>
              {match.double_a_name}
            </p>
            <p className="text-[9px] text-zinc-600 font-bold tracking-widest uppercase mt-1">Dupla A</p>
          </div>

          <div className="flex items-center gap-3 shrink-0 px-2">
            {isEditable ? (
              <>
                <input
                  type="number"
                  min="0"
                  max="7"
                  className="w-14 h-14 bg-white/5 border-2 border-premium-accent/50 rounded-2xl text-center text-2xl font-black italic text-white focus:border-premium-accent outline-none transition-all"
                  value={scoreA}
                  onChange={(e) => setScore(match.id_match, 'a', Math.max(0, Math.min(7, parseInt(e.target.value) || 0)))}
                />
                <div className="text-zinc-600 font-black text-lg">×</div>
                <input
                  type="number"
                  min="0"
                  max="7"
                  className="w-14 h-14 bg-white/5 border-2 border-premium-accent/50 rounded-2xl text-center text-2xl font-black italic text-white focus:border-premium-accent outline-none transition-all"
                  value={scoreB}
                  onChange={(e) => setScore(match.id_match, 'b', Math.max(0, Math.min(7, parseInt(e.target.value) || 0)))}
                />
              </>
            ) : (
              <>
                <div className={`w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center text-2xl font-black italic ${isFinished && scoreA > scoreB ? 'text-green-400 border border-green-500/30' : 'text-white border border-white/10'}`}>
                  {scoreA}
                </div>
                <div className="text-zinc-700 font-black text-lg">×</div>
                <div className={`w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center text-2xl font-black italic ${isFinished && scoreB > scoreA ? 'text-green-400 border border-green-500/30' : 'text-white border border-white/10'}`}>
                  {scoreB}
                </div>
              </>
            )}
          </div>

          <div className="flex-1 text-left min-w-0">
            <p className={`text-lg font-black italic uppercase leading-tight truncate ${isFinished && scoreB > scoreA ? 'text-green-400' : ''}`}>
              {match.double_b_name}
            </p>
            <p className="text-[9px] text-zinc-600 font-bold tracking-widest uppercase mt-1">Dupla B</p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="p-4 bg-white/[0.02] border-t border-white/5 flex flex-wrap gap-2 items-center justify-between">
          <div className="flex gap-2 flex-wrap">
            {/* TO_PLAY: start or notify */}
            {match.status === 'TO_PLAY' && (
              <>
                <button
                  onClick={() => handleStartMatch(match.id_match)}
                  className="flex items-center gap-2 px-4 py-2 bg-premium-accent text-black rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all"
                >
                  <Play size={14} fill="currentColor" /> Iniciar Jogo
                </button>
                <button
                  onClick={() => handleNotify(match.id_match)}
                  disabled={notifying === match.id_match}
                  className="flex items-center gap-2 px-4 py-2 bg-white/5 text-zinc-500 rounded-xl text-[10px] font-black uppercase tracking-widest border border-white/10 hover:bg-white/10 transition-all"
                >
                  <Smartphone size={14} className={notifying === match.id_match ? 'animate-bounce' : ''} />
                  {notifying === match.id_match ? 'Enviando...' : 'Notificar'}
                </button>
              </>
            )}

            {/* CALLING: start */}
            {match.status === 'CALLING' && (
              <button
                onClick={() => handleStartMatch(match.id_match)}
                className="flex items-center gap-2 px-4 py-2 bg-premium-accent text-black rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all"
              >
                <Play size={14} fill="currentColor" /> Iniciar Jogo
              </button>
            )}

            {/* IN_PROGRESS: save score + finish */}
            {isEditable && (
              <>
                {hasUnsavedChanges && (
                  <button
                    onClick={() => handleSaveScore(match)}
                    disabled={saving === match.id_match}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-500/20 text-blue-400 rounded-xl text-[10px] font-black uppercase tracking-widest border border-blue-500/30 hover:bg-blue-500/30 transition-all disabled:opacity-50"
                  >
                    <Save size={14} /> {saving === match.id_match ? 'Salvando...' : 'Salvar Placar'}
                  </button>
                )}
                {savedFeedback === match.id_match && (
                  <span className="text-green-400 text-[10px] font-black uppercase tracking-widest animate-pulse">✓ Salvo!</span>
                )}
                <button
                  onClick={() => handleFinishMatch(match)}
                  disabled={saving === match.id_match}
                  className="flex items-center gap-2 px-4 py-2 bg-green-500/20 text-green-400 rounded-xl text-[10px] font-black uppercase tracking-widest border border-green-500/30 hover:bg-green-500/30 transition-all disabled:opacity-50"
                >
                  <CheckCircle size={14} /> Finalizar Jogo
                </button>
              </>
            )}

            {/* FINISHED: show winner */}
            {isFinished && (
              <span className="text-[10px] font-black uppercase tracking-widest text-green-400 flex items-center gap-2">
                <CheckCircle size={14} />
                {scoreA > scoreB ? match.double_a_name : scoreB > scoreA ? match.double_b_name : 'WO'} venceu
                • +3 pts
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }
};

export default JogosPage;
