import { useState, useEffect } from 'react';
import { LayoutGrid, Calendar, Zap } from 'lucide-react';
import { fetchChaves, fetchMatches, type Chave, type Match } from '../api';

const PublicoPage = () => {
  const [chaves, setChaves] = useState<Chave[]>([]);
  const [jogos, setJogos] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [dataChaves, dataJogos] = await Promise.all([
        fetchChaves(1),
        fetchMatches(1)
      ]);
      setChaves(dataChaves);
      setJogos(dataJogos.filter((j) => j.status !== 'FINISHED'));
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return (
    <div className="flex h-screen items-center justify-center bg-slate-950">
      <div className="flex flex-col items-center gap-6">
        <div className="w-16 h-16 border-4 border-green-400/20 border-t-green-400 rounded-full animate-spin" />
        <p className="text-green-400 font-black uppercase tracking-[0.3em] text-[10px] animate-pulse">Sincronizando Dados...</p>
      </div>
    </div>
  );

  return (
    <div className="max-w-[1600px] mx-auto space-y-20 pb-32 animate-in fade-in slide-in-from-bottom-8 duration-1000">
      {/* Editorial Header */}
      <div className="relative pt-12">
        <div className="absolute top-0 left-0 text-[10rem] font-black text-white/[0.02] select-none leading-none pointer-events-none -translate-y-1/2">
          LIVE
        </div>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 border-b-4 border-white pb-10">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="w-3 h-3 rounded-full bg-green-400 animate-pulse" />
              <span className="text-green-400 text-sm font-black uppercase tracking-[0.3em]">Quadro de Avisos ao Vivo</span>
            </div>
            <h1 className="text-7xl md:text-9xl font-black text-white leading-none tracking-tighter uppercase font-display">
              QUADRO<br />
              <span className="text-green-400">GERAL</span>
            </h1>
          </div>
          <div className="max-w-xs space-y-4">
            <p className="text-zinc-500 font-bold uppercase text-xs leading-relaxed tracking-widest italic">
              Acompanhe em tempo real as convocações das chaves e os próximos jogos nas quadras da Sociedade Rio Branco.
            </p>
            <div className="flex items-center gap-4 text-white/20 select-none">
              <div className="h-px flex-1 bg-white/10" />
              <Zap size={14} />
              <div className="h-px flex-1 bg-white/10" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
        {/* Phase Groups (Left Column) */}
        <div className="lg:col-span-8 space-y-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-green-400">
                <LayoutGrid size={24} />
              </div>
              <h2 className="text-2xl font-black text-white uppercase tracking-tight">Fase de Grupos</h2>
            </div>
            <span className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">{chaves.length} Grupos Ativos</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {chaves.map((chave, idx) => (
              <div key={chave.id_chave} className="group relative bg-white/5 border border-white/5 p-8 hover:border-green-400/30 transition-all duration-500">
                <span className="absolute top-4 right-6 text-4xl font-black text-white/5 group-hover:text-green-400/10 transition-colors">0{idx + 1}</span>
                <div className="space-y-6">
                  <div>
                    <span className="text-[10px] font-black text-green-400 uppercase tracking-widest block mb-1">CONVOCAÇÃO</span>
                    <h3 className="text-2xl font-black text-white uppercase tracking-tighter">GRUPO {chave.nome}</h3>
                  </div>
                  <div className="space-y-3">
                    {chave.duplas.map((d, i) => (
                      <div key={i} className="flex items-center gap-4 text-zinc-400 group-hover:text-zinc-200 transition-colors">
                        <div className="w-1.5 h-1.5 bg-green-400 rotate-45" />
                        <span className="text-sm font-black uppercase tracking-tight">{d.nome_exibicao}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Matches Sidebar (Right Column) */}
        <div className="lg:col-span-4 space-y-10">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-green-400">
              <Calendar size={24} />
            </div>
            <h2 className="text-2xl font-black text-white uppercase tracking-tight">Chamadas</h2>
          </div>

          <div className="space-y-6">
            {jogos.length === 0 ? (
              <div className="p-12 border-2 border-dashed border-white/5 text-center space-y-4">
                <p className="text-zinc-600 font-bold uppercase text-xs tracking-[0.2em] italic">Aguardando início das partidas.</p>
              </div>
            ) : jogos.map(jogo => (
              <div key={jogo.id_match} className={`relative p-8 border ${jogo.status === 'IN_PROGRESS' ? 'border-green-400 bg-green-400/5 shadow-[0_0_40px_rgba(74,222,128,0.1)]' : 'border-white/5 bg-white/5'}`}>
                {jogo.status === 'IN_PROGRESS' && (
                  <div className="absolute -top-3 left-8 px-3 py-1 bg-green-400 text-black text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-black rounded-full animate-pulse" />
                    Em Andamento
                  </div>
                )}
                <div className="flex justify-between items-center mb-8">
                  <span className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">QUADRA</span>
                  <span className="text-xl font-black text-white uppercase font-display">{jogo.court_name}</span>
                </div>
                <div className="text-center space-y-4">
                  <div className="space-y-1">
                    <p className="text-lg font-black text-white uppercase tracking-tighter leading-none">{jogo.double_a_name}</p>
                    <div className="flex items-center gap-3">
                      <div className="h-px flex-1 bg-white/10" />
                      <span className="text-green-400 font-black italic text-xs tracking-widest">VS</span>
                      <div className="h-px flex-1 bg-white/10" />
                    </div>
                    <p className="text-lg font-black text-white uppercase tracking-tighter leading-none">{jogo.double_b_name}</p>
                  </div>
                  {jogo.status !== 'IN_PROGRESS' && (
                    <div className="pt-4">
                      <button className="w-full py-3 bg-white/10 text-white text-[10px] font-black uppercase tracking-[0.3em] hover:bg-white/20 transition-all">
                        Aguardando...
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PublicoPage;
