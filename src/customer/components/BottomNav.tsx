import React from 'react';
import { Home, Coffee, ReceiptText, User, LucideIcon } from 'lucide-react';

interface BottomNavProps {
  currentView: string;
  setView: (view: string) => void;
}

interface NavItem {
  id: string;
  icon: LucideIcon;
  label: string;
}

export default function BottomNav({ currentView, setView }: BottomNavProps) {
  const navItems: NavItem[] = [
    { id: 'landing', icon: Home, label: 'Beranda' },
    { id: 'menu', icon: Coffee, label: 'Menu' },
    { id: 'tracking', icon: ReceiptText, label: 'Pesanan' },
    { id: 'others', icon: User, label: 'Profil' },
  ];

  return (
    <div className="fixed bottom-2 md:bottom-4 left-0 right-0 z-50 px-4 pointer-events-none flex justify-center">
      {/* Curved Floating Nav Container */}
      <div className="w-full max-w-md pointer-events-auto bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-200/50 dark:border-slate-800/50 shadow-[0_8px_30px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.4)] rounded-[2rem] px-5 py-2.5 flex justify-between items-center transition-all duration-300">
        {navItems.map((item: NavItem) => {
          const isActive = currentView === item.id;
          const Icon = item.icon;
          
          return (
            <button 
              key={item.id} 
              onClick={() => setView(item.id)}
              className={`flex items-center justify-center transition-all duration-300 rounded-full tap-highlight-transparent ${
                isActive 
                  ? 'bg-blue-600 text-white px-4 py-2 font-bold shadow-blue-600/20 shadow-md' 
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 p-2.5'
              }`}
            >
              <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
              {isActive && (
                <span className="text-[11px] font-bold tracking-wide ml-2 animate-in slide-in-from-left-2 duration-300">
                  {item.label}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
