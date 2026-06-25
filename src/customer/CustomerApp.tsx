import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ShoppingBag, ChevronRight, Database, AlertCircle } from 'lucide-react';
import { requestForToken, onForegroundMessage } from '@/lib/fcm';
import { toast } from 'sonner';

// Pastikan module-module ini sudah mendukung atau memiliki deklarasi TypeScript
import { useDbQuery } from '@/hooks/db-hooks';
import { isDbConfigured } from '@/lib/db';
import { FORMAT_IDR, base64Decode, generateTableId, pruneOldTransactionIds, pruneOldSentWaIds } from '@/lib/utils';
import { useThemeColor } from '@/hooks/use-theme-color';

// Pages - Eager Loaded
import SplashScreen from './pages/SplashScreen';
import LandingView from './pages/LandingView';
import MenuView from './pages/MenuView';
import CheckoutView from './pages/CheckoutView';
import TrackingView from './pages/TrackingView';
import OthersView from './pages/OthersView';
import HistoryView from './pages/HistoryView';
import SuccessView from './pages/SuccessView';
import SplitView from './pages/SplitView';

// Components
import BottomNav from './components/BottomNav';
import MenuDetailSheet from './components/MenuDetailSheet';
import CustomerInfoModal from './components/CustomerInfoModal';
import GlobalReadyAlert from './components/GlobalReadyAlert';

