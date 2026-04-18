import { useState, useEffect } from 'react';
import { useCategory } from '../context/CategoryContext';
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
  KeyRound,
  X,
  ArrowRightCircle,
  ArrowLeftCircle,
  HelpCircle
} from 'lucide-react';
import { fetchPlayers, addPlayer, generateDoubles } from '../api';
import type { Player, Side } from '../api';
import { TOURNAMENT_ID } from '../config';

const AtletasPage = () => {
  // Rebuild trigger - new registration form with expanded fields
  const { selectedCategory } = useCategory();
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [newPlayer, setNewPlayer] = useState<{
    name: string;
    whatsapp: string;
    side: Side;
    category_id?: number;
    matricula?: string;
    data_nascimento?: string;
    cpf?: string;
    rg?: string;
    endereco?: string;
    numero?: string;
    complemento?: string;
    cep?: string;
    tamanho_camiseta?: string;
    atendido_por?: string;
  }>({ name: '', whatsapp: '', side: 'EITHER', category_id: undefined });
  const [filter, setFilter] = useState({ name: '', side: 'ALL', status: 'ALL', category: 'ALL' });
  const [activeMenu, setActiveMenu] = useState<number | null>(null);
  const [editModal, setEditModal] = useState<Player | null>(null);
  const [editForm, setEditForm] = useState<{ name: string; whatsapp: string; email: string; side: Side; category_id: number | undefined }>({ name: '', whatsapp: '', email: '', side: 'EITHER', category_id: undefined });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const [categories] = useState([
    { id: 1, name: 'Masculino Iniciante / 6ª' },
    { id: 2, name: 'Masculino 4ª' },
    { id: 3, name: 'Feminino Iniciante' }
  ]);

  useEffect(() => {
    const handleClickOutside = () => setActiveMenu(null);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  const handleAction = async (action: string, player: Player) => {
    setActiveMenu(null);
    const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

    if (action === 'delete') {
      if (!confirm(`Tem certeza que deseja excluir ${player.name}?`)) return;
      try {
        const res = await fetch(`${BASE}/api/players/${player.id_player}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Erro ao excluir');
        setPlayers(players.filter(p => p.id_player !== player.id_player));
      } catch (err) {
        alert('Erro ao excluir atleta. Tente novamente.');
      }
    } else if (action === 'confirm') {
      try {
        const res = await fetch(`${BASE}/api/players/${player.id_player}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ payment_status: 'PAID' })
        });
        if (!res.ok) throw new Error('Erro ao confirmar');
        setPlayers(players.map(p => p.id_player === player.id_player ? { ...p, payment_status: 'PAID' } : p));
      } catch (err) {
        alert('Erro ao confirmar pagamento. Tente novamente.');
      }
    } else if (action === 'notify') {
      try {
        const res = await fetch(`${BASE}/api/players/${player.id_player}/notify`, { method: 'POST' });
        if (!res.ok) throw new Error('Erro ao notificar');
        alert(`WhatsApp enviado para ${player.name}`);
      } catch (err) {
        alert(`Notificação enviada para ${player.name} (modo offline)`);
      }
    } else if (action === 'edit') {
      setEditModal(player);
      setEditForm({
        name: player.name || '',
        whatsapp: player.whatsapp || '',
        email: player.email || '',
        side: (player.side as Side) || 'EITHER',
        category_id: player.category_id
      });
      setEditError('');
    } else if (action === 'reset-password') {
      // Sem email nem WhatsApp: atleta não consegue nem fazer lookup pra logar → abrir edição
      if (!player.email && !player.whatsapp) {
        alert(`${player.name} não tem email nem WhatsApp cadastrados. Preencha os dados antes de resetar a senha.`);
        setEditModal(player);
        setEditForm({
          name: player.name || '',
          whatsapp: player.whatsapp || '',
          email: player.email || '',
          side: (player.side as Side) || 'EITHER',
          category_id: player.category_id
        });
        setEditError('');
        return;
      }
      if (!confirm(`Resetar a senha de ${player.name}? Uma nova senha será enviada por WhatsApp.`)) return;
      try {
        const res = await fetch(`${BASE}/api/players/${player.id_player}/reset-password`, { method: 'POST' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erro');
        alert(`Nova senha de ${player.name}: ${data.temp_password}\n\nEnviada por WhatsApp para ${data.whatsapp_masked}`);
      } catch (err: any) {
        alert(`Erro ao resetar senha: ${err.message || 'tente novamente'}`);
      }
    }
  };

  const handleSaveEdit = async () => {
    if (!editModal) return;
    const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    if (!editForm.name.trim()) { setEditError('Nome é obrigatório'); return; }
    setEditSaving(true);
    setEditError('');
    try {
      const res = await fetch(`${BASE}/api/players/${editModal.id_player}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editForm.name.trim(),
          whatsapp: editForm.whatsapp.trim(),
          email: editForm.email.trim().toLowerCase() || null,
          side: editForm.side,
          category_id: editForm.category_id
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const parts = [data.error, data.details, data.hint].filter(Boolean);
        throw new Error(parts.length ? parts.join(' — ') : 'Erro ao salvar');
      }
      setPlayers(players.map(p => p.id_player === editModal.id_player ? {
        ...p,
        name: editForm.name.trim(),
        whatsapp: editForm.whatsapp.trim(),
        email: editForm.email.trim().toLowerCase(),
        side: editForm.side,
        category_id: editForm.category_id
      } : p));
      setEditModal(null);
    } catch (err: any) {
      setEditError(err.message || 'Erro ao salvar');
    } finally {
      setEditSaving(false);
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
        alert("Preencha pelo menos nome e whatsapp!");
        return;
    }
    try {
      await addPlayer({
        id_tournament: TOURNAMENT_ID,
        name: newPlayer.name,
        matricula: newPlayer.matricula,
        data_nascimento: newPlayer.data_nascimento,
        cpf: newPlayer.cpf,
        rg: newPlayer.rg,
        whatsapp: newPlayer.whatsapp,
        endereco: newPlayer.endereco,
        numero: newPlayer.numero,
        complemento: newPlayer.complemento,
        cep: newPlayer.cep,
        tamanho_camiseta: newPlayer.tamanho_camiseta,
        atendido_por: newPlayer.atendido_por,
        side: newPlayer.side,
        category_id: newPlayer.category_id,
        payment_status: 'PENDING'
      });
      loadPlayers();
      setShowForm(false);
      setNewPlayer({ name: '', whatsapp: '', side: 'EITHER', category_id: undefined });
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
    const matchesCategory = selectedCategory ? p.category_id === selectedCategory : true;
    return matchesName && matchesSide && matchesStatus && matchesCategory;
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
            <h2 className="text-5xl font-black italic uppercase tracking-tighter leading-none">Inscrições <br/><span className="text-premium-accent">SRB 2026</span></h2>
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
           
           <div className="space-y-6">
                {/* Row 1: Dados Pessoais Básicos */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-zinc-600 tracking-widest pl-1">Nome Completo *</label>
                        <input
                        type="text" placeholder="Ex: Rodrigo Silva" className="premium-input w-full bg-black/40 h-14"
                        value={newPlayer.name} onChange={e => setNewPlayer({...newPlayer, name: e.target.value})}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-zinc-600 tracking-widest pl-1">Matrícula</label>
                        <input
                        type="text" placeholder="Ex: 12345" className="premium-input w-full bg-black/40 h-14"
                        value={newPlayer.matricula || ''} onChange={e => setNewPlayer({...newPlayer, matricula: e.target.value})}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-zinc-600 tracking-widest pl-1">Data de Nascimento</label>
                        <input
                        type="date" className="premium-input w-full bg-black/40 h-14"
                        value={newPlayer.data_nascimento || ''} onChange={e => setNewPlayer({...newPlayer, data_nascimento: e.target.value})}
                        />
                    </div>
                </div>

                {/* Row 2: Documentos */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-zinc-600 tracking-widest pl-1">CPF</label>
                        <input
                        type="text" placeholder="000.000.000-00" className="premium-input w-full bg-black/40 h-14"
                        value={newPlayer.cpf || ''} onChange={e => setNewPlayer({...newPlayer, cpf: e.target.value})}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-zinc-600 tracking-widest pl-1">RG</label>
                        <input
                        type="text" placeholder="0000000" className="premium-input w-full bg-black/40 h-14"
                        value={newPlayer.rg || ''} onChange={e => setNewPlayer({...newPlayer, rg: e.target.value})}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-zinc-600 tracking-widest pl-1">WhatsApp *</label>
                        <input
                        type="text" placeholder="(51) 99999-9999" className="premium-input w-full bg-black/40 h-14"
                        value={newPlayer.whatsapp} onChange={e => setNewPlayer({...newPlayer, whatsapp: e.target.value})}
                        />
                    </div>
                </div>

                {/* Row 3: Endereço */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="col-span-2 space-y-2">
                        <label className="text-[10px] font-black uppercase text-zinc-600 tracking-widest pl-1">Endereço</label>
                        <input
                        type="text" placeholder="Rua/Avenida..." className="premium-input w-full bg-black/40 h-14"
                        value={newPlayer.endereco || ''} onChange={e => setNewPlayer({...newPlayer, endereco: e.target.value})}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-zinc-600 tracking-widest pl-1">Número</label>
                        <input
                        type="text" placeholder="123" className="premium-input w-full bg-black/40 h-14"
                        value={newPlayer.numero || ''} onChange={e => setNewPlayer({...newPlayer, numero: e.target.value})}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-zinc-600 tracking-widest pl-1">CEP</label>
                        <input
                        type="text" placeholder="00000-000" className="premium-input w-full bg-black/40 h-14"
                        value={newPlayer.cep || ''} onChange={e => setNewPlayer({...newPlayer, cep: e.target.value})}
                        />
                    </div>
                </div>

                {/* Row 4: Complemento e Camiseta */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="col-span-2 space-y-2">
                        <label className="text-[10px] font-black uppercase text-zinc-600 tracking-widest pl-1">Complemento</label>
                        <input
                        type="text" placeholder="Apto, sala..." className="premium-input w-full bg-black/40 h-14"
                        value={newPlayer.complemento || ''} onChange={e => setNewPlayer({...newPlayer, complemento: e.target.value})}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-zinc-600 tracking-widest pl-1">Tamanho Camiseta</label>
                        <select
                            className="premium-input w-full bg-black/40 h-14"
                            value={newPlayer.tamanho_camiseta || ''} onChange={e => setNewPlayer({...newPlayer, tamanho_camiseta: e.target.value})}
                        >
                            <option value="">Selecione...</option>
                            <option value="P">P</option>
                            <option value="M">M</option>
                            <option value="G">G</option>
                            <option value="GG">GG</option>
                        </select>
                    </div>
                </div>

                {/* Row 5: Categoria, Lado e Atendido Por */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-zinc-600 tracking-widest pl-1">Categoria</label>
                        <select
                            className="premium-input w-full bg-black/40 h-14"
                            value={newPlayer.category_id || ''} onChange={e => setNewPlayer({...newPlayer, category_id: e.target.value ? parseInt(e.target.value) : undefined})}
                        >
                            <option value="">Selecione...</option>
                            {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                        </select>
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
                    <div className="col-span-2 space-y-2">
                        <label className="text-[10px] font-black uppercase text-zinc-600 tracking-widest pl-1">Atendido Por</label>
                        <input
                        type="text" placeholder="Nome do atendente" className="premium-input w-full bg-black/40 h-14"
                        value={newPlayer.atendido_por || ''} onChange={e => setNewPlayer({...newPlayer, atendido_por: e.target.value})}
                        />
                    </div>
                </div>

                {/* Action Button */}
                <div className="flex gap-3">
                    <button onClick={handleSave} className="btn-primary flex-1 h-14 text-sm tracking-normal">Salvar Atleta</button>
                    <button onClick={() => setShowForm(false)} className="btn-secondary flex-1 h-14 text-sm tracking-normal">Cancelar</button>
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
                                <button
                                    onClick={() => handleAction('reset-password', player)}
                                    className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-white/5 text-amber-400 transition-all text-xs font-bold uppercase tracking-widest"
                                >
                                    <KeyRound size={16} /> Resetar Senha
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

      {/* Modal: Editar Atleta */}
      {editModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-white/10 rounded-3xl p-4 sm:p-8 w-full max-w-lg space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-black uppercase tracking-tight text-white">Editar Atleta</h3>
              <button onClick={() => setEditModal(null)} className="text-zinc-500 hover:text-white"><X size={20} /></button>
            </div>

            {editError && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-sm text-red-400 font-bold">
                {editError}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Nome *</label>
              <input type="text" value={editForm.name}
                onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                className="w-full h-12 bg-white/5 border border-white/10 text-white rounded-xl px-4 focus:border-premium-accent outline-none text-sm font-bold" />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">WhatsApp</label>
              <input type="text" value={editForm.whatsapp}
                onChange={e => setEditForm({ ...editForm, whatsapp: e.target.value })}
                placeholder="(51) 99999-9999"
                className="w-full h-12 bg-white/5 border border-white/10 text-white rounded-xl px-4 focus:border-premium-accent outline-none text-sm font-bold" />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Email</label>
              <input type="email" value={editForm.email}
                onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                placeholder="atleta@email.com"
                className="w-full h-12 bg-white/5 border border-white/10 text-white rounded-xl px-4 focus:border-premium-accent outline-none text-sm font-bold" />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Lado</label>
              <div className="grid grid-cols-3 gap-2">
                {(['RIGHT', 'LEFT', 'EITHER'] as const).map(s => (
                  <button key={s} type="button"
                    onClick={() => setEditForm({ ...editForm, side: s })}
                    className={`h-12 rounded-xl text-[11px] font-black uppercase tracking-widest border transition-all ${
                      editForm.side === s
                        ? 'bg-premium-accent/20 text-premium-accent border-premium-accent/40'
                        : 'bg-white/5 text-zinc-400 border-white/10 hover:bg-white/10'
                    }`}>
                    {s === 'RIGHT' ? 'Direita' : s === 'LEFT' ? 'Esquerda' : 'Ambos'}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Categoria</label>
              <select value={editForm.category_id ?? ''}
                onChange={e => setEditForm({ ...editForm, category_id: e.target.value ? Number(e.target.value) : undefined })}
                className="w-full h-12 bg-white/5 border border-white/10 text-white rounded-xl px-4 focus:border-premium-accent outline-none text-sm font-bold">
                <option value="">— Sem categoria —</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <button onClick={handleSaveEdit} disabled={editSaving}
              className="w-full h-12 bg-premium-accent hover:bg-premium-accent/90 text-black font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50">
              {editSaving ? <><RefreshCw size={14} className="animate-spin" /> Salvando...</> : <><CheckCircle2 size={14} /> Salvar Alterações</>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AtletasPage;
