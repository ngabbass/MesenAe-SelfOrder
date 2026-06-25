/**
 * QrisPaymentModal — Buka Snap Midtrans dengan fokus QRIS
 *
 * Solusi untuk "no payment channel":
 *   - Buka Snap FULL (tanpa enabled_payments filter)
 *   - Ketika Snap terbuka, tutup Dialog kita agar tidak memblokir klik ke Snap
 *   - Snap menampilkan semua metode termasuk QRIS yang sudah terbukti aktif
 *
 * Cara kerja anti-blokir:
 *   - Saat snapActive=true, Dialog kita ditutup (open={false})
 *   - Snap popup bebas muncul dan bisa diklik oleh user
 *   - Setelah Snap selesai, baru kita tampilkan hasil sukses/error
 */
import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';
import { MidtransService } from '@/services/midtransService';
import { PaymentMethod } from '@/hooks/db-hooks';
import { QrisCard } from '@/components/payment/QrisCard';
import { convertQRIS } from '@/lib/qris-dinamis';

interface QrisPaymentModalProps {
  isOpen: boolean;
  amount: number;
  customerName?: string;
  orderId?: string;
  paymentMethod?: PaymentMethod | null;
  onSuccess: () => void;
  onClose: () => void;
}

type Status = 'loading' | 'snap_open' | 'success' | 'error';

