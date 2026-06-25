import React, { useState, useEffect, useRef, JSX } from 'react';
import { X, User, Hash, ArrowRight, UtensilsCrossed, Phone } from 'lucide-react';
import { useDbQuery } from '@/hooks/db-hooks';
import { parseTableNumber } from '@/lib/utils';

// ==========================================
// Tipe Data & Interfaces (TypeScript)
// ==========================================

export interface CustomerInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (customerName: string, tableNumber: string, customerPhone: string) => void;
  initialCustomerName?: string;
  initialTableNumber?: string;
  initialCustomerPhone?: string;
  storeSettings?: any;
}

export default function CustomerInfoModal({
  isOpen,
  onClose,
  onSubmit,
  initialCustomerName = '',
  initialTableNumber = '',
  initialCustomerPhone = '',
  storeSettings,
}: CustomerInfoModalProps): JSX.Element | null {
  
  const storeSettingsList = (useDbQuery('storeSettings') as any[]) || [];
  const settings = storeSettings || storeSettingsList[0] || {};
  const isWhatsappEnabled = settings?.enableWhatsappNotification === true;

  const [customerName, setCustomerName] = useState<string>(initialCustomerName);
  const [tableNumber, setTableNumber] = useState<string>(initialTableNumber);
  const [customerPhone, setCustomerPhone] = useState<string>(initialCustomerPhone);
  const [isVisible, setIsVisible] = useState<boolean>(false);
  const [shouldRender, setShouldRender] = useState<boolean>(isOpen);
  
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Handle animasi dan auto-focus
  useEffect(() => {
    let hideTimer: NodeJS.Timeout;
    let focusTimer: NodeJS.Timeout;

    if (isOpen) {
      setShouldRender(true);
      // Set state customer dari initial saat modal dibuka
      setCustomerName(initialCustomerName);
      setTableNumber(initialTableNumber);
      setCustomerPhone(initialCustomerPhone);
      
      // Memberi sedikit jeda agar DOM ter-render sebelum animasi transisi dimulai
      requestAnimationFrame(() => {
        setIsVisible(true);
      });
      document.body.style.overflow = 'hidden';
      
      // Auto-focus ke input nama setelah animasi selesai
      focusTimer = setTimeout(() => {
        nameInputRef.current?.focus();
      }, 300);
    } else {
      setIsVisible(false);
      document.body.style.overflow = 'unset';
      // Tunggu animasi fade-out selesai sebelum menghapus komponen dari DOM
      hideTimer = setTimeout(() => {
        setShouldRender(false);
      }, 300);
    }
    
    return () => {
      clearTimeout(focusTimer);
      clearTimeout(hideTimer);
    };
  }, [isOpen, initialCustomerName, initialTableNumber]);

  useEffect(() => {
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  const isNameInvalid = !initialCustomerName.trim() || initialCustomerName.trim().toLowerCase() === 'tamu';
  const isPhoneInvalid = isWhatsappEnabled && !initialCustomerPhone.trim();
  const preventClose = isNameInvalid || isPhoneInvalid;

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    const cleanName = customerName.trim();
    if (!cleanName || cleanName.toLowerCase() === 'tamu') {
      alert('Nama pemesan tidak boleh kosong atau "Tamu"!');
      return;
    }
    if (isWhatsappEnabled && !customerPhone.trim()) {
      alert('Nomor WhatsApp wajib diisi!');
      return;
    }
    onSubmit(cleanName, tableNumber.trim(), isWhatsappEnabled ? customerPhone.trim() : '');
    onClose();
  };

  if (!shouldRender) return null;

  return (
    <div 
      className={`fixed inset-0 z-[100] flex items-center justify-center p-4 transition-all duration-300 ${
        isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
    >
      {/* Backdrop with strong blur */}
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-md transition-opacity"
        onClick={preventClose ? undefined : onClose}
      />

      {/* Modal Content - Animated from bottom/center */}
      <div
        className={`relative w-full max-w-sm bg-white dark:bg-slate-900 border-3 border-black dark:border-slate-700 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_#374151] rounded-3xl overflow-hidden transform transition-all duration-300 ease-out ${
          isVisible ? 'translate-y-0 scale-100' : 'translate-y-8 scale-95'
        }`}
      >
        {/* Close Button overlay (hidden if preventClose is true) */}
        {!preventClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 w-9 h-9 border-2 border-black dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-center text-black dark:text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_#374151] hover:bg-[#fffdf0] rounded-xl active:translate-x-[0.5px] active:translate-y-[0.5px] active:shadow-none transition-all"
            aria-label="Tutup modal"
          >
            <X size={18} strokeWidth={3} />
          </button>
        )}

        {/* Header Icon & Text */}
        <div className="pt-8 px-6 pb-2 text-center">
          <div className="mx-auto inline-flex h-16 w-16 items-center justify-center bg-[#ff90e8] text-black border-2 border-black dark:border-slate-700 rounded-2xl mb-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_#374151]">
            <UtensilsCrossed size={28} strokeWidth={2.5} />
          </div>
          <h2 className="text-xl font-black text-black dark:text-white uppercase tracking-wider">Data Pesanan</h2>
          <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 mt-2 uppercase leading-relaxed">
            Silakan isi nama Anda untuk memesan. Nomor meja telah disesuaikan otomatis oleh sistem.
          </p>
        </div>

        {/* Form Section */}
        <form onSubmit={handleSubmit} className="p-6 pt-4 space-y-4">
          
          {/* Input Nama */}
          <div className="space-y-1.5">
            <label className="text-xs font-black text-black dark:text-white uppercase tracking-wider ml-1">
              Nama Pemesan
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
                <User size={18} strokeWidth={2.5} />
              </div>
              <input
                ref={nameInputRef}
                type="text"
                value={customerName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCustomerName(e.target.value)}
                placeholder="Cth: Budi..."
                className="w-full pl-11 pr-4 py-3.5 bg-white dark:bg-slate-900 border-2 border-black dark:border-slate-700 text-black dark:text-white placeholder-slate-400 font-bold text-xs uppercase shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_#374151] focus:bg-[#fffdf0] dark:focus:bg-slate-800 rounded-xl outline-none"
                required
              />
            </div>
          </div>

          {/* Input Nomor Meja */}
          <div className="space-y-1.5">
            <label className="text-xs font-black text-black dark:text-white uppercase tracking-wider ml-1">
              Nomor Meja
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
                <Hash size={18} strokeWidth={2.5} />
              </div>
              {(() => {
                const parsedTable = parseTableNumber(tableNumber);
                return parsedTable.isTakeAway ? (
                  <input
                    type="text"
                    value="Bawa Pulang (Take Away)"
                    disabled={true}
                    className="w-full pl-11 pr-4 py-3.5 border-2 border-black dark:border-slate-700 text-slate-500 bg-slate-105 dark:bg-slate-800 font-black text-xs uppercase cursor-not-allowed select-none rounded-xl"
                  />
                ) : (
                  <div className="w-full pl-11 pr-4 py-3.5 border-2 border-black dark:border-slate-700 text-slate-500 bg-slate-105 dark:bg-slate-800 font-black flex items-center select-none rounded-xl">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 bg-white dark:bg-slate-900 border border-black dark:border-slate-700 text-black dark:text-white text-[9px] font-black px-2.5 py-1 shadow-[1.5px_1.5px_0px_0px_rgba(0,0,0,1)] dark:shadow-[1.5px_1.5px_0px_0px_#374151] uppercase rounded-md">
                        <span className="w-1.5 h-1.5 bg-blue-500 animate-pulse"></span>
                        {parsedTable.area}
                      </span>
                      <span className="inline-flex items-center bg-black dark:bg-white text-white dark:text-black text-[10px] font-black px-3 py-1 border border-black dark:border-slate-700 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_#374151] uppercase rounded-md">
                        {/^\d+$/.test(parsedTable.table) ? `Meja ${parsedTable.table}` : parsedTable.table}
                      </span>
                    </div>
                  </div>
                );
              })()}
            </div>
            {initialTableNumber === 'Bawa Pulang' ? (
              <p className="text-[10px] text-[#ff8000] ml-1 font-black uppercase tracking-wide">
                *Pesanan Anda akan dicatat sebagai Take Away (Bawa Pulang).
              </p>
            ) : initialTableNumber ? (
              <p className="text-[10px] text-emerald-600 dark:text-emerald-500 ml-1 font-black uppercase tracking-wide">
                *Nomor meja terisi otomatis dari sistem.
              </p>
            ) : null}
          </div>

          {/* Input Nomor WhatsApp (Hanya tampil jika diaktifkan di admin) */}
          {isWhatsappEnabled && (
            <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-300">
              <label className="text-xs font-black text-black dark:text-white uppercase tracking-wider ml-1">
                Nomor WhatsApp Pelanggan
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
                  <Phone size={18} strokeWidth={2.5} />
                </div>
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    const cleaned = e.target.value.replace(/\D/g, '');
                    if (cleaned.length <= 12) {
                      setCustomerPhone(cleaned);
                    }
                  }}
                  maxLength={12}
                  placeholder="Cth: 08123456789..."
                  className="w-full pl-11 pr-4 py-3.5 bg-white dark:bg-slate-900 border-2 border-black dark:border-slate-700 text-black dark:text-white placeholder-slate-400 font-bold text-xs uppercase shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_#374151] focus:bg-[#fffdf0] dark:focus:bg-slate-800 rounded-xl outline-none"
                  required={isWhatsappEnabled}
                />
              </div>
              <p className="text-[9px] font-bold text-slate-400 uppercase leading-relaxed ml-1">
                *Digunakan untuk mengirim pesan WhatsApp otomatis saat pesanan siap diambil/diantar.
              </p>
            </div>
          )}

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={!customerName.trim() || customerName.trim().toLowerCase() === 'tamu' || (isWhatsappEnabled && !customerPhone.trim())}
              className="w-full flex items-center justify-center gap-2.5 bg-[#ffc700] hover:bg-[#ffe066] text-black font-black uppercase text-xs border-2 border-black dark:border-slate-700 py-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_#374151] hover:translate-x-[0.5px] hover:translate-y-[0.5px] hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:hover:shadow-[3px_3px_0px_0px_#374151] active:translate-x-[1.5px] active:translate-y-[1.5px] active:shadow-none transition-all disabled:opacity-50 disabled:cursor-not-allowed rounded-xl"
            >
              Lanjut ke Menu
              <ArrowRight size={18} strokeWidth={3} />
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
