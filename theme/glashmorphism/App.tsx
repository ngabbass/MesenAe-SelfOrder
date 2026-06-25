import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

import { BrowserRouter, Routes, Route } from "react-router-dom";
import CustomerApp from "./customer/CustomerApp";
import ErrorBoundary from "@/components/ErrorBoundary";
import { useThemeColor } from "@/hooks/use-theme-color";
import { useDbQuery, type StoreSettings } from "@/hooks/db-hooks";

const App = () => {
  useThemeColor(); // Activate global theme color sync
  const storeSettingsList = useDbQuery<StoreSettings>('storeSettings') ?? [];
  const storeSettings = storeSettingsList[0] || null;
  const selfOrderTheme = storeSettings?.selfOrderTheme || 'standar';



  return (
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
  );
};

export default App;
