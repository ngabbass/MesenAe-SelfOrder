import React, { ChangeEvent, JSX, useCallback, useMemo, useState, useEffect } from 'react';
import { Search, ChevronLeft, Plus, Minus, PackageOpen, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';

import { FORMAT_IDR } from '@/lib/utils';
import { useDbQuery } from '@/hooks/db-hooks';
import { cldThumb } from '@/lib/cld';

// ==========================================
// Tipe Data & Interfaces
// ==========================================

export interface CategoryItem {
  id: number | string;
  name: string;
  icon?: string;
  [key: string]: unknown;
}

export interface ProductItem {
  id: number | string;
  categoryId: number;
  name: string;
  stock: number;
  price: number;
  photo?: string;
  variants?: unknown[];
  [key: string]: unknown;
}

export interface MenuViewProps {
  setView: (view: string) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedCategory: string;
  setSelectedCategory: (category: string) => void;
  setSelectedItem: (item: ProductItem, hidePhoto?: boolean) => void;
  addToCart?: (item: ProductItem, qty: number, notes: string, variants: unknown[]) => void;
  cartLength?: number;
  cart?: Record<string, unknown>[];
  updateCartQty?: (cartId: number, delta: number) => void;
  isEmbedded?: boolean;
}

// ==========================================
// Sub-Komponen: Product Card (Memoized)
// ==========================================

interface ProductCardProps {
  item: ProductItem;
  onSelect: (item: ProductItem) => void;
  onAddToCart?: (item: ProductItem) => void;
  cartItemData: Record<string, unknown> | null; // Data keranjang dipassing O(1) dari parent
  updateCartQty?: (cartId: number, delta: number) => void;
}

const ProductCard = React.memo(({ item, onSelect, onAddToCart, cartItemData, updateCartQty }: ProductCardProps) => {
  const isOutOfStock = item.stock <= 0;
  const optimizedPhoto = useMemo(() => cldThumb(item.photo), [item.photo]);
  const qty = cartItemData ? cartItemData.qty : 0;

  const handleMinusClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (cartItemData && updateCartQty) {
      updateCartQty(cartItemData.cartId, -1);
    }
  }, [cartItemData, updateCartQty]);

  const handlePlusClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (cartItemData && updateCartQty) {
      updateCartQty(cartItemData.cartId, 1);
    }
  }, [cartItemData, updateCartQty]);

  const handleCardClick = useCallback(() => {
    if (!isOutOfStock) onSelect(item);
  }, [isOutOfStock, item, onSelect]);

  const handleAddClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (isOutOfStock) return;
    onAddToCart?.(item);
  }, [isOutOfStock, item, onAddToCart]);

  return (
    <div
      onClick={handleCardClick}
      className={`glass-card rounded-[1.2rem] overflow-hidden flex flex-col group transition-all duration-300 relative ${
        isOutOfStock
          ? 'opacity-60 grayscale cursor-not-allowed border-slate-100 dark:border-slate-800'
          : 'cursor-pointer hover:-translate-y-1 hover:shadow-lg hover:border-amber-500/30 border-slate-100 dark:border-slate-800/60'
      } border`}
    >
      {/* Container Gambar */}
      <div className="aspect-[4/3] w-full relative flex-shrink-0 bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden">
        {optimizedPhoto ? (
          <img
            src={optimizedPhoto}
            alt={item.name}
            loading="lazy"
            decoding="async"
            width="300"
            height="300"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
          />
        ) : (
          <ImageIcon size={32} strokeWidth={1.5} className="text-slate-300 dark:text-slate-600" />
        )}
        
        {/* Badge Status Stok */}
        {isOutOfStock && (
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center z-10">
            <span className="text-white text-[10px] font-extrabold bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-xl uppercase tracking-wider border border-white/10">
              Habis
            </span>
          </div>
        )}
      </div>

      {/* Konten Detail Produk */}
      <div className="flex-1 flex flex-col justify-between p-2.5 sm:p-3 relative z-10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
        <div className="mb-2">
          <h4 className="font-bold text-[13px] leading-snug text-slate-800 dark:text-slate-100 line-clamp-2">
            {item.name}
          </h4>
          {!isOutOfStock && item.stock > 0 && item.stock <= 5 && (
            <span className="text-[9px] mt-1.5 font-extrabold text-rose-600 bg-rose-50 border border-rose-100 dark:bg-rose-500/10 dark:border-rose-500/20 px-1.5 py-0.5 rounded inline-block uppercase tracking-wider">
              Sisa {item.stock}
            </span>
          )}
        </div>

        <div className="flex justify-between items-end mt-auto gap-2">
          <p className="font-black text-amber-600 dark:text-amber-500 text-[13px] tracking-tight">
            {FORMAT_IDR(item.price)}
          </p>
          
          {/* Kontrol Kuantitas */}
          {!isOutOfStock && (
            qty > 0 && !(item.variants && item.variants.length > 0) ? (
              <div className="flex items-center gap-1 flex-shrink-0 bg-slate-50 dark:bg-slate-800 rounded-full p-0.5 border border-slate-200 dark:border-slate-700 shadow-sm">
                <button
                  type="button"
                  onClick={handleMinusClick}
                  className="w-6 h-6 rounded-full flex items-center justify-center bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-500 active:scale-90 shadow-sm transition-all"
                  aria-label={`Kurangi ${item.name}`}
                >
                  <Minus size={14} strokeWidth={2.5} />
                </button>
                <span className="font-bold text-[11px] text-slate-700 dark:text-slate-200 min-w-[14px] text-center select-none">
                  {qty}
                </span>
                <button
                  type="button"
                  onClick={handlePlusClick}
                  className="w-6 h-6 rounded-full flex items-center justify-center bg-amber-500 text-white active:scale-90 shadow-sm transition-all"
                  aria-label={`Tambah ${item.name}`}
                >
                  <Plus size={14} strokeWidth={2.5} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleAddClick}
                disabled={isOutOfStock}
                className="w-7 h-7 rounded-full flex items-center justify-center transition-all flex-shrink-0 bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-500 active:scale-95"
                aria-label={`Tambah ${item.name}`}
              >
                <Plus size={16} strokeWidth={2.5} />
              </button>
            )
          )}
          {isOutOfStock && (
            <button
              type="button"
              disabled
              className="w-7 h-7 rounded-full flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600 flex-shrink-0"
            >
              <Plus size={16} strokeWidth={2.5} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
});
ProductCard.displayName = 'ProductCard';

