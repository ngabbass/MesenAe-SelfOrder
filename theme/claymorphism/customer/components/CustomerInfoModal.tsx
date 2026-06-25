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
        className={`relative w-full max-w-sm clay-card overflow-hidden transform transition-all duration-300 ease-out ${
          isVisible ? 'translate-y-0 scale-100' : 'translate-y-8 scale-95'
        }`}
      >
        {/* Close Button overlay (hidden if preventClose is true) */}
        {!preventClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 p-2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 clay-btn-secondary !rounded-full transition-colors"
            aria-label="Tutup modal"
          >
            <X size={16} />
          </button>
        )}

        {/* Header Icon & Text */}
        <div className="pt-8 px-6 pb-2 text-center">
          <div className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 mb-4 shadow-inner">
            <UtensilsCrossed size={28} strokeWidth={1.5} />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Data Pesanan</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
            Silakan isi nama Anda untuk memesan. Nomor meja telah disesuaikan otomatis oleh sistem.
          </p>
        </div>

        {/* Form Section */}
        <form onSubmit={handleSubmit} className="p-6 pt-4 space-y-4">
          
          {/* Input Nama */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1">
              Nama Pemesan
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
                <User size={18} />
              </div>
              <input
                ref={nameInputRef}
                type="text"
                value={customerName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCustomerName(e.target.value)}
                placeholder="Cth: Budi..."
                className="w-full pl-11 pr-4 py-3.5 clay-input text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 transition-all"
                required
              />
            </div>
          </div>

          {/* Input Nomor Meja */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1">
              Nomor Meja
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
                <Hash size={18} />
              </div>
              {(() => {
                const parsedTable = parseTableNumber(tableNumber);
                return parsedTable.isTakeAway ? (
                  <input
                    type="text"
                    value="Bawa Pulang (Take Away)"
                    disabled={true}
                    className="w-full pl-11 pr-4 py-3.5 clay-input text-slate-500 dark:text-slate-400 font-semibold transition-all cursor-not-allowed select-none opacity-80"
                  />
                ) : (
                  <div className="w-full pl-11 pr-4 py-3 clay-input text-slate-500 dark:text-slate-400 font-semibold flex items-center select-none">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border border-blue-200/60 dark:border-blue-900/40 text-blue-700 dark:text-blue-300 text-[10px] sm:text-xs font-extrabold px-3 py-1.5 rounded-xl shadow-sm tracking-wide uppercase leading-none">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                        {parsedTable.area}
                      </span>
                      <span className="inline-flex items-center bg-slate-900 dark:bg-slate-800 border border-slate-950 dark:border-slate-700 text-white text-[11px] sm:text-xs font-black px-3.5 py-1.5 rounded-xl shadow-md tracking-wide uppercase leading-none">
                        {/^\d+$/.test(parsedTable.table) ? `Meja ${parsedTable.table}` : parsedTable.table}
                      </span>
                    </div>
                  </div>
                );
              })()}
            </div>
            {initialTableNumber === 'Bawa Pulang' ? (
              <p className="text-[11px] text-blue-600 dark:text-blue-400 ml-1 font-bold">
                *Pesanan Anda akan dicatat sebagai Take Away (Bawa Pulang).
              </p>
            ) : initialTableNumber ? (
              <p className="text-[11px] text-emerald-600 dark:text-emerald-500 ml-1 font-semibold">
                *Nomor meja terisi otomatis dari sistem.
              </p>
            ) : null}
          </div>

          {/* Input Nomor WhatsApp (Hanya tampil jika diaktifkan di admin) */}
          {isWhatsappEnabled && (
            <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-300">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1">
                Nomor WhatsApp Pelanggan
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
                  <Phone size={18} />
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
                  className="w-full pl-11 pr-4 py-3.5 clay-input text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 transition-all"
                  required={isWhatsappEnabled}
                />
              </div>
              <p className="text-[10px] text-muted-foreground ml-1">
                *Digunakan untuk mengirim pesan WhatsApp otomatis saat pesanan siap diambil/diantar.
              </p>
            </div>
          )}

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={!customerName.trim() || customerName.trim().toLowerCase() === 'tamu' || (isWhatsappEnabled && !customerPhone.trim())}
              className="w-full flex items-center justify-center gap-2 clay-btn-primary font-bold py-4 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Lanjut ke Menu
              <ArrowRight size={18} />
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
