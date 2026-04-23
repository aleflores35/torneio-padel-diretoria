import { useState, useEffect } from 'react';
import { RefreshCw, Trophy, Calendar, ChevronDown, ChevronUp } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const TOURNAMENT_ID = 7;

interface ResultMatch {
  id_match: number;
  double_a_name: string;
  double_b_name: string;
  score_a: number;
  score_b: number;
  court_name: string | null;
  scheduled_at: string | null;
  status: 'FINISHED' | 'WO';
}

interface ResultRound {
  id_round: number;
  round_number: number;
  scheduled_date: string;
  matches: ResultMatch[];
}

interface CategoryResults {
  id_category: number;
  name: string;
  rounds: ResultRound[];
}

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
};

const formatTime = (isoStr: string | null) => {
  if (!isoStr) return null;
  const d = new Date(isoStr);
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};

const MatchCard = ({ match }: { match: ResultMatch }) => {
  const aWon = match.score_a > match.score_b;
  const bWon = match.score_b > match.score_a;
  const isWO = match.status === 'WO';

  return (
    <div className="bg-white/[0.03] border border-white/8 rounded-xl p-3 sm:p-4">
      {isWO && (
        <span className="text-[9px] font-black uppercase tracking-widest text-orange-400 mb-2 block">W.O.</span>
      )}
      <div className="flex items-center gap-2 sm:gap-4">
        {/* Dupla A */}
        <div className={`flex-1 min-w-0 text-right ${aWon ? 'opacity-100' : 'opacity-50'}`}>
          <p className={`text-xs sm:text-sm font-display font-black leading-tight ${aWon ? 'text-white' : 'text-white/60'}`}>
            {match.double_a_name.split(' / ').map((n, i) => (
              <span key={i} className="block">{n}</span>
            ))}
          </p>
        </div>

        {/* Placar */}
        <div className="flex-shrink-0 flex items-center gap-2">
          <span className={`text-2xl sm:text-3xl font-display font-black tabular-nums ${aWon ? 'text-green-400' : 'text-white/30'}`}>
            {match.score_a}
          </span>
          <span className="text-white/20 font-black text-sm">×</span>
          <span className={`text-2xl sm:text-3xl font-display font-black tabular-nums ${bWon ? 'text-green-400' : 'text-white/30'}`}>
            {match.score_b}
          </span>
        </div>

        {/* Dupla B */}
        <div className={`flex-1 min-w-0 ${bWon ? 'opacity-100' : 'opacity-50'}`}>
          <p className={`text-xs sm:text-sm font-display font-black leading-tight ${bWon ? 'text-white' : 'text-white/60'}`}>
            {match.double_b_name.split(' / ').map((n, i) => (
              <span key={i} className="block">{n}</span>
            ))}
          </p>
        </div>
      </div>

      {/* Meta */}
      {(match.court_name || match.scheduled_at) && (
        <div className="flex items-center justify-center gap-3 mt-2 pt-2 border-t border-white/5">
          {match.court_name && (
            <span className="text-[9px] font-bold uppercase tracking-widest text-white/30">{match.court_name}</span>
          )}
          {match.scheduled_at && (
            <span className="text-[9px] font-bold uppercase tracking-widest text-white/30">{formatTime(match.scheduled_at)}</span>
          )}
        </div>
      )}
    </div>
  );
};

const RoundBlock = ({ round, defaultOpen = false }: { round: ResultRound; defaultOpen?: boolean }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-white/8 rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-white/[0.04] hover:bg-white/[0.07] transition-all"
      >
        <div className="flex items-center gap-3">
          <Calendar className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white capitalize">
            {formatDate(round.scheduled_date)}
          </span>
          <span className="text-[9px] font-black uppercase tracking-widest text-white/30">
            · {round.matches.length} jogo{round.matches.length !== 1 ? 's' : ''}
          </span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-white/30" /> : <ChevronDown className="w-4 h-4 text-white/30" />}
      </button>
      {open && (
        <div className="p-3 sm:p-4 space-y-2 sm:space-y-3">
          {round.matches.map(m => <MatchCard key={m.id_match} match={m} />)}
        </div>
      )}
    </div>
  );
};