export function QrisPaymentModal({
  isOpen,
  amount,
  customerName,
  orderId,
  paymentMethod,
  onSuccess,
  onClose,
}: QrisPaymentModalProps) {
  const [status, setStatus] = useState<Status>('loading');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // snapActive: saat true, Dialog kita ditutup agar tidak memblokir Snap
  const [snapActive, setSnapActive] = useState(false);
  // Refs untuk callbacks agar tidak stale saat dipakai Snap
  const onSuccessRef = useRef(onSuccess);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onSuccessRef.current = onSuccess; }, [onSuccess]);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  const [qrisData, setQrisData] = useState<string | null>(null);

  const openSnap = useCallback(async () => {
    setStatus('loading');
    setErrorMsg(null);
    setSnapActive(false);

    const isManual = paymentMethod?.provider === 'manual' && paymentMethod?.qrisString;
    if (isManual) {
      try {
        const dynamicQRIS = convertQRIS(paymentMethod.qrisString!, { amount });
        setQrisData(dynamicQRIS);
        setStatus('success'); // Show manual QR code
      } catch (err: any) {
        setStatus('error');
        setErrorMsg('Gagal membuat QRIS dinamis: ' + err.message);
      }
      return;
    }

    // Midtrans: Proteksi double tap / double snap di mobile
    if ((window as any).midtransSnapActive) {
      console.warn('Midtrans Snap is already active. Ignoring request.');
      onCloseRef.current();
      return;
    }
    (window as any).midtransSnapActive = true;

    try {
      await MidtransService.loadSnapScript();

      const token = await MidtransService.createTransactionToken({
        transaction_details: {
          order_id: orderId || `MA-QRIS-${Date.now()}`,
          gross_amount: Math.round(amount),
        },
        item_details: [
          { name: 'Total Belanja MesenAe', price: Math.round(amount), quantity: 1 },
        ],
        customer_details: {
          first_name: customerName || 'Pelanggan MesenAe',
        },
        enabled_payments: ['other_qris'],
      });

      // Tutup Dialog kita terlebih dahulu agar tidak memblokir klik ke Snap
      setSnapActive(true);
      setStatus('snap_open');

      // @ts-expect-error - window.snap injected globally
      window.snap.pay(token, {
        onSuccess: () => {
          setSnapActive(false);
          (window as any).midtransSnapActive = false;
          setStatus('success');
          setTimeout(() => onSuccessRef.current(), 1200);
        },
        onPending: () => {
          setSnapActive(false);
          (window as any).midtransSnapActive = false;
          // Pending = mungkin sudah bayar tapi belum konfirmasi, tutup saja
          onCloseRef.current();
        },
        onError: (result: any) => {
          console.error('[QRIS Snap Error]', result);
          setSnapActive(false);
          setStatus('error');
          setErrorMsg('Pembayaran gagal. Silakan coba lagi.');
        },
        onClose: () => {
          setSnapActive(false);
          (window as any).midtransSnapActive = false;
          // User menutup Snap popup → kembali ke status awal
          onCloseRef.current();
        },
      });
    } catch (err: any) {
      console.error('[QRIS] Error:', err);
      setSnapActive(false);
      (window as any).midtransSnapActive = false;
      setStatus('error');
      setErrorMsg(err.message || 'Gagal memproses pembayaran. Coba lagi.');
    }
  }, [amount, customerName, orderId, paymentMethod]);

  useEffect(() => {
    if (isOpen) {
      openSnap();
    }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleClose = () => {
    if (status === 'loading' || snapActive) return;
    setStatus('loading');
    onClose();
  };

  const isManual = paymentMethod?.provider === 'manual' && paymentMethod?.qrisString;

  // Saat Snap aktif: Dialog kita DITUTUP agar tidak memblokir Snap
  // Saat status lain: Dialog kita tampil normal
  const dialogOpen = isOpen && !snapActive;

  return (
    <Dialog open={dialogOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-[92vw] sm:max-w-[400px] p-0 overflow-hidden clay-card [&>button]:text-white [&>button]:hover:text-white/80 [&>button]:top-3 [&>button]:right-3 [&>button]:z-[110]">
        {/* ── Header Compact ── */}
        <div className="bg-gradient-to-br from-blue-600 to-blue-500 p-4 text-white relative overflow-hidden">
          <div className="absolute -right-8 -top-8 w-24 h-24 bg-white/10 rounded-full blur-2xl pointer-events-none" />

          <DialogHeader className="relative z-10">
            <DialogTitle className="text-white text-base font-bold flex items-center gap-2">
              <img src="/ico/qris.svg" alt="QRIS" className="w-auto h-5 object-contain rounded bg-white px-1" />
              Pembayaran QRIS
            </DialogTitle>
            <DialogDescription className="text-white/80 text-xs mt-0.5">
              Scan dengan e-wallet dan mobile banking apapun
            </DialogDescription>
          </DialogHeader>
          <div className="mt-3 bg-white/15 backdrop-blur-md rounded-2xl p-3 text-center border border-white/10">
            <p className="text-[11px] text-white/70 font-semibold uppercase tracking-wider">Total Tagihan</p>
            <p className="text-2xl font-black text-white mt-0.5 tracking-tight">Rp {amount.toLocaleString('id-ID')}</p>
            <p className="text-xs text-white/70 mt-1">{customerName || 'Pelanggan MesenAe'}</p>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="p-4 flex flex-col items-center gap-4">
          {/* Loading: membuat token */}
          {status === 'loading' && (
            <div className="flex flex-col items-center py-6 gap-3">
              <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
              <p className="text-sm text-muted-foreground font-medium">Membuka halaman QRIS…</p>
            </div>
          )}

          {/* Sukses (Midtrans atau Manual) */}
          {status === 'success' && (
            <div className="flex flex-col items-center py-2 gap-3 w-full">
              {isManual && qrisData ? (
                <div className="flex flex-col items-center gap-3 w-full animate-in fade-in zoom-in duration-300">
                  <QrisCard
                    qrisString={qrisData}
                    className="w-[240px] h-[348px] rounded-[20px] shadow-sm pointer-events-none"
                  />
                  <p className="text-xs text-muted-foreground text-center">
                    Scan QRIS ini dan pastikan nominal tagihan sesuai.
                  </p>
                  <button className="w-full clay-btn-primary py-3.5 text-xs font-black uppercase mt-1" onClick={() => onSuccessRef.current()}>
                    Konfirmasi Pembayaran
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center py-2 gap-3">
                  <div className="w-14 h-14 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <CheckCircle2 className="w-9 h-9 text-green-500" />
                  </div>
                  <p className="text-base font-bold text-green-600 dark:text-green-400">Pembayaran Berhasil!</p>
                  <p className="text-xs text-muted-foreground">Transaksi sedang disimpan…</p>
                </div>
              )}
            </div>
          )}

          {/* Error */}
          {status === 'error' && (
            <div className="flex flex-col items-center py-4 gap-3 w-full">
              <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
                <XCircle className="w-8 h-8 text-destructive" />
              </div>
              <p className="text-sm text-destructive font-medium text-center leading-relaxed">{errorMsg}</p>
              <div className="flex gap-2 w-full">
                <button onClick={openSnap} className="flex-1 clay-btn-primary py-2.5 text-xs font-bold uppercase flex items-center justify-center gap-1.5">
                  <RefreshCw className="w-4 h-4" /> Coba Lagi
                </button>
                <button onClick={handleClose} className="flex-1 clay-btn-secondary py-2.5 text-xs font-bold uppercase flex items-center justify-center">
                  Tutup
                </button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
