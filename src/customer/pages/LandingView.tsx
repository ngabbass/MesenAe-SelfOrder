import React, { JSX, useState, useEffect, useRef } from 'react';
import { 
  MapPin, Flame, Moon, Sun, Gift, Package, 
  Image as ImageIcon, ArrowRight, Store, Plus, Minus
} from 'lucide-react';
import { toast } from 'sonner';
import PromoBanner from '@/components/PromoBanner';

import { FORMAT_IDR, cn, parseTableNumber } from '@/lib/utils';
import { useDbQuery } from '@/hooks/db-hooks';
import { cldThumb } from '@/lib/cld';


// ==========================================
// Tipe Data & Interfaces (TypeScript)
// ==========================================

export interface StoreSettings {
  storeName?: string;
  [key: string]: any;
}

export interface CategoryItem {
  id: number | string;
  name: string;
  icon?: string | JSX.Element;
  [key: string]: any;
}

export interface ProductItem {
  id: number | string;
  categoryId: number;
  name: string;
  stock: number;
  price: number;
  photo?: string;
  [key: string]: any;
}

export interface VoucherItem {
  id: number | string;
  isActive?: boolean;
  is_active?: boolean;
  type: 'percentage' | 'fixed';
  value: number;
  description?: string;
  desc?: string;
  [key: string]: any;
}

export interface LandingViewProps {
  setView: (view: string) => void;
  customerName: string;
  isDarkMode: boolean;
  setIsDarkMode: (darkMode: boolean) => void;
  tableNumber: string | number | null;
  setSelectedItem: (item: ProductItem, hidePhoto?: boolean) => void;
  addToCart?: (item: any, qty: number, notes: string, variants: any[]) => void;
  cartLength?: number;
  setSelectedCategory?: (category: string) => void;
  cart?: any[];
  updateCartQty?: (cartId: number, delta: number) => void;
}

