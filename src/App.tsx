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
import Calculator from "./pages/Calculator";
import Golosovanie from "./pages/Golosovanie";
import MobileBottomNav from "./components/MobileBottomNav";
import ScrollToTop from "./components/ScrollToTop";
import ChatWidget from "./components/ChatWidget";
import SEOHead from "./components/SEOHead";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <div className="relative min-h-screen pb-16 lg:pb-0 bg-background overflow-x-hidden">
          {/* Декоративные цветные сферы для премиального стекломорфизма (уровень $10,000)
              Сферы имеют z-0, чтобы лежать строго под контентом, но над базовым фоном body.
              Используется pointer-events-none, чтобы они не перехватывали клики мыши. */}
          
          {/* 1. Верхняя левая сфера - технологичный синий цвет с медленной пульсацией (период 12 секунд) */}
          <div 
            className="absolute top-[5%] left-[-15%] w-[60vw] h-[60vw] max-w-[650px] max-h-[650px] rounded-full bg-blue-400/20 dark:bg-blue-600/12 blur-[130px] pointer-events-none z-0 animate-pulse" 
            style={{ animationDuration: '12s' }} 
          />
          
          {/* 2. Центральная правая сфера - благородный золотисто-янтарный цвет (период 18 секунд) */}
          <div 
            className="absolute top-[35%] right-[-15%] w-[55vw] h-[55vw] max-w-[550px] max-h-[550px] rounded-full bg-amber-400/10 dark:bg-amber-500/8 blur-[120px] pointer-events-none z-0 animate-pulse" 
            style={{ animationDuration: '18s' }} 
          />
          
          {/* 3. Нижняя левая сфера - нежно-бирюзовый/голубой цвет для цветового разнообразия (период 15 секунд) */}
          <div 
            className="absolute bottom-[15%] left-[-10%] w-[50vw] h-[50vw] max-w-[500px] max-h-[500px] rounded-full bg-sky-300/15 dark:bg-sky-500/10 blur-[110px] pointer-events-none z-0 animate-pulse" 
            style={{ animationDuration: '15s' }} 
          />
          
          {/* Контент приложения с z-10, чтобы лежать поверх размытых сфер заднего плана */}
          <div className="relative z-10">
            <ScrollToTop />
            <SEOHead />
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
              <Route path="/calculator" element={<Calculator />} />
              <Route path="/golosovanie" element={<Golosovanie />} />
              <Route path="/golosovanie/:id" element={<Golosovanie />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </div>
        </div>
        <MobileBottomNav />
        <ChatWidget />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
