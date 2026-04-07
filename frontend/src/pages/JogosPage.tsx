import { useState, useEffect } from 'react';
import {
  fetchMatches,
  scheduleMatches,
  updateMatchStatus,
  callMatch,
  type Match
} from '../api';
import {
  Clock,
  Monitor,
  CheckCircle,
  Play,
  Smartphone,
  Calendar
} from 'lucide-react';

const JogosPage = () => {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [notifying, setNotifying] = useState<number | null>(null);

  const loadMatches = async () => {
    setLoading(true);
    try {
      const data = await fetchMatches(1);
      setMatches(data);
    } catch (err) {
      console.error(err);
    } finally {
      setTimeout(() => setLoading(false), 500);
    }
  };

  useEffect(() => {
    loadMatches();
  }, []);

  const handleUpdateStatus = async (matchId: number, status: string, scoreA?: number, scoreB?: number) => {
    try {
      await updateMatchStatus(matchId, status, scoreA, scoreB);
      loadMatches();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao atualizar status');
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

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' });
  };

  const statusColors: Record<string, string> = {
    FINISHED: 'bg-zinc-800 text-zinc-500',
    IN_PROGRESS: 'bg-premium-accent/20 text-premium-accent border border-premium-accent/30',
    LIVE: 'bg-premium-accent/20 text-premium-accent border border-premium-accent/30',
    CALLING: 'bg-amber-500/20 text-amber-500 border border-amber-500/30 animate-pulse',
    SCHEDULED: 'bg-white/5 text-zinc-400',
    TO_PLAY: 'bg-white/5 text-zinc-400',
  };

  const translateStatus = (status: string): string => {
    const map: Record<string, string> = {
      FINISHED: 'Finalizado',
      IN_PROGRESS: 'Em Andamento',
      LIVE: 'Em Andamento',
      CALLING: 'Chamando',
      SCHEDULED: 'Agendado',
      TO_PLAY: 'Agendado',
    };
    return map[status] || status;
  };

  // Group matches by round (id_round) - Ranking SRB uses rounds instead of groups
  const roundIds = [...new Set(matches.map(m => m.id_round))].sort((a, b) => (a ?? 0) - (b ?? 0));
  const roundDates = new Map<number | undefined, string>();
  matches.forEach(m => {
    if (m.id_round && !roundDates.has(m.id_round)) {
      // Extract date from first match in round (would ideally come from API)
      roundDates.set(m.id_round, m.scheduled_at ? new Date(m.scheduled_at).toLocaleDateString('pt-BR') : 'Data TBD');
    }
  });

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-1000">

      {/* Header section */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/5 border border-white/10 rounded-full text-[10px] font-black text-zinc-500 uppercase tracking-widest leading-none">
                <Calendar size={12} />
                Ranking SRB - Quinta 18h-23h
            </div>
            <h2 className="text-5xl font-black italic uppercase tracking-tighter leading-none">Cronograma <br/><span className="text-premium-accent">de Rodadas</span></h2>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
                onClick={() => scheduleMatches(1).then(loadMatches)}
                className="bg-white/5 hover:bg-white/10 border border-white/10 px-6 py-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all"
          >
            Agendar Próxima
          </button>
          <button className="btn-primary px-8 py-4 text-xs">Atualizar</button>
        </div>
      </div>

      {/* Matches Grid Grouped by Round (Rodada) */}
      <div className="space-y-16">
        {loading ? (
             <div className="py-20 text-center animate-pulse text-zinc-500 font-black uppercase tracking-widest text-xs">Sincronizando rodadas...</div>
        ) : roundIds.length === 0 ? (
             <div className="py-20 text-center text-zinc-600 font-black uppercase tracking-widest text-xs">Nenhuma rodada agendada</div>
        ) : roundIds.map((roundId, idx) => (
            <div key={roundId ?? idx} className="space-y-8">
                <div className="flex items-center gap-4">
                    <div className="h-px flex-1 bg-white/5" />
                    <h3 className="text-sm font-black uppercase tracking-[0.3em] text-zinc-600 bg-black/40 px-6 py-2 rounded-full border border-white/5 flex items-center gap-2">
                        <Calendar size={14} />
                        Rodada <span className="text-premium-accent">{idx + 1}</span> • {roundDates.get(roundId) || 'TBD'}
                    </h3>
                    <div className="h-px flex-1 bg-white/5" />
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    {matches.filter(m => m.id_round === roundId).map((match) => (
                        <div key={match.id_match} className="premium-card !p-0 overflow-hidden border-white/5 group hover:border-premium-accent/50 transition-all duration-500">
                <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/[0.01]">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/5 rounded-xl text-zinc-500">
                            <Monitor size={16} />
                        </div>
                        <span className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400">{match.court_name}</span>
                    </div>
                    <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${statusColors[match.status]}`}>
                        {translateStatus(match.status)}
                    </span>
                </div>

                <div className="p-8 flex items-center justify-between gap-8 relative overflow-hidden">
                    {/* Background Decorative */}
                    <div className="absolute inset-0 bg-gradient-to-r from-premium-accent/0 via-premium-accent/5 to-premium-accent/0 opacity-0 group-hover:opacity-100 transition-opacity duration-1000 -translate-x-full group-hover:translate-x-full" />

                    <div className="flex-1 space-y-2 text-right">
                        <p className="text-xl font-black italic uppercase leading-tight truncate">{match.double_a_name}</p>
                        <p className="text-[10px] text-zinc-600 font-bold tracking-widest uppercase">Dupla A</p>
                    </div>

                    <div className="flex items-center gap-4 shrink-0 px-6">
                        <input 
                            type="number" 
                            className="w-16 h-16 bg-white/5 border border-white/10 rounded-2xl text-center text-3xl font-black italic text-white focus:border-premium-accent outline-none" 
                            value={match.games_double_a}
                            onChange={(e) => handleUpdateStatus(match.id_match, match.status, parseInt(e.target.value), match.games_double_b)}
                        />
                        <div className="w-2 h-2 rounded-full bg-zinc-800" />
                        <input 
                            type="number" 
                            className="w-16 h-16 bg-white/5 border border-white/10 rounded-2xl text-center text-3xl font-black italic text-white focus:border-premium-accent outline-none" 
                            value={match.games_double_b}
                            onChange={(e) => handleUpdateStatus(match.id_match, match.status, match.games_double_a, parseInt(e.target.value))}
                        />
                    </div>

                    <div className="flex-1 space-y-2 text-left">
                        <p className="text-xl font-black italic uppercase leading-tight truncate">{match.double_b_name}</p>
                        <p className="text-[10px] text-zinc-600 font-bold tracking-widest uppercase">Dupla B</p>
                    </div>
                </div>

                <div className="p-6 bg-white/[0.02] border-t border-white/5 flex flex-wrap gap-2 items-center justify-between">
                    <div className="flex gap-2">
                        {match.status === 'CALLING' && (
                            <button
                                onClick={() => handleUpdateStatus(match.id_match, 'IN_PROGRESS')}
                                className="flex items-center gap-2 px-4 py-2 bg-premium-accent text-black rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all"
                            >
                                <Play size={14} fill="currentColor" /> Iniciar Jogo
                            </button>
                        )}
                        {match.status === 'IN_PROGRESS' && (
                            <button
                                onClick={() => handleUpdateStatus(match.id_match, 'FINISHED')}
                                className="flex items-center gap-2 px-4 py-2 bg-zinc-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-green-600 transition-all border border-white/10"
                            >
                                <CheckCircle size={14} /> Finalizar Jogo
                            </button>
                        )}
                    </div>

                    <button 
                        onClick={() => handleNotify(match.id_match)}
                        disabled={notifying === match.id_match}
                        className={`group flex items-center gap-2 px-4 py-2 bg-white/5 text-zinc-500 rounded-xl text-[10px] font-black uppercase tracking-widest border border-white/10 hover:bg-white/10 transition-all ${notifying === match.id_match ? 'opacity-50' : ''}`}
                    >
                        <Smartphone size={14} className={notifying === match.id_match ? 'animate-bounce' : ''} />
                        {notifying === match.id_match ? 'Enviando...' : 'Notificar WhatsApp'}
                    </button>
                </div>
                        </div>
                    ))}
                </div>
            </div>
        ))}
      </div>

    </div>
  );
};

export default JogosPage;
