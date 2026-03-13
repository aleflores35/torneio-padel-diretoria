import { useState, useEffect } from 'react';
import { LayoutGrid, Calendar } from 'lucide-react';
import axios from 'axios';

interface Chave {
  id_chave: number;
  nome: string;
  duplas: { nome_exibicao: string }[];
}

interface Jogo {
  id_match: number;
  id_tournament: number;
  stage: string;
  double_a_name: string;
  double_b_name: string;
  court_name: string;
  status: string;
}

const PublicoPage = () => {
  const [chaves, setChaves] = useState<Chave[]>([]);
  const [jogos, setJogos] = useState<Jogo[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [resChaves, resJogos] = await Promise.all([
        axios.get('http://localhost:3001/api/tournaments/1/chaves'),
        axios.get('http://localhost:3001/api/tournaments/1/matches')
      ]);
      setChaves(resChaves.data);
      setJogos(resJogos.data.filter((j: any) => j.status !== 'FINISHED'));
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000); // 10s refresh
    return () => clearInterval(interval);
  }, []);

  if (loading) return <div className="flex h-screen items-center justify-center text-zinc-500">Carregando quadro de avisos...</div>;

  return (
    <div className="max-w-7xl mx-auto space-y-12 pb-20 animate-in fade-in duration-1000">
      <div className="text-center space-y-2 pt-10">
        <h1 className="text-6xl font-black text-premium-accent tracking-tighter italic">DIRETORIA PADEL</h1>
        <p className="text-zinc-500 font-bold uppercase tracking-widest text-sm">Quadro Geral ao Vivo</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center gap-2 text-zinc-400 font-bold mb-4 px-2">
            <LayoutGrid size={20} />
            <span>Fase de Grupos</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {chaves.map(chave => (
              <div key={chave.id_chave} className="premium-card !p-4 border-white/5 bg-gradient-to-br from-white/5 to-transparent">
                <h3 className="text-premium-accent font-black text-xs mb-3">CONVOCAÇÃO GRUPO {chave.nome}</h3>
                <div className="space-y-2">
                  {chave.duplas.map((d, i) => (
                    <div key={i} className="text-sm text-zinc-300 flex justify-between">
                      <span>{d.nome_exibicao}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="flex items-center gap-2 text-zinc-400 font-bold mb-4 px-2">
            <Calendar size={20} />
            <span>Próximas Chamadas</span>
          </div>
          <div className="space-y-4">
            {jogos.length === 0 ? (
              <p className="text-zinc-600 text-center py-10 italic">Aguardando início dos jogos.</p>
            ) : jogos.map(jogo => (
              <div key={jogo.id_match} className={`premium-card !p-4 border-white/10 ${jogo.status === 'IN_PROGRESS' ? 'border-premium-accent/30 bg-premium-accent/5' : ''}`}>
                <div className="flex justify-between items-start mb-3">
                  <span className={`text-[10px] font-black uppercase ${jogo.status === 'IN_PROGRESS' ? 'text-premium-accent' : 'text-zinc-500'}`}>
                    {jogo.status === 'IN_PROGRESS' ? 'Em Andamento' : 'Chamando'}
                  </span>
                  <span className="text-[10px] bg-white/5 px-2 py-0.5 rounded text-zinc-300 font-bold">{jogo.court_name}</span>
                </div>
                <div className="text-center space-y-1">
                   <p className="font-bold text-sm text-zinc-200">{jogo.double_a_name}</p>
                   <p className="text-premium-accent font-black italic text-xs">VS</p>
                   <p className="font-bold text-sm text-zinc-200">{jogo.double_b_name}</p>
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
