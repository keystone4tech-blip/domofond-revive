import { useState, useEffect } from "react";
import Header from "@/components/Header";
import Contact from "@/components/Contact";
import Requisites from "@/components/Requisites";
import DocumentsList from "@/components/DocumentsList";
import Footer from "@/components/Footer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageSquare, ShieldCheck, FolderOpen } from "lucide-react";

/**
 * Страница Контакты ООО «ДомофонДар»
 * Включает интерактивные вкладки для обратной связи, реквизитов (Карты партнера) и документации.
 */
const Kontakty = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Анимация плавного появления контента
    console.log("[Контакты] Инициализация страницы контактов...");
    const timer = setTimeout(() => setIsVisible(true), 200);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      <Header />
      <main className={`container mx-auto px-4 py-8 md:py-16 max-w-7xl transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        
        {/* Интерактивные вкладки на странице контактов */}
        <Tabs defaultValue="contact-form" className="space-y-8">
          
          {/* Стилизованная панель переключателей вкладок */}
          <div className="flex justify-center">
            <TabsList className="glass-premium border border-slate-200/50 dark:border-slate-800/50 p-1.5 rounded-2xl grid grid-cols-3 gap-2 w-full max-w-2xl shadow-lg h-auto">
              <TabsTrigger 
                value="contact-form" 
                className="flex items-center justify-center gap-2 py-3 px-2 sm:px-4 rounded-xl text-xs sm:text-sm font-semibold transition-all data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md text-slate-500 dark:text-slate-400"
              >
                <MessageSquare className="h-4 w-4" />
                <span className="hidden xs:inline">Обратная связь</span>
                <span className="inline xs:hidden">Связь</span>
              </TabsTrigger>
              <TabsTrigger 
                value="requisites" 
                className="flex items-center justify-center gap-2 py-3 px-2 sm:px-4 rounded-xl text-xs sm:text-sm font-semibold transition-all data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md text-slate-500 dark:text-slate-400"
              >
                <ShieldCheck className="h-4 w-4" />
                <span>Реквизиты</span>
              </TabsTrigger>
              <TabsTrigger 
                value="documents" 
                className="flex items-center justify-center gap-2 py-3 px-2 sm:px-4 rounded-xl text-xs sm:text-sm font-semibold transition-all data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md text-slate-500 dark:text-slate-400"
              >
                <FolderOpen className="h-4 w-4" />
                <span>Документы</span>
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Вкладка 1: Контакты и форма обратной связи */}
          <TabsContent value="contact-form" className="outline-none mt-0">
            <Contact />
          </TabsContent>

          {/* Вкладка 2: Реквизиты компании (Карта партнера) */}
          <TabsContent value="requisites" className="outline-none mt-0">
            <Requisites />
          </TabsContent>

          {/* Вкладка 3: Документы и договора */}
          <TabsContent value="documents" className="outline-none mt-0">
            <div className="py-4">
              <DocumentsList />
            </div>
          </TabsContent>

        </Tabs>

      </main>
      <Footer />
    </div>
  );
};

export default Kontakty;