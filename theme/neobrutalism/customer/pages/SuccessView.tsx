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
    <div className="flex-1 flex flex-col bg-transparent min-h-screen items-center justify-center p-6 text-center animate-in fade-in duration-300">
      
      {/* Animated Success Icon */}
      <div className="relative mb-8">
        {/* Main Circle - Neobrutalist styled */}
        <div className="relative w-28 h-28 bg-[#a3e635] border-3 border-black dark:border-slate-700 flex items-center justify-center text-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] dark:shadow-[6px_6px_0px_0px_#374151] rounded-none">
          <Check size={56} strokeWidth={4} className="animate-in zoom-in spin-in-12 duration-500 delay-150" />
        </div>
      </div>

      {/* Typography */}
      <h2 className="text-2xl font-black text-black dark:text-white uppercase tracking-wider mb-3">
        {isLunas 
          ? 'Pembayaran Berhasil!' 
          : isManualNonCash 
            ? 'Pesanan Dicatat!' 
            : 'Pesanan Telah Dicatat!'}
      </h2>
      <p className="text-slate-600 dark:text-slate-300 font-bold uppercase text-[10px] mb-8 max-w-[320px] mx-auto leading-relaxed">
        {isLunas 
          ? 'Terima kasih, pembayaran telah diterima dan pesanan Anda segera kami siapkan.' 
          : isManualNonCash
            ? `Silakan selesaikan transfer ${FORMAT_IDR(total)} ke rekening tujuan, lalu tekan tombol kirim bukti pembayaran via WhatsApp di bawah.`
            : `Silakan siapkan uang tunai sebesar ${FORMAT_IDR(total)} dan lakukan pembayaran di kasir agar pesanan Anda dapat diproses.`}
      </p>

      {/* Mini Order Summary Card */}
      <div className="w-full max-w-sm bg-white dark:bg-slate-900 border-2 border-black dark:border-slate-700 p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_#374151] mb-8 text-left space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">
              Nomor Pesanan
            </p>
            <p className="font-black text-black dark:text-white text-sm uppercase tracking-wider">
              {orderNumber}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">
              Status
            </p>
            <span className={`inline-flex items-center px-2.5 py-0.5 border border-black text-[9px] font-black uppercase ${isLunas ? 'bg-[#a3e635] text-black' : 'bg-[#ffc700] text-black'}`}>
              {isLunas ? 'Lunas' : 'Belum Lunas'}
            </span>
          </div>
        </div>

        <div className="border-t-2 border-dashed border-black dark:border-slate-700 pt-3 space-y-2 text-[10px] font-bold uppercase text-slate-600 dark:text-slate-300">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span className="font-black text-black dark:text-white">{FORMAT_IDR(liveTransaction?.subtotal || 0)}</span>
          </div>
          {(liveTransaction?.discount_amount || liveTransaction?.discountAmount) > 0 && (
            <div className="flex justify-between text-red-600">
              <span>Diskon</span>
              <span className="font-black">-{FORMAT_IDR(liveTransaction?.discount_amount || liveTransaction?.discountAmount || 0)}</span>
            </div>
          )}
          {(liveTransaction?.tax_amount || liveTransaction?.taxAmount) > 0 && (
            <div className="flex justify-between text-black dark:text-white">
              <span>Pajak (PPN)</span>
              <span className="font-black">+{FORMAT_IDR(liveTransaction?.tax_amount || liveTransaction?.taxAmount || 0)}</span>
            </div>
          )}
          {(liveTransaction?.admin_fee || liveTransaction?.adminFee) > 0 && (
            <div className="flex justify-between text-black dark:text-white">
              <span>Biaya Admin</span>
              <span className="font-black">+{FORMAT_IDR(liveTransaction?.admin_fee || liveTransaction?.adminFee || 0)}</span>
            </div>
          )}
          <div className="flex justify-between text-xs font-black text-black dark:text-white border-t-2 border-dashed border-black dark:border-slate-700 pt-2 uppercase">
            <span>Total</span>
            <span className="font-black text-base">{FORMAT_IDR(total)}</span>
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
              className="w-full flex items-center justify-center gap-2 py-4 bg-[#a3e635] hover:bg-[#bbf255] border-2 border-black dark:border-slate-700 text-black font-black uppercase tracking-wider text-sm shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_#374151] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all"
            >
              <MessageCircle size={20} strokeWidth={3} />
              Kirim Bukti via WhatsApp
            </button>
            <div className="w-full text-center py-2 text-[10px] font-black uppercase text-black flex items-center justify-center gap-1.5 bg-[#ffc700] border-2 border-black dark:border-slate-700 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_#374151]">
              <span className="w-2 h-2 rounded-full bg-black animate-pulse" />
              Menunggu Verifikasi Pembayaran Admin
            </div>
          </>
        ) : (
          /* Tombol Utama (Struk) */
          <button 
            onClick={() => setReceiptOpen(true)}
            disabled={!isLunas}
            className={`w-full flex items-center justify-center gap-2 py-4 font-black uppercase tracking-wider text-sm border-2 border-black dark:border-slate-700 transition-all ${
              isLunas 
                ? 'bg-[#ffc700] hover:bg-[#ffe066] text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_#374151] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none' 
                : 'bg-slate-200 text-slate-500 cursor-not-allowed opacity-60'
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
            className="flex items-center justify-center gap-2 bg-white dark:bg-slate-900 border-2 border-black dark:border-slate-700 text-black dark:text-white hover:bg-[#fffdf0] py-3.5 font-black uppercase tracking-wider text-xs shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_#374151] active:translate-x-[0.5px] active:translate-y-[0.5px] active:shadow-none transition-all"
          >
            <ChefHat size={18} strokeWidth={2.5} />
            Lacak Pesanan
          </button>
          
          <button 
            onClick={() => setView('landing')}
            className="flex items-center justify-center gap-2 bg-white dark:bg-slate-950 border-2 border-black dark:border-slate-700 text-black dark:text-white hover:bg-[#fffdf0] py-3.5 font-black uppercase tracking-wider text-xs shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_#374151] active:translate-x-[0.5px] active:translate-y-[0.5px] active:shadow-none transition-all"
          >
            <Home size={18} strokeWidth={2.5} />
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
