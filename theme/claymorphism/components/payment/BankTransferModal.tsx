/**
 * BankTransferModal
 * Pilih bank → Snap membuka halaman VA bank tersebut secara langsung
 * via enabled_payments — tidak melalui halaman pilihan Snap.
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, XCircle, RefreshCw, ChevronLeft, Landmark } from 'lucide-react';
import { MidtransService } from '@/services/midtransService';
import { PaymentMethod } from '@/hooks/db-hooks';

interface BankTransferModalProps {
  isOpen: boolean;
  amount: number;
  customerName?: string;
  orderId?: string;
  paymentMethod?: PaymentMethod | null;
  onSuccess: () => void;
  onClose: () => void;
}

interface BankOption {
  id: string;
  name: string;
  snapKey: string; // nilai untuk enabled_payments
  color: string;
  abbr: string;
}

const BANKS: BankOption[] = [
  { id: 'bca', name: 'BCA', snapKey: 'bca_va', color: '#005CA9', abbr: 'BCA' },
  { id: 'bni', name: 'BNI', snapKey: 'bni_va', color: '#F68F1E', abbr: 'BNI' },
  { id: 'bri', name: 'BRI', snapKey: 'bri_va', color: '#004B87', abbr: 'BRI' },
  { id: 'mandiri', name: 'Mandiri', snapKey: 'mandiri_bill', color: '#003087', abbr: 'MND' },
  { id: 'seabank', name: 'SeaBank', snapKey: 'other_va', color: '#FF5722', abbr: 'SEA' },
  { id: 'permata', name: 'Permata', snapKey: 'permata_va', color: '#E30613', abbr: 'PRM' },
  { id: 'cimb', name: 'CIMB', snapKey: 'cimb_va', color: '#c0392b', abbr: 'CIMB' },
  { id: 'other', name: 'Bank Lain', snapKey: 'other_va', color: '#64748b', abbr: 'ATM' },
];

type Step = 'select' | 'loading' | 'success' | 'error';

export function BankTransferModal({
  isOpen,
  amount,
  customerName,
  paymentMethod,
  onSuccess,
  onClose,
}: BankTransferModalProps) {
  const [step, setStep] = useState<Step>('select');
  const [selectedBank, setSelectedBank] = useState<BankOption | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const onSuccessRef = useRef(onSuccess);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onSuccessRef.current = onSuccess; }, [onSuccess]);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  const isManual = paymentMethod?.provider === 'manual';

  useEffect(() => {
    if (isOpen) {
      if (isManual) {
        setStep('select'); // for manual we just display details on select step
      } else {
        setStep('select');
        setSelectedBank(null);
        setErrorMsg(null);
        MidtransService.loadSnapScript().catch((e) => console.warn('Snap script:', e));
      }
    }
  }, [isOpen, isManual]);

  const handleBankSelect = useCallback(async (bank: BankOption) => {
    if ((window as any).midtransSnapActive) {
      console.warn('Midtrans Snap active. Ignoring.');
      return;
    }
    (window as any).midtransSnapActive = true;
    
    setSelectedBank(bank);
    setStep('loading');
    setErrorMsg(null);
    const orderId = `MA-VA-${bank.id.toUpperCase()}-${Date.now()}`;

    try {
      const token = await MidtransService.createTransactionToken({
        transaction_details: {
          order_id: orderId,
          gross_amount: Math.round(amount),
        },
        item_details: [
          { name: 'Total Belanja MesenAe', price: Math.round(amount), quantity: 1 },
        ],
        customer_details: { first_name: customerName || 'Pelanggan MesenAe' },
        enabled_payments: [bank.snapKey],
      });

      // @ts-expect-error - window.snap injected globally
      if (!window.snap) throw new Error('Midtrans Snap belum siap.');

      // @ts-expect-error - window.snap injected globally
      window.snap.pay(token, {
        onSuccess: () => {
          (window as any).midtransSnapActive = false;
          setStep('success');
          setTimeout(() => onSuccessRef.current(), 1200);
        },
        onPending: () => {
          (window as any).midtransSnapActive = false;
          setStep('select');
        },
        onError: (result: any) => {
          (window as any).midtransSnapActive = false;
          console.error('Snap Bank Transfer Error:', result);
          setStep('error');
          setErrorMsg('Pembayaran gagal. Silakan pilih bank lain atau coba lagi.');
        },
        onClose: () => {
          (window as any).midtransSnapActive = false;
          setStep('select');
        },
      });

      // Set kembali ke select agar jika user tutup Snap, bisa pilih lagi
      // Jangan set state di sini secara asinkron karena onClose akan menangani
    } catch (err: any) {
      (window as any).midtransSnapActive = false;
      console.error('Bank Transfer Error:', err);
      setStep('error');
      setErrorMsg(err.message || `Gagal memulai transfer via ${bank.name}`);
    }
  }, [amount, customerName]);

  const handleClose = () => {
    if (step === 'loading') return;
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-[92vw] sm:max-w-[400px] p-0 overflow-hidden z-[100] clay-card [&>button]:text-white [&>button]:hover:text-white/80 [&>button]:top-3 [&>button]:right-3 [&>button]:z-[110]">
        {/* Header Compact */}
        <div className="bg-gradient-to-br from-blue-600 to-blue-500 p-4 text-white relative overflow-hidden">
          <div className="absolute -right-8 -top-8 w-24 h-24 bg-white/10 rounded-full blur-2xl pointer-events-none" />

          <DialogHeader className="relative z-10">
            <DialogTitle className="text-white text-base font-bold flex items-center gap-2 tracking-tight">
              {step === 'error' && (
                <button onClick={() => setStep('select')} className="mr-1 p-1 rounded-lg bg-white/10 hover:bg-white/20 transition-colors" aria-label="Kembali">
                  <ChevronLeft className="w-4 h-4" />
                </button>
              )}
              🏦 Transfer Bank
            </DialogTitle>
            <DialogDescription className="text-white/80 text-xs mt-0.5">
              Pilih bank dan ikuti instruksi pembayaran
            </DialogDescription>
          </DialogHeader>
          <div className="mt-3 bg-white/15 backdrop-blur-md rounded-2xl p-3 text-center border border-white/10">
            <p className="text-[11px] text-white/70 font-semibold uppercase tracking-wider">Total Transfer</p>
            <p className="text-2xl font-black text-white mt-0.5 tracking-tight">Rp {amount.toLocaleString('id-ID')}</p>
            <p className="text-xs text-white/70 mt-1">{customerName || 'Pelanggan MesenAe'}</p>
          </div>
        </div>

        {/* Body */}
        <div className="p-4 overflow-y-auto max-h-[55vh] custom-scrollbar-hide">
          {step === 'select' && isManual && paymentMethod && (
            <div className="animate-in fade-in zoom-in duration-300">
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-3 font-medium text-center">Silakan transfer ke rekening berikut:</p>
              
              <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800 mb-3 flex flex-col items-center text-center gap-2 shadow-inner">
                {paymentMethod.iconName ? (
                  <img src={`/ico/${paymentMethod.iconName}.svg`} alt={paymentMethod.bankName} className="h-10 object-contain mb-1" />
                ) : (
                  <Landmark className="w-10 h-10 text-primary mb-1 opacity-80" />
                )}
                <div>
                  <p className="text-xs text-primary uppercase tracking-wider font-bold">{paymentMethod.bankName}</p>
                  <p className="text-xl font-black tracking-tight text-slate-800 dark:text-slate-100 mt-1">{paymentMethod.accountNumber}</p>
                  <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 mt-1">a.n {paymentMethod.accountName}</p>
                </div>
              </div>

              <div className="flex gap-2">
                <button className="flex-1 clay-btn-secondary py-2 text-xs font-bold uppercase" onClick={handleClose}>Batalkan</button>
                <button
                  className="flex-1 clay-btn-primary py-2 text-xs font-bold uppercase"
                  onClick={() => {
                    setStep('success');
                    setTimeout(() => onSuccessRef.current(), 1200);
                  }}
                >
                  Konfirmasi Pembayaran
                </button>
              </div>
            </div>
          )}

          {step === 'select' && !isManual && (
            <>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 font-bold mb-3 uppercase tracking-wider">Pilih Bank Tujuan</p>
              <div className="grid grid-cols-4 gap-2">
                {BANKS.map((bank) => (
                  <button
                    key={bank.id}
                    onClick={() => handleBankSelect(bank)}
                    className="flex flex-col items-center justify-center p-2 rounded-xl border-2 border-slate-100 dark:border-slate-900 hover:border-blue-500 hover:bg-blue-500/5 transition-all active:scale-95 gap-1"
                  >
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center text-[10px] font-black text-white bg-slate-100 overflow-hidden"
                      style={{ backgroundColor: bank.color }}
                    >
                      {['bca', 'bni', 'bri', 'mandiri', 'seabank'].includes(bank.id) ? (
                        <img src={`/ico/${bank.id}.svg`} alt={bank.name} className="w-full h-full object-contain p-1 bg-white" />
                      ) : (
                        bank.abbr
                      )}
                    </div>
                    <span className="text-[10px] font-semibold text-foreground leading-tight text-center">
                      {bank.name}
                    </span>
                  </button>
                ))}
              </div>
              <button className="w-full text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 text-xs font-bold uppercase tracking-wider py-2" onClick={handleClose}>
                Batalkan
              </button>
            </>
          )}

          {step === 'loading' && (
            <div className="flex flex-col items-center py-6 gap-3">
              <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
              <p className="text-sm text-muted-foreground font-medium">
                Menyiapkan pembayaran via {selectedBank?.name}...
              </p>
            </div>
          )}

          {step === 'success' && (
            <div className="flex flex-col items-center py-4 gap-3">
              <div className="w-14 h-14 rounded-full bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center shadow-md animate-bounce">
                <CheckCircle2 className="w-9 h-9 text-emerald-500" />
              </div>
              <p className="text-base font-bold text-emerald-600 dark:text-emerald-400">Transfer Berhasil!</p>
              <p className="text-xs text-slate-400 dark:text-slate-500">Halaman akan segera dialihkan.</p>
            </div>
          )}

          {step === 'error' && (
            <div className="flex flex-col items-center py-4 gap-3 text-center">
              <div className="w-12 h-12 rounded-full bg-rose-50 dark:bg-rose-950/30 flex items-center justify-center">
                <XCircle className="w-8 h-8 text-rose-500" />
              </div>
              <p className="text-sm text-destructive font-medium">{errorMsg}</p>
              <div className="flex gap-2 w-full mt-2">
                <button onClick={() => setStep('select')} className="flex-1 clay-btn-secondary py-2.5 text-xs font-bold uppercase flex items-center justify-center gap-1.5">
                  <ChevronLeft className="w-3.5 h-3.5" /> Pilih Bank Lain
                </button>
                {selectedBank && (
                  <button onClick={() => handleBankSelect(selectedBank)} className="flex-1 clay-btn-primary py-2.5 text-xs font-bold uppercase flex items-center justify-center gap-1.5">
                    <RefreshCw className="w-3.5 h-3.5" /> Coba Lagi
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
