import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Trophy, TrendingUp, CheckCircle2, ArrowRight, Zap, Flame, Award, Calendar, Clock, AlertTriangle } from 'lucide-react';
import { fetchCategories, type Category } from '../api';
import { TOURNAMENT_ID } from '../config';
import { RegistrationForm } from '../components/RegistrationForm';

export function LandingPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const data = await fetchCategories(TOURNAMENT_ID);
        setCategories(data);
        if (data.length > 0) setSelectedCategory(data[0].id);
      } catch (err) {
        console.error('Failed to load categories:', err);
      } finally {
        setLoading(false);
      }
    };

    loadCategories();
  }, []);

  const activeCategory = categories.find(c => c.id === selectedCategory);

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen text-slate-800">Carregando...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white leading-relaxed">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Russo+One&family=Chakra+Petch:wght@300;400;600;700&display=swap');

        .font-display { font-family: 'Russo One', sans-serif; }
        .font-body { font-family: 'Chakra Petch', sans-serif; }

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse-ring {
          0%, 100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.3); }
          50% { box-shadow: 0 0 0 10px rgba(59, 130, 246, 0); }
        }
        .animate-slideUp { animation: slideUp 0.6s ease-out forwards; }
        .animate-pulse-ring { animation: pulse-ring 2s infinite; }

        h1, h2, h3, h4, h5, h6 { font-family: 'Russo One', sans-serif; }
        body { font-family: 'Chakra Petch', sans-serif; }
      `}</style>

      {/* HEADER */}
      <header className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-md border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-green-400 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(74,222,128,0.3)]">
              <Trophy className="w-7 h-7 text-black" />
            </div>
            <div>
              <div className="text-sm font-black text-white font-display tracking-tight">RANKING PADEL</div>
              <div className="text-[10px] text-green-400 font-body font-black uppercase tracking-widest">Rio Branco 2026</div>
            </div>
          </div>
          <nav className="hidden md:flex items-center gap-10 text-[10px] font-black uppercase tracking-widest">
            <Link to="/ranking" className="text-white/60 hover:text-green-400 transition-colors">Ranking</Link>
            <a href="#categorias" className="text-white/60 hover:text-green-400 transition-colors">Categorias</a>
            <a href="#inscrever" className="text-white/60 hover:text-green-400 transition-colors">Inscrever</a>
          </nav>
        </div>
      </header>

      {/* HERO */}
      <section className="relative min-h-screen overflow-hidden">
        {/* Background Image */}
        <div className="absolute inset-0">
          <img
            src={`${import.meta.env.BASE_URL}padel_action_hero_premium_1775612634488.png`}
            alt="Padel em Ação"
            className="w-full h-full object-cover object-center"
          />
          {/* Gradual Overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/80 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent" />
        </div>

        {/* Content */}
        <div className="relative z-10 max-w-7xl mx-auto h-full px-6 flex items-center">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center py-32">
            {/* Left Content */}
            <div className="space-y-10 max-w-2xl">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/20 border border-blue-400 rounded-full backdrop-blur-sm">
                <Zap className="w-4 h-4 text-blue-300" />
                <span className="text-xs font-bold text-blue-300 uppercase tracking-wider font-body">Começou 16 de Abril</span>
              </div>

              {/* Headline */}
              <div className="space-y-6">
                <h1 className="text-5xl sm:text-7xl md:text-8xl lg:text-[10rem] font-display font-black leading-[0.85] text-white tracking-tighter uppercase">
                  RANKING<br/>
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-600">PADEL</span><br/>
                  <div className="flex items-center gap-3">
                    <span className="text-3xl sm:text-5xl md:text-7xl lg:text-8xl text-green-400">SRB</span>
                    <span className="text-3xl sm:text-5xl md:text-7xl lg:text-8xl text-green-400 opacity-50">2026</span>
                  </div>
                </h1>
                <p className="text-base sm:text-xl text-white/60 leading-relaxed max-w-lg font-body font-medium italic border-l-2 border-green-400 pl-4 sm:pl-6">
                  O torneio de elite da Sociedade Rio Branco. Performance, estratégia e tradição em cada partida.
                </p>
              </div>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-6 pt-10">
                <a
                  href="#inscrever"
                  className="group px-10 py-5 font-display font-black uppercase tracking-wider text-black bg-green-400 hover:bg-green-300 rounded-lg shadow-[0_20px_40px_rgba(74,222,128,0.2)] transition-all duration-300 inline-flex items-center justify-center gap-3 text-center cursor-pointer transform hover:-translate-y-1"
                >
                  INSCREVA-SE <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
                </a>
                <Link
                  to="/ranking"
                  className="px-10 py-5 font-display font-black uppercase tracking-wider text-white border-2 border-white/20 rounded-lg hover:bg-white/5 transition-all duration-300 inline-flex items-center justify-center gap-3 text-center backdrop-blur-sm transform hover:-translate-y-1"
                >
                  VER RANKING <TrendingUp className="w-6 h-6" />
                </Link>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-6 pt-8 border-t border-white/20">
                {[
                  { label: 'Categorias', value: '3' },
                  { label: 'Atletas', value: '60' },
                  { label: 'Quintas', value: '52' }
                ].map((stat, i) => (
                  <div key={i}>
                    <div className="text-4xl font-display font-black bg-gradient-to-r from-blue-300 to-orange-400 bg-clip-text text-transparent">{stat.value}</div>
                    <p className="text-xs font-bold text-blue-200 uppercase mt-2 font-body">{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Visual - Feature Cards */}
            <div className="relative hidden lg:flex h-screen items-center justify-end pr-12">
              <div className="space-y-4 w-full max-w-sm">
                {/* Card 1 */}
                <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 p-8 shadow-lg hover:shadow-xl transition-all duration-300 hover:border-blue-400 hover:bg-white/15 transform hover:scale-105">
                  <div className="inline-flex w-12 h-12 bg-blue-500/30 rounded-lg items-center justify-center mb-4">
                    <Flame className="w-6 h-6 text-blue-300" />
                  </div>
                  <h3 className="text-xl font-display font-bold text-white mb-2">RANKING VIVO</h3>
                  <p className="text-sm text-blue-100 font-body">Atualizado a cada partida</p>
                </div>

                {/* Card 2 */}
                <div className="ml-6 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 p-8 shadow-lg hover:shadow-xl transition-all duration-300 hover:border-orange-400 hover:bg-white/15 transform hover:scale-105">
                  <div className="inline-flex w-12 h-12 bg-orange-500/30 rounded-lg items-center justify-center mb-4">
                    <Calendar className="w-6 h-6 text-orange-300" />
                  </div>
                  <h3 className="text-xl font-display font-bold text-white mb-2">QUINTAS</h3>
                  <p className="text-sm text-blue-100 font-body">18h às 23h na quadra</p>
                </div>

                {/* Card 3 */}
                <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 p-8 shadow-lg hover:shadow-xl transition-all duration-300 hover:border-blue-400 hover:bg-white/15 transform hover:scale-105">
                  <div className="inline-flex w-12 h-12 bg-blue-500/30 rounded-lg items-center justify-center mb-4">
                    <Award className="w-6 h-6 text-blue-300" />
                  </div>
                  <h3 className="text-xl font-display font-bold text-white mb-2">SEM REPETIÇÃO</h3>
                  <p className="text-sm text-blue-100 font-body">Parceiros diferentes</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SCORING SYSTEM (EDITORIAL DARK REDESIGN) */}
      <section className="py-24 px-6 bg-slate-900 overflow-hidden relative">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,_rgba(74,222,128,0.05)_0%,_transparent_50%)]" />
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="mb-20 text-center">
            <span className="text-green-400 text-sm font-black uppercase tracking-[0.3em] block mb-4">Regulamento de Pontos</span>
            <h2 className="text-6xl md:text-8xl font-black text-white leading-none tracking-tighter uppercase mb-6">
              Pontuação
            </h2>
            <div className="w-24 h-1 bg-green-400 mx-auto" />
          </div>
 
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            {[
              {
                points: '+3',
                title: 'VITÓRIA',
                label: 'Performance Máxima',
                icon: Trophy,
                desc: 'A recompensa pelo domínio em quadra e entrosamento da dupla.'
              },
              {
                points: '+1',
                title: 'DERROTA',
                label: 'Presença e Luta',
                icon: Flame,
                desc: 'Todo esforço conta. Um ponto pela participação e resiliência.'
              },
              {
                points: '0',
                title: 'WO',
                label: 'Penalidade',
                icon: Zap,
                desc: 'Ausência ou desistência sem justificativa prévia.'
              }
            ].map((item, i) => {
              const Icon = item.icon;
              return (
                <div key={i} className="group p-6 sm:p-10 bg-white/5 border border-white/10 hover:border-green-400 transition-all duration-500 relative">
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-30 transition-opacity">
                    <Icon className="w-16 h-16 text-green-400" />
                  </div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-green-400/60 mb-4">{item.label}</div>
                  <div className="text-8xl font-black text-white leading-none tracking-tighter mb-6">{item.points}</div>
                  <h3 className="text-2xl font-black text-white uppercase tracking-tighter mb-4">{item.title}</h3>
                  <p className="text-white/40 text-sm font-bold uppercase tracking-widest leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CHAMPIONSHIP CALENDAR + SCHEDULE + ABSENCE RULES */}
      <section className="py-24 px-6 bg-slate-950 border-t border-white/5 overflow-hidden relative">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,_rgba(59,130,246,0.04)_0%,_transparent_50%)]" />
        <div className="max-w-7xl mx-auto relative z-10 space-y-24">

          {/* Championship Dates */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-6">
              <span className="text-blue-400 text-sm font-black uppercase tracking-[0.3em]">Calendário Oficial</span>
              <h2 className="text-5xl md:text-7xl font-black text-white leading-none tracking-tighter uppercase">
                Temporada<br/>2026
              </h2>
              <p className="text-white/40 text-sm font-bold uppercase tracking-widest leading-relaxed max-w-sm">
                27 quintas-feiras consecutivas de competição. Todos os atletas jogam entre si.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-6">
              <div className="p-8 bg-white/5 border border-white/10 hover:border-blue-400 transition-colors group">
                <Calendar className="w-8 h-8 text-blue-400 mb-4 group-hover:scale-110 transition-transform" />
                <div className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">Início</div>
                <div className="text-2xl font-black text-white">16 ABR</div>
                <div className="text-sm font-black text-blue-400">2026</div>
              </div>
              <div className="p-8 bg-white/5 border border-white/10 hover:border-green-400 transition-colors group">
                <Trophy className="w-8 h-8 text-green-400 mb-4 group-hover:scale-110 transition-transform" />
                <div className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">Final</div>
                <div className="text-2xl font-black text-white">16 OUT</div>
                <div className="text-sm font-black text-green-400">2026</div>
              </div>
              <div className="col-span-2 p-8 bg-green-400/10 border border-green-400/30">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-green-400/60 mb-1">Duração Total</div>
                    <div className="text-3xl font-black text-white">27 Semanas</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-black uppercase tracking-widest text-green-400/60 mb-1">Partidas Totais</div>
                    <div className="text-3xl font-black text-green-400">296</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Schedule per Category */}
          <div>
            <div className="mb-12">
              <span className="text-orange-400 text-sm font-black uppercase tracking-[0.3em] block mb-4">Programação Semanal</span>
              <h2 className="text-5xl md:text-7xl font-black text-white leading-none tracking-tighter uppercase">
                Jogos por<br/>Semana
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                {
                  category: 'Masculino Iniciante',
                  games: '7',
                  label: 'jogos/semana',
                  type: 'Fixo',
                  total: '189 partidas',
                  color: 'blue',
                  detail: 'Todos os 10 jogadores entram toda quinta'
                },
                {
                  category: 'Masculino 4ª',
                  games: '3–2',
                  label: 'alternado/semana',
                  type: 'Rodízio',
                  total: '68 partidas',
                  color: 'orange',
                  detail: 'Semanas ímpares: 3 jogos · Semanas pares: 2 jogos'
                },
                {
                  category: 'Feminino Iniciante',
                  games: '2–1',
                  label: 'por semana',
                  type: 'Rodízio',
                  total: '39 partidas',
                  color: 'green',
                  detail: 'Semanas 1–12: 2 jogos · Semanas 13+: 1 jogo'
                }
              ].map((item, i) => (
                <div key={i} className={`p-8 bg-white/5 border border-white/10 hover:border-${item.color}-400 transition-all duration-300 group relative overflow-hidden`}>
                  <div className={`absolute top-0 left-0 w-1 h-full bg-${item.color}-400`} />
                  <div className={`text-[10px] font-black uppercase tracking-widest text-${item.color}-400/60 mb-3`}>{item.type}</div>
                  <div className={`text-6xl font-black text-${item.color}-400 leading-none mb-2`}>{item.games}</div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-4">{item.label}</div>
                  <h3 className="text-xl font-black text-white uppercase tracking-tighter mb-3">{item.category}</h3>
                  <p className="text-xs font-bold text-white/30 uppercase tracking-widest leading-relaxed mb-4">{item.detail}</p>
                  <div className={`inline-block px-3 py-1 bg-${item.color}-400/10 border border-${item.color}-400/30 text-[10px] font-black uppercase tracking-widest text-${item.color}-300`}>
                    {item.total}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Absence Rules */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
            <div className="space-y-6">
              <span className="text-red-400 text-sm font-black uppercase tracking-[0.3em]">Regulamento de Ausência</span>
              <h2 className="text-5xl md:text-7xl font-black text-white leading-none tracking-tighter uppercase">
                Regra da<br/>Ausência
              </h2>
              <p className="text-white/40 text-sm font-bold uppercase tracking-widest leading-relaxed max-w-sm border-l-2 border-red-400 pl-6">
                Respeite seus parceiros. O sorteio depende de você.
              </p>
            </div>
            <div className="space-y-4">
              {[
                {
                  icon: Clock,
                  color: 'blue',
                  title: 'Prazo: Segunda-feira 18h',
                  desc: 'Declare sua ausência até segunda-feira às 18h da semana do jogo. Após esse horário, você entra automaticamente no sorteio.'
                },
                {
                  icon: CheckCircle2,
                  color: 'green',
                  title: 'Silêncio = Presença',
                  desc: 'Se não declarar ausência até o prazo, você será incluído no sorteio e deverá comparecer. Ausência implícita = confirmado.'
                },
                {
                  icon: AlertTriangle,
                  color: 'red',
                  title: 'Não apareceu = WO',
                  desc: 'Ausência sem aviso prévio resulta em WO: 0 pontos para você e 3 pontos para o adversário. Seus parceiros também ficam sem jogar.'
                }
              ].map((item, i) => {
                const Icon = item.icon;
                return (
                  <div key={i} className={`p-6 bg-white/5 border border-white/10 hover:border-${item.color}-400 transition-all duration-300 flex gap-5`}>
                    <div className={`flex-shrink-0 w-10 h-10 bg-${item.color}-400/20 flex items-center justify-center`}>
                      <Icon className={`w-5 h-5 text-${item.color}-400`} />
                    </div>
                    <div>
                      <div className={`text-[10px] font-black uppercase tracking-widest text-${item.color}-400 mb-2`}>{item.title}</div>
                      <p className="text-xs font-bold text-white/40 uppercase tracking-widest leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                );
              })}
              <div className="p-6 bg-blue-500/10 border border-blue-400/30 text-center">
                <p className="text-xs font-black uppercase tracking-widest text-blue-300 leading-relaxed">
                  Declare sua ausência em{' '}
                  <a href="/ranking-srb/semana" className="text-blue-400 underline hover:text-blue-300">obralivre.com.br/ranking-srb/semana</a>
                </p>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ========== CATEGORIES SECTION (EDITORIAL REDESIGN) ========== */}
      <section id="categorias" className="py-24 px-6 bg-slate-950 border-t border-white/5 relative overflow-hidden">
        {/* Background Typography Decoration */}
        <div className="absolute top-0 right-0 text-[15rem] md:text-[25rem] font-black text-white/[0.02] select-none leading-none -translate-y-1/2 translate-x-1/4 pointer-events-none">
          REG
        </div>

        <div className="max-w-7xl mx-auto relative z-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-20 gap-8">
            <div className="space-y-4">
              <span className="text-green-400 text-sm font-black uppercase tracking-[0.3em]">Divisões Oficiais</span>
              <h2 className="text-6xl md:text-8xl font-black text-white leading-none tracking-tighter uppercase">
                Categorias
              </h2>
            </div>
            <p className="text-slate-400 max-w-full text-sm sm:text-lg font-medium leading-relaxed italic border-l-2 border-green-400 pl-4 sm:pl-6">
              Escolha sua categoria e garanta sua vaga no torneio mais prestigiado da temporada.
            </p>
          </div>

          {/* New Editorial Category Selector */}
          <div className="flex flex-wrap gap-4 mb-20">
            {categories.map((cat, index) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`group relative py-4 px-6 sm:py-6 sm:px-10 transition-all duration-500 overflow-hidden ${
                  selectedCategory === cat.id
                    ? 'bg-green-400 text-black scale-105 shadow-[0_20px_50px_rgba(74,222,128,0.2)]'
                    : 'bg-white/5 text-white/40 hover:text-white hover:bg-white/10'
                }`}
              >
                <span className="absolute top-2 left-3 text-[10px] font-black opacity-30">0{index + 1}</span>
                <span className="text-xl font-black uppercase tracking-wider">{cat.name}</span>
                {selectedCategory === cat.id && (
                  <div className="absolute bottom-0 left-0 h-1 w-full bg-black/20" />
                )}
              </button>
            ))}
          </div>

          {/* Category Details & Entry Form */}
          {activeCategory && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
              {/* Info Block */}
              <div className="lg:col-span-5 space-y-8">
                <div className="p-6 sm:p-10 bg-white/5 backdrop-blur-xl border border-white/10 relative group">
                  <div className="absolute -top-4 -right-4 w-12 h-12 bg-green-400 flex items-center justify-center rotate-12 group-hover:rotate-0 transition-transform duration-500">
                    <Trophy className="w-6 h-6 text-black" />
                  </div>

                  <span className="text-[10px] font-black uppercase tracking-widest text-green-400/60 block mb-2">Detalhes da Categoria</span>
                  <h3 className="text-4xl font-black text-white uppercase mb-8 tracking-tighter">{activeCategory.name}</h3>

                  <div className="space-y-6">
                    <div className="flex justify-between items-center py-4 border-b border-white/10">
                      <span className="text-[10px] font-black uppercase text-white/40 tracking-widest">Temporada</span>
                      <span className="text-xl font-black text-white">2026</span>
                    </div>
                    <div className="flex justify-between items-center py-4 border-b border-white/10">
                      <span className="text-[10px] font-black uppercase text-white/40 tracking-widest">Status</span>
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                        <span className="text-xl font-black text-green-400 uppercase">ABERTO</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-6 sm:p-10 border border-white/10 bg-gradient-to-br from-green-400/10 to-transparent">
                  <h4 className="text-lg font-black text-white uppercase mb-6 flex items-center gap-4">
                    <CheckCircle2 className="w-6 h-6 text-green-400" />
                    Requisitos
                  </h4>
                  <ul className="space-y-4">
                    {[
                      'Inscrição oficial na categoria selecionada',
                      'Sorteio de parceiros (fair play garantido)',
                      'Horários fixos todas as quintas-feiras',
                      'Ranking ao vivo atualizado em tempo real'
                    ].map((item, i) => (
                      <li key={i} className="flex items-center gap-4 text-[13px] text-white/60 font-black uppercase tracking-widest">
                        <div className="w-1.5 h-1.5 bg-green-400" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Registration Form Block */}
              <div id="inscrever" className="lg:col-span-7 p-6 sm:p-12 bg-white/5 border border-white/10 relative">
                {/* Decorative Accent */}
                <div className="absolute top-0 left-0 w-2 h-full bg-green-400" />

                <h3 className="text-4xl font-black uppercase tracking-tighter mb-4 text-white">
                  Ficha de Inscrição
                </h3>
                <p className="text-white/40 mb-10 font-bold max-w-md uppercase text-xs tracking-widest">
                  Categoria <span className="text-green-400 font-black">{activeCategory.name}</span>. Inscrições abertas.
                </p>

                <RegistrationForm
                  categoryId={activeCategory.id}
                  onSuccess={() => {
                    window.location.href = '/ranking-srb/obrigado.html';
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-white/5 bg-slate-950 py-24 px-6 relative overflow-hidden">
        <div className="absolute bottom-0 right-0 text-[10rem] font-black text-white/[0.02] select-none leading-none pointer-events-none translate-y-1/4 translate-x-1/4">
          SRB
        </div>
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-16 mb-20">
            <div className="space-y-6">
              <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-green-400">Rio Branco</h4>
              <p className="text-sm text-white/40 font-black uppercase tracking-widest leading-loose">
                Ranking Padel SRB 2026<br/>A vanguarda do padel gaúcho.
              </p>
            </div>
            <div className="space-y-6">
              <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-green-400">Navegação</h4>
              <ul className="space-y-4">
                {['Ranking', 'Categorias', 'Admin'].map(link => (
                  <li key={link}>
                    <a href={`/${link.toLowerCase()}`} className="text-xs font-black uppercase tracking-widest text-white/60 hover:text-green-400 transition-colors">
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <div className="space-y-6">
              <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-green-400">Sessões</h4>
              <p className="text-xs font-black uppercase tracking-widest text-white/60 leading-loose">
                Toda Quinta-feira<br/>Das 18h00 às 23h00
              </p>
            </div>
            <div className="space-y-6">
              <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-green-400">Contato</h4>
              <p className="text-xs font-black uppercase tracking-widest text-white/60 leading-loose">
                contato@riobrancopadel.com.br
              </p>
            </div>
          </div>

          <div className="pt-10 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="text-[10px] font-black uppercase tracking-[0.5em] text-white/20">
              © 2026 RANKING PADEL SRB • SOCIEDADE RIO BRANCO
            </div>
            <div className="flex gap-8">
              <span className="text-[8px] font-black text-white/10 uppercase tracking-widest">Built with precision</span>
              <span className="text-[8px] font-black text-white/10 uppercase tracking-widest">Premium Editorial v4.0</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default LandingPage;
