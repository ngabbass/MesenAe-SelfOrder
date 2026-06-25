import React from 'react';
import { useDbQuery } from '@/hooks/db-hooks';
import { Utensils } from 'lucide-react';
import { motion } from 'motion/react';

export default function SplashScreen(): React.JSX.Element {
  const storeSettingsList = useDbQuery<Record<string, unknown>>('storeSettings') ?? [];
  const storeSettings = storeSettingsList[0] || null;

  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-white relative overflow-hidden min-h-screen">
      
      {/* Premium Ambient Background Effects */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 2, ease: "easeOut" }}
        className="absolute w-[40rem] h-[40rem] bg-gradient-to-tr from-amber-500/10 to-orange-500/5 rounded-full blur-[100px] -top-32 -right-32 pointer-events-none" 
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 2, ease: "easeOut", delay: 0.2 }}
        className="absolute w-[30rem] h-[30rem] bg-gradient-to-bl from-amber-400/5 to-transparent rounded-full blur-[80px] bottom-10 -left-20 pointer-events-none" 
      />
      
      {/* Main Content */}
      <div className="relative z-10 flex flex-col items-center">
        
        {/* Premium Glass Logo Container */}
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="glass-panel-heavy p-7 rounded-[2rem] shadow-xl shadow-amber-500/5 mb-8 relative overflow-hidden flex items-center justify-center"
        >
          <div 
            className="absolute inset-0 bg-gradient-to-br from-amber-400/10 to-orange-500/10 opacity-50" 
          />
          {storeSettings?.logo ? (
            <motion.img 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              src={storeSettings.logo as string} 
              alt={(storeSettings.storeName as string) || "Logo"} 
              className="w-20 h-20 object-contain relative z-10" 
            />
          ) : (
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="w-20 h-20 bg-gradient-to-br from-amber-500 to-orange-500 rounded-2xl flex items-center justify-center shadow-inner relative z-10"
            >
              <Utensils size={40} className="text-white drop-shadow-md" strokeWidth={2} />
            </motion.div>
          )}
        </motion.div>
        
        {/* Brand Name */}
        <motion.h1 
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.4, ease: "easeOut" }}
          className="text-3xl font-black tracking-tight mb-2 text-slate-900 dark:text-white"
        >
          {(storeSettings?.storeName as string) || "MesenAe"}
        </motion.h1>
        
        {/* Slogan */}
        <motion.p 
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.5, ease: "easeOut" }}
          className="text-slate-500 dark:text-slate-400 font-bold tracking-widest text-[11px] uppercase"
        >
          Sajian Premium Terbaik
        </motion.p>
      </div>
      
      {/* Modern Loading Progress */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 0.8 }}
        className="absolute bottom-20 z-10 flex flex-col items-center gap-4 w-48"
      >
        <div className="h-1 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden relative">
          <motion.div 
            initial={{ width: "0%" }}
            animate={{ width: "100%" }}
            transition={{ duration: 2, ease: "easeInOut" }}
            className="absolute top-0 left-0 h-full bg-amber-500 rounded-full"
          />
        </div>
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
          Menyiapkan Menu...
        </span>
      </motion.div>

      {/* App Version */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 1 }}
        className="absolute bottom-8 z-10"
      >
        <p className="text-[10px] font-bold tracking-widest text-slate-400 dark:text-slate-600 uppercase">
          Version 1.0.0
        </p>
      </motion.div>
    </div>
  );
}
