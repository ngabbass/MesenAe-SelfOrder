import React, { useState, useMemo, useEffect } from 'react';
import { X, Minus, Plus, Image as ImageIcon, CheckCircle2, Circle } from 'lucide-react';
import { FORMAT_IDR } from '@/lib/utils';
import { ProductVariantGroup } from '@/hooks/db-hooks';
import { cldThumb } from '@/lib/cld';

interface MenuDetailSheetProps {
  item: any;
  hideImage?: boolean;
  onClose: () => void;
  onAdd: (item: any, qty: number, notes: string, variants: any[]) => void;
  onDirectBuy: (item: any, qty: number, notes: string, variants: any[]) => void;
}

export default function MenuDetailSheet({ item, hideImage = false, onClose, onAdd, onDirectBuy }: MenuDetailSheetProps) {
  const [qty, setQty] = useState(1);
  const [notes, setNotes] = useState('');
  const [isVisible, setIsVisible] = useState(false);
  
  // State for selected variants: { [groupName]: { [optionName]: price } }
  const [selectedVariants, setSelectedVariants] = useState<Record<string, Record<string, number>>>({});

  useEffect(() => {
    setIsVisible(true);
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 300); // Tunggu animasi selesai baru unmount
  };

  const toggleVariant = (group: ProductVariantGroup, optionName: string, price: number) => {
    setSelectedVariants(prev => {
      const newSel = { ...prev };
      if (!newSel[group.name]) newSel[group.name] = {};
      
      if (group.type === 'single') {
        newSel[group.name] = { [optionName]: price };
      } else {
        if (newSel[group.name][optionName] !== undefined) {
          delete newSel[group.name][optionName];
        } else {
          newSel[group.name][optionName] = price;
        }
      }
      return newSel;
    });
  };

  const variantsTotal = useMemo(() => {
    let total = 0;
    for (const group in selectedVariants) {
      for (const opt in selectedVariants[group]) {
        total += selectedVariants[group][opt];
      }
    }
    return total;
  }, [selectedVariants]);

  const totalPrice = (item.price + variantsTotal) * qty;

  const getFlatSelectedVariants = () => {
    const flat: { groupName: string, optionName: string, price: number }[] = [];
    for (const groupName in selectedVariants) {
      for (const optionName in selectedVariants[groupName]) {
        flat.push({ groupName, optionName, price: selectedVariants[groupName][optionName] });
      }
    }
    return flat;
  };

  const isReady = useMemo(() => {
    if (!item.variants) return true;
    for (const group of item.variants) {
      if (group.required) {
        const selectedCount = Object.keys(selectedVariants[group.name] || {}).length;
        if (selectedCount === 0) return false;
      }
    }
    return true;
  }, [item.variants, selectedVariants]);

  const handleAdd = () => {
    if (!isReady) return;
    onAdd(item, qty, notes, getFlatSelectedVariants());
    handleClose();
  };

  const handleDirectBuy = () => {
    if (!isReady) return;
    onDirectBuy(item, qty, notes, getFlatSelectedVariants());
    handleClose();
  };

  return (
    <div className={`fixed inset-0 z-[100] flex items-end sm:items-center justify-center transition-all duration-300 ${isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
      
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity"
        onClick={handleClose}
      />

      {/* Sheet Content */}
      <div 
        className={`relative w-full max-w-md clay-card sm:rounded-[2.5rem] rounded-t-[2.5rem] overflow-hidden flex flex-col max-h-[90vh] transform transition-transform duration-300 ease-out ${
          isVisible ? 'translate-y-0 sm:scale-100' : 'translate-y-full sm:translate-y-8 sm:scale-95'
        }`}
      >
        {/* Drag Handle (Mobile only) */}
        <div className="absolute top-0 left-0 right-0 pt-3 pb-2 flex justify-center z-20 pointer-events-none sm:hidden">
          <div className="w-12 h-1.5 rounded-full bg-slate-300/60 dark:bg-slate-700/60 backdrop-blur-md" />
        </div>

        {/* Close Button overlay */}
        <button 
          onClick={handleClose} 
          className="absolute top-4 right-4 z-20 p-2.5 rounded-full clay-btn-secondary transition-all"
          aria-label="Tutup"
        >
          <X size={18} strokeWidth={2.5} />
        </button>

        {/* Scrollable Area */}
        <div className="flex-1 overflow-y-auto pb-[160px] custom-scrollbar bg-transparent">
          
          {/* Image Section */}
          {!hideImage && (
            <div className="relative w-full aspect-square sm:aspect-[4/3] bg-slate-100/50 dark:bg-slate-800/50 shrink-0 flex items-center justify-center">
              {item.photo ? (
                <img src={cldThumb(item.photo)} alt={item.name} decoding="async" className="w-full h-full object-cover" />
              ) : (
                <div className="flex flex-col items-center justify-center text-slate-400 gap-2">
                  <ImageIcon size={48} strokeWidth={1} />
                  <span className="text-sm font-medium">Belum ada foto</span>
                </div>
              )}
              <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-b from-black/20 to-transparent pointer-events-none" />
            </div>
          )}

          {/* Details Section */}
          <div className={`p-6 space-y-6 ${hideImage ? 'pt-12' : ''}`}>
            
            {/* Title & Price */}
            <div className={hideImage ? 'pr-10' : ''}>
              <div className="flex justify-between items-start gap-4 mb-1">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white leading-tight">
                  {item.name}
                </h2>
              </div>
              <p className="text-2xl font-extrabold text-blue-600 dark:text-blue-400 mb-2">
                {FORMAT_IDR(item.price)}
              </p>
              {item.sku && (
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-100/50 dark:bg-slate-800/50 inline-block px-2.5 py-1 rounded-md">
                  SKU: {item.sku}
                </p>
              )}
            </div>

            {/* Variants Section */}
            {item.variants?.length > 0 && (
              <div className="space-y-5">
                {item.variants.map((group: ProductVariantGroup, gIdx: number) => (
                  <div key={gIdx} className="clay-card p-5 border-none shadow-inner mb-4">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="font-bold text-slate-900 dark:text-white text-base">{group.name}</h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {group.type === 'single' ? 'Pilih salah satu' : 'Bisa pilih lebih dari satu'}
                        </p>
                      </div>
                      {group.required && (
                        <span className="text-[10px] bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400 px-2 py-1 rounded-md font-bold uppercase tracking-wider">
                          Wajib
                        </span>
                      )}
                    </div>

                    <div className="space-y-2.5">
                      {group.options.map((opt, oIdx) => {
                        const isSelected = selectedVariants[group.name]?.[opt.name] !== undefined;
                        return (
                          <button 
                            key={oIdx} 
                            type="button"
                            onClick={() => toggleVariant(group, opt.name, opt.price)}
                            className={`w-full flex items-center justify-between p-3.5 transition-all ${
                              isSelected 
                                ? 'clay-btn-primary' 
                                : 'clay-btn-secondary'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              {/* Icon Checklist/Radio */}
                              {isSelected ? (
                                <CheckCircle2 className="text-white shrink-0" size={20} />
                              ) : (
                                <Circle className="text-slate-300 dark:text-slate-600 shrink-0" size={20} />
                              )}
                              <span className={`text-sm font-semibold text-left ${isSelected ? 'text-white' : 'text-slate-700 dark:text-slate-300'}`}>
                                {opt.name}
                              </span>
                            </div>
                            {opt.price > 0 && (
                              <span className={`text-sm font-semibold ${isSelected ? 'text-white/90' : 'text-slate-500'}`}>
                                + {FORMAT_IDR(opt.price)}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Notes Section */}
            <div>
              <h3 className="font-bold mb-3 text-slate-900 dark:text-white">Catatan Tambahan</h3>
              <textarea 
                placeholder="Contoh: Warna cadangan, tingkat pedas, dll..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full clay-input p-4 text-sm outline-none transition-all dark:text-white placeholder-slate-400"
                rows={3}
              ></textarea>
            </div>

          </div>
        </div>

        {/* Fixed Bottom Action Bar */}
        <div className="absolute bottom-0 left-0 right-0 bg-white/60 dark:bg-slate-950/60 backdrop-blur-md px-6 py-4 z-30 border-t border-white/20" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}>
          
          <div className="flex flex-col gap-4">
            {/* Total Price & Qty Row */}
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Harga</span>
                <span className="font-black text-xl text-blue-600 dark:text-blue-400">
                  {FORMAT_IDR(totalPrice)}
                </span>
              </div>
              
              <div className="flex items-center bg-white/40 dark:bg-slate-900/40 p-1 rounded-full border border-slate-200/50 dark:border-slate-700/50 backdrop-blur-sm shadow-inner">
                <button 
                  onClick={() => setQty(Math.max(1, qty - 1))}
                  className="w-9 h-9 rounded-full clay-btn-secondary flex items-center justify-center text-slate-600 dark:text-slate-300"
                >
                  <Minus size={18} strokeWidth={2.5} />
                </button>
                <span className="font-bold w-10 text-center text-slate-900 dark:text-white">{qty}</span>
                <button 
                  onClick={() => setQty(Math.min(item.stock || 99, qty + 1))} // Fallback stock
                  className="w-9 h-9 rounded-full clay-btn-secondary flex items-center justify-center text-blue-600 dark:text-blue-400"
                >
                  <Plus size={18} strokeWidth={2.5} />
                </button>
              </div>
            </div>
            
            {/* Action Buttons Row */}
            <div className="flex gap-3">
              <button 
                onClick={handleAdd}
                disabled={!isReady}
                className="flex-1 clay-btn-secondary py-3.5 font-bold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                + Keranjang
              </button>
              <button 
                onClick={handleDirectBuy}
                disabled={!isReady}
                className="flex-[1.5] clay-btn-primary py-3.5 font-bold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isReady ? 'Beli Langsung' : 'Pilih Varian Wajib'}
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
