import { useRef, useState, useEffect } from 'react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import html2canvas from 'html2canvas';
import { Download, Share2, Loader2, CheckCircle2, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import type { Transaction, StoreSettings, TransactionItemRecord } from '@/hooks/db-hooks';
import { cn, formatReceiptTable } from '@/lib/utils';
import { QRCodeCanvas } from 'qrcode.react';

// Helper: resolve fontSize from either numeric or legacy string enum
function resolveFontSize(val: any): string {
  if (typeof val === 'number') return `${val}px`;
  const map: Record<string, string> = { xs: '9px', sm: '11px', md: '13px', lg: '15px', xl: '17px' };
  return map[val] || '11px';
}

// Helper to remove white background pixels smoothly from images
async function removeWhiteBackground(imageUrl: string): Promise<string> {
  if (!imageUrl) return '';
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      let canvas: HTMLCanvasElement | null = document.createElement('canvas');
      try {
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          canvas.width = 0;
          canvas.height = 0;
          canvas = null;
          resolve(imageUrl);
          return;
        }
        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;
        
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          
          // Calculate average pixel brightness for grayscale
          const avg = (r + g + b) / 3;
          
          // Convert to grayscale
          data[i] = avg;
          data[i + 1] = avg;
          data[i + 2] = avg;
          
          // If the pixel is close to white (brightness > 210)
          if (avg > 210) {
            // Apply smooth alpha gradient for anti-aliasing
            const alpha = Math.max(0, 255 - (avg - 210) * (255 / 45));
            data[i + 3] = Math.min(data[i + 3], alpha);
          }
        }
        ctx.putImageData(imgData, 0, 0);
        const dataUrl = canvas.toDataURL('image/png');
        
        canvas.width = 0;
        canvas.height = 0;
        canvas = null;
        
        resolve(dataUrl);
      } catch (err) {
        console.error('Error removing white background:', err);
        if (canvas) {
          canvas.width = 0;
          canvas.height = 0;
          canvas = null;
        }
        resolve(imageUrl);
      }
    };
    img.onerror = () => {
      resolve(imageUrl);
    };
    img.src = imageUrl;
  });
}

interface ReceiptProps {
  open: boolean;
  onClose: () => void;
  transaction: Transaction;
  items: TransactionItemRecord[];
  storeSettings: StoreSettings | undefined;
  paymentMethodName: string;
}

