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
      {/* Floating Glassmorphism Pill Container */}
      <div className="w-full max-w-md pointer-events-auto bg-white/75 dark:bg-black/75 backdrop-blur-2xl border border-white/20 dark:border-white/5 shadow-[0_16px_40px_rgba(0,0,0,0.12)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.5)] rounded-[2.2rem] px-3.5 py-2.5 flex justify-between items-center transition-all duration-500 relative">
        {navItems.map((item: NavItem) => {
          const isActive = currentView === item.id;
          const Icon = item.icon;
          
          return (
            <button 
              key={item.id} 
              onClick={() => setView(item.id)}
              className="relative flex items-center justify-center transition-all duration-300 rounded-full py-2.5 px-3 sm:px-4 tap-highlight-transparent overflow-hidden"
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              {isActive && (
                <motion.div
                  layoutId="activeNavBackground"
                  className="absolute inset-0 bg-gradient-to-r from-amber-500 to-amber-600 dark:from-amber-600 dark:to-amber-700 shadow-md shadow-amber-500/20 rounded-full"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
              
              <span className={`relative z-10 flex items-center justify-center gap-2 ${
                isActive 
                  ? 'text-white font-extrabold scale-105' 
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

