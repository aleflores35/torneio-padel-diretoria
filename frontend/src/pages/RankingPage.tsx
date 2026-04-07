import { useState, useEffect } from 'react';
import {
  Trophy,
  Users,
  TrendingUp,
  Award,
  RefreshCw,
  Medal
} from 'lucide-react';

interface PlayerRanking {
  id_player: number;
  name: string;
  side: 'RIGHT' | 'LEFT' | 'EITHER';
  points: number;
  wins: number;
  losses: number;
  wos: number;
  matches_played: number;
}

interface CategoryStandings {
  id_category: number;
  name: string;
  standings: PlayerRanking[];
}

const RankingPage = () => {
  const [standings, setStandings] = useState<CategoryStandings[]>([]);
  const [selectedCategory, setSelectedCategory] = useState(1);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<string>('Nunca');

  // Hardcoded 5 Ranking SRB categories
  const categories = [
    { id: 1, name: 'Masculino Iniciante' },
    { id: 2, name: 'Masculino 4ª' },
    { id: 3, name: 'Feminino Iniciante' },
    { id: 4, name: 'Feminino 6ª' },
    { id: 5, name: 'Feminino 4ª' }
  ];

  const loadStandings = async () => {
    setLoading(true);
    try {
      // Mock standings data - in production this would come from API
      const mockStandings: CategoryStandings[] = categories.map(cat => ({
        id_category: cat.id,
        name: cat.name,
        standings: [
          {
            id_player: 1,
            name: 'João Silva',
            side: 'RIGHT',
            points: 42,
            wins: 12,
            losses: 3,
            wos: 0,
            matches_played: 15
          },
          {
            id_player: 2,
            name: 'Pedro Costa',
            side: 'LEFT',
            points: 39,
            wins: 11,
            losses: 4,
            wos: 0,
            matches_played: 15
          },
          {
            id_player: 3,
            name: 'Lucas Martins',
            side: 'RIGHT',
            points: 36,
            wins: 10,
            losses: 5,
            wos: 0,
            matches_played: 15
          },
          {
            id_player: 4,
            name: 'Felipe Gomes',
            side: 'LEFT',
            points: 32,
            wins: 9,
            losses: 6,
            wos: 0,
            matches_played: 15
          },
          {
            id_player: 5,
            name: 'Rafael Oliveira',
            side: 'EITHER',
            points: 28,
            wins: 8,
            losses: 7,
            wos: 0,
            matches_played: 15
          }
        ].sort((a, b) => b.points - a.points || b.wins - a.wins)
      }));

      setStandings(mockStandings);
      setLastUpdate(new Date().toLocaleTimeString('pt-BR'));
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStandings();
    const interval = setInterval(loadStandings, 30000); // Auto-refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const currentStanding = standings.find(s => s.id_category === selectedCategory);

  const sideLabels: Record<string, string> = {
    RIGHT: 'Direita',
    LEFT: 'Esquerda',
    EITHER: 'Flexível'
  };

  const sideColors: Record<string, string> = {
    RIGHT: 'bg-blue-500/10 text-blue-500 border border-blue-500/20',
    LEFT: 'bg-amber-500/10 text-amber-500 border border-amber-500/20',
    EITHER: 'bg-zinc-700/20 text-zinc-400 border border-zinc-600/20'
  };

  if (loading) {
    return (
      <div className="py-20 text-center animate-pulse text-zinc-500 font-black uppercase tracking-widest text-xs">
        Sincronizando ranking...
      </div>
    );
  }

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-1000">

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-premium-accent/10 border border-premium-accent/20 rounded-full text-[10px] font-black text-premium-accent uppercase tracking-widest leading-none">
                <Trophy size={12} />
                Ranking SRB 2026
            </div>
            <h2 className="text-5xl font-black italic uppercase tracking-tighter leading-none text-white">Classificação <br/><span className="text-premium-accent">Geral</span></h2>
        </div>
        <div className="flex flex-wrap items-center gap-3">
            <button
                onClick={loadStandings}
                className="bg-white/5 hover:bg-white/10 border border-white/10 px-6 py-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all inline-flex items-center gap-2"
            >
              <RefreshCw size={14} />
              Atualizar
            </button>
            <div className="text-right bg-white/5 border border-white/10 px-6 py-4 rounded-2xl">
              <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest leading-none">Última Atualização</p>
              <p className="text-sm font-black italic uppercase text-white">{lastUpdate}</p>
            </div>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex gap-3 overflow-x-auto pb-2">
        {categories.map(cat => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest whitespace-nowrap transition-all ${
              selectedCategory === cat.id
                ? 'bg-premium-accent text-black shadow-[0_0_20px_rgba(153,204,51,0.3)]'
                : 'bg-white/5 text-zinc-400 border border-white/10 hover:border-premium-accent/50'
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Standings Table */}
      {currentStanding && (
        <div className="premium-card !p-0 overflow-hidden border-white/5">
          {/* Table Header */}
          <div className="bg-white/[0.02] border-b border-white/5 px-6 py-4">
            <h3 className="text-lg font-black uppercase text-white tracking-tighter flex items-center gap-3">
              <Medal size={18} className="text-premium-accent" />
              {currentStanding.name}
            </h3>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5 bg-white/[0.01]">
                  <th className="px-6 py-3 text-left text-[9px] font-black text-zinc-600 uppercase tracking-widest">Pos.</th>
                  <th className="px-6 py-3 text-left text-[9px] font-black text-zinc-600 uppercase tracking-widest">Atleta</th>
                  <th className="px-6 py-3 text-center text-[9px] font-black text-zinc-600 uppercase tracking-widest">Lado</th>
                  <th className="px-6 py-3 text-center text-[9px] font-black text-zinc-600 uppercase tracking-widest">Jogos</th>
                  <th className="px-6 py-3 text-center text-[9px] font-black text-zinc-600 uppercase tracking-widest">V-D-WO</th>
                  <th className="px-6 py-3 text-right text-[9px] font-black text-zinc-600 uppercase tracking-widest">Pontos</th>
                </tr>
              </thead>
              <tbody>
                {currentStanding.standings.map((player, idx) => {
                  const isLeader = idx === 0;
                  return (
                    <tr
                      key={player.id_player}
                      className={`border-b border-white/5 transition-all hover:bg-white/[0.02] ${
                        isLeader ? 'bg-premium-accent/5' : ''
                      }`}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black ${
                            isLeader
                              ? 'bg-premium-accent text-black shadow-[0_0_15px_rgba(153,204,51,0.4)]'
                              : 'bg-white/5 text-white'
                          }`}>
                            {idx + 1}
                          </div>
                          {isLeader && <Trophy size={14} className="text-premium-accent" />}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-black text-white uppercase leading-tight">{player.name}</p>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest inline-block ${sideColors[player.side]}`}>
                          {sideLabels[player.side]}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <p className="text-sm font-black text-white">{player.matches_played}</p>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
                          {player.wins}-{player.losses}-{player.wos}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <p className={`text-xl font-black italic ${isLeader ? 'text-premium-accent' : 'text-white'}`}>
                          {player.points}
                        </p>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer Info */}
          <div className="bg-white/[0.01] border-t border-white/5 px-6 py-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Premiação</p>
              <p className="text-xs text-zinc-400 font-bold">
                Líder Direita: <span className="text-blue-400">{currentStanding.standings.find(p => p.side === 'RIGHT')?.name || '-'}</span>
                {' | '}
                Líder Esquerda: <span className="text-amber-400">{currentStanding.standings.find(p => p.side === 'LEFT')?.name || '-'}</span>
              </p>
            </div>
            <div className="flex items-center gap-2 text-zinc-500">
              <TrendingUp size={14} />
              <p className="text-[10px] font-bold uppercase tracking-widest">Ranking ao vivo</p>
            </div>
          </div>
        </div>
      )}

      {/* Scoring Rules Info */}
      <div className="premium-card bg-white/[0.01] border-white/5 p-8 space-y-6">
        <div className="flex items-center gap-3">
          <Award className="text-premium-accent" size={20} />
          <h3 className="text-lg font-black uppercase text-white tracking-tighter">Sistema de Pontuação</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="flex gap-4">
            <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center text-green-500 font-black text-lg">+3</div>
            <div>
              <p className="text-sm font-black text-white uppercase">Vitória</p>
              <p className="text-[10px] text-zinc-500 font-bold">Dupla vence o jogo</p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500 font-black text-lg">+1</div>
            <div>
              <p className="text-sm font-black text-white uppercase">Derrota</p>
              <p className="text-[10px] text-zinc-500 font-bold">Dupla perde o jogo</p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="w-12 h-12 rounded-xl bg-zinc-700/20 flex items-center justify-center text-zinc-400 font-black text-lg">+0</div>
            <div>
              <p className="text-sm font-black text-white uppercase">WO</p>
              <p className="text-[10px] text-zinc-500 font-bold">Ausência ou desistência</p>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};

export default RankingPage;
