import React, { useState, useEffect } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { fetchPlayers } from '../api';
import { CategoryFilter } from './CategoryFilter';
import { useCategory } from '../context/CategoryContext';
import {
  Users,
  Calendar,
  Monitor,
  LogOut,
  Menu,
  X,
  Search,
  Bell,
  ChevronRight,
  Settings,
  Trophy,
  Zap,
  UserCircle2
} from 'lucide-react';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const userRole = localStorage.getItem('userRole') || 'ATHLETE';
  const location = useLocation();
  const { selectedCategory, setSelectedCategory } = useCategory();

  const categories = [
    { id: 1, name: 'Masculino Iniciante / 6ª' },
    { id: 2, name: 'Masculino 4ª' },
    { id: 3, name: 'Feminino Iniciante' },
    { id: 4, name: 'Feminino 6ª' },
    { id: 5, name: 'Feminino 4ª' }
  ];

  const [playerCounts, setPlayerCounts] = useState<Record<number, number>>({});

  const allMenuItems = [
    { name: 'Painel', icon: <Monitor size={20} />, path: '/admin', roles: ['ADMIN', 'SUPPORT'] },
    { name: 'Atletas', icon: <Users size={20} />, path: '/admin/atletas', roles: ['ADMIN', 'SUPPORT'] },
    { name: 'Rodadas & Duplas', icon: <Calendar size={20} />, path: '/rodadas', roles: ['ADMIN', 'SUPPORT'] },
    { name: 'Jogos & Placar', icon: <Zap size={20} />, path: '/jogos', roles: ['ADMIN', 'SUPPORT'] },
    { name: 'Ranking', icon: <Trophy size={20} />, path: '/ranking', roles: ['ADMIN', 'SUPPORT', 'ATHLETE'] },
  ];

  const menuItems = allMenuItems.filter((item) =>
    item.roles.includes(userRole)
  );

  useEffect(() => {
    const loadPlayerCounts = async () => {
      try {
        const players = await fetchPlayers();
        const counts: Record<number, number> = {};
        categories.forEach(cat => {
          const catPlayers = players.filter((p: any) => p.category_id === cat.id);
          counts[cat.id] = catPlayers.length;
        });
        setPlayerCounts(counts);
      } catch (err) {
        console.error('Erro ao carregar contagem de atletas:', err);
      }
    };
    loadPlayerCounts();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('userRole');
    localStorage.removeItem('athleteSession');
    window.location.href = '/ranking-srb/login';
  };

  const currentPathName = allMenuItems.find(item => item.path === location.pathname)?.name || 'Início';

  return (
    <div className="flex h-screen bg-slate-950 overflow-hidden text-white font-sans font-medium">
      {/* Sidebar - Desktop */}
      <aside className="hidden lg:flex w-[300px] bg-black/40 border-r border-white/5 flex-col p-8 space-y-12 transition-all duration-500">
        <Link to="/" className="flex items-center gap-4 group">
          <div className="w-14 h-14 bg-green-400 rounded-2xl flex items-center justify-center text-black group-hover:scale-110 transition-transform shadow-[0_0_30px_rgba(74,222,128,0.2)]">
            <Trophy size={28} />
          </div>
          <div className="flex flex-col">
            <span className="font-black italic text-2xl tracking-tighter leading-none font-display text-white">RANKING PADEL <span className="text-green-400">SRB</span></span>
            <span className="text-[10px] font-black text-green-400/50 uppercase tracking-[0.4em] mt-2">Temporada 2026</span>
          </div>
        </Link>
        
        <nav className="flex-1 space-y-8 overflow-y-auto scrollbar-hide">
          <div>
            <p className="px-5 text-[10px] font-black text-zinc-700 uppercase tracking-[0.4em] mb-6">Menu de Gestão</p>
            {menuItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center justify-between px-5 py-4 rounded-2xl transition-all duration-300 group ${
                    isActive
                    ? 'bg-green-400 text-black font-black shadow-[0_15px_40px_rgba(74,222,128,0.15)] scale-[1.02]'
                    : 'text-zinc-500 hover:text-white hover:bg-white/[0.03]'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <div className="flex items-center space-x-4">
                      <span className={`${isActive ? 'text-black' : 'text-zinc-600 group-hover:text-green-400 transition-colors'}`}>
                        {item.icon}
                      </span>
                      <span className="text-sm tracking-tight uppercase font-bold">{item.name}</span>
                    </div>
                    {isActive && <div className="w-2 h-2 bg-black rounded-full shadow-inner animate-pulse" />}
                  </>
                )}
              </NavLink>
            ))}
          </div>

          {/* Categories Filter Component */}
          <div className="border-t border-white/5 pt-8">
            <CategoryFilter
              categories={categories}
              playerCounts={playerCounts}
              selectedCategory={selectedCategory}
              onSelectCategory={setSelectedCategory}
            />
          </div>
        </nav>

        <div className="pt-8 border-t border-white/5 space-y-6">
            <div className="bg-white/5 p-5 rounded-3xl border border-white/5 flex items-center gap-4 backdrop-blur-md">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-green-400 to-emerald-600 flex items-center justify-center text-black font-black text-sm shadow-inner transition-transform hover:rotate-6">
                    {userRole.charAt(0)}
                </div>
                <div className="flex-1 truncate">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white leading-none">{userRole}</p>
                    <p className="text-[9px] text-green-400/60 font-black uppercase tracking-widest mt-2 flex items-center gap-1">
                      <Zap size={10} /> Online
                    </p>
                </div>
                <button
                    onClick={handleLogout}
                    className="p-3 text-zinc-600 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-all"
                    title="Sair"
                >
                    <LogOut size={20} />
                </button>
            </div>
            <Link to="/atleta"
              className="flex items-center gap-3 px-4 py-3 bg-white/[0.03] hover:bg-white/[0.07] border border-white/5 hover:border-green-400/20 rounded-2xl transition-all group">
              <UserCircle2 size={16} className="text-zinc-600 group-hover:text-green-400 transition-colors shrink-0" />
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-600 group-hover:text-green-400 transition-colors">Ver como Atleta</span>
            </Link>
            <p className="text-center text-[8px] text-zinc-800 font-black uppercase tracking-[0.5em]">SRB PREMIUM v4.0</p>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Modern Header */}
        <header className="h-24 px-8 md:px-12 flex items-center justify-between bg-black/20 backdrop-blur-3xl border-b border-white/5">
            <div className="flex items-center gap-6">
                <button onClick={() => setMobileMenuOpen(true)} className="lg:hidden p-3 bg-white/5 rounded-2xl">
                    <Menu className="text-green-400" />
                </button>
                <div className="hidden sm:flex items-center gap-4 text-zinc-600 text-xs font-black uppercase tracking-[0.3em] font-display">
                    <Link to="/" className="hover:text-green-400 transition-colors">Sistema</Link>
                    <ChevronRight size={14} className="opacity-30" />
                    <span className="text-white brightness-125 tracking-wider">{currentPathName}</span>
                </div>
            </div>

            <div className="flex items-center gap-3 sm:gap-6">
                <div className="hidden md:flex relative group w-64 lg:w-96">
                    <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-premium-accent transition-colors" />
                    <input 
                        type="text" 
                        placeholder="Pesquisar atleta, jogo ou quadra..." 
                        className="w-full bg-white/[0.03] border border-white/[0.05] h-12 rounded-2xl pl-12 pr-4 text-sm focus:border-premium-accent/30 focus:bg-white/[0.05] transition-all outline-none"
                    />
                </div>
                <div className="flex items-center gap-2 sm:gap-3">
                    <button className="p-3 bg-white/5 rounded-2xl text-zinc-400 hover:text-white transition-all relative">
                        <Bell size={20} />
                        <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-premium-accent rounded-full border-2 border-black animate-pulse" />
                    </button>
                    <button className="p-3 bg-white/5 rounded-2xl text-zinc-400 hover:text-white transition-all">
                        <Settings size={20} />
                    </button>
                </div>
            </div>
        </header>

        {/* Content Viewport */}
        <main className="flex-1 overflow-y-auto scrollbar-hide bg-[radial-gradient(circle_at_0%_0%,_rgba(153,204,51,0.03)_0%,_transparent_50%)]">
            <div className="p-6 md:p-10 max-w-[1600px] mx-auto pb-32 lg:pb-10">
                {children}
            </div>
        </main>
      </div>

      {/* Bottom Nav - Mobile */}
      <div className="lg:hidden fixed bottom-6 left-6 right-6 h-20 glass-effect p-2 rounded-[28px] shadow-2xl border border-white/10 flex justify-around items-center z-50">
            {menuItems.slice(0, 4).map((item) => (
                <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => 
                    `relative flex flex-col items-center justify-center flex-1 h-full rounded-2xl transition-all duration-500 overflow-hidden ${
                    isActive ? 'text-black' : 'text-zinc-500'
                    }`
                }
                >
                {({ isActive }) => (
                    <>
                    {isActive && (
                        <div className="absolute inset-0 bg-premium-accent animate-in slide-in-from-bottom-full duration-500" />
                    )}
                    <div className="relative z-10 flex flex-col items-center gap-0.5">
                        <div className={`p-1.5 ${isActive ? 'scale-110 rotate-3 transition-transform duration-500' : ''}`}>
                            {React.cloneElement(item.icon as React.ReactElement<{ size: number }>, { size: 22 })}
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-tighter leading-none">{item.name.split(' ')[0]}</span>
                    </div>
                    </>
                )}
                </NavLink>
            ))}
      </div>

      {/* Fullscreen Mobile Menu Overlay */}
      {mobileMenuOpen && (
          <div className="fixed inset-0 bg-black/98 z-[100] animate-in fade-in duration-500 flex flex-col p-10 backdrop-blur-2xl">
              <div className="flex justify-between items-center mb-20">
                    <img src="logo.png" className="w-16 h-16 grayscale brightness-200" alt="logo" />
                    <button onClick={() => setMobileMenuOpen(false)} className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center text-premium-accent">
                        <X size={32} />
                    </button>
              </div>
              <nav className="space-y-4">
                <p className="text-[10px] font-black text-zinc-700 uppercase tracking-widest pl-2 mb-6">Menu de Navegação</p>
                {menuItems.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        onClick={() => setMobileMenuOpen(false)}
                        className={({ isActive }) => 
                            `flex items-center justify-between text-4xl font-black uppercase italic tracking-tighter py-2 border-b border-white/5 group ${
                                isActive ? 'text-premium-accent' : 'text-zinc-800'
                            }`
                        }
                    >
                        <span>{item.name}</span>
                        <ChevronRight className="group-hover:translate-x-2 transition-transform" />
                    </NavLink>
                ))}
              </nav>
              <div className="mt-auto pt-10 border-t border-white/5">
                    <button 
                        onClick={handleLogout}
                        className="flex items-center space-x-4 text-zinc-600 text-xl font-bold uppercase tracking-widest"
                    >
                        <LogOut size={24} />
                        <span>Encerrar Acesso</span>
                    </button>
                    <p className="mt-8 text-zinc-800 text-[10px] font-black italic tracking-widest">© 2026 RANKING PADEL SRB DEV TEAM</p>
              </div>
          </div>
      )}
    </div>
  );
};

export default Layout;
