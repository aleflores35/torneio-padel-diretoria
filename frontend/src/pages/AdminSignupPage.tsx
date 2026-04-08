import { useState } from 'react';
import { Mail, Lock, Key, CheckCircle } from 'lucide-react';

const AdminSignupPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  // Códigos de convite válidos (Admin e Support)
  const VALID_CODES = {
    'ADMIN_2026_001': { role: 'ADMIN', name: 'Admin 1' },
    'ADMIN_2026_002': { role: 'ADMIN', name: 'Admin 2' },
    'SUPPORT_2026': { role: 'SUPPORT', name: 'Support' }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Validações
    if (!email || !password || !inviteCode) {
      setError('Preencha todos os campos!');
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError('Senhas não conferem!');
      setLoading(false);
      return;
    }

    if (password.length < 8) {
      setError('Senha deve ter pelo menos 8 caracteres!');
      setLoading(false);
      return;
    }

    // Validar código de convite
    const inviteData = VALID_CODES[inviteCode as keyof typeof VALID_CODES];
    if (!inviteData) {
      setError('Código de convite inválido!');
      setLoading(false);
      return;
    }

    try {
      // Aqui você faria a chamada para criar o usuário via Supabase
      // Por enquanto, simulamos sucesso
      console.log('Signup:', { email, role: inviteData.role, name: inviteData.name });

      // Simular delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      setSuccess(true);
      setTimeout(() => {
        window.location.href = '/login';
      }, 2000);
    } catch (err) {
      setError('Erro ao criar conta. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-black to-blue-900/20 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="premium-card text-center space-y-6">
            <div className="flex justify-center">
              <CheckCircle size={64} className="text-premium-accent" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white mb-2">Conta Criada!</h1>
              <p className="text-zinc-400">Redirecionando para login...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-black to-blue-900/20 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="premium-card space-y-8">
          {/* Header */}
          <div className="space-y-2 text-center">
            <h1 className="text-4xl font-black uppercase italic tracking-tighter text-white">
              Acesso Admin
            </h1>
            <p className="text-sm text-zinc-500 font-bold uppercase tracking-widest">
              Ranking Padel SRB 2026
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSignup} className="space-y-5">
            {/* Invite Code */}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-zinc-600 tracking-widest pl-1">
                Código de Convite *
              </label>
              <div className="relative">
                <Key size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" />
                <input
                  type="text"
                  placeholder="Código..."
                  className="premium-input w-full pl-12 h-12"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  disabled={loading}
                />
              </div>
            </div>

            {/* Email */}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-zinc-600 tracking-widest pl-1">
                Email *
              </label>
              <div className="relative">
                <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" />
                <input
                  type="email"
                  placeholder="seu@email.com"
                  className="premium-input w-full pl-12 h-12"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-zinc-600 tracking-widest pl-1">
                Senha (mín 8 caracteres) *
              </label>
              <div className="relative">
                <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" />
                <input
                  type="password"
                  placeholder="••••••••"
                  className="premium-input w-full pl-12 h-12"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>

            {/* Confirm Password */}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-zinc-600 tracking-widest pl-1">
                Confirmar Senha *
              </label>
              <div className="relative">
                <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" />
                <input
                  type="password"
                  placeholder="••••••••"
                  className="premium-input w-full pl-12 h-12"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl">
                <p className="text-xs font-bold text-red-500 uppercase tracking-widest">{error}</p>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full h-12 text-sm tracking-normal disabled:opacity-50"
            >
              {loading ? 'Criando conta...' : 'Criar Conta'}
            </button>
          </form>

          {/* Info */}
          <div className="pt-4 border-t border-white/10 space-y-3">
            <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest text-center">
              Códigos Válidos:
            </p>
            <div className="space-y-2 text-[10px] font-mono">
              <div className="p-2 bg-white/5 rounded-xl">
                <p className="text-zinc-400">ADMIN_2026_001 → Admin</p>
              </div>
              <div className="p-2 bg-white/5 rounded-xl">
                <p className="text-zinc-400">ADMIN_2026_002 → Admin</p>
              </div>
              <div className="p-2 bg-white/5 rounded-xl">
                <p className="text-zinc-400">SUPPORT_2026 → Support</p>
              </div>
            </div>
          </div>

          {/* Back to Login */}
          <div className="text-center">
            <a href="/login" className="text-xs font-bold text-premium-accent hover:underline uppercase tracking-widest">
              Já tem conta? Faça login
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminSignupPage;