// Loading fallback component
const PageSkeleton = ({ view }: { view?: string }) => {
  if (view === 'others') {
    return (
      <div className="flex-1 flex flex-col bg-slate-50 dark:bg-slate-950 pb-[120px] overflow-y-auto animate-pulse">
        {/* Profile Card Header Skeleton */}
        <div className="px-4 pt-6 pb-2">
          <div className="bg-slate-200 dark:bg-slate-900 rounded-[2rem] p-6 h-[142px] flex items-center gap-4 border border-slate-200/20 dark:border-slate-800/50">
            <div className="w-16 h-16 bg-slate-300 dark:bg-slate-800 rounded-full shrink-0" />
            <div className="space-y-3 flex-1">
              <div className="h-6 w-36 bg-slate-300 dark:bg-slate-800 rounded-md" />
              <div className="h-4 w-28 bg-slate-300 dark:bg-slate-800 rounded-md" />
            </div>
          </div>
        </div>
        
        {/* Menu Items Skeleton */}
        <div className="px-4 space-y-5 mt-4">
          <div>
            <div className="h-4 w-24 bg-slate-200 dark:bg-slate-800 rounded mb-3 ml-2" />
            <div className="bg-white dark:bg-slate-900 rounded-[1.5rem] p-4 h-32 border border-slate-100 dark:border-slate-800" />
          </div>
          <div>
            <div className="h-4 w-24 bg-slate-200 dark:bg-slate-800 rounded mb-3 ml-2" />
            <div className="bg-white dark:bg-slate-900 rounded-[1.5rem] p-4 h-32 border border-slate-100 dark:border-slate-800" />
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="flex-1 flex flex-col p-4 animate-pulse">
      <div className="h-10 w-1/3 bg-slate-200 dark:bg-slate-800 rounded-lg mb-6"></div>
      <div className="space-y-4">
        <div className="h-24 w-full bg-slate-200 dark:bg-slate-800 rounded-2xl"></div>
        <div className="h-24 w-full bg-slate-200 dark:bg-slate-800 rounded-2xl"></div>
      </div>
    </div>
  );
};


// ==========================================
// Tipe Data & Interfaces
// ==========================================

export interface Variant {
  id: string | number;
  name: string;
  price: number;
}

export interface MenuItem {
  id: string | number;
  name: string;
  price: number;
  image?: string;
  description?: string;
  stock?: number;
  [key: string]: unknown; // Menggunakan unknown untuk menghindari 'any' yang tidak aman
}

export interface CartItem extends MenuItem {
  cartId: number;
  qty: number;
  notes: string;
  selectedVariants: Variant[];
}

export interface CartTotals {
  subtotal: number;
  tax: number;
  service: number;
  total: number;
}

// Format final data transaksi untuk dikirim antar page
export interface FinalOrderData {
  transaction: {
    id?: string | number;
    receipt_number?: string;
    [key: string]: unknown;
  };
  items: unknown[];
  paymentMethodName: string;
}

export default function CustomerApp() {
  useThemeColor();



  // Ambil view awal dari URL jika ada
  const getInitialView = (): string => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('view') || 'splash';
    }
    return 'splash';
  };

  // ==========================================
  // States
  // ==========================================
  const [viewState, setViewState] = useState<string>(getInitialView);
  const [customerName, setCustomerName] = useState<string>(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('mesenae_customerName') || '';
    return '';
  });
  const [customerPhone, setCustomerPhone] = useState<string>(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('mesenae_customerPhone') || '';
    return '';
  });
  const [tableNumber, setTableNumber] = useState<string>(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('mesenae_tableNumber') || 'Bawa Pulang';
    return 'Bawa Pulang';
  });

  // Bersihkan data localStorage lama pada setiap startup untuk mencegah penumpukan
  useEffect(() => {
    pruneOldTransactionIds();
    pruneOldSentWaIds();
  }, []);

  // Global audio instances for notification sounds & context unlocker (Chrome / Android Autoplay bypass)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const notifAudio = new Audio('/notif.mp3');
    const siapAudio = new Audio('/siap.mp3');
    
    notifAudio.preload = 'auto';
    siapAudio.preload = 'auto';

    let unlocked = false;
    let lastPlayedTime = 0;
    // Grace period 4 detik setelah mount agar suara tidak dimainkan
    // akibat FCM foreground listener atau data Firestore yang dimuat awal.
    const audioMountTime = Date.now();

    const unlock = () => {
      if (unlocked) return;
      
      // Play a short silent/paused cycle to unlock the browser AudioContext
      // IMPORTANT: Set volume to 0 so it's truly silent during unlock, and do NOT restore volume to 1 here
      notifAudio.volume = 0;
      siapAudio.volume = 0;
      
      notifAudio.play()
        .then(() => {
          notifAudio.pause();
          notifAudio.currentTime = 0;
        })
        .catch(err => console.debug('[Audio] Unlock notifAudio failed', err));

      siapAudio.play()
        .then(() => {
          siapAudio.pause();
          siapAudio.currentTime = 0;
          unlocked = true;
          cleanup();
          console.info('[Audio] Browser AudioContext unlocked successfully');
        })
        .catch(err => console.debug('[Audio] Unlock siapAudio failed', err));
    };

    const cleanup = () => {
      document.removeEventListener('click', unlock);
      document.removeEventListener('touchstart', unlock);
      document.removeEventListener('keydown', unlock);
    };

    document.addEventListener('click', unlock);
    document.addEventListener('touchstart', unlock);
    document.addEventListener('keydown', unlock);

    // Expose global play function with built-in 5s throttle to prevent overlapping double-plays
    (window as any).playReadyNotificationSound = () => {
      const now = Date.now();
      // Cegah suara diputar dalam 4 detik pertama setelah mount (startup grace period)
      if (now - audioMountTime < 4000) {
        console.log('[Audio] Suppressed play during startup grace period');
        return;
      }
      if (now - lastPlayedTime < 5000) {
        console.log('[Audio] Suppressed duplicate play within 5 seconds');
        return;
      }
      lastPlayedTime = now;

      console.log('[Audio] Triggering ready notification sound');
      
      // Restore volume for actual playback
      notifAudio.volume = 1;
      siapAudio.volume = 1;
      
      notifAudio.currentTime = 0;
      siapAudio.currentTime = 0;

      notifAudio.play()
        .then(() => {
          setTimeout(() => {
            siapAudio.play().catch(e => console.warn('[Audio] siapAudio.play blocked:', e));
          }, 500);
        })
        .catch(e => {
          console.warn('[Audio] notifAudio.play blocked, trying fallback...', e);
          siapAudio.play().catch(err => console.warn('[Audio] siapAudio fallback blocked:', err));
        });
    };

    return () => {
      cleanup();
      delete (window as any).playReadyNotificationSound;
    };
  }, []);

  // Daftarkan FCM token & listener foreground message saat customerName tersedia
  useEffect(() => {
    if (!customerName) return;
    requestForToken('customer', customerName).catch(console.error);

    // Setup foreground messaging listener
    let unsubscribe: (() => void) | undefined;
    
    onForegroundMessage((payload) => {
      console.info('[FCM] Foreground notification received:', payload);
      
      // Trigger sound
      if (typeof window !== 'undefined' && typeof (window as any).playReadyNotificationSound === 'function') {
        (window as any).playReadyNotificationSound();
      }
      
      // Tampilkan notifikasi toast di foreground
      const title = payload.notification?.title || 'Notifikasi';
      const body = payload.notification?.body || 'Status pesanan Anda telah diperbarui!';
      toast.info(body, {
        description: title,
        duration: 8000,
      });
    }).then(unsub => {
      unsubscribe = unsub;
    }).catch(err => {
      console.error('[FCM] Error setting up foreground listener:', err);
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [customerName]);

  // Modals
  const [showCustomerModal, setShowCustomerModal] = useState<boolean>(false);

  // Data States
  const [cart, setCart] = useState<CartItem[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedCart = localStorage.getItem('mesenae_cart');
        return savedCart ? JSON.parse(savedCart) : [];
      } catch {
        return [];
      }
    }
    return [];
  });

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedItem, setSelectedItemState] = useState<MenuItem | null>(null);
  const [hidePhotoInSheet, setHidePhotoInSheet] = useState<boolean>(false);

  const setSelectedItem = useCallback((item: MenuItem | null, hidePhoto = false) => {
    setSelectedItemState(item);
    setHidePhotoInSheet(hidePhoto);
  }, []);

  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const saved = localStorage.getItem('mesenae_darkMode');
    if (saved !== null) return saved === 'true';
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  const [finalOrderData, setFinalOrderData] = useState<FinalOrderData | null>(null);
  const [appliedVoucher, setAppliedVoucher] = useState<any>(null);
  const [splitConfig, setSplitConfig] = useState<any>(null);

  // Gunakan optional chaining atau type assertion sesuai pengembalian useDbQuery
  const storeSettingsList = (useDbQuery('storeSettings') as unknown[]) ?? [];
  const storeSettings = storeSettingsList[0] || null;

  // ==========================================
  // Custom Navigation & History Management
  // ==========================================
  const setView = useCallback((newView: string, replace: boolean = false) => {
    if (newView === viewState) return;

    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('view', newView);

      if (replace) {
        window.history.replaceState({ view: newView }, '', url.toString());
      } else {
        window.history.pushState({ view: newView }, '', url.toString());
      }
    }

    setViewState(newView);
  }, [viewState]);

  // Handle PopState (Back/Forward browser/device button)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handlePopState = (event: PopStateEvent) => {
      // Tutup modal detail menu jika sedang terbuka saat user menekan back
      if (selectedItem) {
        setSelectedItem(null);
        return;
      }
      // Tutup modal customer info jika terbuka
      if (showCustomerModal) {
        setShowCustomerModal(false);
        return;
      }

      if (event.state && event.state.view) {
        setViewState(event.state.view);
      } else {
        const params = new URLSearchParams(window.location.search);
        setViewState(params.get('view') || 'landing');
      }
    };

    window.addEventListener('popstate', handlePopState);

    // Setup initial state di history
    if (!window.history.state) {
      const url = new URL(window.location.href);
      url.searchParams.set('view', viewState);
      window.history.replaceState({ view: viewState }, '', url.toString());
    }

    return () => window.removeEventListener('popstate', handlePopState);
  }, [viewState, selectedItem, showCustomerModal]);

  // ==========================================
  // Effect Syncs
  // ==========================================
  useEffect(() => {
    if (typeof window !== 'undefined') localStorage.setItem('mesenae_customerName', customerName);
  }, [customerName]);

  useEffect(() => {
    if (typeof window !== 'undefined') localStorage.setItem('mesenae_customerPhone', customerPhone);
  }, [customerPhone]);

  useEffect(() => {
    if (typeof window !== 'undefined') localStorage.setItem('mesenae_tableNumber', tableNumber);
  }, [tableNumber]);

  useEffect(() => {
    if (typeof window !== 'undefined') localStorage.setItem('mesenae_cart', JSON.stringify(cart));
  }, [cart]);

  // Sync dark mode to document root for desktop/global styles and persist
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (isDarkMode) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      localStorage.setItem('mesenae_darkMode', String(isDarkMode));
    } catch (e) { console.warn('Storage write error', e); }
  }, [isDarkMode]);

  // Handle URL Query Params and path segments for direct table scan
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const getTableFromUrl = () => {
      const params = new URLSearchParams(window.location.search);
      // Check query parameter 'table' or 'tabble'
      const tableVal = params.get('table') || params.get('tabble');
      if (tableVal) return base64Decode(tableVal);

      // Check pathname (e.g. /table=3 or /tabble=3 or /table/3 or /tabble/3)
      const urlPath = window.location.pathname;
      const match = urlPath.match(/(?:table|tabble)=([^&#/]+)/i) || 
                    urlPath.match(/(?:table|tabble)\/([^&#/]+)/i);
      if (match && match[1]) {
        return base64Decode(decodeURIComponent(match[1]));
      }
      return null;
    };

    const urlTable = getTableFromUrl();
    if (urlTable) {
      setTableNumber(urlTable);
    }
  }, []);

  // Validate table selection against Firestore active tables when storeSettings is loaded
  useEffect(() => {
    // Only validate if storeSettings is successfully loaded from Firestore
    if (!storeSettings) return;

    // Check if tableNumber is active in storeSettings.tables
    const activeTables = Array.isArray((storeSettings as any)?.tables) 
      ? (storeSettings as any).tables 
      : [];

    // "Bawa Pulang" (Take Away) is always valid
    if (tableNumber === 'Bawa Pulang') return;

    // Resolve tableNumber from hash ID to raw table name if possible
    let resolvedTable = activeTables.find(
      (t: any) => generateTableId(String(t)) === tableNumber || String(t).trim().toLowerCase() === String(tableNumber).trim().toLowerCase()
    );

    // Fallback: check base64 decoded match
    if (!resolvedTable) {
      try {
        const decoded = base64Decode(tableNumber);
        resolvedTable = activeTables.find(
          (t: any) => String(t).trim().toLowerCase() === decoded.trim().toLowerCase()
        );
      } catch (e) {}
    }

    if (resolvedTable) {
      if (resolvedTable !== tableNumber) {
        setTableNumber(resolvedTable);
      }
      return;
    }

    // Invalid or inactive table: redirect to takeaway ("Bawa Pulang")
    setTableNumber('Bawa Pulang');
    
    // Clean up URL query params and pathname if necessary to avoid persistent invalid state in URL
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('table');
      url.searchParams.delete('tabble');
      
      // If the pathname was "/table=X" or "/tabble=X", reset to "/"
      if (url.pathname.toLowerCase().includes('table=') || url.pathname.toLowerCase().includes('tabble=')) {
        url.pathname = '/';
      }
      
      window.history.replaceState(window.history.state, '', url.toString());
    }

    toast.error('Nomor meja tidak terdaftar atau dinonaktifkan. Dialihkan ke Bawa Pulang.', {
      id: 'table-validation-error', // Prevent duplicate toasts
    });
  }, [storeSettings, tableNumber]);

  // Splash Screen & Routing Logic
  useEffect(() => {
    if (viewState === 'splash') {
      const timer = setTimeout(() => {
        const isNameInvalid = !customerName || customerName.trim().toLowerCase() === 'tamu';
        const isWhatsappEnabled = storeSettings?.enableWhatsappNotification === true;
        const isPhoneInvalid = isWhatsappEnabled && !customerPhone.trim();

        if (isNameInvalid || isPhoneInvalid) {
          setShowCustomerModal(true);
        }
        setView('landing', true);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [viewState, customerName, customerPhone, storeSettings, setView]);

  // Enforce customer info validation globally (Name must not be empty/Tamu, and WA phone must be present if WA notification is enabled)
  useEffect(() => {
    if (viewState === 'splash') return; // Tunggu splash screen selesai

    const isNameInvalid = !customerName || customerName.trim().toLowerCase() === 'tamu';
    const isWhatsappEnabled = storeSettings?.enableWhatsappNotification === true;
    const isPhoneInvalid = isWhatsappEnabled && !customerPhone.trim();

    if (isNameInvalid || isPhoneInvalid) {
      if (!showCustomerModal) {
        setShowCustomerModal(true);
      }
    }
  }, [viewState, customerName, customerPhone, storeSettings, showCustomerModal]);

  // ==========================================
  // Business Logic
  // ==========================================
  const addToCart = (item: MenuItem, qty: number, notes: string, selectedVariants: Variant[]) => {
    const existingIndex = cart.findIndex((c) =>
      c.id === item.id &&
      JSON.stringify(c.selectedVariants) === JSON.stringify(selectedVariants) &&
      c.notes === notes
    );

    if (existingIndex >= 0) {
      const newCart = [...cart];
      newCart[existingIndex].qty += qty;
      setCart(newCart);
    } else {
      setCart([...cart, { ...item, cartId: Date.now(), qty, notes, selectedVariants }]);
    }
    setSelectedItem(null);
  };

  const directBuy = (item: MenuItem, qty: number, notes: string, selectedVariants: Variant[]) => {
    addToCart(item, qty, notes, selectedVariants);
    setTimeout(() => setView('checkout'), 100);
  };

  const handleCustomerInfoSubmit = (name: string, table: string, phone: string) => {
    setCustomerName(name);
    setTableNumber(table);
    setCustomerPhone(phone);
    setShowCustomerModal(false);
  };

  const updateCartQty = (cartId: number, delta: number) => {
    setCart((prevCart) => {
      const newCart = prevCart.map((item) => {
        if (item.cartId === cartId) {
          const newQty = Math.max(0, item.qty + delta);
          return { ...item, qty: newQty };
        }
        return item;
      }).filter((item) => item.qty > 0);

      if (newCart.length === 0 && viewState === 'checkout') {
        setTimeout(() => setView('menu'), 0);
      }
      return newCart;
    });
  };

  const cartTotal: CartTotals = useMemo(() => {
    const subtotal = cart.reduce((sum: number, item: CartItem) => {
      const itemPrice = item.price;
      const variantsPrice = item.selectedVariants?.reduce((a: number, b: Variant) => a + b.price, 0) || 0;
      return sum + ((itemPrice + variantsPrice) * item.qty);
    }, 0);
    // Tidak ada pajak & service default (Hanya potongan MDR Midtrans saat checkout)
    const tax = 0;
    const service = 0;
    return { subtotal, tax, service, total: subtotal + tax + service };
  }, [cart]);

  // ==========================================
  // Render
  // ==========================================
  if (!isDbConfigured) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6 font-sans">
        <div className="max-w-md w-full bg-white rounded-[2rem] p-8 shadow-2xl shadow-slate-200/50 border border-slate-100 text-center animate-in zoom-in-95 duration-500">
          <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6 text-blue-600 shadow-inner">
            <Database size={32} strokeWidth={1.5} />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-3">Database Belum Siap</h1>
          <p className="text-sm text-slate-500 mb-6 leading-relaxed">
            Sistem tidak dapat dimuat. Pastikan Anda telah mengatur konfigurasi berikut pada Environment Variables:
          </p>
          <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 text-left text-sm space-y-2.5 mb-6">
            <div className="flex items-center gap-2 text-slate-700">
              <AlertCircle size={16} className="text-amber-500" />
              <span className="font-mono font-bold text-xs">SPREADSHEET_ID</span>
            </div>
            <div className="flex items-center gap-2 text-slate-700">
              <AlertCircle size={16} className="text-amber-500" />
              <span className="font-mono font-bold text-xs">FOLDER_UTAMA_ID</span>
            </div>
          </div>
          <p className="text-[11px] text-slate-400 font-medium">
            Jika baru saja diubah, harap tunggu beberapa menit hingga proses deployment server selesai.
          </p>
        </div>
      </div>
    );
  }

  return (
    // Background utama selaras tema; darkmode diterapkan hingga ke akar
    <div className={`min-h-[100dvh] font-sans flex flex-col transition-colors duration-300 bg-slate-50 dark:bg-slate-950`}>

      {/* 
        PERUBAHAN DESKTOP RESPONSIVE:
        Dikembalikan ke max-w-[1920px] agar full layar di desktop.
      */}
      <div className={`w-full max-w-[1920px] mx-auto bg-white dark:bg-slate-950 flex-1 relative flex flex-col md:border-x border-slate-200 dark:border-slate-800 shadow-sm md:shadow-none overflow-hidden transition-all ${isDarkMode ? 'dark customer-theme' : 'customer-theme'}`}>

        {customerName && <GlobalReadyAlert customerName={customerName} storeSettings={storeSettings} />}

        {viewState === 'splash' && <SplashScreen />}

        {viewState === 'landing' && (
          <LandingView
            setView={setView}
            customerName={customerName}
            isDarkMode={isDarkMode}
            setIsDarkMode={setIsDarkMode}
            tableNumber={tableNumber}
            setSelectedItem={setSelectedItem}
            addToCart={addToCart as any}
            cartLength={cart.length}
            setSelectedCategory={setSelectedCategory}
            cart={cart}
            updateCartQty={updateCartQty}
          />
        )}

        {viewState === 'menu' && (
          <MenuView
            setView={setView}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            selectedCategory={selectedCategory}
            setSelectedCategory={setSelectedCategory}
            setSelectedItem={setSelectedItem}
            addToCart={addToCart as any}
            cartLength={cart.length}
            cart={cart}
            updateCartQty={updateCartQty}
          />
        )}

        {viewState === 'checkout' && (
          <CheckoutView 
            setView={setView} 
            cart={cart as any} 
            updateCartQty={updateCartQty} 
            totals={cartTotal} 
            setCart={setCart as any} 
            appliedVoucher={appliedVoucher} 
            setAppliedVoucher={setAppliedVoucher}
            customerName={customerName}
            customerPhone={customerPhone}
            setFinalOrderData={setFinalOrderData as any}
            tableNumber={tableNumber}
            setTableNumber={setTableNumber}
            splitConfig={splitConfig}
            setSplitConfig={setSplitConfig}
          />
        )}
        {viewState === 'tracking' && <TrackingView setView={setView} finalOrderData={finalOrderData as any} tableNumber={tableNumber} storeSettings={storeSettings as any} customerName={customerName} />}
        {viewState === 'others' && <OthersView setView={setView} storeSettings={storeSettings as any} tableNumber={tableNumber} customerName={customerName} customerPhone={customerPhone} setCustomerName={setCustomerName} setCustomerPhone={setCustomerPhone} />}
        {viewState === 'history' && <HistoryView setView={setView} customerName={customerName} storeSettings={storeSettings as any} />}
        {viewState === 'success' && <SuccessView setView={setView} finalOrderData={finalOrderData as any} />}
        {viewState === 'split' && <SplitView setView={setView} cart={cart as any} totals={cartTotal} customerName={customerName} setFinalOrderData={setFinalOrderData as any} setCart={setCart as any} tableNumber={tableNumber} splitConfig={splitConfig} setSplitConfig={setSplitConfig} />}

        {/* Modal / Sheet Component */}
        {selectedItem && (
          <MenuDetailSheet
            item={selectedItem}
            hideImage={hidePhotoInSheet}
            onClose={() => setSelectedItem(null)}
            onAdd={addToCart}
            onDirectBuy={directBuy}
          />
        )}

        <CustomerInfoModal
          isOpen={showCustomerModal}
          onClose={() => setShowCustomerModal(false)}
          onSubmit={handleCustomerInfoSubmit}
          initialCustomerName={customerName}
          initialTableNumber={tableNumber}
          initialCustomerPhone={customerPhone}
          storeSettings={storeSettings}
        />

        {/* Floating Cart & Navigation */}
        {['menu', 'tracking', 'others', 'landing'].includes(viewState) && tableNumber && (
          <>
            {cart.length > 0 && viewState !== 'tracking' && viewState !== 'landing' && viewState !== 'others' && (
              <div className="fixed bottom-[88px] left-0 right-0 z-40 px-4 md:px-8 pointer-events-none flex justify-center animate-in slide-in-from-bottom-8 fade-in duration-300">
                {/* Pembungkus Cart Floating dengan lebar maksimal terkontrol agar tidak terlalu panjang di Desktop */}
                <div className="w-full max-w-md md:max-w-xl pointer-events-auto px-2">
                  <button
                    onClick={() => setView('checkout')}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white p-3.5 px-5 rounded-[1.5rem] flex items-center justify-between active:scale-[0.98] transition-all border border-blue-500/50"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="relative">
                        <div className="bg-white/20 p-2.5 rounded-full backdrop-blur-md">
                          <ShoppingBag size={20} strokeWidth={2} />
                        </div>
                        <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white text-[10px] min-w-[22px] h-[22px] px-1 flex items-center justify-center rounded-full font-black border-2 border-blue-600 shadow-sm">
                          {cart.reduce((a: number, b: CartItem) => a + b.qty, 0)}
                        </span>
                      </div>
                      <div className="text-left">
                        <p className="text-[10px] font-semibold text-blue-200 uppercase tracking-wider mb-0.5">Total Pesanan</p>
                        <p className="font-extrabold text-base leading-none">{FORMAT_IDR(cartTotal.total)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-sm font-bold bg-white/10 px-3 py-2 rounded-xl hover:bg-white/20 transition-colors">
                      Checkout <ChevronRight size={18} strokeWidth={2.5} />
                    </div>
                  </button>
                </div>
              </div>
            )}

            <BottomNav currentView={viewState} setView={setView} />
          </>
        )}
      </div>
    </div>
  );
}
