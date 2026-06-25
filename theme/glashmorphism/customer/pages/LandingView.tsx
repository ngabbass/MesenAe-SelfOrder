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
  [key: string]: unknown;
}

export interface CategoryItem {
  id: number | string;
  name: string;
  icon?: string | JSX.Element;
  [key: string]: unknown;
}

export interface ProductItem {
  id: number | string;
  categoryId: number;
  name: string;
  stock: number;
  price: number;
  photo?: string;
  [key: string]: unknown;
}

export interface VoucherItem {
  id: number | string;
  isActive?: boolean;
  is_active?: boolean;
  type: 'percentage' | 'fixed';
  value: number;
  description?: string;
  desc?: string;
  [key: string]: unknown;
}

export interface LandingViewProps {
  setView: (view: string) => void;
  customerName: string;
  isDarkMode: boolean;
  setIsDarkMode: (darkMode: boolean) => void;
  tableNumber: string | number | null;
  setSelectedItem: (item: ProductItem, hidePhoto?: boolean) => void;
  addToCart?: (item: ProductItem, qty: number, notes: string, variants: unknown[]) => void;
  cartLength?: number;
  setSelectedCategory?: (category: string) => void;
  cart?: Record<string, unknown>[];
  updateCartQty?: (cartId: number, delta: number) => void;
  isEmbedded?: boolean;
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
  isEmbedded = false,
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
  const banners = (useDbQuery('banners') as Record<string, unknown>[]) ?? [];
  const transactionItems = (useDbQuery('transaction_items') as Record<string, unknown>[]) ?? [];

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
    const active = banners.filter((b: Record<string, unknown>) => b.isActive !== false);
    return active.sort((a, b) => {
      const orderA = a.order as number | undefined;
      const orderB = b.order as number | undefined;
      const createdA = a.created_at as number | undefined;
      const createdB = b.created_at as number | undefined;
      
      if (orderA !== undefined && orderB !== undefined) return orderA - orderB;
      if (createdA && createdB) return createdB - createdA;
      return String(a.id).localeCompare(String(b.id));
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
      <div className={`flex-1 overflow-y-auto ${isEmbedded ? 'pb-4' : 'pb-20'} bg-slate-50 dark:bg-slate-950 font-sans animate-in fade-in duration-300`}>
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
    <div className={`flex-1 overflow-y-auto ${isEmbedded ? 'pb-4' : 'pb-20'} bg-transparent font-sans animate-in fade-in duration-500 relative`}>
      
      {/* Hero Header Section */}
      <div className="px-5 pt-4 pb-14 relative z-10">
        <div className="flex justify-between items-center mb-0">
          <div className="space-y-0.5">
            <h1 className="text-2xl md:text-3xl font-black text-slate-800 dark:text-white leading-tight">
              {customerName ? `Halo, ${customerName}!` : 'Mau pesan apa?'}
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-xs font-medium">Sajian terbaik menanti Anda</p>
          </div>
          
          <button 
            onClick={() => setIsDarkMode(!isDarkMode)} 
            className="w-10 h-10 rounded-full glass-button flex items-center justify-center transition-all shrink-0"
            aria-label="Toggle Dark Mode"
          >
            {isDarkMode ? <Sun size={20} className="text-amber-500" strokeWidth={2.5} /> : <Moon size={20} className="text-slate-700" strokeWidth={2.5} />}
          </button>
        </div>
      </div>

      {/* Floating Card: Posisi/Meja (Premium Glass) */}
      <div className="px-5 -mt-10 relative z-20 mb-6">
        <div className="glass-panel-heavy rounded-[1.5rem] p-4 shadow-sm flex items-center justify-between cursor-pointer group hover:border-amber-400/50 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all" onClick={() => setView('others')}>
          <div className="flex items-center gap-3">
            <div className="w-[46px] h-[46px] rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-white shadow-sm shrink-0 group-hover:scale-105 transition-transform duration-300">
              <Store size={22} strokeWidth={2} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-0.5">Lokasi</p>
              <h2 className="text-[15px] font-black text-slate-800 dark:text-white leading-tight line-clamp-1">{storeName}</h2>
              {tableNumber && (
                <div className="flex items-center gap-1 mt-1 text-amber-600 dark:text-amber-400 text-[11px] font-bold">
                  <MapPin size={12} strokeWidth={2.5} />
                  <span>{String(tableNumber).toLowerCase() === 'bawa pulang' ? 'Takeaway' : `Meja ${parseTableNumber(String(tableNumber))}`}</span>
                </div>
              )}
            </div>
          </div>
          <div className="w-9 h-9 rounded-full glass-button flex items-center justify-center text-slate-400 dark:text-slate-500 group-hover:bg-amber-500 group-hover:text-white shrink-0">
            <ArrowRight size={18} strokeWidth={2.5} />
          </div>
        </div>
      </div>

      <div className="px-5 space-y-6">
        
        {/* Banner Promo Spesial */}
        {displayOffers.length > 0 ? (
          <div>
            <div className="flex justify-between items-end mb-3">
              <h3 className="font-black text-[19px] tracking-tight text-slate-900 dark:text-white drop-shadow-sm">Penawaran Menarik</h3>
            </div>

            <div className="-mx-6">
              {displayOffers.length > 1 ? (
                <div className="relative">
                  <div
                    ref={carouselRef}
                    onScroll={handleScroll}
                    className="flex w-full overflow-x-auto snap-x snap-mandatory scroll-smooth custom-scrollbar-hide"
                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                  >
                    {displayOffers.map((promo, index) => (
                      <div key={`${promo.id || index}`} className="snap-center shrink-0 w-full px-4 md:px-6">
                        <PromoBanner
                          banner={promo}
                          className="w-full aspect-[21/9] md:aspect-[32/9] rounded-[2rem] shadow-xl shadow-amber-500/10 border border-white/20 dark:border-white/5"
                          onAction={() => setView('menu')}
                          priority={index === 0}
                        />
                      </div>
                    ))}
                  </div>

                  {/* Dots */}
                  <div className="flex justify-center gap-1.5 mt-4">
                    {displayOffers.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          if (!carouselRef.current) return;
                          const width = carouselRef.current.clientWidth;
                          carouselRef.current.scrollTo({ left: i * width, behavior: 'smooth' });
                          setActiveDotIndex(i);
                        }}
                        className={`h-1.5 rounded-full transition-all duration-500 ${i === activeDotIndex ? 'w-6 bg-amber-500 shadow-md shadow-amber-500/30' : 'w-1.5 bg-white/40 dark:bg-slate-700 backdrop-blur-md'}`}
                        aria-label={`Go to slide ${i + 1}`}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="px-4 md:px-6">
                  <PromoBanner
                    banner={displayOffers[0]}
                    className="w-full aspect-[21/9] md:aspect-[32/9] rounded-[2rem] shadow-xl shadow-amber-500/10 border border-white/20 dark:border-white/5"
                    onAction={() => setView('menu')}
                    priority={true}
                  />
                </div>
              )}
            </div>
          </div>
        ) : (
          <div>
            <div className="flex justify-between items-end mb-3">
              <h3 className="font-black text-[19px] tracking-tight text-slate-900 dark:text-white drop-shadow-sm">Promo Menarik</h3>
            </div>
            <div className="-mx-6 px-4 md:px-6">
              <PromoBanner
                banner={{ id: -1, title: 'Diskon Spesial', description: 'Gunakan promo menarik dari kami untuk pesanan Anda hari ini.', imageUrl: '', isActive: true }}
                className="w-full aspect-[21/9] md:aspect-[32/9] rounded-[2rem] shadow-xl shadow-amber-500/10 border border-white/20 dark:border-white/5"
                onAction={() => setView('menu')}
                priority={true}
              />
            </div>
          </div>
        )}

        {/* Quick Categories (Premium Glass) */}
        <div>
          <h3 className="font-black text-[19px] tracking-tight mb-3 text-slate-900 dark:text-white drop-shadow-sm">Kategori Pilihan</h3>
          <div className="flex space-x-3.5 overflow-x-auto pb-3 custom-scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {categories.map((cat) => (
              <button 
                key={cat.id}
                onClick={() => {
                  setSelectedCategory?.(cat.id.toString());
                  setView('menu');
                }}
                className="flex flex-col items-center space-y-1.5 min-w-[64px] group"
              >
                <div className="w-[3rem] h-[3rem] md:w-[4rem] md:h-[4rem] rounded-xl md:rounded-2xl glass-card flex items-center justify-center text-slate-700 dark:text-slate-300 transition-all duration-300 group-hover:bg-amber-500/10 group-hover:border-amber-400/50 group-hover:text-amber-600 dark:group-hover:text-amber-400 group-active:scale-90 shadow-sm">
                  {cat.icon || <Package size={20} strokeWidth={2} />}
                </div>
                <span className="text-[9px] md:text-[11px] font-bold text-slate-600 dark:text-slate-400 text-center w-full truncate px-1 transition-colors group-hover:text-amber-600 dark:group-hover:text-amber-400">
                  {cat.name}
                </span>
              </button>
            ))}
            
            <button 
              onClick={() => {
                setSelectedCategory?.('all');
                setView('menu');
              }}
              className="flex flex-col items-center space-y-1.5 min-w-[64px] group"
            >
              <div className="w-[3rem] h-[3rem] md:w-[4rem] md:h-[4rem] rounded-xl md:rounded-2xl bg-white/10 dark:bg-black/20 backdrop-blur-md border border-slate-200 dark:border-slate-800 border-dashed flex items-center justify-center text-slate-500 transition-all duration-300 group-hover:border-amber-500/50 group-active:scale-90">
                <Store size={20} strokeWidth={2} />
              </div>
              <span className="text-[9px] md:text-[11px] font-bold text-slate-500 text-center w-full">
                Semua
              </span>
            </button>
          </div>
        </div>

        {/* Populer / Rekomendasi (Premium Glass) */}
        <div>
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-black text-[19px] tracking-tight flex items-center text-slate-900 dark:text-white drop-shadow-sm">
              <Flame size={22} strokeWidth={2.5} className="text-amber-500 mr-2 drop-shadow-sm" /> 
              Produk Favorit
            </h3>
            <button onClick={() => setView('menu')} className="text-[13px] font-bold text-amber-600 hover:text-amber-700 dark:text-amber-400">
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
                  setSelectedItem(item);
                }}
                  className={`glass-card rounded-[1.2rem] p-2.5 border transition-all duration-300 shrink-0 snap-start w-[140px] sm:w-[160px] md:w-[180px] lg:w-[200px] group ${
                    isOutOfStock 
                      ? 'border-slate-100 dark:border-slate-800 opacity-60 grayscale cursor-not-allowed' 
                      : 'border-slate-100 dark:border-slate-800/60 hover:shadow-lg hover:-translate-y-1 cursor-pointer hover:border-amber-500/30'
                  }`}
                >
                  <div className="h-28 rounded-xl bg-slate-100 dark:bg-slate-800 mb-2.5 overflow-hidden relative flex items-center justify-center">
                    {item.photo ? (
                      <img src={cldThumb(item.photo)} alt={item.name} loading="lazy" decoding="async" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <ImageIcon size={28} strokeWidth={1.5} className="text-slate-300 dark:text-slate-600" />
                    )}
                    
                    {/* Badge Status */}
                    {isOutOfStock && (
                      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center z-10">
                        <span className="text-white text-[10px] font-extrabold bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-xl uppercase tracking-wider border border-white/10">
                          Habis
                        </span>
                      </div>
                    )}
                  </div>
                  
                  <div className="px-0.5 relative z-10">
                    <h4 className="font-bold text-[13px] text-slate-800 dark:text-slate-100 line-clamp-2 mb-1 leading-snug">
                      {item.name}
                    </h4>
                    <div className="flex items-center justify-between gap-1 mt-2">
                      <p className="text-amber-600 dark:text-amber-500 font-black text-[13px]">
                        {FORMAT_IDR(item.price)}
                      </p>
                      {!isOutOfStock && (
                        <button 
                          type="button"
                          onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                            e.stopPropagation();
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
                          className="w-7 h-7 bg-amber-50 dark:bg-amber-500/10 rounded-full flex items-center justify-center text-amber-600 dark:text-amber-500 active:scale-95 transition-transform"
                        >
                          <Plus size={16} strokeWidth={2.5} />
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
