import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Cabinet from "./pages/Cabinet";
import Admin from "./pages/Admin";
import FSM from "./pages/FSM";
import Domofony from "./pages/Domofony";
import Videonablyudenie from "./pages/Videonablyudenie";
import NashiRaboty from "./pages/NashiRaboty";
import Voprosy from "./pages/Voprosy";
import Kontakty from "./pages/Kontakty";
import NotFound from "./pages/NotFound";
import SmartIntercom from "./pages/SmartIntercom";
import Payment from "./pages/Payment";
import MobileBottomNav from "./components/MobileBottomNav";
import ScrollToTop from "./components/ScrollToTop";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <div className="pb-16 lg:pb-0">
          <ScrollToTop />
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/cabinet" element={<Cabinet />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/fsm" element={<FSM />} />
            <Route path="/domofony" element={<Domofony />} />
            <Route path="/videonablyudenie" element={<Videonablyudenie />} />
            <Route path="/nashi-raboty" element={<NashiRaboty />} />
            <Route path="/voprosy" element={<Voprosy />} />
            <Route path="/kontakty" element={<Kontakty />} />
            <Route path="/smart-intercom" element={<SmartIntercom />} />
            <Route path="/payment" element={<Payment />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
        <MobileBottomNav />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
