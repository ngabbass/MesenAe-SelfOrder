import React from 'react';
import { useDbQuery } from '@/hooks/db-hooks';

export default function SplashScreen(): React.JSX.Element {
  const storeSettingsList = useDbQuery<any>('storeSettings') ?? [];
  const storeSettings = storeSettingsList[0] || null;

  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-gradient-to-br from-blue-600 via-indigo-700 to-blue-900 text-white relative overflow-hidden min-h-screen">
      
      {/* Efek Cahaya / Glow di Latar Belakang */}
      <div 
        className="absolute w-[30rem] h-[30rem] bg-white/10 rounded-full blur-[80px] -top-32 -left-20 animate-pulse" 
        style={{ animationDuration: '4s' }}
      />
      <div className="absolute w-[20rem] h-[20rem] bg-indigo-400/20 rounded-full blur-[60px] bottom-10 right-10" />
      
      {/* Konten Utama */}
      <div className="relative z-10 flex flex-col items-center">
        
        {/* Logo Container dengan Animasi Scale-In */}
        <div className="logo-container bg-white p-7 rounded-[2rem] shadow-2xl shadow-blue-900/50 mb-6 relative overflow-hidden">
          <div 
            className="absolute inset-0 bg-blue-100 rounded-[2rem] scale-110 animate-ping opacity-20" 
            style={{ animationDuration: '3s' }}
          />
          <img src={storeSettings?.logo || "/icon-192.png"} alt={storeSettings?.storeName || "MesenAe Logo"} width="64" height="64" className="w-16 h-16 object-contain relative z-10" />
        </div>
        
        {/* Nama Brand dengan Animasi Fade-In-Up */}
        <h1 className="title-text text-4xl font-black tracking-tight mb-2 drop-shadow-md">
          {storeSettings?.storeName || "MesenAe"}
        </h1>
        
        {/* Slogan dengan Animasi Fade-In-Up (Delay) */}
        <p className="subtitle-text text-blue-100/90 font-medium tracking-wide text-sm drop-shadow-sm">
          Pesan Mudah, Cepat, dan Praktis.
        </p>
      </div>
      
      {/* Loading Indicator Modern */}
      <div className="absolute bottom-16 z-10 flex flex-col items-center gap-6">
        <div className="flex space-x-2.5">
          <div className="loading-dot w-2.5 h-2.5 bg-white rounded-full shadow-sm" />
          <div className="loading-dot w-2.5 h-2.5 bg-white rounded-full shadow-sm" />
          <div className="loading-dot w-2.5 h-2.5 bg-white rounded-full shadow-sm" />
        </div>
      </div>

      {/* Versi Aplikasi */}
      <div className="absolute bottom-6 z-10">
        <p className="text-[10px] font-semibold tracking-widest text-white/40 uppercase">
          Version 1.0.0
        </p>
      </div>

      {/* CSS Animasi Kustom yang Disematkan */}
      
    </div>
  );
}
