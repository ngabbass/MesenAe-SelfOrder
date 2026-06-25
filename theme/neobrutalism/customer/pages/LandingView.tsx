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
        <div className="bg-white border-b-4 border-black p-6 pt-10 pb-12 h-[168px] animate-pulse relative overflow-hidden">
          <div className="flex justify-between items-start relative z-10">
            <div className="space-y-3">
              <div className="h-4 w-32 bg-slate-200 rounded-none border border-black" />
              <div className="h-8 w-48 bg-slate-200 rounded-none border-2 border-black" />
            </div>
            <div className="w-11 h-11 bg-slate-200 rounded-none border-2 border-black" />
          </div>
        </div>

        {/* Floating Card Skeleton */}
        <div className="px-6 -mt-8 relative z-20 mb-4">
          <div className="bg-white dark:bg-slate-900 border-2 border-black dark:border-slate-700 p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_#374151] flex items-center justify-between animate-pulse">
            <div className="flex items-center gap-4">
              <div className="w-[52px] h-[52px] bg-slate-200 dark:bg-slate-800 border-2 border-black dark:border-slate-700" />
              <div className="space-y-2">
                <div className="h-3 w-20 bg-slate-200 rounded-none" />
                <div className="h-5 w-32 bg-slate-200 rounded-none border border-black" />
              </div>
            </div>
            <div className="w-10 h-10 bg-slate-200 border-2 border-black" />
          </div>
        </div>

        <div className="px-6 space-y-5">
          {/* Categories skeleton */}
          <div>
            <div className="h-6 w-36 bg-slate-200 animate-pulse rounded-none border border-black mb-2.5" />
            <div className="flex space-x-3.5 overflow-hidden pb-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="flex flex-col items-center space-y-2.5 min-w-[76px]">
                  <div className="w-[4.5rem] h-[4.5rem] bg-slate-200 border-2 border-black animate-pulse" />
                  <div className="h-3 w-12 bg-slate-200 animate-pulse" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const catColors = ['bg-[#ffc700]', 'bg-[#ff90e8]', 'bg-[#a3e635]', 'bg-[#3bf4fb]', 'bg-[#ffc700]'];

  return (
    <div className={`flex-1 overflow-y-auto ${isEmbedded ? 'pb-4' : 'pb-20'} bg-transparent font-sans animate-in fade-in duration-500 relative`}>
      
      {/* Hero Header Section */}
      <div className="px-5 pt-6 pb-12 relative z-10 border-b-2 border-black dark:border-slate-700 bg-[#fffdf0] dark:bg-slate-900">
        <div className="flex justify-between items-center mb-0">
          <div className="space-y-1">
            <h1 className="text-2xl md:text-3xl font-black text-black dark:text-white uppercase tracking-tight">
              {customerName ? `Halo, ${customerName}!` : 'Mau pesan apa?'}
            </h1>
            <p className="text-slate-600 dark:text-slate-400 text-xs font-black uppercase">Sajian terbaik menanti Anda</p>
          </div>
          
          <button 
            onClick={() => setIsDarkMode(!isDarkMode)} 
            className="w-10 h-10 border-2 border-black dark:border-slate-700 bg-[#ffc700] hover:bg-[#ffe066] flex items-center justify-center text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_#374151] hover:translate-x-[0.5px] hover:translate-y-[0.5px] hover:shadow-[1.5px_1.5px_0px_0px_rgba(0,0,0,1)] dark:hover:shadow-[1.5px_1.5px_0px_0px_#374151] transition-all shrink-0 active:scale-95"
            aria-label="Toggle Dark Mode"
          >
            {isDarkMode ? <Sun size={20} className="text-black" strokeWidth={3} /> : <Moon size={20} className="text-black" strokeWidth={3} />}
          </button>
        </div>
      </div>

      {/* Floating Card: Posisi/Meja (Neobrutalism) */}
      <div className="px-5 -mt-6 relative z-20 mb-6">
        <div className="bg-white dark:bg-slate-900 border-2 border-black dark:border-slate-700 p-4 shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] dark:shadow-[5px_5px_0px_0px_#374151] flex items-center justify-between cursor-pointer group transition-all active:translate-x-[1.5px] active:translate-y-[1.5px] active:shadow-none" onClick={() => setView('others')}>
          <div className="flex items-center gap-3">
            <div className="w-[46px] h-[46px] border-2 border-black dark:border-slate-700 bg-[#ffc700] flex items-center justify-center text-black shrink-0 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_#374151]">
              <Store size={22} strokeWidth={3} />
            </div>
            <div>
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Lokasi Toko</p>
              <h2 className="text-[15px] font-black text-black dark:text-white uppercase leading-none truncate">{storeName}</h2>
              {tableNumber && (
                <div className="flex items-center gap-1 mt-1 text-black dark:text-white text-[10px] font-black uppercase">
                  <MapPin size={12} strokeWidth={3} />
                  <span className="bg-[#ffc700] px-1.5 py-0.5 border border-black text-black text-[9px]">
                    {String(tableNumber).toLowerCase() === 'bawa pulang' ? 'Takeaway' : `Meja ${parseTableNumber(String(tableNumber))}`}
                  </span>
                </div>
              )}
            </div>
          </div>
          <div className="w-8 h-8 border-2 border-black dark:border-slate-700 bg-white dark:bg-slate-800 text-black dark:text-white flex items-center justify-center shadow-[1.5px_1.5px_0px_0px_rgba(0,0,0,1)] dark:shadow-[1.5px_1.5px_0px_0px_#374151] group-hover:bg-[#ffc700] transition-colors shrink-0">
            <ArrowRight size={16} strokeWidth={3} />
          </div>
        </div>
      </div>

      <div className="px-5 space-y-6">
        
        {/* Banner Promo Spesial */}
        {displayOffers.length > 0 ? (
          <div>
            <div className="flex justify-between items-end mb-3">
              <h3 className="font-black text-sm uppercase tracking-wider bg-[#ff90e8] border-2 border-black dark:border-slate-700 inline-block px-2.5 py-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_#374151] rounded-xl">
                Penawaran Menarik
              </h3>
            </div>

            <div className="-mx-5">
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
                          className="w-full aspect-[21/9] md:aspect-[32/9] border-2 border-black dark:border-slate-700 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_#374151] rounded-2xl overflow-hidden bg-white dark:bg-slate-900"
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
                        className={`h-2.5 rounded-full border border-black transition-all duration-300 ${i === activeDotIndex ? 'w-6 bg-black dark:bg-[#ffc700]' : 'w-2.5 bg-white'}`}
                        aria-label={`Go to slide ${i + 1}`}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="px-4 md:px-6">
                  <PromoBanner
                    banner={displayOffers[0]}
                    className="w-full aspect-[21/9] md:aspect-[32/9] border-2 border-black dark:border-slate-700 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] rounded-2xl overflow-hidden bg-white dark:bg-slate-900"
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
              <h3 className="font-black text-sm uppercase tracking-wider bg-[#ff90e8] border-2 border-black dark:border-slate-700 inline-block px-2.5 py-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_#374151] rounded-xl">
                Promo Menarik
              </h3>
            </div>
            <div className="-mx-5 px-4 md:px-6">
              <PromoBanner
                banner={{ id: -1, title: 'Diskon Spesial', description: 'Gunakan promo menarik dari kami untuk pesanan Anda hari ini.', imageUrl: '', isActive: true }}
                className="w-full aspect-[21/9] md:aspect-[32/9] border-2 border-black dark:border-slate-700 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] rounded-2xl overflow-hidden bg-white dark:bg-slate-900"
                onAction={() => setView('menu')}
                priority={true}
              />
            </div>
          </div>
        )}

        {/* Quick Categories (Neobrutalism) */}
        <div>
          <h3 className="font-black text-sm uppercase tracking-wider bg-[#a3e635] border-2 border-black dark:border-slate-700 inline-block px-2.5 py-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_#374151] mb-4 rounded-xl">
            Kategori Pilihan
          </h3>
          <div className="flex space-x-3.5 overflow-x-auto pb-3 custom-scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {categories.map((cat, index) => {
              const bgColor = catColors[index % catColors.length];
              return (
                <button 
                  key={cat.id}
                  onClick={() => {
                    setSelectedCategory?.(cat.id.toString());
                    setView('menu');
                  }}
                  className="flex flex-col items-center space-y-1.5 min-w-[72px] group"
                >
                  <div className={`w-[3.25rem] h-[3.25rem] md:w-[4rem] md:h-[4rem] border-2 border-black dark:border-slate-700 ${bgColor} flex items-center justify-center text-black transition-all duration-200 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_#374151] group-active:translate-x-[1px] group-active:translate-y-[1px] group-active:shadow-none`}>
                    {cat.icon || <Package size={20} strokeWidth={2.5} />}
                  </div>
                  <span className="text-[10px] font-black uppercase text-black dark:text-white text-center w-full truncate px-1">
                    {cat.name}
                  </span>
                </button>
              );
            })}
            
            <button 
              onClick={() => {
                setSelectedCategory?.('all');
                setView('menu');
              }}
              className="flex flex-col items-center space-y-1.5 min-w-[72px] group"
            >
              <div className="w-[3.25rem] h-[3.25rem] md:w-[4rem] md:h-[4rem] border-2 border-black dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-center text-black dark:text-white transition-all duration-200 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_#374151] group-active:translate-x-[1px] group-active:translate-y-[1px] group-active:shadow-none">
                <Store size={20} strokeWidth={2.5} />
              </div>
              <span className="text-[10px] font-black uppercase text-black dark:text-white text-center w-full">
                Semua
              </span>
            </button>
          </div>
        </div>

        {/* Populer / Rekomendasi (Neobrutalism) */}
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-black text-sm uppercase tracking-wider bg-[#3bf4fb] border-2 border-black dark:border-slate-700 inline-block px-2.5 py-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_#374151]">
              <Flame size={16} strokeWidth={3} className="inline-block mr-1 text-black" /> Produk Favorit
            </h3>
            <button onClick={() => setView('menu')} className="text-[10px] font-black uppercase tracking-wide bg-white dark:bg-slate-800 border-2 border-black dark:border-slate-700 px-2.5 py-1 shadow-[1.5px_1.5px_0px_0px_rgba(0,0,0,1)] dark:shadow-[1.5px_1.5px_0px_0px_#374151] hover:translate-x-[0.5px] hover:translate-y-[0.5px] active:scale-95 transition-all text-black dark:text-white">
              Lihat Semua
            </button>
          </div>
          
          <div className="flex space-x-4 mt-2 overflow-x-auto pb-4 snap-x snap-mandatory custom-scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {sortedProducts.slice(0, 10).map((item) => {
              const isOutOfStock = item.stock <= 0;
              
              return (
                <div 
                  key={item.id} 
                  onClick={() => {
                    if (isOutOfStock) return;
                    setSelectedItem(item);
                  }}
                  className={`border-2 border-black dark:border-slate-700 bg-white dark:bg-slate-900 p-2.5 transition-all duration-200 shrink-0 snap-start w-[140px] sm:w-[160px] md:w-[180px] lg:w-[200px] group relative ${
                    isOutOfStock 
                      ? 'opacity-60 grayscale cursor-not-allowed' 
                      : 'shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_#374151] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:hover:shadow-[3px_3px_0px_0px_#374151] cursor-pointer'
                  }`}
                >
                  <div className="h-28 border-2 border-black bg-slate-50 mb-2.5 overflow-hidden relative flex items-center justify-center">
                    {item.photo ? (
                      <img src={cldThumb(item.photo)} alt={item.name} loading="lazy" decoding="async" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <ImageIcon size={28} className="text-black" />
                    )}
                    
                    {/* Badge Status */}
                    {isOutOfStock && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10">
                        <span className="text-white text-[9px] font-black bg-red-600 border border-black px-2 py-1 uppercase tracking-wider">
                          Habis
                        </span>
                      </div>
                    )}
                  </div>
                  
                  <div className="px-0.5 relative z-10">
                    <h4 className="font-black text-[12px] uppercase tracking-tight text-black dark:text-white line-clamp-2 mb-1 leading-snug">
                      {item.name}
                    </h4>
                    <div className="flex items-center justify-between gap-1 mt-2">
                      <p className="text-black dark:text-[#ffc700] font-black text-[12px] bg-[#ffc700] dark:bg-black px-1.5 py-0.5 border border-black">
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
                          className="w-7 h-7 bg-[#ffc700] border-2 border-black dark:border-slate-700 flex items-center justify-center text-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] dark:shadow-[1px_1px_0px_0px_#374151] active:translate-x-[0.5px] active:translate-y-[0.5px] active:shadow-none transition-all shrink-0"
                        >
                          <Plus size={14} strokeWidth={3} />
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
