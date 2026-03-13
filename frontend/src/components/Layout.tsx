import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Users, LayoutGrid, Calendar, Monitor, Globe, LogOut, Menu, X } from 'lucide-react';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const userRole = localStorage.getItem('userRole') || 'ATHLETE';

  const allMenuItems = [
    { name: 'Admin', icon: <Users size={20} />, path: '/admin', roles: ['ADMIN'] },
    { name: 'Chaves', icon: <LayoutGrid size={20} />, path: '/chaves', roles: ['ADMIN'] },
    { name: 'Jogos', icon: <Calendar size={20} />, path: '/jogos', roles: ['ADMIN', 'SUPPORT'] },
    { name: 'Quadras', icon: <Monitor size={20} />, path: '/quadras', roles: ['ADMIN', 'SUPPORT'] },
    { name: 'Público', icon: <Globe size={20} />, path: '/publico', roles: ['ADMIN', 'SUPPORT', 'ATHLETE'] },
  ];

  const menuItems = allMenuItems.filter(item => item.roles.includes(userRole));

  const handleLogout = () => {
    localStorage.removeItem('userRole');
    window.location.href = '/';
  };

  return (
    <div className="flex h-screen bg-premium-dark overflow-hidden text-white font-sans">
      {/* Sidebar - Desktop Only */}
      <aside className="hidden lg:flex w-64 glass-effect border-r border-white/10 flex-col">
        <div className="p-8 flex flex-col items-center">
          <img src="/logo.png" alt="Diretoria Padel" className="w-24 h-24 mb-4 drop-shadow-[0_0_15px_rgba(153,204,51,0.3)]" />
          <h1 className="text-xl font-bold text-premium-accent tracking-tighter uppercase text-center leading-none">DIRETORIA PADEL</h1>
          <p className="text-[9px] text-zinc-500 mt-2 font-black tracking-widest bg-white/5 px-2 py-1 rounded">SISTEMA OFICIAL</p>
        </div>
        
        <nav className="flex-1 px-4 space-y-2 mt-4">
          {menuItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => 
                `flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-300 ${
                  isActive ? 'bg-premium-accent text-black font-bold' : 'hover:bg-white/5 text-zinc-400'
                }`
              }
            >
              {item.icon}
              <span>{item.name}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-white/10">
          <button 
            onClick={handleLogout}
            className="flex items-center space-x-3 w-full px-4 py-3 text-zinc-400 hover:text-red-400 transition-colors"
          >
            <LogOut size={20} />
            <span>Sair</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-zinc-900 via-premium-dark to-premium-dark scrollbar-hide pb-24 lg:pb-8">
        <div className="p-4 md:p-8">
          {/* Header Mobile Only */}
          <div className="lg:hidden flex items-center justify-between mb-8 glass-effect !bg-black/20 p-4 rounded-2xl border border-white/5">
                <div className="flex items-center gap-3">
                    <img src="/logo.png" className="w-10 h-10" alt="logo" />
                    <span className="font-black text-premium-accent italic tracking-tighter">DIRETORIA PADEL</span>
                </div>
                <button onClick={() => setMobileMenuOpen(true)}>
                    <Menu className="text-premium-accent" />
                </button>
          </div>

          {children}
        </div>
      </main>

      {/* Bottom Navigation - Mobile Only */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 glass-effect border-t border-white/10 px-2 py-3 flex justify-around items-center z-40">
            {menuItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => 
                `flex flex-col items-center gap-1 transition-all duration-300 ${
                  isActive ? 'text-premium-accent' : 'text-zinc-500'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div className={`p-2 rounded-xl ${isActive ? 'bg-premium-accent/10' : ''}`}>
                    {React.cloneElement(item.icon as React.ReactElement<any>, { size: 24 })}
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-tight">{item.name.split(' ')[0]}</span>
                </>
              )}
            </NavLink>
          ))}
      </div>

      {/* Fullscreen Mobile Menu Overlay */}
      {mobileMenuOpen && (
          <div className="fixed inset-0 bg-black/95 z-50 animate-in fade-in duration-300 flex flex-col p-8">
              <div className="flex justify-between items-center mb-12">
                  <span className="text-2xl font-black text-premium-accent italic">MENU</span>
                  <button onClick={() => setMobileMenuOpen(false)}>
                      <X size={32} />
                  </button>
              </div>
              <nav className="space-y-6">
                {menuItems.map((item) => (
                    <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={({ isActive }) => 
                        `flex items-center space-x-6 text-3xl font-bold ${
                        isActive ? 'text-premium-accent' : 'text-zinc-600'
                        }`
                    }
                    >
                    {item.icon}
                    <span>{item.name}</span>
                    </NavLink>
                ))}
              </nav>
              <div className="mt-auto">
                    <button 
                        onClick={handleLogout}
                        className="flex items-center space-x-4 text-zinc-600 text-xl py-4 border-t border-white/10 w-full"
                    >
                        <LogOut size={24} />
                        <span>Encerrar Sessão</span>
                    </button>
              </div>
          </div>
      )}
    </div>
  );
};

export default Layout;
