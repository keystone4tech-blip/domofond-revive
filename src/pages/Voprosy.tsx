import { useState, useEffect } from "react";
import Header from "@/components/Header";
import FAQ from "@/components/FAQ";
import Footer from "@/components/Footer";

/**
 * Страница Вопросы и ответы ООО «ДомофонДар»
 * Рендерит компонент FAQ с пошаговой плавной анимацией появления шапки и контента.
 */
const Voprosy = () => {
  // Состояния для пошаговой анимации элементов страницы
  const [isVisible, setIsVisible] = useState({
    header: false,
    faq: false
  });

  useEffect(() => {
    // Пошаговый запуск анимаций
    console.log("[Voprosy] Страница 'Вопросы и ответы' смонтирована. Запуск анимаций появления элементов.");
    const headerTimer = setTimeout(() => setIsVisible(prev => ({ ...prev, header: true })), 400);
    const faqTimer = setTimeout(() => setIsVisible(prev => ({ ...prev, faq: true })), 800);
    
    return () => {
      clearTimeout(headerTimer);
      clearTimeout(faqTimer);
    };
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 overflow-hidden">
        {/* Шапка страницы "Вопросы и ответы" в едином стиле */}
        <section className="py-8 md:py-12 bg-gradient-to-br from-primary/10 via-background to-primary/5">
          <div className="container">
            <div className="max-w-3xl mx-auto text-center">
              {/* Унифицированный градиентный заголовок с анимацией появления сверху вниз */}
              <h1
                className={`text-3xl sm:text-4xl md:text-5xl section-title-gradient transition-all duration-700 ease-out ${
                  isVisible.header ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-10'
                }`}
              >
                Вопросы и ответы
              </h1>
              <p
                className={`text-lg text-muted-foreground mt-4 mb-2 transition-all duration-700 delay-200 ease-out ${
                  isVisible.header ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'
                }`}
              >
                Найдите ответы на часто задаваемые вопросы о наших услугах, установке и техническом обслуживании домофонов.
              </p>
            </div>
          </div>
        </section>

        {/* Блок FAQ с плавной анимацией появления снизу вверх */}
        <div
          className={`transition-all duration-1000 ease-out ${
            isVisible.faq ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-10 scale-95'
          }`}
        >
          <FAQ />
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Voprosy;