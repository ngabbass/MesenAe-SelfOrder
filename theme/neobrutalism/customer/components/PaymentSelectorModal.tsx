import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, CreditCard, Check } from 'lucide-react';
import { getPaymentLogoSrc, getCategoryIcon, PaymentLogoBlock } from '../pages/CheckoutView';

interface PaymentSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  paymentMethods: any[];
  selectedMethodId: string;
  setSelectedMethodId: (id: string) => void;
}

export default function PaymentSelectorModal({
  isOpen,
  onClose,
  paymentMethods,
  selectedMethodId,
  setSelectedMethodId,
}: PaymentSelectorModalProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [shouldRender, setShouldRender] = useState(isOpen);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    if (isOpen) {
      setShouldRender(true);
      document.body.style.overflow = 'hidden';
      timeoutId = setTimeout(() => setIsVisible(true), 10);
    } else {
      setIsVisible(false);
      document.body.style.overflow = 'unset';
      timeoutId = setTimeout(() => setShouldRender(false), 300);
    }
    return () => {
      clearTimeout(timeoutId);
    };
  }, [isOpen]);

  useEffect(() => {
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  if (!shouldRender) return null;

  return createPortal(
    <div className={`fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-6 transition-opacity duration-300 ${isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-none" 
        onClick={onClose} 
      />
      <div className={`bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_#374151] relative z-10 flex flex-col max-h-[85vh] overflow-hidden border-3 border-black dark:border-slate-700 transition-all duration-300 transform ${isVisible ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'}`}>
        
        <div className="bg-white dark:bg-slate-900 px-6 py-5 border-b-3 border-black dark:border-slate-700 flex items-center justify-between sticky top-0 z-20 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 border-2 border-black dark:border-slate-700 bg-[#ff90e8] flex items-center justify-center shrink-0 rounded-xl shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_#374151]">
              <CreditCard className="text-black" size={18} strokeWidth={2.5} />
            </div>
            <div>
              <h3 className="font-black text-sm text-black dark:text-white uppercase tracking-wider">Metode Pembayaran</h3>
              <p className="text-[10px] font-black text-slate-500 mt-0.5 uppercase tracking-wide">PILIH SALAH SATU</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="w-9 h-9 border-2 border-black dark:border-slate-700 bg-white hover:bg-[#fffdf0] text-black hover:text-red-500 transition-colors flex items-center justify-center shrink-0 rounded-xl shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_#374151] active:translate-x-[0.5px] active:translate-y-[0.5px] active:shadow-none"
          >
            <X size={18} strokeWidth={3} />
          </button>
        </div>
        
        <div className="overflow-y-auto p-5 sm:p-6 space-y-4 bg-[#fffdf2] dark:bg-slate-950 flex-1 overscroll-contain">
          {paymentMethods.map((pm: any) => {
            const IconComponent = getCategoryIcon(pm.category);
            const isSelected = selectedMethodId === pm.id.toString();
            
            return (
              <div 
                key={pm.id}
                onClick={() => { 
                  setSelectedMethodId(pm.id.toString()); 
                  setTimeout(() => onClose(), 150);
                }}
                className={`flex items-center justify-between p-4 border-2 border-black dark:border-slate-700 cursor-pointer select-none transition-all active:translate-x-[1px] active:translate-y-[1px] active:shadow-none rounded-2xl ${
                  isSelected 
                    ? 'bg-[#ffc700] text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_#374151]' 
                    : 'bg-white hover:bg-[#fffdf6] dark:bg-slate-900 dark:hover:bg-slate-850 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_#374151]'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`p-1 border-2 border-black dark:border-slate-700 bg-white rounded-xl shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_#374151] overflow-hidden`}>
                    <PaymentLogoBlock 
                      src={getPaymentLogoSrc(pm)} 
                      alt={pm.name} 
                      IconComponent={IconComponent} 
                      isSelected={isSelected}
                      small={true}
                    />
                  </div>
                  
                  <div>
                    <h4 className={`text-xs font-black uppercase tracking-wider ${isSelected ? 'text-black' : 'text-black dark:text-white'}`}>
                      {pm.name}
                    </h4>
                    <p className={`text-[9px] font-black uppercase mt-1 ${isSelected ? 'text-black/70' : 'text-slate-500 dark:text-slate-400'}`}>
                      {pm.category === 'tunai'
                        ? 'Bayar langsung di kasir'
                        : pm.provider === 'manual'
                        ? 'Perlu verifikasi kasir'
                        : 'Proses QR/E-wallet otomatis'}
                    </p>
                  </div>
                </div>
                
                <div className="mr-1">
                  {isSelected ? (
                    <div className="w-6 h-6 border-2 border-black bg-black text-[#ffc700] rounded-lg flex items-center justify-center">
                      <Check size={14} strokeWidth={3} />
                    </div>
                  ) : (
                    <div className="w-6 h-6 border-2 border-black bg-white rounded-lg" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>,
    document.body
  );
}
