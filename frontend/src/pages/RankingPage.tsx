import { useState, useEffect } from 'react';
import {
  RefreshCw,
  ChevronRight,
  Target,
  Trophy,
  AlertTriangle,
  Crown,
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
    { id: 1, name: 'Masc. Ini./6ª', fullName: 'Masculino Iniciante / 6ª' },
    { id: 2, name: 'Masc. 4ª', fullName: 'Masculino 4ª' },
    { id: 3, name: 'Fem. Iniciante', fullName: 'Feminino Iniciante' },
  ];

  const loadStandings = async () => {
    setLoading(true);
    try {
      const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const TOURNAMENT_ID = 7;
      const results = await Promise.all(
        categories.map(async (cat) => {
          const res = await fetch(`${BASE}/api/tournaments/${TOURNAMENT_ID}/ranking/${cat.id}`);
          const data = res.ok ? await res.json() : [];
          return {
            id_category: cat.id,
            name: cat.fullName,
            standings: (data as PlayerRanking[]).sort((a, b) =>
              b.points - a.points
              || b.wins - a.wins
              || a.losses - b.losses
              || a.wos - b.wos
              || b.matches_played - a.matches_played
            )
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
  const currentCat = categories.find(c => c.id === selectedCategory);

  const sideLabels: Record<string, string> = {
    RIGHT: 'Dir',
    LEFT: 'Esq',
    EITHER: 'Flex'
  };

  const sideColors: Record<string, string> = {
    RIGHT: 'text-blue-400 bg-blue-500/10 border-blue-400/20',
    LEFT: 'text-green-400 bg-green-500/10 border-green-400/20',
    EITHER: 'text-slate-400 bg-slate-500/10 border-slate-400/20'
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
    <div className="min-h-screen bg-slate-950 text-white font-body overflow-x-hidden">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Russo+One&family=Chakra+Petch:wght@300;400;600;700&display=swap');
        .font-display { font-family: 'Russo One', sans-serif; }
        .font-body { font-family: 'Chakra Petch', sans-serif; }
      `}</style>

      {/* Header */}
      <div className="px-4 pt-8 pb-6 sm:px-8 sm:pt-12 max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-4">
          <span className="w-8 h-0.5 bg-green-400" />
          <span className="text-[9px] font-black uppercase tracking-[0.35em] text-green-400">Classificação Oficial</span>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <h1 className="text-4xl sm:text-6xl font-display font-black leading-none tracking-tighter uppercase">
            Ranking<br/><span className="text-green-400">Geral</span>
          </h1>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={loadStandings}
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

      {/* Líderes por categoria × lado */}
      <div className="px-4 sm:px-8 max-w-4xl mx-auto mb-6">
        <div className="flex items-center gap-3 mb-4">
          <Crown className="w-4 h-4 text-yellow-400" />
          <span className="text-[9px] font-black uppercase tracking-[0.3em] text-yellow-400">Líderes por Categoria × Lado</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {categories.map(cat => {
            const catStandings = standings.find(s => s.id_category === cat.id)?.standings || [];
            const topRight = catStandings.filter(p => p.side === 'RIGHT').sort((a, b) => b.points - a.points)[0];
            const topLeft = catStandings.filter(p => p.side === 'LEFT').sort((a, b) => b.points - a.points)[0];
            return (
              <div key={cat.id} className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 space-y-3">
                <p className="text-[9px] font-black uppercase tracking-widest text-yellow-400/80">{cat.fullName}</p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-blue-500/5 border border-blue-400/20">
                    <div className="min-w-0">
                      <p className="text-[8px] font-black uppercase tracking-widest text-blue-400">🏆 Direita</p>
                      <p className="text-xs font-display font-black text-white truncate">{topRight?.name || '—'}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-lg font-display font-black italic text-blue-400">{topRight?.points ?? 0}</p>
                      <p className="text-[7px] text-white/40 font-bold uppercase">{topRight?.matches_played ?? 0}j</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-green-500/5 border border-green-400/20">
                    <div className="min-w-0">
                      <p className="text-[8px] font-black uppercase tracking-widest text-green-400">🏆 Esquerda</p>
                      <p className="text-xs font-display font-black text-white truncate">{topLeft?.name || '—'}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-lg font-display font-black italic text-green-400">{topLeft?.points ?? 0}</p>
                      <p className="text-[7px] text-white/40 font-bold uppercase">{topLeft?.matches_played ?? 0}j</p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-[9px] text-white/30 font-bold uppercase tracking-widest mt-3 flex items-center gap-2">
          <AlertTriangle className="w-3 h-3 text-orange-400" />
          Atletas marcados como "Flex" precisam escolher um lado para disputar a liderança
        </p>
      </div>

      {/* Category tabs — horizontal scroll on mobile */}
      <div className="px-4 sm:px-8 max-w-4xl mx-auto">
        <div className="flex gap-1 overflow-x-auto no-scrollbar border-b border-white/5 pb-0">
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`flex-shrink-0 px-4 py-3 text-[10px] font-black uppercase tracking-[0.15em] transition-all relative whitespace-nowrap ${
                selectedCategory === cat.id
                  ? 'text-green-400'
                  : 'text-white/40 hover:text-white'
              }`}
            >
              {cat.name}
              {selectedCategory === cat.id && (
                <div className="absolute bottom-0 left-0 w-full h-[2px] bg-green-400" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Standings */}
      <div className="px-4 sm:px-8 pt-6 pb-12 max-w-4xl mx-auto">
        {currentStanding && currentStanding.standings.length === 0 ? (
          <div className="py-16 text-center">
            <Trophy className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
            <p className="text-zinc-600 font-black uppercase tracking-widest text-xs">Nenhum resultado ainda</p>
          </div>
        ) : currentStanding && (
          <>
            {/* Mobile: card list */}
            <div className="sm:hidden space-y-2">
              {currentStanding.standings.map((player, idx) => {
                const isFirst = idx === 0;
                return (
                  <div
                    key={player.id_player}
                    className={`flex items-center gap-3 p-3 rounded-2xl border transition-all ${
                      isFirst
                        ? 'bg-green-400/[0.06] border-green-400/20'
                        : 'bg-white/[0.02] border-white/5'
                    }`}
                  >
                    {/* Position */}
                    <div className={`w-9 h-9 flex-shrink-0 flex items-center justify-center font-display font-black text-sm rounded-xl ${
                      isFirst ? 'bg-green-400 text-black' : 'bg-white/5 text-white/50'
                    }`}>
                      {idx + 1}
                    </div>

                    {/* Name + meta */}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-display font-black uppercase tracking-tight truncate leading-none ${isFirst ? 'text-green-400' : 'text-white'}`}>
                        {player.name}
                      </p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className={`text-[8px] font-black px-1.5 py-0.5 rounded border ${sideColors[player.side]}`}>
                          {sideLabels[player.side]}
                        </span>
                        {player.side === 'EITHER' && (
                          <span className="text-[8px] font-black px-1.5 py-0.5 rounded border border-orange-400/40 bg-orange-500/10 text-orange-400 flex items-center gap-1">
                            <AlertTriangle className="w-2.5 h-2.5" /> Definir lado
                          </span>
                        )}
                        <span className="text-[8px] font-black px-1.5 py-0.5 rounded border border-white/10 bg-white/5 text-white/60">
                          {player.matches_played}J
                        </span>
                        <span className="text-[9px] text-zinc-600 font-bold">
                          <span className="text-green-400">{player.wins}V</span>
                          {' '}<span className="text-red-400">{player.losses}D</span>
                          {player.wos > 0 && <span className="text-zinc-600"> {player.wos}WO</span>}
                        </span>
                      </div>
                    </div>

                    {/* Points */}
                    <div className="flex-shrink-0 text-right">
                      <p className={`text-2xl font-display font-black italic leading-none ${isFirst ? 'text-green-400' : 'text-white'}`}>
                        {player.points}
                      </p>
                      <p className="text-[8px] text-zinc-600 font-bold uppercase tracking-wide">pts</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop: table */}
            <div className="hidden sm:block bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{currentCat?.fullName}</p>
                <p className="text-[9px] text-zinc-700 font-bold">{currentStanding.standings.length} atletas</p>
              </div>
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="px-5 py-4 text-[9px] font-black uppercase tracking-widest text-white/30">Pos.</th>
                    <th className="px-5 py-4 text-[9px] font-black uppercase tracking-widest text-white/30">Atleta</th>
                    <th className="px-5 py-4 text-[9px] font-black uppercase tracking-widest text-white/30 text-center">Lado</th>
                    <th className="px-5 py-4 text-[9px] font-black uppercase tracking-widest text-white/30 text-center">J</th>
                    <th className="px-5 py-4 text-[9px] font-black uppercase tracking-widest text-white/30 text-center">V-D-WO</th>
                    <th className="px-5 py-4 text-[9px] font-black uppercase tracking-widest text-white/30 text-right">Pts</th>
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
                        <td className="px-5 py-4">
                          <div className={`w-8 h-8 flex items-center justify-center font-display font-black text-sm rounded-lg ${isFirst ? 'bg-green-400 text-black' : 'bg-white/5 text-white/50'}`}>
                            {idx + 1}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <p className="text-base font-display font-black uppercase tracking-tight text-white group-hover:text-green-400 transition-colors">
                            {player.name}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {isFirst && <span className="text-[9px] font-black text-green-400 uppercase tracking-widest">Líder</span>}
                            {player.side === 'EITHER' && (
                              <span className="text-[8px] font-black px-1.5 py-0.5 rounded border border-orange-400/40 bg-orange-500/10 text-orange-400 flex items-center gap-1 uppercase tracking-widest">
                                <AlertTriangle className="w-2.5 h-2.5" /> Definir lado
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-4 text-center">
                          <span className={`text-[9px] font-black px-2 py-1 border rounded-full ${sideColors[player.side]}`}>
                            {sideLabels[player.side]}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-center font-display font-black text-lg text-white/70">
                          {player.matches_played}
                        </td>
                        <td className="px-5 py-4 text-center text-xs font-black">
                          <span className="text-green-400">{player.wins}</span>
                          <span className="text-white/20 mx-1">/</span>
                          <span className="text-red-400">{player.losses}</span>
                          <span className="text-white/20 mx-1">/</span>
                          <span className="text-slate-600">{player.wos}</span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <p className={`text-3xl font-display font-black italic ${isFirst ? 'text-green-400' : 'text-white'}`}>
                            {player.points}
                          </p>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Rules + Prize */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-10">
          <div className="p-5 sm:p-8 border border-white/5 bg-white/5 rounded-2xl space-y-4 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-green-400 rounded-l-2xl" />
            <div className="flex items-center gap-3">
              <Target className="text-green-400 w-5 h-5 flex-shrink-0" />
              <h3 className="text-lg sm:text-2xl font-display font-black uppercase tracking-tighter">Regulamento</h3>
            </div>
            <p className="text-white/40 text-xs font-bold uppercase tracking-wider leading-loose">
              Ranking atualizado toda quinta após as 23h. Pontuação prioriza vitórias e regularidade em quadra.
            </p>
            <div className="flex gap-6">
              <div>
                <span className="text-2xl font-display font-black text-white">+3</span>
                <p className="text-[9px] font-black uppercase text-green-400 tracking-widest">Vitória</p>
              </div>
              <div>
                <span className="text-2xl font-display font-black text-white">+1</span>
                <p className="text-[9px] font-black uppercase text-white/40 tracking-widest">Derrota</p>
              </div>
              <div>
                <span className="text-2xl font-display font-black text-white">0</span>
                <p className="text-[9px] font-black uppercase text-red-500 tracking-widest">WO</p>
              </div>
            </div>
          </div>

          <div className="p-5 sm:p-8 border border-green-400/20 bg-green-400/5 rounded-2xl flex flex-col justify-center space-y-4">
            <h3 className="text-2xl sm:text-3xl font-display font-black uppercase tracking-tighter text-white">
              Prêmio <span className="text-green-400">Master</span>
            </h3>
            <p className="text-white/60 text-sm font-medium leading-relaxed italic">
              "Líderes de cada categoria garantem vaga no Padel Finals de Dezembro e kit exclusivo SRB."
            </p>
            <a href="/" className="inline-flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.25em] text-green-400 hover:text-white transition-colors">
              Ir para Início <ChevronRight className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        <div className="text-center pt-10">
          <p className="text-[9px] font-black uppercase tracking-[0.8em] text-white/10">Sociedade Rio Branco • Tradição no Padel</p>
        </div>
      </div>
    </div>
  );
};

export default RankingPage;
