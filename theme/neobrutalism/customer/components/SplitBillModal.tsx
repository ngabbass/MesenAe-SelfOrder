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

  // Palet neobrutalist warna kontras tinggi
  const SEGMENT_COLORS = [
    'bg-[#ffc700]', // Kuning
    'bg-[#ff90e8]', // Pink
    'bg-[#38bdf8]', // Cyan
    'bg-[#a3e635]', // Lime Green
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
        className="relative h-12 w-full bg-[#f0f0f0] border-3 border-black dark:border-slate-700 select-none flex overflow-hidden rounded-xl shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_#374151]"
      >
        {Array.from({ length: numPeople }).map((_, i) => {
          const amt = portions[i] || 0;
          const pct = total > 0 ? (amt / total) * 100 : 100 / numPeople;
          return (
            <div
              key={i}
              className={`h-full relative flex items-center justify-center border-r-2 border-black last:border-r-0 ${SEGMENT_COLORS[i] || 'bg-blue-200'}`}
              style={{ width: `${pct}%` }}
            >
              {pct > 15 && (
                <span className="text-[10px] font-black text-black pointer-events-none uppercase tracking-wider truncate px-1">
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
            className="absolute top-[8px] h-12 w-8 -ml-4 cursor-ew-resize flex items-center justify-center z-20 group"
            style={{ left: `${pct}%` }}
            onMouseDown={(e) => {
              e.preventDefault();
              setActiveDrag(k);
            }}
            onTouchStart={() => setActiveDrag(k)}
          >
            <div className="w-3.5 h-full bg-black border-2 border-white group-hover:bg-red-500 group-active:bg-red-500 transition-colors" />
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
        className="absolute inset-0 bg-black/60 backdrop-blur-none animate-in fade-in duration-300"
        onClick={onClose}
      />
      
      {/* Modal Container */}
      <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_#374151] relative z-10 animate-in fade-in zoom-in-95 duration-300 flex flex-col max-h-[90vh] overflow-hidden border-3 border-black dark:border-slate-700">
        
        {/* Header - Fixed di atas */}
        <div className="bg-white dark:bg-slate-900 px-6 py-5 border-b-3 border-black dark:border-slate-700 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 border-2 border-black dark:border-slate-700 bg-[#ff90e8] flex items-center justify-center shrink-0 rounded-xl shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_#374151]">
              <Share2 className="text-black" size={18} strokeWidth={2.5} />
            </div>
            <div>
              <h3 className="font-black text-sm text-black dark:text-white uppercase tracking-wider">Bagi Tagihan</h3>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="w-9 h-9 border-2 border-black dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-[#fffdf0] dark:hover:bg-slate-700 text-black dark:text-white hover:text-red-500 flex items-center justify-center shrink-0 rounded-xl shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_#374151] active:translate-x-[0.5px] active:translate-y-[0.5px] active:shadow-none"
          >
            <X size={18} strokeWidth={3} />
          </button>
        </div>

        {/* Content Body - Area yang bisa discroll */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 custom-scrollbar-hide bg-[#fffdf2] dark:bg-slate-950">
          
          {/* Total Tagihan Summary Box */}
          <div className="bg-[#ffc700] p-5 border-3 border-black dark:border-slate-700 text-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_#374151] rounded-2xl text-black">
            <p className="text-[10px] font-black uppercase tracking-widest mb-1.5">
              TOTAL TAGIHAN
            </p>
            <p className="text-3xl font-black tracking-tight leading-none">
              {FORMAT_IDR(finalTotal)}
            </p>
          </div>

          {/* Konfigurasi Jumlah Orang */}
          <div className="space-y-3">
            <label className="text-[10px] font-black text-black dark:text-white uppercase tracking-wider block px-1">
              Bagi Berapa Orang?
            </label>
            <div className="grid grid-cols-3 gap-3">
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
                    className={`py-3.5 border-2 border-black dark:border-slate-700 font-black uppercase text-xs tracking-wider transition-all rounded-xl shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_#374151] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none ${
                      isSelected
                        ? 'bg-[#ffc700] text-black shadow-none translate-x-[1px] translate-y-[1px]'
                        : 'bg-white dark:bg-slate-900 text-black dark:text-white hover:bg-slate-50'
                    }`}
                  >
                    {num} Orang
                  </button>
                );
              })}
            </div>
          </div>

          {/* Opsi Bagi Rata Toggle */}
          <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 border-3 border-black dark:border-slate-700 rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_#374151]">
            <div>
              <h4 className="text-xs font-black uppercase tracking-wider text-black dark:text-white">Bagi Tagihan Rata</h4>
              <p className="text-[9px] font-black uppercase text-slate-500 mt-1">Total dibagi otomatis secara adil</p>
            </div>
            <div
              onClick={() => setIsBagiRata(!isBagiRata)}
              className="w-14 h-7 border-2 border-black dark:border-slate-700 bg-white dark:bg-slate-900 flex items-center p-0.5 cursor-pointer shrink-0 rounded-full"
            >
              <div className={`w-5.5 h-5.5 border border-black dark:border-slate-700 rounded-full transform transition-transform duration-200 ${
                isBagiRata ? 'translate-x-7 bg-[#ffc700]' : 'translate-x-0 bg-red-500'
              }`} />
            </div>
          </div>

          {/* Multi-Handle Slider (Mode Manual) */}
          {!isBagiRata && (
            <div className="p-5 bg-white dark:bg-slate-900 border-3 border-black dark:border-slate-700 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_#374151] space-y-4 rounded-2xl animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center justify-between">
                <h4 className="text-[10px] font-black text-black dark:text-white uppercase tracking-wider">
                  Atur Porsi Pembayaran
                </h4>
                <span className="text-[9px] font-black text-black bg-[#ff90e8] border-2 border-black dark:border-slate-700 px-2 py-0.5 shadow-[1.5px_1.5px_0px_0px_rgba(0,0,0,1)] dark:shadow-[1.5px_1.5px_0px_0px_#374151] uppercase rounded-md">
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
            <label className="text-[10px] font-black text-black dark:text-white uppercase tracking-wider block px-1">
              Rincian Pembagian
            </label>
            
            <div className="space-y-4">
              {Array.from({ length: localNumPeople }).map((_, idx) => {
                const amount = customAmounts[idx] || 0;
                const method = portionMethods[idx] || 'qris';
                
                return (
                  <div key={idx} className="p-4 bg-white dark:bg-slate-900 border-3 border-black dark:border-slate-700 space-y-3.5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_#374151] rounded-2xl">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-black dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                        <User size={16} className="text-black dark:text-white" strokeWidth={2.5} /> Orang {idx + 1}
                      </span>
                      
                      {/* Tampilan Input vs Teks Statis */}
                      {isBagiRata ? (
                        <span className="font-black text-xs text-black bg-white border-2 border-black dark:border-slate-700 px-3 py-1.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_#374151] rounded-xl">
                          {FORMAT_IDR(amount)}
                        </span>
                      ) : (
                        <div className="flex items-center gap-1.5 w-[140px]">
                          <span className="text-[10px] text-slate-400 font-black uppercase">Rp</span>
                          <input
                            type="number"
                            value={amount || ''}
                            onChange={(e) => {
                              const val = Math.max(0, parseInt(e.target.value) || 0);
                              updatePortionManually(idx, val);
                            }}
                            className="w-full bg-white dark:bg-slate-950 border-2 border-black dark:border-slate-700 px-2.5 py-1.5 text-xs font-black text-right text-black dark:text-white outline-none focus:bg-[#fffdf0] rounded-xl shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_#374151]"
                            placeholder="0"
                          />
                        </div>
                      )}
                    </div>

                    {/* Pemilihan Metode Pembayaran per Orang */}
                    <div className="grid grid-cols-2 gap-2.5 pt-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setPortionMethods(prev => {
                            const next = [...prev];
                            next[idx] = 'qris';
                            return next;
                          });
                        }}
                        className={`py-2 px-3 border-2 border-black dark:border-slate-700 text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 rounded-xl shadow-[2.5px_2.5px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2.5px_2.5px_0px_0px_#374151] active:translate-x-[0.5px] active:translate-y-[0.5px] active:shadow-none ${
                          method === 'qris'
                            ? 'bg-[#ffc700] text-black shadow-none translate-x-[0.5px] translate-y-[0.5px]'
                            : 'bg-white dark:bg-slate-900 text-slate-500 hover:bg-slate-50'
                        }`}
                      >
                        <QrCode size={14} strokeWidth={2.5} /> QRIS
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
                        className={`py-2 px-3 border-2 border-black dark:border-slate-700 text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 rounded-xl shadow-[2.5px_2.5px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2.5px_2.5px_0px_0px_#374151] active:translate-x-[0.5px] active:translate-y-[0.5px] active:shadow-none ${
                          method === 'tunai'
                            ? 'bg-[#ffc700] text-black shadow-none translate-x-[0.5px] translate-y-[0.5px]'
                            : 'bg-white dark:bg-slate-900 text-slate-500 hover:bg-slate-50'
                        }`}
                      >
                        <RpIcon size={14} strokeWidth={2.5} /> Tunai
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
                  <div className="p-3.5 border-2 border-black dark:border-slate-700 text-[10px] font-black uppercase flex items-center justify-center gap-2 rounded-xl bg-[#ff90e8] text-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_#374151]">
                    <AlertCircle size={16} strokeWidth={2.5} />
                    <span>
                      {diff > 0 
                        ? `KURANG ${FORMAT_IDR(diff)} DARI TOTAL.` 
                        : `KELEBIHAN ${FORMAT_IDR(Math.abs(diff))}.`
                      }
                    </span>
                  </div>
                );
              }
              return (
                <div className="p-3.5 border-2 border-black dark:border-slate-700 text-[10px] font-black uppercase flex items-center justify-center gap-2 rounded-xl bg-[#a3e635] text-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_#374151]">
                  <CheckCircle2 size={16} strokeWidth={2.5} />
                  <span>Total pembagian tagihan sudah tepat!</span>
                </div>
              );
            })()}
          </div>
        </div>

        {/* Footer Konfirmasi - Fixed di bawah */}
        <div className="p-5 border-t-3 border-black dark:border-slate-700 bg-[#fffdf2] dark:bg-slate-900 shrink-0">
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
            className="w-full bg-[#ffc700] hover:bg-[#ffe066] disabled:bg-slate-200 disabled:text-slate-400 border-3 border-black dark:border-slate-700 text-black py-4 font-black uppercase tracking-wider text-xs flex justify-center items-center gap-2 active:translate-x-[1.5px] active:translate-y-[1.5px] active:shadow-none transition-all shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] dark:shadow-[5px_5px_0px_0px_#374151] rounded-2xl disabled:shadow-none"
          >
            Terapkan Bagian
          </button>
        </div>
        
      </div>
    </div>,
    document.body
  );
}
