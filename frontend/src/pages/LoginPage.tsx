import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn, Mail, Lock, ShieldCheck, Trophy } from 'lucide-react';

const LoginPage = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Forgot password state
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotMsg, setForgotMsg] = useState<{ ok?: boolean; text: string } | null>(null);
  const [forgotLoading, setForgotLoading] = useState(false);

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotMsg(null);
    if (!forgotEmail.includes('@')) {
      setForgotMsg({ ok: false, text: 'Informe um email válido.' });
      return;
    }
    setForgotLoading(true);
    try {
      const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const res = await fetch(`${BASE}/api/auth/athlete/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setForgotMsg({ ok: true, text: `Nova senha enviada pelo WhatsApp ${data.whatsapp_masked}` });
      } else {
        setForgotMsg({ ok: false, text: data.error || 'Não foi possível resetar a senha.' });
      }
    } catch {
      setForgotMsg({ ok: false, text: 'Erro de conexão. Tente novamente.' });
    } finally {
      setForgotLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // 1. Tenta login admin (hardcoded)
    const admins = [
      { email: 'admin@diretoria.com', password: 'admin123' },
      { email: 'demo@padel.com', password: 'demo123' },
      { email: 'alessandro.flores16@gmail.com', password: 'Padelsuper@2026' },
      { email: 'marialuisabonitzio@gmail.com', password: 'Padelsuper@2026' },
      { email: 'marciovipveiculos@gmail.com', password: '220275' }
    ];
    const isAdmin = admins.some(a => a.email === email && a.password === password);
    if (isAdmin) {
      localStorage.setItem('userRole', 'ADMIN');
      setLoading(false);
      navigate('/rodadas');
      return;
    }

    // 2. Tenta login de atleta via API
    try {
      const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const res = await fetch(`${BASE}/api/auth/athlete/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (res.ok && data.role === 'ATHLETE') {
        localStorage.setItem('userRole', 'ATHLETE');
        localStorage.setItem('athleteData', JSON.stringify(data));
        // Also save player_session so AtletaPage reads it and skips its own login
        localStorage.setItem('player_session', JSON.stringify({
          id_player: data.id_player,
          name: data.name,
          side: data.side,
          category_id: data.category_id,
        }));
        navigate('/atleta');
        return;
      }
      setError(data.error || 'Email ou senha incorretos.');
    } catch {
      setError('Erro de conexão. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="min-h-screen flex items-center justify-center bg-premium-dark p-6">
      <div className="w-full max-w-md space-y-8 animate-in zoom-in duration-500">
        <div className="text-center space-y-4">
          <div className="w-24 h-24 bg-green-400 rounded-3xl mx-auto flex items-center justify-center text-black shadow-[0_0_50px_rgba(74,222,128,0.3)] rotate-3">
            <Trophy size={48} />
          </div>
          <div className="space-y-2">
            <h2 className="text-5xl font-black font-display tracking-tighter uppercase text-white leading-none">
              RANKING <span className="text-green-400">SRB</span>
            </h2>
            <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.3em] italic">
              Acesso Restrito • Temporada 2026
            </p>
          </div>
        </div>

        <form className="premium-card space-y-6" onSubmit={handleLogin}>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                <Mail size={14} /> E-mail
              </label>
              <input 
                type="email" 
                placeholder="seu@email.com" 
                className="premium-input w-full"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                <Lock size={14} /> Senha
              </label>
              <input 
                type="password" 
                placeholder="••••••••" 
                className="premium-input w-full"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-400 font-bold">
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50">
            <LogIn size={20} />
            <span>{loading ? 'Entrando...' : 'Entrar no Sistema'}</span>
          </button>

          <div className="flex items-center justify-between text-[11px] text-zinc-600 font-bold uppercase tracking-tighter">
            <button type="button" onClick={() => { setForgotOpen(o => !o); setForgotMsg(null); }} className="hover:text-premium-accent transition-colors">
              Esqueci a senha
            </button>
            <span className="flex items-center gap-1"><ShieldCheck size={12} /> Acesso Seguro</span>
          </div>

          {forgotOpen && (
            <div className="border-t border-white/10 pt-4 space-y-3">
              <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                <Mail size={14} /> Email cadastrado
              </label>
              <input
                type="email"
                placeholder="seu@email.com"
                className="premium-input w-full"
                value={forgotEmail}
                onChange={e => setForgotEmail(e.target.value)}
              />
              <button type="button" onClick={handleForgotPassword} disabled={forgotLoading}
                className="w-full h-11 bg-green-400 hover:bg-green-300 text-black font-black uppercase tracking-widest rounded-xl text-xs disabled:opacity-50">
                {forgotLoading ? 'Enviando...' : 'Enviar nova senha por WhatsApp'}
              </button>
              {forgotMsg && (
                <p className={`text-xs font-bold ${forgotMsg.ok ? 'text-green-400' : 'text-red-400'}`}>
                  {forgotMsg.text}
                </p>
              )}
            </div>
          )}
        </form>

        <div className="text-center">
            <p className="text-zinc-600 text-[10px] font-black uppercase tracking-[0.2em]">RANKING PADEL SRB © 2026</p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
