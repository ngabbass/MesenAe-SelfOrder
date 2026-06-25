import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { 
  ChevronLeft, QrCode, CreditCard,
  ArrowRight, Smartphone, LayoutGrid, User,
  Trash2, Plus, Minus, Share2, ChevronRight, CheckCircle2, 
  X, TicketPercent, Hash, ShoppingBag, Check
} from 'lucide-react';
import { RpIcon } from '@/components/ui/RpIcon';
import { FORMAT_IDR, saveLocalTransactionId, parseTableNumber } from '@/lib/utils';
import { toast } from 'sonner';
import { useDbQuery } from '@/hooks/db-hooks';
import { 
  createTransaction, createTransactionItems, updateProductStock, 
  fetchTransactionByReceiptNumber, appendPaymentToTransactionByReceipt 
} from '@/lib/db';
import { sendPushToRole } from '@/lib/fcm';
import { cldThumb } from '@/lib/cld';
import { 
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, 
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle 
} from '@/components/ui/alert-dialog';

import SplitBillModal from '../components/SplitBillModal';
import PaymentSelectorModal from '../components/PaymentSelectorModal';
import PaymentModal from '../components/PaymentModal';

// ============================================================================
// TIPE DATA & INTERFACES (Strict Typing)
// ============================================================================

export interface SelectedVariant {
  optionName: string;
  price: number;
  [key: string]: any;
}

export interface CartItem {
  id: number | string;
  cartId?: string | number;
  name: string;
  qty: number;
  price: number;
  hpp?: number;
  stock?: number;
  categoryId?: number | string;
  selectedVariants?: SelectedVariant[];
  notes?: string;
  photo?: string;
  [key: string]: any;
}

export interface BillTotals {
  subtotal: number;
  tax: number;
  service: number;
  total: number;
}

export interface PaymentRecord {
  method_id: number | string;
  method_name: string;
  amount: number;
  date: string;
}

export interface TransactionData {
  id?: string | number;
  subtotal: number;
  discount_type: 'percentage' | 'nominal' | null;
  discount_value: number;
  discount_amount: number;
  total: number;
  payment_method_id: number | string;
  payment_amount: number;
  payments: PaymentRecord[];
  change: number;
  profit: number;
  date: string;
  receipt_number: string;
  status: string;
  kitchen_status: string;
  customer_name: string | null;
  table_number: string | null;
  opened_at: string;
  closed_at?: string | null;
  remarks?: string;
  tax_and_service?: number;
  tax_amount?: number;
  admin_fee?: number;
  needs_kitchen?: boolean;
  customer_phone?: string | null;
}

export interface TransactionItemRecord {
  transaction_id: string | number;
  product_id: number | string;
  product_name: string;
  quantity: number;
  price: number;
  hpp: number;
  discount_type: string | null;
  discount_value: number;
  discount_amount: number;
  subtotal: number;
  selected_variants: SelectedVariant[];
  notes?: string;
}

export interface FinalOrderData {
  transaction: TransactionData;
  items: TransactionItemRecord[];
  paymentMethodName: string;
}

export interface CheckoutViewProps {
  setView: (view: string) => void;
  totals: BillTotals;
  cart: CartItem[];
  customerName?: string | null;
  customerPhone?: string;
  setFinalOrderData: (data: FinalOrderData) => void;
  setCart: React.Dispatch<React.SetStateAction<CartItem[]>> | ((cart: CartItem[]) => void);
  tableNumber?: string | number;
  setTableNumber: (val: string) => void;
  appliedVoucher?: any;
  setAppliedVoucher?: (v: any) => void;
  splitConfig?: any;
  setSplitConfig?: (v: any) => void;
  updateCartQty?: (cartId: string | number, delta: number) => void;
}

// ============================================================================
// HELPER FUNCTIONS PENGELOLAAN UI & ICON
// ============================================================================

export const getCategoryIcon = (category: string) => {
  switch (category?.toLowerCase()) {
    case 'tunai': return RpIcon;
    case 'qris': return QrCode;
    case 'e-wallet': return Smartphone;
    case 'transfer': return CreditCard;
    default: return LayoutGrid;
  }
};

export const getPaymentLogoSrc = (pm: any): string | null => {
  if (!pm) return null;
  const name = (pm.name || '').toLowerCase();
  const bank = (pm.bankName || '').toLowerCase();
  const category = (pm.category || '').toLowerCase();
  const key = bank || name;

  if (category === 'qris' || key.includes('qris')) return '/ico/qris.svg';
  if (key.includes('bca')) return '/ico/bca.svg';
  if (key.includes('bni')) return '/ico/bni.svg';
  if (key.includes('bri')) return '/ico/bri.svg';
  if (key.includes('mandiri')) return '/ico/mandiri.svg';
  if (key.includes('seabank') || key.includes('sea bank')) return '/ico/seabank.svg';
  if (key.includes('gopay') || key.includes('go pay')) return '/ico/gopay.svg';
  if (key.includes('ovo')) return '/ico/ovo.svg';
  if (key.includes('dana')) return '/ico/dana.svg';
  if (key.includes('shopeepay') || key.includes('shopee')) return '/ico/shopeepay.svg';
  if (key.includes('linkaja') || key.includes('link aja')) return '/ico/linkaja.svg';
  if (category === 'lainnya' || key.includes('lain')) return '/ico/lainnya.svg';
  if (category === 'transfer' || key.includes('transfer')) return '/ico/transfer.svg';
  if (category === 'ewallet' || key.includes('e-wallet') || key.includes('ewallet')) return '/ico/ewallet.svg';
  if (category === 'tunai' || key.includes('tunai') || key.includes('cash')) return '/ico/tunai.svg';
  if (pm.provider === 'midtrans') return '/ico/lainnya.svg';

  return null;
};

