import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn, Mail, Lock, ShieldCheck } from 'lucide-react';

const LoginPage = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Simulação de autenticação por papéis
    if ((email === 'admin@diretoria.com' && password === 'admin123') ||
        (email === 'demo@padel.com' && password === 'demo123')) {
      localStorage.setItem('userRole', 'ADMIN');
      navigate('/admin');
    } else if (email === 'suporte@diretoria.com' && password === 'suporte123') {
      localStorage.setItem('userRole', 'SUPPORT');
      navigate('/quadras');
    } else {
      localStorage.setItem('userRole', 'ATHLETE');
      navigate('/publico');
    }
  };


  return (
    <div className="min-h-screen flex items-center justify-center bg-premium-dark p-6">
      <div className="w-full max-w-md space-y-8 animate-in zoom-in duration-500">
        <div className="text-center space-y-2">
          <img src="logo.png" alt="Logo" className="w-32 h-32 mx-auto drop-shadow-[0_0_20px_rgba(153,204,51,0.4)]" />
          <h2 className="text-4xl font-black tracking-tighter uppercase text-premium-accent">Portal do Atleta</h2>
          <p className="text-zinc-500 text-sm">Acesse sua conta para gerenciar inscrições e jogos.</p>
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

          <button type="submit" className="btn-primary w-full flex items-center justify-center gap-2">
            <LogIn size={20} />
            <span>Entrar no Sistema</span>
          </button>

          <div className="flex items-center justify-between text-[11px] text-zinc-600 font-bold uppercase tracking-tighter">
            <a href="#" className="hover:text-premium-accent transition-colors">Esqueci a senha</a>
            <span className="flex items-center gap-1"><ShieldCheck size={12} /> Acesso Seguro</span>
          </div>
        </form>

        <div className="text-center">
            <p className="text-zinc-600 text-[10px] font-black uppercase tracking-[0.2em]">Diretoria Padel © 2026</p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
