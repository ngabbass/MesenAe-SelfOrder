import React, { useState, useEffect, useCallback } from 'react';
import { 
  Plus, MessageCircle,
  ClipboardList, ChefHat, PackageOpen, BellRing, CheckCircle2,
  MapPin, Hash, LucideIcon
} from 'lucide-react';
import { RpIcon } from '@/components/ui/RpIcon';
import { TakeawayIcon } from '@/components/ui/TakeawayIcon';
import { FORMAT_IDR, getLocalTransactionIds, parseTableNumber } from '@/lib/utils';
import { toast } from 'sonner';
import ReceiptModal from '../../components/Receipt';
import { useDbQuery } from '@/hooks/db-hooks';

// Helper performa untuk membandingkan array tanpa JSON.stringify
const isTxArrayDifferent = (arr1: any[], arr2: any[]) => {
  if (arr1.length !== arr2.length) return true;
  for (let i = 0; i < arr1.length; i++) {
    if (arr1[i].id !== arr2[i].id) return true;
    if (arr1[i].status !== arr2[i].status) return true;
    if (arr1[i].kitchen_status !== arr2[i].kitchen_status) return true;
    if (arr1[i].kitchenStatus !== arr2[i].kitchenStatus) return true;
  }
  return false;
};

const isItemArrayDifferent = (arr1: any[], arr2: any[]) => {
  if (arr1.length !== arr2.length) return true;
  for (let i = 0; i < arr1.length; i++) {
    if (arr1[i].id !== arr2[i].id) return true;
    if (arr1[i].qty !== arr2[i].qty) return true;
  }
  return false;
};


// ==========================================
// Tipe Data & Interfaces (TypeScript)
// ==========================================

export interface StoreSettings {
  phone?: string;
  [key: string]: any;
}

export interface TransactionInfo {
  id?: string | number;
  receipt_number?: string;
  receiptNumber?: string;
  table_number?: string;
  tableNumber?: string;
  kitchen_status?: string;
  kitchenStatus?: string;
  status?: string;
  [key: string]: any;
}

export interface FinalOrderData {
  transaction?: TransactionInfo;
  [key: string]: any;
}

export interface TrackingViewProps {
  setView: (view: string) => void;
  finalOrderData: FinalOrderData | null;
  tableNumber?: string | number;
  storeSettings: StoreSettings | null;
  customerName?: string | null;
  isEmbedded?: boolean;
}

interface Step {
  id: string;
  title: string;
  desc: string;
  icon: LucideIcon;
}




