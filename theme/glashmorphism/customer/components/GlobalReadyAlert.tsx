import React, { useState, useEffect, useRef } from 'react';
import { BellRing, PartyPopper, X } from 'lucide-react';
import { TakeawayIcon } from '@/components/ui/TakeawayIcon';
import { useDbQuery } from '@/hooks/db-hooks';
import { getLocalTransactionIds } from '@/lib/utils';
import { sendWhatsAppNotification } from '@/lib/fonnte';
import { uploadToCloudinary } from '@/lib/cloudinary';
import html2canvas from 'html2canvas';
import { fetchTransactionItems } from '@/lib/db';

// ============================================================================
// HELPER: GENERASI GAMBAR STRUK HITAM PUTIH STANDAR DI BELAKANG LAYAR (OFFSCREEN)
// ============================================================================
async function generateAndUploadReceiptImage(
  transaction: any,
  storeSettings: any
): Promise<string | undefined> {
  try {
    const receiptNo = transaction.receipt_number || transaction.receiptNumber || '-';
    console.info('[ReceiptGen] Generating offscreen receipt image for:', receiptNo);

    // 1. Ambil list item transaksi
    const items = await fetchTransactionItems(transaction.id);
    if (!items || items.length === 0) {
      console.warn('[ReceiptGen] No items found for transaction:', transaction.id);
    }

    // 2. Buat element penampung offscreen
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '-9999px';
    container.style.width = '280px'; // Lebar kertas thermal 58mm standar
    container.style.background = '#ffffff';
    container.style.color = '#000000';
    container.style.padding = '15px';
    container.style.fontFamily = "'Courier New', Courier, monospace";
    container.style.fontSize = '11px';
    container.style.lineHeight = '1.3';
    container.style.boxSizing = 'border-box';

    // Helper format rupiah
    const rp = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;
    const dateStr = transaction.date 
      ? new Date(transaction.date).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) 
      : '-';

    const tableVal = transaction.table_number || transaction.tableNumber;
    const isTakeaway = !tableVal || String(tableVal).toLowerCase() === 'bawa pulang';

    // 3. Susun HTML struktur struk hitam putih super bersih & kontras tinggi
    let htmlContent = `
      <div style="text-align: center; margin-bottom: 12px; border-bottom: 1px dashed #000000; padding-bottom: 8px;">
        <h2 style="margin: 0; font-size: 15px; font-weight: bold; text-transform: uppercase;">${(storeSettings?.storeName || 'TOKO KAMI').toUpperCase()}</h2>
        ${storeSettings?.address ? `<p style="margin: 2px 0 0 0; font-size: 9px; opacity: 0.9;">${storeSettings.address}</p>` : ''}
        ${storeSettings?.phone ? `<p style="margin: 1px 0 0 0; font-size: 9px; opacity: 0.9;">Telp: ${storeSettings.phone}</p>` : ''}
      </div>
      
      <div style="margin-bottom: 10px; font-size: 10px;">
        <div style="display: flex; justify-content: space-between;"><span>No. Struk:</span><strong>${receiptNo}</strong></div>
        <div style="display: flex; justify-content: space-between;"><span>Tanggal:</span><span>${dateStr}</span></div>
        <div style="display: flex; justify-content: space-between;"><span>Pelanggan:</span><span>${transaction.customer_name || transaction.customerName || 'Tamu'}</span></div>
        <div style="display: flex; justify-content: space-between;"><span>Tipe/Meja:</span><span>${isTakeaway ? 'Take Away' : `Meja ${tableVal}`}</span></div>
      </div>
      
      <div style="border-top: 1px dashed #000000; padding-top: 8px; margin-bottom: 8px;">
    `;

    // Sediakan item per baris
    items.forEach((item: any) => {
      const pName = item.product_name || item.productName || 'Produk';
      const qty = item.quantity || 1;
      const price = item.price || 0;
      const subtotal = item.subtotal || (qty * price);

      let safeVariants = item.selected_variants || item.selectedVariants || [];
      if (typeof safeVariants === 'string') {
        try { safeVariants = JSON.parse(safeVariants); } catch (_) { safeVariants = []; }
      }
      if (!Array.isArray(safeVariants)) safeVariants = [];

      htmlContent += `
        <div style="margin-bottom: 6px;">
          <div style="font-weight: bold; text-align: left;">${pName}</div>
          <div style="display: flex; justify-content: space-between; font-size: 10px; padding-left: 4px;">
            <span>${qty} x ${rp(price)}</span>
            <span>${rp(subtotal)}</span>
          </div>
      `;

      if (safeVariants.length > 0) {
        htmlContent += `
          <div style="font-size: 9px; opacity: 0.8; padding-left: 6px; text-align: left;">
            + ${safeVariants.map((v: any) => v.option_name || v.optionName).join(', ')}
          </div>
        `;
      }

      if (item.notes) {
        htmlContent += `
          <div style="font-size: 9px; font-style: italic; opacity: 0.8; padding-left: 6px; text-align: left;">
            Catatan: ${item.notes}
          </div>
        `;
      }

      htmlContent += `</div>`;
    });

    // 4. Bagian footer biaya
    const subtotal = transaction.subtotal || 0;
    const taxAndService = transaction.tax_and_service || transaction.taxAndService || 0;
    const discount = transaction.discount_amount || transaction.discountAmount || 0;
    const total = transaction.total || (subtotal + taxAndService - discount);
    const bayar = transaction.payment_amount || transaction.paymentAmount || total;
    const kembali = transaction.change || 0;

    htmlContent += `
      </div>
      
      <div style="border-top: 1px dashed #000000; padding-top: 6px; font-size: 10px; margin-bottom: 12px;">
        <div style="display: flex; justify-content: space-between;"><span>Subtotal:</span><span>${rp(subtotal)}</span></div>
        ${taxAndService > 0 ? `<div style="display: flex; justify-content: space-between;"><span>Biaya Admin:</span><span>${rp(taxAndService)}</span></div>` : ''}
        ${discount > 0 ? `<div style="display: flex; justify-content: space-between;"><span>Diskon:</span><span>-${rp(discount)}</span></div>` : ''}
        <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 12px; margin-top: 2px; border-top: 1px solid #000000; padding-top: 2px;">
          <span>TOTAL:</span><span>${rp(total)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-top: 4px;"><span>Bayar:</span><span>${rp(bayar)}</span></div>
        <div style="display: flex; justify-content: space-between;"><span>Kembali:</span><span>${rp(kembali)}</span></div>
      </div>
      
      <div style="text-align: center; font-size: 9px; border-top: 1px dashed #000000; padding-top: 8px;">
        <p style="margin: 0; font-weight: bold;">Terima kasih atas kunjungan Anda!</p>
        ${storeSettings?.receiptFooter ? `<p style="margin: 2px 0 0 0;">${storeSettings.receiptFooter}</p>` : ''}
      </div>
    `;

    container.innerHTML = htmlContent;
    document.body.appendChild(container);

    // 5. Render dengan html2canvas
    const canvas = await html2canvas(container, {
      backgroundColor: '#ffffff',
      scale: 1, // Diubah menjadi 1 agar resolusi/ukuran gambar sangat kecil dan ringan
      useCORS: true,
      logging: false,
    });

    // 6. Hapus element dari DOM
    document.body.removeChild(container);

    // 7. Binarisasi hitam-putih kontras tinggi agar super ringan & tajam
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const pixels = imgData.data;
      for (let i = 0; i < pixels.length; i += 4) {
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];
        const avg = 0.299 * r + 0.587 * g + 0.114 * b;
        
        // Threshold: Di bawah 180 jadi hitam pekat (0), di atas jadi putih bersih (255)
        const val = avg < 180 ? 0 : 255;
        pixels[i] = val;
        pixels[i + 1] = val;
        pixels[i + 2] = val;
      }
      ctx.putImageData(imgData, 0, 0);
    }

    // 8. Convert ke JPEG Blob (kualitas 0.5 untuk optimasi ukuran file ekstrem di bawah 10 KB!)
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', 0.5);
    });

    if (!blob) {
      console.error('[ReceiptGen] Failed to create blob from receipt canvas');
      return undefined;
    }

    // 9. Upload ke Cloudinary
    console.info(`[ReceiptGen] Uploading receipt image (${(blob.size / 1024).toFixed(2)} KB) to Cloudinary...`);
    const uploadUrl = await uploadToCloudinary('receipts', `ready_${transaction.id}`, blob);
    if (!uploadUrl) {
      throw new Error('Gagal mengunggah gambar ke Cloudinary');
    }
    console.info('[ReceiptGen] Successfully generated & uploaded receipt URL:', uploadUrl);
    return uploadUrl;
  } catch (error) {
    console.error('[ReceiptGen] Error generating offscreen receipt image:', error);
    return undefined;
  }
}


