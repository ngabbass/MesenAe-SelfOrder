import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
  FileText, ChevronRight, X, Smartphone, Ticket, User, MapPin, Scissors,
  MessageCircle, Headset, Phone, Edit2
} from 'lucide-react';
import { FORMAT_IDR, parseTableNumber } from '@/lib/utils';
import { useDbQuery } from '@/hooks/db-hooks';
import { toast } from 'sonner';

// 1. Definisikan tipe untuk pengaturan toko
interface StoreSettings {
  phone?: string;
  [key: string]: unknown;
}

// 2. Definisikan tipe untuk Voucher
interface Voucher {
  id: string | number;
  isActive?: boolean;
  is_active?: boolean;
  showInCustomerApp?: boolean;
  show_in_customer_app?: boolean;
  type: 'percentage' | 'nominal' | string; 
  value: number;
  code: string;
}

// 3. Definisikan tipe untuk Props Komponen
interface OthersViewProps {
  setView: (view: string) => void;
  storeSettings?: StoreSettings | null;
  tableNumber?: string | number | null;
  customerName?: string | null;
  customerPhone?: string | null;
  setCustomerName: (name: string) => void;
  setCustomerPhone: (phone: string) => void;
  isEmbedded?: boolean;
}

export default function OthersView({ 
  setView, 
  storeSettings, 
  tableNumber, 
  customerName,
  customerPhone,
  setCustomerName,
  setCustomerPhone,
  isEmbedded = false
}: OthersViewProps) {
  const [showCS, setShowCS] = useState<boolean>(false);
  const [showVouchers, setShowVouchers] = useState<boolean>(false);

  // States & handlers for profile edit modal
  const [isEditOpen, setIsEditOpen] = useState<boolean>(false);
  const [editName, setEditName] = useState<string>(customerName || '');
  const [editPhone, setEditPhone] = useState<string>(customerPhone || '');

  const storeSettingsList = (useDbQuery('storeSettings') as any[]) || [];
  const settings = storeSettings || storeSettingsList[0] || {};
  const isWhatsappEnabled = settings?.enableWhatsappNotification === true;

  const openEditModal = () => {
    setEditName(customerName || '');
    setEditPhone(customerPhone || '');
    setIsEditOpen(true);
  };

  const handleEditSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const cleanName = editName.trim();
    if (!cleanName || cleanName.toLowerCase() === 'tamu') {
      toast.error('Nama pemesan tidak boleh kosong atau "Tamu"!');
      return;
    }
    if (isWhatsappEnabled && !editPhone.trim()) {
      toast.error('Nomor WhatsApp wajib diisi!');
      return;
    }
    
    setCustomerName(cleanName);
    setCustomerPhone(editPhone.trim());
    setIsEditOpen(false);
    toast.success('Profil berhasil diperbarui!');
  };

  const vouchersResult = useDbQuery('vouchers') as Voucher[];
  const vouchers = useMemo(() => vouchersResult ?? [], [vouchersResult]);

  const usersResult = useDbQuery('users') as any[];
  const users = useMemo(() => usersResult ?? [], [usersResult]);
  
  const activeVouchers = useMemo(() => {
    return vouchers.filter((v: Voucher) => {
      const isActive = v.isActive || v.is_active;
      const isShown = v.showInCustomerApp !== false && v.show_in_customer_app !== false;
      return isActive && isShown;
    });
  }, [vouchers]);

  const activeKasirWa = useMemo(() => {
    const kasir = users.find(u => u.whatsapp);
    return kasir?.whatsapp || storeSettings?.phone;
  }, [users, storeSettings?.phone]);

  // Modifikasi fungsi openWhatsApp untuk menerima pre-filled message
  const openWhatsApp = (phone?: string, message?: string) => {
    if (!phone) {
      toast.error('Nomor WhatsApp belum diatur');
      return;
    }
    let formattedPhone = phone.replace(/\D/g, '');
    if (formattedPhone.startsWith('0')) {
      formattedPhone = '62' + formattedPhone.substring(1);
    }
    
    // Gunakan URL API WhatsApp dengan parameter text
    const url = new URL(`https://wa.me/${formattedPhone}`);
    if (message) {
      url.searchParams.append('text', message);
    }
    
    window.open(url.toString(), '_blank');
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`Kode promo "${text}" disalin!`);
  };

  // Pre-filled messages templates
  const orderMessageTemplate = (() => {
    const parsed = parseTableNumber(tableNumber);
    const locText = parsed.isTakeAway ? '(Take Away)' : `(${parsed.area} - Meja ${parsed.table})`;
    return `Halo Admin, saya *${customerName || 'Tamu'}* ${locText}. Saya butuh bantuan terkait pesanan saya.`;
  })();
  const techMessageTemplate = `Halo Tim Support, saya *${customerName || 'Tamu'}*. Saya mengalami kendala teknis saat menggunakan aplikasi pemesanan.`;

  return (
    <div className={isEmbedded ? "space-y-4 animate-in fade-in duration-300 pb-4 px-2" : "flex-1 flex flex-col bg-transparent pb-24 overflow-y-auto animate-in fade-in duration-300 px-4 pt-6"}>
      
      {/* Profil Header Card - Neobrutalism theme */}
      <div className="pb-2">
        <div className="relative bg-white dark:bg-slate-900 text-black dark:text-white border-3 border-black dark:border-slate-700 p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] dark:shadow-[6px_6px_0px_0px_#374151] overflow-hidden rounded-md">
          <div className="flex items-center gap-4 relative z-10">
            {/* Profile Avatar with black border */}
            <div className="w-16 h-16 bg-[#ffc700] border-2 border-black dark:border-slate-700 flex items-center justify-center text-black shrink-0 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_#374151]">
              <User size={30} strokeWidth={3} />
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h1 
                  onClick={openEditModal}
                  className="font-black uppercase tracking-tight text-xl sm:text-2xl text-black dark:text-white leading-tight truncate cursor-pointer hover:text-amber-600 transition-colors"
                  title="Ubah Nama/Nomor"
                >
                  {customerName || 'Tamu'}
                </h1>
                <button 
                  onClick={openEditModal}
                  className="p-1.5 border border-black dark:border-slate-700 bg-[#ffc700] hover:bg-[#ffe066] text-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] dark:shadow-[1px_1px_0px_0px_#374151] transition-all shrink-0 active:translate-x-[0.5px] active:translate-y-[0.5px]"
                  title="Ubah Nama/Nomor"
                >
                  <Edit2 size={12} strokeWidth={3} />
                </button>
              </div>
              
              {/* WhatsApp details if available */}
              {customerPhone && (
                <p className="text-[10px] font-mono text-slate-700 dark:text-slate-300 mt-1 tracking-tight flex items-center gap-1 font-black uppercase">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 border border-black animate-pulse"></span>
                  WA: {customerPhone}
                </p>
              )}

              {/* Table / Order Type Badge */}
              <div className="flex items-center gap-1.5 mt-2.5 text-black dark:text-white text-xs font-bold">
                {(() => {
                  const parsed = parseTableNumber(tableNumber);
                  return parsed.isTakeAway ? (
                    <span className="inline-flex items-center gap-1 bg-white dark:bg-slate-900 border-2 border-black dark:border-slate-700 text-black dark:text-white text-[10px] font-black px-3 py-1.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_#374151] uppercase tracking-wide">
                      Take Away (Bawa Pulang)
                    </span>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 bg-white dark:bg-slate-900 border-2 border-black dark:border-slate-700 text-black dark:text-white text-[10px] font-black px-3 py-1.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_#374151] tracking-wide uppercase leading-none">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 border border-black dark:border-slate-700"></span>
                        {parsed.area}
                      </span>
                      <span className="inline-flex items-center bg-[#ffc700] border-2 border-black dark:border-slate-700 text-black text-[10px] font-black px-3.5 py-1.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_#374151] tracking-wide uppercase leading-none">
                        {/^\d+$/.test(parsed.table) ? `Meja ${parsed.table}` : parsed.table}
                      </span>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Menu List */}
      <div className="px-0.5 space-y-5">
        
        {/* Group 1: Aktivitas */}
        <div>
          <h3 className="px-1 text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2 mt-4">Aktivitas Saya</h3>
          <div className="bg-white dark:bg-slate-900 border-2 border-black dark:border-slate-700 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_#374151] overflow-hidden rounded-none">
            
            {/* Riwayat Pesanan */}
            <button 
              onClick={() => setView('history')} 
              className="w-full p-4 flex items-center justify-between hover:bg-[#fffdf0] dark:hover:bg-slate-800 transition-all group"
            >
              <div className="flex items-center gap-3.5">
                <div className="bg-[#ffc700] border border-black p-2 text-black">
                  <FileText size={20} strokeWidth={2.5} />
                </div>
                <span className="font-black text-xs uppercase tracking-wider text-black dark:text-white text-left">Riwayat Pesanan</span>
              </div>
              <ChevronRight size={18} className="text-black dark:text-white" strokeWidth={3} />
            </button>

            <div className="h-[2px] bg-black dark:bg-slate-700" />
            
            {/* Promo & Voucher */}
            <button 
              onClick={() => setShowVouchers(true)}
              className="w-full p-4 flex items-center justify-between hover:bg-[#fffdf0] dark:hover:bg-slate-800 transition-all group"
            >
              <div className="flex items-center gap-3.5">
                <div className="bg-[#ff90e8] border border-black p-2 text-black">
                  <Ticket size={20} strokeWidth={2.5} />
                </div>
                <span className="font-black text-xs uppercase tracking-wider text-black dark:text-white text-left">Promo & Voucher</span>
              </div>
              <div className="flex items-center gap-2">
                {activeVouchers.length > 0 && (
                  <span className="bg-[#ffc700] text-black border border-black text-[9px] font-black px-2 py-0.5 uppercase tracking-wide">
                    {activeVouchers.length} Promo
                  </span>
                )}
                <ChevronRight size={18} className="text-black dark:text-white" strokeWidth={3} />
              </div>
            </button>
          </div>
        </div>

        {/* Group 2: Bantuan */}
        <div>
          <h3 className="px-1 text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2 mt-2">Pusat Bantuan</h3>
          <div className="bg-white dark:bg-slate-900 border-2 border-black dark:border-slate-700 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_#374151] overflow-hidden rounded-none">
            
            {/* Customer Service Toggle */}
            <button 
              onClick={() => setShowCS(!showCS)} 
              className="w-full p-4 flex items-center justify-between hover:bg-[#fffdf0] dark:hover:bg-slate-800 transition-all group"
            >
              <div className="flex items-center gap-3.5">
                <div className="bg-[#3bf4fb] border border-black p-2 text-black">
                  <Headset size={20} strokeWidth={2.5} />
                </div>
                <div className="text-left">
                  <span className="block font-black text-xs uppercase tracking-wider text-black dark:text-white">Hubungi Kami</span>
                  <span className="block text-[9px] text-slate-500 dark:text-slate-400 mt-0.5 font-bold uppercase">Butuh bantuan? Kami siap membantu</span>
                </div>
              </div>
              <ChevronRight size={18} className={`text-black dark:text-white transition-transform duration-200 ${showCS ? 'rotate-90' : ''}`} strokeWidth={3} />
            </button>
            
            {/* CS Options Dropdown */}
            {showCS && (
              <div className="px-4 pb-5 pt-3 bg-slate-50 dark:bg-slate-800/50 space-y-3 border-t-2 border-black">
                
                {/* Opsi 1: Bantuan Kasir */}
                <button 
                  onClick={() => openWhatsApp(activeKasirWa, orderMessageTemplate)} 
                  className="w-full flex items-center gap-4 bg-white dark:bg-slate-900 border-2 border-black dark:border-slate-700 p-4 active:translate-x-[1px] active:translate-y-[1px] shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_#374151] transition-all group"
                >
                  <div className="w-12 h-12 bg-[#a3e635] border-2 border-black dark:border-slate-700 flex items-center justify-center text-black shrink-0">
                    <MessageCircle size={24} strokeWidth={2.5} />
                  </div>
                  <div className="text-left flex-1">
                    <h4 className="font-black text-xs uppercase tracking-wider text-black dark:text-white">Bantuan Pesanan</h4>
                    <p className="text-[10px] text-slate-600 dark:text-slate-400 mt-0.5 leading-snug font-bold uppercase">Hubungi kasir untuk kendala menu atau pembayaran</p>
                  </div>
                  <ChevronRight size={16} className="text-black dark:text-white" strokeWidth={3} />
                </button>

                {/* Opsi 2: Bantuan Teknis */}
                <button 
                  onClick={() => openWhatsApp(import.meta.env.VITE_TECH_SUPPORT_WA || '085159686554', techMessageTemplate)} 
                  className="w-full flex items-center gap-4 bg-white dark:bg-slate-900 border-2 border-black dark:border-slate-700 p-4 active:translate-x-[1px] active:translate-y-[1px] shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_#374151] transition-all group"
                >
                  <div className="w-12 h-12 bg-[#ffc700] border-2 border-black dark:border-slate-700 flex items-center justify-center text-black shrink-0">
                    <Smartphone size={24} strokeWidth={2.5} />
                  </div>
                  <div className="text-left flex-1">
                    <h4 className="font-black text-xs uppercase tracking-wider text-black dark:text-white">Bantuan Teknis</h4>
                    <p className="text-[10px] text-slate-600 dark:text-slate-400 mt-0.5 leading-snug font-bold uppercase">Laporan error, bug, atau masalah pada aplikasi</p>
                  </div>
                  <ChevronRight size={16} className="text-black dark:text-white" strokeWidth={3} />
                </button>

              </div>
            )}
          </div>
        </div>

      </div>

      {/* Voucher Promo Dialog Modal - Neobrutalist Ticket style */}
      {showVouchers && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 transition-opacity" onClick={() => setShowVouchers(false)} />
          
          <div className="relative bg-white dark:bg-slate-900 w-full max-w-sm border-3 border-black dark:border-slate-700 p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_#374151] flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200 rounded-none">
            
            <button 
              onClick={() => setShowVouchers(false)} 
              className="absolute top-4 right-4 p-2 bg-white dark:bg-slate-800 border-2 border-black dark:border-slate-700 text-black dark:text-white hover:bg-[#ffc700] shadow-[1.5px_1.5px_0px_0px_rgba(0,0,0,1)] dark:shadow-[1.5px_1.5px_0px_0px_#374151] active:scale-95 transition-all z-10"
            >
              <X size={18} strokeWidth={3} />
            </button>
            
            <div className="text-center mb-6 pt-2">
              <div className="w-16 h-16 bg-[#ff90e8] border-2 border-black dark:border-slate-700 flex items-center justify-center mx-auto mb-4 text-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_#374151]">
                <Ticket size={28} strokeWidth={3} />
              </div>
              <h2 className="text-lg font-black uppercase tracking-wider text-black dark:text-white">Promo Spesial</h2>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1 font-bold uppercase leading-relaxed">
                Salin kode di bawah dan gunakan saat melakukan pembayaran.
              </p>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1 custom-scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
              {activeVouchers.length === 0 ? (
                <div className="text-center py-10 border-2 border-dashed border-black">
                  <Ticket size={40} strokeWidth={2} className="mx-auto mb-3 text-black" />
                  <p className="font-black text-sm uppercase tracking-wider text-black">Belum Ada Promo</p>
                  <p className="text-[10px] font-bold text-slate-500 uppercase mt-1">Cek lagi nanti untuk promo menarik lainnya.</p>
                </div>
              ) : (
                activeVouchers.map((v: Voucher) => (
                  <div key={v.id} className="relative bg-white dark:bg-slate-800 border-2 border-black dark:border-slate-700 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_#374151] flex overflow-hidden min-h-[96px]">
                    
                    {/* Left Side (Yellow badge matching theme color) */}
                    <div className="w-24 bg-[#ffc700] border-r-2 border-black dark:border-slate-700 text-black p-3 flex flex-col items-center justify-center shrink-0 text-center">
                      <span className="text-[8px] font-black tracking-widest uppercase leading-none">DISKON</span>
                      <span className="font-black text-lg sm:text-xl leading-none mt-1.5">
                        {v.type === 'percentage' ? `${v.value}%` : v.value >= 1000 ? `${v.value / 1000}k` : v.value}
                      </span>
                      <span className="text-[8px] font-black tracking-wide uppercase mt-1.5 leading-none">KUPON</span>
                    </div>

                    {/* Dashed divider */}
                    <div className="absolute top-0 bottom-0 left-[96px] border-l-2 border-dashed border-black dark:border-slate-700 z-10" />

                    {/* Right Side (Details & Copy Button) */}
                    <div className="flex-1 p-3.5 pl-6 flex flex-col justify-between min-w-0 bg-white dark:bg-slate-800">
                      <div className="min-w-0">
                        <span className="text-[9px] font-black uppercase text-black bg-[#ff90e8] border border-black dark:border-slate-700 px-1.5 py-0.5 inline-block mb-1">
                          Kupon Aktif
                        </span>
                        <p className="font-mono text-sm sm:text-base font-black text-black dark:text-slate-200 tracking-wider truncate uppercase leading-none mt-0.5">
                          {v.code}
                        </p>
                        <p className="text-[10px] text-slate-700 dark:text-slate-400 mt-1.5 font-bold uppercase leading-snug line-clamp-1">
                          {v.description || v.desc || 'Semua produk'}
                        </p>
                      </div>
                      <div className="flex items-center justify-between mt-2 gap-2">
                        <span className="text-[9px] text-slate-500 font-bold uppercase">Klik untuk salin</span>
                        <button 
                          onClick={() => copyToClipboard(v.code)}
                          className="flex items-center gap-1 bg-[#ffc700] hover:bg-[#ffe066] border-2 border-black dark:border-slate-700 text-black text-[10px] font-black px-3 py-2 shadow-[1.5px_1.5px_0px_0px_rgba(0,0,0,1)] dark:shadow-[1.5px_1.5px_0px_0px_#374151] active:translate-x-[0.5px] active:translate-y-[0.5px] active:shadow-none transition-all shrink-0"
                        >
                          <Scissors size={10} strokeWidth={2.5} />
                          Salin
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Edit Profile Modal - Neobrutalist */}
      {isEditOpen && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 transition-opacity animate-in fade-in duration-300" onClick={() => setIsEditOpen(false)} />
          
          <div className="relative bg-white dark:bg-slate-900 w-full max-w-sm border-3 border-black dark:border-slate-700 p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_#374151] flex flex-col animate-in zoom-in-95 duration-200 rounded-none">
            
            <button 
              onClick={() => setIsEditOpen(false)} 
              className="absolute top-4 right-4 p-2 bg-white dark:bg-slate-800 border-2 border-black dark:border-slate-700 text-black dark:text-white hover:bg-[#ffc700] shadow-[1.5px_1.5px_0px_0px_rgba(0,0,0,1)] dark:shadow-[1.5px_1.5px_0px_0px_#374151] active:scale-95 transition-all z-10"
            >
              <X size={18} strokeWidth={3} />
            </button>
            
            <div className="text-center mb-6 pt-2">
              <div className="w-16 h-16 bg-[#ffc700] border-2 border-black dark:border-slate-700 flex items-center justify-center mx-auto mb-4 text-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_#374151]">
                <User size={28} strokeWidth={3} />
              </div>
              <h2 className="text-lg font-black uppercase tracking-wider text-black dark:text-white">Ubah Profil</h2>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1 font-bold uppercase leading-relaxed">
                Perbarui nama dan nomor WhatsApp Anda untuk pemesanan.
              </p>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              {/* Input Nama */}
              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase tracking-wide text-black dark:text-white ml-1">
                  Nama Pemesan
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-black">
                    <User size={18} strokeWidth={3} />
                  </div>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Cth: Budi..."
                    className="w-full pl-11 pr-4 py-3 bg-white dark:bg-slate-950 border-2 border-black dark:border-slate-700 text-black dark:text-white font-bold placeholder-slate-400 focus:bg-[#fffdf0] focus:text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_#374151]"
                    required
                  />
                </div>
              </div>

              {/* Input Nomor WhatsApp */}
              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase tracking-wide text-black dark:text-white ml-1">
                  Nomor WhatsApp
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-black">
                    <Phone size={18} strokeWidth={3} />
                  </div>
                  <input
                    type="text"
                    value={editPhone}
                    onChange={(e) => {
                      const cleaned = e.target.value.replace(/\D/g, '');
                      if (cleaned.length <= 12) {
                        setEditPhone(cleaned);
                      }
                    }}
                    maxLength={12}
                    placeholder="Cth: 08123456789..."
                    className="w-full pl-11 pr-4 py-3 bg-white dark:bg-slate-950 border-2 border-black dark:border-slate-700 text-black dark:text-white font-bold placeholder-slate-400 focus:bg-[#fffdf0] focus:text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_#374151]"
                    required={isWhatsappEnabled}
                  />
                </div>
                <p className="text-[10px] text-red-600 font-bold uppercase ml-1">
                  {isWhatsappEnabled 
                    ? "*Wajib diisi untuk menerima notifikasi pesanan siap saji via WhatsApp."
                    : "*Opsional. Digunakan jika notifikasi WhatsApp diaktifkan."
                  }
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={!editName.trim() || editName.trim().toLowerCase() === 'tamu' || (isWhatsappEnabled && !editPhone.trim())}
                  className="w-full flex items-center justify-center gap-2 bg-[#a3e635] hover:bg-[#bbf255] text-black font-black uppercase tracking-wider text-xs py-4 border-2 border-black dark:border-slate-700 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_#374151] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
      
    </div>
  );
}
