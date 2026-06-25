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
  <div className="h-2 w-full bg-[#f6f6f6] dark:bg-slate-950 border-y-2 border-black dark:border-slate-700" />
));
SectionSpacer.displayName = 'SectionSpacer';

export const PaymentLogoBlock = React.memo(({ src, alt, IconComponent, isSelected, small }: { src: string | null, alt: string, IconComponent: any, isSelected?: boolean, small?: boolean }) => {
  const sizeClass = small ? "w-8 h-8 p-1" : "w-12 h-12 p-1.5";
  return (
    <div className={`${sizeClass} flex items-center justify-center shrink-0 bg-white dark:bg-slate-800 border-2 border-black dark:border-slate-700 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_#374151] overflow-hidden rounded-md`}>
      {src ? (
        <img src={src} alt={alt} loading="lazy" className="w-full h-full object-contain" />
      ) : (
        <IconComponent size={small ? 14 : 22} className="text-black dark:text-amber-400" strokeWidth={2.5} />
      )}
    </div>
  );
});
PaymentLogoBlock.displayName = 'PaymentLogoBlock';

const OrderInfoBlock = React.memo(({ customerName, tableNumber }: { customerName?: string | null, tableNumber?: string | number }) => {
  const parsedTable = parseTableNumber(tableNumber);
  
  return (
    <div className="mx-4 mt-4 bg-white dark:bg-slate-900 p-5 border-3 border-black dark:border-slate-700 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] dark:shadow-[6px_6px_0px_0px_#374151] rounded-2xl">
      <h3 className="text-xs font-black text-black dark:text-white uppercase tracking-wider mb-4 bg-[#ffc700] border-2 border-black dark:border-slate-700 inline-block px-2.5 py-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_#374151] rounded-xl">
        Detail Pemesan
      </h3>
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-9 h-9 border-2 border-black dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-center shrink-0 rounded-xl shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_#374151]">
            <User size={18} className="text-black dark:text-white" strokeWidth={2.5} />
          </div>
          <div className="flex-1">
            <p className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 leading-none mb-1">Nama Pelanggan</p>
            <p className="text-sm font-black text-black dark:text-white leading-none">
              {customerName || 'Tamu / Tanpa Nama'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3.5">
          <div className="w-9 h-9 border-2 border-black dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-center shrink-0 rounded-xl shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_#374151]">
            {parsedTable.isTakeAway ? (
              <ShoppingBag size={18} className="text-black dark:text-white" strokeWidth={2.5} />
            ) : (
              <Hash size={18} className="text-black dark:text-white" strokeWidth={2.5} />
            )}
          </div>
          <div className="flex-1">
            <p className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 leading-none mb-1.5">Tipe Pesanan</p>
            {parsedTable.isTakeAway ? (
              <span className="inline-flex items-center text-[10px] font-black text-black bg-[#ffc700] px-2.5 py-1 border-2 border-black dark:border-slate-700 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_#374151] uppercase rounded-xl">
                Bawa Pulang (Take Away)
              </span>
            ) : (
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center text-[10px] font-black text-black bg-white dark:bg-slate-800 px-2.5 py-1 border-2 border-black dark:border-slate-700 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_#374151] uppercase rounded-xl">
                  {parsedTable.area}
                </span>
                <span className="inline-flex items-center text-[10px] font-black text-black bg-[#ffc700] px-2.5 py-1 border-2 border-black dark:border-slate-700 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_#374151] uppercase rounded-xl">
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
    <div className="mx-4 mt-4 bg-white dark:bg-slate-900 p-5 border-3 border-black dark:border-slate-700 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] dark:shadow-[6px_6px_0px_0px_#374151] rounded-2xl">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-black text-black dark:text-white uppercase tracking-wider bg-[#ffc700] border-2 border-black dark:border-slate-700 inline-block px-2.5 py-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_#374151] rounded-xl">
          Daftar Pesanan
        </h3>
        <button 
          onClick={onAddMore} 
          className="text-[10px] font-black uppercase text-black bg-white border-2 border-black dark:border-slate-700 px-3 py-1.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_#374151] hover:translate-x-[0.5px] hover:translate-y-[0.5px] hover:shadow-[1.5px_1.5px_0px_0px_rgba(0,0,0,1)] dark:hover:shadow-[1.5px_1.5px_0px_0px_#374151] transition-all flex items-center gap-1 rounded-xl active:scale-95"
        >
          <Plus size={12} strokeWidth={3} /> Tambah Menu
        </button>
      </div>

      <div className="space-y-4 mt-2">
        {cart.map((item, index) => {
          const variantTotal = item.selectedVariants?.reduce((s: number, a: SelectedVariant) => s + a.price, 0) || 0;
          const itemTotal = (item.price + variantTotal) * item.qty;

          return (
            <div key={item.cartId || item.id} className="relative">
              <div className="flex gap-4 bg-white dark:bg-slate-850 p-3 border-2 border-black dark:border-slate-700 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_#374151] rounded-2xl">
                <div className="w-16 h-16 sm:w-20 sm:h-20 border-2 border-black dark:border-slate-700 shrink-0 flex items-center justify-center overflow-hidden bg-slate-100 rounded-xl">
                  {item.photo ? (
                    <img src={cldThumb(item.photo)} alt={item.name} decoding="async" loading="lazy" className="w-full h-full object-cover" />
                  ) : (
                    <LayoutGrid size={24} className="text-black" />
                  )}
                </div>
                
                <div className="flex-1 flex flex-col justify-center min-w-0">
                  <h4 className="font-black text-sm text-black dark:text-white leading-tight uppercase tracking-tight mb-1 truncate">
                    {item.name}
                  </h4>
                  
                  {item.selectedVariants && item.selectedVariants.length > 0 && (
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide line-clamp-1 mb-1">
                      {item.selectedVariants.map((a) => a.optionName).join(', ')}
                    </p>
                  )}
                  
                  {item.notes && (
                    <div className="mt-1 mb-1.5 inline-flex">
                      <p className="text-[9px] font-black uppercase text-black bg-[#fffdf0] border border-black px-2 py-0.5 truncate max-w-full rounded-lg">
                        Catatan: {item.notes}
                      </p>
                    </div>
                  )}

                  <div className="flex items-center justify-between mt-1">
                    <span className="font-black text-sm text-black dark:text-white">
                      {FORMAT_IDR(itemTotal)}
                    </span>
                    
                    {updateCartQty && (
                      <div className="flex items-center bg-white border-2 border-black dark:border-slate-700 p-0.5 shadow-[1.5px_1.5px_0px_0px_rgba(0,0,0,1)] dark:shadow-[1.5px_1.5px_0px_0px_#374151] rounded-xl">
                        <button 
                          onClick={() => updateCartQty(item.cartId || item.id, -1)} 
                          className="w-6 h-6 bg-[#ffc700] hover:bg-[#ffe066] border border-black flex items-center justify-center text-black active:scale-95 transition-transform rounded-lg"
                        >
                          <Minus size={12} strokeWidth={3} />
                        </button>
                        <span className="text-xs font-black w-6 text-center text-black select-none">
                          {item.qty}
                        </span>
                        <button 
                          onClick={() => updateCartQty(item.cartId || item.id, 1)} 
                          className="w-6 h-6 bg-[#ffc700] hover:bg-[#ffe066] border border-black flex items-center justify-center text-black active:scale-95 transition-transform rounded-lg"
                        >
                          <Plus size={12} strokeWidth={3} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
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
    <div className="flex-1 flex flex-col bg-slate-50 dark:bg-slate-950 min-h-screen font-sans animate-in fade-in duration-300">
      
      {/* 1. Header (Sticky) */}
      <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b-3 border-black dark:border-slate-700 px-4 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setView('menu')} 
            className="w-11 h-11 flex items-center justify-center bg-[#ffc700] hover:bg-[#ffe066] border-2 border-black dark:border-slate-700 text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_#374151] rounded-xl active:translate-x-[0.5px] active:translate-y-[0.5px] transition-all"
          >
            <ChevronLeft size={20} strokeWidth={3} />
          </button>
          <h1 className="font-black text-sm uppercase tracking-wider text-black dark:text-white tracking-tight">
            Checkout Pesanan
          </h1>
        </div>
        <button 
          onClick={() => setClearConfirmOpen(true)} 
          className="w-11 h-11 flex items-center justify-center bg-white dark:bg-slate-800 hover:bg-[#fffdf0] dark:hover:bg-slate-700 text-red-500 border-2 border-black dark:border-slate-700 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_#374151] rounded-xl active:translate-x-[0.5px] active:translate-y-[0.5px] transition-all"
        >
          <Trash2 size={20} strokeWidth={2.5} />
        </button>
      </div>

      {/* 2. Body Scrollable */}
      <div className="flex-1 flex flex-col pb-6">
        
        <OrderInfoBlock customerName={customerName} tableNumber={tableNumber} />

        <CartItemListBlock cart={cart} updateCartQty={updateCartQty} onAddMore={() => setView('menu')} />

        {/* Blok Promo / Voucher */}
        <div className="mx-4 mt-4 bg-white dark:bg-slate-900 p-5 border-3 border-black dark:border-slate-700 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] dark:shadow-[6px_6px_0px_0px_#374151] rounded-2xl">
          <h3 className="text-xs font-black text-black dark:text-white uppercase tracking-wider mb-4 bg-[#ffc700] border-2 border-black dark:border-slate-700 inline-block px-2.5 py-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_#374151] rounded-xl flex items-center gap-1.5 w-fit">
            <TicketPercent size={14} strokeWidth={2.5} /> Promo & Voucher
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
              className="flex-1 bg-white dark:bg-slate-900 border-2 border-black dark:border-slate-700 p-3 text-xs font-bold uppercase outline-none focus:bg-[#fffdf0] placeholder-slate-400 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_#374151] text-black dark:text-white rounded-xl"
            />
            <button
              onClick={handleApplyPromo}
              className="px-5 bg-[#ffc700] hover:bg-[#ffe066] text-black font-black uppercase text-xs border-2 border-black dark:border-slate-700 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_#374151] rounded-xl active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all"
            >
              Terapkan
            </button>
          </div>
          {promoError && <p className="text-[10px] font-black text-red-500 mt-2 ml-1 uppercase">{promoError}</p>}
          
          {appliedVoucher && (
            <div className="mt-4 p-3 bg-white dark:bg-slate-800 border-2 border-black dark:border-slate-700 flex items-center justify-between shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_#374151] rounded-xl">
              <div className="flex items-center gap-2 text-black dark:text-white">
                <CheckCircle2 size={16} strokeWidth={3} className="text-black dark:text-white" />
                <span className="text-xs font-black uppercase tracking-wide">Voucher {appliedVoucher.code} Aktif</span>
              </div>
              <button 
                onClick={() => setAppliedVoucher && setAppliedVoucher(null)} 
                className="text-[10px] font-black uppercase text-black bg-red-500 hover:bg-red-600 border border-black dark:border-slate-700 px-3 py-1.5 shadow-[1.5px_1.5px_0px_0px_rgba(0,0,0,1)] dark:shadow-[1.5px_1.5px_0px_0px_#374151] active:scale-95 transition-all text-white rounded-lg"
              >
                Hapus
              </button>
            </div>
          )}
        </div>

        {/* Blok Split Bill */}
        {storeSettings?.enableSplitBill !== false && (
          <div className="mx-4 mt-4 bg-white dark:bg-slate-900 p-5 flex items-center justify-between border-3 border-black dark:border-slate-700 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] dark:shadow-[6px_6px_0px_0px_#374151] rounded-2xl">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 border-2 border-black dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-center shrink-0 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_#374151] rounded-xl">
                <Share2 size={18} className="text-black dark:text-white" strokeWidth={2.5} />
              </div>
              <div>
                <h3 className="text-sm font-black text-black dark:text-white uppercase tracking-tight">Split Bill</h3>
                {splitConfig?.active ? (
                  <p className="text-[10px] font-bold text-[#ffc700] uppercase mt-0.5 bg-black dark:bg-white dark:text-black px-1.5 py-0.5 border border-black w-fit rounded-lg">
                    Aktif • Dibagi {splitConfig.numPeople} Orang
                  </p>
                ) : (
                  <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
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
                    className="px-3 py-1.5 bg-white dark:bg-slate-800 border-2 border-black dark:border-slate-700 text-black dark:text-white text-[10px] font-black uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_#374151] hover:translate-x-[0.5px] hover:translate-y-[0.5px] hover:shadow-[1.5px_1.5px_0px_0px_rgba(0,0,0,1)] dark:hover:shadow-[1.5px_1.5px_0px_0px_#374151] active:scale-95 transition-all rounded-xl"
                  >
                    Ubah
                  </button>
                  <button 
                    onClick={() => { if(setSplitConfig) setSplitConfig(null); toast.info('Dimatikan'); }} 
                    className="px-3 py-1.5 bg-red-500 border-2 border-black dark:border-slate-700 text-white text-[10px] font-black uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_#374151] hover:translate-x-[0.5px] hover:translate-y-[0.5px] hover:shadow-[1.5px_1.5px_0px_0px_rgba(0,0,0,1)] dark:hover:shadow-[1.5px_1.5px_0px_0px_#374151] active:scale-95 transition-all rounded-xl"
                  >
                    Batal
                  </button>
                </div>
              ) : (
                <button 
                  onClick={() => setSplitModalOpen(true)} 
                  className="px-4 py-2 text-center bg-[#ffc700] hover:bg-[#ffe066] text-black text-[10px] font-black border-2 border-black dark:border-slate-700 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_#374151] active:translate-x-[0.5px] active:translate-y-[0.5px] active:shadow-none transition-all uppercase rounded-xl"
                >
                  Atur
                </button>
              )}
            </div>
          </div>
        )}

        {/* Blok Pemilihan Metode Pembayaran Utama */}
        {!splitConfig?.active && (
          <div 
            className="mx-4 mt-4 bg-white dark:bg-slate-900 p-5 cursor-pointer flex items-center justify-between border-3 border-black dark:border-slate-700 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] dark:shadow-[6px_6px_0px_0px_#374151] rounded-2xl" 
            onClick={() => setPaymentModalOpen(true)}
          >
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 border-2 border-black dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-center shrink-0 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_#374151] rounded-xl">
                <CreditCard size={18} className="text-black dark:text-white" strokeWidth={2.5} />
              </div>
              <div>
                <h3 className="text-sm font-black text-black dark:text-white uppercase tracking-tight">Metode Pembayaran</h3>
                <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                  {selectedMethod ? 'KETUK UNTUK MENGUBAH' : 'PILIH CARA BAYAR'}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {selectedMethod ? (
                <button className="flex items-center gap-2 bg-white dark:bg-slate-800 border-2 border-black dark:border-slate-700 p-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_#374151] rounded-xl">
                  <PaymentLogoBlock 
                    src={getPaymentLogoSrc(selectedMethod)} 
                    alt={selectedMethod.name} 
                    IconComponent={RpIcon} 
                    small={true}
                  />
                  <span className="text-[11px] font-black text-black dark:text-white uppercase pr-1">{selectedMethod.name}</span>
                </button>
              ) : (
                <button className="px-4 py-2 bg-[#ffc700] hover:bg-[#ffe066] border-2 border-black dark:border-slate-700 text-black text-[10px] font-black uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_#374151] active:translate-x-[0.5px] active:translate-y-[0.5px] active:shadow-none transition-all rounded-xl">
                  Pilih
                </button>
              )}
            </div>
          </div>
        )}

        {/* Blok Rincian Tagihan */}
        <div className="mx-4 mt-4 mb-6 bg-white dark:bg-slate-900 p-5 border-3 border-black dark:border-slate-700 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] dark:shadow-[6px_6px_0px_0px_#374151] rounded-2xl">
          <h3 className="text-xs font-black text-black dark:text-white uppercase tracking-wider mb-5 bg-[#ffc700] border-2 border-black dark:border-slate-700 inline-block px-2.5 py-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_#374151] rounded-xl flex items-center gap-1.5 w-fit">
            <RpIcon size={14} strokeWidth={2.5} /> Rincian Pembayaran
          </h3>
          
          <div className="space-y-3 font-bold text-xs uppercase">
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">Total Harga</span>
              <span className="font-black text-black dark:text-white">{FORMAT_IDR(totals.subtotal)}</span>
            </div>
            
            {getDiscountAmount() > 0 && (
              <div className="flex justify-between text-black">
                <span className="font-black flex items-center gap-1">
                  <TicketPercent size={14} strokeWidth={2.5} /> Diskon
                </span>
                <span className="font-black bg-red-500 text-white border border-black px-1">-{FORMAT_IDR(getDiscountAmount())}</span>
              </div>
            )}
            
            {storeSettings?.enableTax && getPpnAmount() > 0 && (
              <div className="flex justify-between">
                <span className="text-slate-600 dark:text-slate-400">Pajak ({storeSettings.taxPercentage}%)</span>
                <span className="font-black text-black dark:text-white">+{FORMAT_IDR(getPpnAmount())}</span>
              </div>
            )}
            
            {!splitConfig?.active && selectedMethod && getAdminFee() > 0 && (
              <div className="flex justify-between">
                <span className="text-slate-600 dark:text-slate-400">Biaya Layanan</span>
                <span className="font-black text-black dark:text-white">+{FORMAT_IDR(getAdminFee())}</span>
              </div>
            )}
          </div>
          
          <div className="mt-5 pt-5 border-t-2 border-dashed border-black dark:border-slate-700 flex justify-between items-center">
            <div>
              <span className="block text-[11px] font-black text-black dark:text-white uppercase tracking-wider">Total Bayar</span>
            </div>
            <span className="text-[22px] font-black bg-black text-[#ffc700] dark:bg-white dark:text-black border-2 border-black dark:border-slate-700 px-3 py-1 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_#374151] leading-none">
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
            className="w-full h-14 bg-[#ffc700] hover:bg-[#ffe066] disabled:bg-slate-200 disabled:text-slate-400 border-3 border-black dark:border-slate-700 text-black font-black uppercase tracking-wider text-xs flex justify-center items-center gap-2.5 shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] dark:shadow-[5px_5px_0px_0px_#374151] disabled:shadow-none transition-all active:translate-x-[2px] active:translate-y-[2px] active:shadow-none rounded-2xl"
          >
            {processing ? (
              <>
                <div className="w-4 h-4 border-2 border-black border-t-white rounded-full animate-spin" />
                Memproses...
              </>
            ) : (
              <>
                {(splitConfig?.active && storeSettings?.enableSplitBill !== false) ? 'Lanjutkan Pembayaran (Split Bill)' : 'Buat Pesanan Sekarang'}
                <ArrowRight size={16} strokeWidth={3} />
              </>
            )}
          </button>
        </div>

      </div> 

      {/* ============================================================================ */}
      {/* AREA MODALS & DIALOGS */}
      {/* ============================================================================ */}

      <AlertDialog open={clearConfirmOpen} onOpenChange={setClearConfirmOpen}>
        <AlertDialogContent className="max-w-[340px] w-[90vw] rounded-3xl p-6 bg-white dark:bg-slate-900 border-3 border-black dark:border-slate-700 text-black dark:text-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_#374151]">
          <AlertDialogHeader>
            <div className="w-14 h-14 bg-[#ff90e8] border-2 border-black dark:border-slate-700 flex items-center justify-center mx-auto mb-3 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_#374151] rounded-xl">
              <Trash2 className="w-7 h-7 text-black" strokeWidth={2.5} />
            </div>
            <AlertDialogTitle className="text-center text-base font-black text-black dark:text-white uppercase tracking-wider">Batalkan Pesanan?</AlertDialogTitle>
            <AlertDialogDescription className="text-center text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-2 uppercase leading-relaxed">
              Pesanan di keranjang Anda akan dihapus sepenuhnya.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6 flex flex-row gap-3">
            <AlertDialogCancel className="flex-1 mt-0 h-12 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border-2 border-black dark:border-slate-700 text-black dark:text-white font-black uppercase text-xs tracking-wider shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_#374151] rounded-xl">
              Tutup
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => { setCart([]); setClearConfirmOpen(false); setView('menu'); }} 
              className="flex-1 h-12 bg-red-500 hover:bg-red-600 border-2 border-black dark:border-slate-700 text-white font-black uppercase text-xs tracking-wider shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_#374151] rounded-xl"
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
