import { useState, useEffect } from 'react';
import { 
  Users, 
  CheckCircle, 
  UserPlus,
  RefreshCw,
  LayoutGrid,
  Filter,
  Search,
  MoreHorizontal,
  Mail,
  Smartphone,
  Edit2,
  Trash2,
  CheckCircle2,
  MessageSquare,
  X,
  ArrowRightCircle,
  ArrowLeftCircle,
  HelpCircle
} from 'lucide-react';
import { fetchPlayers, addPlayer, generateDoubles } from '../api';
import type { Player, Side } from '../api';

const AtletasPage = () => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [newPlayer, setNewPlayer] = useState<{ name: string; whatsapp: string; side: Side; category_id?: number }>({ name: '', whatsapp: '', side: 'EITHER', category_id: undefined });
  const [filter, setFilter] = useState({ name: '', side: 'ALL', status: 'ALL', category: 'ALL' });
  const [activeMenu, setActiveMenu] = useState<number | null>(null);
  const [categories] = useState([
    { id: 1, name: 'Masculino Iniciante' },
    { id: 2, name: 'Masculino 4ª' },
    { id: 3, name: 'Feminino Iniciante' },
    { id: 4, name: 'Feminino 6ª' },
    { id: 5, name: 'Feminino 4ª' }
  ]);

  useEffect(() => {
    const handleClickOutside = () => setActiveMenu(null);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  const handleAction = (action: string, player: Player) => {
    setActiveMenu(null);
    console.log(`Action ${action} on player ${player.name}`);
    
    if (action === 'delete') {
      if (confirm(`Tem certeza que deseja excluir ${player.name}?`)) {
        setPlayers(players.filter(p => p.id_player !== player.id_player));
      }
    } else if (action === 'confirm') {
      setPlayers(players.map(p => p.id_player === player.id_player ? { ...p, payment_status: 'PAID' } : p));
      alert(`Pagamento de ${player.name} confirmado com sucesso!`);
    } else if (action === 'notify') {
      alert(`[SIMULAÇÃO] WhatsApp enviado para ${player.name}: "Sua inscrição no Diretoria Padel foi confirmada!"`);
    } else if (action === 'edit') {
      alert(`Abrindo edição de ${player.name}... (Simulação)`);
    }
  };

  useEffect(() => {
    loadPlayers();
  }, []);

  const loadPlayers = async () => {
    setLoading(true);
    try {
      const data = await fetchPlayers();
      setPlayers(data);
    } catch (err) {
      console.error(err);
    } finally {
      setTimeout(() => setLoading(false), 500); // Smooth transition
    }
  };

  const handleSave = async () => {
    if (!newPlayer.name || !newPlayer.whatsapp) {
        alert("Preencha nome e whatsapp!");
        return;
    }
    try {
      await addPlayer({ 
        id_tournament: 1, 
        name: newPlayer.name, 
        whatsapp: newPlayer.whatsapp, 
        side: newPlayer.side, 
        payment_status: 'PENDING' 
      });
      loadPlayers();
      setShowForm(false);
      setNewPlayer({ name: '', whatsapp: '', side: 'EITHER' });
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao salvar');
    }
  };

  const handleGenerateDoubles = async () => {
    setIsGenerating(true);
    try {
      await generateDoubles(1);
      alert('Lista de Duplas atualizada com sucesso!');
      setIsGenerating(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao gerar duplas');
      setIsGenerating(false);
    }
  };

  const filteredPlayers = players.filter((p) => {
    const matchesName = p.name.toLowerCase().includes(filter.name.toLowerCase());
    const matchesSide = filter.side === 'ALL' || p.side === filter.side;
    const matchesStatus = filter.status === 'ALL' || p.payment_status === filter.status;
    return matchesName && matchesSide && matchesStatus;
  });

  const stats = [
    { label: 'Total Atletas', value: players.length, icon: <Users size={18} />, color: 'text-white' },
    { label: 'Confirmados', value: players.filter((p) => p.payment_status === 'PAID').length, icon: <CheckCircle size={18} />, color: 'text-premium-accent' },
    { label: 'Pendentes', value: players.filter((p) => p.payment_status !== 'PAID').length, icon: <RefreshCw size={18} />, color: 'text-amber-500' },
    { label: 'Direita', value: players.filter((p) => p.side === 'RIGHT').length, icon: <ArrowRightCircle size={18} />, color: 'text-blue-500' },
    { label: 'Esquerda', value: players.filter((p) => p.side === 'LEFT').length, icon: <ArrowLeftCircle size={18} />, color: 'text-purple-500' },
    { label: 'Ambos', value: players.filter((p) => p.side === 'EITHER').length, icon: <HelpCircle size={18} />, color: 'text-zinc-400' },
  ];

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-1000">
      {/* Header with Stats */}
      <div className="flex flex-col lg:flex-row gap-8 lg:items-end justify-between">
        <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-premium-accent/10 border border-premium-accent/20 rounded-full text-[10px] font-black text-premium-accent uppercase tracking-widest">
                <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-premium-accent opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-premium-accent"></span>
                </span>
                Gerenciamento em tempo real
            </div>
            <h2 className="text-5xl font-black italic uppercase tracking-tighter leading-none">Inscrições <br/><span className="text-premium-accent">Diretoria</span></h2>
        </div>
        
        <div className="flex flex-wrap gap-3 max-w-4xl">
            {stats.map((s, i) => (
                <div key={i} className="bg-zinc-900/40 p-3.5 rounded-[18px] border border-white/5 min-w-[120px] flex flex-col items-center gap-1.5 group hover:border-premium-accent/30 transition-all duration-500">
                    <div className={`${s.color} bg-white/[0.03] p-2 rounded-xl group-hover:scale-110 transition-transform`}>{s.icon}</div>
                    <div className="text-center">
                        <p className="text-[9px] font-black uppercase text-zinc-600 tracking-widest">{s.label}</p>
                        <p className="text-xl font-black text-white italic">{s.value}</p>
                    </div>
                </div>
            ))}
        </div>
      </div>

      {/* Control Bar */}
      <div className="flex flex-col md:flex-row gap-4 items-center">
        <div className="flex-1 w-full relative group">
          <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-premium-accent transition-colors" />
          <input 
            type="text" 
            placeholder="Pesquisar atleta por nome..." 
            className="w-full h-14 bg-white/5 border border-white/5 rounded-2xl pl-14 pr-4 transition-all focus:bg-white/[0.08] focus:border-premium-accent/30 outline-none"
            value={filter.name}
            onChange={e => setFilter({...filter, name: e.target.value})}
          />
        </div>
        <div className="flex gap-4 w-full md:w-auto">
            <select 
             className="h-14 bg-white/5 border border-white/5 text-zinc-400 rounded-2xl px-6 focus:border-premium-accent/30 outline-none appearance-none min-w-[140px] font-bold text-xs uppercase tracking-widest"
             value={filter.side}
             onChange={e => setFilter({...filter, side: e.target.value})}
            >
              <option value="ALL">Lado: Todos</option>
              <option value="RIGHT">Direita</option>
              <option value="LEFT">Esquerda</option>
              <option value="EITHER">Ambos</option>
            </select>
            <button className="h-14 aspect-square flex items-center justify-center bg-white/5 border border-white/5 rounded-2xl text-zinc-500 hover:text-white transition-all">
                <Filter size={20} />
            </button>
            <button 
                onClick={() => setShowForm(!showForm)}
                className="btn-primary"
            >
                <UserPlus size={20} />
                <span className="hidden sm:inline">Adicionar</span>
            </button>
        </div>
      </div>

      {showForm && (
        <div className="premium-card !bg-white/[0.02] border-premium-accent/20 animate-in slide-in-from-top-6 duration-700">
           <div className="flex justify-between items-center mb-10">
                <div className="space-y-1">
                    <h3 className="text-xl font-black uppercase italic italic tracking-tighter">Novo Integrante</h3>
                    <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest leading-none">Preencha os dados do atleta abaixo</p>
                </div>
                <button onClick={() => setShowForm(false)} className="text-zinc-600 hover:text-white transition-colors"><MoreHorizontal /></button>
           </div>
           
           <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-zinc-600 tracking-widest pl-1">Nome Completo</label>
                    <input 
                    type="text" placeholder="Ex: Rodrigo Silva" className="premium-input w-full bg-black/40 h-14" 
                    value={newPlayer.name} onChange={e => setNewPlayer({...newPlayer, name: e.target.value})}
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-zinc-600 tracking-widest pl-1">WhatsApp</label>
                    <input 
                    type="text" placeholder="(51) 99999-9999" className="premium-input w-full bg-black/40 h-14" 
                    value={newPlayer.whatsapp} onChange={e => setNewPlayer({...newPlayer, whatsapp: e.target.value})}
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-zinc-600 tracking-widest pl-1">Preferência de Lado</label>
                    <select 
                        className="premium-input w-full bg-black/40 h-14"
                        value={newPlayer.side} onChange={e => setNewPlayer({...newPlayer, side: e.target.value as Side})}
                    >
                        <option value="RIGHT">DIREITA</option>
                        <option value="LEFT">ESQUERDA</option>
                        <option value="EITHER">INDIFERENTE</option>
                    </select>
                </div>
                <div className="flex items-end">
                    <button onClick={handleSave} className="btn-primary w-full h-14 text-sm tracking-normal">Salvar Atleta</button>
                </div>
           </div>
        </div>
      )}

      {/* Main Table View */}
      <div className="premium-card !p-0 overflow-hidden border-white/[0.03]">
        <div className="overflow-x-auto scrollbar-hide">
            <table className="w-full text-left border-collapse">
            <thead>
                <tr className="bg-white/[0.02] text-zinc-600 text-[10px] font-black uppercase tracking-[0.2em] border-b border-white/[0.03]">
                <th className="px-10 py-6">Status</th>
                <th className="px-6 py-6">Informações do Atleta</th>
                <th className="px-6 py-6">Lado</th>
                <th className="px-6 py-6">Categoria</th>
                <th className="px-6 py-6">Participação</th>
                <th className="px-10 py-6 text-right">Ação</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.03]">
                {loading ? (
                Array.from({length: 5}).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                        <td colSpan={6} className="px-10 py-6 h-20 bg-white/[0.01]"></td>
                    </tr>
                ))
                ) : filteredPlayers.length === 0 ? (
                <tr><td colSpan={6} className="px-10 py-24 text-center text-zinc-600 font-bold uppercase tracking-widest">Nenhum atleta encontrado</td></tr>
                ) : filteredPlayers.map((player) => (
                <tr key={player.id_player} className="group hover:bg-white/[0.02] transition-colors relative">
                    <td className="px-10 py-6">
                        <div className={`w-3 h-3 rounded-full shadow-[0_0_10px_rgba(153,204,51,0)] group-hover:shadow-current transition-all ${
                            player.payment_status === 'PAID' ? 'bg-premium-accent' : 'bg-amber-500'
                        }`} />
                    </td>
                    <td className="px-6 py-6">
                        <div className="flex flex-col">
                            <span className="text-white font-black uppercase italic tracking-tighter text-lg leading-none mb-1">{player.name}</span>
                            <span className="text-zinc-600 text-xs font-bold font-mono flex items-center gap-1.5"><Smartphone size={10} /> {player.whatsapp}</span>
                        </div>
                    </td>
                    <td className="px-6 py-6">
                        <button
                            onClick={() => {
                                const nextSide: Record<Side, Side> = { 'RIGHT': 'LEFT', 'LEFT': 'EITHER', 'EITHER': 'RIGHT' };
                                const newSide = nextSide[player.side] || 'RIGHT';
                                setPlayers(players.map(p => p.id_player === player.id_player ? { ...p, side: newSide } : p));
                            }}
                            className={`text-[10px] font-black px-3 py-1.5 rounded-full border transition-all hover:scale-105 active:scale-95 ${
                                player.side === 'RIGHT' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.1)]' :
                                player.side === 'LEFT' ? 'bg-purple-500/10 text-purple-500 border-purple-500/20 shadow-[0_0_15px_rgba(168,85,247,0.1)]' :
                                'bg-zinc-500/10 text-zinc-400 border-zinc-500/20 shadow-[0_0_15px_rgba(113,113,122,0.1)]'
                            }`}
                        >
                            {player.side === 'RIGHT' ? 'DIREITA' : player.side === 'LEFT' ? 'ESQUERDA' : 'AMBOS'}
                        </button>
                    </td>
                    <td className="px-6 py-6">
                        <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                            {player.category_id ? categories.find(c => c.id === player.category_id)?.name || 'Sem categoria' : 'Sem categoria'}
                        </span>
                    </td>
                    <td className="px-6 py-6">
                        <div className={`inline-flex items-center gap-2.5 px-4 py-2 rounded-[14px] text-xs font-black uppercase tracking-widest ${
                            player.payment_status === 'PAID' ? 'bg-premium-accent text-black' : 'bg-white/5 text-zinc-600'
                        }`}>
                            {player.payment_status === 'PAID' ? 'Confirmado' : 'Pendente'}
                        </div>
                    </td>
                    <td className="px-10 py-6 text-right relative">
                        <button 
                            onClick={(e) => {
                                e.stopPropagation();
                                setActiveMenu(activeMenu === player.id_player ? null : player.id_player);
                            }}
                            className={`p-2.5 rounded-xl transition-all ${
                                activeMenu === player.id_player ? 'bg-premium-accent text-black shadow-[0_0_20px_rgba(153,204,51,0.4)]' : 'bg-white/5 text-zinc-700 hover:text-white hover:bg-white/10'
                            }`}
                        >
                            {activeMenu === player.id_player ? <X size={18} /> : <MoreHorizontal size={18} />}
                        </button>

                        {activeMenu === player.id_player && (
                            <div 
                                className="absolute right-24 top-1/2 -translate-y-1/2 w-64 bg-black/90 backdrop-blur-3xl border border-white/10 rounded-[24px] shadow-2xl z-50 p-2 overflow-hidden animate-in fade-in zoom-in-95 duration-200"
                                onClick={e => e.stopPropagation()}
                            >
                                <div className="p-3 border-b border-white/5 mb-1">
                                    <p className="text-[10px] font-black uppercase text-zinc-600 tracking-widest text-center">Gerenciar Atleta</p>
                                </div>
                                <button 
                                    onClick={() => handleAction('edit', player)}
                                    className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-white/5 text-zinc-400 hover:text-white transition-all text-xs font-bold uppercase tracking-widest"
                                >
                                    <Edit2 size={16} /> Editar Dados
                                </button>
                                {player.payment_status !== 'PAID' && (
                                    <button 
                                        onClick={() => handleAction('confirm', player)}
                                        className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-white/5 text-premium-accent transition-all text-xs font-bold uppercase tracking-widest"
                                    >
                                        <CheckCircle2 size={16} /> Confirmar Pix
                                    </button>
                                )}
                                <button 
                                    onClick={() => handleAction('notify', player)}
                                    className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-white/5 text-blue-500 transition-all text-xs font-bold uppercase tracking-widest"
                                >
                                    <MessageSquare size={16} /> Notificar Whats
                                </button>
                                <div className="h-px bg-white/5 my-1" />
                                <button 
                                    onClick={() => handleAction('delete', player)}
                                    className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-red-500/10 text-red-500 transition-all text-xs font-bold uppercase tracking-widest"
                                >
                                    <Trash2 size={16} /> Remover
                                </button>
                            </div>
                        )}
                    </td>
                </tr>
                ))}
            </tbody>
            </table>
        </div>
      </div>

      {/* Special Action Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-6 p-8 bg-gradient-to-r from-premium-accent/10 to-transparent rounded-[32px] border border-premium-accent/20">
            <div className="flex items-center gap-5">
                <div className="w-16 h-16 bg-premium-accent/20 rounded-2xl flex items-center justify-center text-premium-accent rotate-3 group-hover:rotate-0 transition-transform">
                    <LayoutGrid size={32} />
                </div>
                <div>
                    <h4 className="text-xl font-black italic uppercase tracking-tighter">Gerar Automatização</h4>
                    <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest">Sorteio de duplas e chaves inteligentes</p>
                </div>
            </div>
            <button 
                className={`btn-primary h-16 px-10 text-lg ${isGenerating ? 'opacity-50' : 'hover:-translate-y-1'}`}
                onClick={handleGenerateDoubles}
                disabled={isGenerating}
            >
                {isGenerating ? <RefreshCw className="animate-spin" size={20} /> : <Mail size={20} />}
                <span>{isGenerating ? 'Processando algoritmos...' : 'Gerar e Notificar Duplas'}</span>
            </button>
      </div>
    </div>
  );
};

export default AtletasPage;
