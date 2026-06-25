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
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
        onClick={handleClose}
      />

      {/* Sheet Content (Neobrutalist Block Container) */}
      <div 
        className={`relative w-full max-w-md bg-white dark:bg-slate-900 border-t-4 sm:border-4 border-black dark:border-slate-700 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_#374151] sm:rounded-xl rounded-t-xl overflow-hidden flex flex-col max-h-[90vh] transform transition-transform duration-300 ease-out ${
          isVisible ? 'translate-y-0 sm:scale-100' : 'translate-y-full sm:translate-y-8 sm:scale-95'
        }`}
      >
        {/* Drag Handle (Mobile only) */}
        <div className="absolute top-0 left-0 right-0 pt-3 pb-2 flex justify-center z-20 pointer-events-none sm:hidden">
          <div className="w-12 h-1.5 bg-black/20 dark:bg-white/20 rounded-full" />
        </div>

        {/* Close Button overlay (Rectangular, bold border) */}
        <button 
          onClick={handleClose} 
          className="absolute top-4 right-4 z-20 p-2 bg-white dark:bg-slate-800 border-2 border-black dark:border-slate-700 text-black dark:text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_#374151] hover:translate-x-[0.5px] hover:translate-y-[0.5px] hover:shadow-[1.5px_1.5px_0px_0px_rgba(0,0,0,1)] dark:hover:shadow-[1.5px_1.5px_0px_0px_#374151] transition-all font-black"
          aria-label="Tutup"
        >
          <X size={18} strokeWidth={3} />
        </button>

        {/* Scrollable Area */}
        <div className="flex-1 overflow-y-auto pb-[160px] custom-scrollbar">
          
          {/* Image Section */}
          {!hideImage && (
            <div className="relative w-full aspect-square sm:aspect-[4/3] bg-slate-100 dark:bg-slate-800 shrink-0 flex items-center justify-center border-b-2 border-black dark:border-slate-700">
              {item.photo ? (
                <img src={cldThumb(item.photo)} alt={item.name} decoding="async" className="w-full h-full object-cover" />
              ) : (
                <div className="flex flex-col items-center justify-center text-slate-400 gap-2">
                  <ImageIcon size={48} strokeWidth={1.5} className="text-black dark:text-white" />
                  <span className="text-xs font-black uppercase text-black dark:text-white">Belum ada foto</span>
                </div>
              )}
            </div>
          )}

          {/* Details Section */}
          <div className={`p-6 space-y-6 ${hideImage ? 'pt-12' : ''}`}>
            
            {/* Title & Price */}
            <div className={hideImage ? 'pr-10' : ''}>
              <h2 className="text-2xl font-black text-black dark:text-white leading-tight uppercase tracking-tight mb-2">
                {item.name}
              </h2>
              <div className="inline-block bg-[#ffc700] text-black border-2 border-black dark:border-slate-700 font-black px-3 py-1.5 text-lg shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_#374151]">
                {FORMAT_IDR(item.price)}
              </div>
              {item.sku && (
                <p className="text-xs font-black text-black dark:text-white bg-white dark:bg-slate-800 border border-black dark:border-slate-700 inline-block px-2.5 py-1 mt-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_#374151] uppercase">
                  SKU: {item.sku}
                </p>
              )}
            </div>

            {/* Variants Section */}
            {item.variants?.length > 0 && (
              <div className="space-y-5">
                {item.variants.map((group: ProductVariantGroup, gIdx: number) => (
                  <div key={gIdx} className="bg-[#fffdf0] dark:bg-slate-800 border-2 border-black dark:border-slate-700 p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_#374151]">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="font-black text-black dark:text-white text-base uppercase tracking-tight">{group.name}</h3>
                        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                          {group.type === 'single' ? 'PILIH SALAH SATU:' : 'PILIH BEBAS:'}
                        </p>
                      </div>
                      {group.required && (
                        <span className="text-[10px] bg-red-500 text-white border-2 border-black px-2.5 py-1 font-black uppercase tracking-wider">
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
                            className={`w-full flex items-center justify-between p-3 border-2 border-black dark:border-slate-700 transition-all ${
                              isSelected 
                                ? 'bg-[#ffc700] text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_#374151] font-black' 
                                : 'bg-white dark:bg-slate-900 text-black dark:text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,0.15)] dark:shadow-[2px_2px_0px_0px_rgba(255,199,0,0.15)] hover:translate-x-[0.5px] hover:translate-y-[0.5px]'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              {isSelected ? (
                                <CheckCircle2 className="text-black shrink-0" size={18} strokeWidth={3} />
                              ) : (
                                <Circle className="text-slate-400 dark:text-slate-600 shrink-0" size={18} strokeWidth={2} />
                              )}
                              <span className="text-xs font-bold uppercase tracking-wide">
                                {opt.name}
                              </span>
                            </div>
                            {opt.price > 0 && (
                              <span className="text-xs font-black">
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
              <h3 className="font-black mb-3 uppercase text-sm tracking-wide text-black dark:text-white">Catatan Tambahan</h3>
              <textarea 
                placeholder="Contoh: pedas sedang, es sedikit, dll..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full bg-white dark:bg-slate-900 border-2 border-black dark:border-slate-700 p-3 text-xs font-bold outline-none focus:bg-[#fffdf0] dark:focus:bg-slate-800 transition-all text-black dark:text-white placeholder-slate-400 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_#374151]"
                rows={2}
              />
            </div>

          </div>
        </div>

        {/* Fixed Bottom Action Bar */}
        <div className="absolute bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t-3 border-black dark:border-slate-700 px-5 py-4 z-30 shadow-[0_-4px_0px_0px_rgba(0,0,0,0.05)]" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}>
          
          <div className="flex flex-col gap-4">
            {/* Total Price & Qty Row */}
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Total Harga</span>
                <span className="font-black text-xl text-black dark:text-white">
                  {FORMAT_IDR(totalPrice)}
                </span>
              </div>
              
              <div className="flex items-center bg-white dark:bg-slate-800 border-2 border-black dark:border-slate-700 p-0.5">
                <button 
                  onClick={() => setQty(Math.max(1, qty - 1))}
                  className="w-8 h-8 bg-[#ffc700] hover:bg-[#ffe066] text-black border border-black flex items-center justify-center font-black active:scale-95 transition-all"
                >
                  <Minus size={14} strokeWidth={3} />
                </button>
                <span className="font-black w-8 text-center text-xs text-black dark:text-white">{qty}</span>
                <button 
                  onClick={() => setQty(Math.min(item.stock || 99, qty + 1))}
                  className="w-8 h-8 bg-[#ffc700] hover:bg-[#ffe066] text-black border border-black flex items-center justify-center font-black active:scale-95 transition-all"
                >
                  <Plus size={14} strokeWidth={3} />
                </button>
              </div>
            </div>
            
            {/* Action Buttons Row */}
            <div className="flex gap-3">
              <button 
                onClick={handleAdd}
                disabled={!isReady}
                className="flex-1 border-2 border-black dark:border-slate-700 bg-white hover:bg-slate-100 text-black font-black uppercase tracking-wider text-xs shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_#374151] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none py-3.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
              >
                + Keranjang
              </button>
              <button 
                onClick={handleDirectBuy}
                disabled={!isReady}
                className="flex-[1.5] border-2 border-black dark:border-slate-700 bg-[#ffc700] hover:bg-[#ffe066] text-black font-black uppercase tracking-wider text-xs shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_#374151] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none py-3.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
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
