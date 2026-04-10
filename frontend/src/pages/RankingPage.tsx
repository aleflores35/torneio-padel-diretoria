import { useState, useEffect } from 'react';
import {
  RefreshCw,
  ChevronRight,
  Target
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
      const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const results = await Promise.all(
        categories.map(async (cat) => {
          const res = await fetch(`${BASE}/api/tournaments/1/ranking/${cat.id}`);
          const data = res.ok ? await res.json() : [];
          return {
            id_category: cat.id,
            name: cat.name,
            standings: (data as PlayerRanking[]).sort((a, b) => b.points - a.points || b.wins - a.wins)
          };
        })
      );
      setStandings(results);
      setLastUpdate(new Date().toLocaleTimeString('pt-BR'));
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStandings();
    const interval = setInterval(loadStandings, 30000);
    return () => clearInterval(interval);
  }, []);

  const currentStanding = standings.find(s => s.id_category === selectedCategory);

  const sideLabels: Record<string, string> = {
    RIGHT: 'Direita',
    LEFT: 'Esquerda',
    EITHER: 'Flexível'
  };

  const sideColors: Record<string, string> = {
    RIGHT: 'text-blue-400 border-blue-400/20',
    LEFT: 'text-green-400 border-green-400/20',
    EITHER: 'text-slate-400 border-slate-400/20'
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="w-10 h-10 text-green-400 animate-spin" />
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40">Sincronizando Ranking</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white font-body p-6 md:p-12 overflow-x-hidden">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Russo+One&family=Chakra+Petch:wght@300;400;600;700&display=swap');
        .font-display { font-family: 'Russo One', sans-serif; }
        .font-body { font-family: 'Chakra Petch', sans-serif; }
      `}</style>

      <div className="max-w-7xl mx-auto space-y-16">
        
        {/* Header Section */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-10">
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <span className="w-12 h-0.5 bg-green-400" />
              <span className="text-[10px] font-black uppercase tracking-[0.4em] text-green-400">Classificação Oficial</span>
            </div>
            <h1 className="text-6xl md:text-8xl font-display font-black leading-none tracking-tighter uppercase">
              Ranking <br/> <span className="text-green-400">Geral</span>
            </h1>
          </div>
          
          <div className="flex flex-wrap items-center gap-4">
            <button 
              onClick={loadStandings}
              className="px-8 py-5 bg-white/5 border border-white/10 hover:bg-white/10 transition-all rounded-lg flex items-center gap-3 group"
            >
              <RefreshCw className="w-4 h-4 text-green-400 group-hover:rotate-180 transition-transform duration-500" />
              <span className="text-[10px] font-black uppercase tracking-widest">Atualizar Agora</span>
            </button>
            <div className="px-8 py-5 bg-green-400 text-black rounded-lg text-center min-w-[180px]">
              <p className="text-[9px] font-black uppercase tracking-widest opacity-60">Última Sincronização</p>
              <p className="text-xl font-display font-black leading-none mt-1">{lastUpdate}</p>
            </div>
          </div>
        </div>

        {/* Categories Navigation */}
        <div className="flex flex-wrap gap-3 border-b border-white/5 pb-8">
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-8 py-4 text-[10px] font-black uppercase tracking-[0.2em] transition-all relative ${
                selectedCategory === cat.id
                  ? 'text-green-400'
                  : 'text-white/40 hover:text-white'
              }`}
            >
              {cat.name}
              {selectedCategory === cat.id && (
                <div className="absolute bottom-[-2px] left-0 w-full h-[2px] bg-green-400" />
              )}
            </button>
          ))}
        </div>

        {/* Podium / Leader Highlight (Optional Visual) */}
        {currentStanding && currentStanding.standings.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
            
            {/* Table Area */}
            <div className="lg:col-span-12">
              <div className="bg-white/5 border border-white/10 relative overflow-hidden">
                {/* Background Text Decoration */}
                <div className="absolute top-0 right-0 p-10 text-[10rem] font-black text-white/[0.02] leading-none pointer-events-none select-none">
                  LEADER
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="px-10 py-8 text-[10px] font-black uppercase tracking-widest text-white/40">Pos.</th>
                        <th className="px-10 py-8 text-[10px] font-black uppercase tracking-widest text-white/40">Atleta</th>
                        <th className="px-10 py-8 text-[10px] font-black uppercase tracking-widest text-white/40 text-center">Lado</th>
                        <th className="px-10 py-8 text-[10px] font-black uppercase tracking-widest text-white/40 text-center">Jogos</th>
                        <th className="px-10 py-8 text-[10px] font-black uppercase tracking-widest text-white/40 text-center">V-D-WO</th>
                        <th className="px-10 py-8 text-[10px] font-black uppercase tracking-widest text-white/40 text-right">Pontos</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentStanding.standings.map((player, idx) => {
                        const isFirst = idx === 0;
                        return (
                          <tr 
                            key={player.id_player}
                            className={`group border-b border-white/5 hover:bg-white/[0.03] transition-colors ${isFirst ? 'bg-green-400/[0.02]' : ''}`}
                          >
                            <td className="px-10 py-8">
                              <div className={`w-10 h-10 flex items-center justify-center font-display font-black text-lg ${isFirst ? 'bg-green-400 text-black' : 'bg-white/5 text-white/60'}`}>
                                {idx + 1}
                              </div>
                            </td>
                            <td className="px-10 py-8">
                              <div className="flex items-center gap-4">
                                <div>
                                  <p className="text-xl font-display font-black uppercase tracking-tighter text-white group-hover:text-green-400 transition-colors">
                                    {player.name}
                                  </p>
                                  {isFirst && (
                                    <span className="text-[10px] font-black text-green-400 uppercase tracking-widest">Líder da Temporada</span>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-10 py-8 text-center text-[10px] font-black uppercase tracking-widest">
                              <span className={`px-4 py-2 border rounded-full ${sideColors[player.side]}`}>
                                {sideLabels[player.side]}
                              </span>
                            </td>
                            <td className="px-10 py-8 text-center font-display font-black text-xl text-white/80">
                              {player.matches_played}
                            </td>
                            <td className="px-10 py-8 text-center font-black uppercase tracking-widest text-white/40 text-xs">
                              <span className="text-green-400">{player.wins}</span>
                              <span className="mx-1">/</span>
                              <span className="text-red-400">{player.losses}</span>
                              <span className="mx-1">/</span>
                              <span className="text-slate-600">{player.wos}</span>
                            </td>
                            <td className="px-10 py-8 text-right">
                              <p className={`text-4xl font-display font-black italic ${isFirst ? 'text-green-400' : 'text-white'}`}>
                                {player.points}
                              </p>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer Info / Rules Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 pt-20">
          <div className="p-12 border border-white/5 bg-white/5 space-y-8 relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-1 h-full bg-green-400" />
            <div className="flex items-center gap-4">
              <Target className="text-green-400 w-8 h-8" />
              <h3 className="text-3xl font-display font-black uppercase tracking-tighter">Regulamento</h3>
            </div>
            <p className="text-white/40 text-sm font-bold uppercase tracking-widest leading-loose">
              O ranking é atualizado toda quinta-feira após a última partida das 23h. O sistema de pontuação prioriza vitórias e a regularidade do atleta em quadra.
            </p>
            <div className="flex gap-10">
              <div className="space-y-1">
                <span className="text-3xl font-display font-black text-white">+3</span>
                <p className="text-[10px] font-black uppercase text-green-400 tracking-widest">Vitória</p>
              </div>
              <div className="space-y-1">
                <span className="text-3xl font-display font-black text-white">+1</span>
                <p className="text-[10px] font-black uppercase text-white/40 tracking-widest">Derrota</p>
              </div>
              <div className="space-y-1">
                <span className="text-3xl font-display font-black text-white">0</span>
                <p className="text-[10px] font-black uppercase text-red-500 tracking-widest">WO</p>
              </div>
            </div>
          </div>

          <div className="p-12 border border-green-400/20 bg-green-400/5 flex flex-col justify-center space-y-8">
            <h3 className="text-4xl font-display font-black uppercase tracking-tighter text-white">Prêmio <span className="text-green-400">Master</span></h3>
            <p className="text-white/60 text-lg font-medium leading-relaxed italic">
              "Os líderes de cada categoria garantem vaga direta para o Padel Finals de Dezembro e kit exclusivo SRB."
            </p>
            <a href="/" className="inline-flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.3em] text-green-400 hover:text-white transition-colors">
              Ir para Início <ChevronRight className="w-4 h-4" />
            </a>
          </div>
        </div>

        {/* SRB Brand Decorative */}
        <div className="text-center pt-20">
          <p className="text-[10px] font-black uppercase tracking-[1em] text-white/10">Sociedade Rio Branco • Tradição no Padel</p>
        </div>

      </div>
    </div>
  );
};

export default RankingPage;
