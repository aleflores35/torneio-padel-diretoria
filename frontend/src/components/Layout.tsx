import React, { useState } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { 
  Users, 
  LayoutGrid, 
  Calendar, 
  Monitor, 
  Globe, 
  LogOut, 
  Menu, 
  X, 
  Search, 
  Bell, 
  ChevronRight,
  Settings
} from 'lucide-react';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const userRole = localStorage.getItem('userRole') || 'ATHLETE';
  const location = useLocation();

  const allMenuItems = [
    { name: 'Dashboard', icon: <Monitor size={20} />, path: '/admin', roles: ['ADMIN', 'SUPPORT'] },
    { name: 'Gestão de Atletas', icon: <Users size={20} />, path: '/admin/atletas', roles: ['ADMIN', 'SUPPORT'] },
    { name: 'Lista de Duplas', icon: <Users size={20} />, path: '/duplas', roles: ['ADMIN', 'SUPPORT'] },
    { name: 'Duplas & Chaves', icon: <LayoutGrid size={20} />, path: '/chaves', roles: ['ADMIN', 'SUPPORT'] },
    { name: 'Cronograma', icon: <Calendar size={20} />, path: '/jogos', roles: ['ADMIN', 'SUPPORT'] },
    { name: 'Quadras Live', icon: <Monitor size={20} />, path: '/quadras', roles: ['ADMIN', 'SUPPORT'] },
    { name: 'Quadro Geral', icon: <Globe size={20} />, path: '/publico', roles: ['ADMIN', 'SUPPORT', 'ATHLETE'] },
  ];

  const menuItems = allMenuItems.filter((item) => 
    item.roles.includes(userRole)
  );

  const handleLogout = () => {
    localStorage.removeItem('userRole');
    window.location.href = '/login';
  };

  const currentPathName = allMenuItems.find(item => item.path === location.pathname)?.name || 'Início';

  return (
    <div className="flex h-screen bg-[#060606] overflow-hidden text-white font-sans font-medium">
      {/* Sidebar - Desktop */}
      <aside className="hidden lg:flex w-[280px] bg-black/40 border-r border-white/5 flex-col p-6 space-y-10">
        <Link to="/" className="flex items-center gap-3 group">
          <div className="w-12 h-12 bg-premium-accent/10 rounded-2xl flex items-center justify-center text-premium-accent group-hover:scale-110 transition-transform shadow-[0_0_20px_rgba(153,204,51,0.1)]">
            <LayoutGrid size={24} />
          </div>
          <div className="flex flex-col">
            <span className="font-black italic text-xl tracking-tighter leading-none">DIRETORIA <span className="text-premium-accent">PADEL</span></span>
            <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest mt-1">Management Tool</span>
          </div>
        </Link>
        
        <nav className="flex-1 space-y-1.5 overflow-y-auto scrollbar-hide">
          <p className="px-4 text-[10px] font-black text-zinc-700 uppercase tracking-widest mb-4">Módulos</p>
          {menuItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => 
                `flex items-center justify-between px-4 py-3.5 rounded-2xl transition-all duration-300 group ${
                  isActive 
                  ? 'bg-gradient-to-r from-premium-accent to-[#7fb220] text-black font-black shadow-[0_10px_30px_rgba(153,204,51,0.2)]' 
                  : 'text-zinc-500 hover:text-white hover:bg-white/[0.03]'
                }`
              }
            >
              <div className="flex items-center space-x-3.5">
                {item.icon}
                <span className="text-sm tracking-tight">{item.name}</span>
              </div>
              {location.pathname === item.path && <div className="w-1.5 h-1.5 bg-black rounded-full shadow-inner animate-pulse" />}
            </NavLink>
          ))}
        </nav>

        <div className="pt-6 border-t border-white/5 space-y-4">
            <div className="bg-zinc-900/50 p-4 rounded-3xl border border-white/5 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-premium-accent to-zinc-500 flex items-center justify-center text-black font-black text-xs">
                    {userRole.charAt(0)}
                </div>
                <div className="flex-1 truncate">
                    <p className="text-xs font-black uppercase tracking-tighter leading-none">{userRole}</p>
                    <p className="text-[10px] text-zinc-600 mt-1">Sessão Ativa</p>
                </div>
                <button 
                    onClick={handleLogout}
                    className="p-2 text-zinc-600 hover:text-red-500 transition-colors"
                >
                    <LogOut size={18} />
                </button>
            </div>
            <p className="text-center text-[8px] text-zinc-800 font-black uppercase tracking-[0.3em]">Build v2.1.0-Demo</p>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Modern Header */}
        <header className="h-20 lg:h-24 px-6 md:px-10 flex items-center justify-between bg-black/20 backdrop-blur-3xl border-b border-white/5">
            <div className="flex items-center gap-4">
                <button onClick={() => setMobileMenuOpen(true)} className="lg:hidden p-2 bg-white/5 rounded-xl">
                    <Menu className="text-premium-accent" />
                </button>
                <div className="hidden sm:flex items-center gap-2 text-zinc-600 text-sm font-black uppercase tracking-widest italic">
                    <Link to="/" className="hover:text-premium-accent transition-colors">Sistema</Link>
                    <ChevronRight size={14} />
                    <span className="text-white brightness-125">{currentPathName}</span>
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
                    <p className="mt-8 text-zinc-800 text-[10px] font-black italic tracking-widest">© 2026 DIRETORIA PADEL DEV TEAM</p>
              </div>
          </div>
      )}
    </div>
  );
};

export default Layout;
