import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Header from "@/components/Header";
import Contact from "@/components/Contact";
import Requisites from "@/components/Requisites";
import DocumentsList from "@/components/DocumentsList";
import Footer from "@/components/Footer";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageSquare, ShieldCheck, FolderOpen } from "lucide-react";

/**
 * Варианты анимации для плавного сдвига (slide) вкладок влево или вправо.
 * В зависимости от направления (direction):
 * - direction > 0: Вперед (слева направо). Вход справа, выход влево.
 * - direction < 0: Назад (справа налево). Вход слева, выход вправо.
 */
const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 300 : -300, // Мягкое смещение 300px для мобильной адаптивности
    opacity: 0
  }),
  center: {
    x: 0,
    opacity: 1
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -300 : 300,
    opacity: 0
  })
};

/**
 * Страница Контакты ООО «ДомофонДар»
 * Включает интерактивные вкладки для обратной связи, реквизитов (Карты партнера) и документации.
 * Реализовано плавное переключение между вкладками на базе framer-motion.
 */
const Kontakty = () => {
  const [isVisible, setIsVisible] = useState(false);

  // Стейты для управления вкладками и направлением анимации
  const tabsOrder = ["contact-form", "requisites", "documents"];
  const [activeTab, setActiveTab] = useState("contact-form");
  const [direction, setDirection] = useState(0); // -1 — назад (влево), 1 — вперед (вправо)

  useEffect(() => {
    // Анимация плавного появления контента страницы
    console.log("[Контакты] Инициализация страницы контактов...");
    const timer = setTimeout(() => setIsVisible(true), 200);
    return () => clearTimeout(timer);
  }, []);

  /**
   * Обработчик переключения вкладок
   * Вычисляет направление анимации на основе разницы индексов новой и старой вкладок
   */
  const handleTabChange = (newTab: string) => {
    const currentIndex = tabsOrder.indexOf(activeTab);
    const newIndex = tabsOrder.indexOf(newTab);
    const newDirection = newIndex > currentIndex ? 1 : -1;
    
    console.log(`[Контакты] Смена вкладки: ${activeTab} -> ${newTab} (направление: ${newDirection})`);
    
    setDirection(newDirection);
    setActiveTab(newTab);
  };

  return (
    <div className="min-h-screen transition-colors duration-300">
      <Header />
      <main className={`container mx-auto px-4 py-8 md:py-16 max-w-7xl transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        
        {/* Интерактивные вкладки на странице контактов с контролируемым значением */}
        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-8">
          
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

          {/* Анимированный контейнер для отображения контента вкладки */}
          <div className="relative overflow-hidden w-full min-h-[500px]">
            <AnimatePresence initial={false} mode="wait" custom={direction}>
              <motion.div
                key={activeTab}
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{
                  x: { type: "spring", stiffness: 300, damping: 30 },
                  opacity: { duration: 0.15 }
                }}
                className="w-full focus:outline-none"
              >
                {activeTab === "contact-form" && <Contact />}
                {activeTab === "requisites" && <Requisites />}
                {activeTab === "documents" && (
                  <div className="py-4">
                    <DocumentsList />
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

        </Tabs>

      </main>
      <Footer />
    </div>
  );
};

export default Kontakty;