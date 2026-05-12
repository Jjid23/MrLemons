import { ReactNode } from 'react';
import { auth } from '../lib/firebase';
import { signOut } from 'firebase/auth';
import { motion } from 'motion/react';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  LogOut, 
  User as UserIcon
} from 'lucide-react';
import { cn } from '../lib/utils';

interface LayoutProps {
  children: ReactNode;
  user: any;
  permissions?: string[];
  view: 'pos' | 'admin';
  setView: (view: 'pos' | 'admin') => void;
}

export function Layout({ children, user, permissions = [], view, setView }: LayoutProps) {
  const handleLogout = () => signOut(auth);

  return (
    <div className="flex h-screen bg-natural dark:bg-stone-950 overflow-hidden font-sans text-stone-900 dark:text-stone-100 selection:bg-lemon/30 transition-colors duration-300">
      {/* Sidebar - Organic Tech Aesthetic */}
      <aside className="w-20 md:w-72 bg-white dark:bg-stone-900 border-r border-stone-200 dark:border-stone-800 flex flex-col items-center py-10 z-20 shadow-xl shadow-stone-200/20 dark:shadow-none relative transition-colors duration-300">
        <div className="absolute top-0 right-0 h-full w-[1px] bg-gradient-to-b from-transparent via-stone-200 dark:via-stone-800 to-transparent"></div>
        
        <div className="flex items-center gap-4 mb-16 px-8 w-full group cursor-default">
          <div className="w-12 h-12 bg-lemon rounded-3xl flex items-center justify-center text-stone-800 shrink-0 shadow-lg shadow-lemon/20 transform group-hover:rotate-12 transition-transform duration-500">
              <img src="/Lemon.jpg" alt="Mr Lemon" className="w-full h-full object-cover p-1" />
            </div>
            <div className="hidden md:block transition-all duration-300">
            <h1 className="font-black text-2xl tracking-tight text-stone-800 dark:text-stone-100 leading-none">
              Mr Lemon
            </h1>
            <p className="text-[10px] uppercase font-black tracking-[0.3em] text-stone-500 dark:text-stone-400 mt-2">Operations v2.0</p>
          </div>
        </div>

        <nav className="flex-1 w-full space-y-3 px-4">
          <p className="hidden md:block text-xs font-black uppercase tracking-[0.2em] text-stone-400 dark:text-stone-500 mb-4 ml-4">Navigation</p>
          
          {permissions.includes('orders.create') && (
            <button
              onClick={() => setView('pos')}
              className={cn(
                "w-full flex items-center gap-4 px-5 py-5 rounded-[28px] transition-all duration-300 group relative active:scale-95 text-left",
                view === 'pos' 
                  ? "bg-stone-800 dark:bg-lemon text-white dark:text-stone-900 shadow-2xl shadow-stone-800/20 dark:shadow-lemon/20" 
                  : "bg-transparent text-stone-500 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-800 hover:text-stone-800 dark:hover:text-stone-100"
              )}
            >
              <div className={cn(
                "w-12 h-12 rounded-2xl flex items-center justify-center transition-colors",
                view === 'pos' ? "bg-white/10 dark:bg-stone-900/10" : "bg-stone-100 dark:bg-stone-800 group-hover:bg-stone-200 dark:group-hover:bg-stone-700"
              )}>
                <ShoppingCart size={24} strokeWidth={2.5} />
              </div>
              <span className="hidden md:block font-black text-sm uppercase tracking-widest">POS Terminal</span>
            </button>
          )}

          {permissions.includes('reports.view') && (
            <button
              onClick={() => setView('admin')}
              className={cn(
                "w-full flex items-center gap-4 px-5 py-5 rounded-[28px] transition-all duration-300 group relative active:scale-95 text-left",
                view === 'admin' 
                  ? "bg-stone-800 dark:bg-lemon text-white dark:text-stone-900 shadow-2xl shadow-stone-800/20 dark:shadow-lemon/20" 
                  : "bg-transparent text-stone-500 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-800 hover:text-stone-800 dark:hover:text-stone-100"
              )}
            >
              <div className={cn(
                "w-12 h-12 rounded-2xl flex items-center justify-center transition-colors",
                view === 'admin' ? "bg-white/10 dark:bg-stone-900/10" : "bg-stone-100 dark:bg-stone-800 group-hover:bg-stone-200 dark:group-hover:bg-stone-700"
              )}>
                <LayoutDashboard size={24} strokeWidth={2.5} />
              </div>
              <span className="hidden md:block font-black text-sm uppercase tracking-widest">Admin Panel</span>
            </button>
          )}
        </nav>

        <div className="w-full px-4 space-y-6">
          <div className="hidden md:block p-1 bg-stone-50 dark:bg-stone-800/50 rounded-[32px] border border-stone-100 dark:border-stone-800 shadow-inner">
            <div className="flex items-center gap-3 p-3 bg-white dark:bg-stone-800 rounded-[28px] shadow-sm">
              <div className="w-12 h-12 bg-natural dark:bg-stone-900 rounded-2xl flex items-center justify-center border border-stone-100 dark:border-stone-700 overflow-hidden shadow-inner shrink-0 leading-none">
                <img 
                  src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.name || 'Felix'}`} 
                  alt="avatar" 
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-black truncate text-stone-900 dark:text-stone-100">{user?.name}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                  <p className="text-[10px] uppercase tracking-widest font-black text-stone-500 dark:text-stone-400">
                    {user?.roleId || 'Staff'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <button 
            onClick={handleLogout}
            className="w-full flex items-center justify-center md:justify-start gap-4 px-5 py-4 text-stone-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-[28px] transition-all group active:scale-95"
          >
            <div className="w-12 h-12 bg-stone-50 dark:bg-stone-800 group-hover:bg-red-100 dark:group-hover:bg-red-900/30 rounded-2xl flex items-center justify-center transition-colors text-stone-400 group-hover:text-red-500">
              <LogOut size={24} />
            </div>
            <span className="hidden md:block font-black text-sm uppercase tracking-widest">Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content with Grid Texture */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <div className="absolute inset-0 bg-grid-stone pointer-events-none opacity-50 z-0"></div>
        <div className="relative z-10 flex-1 flex flex-col overflow-hidden">
          {children}
        </div>
      </main>
    </div>
  );
}
