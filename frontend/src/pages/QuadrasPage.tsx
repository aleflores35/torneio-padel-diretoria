import { useState, useEffect } from 'react';
import { Monitor, Bell, Play, CheckCircle2, MoreVertical } from 'lucide-react';
import axios from 'axios';

interface Court {
  id_court: number;
  name: string;
  match?: any;
}

const QuadrasPage = () => {
  const [courts, setCourts] = useState<Court[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const resCourts = await axios.get('http://localhost:3001/api/tournaments/1/courts');
      const resMatches = await axios.get('http://localhost:3001/api/tournaments/1/matches');
      
      const enrichedCourts = resCourts.data.map((c: any) => {
        // Encontrar jogo em andamento OU chamando para esta quadra
        const activeMatch = resMatches.data.find((m: any) => 
          m.id_court === c.id_court && (m.status === 'IN_PROGRESS' || m.status === 'CALLING')
        );
        return {
          ...c,
          match: activeMatch
        };
      });
      
      setCourts(enrichedCourts);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  const handleCall = (matchId: number) => {
    axios.post(`http://localhost:3001/api/matches/${matchId}/call`)
      .then(() => fetchData())
      .catch(err => alert(err.message));
  };

  const handleUpdateStatus = (matchId: number, status: string) => {
    axios.post(`http://localhost:3001/api/matches/${matchId}/status`, { status })
      .then(() => fetchData())
      .catch(err => alert(err.message));
  };

  const handleFinish = (match: any) => {
    const score = prompt('Digite o placar final (ex: 6-2):');
    if (!score) return;
    const [sa, sb] = score.split('-').map(Number);
    
    axios.post(`http://localhost:3001/api/matches/${match.id_match}/status`, { 
      status: 'FINISHED',
      games_double_a: sa,
      games_double_b: sb
    })
      .then(() => fetchData())
      .catch(err => alert(err.message));
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000); // 10s auto-refresh
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold bg-gradient-to-r from-white to-zinc-500 bg-clip-text text-transparent">Operação de Quadras</h2>
          <p className="text-zinc-500 text-sm mt-1">Gerencie a ocupação em tempo real.</p>
        </div>
        <div className="flex items-center gap-2 text-zinc-500 text-xs uppercase tracking-widest bg-white/5 px-4 py-2 rounded-full border border-white/5">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          Live Update On
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 h-[calc(100vh-250px)]">
        {loading ? (
           <p className="text-zinc-500">Carregando ocupação...</p>
        ) : courts.map(q => (
          <div key={q.id_court} className="flex flex-col bg-premium-card border border-white/5 rounded-3xl overflow-hidden shadow-2xl">
            <div className="p-5 bg-gradient-to-b from-white/5 to-transparent border-b border-white/5 flex items-center justify-between">
              <h3 className="text-xl font-black text-zinc-300">{q.name}</h3>
              <MoreVertical size={20} className="text-zinc-600 cursor-pointer" />
            </div>

            <div className="flex-1 p-6 flex flex-col items-center justify-center text-center space-y-6">
              {!q.match ? (
                <div className="space-y-4">
                  <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto text-zinc-600 border border-dashed border-white/10">
                    <Monitor size={32} />
                  </div>
                  <p className="text-zinc-500 text-sm px-4">Livre no momento. Selecione um jogo.</p>
                  <button className="premium-input !py-2 !text-xs w-full text-zinc-400 font-bold hover:bg-white/5 transition-colors">Próximo Jogo</button>
                </div>
              ) : (
                <div className="w-full space-y-6">
                   <span className={`text-[10px] px-3 py-1 rounded-full font-black uppercase tracking-widest ${
                     q.match.status === 'CALLING' ? 'bg-amber-500/20 text-amber-500 animate-pulse' : 'bg-premium-accent/20 text-premium-accent'
                   }`}>
                     {q.match.status === 'CALLING' ? 'CHAMANDO ATLETAS' : 'EM ANDAMENTO'}
                   </span>
                   <div className="space-y-2">
                     <p className="text-2xl font-bold truncate">{q.match.double_a_name}</p>
                     <p className="text-zinc-600 text-sm italic">vs</p>
                     <p className="text-2xl font-bold truncate">{q.match.double_b_name}</p>
                   </div>
                   <div className="bg-black/40 p-4 rounded-2xl border border-white/5 shadow-inner">
                     <p className="text-4xl font-mono font-black text-premium-accent tracking-tighter">
                        {q.match.games_double_a} <span className="text-zinc-700 mx-2">x</span> {q.match.games_double_b}
                     </p>
                   </div>
                </div>
              )}
            </div>

            <div className="p-4 grid grid-cols-3 gap-2 bg-black/20 border-t border-white/5">
              <button 
                onClick={() => q.match && handleCall(q.match.id_match)}
                disabled={!q.match}
                className="flex flex-col items-center justify-center gap-1 p-3 rounded-xl hover:bg-white/5 transition-colors text-zinc-500 hover:text-amber-500 disabled:opacity-20"
              >
                <Bell size={18} />
                <span className="text-[10px] font-bold">CHAMAR</span>
              </button>
              <button 
                onClick={() => q.match && handleUpdateStatus(q.match.id_match, 'IN_PROGRESS')}
                disabled={!q.match || q.match.status === 'IN_PROGRESS'}
                className="flex flex-col items-center justify-center gap-1 p-3 rounded-xl hover:bg-white/5 transition-colors text-zinc-500 hover:text-premium-accent disabled:opacity-20"
              >
                <Play size={18} />
                <span className="text-[10px] font-bold">INICIAR</span>
              </button>
              <button 
                onClick={() => q.match && handleFinish(q.match)}
                disabled={!q.match}
                className="flex flex-col items-center justify-center gap-1 p-3 rounded-xl hover:bg-white/5 transition-colors text-zinc-500 hover:text-green-500 disabled:opacity-20"
              >
                <CheckCircle2 size={18} />
                <span className="text-[10px] font-bold">FINALIZAR</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>

  );
};

export default QuadrasPage;
