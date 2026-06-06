import { useState, useEffect } from "react";
import Header from "@/components/Header";
import FAQ from "@/components/FAQ";
import Footer from "@/components/Footer";

const Voprosy = () => {
  const [isVisible, setIsVisible] = useState({
    content: false
  });

  useEffect(() => {
    // Анимация содержимого (0.5 сек)
    setTimeout(() => setIsVisible(prev => ({ ...prev, content: true })), 500);
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main
        className={`flex-1 transition-opacity duration-700 ${
          isVisible.content ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {/* Шапка страницы "Вопросы и ответы" в едином стиле */}
        <section className="py-8 md:py-12 bg-gradient-to-br from-primary/10 via-background to-primary/5">
          <div className="container">
            <div className="max-w-3xl mx-auto text-center">
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
                Вопросы и ответы
              </h1>
              <p className="text-lg text-muted-foreground mt-4 mb-2">
                Найдите ответы на часто задаваемые вопросы о наших услугах, установке и техническом обслуживании домофонов.
              </p>
            </div>
          </div>
        </section>

        <FAQ />
      </main>
      <Footer />
    </div>
  );
};

export default Voprosy;