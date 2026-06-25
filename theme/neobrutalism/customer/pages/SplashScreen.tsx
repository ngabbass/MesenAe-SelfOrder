import React from 'react';
import { useDbQuery } from '@/hooks/db-hooks';
import { Utensils } from 'lucide-react';
import { motion } from 'motion/react';

export default function SplashScreen(): React.JSX.Element {
  const storeSettingsList = useDbQuery<Record<string, unknown>>('storeSettings') ?? [];
  const storeSettings = storeSettingsList[0] || null;

  return (
    <div className="customer-theme flex-1 flex flex-col items-center justify-center text-black dark:text-white relative overflow-hidden min-h-screen">
      
      {/* Neobrutalist Decorative Floating Background Shapes */}
      <div className="absolute top-12 left-12 w-12 h-12 border-4 border-black dark:border-slate-700 bg-[#ffc700] rotate-12 hidden md:block" />
      <div className="absolute bottom-16 right-16 w-16 h-16 border-4 border-black dark:border-slate-700 bg-red-500 -rotate-12 hidden md:block" />
      <div className="absolute top-1/4 right-24 text-6xl font-black text-black/10 dark:text-white/10 select-none hidden md:block">★</div>
      <div className="absolute bottom-1/4 left-24 text-6xl font-black text-black/10 dark:text-white/10 select-none hidden md:block">✿</div>
      
      {/* Main Content */}
      <div className="relative z-10 flex flex-col items-center max-w-sm w-full px-6">
        
        {/* Bold Logo Container */}
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="bg-white dark:bg-slate-900 p-6 rounded-xl border-4 border-black dark:border-slate-700 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_#374151] mb-8 flex items-center justify-center w-32 h-32"
        >
          {storeSettings?.logo ? (
            <motion.img 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              src={storeSettings.logo as string} 
              alt={(storeSettings.storeName as string) || "Logo"} 
              className="w-20 h-20 object-contain" 
            />
          ) : (
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="w-20 h-20 bg-[#ffc700] border-2 border-black rounded-lg flex items-center justify-center"
            >
              <Utensils size={36} className="text-black" strokeWidth={2.5} />
            </motion.div>
          )}
        </motion.div>
        
        {/* Brand Name */}
        <motion.h1 
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="text-3xl md:text-4xl font-black tracking-tight mb-2 text-black dark:text-white text-center bg-[#ffc700] border-3 border-black dark:border-slate-700 px-4 py-1 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_#374151] rotate-[-1deg]"
        >
          {((storeSettings?.storeName as string) || "MesenAe").toUpperCase()}
        </motion.h1>
        
        {/* Slogan */}
        <motion.p 
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="text-black dark:text-white bg-white dark:bg-slate-900 border-2 border-black dark:border-slate-700 px-3 py-1 text-xs font-black uppercase tracking-wider mt-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_#374151]"
        >
          Sajian Premium Terbaik
        </motion.p>
      </div>
      
      {/* Modern Loading Progress */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.5 }}
        className="absolute bottom-20 z-10 flex flex-col items-center gap-3 w-64 px-4"
      >
        <div className="h-5 w-full bg-white dark:bg-slate-900 border-3 border-black dark:border-slate-700 p-1 overflow-hidden relative shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_#374151] rounded-md">
          <motion.div 
            initial={{ width: "0%" }}
            animate={{ width: "100%" }}
            transition={{ duration: 2, ease: "easeInOut" }}
            className="h-full bg-red-500 border-r-2 border-black dark:border-slate-700"
          />
        </div>
        <span className="text-[11px] font-black text-black dark:text-white bg-white dark:bg-slate-900 border border-black dark:border-slate-700 px-2 py-0.5 uppercase tracking-widest">
          Menyiapkan Menu...
        </span>
      </motion.div>

      {/* App Version */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.6 }}
        className="absolute bottom-8 z-10"
      >
        <p className="text-[10px] font-black tracking-widest text-black/40 dark:text-white/40 uppercase">
          Version 1.0.0
        </p>
      </motion.div>
    </div>
  );
}