// ============================================================================
// HELPER: LOCALSTORAGE UNTUK MELACAK TRANSAKSI YANG SUDAH DIKIRIMI WA
// ============================================================================
const getSentWaTxIds = (): string[] => {
  try {
    const saved = localStorage.getItem('mesenae_sent_wa_tx_ids');
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
};

const markWaTxAsSent = (txId: string) => {
  try {
    const sentIds = getSentWaTxIds();
    if (!sentIds.includes(txId)) {
      sentIds.push(txId);
      localStorage.setItem('mesenae_sent_wa_tx_ids', JSON.stringify(sentIds));
    }
  } catch (e) {
    console.error('[GlobalReadyAlert] Gagal menyimpan ID transaksi WA ke localStorage:', e);
  }
};

interface GlobalReadyAlertProps {
  customerName: string;
  storeSettings?: any; // untuk membaca deliveryMode
}

export default function GlobalReadyAlert({ customerName, storeSettings }: GlobalReadyAlertProps) {
  // Juga ambil storeSettings dari DB langsung (fallback jika prop belum tersedia)
  const dbSettingsList = (useDbQuery('storeSettings') as any[]) || [];
  const settings = storeSettings || dbSettingsList[0] || {};
  const isAmbil = settings?.deliveryMode === 'ambil';
  const allTxs = (useDbQuery('transactions') as any[]) || [];

  // Mencegah alarm berulang untuk transaksi yang sama setelah ditutup
  const [dismissedTxs, setDismissedTxs] = useState<Record<string, boolean>>({});
  const [activeReadyTx, setActiveReadyTx] = useState<any | null>(null);

  const vibrationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const notifiedTxsRef = useRef<Set<string>>(new Set());
  const isInitialLoadRef = useRef<boolean>(true);
  // Timestamp saat komponen dimount — digunakan sebagai grace period
  // agar transaksi yang sudah 'siap' sebelum user membuka halaman tidak memicu alarm.
  const mountTimeRef = useRef<number>(Date.now());

  // Deteksi transaksi yang statusnya "siap"
  useEffect(() => {
    if (!customerName && getLocalTransactionIds().length === 0) return;
    // PENTING: Jangan proses saat allTxs masih kosong (Firestore belum memuat).
    // Jika kita consume isInitialLoadRef saat allTxs=[], maka data yang datang kemudian
    // akan dianggap 'baru' dan memicu alarm palsu.
    if (allTxs.length === 0) return;

    const localIds = getLocalTransactionIds();

    // ── INITIAL LOAD: Tandai semua transaksi 'siap' yang sudah ada sebagai 'sudah dilihat' ──
    // Ini mencegah alarm/notifikasi untuk pesanan lama yang sudah siap sebelum user membuka halaman.
    if (isInitialLoadRef.current) {
      isInitialLoadRef.current = false;
      const sentIds = getSentWaTxIds();
      let updated = false;

      allTxs.forEach(tx => {
        const matchName = tx.customer_name === customerName || tx.customerName === customerName;
        const matchId = localIds.includes(tx.id as string | number);
        if (matchName || matchId) {
          const kitchen = (tx.kitchen_status || tx.kitchenStatus || '').toLowerCase();
          // Tandai SEMUA status terminal (siap, diantarkan, selesai) sebagai sudah diproses
          if (['siap', 'diantarkan', 'selesai'].includes(kitchen)) {
            const txIdStr = String(tx.id);
            notifiedTxsRef.current.add(txIdStr);
            setDismissedTxs(prev => ({ ...prev, [tx.id]: true }));
            if (!sentIds.includes(txIdStr)) {
              sentIds.push(txIdStr);
              updated = true;
            }
          }
        }
      });

      if (updated) {
        localStorage.setItem('mesenae_sent_wa_tx_ids', JSON.stringify(sentIds));
      }
      console.info("[GlobalReadyAlert] Initial load: ignored", notifiedTxsRef.current.size, "historical ready/complete transactions.");
      return;
    }

    // ── GRACE PERIOD: Dalam 3 detik pertama setelah mount, abaikan semua alarm ──
    // Ini melindungi dari skenario di mana Firestore mengirim batch update cepat
    // yang lolos dari filter isInitialLoadRef di atas.
    const elapsed = Date.now() - mountTimeRef.current;
    if (elapsed < 3000) {
      return;
    }

    const readyTxs = allTxs.filter(tx => {
      const matchName = tx.customer_name === customerName || tx.customerName === customerName;
      const matchId = localIds.includes(tx.id as string | number);
      if (!matchName && !matchId) return false;

      const status = (tx.status || '').toLowerCase();
      const kitchen = (tx.kitchen_status || tx.kitchenStatus || '').toLowerCase();

      // Hanya izinkan transaksi yang dibuat dalam waktu 2 jam terakhir (mencegah data sampah kuno)
      const txDate = tx.date ? new Date(tx.date).getTime() : 0;
      const isRecent = Date.now() - txDate < 2 * 60 * 60 * 1000;

      return status !== 'cancelled' && status !== 'batal' && kitchen === 'siap' && isRecent;
    });

    // Ambil transaksi pertama yang belum di-dismiss
    const newReadyTx = readyTxs.find(tx => !dismissedTxs[tx.id]);

    if (newReadyTx) {
      const txKey = String(newReadyTx.id);

      // Trigger system notification hanya sekali per transaksi
      if (!notifiedTxsRef.current.has(txKey)) {
        notifiedTxsRef.current.add(txKey);

        // ── MAINKAN SUARA NOTIFIKASI (notif.mp3 diikuti siap.mp3 dengan jeda singkat 500ms) ──
        try {
          if (typeof window !== 'undefined' && typeof (window as any).playReadyNotificationSound === 'function') {
            (window as any).playReadyNotificationSound();
          } else {
            const audioNotif = new Audio('/notif.mp3');
            audioNotif.play().catch(audioErr => {
              console.warn('[GlobalReadyAlert] Browser memblokir pemutaran notif.mp3 otomatis:', audioErr);
            });

            // Mainkan siap.mp3 setelah jeda 500ms (tidak menunggu notif.mp3 selesai sepenuhnya)
            setTimeout(() => {
              try {
                const audioSiap = new Audio('/siap.mp3');
                audioSiap.play().catch(e => {
                  console.warn('[GlobalReadyAlert] Browser memblokir pemutaran siap.mp3 otomatis:', e);
                });
              } catch (err) {
                console.error('[GlobalReadyAlert] Gagal memutar siap.mp3:', err);
              }
            }, 500);
          }
        } catch (audioErr) {
          console.error('[GlobalReadyAlert] Gagal memutar suara notifikasi:', audioErr);
        }

        // ── KIRIM NOTIFIKASI WHATSAPP OTOMATIS (FONNTE) ──
        const isWhatsappEnabled = settings?.enableWhatsappNotification === true;
        const targetPhone = newReadyTx.customer_phone || newReadyTx.customerPhone || localStorage.getItem('mesenae_customerPhone');
        
        const sentIds = getSentWaTxIds();
        const isAlreadySent = sentIds.includes(txKey);

        if (isWhatsappEnabled && targetPhone && !isAlreadySent) {
          // Tandai langsung di localStorage agar tidak mengirim ulang
          markWaTxAsSent(txKey);

          const receiptNo = newReadyTx.receipt_number || newReadyTx.receiptNumber || '-';
          const tableLabel = newReadyTx.table_number || newReadyTx.tableNumber;
          const isTakeaway = !tableLabel || String(tableLabel) === 'Bawa Pulang';
          
          const nameToUse = newReadyTx.customer_name || newReadyTx.customerName || customerName || '';
          
          const waMessage = `Halo, kak *${nameToUse}* 👋\n\n` +
            `*PESANAN ANDA SUDAH SIAP!* 🍽️🚀\n\n` +
            `• No. Pesanan : *${receiptNo}*\n` +
            `• Tipe/Meja   : *${isTakeaway ? 'Take Away (Bawa Pulang)' : `Meja ${tableLabel}`}*\n` +
            `• Penyerahan  : *${isAmbil ? '📍 Silakan ambil pesanan Anda di kasir' : '🛵 Pesanan akan segera diantarkan ke meja Anda'}*\n\n` +
            `Selamat menikmati kak, terimakasih telah memesan di *${settings?.storeName || 'Mesen.Ae'}* 🙏😊\n\n` +
            `_Pesan ini dikirim otomatis oleh sistem._`;

          sendWhatsAppNotification({
            target: targetPhone,
            message: waMessage
          })
            .then(res => console.info("[Fonnte] Sukses mengirim notifikasi:", res))
            .catch(err => console.error("[Fonnte] Error pengiriman notifikasi:", err));
        }

        try {
          if ('Notification' in window && Notification.permission === 'granted') {
            if ('serviceWorker' in navigator) {
              navigator.serviceWorker.ready.then(reg => {
                reg.showNotification('Pesanan Siap! 🍽️', {
                  body: isAmbil
                    ? `Pesanan #${newReadyTx.receipt_number || newReadyTx.receiptNumber || 'Anda'} siap — silakan diambil.`
                    : `Pesanan #${newReadyTx.receipt_number || newReadyTx.receiptNumber || 'Anda'} siap — akan segera diantar.`,
                  icon: '/icon-192.png',
                  vibrate: [500, 200, 500, 200, 500],
                  requireInteraction: true,
                });
              }).catch(() => {});
            }
          }
        } catch (e) {
          console.warn('Global notification failed', e);
        }
      }

      if (!activeReadyTx || activeReadyTx.id !== newReadyTx.id) {
        setActiveReadyTx(newReadyTx);
      }
    } else {
      setActiveReadyTx(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allTxs, customerName, dismissedTxs]);

  // Getaran berulang selama modal tampil
  useEffect(() => {
    if (activeReadyTx) {
      const runVibration = () => {
        if ('vibrate' in navigator) {
          navigator.vibrate([800, 400, 800, 400, 1200]);
        }
      };
      runVibration();
      vibrationIntervalRef.current = setInterval(runVibration, 4000);
    } else {
      if (vibrationIntervalRef.current) {
        clearInterval(vibrationIntervalRef.current);
        vibrationIntervalRef.current = null;
      }
      if ('vibrate' in navigator) navigator.vibrate(0);
    }

    return () => {
      if (vibrationIntervalRef.current) {
        clearInterval(vibrationIntervalRef.current);
        vibrationIntervalRef.current = null;
      }
      if ('vibrate' in navigator) navigator.vibrate(0);
    };
  }, [activeReadyTx]);

  const handleDismiss = () => {
    if (activeReadyTx) {
      setDismissedTxs(prev => ({ ...prev, [activeReadyTx.id]: true }));
      setActiveReadyTx(null);
      if ('vibrate' in navigator) navigator.vibrate(0);
    }
  };

  if (!activeReadyTx) return null;

  const orderNum = activeReadyTx.receipt_number || activeReadyTx.receiptNumber || '-';
  const tableNum = activeReadyTx.table_number || activeReadyTx.tableNumber;
  const isTakeaway = !tableNum || String(tableNum) === 'Bawa Pulang';

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center p-5 bg-black/70 backdrop-blur-md animate-in fade-in duration-300"
      onClick={handleDismiss}
    >
      {/* Efek kilat merah di latar */}
      <div className="absolute inset-0 pointer-events-none animate-flash-overlay" />

      <div
        className="relative z-10 w-full max-w-sm glass-panel-heavy rounded-[2rem] overflow-hidden shadow-2xl shadow-black/40 animate-in zoom-in-90 duration-300"
        onClick={e => e.stopPropagation()}
      >
        {/* Banner merah atas */}
        <div className="bg-gradient-to-br from-red-500 to-rose-600 p-6 pb-8 text-center relative overflow-hidden">
          {/* Dekorasi */}
          <div className="absolute -top-6 -right-6 w-28 h-28 bg-white/10 rounded-full blur-2xl" />
          <div className="absolute -bottom-4 -left-4 w-20 h-20 bg-white/10 rounded-full blur-xl" />

          {/* Tombol tutup sudut kanan atas */}
          <button
            onClick={handleDismiss}
            className="absolute top-4 right-4 w-8 h-8 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-colors"
            aria-label="Tutup"
          >
            <X size={16} className="text-white" />
          </button>

          {/* Icon bergetar */}
          <div className="relative inline-block mb-3">
            <div className="absolute inset-0 bg-white rounded-full animate-ping opacity-30" style={{ animationDuration: '1.2s' }} />
            <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center relative z-10 border-2 border-white/30">
              <BellRing size={40} className="text-white animate-shake" />
            </div>
          </div>

          <h2 className="text-2xl font-black text-white tracking-tight flex items-center justify-center gap-2">
            Pesanan Siap! <PartyPopper size={24} className="text-yellow-300" />
          </h2>
          <p className="text-white/80 text-sm mt-1 font-medium">
            {isAmbil
              ? 'Silakan ambil pesanan Anda di kasir'
              : `Pesanan akan segera diantar ke meja`}
          </p>
        </div>

        {/* Body info */}
        <div className="p-6 space-y-4">
          <div className="glass-card border border-white/20 dark:border-white/10 rounded-2xl p-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Nomor Pesanan</span>
              <span className="font-black text-slate-900 dark:text-white text-sm">{orderNum}</span>
            </div>
            <div className="h-px bg-white/10 dark:bg-slate-800" />
            <div className="flex justify-between items-center">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                {isTakeaway ? 'Tipe' : 'Meja'}
              </span>
              <span className="font-black text-slate-900 dark:text-white text-sm">
                {isTakeaway ? <span className="flex items-center gap-1.5"><TakeawayIcon className="w-4 h-4" /> Take Away</span> : `Meja ${tableNum}`}
              </span>
            </div>
            <div className="h-px bg-white/10 dark:bg-slate-800" />
            <div className="flex justify-between items-center">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Penyerahan</span>
              <span className="font-black text-sm text-emerald-600 dark:text-emerald-400">
                {isAmbil ? '📍 Ambil di Kasir' : '🛵 Diantar ke Meja'}
              </span>
            </div>
          </div>

          <button
            onClick={handleDismiss}
            className="w-full bg-slate-900 dark:bg-white hover:bg-slate-700 dark:hover:bg-slate-100 text-white dark:text-slate-900 font-bold text-base px-6 py-4 rounded-[1.2rem] active:scale-[0.98] transition-all shadow-lg"
          >
            Tutup
          </button>
        </div>
      </div>

      
    </div>
  );
}
