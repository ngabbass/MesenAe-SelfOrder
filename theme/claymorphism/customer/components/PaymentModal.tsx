import React from 'react';
import { createPortal } from 'react-dom';
import { X, QrCode, CreditCard, Smartphone, Copy, Check } from 'lucide-react';
import { RpIcon } from '@/components/ui/RpIcon';
import { FORMAT_IDR } from '@/lib/utils';
import { QrisCard } from '../../components/payment/QrisCard';
import { convertQRIS } from '@/lib/qris-dinamis';
import { toast } from 'sonner';
import { getPaymentLogoSrc } from '../pages/CheckoutView';
import { MidtransPaymentModal } from '../../components/MidtransPaymentModal';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedMethod: any;
  finalTotal: number;
  customerName: string | null;
  qrisImageUrl: string;
  setQrisImageUrl: (url: string) => void;
  processing: boolean;
  onConfirm: () => void; // Untuk konfirmasi bayar manual/transfer via WA
  onDownloadQR: () => void;
  
  // Midtrans props
  receiptNumber: string | null;
  onMidtransSuccess: () => void;
  onMidtransPending: () => void;
  onMidtransError: () => void;
}

// Sub-komponen untuk Container Logo Putih agar tetap sempurna di Dark Mode
const PaymentLogoBlock = React.memo(({ src, alt, IconComponent, small }: { src: string | null, alt: string, IconComponent: any, small?: boolean }) => {
  const sizeClass = small ? "w-6 h-6 rounded-md p-0.5" : "w-10 h-10 rounded-xl p-0.5";
  return (
    <div className={`${sizeClass} flex items-center justify-center shrink-0 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 shadow-sm overflow-hidden`}>
      {src ? (
        <img src={src} alt={alt} loading="lazy" className="w-full h-full object-contain" />
      ) : (
        <IconComponent size={small ? 14 : 20} className="text-blue-600 dark:text-amber-400" />
      )}
    </div>
  );
});
PaymentLogoBlock.displayName = 'PaymentLogoBlock';

