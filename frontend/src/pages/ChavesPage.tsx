import { useState, useEffect } from 'react';
import { LayoutGrid, RefreshCw } from 'lucide-react';
import axios from 'axios';

interface Dupla {
  id_dupla: number;
  nome_exibicao: string;
}

interface Chave {
  id_chave: number;
  nome: string;
  duplas: Dupla[];
}

const ChavesPage = () => {
  const [chaves, setChaves] = useState<Chave[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchChaves();
  }, []);

  const fetchChaves = () => {
    setLoading(true);
    axios.get('http://localhost:3001/api/tournaments/1/chaves')
      .then(res => {
        setChaves(res.data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold bg-gradient-to-r from-white to-zinc-500 bg-clip-text text-transparent">Duplas & Chaves</h2>
          <p className="text-zinc-500 text-sm mt-1">Sorteio de duplas e distribuição dos grupos.</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 bg-white/5 hover:bg-white/10 px-4 py-2 rounded-lg border border-white/10 transition-colors" onClick={() => {
            setLoading(true);
            axios.post('http://localhost:3001/api/tournaments/1/generate-doubles').then(() => {
              fetchChaves();
            });
          }}>
            <RefreshCw size={18} />
            <span>Re-sortear Duplas</span>
          </button>
          <button className="btn-primary" onClick={() => {
            setLoading(true);
            axios.post('http://localhost:3001/api/tournaments/1/generate-chaves')
              .then(() => {
                fetchChaves();
              })
              .catch(err => {
                alert(err.message);
                setLoading(false);
              });
          }}>Gerar Chaves</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {loading ? (
          <div className="col-span-full text-center py-12 text-zinc-500">Carregando chaves...</div>
        ) : chaves.length === 0 ? (
          <div className="col-span-full text-center py-12 text-zinc-500">Nenhuma chave gerada ainda.</div>
        ) : chaves.map(chave => (
          <div key={chave.id_chave} className="premium-card !p-0 overflow-hidden border-white/5">
            <div className="bg-premium-accent/10 p-4 border-b border-white/5 flex items-center justify-between">
              <h3 className="text-lg font-bold text-premium-accent">CHAVE {chave.nome}</h3>
              <LayoutGrid size={16} className="text-premium-accent/50" />
            </div>
            <div className="p-4 space-y-3">
              {chave.duplas.map((dupla, idx) => (
                <div key={idx} className="flex items-center gap-3 text-sm">
                  <span className="text-zinc-600 font-mono">{idx + 1}.</span>
                  <div className="flex-1 bg-white/5 p-2 rounded border border-white/5">
                    <span className="text-zinc-300">{dupla.nome_exibicao}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ChavesPage;
