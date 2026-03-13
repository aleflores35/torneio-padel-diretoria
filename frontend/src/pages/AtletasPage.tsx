import { useState, useEffect } from 'react';
import { 
  Users, 
  CheckCircle, 
  UserPlus,
  RefreshCw,
  LayoutGrid
} from 'lucide-react';
import axios from 'axios';

interface Player {
  id_player: number;
  name: string;
  whatsapp: string;
  side: string;
  payment_status: string;
}

const AtletasPage = () => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [newPlayer, setNewPlayer] = useState({ name: '', whatsapp: '', side: 'EITHER' });
  const [filter, setFilter] = useState({ name: '', side: 'ALL', status: 'ALL' });

  useEffect(() => {
    fetchPlayers();
  }, []);

  const fetchPlayers = () => {
    setLoading(true);
    axios.get('http://localhost:3001/api/players')
      .then(res => {
        setPlayers(res.data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  };

  const handleSave = () => {
    axios.post('http://localhost:3001/api/players', { ...newPlayer, id_tournament: 1 })
      .then(() => {
        fetchPlayers();
        setShowForm(false);
        setNewPlayer({ name: '', whatsapp: '', side: 'EITHER' });
      })
      .catch(err => alert(err.message));
  };

  const handleGenerateDoubles = () => {
    setIsGenerating(true);
    axios.post('http://localhost:3001/api/tournaments/1/generate-doubles')
      .then(() => {
        alert('Duplas geradas com sucesso!');
        setIsGenerating(false);
      })
      .catch(err => {
        alert(err.message);
        setIsGenerating(false);
      });
  };

  const filteredPlayers = players.filter((p: any) => {
    const matchesName = p.name.toLowerCase().includes(filter.name.toLowerCase());
    const matchesSide = filter.side === 'ALL' || p.side === filter.side;
    const matchesStatus = filter.status === 'ALL' || p.payment_status === filter.status;
    return matchesName && matchesSide && matchesStatus;
  });

  const stats = [
    { label: 'Total', value: players.length, icon: <Users size={16} /> },
    { label: 'Filtrados', value: filteredPlayers.length, icon: <RefreshCw size={16} /> },
    { label: 'Pagos', value: players.filter((p: any) => p.payment_status === 'PAID').length, icon: <CheckCircle className="text-green-500" size={16} /> },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold bg-gradient-to-r from-white to-zinc-500 bg-clip-text text-transparent">Inscrições</h2>
          <p className="text-zinc-500 text-sm mt-1">Gerenciamento de atletas participantes.</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="btn-primary flex items-center gap-2" onClick={() => setShowForm(!showForm)}>
            <UserPlus size={18} />
            <span>Novo Atleta</span>
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 bg-zinc-900/90 p-6 rounded-xl border border-premium-accent/20 mb-6 shadow-2xl">
           <div className="flex-1 min-w-[200px] relative">
             <input 
               type="text" 
               placeholder="Buscar atleta por nome..." 
               className="w-full h-12 bg-black/40 border border-white/10 text-white rounded-lg pl-12 pr-4 focus:border-premium-accent outline-none"
               value={filter.name}
               onChange={e => setFilter({...filter, name: e.target.value})}
             />
             <Users size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
           </div>
           <select 
             className="h-12 bg-black/40 border border-white/10 text-white rounded-lg px-4 focus:border-premium-accent outline-none min-w-[150px]"
             value={filter.side}
             onChange={e => setFilter({...filter, side: e.target.value})}
           >
             <option value="ALL">Todos os Lados</option>
             <option value="RIGHT">Direita</option>
             <option value="LEFT">Esquerda</option>
             <option value="EITHER">Indiferente</option>
           </select>
           <select 
             className="h-12 bg-black/40 border border-white/10 text-white rounded-lg px-4 focus:border-premium-accent outline-none min-w-[150px]"
             value={filter.status}
             onChange={e => setFilter({...filter, status: e.target.value})}
           >
             <option value="ALL">Todos os Status</option>
             <option value="PAID">Pago</option>
             <option value="PENDING">Pendente</option>
           </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {stats.map((s, i) => (
          <div key={i} className="premium-card flex items-center gap-4 border-white/5 bg-gradient-to-br from-white/5 to-transparent">
            <div className="p-3 bg-premium-accent/10 rounded-lg text-premium-accent">
              {s.icon}
            </div>
            <div>
              <p className="text-zinc-500 text-xs font-bold uppercase tracking-wider">{s.label}</p>
              <p className="text-2xl font-black text-white">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="premium-card space-y-4 animate-in slide-in-from-top duration-300 border-premium-accent/30">
          <h3 className="font-bold text-lg text-premium-accent">Cadastro de Atleta</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input 
              type="text" placeholder="Nome Completo" className="premium-input bg-black/40" 
              value={newPlayer.name} onChange={e => setNewPlayer({...newPlayer, name: e.target.value})}
            />
            <input 
              type="text" placeholder="WhatsApp" className="premium-input bg-black/40" 
              value={newPlayer.whatsapp} onChange={e => setNewPlayer({...newPlayer, whatsapp: e.target.value})}
            />
            <select 
              className="premium-input bg-black/40"
              value={newPlayer.side} onChange={e => setNewPlayer({...newPlayer, side: e.target.value})}
            >
              <option value="RIGHT">Direita</option>
              <option value="LEFT">Esquerda</option>
              <option value="EITHER">Indiferente</option>
            </select>
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={() => setShowForm(false)} className="px-6 py-2 text-zinc-400 hover:text-white transition-colors">Cancelar</button>
            <button onClick={handleSave} className="btn-primary px-8">Salvar Atleta</button>
          </div>
        </div>
      )}

      <div className="premium-card overflow-hidden !p-0">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-white/5 text-zinc-400 text-xs uppercase tracking-wider font-bold">
              <th className="px-6 py-4">Atleta</th>
              <th className="px-6 py-4">Lado</th>
              <th className="px-6 py-4 text-center">Status Pagamento</th>
              <th className="px-6 py-4">WhatsApp</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {loading ? (
              <tr><td colSpan={4} className="px-6 py-12 text-center text-zinc-500">Carregando...</td></tr>
            ) : filteredPlayers.length === 0 ? (
              <tr><td colSpan={4} className="px-6 py-12 text-center text-zinc-500">Nenhum atleta encontrado.</td></tr>
            ) : filteredPlayers.map((player: any) => (
              <tr key={player.id_player} className="hover:bg-white/[0.02] transition-colors group">
                <td className="px-6 py-4 font-medium text-zinc-200">{player.name}</td>
                <td className="px-6 py-4">
                  <span className={`text-[10px] font-black px-2 py-1 rounded-full ${
                    player.side === 'RIGHT' ? 'bg-blue-500/10 text-blue-500' : 
                    player.side === 'LEFT' ? 'bg-purple-500/10 text-purple-500' : 
                    'bg-zinc-500/10 text-zinc-400'
                  }`}>
                    {player.side === 'RIGHT' ? 'DIREITA' : player.side === 'LEFT' ? 'ESQUERDA' : 'INDIFERENTE'}
                  </span>
                </td>
                <td className="px-6 py-4 text-center">
                  <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg text-xs font-bold ${
                    player.payment_status === 'PAID' ? 'bg-green-500/10 text-green-500' : 'bg-amber-500/10 text-amber-500'
                  }`}>
                    {player.payment_status === 'PAID' ? <CheckCircle size={14} /> : <RefreshCw size={14} className="animate-spin-slow" />}
                    {player.payment_status === 'PAID' ? 'PAGO' : 'PENDENTE'}
                  </div>
                </td>
                <td className="px-6 py-4 text-zinc-500 font-mono text-sm">{player.whatsapp}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end p-4">
        <button 
          className={`btn-primary flex items-center gap-2 px-10 py-4 text-lg ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
          onClick={handleGenerateDoubles}
          disabled={isGenerating}
        >
          {isGenerating ? <RefreshCw className="animate-spin" size={20} /> : <LayoutGrid size={20} />}
          <span>{isGenerating ? 'Gerando...' : 'Gerar Duplas Automatizadas'}</span>
        </button>
      </div>
    </div>
  );
};

export default AtletasPage;
