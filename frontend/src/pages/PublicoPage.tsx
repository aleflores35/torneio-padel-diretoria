import { useState, useEffect } from 'react';
import API_URL, { TOURNAMENT_ID } from '../config';
import { Zap } from 'lucide-react';

interface Category {
  id: number;
  name: string;
}

interface MatchItem {
  id_match: number;
  id_category: number | null;
  double_a_name: string;
  double_b_name: string;
  court_name: string;
  scheduled_at: string | null;
  scheduled_date: string | null;
  status: string;
  score_a: number | null;
  score_b: number | null;
}

// Data de hoje como YYYY-MM-DD (local, sem bug de timezone)
const todayLocal = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Próxima quinta-feira (ou hoje se for quinta)
const targetDate = (): string => {
  const d = new Date();
  const day = d.getDay();
  if (day === 4) return todayLocal(); // hoje é quinta
  const diff = day < 4 ? 4 - day : 11 - day;
  const thu = new Date(d);
  thu.setDate(d.getDate() + diff);
  return `${thu.getFullYear()}-${String(thu.getMonth() + 1).padStart(2, '0')}-${String(thu.getDate()).padStart(2, '0')}`;
};

const formatTime = (iso: string | null): string => {
  if (!iso) return '';
  const t = iso.includes('T') ? iso.split('T')[1].substring(0, 5) : '';
  return t ? t.replace(':', 'h') : '';
};

const STATUS_ORDER: Record<string, number> = { IN_PROGRESS: 0, TO_PLAY: 1, FINISHED: 2, WO: 3 };

