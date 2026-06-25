import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { ShoppingBag, ChevronRight, Database, AlertCircle, Menu as MenuIcon, Home, Coffee, User, X, ClipboardList, MapPin, Store, Sun, Moon } from 'lucide-react';
import { requestForToken, onForegroundMessage } from '@/lib/fcm';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';

// Pastikan module-module ini sudah mendukung atau memiliki deklarasi TypeScript
import { useDbQuery } from '@/hooks/db-hooks';
import { isDbConfigured } from '@/lib/db';
import { FORMAT_IDR, base64Decode, generateTableId, pruneOldTransactionIds, pruneOldSentWaIds, getLocalTransactionIds } from '@/lib/utils';
import { useThemeColor } from '@/hooks/use-theme-color';
import PromoBanner from '@/components/PromoBanner';

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
  const [isNavOpen, setIsNavOpen] = useState(false);
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
  // Single-Page Unified Layout Logic & Redirects
  // ==========================================
  const banners = (useDbQuery('banners') as any[]) ?? [];
  const allTxs = (useDbQuery('transactions') || []) as any[];

  // Redirect 'landing' to 'menu' so they immediately land on the combined page
  useEffect(() => {
    if (viewState === 'landing') {
      setView('menu', true);
    }
  }, [viewState, setView]);

  const activeBanners = useMemo(() => {
    const active = banners.filter((b: any) => b.isActive !== false);
    return active.sort((a, b) => {
      if (a.order !== undefined && b.order !== undefined) return a.order - b.order;
      if (a.created_at && b.created_at) return b.created_at - a.created_at;
      return String(a.id).localeCompare(String(b.id));
    });
  }, [banners]);

  const displayOffers = useMemo(() => {
    return activeBanners;
  }, [activeBanners]);

  const [activeDotIndex, setActiveDotIndex] = useState(0);
  const carouselRef = useRef<HTMLDivElement>(null);

  const handleScroll = () => {
    if (!carouselRef.current || displayOffers.length <= 1) return;
    const scrollLeft = carouselRef.current.scrollLeft;
    const width = carouselRef.current.clientWidth;
    if (width > 0) {
      const activeIndex = Math.round(scrollLeft / width);
      setActiveDotIndex(activeIndex);
    }
  };

  const hasActiveTx = useMemo(() => {
    const localTxIds = getLocalTransactionIds().map(String);
    const activeStatusList = ['pending', 'diproses', 'siap disajikan', 'on_process', 'ready', 'unpaid'];
    return allTxs.some(tx => {
      const matchName = customerName && (tx.customer_name === customerName || tx.customerName === customerName);
      const matchId = localTxIds.includes(String(tx.id));
      const kitchen = (tx.kitchen_status || tx.kitchenStatus || 'pending').toLowerCase();
      const status = (tx.status || '').toLowerCase();
      
      const isKitchenActive = kitchen !== 'diantarkan' && kitchen !== 'selesai';
      const isStatusActive = status !== 'cancelled' && status !== 'batal' && (status === 'belum lunas' || isKitchenActive);
      
      return (matchName || matchId) && isStatusActive;
    });
  }, [allTxs, customerName]);

  const isMainView = ['menu', 'tracking', 'history', 'others', 'landing'].includes(viewState);

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
        {viewState === 'success' && <SuccessView setView={setView} finalOrderData={finalOrderData as any} />}
        {viewState === 'split' && <SplitView setView={setView} cart={cart as any} totals={cartTotal} customerName={customerName} setFinalOrderData={setFinalOrderData as any} setCart={setCart as any} tableNumber={tableNumber} splitConfig={splitConfig} setSplitConfig={setSplitConfig} />}

        {isMainView && (
          <div className="flex-1 flex flex-col overflow-y-auto bg-transparent relative pb-20">

            {/* Premium Header */}
            <div className="px-5 pt-4 pb-3 relative z-10">
              <div className="flex justify-between items-center">
                <div className="space-y-0.5">
                  <h1 className="text-2xl font-black text-slate-800 dark:text-white leading-tight">
                    {customerName ? `Halo, ${customerName}!` : 'Selamat Datang'}
                  </h1>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-bold uppercase">
                    {storeSettings?.storeName || 'Sajian Terbaik Menanti'}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      localStorage.setItem('mesenae_darkMode', (!isDarkMode).toString());
                      setIsDarkMode(!isDarkMode);
                    }}
                    className="w-10 h-10 rounded-full glass-button flex items-center justify-center transition-all hover:scale-105 active:scale-95 text-slate-700 dark:text-amber-400 shadow-sm"
                    aria-label="Toggle Dark Mode"
                  >
                    {isDarkMode ? <Sun size={20} strokeWidth={2.5} /> : <Moon size={20} strokeWidth={2.5} />}
                  </button>
                </div>
              </div>
            </div>

            {/* Location Banner (Clickable to change Customer Name/Table) */}
            <div className="px-5 relative z-10 mb-5">
              <div 
                onClick={() => setShowCustomerModal(true)}
                className="glass-panel-heavy rounded-[1.5rem] p-3.5 flex items-center justify-between cursor-pointer hover:border-amber-500/50 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all duration-300 group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-[42px] h-[42px] rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-white shadow-sm shrink-0">
                    <Store size={20} strokeWidth={2.5} />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-0.5">Lokasi / Meja</p>
                    <div className="flex items-center gap-1.5">
                      <MapPin size={12} className="text-amber-500" strokeWidth={2.5} />
                      <span className="font-extrabold text-[13px] text-slate-800 dark:text-white">
                        {String(tableNumber).toLowerCase() === 'bawa pulang' ? 'Bawa Pulang (Takeaway)' : `Meja ${tableNumber}`}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="w-8 h-8 rounded-full glass-button flex items-center justify-center text-slate-400 dark:text-slate-500 group-hover:bg-amber-500 group-hover:text-white shrink-0 transition-all duration-300">
                  <ChevronRight size={16} strokeWidth={2.5} />
                </div>
              </div>
            </div>

            {/* Promo Banner Carousel */}
            {displayOffers.length > 0 && (
              <div className="mb-6 relative z-10">
                <div className="px-6 flex justify-between items-end mb-2.5">
                  <h3 className="font-black text-base tracking-tight text-slate-800 dark:text-white">Penawaran Spesial</h3>
                </div>

                <div className="relative">
                  <div
                    ref={carouselRef}
                    onScroll={handleScroll}
                    className="flex overflow-x-auto snap-x snap-mandatory scroll-smooth custom-scrollbar-hide"
                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                  >
                    {displayOffers.map((promo, index) => (
                      <div key={`${promo.id || index}`} className="snap-center shrink-0 w-full px-6">
                        <PromoBanner
                          banner={promo}
                          className="w-full aspect-[21/9] md:aspect-[32/9] rounded-[1.8rem] shadow-xl border border-white/20 dark:border-white/5"
                          onAction={() => setView('menu')}
                          priority={index === 0}
                        />
                      </div>
                    ))}
                  </div>

                  {displayOffers.length > 1 && (
                    <div className="flex justify-center gap-1.5 mt-3">
                      {displayOffers.map((_, i) => (
                        <button
                          key={i}
                          onClick={() => {
                            if (!carouselRef.current) return;
                            const width = carouselRef.current.clientWidth;
                            carouselRef.current.scrollTo({ left: i * width, behavior: 'smooth' });
                            setActiveDotIndex(i);
                          }}
                          className={`h-1.5 rounded-full transition-all duration-300 ${
                            i === activeDotIndex ? 'w-5 bg-amber-500 shadow-md shadow-amber-500/30' : 'w-1.5 bg-slate-300 dark:bg-slate-700'
                          }`}
                          aria-label={`Go to slide ${i + 1}`}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Centered Segmented Navbar */}
            <div className="px-6 py-2 sticky top-0 z-30 mb-4 bg-transparent">
              <div className="glass-panel-heavy rounded-[2rem] p-1.5 flex items-center justify-between">
                {[
                  { id: 'menu', label: 'Daftar Menu', icon: Coffee },
                  { id: 'tracking', label: 'Lacak Order', icon: ClipboardList, badge: hasActiveTx },
                  { id: 'others', label: 'Profil & CS', icon: User }
                ].map((tab) => {
                  const isActive = (tab.id === 'menu' && (viewState === 'menu' || viewState === 'landing')) ||
                                   (tab.id === 'tracking' && (viewState === 'tracking' || viewState === 'history')) ||
                                   (tab.id === 'others' && viewState === 'others');

                  const handleClick = () => {
                    if (tab.id === 'tracking') {
                      setView(hasActiveTx ? 'tracking' : 'history');
                    } else {
                      setView(tab.id);
                    }
                  };

                  return (
                    <button
                      key={tab.id}
                      onClick={handleClick}
                      className={`flex-1 py-3 px-2 rounded-[1.8rem] flex items-center justify-center gap-2 font-black text-xs sm:text-sm transition-all duration-300 relative ${
                        isActive
                          ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/30 scale-[1.02]'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      <tab.icon size={16} strokeWidth={isActive ? 2.5 : 2} />
                      <span className="hidden xs:inline">{tab.label}</span>
                      <span className="xs:hidden">{tab.label.split(' ')[0]}</span>
                      
                      {tab.badge && (
                        <span className="absolute top-2 right-4 w-2.5 h-2.5 rounded-full bg-rose-500 border-2 border-white dark:border-slate-900 animate-pulse" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Embedded Views Panel (with a nice entry animation) */}
            <div className="px-2 relative z-10">
              <AnimatePresence mode="wait">
                <motion.div
                  key={viewState}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.25, ease: 'easeInOut' }}
                  className="w-full"
                >
                  {(viewState === 'menu' || viewState === 'landing') && (
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
                      isEmbedded={true}
                    />
                  )}

                  {viewState === 'tracking' && (
                    <TrackingView
                      setView={setView}
                      finalOrderData={finalOrderData as any}
                      tableNumber={tableNumber}
                      storeSettings={storeSettings as any}
                      customerName={customerName}
                      isEmbedded={true}
                    />
                  )}

                  {viewState === 'history' && (
                    <HistoryView
                      setView={setView}
                      customerName={customerName}
                      storeSettings={storeSettings as any}
                      isEmbedded={true}
                    />
                  )}

                  {viewState === 'others' && (
                    <OthersView
                      setView={setView}
                      storeSettings={storeSettings as any}
                      tableNumber={tableNumber}
                      customerName={customerName}
                      customerPhone={customerPhone}
                      setCustomerName={setCustomerName}
                      setCustomerPhone={setCustomerPhone}
                      isEmbedded={true}
                    />
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        )}

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

        {/* Floating Cart Button (No more old Switcher FAB!) */}
        {isMainView && tableNumber && (
          <>
            {cart.length > 0 && (viewState === 'menu' || viewState === 'landing') && (
              <div className="fixed bottom-6 md:bottom-10 left-1/2 -translate-x-1/2 z-40 px-6 w-full max-w-md pointer-events-none flex justify-center animate-in slide-in-from-bottom-8 fade-in duration-300">
                <div className="w-full pointer-events-auto">
                  <button
                    onClick={() => setView('checkout')}
                    className="w-full glass-panel-heavy text-slate-800 dark:text-white p-4 px-6 rounded-[2.2rem] flex items-center justify-between active:scale-[0.98] transition-all border border-amber-500/30 relative overflow-hidden group"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-amber-500/20 to-orange-500/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="flex items-center gap-4 relative z-10">
                      <div className="relative">
                        <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white p-3 rounded-full shadow-md shadow-amber-500/20">
                          <ShoppingBag size={20} strokeWidth={2.5} />
                        </div>
                        <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white text-[10px] min-w-[22px] h-[22px] px-1 flex items-center justify-center rounded-full font-black border-2 border-white dark:border-slate-900 shadow-md">
                          {cart.reduce((a: number, b: CartItem) => a + b.qty, 0)}
                        </span>
                      </div>
                      <div className="text-left">
                        <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-0.5">Keranjang Belanja</p>
                        <p className="font-black text-lg leading-none text-slate-800 dark:text-white">{FORMAT_IDR(cartTotal.total)}</p>
                      </div>
                    </div>
                    <div className="relative z-10 flex items-center gap-1 text-xs font-black bg-slate-950 dark:bg-white/10 px-4 py-2.5 rounded-[1.2rem] text-amber-500 dark:text-amber-400 uppercase tracking-widest hover:scale-105 active:scale-95 transition-all">
                      Bayar <ChevronRight size={16} strokeWidth={3} />
                    </div>
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
