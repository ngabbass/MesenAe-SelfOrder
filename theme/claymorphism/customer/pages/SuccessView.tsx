import React, { useState, useEffect } from 'react';
import { Check, Home, ChefHat, MessageCircle } from 'lucide-react';
import { RpIcon } from '@/components/ui/RpIcon';
import Receipt from '../../components/Receipt';
import { useDbQuery, StoreSettings } from '@/hooks/db-hooks';
import { FORMAT_IDR } from '@/lib/utils';
import { requestForToken } from '@/lib/fcm';
import { toast } from 'sonner';

// ==========================================
// Tipe Data & Interfaces (TypeScript)
// ==========================================

export interface TransactionData {
  status?: string;
  receipt_number?: string;
  receiptNumber?: string;
  total?: number;
  [key: string]: any; // Untuk mendukung properti lain dari database
}

export interface FinalOrderData {
  transaction?: TransactionData;
  items?: any[]; // Bisa diganti dengan interface CartItem spesifik jika ada
  paymentMethodName?: string;
  [key: string]: any;
}

export interface SuccessViewProps {
  setView: (view: string) => void;
  finalOrderData: FinalOrderData | null;
}

export default function SuccessView({ setView, finalOrderData }: SuccessViewProps) {
  // Diubah ke false agar pengguna bisa melihat layar "Sukses" yang cantik ini
  // sebelum memutuskan untuk membuka popup Struk secara manual.
  const [receiptOpen, setReceiptOpen] = useState<boolean>(false); 
  
  // Mengambil dan menentukan tipe data query dari DB
  const storeSettingsList = (useDbQuery('storeSettings') as StoreSettings[]) ?? [];
  const storeSettings: StoreSettings | undefined = storeSettingsList[0] || undefined;
  
  // Ambil data transaksi secara real-time dari Firestore
  const allTransactions = (useDbQuery('transactions') as TransactionData[]) ?? [];
  const liveTransaction = allTransactions.find(t => t.id === finalOrderData?.transaction?.id) || finalOrderData?.transaction;

  // Memastikan layar kembali ke atas saat masuk ke halaman ini
  useEffect(() => {
    window.scrollTo(0, 0);
    
    // Minta izin notifikasi (FCM) secara elegan setelah berhasil pesan
    const custName = finalOrderData?.transaction?.customer_name || 'Tamu';
    requestForToken('customer', custName).then(token => {
      // customer push token opt-in
    }).catch(console.error);
  }, [finalOrderData]);

  if (!finalOrderData) return null;

  const isLunas: boolean = liveTransaction?.status === 'lunas' || liveTransaction?.status === 'completed';
  const orderNumber: string = liveTransaction?.receipt_number || liveTransaction?.receiptNumber || 'TX-???';
  const total: number = liveTransaction?.total || 0;
  
  // Deteksi pembayaran manual non-kasir (QRIS manual, E-Wallet manual, Transfer Bank manual)
  const isManualNonCash = !isLunas && 
    (liveTransaction?.remarks || '').toLowerCase().includes('manual') && 
    !(liveTransaction?.remarks || '').toLowerCase().includes('kasir');

  // Kirim bukti transfer manual via WhatsApp
  const handleSendWaProof = () => {
    let rawPhone = storeSettings?.phone || '';
    rawPhone = rawPhone.replace(/[^0-9]/g, '');
    if (rawPhone.startsWith('0')) {
      rawPhone = '62' + rawPhone.substring(1);
    }

    const tableText = liveTransaction?.table_number === 'Bawa Pulang' 
      ? 'Take Away (Bawa Pulang)' 
      : `Meja ${liveTransaction?.table_number || '-'}`;

    const itemsText = (finalOrderData.items || []).map((item: any) => 
      `- ${item.product_name || item.name} x${item.quantity || item.qty} (${FORMAT_IDR(item.subtotal || item.price * item.quantity)})`
    ).join('\n');

    const subtotal = liveTransaction?.subtotal || 0;
    const discountAmount = liveTransaction?.discount_amount || liveTransaction?.discountAmount || 0;
    const taxAmount = liveTransaction?.tax_amount || liveTransaction?.taxAmount || 0;
    const adminFee = liveTransaction?.admin_fee || liveTransaction?.adminFee || 0;
    
    const discountLine = discountAmount > 0 ? `\n- Diskon: -${FORMAT_IDR(discountAmount)}` : '';
    const ppnLine = taxAmount > 0 ? `\n- Pajak (PPN): +${FORMAT_IDR(taxAmount)}` : '';
    const adminLine = adminFee > 0 ? `\n- Biaya Admin: +${FORMAT_IDR(adminFee)}` : '';

    const text = encodeURIComponent(
`Halo Admin, saya ingin mengirimkan bukti pembayaran untuk pesanan saya:

*Detail Pemesan:*
- Nama: ${liveTransaction?.customer_name || 'Tamu'}
- No. Meja/Tipe: ${tableText}
- No. Struk: ${orderNumber}

*Detail Pesanan:*
${itemsText}
- Subtotal: ${FORMAT_IDR(subtotal)}${discountLine}${ppnLine}${adminLine}
*Total Tagihan:* ${FORMAT_IDR(total)}
*Metode Pembayaran:* ${finalOrderData.paymentMethodName || 'Manual'}

Berikut saya lampirkan bukti pembayarannya. Mohon segera diproses. Terima kasih!`
    );

    if (!rawPhone) {
      toast.error('Nomor WhatsApp admin belum dikonfigurasi');
      return;
    }

    window.open(`https://wa.me/${rawPhone}?text=${text}`, '_blank');
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-50 dark:bg-slate-950 min-h-screen items-center justify-center p-6 text-center animate-in fade-in duration-300">
      
      {/* Animated Success Icon */}
      <div className="relative mb-8">
        {/* Background pulsing glow */}
        <div className="absolute inset-0 bg-emerald-500/20 dark:bg-emerald-500/10 rounded-full animate-ping" style={{ animationDuration: '2s' }} />
        
        {/* Main Circle */}
        <div className="relative w-28 h-28 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center text-emerald-500 dark:text-emerald-400 shadow-inner border-4 border-white dark:border-slate-900">
          <Check size={56} strokeWidth={3} className="animate-in zoom-in spin-in-12 duration-500 delay-150" />
        </div>
      </div>

      {/* Typography */}
      <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-3 tracking-tight">
        {isLunas 
          ? 'Pembayaran Berhasil!' 
          : isManualNonCash 
            ? 'Pesanan Dicatat!' 
            : 'Pesanan Telah Dicatat!'}
      </h2>
      <p className="text-slate-500 dark:text-slate-400 mb-8 max-w-[320px] mx-auto leading-relaxed text-sm">
        {isLunas 
          ? 'Terima kasih, pembayaran telah diterima dan pesanan Anda segera kami siapkan.' 
          : isManualNonCash
            ? `Silakan selesaikan transfer ${FORMAT_IDR(total)} ke rekening tujuan, lalu tekan tombol kirim bukti pembayaran via WhatsApp di bawah.`
            : `Silakan siapkan uang tunai sebesar ${FORMAT_IDR(total)} dan lakukan pembayaran di kasir agar pesanan Anda dapat diproses.`}
      </p>

      {/* Mini Order Summary Card */}
      <div className="w-full max-w-sm p-5 mb-8 text-left space-y-4 clay-card">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">
              Nomor Pesanan
            </p>
            <p className="font-extrabold text-slate-900 dark:text-white text-base">
              {orderNumber}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">
              Status
            </p>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${isLunas ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400' : 'bg-blue-100 text-blue-800 dark:bg-blue-950/30 dark:text-blue-400'}`}>
              {isLunas ? 'Lunas' : 'Belum Lunas'}
            </span>
          </div>
        </div>

        <div className="border-t border-slate-100 dark:border-slate-800 pt-3 space-y-2 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span className="font-bold text-slate-800 dark:text-slate-200">{FORMAT_IDR(liveTransaction?.subtotal || 0)}</span>
          </div>
          {(liveTransaction?.discount_amount || liveTransaction?.discountAmount) > 0 && (
            <div className="flex justify-between text-red-500">
              <span>Diskon</span>
              <span className="font-bold">-{FORMAT_IDR(liveTransaction?.discount_amount || liveTransaction?.discountAmount || 0)}</span>
            </div>
          )}
          {(liveTransaction?.tax_amount || liveTransaction?.taxAmount) > 0 && (
            <div className="flex justify-between text-blue-600 dark:text-blue-400">
              <span>Pajak (PPN)</span>
              <span className="font-bold">+{FORMAT_IDR(liveTransaction?.tax_amount || liveTransaction?.taxAmount || 0)}</span>
            </div>
          )}
          {(liveTransaction?.admin_fee || liveTransaction?.adminFee) > 0 && (
            <div className="flex justify-between text-blue-600 dark:text-blue-400">
              <span>Biaya Admin</span>
              <span className="font-bold">+{FORMAT_IDR(liveTransaction?.admin_fee || liveTransaction?.adminFee || 0)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm font-black text-slate-900 dark:text-white border-t border-slate-100 dark:border-slate-800 pt-2">
            <span>Total</span>
            <span className="text-blue-600 dark:text-blue-400">{FORMAT_IDR(total)}</span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="space-y-3 w-full max-w-sm">
        
        {/* Render WA proof submission if manual non-cash */}
        {isManualNonCash ? (
          <>
            <button 
              onClick={handleSendWaProof}
              className="w-full flex items-center justify-center gap-2 rounded-[1.2rem] py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-base transition-all active:scale-[0.98] shadow-lg shadow-emerald-600/20"
            >
              <MessageCircle size={20} strokeWidth={2.5} />
              Kirim Bukti via WhatsApp
            </button>
            <div className="w-full text-center py-2 text-xs font-semibold text-blue-500 flex items-center justify-center gap-1.5 bg-blue-500/5 rounded-xl border border-blue-500/10">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              Menunggu Verifikasi Pembayaran Admin
            </div>
          </>
        ) : (
          /* Tombol Utama (Struk) */
          <button 
            onClick={() => setReceiptOpen(true)}
            disabled={!isLunas}
            className={`w-full flex items-center justify-center gap-2 py-4 font-bold text-base uppercase transition-all ${
              isLunas 
                ? 'clay-btn-primary' 
                : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed border border-slate-200 dark:border-slate-700 shadow-inner rounded-2xl'
            }`}
          >
            <RpIcon size={20} strokeWidth={2.5} />
            {isLunas ? 'Lihat Struk Digital' : 'Menunggu Konfirmasi Kasir'}
          </button>
        )}

        {/* Tombol Sekunder (Split jadi 2) */}
        <div className="grid grid-cols-2 gap-3">
          <button 
            onClick={() => setView('tracking')}
            className="flex items-center justify-center gap-2 clay-btn-secondary py-3 text-sm font-bold"
          >
            <ChefHat size={18} />
            Lacak Pesanan
          </button>
          
          <button 
            onClick={() => setView('landing')}
            className="flex items-center justify-center gap-2 clay-btn-secondary py-3 text-sm font-bold"
          >
            <Home size={18} />
            Ke Beranda
          </button>
        </div>

      </div>

      {/* Komponen Struk Modal */}
      <Receipt 
        open={receiptOpen}
        onClose={() => setReceiptOpen(false)}
        transaction={liveTransaction as any}
        items={finalOrderData.items}
        storeSettings={storeSettings}
        paymentMethodName={finalOrderData.paymentMethodName}
      />
    </div>
  );
}