export default function TrackingView({ 
  setView, 
  finalOrderData, 
  tableNumber, 
  storeSettings,
  customerName,
  isEmbedded = false
}: TrackingViewProps) {
  
  const [liveTx, setLiveTx] = useState<TransactionInfo | undefined>(
    finalOrderData?.transaction || undefined
  );
  
  const [activeTxs, setActiveTxs] = useState<TransactionInfo[]>([]);
  const [receiptOpen, setReceiptOpen] = useState<boolean>(false);
  const [activeItems, setActiveItems] = useState<any[]>(
    (finalOrderData?.items as any[]) || []
  );
  const [paymentMethodName, setPaymentMethodName] = useState<string>(
    (finalOrderData?.paymentMethodName as string) || 'Pembayaran'
  );
  const [loadingActive, setLoadingActive] = useState<boolean>(
    !(finalOrderData || liveTx)
  );

  // --- All hooks MUST be called before any conditional returns ---
  const usersResult = useDbQuery('users') as any[];
  const users = React.useMemo(() => usersResult ?? [], [usersResult]);
  const activeKasirWa = React.useMemo(() => {
    const kasir = users.find(u => u.whatsapp);
    return kasir?.whatsapp || storeSettings?.phone;
  }, [users, storeSettings?.phone]);

  const isPaid = liveTx?.status === 'lunas' || liveTx?.status === 'completed';
  const currentStatus = (liveTx?.kitchen_status || liveTx?.kitchenStatus || 'diproses').toLowerCase();
  const txId = liveTx?.id;

  const openWhatsApp = useCallback((phone: string | undefined, text: string) => {
    if (!phone) {
      toast.error('Nomor telepon restoran belum diatur');
      return;
    }
    let formattedPhone = phone.replace(/\D/g, '');
    if (formattedPhone.startsWith('0')) {
      formattedPhone = '62' + formattedPhone.substring(1);
    }
    window.open(`https://wa.me/${formattedPhone}?text=${encodeURIComponent(text)}`, '_blank');
  }, []);



  // Extract payment method name from transaction data
  const extractPaymentMethod = useCallback((tx: any): string => {
    let pmName = 'Pembayaran';
    if (tx.payments) {
      try {
        const parsed = typeof tx.payments === 'string' ? JSON.parse(tx.payments) : tx.payments;
        if (Array.isArray(parsed) && parsed.length > 0) {
          pmName = parsed[0].method_name || 'Pembayaran';
        }
      } catch (e) { console.warn('Parse payment error', e); }
    }
    if (tx.payment_method_id === 0) {
      pmName = 'Bayar di Kasir';
    }
    return pmName;
  }, []);

  // 1. Dapatkan semua data dari firebase onSnapshot
  const allTxs = (useDbQuery<any>('transactions') || []) as TransactionInfo[];
  const allItems = useDbQuery<any>('transactionItems') || [];

  // 2. TRUE REALTIME SYNC (No more polling!)
  useEffect(() => {
    if (!customerName && getLocalTransactionIds().length === 0) {
      setLoadingActive(false);
      return;
    }

    const localIds = getLocalTransactionIds();
    const sorted = allTxs.filter(tx => {
      // Allow if it matches customer name OR is in local browser history
      const matchName = tx.customer_name === customerName || tx.customerName === customerName;
      const matchId = localIds.includes(tx.id as string | number);
      return matchName || matchId;
    }).sort((a, b) => {
      const dateA = new Date(a.date || a.created_at || 0).getTime();
      const dateB = new Date(b.date || b.created_at || 0).getTime();
      return dateB - dateA;
    });

    const actives = sorted.filter(tx => {
      const status = (tx.status || '').toLowerCase();
      const kitchen = (tx.kitchen_status || tx.kitchenStatus || 'pending').toLowerCase();
      
      if (tx.remarks && tx.remarks.includes('Split Bill') && status === 'belum lunas') {
        return false;
      }
      
      return status !== 'cancelled' && status !== 'batal' && (status === 'belum lunas' || (kitchen !== 'diantarkan' && kitchen !== 'selesai'));
    });

    if (actives.length > 0) {
      // Hanya perbarui state jika array benar-benar berubah (menghindari render berlebih)
      if (isTxArrayDifferent(activeTxs, actives)) {
        setActiveTxs(actives);
      }
      
      const currentLiveTx = liveTx || actives[0];
      const isLiveTxActive = actives.find(t => t.id === currentLiveTx.id);
      const targetTx = isLiveTxActive || actives[0];
      
      if (!liveTx || !isLiveTxActive) {
        setLiveTx(targetTx);
        setPaymentMethodName(extractPaymentMethod(targetTx));
      } else {
        // If liveTx exists, detect changes to trigger toast / notification
        if (liveTx.status !== targetTx.status || liveTx.kitchenStatus !== targetTx.kitchenStatus || liveTx.kitchen_status !== targetTx.kitchen_status) {

           // Hanya notifikasi perubahan status pembayaran (siap ditangani GlobalReadyAlert)
           const wasPaid = liveTx?.status === 'lunas' || liveTx?.status === 'completed';
           const nowPaid = targetTx.status === 'lunas' || targetTx.status === 'completed';
           if (!wasPaid && nowPaid) {
             toast.success('Pembayaran dikonfirmasi! Pesanan sedang diproses. 🎉');
           }

           setLiveTx(targetTx);
           setPaymentMethodName(extractPaymentMethod(targetTx));
        }
      }

      // Update Active Items instantly from Firebase memory
      const items = allItems.filter(i => i.transactionId === targetTx.id || i.transaction_id === targetTx.id);
      if (items.length > 0 && isItemArrayDifferent(activeItems, items)) {
        setActiveItems(items);
      }
    } else {
      if (activeTxs.length > 0) setActiveTxs([]);
      if (liveTx) setLiveTx(undefined);
      if (activeItems.length > 0) setActiveItems([]);
    }
    setLoadingActive(false);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allTxs, allItems, customerName]);

  // Steps definition
  const stepsList: Step[] = React.useMemo(() => {
    const isAmbil = storeSettings?.deliveryMode === 'ambil';
    const isKitchenEnabled = storeSettings?.enableKitchen !== false && storeSettings?.enable_kitchen !== false;
    const hasKitchen = liveTx?.needs_kitchen !== false && liveTx?.needsKitchen !== false;

    if (!isKitchenEnabled) {
      // Simplified 3-stage flow
      const steps: Step[] = [
        { id: 'diproses', title: 'Pesanan Diterima', desc: 'Kasir telah menerima pesanan Anda', icon: ClipboardList },
        { id: 'siap', title: 'Pesanan Siap', desc: isAmbil ? 'Pesanan Anda sudah siap, silakan ke kasir' : 'Pesanan Anda sudah siap dan sedang diantar ke meja', icon: BellRing },
        { id: 'diantarkan', title: 'Selesai', desc: 'Pesanan telah selesai disajikan. Terima kasih!', icon: CheckCircle2 }
      ];
      return steps;
    }

    if (hasKitchen) {
      const steps: Step[] = [
        { id: 'diproses', title: 'Pesanan Diterima', desc: 'Kasir telah menerima pesanan Anda', icon: ClipboardList },
        { id: 'dimasak', title: 'Sedang Dimasak', desc: 'Koki kami sedang menyiapkan pesanan', icon: ChefHat },
        { id: 'disiapkan', title: 'Sedang Disiapkan', desc: 'Pesanan sedang dikemas atau disiapkan', icon: PackageOpen },
      ];
      if (isAmbil) {
        steps.push({ id: 'siap', title: 'Pesanan Siap', desc: 'Pesanan Anda sudah siap, silakan ke kasir', icon: BellRing });
        steps.push({ id: 'diantarkan', title: 'Selesai', desc: 'Pesanan telah Anda ambil. Terima kasih!', icon: CheckCircle2 });
      } else {
        steps.push({ id: 'siap', title: 'Pesanan Siap', desc: 'Menunggu pelayan mengantar ke meja', icon: BellRing });
        steps.push({ id: 'diantarkan', title: 'Selesai', desc: 'Sedang diantar ke meja. Selamat menikmati!', icon: CheckCircle2 });
      }
      return steps;
    } else {
      // Retail only flow (matches ActiveOrders.tsx)
      const steps: Step[] = [
        { id: 'pending', title: 'Pesanan Diterima', desc: 'Pesanan Anda telah diterima kasir', icon: ClipboardList },
        { id: 'disiapkan', title: 'Sedang Disiapkan', desc: 'Pesanan ritel Anda sedang disiapkan', icon: PackageOpen }
      ];
      if (isAmbil) {
        steps.push({ id: 'siap', title: 'Pesanan Siap', desc: 'Pesanan ritel Anda sudah siap diambil', icon: BellRing });
        steps.push({ id: 'diantarkan', title: 'Selesai', desc: 'Pesanan telah Anda ambil. Terima kasih!', icon: CheckCircle2 });
      } else {
        steps.push({ id: 'siap', title: 'Pesanan Siap', desc: 'Pesanan ritel Anda segera diantar ke meja', icon: BellRing });
        steps.push({ id: 'diantarkan', title: 'Selesai', desc: 'Sedang diantar ke meja. Selamat menikmati!', icon: CheckCircle2 });
      }
      return steps;
    }
  }, [storeSettings?.deliveryMode, storeSettings?.enableKitchen, storeSettings?.enable_kitchen, liveTx?.needs_kitchen, liveTx?.needsKitchen]);

  const currentStatusRaw = (liveTx?.kitchenStatus || liveTx?.kitchen_status || (liveTx?.needs_kitchen === false ? 'pending' : 'diproses')).toLowerCase();
  
  let currentStepIndex = stepsList.findIndex(s => s.id === currentStatusRaw);
  if (currentStepIndex === -1) {
    const isKitchenEnabled = storeSettings?.enableKitchen !== false && storeSettings?.enable_kitchen !== false;
    if (!isKitchenEnabled) {
      if (['pending', 'diproses', 'dimasak', 'disiapkan'].includes(currentStatusRaw)) {
        currentStepIndex = 0;
      } else if (currentStatusRaw === 'siap') {
        currentStepIndex = 1;
      } else if (['diantarkan', 'selesai'].includes(currentStatusRaw)) {
        currentStepIndex = 2;
      } else {
        currentStepIndex = 0;
      }
    } else {
      if (currentStatusRaw === 'diproses' && stepsList[0].id === 'pending') currentStepIndex = 0;
      else if (currentStatusRaw === 'null' || currentStatusRaw === '') currentStepIndex = 0;
      else currentStepIndex = 0;
    }
  }



  const handleTabClick = (tx: TransactionInfo) => {
    if (liveTx?.id === tx.id) return;
    setLiveTx(tx);
    setPaymentMethodName(extractPaymentMethod(tx));
    const items = allItems.filter((i: any) => i.transactionId === tx.id || i.transaction_id === tx.id);
    setActiveItems(items);
  };

  // --- CONDITIONAL RENDERS (safe — all hooks already called above) ---

  if (loadingActive) {
    if (liveTx || finalOrderData?.transaction) {
      return (
        <div className={isEmbedded ? "flex-1 flex flex-col bg-transparent animate-in fade-in duration-300" : "flex-1 flex flex-col bg-slate-50 dark:bg-slate-950 min-h-screen animate-in fade-in duration-300"}>
          {/* Skeleton Header */}
          {!isEmbedded && (
            <div className="sticky top-0 z-20 bg-white/90 dark:bg-slate-900/90 px-4 pt-6 pb-4 border-b border-slate-200/60 dark:border-slate-800/60">
              <div className="h-6 w-40 bg-slate-200 dark:bg-slate-800 rounded-md animate-pulse mx-auto" />
            </div>
          )}

          <div className={isEmbedded ? "p-4 pb-4" : "flex-1 p-5 overflow-y-auto pb-24 custom-scrollbar-hide"}>
            {/* Skeleton Hero Card */}
            <div className="bg-slate-200 dark:bg-slate-800 rounded-[1.5rem] h-32 mb-6 animate-pulse" />
            
            {/* Skeleton Timeline */}
            <div className="bg-white dark:bg-slate-900 rounded-[1.5rem] p-6 shadow-sm border border-slate-100 dark:border-slate-800 mb-6">
               <div className="h-5 w-32 bg-slate-200 dark:bg-slate-800 rounded-md animate-pulse mb-6" />
               <div className="relative pl-2 space-y-6">
                 {[1, 2, 3, 4].map(i => (
                   <div key={i} className="flex items-start gap-4">
                     <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-800 animate-pulse shrink-0" />
                     <div className="pt-1.5 w-full">
                       <div className="h-4 w-32 bg-slate-200 dark:bg-slate-800 rounded-md animate-pulse mb-2" />
                       <div className="h-3 w-48 bg-slate-200 dark:bg-slate-800 rounded-md animate-pulse" />
                     </div>
                   </div>
                 ))}
               </div>
            </div>

            {/* Skeleton Buttons */}
            <div className="space-y-3">
               <div className="h-14 bg-slate-200 dark:bg-slate-800 rounded-[1.2rem] animate-pulse" />
               <div className="h-14 bg-slate-200 dark:bg-slate-800 rounded-[1.2rem] animate-pulse" />
            </div>
          </div>
        </div>
      );
    } else {
      return (
        <div className={isEmbedded ? "flex-1 flex flex-col items-center justify-center p-6 bg-transparent py-16 animate-in fade-in duration-300" : "flex-1 flex flex-col items-center justify-center p-6 bg-slate-50 dark:bg-slate-950 min-h-screen animate-in fade-in duration-300"}>
          <div className="w-24 h-24 bg-slate-200 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6 animate-pulse" />
          <div className="h-6 w-48 bg-slate-200 dark:bg-slate-800 rounded-md animate-pulse mb-3" />
          <div className="space-y-2 mb-8">
            <div className="h-4 w-56 bg-slate-200 dark:bg-slate-800 rounded-md animate-pulse mx-auto" />
            <div className="h-4 w-40 bg-slate-200 dark:bg-slate-800 rounded-md animate-pulse mx-auto" />
          </div>
          <div className="w-48 h-12 bg-slate-200 dark:bg-slate-800 rounded-full animate-pulse" />
        </div>
      );
    }
  }

  if (!liveTx) {
    return (
      <div className={isEmbedded ? "flex-1 flex flex-col items-center justify-center p-6 bg-transparent py-16 animate-in fade-in duration-300" : "flex-1 flex flex-col items-center justify-center p-6 bg-slate-50 dark:bg-slate-950 min-h-screen animate-in fade-in duration-300"}>
        <div className="w-24 h-24 bg-amber-500/10 dark:bg-slate-900/50 rounded-full flex items-center justify-center mb-6 shadow-inner border border-amber-500/20">
          <PackageOpen size={40} strokeWidth={1.5} className="text-amber-500 dark:text-amber-400" />
        </div>
        <h2 className="text-xl font-black text-slate-800 dark:text-white mb-2 text-center">Belum Ada Pesanan</h2>
        <p className="text-slate-500 dark:text-slate-400 mb-8 text-center text-sm max-w-[250px] leading-relaxed">
          Anda tidak memiliki pesanan aktif yang sedang dilacak saat ini.
        </p>
        <button 
          onClick={() => setView('menu')} 
          className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-8 py-3.5 rounded-full font-black shadow-lg shadow-amber-500/20 active:scale-95 transition-all hover:opacity-90 uppercase tracking-widest text-xs"
        >
          Lihat Katalog Menu
        </button>
      </div>
    );
  }

  return (
    <div className={isEmbedded ? "flex-1 flex flex-col bg-transparent animate-in fade-in duration-300" : "flex-1 flex flex-col bg-slate-50 dark:bg-slate-950 min-h-screen animate-in fade-in duration-300"}>
      
      {/* Sticky Header */}
      {!isEmbedded && (
        <div className="sticky top-0 z-20 bg-white dark:bg-slate-900 border-b-3 border-black dark:border-slate-700">
          <div className="px-4 pt-6 pb-4">
            <h1 className="text-center font-black uppercase tracking-wider text-base text-black dark:text-white">
              Pelacakan Langsung
            </h1>
          </div>
          
          {/* Tabs Pesanan Aktif */}
          {activeTxs.length > 1 && (
            <div className="flex overflow-x-auto gap-3 px-4 pb-4 custom-scrollbar-hide snap-x">
              {activeTxs.map((tx, idx) => {
                const isSelected = liveTx?.id === tx.id;
                return (
                  <button
                    key={tx.id}
                    onClick={() => handleTabClick(tx)}
                    className={`snap-center shrink-0 px-5 py-2.5 border-2 border-black dark:border-slate-700 font-black uppercase tracking-wider text-xs transition-all ${
                      isSelected 
                        ? 'bg-[#ffc700] text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_#374151]' 
                        : 'bg-white dark:bg-slate-800 text-black dark:text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_#374151] hover:bg-[#fffdf0]'
                    }`}
                  >
                    Order #{tx.receipt_number?.split('-').pop() || (idx + 1)}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {isEmbedded && activeTxs.length > 1 && (
        <div className="px-4 pb-2 relative z-10">
          <div className="flex overflow-x-auto gap-3 pb-2 custom-scrollbar-hide snap-x">
            {activeTxs.map((tx, idx) => {
              const isSelected = liveTx?.id === tx.id;
              return (
                <button
                  key={tx.id}
                  onClick={() => handleTabClick(tx)}
                  className={`snap-center shrink-0 px-5 py-2.5 border-2 border-black dark:border-slate-700 font-black uppercase tracking-wider text-xs transition-all ${
                    isSelected 
                      ? 'bg-[#ffc700] text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_#374151]' 
                      : 'bg-white dark:bg-slate-800 text-black dark:text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_#374151] hover:bg-[#fffdf0]'
                  }`}
                >
                  Order #{tx.receipt_number?.split('-').pop() || (idx + 1)}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className={isEmbedded ? "p-4 pb-4" : "flex-1 p-5 overflow-y-auto pb-24 custom-scrollbar-hide"}>
        
        {/* Hero Card: Order & Table Info */}
        <div className="bg-[#ffc700] border-3 border-black dark:border-slate-700 text-black p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] dark:shadow-[6px_6px_0px_0px_#374151] mb-6 flex justify-between items-center relative overflow-hidden">
          <div className="relative z-10">
            <div className="flex items-center gap-1.5 text-black mb-1">
              <Hash size={14} strokeWidth={3} />
              <p className="text-[9px] uppercase font-black tracking-wider">Nomor Order</p>
            </div>
            <p className="font-black text-xl text-black tracking-wider uppercase">
              {liveTx?.receipt_number || liveTx?.receiptNumber || 'TX-???'}
            </p>
          </div>
          
          <div className="text-right relative z-10 border-l-2 border-black pl-5 flex flex-col items-end">
            {(() => {
              const tbl = liveTx?.table_number || liveTx?.tableNumber || '';
              const parsedTable = parseTableNumber(tbl);
              return (
                <>
                  <div className="flex items-center justify-end gap-1.5 text-black mb-1.5">
                    <MapPin size={14} strokeWidth={3} />
                    <p className="text-[9px] uppercase font-black tracking-wider">
                      {parsedTable.isTakeAway ? 'Take Away' : 'Lokasi'}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {parsedTable.isTakeAway ? (
                      <div className="bg-white dark:bg-slate-900 border-2 border-black dark:border-slate-700 p-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_#374151]"><TakeawayIcon className="w-8 h-8 text-black dark:text-white" /></div>
                    ) : (
                      <div className="flex flex-col items-end gap-1.5">
                        <span className="inline-flex items-center gap-1 bg-white dark:bg-slate-900 border border-black dark:border-slate-700 text-black dark:text-white text-[9px] font-black px-3 py-1.5 shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] dark:shadow-[1px_1px_0px_0px_#374151] uppercase tracking-wide">
                          <span className="w-1.5 h-1.5 bg-emerald-500 border border-black dark:border-slate-700 animate-pulse"></span>
                          {parsedTable.area}
                        </span>
                        <span className="inline-flex items-center bg-black dark:bg-white text-white dark:text-black text-[10px] font-black px-3.5 py-1.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_#374151] border border-black dark:border-slate-700 uppercase tracking-wider">
                          {/^\d+$/.test(parsedTable.table) ? `Meja ${parsedTable.table}` : parsedTable.table}
                        </span>
                      </div>
                    )}
                  </div>
                </>
              );
            })()}
          </div>
        </div>

        {/* Timeline Status / Payment Notice */}
        {!isPaid ? (
          /* Tampilan Khusus Belum Lunas (Bayar Ke Kasir) */
          <div className="bg-white dark:bg-slate-900 border-3 border-black dark:border-slate-700 p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_#374151] text-center space-y-6 mb-6">
            <div className="w-16 h-16 bg-[#ffc700] border-2 border-black dark:border-slate-700 flex items-center justify-center mx-auto text-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_#374151]">
              <RpIcon size={32} strokeWidth={3} />
            </div>
            
            <div className="space-y-2">
              <h3 className="font-black text-black dark:text-white text-base uppercase tracking-wider">
                Siapkan Cash & Bayar ke Kasir
              </h3>
              <p className="text-[10px] text-slate-600 dark:text-slate-300 font-bold uppercase leading-relaxed max-w-xs mx-auto">
                Silakan lakukan pembayaran ke petugas kasir agar pesanan Anda dapat segera diproses dan dipantau statusnya di sini.
              </p>
            </div>
            
            <div className="bg-slate-100 dark:bg-slate-800 border-2 border-black dark:border-slate-700 p-4 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_#374151]">
              <p className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">
                Jumlah Uang Tunai (Cash)
              </p>
              <p className="font-black text-xl text-black dark:text-white">
                {FORMAT_IDR(liveTx?.total || 0)}
              </p>
            </div>

            <div className="pt-2 text-[10px] font-black uppercase text-[#ff8000] flex items-center justify-center gap-1.5 animate-pulse">
              <span className="w-2 h-2 bg-[#ff8000] border border-black"></span>
              <span>Menunggu Konfirmasi Kasir...</span>
            </div>
          </div>
        ) : (
          /* Timeline Status (Tampilan Standar saat sudah Lunas) */
          <div className="bg-white dark:bg-slate-900 border-3 border-black dark:border-slate-700 p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_#374151] relative mb-6">
            <h3 className="font-black text-black dark:text-white text-sm uppercase tracking-wide mb-6">
              Status Pesanan
            </h3>
            
            {/* Timeline Container */}
            <div className="relative pl-2">
              {/* The vertical connector line */}
              <div className="absolute top-4 bottom-8 left-[1.3rem] w-1 bg-black dark:bg-slate-700" />
              
              <div className="space-y-6">
                {stepsList.map((step, index) => {
                  const isDone = index < currentStepIndex || currentStatus === 'diantarkan';
                  const isActive = index === currentStepIndex && currentStatus !== 'diantarkan';

                  return (
                    <div key={step.id} className="relative flex items-start gap-4 group">
                      
                      {/* Circle Indicator */}
                      <div className="relative z-10 flex flex-col items-center">
                        <div className={`w-10 h-10 border-2 border-black dark:border-slate-700 flex items-center justify-center transition-all duration-500 shadow-sm
                          ${isDone ? 'bg-[#a3e635] text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_#374151]' : 
                            isActive ? 'bg-[#ffc700] text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_#374151]' : 
                            'bg-slate-100 text-slate-400 border-2 border-slate-300'}
                        `}>
                          <step.icon size={18} strokeWidth={3} />
                        </div>
                      </div>
                      
                      {/* Text Content */}
                      <div className="pt-1.5 w-full">
                        <h4 className={`font-black uppercase tracking-wider text-xs transition-colors duration-300 ${
                          isDone || isActive ? 'text-black dark:text-white' : 'text-slate-400 dark:text-slate-600'
                        }`}>
                          {step.title}
                        </h4>
                        <p className={`text-[10px] font-bold uppercase mt-1 transition-colors duration-300 leading-relaxed ${
                          isDone || isActive ? 'text-slate-600 dark:text-slate-300' : 'text-slate-400 dark:text-slate-700'
                        }`}>
                          {step.desc}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
        
        {/* Additional Actions */}
        <div className="space-y-3">
          {/* Tombol Lihat Struk Digital / Detail Tagihan */}
          <button
            onClick={() => setReceiptOpen(true)}
            className="w-full bg-[#ffc700] hover:bg-[#ffe066] text-black border-2 border-black dark:border-slate-700 py-4 font-black flex items-center justify-center text-xs uppercase tracking-wider shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_#374151] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all mb-1"
          >
            <RpIcon size={18} className="mr-2" strokeWidth={2.5} /> {isPaid ? 'Lihat Struk Digital' : 'Lihat Detail Tagihan'}
          </button>

          {/* Contact WhatsApp */}
          <button
            onClick={() => {
              const orderNum = liveTx?.receipt_number || liveTx?.receiptNumber || '';
              const tbl = liveTx?.table_number || liveTx?.tableNumber || '-';
              const tblLabel = tbl === 'Bawa Pulang' ? 'Take Away' : `Meja *${tbl}*`;
              const text = `Halo, saya ingin menanyakan status pesanan saya dengan nomor order *${orderNum}* (${tblLabel}). Terimakasih!`;
              openWhatsApp(activeKasirWa, text);
            }}
            className="w-full bg-[#25D366] hover:bg-[#20bd5a] text-white border-2 border-black dark:border-slate-700 py-4 font-black flex items-center justify-center text-xs uppercase tracking-wider shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_#374151] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all"
          >
            <MessageCircle size={20} className="mr-2" strokeWidth={2.5} /> Hubungi Dapur / Restoran
          </button>

          {/* Secondary Action Buttons */}
          <button 
            onClick={() => setView('menu')} 
            className="w-full bg-white hover:bg-[#fffdf0] text-black dark:text-white dark:bg-slate-900 border-2 border-black dark:border-slate-700 py-4 font-black flex items-center justify-center text-xs uppercase tracking-wider shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_#374151] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all"
          >
            <Plus size={18} strokeWidth={3} className="mr-2" /> Pesan Lagi
          </button>
        </div>

      </div>

      {/* Komponen Struk Modal */}
      <ReceiptModal 
        open={receiptOpen}
        onClose={() => setReceiptOpen(false)}
        transaction={liveTx as any}
        items={activeItems}
        storeSettings={storeSettings as any}
        paymentMethodName={paymentMethodName}
      />

      
    </div>
  );
}
