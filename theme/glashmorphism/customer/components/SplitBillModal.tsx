import React from 'react';
import { createPortal } from 'react-dom';
import { Share2, X, QrCode, AlertCircle, CheckCircle2, User } from 'lucide-react';
import { RpIcon } from '@/components/ui/RpIcon';
import { FORMAT_IDR } from '@/lib/utils';
import { toast } from 'sonner';

// ============================================================================
// MultiSegmentSlider (Private helper component)
// ============================================================================

interface MultiSegmentSliderProps {
  total: number;
  portions: number[];
  onChange: React.Dispatch<React.SetStateAction<number[]>>;
  numPeople: number;
}

function MultiSegmentSlider({ total, portions, onChange, numPeople }: MultiSegmentSliderProps) {
  const trackRef = React.useRef<HTMLDivElement>(null);
  const [activeDrag, setActiveDrag] = React.useState<number | null>(null);

  // Palet gradasi biru agar terintegrasi elegan dengan UI aplikasi.
  const SEGMENT_COLORS = [
    'bg-blue-600',
    'bg-blue-500',
    'bg-blue-400',
    'bg-blue-300',
  ];

  const cumulativeAmounts = React.useMemo(() => {
    const arr: number[] = [];
    let sum = 0;
    for (let i = 0; i < numPeople; i++) {
      sum += portions[i] || 0;
      arr.push(sum);
    }
    return arr;
  }, [portions, numPeople]);

  const handleMove = React.useCallback((clientX: number) => {
    if (activeDrag === null || !trackRef.current || total <= 0) return;
    const rect = trackRef.current.getBoundingClientRect();
    let x = (clientX - rect.left) / rect.width;
    x = Math.max(0, Math.min(1, x));

    const minBound = activeDrag > 0 ? cumulativeAmounts[activeDrag - 1] : 0;
    const maxBound = activeDrag < numPeople - 2 ? cumulativeAmounts[activeDrag + 1] : total;

    let newCumulativeAmount = Math.round(x * total);
    newCumulativeAmount = Math.min(maxBound, Math.max(minBound, newCumulativeAmount));

    onChange(prev => {
      const next = [...prev];
      next[activeDrag] = newCumulativeAmount - minBound;
      next[activeDrag + 1] = maxBound - newCumulativeAmount;
      return next;
    });
  }, [activeDrag, cumulativeAmounts, total, numPeople, onChange]);

  React.useEffect(() => {
    if (activeDrag === null) return;

    const onMouseMove = (e: MouseEvent) => handleMove(e.clientX);
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) handleMove(e.touches[0].clientX);
    };
    const onMouseUp = () => setActiveDrag(null);
    const onTouchEnd = () => setActiveDrag(null);

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [activeDrag, handleMove]);

  return (
    <div className="relative pt-2 pb-6">
      <div 
        ref={trackRef} 
        className="relative h-10 w-full bg-slate-100 dark:bg-slate-800 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 select-none shadow-inner flex"
      >
        {Array.from({ length: numPeople }).map((_, i) => {
          const amt = portions[i] || 0;
          const pct = total > 0 ? (amt / total) * 100 : 100 / numPeople;
          return (
            <div
              key={i}
              className={`h-full relative flex items-center justify-center transition-all ${SEGMENT_COLORS[i] || 'bg-blue-200'}`}
              style={{ width: `${pct}%` }}
            >
              {pct > 15 && (
                <span className="text-[10px] font-black text-white pointer-events-none drop-shadow-sm truncate px-1">
                  P{i + 1} ({Math.round(pct)}%)
                </span>
              )}
            </div>
          );
        })}
      </div>

      {Array.from({ length: numPeople - 1 }).map((_, k) => {
        const amt = cumulativeAmounts[k] || 0;
        const pct = total > 0 ? (amt / total) * 100 : ((k + 1) / numPeople) * 100;
        return (
          <div
            key={k}
            className="absolute top-[8px] h-10 w-8 -ml-4 cursor-ew-resize flex items-center justify-center z-20 group"
            style={{ left: `${pct}%` }}
            onMouseDown={(e) => {
              e.preventDefault();
              setActiveDrag(k);
            }}
            onTouchStart={() => setActiveDrag(k)}
          >
            <div className="w-1.5 h-full bg-white dark:bg-slate-100 rounded-full shadow-md border border-slate-300 dark:border-slate-600 group-hover:scale-x-125 group-active:scale-x-125 transition-transform" />
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// SplitBillModal Component
// ============================================================================

interface SplitBillModalProps {
  isOpen: boolean;
  onClose: () => void;
  finalTotal: number;
  localNumPeople: number;
  setLocalNumPeople: (num: number) => void;
  isBagiRata: boolean;
  setIsBagiRata: (val: boolean) => void;
  customAmounts: number[];
  setCustomAmounts: React.Dispatch<React.SetStateAction<number[]>>;
  portionMethods: ('qris' | 'tunai')[];
  setPortionMethods: React.Dispatch<React.SetStateAction<('qris' | 'tunai')[]>>;
  setSplitConfig?: (v: any) => void;
  updatePortionManually: (idx: number, newVal: number) => void;
}

export default function SplitBillModal({
  isOpen,
  onClose,
  finalTotal,
  localNumPeople,
  setLocalNumPeople,
  isBagiRata,
  setIsBagiRata,
  customAmounts,
  setCustomAmounts,
  portionMethods,
  setPortionMethods,
  setSplitConfig,
  updatePortionManually
}: SplitBillModalProps) {
  
  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/60 dark:bg-black/60 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={onClose}
      />
      
      {/* Modal Container */}
      <div className="glass-panel-heavy w-full max-w-md rounded-[1.5rem] shadow-2xl relative z-10 animate-in fade-in zoom-in-95 duration-300 flex flex-col max-h-[90vh] overflow-hidden border border-white/20 dark:border-white/10">
        
        {/* Header - Fixed di atas */}
        <div className="bg-transparent px-6 py-5 border-b border-white/20 dark:border-white/10 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center shrink-0">
              <Share2 className="text-blue-600 dark:text-blue-400" size={16} />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white leading-tight">Pengaturan Bagi Tagihan</h3>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 dark:bg-slate-800/40 backdrop-blur-sm flex items-center justify-center text-slate-500 transition-colors shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body - Area yang bisa discroll */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 custom-scrollbar-hide bg-transparent">
          
          {/* Total Tagihan Summary Box */}
          <div className="bg-blue-50/50 dark:bg-blue-900/10 p-5 rounded-2xl border border-blue-100 dark:border-blue-900/30 text-center shadow-sm">
            <p className="text-[11px] font-extrabold text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-1">
              Total Pembayaran
            </p>
            <p className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              {FORMAT_IDR(finalTotal)}
            </p>
          </div>

          {/* Konfigurasi Jumlah Orang */}
          <div className="space-y-3">
            <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block px-1">
              Bagi Berapa Orang?
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              {[2, 3, 4].map((num) => {
                const isSelected = localNumPeople === num;
                return (
                  <button
                    key={num}
                    type="button"
                    onClick={() => {
                      setLocalNumPeople(num);
                      setCustomAmounts(Array.from({ length: num }, (_, i) => {
                        const eq = Math.floor(finalTotal / num);
                        return i === num - 1 ? finalTotal - eq * (num - 1) : eq;
                      }));
                    }}
                    className={`py-3.5 rounded-xl font-bold text-sm border-2 transition-all active:scale-[0.98] ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 shadow-sm'
                        : 'border-white/20 dark:border-white/10 glass-card hover:border-white/35 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {num} Orang
                  </button>
                );
              })}
            </div>
          </div>

          {/* Opsi Bagi Rata Toggle */}
          <div className="flex items-center justify-between p-4 glass-card rounded-2xl border border-white/20 dark:border-white/10 shadow-sm">
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">Bagi Tagihan Rata</h4>
              <p className="text-[11px] font-medium text-slate-500 mt-0.5">Total dibagi otomatis secara adil</p>
            </div>
            <div
              onClick={() => setIsBagiRata(!isBagiRata)}
              className={`w-12 h-7 rounded-full transition-colors flex items-center p-1 cursor-pointer shrink-0 ${
                isBagiRata ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'
              }`}
            >
              <div className={`w-5 h-5 bg-white rounded-full shadow-sm transform transition-transform duration-200 ${
                isBagiRata ? 'translate-x-5' : 'translate-x-0'
              }`} />
            </div>
          </div>

          {/* Multi-Handle Slider (Mode Manual) */}
          {!isBagiRata && (
            <div className="p-5 glass-card rounded-2xl border border-white/20 dark:border-white/10 shadow-sm space-y-4 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center justify-between">
                <h4 className="text-[11px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                  Atur Porsi Pembayaran
                </h4>
                <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded">
                  Geser Batas
                </span>
              </div>
              <MultiSegmentSlider
                total={finalTotal}
                portions={customAmounts}
                onChange={setCustomAmounts}
                numPeople={localNumPeople}
              />
            </div>
          )}

          {/* Form Detail Input per Orang */}
          <div className="space-y-4">
            <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block px-1">
              Rincian Pembagian
            </label>
            
            <div className="space-y-3">
              {Array.from({ length: localNumPeople }).map((_, idx) => {
                const amount = customAmounts[idx] || 0;
                const method = portionMethods[idx] || 'qris';
                
                return (
                  <div key={idx} className="p-4 glass-card rounded-2xl border border-white/20 dark:border-white/10 space-y-3.5 shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        <User size={16} className="text-blue-500" /> Orang {idx + 1}
                      </span>
                      
                      {/* Tampilan Input vs Teks Statis */}
                      {isBagiRata ? (
                        <span className="font-black text-sm text-slate-900 dark:text-white tracking-wide glass-card px-3 py-1.5 rounded-lg border border-white/20 dark:border-white/10">
                          {FORMAT_IDR(amount)}
                        </span>
                      ) : (
                        <div className="flex items-center gap-1.5 w-[140px]">
                          <span className="text-[11px] text-slate-400 font-bold">Rp</span>
                          <input
                            type="number"
                            value={amount || ''}
                            onChange={(e) => {
                              const val = Math.max(0, parseInt(e.target.value) || 0);
                              updatePortionManually(idx, val);
                            }}
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-blue-200 dark:border-blue-800 rounded-lg px-2.5 py-1.5 text-sm font-black text-right text-blue-700 dark:text-blue-400 outline-none focus:ring-2 focus:ring-blue-500/20 placeholder-slate-400 transition-colors"
                            placeholder="0"
                          />
                        </div>
                      )}
                    </div>

                    {/* Pemilihan Metode Pembayaran per Orang */}
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setPortionMethods(prev => {
                            const next = [...prev];
                            next[idx] = 'qris';
                            return next;
                          });
                        }}
                        className={`py-2 rounded-xl text-xs font-bold border-2 transition-all flex items-center justify-center gap-1.5 active:scale-95 ${
                          method === 'qris'
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
                            : 'border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 text-slate-500'
                        }`}
                      >
                        <QrCode size={14} /> QRIS
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPortionMethods(prev => {
                            const next = [...prev];
                            next[idx] = 'tunai';
                            return next;
                          });
                        }}
                        className={`py-2 rounded-xl text-xs font-bold border-2 transition-all flex items-center justify-center gap-1.5 active:scale-95 ${
                          method === 'tunai'
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
                            : 'border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 text-slate-500'
                        }`}
                      >
                        <RpIcon size={14} /> Tunai
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Validasi Total Akumulasi Input (Warning Box) */}
          <div className="pt-2 pb-1">
            {(() => {
              const currentSum = customAmounts.reduce((a, b) => a + b, 0);
              const diff = finalTotal - currentSum;
              
              if (diff !== 0) {
                return (
                  <div className="p-3.5 rounded-xl text-[11px] font-bold flex items-center justify-center gap-2 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50">
                    <AlertCircle size={16} />
                    <span>
                      {diff > 0 
                        ? `Masih kurang ${FORMAT_IDR(diff)} lagi dari total.` 
                        : `Total kelebihan ${FORMAT_IDR(Math.abs(diff))}.`
                      }
                    </span>
                  </div>
                );
              }
              return (
                <div className="p-3.5 rounded-xl text-[11px] font-bold flex items-center justify-center gap-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/50">
                  <CheckCircle2 size={16} />
                  <span>Total pembagian tagihan sudah tepat!</span>
                </div>
              );
            })()}
          </div>
        </div>

        {/* Footer Konfirmasi - Fixed di bawah */}
        <div className="p-5 border-t border-white/20 dark:border-white/10 bg-transparent shrink-0">
          <button 
            type="button"
            onClick={() => {
              const currentSum = customAmounts.reduce((a, b) => a + b, 0);
              if (currentSum !== finalTotal) {
                toast.error('Jumlah akumulasi pembagian harus sama dengan total tagihan pesanan.');
                return;
              }
              
              const splitsData = Array.from({ length: localNumPeople }).map((_, idx) => ({
                id: idx + 1,
                name: `Orang ${idx + 1}`,
                amount: customAmounts[idx] || 0,
                paymentMethod: portionMethods[idx] || 'qris',
                isPaid: false
              }));

              if (setSplitConfig) {
                setSplitConfig({
                  active: true,
                  numPeople: localNumPeople,
                  splits: splitsData
                });
              }
              onClose();
              toast.success('Pengaturan Split Bill telah disimpan!');
            }}
            disabled={customAmounts.reduce((a, b) => a + b, 0) !== finalTotal}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:text-slate-500 dark:disabled:bg-slate-800 dark:disabled:text-slate-600 text-white rounded-xl py-3.5 font-bold text-sm flex justify-center items-center transition-all shadow-md shadow-blue-600/20 active:scale-[0.98] disabled:shadow-none"
          >
            Terapkan Bagian
          </button>
        </div>
        
      </div>
    </div>,
    document.body
  );
}
