import { useState, useEffect } from 'react';
import {
  Trophy,
  Users,
  Monitor,
  Clock,
  Calendar,
  Zap,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Activity,
  RefreshCw,
  Medal
} from 'lucide-react';
import { fetchMatches, fetchPlayers } from '../api';

interface CategoryStats {
  id: number;
  name: string;
  playerCount: number;
  leaderRight: { name: string; points: number } | null;
  leaderLeft: { name: string; points: number } | null;
}

const DashboardPage = () => {
  const [stats, setStats] = useState({
    totalPlayers: 0,
    totalMatches: 0,
    finishedMatches: 0,
    activeMatches: 0,
    roundsCompleted: 0,
    roundsTotal: 0
  });
  const [categories, setCategories] = useState<CategoryStats[]>([]);
  const [loading, setLoading] = useState(true);

  // Hardcoded 5 Ranking SRB categories
  const rankingSrbCategories = [
    { id: 1, name: 'Masculino Iniciante' },
    { id: 2, name: 'Masculino 4ª' },
    { id: 3, name: 'Feminino Iniciante' },
    { id: 4, name: 'Feminino 6ª' },
    { id: 5, name: 'Feminino 4ª' }
  ];

  const loadData = async () => {
    try {
      const players = await fetchPlayers();
      const matches = await fetchMatches(1);

      // Load rounds to calculate progress
      let roundsCompleted = 0;
      let roundsTotal = 0;
      try {
        const roundsRes = await fetch('http://localhost:3001/api/tournaments/1/rounds');
        if (roundsRes.ok) {
          const rounds = await roundsRes.json();
          roundsTotal = rounds.length > 0 ? Math.max(...rounds.map((r: any) => r.round_number)) : 0;
          roundsCompleted = rounds.filter((r: any) => r.status === 'FINISHED').length;
        }
      } catch (e) {
        console.error('Error loading rounds:', e);
      }

      // Group players by category + load real leaders from ranking API
      const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const categoryStats: CategoryStats[] = await Promise.all(
        rankingSrbCategories.map(async (cat) => {
          let leaderRight: { name: string; points: number } | null = null;
          let leaderLeft: { name: string; points: number } | null = null;
          try {
            const res = await fetch(`${BASE}/api/tournaments/1/ranking/${cat.id}`);
            if (res.ok) {
              const standings: any[] = await res.json();
              const right = standings.filter(p => p.side === 'RIGHT' || p.side === 'EITHER').sort((a, b) => b.points - a.points)[0];
              const left = standings.filter(p => p.side === 'LEFT' || p.side === 'EITHER').sort((a, b) => b.points - a.points)[0];
              if (right) leaderRight = { name: right.name, points: right.points };
              if (left) leaderLeft = { name: left.name, points: left.points };
            }
          } catch (e) { /* sem dados ainda */ }
          return {
            ...cat,
            playerCount: players.filter((p: any) => p.category_id === cat.id).length,
            leaderRight,
            leaderLeft
          };
        })
      );

      setStats({
        totalPlayers: players.length,
        totalMatches: matches.length,
        finishedMatches: matches.filter((m: any) => m.status === 'FINISHED').length,
        activeMatches: matches.filter((m: any) => m.status === 'LIVE' || m.status === 'CALLING').length,
        roundsCompleted: roundsCompleted,
        roundsTotal: roundsTotal || 8 // Default to 8 if no rounds yet
      });
      setCategories(categoryStats);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  const steps = [
    { label: 'Inscrições', status: 'COMPLETED', icon: <Users size={16} /> },
    { label: 'Sorteio Rodadas', status: 'COMPLETED', icon: <Zap size={16} /> },
    { label: 'Rodadas em Andamento', status: 'ACTIVE', icon: <Activity size={16} /> },
    { label: 'Ranking Final', status: 'PENDING', icon: <Trophy size={16} /> }
  ];

  if (loading) return <div className="py-20 text-center text-zinc-500 font-black uppercase tracking-widest text-xs animate-pulse">Sincronizando Ranking SRB...</div>;

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-1000">

      {/* Welcome Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-premium-accent/10 border border-premium-accent/20 rounded-full text-[10px] font-black text-premium-accent uppercase tracking-widest leading-none">
                <Medal size={12} />
                Ranking SRB 2026
            </div>
            <h2 className="text-5xl font-black italic uppercase tracking-tighter leading-none text-white">Status <br/><span className="text-premium-accent">do Ranking</span></h2>
        </div>
        <div className="flex flex-wrap items-center gap-3">
            <button className="bg-white/5 hover:bg-white/10 border border-white/10 px-6 py-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all inline-flex items-center gap-2">
                <RefreshCw size={14} />
                Atualizar
            </button>
            <div className="flex bg-white/5 border border-white/10 p-2 rounded-2xl gap-2">
                <div className="px-4 py-2 text-right">
                    <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest leading-none">Rodadas</p>
                    <p className="text-sm font-black italic uppercase text-premium-accent">{stats.roundsCompleted}/{stats.roundsTotal}</p>
                </div>
                <div className="w-px bg-white/10" />
                <div className="px-4 py-2 text-left">
                    <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest leading-none">Status</p>
                    <p className="text-sm font-black italic uppercase text-white">Em Andamento</p>
                </div>
            </div>
        </div>
      </div>

      {/* Ranking SRB Lifecycle Stepper */}
      <div className="premium-card p-6 bg-white/[0.01]">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 relative">
              <div className="absolute top-1/2 left-0 w-full h-px bg-white/5 -translate-y-1/2 hidden md:block" />

              {steps.map((step, idx) => (
                  <div key={idx} className="relative z-10 flex flex-col items-center gap-3 bg-[#0c0c0c] md:px-6">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border-2 transition-all duration-500 ${
                          step.status === 'COMPLETED' ? 'bg-premium-accent border-premium-accent text-black shadow-[0_0_20px_rgba(153,204,51,0.3)]' :
                          step.status === 'ACTIVE' ? 'bg-white/5 border-premium-accent text-premium-accent animate-pulse' :
                          'bg-white/5 border-white/5 text-zinc-600'
                      }`}>
                          {step.status === 'COMPLETED' ? <CheckCircle2 size={24} /> : step.icon}
                      </div>
                      <div className="text-center">
                          <p className={`text-[10px] font-black uppercase tracking-widest ${
                              step.status === 'PENDING' ? 'text-zinc-700' : 'text-zinc-400'
                          }`}>{step.label}</p>
                          {step.status === 'ACTIVE' && <p className="text-[8px] font-bold text-premium-accent uppercase tracking-[0.2em] mt-1">Agora</p>}
                      </div>
                  </div>
              ))}
          </div>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          <StatCard
            title="Atletas Inscritos"
            value={stats.totalPlayers}
            subValue="5 categorias"
            icon={<Users className="text-blue-500" />}
          />
          <StatCard
            title="Rodadas Concluídas"
            value={`${stats.roundsCompleted}/${stats.roundsTotal}`}
            subValue={stats.roundsTotal > 0 ? `${Math.round((stats.roundsCompleted / stats.roundsTotal) * 100)}% concluído` : 'Aguardando geração'}
            icon={<Zap className="text-amber-500" />}
            progress={(stats.roundsCompleted / stats.roundsTotal) * 100}
          />
          <StatCard
            title="Jogos Realizados"
            value={`${stats.finishedMatches}/${stats.totalMatches}`}
            subValue={`${Math.round((stats.finishedMatches / stats.totalMatches) * 100 || 0)}% concluído`}
            icon={<Activity className="text-premium-accent" />}
            progress={(stats.finishedMatches / stats.totalMatches) * 100}
          />
          <StatCard
            title="Jogos Agora"
            value={stats.activeMatches}
            subValue="em andamento na quadra"
            icon={<Monitor className="text-red-500" />}
            isLive={stats.activeMatches > 0}
          />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-10">

          {/* Categories Standings */}
          <div className="xl:col-span-2 space-y-6">
              <div className="flex items-center justify-between">
                  <h3 className="text-xl font-black italic uppercase tracking-tighter flex items-center gap-3 text-white">
                    <Trophy size={20} className="text-premium-accent" />
                    Líderes por Categoria
                  </h3>
                  <button className="text-[10px] font-black uppercase tracking-widest text-premium-accent hover:brightness-125 transition-all">Ver Completo</button>
              </div>

              <div className="space-y-4">
                  {categories.map((cat) => (
                      <div key={cat.id} className="premium-card bg-white/[0.01] border-white/5 p-6">
                          <div className="flex items-center justify-between mb-4">
                              <h4 className="text-sm font-black uppercase text-white tracking-wider">{cat.name}</h4>
                              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{cat.playerCount} atletas</span>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                              <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                                  <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mb-2">Líder DIREITA</p>
                                  <p className="text-sm font-black text-white truncate">-</p>
                                  <p className="text-[10px] text-zinc-500 font-bold">— pts</p>
                              </div>
                              <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                                  <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mb-2">Líder ESQUERDA</p>
                                  <p className="text-sm font-black text-white truncate">-</p>
                                  <p className="text-[10px] text-zinc-500 font-bold">— pts</p>
                              </div>
                          </div>
                      </div>
                  ))}
              </div>
          </div>

          {/* Live Status & Next Matches */}
          <div className="space-y-6">
              <div className="flex items-center justify-between">
                  <h3 className="text-xl font-black italic uppercase tracking-tighter flex items-center gap-3 text-white">
                    <Activity size={20} className="text-premium-accent" />
                    Live Agora
                  </h3>
              </div>

              <div className="premium-card bg-white/[0.02] border-white/5 p-8 space-y-8">
                  <div className="space-y-2">
                       <p className="text-[10px] font-black uppercase text-zinc-600 tracking-widest pl-1">Rodada Atual</p>
                       <div className="flex items-end gap-3">
                           <span className="text-4xl font-black italic text-white leading-none">{stats.roundsCompleted}</span>
                           <span className="text-xs font-bold text-premium-accent uppercase pb-1">de {stats.roundsTotal}</span>
                       </div>
                       <p className="text-[10px] text-zinc-500 font-medium">Quinta-feira, 18h–23h</p>
                  </div>

                  <div className="space-y-4 pt-4 border-t border-white/5">
                      <p className="text-[10px] font-black uppercase text-zinc-600 tracking-widest pl-1">Próximas Duplas</p>
                      {[
                        { pair: 'João / Maria', cat: 'Masc. Iniciante' },
                        { pair: 'Paula / Sofia', cat: 'Fem. 4ª' }
                      ].map((item, i) => (
                        <div key={i} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5 group hover:border-premium-accent/30 transition-all">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-zinc-500">
                                    <Clock size={14} />
                                </div>
                                <div>
                                    <p className="text-xs font-black uppercase text-white truncate w-40">{item.pair}</p>
                                    <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest">{item.cat}</p>
                                </div>
                            </div>
                            <button className="p-2 text-zinc-700 hover:text-premium-accent transition-colors">
                                <ArrowRight size={16} />
                            </button>
                        </div>
                      ))}
                  </div>

                  <button className="btn-primary w-full py-4 text-xs flex items-center justify-center gap-3">
                      <Calendar size={14} />
                      Ver Cronograma Completo
                  </button>
              </div>

              {/* Info Box */}
              <div className="bg-blue-500/10 border border-blue-500/20 p-6 rounded-3xl flex gap-4">
                  <AlertCircle className="text-blue-500 shrink-0" size={20} />
                  <div>
                      <p className="text-xs font-black text-blue-500 uppercase tracking-widest mb-1">Próxima Quinta</p>
                      <p className="text-[11px] text-blue-500/70 font-bold leading-tight uppercase">Rodada {stats.roundsCompleted + 1} agendada para 18h na quadra de vidro.</p>
                  </div>
              </div>
          </div>

      </div>

    </div>
  );
};

// Sub-components

interface StatCardProps {
  title: string;
  value: string | number;
  subValue: string;
  icon: React.ReactNode;
  isLive?: boolean;
  progress?: number;
}

const StatCard = ({ title, value, subValue, icon, isLive, progress }: StatCardProps) => (
    <div className="premium-card bg-white/[0.01] border-white/5 p-6 space-y-4 hover:border-premium-accent/30 transition-all group overflow-hidden relative">
        <div className="flex justify-between items-start">
            <div className="p-3 bg-white/5 rounded-2xl group-hover:scale-110 transition-transform duration-500">
                {icon}
            </div>
            {isLive && (
                <span className="flex items-center gap-1.5 px-2 py-0.5 bg-red-500/10 text-red-500 border border-red-500/20 rounded-full text-[8px] font-black uppercase tracking-widest">
                    <div className="w-1 h-1 bg-red-500 rounded-full animate-pulse" />
                    Live
                </span>
            )}
        </div>
        <div>
            <h4 className="text-[9px] font-black uppercase text-zinc-700 tracking-widest mb-1">{title}</h4>
            <p className="text-4xl font-black italic text-white uppercase tracking-tighter leading-none">{value}</p>
            <p className="text-[10px] font-bold text-zinc-500 mt-2 uppercase tracking-tight">{subValue}</p>
        </div>
        {progress !== undefined && (
            <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden mt-2">
                <div className="h-full bg-premium-accent shadow-[0_0_10px_rgba(153,204,51,0.5)]" style={{ width: `${progress}%` }} />
            </div>
        )}
    </div>
);

export default DashboardPage;
