import React, { useState, useEffect } from 'react';
import { 
  ChevronLeft, Clock, 
  ChevronRight, CheckCircle2, Package, XCircle, FileText,
  LucideIcon, MessageCircle
} from 'lucide-react';
import { RpIcon } from '@/components/ui/RpIcon';
import { FORMAT_IDR, getLocalTransactionIds } from '@/lib/utils';
import { fetchTransactionItems, appendPaymentToTransactionByReceipt, dbUpsert } from '@/lib/db';
import { useDbQuery } from '@/hooks/db-hooks';
import { toast } from 'sonner';
import ReceiptModal from '../../components/Receipt';
import { MidtransPaymentModal } from '../../components/MidtransPaymentModal';

// 1. Definisikan tipe untuk Data Transaksi
interface Transaction {
  id: string | number;
  date?: string | Date;
  created_at?: string | Date;
  status?: string;
  receipt_number?: string;
  total: number;
  table_number?: string | number | null;
}

// 2. Definisikan tipe untuk Props Komponen
interface HistoryViewProps {
  setView: (view: string) => void;
  customerName?: string | null;
  storeSettings?: any;
  isEmbedded?: boolean;
}

// 3. Definisikan tipe untuk return value dari fungsi getStatusDisplay
interface StatusDisplay {
  bg: string;
  text: string;
  label: string;
  Icon: LucideIcon;
}

