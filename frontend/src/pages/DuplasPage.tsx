import { useState, useEffect } from 'react';
import { 
  Users, 
  RefreshCw,
  Search,
  UserCheck
} from 'lucide-react';
import { fetchDoubles, generateDoubles } from '../api';

interface Double {
  id_double: number;
  display_name: string;
  category?: string;
}

const DuplasPage = () => {
  const [doubles, setDoubles] = useState<Double[]>([]);
  const [loading, setLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadDoubles();
  }, []);

  const loadDoubles = async () => {
    setLoading(true);
    try {
      const data = await fetchDoubles(1);
      setDoubles(data);
    } catch (err) {
      console.error(err);
    } finally {
      setTimeout(() => setLoading(false), 500);
    }
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      await generateDoubles(1);
      await loadDoubles();
    } catch (err) {
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  const filteredDoubles = doubles.filter(d => 
    d.display_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-1000">
      
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-premium-accent/10 border border-premium-accent/20 rounded-full text-[10px] font-black text-premium-accent uppercase tracking-widest leading-none">
                <UserCheck size={12} />
                Lista Oficial de Duplas Formadas
            </div>
            <h2 className="text-5xl font-black italic uppercase tracking-tighter leading-none">Duplas <br/><span className="text-premium-accent">Sorteadas</span></h2>
        </div>
        
        <div className="flex gap-3">
          <button 
                onClick={handleGenerate}
                disabled={isGenerating}
                className="bg-white/5 hover:bg-white/10 border border-white/10 px-8 py-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all inline-flex items-center gap-2"
          >
            {isGenerating ? <RefreshCw size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            {isGenerating ? 'Sorteando...' : 'Regerar Duplas'}
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative group max-w-2xl">
          <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-premium-accent transition-colors" />
          <input 
            type="text" 
            placeholder="Buscar dupla (ex: Rodrigo / João)..." 
            className="w-full h-14 bg-white/5 border border-white/5 rounded-2xl pl-14 pr-4 transition-all focus:bg-white/[0.08] focus:border-premium-accent/30 outline-none"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
             Array.from({length: 6}).map((_, i) => (
                <div key={i} className="premium-card h-32 animate-pulse bg-white/[0.02]" />
             ))
        ) : filteredDoubles.length === 0 ? (
            <div className="col-span-full py-20 text-center text-zinc-600 font-bold uppercase tracking-widest">
                Nenhuma dupla formada. Clique em "Sorteador" no painel de atletas.
            </div>
        ) : filteredDoubles.map((double) => (
            <div key={double.id_double} className="premium-card group hover:border-premium-accent/30 transition-all duration-500 overflow-hidden relative">
                {/* Accent line */}
                <div className="absolute top-0 left-0 w-1 h-full bg-premium-accent/20 group-hover:bg-premium-accent group-hover:shadow-[0_0_15px_rgba(153,204,51,0.5)] transition-all" />
                
                <div className="flex items-center gap-5">
                    <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center text-zinc-600 group-hover:text-premium-accent transition-colors">
                        <Users size={20} />
                    </div>
                    <div className="space-y-1">
                        <p className="text-[10px] font-black uppercase text-zinc-600 tracking-widest pl-1">Dupla Oficial</p>
                        <h3 className="text-xl font-black italic uppercase tracking-tighter text-white leading-tight">
                            {double.display_name.split(' / ')[0]} <br/>
                            <span className="text-premium-accent">&</span> {double.display_name.split(' / ')[1]}
                        </h3>
                    </div>
                </div>
            </div>
        ))}
      </div>

    </div>
  );
};

export default DuplasPage;
