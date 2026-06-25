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
    <div className={isEmbedded ? "space-y-4 animate-in fade-in duration-300 pb-4 px-2" : "flex-1 flex flex-col bg-slate-50 dark:bg-slate-950 pb-24 overflow-y-auto animate-in fade-in duration-300 px-4 pt-6"}>
      
      {/* Profil Header Card - Redesigned Warm/Professional Theme */}
      <div className="pb-2">
        <div className="relative bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-[2rem] p-6 shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
          {/* Decorative glowing background patterns */}
          <div className="absolute top-[-40%] right-[-20%] w-56 h-56 bg-amber-500/5 dark:bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-[-30%] left-[-10%] w-40 h-40 bg-orange-500/5 dark:bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="flex items-center gap-4 relative z-10">
            {/* Beautiful Profile Avatar with amber border */}
            <div className="w-16 h-16 bg-amber-500/10 dark:bg-amber-500/20 backdrop-blur-md rounded-full flex items-center justify-center text-amber-500 dark:text-amber-400 shrink-0 border border-amber-100 dark:border-amber-900/40 shadow-sm">
              <User size={30} strokeWidth={1.5} />
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h1 
                  onClick={openEditModal}
                  className="font-extrabold text-xl sm:text-2xl text-slate-900 dark:text-white leading-tight truncate cursor-pointer hover:text-amber-500 dark:hover:text-amber-400 transition-colors"
                  title="Ubah Nama/Nomor"
                >
                  {customerName || 'Tamu'}
                </h1>
                <button 
                  onClick={openEditModal}
                  className="p-1 text-slate-400 hover:text-amber-500 dark:hover:text-amber-400 transition-colors shrink-0"
                  title="Ubah Nama/Nomor"
                >
                  <Edit2 size={16} />
                </button>
              </div>
              
              {/* WhatsApp details if available */}
              {customerPhone && (
                <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-0.5 tracking-tight flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  WA: {customerPhone}
                </p>
              )}

              {/* Table / Order Type Badge */}
              <div className="flex items-center gap-1.5 mt-2.5 text-slate-600 dark:text-slate-300 text-xs font-medium">
                {(() => {
                  const parsed = parseTableNumber(tableNumber);
                  return parsed.isTakeAway ? (
                    <span className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-[9px] sm:text-[10px] font-extrabold px-3 py-1.5 rounded-xl shadow-sm uppercase tracking-wide">
                      Take Away (Bawa Pulang)
                    </span>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-[9px] sm:text-[10px] font-extrabold px-3 py-1.5 rounded-xl shadow-sm tracking-wide uppercase leading-none">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                        {parsed.area}
                      </span>
                      <span className="inline-flex items-center bg-gradient-to-r from-amber-500 to-orange-500 border-0 text-white text-[9px] sm:text-[10px] font-black px-3.5 py-1.5 rounded-xl shadow-md tracking-wide uppercase leading-none">
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
      <div className="px-4 space-y-5">
        
        {/* Group 1: Aktivitas */}
        <div>
          <h3 className="px-4 text-[11px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2 mt-4">Aktivitas Saya</h3>
          <div className="bg-white dark:bg-slate-900 rounded-[1.5rem] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
            
            {/* Riwayat Pesanan */}
            <button 
              onClick={() => setView('history')} 
              className="w-full p-4 flex items-center justify-between hover:bg-amber-500/5 dark:hover:bg-amber-500/10 active:bg-slate-100 transition-all duration-200 group"
            >
              <div className="flex items-center gap-3.5">
                <div className="bg-amber-500/10 p-2.5 rounded-xl text-amber-500 group-hover:scale-110 transition-transform">
                  <FileText size={20} strokeWidth={2} />
                </div>
                <span className="font-semibold text-slate-700 dark:text-slate-200 text-left">Riwayat Pesanan</span>
              </div>
              <ChevronRight size={18} className="text-slate-400 group-hover:translate-x-1 transition-transform" />
            </button>

            <div className="h-[1px] bg-slate-100 dark:bg-slate-800 mx-4" />
            
            {/* Promo & Voucher */}
            <button 
              onClick={() => setShowVouchers(true)}
              className="w-full p-4 flex items-center justify-between hover:bg-amber-500/5 dark:hover:bg-amber-500/10 active:bg-slate-100 transition-all duration-200 group"
            >
              <div className="flex items-center gap-3.5">
                <div className="bg-orange-500/10 p-2.5 rounded-xl text-orange-500 group-hover:scale-110 transition-transform">
                  <Ticket size={20} strokeWidth={2} />
                </div>
                <span className="font-semibold text-slate-700 dark:text-slate-200 text-left">Promo & Voucher</span>
              </div>
              <div className="flex items-center gap-2">
                {activeVouchers.length > 0 && (
                  <span className="bg-orange-500/10 text-orange-500 dark:bg-orange-500/20 dark:text-orange-400 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {activeVouchers.length} Promo
                  </span>
                )}
                <ChevronRight size={18} className="text-slate-400 group-hover:translate-x-1 transition-transform" />
              </div>
            </button>
          </div>
        </div>

        {/* Group 2: Bantuan */}
        <div>
          <h3 className="px-4 text-[11px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2 mt-2">Pusat Bantuan</h3>
          <div className="bg-white dark:bg-slate-900 rounded-[1.5rem] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
            
            {/* Customer Service Toggle */}
            <button 
              onClick={() => setShowCS(!showCS)} 
              className="w-full p-4 flex items-center justify-between hover:bg-amber-500/5 dark:hover:bg-amber-500/10 active:bg-slate-100 transition-all duration-200 group"
            >
              <div className="flex items-center gap-3.5">
                <div className="bg-emerald-500/10 p-2.5 rounded-xl text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform">
                  <Headset size={20} strokeWidth={2} />
                </div>
                <div className="text-left">
                  <span className="block font-semibold text-slate-700 dark:text-slate-200">Hubungi Kami</span>
                  <span className="block text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 font-medium">Butuh bantuan? Kami siap membantu</span>
                </div>
              </div>
              <ChevronRight size={18} className={`text-slate-400 transition-all duration-300 group-hover:translate-x-1 ${showCS ? 'rotate-90 text-amber-500' : ''}`} />
            </button>
            
            {/* CS Options Dropdown */}
            {showCS && (
              <div className="px-4 pb-5 pt-2 bg-slate-50/50 dark:bg-slate-800/10 space-y-3 animate-in slide-in-from-top-2 duration-300 border-t border-slate-100 dark:border-slate-800">
                
                {/* Opsi 1: Bantuan Kasir */}
                <button 
                  onClick={() => openWhatsApp(activeKasirWa, orderMessageTemplate)} 
                  className="w-full flex items-center gap-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 rounded-2xl active:scale-[0.98] hover:shadow-md hover:border-amber-500/20 dark:hover:border-amber-500/10 transition-all group"
                >
                  <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform shrink-0">
                    <MessageCircle size={24} strokeWidth={1.5} />
                  </div>
                  <div className="text-left flex-1">
                    <h4 className="font-semibold text-sm text-slate-800 dark:text-slate-100 group-hover:text-amber-500 transition-colors">Bantuan Pesanan</h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">Hubungi kasir untuk kendala menu atau pembayaran</p>
                  </div>
                  <ChevronRight size={16} className="text-slate-300 dark:text-slate-600 group-hover:text-amber-500 transition-colors" />
                </button>

                {/* Opsi 2: Bantuan Teknis */}
                <button 
                  onClick={() => openWhatsApp(import.meta.env.VITE_TECH_SUPPORT_WA || '085159686554', techMessageTemplate)} 
                  className="w-full flex items-center gap-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 rounded-2xl active:scale-[0.98] hover:shadow-md hover:border-amber-500/20 dark:hover:border-amber-500/10 transition-all group"
                >
                  <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500 group-hover:scale-110 transition-transform shrink-0">
                    <Smartphone size={24} strokeWidth={1.5} />
                  </div>
                  <div className="text-left flex-1">
                    <h4 className="font-semibold text-sm text-slate-800 dark:text-slate-100 group-hover:text-amber-500 transition-colors">Bantuan Teknis</h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">Laporan error, bug, atau masalah pada aplikasi</p>
                  </div>
                  <ChevronRight size={16} className="text-slate-300 dark:text-slate-600 group-hover:text-amber-500 transition-colors" />
                </button>

              </div>
            )}
          </div>
        </div>

      </div>

      {/* Voucher Promo Dialog Modal - Redesigned Ticket style with dynamic theme color */}
      {showVouchers && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={() => setShowVouchers(false)} />
          
          <div className="relative bg-white dark:bg-slate-900 w-full max-w-sm rounded-[2rem] p-6 shadow-2xl border border-slate-100 dark:border-slate-800 flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
            
            <button 
              onClick={() => setShowVouchers(false)} 
              className="absolute top-4 right-4 p-2.5 bg-slate-100 hover:bg-amber-500/10 dark:bg-slate-800 dark:hover:bg-amber-500/10 text-slate-500 hover:text-amber-500 rounded-full transition-colors z-10"
            >
              <X size={18} strokeWidth={2.5} />
            </button>
            
            <div className="text-center mb-6 pt-2">
              <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-4 text-amber-500 shadow-inner">
                <Ticket size={28} strokeWidth={1.5} />
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Promo Spesial</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-[220px] mx-auto leading-relaxed">
                Salin kode di bawah dan gunakan saat melakukan pembayaran.
              </p>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1 custom-scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
              {activeVouchers.length === 0 ? (
                <div className="text-center py-10">
                  <Ticket size={40} strokeWidth={1} className="mx-auto mb-3 text-slate-300 dark:text-slate-600" />
                  <p className="font-semibold text-slate-800 dark:text-slate-200">Belum Ada Promo</p>
                  <p className="text-xs text-slate-500 mt-1">Cek lagi nanti untuk promo menarik lainnya.</p>
                </div>
              ) : (
                activeVouchers.map((v: Voucher) => (
                  <div key={v.id} className="relative bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 rounded-2xl shadow-sm hover:shadow-md transition-all flex overflow-hidden min-h-[96px]">
                    
                    {/* Left Side (Gradient badge matching theme color) */}
                    <div className="w-24 bg-gradient-to-br from-amber-500 to-orange-600 text-white p-3 flex flex-col items-center justify-center shrink-0 text-center">
                      <span className="text-[8px] font-bold tracking-widest uppercase opacity-80 leading-none">DISKON</span>
                      <span className="font-black text-lg sm:text-xl leading-none mt-1.5">
                        {v.type === 'percentage' ? `${v.value}%` : v.value >= 1000 ? `${v.value / 1000}k` : v.value}
                      </span>
                      <span className="text-[8px] font-medium tracking-wide uppercase opacity-70 mt-1.5 leading-none">KUPON</span>
                    </div>

                    {/* Dashed divider & cutouts */}
                    <div className="absolute top-0 bottom-0 left-[96px] border-l-2 border-dashed border-slate-200 dark:border-slate-700 z-10" />
                    <div className="absolute -top-2 left-[88px] w-4 h-4 bg-white dark:bg-slate-900 rounded-full border border-slate-200/60 dark:border-slate-800/80 z-10" />
                    <div className="absolute -bottom-2 left-[88px] w-4 h-4 bg-white dark:bg-slate-900 rounded-full border border-slate-200/60 dark:border-slate-800/80 z-10" />

                    {/* Right Side (Details & Copy Button) */}
                    <div className="flex-1 p-3.5 pl-6 flex flex-col justify-between min-w-0">
                      <div className="min-w-0">
                        <span className="text-[9px] font-extrabold text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded-md inline-block mb-1">
                          Kupon Aktif
                        </span>
                        <p className="font-mono text-sm sm:text-base font-black text-slate-800 dark:text-slate-200 tracking-wider truncate uppercase leading-none mt-0.5">
                          {v.code}
                        </p>
                        {/* Deskripsi kegunaan voucher */}
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1.5 font-semibold leading-snug line-clamp-1">
                          {v.description || v.desc || 'Semua produk'}
                        </p>
                      </div>
                      <div className="flex items-center justify-between mt-2 gap-2">
                        <span className="text-[9px] text-slate-400 dark:text-slate-500 font-medium">Klik untuk salin</span>
                        <button 
                          onClick={() => copyToClipboard(v.code)}
                          className="flex items-center gap-1 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px] font-bold px-3 py-2 rounded-xl active:scale-95 transition-all shadow-sm shrink-0"
                        >
                          <Scissors size={10} />
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

      {/* Edit Profile Modal */}
      {isEditOpen && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity animate-in fade-in duration-300" onClick={() => setIsEditOpen(false)} />
          
          <div className="relative bg-white dark:bg-slate-900 w-full max-w-sm rounded-[2rem] p-6 shadow-2xl border border-slate-100 dark:border-slate-800 flex flex-col animate-in zoom-in-95 duration-200">
            
            <button 
              onClick={() => setIsEditOpen(false)} 
              className="absolute top-4 right-4 p-2.5 bg-slate-100 hover:bg-amber-500/10 dark:bg-slate-800 dark:hover:bg-amber-500/10 text-slate-500 hover:text-amber-500 rounded-full transition-colors z-10"
            >
              <X size={18} strokeWidth={2.5} />
            </button>
            
            <div className="text-center mb-6 pt-2">
              <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-4 text-amber-500 shadow-inner">
                <User size={28} strokeWidth={1.5} />
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Ubah Profil</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                Perbarui nama dan nomor WhatsApp Anda untuk pemesanan.
              </p>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4">
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
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Cth: Budi..."
                    className="w-full pl-11 pr-4 py-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 dark:focus:border-amber-500 transition-all"
                    required
                  />
                </div>
              </div>

              {/* Input Nomor WhatsApp */}
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1">
                  Nomor WhatsApp
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
                    <Phone size={18} />
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
                    className="w-full pl-11 pr-4 py-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 dark:focus:border-amber-500 transition-all"
                    required={isWhatsappEnabled}
                  />
                </div>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 ml-1">
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
                  className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-black uppercase tracking-wider text-xs py-4 rounded-2xl shadow-lg shadow-amber-500/20 hover:opacity-95 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
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