const PublicoPage = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [matches, setMatches] = useState<MatchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  const gameDate = targetDate();

  const loadData = async () => {
    try {
      const [catRes, matchRes] = await Promise.all([
        fetch(`${API_URL}/api/tournaments/${TOURNAMENT_ID}/categories`),
        fetch(`${API_URL}/api/tournaments/${TOURNAMENT_ID}/matches`),
      ]);
      if (catRes.ok) setCategories(await catRes.json());
      if (matchRes.ok) {
        const all: MatchItem[] = await matchRes.json();
        setMatches(all.filter(m => m.scheduled_date === gameDate));
      }
      setLastUpdate(new Date());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, []);

  const catMap: Record<number, string> = {};
  categories.forEach(c => { catMap[c.id] = c.name; });

  const sorted = [...matches].sort((a, b) => {
    const oa = STATUS_ORDER[a.status] ?? 9;
    const ob = STATUS_ORDER[b.status] ?? 9;
    if (oa !== ob) return oa - ob;
    return (a.scheduled_at || '').localeCompare(b.scheduled_at || '');
  });

  const inProgress = sorted.filter(m => m.status === 'IN_PROGRESS');
  const upcoming = sorted.filter(m => m.status === 'TO_PLAY');
  const done = sorted.filter(m => m.status === 'FINISHED' || m.status === 'WO');

  const gameDateFormatted = new Date(gameDate + 'T12:00:00').toLocaleDateString('pt-BR', {
    weekday: 'long', day: '2-digit', month: 'long'
  });

  if (loading) return (
    <div className="flex h-screen items-center justify-center bg-slate-950">
      <div className="flex flex-col items-center gap-6">
        <div className="w-16 h-16 border-4 border-green-400/20 border-t-green-400 rounded-full animate-spin" />
        <p className="text-green-400 font-black uppercase tracking-[0.3em] text-[10px] animate-pulse">Sincronizando...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-16">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Russo+One&family=Chakra+Petch:wght@400;600;700&display=swap');
        .font-display { font-family: 'Russo One', sans-serif; }
        body { font-family: 'Chakra Petch', sans-serif; }
      `}</style>

      {/* Header */}
      <div className="border-b border-white/5 bg-black/60 sticky top-0 z-10 backdrop-blur-md px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-3 h-3 rounded-full bg-green-400 animate-pulse" />
          <span className="text-green-400 text-sm font-black uppercase tracking-[0.3em]">AO VIVO</span>
          <span className="text-white/30 text-xs font-bold uppercase tracking-widest capitalize">{gameDateFormatted} · 18h às 21h</span>
        </div>
        <div className="text-[10px] font-black text-white/20 uppercase tracking-widest">
          atualizado {lastUpdate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </div>
      </div>

      {/* Big title */}
      <div className="px-8 pt-10 pb-6 border-b border-white/5">
        <div className="flex items-end justify-between gap-8">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-green-400 mb-2">Quadro Geral</div>
            <h1 className="text-7xl md:text-9xl font-display font-black text-white leading-none tracking-tighter uppercase">
              RANKING<br /><span className="text-green-400">PADEL SRB</span>
            </h1>
          </div>
          <div className="hidden md:flex gap-8 text-right shrink-0">
            <div>
              <div className="text-4xl font-display font-black text-green-400">{inProgress.length}</div>
              <div className="text-[10px] font-black text-white/30 uppercase tracking-widest">em quadra</div>
            </div>
            <div>
              <div className="text-4xl font-display font-black text-blue-400">{upcoming.length}</div>
              <div className="text-[10px] font-black text-white/30 uppercase tracking-widest">a jogar</div>
            </div>
            <div>
              <div className="text-4xl font-display font-black text-white/40">{done.length}</div>
              <div className="text-[10px] font-black text-white/30 uppercase tracking-widest">encerrados</div>
            </div>
          </div>
        </div>
      </div>

      {matches.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 gap-6">
          <Zap size={48} className="text-white/10" />
          <p className="text-white/20 font-black uppercase tracking-[0.3em] text-sm">Sem jogos programados para esta sessão</p>
        </div>
      ) : (
        <div className="px-8 pt-10 space-y-12">

          {/* EM ANDAMENTO */}
          {inProgress.length > 0 && (
            <div>
              <div className="flex items-center gap-4 mb-6">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-green-400">Em Andamento</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {inProgress.map(m => (
                  <MatchCard key={m.id_match} match={m} catName={catMap[m.id_category!]} variant="live" />
                ))}
              </div>
            </div>
          )}

          {/* A JOGAR */}
          {upcoming.length > 0 && (
            <div>
              <div className="flex items-center gap-4 mb-6">
                <div className="w-2 h-2 bg-blue-400 rounded-full" />
                <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-400">Próximos Jogos</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {upcoming.map(m => (
                  <MatchCard key={m.id_match} match={m} catName={catMap[m.id_category!]} variant="upcoming" />
                ))}
              </div>
            </div>
          )}

          {/* ENCERRADOS */}
          {done.length > 0 && (
            <div>
              <div className="flex items-center gap-4 mb-6">
                <div className="w-2 h-2 bg-white/20 rounded-full" />
                <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30">Encerrados</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                {done.map(m => (
                  <MatchCard key={m.id_match} match={m} catName={catMap[m.id_category!]} variant="done" />
                ))}
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
};

/* ─── Match Card ─────────────────────────────────────────────────────────────── */

interface MatchCardProps {
  match: MatchItem;
  catName?: string;
  variant: 'live' | 'upcoming' | 'done';
}

function MatchCard({ match, catName, variant }: MatchCardProps) {
  const time = formatTime(match.scheduled_at);
  const isWo = match.status === 'WO';

  const containerClass = {
    live: 'border-green-400 bg-green-400/5 shadow-[0_0_40px_rgba(74,222,128,0.1)]',
    upcoming: 'border-white/10 bg-white/[0.03]',
    done: 'border-white/5 bg-white/[0.02] opacity-60',
  }[variant];

  return (
    <div className={`relative p-6 border rounded-none transition-all ${containerClass}`}>
      {/* Live badge */}
      {variant === 'live' && (
        <div className="absolute -top-3 left-6 px-3 py-1 bg-green-400 text-black text-[9px] font-black uppercase tracking-widest flex items-center gap-2">
          <div className="w-1.5 h-1.5 bg-black rounded-full animate-pulse" />
          Em Andamento
        </div>
      )}

      {/* Meta */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {time && (
            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
              variant === 'live' ? 'bg-green-400/20 text-green-300 border-green-400/30' : 'bg-blue-500/20 text-blue-300 border-blue-500/30'
            }`}>
              {time}
            </span>
          )}
          <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">{match.court_name}</span>
        </div>
        {catName && (
          <span className="text-[9px] font-black text-white/20 uppercase tracking-widest">{catName}</span>
        )}
      </div>

      {/* Duplas */}
      <div className="space-y-3 text-center">
        <p className={`font-black uppercase tracking-tight leading-tight ${variant === 'done' ? 'text-lg text-white/50' : 'text-2xl text-white'}`}>
          {match.double_a_name}
        </p>

        {/* Score or VS */}
        {(variant === 'done' || isWo) && match.score_a != null && !isWo ? (
          <div className="flex items-center justify-center gap-4">
            <span className="text-3xl font-display font-black text-white/60">{match.score_a}</span>
            <span className="text-white/20 font-black">×</span>
            <span className="text-3xl font-display font-black text-white/60">{match.score_b}</span>
          </div>
        ) : isWo ? (
          <div className="py-1">
            <span className="text-[10px] font-black text-red-400 bg-red-500/10 px-3 py-1 rounded-full border border-red-500/30 uppercase tracking-widest">
              W.O.
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-white/10" />
            <span className={`font-black italic text-xs tracking-widest ${variant === 'live' ? 'text-green-400' : 'text-white/30'}`}>VS</span>
            <div className="h-px flex-1 bg-white/10" />
          </div>
        )}

        <p className={`font-black uppercase tracking-tight leading-tight ${variant === 'done' ? 'text-lg text-white/50' : 'text-2xl text-white'}`}>
          {match.double_b_name}
        </p>
      </div>
    </div>
  );
}

export default PublicoPage;