export default function LandingView({
  setView,
  customerName,
  isDarkMode,
  setIsDarkMode,
  tableNumber,
  setSelectedItem,
  addToCart,
  cartLength = 0,
  setSelectedCategory,
  cart,
  updateCartQty,
}: LandingViewProps): JSX.Element {
  
  // Mengambil data dengan asersi tipe (Type Assertion) yang aman
  const storeSettingsList = (useDbQuery('storeSettings') as StoreSettings[]) ?? [];
  const dbCategories = (useDbQuery('categories') as CategoryItem[]) ?? [];
  const categories = React.useMemo(() => {
    return [...dbCategories].sort((a, b) => {
      if (a.order !== undefined && b.order !== undefined) return a.order - b.order;
      if (a.createdAt && b.createdAt) return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return String(a.id).localeCompare(String(b.id));
    });
  }, [dbCategories]);
  const products = (useDbQuery('products') as ProductItem[]) ?? [];
  const vouchers = (useDbQuery('vouchers') as VoucherItem[]) ?? [];
  const banners = (useDbQuery('banners') as any[]) ?? [];
  const transactionItems = (useDbQuery('transaction_items') as any[]) ?? [];

  const storeSettings = storeSettingsList[0] || null;
  const activeVouchers = vouchers.filter((v) => {
    const isActive = v.isActive || v.is_active;
    const isShown = v.showInCustomerApp !== false && v.show_in_customer_app !== false;
    return isActive && isShown;
  });
  
  // Hitung jumlah pembelian tiap produk
  const productSales = React.useMemo(() => {
    const sales: Record<string, number> = {};
    transactionItems.forEach(item => {
      const pid = String(item.product_id);
      sales[pid] = (sales[pid] || 0) + (Number(item.quantity) || 0);
    });
    return sales;
  }, [transactionItems]);

  // Urutkan produk berdasarkan penjualan terbanyak (Produk Favorit)
  const sortedProducts = React.useMemo(() => {
    if (Object.keys(productSales).length === 0) {
      return products;
    }
    return [...products].sort((a, b) => {
      const salesA = productSales[String(a.id)] || 0;
      const salesB = productSales[String(b.id)] || 0;
      if (salesB !== salesA) return salesB - salesA;
      return String(a.id).localeCompare(String(b.id)); // Fallback
    });
  }, [products, productSales]);
  const [loading, setLoading] = useState(() => {
    if (typeof window === 'undefined') return true;
    return sessionStorage.getItem('mesenae_landing_cached') !== 'true';
  });
  
  useEffect(() => {
    if (loading) {
      if (categories.length > 0 || products.length > 0) {
        setLoading(false);
        sessionStorage.setItem('mesenae_landing_cached', 'true');
      }
      // Timeout fallback for empty database (prevent infinite skeleton)
      const timer = setTimeout(() => {
        setLoading(false);
        sessionStorage.setItem('mesenae_landing_cached', 'true');
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [loading, categories.length, products.length]);

  const storeName = storeSettings?.storeName || 'Toko Kami';

  // Ambil Banners dari koleksi banners terpisah
  const activeBanners = React.useMemo(() => {
    const active = banners.filter((b: any) => b.isActive !== false);
    return active.sort((a, b) => {
      if (a.order !== undefined && b.order !== undefined) return a.order - b.order;
      if (a.created_at && b.created_at) return b.created_at - a.created_at;
      return a.id.localeCompare(b.id);
    });
  }, [banners]);

  const displayOffers = React.useMemo(() => {
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

  // Render Skeleton saat Kondisi Loading
  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto pb-32 bg-slate-50 dark:bg-slate-950 font-sans animate-in fade-in duration-300">
        {/* Hero Section Skeleton */}
        <div className="bg-slate-200 dark:bg-slate-800 rounded-b-[2.5rem] p-6 pt-10 pb-12 h-[168px] animate-pulse relative overflow-hidden">
          <div className="flex justify-between items-start relative z-10">
            <div className="space-y-3">
              <div className="h-4 w-32 bg-white/40 dark:bg-white/10 rounded-full" />
              <div className="h-8 w-48 bg-white/40 dark:bg-white/10 rounded-full" />
              <div className="h-3 w-64 bg-white/40 dark:bg-white/10 rounded-full hidden sm:block" />
            </div>
            <div className="w-11 h-11 bg-white/40 dark:bg-white/10 rounded-full" />
          </div>
        </div>

        {/* Floating Card Skeleton */}
        <div className="px-6 -mt-8 relative z-20 mb-4">
          <div className="bg-white dark:bg-slate-900 rounded-[1.5rem] p-4 shadow-xl flex items-center justify-between border border-slate-100 dark:border-slate-800 animate-pulse">
            <div className="flex items-center gap-4">
              <div className="w-[52px] h-[52px] rounded-2xl bg-slate-200 dark:bg-slate-800" />
              <div className="space-y-2">
                <div className="h-3 w-20 bg-slate-200 dark:bg-slate-800 rounded-full" />
                <div className="h-5 w-32 bg-slate-200 dark:bg-slate-800 rounded-full" />
              </div>
            </div>
            <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-800" />
          </div>
        </div>

        <div className="px-6 space-y-5">
          {/* Promo banner skeleton */}
          <div>
            <div className="flex justify-between items-end mb-2">
              <div className="h-6 w-40 bg-slate-200 dark:bg-slate-800 animate-pulse rounded-full" />
            </div>
            <div className="-mx-6 px-4 md:px-6">
              <div className="w-full aspect-[21/9] md:aspect-[32/9] bg-slate-200 dark:bg-slate-800 animate-pulse rounded-3xl" />
            </div>
          </div>
          
          {/* Categories skeleton */}
          <div>
            <div className="h-6 w-36 bg-slate-200 dark:bg-slate-800 animate-pulse rounded-full mb-2.5" />
            <div className="flex space-x-3.5 overflow-hidden pb-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="flex flex-col items-center space-y-2.5 min-w-[76px]">
                  <div className="w-[4.5rem] h-[4.5rem] rounded-[1.2rem] bg-slate-200 dark:bg-slate-800 animate-pulse border border-slate-100 dark:border-slate-800" />
                  <div className="h-3 w-12 bg-slate-200 dark:bg-slate-800 animate-pulse rounded-full" />
                </div>
              ))}
            </div>
          </div>
          
          {/* Products skeleton */}
          <div>
            <div className="flex justify-between items-center mb-2.5 text-slate-900">
              <div className="h-6 w-40 bg-slate-200 dark:bg-slate-800 animate-pulse rounded-full" />
              <div className="h-4 w-20 bg-slate-200 dark:bg-slate-800 animate-pulse rounded-full" />
            </div>
            <div className="flex space-x-3.5 mt-2 overflow-hidden pb-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-white dark:bg-slate-900 rounded-[1.5rem] p-3 border border-slate-100 dark:border-slate-800 shrink-0 w-[150px] sm:w-[180px] md:w-[200px] lg:w-[220px]">
                  <div className="h-32 rounded-xl bg-slate-200 dark:bg-slate-800 mb-3 animate-pulse" />
                  <div className="px-1 space-y-3">
                    <div className="h-4 w-3/4 bg-slate-200 dark:bg-slate-800 animate-pulse rounded-full" />
                    <div className="flex justify-between items-end gap-2">
                      <div className="h-4 w-1/2 bg-slate-200 dark:bg-slate-800 animate-pulse rounded-full" />
                      <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-800 animate-pulse" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto pb-32 bg-slate-50 dark:bg-slate-950 font-sans animate-in fade-in duration-300">
      
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-b-[2.5rem] p-6 pt-10 pb-12 text-white relative overflow-hidden shadow-md">
        {/* Dekorasi Latar */}
        <div className="absolute top-[-20%] right-[-10%] w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-[-20%] left-[-10%] w-48 h-48 bg-blue-400/20 rounded-full blur-2xl"></div>
        
        <div className="flex justify-between items-start relative z-10">
          <div className="space-y-1">
            <p className="text-blue-100/90 text-sm font-medium flex items-center gap-1.5">
              Halo, {customerName || 'Tamu'} <span className="animate-wave origin-bottom-right inline-block">👋</span>
            </p>
            <h2 className="text-3xl font-extrabold tracking-tight leading-tight mb-2">
              {storeName}
            </h2>
            <p className="text-sm text-blue-100/80 max-w-xs leading-relaxed hidden sm:block">
              Pilih produk dan layanan favorit Anda langsung dari tempat Anda tanpa perlu antre panjang.
            </p>
          </div>
          
          <button 
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="p-3 bg-white/10 hover:bg-white/20 rounded-full backdrop-blur-md border border-white/10 transition-all active:scale-95"
            aria-label="Toggle Tema"
          >
            {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>
      </div>

      {/* Floating Card: Posisi/Meja */}
      <div className="px-6 -mt-8 relative z-20 mb-4">
        <div className="bg-white dark:bg-slate-900 rounded-[1.5rem] p-4 shadow-xl shadow-slate-200/50 dark:shadow-slate-900/50 flex items-center justify-between border border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-4">
            <div className="bg-blue-50 dark:bg-blue-500/10 p-3.5 rounded-2xl text-blue-600 dark:text-blue-400">
              <MapPin size={24} strokeWidth={2} />
            </div>
            <div>
              {(() => {
                const parsedTable = parseTableNumber(tableNumber);
                return (
                  <>
                    <p className="text-[11px] uppercase font-bold tracking-widest text-slate-400 dark:text-slate-500 mb-1">
                      {parsedTable.isTakeAway ? 'Tipe Pesanan' : 'Lokasi Anda'}
                    </p>
                    <div className="flex items-center gap-2 flex-wrap mt-1">
                      {parsedTable.isTakeAway ? (
                        <p className="font-extrabold text-base text-slate-800 dark:text-white leading-none">
                          Take Away (Bawa Pulang)
                        </p>
                      ) : (
                        <div className="flex items-center gap-2 mt-1">
                          <span className="inline-flex items-center gap-1 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border border-blue-200/60 dark:border-blue-900/40 text-blue-700 dark:text-blue-300 text-[10px] sm:text-xs font-extrabold px-3 py-1.5 rounded-xl shadow-sm tracking-wide uppercase leading-none">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                            {parsedTable.area}
                          </span>
                          <span className="inline-flex items-center bg-slate-900 dark:bg-slate-800 border border-slate-950 dark:border-slate-700 text-white text-[11px] sm:text-xs font-black px-3.5 py-1.5 rounded-xl shadow-md tracking-wide uppercase leading-none">
                            {/^\d+$/.test(parsedTable.table) ? `Meja ${parsedTable.table}` : parsedTable.table}
                          </span>
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
          <button 
            onClick={() => setView('menu')}
            className="w-10 h-10 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-600 dark:text-slate-300 transition-colors"
          >
            <ArrowRight size={18} />
          </button>
        </div>
      </div>

      <div className="px-6 space-y-5">
        
        {/* Banner Promo Spesial */}
        {displayOffers.length > 0 ? (
          <div>
            {/* Section title — stays in normal flow padding */}
            <div className="flex justify-between items-end mb-2">
              <h3 className="font-extrabold text-lg tracking-tight text-slate-900 dark:text-white">Penawaran Menarik</h3>
            </div>

            {/* Break out of px-6 container: -mx-6 cancels parent padding */}
            <div className="-mx-6">
              {displayOffers.length > 1 ? (
                <div className="relative">
                  {/* Carousel track */}
                  <div
                    ref={carouselRef}
                    onScroll={handleScroll}
                    className="flex w-full overflow-x-auto snap-x snap-mandatory scroll-smooth custom-scrollbar-hide"
                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                  >
                    {displayOffers.map((promo, index) => (
                      <div key={`${promo.id || index}`} className="snap-center shrink-0 w-full">
                        {/* Mobile: 21/9 with px-4 padding; Desktop: 32/9 full-bleed */}
                        <div className="px-4 md:px-6">
                          <PromoBanner
                            banner={promo}
                            className="w-full aspect-[21/9] md:aspect-[32/9] rounded-3xl shadow-lg shadow-slate-900/10"
                            onAction={() => setView('menu')}
                            priority={index === 0}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Dots */}
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
                        className={`h-1.5 rounded-full transition-all duration-300 ${i === activeDotIndex ? 'w-4 bg-blue-600' : 'w-1.5 bg-slate-300 dark:bg-slate-700'}`}
                        aria-label={`Go to slide ${i + 1}`}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                // Single banner
                <div className="px-4 md:px-6">
                  <PromoBanner
                    banner={displayOffers[0]}
                    className="w-full aspect-[21/9] md:aspect-[32/9] rounded-3xl shadow-lg shadow-slate-900/10"
                    onAction={() => setView('menu')}
                    priority={true}
                  />
                </div>
              )}
            </div>
          </div>
        ) : (
          // Fallback — no active banners
          <div>
            <div className="flex justify-between items-end mb-2">
              <h3 className="font-extrabold text-lg tracking-tight text-slate-900 dark:text-white">Promo Menarik</h3>
            </div>
            <div className="-mx-6 px-4 md:px-6">
              <PromoBanner
                banner={{ id: -1, title: 'Diskon Spesial', description: 'Gunakan promo menarik dari kami untuk pesanan Anda hari ini.', imageUrl: '', isActive: true }}
                className="w-full aspect-[21/9] md:aspect-[32/9] rounded-3xl shadow-lg shadow-slate-900/10"
                onAction={() => setView('menu')}
                priority={true}
              />
            </div>
          </div>
        )}

        {/* Quick Categories */}
        <div>
          <h3 className="font-extrabold text-lg tracking-tight mb-2.5 text-slate-900 dark:text-white">Kategori Pilihan</h3>
          <div className="flex space-x-3.5 overflow-x-auto pb-3 custom-scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {categories.map((cat) => (
              <button 
                key={cat.id}
                onClick={() => {
                  setSelectedCategory?.(cat.id.toString());
                  setView('menu');
                }}
                className="flex flex-col items-center space-y-2.5 min-w-[76px] group"
              >
                <div className="w-[4.5rem] h-[4.5rem] rounded-[1.2rem] bg-white dark:bg-slate-900 shadow-sm border border-slate-100 dark:border-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-300 transition-all group-hover:shadow-md group-hover:border-blue-200 dark:group-hover:border-blue-900 group-hover:text-blue-600 dark:group-hover:text-blue-400 group-active:scale-95">
                  {cat.icon || <Package size={26} strokeWidth={1.5} />}
                </div>
                <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 text-center w-full truncate px-1">
                  {cat.name}
                </span>
              </button>
            ))}
            
            {/* Tombol "Lihat Semua" */}
            <button 
              onClick={() => {
                setSelectedCategory?.('all');
                setView('menu');
              }}
              className="flex flex-col items-center space-y-2.5 min-w-[76px] group"
            >
              <div className="w-[4.5rem] h-[4.5rem] rounded-[1.2rem] bg-slate-50 dark:bg-slate-800/50 border border-slate-200 border-dashed dark:border-slate-700 flex items-center justify-center text-slate-500 transition-all group-active:scale-95">
                <Store size={26} strokeWidth={1.5} />
              </div>
              <span className="text-[11px] font-semibold text-slate-500 text-center w-full">
                Semua
              </span>
            </button>
          </div>
        </div>

        {/* Populer / Rekomendasi */}
        <div>
          <div className="flex justify-between items-center mb-2.5">
            <h3 className="font-extrabold text-lg tracking-tight flex items-center text-slate-900 dark:text-white">
              <Flame size={20} className="text-orange-500 mr-2 fill-orange-500/20" /> 
              Produk Favorit
            </h3>
            <button onClick={() => setView('menu')} className="text-sm font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400">
              Lihat Semua
            </button>
          </div>
          
          <div className="flex space-x-3.5 mt-2 overflow-x-auto pb-4 snap-x snap-mandatory custom-scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {sortedProducts.slice(0, 10).map((item) => {
              const isOutOfStock = item.stock <= 0;
              
              return (
                <div 
                  key={item.id} 
                  onClick={() => {
                  if (isOutOfStock) return;
                  // Klik pada kartu selalu membuka modal produk
                  setSelectedItem(item);
                }}
                  className={`bg-white dark:bg-slate-900 rounded-[1.5rem] p-3 border transition-all shrink-0 snap-start w-[150px] sm:w-[180px] md:w-[200px] lg:w-[220px] ${
                    isOutOfStock 
                      ? 'border-slate-100 dark:border-slate-800 opacity-60 grayscale' 
                      : 'border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-blue-200 dark:hover:border-blue-900 cursor-pointer active:scale-[0.98]'
                  }`}
                >
                  <div className="h-32 rounded-xl bg-slate-100 dark:bg-slate-800 mb-3 overflow-hidden relative flex items-center justify-center">
                    {item.photo ? (
                      <img src={cldThumb(item.photo)} alt={item.name} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon size={32} strokeWidth={1.5} className="text-slate-300 dark:text-slate-600" />
                    )}
                    
                    {/* Badge Status */}
                    <div className="absolute top-2 left-2 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md px-2 py-1 rounded-md text-[9px] font-bold tracking-wide uppercase shadow-sm">
                      {isOutOfStock ? (
                        <span className="text-slate-600 dark:text-slate-400">Habis</span>
                      ) : (
                        <span className="text-blue-600 dark:text-blue-400">Tersedia</span>
                      )}
                    </div>
                  </div>
                  
                  <div className="px-1">
                    <h4 className="font-bold text-sm text-slate-900 dark:text-white line-clamp-1 mb-1.5 leading-snug">
                      {item.name}
                    </h4>
                    <div className="flex items-center justify-between gap-1">
                      <p className="text-blue-600 dark:text-blue-400 font-extrabold text-[13px]">
                        {FORMAT_IDR(item.price)}
                      </p>
                      {!isOutOfStock && (
                        <button 
                          type="button"
                          onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                            e.stopPropagation(); // Mencegah click tembus ke card (buka modal)
                            if (isOutOfStock) return;
                            
                            if (setSelectedCategory && item.categoryId) {
                              setSelectedCategory(item.categoryId.toString());
                            }
                            setView('menu');
                            
                            // Jika ada varian, mau tidak mau buka modal
                            if ((item.variants && item.variants.length > 0) || !addToCart) {
                              setSelectedItem(item, true);
                            } else {
                              addToCart(item, 1, '', []);
                              toast.success(`${item.name} ditambahkan ke keranjang`);
                            }
                          }}
                          className="w-7 h-7 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-400 active:scale-95 active:bg-blue-50 dark:active:bg-slate-700 active:text-blue-600 transition-colors"
                        >
                          <Plus size={14} strokeWidth={2.5} className="text-blue-600 dark:text-blue-400" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      
    </div>
  );
}