export default function PaymentModal({
  isOpen,
  onClose,
  selectedMethod,
  finalTotal,
  customerName,
  qrisImageUrl,
  setQrisImageUrl,
  processing,
  onConfirm,
  onDownloadQR,
  
  receiptNumber,
  onMidtransSuccess,
  onMidtransPending,
  onMidtransError
}: PaymentModalProps) {
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (!isOpen) {
      setCopied(false);
    }
  }, [isOpen]);
  
  if (!isOpen || !selectedMethod) return null;

  // Render Midtrans Modal untuk metode online otomatis
  const isOnline = selectedMethod.provider !== 'manual';
  if (isOnline) {
    return (
      <MidtransPaymentModal
        isOpen={isOpen}
        paymentType={selectedMethod.category}
        amount={finalTotal}
        customerName={customerName || 'Customer Web'}
        orderId={receiptNumber || undefined}
        paymentMethod={selectedMethod}
        onSuccess={onMidtransSuccess}
        onPending={onMidtransPending}
        onError={onMidtransError}
        onClose={onClose}
      />
    );
  }

  // Helper untuk menentukan icon generic
  const getGenericIcon = (category: string) => {
    if (category === 'qris') return QrCode;
    if (category === 'transfer') return CreditCard;
    if (category === 'tunai') return RpIcon;
    return Smartphone;
  };

  // Render Modal untuk Pembayaran Manual (Transfer / Scan Manual)
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/60 dark:bg-black/60 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={!processing ? onClose : undefined}
      />
      
      {/* Container Dialog */}
      <div className="bg-transparent w-full max-w-md clay-card relative z-10 animate-in fade-in zoom-in-95 duration-300 flex flex-col max-h-[85vh] overflow-hidden">
        
        {/* Header Modal */}
        <div className="bg-transparent px-6 py-5 border-b border-slate-100/10 flex items-center justify-between sticky top-0 z-20 shrink-0">
          <div className="flex items-center gap-3">
            <PaymentLogoBlock 
              src={getPaymentLogoSrc(selectedMethod)} 
              alt={selectedMethod.name} 
              IconComponent={getGenericIcon(selectedMethod.category)}
            />
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white leading-tight">
                {selectedMethod.name}
              </h3>
              <p className="text-[11px] font-medium text-slate-500 mt-0.5">Selesaikan Pembayaran</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            disabled={processing}
            className="w-8 h-8 rounded-full clay-btn-secondary flex items-center justify-center text-slate-500 transition-colors shrink-0 disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-transparent">
          
          {/* Callout Total Harga */}
          <div className="bg-blue-50/50 dark:bg-blue-950/20 p-5 rounded-2xl border border-blue-100 dark:border-blue-900/40 text-center shadow-inner">
            <p className="text-[11px] font-extrabold text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-1.5">
              Total Tagihan
            </p>
            <p className="text-[32px] font-black text-slate-900 dark:text-white tracking-tight leading-none">
              {FORMAT_IDR(finalTotal)}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-2 flex items-center justify-center gap-1.5">
              Jumlah transfer harus sesuai hingga digit terakhir
            </p>
          </div>

          {/* Kondisi 1: QRIS Manual */}
          {selectedMethod.category === 'qris' && selectedMethod.qrisString && (() => {
            let dynamicQris = selectedMethod.qrisString;
            try {
              dynamicQris = convertQRIS(selectedMethod.qrisString, { amount: finalTotal });
            } catch (err) {
              console.error("Gagal membuat QRIS dinamis:", err);
            }
            
            return (
              <div className="flex flex-col items-center justify-center space-y-5">
                <div className="bg-white p-2.5 rounded-3xl shadow-inner border border-slate-200/50 w-full max-w-[280px]">
                  <QrisCard 
                    qrisString={dynamicQris} 
                    onCanvasRendered={setQrisImageUrl}
                    className="w-full h-auto rounded-2xl pointer-events-none"
                  />
                </div>

                <div className="text-center space-y-3">
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    Buka aplikasi Bank atau E-Wallet Anda,<br /> lalu scan QR Code di atas.
                  </p>
                  
                  <button 
                    onClick={onDownloadQR}
                    className="mx-auto px-5 py-2.5 clay-btn-secondary text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2"
                  >
                    <QrCode size={16} />
                    Simpan QRIS ke Galeri
                  </button>
                </div>
              </div>
            );
          })()}

          {/* Kondisi 2: Rekening Bank / E-Wallet Transfer Manual */}
          {selectedMethod.category !== 'qris' && (
            <div className="space-y-4">
              
              <div className="clay-card p-5 border-none shadow-inner space-y-4">
                
                {/* Bank / Wallet Name */}
                {selectedMethod.bankName && (
                  <div>
                    <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Tujuan Transfer</p>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{selectedMethod.bankName}</p>
                  </div>
                )}

                {/* Account Number */}
                {selectedMethod.accountNumber && (
                  <div>
                    <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                      {selectedMethod.category === 'e-wallet' ? 'Nomor E-Wallet / HP' : 'Nomor Rekening'}
                    </p>
                    <div className="flex items-center justify-between bg-white/50 dark:bg-slate-950/50 border border-slate-200/50 dark:border-slate-700/50 px-3.5 py-2.5 rounded-xl shadow-inner">
                      <p className="text-[17px] font-black text-slate-900 dark:text-white tracking-wide">
                        {selectedMethod.accountNumber}
                      </p>
                      <button 
                        onClick={() => {
                          navigator.clipboard.writeText(selectedMethod.accountNumber || '');
                          setCopied(true);
                          toast.success('Nomor berhasil disalin!');
                          setTimeout(() => setCopied(false), 2000);
                        }}
                        className={`p-2 rounded-lg transition-all shrink-0 ${
                          copied 
                            ? 'clay-btn-primary' 
                            : 'clay-btn-secondary'
                        }`}
                        title="Salin Nomor"
                      >
                        {copied ? <Check size={16} /> : <Copy size={16} />}
                      </button>
                    </div>
                  </div>
                )}

                {/* Account Name */}
                {selectedMethod.accountName && (
                  <div>
                    <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Atas Nama</p>
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{selectedMethod.accountName}</p>
                  </div>
                )}
              </div>

              {/* Instructions */}
              <div className="bg-blue-50/50 dark:bg-blue-900/10 p-4 rounded-xl border border-blue-100 dark:border-blue-900/30">
                <p className="text-xs font-bold text-blue-800 dark:text-blue-300 mb-2">Petunjuk Pembayaran:</p>
                <ol className="list-decimal pl-4 space-y-1.5 text-[11px] font-medium text-slate-600 dark:text-slate-400">
                  <li>Lakukan transfer persis sebesar <strong className="text-slate-900 dark:text-white">{FORMAT_IDR(finalTotal)}</strong>.</li>
                  <li>Simpan bukti transfer / struk pembayaran Anda.</li>
                  <li>Ketuk tombol WhatsApp di bawah untuk mengirimkan bukti transfer ke admin.</li>
                </ol>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions (WhatsApp Button) */}
        <div className="p-5 border-t border-slate-100/10 bg-transparent shrink-0">
          <button 
            onClick={onConfirm}
            disabled={processing}
            className="w-full shadow-[inset_0_-4px_6px_rgba(0,0,0,0.15),inset_0_4px_6px_rgba(255,255,255,0.25),0_10px_15px_-3px_rgba(37,211,102,0.3)] bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-2xl py-3.5 font-bold text-sm flex justify-center items-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {processing ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Memproses...</span>
              </div>
            ) : (
              <>
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12.012 2c-5.506 0-9.989 4.478-9.99 9.984a9.96 9.96 0 0 0 1.335 4.963L2 22l5.233-1.371a9.96 9.96 0 0 0 4.779 1.21h.005c5.505 0 9.989-4.478 9.99-9.984.001-2.67-1.037-5.18-2.92-7.062a9.923 9.923 0 0 0-7.075-2.923v.012zm5.719 14.158c-.313.882-1.572 1.623-2.155 1.706-.52.073-1.205.132-3.486-.816-2.915-1.212-4.792-4.18-4.937-4.375-.145-.195-1.182-1.576-1.182-3.003 0-1.427.747-2.128 1.012-2.408.265-.28.58-.35.772-.35.192 0 .385.002.553.01.176.009.414-.067.65.503.242.585.83 2.02.902 2.169.073.149.121.321.024.514-.097.194-.145.313-.29.479-.145.166-.303.372-.433.498-.145.14-.297.293-.127.585.17.292.756 1.246 1.626 2.021.87.775 1.602 1.016 1.83 1.127.228.11.362.093.497-.062.135-.156.578-.673.733-.902.156-.23.313-.193.53-.11.216.082 1.372.648 1.613.768.24.12.4.179.46.28.06.1.06.58-.253 1.462z"/>
                </svg>
                <span>Kirim Bukti ke WhatsApp</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>,
    document.body
  );
}
