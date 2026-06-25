import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

import { BrowserRouter, Routes, Route } from "react-router-dom";
import CustomerApp from "./customer/CustomerApp";
import NeobrutalismApp from "../theme/neobrutalism/App";
import GlashmorphismApp from "../theme/glashmorphism/App";
import ClaymorphismApp from "../theme/claymorphism/App";

import ErrorBoundary from "@/components/ErrorBoundary";
import { useThemeColor } from "./hooks/use-theme-color";
import { useDbQuery, type StoreSettings } from "./hooks/db-hooks";

const App = () => {
  useThemeColor(); // Activate global theme color sync
  const storeSettingsList = useDbQuery<StoreSettings>('storeSettings') ?? [];
  const storeSettings = storeSettingsList[0] || null;
  const selfOrderTheme = storeSettings?.selfOrderTheme || 'standar';


  useEffect(() => {
    // Remove any existing theme- classes
    const classesToRemove = Array.from(document.documentElement.classList).filter(c => c.startsWith('theme-'));
    classesToRemove.forEach(c => document.documentElement.classList.remove(c));
    
    // Add current theme class
    const themeClass = `theme-${selfOrderTheme}`;
    document.documentElement.classList.add(themeClass);
    
    // Support both glashmorphism and glassmorphism spellings
    if (selfOrderTheme === 'glashmorphism' || selfOrderTheme === 'glassmorphism') {
      document.documentElement.classList.add('theme-glashmorphism');
      document.documentElement.classList.add('theme-glassmorphism');
    }

    return () => {
      document.documentElement.classList.remove(themeClass);
      document.documentElement.classList.remove('theme-glashmorphism');
      document.documentElement.classList.remove('theme-glassmorphism');
    };
  }, [selfOrderTheme]);

  if (selfOrderTheme === 'neobrutalism') {
    return <NeobrutalismApp />;
  }
  if (selfOrderTheme === 'glashmorphism' || selfOrderTheme === 'glassmorphism') {
    return <GlashmorphismApp />;
  }
  if (selfOrderTheme === 'claymorphism') {
    return <ClaymorphismApp />;
  }

  // Fallback to standard theme
  const outerThemeClass = `theme-${selfOrderTheme}`;

  return (
      <div className={`${outerThemeClass} min-h-screen bg-background`}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <ErrorBoundary>
            <BrowserRouter>
              <Routes>
                {/* Seluruh rute apapun akan diserap oleh CustomerApp secara mandiri */}
                <Route path="/*" element={<CustomerApp />} />
              </Routes>
            </BrowserRouter>
          </ErrorBoundary>
        </TooltipProvider>
      </div>
  );
};

export default App;