// ==========================================
// Sub-Komponen: Product Grid (Memoized)
// ==========================================

interface ProductGridProps {
  items: ProductItem[];
  onSelect: (item: ProductItem) => void;
  onAddToCart?: (item: ProductItem) => void;
  cartMap: Record<string, Record<string, unknown>>; // O(1) map passed down
  updateCartQty?: (cartId: number, delta: number) => void;
}

const ProductGrid = React.memo(({ items, onSelect, onAddToCart, cartMap, updateCartQty }: ProductGridProps) => (
  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-3 sm:gap-4">
    {items.map((item) => (
      <ProductCard
        key={item.id}
        item={item}
        onSelect={onSelect}
        onAddToCart={onAddToCart}
        cartItemData={cartMap[String(item.id)] || null}
        updateCartQty={updateCartQty}
      />
    ))}
  </div>
));
ProductGrid.displayName = 'ProductGrid';

// ==========================================
// Main Component: MenuView
// ==========================================

export default function MenuView({
  setView,
  searchQuery,
  setSearchQuery,
  selectedCategory,
  setSelectedCategory,
  setSelectedItem,
  addToCart,
  cartLength = 0,
  cart = [],
  updateCartQty,
  isEmbedded = false,
}: MenuViewProps): JSX.Element {

  const dbCategories = (useDbQuery('categories') as CategoryItem[]) ?? [];
  const categories = useMemo(() => {
    return [...dbCategories].sort((a, b) => {
      if (a.order !== undefined && b.order !== undefined) return a.order - b.order;
      if (a.createdAt && b.createdAt) return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return String(a.id).localeCompare(String(b.id));
    });
  }, [dbCategories]);

  const products = (useDbQuery('products') as ProductItem[]) ?? [];
  
  const [loading, setLoading] = useState(() => {
    if (typeof window === 'undefined') return true;
    return sessionStorage.getItem('mesenae_menu_cached') !== 'true';
  });

  useEffect(() => {
    if (loading) {
      if (dbCategories.length > 0 || products.length > 0) {
        setLoading(false);
        sessionStorage.setItem('mesenae_menu_cached', 'true');
      }
      const timer = setTimeout(() => {
        setLoading(false);
        sessionStorage.setItem('mesenae_menu_cached', 'true');
      }, 1000); // Dikurangi menjadi 1 detik agar tidak terlalu lama memblokir UI
      return () => clearTimeout(timer);
    }
  }, [loading, dbCategories.length, products.length]);

  // Logika Filter & Search
  const filteredMenu = useMemo(() => {
    const filtered = products.filter((item) => {
      const matchCat = selectedCategory === 'all' || String(item.categoryId) === String(selectedCategory);
      const matchSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchSearch;
    });

    // Jika menampilkan semua, urutkan berdasarkan urutan kategori
    if (selectedCategory === 'all') {
      return [...filtered].sort((a, b) => {
        const catA = categories.findIndex(c => String(c.id) === String(a.categoryId));
        const catB = categories.findIndex(c => String(c.id) === String(b.categoryId));
        return catA - catB;
      });
    }
    return filtered;
  }, [products, categories, selectedCategory, searchQuery]);

  // Map Keranjang Belanja untuk performa O(1) di anak komponen
  const cartMap = useMemo(() => {
    const map: Record<string, Record<string, unknown>> = {};
    cart.forEach(c => {
      // Kita hanya memetakan item tanpa varian tambahan / catatan khusus untuk quick add/minus
      if ((!c.selectedVariants || (c.selectedVariants as unknown[]).length === 0) && !c.notes) {
        map[String(c.id)] = c;
      }
    });
    return map;
  }, [cart]);

  // Handler Aksi
  const handleSelect = useCallback((item: ProductItem) => {
    setSelectedItem(item);
  }, [setSelectedItem]);

  const handleAddToCart = useCallback((item: ProductItem) => {
    if (item.variants && item.variants.length > 0) {
      setSelectedItem(item, true); // Buka modal opsi jika ada varian
    } else if (addToCart) {
      addToCart(item, 1, '', []);
      toast.success(`${item.name} ditambahkan`);
    } else {
      setSelectedItem(item, true);
    }
  }, [addToCart, setSelectedItem]);

  // ==========================================
  // Render: Loading Skeleton
  // ==========================================
  if (loading) {
    return (
      <div className="flex-1 flex flex-col bg-slate-50 dark:bg-slate-950 animate-in fade-in duration-300">
        <div className="sticky top-0 z-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-4 pt-4 pb-3 border-b border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-800 animate-pulse shrink-0" />
            <div className="flex-1 h-12 rounded-2xl bg-slate-200 dark:bg-slate-800 animate-pulse" />
          </div>
          <div className="flex gap-2.5 overflow-hidden pb-1">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-9 w-[88px] rounded-full bg-slate-200 dark:bg-slate-800 animate-pulse shrink-0" />
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 pb-[120px]">
          <div className="mb-4 flex items-center justify-between text-sm px-1">
            <div className="h-4 w-32 bg-slate-200 dark:bg-slate-800 animate-pulse rounded-full" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-3 sm:gap-4 mt-2">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div key={i} className="bg-white dark:bg-slate-900 rounded-[1.25rem] flex flex-col border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
                <div className="aspect-square bg-slate-200 dark:bg-slate-800 animate-pulse w-full border-b border-slate-100/50 dark:border-slate-800/50" />
                <div className="p-3.5 flex-1 flex flex-col justify-between">
                  <div className="mb-2 space-y-2">
                    <div className="h-4 bg-slate-200 dark:bg-slate-800 animate-pulse rounded w-full" />
                    <div className="h-4 bg-slate-200 dark:bg-slate-800 animate-pulse rounded w-2/3" />
                  </div>
                  <div className="flex justify-between items-end mt-auto gap-2">
                    <div className="h-5 bg-slate-200 dark:bg-slate-800 animate-pulse rounded w-16" />
                    <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-slate-200 dark:bg-slate-800 animate-pulse shrink-0" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // Render: Layout Utama
  // ==========================================
  return (
    <div className="flex-1 flex flex-col relative z-0">

      {/* Header Sticky Container */}
      <div className={isEmbedded ? "pt-2 pb-3 px-4 relative z-10" : "sticky top-0 z-30 pt-4 pb-3 px-4 backdrop-blur-2xl bg-white/40 dark:bg-black/40 border-b border-white/20 shadow-sm transition-all"}>
        {/* Soft Decorative Gradient behind header */}
        {!isEmbedded && <div className="absolute inset-0 bg-gradient-to-b from-amber-500/10 to-transparent -z-10 pointer-events-none" />}

        {/* Nav & Search Bar */}
        <div className="flex items-center gap-3 mb-4 relative z-10">
          {!isEmbedded && (
            <button
              onClick={() => setView('landing')}
              className="w-11 h-11 flex items-center justify-center glass-button rounded-full shrink-0 text-slate-800 dark:text-white"
              aria-label="Kembali ke Beranda"
            >
              <ChevronLeft size={24} strokeWidth={2.5} />
            </button>
          )}

          <div className="flex-1 relative group">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-500 dark:text-slate-400 group-focus-within:text-amber-500 transition-colors" size={18} strokeWidth={2.5} />
            <input
              type="text"
              placeholder="Cari menu favorit..."
              value={searchQuery}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
              className="w-full glass-card pl-11 pr-4 py-3 rounded-[1.5rem] text-[15px] focus:outline-none focus:ring-2 focus:ring-amber-500/50 border border-white/30 dark:border-white/10 transition-all placeholder-slate-500 dark:placeholder-slate-400 font-medium text-slate-900 dark:text-white"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <Plus size={18} className="rotate-45" strokeWidth={2.5} />
              </button>
            )}
          </div>
        </div>

        {/* Categories Horizontal Scroll */}
        <div className="flex gap-2.5 overflow-x-auto pb-1 custom-scrollbar-hide relative z-10" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-4 py-2 md:px-5 md:py-2.5 rounded-xl md:rounded-[1.2rem] text-[12px] md:text-[13px] font-bold whitespace-nowrap transition-all flex-shrink-0 active:scale-95 border ${
              selectedCategory === 'all'
                ? 'bg-amber-500 text-white border-amber-400 shadow-md shadow-amber-500/20'
                : 'glass-card text-slate-700 dark:text-slate-200 hover:bg-white/40'
            }`}
          >
            Semua Menu
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id.toString())}
              className={`px-4 py-2 md:px-5 md:py-2.5 rounded-xl md:rounded-[1.2rem] text-[12px] md:text-[13px] font-bold whitespace-nowrap transition-all flex items-center gap-1.5 md:gap-2 flex-shrink-0 active:scale-95 border ${
                selectedCategory === String(cat.id)
                  ? 'bg-amber-500 text-white border-amber-400 shadow-md shadow-amber-500/20'
                  : 'glass-card text-slate-700 dark:text-slate-200 hover:bg-white/40'
              }`}
            >
              {cat.icon && <span className="text-[13px] md:text-[14px]">{cat.icon}</span>}
              <span>{cat.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Area Daftar Produk */}
      <div className={isEmbedded ? "px-4 pb-4" : "flex-1 overflow-y-auto p-4 pb-20 custom-scrollbar-hide"}>

        {/* Pencarian dan Hasil */}
        <div className="mb-4 flex items-center justify-between text-[10px] md:text-xs text-slate-500 dark:text-slate-400 px-1">
          <span className="font-bold uppercase tracking-wider">{filteredMenu.length} Hasil Ditemukan</span>
        </div>

        {/* Kontainer Grid List Produk */}
        {selectedCategory === 'all' && !searchQuery ? (
          <div className="space-y-8">
            {categories.map((cat) => {
              const catProducts = filteredMenu.filter((p) => String(p.categoryId) === String(cat.id));
              if (catProducts.length === 0) return null;
              
              return (
                <div key={cat.id} className="space-y-4">
                  <div className="flex items-center gap-2 mb-2 px-1">
                    {cat.icon && <span className="text-lg bg-blue-50 dark:bg-blue-900/20 p-1.5 rounded-lg">{cat.icon}</span>}
                    <h3 className="font-black text-slate-900 dark:text-white text-base tracking-tight">
                      {cat.name}
                    </h3>
                  </div>
                  <ProductGrid 
                    items={catProducts} 
                    onSelect={handleSelect} 
                    onAddToCart={handleAddToCart} 
                    cartMap={cartMap} 
                    updateCartQty={updateCartQty} 
                  />
                </div>
              );
            })}
            
            {/* Produk Tanpa Kategori */}
            {(() => {
              const uncategorized = filteredMenu.filter((p) => !categories.some((c) => String(c.id) === String(p.categoryId)));
              if (uncategorized.length === 0) return null;
              
              return (
                <div className="space-y-4 pt-4 border-t border-dashed border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-2 mb-2 px-1">
                    <span className="text-lg bg-slate-100 dark:bg-slate-800 p-1.5 rounded-lg">📦</span>
                    <h3 className="font-black text-slate-900 dark:text-white text-base tracking-tight">
                      Lain-lain
                    </h3>
                  </div>
                  <ProductGrid 
                    items={uncategorized} 
                    onSelect={handleSelect} 
                    onAddToCart={handleAddToCart} 
                    cartMap={cartMap} 
                    updateCartQty={updateCartQty} 
                  />
                </div>
              );
            })()}
          </div>
        ) : (
          <ProductGrid 
            items={filteredMenu} 
            onSelect={handleSelect} 
            onAddToCart={handleAddToCart} 
            cartMap={cartMap} 
            updateCartQty={updateCartQty} 
          />
        )}

        {/* Status Kosong (Empty State) saat Pencarian Tidak Ditemukan */}
        {filteredMenu.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center px-4 animate-in fade-in zoom-in duration-300">
            <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800/50 rounded-full flex items-center justify-center mb-5 border border-slate-200 dark:border-slate-700">
              <PackageOpen size={36} strokeWidth={1.5} className="text-slate-400" />
            </div>
            <h3 className="font-extrabold text-slate-900 dark:text-white text-lg mb-2">
              Menu Tidak Ditemukan
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-[250px] leading-relaxed">
              Mungkin kata kuncinya kurang tepat atau coba cari di kategori Semua.
            </p>
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('all');
              }}
              className="mt-6 px-6 py-3 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 active:scale-95 transition-all shadow-md shadow-blue-600/20"
            >
              Hapus Filter
            </button>
          </div>
        )}
        
      </div>
    </div>
  );
}
