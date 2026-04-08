// frontend/src/components/RegistrationForm.tsx
import React, { useState } from 'react';
import { AlertCircle, CheckCircle } from 'lucide-react';
import api from '../api';

interface RegistrationFormProps {
  categoryId: number;
  deadline: string;
  onSuccess: () => void;
}

export function RegistrationForm({ categoryId, deadline, onSuccess }: RegistrationFormProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [side, setSide] = useState<'RIGHT' | 'LEFT' | 'EITHER'>('EITHER');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const daysLeft = Math.ceil(
    (new Date(deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await api.post('/athletes', {
        name: name.trim(),
        email: email.trim(),
        side,
        category_id: categoryId
      });
      setSuccess(true);
      setName('');
      setEmail('');
      setSide('EITHER');
      setTimeout(onSuccess, 2000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao registrar');
    } finally {
      setLoading(false);
    }
  };

  if (daysLeft <= 0) {
    return (
      <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6 backdrop-blur-md">
        <p className="text-red-400 font-black uppercase text-xs tracking-widest flex items-center gap-2">
          <AlertCircle size={16} /> Inscrições encerradas para esta categoria
        </p>
      </div>
    );
  }

  if (success) {
    return (
      <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-8 backdrop-blur-md flex flex-col items-center gap-4 text-center">
        <div className="w-16 h-16 bg-green-400 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(74,222,128,0.3)]">
          <CheckCircle className="w-10 h-10 text-black" />
        </div>
        <div>
          <h4 className="text-2xl font-black text-white uppercase tracking-tighter">Inscrição Confirmada!</h4>
          <p className="text-green-400/60 font-bold uppercase text-[10px] tracking-[0.2em] mt-2">Bem-vindo ao Ranking SRB 2026</p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex gap-3 animate-in slide-in-from-top-4 duration-300">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-400 font-bold uppercase tracking-tight">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="text-[10px] font-black text-black/40 uppercase tracking-[0.2em] ml-1">Nome Completo</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full h-14 bg-slate-100 border-2 border-slate-200 text-black rounded-xl px-5 focus:border-green-400 outline-none transition-all placeholder:text-slate-400 font-black uppercase tracking-tight text-sm"
            placeholder="Ex: João da Silva"
          />
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black text-black/40 uppercase tracking-[0.2em] ml-1">E-mail de Contato</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full h-14 bg-slate-100 border-2 border-slate-200 text-black rounded-xl px-5 focus:border-green-400 outline-none transition-all placeholder:text-slate-400 font-black uppercase tracking-tight text-sm"
            placeholder="joao@exemplo.com"
          />
        </div>
      </div>

      <div className="space-y-4">
        <label className="text-[10px] font-black text-black/40 uppercase tracking-[0.2em] ml-1">Lado de Preferência em Quadra</label>
        <div className="grid grid-cols-3 gap-4">
          {(['RIGHT', 'LEFT', 'EITHER'] as const).map((opt) => (
            <label 
              key={opt} 
              className={`relative flex items-center justify-center h-16 border-2 rounded-xl cursor-pointer transition-all duration-300 ${
                side === opt 
                  ? 'border-green-400 bg-green-50 text-green-600' 
                  : 'border-slate-100 bg-slate-50 text-slate-400 hover:border-slate-200'
              }`}
            >
              <input
                type="radio"
                name="side"
                value={opt}
                checked={side === opt}
                onChange={(e) => setSide(e.target.value as any)}
                className="sr-only"
              />
              <span className="text-xs font-black uppercase tracking-widest">
                {opt === 'RIGHT' && 'Direita'}
                {opt === 'LEFT' && 'Esquerda'}
                {opt === 'EITHER' && 'Ambos'}
              </span>
              {side === opt && (
                <div className="absolute -top-2 -right-2 w-5 h-5 bg-green-400 rounded-full flex items-center justify-center shadow-lg">
                  <CheckCircle size={12} className="text-black" />
                </div>
              )}
            </label>
          ))}
        </div>
      </div>

      <div className="pt-4">
        <button
          type="submit"
          disabled={loading}
          className="group w-full h-16 bg-black text-white rounded-xl hover:bg-slate-800 disabled:opacity-50 transition-all duration-300 flex items-center justify-center gap-3 shadow-xl hover:shadow-2xl transform hover:-translate-y-1"
        >
          <span className="text-sm font-black uppercase tracking-[0.3em]">
            {loading ? 'Processando...' : 'Confirmar Inscrição'}
          </span>
          {!loading && <CheckCircle className="w-5 h-5 text-green-400 group-hover:scale-110 transition-transform" />}
        </button>
        
        <div className="mt-6 flex items-center justify-center gap-2">
          <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            Encerra em {daysLeft} dias
          </span>
        </div>
      </div>
    </form>
  );
}
