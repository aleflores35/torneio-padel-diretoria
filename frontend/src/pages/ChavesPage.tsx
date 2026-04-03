import { useState, useEffect } from 'react';
import { 
  fetchChaves, 
  generateDoubles, 
  generateChaves 
} from '../api';
import { 
  Trophy, 
  RefreshCw, 
  LayoutGrid, 
  Star,
  ChevronRight
} from 'lucide-react';

interface Dupla {
  id: number;
  nome_exibicao: string;
  v: number;
  d: number;
  saldo: number;
}

interface Chave {
  id_chave: number;
  nome: string;
  duplas: Dupla[];
}

const ChavesPage = () => {
  const [chaves, setChaves] = useState<Chave[]>([]);
  const [loading, setLoading] = useState(true);

  const loadChaves = async () => {
    setLoading(true);
    try {
      const data = await fetchChaves(1);
      setChaves(data);
    } catch (err) {
      console.error(err);
    } finally {
      setTimeout(() => setLoading(false), 500);
    }
  };

  useEffect(() => {
    loadChaves();
  }, []);

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-1000">
      
      {/* Header section */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/5 border border-white/10 rounded-full text-[10px] font-black text-zinc-500 uppercase tracking-widest leading-none">
                <LayoutGrid size={12} />
                Sistema de Grupos & Mata-Mata
            </div>
            <h2 className="text-5xl font-black italic uppercase tracking-tighter leading-none">Sorteio e <br/><span className="text-premium-accent">Classificação</span></h2>
        </div>
        <div className="flex flex-wrap gap-3">
          <button 
                onClick={async () => {
                    await generateDoubles(1);
                    loadChaves();
                    alert("Duplas sorteadas com sucesso!");
                }}
                className="bg-white/5 hover:bg-white/10 border border-white/10 px-6 py-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all inline-flex items-center gap-2"
          >
            <RefreshCw size={14} />
            Refazer Tudo
          </button>
          <button 
                onClick={async () => {
                    await generateChaves(1);
                    loadChaves();
                }}
                className="btn-primary px-8 py-4 text-xs"
          >
                Gerar Chaves
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-10">
        {loading ? (
             <div className="col-span-full py-20 text-center text-zinc-500 font-black uppercase tracking-widest text-xs">Calculando standings...</div>
        ) : chaves.map((chave) => (
            <div key={chave.id_chave} className="premium-card !p-0 overflow-hidden border-white/5 shadow-2xl group hover:border-premium-accent/30 transition-all duration-500">
                <div className="p-6 border-b border-white/5 bg-white/[0.01] flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-premium-accent/10 rounded-xl text-premium-accent">
                            <Star size={18} fill="currentColor" />
                        </div>
                        <h3 className="text-xl font-black italic uppercase tracking-tighter text-white">{chave.nome}</h3>
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-600">Fase de Grupos</span>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-white/5 text-[9px] font-black uppercase tracking-widest text-zinc-500 border-b border-white/5">
                                <th className="px-6 py-4 text-left">Pos / Dupla</th>
                                <th className="px-4 py-4 text-center">V</th>
                                <th className="px-4 py-4 text-center">D</th>
                                <th className="px-4 py-4 text-center">Saldo</th>
                                <th className="px-6 py-4 text-right">Ação</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {chave.duplas.map((dupla, idx) => (
                                <tr key={idx} className="group/row hover:bg-white/[0.02] transition-colors">
                                    <td className="px-6 py-6">
                                        <div className="flex items-center gap-4">
                                            <span className={`text-xl font-black italic ${idx === 0 ? 'text-premium-accent' : idx === 1 ? 'text-zinc-300' : 'text-zinc-700'}`}>
                                                #{idx + 1}
                                            </span>
                                            <p className="text-sm font-black uppercase tracking-tight text-zinc-200">{dupla.nome_exibicao}</p>
                                        </div>
                                    </td>
                                    <td className="px-4 py-6 text-center text-sm font-black text-white">{dupla.v}</td>
                                    <td className="px-4 py-6 text-center text-sm font-black text-zinc-600">{dupla.d}</td>
                                    <td className={`px-4 py-6 text-center text-sm font-black ${dupla.saldo >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                        {dupla.saldo > 0 ? `+${dupla.saldo}` : dupla.saldo}
                                    </td>
                                    <td className="px-6 py-6 text-right">
                                        <button className="p-2 hover:bg-white/5 rounded-lg text-zinc-700 hover:text-white transition-colors">
                                            <ChevronRight size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="p-4 bg-white/[0.02] text-center border-t border-white/5">
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-700">Classificam os 2 melhores para as Semifinais</p>
                </div>
            </div>
        ))}
      </div>

      {/* Playoff View Bridge */}
      <div className="premium-card p-10 bg-[radial-gradient(circle_at_top_right,_rgba(153,204,51,0.05),_transparent_70%)] text-center space-y-6">
            <div className="w-16 h-16 bg-premium-accent/10 rounded-full flex items-center justify-center mx-auto text-premium-accent border border-premium-accent/30">
                <Trophy size={32} />
            </div>
            <div className="space-y-2">
                <h3 className="text-3xl font-black italic uppercase tracking-tighter">Mata-Mata <span className="text-premium-accent">Live</span></h3>
                <p className="text-zinc-500 max-w-lg mx-auto text-sm">Visualização em tempo real das oitavas, quartas e finais conforme os resultados dos grupos forem validados.</p>
            </div>
            <button className="bg-white/5 border border-white/10 px-10 py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-premium-accent hover:text-black hover:border-premium-accent transition-all duration-500">
                Ver Chaveamento Final
            </button>
      </div>

    </div>
  );
};

export default ChavesPage;