export default function HistoryView({ 
  setView, 
  customerName, 
  storeSettings,
  isEmbedded = false 
}: HistoryViewProps) {
  const [loading, setLoading] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return sessionStorage.getItem('mesenae_history_cached') !== 'true';
  });
  const [visibleCount, setVisibleCount] = useState<number>(10);

  // States untuk Struk Modal
  const [selectedTx, setSelectedTx] = useState<any | null>(null);
  const [selectedItems, setSelectedItems] = useState<any[]>([]);
  const [selectedPmName, setSelectedPmName] = useState<string>('Pembayaran');
  const [receiptOpen, setReceiptOpen] = useState<boolean>(false);

  // States untuk Lanjutkan Split Bill
  const [midtransOpen, setMidtransOpen] = useState(false);
  const [splitTxToPay, setSplitTxToPay] = useState<any | null>(null);
  const [splitRemaining, setSplitRemaining] = useState<number>(0);

  // Realtime data dari Firestore via snapshot
  const allTxs = (useDbQuery<any>('transactions') || []) as any[];
  const allPaymentMethods = useDbQuery<any>('paymentMethods') || [];

  // Filter sesuai pelanggan + device ini saja
  const history: Transaction[] = React.useMemo(() => {
    const localTxIds = getLocalTransactionIds().map(String);
    return allTxs
      .filter(tx => {
        const matchName = customerName && (tx.customer_name === customerName || tx.customerName === customerName);
        const matchId = localTxIds.includes(String(tx.id));
        return matchName || matchId;
      })
      .sort((a, b) => {
        const dateA = new Date(a.date || a.created_at || 0).getTime();
        const dateB = new Date(b.date || b.created_at || 0).getTime();
        return dateB - dateA;
      }) as Transaction[];
  }, [allTxs, customerName]);

  // Loading hanya sebentar saat mount (data dari snapshot)
  useEffect(() => {
    if (loading) {
      if (allTxs.length > 0) {
        setLoading(false);
        sessionStorage.setItem('mesenae_history_cached', 'true');
      }
      const timer = setTimeout(() => {
        setLoading(false);
        sessionStorage.setItem('mesenae_history_cached', 'true');
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [loading, allTxs.length]);

  // Helper untuk styling status pesanan
  const getStatusDisplay = (status?: string): StatusDisplay => {
    const s = (status || '').toLowerCase();
    if (s === 'completed' || s === 'selesai' || s === 'lunas') {
      return { 
        bg: 'bg-[#a3e635] text-black border border-black', 
        text: 'text-black', 
        label: 'Lunas', 
        Icon: CheckCircle2 
      };
    }
    if (s === 'processing' || s === 'diproses') {
      return { 
        bg: 'bg-[#3bf4fb] text-black border border-black', 
        text: 'text-black', 
        label: 'Diproses', 
        Icon: Package 
      };
    }
    if (s === 'cancelled' || s === 'batal') {
      return { 
        bg: 'bg-[#ff4e4e] text-black border border-black', 
        text: 'text-black', 
        label: 'Batal', 
        Icon: XCircle 
      };
    }
    if (s === 'belum lunas') {
      return { 
        bg: 'bg-[#ffc700] text-black border border-black', 
        text: 'text-black', 
        label: 'Belum Lunas', 
        Icon: Clock 
      };
    }
    // Default / Pending
    return { 
      bg: 'bg-white text-black border border-black', 
      text: 'text-black', 
      label: status || 'Menunggu', 
      Icon: Clock 
    };
  };

  // Detect manual non-cash web order
  const isManualNonCashWebOrder = (tx: any): boolean => {
    const remarks = tx.remarks || tx.remark || '';
    return (
      (tx.status === 'belum lunas') &&
      remarks.includes('Manual') &&
      remarks.includes('Web')
    );
  };

  const handleSendWaProof = (tx: any) => {
    let rawPhone = storeSettings?.phone || storeSettings?.storePhone || '';
    rawPhone = rawPhone.replace(/[^0-9]/g, '');
    if (rawPhone.startsWith('0')) rawPhone = '62' + rawPhone.substring(1);

    const pmName = (() => {
      if (tx.payments) {
        try {
          const parsed = typeof tx.payments === 'string' ? JSON.parse(tx.payments) : tx.payments;
          if (Array.isArray(parsed) && parsed.length > 0) return parsed[0].method_name || 'Manual';
        } catch { /* ignore */ }
      }
      const pm = allPaymentMethods.find((m: any) => m.id === (tx.payment_method_id || tx.paymentMethodId));
      return pm?.name || 'Manual';
    })();

    const tableText = String(tx.table_number || tx.tableNumber || '') === 'Bawa Pulang'
      ? 'Take Away (Bawa Pulang)'
      : `Meja ${tx.table_number || tx.tableNumber || '-'}`;

    const receiptNum = tx.receipt_number || tx.receiptNumber || `ORD-${tx.id.toString().slice(-5).toUpperCase()}`;
    const total = FORMAT_IDR(tx.total);

    const text = encodeURIComponent(
`Halo Admin, saya ingin mengirimkan bukti pembayaran untuk pesanan saya:

*Detail Pemesan:*
- Nama: ${tx.customer_name || tx.customerName || 'Tamu'}
- No. Meja/Tipe: ${tableText}
- No. Struk: ${receiptNum}

*Total Tagihan:* ${total}
*Metode Pembayaran:* ${pmName}

Berikut saya lampirkan bukti pembayarannya. Mohon segera dikonfirmasi. Terima kasih!`
    );

    if (!rawPhone) {
      toast.error('Nomor WhatsApp admin belum dikonfigurasi');
      return;
    }
    window.open(`https://wa.me/${rawPhone}?text=${text}`, '_blank');
  };

  const handleContinueSplit = (tx: any) => {
    let paid = 0;
    if (tx.payments) {
      try {
        const parsed = typeof tx.payments === 'string' ? JSON.parse(tx.payments) : tx.payments;
        if (Array.isArray(parsed)) {
          paid = parsed.reduce((sum, p) => sum + Number(p.amount || 0), 0);
        }
      } catch (e) {}
    }
    const remaining = Math.round(tx.total - paid);
    if (remaining > 0) {
      setSplitTxToPay(tx);
      setSplitRemaining(remaining);
      setMidtransOpen(true);
    } else {
      toast.info('Transaksi ini sudah lunas.');
    }
  };

  const onSplitSuccess = async () => {
    if (!splitTxToPay) return;
    const toastId = toast.loading('Memproses pembayaran...');
    try {
      const receiptNumber = splitTxToPay.receipt_number || splitTxToPay.receiptNumber || `ORD-${splitTxToPay.id.toString().slice(-5).toUpperCase()}`;
      await appendPaymentToTransactionByReceipt(receiptNumber, {
        method_id: 0,
        method_name: 'Midtrans (Split)',
        amount: splitRemaining,
        date: new Date().toISOString()
      });
      
      await dbUpsert('transactions', { 
        id: splitTxToPay.id, 
        status: 'lunas',
        kitchen_status: 'diproses' // Masuk ke dapur
      });
      
      toast.success('Pembayaran split bill berhasil dilunasi!', { id: toastId });
      setMidtransOpen(false);
      setSplitTxToPay(null);
    } catch (e) {
      toast.error('Gagal memproses pembayaran.', { id: toastId });
    }
  };

  return (
    <div className={isEmbedded ? "flex-1 flex flex-col bg-transparent animate-in fade-in duration-300" : "flex-1 flex flex-col bg-transparent h-screen animate-in fade-in duration-300"}>
      
      {/* Sticky Header */}
      {!isEmbedded && (
        <div className="sticky top-0 z-20 bg-white dark:bg-slate-900 px-4 pt-6 pb-4 border-b-3 border-black dark:border-slate-700 flex items-center">
          <button 
            onClick={() => setView('others')} 
            className="w-11 h-11 flex items-center justify-center bg-[#ffc700] hover:bg-[#ffe066] text-black border-2 border-black dark:border-slate-700 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_#374151] active:translate-x-[0.5px] active:translate-y-[0.5px] transition-all shrink-0"
          >
            <ChevronLeft size={22} strokeWidth={3} />
          </button>
          <h1 className="flex-1 text-center font-black uppercase tracking-wider text-base text-black dark:text-white pr-11">
            Riwayat Pesanan
          </h1>
        </div>
      )}

      {/* Main Content Area */}
      <div className={isEmbedded ? "p-4 pb-4" : "flex-1 p-4 pb-24 overflow-y-auto custom-scrollbar-hide"}>
        {loading ? (
          /* Skeleton Loading */
          <div className="space-y-3 sm:space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white dark:bg-slate-900 border-2 border-black dark:border-slate-700 p-4 sm:p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_#374151] relative overflow-hidden">
                {/* Bagian Atas: Tanggal & Nomor Pesanan (SKELETON) */}
                <div className="flex justify-between items-start mb-3 gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <div className="w-3 h-3 sm:w-3.5 sm:h-3.5 bg-slate-200 dark:bg-slate-800 rounded-none animate-pulse" />
                      <div className="h-3 w-32 bg-slate-200 dark:bg-slate-800 animate-pulse" />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3.5 h-3.5 sm:w-4 sm:h-4 bg-slate-200 dark:bg-slate-800 rounded-none animate-pulse" />
                      <div className="h-4 sm:h-[18px] w-28 sm:w-36 bg-slate-200 dark:bg-slate-800 animate-pulse" />
                    </div>
                  </div>
                  
                  {/* Badge Status (SKELETON) */}
                  <div className="px-2 py-1 bg-slate-200 dark:bg-slate-800 animate-pulse w-16 h-[22px] sm:h-6 flex-shrink-0 border border-black" />
                </div>
                
                {/* Pemisah Struk (Dashed Line) */}
                <div className="relative h-0 border-t-2 border-dashed border-black my-4">
                  <div className="absolute -left-[26px] -top-2 w-4 h-4 bg-white dark:bg-slate-950 border border-black" />
                  <div className="absolute -right-[26px] -top-2 w-4 h-4 bg-white dark:bg-slate-950 border border-black" />
                </div>

                {/* Bagian Bawah: Total & Info Meja (SKELETON) */}
                <div className="flex justify-between items-end relative z-10 gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="h-2.5 sm:h-3 w-20 bg-slate-200 dark:bg-slate-800 animate-pulse mb-1" />
                    <div className="h-5 sm:h-6 w-24 sm:w-32 bg-slate-200 dark:bg-slate-800 animate-pulse" />
                  </div>
                  
                  <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
                    <div className="text-right border-r-2 border-black pr-2 sm:pr-4 flex flex-col items-end">
                      <div className="h-2.5 sm:h-3 w-10 bg-slate-200 dark:bg-slate-800 animate-pulse mb-1" />
                      <div className="h-4 sm:h-5 w-14 bg-slate-200 dark:bg-slate-800 animate-pulse" />
                    </div>
                    
                    <div className="w-7 h-7 bg-slate-200 dark:bg-slate-800 animate-pulse flex-shrink-0 border border-black" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : history.length === 0 ? (
          /* Empty State */
          <div className="flex flex-col items-center justify-center h-full text-center px-6 mt-10 py-12 border-2 border-dashed border-black dark:border-slate-700 bg-white dark:bg-slate-900 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_#374151]">
            <div className="w-24 h-24 bg-[#ff90e8] border-2 border-black dark:border-slate-700 flex items-center justify-center mb-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_#374151] text-black">
              <FileText size={40} strokeWidth={3} />
            </div>
            <h2 className="text-base font-black uppercase tracking-wider text-black dark:text-white mb-2">
              Belum Ada Transaksi
            </h2>
            <p className="text-slate-600 dark:text-slate-400 font-bold uppercase text-[10px] max-w-[260px] leading-relaxed">
              Kelihatannya Anda belum membuat pesanan. Yuk, lihat katalog dan mulai belanja!
            </p>
            <button 
              onClick={() => setView('menu')} 
              className="mt-8 bg-[#ffc700] hover:bg-[#ffe066] text-black px-8 py-3.5 border-2 border-black dark:border-slate-700 font-black uppercase tracking-wider text-xs shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_#374151] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all"
            >
              Lihat Katalog
            </button>
          </div>
        ) : (
          /* Transaction List */
          <div className="space-y-3 sm:space-y-4">
            {history.slice(0, visibleCount).map((tx: Transaction) => {
              const statusInfo = getStatusDisplay(tx.status);
              const txDate = new Date(tx.date || tx.created_at || new Date());
              
              return (
                <div 
                  key={tx.id} 
                  className="group bg-white dark:bg-slate-900 border-2 border-black dark:border-slate-700 p-4 sm:p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_#374151] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] dark:hover:shadow-[6px_6px_0px_0px_#374151] transition-all relative overflow-hidden active:translate-x-[0.5px] active:translate-y-[0.5px] cursor-pointer"
                  onClick={async () => {
                    const toastId = toast.loading('Memuat detail struk...');
                    try {
                      const items = await fetchTransactionItems(tx.id as number);
                      // Map receipt_number to receiptNumber for compatibility
                      const normalizedTx = {
                        ...tx,
                        receiptNumber: tx.receipt_number || `ORD-${tx.id.toString().slice(-5).toUpperCase()}`
                      };
                      setSelectedTx(normalizedTx);
                      setSelectedItems(items || []);
                      
                      let pmName = 'Pembayaran';
                      if ((tx as any).payments) {
                        try {
                          const parsed = typeof (tx as any).payments === 'string' ? JSON.parse((tx as any).payments) : (tx as any).payments;
                          if (Array.isArray(parsed) && parsed.length > 0) {
                            pmName = parsed[0].method_name || 'Pembayaran';
                          }
                        } catch (e) { console.warn('Parse payment error', e); }
                      }
                      if ((tx as any).payment_method_id === 0) {
                        pmName = 'Bayar di Kasir';
                      }
                      setSelectedPmName(pmName);
                      setReceiptOpen(true);
                      toast.dismiss(toastId);
                    } catch (error) {
                      console.error('Gagal mengambil item transaksi:', error);
                      toast.error('Gagal memuat detail struk');
                      toast.dismiss(toastId);
                    }
                  }}
                >
                  {/* Bagian Atas: Tanggal & Nomor Pesanan */}
                  <div className="flex justify-between items-start mb-3 gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-1 text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5 flex-wrap">
                        <Clock size={12} strokeWidth={2.5} />
                        <span>
                          {txDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                          <span className="mx-1">•</span>
                          {txDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <RpIcon size={14} className="text-black dark:text-white" />
                        <p className="font-black text-sm text-black dark:text-white truncate uppercase tracking-wider">
                          {tx.receipt_number || `ORD-${tx.id.toString().slice(-5).toUpperCase()}`}
                        </p>
                      </div>
                    </div>

                    {/* Badge Status */}
                    <div className={`flex items-center gap-1 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${statusInfo.bg} ${statusInfo.text}`}>
                      <statusInfo.Icon size={12} strokeWidth={3} className="w-3.5 h-3.5" />
                      {statusInfo.label}
                    </div>
                  </div>
                  
                  {/* Pemisah Struk (Dashed Line) */}
                  <div className="relative h-0 border-t-2 border-dashed border-black dark:border-slate-700 my-4">
                    {/* Lubang pinggir struk */}
                    <div className="absolute -left-[26px] -top-2 w-4 h-4 bg-slate-100 dark:bg-slate-950 border border-black dark:border-slate-700" />
                    <div className="absolute -right-[26px] -top-2 w-4 h-4 bg-slate-100 dark:bg-slate-950 border border-black dark:border-slate-700" />
                  </div>

                  {/* Bagian Bawah: Total & Info Meja */}
                  <div className="flex justify-between items-end relative z-10 gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">
                        Total Belanja
                      </p>
                      <p className="font-black text-base sm:text-lg text-black dark:text-white truncate">
                        {FORMAT_IDR(tx.total)}
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
                      {tx.table_number && (
                        <div className="text-right border-r-2 border-black pr-2 sm:pr-4">
                          <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">
                            {String(tx.table_number) === 'Bawa Pulang' ? 'Tipe' : 'Meja'}
                          </p>
                          <p className="font-black text-xs uppercase tracking-wide text-black dark:text-white truncate max-w-[80px] sm:max-w-[120px]">
                            {String(tx.table_number) === 'Bawa Pulang' ? 'Take Away' : tx.table_number}
                          </p>
                        </div>
                      )}
                      
                      {/* Chevron Detail Indicator */}
                      <div className="w-8 h-8 border-2 border-black dark:border-slate-700 bg-white dark:bg-slate-800 text-black dark:text-white flex items-center justify-center group-hover:bg-[#ffc700] transition-colors flex-shrink-0">
                        <ChevronRight size={16} strokeWidth={3} />
                      </div>
                    </div>
                  </div>

                  {/* WA Send Proof Button for unpaid manual web orders */}
                  {isManualNonCashWebOrder(tx as any) && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleSendWaProof(tx as any); }}
                      className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 bg-[#a3e635] hover:bg-[#bbf255] border-2 border-black dark:border-slate-700 text-black text-[10px] font-black uppercase tracking-wider shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_#374151] active:translate-x-[0.5px] active:translate-y-[0.5px] active:shadow-none transition-all"
                    >
                      <MessageCircle size={14} strokeWidth={2.5} />
                      Kirim Bukti Pembayaran via WhatsApp
                    </button>
                  )}

                  {/* Continue Split Bill Button */}
                  {(tx as any).status === 'belum lunas' && ((tx as any).remarks || '').includes('Split Bill') && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleContinueSplit(tx as any); }}
                      className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 bg-[#ffc700] hover:bg-[#ffe066] border-2 border-black dark:border-slate-700 text-black text-[10px] font-black uppercase tracking-wider shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_#374151] active:translate-x-[0.5px] active:translate-y-[0.5px] active:shadow-none transition-all"
                    >
                      <RpIcon size={14} />
                      Lanjutkan Pembayaran Split Bill
                    </button>
                  )}
                </div>
              );
            })}
            
            {history.length > visibleCount && (
              <button 
                onClick={() => setVisibleCount(c => c + 10)} 
                className="w-full bg-white dark:bg-slate-900 hover:bg-[#fffdf0] dark:hover:bg-slate-800 border-2 border-black dark:border-slate-700 text-black dark:text-white font-black uppercase tracking-wider text-xs py-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_#374151] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all"
              >
                Lihat Selanjutnya
              </button>
            )}
          </div>
        )}
      </div>

      {/* Receipt Modal */}
      {selectedTx && (
        <ReceiptModal
          open={receiptOpen}
          onClose={() => {
            setReceiptOpen(false);
            setSelectedTx(null);
          }}
          transaction={selectedTx}
          items={selectedItems}
          storeSettings={storeSettings || undefined}
          paymentMethodName={selectedPmName}
        />
      )}

      {/* Midtrans Modal for Continuing Split Bill */}
      <MidtransPaymentModal
        isOpen={midtransOpen}
        paymentType="qris" 
        amount={splitRemaining}
        customerName={customerName || 'Customer Web'}
        orderId={splitTxToPay ? `${splitTxToPay.receipt_number || splitTxToPay.receiptNumber || splitTxToPay.id}-SPLIT-REMAINING-${Date.now()}` : undefined}
        onSuccess={onSplitSuccess}
        onPending={() => { setMidtransOpen(false); toast.info('Pembayaran diproses. Cek secara berkala.'); }}
        onError={() => { setMidtransOpen(false); toast.error('Pembayaran gagal'); }}
        onClose={() => setMidtransOpen(false)}
      />
    </div>
  );
}
