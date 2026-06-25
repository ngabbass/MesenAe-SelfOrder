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
  const sizeClass = small ? "w-7 h-7 p-0.5" : "w-11 h-11 p-0.5";
  return (
    <div className={`${sizeClass} flex items-center justify-center shrink-0 bg-white dark:bg-slate-800 border-2 border-black dark:border-slate-700 shadow-[1.5px_1.5px_0px_0px_rgba(0,0,0,1)] dark:shadow-[1.5px_1.5px_0px_0px_#374151] overflow-hidden`}>
      {src ? (
        <img src={src} alt={alt} loading="lazy" className="w-full h-full object-contain" />
      ) : (
        <IconComponent size={small ? 14 : 20} className="text-black dark:text-amber-400" strokeWidth={2.5} />
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
        className="absolute inset-0 bg-black/65 backdrop-blur-none animate-in fade-in duration-300"
        onClick={!processing ? onClose : undefined}
      />
      
      {/* Container Dialog */}
      <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_#374151] relative z-10 animate-in fade-in zoom-in-95 duration-300 flex flex-col max-h-[85vh] overflow-hidden border-3 border-black dark:border-slate-700">
        
        {/* Header Modal */}
        <div className="bg-white dark:bg-slate-900 px-6 py-5 border-b-3 border-black dark:border-slate-700 flex items-center justify-between sticky top-0 z-20 shrink-0">
          <div className="flex items-center gap-3">
            <PaymentLogoBlock 
              src={getPaymentLogoSrc(selectedMethod)} 
              alt={selectedMethod.name} 
              IconComponent={getGenericIcon(selectedMethod.category)}
            />
            <div>
              <h3 className="font-black text-sm text-black dark:text-white uppercase tracking-wider">
                {selectedMethod.name}
              </h3>
              <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 mt-0.5 uppercase">SELESAIKAN PEMBAYARAN</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            disabled={processing}
            className="w-9 h-9 border-2 border-black dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-[#fffdf0] dark:hover:bg-slate-700 text-black dark:text-white hover:text-red-500 flex items-center justify-center shrink-0 rounded-xl shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_#374151] active:translate-x-[0.5px] active:translate-y-[0.5px] active:shadow-none transition-colors disabled:opacity-50"
          >
            <X size={18} strokeWidth={3} />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#fffdf2] dark:bg-slate-950">
          
          {/* Callout Total Harga */}
          <div className="bg-[#ffc700] p-5 border-3 border-black dark:border-slate-700 text-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_#374151] rounded-2xl text-black">
            <p className="text-[10px] font-black uppercase tracking-widest mb-1">
              TOTAL TAGIHAN
            </p>
            <p className="text-[30px] font-black tracking-tight leading-none text-black">
              {FORMAT_IDR(finalTotal)}
            </p>
            <p className="text-[9px] text-black/80 font-black uppercase mt-2.5 flex items-center justify-center gap-1.5">
              Bayar persis sesuai nominal di atas
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
                <div className="bg-white p-2.5 border-3 border-black dark:border-slate-700 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_#374151] w-full max-w-[280px] rounded-2xl">
                  <QrisCard 
                    qrisString={dynamicQris} 
                    onCanvasRendered={setQrisImageUrl}
                    className="w-full h-auto rounded-none pointer-events-none"
                  />
                </div>

                <div className="text-center space-y-3 w-full">
                  <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase leading-relaxed">
                    Buka aplikasi Bank or E-Wallet Anda,<br /> lalu scan QR Code di atas.
                  </p>
                  
                  <button 
                    onClick={onDownloadQR}
                    className="mx-auto px-5 py-2.5 border-2 border-black dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-[#fffdf0] dark:hover:bg-slate-700 text-black dark:text-white text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-2 active:translate-x-[0.5px] active:translate-y-[0.5px] active:shadow-none transition-all shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_#374151] rounded-xl"
                  >
                    <QrCode size={16} strokeWidth={2.5} />
                    Simpan QRIS ke Galeri
                  </button>
                </div>
              </div>
            );
          })()}

          {/* Kondisi 2: Rekening Bank / E-Wallet Transfer Manual */}
          {selectedMethod.category !== 'qris' && (
            <div className="space-y-5">
              
              <div className="bg-white dark:bg-slate-900 p-5 border-3 border-black dark:border-slate-700 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_#374151] space-y-4 rounded-2xl">
                
                {/* Bank / Wallet Name */}
                {selectedMethod.bankName && (
                  <div>
                    <p className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Tujuan Transfer</p>
                    <p className="text-sm font-black text-black dark:text-white uppercase tracking-wider">{selectedMethod.bankName}</p>
                  </div>
                )}

                {/* Account Number */}
                {selectedMethod.accountNumber && (
                  <div>
                    <p className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                      {selectedMethod.category === 'e-wallet' ? 'Nomor E-Wallet / HP' : 'Nomor Rekening'}
                    </p>
                    <div className="flex items-center justify-between bg-[#fffdf0] dark:bg-slate-950 border-2 border-black dark:border-slate-700 px-3.5 py-2 rounded-xl shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_#374151]">
                      <p className="text-[18px] font-black text-black dark:text-white tracking-wide leading-none">
                        {selectedMethod.accountNumber}
                      </p>
                      <button 
                        onClick={() => {
                          navigator.clipboard.writeText(selectedMethod.accountNumber || '');
                          setCopied(true);
                          toast.success('Nomor berhasil disalin!');
                          setTimeout(() => setCopied(false), 2000);
                        }}
                        className={`p-2 border-2 border-black dark:border-slate-700 active:scale-95 transition-all shrink-0 rounded-lg shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_#374151] active:translate-x-[0.5px] active:translate-y-[0.5px] active:shadow-none ${
                          copied 
                            ? 'text-white bg-emerald-600 hover:bg-emerald-700' 
                            : 'text-black bg-[#ff90e8] hover:bg-[#ffb3ee]'
                        }`}
                        title="Salin Nomor"
                      >
                        {copied ? <Check size={16} strokeWidth={3} /> : <Copy size={16} strokeWidth={2.5} />}
                      </button>
                    </div>
                  </div>
                )}

                {/* Account Name */}
                {selectedMethod.accountName && (
                  <div>
                    <p className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Atas Nama</p>
                    <p className="text-xs font-black text-black dark:text-white uppercase">{selectedMethod.accountName}</p>
                  </div>
                )}
              </div>

              {/* Instructions */}
              <div className="bg-[#a3e635] p-5 border-3 border-black dark:border-slate-700 text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_#374151] rounded-2xl">
                <p className="text-[10px] font-black uppercase mb-2">Petunjuk Pembayaran:</p>
                <ol className="list-decimal pl-4 space-y-1.5 text-[9px] font-bold uppercase leading-relaxed text-black">
                  <li>Lakukan transfer persis sebesar <strong className="font-black bg-white px-1 border border-black">{FORMAT_IDR(finalTotal)}</strong>.</li>
                  <li>Simpan bukti transfer / struk pembayaran Anda.</li>
                  <li>Ketuk tombol WhatsApp di bawah untuk mengirimkan bukti transfer ke admin.</li>
                </ol>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions (WhatsApp Button) */}
        <div className="p-5 border-t-3 border-black dark:border-slate-700 bg-[#fffdf2] dark:bg-slate-900 shrink-0">
          <button 
            onClick={onConfirm}
            disabled={processing}
            className="w-full bg-[#25D366] hover:bg-[#20bd5a] disabled:bg-slate-300 dark:disabled:bg-slate-800 text-black border-3 border-black dark:border-slate-700 py-4 font-black uppercase tracking-wider text-xs flex justify-center items-center gap-2.5 active:translate-x-[1.5px] active:translate-y-[1.5px] active:shadow-none transition-all shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] dark:shadow-[5px_5px_0px_0px_#374151] rounded-2xl"
          >
            {processing ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-black border-t-white rounded-full animate-spin" />
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
