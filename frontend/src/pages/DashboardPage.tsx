import { useState, useEffect } from 'react';
import { 
  Trophy, 
  Users, 
  Monitor, 
  Clock, 
  Calendar,
  Zap,
  CheckCircle2,
  AlertCircle,
  Play,
  ArrowRight,
  TrendingUp,
  Activity,
  RefreshCw
} from 'lucide-react';
import { fetchMatches, fetchCourts, fetchPlayers, updateMatchStatus } from '../api';

const DashboardPage = () => {
  const [stats, setStats] = useState({
    players: 0,
    paidPlayers: 0,
    matches: 0,
    finishedMatches: 0,
    activeMatches: 0,
    courtsOccupied: 0
  });
  const [loading, setLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState(2);
  const [isSimulating, setIsSimulating] = useState(false);

  const loadData = async () => {
    try {
      const players = await fetchPlayers();
      const matches = await fetchMatches(1);
      const courts = await fetchCourts();

      setStats({
        players: players.length,
        paidPlayers: players.filter((p) => p.payment_status === 'PAID').length,
        matches: matches.length,
        finishedMatches: matches.filter((m) => m.status === 'FINISHED').length,
        activeMatches: matches.filter((m) => m.status === 'LIVE' || m.status === 'CALLING').length,
        courtsOccupied: courts.filter((c) => c.status === 'BUSY').length
      });
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  const handleSimulate = async () => {
    setIsSimulating(true);
    try {
        const matches = await fetchMatches(1);
        const liveMatch = matches.find((m) => m.status === 'LIVE');
        const callingMatch = matches.find((m) => m.status === 'CALLING');
        const scheduledMatch = matches.find((m) => m.status === 'SCHEDULED');

        if (liveMatch) {
            await updateMatchStatus(liveMatch.id_match, 'FINISHED', 6, 2);
        }
        if (callingMatch) {
            await updateMatchStatus(callingMatch.id_match, 'LIVE');
        }
        if (scheduledMatch) {
            await updateMatchStatus(scheduledMatch.id_match, 'CALLING');
        }
        
        if (stats.finishedMatches > 4 && currentStep === 2) {
            setCurrentStep(3);
        }

        await loadData();
    } catch (err) {
        console.error(err);
    } finally {
        setTimeout(() => setIsSimulating(false), 800);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  const steps = [
    { label: 'Inscrições', status: currentStep > 0 ? 'COMPLETED' : 'ACTIVE', icon: <Users size={16} /> },
    { label: 'Sorteio & Chaves', status: currentStep > 1 ? 'COMPLETED' : currentStep === 1 ? 'ACTIVE' : 'PENDING', icon: <Zap size={16} /> },
    { label: 'Fase de Grupos', status: currentStep > 2 ? 'COMPLETED' : currentStep === 2 ? 'ACTIVE' : 'PENDING', icon: <Activity size={16} /> },
    { label: 'Mata-Mata', status: currentStep > 3 ? 'COMPLETED' : currentStep === 3 ? 'ACTIVE' : 'PENDING', icon: <Trophy size={16} /> },
    { label: 'Final & Premiação', status: currentStep > 4 ? 'COMPLETED' : currentStep === 4 ? 'ACTIVE' : 'PENDING', icon: <StarIcon size={16} /> }
  ];

  if (loading) return <div className="py-20 text-center text-zinc-500 font-black uppercase tracking-widest text-xs animate-pulse">Sincronizando Sistema Central...</div>;

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-1000">
      
      {/* Welcome Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-premium-accent/10 border border-premium-accent/20 rounded-full text-[10px] font-black text-premium-accent uppercase tracking-widest leading-none">
                <Monitor size={12} />
                Painel de Controle Central
            </div>
            <h2 className="text-5xl font-black italic uppercase tracking-tighter leading-none text-white">Dinâmica do <br/><span className="text-premium-accent">Torneio</span></h2>
        </div>
        <div className="flex flex-wrap items-center gap-3">
            <button 
                onClick={handleSimulate}
                disabled={isSimulating}
                className="bg-premium-accent/10 hover:bg-premium-accent/20 text-premium-accent border border-premium-accent/30 px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all inline-flex items-center gap-2"
            >
                {isSimulating ? <RefreshCw size={14} className="animate-spin" /> : <Zap size={14} fill="currentColor" />}
                {isSimulating ? 'Simulando...' : 'Avançar Dinâmica'}
            </button>
            <div className="flex bg-white/5 border border-white/10 p-2 rounded-2xl gap-2">
                <div className="px-4 py-2 text-right">
                    <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest leading-none">Status Geral</p>
                    <p className="text-sm font-black italic uppercase text-premium-accent">Em Andamento</p>
                </div>
                <div className="w-px bg-white/10" />
                <div className="px-4 py-2 text-left">
                    <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest leading-none">Tempo</p>
                    <p className="text-sm font-black italic uppercase text-white">04h 22m</p>
                </div>
            </div>
        </div>
      </div>

      {/* Tournament Lifecycle Stepper */}
      <div className="premium-card p-6 bg-white/[0.01]">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 relative">
              {/* Connector Line */}
              <div className="absolute top-1/2 left-0 w-full h-px bg-white/5 -translate-y-1/2 hidden md:block" />
              
              {steps.map((step, idx) => (
                  <div key={idx} className="relative z-10 flex flex-col items-center gap-3 bg-[#0c0c0c] md:px-6">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border-2 transition-all duration-500 ${
                          step.status === 'COMPLETED' ? 'bg-premium-accent border-premium-accent text-black shadow-[0_0_20px_rgba(153,204,51,0.3)]' :
                          step.status === 'ACTIVE' ? 'bg-white/5 border-premium-accent text-premium-accent animate-pulse' :
                          'bg-white/5 border-white/5 text-zinc-600'
                      }`}>
                          {step.status === 'COMPLETED' ? <CheckCircle2 size={24} /> : step.icon}
                      </div>
                      <div className="text-center">
                          <p className={`text-[10px] font-black uppercase tracking-widest ${
                              step.status === 'PENDING' ? 'text-zinc-700' : 'text-zinc-400'
                          }`}>{step.label}</p>
                          {step.status === 'ACTIVE' && <p className="text-[8px] font-bold text-premium-accent uppercase tracking-[0.2em] mt-1">Agora</p>}
                      </div>
                  </div>
              ))}
          </div>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          <StatCard 
            title="Atletas Inscritos" 
            value={stats.players} 
            subValue={`${stats.paidPlayers} confirmados`}
            icon={<Users className="text-blue-500" />}
            trend="+12% vs meta"
          />
          <StatCard 
            title="Progresso Jogos" 
            value={`${stats.finishedMatches}/${stats.matches}`} 
            subValue={`${Math.round((stats.finishedMatches/stats.matches)*100 || 0)}% concluído`}
            icon={<Zap className="text-amber-500" />}
            progress={(stats.finishedMatches/stats.matches)*100}
          />
          <StatCard 
            title="Quadras Ativas" 
            value={`${stats.activeMatches}/4`} 
            subValue="Alta ocupação"
            icon={<Monitor className="text-premium-accent" />}
            isLive
          />
          <StatCard 
            title="Próxima Rodada" 
            value="14:30" 
            subValue="Início das Semifinais"
            icon={<Clock className="text-zinc-500" />}
            trend="Atraso: 0m"
          />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-10">
          
          {/* Cronograma / Timeline View */}
          <div className="xl:col-span-2 space-y-6">
              <div className="flex items-center justify-between">
                  <h3 className="text-xl font-black italic uppercase tracking-tighter flex items-center gap-3 text-white">
                    <Calendar size={20} className="text-premium-accent" />
                    Cronograma de Hoje
                  </h3>
                  <button className="text-[10px] font-black uppercase tracking-widest text-premium-accent hover:brightness-125 transition-all">Ver Completo</button>
              </div>
              
              <div className="space-y-4">
                  <TimelineItem 
                    time="08:00" 
                    title="Acreditação & Café" 
                    desc="Recepção dos atletas e entrega dos kits"
                    status="FINISHED"
                  />
                  <TimelineItem 
                    time="09:00" 
                    title="Início Fase de Grupos" 
                    desc="Chaves A, B, C e D em quadra"
                    status="FINISHED"
                  />
                  <TimelineItem 
                    time="11:30" 
                    title="Rodada Final Grupos" 
                    desc="Definição dos classificados para o Mata-Mata"
                    status="LIVE"
                  />
                  <TimelineItem 
                    time="13:00" 
                    title="Carreteiro do Marcola" 
                    desc="Intervalo oficial para o almoço no deck"
                    status="PENDING"
                  />
                  <TimelineItem 
                    time="14:30" 
                    title="Quartas de Final" 
                    desc="Início dos jogos eliminatórios (Mata-Mata)"
                    status="PENDING"
                  />
                  <TimelineItem 
                    time="17:00" 
                    title="Grande Final" 
                    desc="Decisão do título e premiação oficial"
                    status="PENDING"
                    isPremium
                  />
              </div>
          </div>

          {/* Dinâmica / Live Status Side */}
          <div className="space-y-6">
              <div className="flex items-center justify-between">
                  <h3 className="text-xl font-black italic uppercase tracking-tighter flex items-center gap-3 text-white">
                    <TrendingUp size={20} className="text-premium-accent" />
                    Dinâmica Live
                  </h3>
              </div>

              <div className="premium-card bg-white/[0.02] border-white/5 p-8 space-y-8">
                  <div className="space-y-2">
                       <p className="text-[10px] font-black uppercase text-zinc-600 tracking-widest pl-1">Match Factor</p>
                       <div className="flex items-end gap-3">
                           <span className="text-4xl font-black italic text-white leading-none">35.2</span>
                           <span className="text-xs font-bold text-premium-accent uppercase pb-1">min / jogo</span>
                       </div>
                       <p className="text-[10px] text-zinc-500 font-medium">Cronograma dentro do esperado.</p>
                  </div>

                  <div className="space-y-4 pt-4 border-t border-white/5">
                      <p className="text-[10px] font-black uppercase text-zinc-600 tracking-widest pl-1">Próximos a Chamar</p>
                      {[
                        { pair: 'Rodrigo / João', cat: 'Open' },
                        { pair: 'Bruno / Caio', cat: 'Open' }
                      ].map((item, i) => (
                        <div key={i} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5 group hover:border-premium-accent/30 transition-all">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-zinc-500">
                                    <Clock size={14} />
                                </div>
                                <div>
                                    <p className="text-xs font-black uppercase text-white truncate w-32">{item.pair}</p>
                                    <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest">{item.cat}</p>
                                </div>
                            </div>
                            <button className="p-2 text-zinc-700 hover:text-premium-accent transition-colors">
                                <ArrowRight size={16} />
                            </button>
                        </div>
                      ))}
                  </div>

                  <button className="btn-primary w-full py-4 text-xs flex items-center justify-center gap-3">
                      <Zap size={14} fill="currentColor" />
                      Sugestão: Rodar Rodada 3
                  </button>
              </div>

              {/* Quick Alert Box */}
              <div className="bg-amber-500/10 border border-amber-500/20 p-6 rounded-3xl flex gap-4">
                  <AlertCircle className="text-amber-500 shrink-0" size={20} />
                  <div>
                      <p className="text-xs font-black text-amber-500 uppercase tracking-widest mb-1">Ação Sugerida</p>
                      <p className="text-[11px] text-amber-500/70 font-bold leading-tight uppercase">3 duplas aguardam quadra há mais de 15 minutos. Considere liberar quadra 4.</p>
                  </div>
              </div>
          </div>

      </div>

    </div>
  );
};

// Sub-components

interface StatCardProps {
  title: string;
  value: string | number;
  subValue: string;
  icon: React.ReactNode;
  isLive?: boolean;
  progress?: number;
  trend?: string;
}

const StatCard = ({ title, value, subValue, icon, isLive, progress, trend }: StatCardProps) => (
    <div className="premium-card bg-white/[0.01] border-white/5 p-6 space-y-4 hover:border-premium-accent/30 transition-all group overflow-hidden relative">
        <div className="flex justify-between items-start">
            <div className="p-3 bg-white/5 rounded-2xl group-hover:scale-110 transition-transform duration-500">
                {icon}
            </div>
            {isLive ? (
                <span className="flex items-center gap-1.5 px-2 py-0.5 bg-red-500/10 text-red-500 border border-red-500/20 rounded-full text-[8px] font-black uppercase tracking-widest">
                    <div className="w-1 h-1 bg-red-500 rounded-full animate-pulse" />
                    Live
                </span>
            ) : trend ? (
                <span className="text-[8px] font-black uppercase tracking-widest text-zinc-600">{trend}</span>
            ) : null}
        </div>
        <div>
            <h4 className="text-[9px] font-black uppercase text-zinc-700 tracking-widest mb-1">{title}</h4>
            <p className="text-4xl font-black italic text-white uppercase tracking-tighter leading-none">{value}</p>
            <p className="text-[10px] font-bold text-zinc-500 mt-2 uppercase tracking-tight">{subValue}</p>
        </div>
        {progress !== undefined && (
            <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden mt-2">
                <div className="h-full bg-premium-accent shadow-[0_0_10px_rgba(153,204,51,0.5)]" style={{ width: `${progress}%` }} />
            </div>
        )}
    </div>
);

interface TimelineItemProps {
  time: string;
  title: string;
  desc: string;
  status: 'FINISHED' | 'LIVE' | 'PENDING';
  isPremium?: boolean;
}

const TimelineItem = ({ time, title, desc, status, isPremium }: TimelineItemProps) => (
    <div className={`flex gap-6 group ${status === 'FINISHED' ? 'opacity-40 hover:opacity-100 transition-opacity' : ''}`}>
        <div className="w-20 pt-1">
            <p className={`text-sm font-black italic text-right ${status === 'LIVE' ? 'text-premium-accent' : 'text-zinc-500'}`}>{time}</p>
        </div>
        <div className="relative flex flex-col items-center pt-2">
            <div className={`w-3 h-3 rounded-full z-10 border-2 ${
                status === 'FINISHED' ? 'bg-zinc-800 border-zinc-700' :
                status === 'LIVE' ? 'bg-premium-accent border-premium-accent animate-ping absolute' :
                'bg-zinc-900 border-zinc-800'
            }`} />
            {status === 'LIVE' && <div className="w-3 h-3 rounded-full bg-premium-accent border-2 border-premium-accent z-10" />}
            <div className="w-px h-full bg-white/5 absolute top-5" />
        </div>
        <div className={`flex-1 p-6 rounded-3xl border transition-all duration-500 mb-4 ${
            status === 'LIVE' ? 'bg-premium-accent/5 border-premium-accent/30 shadow-[0_0_40px_rgba(153,204,51,0.05)]' :
            isPremium ? 'border-premium-accent/20 bg-gradient-to-r from-premium-accent/5 to-transparent' :
            'bg-white/[0.01] border-white/5'
        }`}>
            <div className="flex justify-between items-start">
                <h4 className={`text-lg font-black italic uppercase tracking-tighter leading-none ${status === 'LIVE' ? 'text-premium-accent' : 'text-white'}`}>{title}</h4>
                {status === 'LIVE' && (
                    <span className="flex items-center gap-1 text-[8px] font-black uppercase text-premium-accent tracking-widest border border-premium-accent/30 px-2 py-1 rounded-lg">
                        <Play size={8} fill="currentColor" /> Agora
                    </span>
                )}
            </div>
            <p className="text-[11px] text-zinc-500 font-bold uppercase tracking-wide mt-2">{desc}</p>
        </div>
    </div>
);

const StarIcon = ({ size }: { size: number }) => (
    <div className="w-4 h-4 text-currentColor flex items-center justify-center">
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
    </div>
);

export default DashboardPage;
