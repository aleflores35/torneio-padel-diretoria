import { useState } from 'react';
import { 
  Trophy, 
  Users, 
  MapPin, 
  Calendar, 
  ChevronRight, 
  Smartphone, 
  Star,
  CheckCircle2
} from 'lucide-react';
import axios from 'axios';

const LandingPage = () => {
  const [formData, setFormData] = useState({
    name: '',
    whatsapp: '',
    side: 'EITHER'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    axios.post('http://localhost:3001/api/players', { 
      ...formData, 
      id_tournament: 1,
      payment_status: 'PENDING'
    })
    .then(() => {
      setSuccess(true);
      setIsSubmitting(false);
    })
    .catch(err => {
      alert(err.message);
      setIsSubmitting(false);
    });
  };

  if (success) {
    return (
      <div className="min-h-screen bg-premium-dark flex items-center justify-center p-6 text-center">
        <div className="max-w-md space-y-6 animate-in zoom-in duration-500">
          <div className="w-24 h-24 bg-premium-accent/20 rounded-full flex items-center justify-center mx-auto text-premium-accent">
            <CheckCircle2 size={48} />
          </div>
          <h1 className="text-4xl font-black text-white italic">INSCRIÇÃO RECEBIDA!</h1>
          <p className="text-zinc-400">Excelente! Agora é só aguardar. Você receberá um WhatsApp com as instruções para pagamento e acesso ao portal.</p>
          <button 
            onClick={() => window.location.href = '/login'}
            className="btn-primary w-full py-4 text-lg"
          >
            Acessar Portal do Atleta
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-premium-dark text-white font-sans selection:bg-premium-accent selection:text-black">
      {/* Hero Section */}
      <section className="relative h-screen flex items-center justify-center overflow-hidden border-b border-white/5">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-premium-accent/10 via-transparent to-transparent opacity-50" />
        <div className="container mx-auto px-6 relative z-10 text-center space-y-8">
          <img src="/logo.png" alt="Diretoria Padel" className="w-32 h-32 mx-auto drop-shadow-[0_0_30px_rgba(153,204,51,0.5)] animate-pulse" />
          <div className="space-y-4">
            <h1 className="text-7xl md:text-9xl font-black italic tracking-tighter leading-none">
              DIRETORIA<br/><span className="text-premium-accent">PADEL</span>
            </h1>
            <p className="text-xl md:text-2xl text-zinc-400 font-medium max-w-2xl mx-auto">
              O maior torneio de padel da região. Tecnologia, competição e o melhor networking do esporte.
            </p>
          </div>
          <div className="flex flex-col md:flex-row items-center justify-center gap-4 pt-8">
            <a href="#register" className="btn-primary px-12 py-5 text-xl flex items-center gap-3 w-full md:w-auto">
              Garanta Sua Vaga <ChevronRight size={20} />
            </a>
            <a href="/publico" className="bg-white/5 hover:bg-white/10 border border-white/10 px-12 py-5 text-xl rounded-2xl transition-all w-full md:w-auto">
              Ver Placar Ao Vivo
            </a>
          </div>
        </div>
      </section>

      {/* Info Section */}
      <section className="py-24 bg-black/30">
        <div className="container mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-12 text-center">
          <div className="space-y-4 group">
            <div className="w-16 h-16 bg-premium-accent/10 rounded-2xl flex items-center justify-center mx-auto text-premium-accent group-hover:scale-110 transition-transform">
              <Calendar size={32} />
            </div>
            <h3 className="text-2xl font-bold uppercase tracking-tighter">11 de Abril</h3>
            <p className="text-zinc-500 font-bold uppercase text-xs tracking-widest">Sábado • A partir das 09h</p>
          </div>
          <div className="space-y-4 group">
            <div className="w-16 h-16 bg-premium-accent/10 rounded-2xl flex items-center justify-center mx-auto text-premium-accent group-hover:scale-110 transition-transform">
              <MapPin size={32} />
            </div>
            <h3 className="text-2xl font-bold uppercase tracking-tighter">Complexo Compadel</h3>
            <p className="text-zinc-500 font-bold uppercase text-xs tracking-widest">Compadel é Nosso Território</p>
          </div>
          <div className="space-y-4 group">
            <div className="w-16 h-16 bg-premium-accent/10 rounded-2xl flex items-center justify-center mx-auto text-premium-accent group-hover:scale-110 transition-transform">
              <Users size={32} />
            </div>
            <h3 className="text-2xl font-bold uppercase tracking-tighter text-premium-accent">Vagas Limitadas</h3>
            <p className="text-zinc-500 font-bold uppercase text-xs tracking-widest">Apenas 32 Duplas</p>
          </div>

          {/* New Prizes Section based on official data */}
          <div className="md:col-span-3 mt-12 grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="premium-card bg-zinc-900/50 border-white/5 p-8 border-premium-accent/30 shadow-[0_0_30px_rgba(153,204,51,0.1)]">
              <div className="text-premium-accent mb-4"><Trophy size={48} className="mx-auto" /></div>
              <h4 className="text-xl font-black uppercase italic tracking-tighter">Campeão</h4>
              <p className="text-sm text-zinc-400 mt-2 uppercase font-bold">Troféu + 100% Inscrição</p>
              <p className="text-xs text-zinc-600 mt-1">Crédito na Copa + Brinde Especial</p>
            </div>
            <div className="premium-card bg-zinc-900/50 border-white/5 p-8">
              <div className="text-zinc-400 mb-4"><Trophy size={48} className="mx-auto" /></div>
              <h4 className="text-xl font-black uppercase italic tracking-tighter">Vice Campeão</h4>
              <p className="text-sm text-zinc-400 mt-2 uppercase font-bold">Troféu + 50% Inscrição</p>
              <p className="text-xs text-zinc-600 mt-1">Crédito na Copa + Brinde Especial</p>
            </div>
            <div className="premium-card bg-zinc-900/50 border-white/5 p-8">
              <div className="text-premium-accent/40 mb-4"><Users size={48} className="mx-auto" /></div>
              <h4 className="text-xl font-black uppercase italic tracking-tighter">Inscrição</h4>
              <p className="text-3xl font-black text-white mt-2 italic">R$ 85,00</p>
              <p className="text-zinc-500 font-bold uppercase text-[10px] mt-2 tracking-widest">Incluso Almoço Completo</p>
            </div>
          </div>
        </div>
      </section>

      {/* Lunch Section - Carreteiro do Marcola */}
      <section className="py-24 bg-gradient-to-b from-transparent to-black/50 overflow-hidden">
        <div className="container mx-auto px-6">
            <div className="glass-effect p-12 rounded-[40px] border border-white/5 flex flex-col md:flex-row items-center gap-12">
                <div className="flex-1 space-y-6">
                    <span className="bg-premium-accent/20 text-premium-accent px-4 py-1 rounded-full text-xs font-black uppercase tracking-widest inline-block leading-none">Cardápio Oficial</span>
                    <h2 className="text-5xl font-black italic uppercase leading-none">Carreteiro do <span className="text-premium-accent">Marcola</span></h2>
                    <p className="text-zinc-400 text-lg">Energia garantida para as finais com o melhor da culinária raiz: Carreteiro, maionese, salada, ovo cozido e aquele tempero verde especial.</p>
                    <div className="flex flex-wrap gap-3">
                        {['Carreteiro', 'Maionese', 'Ma Meat', 'Salada', 'Farofa', 'Batata Palha'].map(item => (
                            <span key={item} className="bg-white/5 border border-white/10 px-4 py-2 rounded-xl text-xs font-bold text-zinc-400 uppercase tracking-tighter">{item}</span>
                        ))}
                    </div>
                </div>
                <div className="w-full md:w-1/3 aspect-square bg-gradient-to-br from-zinc-800 to-zinc-900 rounded-[30px] border border-white/10 flex items-center justify-center rotate-3 relative hover:rotate-0 transition-transform duration-500">
                    <div className="absolute inset-0 bg-black/40 rounded-[30px]" />
                    <span className="text-6xl text-white italic font-black z-10 opacity-20 uppercase -rotate-90">MEAL TIME</span>
                    <div className="z-20 text-center space-y-2">
                         <div className="text-premium-accent text-5xl font-black">🍚+🍖</div>
                         <div className="text-zinc-400 font-black text-xs uppercase tracking-widest">Almoço por Atleta</div>
                    </div>
                </div>
            </div>
        </div>
      </section>

      {/* Regulations detail */}
      <section className="py-12 bg-premium-accent text-black overflow-hidden relative">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[120px] font-black italic opacity-10 whitespace-nowrap tracking-tighter">REGRAS DO JOGO • REGRAS DO JOGO • REGRAS DO JOGO</div>
          <div className="container mx-auto px-6 relative z-10 flex flex-wrap justify-center gap-12 font-black italic uppercase text-lg">
                <div className="flex items-center gap-3"><CheckCircle2 size={24} /> Jogos até 06 games</div>
                <div className="flex items-center gap-3"><CheckCircle2 size={24} /> Sem vantagem (No Ad)</div>
                <div className="flex items-center gap-3"><CheckCircle2 size={24} /> Final até 09 games</div>
                <div className="flex items-center gap-3"><CheckCircle2 size={24} /> 4 Tubos de Bola Compadel</div>
          </div>
      </section>

      {/* Stats Section - Experience focus */}
      <section className="py-24 border-y border-white/5 relative overflow-hidden">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
            <div className="space-y-8 order-2 lg:order-1">
              <h2 className="text-5xl md:text-6xl font-black italic leading-none uppercase">Sinta a <span className="text-premium-accent">Energia</span> da Competição</h2>
              <p className="text-xl text-zinc-400">Não é apenas um torneio, é o ápice da sua jornada no padel. Estrutura de nível profissional para você focar apenas no seu melhor jogo.</p>
              
              <div className="space-y-6">
                <div className="flex gap-4 group">
                  <div className="mt-1 p-3 bg-premium-accent/10 rounded-xl group-hover:bg-premium-accent group-hover:text-black transition-all"><Smartphone size={24} /></div>
                  <div>
                    <h4 className="font-bold text-xl uppercase tracking-tighter">Experiência Digital Pro</h4>
                    <p className="text-zinc-500">Avisos via WhatsApp, placares em tempo real e estatísticas da sua categoria.</p>
                  </div>
                </div>
                <div className="flex gap-4 group">
                  <div className="mt-1 p-3 bg-premium-accent/10 rounded-xl group-hover:bg-premium-accent group-hover:text-black transition-all"><Users size={24} /></div>
                  <div>
                    <h4 className="font-bold text-xl uppercase tracking-tighter">Comunidade e Networking</h4>
                    <p className="text-zinc-500">Conecte-se com os melhores jogadores e entusiastas do esporte na região.</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="relative group order-1 lg:order-2">
               <div className="absolute -inset-4 bg-premium-accent/30 rounded-[40px] blur-3xl opacity-20 group-hover:opacity-40 transition duration-1000" />
               <div className="relative overflow-hidden rounded-[40px] border border-white/10 shadow-2xl skew-y-2 group-hover:skew-y-0 transition-transform duration-700">
                  <img src="/athlete_hero.webp" className="w-full h-[500px] object-cover scale-110 group-hover:scale-100 transition-transform duration-1000" alt="Athlete Action" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                  <div className="absolute bottom-8 left-8">
                     <span className="bg-premium-accent text-black px-4 py-1 rounded-full text-xs font-black uppercase tracking-widest">Live Performance</span>
                  </div>
               </div>
            </div>
          </div>
        </div>
      </section>

      {/* Registration Section */}
      <section id="register" className="py-32 relative">
        <div className="container mx-auto px-6 max-w-4xl">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-6xl font-black italic uppercase tracking-tighter">Inscrição <span className="text-premium-accent">Atleta</span></h2>
            <p className="text-zinc-500">Preencha seus dados para entrar na lista de sorteio do torneio.</p>
          </div>

          <form onSubmit={handleSubmit} className="premium-card !p-12 border-premium-accent/30 bg-black/40 backdrop-blur-3xl space-y-8 shadow-[0_0_50px_rgba(153,204,51,0.1)]">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Nome Completo</label>
                <input 
                  type="text" 
                  className="premium-input w-full bg-black/50 h-14 text-lg" 
                  placeholder="Seu nome"
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">WhatsApp</label>
                <input 
                  type="text" 
                  className="premium-input w-full bg-black/50 h-14 text-lg" 
                  placeholder="(00) 00000-0000"
                  value={formData.whatsapp}
                  onChange={e => setFormData({...formData, whatsapp: e.target.value})}
                  required
                />
              </div>
            </div>

            <div className="space-y-4">
              <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest block text-center">Lado de Preferência</label>
              <div className="flex flex-wrap justify-center gap-4">
                {['RIGHT', 'LEFT', 'EITHER'].map(side => (
                  <button
                    key={side}
                    type="button"
                    onClick={() => setFormData({...formData, side})}
                    className={`px-8 py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all ${
                      formData.side === side 
                      ? 'bg-premium-accent text-black shadow-[0_0_20px_rgba(153,204,51,0.4)]' 
                      : 'bg-white/5 text-zinc-500 hover:bg-white/10'
                    }`}
                  >
                    {side === 'RIGHT' ? 'Direita' : side === 'LEFT' ? 'Esquerda' : 'Indiferente'}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-8">
              <button 
                type="submit" 
                disabled={isSubmitting}
                className={`btn-primary w-full py-6 text-2xl flex items-center justify-center gap-4 ${isSubmitting ? 'opacity-50' : ''}`}
              >
                {isSubmitting ? 'Processando...' : 'Confirmar Inscrição'}
              </button>
              <p className="text-center text-zinc-600 text-xs mt-6 uppercase tracking-wider">
                Ao se inscrever você concorda com o regulamento do Diretoria Padel.
              </p>
            </div>
          </form>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-20 border-t border-white/5 text-center space-y-8">
        <img src="/logo.png" className="w-16 h-16 mx-auto opacity-50" alt="footer logo" />
        <div className="flex justify-center gap-8 text-zinc-600 font-bold uppercase tracking-widest text-xs">
          <a href="#" className="hover:text-premium-accent transition-colors">Termos</a>
          <a href="#" className="hover:text-premium-accent transition-colors">Privacidade</a>
          <a href="#" className="hover:text-premium-accent transition-colors">Regulamento</a>
          <a href="/login" className="text-premium-accent">Acesso Restrito</a>
        </div>
        <p className="text-zinc-700 text-[10px] font-black uppercase tracking-[0.3em]">Diretoria Padel © 2026 - Todos os Direitos Reservados</p>
      </footer>
    </div>
  );
};

export default LandingPage;
