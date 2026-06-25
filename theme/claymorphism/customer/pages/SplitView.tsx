import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { 
  ChevronLeft, CheckCircle2, QrCode, 
  X, Info, SplitSquareHorizontal, ArrowRight, Check
} from 'lucide-react';
import { RpIcon } from '@/components/ui/RpIcon';
import { FORMAT_IDR, saveLocalTransactionId } from '@/lib/utils';
import { CartItem } from './CheckoutView';
import { toast } from 'sonner';
import { MidtransPaymentModal } from '../../components/MidtransPaymentModal';
import { 
  createTransaction, createTransactionItems, updateProductStock, 
  appendPaymentToTransactionByReceipt, dbUpsert, subscribeToTransactionUpdates,
  dbDelete
} from '@/lib/db';
import { useDbQuery } from '@/hooks/db-hooks';

// ============================================================================
// TIPE DATA & INTERFACES
// ============================================================================

interface Variant {
  name?: string;
  price: number;
}

export interface SplitItemConfig {
  amount: number;
  paymentMethod: 'qris' | 'tunai';
  [key: string]: any;
}

export interface SplitConfigProps {
  numPeople: number;
  active: boolean;
  splits: SplitItemConfig[];
}

interface SplitViewProps {
  setView: (view: string) => void;
  cart: CartItem[];
  totals: any;
  customerName?: string | null;
  setFinalOrderData: (data: any) => void;
  setCart: (cart: CartItem[]) => void;
  tableNumber?: string | number;
  splitConfig?: SplitConfigProps | null;
  setSplitConfig?: (v: any) => void;
}

// ============================================================================
// MEMOIZED SUB-COMPONENTS (UI HELPERS)
// ============================================================================

