import React from 'react';
import { Home, Coffee, ReceiptText, User, LucideIcon } from 'lucide-react';
import { motion } from 'motion/react';

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
    <div className="fixed bottom-4 left-0 right-0 z-50 px-4 pointer-events-none flex justify-center pb-safe">
      {/* Neobrutalist Solid Pill Container */}
      <div className="w-full max-w-md pointer-events-auto bg-white dark:bg-slate-900 border-3 border-black dark:border-slate-700 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] dark:shadow-[6px_6px_0px_0px_#374151] rounded-xl px-2 py-2 flex justify-between items-center transition-all duration-300 relative">
        {navItems.map((item: NavItem) => {
          const isActive = currentView === item.id;
          const Icon = item.icon;
          
          return (
            <button 
              key={item.id} 
              onClick={() => setView(item.id)}
              className="relative flex items-center justify-center transition-all duration-300 rounded-lg py-2 px-3 sm:px-4 tap-highlight-transparent overflow-hidden"
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              {isActive && (
                <motion.div
                  layoutId="activeNavBackground"
                  className="absolute inset-0 bg-[#ffc700] border-2 border-black dark:border-slate-700 rounded-lg shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_#374151]"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
              
              <span className={`relative z-10 flex items-center justify-center gap-2 ${
                isActive 
                  ? 'text-black font-extrabold scale-105' 
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:scale-105'
              } transition-all duration-200`}>
                <Icon size={19} strokeWidth={isActive ? 2.5 : 2} />
                {isActive && (
                  <span className="text-[11px] font-black tracking-wide leading-none select-none">
                    {item.label}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

