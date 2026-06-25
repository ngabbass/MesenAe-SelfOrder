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
      className={`border-2 border-black dark:border-slate-700 bg-white dark:bg-slate-900 flex flex-col group transition-all duration-200 relative ${
        isOutOfStock
          ? 'opacity-60 grayscale cursor-not-allowed'
          : 'shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_#374151] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:hover:shadow-[3px_3px_0px_0px_#374151] cursor-pointer'
      }`}
    >
      {/* Container Gambar */}
      <div className="aspect-[4/3] w-full relative flex-shrink-0 bg-slate-50 border-b-2 border-black flex items-center justify-center overflow-hidden">
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
          <ImageIcon size={32} className="text-black" />
        )}
        
        {/* Badge Status Stok */}
        {isOutOfStock && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10">
            <span className="text-white text-[9px] font-black bg-red-600 border border-black dark:border-slate-700 px-2 py-1 uppercase tracking-wider shadow-[1.5px_1.5px_0px_0px_rgba(0,0,0,1)] dark:shadow-[1.5px_1.5px_0px_0px_#374151]">
              Habis
            </span>
          </div>
        )}
      </div>

      {/* Konten Detail Produk */}
      <div className="flex-1 flex flex-col justify-between p-2.5 sm:p-3 relative z-10 bg-white dark:bg-slate-900">
        <div className="mb-2">
          <h4 className="font-black text-[12px] sm:text-[13px] uppercase tracking-tight text-black dark:text-white leading-snug line-clamp-2">
            {item.name}
          </h4>
          {!isOutOfStock && item.stock > 0 && item.stock <= 5 && (
            <span className="text-[9px] mt-1.5 font-black text-white bg-red-500 border border-black px-1.5 py-0.5 uppercase tracking-wide inline-block">
              Sisa {item.stock}
            </span>
          )}
        </div>

        <div className="flex justify-between items-end mt-auto gap-2">
          <p className="font-black text-black dark:text-[#ffc700] text-[12px] sm:text-[13px] bg-[#ffc700] dark:bg-black px-1.5 py-0.5 border border-black">
            {FORMAT_IDR(item.price)}
          </p>
          
          {/* Kontrol Kuantitas */}
          {!isOutOfStock && (
            qty > 0 && !(item.variants && item.variants.length > 0) ? (
              <div className="flex items-center bg-white dark:bg-slate-800 border-2 border-black dark:border-slate-700 p-0.5 shadow-[1.5px_1.5px_0px_0px_rgba(0,0,0,1)] dark:shadow-[1.5px_1.5px_0px_0px_#374151]">
                <button
                  type="button"
                  onClick={handleMinusClick}
                  className="w-6 h-6 bg-[#ffc700] hover:bg-[#ffe066] border border-black flex items-center justify-center text-black active:scale-95 transition-transform"
                  aria-label={`Kurangi ${item.name}`}
                >
                  <Minus size={12} strokeWidth={3} />
                </button>
                <span className="font-black text-xs text-black min-w-[14px] text-center select-none">
                  {qty}
                </span>
                <button
                  type="button"
                  onClick={handlePlusClick}
                  className="w-6 h-6 bg-[#ffc700] hover:bg-[#ffe066] border border-black flex items-center justify-center text-black active:scale-95 transition-transform"
                  aria-label={`Tambah ${item.name}`}
                >
                  <Plus size={12} strokeWidth={3} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleAddClick}
                disabled={isOutOfStock}
                className="w-7 h-7 bg-[#ffc700] hover:bg-[#ffe066] border-2 border-black dark:border-slate-700 flex items-center justify-center text-black shadow-[1.5px_1.5px_0px_0px_rgba(0,0,0,1)] dark:shadow-[1.5px_1.5px_0px_0px_#374151] active:translate-x-[0.5px] active:translate-y-[0.5px] active:shadow-none transition-all shrink-0"
                aria-label={`Tambah ${item.name}`}
              >
                <Plus size={14} strokeWidth={3} />
              </button>
            )
          )}
          {isOutOfStock && (
            <button
              type="button"
              disabled
              className="w-7 h-7 bg-slate-200 border-2 border-black text-slate-400 flex items-center justify-center shrink-0 cursor-not-allowed"
            >
              <Plus size={14} strokeWidth={3} />
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
        <div className="sticky top-0 z-20 bg-white dark:bg-slate-900 border-b-2 border-black dark:border-slate-700 px-4 pt-4 pb-3">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 border-2 border-black dark:border-slate-700 bg-slate-200 dark:bg-slate-800 animate-pulse shrink-0" />
            <div className="flex-1 h-11 border-2 border-black dark:border-slate-700 bg-slate-200 dark:bg-slate-800 animate-pulse" />
          </div>
          <div className="flex gap-2.5 overflow-hidden pb-1">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-9 w-[88px] border-2 border-black dark:border-slate-700 bg-slate-200 dark:bg-slate-800 animate-pulse shrink-0" />
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 pb-[120px]">
          <div className="mb-4 flex items-center justify-between text-sm px-1">
            <div className="h-4 w-32 bg-slate-200 dark:bg-slate-800 animate-pulse border border-black dark:border-slate-700" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-3 sm:gap-4 mt-2">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div key={i} className="bg-white dark:bg-slate-900 border-2 border-black dark:border-slate-700 flex flex-col overflow-hidden shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_#374151]">
                <div className="aspect-square bg-slate-200 dark:bg-slate-800 animate-pulse w-full border-b-2 border-black dark:border-slate-700" />
                <div className="p-3.5 flex-1 flex flex-col justify-between">
                  <div className="mb-2 space-y-2">
                    <div className="h-4 bg-slate-200 dark:bg-slate-800 animate-pulse border border-black dark:border-slate-700 w-full" />
                    <div className="h-4 bg-slate-200 dark:bg-slate-800 animate-pulse border border-black dark:border-slate-700 w-2/3" />
                  </div>
                  <div className="flex justify-between items-end mt-auto gap-2">
                    <div className="h-5 bg-slate-200 dark:bg-slate-800 animate-pulse border border-black dark:border-slate-700 w-16" />
                    <div className="w-8 h-8 border-2 border-black dark:border-slate-700 bg-slate-200 dark:bg-slate-800 animate-pulse shrink-0" />
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
      <div className={isEmbedded ? "pt-2 pb-3 px-4 relative z-10 border-b-2 border-black dark:border-slate-700" : "sticky top-0 z-30 pt-4 pb-3 px-4 bg-[#fffdf0] dark:bg-slate-900 border-b-2 border-black dark:border-slate-700 transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,0.1)] dark:shadow-[2px_2px_0px_0px_#374151]"}>

        {/* Nav & Search Bar */}
        <div className="flex items-center gap-3 mb-4 relative z-10">
          {!isEmbedded && (
            <button
              onClick={() => setView('landing')}
              className="w-11 h-11 flex items-center justify-center border-2 border-black dark:border-slate-700 bg-[#ffc700] hover:bg-[#ffe066] text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_#374151] hover:translate-x-[0.5px] hover:translate-y-[0.5px] hover:shadow-[1.5px_1.5px_0px_0px_rgba(0,0,0,1)] dark:hover:shadow-[1.5px_1.5px_0px_0px_#374151] transition-all shrink-0 active:scale-95 rounded-md"
              aria-label="Kembali ke Beranda"
            >
              <ChevronLeft size={24} strokeWidth={3} />
            </button>
          )}

          <div className="flex-1 relative group">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-black dark:text-white" size={18} strokeWidth={3} />
            <input
              type="text"
              placeholder="Cari menu favorit..."
              value={searchQuery}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
              className="w-full bg-white dark:bg-slate-950 border-2 border-black dark:border-slate-700 pl-11 pr-4 py-3 text-[14px] font-black uppercase tracking-wide focus:bg-[#fffdf0] focus:text-black placeholder-slate-500 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_#374151]"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 text-black hover:scale-110"
              >
                <Plus size={18} className="rotate-45" strokeWidth={3} />
              </button>
            )}
          </div>
        </div>

        {/* Categories Horizontal Scroll */}
        <div className="flex gap-2.5 overflow-x-auto pb-1 custom-scrollbar-hide relative z-10" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-4 py-2.5 text-xs font-black uppercase tracking-wider whitespace-nowrap transition-all flex-shrink-0 active:translate-x-[0.5px] active:translate-y-[0.5px] active:shadow-none border-2 border-black dark:border-slate-700 ${
              selectedCategory === 'all'
                ? 'bg-[#ffc700] text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_#374151]'
                : 'bg-white dark:bg-slate-800 text-black dark:text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_#374151] hover:bg-[#fffdf0]'
            }`}
          >
            Semua Menu
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id.toString())}
              className={`px-4 py-2.5 text-xs font-black uppercase tracking-wider whitespace-nowrap transition-all flex items-center gap-1.5 flex-shrink-0 active:translate-x-[0.5px] active:translate-y-[0.5px] active:shadow-none border-2 border-black dark:border-slate-700 ${
                selectedCategory === String(cat.id)
                  ? 'bg-[#ffc700] text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_#374151]'
                  : 'bg-white dark:bg-slate-800 text-black dark:text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_#374151] hover:bg-[#fffdf0]'
              }`}
            >
              {cat.icon && <span className="text-[13px]">{cat.icon}</span>}
              <span>{cat.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Area Daftar Produk */}
      <div className={isEmbedded ? "px-4 pb-4" : "flex-1 overflow-y-auto p-4 pb-20 custom-scrollbar-hide"}>

        {/* Pencarian dan Hasil */}
        <div className="mb-4 flex items-center justify-between text-[10px] md:text-xs text-slate-500 dark:text-slate-400 px-1">
          <span className="font-black uppercase tracking-wider bg-black text-[#ffc700] px-2 py-0.5 border border-black">{filteredMenu.length} Hasil Ditemukan</span>
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
                    <div className="text-xs font-black text-black dark:text-white uppercase tracking-wider bg-[#ff90e8] border-2 border-black dark:border-slate-700 inline-flex items-center gap-2 px-2.5 py-1.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_#374151] rounded-xl">
                      {cat.icon && <span className="text-base">{cat.icon}</span>}
                      <span>{cat.name}</span>
                    </div>
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
                <div className="space-y-4 pt-4 border-t-2 border-black">
                  <div className="flex items-center gap-2 mb-2 px-1">
                    <div className="text-xs font-black text-black dark:text-white uppercase tracking-wider bg-slate-200 dark:bg-slate-800 border-2 border-black dark:border-slate-700 inline-flex items-center gap-2 px-2.5 py-1.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_#374151] rounded-xl">
                      <span className="text-base">📦</span>
                      <span>Lain-lain</span>
                    </div>
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
            <div className="w-20 h-20 bg-[#ffc700] border-2 border-black dark:border-slate-700 flex items-center justify-center mb-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_#374151]">
              <PackageOpen size={36} strokeWidth={2.5} className="text-black" />
            </div>
            <h3 className="font-black uppercase tracking-tight text-black dark:text-white text-lg mb-2">
              Menu Tidak Ditemukan
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 max-w-[250px] font-bold uppercase leading-relaxed">
              Mungkin kata kuncinya kurang tepat atau coba cari di kategori Semua.
            </p>
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('all');
              }}
              className="mt-6 px-6 py-3 bg-red-500 border-2 border-black dark:border-slate-700 text-white text-xs font-black uppercase shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_#374151] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all"
            >
              Hapus Filter
            </button>
          </div>
        )}
        
      </div>
    </div>
  );
}