const SectionSpacer = React.memo(() => (
  <div className="h-2.5 w-full bg-slate-100 dark:bg-slate-950/50 border-y border-slate-200/50 dark:border-slate-800/50" />
));
SectionSpacer.displayName = 'SectionSpacer';

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function SplitView({ 
  setView, 
  cart, 
  totals, 
  customerName, 
  setFinalOrderData, 
  setCart, 
  tableNumber,
  splitConfig,
  setSplitConfig
}: SplitViewProps) {
  
  // State Pengelolaan Transaksi
  const [isProcessing, setIsProcessing] = useState(false);
  const isInitializingRef = useRef(false);

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  
  const [receiptNumber] = useState<string>(() => `TX${Date.now()}`);
  const [txId, setTxId] = useState<string | number | null>(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('mesenae_split_tx_id') || null;
    }
    return null;
  });

  const [paidSplits, setPaidSplits] = useState<boolean[]>(() => {
    const count = splitConfig?.splits?.length || 2;
    return Array.from({ length: count }, () => false);
  });
  
  const [liveTx, setLiveTx] = useState<any>(null);
  
  const fixedTotal = useMemo(() => {
    if (splitConfig?.splits) {
      return splitConfig.splits.reduce((a: number, b: any) => a + b.amount, 0);
    }
    return totals.total || 0;
  }, [splitConfig, totals]);

  const actualTotal = liveTx?.total || fixedTotal;
  
  // State UI Modals
  const [midtransOpen, setMidtransOpen] = useState(false);
  const [activeSplitIndex, setActiveSplitIndex] = useState<number | null>(null);
  const [cashInstructionOpen, setCashInstructionOpen] = useState(false);
  const [cashInstructionAmount, setCashInstructionAmount] = useState(0);

  const categories = useDbQuery<any>('categories') || [];
  const storeSettingsList = useDbQuery<any>('storeSettings') || [];
  const storeSettings = storeSettingsList[0];

  const needsKitchen = useMemo(() => {
    return cart.some(item => categories.find((cat: any) => cat.id === item.categoryId || cat.id?.toString() === item.categoryId?.toString())?.needsKitchen !== false);
  }, [cart, categories]);

  // Sinkronisasi ID Transaksi
  useEffect(() => {
    if (txId && typeof window !== 'undefined') {
      sessionStorage.setItem('mesenae_split_tx_id', String(txId));
    }
  }, [txId]);

  // ============================================================================
  // INISIALISASI TRANSAKSI KE DATABASE
  // ============================================================================
  useEffect(() => {
    const initTx = async () => {
      if (txId || cart.length === 0 || isInitializingRef.current) return;
      
      isInitializingRef.current = true;
      setIsProcessing(true);
      
      try {
        const totalProfit = cart.reduce((sum, item) => sum + ((item.price - (item.hpp || 0)) * item.qty), 0);
        const subtotalVal = totals.subtotal > 0 ? totals.subtotal : fixedTotal;
        const taxPercentage = storeSettings?.taxPercentage || 0;
        const taxAmount = storeSettings?.enableTax ? Math.round(subtotalVal * taxPercentage / 100) : 0;

        const txData: any = {
          subtotal: subtotalVal,
          discount_type: null,
          discount_value: 0,
          discount_amount: 0,
          total: fixedTotal,
          tax_and_service: taxAmount,
          tax_amount: taxAmount,
          admin_fee: 0,
          payment_method_id: 0,
          payment_amount: 0,
          payments: [],
          change: 0,
          profit: totalProfit,
          date: new Date().toISOString(),
          receipt_number: receiptNumber,
          status: 'belum lunas',
          kitchen_status: 'pending',
          needs_kitchen: needsKitchen,
          customer_name: (customerName || 'Tamu').trim(),
          table_number: (tableNumber?.toString() || '').trim(),
          opened_at: new Date().toISOString(),
          remarks: `Split Bill (${splitConfig?.numPeople || 2}x) - Web`
        };

        const createdId = await createTransaction(txData);
        if (!createdId) throw new Error('Gagal membuat transaksi');
        
        setTxId(createdId);
        saveLocalTransactionId(createdId);

        const itemRecords = cart.map(c => ({
          transaction_id: createdId,
          product_id: c.id,
          product_name: c.name,
          quantity: c.qty,
          price: c.price,
          hpp: c.hpp || 0,
          discount_type: null,
          discount_value: 0,
          discount_amount: 0,
          subtotal: (c.price + (c.selectedVariants?.reduce((s: number, a: Variant) => s + a.price, 0) || 0)) * c.qty,
          selected_variants: c.selectedVariants || [],
          notes: c.notes,
        }));
        
        await Promise.all([
          createTransactionItems(itemRecords),
          ...cart.map(item => updateProductStock(item.id, (item.stock || 0) - item.qty))
        ]);
        
        setFinalOrderData({
          transaction: { ...txData, id: createdId },
          items: itemRecords,
          paymentMethodName: 'Split Bill'
        });

      } catch (error) {
        console.error('Failed to initialize split transaction:', error);
        toast.error('Gagal memproses pesanan awal.');
      } finally {
        setIsProcessing(false);
      }
    };

    initTx();
  }, [txId, cart, totals, fixedTotal, receiptNumber, customerName, tableNumber, splitConfig, needsKitchen, setFinalOrderData]);

  // ============================================================================
  // REAL-TIME LISTENER PAYMENTS
  // ============================================================================
  useEffect(() => {
    if (!txId) return;
    
    const unsub = subscribeToTransactionUpdates(txId, (tx) => {
      setLiveTx(tx);
      if (tx && tx.payments) {
        try {
          const parsed = typeof tx.payments === 'string' ? JSON.parse(tx.payments) : tx.payments;
          
          if (Array.isArray(parsed) && parsed.length > 0) {
            setCart([]); 
            
            setPaidSplits(prev => {
              const count = splitConfig?.splits?.length || 2;
              const newPaidStatus = Array.from({ length: count }, () => false);
              let unconsumedPayments = [...parsed];

              // Pencocokan berdasarkan nama
              for (let idx = 0; idx < newPaidStatus.length; idx++) {
                const matchedIndex = unconsumedPayments.findIndex((p: any) => 
                  p.method_name && p.method_name.includes(`Split ${idx + 1}`)
                );
                if (matchedIndex !== -1) {
                  newPaidStatus[idx] = true;
                  unconsumedPayments.splice(matchedIndex, 1);
                }
              }

              // Pencocokan sisa berdasarkan nominal
              for (let idx = 0; idx < newPaidStatus.length; idx++) {
                if (newPaidStatus[idx]) continue;
                const splitAmount = splitConfig?.splits?.[idx]?.amount || Math.ceil(fixedTotal / count);
                const matchedIndex = unconsumedPayments.findIndex((p: any) => 
                  Math.abs(p.amount - splitAmount) <= 2
                );
                if (matchedIndex !== -1) {
                  newPaidStatus[idx] = true;
                  unconsumedPayments.splice(matchedIndex, 1);
                }
              }

              return newPaidStatus;
            });
          }
        } catch (e) {
          console.error("Gagal memproses data payments real-time:", e);
        }
      }
    });
    
    return unsub;
  }, [txId, splitConfig, fixedTotal, setCart]);

  // Arahkan ke sukses jika semua terbayar
  useEffect(() => {
    if (paidSplits.length > 0 && paidSplits.every(Boolean)) {
      if (typeof window !== 'undefined') sessionStorage.removeItem('mesenae_split_tx_id');
      if (setSplitConfig) setSplitConfig(null);
      setCart([]);
      
      const timer = setTimeout(() => setView('success'), 1500);
      return () => clearTimeout(timer);
    }
  }, [paidSplits, setView, setSplitConfig, setCart]);

  // ============================================================================
  // HANDLERS (Aksi Pengguna)
  // ============================================================================
  
  const handlePayClick = useCallback((index: number) => {
    const splitItem = splitConfig?.splits?.[index];
    if (splitItem?.paymentMethod === 'tunai') {
      setCashInstructionAmount(splitItem.amount);
      setCashInstructionOpen(true);
    } else {
      setActiveSplitIndex(index);
      setMidtransOpen(true);
    }
  }, [splitConfig]);

  const onMidtransSuccess = async () => {
    setMidtransOpen(false);
    if (activeSplitIndex === null) return;
    
    setIsProcessing(true);
    try {
      const count = splitConfig?.splits?.length || 2;
      const splitAmount = splitConfig?.splits?.[activeSplitIndex]?.amount || Math.ceil(fixedTotal / count);
      
      await appendPaymentToTransactionByReceipt(receiptNumber, {
        method_id: 0,
        method_name: `Midtrans (Split ${activeSplitIndex + 1})`,
        amount: splitAmount,
        date: new Date().toISOString()
      });
      
      setCart([]);
      
      const newPaidSplits = [...paidSplits];
      newPaidSplits[activeSplitIndex] = true;
      setPaidSplits(newPaidSplits);
      
      toast.success(`Tagihan ke-${activeSplitIndex + 1} Berhasil Dilunasi!`);
      
      if (newPaidSplits.every(Boolean)) {
        if (txId) {
          await dbUpsert('transactions', { 
            id: txId, 
            status: 'lunas',
            kitchen_status: 'diproses'
          });
        }
      }
    } catch (error) {
      console.error(error);
      toast.error('Terjadi kendala saat memproses pembayaran.');
    } finally {
      setIsProcessing(false);
      setActiveSplitIndex(null);
    }
  };

  const handleBackOrCancel = async () => {
    const hasPaidAny = paidSplits.some(Boolean);
    
    if (hasPaidAny) {
      if (setSplitConfig) setSplitConfig(null);
      if (typeof window !== 'undefined') sessionStorage.removeItem('mesenae_split_tx_id');
      setView('tracking');
      return;
    } 
    
    setIsProcessing(true);
    try {
      if (txId) {
        await Promise.all(cart.map(item => updateProductStock(item.id, item.stock || 0)));
        await dbDelete('transactions', txId);
      }
      
      if (typeof window !== 'undefined') sessionStorage.removeItem('mesenae_split_tx_id');
      
      toast.success('Bagi tagihan dibatalkan.');
      setView('checkout');
    } catch (err) {
      console.error("Gagal rollback split bill:", err);
      setView('checkout');
    } finally {
      setIsProcessing(false);
    }
  };

  const itemsList = splitConfig?.splits || Array.from({ length: 2 }, (_, idx) => ({
    id: idx + 1,
    name: `Tagihan ke-${idx + 1}`,
    amount: Math.ceil(actualTotal / 2),
    paymentMethod: 'qris'
  }));

  // ============================================================================
  // RENDER UI UTAMA
  // ============================================================================

  return (
    <div className="flex-1 flex flex-col bg-slate-50 dark:bg-slate-950 min-h-screen font-sans animate-in fade-in duration-300">
      
      {/* 1. STICKY HEADER */}
      <div className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 py-3.5 flex items-center justify-between shadow-sm">
        <button 
          onClick={handleBackOrCancel} 
          disabled={isProcessing}
          className="w-8 h-8 flex items-center justify-center text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/50 dark:hover:bg-slate-800 rounded-full transition-colors disabled:opacity-50"
          aria-label="Kembali"
        >
          <ChevronLeft size={20} strokeWidth={2.5} />
        </button>
        <h1 className="font-bold text-[16px] text-slate-900 dark:text-white tracking-tight absolute left-1/2 -translate-x-1/2">
          Bayar Split Bill
        </h1>
        <div className="w-8 h-8" />
      </div>

      {/* 2. KONTEN UTAMA */}
      <div className="flex-1 flex flex-col pb-[120px]">
        
        {/* Blok Rangkuman */}
        <div className="px-5 pt-8 pb-6 flex flex-col items-center justify-center">
          <div className="w-full max-w-sm p-6 text-center flex flex-col items-center justify-center clay-card">
            <div className="w-14 h-14 rounded-full bg-blue-50/80 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-4 border border-blue-100 dark:border-blue-800/50">
              <SplitSquareHorizontal size={26} strokeWidth={2} />
            </div>
            <p className="text-[11px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">
              Total Tagihan Keseluruhan
            </p>
            <p className="text-[32px] font-black text-slate-900 dark:text-white leading-none tracking-tight">
              {FORMAT_IDR(actualTotal)}
            </p>
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-4 text-center max-w-[280px]">
              Total pesanan Anda telah dibagi menjadi {itemsList.length} tagihan terpisah. 
            </p>
          </div>
        </div>
        
        <SectionSpacer />

        {/* Blok Daftar Tagihan */}
        <div className="bg-white dark:bg-slate-900 px-5 py-6">
          <h3 className="text-[11px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-5 flex items-center gap-2">
            <RpIcon size={16} /> Rincian Bagian
          </h3>

          <div className="space-y-4">
            {itemsList.map((portion: any, idx: number) => {
              const isPaid = paidSplits[idx];
              
              return (
                <div 
                  key={portion.id} 
                  className={`relative overflow-hidden rounded-3xl transition-all duration-300 ${
                    isPaid 
                      ? 'bg-blue-50/40 border-2 border-blue-200/50 dark:bg-blue-950/20 dark:border-blue-900/40' 
                      : 'clay-card'
                  }`}
                >
                  <div className="p-5 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2.5 mb-1.5">
                        <span className="text-xs font-extrabold text-slate-500 dark:text-slate-400 tracking-wide uppercase">
                          {portion.name}
                        </span>
                        
                        <span className="px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 flex items-center gap-1.5 border border-slate-200/60 dark:border-slate-700/60">
                          {portion.paymentMethod === 'qris' ? (
                            <><QrCode size={11} /> QRIS</>
                          ) : (
                            <><RpIcon size={11} /> Tunai</>
                          )}
                        </span>
                      </div>
                      <p className={`text-[19px] font-black tracking-tight ${isPaid ? 'text-slate-400 dark:text-slate-500 line-through' : 'text-slate-900 dark:text-white'}`}>
                        {FORMAT_IDR(portion.amount)}
                      </p>
                    </div>

                    <div>
                      {isPaid ? (
                        <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 bg-blue-100/50 dark:bg-blue-900/30 px-3 py-1.5 rounded-lg font-bold text-xs">
                          <CheckCircle2 size={16} /> Lunas
                        </div>
                      ) : (
                        <button
                          onClick={() => handlePayClick(idx)}
                          disabled={isProcessing || !txId}
                          className="flex items-center gap-2 clay-btn-primary disabled:bg-slate-200 disabled:text-slate-400 dark:disabled:bg-slate-800 dark:disabled:text-slate-500 disabled:shadow-none px-5 py-2.5 font-bold text-sm"
                        >
                          {!txId ? (
                            <div className="flex items-center gap-1.5">
                              <div className="w-3.5 h-3.5 border-2 border-slate-400 border-t-slate-600 dark:border-slate-600 dark:border-t-slate-400 rounded-full animate-spin" />
                              <span>Memuat...</span>
                            </div>
                          ) : isProcessing && activeSplitIndex === idx ? (
                            <div className="flex items-center gap-1.5">
                              <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              <span>Memproses...</span>
                            </div>
                          ) : (
                            <>
                              Bayar
                              <ArrowRight size={16} strokeWidth={3} />
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {paidSplits.every(Boolean) && (
            <div className="mt-8 animate-in fade-in zoom-in slide-in-from-bottom-4 duration-500">
              <div className="w-full bg-blue-600 text-white p-4.5 rounded-2xl font-bold text-center text-sm shadow-lg shadow-blue-600/20 flex flex-col items-center justify-center gap-2 border border-blue-500">
                <div className="w-10 h-10 rounded-full bg-white text-blue-600 flex items-center justify-center mb-1 shadow-sm">
                  <Check strokeWidth={3} size={22} />
                </div>
                Semua Tagihan Dilunasi!
                <span className="text-[11px] font-medium opacity-90">Memproses pesanan Anda...</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ============================================================================ */}
      {/* AREA MODALS & DIALOGS */}
      {/* ============================================================================ */}
      
      {/* Modal Midtrans Online */}
      <MidtransPaymentModal
        isOpen={midtransOpen}
        paymentType="qris" 
        amount={activeSplitIndex !== null ? (itemsList[activeSplitIndex]?.amount || 0) : 0}
        customerName={customerName || 'Customer Web'}
        orderId={activeSplitIndex !== null ? `${receiptNumber}-SPLIT${activeSplitIndex + 1}-${Date.now()}` : undefined}
        onSuccess={onMidtransSuccess}
        onPending={() => { 
          setMidtransOpen(false); 
          toast.info('Sistem sedang memverifikasi pembayaran Anda.'); 
        }}
        onError={() => { 
          setMidtransOpen(false); 
          toast.error('Pembayaran ditolak atau dibatalkan.'); 
        }}
        onClose={() => setMidtransOpen(false)}
      />

      {/* Centered Modal Instruksi Bayar Tunai (Bukan Bottom Sheet) */}
      {cashInstructionOpen && createPortal(
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6">
          {/* Backdrop Blur */}
          <div 
            className="absolute inset-0 bg-slate-900/60 dark:bg-black/60 backdrop-blur-sm animate-in fade-in duration-300" 
            onClick={() => setCashInstructionOpen(false)} 
          />
          
          {/* Kontainer Utama Dialog */}
          <div className="w-full max-w-sm relative z-10 animate-in fade-in zoom-in-95 duration-300 flex flex-col overflow-hidden clay-card p-0 border-none">
            
            {/* Header Dialog */}
            <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800/50 flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white">Bayar Tunai</h3>
                <p className="text-[11px] font-medium text-slate-500 mt-0.5">Selesaikan di meja kasir</p>
              </div>
              <button 
                onClick={() => setCashInstructionOpen(false)} 
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 transition-colors shrink-0"
              >
                <X size={18} />
              </button>
            </div>
            
            {/* Konten Utama Dialog */}
            <div className="p-6 space-y-4">
              <div className="w-14 h-14 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center mx-auto mb-2 border border-blue-100 dark:border-blue-800/50">
                <RpIcon className="w-7 h-7 text-blue-600 dark:text-blue-400" />
              </div>
              
              <p className="text-center text-sm font-medium text-slate-500 dark:text-slate-400 px-2">
                Tunjukkan Nomor Referensi ini ke kasir untuk proses pembayaran bagian Anda:
              </p>
              
              {/* Kartu Informasi Nominal */}
              <div className="bg-slate-50 dark:bg-slate-950 p-4.5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-500" />
                <p className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider">Nomor Referensi</p>
                <p className="text-[20px] font-black text-slate-900 dark:text-white tracking-tight">{receiptNumber}</p>
                <div className="h-[1px] w-full bg-slate-200 dark:bg-slate-800 my-2" />
                <p className="text-sm font-bold text-slate-500 dark:text-slate-400">
                  Total Bayar: <span className="text-blue-600 dark:text-blue-400 font-black ml-1">{FORMAT_IDR(cashInstructionAmount)}</span>
                </p>
              </div>
              
              <p className="text-[11px] text-center italic text-slate-400 font-medium pt-1">
                Tampilan web Anda akan otomatis diperbarui begitu kasir mengonfirmasi pembayaran uang tunai ini.
              </p>
            </div>
            
            {/* Footer Aksi Dialog */}
            <div className="p-5 bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800 shrink-0">
              <button 
                onClick={() => setCashInstructionOpen(false)} 
                className="w-full clay-btn-primary py-3.5 font-bold text-sm"
              >
                Saya Mengerti
              </button>
            </div>

          </div>
        </div>,
        document.body
      )}

    </div>
  );
}
