import { useState, useEffect } from 'react';
import { useCategory } from '../context/CategoryContext';
import { useNavigate } from 'react-router-dom';
import API_URL from '../config';
import {
  Calendar,
  Users,
  Play,
  CheckCircle,
  AlertCircle,
  Shuffle,
  Zap,
  RefreshCw,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

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
  status: 'PENDING' | 'IN_PROGRESS' | 'FINISHED';
  doubles?: Double[];
  total_doubles?: number;
}

const RondasPage = () => {
  const { selectedCategory } = useCategory();
  const navigate = useNavigate();
  const [rounds, setRounds] = useState<Round[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingCategory, setGeneratingCategory] = useState<number | null>(null);
  const [schedulingRound, setSchedulingRound] = useState<number | null>(null);
  const [expandedRound, setExpandedRound] = useState<number | null>(null);

  const categories = [
    { id: 1, name: 'Masculino Iniciante' },
    { id: 2, name: 'Masculino 4ª' },
    { id: 3, name: 'Feminino Iniciante' },
    { id: 4, name: 'Feminino 6ª' },
    { id: 5, name: 'Feminino 4ª' }
  ];

  const loadRounds = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/tournaments/1/rounds`);
      if (!response.ok) throw new Error('Failed to load rounds');
      const data = await response.json();
      setRounds(data);
    } catch (err) {
      console.error(err);
      setRounds([]);
    } finally {
      setLoading(false);
    }
  };

  const loadRoundDoubles = async (round: Round) => {
    if (expandedRound === round.id_round) {
      setExpandedRound(null);
      return;
    }
    try {
      const response = await fetch(`${API_URL}/api/tournaments/1/rounds/${round.id_category}/calendar`);
      if (!response.ok) throw new Error('Failed to load calendar');
      const calendar = await response.json();
      const roundData = calendar.find((r: any) => r.id_round === round.id_round);
      if (roundData?.doubles) {
        setRounds(prev => prev.map(r =>
          r.id_round === round.id_round ? { ...r, doubles: roundData.doubles } : r
        ));
      }
      setExpandedRound(round.id_round);
    } catch (err) {
      console.error(err);
      setExpandedRound(round.id_round);
    }
  };

  useEffect(() => {
    loadRounds();
  }, []);

  const handleGenerateRounds = async (categoryId: number) => {
    setGeneratingCategory(categoryId);
    try {
      const response = await fetch(`${API_URL}/api/tournaments/1/generate-rounds/${categoryId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start_date: '2026-04-16' })
      });
      if (!response.ok) throw new Error('Erro ao gerar rodadas');
      await loadRounds();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao gerar rodadas');
    } finally {
      setGeneratingCategory(null);
    }
  };

  const handleScheduleRound = async (roundId: number) => {
    setSchedulingRound(roundId);
    try {
      const response = await fetch(`${API_URL}/api/rounds/${roundId}/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!response.ok) throw new Error('Erro ao agendar rodada');
      await loadRounds();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao agendar rodada');
    } finally {
      setSchedulingRound(null);
    }
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr + 'T12:00:00');
    return date.toLocaleDateString('pt-BR', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit'
    });
  };

  const statusColors: Record<string, string> = {
    FINISHED: 'bg-green-500/20 text-green-400 border border-green-500/30',
    IN_PROGRESS: 'bg-premium-accent/20 text-premium-accent border border-premium-accent/30',
    PENDING: 'bg-white/5 text-zinc-400 border border-white/10'
  };

  const statusLabels: Record<string, string> = {
    FINISHED: 'Finalizada',
    IN_PROGRESS: 'Agendada',
    PENDING: 'Pendente'
  };

  if (loading) {
    return (
      <div className="py-20 text-center animate-pulse text-zinc-500 font-black uppercase tracking-widest text-xs">
        Sincronizando rodadas...
      </div>
    );
  }

  const roundsByCategory = categories.map(cat => ({
    ...cat,
    rounds: rounds.filter(r => r.id_category === cat.id).sort((a, b) => a.round_number - b.round_number)
  }));

  const filteredRoundsByCategory = selectedCategory
    ? roundsByCategory.filter(cat => cat.id === selectedCategory)
    : roundsByCategory;

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
            Rodadas &<br /><span className="text-premium-accent">Duplas</span>
          </h2>
          <p className="text-zinc-500 text-sm max-w-md">
            Cada rodada sorteia duplas novas (nenhuma dupla se repete). Todos jogam contra todos ao longo das semanas.
          </p>
        </div>
        <button
          onClick={loadRounds}
          className="bg-white/5 hover:bg-white/10 border border-white/10 px-6 py-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all inline-flex items-center gap-2"
        >
          <RefreshCw size={14} />
          Atualizar
        </button>
      </div>

      {/* Flow explanation */}
      <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-zinc-600">
        <span className="bg-white/5 px-3 py-1.5 rounded-lg border border-white/10">1. Gerar Rodadas</span>
        <span>→</span>
        <span className="bg-white/5 px-3 py-1.5 rounded-lg border border-white/10">2. Agendar Horários</span>
        <span>→</span>
        <span className="bg-white/5 px-3 py-1.5 rounded-lg border border-white/10">3. Jogar & Placar</span>
        <span>→</span>
        <span className="bg-premium-accent/20 text-premium-accent px-3 py-1.5 rounded-lg border border-premium-accent/30">4. Ranking</span>
      </div>

      {/* Categories & Rounds */}
      <div className="space-y-12">
        {filteredRoundsByCategory.map((catData) => (
          <div key={catData.id} className="space-y-6">
            {/* Category Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="h-px w-12 bg-white/5" />
                <h3 className="text-lg font-black uppercase tracking-[0.2em] text-white flex items-center gap-3">
                  <Users size={16} className="text-premium-accent" />
                  {catData.name}
                  <span className="text-xs text-zinc-500 font-bold">({catData.rounds.length} rodadas)</span>
                </h3>
              </div>
              {catData.rounds.length === 0 && (
                <button
                  onClick={() => handleGenerateRounds(catData.id)}
                  disabled={generatingCategory === catData.id}
                  className="bg-premium-accent/20 hover:bg-premium-accent/30 text-premium-accent border border-premium-accent/30 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all inline-flex items-center gap-2 disabled:opacity-50"
                >
                  {generatingCategory === catData.id ? (
                    <><RefreshCw size={12} className="animate-spin" /> Gerando...</>
                  ) : (
                    <><Shuffle size={12} /> Gerar Rodadas</>
                  )}
                </button>
              )}
            </div>

            {/* Rounds List */}
            {catData.rounds.length === 0 ? (
              <div className="premium-card p-12 text-center">
                <AlertCircle size={24} className="mx-auto text-zinc-600 mb-3" />
                <p className="text-zinc-500 font-bold uppercase tracking-widest text-xs">Nenhuma rodada gerada</p>
                <p className="text-zinc-600 text-xs mt-2">Clique em "Gerar Rodadas" para criar o calendário com duplas sorteadas</p>
              </div>
            ) : (
              <div className="space-y-3">
                {catData.rounds.map((round) => (
                  <div key={round.id_round} className="premium-card !p-0 overflow-hidden border-white/5 hover:border-white/10 transition-all">
                    {/* Round header row */}
                    <div className="flex items-center justify-between p-4 gap-4">
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-sm font-black text-premium-accent shrink-0">
                          {round.round_number}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-black uppercase tracking-wide text-white">Rodada {round.round_number}</p>
                          <p className="text-[10px] text-zinc-500 font-bold">
                            {formatDate(round.scheduled_date)} • {(round.window_start || '18:00').substring(0, 5)} - {(round.window_end || '23:00').substring(0, 5)}
                          </p>
                        </div>
                      </div>

                      <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest shrink-0 ${statusColors[round.status] || statusColors.PENDING}`}>
                        {statusLabels[round.status] || round.status}
                      </span>

                      <div className="flex items-center gap-2 shrink-0">
                        {/* Show doubles button */}
                        <button
                          onClick={() => loadRoundDoubles(round)}
                          className="flex items-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-zinc-400 transition-all border border-white/10"
                        >
                          <Users size={12} />
                          Duplas
                          {expandedRound === round.id_round ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        </button>

                        {/* Schedule button */}
                        {round.status === 'PENDING' && (
                          <button
                            onClick={() => handleScheduleRound(round.id_round)}
                            disabled={schedulingRound === round.id_round}
                            className="flex items-center gap-1.5 px-3 py-2 bg-premium-accent/20 text-premium-accent rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-premium-accent/30 transition-all disabled:opacity-50 border border-premium-accent/30"
                          >
                            {schedulingRound === round.id_round ? (
                              <><RefreshCw size={12} className="animate-spin" /> Agendando...</>
                            ) : (
                              <><Zap size={12} fill="currentColor" /> Agendar</>
                            )}
                          </button>
                        )}

                        {/* Go to matches button */}
                        {round.status === 'IN_PROGRESS' && (
                          <button
                            onClick={() => navigate('/jogos')}
                            className="flex items-center gap-1.5 px-3 py-2 bg-premium-accent text-black rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all"
                          >
                            <Play size={12} fill="currentColor" /> Ver Jogos
                          </button>
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

                    {/* Expanded doubles section */}
                    {expandedRound === round.id_round && (
                      <div className="border-t border-white/5 bg-white/[0.02] p-4">
                        {round.doubles && round.doubles.length > 0 ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {round.doubles.map((d, i) => (
                              <div key={d.id_double} className="flex items-center gap-3 bg-white/5 rounded-xl p-3 border border-white/5">
                                <div className="w-7 h-7 bg-premium-accent/20 rounded-lg flex items-center justify-center text-[10px] font-black text-premium-accent shrink-0">
                                  {i + 1}
                                </div>
                                <p className="text-xs font-bold text-white truncate">{d.display_name}</p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-zinc-500 text-center py-2">Carregando duplas...</p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default RondasPage;
