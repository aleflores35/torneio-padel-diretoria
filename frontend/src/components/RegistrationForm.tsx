import React, { useState, useEffect, useRef } from 'react';
import { AlertCircle, CheckCircle, Search, ChevronRight, User, Lock } from 'lucide-react';
import API_URL, { TOURNAMENT_ID } from '../config';

interface Player {
  id_player: number;
  name: string;
  email?: string;
  whatsapp?: string;
  side?: string;
  category_id?: number;
}

interface RegistrationFormProps {
  categoryId: number;
  onSuccess: () => void;
}

export function RegistrationForm({ categoryId, onSuccess }: RegistrationFormProps) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<Player[]>([]);
  const [selected, setSelected] = useState<Player | null>(null);
  const [searching, setSearching] = useState(false);
  const [formData, setFormData] = useState({ email: '', whatsapp: '', side: 'EITHER' as 'RIGHT' | 'LEFT' | 'EITHER', password: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Busca atletas pelo nome enquanto digita
  useEffect(() => {
    if (search.length < 2) {
      setResults([]);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `${API_URL}/api/tournaments/${TOURNAMENT_ID}/players?category=${categoryId}&name=${encodeURIComponent(search)}`
        );
        const data: Player[] = res.ok ? await res.json() : [];
        // Filtra no frontend pelo nome digitado (case insensitive)
        const filtered = data.filter(p =>
          p.name.toLowerCase().includes(search.toLowerCase())
        );
        setResults(filtered.slice(0, 6));
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
  }, [search, categoryId]);

  const handleSelect = (player: Player) => {
    setSelected(player);
    setSearch(player.name);
    setResults([]);
    setFormData({
      email: player.email || '',
      whatsapp: player.whatsapp || '',
      side: (player.side as 'RIGHT' | 'LEFT' | 'EITHER') || 'EITHER',
      password: '',
      confirmPassword: ''
    });
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) {
      setError('Selecione seu nome na lista de atletas cadastrados');
      return;
    }
    if (!formData.email.trim()) {
      setError('Email é obrigatório');
      return;
    }
    if (!formData.whatsapp.trim()) {
      setError('WhatsApp é obrigatório');
      return;
    }
    if (!formData.password) {
      setError('Crie uma senha para acessar o sistema');
      return;
    }
    if (formData.password.length < 6) {
      setError('A senha precisa ter pelo menos 6 caracteres');
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setError('As senhas não coincidem');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/players/${selected.id_player}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email.trim().toLowerCase(),
          whatsapp: formData.whatsapp.trim(),
          side: formData.side,
          password: formData.password
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const parts = [data.error, data.details, data.hint].filter(Boolean);
        throw new Error(parts.length ? parts.join(' — ') : 'Erro ao atualizar dados');
      }
      setSuccess(true);
      setTimeout(onSuccess, 3000);
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="flex flex-col items-center gap-6 text-center py-8">
        <div className="w-20 h-20 bg-green-400 rounded-full flex items-center justify-center shadow-[0_0_40px_rgba(74,222,128,0.3)]">
          <CheckCircle className="w-12 h-12 text-black" />
        </div>
        <div>
          <h4 className="text-3xl font-black text-white uppercase tracking-tighter">Dados Confirmados!</h4>
          <p className="text-white/40 font-bold uppercase text-[10px] tracking-[0.2em] mt-2">
            {selected?.name} — Ranking SRB 2026
          </p>
        </div>
        <p className="text-sm text-white/50 max-w-xs">
          Você receberá informações sobre os jogos pelo email e WhatsApp cadastrados.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <p className="text-sm text-red-400 font-bold">{error}</p>
        </div>
      )}

      {/* Busca por nome */}
      <div className="space-y-2">
        <label className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">
          Seu Nome *
        </label>
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input
            type="text"
            placeholder="Digite seu nome para buscar..."
            value={search}
            onChange={e => { setSearch(e.target.value); setSelected(null); }}
            className="w-full h-14 bg-white/5 border border-white/10 text-white rounded-xl pl-11 pr-5 focus:border-green-400 outline-none text-sm font-bold transition-all placeholder:text-white/20"
          />
          {searching && (
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] text-white/30 uppercase tracking-widest">buscando...</span>
          )}
        </div>

        {/* Dropdown de resultados */}
        {results.length > 0 && (
          <div className="bg-slate-900 border border-white/10 rounded-xl overflow-hidden shadow-2xl">
            {results.map(p => (
              <button
                key={p.id_player}
                type="button"
                onClick={() => handleSelect(p)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-all text-left border-b border-white/5 last:border-0"
              >
                <div className="w-8 h-8 bg-green-400/10 rounded-lg flex items-center justify-center shrink-0">
                  <User className="w-4 h-4 text-green-400" />
                </div>
                <span className="text-sm font-bold text-white">{p.name}</span>
              </button>
            ))}
          </div>
        )}

        {search.length >= 2 && results.length === 0 && !searching && !selected && (
          <p className="text-xs text-white/30 font-bold px-1">
            Nome não encontrado. Apenas atletas já inscritos podem completar o cadastro.
          </p>
        )}

        {selected && (
          <p className="text-xs text-green-400 font-bold px-1 flex items-center gap-2">
            <CheckCircle className="w-3.5 h-3.5" /> {selected.name} selecionado
          </p>
        )}
      </div>

      {/* Campos de contato — só aparecem após selecionar */}
      {selected && (
        <>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Email *</label>
            <input
              type="email"
              placeholder="seu@email.com"
              value={formData.email}
              onChange={e => setFormData({ ...formData, email: e.target.value })}
              required
              className="w-full h-14 bg-white/5 border border-white/10 text-white rounded-xl px-5 focus:border-green-400 outline-none text-sm font-bold transition-all placeholder:text-white/20"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">WhatsApp *</label>
            <input
              type="text"
              placeholder="(51) 99999-9999"
              value={formData.whatsapp}
              onChange={e => setFormData({ ...formData, whatsapp: e.target.value })}
              required
              className="w-full h-14 bg-white/5 border border-white/10 text-white rounded-xl px-5 focus:border-green-400 outline-none text-sm font-bold transition-all placeholder:text-white/20"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] flex items-center gap-1.5">
              <Lock className="w-3 h-3" /> Crie sua senha *
            </label>
            <input
              type="password"
              placeholder="Mínimo 6 caracteres"
              value={formData.password}
              onChange={e => setFormData({ ...formData, password: e.target.value })}
              required
              className="w-full h-14 bg-white/5 border border-white/10 text-white rounded-xl px-5 focus:border-green-400 outline-none text-sm font-bold transition-all placeholder:text-white/20"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] flex items-center gap-1.5">
              <Lock className="w-3 h-3" /> Confirme a senha *
            </label>
            <input
              type="password"
              placeholder="Repita a senha"
              value={formData.confirmPassword}
              onChange={e => setFormData({ ...formData, confirmPassword: e.target.value })}
              required
              className={`w-full h-14 bg-white/5 border text-white rounded-xl px-5 focus:outline-none text-sm font-bold transition-all placeholder:text-white/20 ${
                formData.confirmPassword && formData.password !== formData.confirmPassword
                  ? 'border-red-500/50 focus:border-red-400'
                  : 'border-white/10 focus:border-green-400'
              }`}
            />
            {formData.confirmPassword && formData.password !== formData.confirmPassword && (
              <p className="text-xs text-red-400 font-bold px-1">As senhas não coincidem</p>
            )}
          </div>

          <div className="space-y-3">
            <label className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Lado de Preferência</label>
            <div className="grid grid-cols-3 gap-3">
              {([
                { value: 'RIGHT', label: 'Direita' },
                { value: 'LEFT', label: 'Esquerda' },
                { value: 'EITHER', label: 'Ambos' }
              ] as const).map(opt => (
                <label
                  key={opt.value}
                  className={`flex items-center justify-center h-12 border rounded-xl cursor-pointer transition-all text-xs font-black uppercase tracking-widest ${
                    formData.side === opt.value
                      ? 'border-green-400 bg-green-400/10 text-green-400'
                      : 'border-white/10 bg-white/5 text-white/40 hover:border-white/20'
                  }`}
                >
                  <input
                    type="radio"
                    name="side"
                    value={opt.value}
                    checked={formData.side === opt.value}
                    onChange={e => setFormData({ ...formData, side: e.target.value as 'RIGHT' | 'LEFT' | 'EITHER' })}
                    className="sr-only"
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-14 bg-green-400 hover:bg-green-300 text-black font-black uppercase tracking-[0.2em] rounded-xl transition-all flex items-center justify-center gap-3 shadow-[0_10px_30px_rgba(74,222,128,0.2)] disabled:opacity-50 transform hover:-translate-y-0.5"
          >
            {loading ? 'Salvando...' : <><ChevronRight className="w-5 h-5" /> Confirmar Dados</>}
          </button>
        </>
      )}

      <p className="text-center text-[10px] text-white/20 font-bold uppercase tracking-widest">
        Inscrições abertas · Toda quinta 18h–23h
      </p>
    </form>
  );
}