export default function Receipt({ open, onClose, transaction, items, storeSettings, paymentMethodName }: ReceiptProps) {
  const receiptRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState<boolean>(false);
  const [sharing, setSharing] = useState<boolean>(false);
  const [processedLogo, setProcessedLogo] = useState<string | undefined>();
  const [processedFooterImg, setProcessedFooterImg] = useState<string | undefined>();

  useState(() => {
    // Empty trigger
  });

  const footerImgUrl = (storeSettings as any)?.receiptFooterImg || (storeSettings as any)?.receiptFooterImage;

  useState(() => {
    // Empty trigger
  });

  // Parse dynamic receipt configuration settings
  const typo = (storeSettings as any)?.receiptTypography || {};
  const fontFamilyVal = typo.fontFamily || 'courier';
  const fontSizeVal = typo.fontSize ?? 'sm';
  const lineHeightVal = typo.lineHeight || 'normal';
  const paperWidthVal = typo.paperWidth || '58mm';
  const rawTemplate = (storeSettings as any)?.receiptTemplate ?? 'fnb';
  const template = rawTemplate === 'finedining' ? 'classic' : rawTemplate;
  const showLogo = (storeSettings as any)?.receiptShowLogo ?? true;
  const showFooterImg = (storeSettings as any)?.receiptShowFooterImg ?? true;
  const footerType = (storeSettings as any)?.receiptFooterType || 'image';
  const footerQrUrl = (storeSettings as any)?.receiptFooterQrUrl || '';

  useEffect(() => {
    let isMounted = true;
    if (open && storeSettings?.logo) {
      removeWhiteBackground(storeSettings.logo).then(res => {
        if (isMounted) setProcessedLogo(res);
      });
    } else {
      setProcessedLogo(undefined);
    }
    return () => { isMounted = false; };
  }, [open, storeSettings?.logo]);

  useEffect(() => {
    let isMounted = true;
    if (open && footerImgUrl) {
      removeWhiteBackground(footerImgUrl).then(res => {
        if (isMounted) setProcessedFooterImg(res);
      });
    } else {
      setProcessedFooterImg(undefined);
    }
    return () => { isMounted = false; };
  }, [open, footerImgUrl]);

  // Custom Styles
  const footerStyles = (storeSettings as any)?.receiptFooterStyles || {};
  const line1Bold = footerStyles.line1?.bold ?? false;
  const line1Italic = footerStyles.line1?.italic ?? false;
  const line1Underline = footerStyles.line1?.underline ?? false;
  const line2Bold = footerStyles.line2?.bold ?? false;
  const line2Italic = footerStyles.line2?.italic ?? false;
  const line2Underline = footerStyles.line2?.underline ?? false;

  const getFooterStyle = (block: string) => {
    const isLine1 = block === 'line1';
    const bold = isLine1 ? line1Bold : line2Bold;
    const italic = isLine1 ? line1Italic : line2Italic;
    const underline = isLine1 ? line1Underline : line2Underline;
    return {
      fontWeight: bold ? 'bold' : 'normal',
      fontStyle: italic ? 'italic' : 'normal',
      textDecoration: underline ? 'underline' : 'none'
    };
  };

  if (!transaction) return null;
  const safeItems = Array.isArray(items) ? items : [];
  const tableVal = transaction.tableNumber || (transaction as any).table_number;
  const isTakeAway = tableVal && (
    String(tableVal).toLowerCase() === 'bawa pulang' ||
    String(tableVal).toLowerCase() === 'take away' ||
    String(tableVal).toLowerCase() === 'ambil sendiri'
  );

  const isPaidTx = transaction.status === 'lunas' || transaction.status === 'completed';

  // Normalisasi data untuk menghindari error camelCase vs snake_case
  const txDiscountAmount = transaction.discountAmount ?? (transaction as any).discount_amount ?? 0;
  const txPaymentAmount = transaction.paymentAmount ?? (transaction as any).payment_amount ?? 0;
  const rp = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;

  const captureReceipt = async (): Promise<HTMLCanvasElement | null> => {
    if (!receiptRef.current) return null;
    try {
      const canvas = await html2canvas(receiptRef.current, {
        backgroundColor: null,
        scale: 3,
        useCORS: true,
        logging: false,
      });
      return canvas;
    } catch {
      toast.error('Gagal membuat gambar struk');
      return null;
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    const canvas = await captureReceipt();
    if (!canvas) {
      setDownloading(false);
      return;
    }
    const link = document.createElement('a');
    link.download = `Struk_${transaction.receiptNumber}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    toast.success('Struk berhasil diunduh');
    setDownloading(false);
  };

  const handleShare = async () => {
    setSharing(true);
    const canvas = await captureReceipt();
    if (!canvas) {
      setSharing(false);
      return;
    }

    try {
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
      if (!blob) {
        setSharing(false);
        return;
      }

      const file = new File([blob], `Struk_${transaction.receiptNumber}.png`, { type: 'image/png' });
      
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
        });
      } else {
        toast.info('Fitur bagikan gambar langsung tidak didukung di browser ini. Silakan unduh gambar.');
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== 'AbortError') {
        toast.error('Gagal membagikan struk');
      }
    } finally {
      setSharing(false);
    }
  };

  // Footer order & data
  const footerOrder: string[] = (storeSettings as any)?.receiptFooterOrder || ['line1', 'line2', 'image'];
  const footerLinesData: string[] = (storeSettings as any)?.receiptFooterLines || [];
  const footerImgData = (storeSettings as any)?.receiptFooterImg || (storeSettings as any)?.receiptFooterImage;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md md:max-w-xl w-[95vw] max-h-[90vh] overflow-y-auto rounded-3xl p-6 bg-background border border-border shadow-2xl flex flex-col">
        <DialogHeader className="mb-4">
          <DialogTitle className="text-center text-foreground flex items-center justify-center gap-2">
            {isPaidTx ? (
              <>
                <CheckCircle2 className="text-emerald-500 w-6 h-6" />
                Pembayaran Berhasil
              </>
            ) : (
              <>
                <Clock className="text-amber-500 w-6 h-6 animate-pulse" />
                Detail Tagihan
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* Kertas Struk */}
        <div 
          className={cn(
            "relative mx-auto bg-white text-black p-6 shadow-lg mb-6 overflow-hidden flex-shrink-0 transition-all duration-300",
            paperWidthVal === '58mm' ? "w-full max-w-[280px]" : "w-full max-w-[360px]"
          )}
          style={{ 
            fontFamily: fontFamilyVal === 'monospace' ? 'monospace' : fontFamilyVal === 'sans-serif' ? 'sans-serif' : fontFamilyVal === 'receipt-font' ? 'monospace' : "'Courier New', Courier, monospace",
            fontSize: resolveFontSize(fontSizeVal),
            lineHeight: lineHeightVal === 'tight' ? '1.15' : lineHeightVal === 'relaxed' ? '1.5' : '1.3',
            letterSpacing: fontFamilyVal === 'receipt-font' ? '-0.05em' : 'normal',
            clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 6px), 98% 100%, 96% calc(100% - 6px), 94% 100%, 92% calc(100% - 6px), 90% 100%, 88% calc(100% - 6px), 86% 100%, 84% calc(100% - 6px), 82% 100%, 80% calc(100% - 6px), 78% 100%, 76% calc(100% - 6px), 74% 100%, 72% calc(100% - 6px), 70% 100%, 68% calc(100% - 6px), 66% 100%, 64% calc(100% - 6px), 62% 100%, 60% calc(100% - 6px), 58% 100%, 56% calc(100% - 6px), 54% 100%, 52% calc(100% - 6px), 50% 100%, 48% calc(100% - 6px), 46% 100%, 44% calc(100% - 6px), 42% 100%, 40% calc(100% - 6px), 38% 100%, 36% calc(100% - 6px), 34% 100%, 32% calc(100% - 6px), 30% 100%, 28% calc(100% - 6px), 26% 100%, 24% calc(100% - 6px), 22% 100%, 20% calc(100% - 6px), 18% 100%, 16% calc(100% - 6px), 14% 100%, 12% calc(100% - 6px), 10% 100%, 8% calc(100% - 6px), 6% 100%, 4% calc(100% - 6px), 2% 100%, 0 calc(100% - 6px))'
          }}
        >
          
          <div ref={receiptRef} className="relative z-10 bg-white text-black">

            {/* ── MINIMARKET TEMPLATE ── */}
            {template === 'minimarket' && (
              <div className="w-full text-left uppercase text-[0.85em] relative z-10">
                {showLogo && storeSettings?.logo && (
                  <div className="mb-3 text-center">
                    <img crossOrigin="anonymous" src={processedLogo || storeSettings.logo} alt="Logo" className="w-28 h-8 object-contain mx-auto mb-2 grayscale" style={{ filter: 'grayscale(1) contrast(1.2) brightness(1.1)' }} />
                  </div>
                )}
                <div className="mb-2">
                  <h2 className="font-extrabold text-[1.1em]">{storeSettings?.storeName?.toUpperCase() || 'TOKO'}</h2>
                  {storeSettings?.address && <p className="text-[0.9em] leading-tight">{storeSettings.address.toUpperCase()}</p>}
                  {storeSettings?.phone && <p className="text-[0.9em] leading-tight">{storeSettings.phone}</p>}
                </div>
                <div className="mb-2 text-[0.95em] uppercase font-medium space-y-0.5">
                  <div>No. Struk: {transaction.receiptNumber}</div>
                  <div className="flex justify-between w-full">
                    <span>TGL: {format(new Date(transaction.date), 'dd.MM.yy-HH:mm')}</span>
                    <span>KASIR: {String(transaction.cashierName || (transaction as any).cashier_name || 'Staff').toUpperCase()}</span>
                  </div>
                  {(transaction.customerName || tableVal) && (
                    <div className="flex justify-between w-full gap-2 items-start">
                      <span className="flex-1 text-left min-w-0 break-words">PELANGGAN: {transaction.customerName ? String(transaction.customerName).toUpperCase() : '-'}</span>
                      <span className="shrink-0 text-right max-w-[60%] break-words">MEJA/TIPE: {tableVal ? formatReceiptTable(tableVal).toUpperCase() : '-'}</span>
                    </div>
                  )}
                </div>
                <div className="border-t border-dashed border-black my-2" />
                
                {/* Items */}
                <div className="space-y-1">
                  {safeItems.map((item: any, i: number) => {
                    const pName = item.productName || item.product_name || 'Produk';
                    return (
                      <div key={i} className="flex leading-tight font-medium py-0.5">
                        <span className="flex-1 pr-1 break-words whitespace-normal text-left">{pName.toUpperCase()}</span>
                        <span className="w-4 text-center shrink-0">{item.quantity}</span>
                        <span className="w-14 text-right shrink-0">{rp(item.price)}</span>
                        <span className="w-14 text-right shrink-0">{rp(item.subtotal)}</span>
                      </div>
                    );
                  })}
                </div>
                
                <div className="border-t border-dashed border-black my-2" />
                <div className="space-y-0.5 text-[0.95em] font-medium">
                  <div className="flex justify-end gap-4">
                    <span>HARGA JUAL :</span><span className="w-20 text-right">{rp(transaction.subtotal)}</span>
                  </div>
                  {txDiscountAmount > 0 && (
                    <div className="flex justify-end gap-4">
                      <span>DISKON :</span><span className="w-20 text-right">-{rp(txDiscountAmount)}</span>
                    </div>
                  )}
                  {((transaction.tax_and_service || transaction.taxAndService) > 0) && (
                    <div className="flex justify-end gap-4">
                      <span>BIAYA ADMIN :</span><span className="w-20 text-right">{rp(transaction.tax_and_service || transaction.taxAndService)}</span>
                    </div>
                  )}
                  <div className="border-t border-dashed border-black my-1" />
                  <div className="flex justify-end gap-4 font-extrabold text-[1.05em]">
                    <span>TOTAL :</span><span className="w-20 text-right">{rp(transaction.total)}</span>
                  </div>
                  <div className="flex justify-end gap-4">
                    <span>TUNAI/QRIS :</span><span className="w-20 text-right">{rp(txPaymentAmount || transaction.total)}</span>
                  </div>
                  <div className="flex justify-end gap-4">
                    <span>KEMBALI :</span><span className="w-20 text-right">{rp(transaction.change)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* ── FNB (Kafe/Resto) TEMPLATE ── */}
            {template === 'fnb' && (
              <div className="w-full text-left text-[0.85em] relative z-10">
                <div className="text-center mb-4">
                  {showLogo && storeSettings?.logo && (
                    <div className="w-14 h-14 mx-auto mb-2 overflow-hidden bg-transparent">
                      <img crossOrigin="anonymous" src={processedLogo || storeSettings.logo} alt="Logo" className="w-full h-full object-contain mx-auto grayscale" />
                    </div>
                  )}
                  <h2 className="font-bold text-[1.25em]">{storeSettings?.storeName?.toUpperCase() || 'TOKO'}</h2>
                  {storeSettings?.address && <p className="opacity-90">{storeSettings.address}</p>}
                  {storeSettings?.phone && <p className="opacity-90 leading-tight">{storeSettings.phone}</p>}
                </div>
                <div className="mb-2 font-medium">
                  <div className="grid grid-cols-[65px_auto] gap-x-1">
                    <span>No Struk</span><span>: {transaction.receiptNumber}</span>
                    <span>Tanggal</span><span>: {format(new Date(transaction.date), 'dd MMM yyyy, HH:mm', { locale: id })}</span>
                    <span>Kasir</span><span>: {transaction.cashierName || (transaction as any).cashier_name || 'Staff'}</span>
                    {transaction.customerName && (
                      <><span>Nama</span><span>: {transaction.customerName}</span></>
                    )}
                    {tableVal && (
                      <>
                        <span>Meja/Tipe</span>
                        <span>: {formatReceiptTable(tableVal)}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="border-t border-dashed border-black my-2" />
                
                {/* Items */}
                <div className="space-y-2">
                  {safeItems.map((item: any, i: number) => {
                    const pName = item.productName || item.product_name || 'Produk';
                    let variants = item.selectedVariants || item.selected_variants || [];
                    if (typeof variants === 'string') {
                      try { variants = JSON.parse(variants); } catch (e) { variants = []; }
                    }
                    return (
                      <div key={i} className="leading-tight font-medium">
                        <div className="font-bold break-words whitespace-normal text-left">{pName}</div>
                        <div className="flex justify-between text-[0.95em] mt-0.5">
                          <span>{item.quantity} x {rp(item.price)}</span>
                          <span>{rp(item.subtotal)}</span>
                        </div>
                        {Array.isArray(variants) && variants.length > 0 && (
                          <div className="opacity-80 text-[0.9em] pl-1">+ {variants.map((v: any) => v.optionName || v.option_name).join(', ')}</div>
                        )}
                        {item.notes && <div className="opacity-80 text-[0.9em] pl-1">Catatan: {item.notes}</div>}
                      </div>
                    );
                  })}
                </div>
                
                <div className="border-t border-dashed border-black my-2" />
                <div className="grid grid-cols-[80px_auto] gap-x-1 ml-auto max-w-[200px] font-medium text-[0.95em]">
                  <span>Subtotal</span><span>: {rp(transaction.subtotal)}</span>
                  {txDiscountAmount > 0 && (
                    <><span>Diskon</span><span>: -{rp(txDiscountAmount)}</span></>
                  )}
                  {((transaction.tax_and_service || transaction.taxAndService) > 0) && (
                    <><span>Biaya Admin</span><span>: {rp(transaction.tax_and_service || transaction.taxAndService)}</span></>
                  )}
                  <span className="font-extrabold text-[1.1em]">Total</span><span className="font-extrabold text-[1.1em]">: {rp(transaction.total)}</span>
                  <span>Bayar</span><span>: {paymentMethodName}</span>
                  <span>Kembali</span><span>: {rp(transaction.change)}</span>
                </div>
              </div>
            )}

            {/* ── CLASSIC TEMPLATE ── */}
            {template === 'classic' && (
              <div className="w-full text-[0.85em] relative z-10">
                <div className="text-center mb-3">
                  {showLogo && storeSettings?.logo && (
                    <div className="w-16 h-16 mx-auto mb-2 overflow-hidden bg-transparent">
                      <img crossOrigin="anonymous" src={processedLogo || storeSettings.logo} alt="Logo" className="w-full h-full object-contain mx-auto grayscale" />
                    </div>
                  )}
                  <h2 className="font-extrabold text-[1.25em] tracking-wide">{storeSettings?.storeName || 'TOKO'}</h2>
                  {storeSettings?.address && <p className="text-[0.9em] mt-1 leading-tight">{storeSettings.address}</p>}
                  {storeSettings?.phone && <p className="text-[0.9em] leading-tight">{storeSettings.phone}</p>}
                </div>
                <div className="border-t border-dashed border-black/60 my-2" />
                <div className="space-y-0.5 font-medium">
                  <div className="flex justify-between"><span>No. Struk: {transaction.receiptNumber}</span><span>{paymentMethodName}</span></div>
                  <div className="flex justify-between">
                    <span>{format(new Date(transaction.date), 'dd/MM/yyyy')}</span>
                    <span>{format(new Date(transaction.date), 'HH:mm')}</span>
                  </div>
                </div>
                <div className="border-t border-dashed border-black/40 my-2" />
                <div className="space-y-0.5 text-left font-medium">
                  <div className="flex justify-between"><span className="text-gray-500">Kasir:</span><span className="font-semibold">{transaction.cashierName || (transaction as any).cashier_name || 'Staff'}</span></div>
                  {transaction.customerName && (
                    <div className="flex justify-between"><span className="text-gray-500">Pelanggan:</span><span className="font-semibold">{transaction.customerName}</span></div>
                  )}
                  {tableVal && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Meja / Tipe:</span>
                      <span className="font-bold">{formatReceiptTable(tableVal)}</span>
                    </div>
                  )}
                </div>
                <div className="border-t border-dashed border-black/60 my-2" />
                
                {/* Items */}
                <div className="space-y-1.5 font-medium">
                  {safeItems.map((item: any, i: number) => {
                    const pName = item.productName || item.product_name || 'Produk';
                    let variants = item.selectedVariants || item.selected_variants || [];
                    if (typeof variants === 'string') {
                      try { variants = JSON.parse(variants); } catch (e) { variants = []; }
                    }
                    return (
                      <div key={i}>
                        <div className="flex justify-between font-semibold">
                          <span className="break-words whitespace-normal text-left">{pName}</span>
                          <span>{rp(item.subtotal)}</span>
                        </div>
                        <div className="text-[0.9em] text-gray-500 pl-2 text-left">
                          {item.quantity} x {rp(item.price)}
                          {Array.isArray(variants) && variants.length > 0 && ` (+ ${variants.map((v: any) => v.optionName || v.option_name).join(', ')})`}
                          {item.notes && ` (Catatan: ${item.notes})`}
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                <div className="border-t border-dashed border-black/60 my-2" />
                <div className="space-y-1 font-medium">
                  <div className="flex justify-between"><span className="text-gray-600">Subtotal</span><span>{rp(transaction.subtotal)}</span></div>
                  {txDiscountAmount > 0 && (
                    <div className="flex justify-between"><span className="text-gray-600">Diskon</span><span>-{rp(txDiscountAmount)}</span></div>
                  )}
                  {((transaction.tax_and_service || transaction.taxAndService) > 0) && (
                    <div className="flex justify-between"><span className="text-gray-600">Biaya Admin</span><span>{rp(transaction.tax_and_service || transaction.taxAndService)}</span></div>
                  )}
                  <div className="flex justify-between font-black text-[1.1em] border-t border-gray-300 pt-1.5 mt-1.5"><span>Total</span><span>{rp(transaction.total)}</span></div>
                  <div className="flex justify-between mt-1"><span className="text-gray-600">Bayar</span><span>{rp(txPaymentAmount || transaction.total)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-600">Kembali</span><span>{rp(transaction.change)}</span></div>
                </div>
              </div>
            )}

            {/* ── MINIMALIS TEMPLATE ── */}
            {template === 'minimalis' && (
              <div className="w-full text-center text-[0.85em] relative z-10">
                <div className="mb-4">
                  {showLogo && storeSettings?.logo && (
                    <div className="w-10 h-10 mx-auto mb-2 overflow-hidden bg-transparent">
                      <img crossOrigin="anonymous" src={processedLogo || storeSettings.logo} alt="Logo" className="w-full h-full object-contain mx-auto grayscale" />
                    </div>
                  )}
                  <h2 className="font-bold text-[1.15em]">{storeSettings?.storeName || 'Toko'}</h2>
                  {storeSettings?.address && <p className="text-[0.9em] opacity-75">{storeSettings.address}</p>}
                </div>
                <div className="border-t border-solid border-black/20 my-3" />
                <div className="opacity-80 flex justify-between font-medium">
                  <span>{format(new Date(transaction.date), 'dd/MM/yyyy')}</span>
                  <span>{transaction.receiptNumber}</span>
                </div>
                <div className="text-left space-y-0.5 mt-1 mb-2 font-medium">
                  <div className="flex justify-between"><span className="opacity-60">Kasir</span><span>{transaction.cashierName || (transaction as any).cashier_name || 'Staff'}</span></div>
                  {transaction.customerName && (
                    <div className="flex justify-between"><span className="opacity-60">Pelanggan</span><span>{transaction.customerName}</span></div>
                  )}
                  {tableVal && (
                    <div className="flex justify-between">
                      <span className="opacity-60">Meja/Tipe</span>
                      <span>{formatReceiptTable(tableVal)}</span>
                    </div>
                  )}
                </div>
                <div className="border-t border-solid border-black/20 my-3" />
                
                {/* Items */}
                <div className="space-y-1.5 text-left font-medium">
                  {safeItems.map((item: any, i: number) => {
                    const pName = item.productName || item.product_name || 'Produk';
                    let variants = item.selectedVariants || item.selected_variants || [];
                    if (typeof variants === 'string') {
                      try { variants = JSON.parse(variants); } catch (e) { variants = []; }
                    }
                    return (
                      <div key={i} className="flex justify-between">
                        <span className="break-words whitespace-normal text-left pr-2">
                          {item.quantity}x {pName}
                          {Array.isArray(variants) && variants.length > 0 && ` (+${variants.map((v: any) => v.optionName || v.option_name).join(', ')})`}
                          {item.notes && ` (*${item.notes})`}
                        </span>
                        <span className="shrink-0">{rp(item.subtotal)}</span>
                      </div>
                    );
                  })}
                </div>
                
                <div className="border-t border-solid border-black/20 my-3" />
                <div className="space-y-0.5 font-medium">
                  <div className="flex justify-between">
                    <span>Subtotal</span><span>{rp(transaction.subtotal)}</span>
                  </div>
                  {txDiscountAmount > 0 && (
                    <div className="flex justify-between">
                      <span>Diskon</span><span>-{rp(txDiscountAmount)}</span>
                    </div>
                  )}
                  {((transaction.tax_and_service || transaction.taxAndService) > 0) && (
                    <div className="flex justify-between">
                      <span>Biaya Admin</span><span>{rp(transaction.tax_and_service || transaction.taxAndService)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-[1.1em] pt-1 mt-1 border-t border-dashed border-gray-300">
                    <span>Total</span><span>{rp(transaction.total)}</span>
                  </div>
                </div>
                <div className="flex justify-between opacity-80 mt-1.5 font-medium">
                  <span>Pembayaran</span><span>{paymentMethodName}</span>
                </div>
                <div className="flex justify-between opacity-80 font-medium">
                  <span>Kembali</span><span>{rp(transaction.change)}</span>
                </div>
              </div>
            )}

            {/* ── Dynamic Footer ── */}
            <div className="border-t border-black mt-4 mb-3 opacity-40" />
            <div className="relative z-10 pt-1 pb-3 space-y-2 text-gray-500 text-[0.85em] text-center">
              {footerOrder.map((block: string, idx: number) => {
                if (block === 'line1' && footerLinesData[0]?.trim()) {
                  return (
                    <p 
                      key={idx} 
                      className="whitespace-pre-wrap leading-relaxed" 
                      style={getFooterStyle('line1')}
                    >
                      {footerLinesData[0].trim()}
                    </p>
                  );
                }
                if (block === 'line2' && footerLinesData[1]?.trim()) {
                  return (
                    <p 
                      key={idx} 
                      className="whitespace-pre-wrap leading-relaxed" 
                      style={getFooterStyle('line2')}
                    >
                      {footerLinesData[1].trim()}
                    </p>
                  );
                }
                if (block === 'image' && showFooterImg) {
                  if (footerType === 'qrcode' && footerQrUrl) {
                    return (
                      <div key={idx} className="my-2.5 flex justify-center text-center">
                        <QRCodeCanvas 
                          value={footerQrUrl} 
                          size={72} 
                          level="M" 
                          includeMargin={true} 
                          className="mx-auto bg-white p-0.5 rounded"
                        />
                      </div>
                    );
                  } else if (footerType === 'image' && footerImgData) {
                    return (
                      <div key={idx} className="my-2.5 text-center">
                        <img 
                          crossOrigin="anonymous"
                          src={processedFooterImg || footerImgData} 
                          alt="Footer" 
                          className="h-16 w-auto mx-auto object-contain rounded-xl grayscale opacity-75 select-none" 
                          style={{ filter: 'grayscale(1) contrast(1.2)' }}
                        />
                      </div>
                    );
                  }
                }
                return null;
              })}
            </div>
          </div>
        </div>

        {/* Tombol Aksi */}
        <div className="grid grid-cols-2 gap-3 mt-2">
          <Button 
            variant="outline" 
            className="flex flex-col items-center justify-center gap-2 h-20 bg-card border-border hover:bg-muted hover:border-primary/50 text-muted-foreground hover:text-primary rounded-2xl transition-all shadow-sm" 
            onClick={handleDownload} 
            disabled={downloading || sharing}
          >
            {downloading ? <Loader2 className="w-6 h-6 animate-spin text-primary" /> : <Download className="w-6 h-6 text-muted-foreground group-hover:text-primary" />}
            <span className="text-[10px] font-bold uppercase tracking-wider">Unduh</span>
          </Button>

          <Button 
            variant="outline" 
            className="flex flex-col items-center justify-center gap-2 h-20 bg-card border-border hover:bg-muted hover:border-primary/50 text-muted-foreground hover:text-primary rounded-2xl transition-all shadow-sm" 
            onClick={handleShare} 
            disabled={downloading || sharing}
          >
            {sharing ? <Loader2 className="w-6 h-6 animate-spin text-primary" /> : <Share2 className="w-6 h-6 text-muted-foreground group-hover:text-primary" />}
            <span className="text-[10px] font-bold uppercase tracking-wider">Bagikan</span>
          </Button>
        </div>

        <Button 
          className="w-full mt-3 rounded-2xl py-6 text-base font-bold bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:hover:bg-white dark:text-slate-900 transition-all shadow-md" 
          onClick={onClose}
        >
          Tutup
        </Button>
      </DialogContent>
    </Dialog>
  );
}