const ResultadosPage = () => {
  const [data, setData] = useState<CategoryResults[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState('Nunca');

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/tournaments/${TOURNAMENT_ID}/resultados`);
      const json: CategoryResults[] = res.ok ? await res.json() : [];
      setData(json);
      if (json.length > 0 && selectedCategory === null) setSelectedCategory(json[0].id_category);
      setLastUpdate(new Date().toLocaleTimeString('pt-BR'));
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const current = data.find(c => c.id_category === selectedCategory);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Russo+One&family=Chakra+Petch:wght@300;400;600;700&display=swap');`}</style>
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="w-10 h-10 text-green-400 animate-spin" />
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40" style={{ fontFamily: 'Chakra Petch, sans-serif' }}>
            Carregando Resultados
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white overflow-x-hidden" style={{ fontFamily: 'Chakra Petch, sans-serif' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Russo+One&family=Chakra+Petch:wght@300;400;600;700&display=swap');
        .font-display { font-family: 'Russo One', sans-serif; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      {/* Header */}
      <div className="px-4 pt-8 pb-6 sm:px-8 sm:pt-12 max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-4">
          <span className="w-8 h-0.5 bg-green-400" />
          <span className="text-[9px] font-black uppercase tracking-[0.35em] text-green-400">Resultados Oficiais · Ranking SRB 2026</span>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <h1 className="text-4xl sm:text-6xl font-display font-black leading-none tracking-tighter uppercase">
            Placar<br /><span className="text-green-400">das Rodadas</span>
          </h1>
          <div className="flex items-center gap-2">
            <button
              onClick={load}
              className="flex items-center gap-2 px-4 py-2.5 bg-white/5 border border-white/10 hover:bg-white/10 transition-all rounded-xl"
            >
              <RefreshCw className="w-3.5 h-3.5 text-green-400" />
              <span className="text-[9px] font-black uppercase tracking-widest">Atualizar</span>
            </button>
            <div className="px-4 py-2.5 bg-green-400 text-black rounded-xl">
              <p className="text-[8px] font-black uppercase tracking-widest opacity-60 leading-none">Atualizado</p>
              <p className="text-sm font-display font-black leading-tight mt-0.5">{lastUpdate}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Category tabs */}
      {data.length > 0 && (
        <div className="px-4 sm:px-8 max-w-4xl mx-auto">
          <div className="flex gap-1 overflow-x-auto no-scrollbar border-b border-white/5 pb-0">
            {data.map(cat => (
              <button
                key={cat.id_category}
                onClick={() => setSelectedCategory(cat.id_category)}
                className={`flex-shrink-0 px-4 py-3 text-[10px] font-black uppercase tracking-[0.15em] transition-all relative whitespace-nowrap ${
                  selectedCategory === cat.id_category ? 'text-green-400' : 'text-white/40 hover:text-white'
                }`}
              >
                {cat.name}
                {selectedCategory === cat.id_category && (
                  <div className="absolute bottom-0 left-0 w-full h-[2px] bg-green-400" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Rounds */}
      <div className="px-4 sm:px-8 pt-6 pb-16 max-w-4xl mx-auto space-y-4">
        {!current || current.rounds.length === 0 ? (
          <div className="py-16 text-center">
            <Trophy className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
            <p className="text-zinc-600 font-black uppercase tracking-widest text-xs">Nenhum resultado ainda</p>
          </div>
        ) : (
          current.rounds.map((r, i) => <RoundBlock key={r.id_round} round={r} defaultOpen={i === 0} />)
        )}
      </div>
    </div>
  );
};

export default ResultadosPage;
