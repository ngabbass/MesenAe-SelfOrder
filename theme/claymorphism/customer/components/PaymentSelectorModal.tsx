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
      // Jeda untuk animasi
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

  // Clean up on unmount
  useEffect(() => {
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  if (!shouldRender) return null;

  return createPortal(
    <div className={`fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-6 transition-opacity duration-300 ${isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
      <div 
        className="absolute inset-0 bg-slate-900/50 dark:bg-black/60 backdrop-blur-sm" 
        onClick={onClose} 
      />
      <div className={`bg-transparent w-full max-w-md clay-card relative z-10 flex flex-col max-h-[85vh] overflow-hidden transition-all duration-300 transform ${isVisible ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'}`}>
        
        <div className="bg-transparent px-6 py-5 border-b border-slate-100/10 flex items-center justify-between sticky top-0 z-20 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center shrink-0">
              <CreditCard className="text-blue-600 dark:text-blue-400" size={16} />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white leading-tight">Pilih Pembayaran</h3>
              <p className="text-[11px] font-medium text-slate-500 mt-0.5">Pilih metode yang Anda inginkan</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="w-8 h-8 rounded-full clay-btn-secondary flex items-center justify-center text-slate-500 transition-colors shrink-0"
          >
            <X size={18} />
          </button>
        </div>
        
        <div className="overflow-y-auto p-5 sm:p-6 space-y-3 bg-transparent flex-1 overscroll-contain">
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
                className={`flex items-center justify-between p-4 cursor-pointer transition-all active:scale-[0.98] ${
                  isSelected 
                    ? 'clay-btn-primary border-transparent' 
                    : 'clay-btn-secondary border-transparent shadow-sm'
                }`}
              >
                <div className="flex items-center gap-4">
                  <PaymentLogoBlock 
                    src={getPaymentLogoSrc(pm)} 
                    alt={pm.name} 
                    IconComponent={IconComponent} 
                    isSelected={isSelected} 
                  />
                  
                  <div>
                    <h4 className={`text-sm font-bold ${isSelected ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                      {pm.name}
                    </h4>
                    <p className={`text-[11px] font-medium mt-0.5 ${isSelected ? 'text-white/80' : 'text-slate-500 dark:text-slate-400'}`}>
                      {pm.category === 'tunai'
                        ? 'Bayar di kasir'
                        : pm.provider === 'manual'
                        ? 'Perlu konfirmasi'
                        : 'Proses otomatis'}
                    </p>
                  </div>
                </div>
                
                <div className="mr-2">
                  {isSelected ? (
                    <div className="w-6 h-6 rounded-full bg-white text-blue-600 flex items-center justify-center shadow-inner">
                      <Check size={14} strokeWidth={3} />
                    </div>
                  ) : (
                    <div className="w-6 h-6 rounded-full border-2 border-slate-200 dark:border-slate-700" />
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
