import { useState, useEffect } from 'react';
import { 
  Bell, 
  Play, 
  CheckCircle2, 
  Info,
  Clock,
  Activity
} from 'lucide-react';
import { fetchMatches, fetchCourts, updateMatchStatus } from '../api';
import type { Court, Match } from '../api';

const QuadrasPage = () => {
  const [courts, setCourts] = useState<Court[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const resCourts = await fetchCourts();
      const resMatches = await fetchMatches(1);
      setCourts(resCourts);
      setMatches(resMatches);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleUpdateStatus = async (matchId: number, status: string) => {
    await updateMatchStatus(matchId, status);
    fetchData();
  };

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-1000">
      
      {/* Header section */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-premium-accent/10 border border-premium-accent/20 rounded-full text-[10px] font-black text-premium-accent uppercase tracking-widest leading-none">
                <Activity size={12} className="animate-pulse" />
                Live Hub: 4 Quadras Monitoradas
            </div>
            <h2 className="text-5xl font-black italic uppercase tracking-tighter leading-none">Status das <br/><span className="text-premium-accent">Quadras</span></h2>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        {loading ? (
             <div className="col-span-full py-20 text-center text-zinc-500 font-black uppercase tracking-widest text-xs">Sincronizando sensores...</div>
        ) : courts.map((court) => {
            const activeMatch = matches.find(m =>
                m.court_name === court.name && (m.status === 'IN_PROGRESS' || m.status === 'CALLING')
            );

            return (
                <div key={court.id} className={`premium-card !p-0 overflow-hidden border-white/5 transition-all duration-700 relative flex flex-col h-[500px] ${activeMatch ? 'shadow-[0_0_50px_rgba(153,204,51,0.05)] border-premium-accent/20' : 'opacity-80'}`}>
                    
                    {/* Court Header */}
                    <div className="p-6 border-b border-white/5 bg-white/[0.01] flex justify-between items-center">
                        <div className="flex items-center gap-2">
                             <div className={`w-2 h-2 rounded-full ${activeMatch ? 'bg-premium-accent animate-pulse' : 'bg-zinc-600'}`} />
                             <span className="text-xs font-black uppercase tracking-widest text-white">{court.name}</span>
                        </div>
                        <span className={`text-[10px] font-black uppercase tracking-widest ${activeMatch ? 'text-premium-accent' : 'text-zinc-600'}`}>
                            {activeMatch ? 'Ocupada' : 'Livre'}
                        </span>
                    </div>

                    {/* Court Body */}
                    <div className="flex-1 p-8 flex flex-col items-center justify-center text-center space-y-8 relative">
                        {activeMatch ? (
                            <div className="w-full space-y-8 animate-in zoom-in duration-500">
                                <span className={`inline-block px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                                    activeMatch.status === 'CALLING' ? 'bg-amber-500/20 text-amber-500 animate-pulse border border-amber-500/30' : 'bg-premium-accent/20 text-premium-accent border border-premium-accent/30'
                                }`}>
                                    {activeMatch.status === 'CALLING' ? 'Chamando Atletas' : 'Jogo em curso'}
                                </span>

                                <div className="space-y-4">
                                     <div className="space-y-1">
                                         <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600">Dupla A</p>
                                         <p className="text-xl font-black italic uppercase leading-none">{activeMatch.double_a_name}</p>
                                     </div>
                                     <div className="text-zinc-700 italic font-black text-xs uppercase -rotate-12">vs</div>
                                     <div className="space-y-1">
                                         <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600">Dupla B</p>
                                         <p className="text-xl font-black italic uppercase leading-none">{activeMatch.double_b_name}</p>
                                     </div>
                                </div>

                                <div className="bg-black/40 backdrop-blur-xl p-6 rounded-[30px] border border-white/5 shadow-inner">
                                     <p className="text-5xl font-black italic text-white tracking-tighter">
                                        {activeMatch.games_double_a} <span className="text-zinc-800 mx-2 text-3xl not-italic">:</span> {activeMatch.games_double_b}
                                     </p>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-6 opacity-40 group hover:opacity-100 transition-all">
                                <div className="w-20 h-20 bg-white/5 border border-dashed border-white/10 rounded-full flex items-center justify-center mx-auto text-zinc-600">
                                    <Clock size={32} />
                                </div>
                                <div className="space-y-2">
                                    <p className="text-xs font-black uppercase tracking-widest text-zinc-600 leading-tight">Aguardando<br/>Próximo Jogo</p>
                                </div>
                                <button className="w-full h-12 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:bg-white/10 transition-all">
                                    Escalar Automático
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Court Footer Actions */}
                    <div className="grid grid-cols-3 bg-black/40 border-t border-white/5">
                         <button 
                            onClick={() => activeMatch && alert("Chamada sonora enviada para os alto-falantes e WhatsApp.")}
                            disabled={!activeMatch || activeMatch.status !== 'CALLING'}
                            className="p-5 border-r border-white/5 flex flex-col items-center gap-1 hover:bg-white/5 transition-all text-zinc-500 hover:text-amber-500 disabled:opacity-10"
                         >
                            <Bell size={18} />
                            <span className="text-[9px] font-black uppercase tracking-widest">Chamar</span>
                         </button>
                         <button
                            onClick={() => activeMatch && handleUpdateStatus(activeMatch.id_match, 'IN_PROGRESS')}
                            disabled={!activeMatch || activeMatch.status !== 'CALLING'}
                            className="p-5 border-r border-white/5 flex flex-col items-center gap-1 hover:bg-white/5 transition-all text-zinc-500 hover:text-premium-accent disabled:opacity-10"
                         >
                            <Play size={18} />
                            <span className="text-[9px] font-black uppercase tracking-widest">Iniciar</span>
                         </button>
                         <button
                            onClick={() => activeMatch && handleUpdateStatus(activeMatch.id_match, 'FINISHED')}
                            disabled={!activeMatch || activeMatch.status !== 'IN_PROGRESS'}
                            className="p-5 flex flex-col items-center gap-1 hover:bg-white/5 transition-all text-zinc-500 hover:text-green-500 disabled:opacity-10"
                         >
                            <CheckCircle2 size={18} />
                            <span className="text-[9px] font-black uppercase tracking-widest">Ponto</span>
                         </button>
                    </div>

                </div>
            )
        })}
      </div>

      {/* Footer Info */}
      <div className="premium-card bg-zinc-900/50 border-white/5 p-6 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4 text-zinc-500">
                <Info size={20} className="text-premium-accent" />
                <p className="text-xs uppercase font-bold tracking-widest">Restam <span className="text-white">52 jogos</span> para concluir o cronograma de hoje.</p>
            </div>
            <div className="text-[10px] uppercase font-black tracking-widest px-4 py-2 bg-black/40 rounded-xl text-zinc-600">
                Média de Partida: 35min
            </div>
      </div>

    </div>
  );
};

export default QuadrasPage;