// ============================================================================
// MEMOIZED SUB-COMPONENTS (OPTIMASI PERFORMA & UI)
// ============================================================================

const SectionSpacer = React.memo(() => (
  <div className="h-2 w-full bg-slate-100 dark:bg-black/40 border-y border-slate-200/50 dark:border-white/5" />
));
SectionSpacer.displayName = 'SectionSpacer';

export const PaymentLogoBlock = React.memo(({ src, alt, IconComponent, isSelected, small }: { src: string | null, alt: string, IconComponent: any, isSelected?: boolean, small?: boolean }) => {
  const sizeClass = small ? "w-6 h-6 rounded-md p-0.5" : "w-12 h-12 rounded-xl p-0.5";
  return (
    <div className={`${sizeClass} flex items-center justify-center shrink-0 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 shadow-sm overflow-hidden`}>
      {src ? (
        <img src={src} alt={alt} loading="lazy" className="w-full h-full object-contain" />
      ) : (
        <IconComponent size={small ? 14 : 24} className={isSelected ? 'text-blue-600 dark:text-amber-400' : 'text-slate-500 dark:text-slate-400'} />
      )}
    </div>
  );
});
PaymentLogoBlock.displayName = 'PaymentLogoBlock';

const OrderInfoBlock = React.memo(({ customerName, tableNumber }: { customerName?: string | null, tableNumber?: string | number }) => {
  const parsedTable = parseTableNumber(tableNumber);
  
  return (
    <div className="glass-card rounded-[1.5rem] p-5 shadow-sm mx-4 mt-4 border border-white/20 dark:border-white/10">
      <h3 className="text-[11px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-4">
        Detail Pemesan
      </h3>
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-9 h-9 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center shrink-0">
            <User size={18} className="text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex-1">
            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 leading-none mb-1">Nama Pelanggan</p>
            <p className="text-sm font-bold text-slate-900 dark:text-white leading-none">
              {customerName || 'Tamu / Tanpa Nama'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3.5">
          <div className="w-9 h-9 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center shrink-0">
            {parsedTable.isTakeAway ? (
              <ShoppingBag size={18} className="text-blue-600 dark:text-blue-400" />
            ) : (
              <Hash size={18} className="text-blue-600 dark:text-blue-400" />
            )}
          </div>
          <div className="flex-1">
            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 leading-none mb-1.5">Tipe Pesanan</p>
            {parsedTable.isTakeAway ? (
              <span className="inline-flex items-center text-[11px] font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700">
                Bawa Pulang (Take Away)
              </span>
            ) : (
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center text-[11px] font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 px-2.5 py-1 rounded-md border border-blue-100 dark:border-blue-800/50">
                  {parsedTable.area}
                </span>
                <span className="inline-flex items-center text-[11px] font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700">
                  {/^\d+$/.test(parsedTable.table) ? `Meja ${parsedTable.table}` : parsedTable.table}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});
OrderInfoBlock.displayName = 'OrderInfoBlock';

const CartItemListBlock = React.memo(({ cart, updateCartQty, onAddMore }: { cart: CartItem[], updateCartQty?: (id: string | number, delta: number) => void, onAddMore: () => void }) => {
  return (
    <div className="glass-card rounded-[1.5rem] p-5 shadow-sm mx-4 border border-white/20 dark:border-white/10">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[11px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-2">
          Daftar Pesanan
        </h3>
        <button 
          onClick={onAddMore} 
          className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors flex items-center gap-1"
        >
          <Plus size={14} /> Tambah Menu
        </button>
      </div>

      <div className="space-y-4 mt-2">
        {cart.map((item, index) => {
          const variantTotal = item.selectedVariants?.reduce((s: number, a: SelectedVariant) => s + a.price, 0) || 0;
          const itemTotal = (item.price + variantTotal) * item.qty;

          return (
            <div key={item.cartId || item.id} className="relative">
              <div className="flex gap-4">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 shrink-0 border border-slate-200/50 dark:border-slate-700/50 flex items-center justify-center">
                  {item.photo ? (
                    <img src={cldThumb(item.photo)} alt={item.name} decoding="async" loading="lazy" className="w-full h-full object-cover" />
                  ) : (
                    <LayoutGrid size={24} className="text-slate-300 dark:text-slate-600" />
                  )}
                </div>
                
                <div className="flex-1 flex flex-col justify-center min-w-0 py-0.5">
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white leading-tight mb-1 truncate">
                    {item.name}
                  </h4>
                  
                  {item.selectedVariants && item.selectedVariants.length > 0 && (
                    <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 line-clamp-1 mb-1">
                      {item.selectedVariants.map((a) => a.optionName).join(', ')}
                    </p>
                  )}
                  
                  {item.notes && (
                    <div className="mt-1 mb-1.5 inline-flex">
                      <p className="text-[10px] font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700 truncate max-w-full">
                        Catatan: {item.notes}
                      </p>
                    </div>
                  )}

                  <div className="flex items-center justify-between mt-auto pt-1">
                    <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                      {FORMAT_IDR(itemTotal)}
                    </span>
                    
                    {updateCartQty && (
                      <div className="flex items-center bg-slate-50 dark:bg-slate-800/80 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm p-0.5">
                        <button 
                          onClick={() => updateCartQty(item.cartId || item.id, -1)} 
                          className="w-6 h-6 rounded-md bg-white dark:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 active:scale-95 transition-transform border border-slate-100 dark:border-slate-600"
                        >
                          <Minus size={14} strokeWidth={2.5} />
                        </button>
                        <span className="text-xs font-bold w-7 text-center text-slate-900 dark:text-white select-none">
                          {item.qty}
                        </span>
                        <button 
                          onClick={() => updateCartQty(item.cartId || item.id, 1)} 
                          className="w-6 h-6 rounded-md bg-blue-600 text-white flex items-center justify-center active:scale-95 transition-transform shadow-sm border border-blue-600"
                        >
                          <Plus size={14} strokeWidth={2.5} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              {index < cart.length - 1 && (
                <div className="h-[1px] w-full bg-slate-100 dark:bg-slate-800/60 mt-4" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});
CartItemListBlock.displayName = 'CartItemListBlock';

// ============================================================================
// MAIN COMPONENT EXPORT
// ============================================================================

export default function CheckoutView({ 
  setView, 
  totals, 
  cart, 
  customerName, 
  customerPhone, 
  setFinalOrderData, 
  setCart, 
  tableNumber, 
  setTableNumber, 
  appliedVoucher, 
  setAppliedVoucher, 
  splitConfig, 
  setSplitConfig, 
  updateCartQty
}: CheckoutViewProps) {
  
  // State UI Lokal
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [promoCode, setPromoCode] = useState<string>('');
  const [promoError, setPromoError] = useState<string>('');

  // State Pembayaran & Transaksi
  const [selectedMethodId, setSelectedMethodId] = useState<string>('');
  const [paymentModalOpen, setPaymentModalOpen] = useState<boolean>(false);
  const [processing, setProcessing] = useState<boolean>(false);
  const [paymentProcessOpen, setPaymentProcessOpen] = useState<boolean>(false);
  const [pendingReceiptNumber, setPendingReceiptNumber] = useState<string | null>(null);
  const [qrisImageUrl, setQrisImageUrl] = useState<string>("");

  // State Split Bill (Bagi Tagihan)
  const [splitModalOpen, setSplitModalOpen] = useState<boolean>(false);
  const [localNumPeople, setLocalNumPeople] = useState<number>(2);
  const [isBagiRata, setIsBagiRata] = useState<boolean>(true);
  const [customAmounts, setCustomAmounts] = useState<number[]>([0, 0]);
  const [portionMethods, setPortionMethods] = useState<('qris' | 'tunai')[]>(['qris', 'qris', 'qris', 'qris']);

  // Fetching Data Master
  const categories = useDbQuery<any>('categories') || [];
  const dbPaymentMethods = useDbQuery<any>('paymentMethods') || [];
  const storeSettingsList = useDbQuery<any>('storeSettings') || [];
  const storeSettings = storeSettingsList[0];
  const allVouchers = (useDbQuery('vouchers') as any[]) ?? [];

  // Failsafe: Kembali ke menu jika keranjang dikosongkan
  useEffect(() => {
    if (cart.length === 0) {
      setView('menu');
    }
  }, [cart.length, setView]);

  // Memoization Data Master
  const sortedPaymentMethods = useMemo(() => {
    return [...dbPaymentMethods]
      .filter((pm: any) => pm.isActive !== false)
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  }, [dbPaymentMethods]);

  const finalPaymentMethods = useMemo(() => {
    if (sortedPaymentMethods.length > 0) return sortedPaymentMethods;
    return [{ id: 'cash', name: 'Bayar di Kasir', category: 'tunai', isDefault: true, provider: 'manual' }];
  }, [sortedPaymentMethods]);

  const selectedMethod = useMemo(() => {
    return finalPaymentMethods.find((p: any) => p.id.toString() === selectedMethodId);
  }, [finalPaymentMethods, selectedMethodId]);

  // ============================================================================
  // LOGIKA KALKULASI FINANSIAL
  // ============================================================================
  
  const getDiscountAmount = useCallback((): number => {
    if (!appliedVoucher) return 0;
    
    let eligibleSubtotal = totals.subtotal;
    if (appliedVoucher.applicableProductIds && appliedVoucher.applicableProductIds.length > 0) {
      eligibleSubtotal = cart.reduce((sum, item) => {
        const itemId = item.productId || item.id;
        if (appliedVoucher.applicableProductIds.includes(itemId)) {
          return sum + (item.price * item.qty);
        }
        return sum;
      }, 0);
    }

    if (eligibleSubtotal === 0) return 0;

    if (appliedVoucher.type === 'percentage') {
      return (eligibleSubtotal * appliedVoucher.value) / 100;
    }
    return Math.min(appliedVoucher.value, eligibleSubtotal);
  }, [appliedVoucher, totals.subtotal, cart]);

  const getPpnAmount = useCallback((): number => {
    if (!storeSettings?.enableTax) return 0;
    const baseTotal = Math.max(0, totals.subtotal - getDiscountAmount());
    return Math.round(baseTotal * (storeSettings.taxPercentage || 0) / 100);
  }, [storeSettings, totals.subtotal, getDiscountAmount]);

  const getAdminFee = useCallback((): number => {
    if (!selectedMethod) return 0;
    const isMidtrans = selectedMethod.provider !== 'manual';
    
    if (isMidtrans) {
      const baseTotal = Math.max(0, totals.subtotal - getDiscountAmount());
      if (selectedMethod.category === 'qris') return Math.round(baseTotal * 0.007);
      if (selectedMethod.category === 'e-wallet') return Math.round(baseTotal * 0.02);
      if (selectedMethod.category === 'transfer') return 4000;
      if (selectedMethod.category === 'lainnya') return Math.round(baseTotal * 0.03);
    }
    return 0;
  }, [selectedMethod, totals.subtotal, getDiscountAmount]);

  const finalTotal = Math.max(0, totals.subtotal - getDiscountAmount()) + getPpnAmount() + getAdminFee();

  // ============================================================================
  // LOGIKA SPLIT BILL (BAGI TAGIHAN)
  // ============================================================================
  
  const equalAmounts = useMemo(() => {
    const arr: number[] = [];
    if (localNumPeople <= 0) return arr;
    const eq = Math.floor(finalTotal / localNumPeople);
    for (let i = 0; i < localNumPeople; i++) {
      if (i === localNumPeople - 1) {
        arr.push(finalTotal - eq * (localNumPeople - 1));
      } else {
        arr.push(eq);
      }
    }
    return arr;
  }, [finalTotal, localNumPeople]);

  useEffect(() => {
    if (isBagiRata) {
      setCustomAmounts(equalAmounts);
    } else {
      const currentSum = customAmounts.reduce((a, b) => a + b, 0);
      if (currentSum !== finalTotal || customAmounts.length !== localNumPeople) {
        setCustomAmounts(equalAmounts);
      }
    }
  }, [localNumPeople, isBagiRata, equalAmounts, finalTotal, customAmounts]);

  const updatePortionManually = useCallback((idx: number, newVal: number) => {
    if (finalTotal <= 0) return;
    const clampedVal = Math.max(0, Math.min(finalTotal, newVal));
    
    setCustomAmounts(prev => {
      const next = [...prev];
      const N = localNumPeople;
      let sumBefore = 0;
      
      if (idx < N - 1) {
        for (let i = 0; i < idx; i++) {
          next[i] = prev[i] || 0;
          sumBefore += next[i];
        }
        
        if (clampedVal + sumBefore > finalTotal) {
          next[idx] = finalTotal - sumBefore;
          for (let i = idx + 1; i < N; i++) next[i] = 0;
        } else {
          next[idx] = clampedVal;
          const remaining = finalTotal - sumBefore - clampedVal;
          const subsequentPrev = prev.slice(idx + 1);
          const sumSubsequentPrev = subsequentPrev.reduce((a, b) => a + b, 0);
          
          if (sumSubsequentPrev > 0) {
            let distributed = 0;
            let lastSubIdx = -1;
            for (let i = idx + 1; i < N; i++) {
              const prevVal = prev[i] || 0;
              const scaled = Math.round((prevVal / sumSubsequentPrev) * remaining);
              next[i] = scaled;
              distributed += scaled;
              lastSubIdx = i;
            }
            if (lastSubIdx !== -1) next[lastSubIdx] = Math.max(0, next[lastSubIdx] + (remaining - distributed));
          } else {
            const countSub = N - 1 - idx;
            const share = Math.floor(remaining / countSub);
            let distributed = 0;
            for (let i = idx + 1; i < N; i++) {
              next[i] = share;
              distributed += share;
            }
            next[N - 1] += (remaining - distributed);
          }
        }
      } else {
        for (let i = 0; i < N - 2; i++) {
          next[i] = prev[i] || 0;
          sumBefore += next[i];
        }
        next[N - 1] = clampedVal;
        if (clampedVal + sumBefore > finalTotal) {
          next[N - 1] = finalTotal - sumBefore;
          next[N - 2] = 0;
        } else {
          next[N - 2] = finalTotal - sumBefore - clampedVal;
        }
      }
      return next;
    });
  }, [finalTotal, localNumPeople]);

  // ============================================================================
  // HANDLERS (Aksi & Interaksi Data)
  // ============================================================================

  const handleApplyPromo = () => {
    if (!promoCode.trim()) {
      setPromoError('Masukkan kode promo terlebih dahulu.');
      return;
    }
    const found = allVouchers.find(v => v.code.toUpperCase() === promoCode.trim().toUpperCase());
    if (!found) {
      setPromoError('Kode promo tidak ditemukan.');
      return;
    }
    const isActive = found.isActive !== false && found.is_active !== false;
    if (!isActive) {
      setPromoError('Kode promo sudah tidak aktif.');
      return;
    }
    
    if (setAppliedVoucher) setAppliedVoucher(found);
    toast.success(`Promo ${found.code} berhasil diterapkan.`);
    setPromoError('');
    setPromoCode('');
  };

  const buildTransactionPayload = (methodId: string | number, methodName: string, isPaid: boolean, receiptNum: string): TransactionData => {
    const totalProfit = cart.reduce((sum, item) => sum + ((item.price - (item.hpp || 0)) * item.qty), 0) - getDiscountAmount();
    const txNeedsKitchen = cart.some(item => categories.find((cat: any) => cat.id === item.categoryId || cat.id?.toString() === item.categoryId?.toString())?.needsKitchen !== false);

    return {
      subtotal: totals.subtotal,
      discount_type: appliedVoucher?.type || null,
      discount_value: appliedVoucher?.value || 0,
      discount_amount: getDiscountAmount(),
      total: finalTotal,
      payment_method_id: methodId,
      payment_amount: isPaid ? finalTotal : 0,
      payments: isPaid ? [{ method_id: methodId, method_name: methodName, amount: finalTotal, date: new Date().toISOString() }] : [],
      change: 0,
      profit: totalProfit,
      date: new Date().toISOString(),
      receipt_number: receiptNum,
      status: isPaid ? 'lunas' : 'belum lunas',
      kitchen_status: isPaid ? 'diproses' : 'pending',
      customer_name: (customerName || 'Tamu').trim(),
      table_number: (tableNumber?.toString() || '').trim(),
      remarks: `Pesanan via Web (${methodName})`,
      opened_at: new Date().toISOString(),
      closed_at: isPaid ? new Date().toISOString() : null,
      tax_and_service: getPpnAmount() + getAdminFee(),
      tax_amount: getPpnAmount(),
      admin_fee: getAdminFee(),
      needs_kitchen: txNeedsKitchen,
      customer_phone: (customerPhone || '').trim() || null,
    };
  };

  const processCheckoutInternals = async (txId: string | number) => {
    const itemRecords: TransactionItemRecord[] = cart.map(c => ({
      transaction_id: txId,
      product_id: c.id,
      product_name: c.name,
      quantity: c.qty,
      price: c.price,
      hpp: c.hpp || 0,
      discount_type: null,
      discount_value: 0,
      discount_amount: 0,
      subtotal: (c.price + (c.selectedVariants?.reduce((s: number, a: SelectedVariant) => s + a.price, 0) || 0)) * c.qty,
      selected_variants: c.selectedVariants || [],
      notes: c.notes,
    }));

    await createTransactionItems(itemRecords);

    await Promise.all(cart.map(item => {
      const newStock = (item.stock || 0) - item.qty;
      return updateProductStock(item.id, newStock);
    }));

    return itemRecords;
  };

  const handlePay = async () => {
    if (!selectedMethod) {
      toast.info('Silakan pilih metode pembayaran terlebih dahulu.');
      return setPaymentModalOpen(true);
    }

    if (selectedMethod.category === 'tunai') {
      setProcessing(true);
      try {
        const receiptNumber = `TX${Date.now()}`;
        const txData = buildTransactionPayload(selectedMethod.id, selectedMethod.name, false, receiptNumber);
        
        const txId = await createTransaction(txData);
        if (!txId) throw new Error('Gagal membuat transaksi.');
        saveLocalTransactionId(txId);

        const itemRecords = await processCheckoutInternals(txId);

        setFinalOrderData({ transaction: { ...txData, id: txId }, items: itemRecords, paymentMethodName: selectedMethod.name });
        
        sendPushToRole(['admin', 'kasir', 'kitchen', 'dapur', 'user'], {
          title: 'Pesanan Baru Masuk! 🚀',
          body:  `Pesanan dari ${txData.customer_name} menunggu pembayaran tunai.`,
          url:   '/admin/pesanan-aktif',
        }).catch(console.error);

        setCart([]);
        setView('success');
      } catch (err) {
        console.error('Error in handlePay:', err);
        toast.error("Terjadi kesalahan saat membuat pesanan.");
      } finally {
        setProcessing(false);
      }
    } else {
      const receiptNumber = pendingReceiptNumber || `TX${Date.now()}`;
      setPendingReceiptNumber(receiptNumber);
      setPaymentProcessOpen(true);
    }
  };

  const onMidtransSuccess = async () => {
    setPaymentProcessOpen(false);
    setProcessing(true);
    try {
      const receiptNumber = pendingReceiptNumber || `TX${Date.now()}`;
      const methodName = selectedMethod ? selectedMethod.name : 'Pembayaran Online';
      const methodId = selectedMethod ? selectedMethod.id : 0;
      
      const txData = buildTransactionPayload(methodId, methodName, true, receiptNumber);
      const existing = await fetchTransactionByReceiptNumber(receiptNumber);
      
      let txId: string | number;

      if (existing) {
        await appendPaymentToTransactionByReceipt(receiptNumber, txData.payments[0]);
        txId = existing.id;
      } else {
        txId = await createTransaction(txData);
        if (!txId) throw new Error('Gagal membuat transaksi baru.');
        saveLocalTransactionId(txId);
        
        const itemRecords = await processCheckoutInternals(txId);
        
        setFinalOrderData({ transaction: { ...txData, id: txId }, items: itemRecords, paymentMethodName: methodName });
        
        sendPushToRole(['admin', 'kasir', 'kitchen', 'dapur', 'user'], {
          title: 'Pembayaran Diterima! 💸',
          body:  `Pesanan dari ${txData.customer_name} telah lunas dibayar via Online Payment.`,
          url:   '/admin/pesanan-aktif',
        }).catch(console.error);
        
        setCart([]);
      }

      const updated = await fetchTransactionByReceiptNumber(receiptNumber);
      const updatedStatus = (updated?.status || '').toLowerCase();

      setView(updatedStatus === 'lunas' ? 'success' : 'tracking');
    } catch (err) {
      console.error('Error onMidtransSuccess:', err);
      toast.error("Gagal memvalidasi transaksi online.");
    } finally {
      setProcessing(false);
    }
  };

  const handleConfirmManualPayment = async () => {
    if (!selectedMethod) return;
    setProcessing(true);
    try {
      const receiptNumber = pendingReceiptNumber || `TX${Date.now()}`;
      const txData = buildTransactionPayload(selectedMethod.id, selectedMethod.name, false, receiptNumber);
      
      const txId = await createTransaction(txData);
      if (!txId) throw new Error('Gagal inisiasi pesanan.');
      saveLocalTransactionId(txId);

      const itemRecords = await processCheckoutInternals(txId);

      setFinalOrderData({ transaction: { ...txData, id: txId }, items: itemRecords, paymentMethodName: selectedMethod.name });

      sendPushToRole(['admin', 'kasir', 'kitchen', 'dapur', 'user'], {
        title: 'Pesanan Baru Masuk! 🚀',
        body:  `Pesanan manual via ${selectedMethod.name} menunggu konfirmasi bukti transfer.`,
        url:   '/admin/pesanan-aktif',
      }).catch(console.error);

      const tableText = tableNumber === 'Bawa Pulang' ? 'Take Away' : `Meja ${tableNumber}`;
      const itemsText = cart.map(item => `- ${item.name} x${item.qty} (${FORMAT_IDR(item.price * item.qty)})`).join('\n');
      const ppnLine = getPpnAmount() > 0 ? `\n- PPN: +${FORMAT_IDR(getPpnAmount())}` : '';
      const adminLine = getAdminFee() > 0 ? `\n- Admin: +${FORMAT_IDR(getAdminFee())}` : '';
      
      const waRawMsg = `Halo Admin, konfirmasi pembayaran pesanan:\n\n*Pemesan:* ${customerName || 'Tamu'}\n*Tipe/Meja:* ${tableText}\n*No. Struk:* ${receiptNumber}\n\n*Pesanan:*\n${itemsText}\n- Subtotal: ${FORMAT_IDR(totals.subtotal)}${ppnLine}${adminLine}\n\n*Total Tagihan:* ${FORMAT_IDR(finalTotal)}\n*Metode:* ${selectedMethod.name}\n\nBerikut bukti pembayarannya. Mohon diproses.`;
      
      const waUrl = `https://wa.me/${(storeSettings?.phone || '').replace(/\D/g, '')}?text=${encodeURIComponent(waRawMsg)}`;
      
      setCart([]);
      setPaymentProcessOpen(false);
      window.open(waUrl, '_blank');
      setView('success');
    } catch (err) {
      console.error('Error Confirm Manual Payment:', err);
      toast.error("Gagal memproses pesanan manual.");
    } finally {
      setProcessing(false);
    }
  };

  const handleDownloadQR = () => {
    if (!qrisImageUrl) {
      toast.error('QRIS belum siap diunduh.');
      return;
    }
    try {
      const link = document.createElement('a');
      link.download = `QRIS_${customerName || 'Invoice'}_${Date.now()}.png`;
      link.href = qrisImageUrl;
      link.click();
      toast.success('Kode QRIS tersimpan di galeri.');
    } catch (error) {
      console.error('Error downloading QR:', error);
      toast.error('Gagal menyimpan gambar.');
    }
  };

  // ============================================================================
  // RENDERING UI UTAMA
  // ============================================================================

  return (
    <div className="flex-1 flex flex-col bg-transparent min-h-screen font-sans animate-in fade-in duration-300">
      
      {/* 1. Header (Sticky) */}
      <div className="sticky top-0 z-30 bg-white/40 dark:bg-black/40 backdrop-blur-md border-b border-white/20 px-4 py-3.5 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setView('menu')} 
            className="w-8 h-8 flex items-center justify-center text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-full transition-colors"
          >
            <ChevronLeft size={20} strokeWidth={2.5} />
          </button>
          <h1 className="font-bold text-[16px] text-slate-900 dark:text-white tracking-tight">
            Checkout Pesanan
          </h1>
        </div>
        <button 
          onClick={() => setClearConfirmOpen(true)} 
          className="p-2 text-slate-400 hover:text-red-500 rounded-full transition-colors"
        >
          <Trash2 size={20} />
        </button>
      </div>

      {/* 2. Body Scrollable */}
      <div className="flex-1 flex flex-col pb-6">
        
        <OrderInfoBlock customerName={customerName} tableNumber={tableNumber} />
        <SectionSpacer />

        <CartItemListBlock cart={cart} updateCartQty={updateCartQty} onAddMore={() => setView('menu')} />
        <SectionSpacer />

        {/* Blok Promo / Voucher */}
        <div className="glass-card rounded-[1.5rem] p-5 shadow-sm mx-4 border border-white/20 dark:border-white/10">
          <h3 className="text-[11px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-4">
            <TicketPercent size={16} /> Promo & Voucher
          </h3>
          
          <div className="flex gap-2.5">
            <input
              type="text"
              placeholder="Masukkan kode voucher"
              value={promoCode}
              onChange={(e) => { 
                setPromoCode(e.target.value.toUpperCase()); 
                setPromoError(''); 
              }}
              className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-semibold text-slate-900 dark:text-white placeholder-slate-400 focus:border-blue-500 focus:ring-1 outline-none transition-all"
            />
            <button
              onClick={handleApplyPromo}
              className="px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl transition-all shadow-sm"
            >
              Terapkan
            </button>
          </div>
          {promoError && <p className="text-[11px] font-bold text-red-500 mt-2 ml-1">{promoError}</p>}
          
          {appliedVoucher && (
            <div className="mt-4 p-3.5 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800/50 flex items-center justify-between">
              <div className="flex items-center gap-2.5 text-blue-700 dark:text-blue-400">
                <CheckCircle2 size={18} />
                <span className="text-xs font-bold">Voucher {appliedVoucher.code} Aktif</span>
              </div>
              <button 
                onClick={() => setAppliedVoucher && setAppliedVoucher(null)} 
                className="text-xs font-bold text-slate-500 hover:text-red-500 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm transition-colors"
              >
                Hapus
              </button>
            </div>
          )}
        </div>
        <SectionSpacer />

        {/* Blok Split Bill */}
        {storeSettings?.enableSplitBill !== false && (
          <>
            <div className="glass-card rounded-[1.5rem] p-5 shadow-sm mx-4 flex items-center justify-between border border-white/20 dark:border-white/10">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center shrink-0">
                  <Share2 size={18} className="text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Split Bill</h3>
                  {splitConfig?.active ? (
                    <p className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 mt-0.5">
                      Aktif • Dibagi {splitConfig.numPeople} Orang
                    </p>
                  ) : (
                    <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                      Bayar dengan Split Bill
                    </p>
                  )}
                </div>
              </div>

              <div>
                {splitConfig?.active ? (
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setSplitModalOpen(true)} 
                      className="px-3 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-lg transition-colors hover:bg-slate-200 dark:hover:bg-slate-700"
                    >
                      Ubah
                    </button>
                    <button 
                      onClick={() => { if(setSplitConfig) setSplitConfig(null); toast.info('Dimatikan'); }} 
                      className="px-3 py-2 text-red-600 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 text-xs font-bold rounded-lg transition-colors"
                    >
                      Batal
                    </button>
                  </div>
                ) : (
                  <button 
                    onClick={() => setSplitModalOpen(true)} 
                    className="px-5 py-2 min-w-[80px] text-center bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-xs font-bold rounded-lg transition-colors"
                  >
                    Atur
                  </button>
                )}
              </div>
            </div>
            <SectionSpacer />
          </>
        )}

        {/* Blok Pemilihan Metode Pembayaran Utama */}
        {!splitConfig?.active && (
          <>
            <div 
              className="glass-card rounded-[1.5rem] p-5 cursor-pointer hover:bg-white/20 dark:hover:bg-white/10 transition-all flex items-center justify-between border border-white/20 dark:border-white/10 mx-4 shadow-sm" 
              onClick={() => setPaymentModalOpen(true)}
            >
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center shrink-0">
                  <CreditCard size={18} className="text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Metode Pembayaran</h3>
                  <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                    {selectedMethod ? 'Ketuk untuk mengubah' : 'Pilih cara bayar'}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {selectedMethod ? (
                  <button className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                    <PaymentLogoBlock 
                      src={getPaymentLogoSrc(selectedMethod)} 
                      alt={selectedMethod.name} 
                      IconComponent={RpIcon} 
                      small={true}
                    />
                    <span className="text-xs font-bold text-slate-900 dark:text-white">{selectedMethod.name}</span>
                  </button>
                ) : (
                  <button className="px-5 py-2 min-w-[80px] text-center font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded-lg transition-colors text-xs">
                    Pilih
                  </button>
                )}
              </div>
            </div>
            <SectionSpacer />
          </>
        )}

        {/* Blok Rincian Tagihan */}
        <div className="glass-card rounded-[1.5rem] p-5 shadow-sm mx-4 border border-white/20 dark:border-white/10">
          <h3 className="text-[11px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-5">
            <RpIcon size={16} /> Rincian Pembayaran
          </h3>
          
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="font-medium text-slate-600 dark:text-slate-400">Total Harga</span>
              <span className="font-bold text-slate-900 dark:text-white">{FORMAT_IDR(totals.subtotal)}</span>
            </div>
            
            {getDiscountAmount() > 0 && (
              <div className="flex justify-between text-sm">
                <span className="font-medium text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                  <TicketPercent size={14} /> Diskon
                </span>
                <span className="font-bold text-blue-600 dark:text-blue-400">-{FORMAT_IDR(getDiscountAmount())}</span>
              </div>
            )}
            
            {storeSettings?.enableTax && getPpnAmount() > 0 && (
              <div className="flex justify-between text-sm">
                <span className="font-medium text-slate-600 dark:text-slate-400">Pajak ({storeSettings.taxPercentage}%)</span>
                <span className="font-bold text-slate-900 dark:text-white">+{FORMAT_IDR(getPpnAmount())}</span>
              </div>
            )}
            
            {!splitConfig?.active && selectedMethod && getAdminFee() > 0 && (
              <div className="flex justify-between text-sm">
                <span className="font-medium text-slate-600 dark:text-slate-400">Biaya Layanan</span>
                <span className="font-bold text-slate-900 dark:text-white">+{FORMAT_IDR(getAdminFee())}</span>
              </div>
            )}
          </div>
          
          <div className="mt-5 pt-5 border-t-2 border-dashed border-slate-200 dark:border-slate-800 flex justify-between items-end">
            <div>
              <span className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Total Bayar</span>
            </div>
            <span className="text-[22px] font-black text-blue-600 dark:text-blue-400 leading-none">
              {FORMAT_IDR(finalTotal)}
            </span>
          </div>
        </div>

        {/* 3. Action Tombol Pembayaran */}
        <div className="mt-auto px-5 pt-8 pb-4">
          <button 
            onClick={() => {
              if (splitConfig?.active && storeSettings?.enableSplitBill !== false) {
                setView('split');
              } else {
                handlePay();
              }
            }}
            disabled={processing || cart.length === 0}
            className="w-full h-[52px] bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-800 text-white rounded-2xl font-bold text-sm flex justify-center items-center gap-2.5 shadow-lg shadow-blue-600/20 disabled:shadow-none transition-all active:scale-[0.98]"
          >
            {processing ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Memproses...
              </>
            ) : (
              <>
                {(splitConfig?.active && storeSettings?.enableSplitBill !== false) ? 'Lanjutkan Pembayaran (Split Bill)' : 'Buat Pesanan Sekarang'}
                <ArrowRight size={18} strokeWidth={3} />
              </>
            )}
          </button>
        </div>

      </div> 

      {/* ============================================================================ */}
      {/* AREA MODALS & DIALOGS */}
      {/* ============================================================================ */}

      <AlertDialog open={clearConfirmOpen} onOpenChange={setClearConfirmOpen}>
        <AlertDialogContent className="max-w-[340px] w-[90vw] rounded-3xl p-6 bg-white dark:bg-slate-900 border-none shadow-2xl">
          <AlertDialogHeader>
            <div className="w-14 h-14 rounded-full bg-red-50 dark:bg-red-500/10 flex items-center justify-center mx-auto mb-3">
              <Trash2 className="w-7 h-7 text-red-500" />
            </div>
            <AlertDialogTitle className="text-center text-lg font-bold text-slate-900 dark:text-white">Batalkan Pesanan?</AlertDialogTitle>
            <AlertDialogDescription className="text-center text-sm font-medium text-slate-500 dark:text-slate-400 mt-2">
              Pesanan di keranjang Anda akan dihapus sepenuhnya.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6 flex flex-row gap-3">
            <AlertDialogCancel className="flex-1 mt-0 h-12 rounded-xl font-bold border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              Tutup
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => { setCart([]); setClearConfirmOpen(false); setView('menu'); }} 
              className="flex-1 h-12 rounded-xl font-bold bg-red-500 hover:bg-red-600 text-white shadow-none"
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <SplitBillModal
        isOpen={splitModalOpen}
        onClose={() => setSplitModalOpen(false)}
        finalTotal={finalTotal}
        localNumPeople={localNumPeople}
        setLocalNumPeople={setLocalNumPeople}
        isBagiRata={isBagiRata}
        setIsBagiRata={setIsBagiRata}
        customAmounts={customAmounts}
        setCustomAmounts={setCustomAmounts}
        portionMethods={portionMethods}
        setPortionMethods={setPortionMethods}
        setSplitConfig={setSplitConfig}
        updatePortionManually={updatePortionManually}
      />

      {/* Centered Scrollable Modal Pemilihan Metode Pembayaran */}
      <PaymentSelectorModal
        isOpen={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        paymentMethods={finalPaymentMethods}
        selectedMethodId={selectedMethodId}
        setSelectedMethodId={setSelectedMethodId}
      />

      <PaymentModal
        isOpen={paymentProcessOpen}
        onClose={() => setPaymentProcessOpen(false)}
        selectedMethod={selectedMethod}
        finalTotal={finalTotal}
        customerName={customerName || 'Tamu'}
        qrisImageUrl={qrisImageUrl}
        setQrisImageUrl={setQrisImageUrl}
        processing={processing}
        onConfirm={handleConfirmManualPayment}
        onDownloadQR={handleDownloadQR}
        receiptNumber={pendingReceiptNumber}
        onMidtransSuccess={onMidtransSuccess}
        onMidtransPending={() => { 
          setPaymentProcessOpen(false); 
          toast.info('Menunggu konfirmasi pembayaran...'); 
        }}
        onMidtransError={() => { 
          setPaymentProcessOpen(false); 
          toast.error('Pembayaran gagal atau kedaluwarsa.'); 
        }}
      />
    </div>
  );
}
