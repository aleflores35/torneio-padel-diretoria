import { useState, useEffect } from 'react';
import { useCategory } from '../context/CategoryContext';
import {
  Calendar,
  Clock,
  Users,
  Play,
  CheckCircle,
  AlertCircle,
  Shuffle,
  Zap,
  RefreshCw
} from 'lucide-react';

interface Round {
  id_round: number;
  id_tournament: number;
  id_category: number;
  round_number: number;
  scheduled_date: string;
  window_start: string;
  window_end: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'FINISHED';
  notes?: string;
}

const RondasPage = () => {
  const { selectedCategory } = useCategory();
  const [rounds, setRounds] = useState<Round[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingCategory, setGeneratingCategory] = useState<number | null>(null);
  const [schedulingRound, setSchedulingRound] = useState<number | null>(null);

  // Hardcoded 5 Ranking SRB categories
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
      const response = await fetch(`http://localhost:3001/api/tournaments/1/rounds`);
      if (!response.ok) throw new Error('Failed to load rounds');
      const data = await response.json();
      setRounds(data);
      setLoading(false);
    } catch (err) {
      console.error(err);
      // Fallback: load mock data if API fails
      const mockRounds: Round[] = [
        {
          id_round: 1,
          id_tournament: 1,
          id_category: 1,
          round_number: 1,
          scheduled_date: '2026-04-16',
          window_start: '18:00',
          window_end: '23:00',
          status: 'PENDING'
        }
      ];
      setRounds(mockRounds);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRounds();
  }, []);

  const handleGenerateRounds = async (categoryId: number) => {
    setGeneratingCategory(categoryId);
    try {
      const response = await fetch(`http://localhost:3001/api/tournaments/1/generate-rounds/${categoryId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start_date: '2026-04-16' })
      });
      if (!response.ok) throw new Error('Erro ao gerar rodadas');
      const result = await response.json();
      console.log('Rodadas geradas:', result);
      await loadRounds();
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : 'Erro ao gerar rodadas');
    } finally {
      setGeneratingCategory(null);
    }
  };

  const handleScheduleRound = async (roundId: number) => {
    setSchedulingRound(roundId);
    try {
      const response = await fetch(`http://localhost:3001/api/rounds/${roundId}/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!response.ok) throw new Error('Erro ao agendar rodada');
      const result = await response.json();
      console.log('Rodada agendada:', result);
      await loadRounds();
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : 'Erro ao agendar rodada');
    } finally {
      setSchedulingRound(null);
    }
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const statusColors: Record<string, string> = {
    FINISHED: 'bg-zinc-800 text-zinc-500',
    IN_PROGRESS: 'bg-premium-accent/20 text-premium-accent border border-premium-accent/30',
    PENDING: 'bg-white/5 text-zinc-400'
  };

  const statusLabels: Record<string, string> = {
    FINISHED: 'Finalizada',
    IN_PROGRESS: 'Em Andamento',
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
    rounds: rounds.filter(r => r.id_category === cat.id)
  }));

  const filteredRoundsByCategory = selectedCategory
    ? roundsByCategory.filter(cat => cat.id === selectedCategory)
    : roundsByCategory;

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-1000">
      {/* Header section */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/5 border border-white/10 rounded-full text-[10px] font-black text-zinc-500 uppercase tracking-widest leading-none">
                <Calendar size={12} />
                Ranking SRB - Quinta 18h-23h
            </div>
            <h2 className="text-5xl font-black italic uppercase tracking-tighter leading-none">Gestão de <br/><span className="text-premium-accent">Rodadas</span></h2>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
                className="bg-white/5 hover:bg-white/10 border border-white/10 px-6 py-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all inline-flex items-center gap-2"
          >
            <RefreshCw size={14} />
            Atualizar
          </button>
        </div>
      </div>

      {/* Categories & Rounds Grid */}
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
                </h3>
              </div>
              <button
                onClick={() => handleGenerateRounds(catData.id)}
                disabled={generatingCategory === catData.id}
                className="bg-premium-accent/20 hover:bg-premium-accent/30 text-premium-accent border border-premium-accent/30 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all inline-flex items-center gap-2 disabled:opacity-50"
              >
                {generatingCategory === catData.id ? (
                  <>
                    <RefreshCw size={12} className="animate-spin" />
                    Gerando...
                  </>
                ) : (
                  <>
                    <Shuffle size={12} />
                    Gerar Rodadas
                  </>
                )}
              </button>
            </div>

            {/* Rounds List */}
            {catData.rounds.length === 0 ? (
              <div className="premium-card p-12 text-center">
                <AlertCircle size={24} className="mx-auto text-zinc-600 mb-3" />
                <p className="text-zinc-500 font-bold uppercase tracking-widest text-xs">Nenhuma rodada gerada</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {catData.rounds.map((round) => (
                  <div key={round.id_round} className="premium-card !p-0 overflow-hidden border-white/5 group hover:border-premium-accent/50 transition-all duration-500">
                    {/* Header */}
                    <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/[0.01]">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/5 rounded-xl text-zinc-500">
                          <Calendar size={16} />
                        </div>
                        <div>
                          <p className="text-xs font-black uppercase tracking-[0.2em] text-white">Rodada {round.round_number}</p>
                          <p className="text-[9px] text-zinc-600 font-bold">{formatDate(round.scheduled_date)}</p>
                        </div>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${statusColors[round.status]}`}>
                        {statusLabels[round.status]}
                      </span>
                    </div>

                    {/* Details */}
                    <div className="p-6 space-y-4">
                      <div className="flex items-center gap-3 text-zinc-400">
                        <Clock size={14} />
                        <span className="text-xs font-bold uppercase tracking-widest">{round.window_start} - {round.window_end}</span>
                      </div>

                      {round.notes && (
                        <p className="text-[10px] text-zinc-500 font-medium italic border-l-2 border-premium-accent/30 pl-3">
                          {round.notes}
                        </p>
                      )}

                      {/* Action Buttons */}
                      <div className="flex gap-2 pt-4 border-t border-white/5">
                        {round.status === 'PENDING' && (
                          <button
                            onClick={() => handleScheduleRound(round.id_round)}
                            disabled={schedulingRound === round.id_round}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-premium-accent/20 text-premium-accent rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-premium-accent/30 transition-all disabled:opacity-50 border border-premium-accent/30"
                          >
                            {schedulingRound === round.id_round ? (
                              <>
                                <RefreshCw size={12} className="animate-spin" />
                                Agendando...
                              </>
                            ) : (
                              <>
                                <Zap size={12} fill="currentColor" />
                                Agendar
                              </>
                            )}
                          </button>
                        )}
                        {round.status === 'IN_PROGRESS' && (
                          <button className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-premium-accent text-black rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all">
                            <Play size={12} fill="currentColor" />
                            Ver Jogos
                          </button>
                        )}
                        {round.status === 'FINISHED' && (
                          <button className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-zinc-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-zinc-600 transition-all">
                            <CheckCircle size={12} />
                            Ver Resultado
                          </button>
                        )}
                      </div>
                    </div>
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
