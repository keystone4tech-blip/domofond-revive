import { useState, useEffect } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { ShinyButton } from "@/components/ui/shiny-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Phone, Check, Clock, ShieldCheck, Zap, Wrench } from "lucide-react";

const Domofony = () => {
  const [isVisible, setIsVisible] = useState({
    header: false,
    systems: [false, false, false],
    whyChooseUs: false
  });

  useEffect(() => {
    console.log("[Domofony] Страница 'Домофонные системы' смонтирована. Заголовки страниц и подразделов переведены на единый градиентный стиль.");
    // Анимация заголовка (0.5 сек)
    setTimeout(() => setIsVisible(prev => ({ ...prev, header: true })), 500);

    // Анимация систем (1.0 сек)
    setTimeout(() => setIsVisible(prev => ({
      ...prev,
      systems: [true, true, true]
    })), 1000);

    // Анимация блока "Почему выбирают нас" (1.5 сек)
    setTimeout(() => setIsVisible(prev => ({ ...prev, whyChooseUs: true })), 1500);
  }, []);

  const scrollToContact = () => {
    window.location.href = "/#contact";
  };

  const systems = [
    {
      title: "Аудиодомофоны",
      description: "Надежные системы голосовой связи",
      price: "от 8 000 ₽",
      features: [
        "Кристально чистый звук",
        "Простота использования",
        "Долгий срок службы",
        "Доступная стоимость",
      ],
    },
    {
      title: "Видеодомофоны",
      description: "Визуальный контроль посетителей",
      price: "от 15 000 ₽",
      features: [
        "Цветной дисплей 7-10 дюймов",
        "Запись видео на карту памяти",
        "Ночной режим работы",
        "Двусторонняя связь",
      ],
    },
    {
      title: "IP-домофоны",
      description: "Современные сетевые решения",
      price: "от 20 000 ₽",
      features: [
        "Удаленный доступ через интернет",
        "Интеграция с системами безопасности",
        "Облачное хранение записей",
        "Мобильное приложение",
      ],
    },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        {/* Hero Section */}
        <section className="py-8 md:py-12 bg-gradient-to-br from-primary/10 via-background to-primary/5 border-b border-border/40">
          <div className="container px-4">
            <div className="max-w-3xl mx-auto text-center">
              {/* Унифицированный переливающийся заголовок */}
              <h1
                className={`text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight hero-title-shimmer ${
                  isVisible.header ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-10'
                } transition-all duration-700 ease-out`}
              >
                Домофонные системы
              </h1>
              <p
                className={`text-base sm:text-lg text-muted-foreground mt-4 mb-6 max-w-2xl mx-auto leading-relaxed ${
                  isVisible.header ? 'opacity-100' : 'opacity-0'
                } transition-opacity duration-700 delay-300`}
              >
                Профессиональная установка и обслуживание домофонов любой сложности.
                Гарантия качества и надежности.
              </p>
              <ShinyButton
                onClick={scrollToContact}
                className={`gap-2 ${
                  isVisible.header ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
                } transition-all duration-300`}
              >
                <Phone className="h-5 w-5" />
                Получить консультацию
              </ShinyButton>
            </div>
          </div>
        </section>

        {/* Types of Systems */}
        <section className="py-8 md:py-12">
          <div className="container">
            <div className="text-center mb-8">
              {/* Унифицированный градиентный заголовок */}
              <h2
                className={`text-3xl sm:text-4xl mb-4 section-title-gradient ${
                  isVisible.systems[0] ? 'opacity-100' : 'opacity-0'
                } transition-opacity duration-700`}
              >
                Типы домофонных систем
              </h2>
              <p
                className={`text-lg text-muted-foreground max-w-2xl mx-auto ${
                  isVisible.systems[0] ? 'opacity-100' : 'opacity-0'
                } transition-opacity duration-700 delay-200`}
              >
                Подберем оптимальное решение для вашего объекта
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {systems.map((system, index) => (
                <Card
                  key={index}
                  className={`hover:shadow-2xl hover:-translate-y-1.5 border border-transparent hover:border-primary/30 dark:hover:border-primary/50 hover:bg-slate-50/50 dark:hover:bg-slate-900/50 cursor-pointer transition-all duration-300 ${
                    isVisible.systems[index]
                      ? 'opacity-100 translate-y-0 scale-100'
                      : 'opacity-0 translate-y-10 scale-95'
                  } ease-out`}
                >
                  <CardHeader>
                    <CardTitle>{system.title}</CardTitle>
                    <CardDescription>{system.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="text-2xl font-bold text-primary">{system.price}</div>
                    <ul className="space-y-2">
                      {system.features.map((feature, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm">
                          <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Why Choose Us */}
        <section className="py-8 md:py-12 bg-muted/30">
          <div className="container">
            <div className="max-w-3xl mx-auto text-center">
              {/* Унифицированный градиентный заголовок с правильным центрированием в родительском контейнере */}
              <h2
                className={`text-3xl sm:text-4xl mb-8 text-center section-title-gradient ${
                  isVisible.whyChooseUs ? 'opacity-100' : 'opacity-0'
                } transition-opacity duration-700`}
              >
                Почему выбирают нас
              </h2>
              <div className="grid gap-5 md:grid-cols-2">
                
                {/* Карточка 1: Опыт в Краснодаре и ЮФО */}
                <div
                  className={`shiny-border-card group cursor-default ${
                    isVisible.whyChooseUs ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-10 scale-95'
                  } transition-all duration-700 ease-out`}
                >
                  <div className="shiny-border-card-inner p-6 flex flex-col items-center text-center h-full justify-start">
                    <div className="shiny-icon-badge mb-3">
                      <div className="shiny-icon-badge-inner">
                        <Clock className="h-6 w-6 text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform duration-300" />
                      </div>
                    </div>
                    <h3 className="text-lg font-bold tracking-tight text-foreground mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      7 лет в Краснодаре
                    </h3>
                    <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                      Более 20 лет опыта по Югу России и свыше 11 200 абонентов на постоянном обслуживании
                    </p>
                  </div>
                </div>

                {/* Карточка 2: Официальная гарантия */}
                <div
                  className={`shiny-border-card group cursor-default ${
                    isVisible.whyChooseUs ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-10 scale-95'
                  } transition-all duration-700 ease-out delay-100`}
                >
                  <div className="shiny-border-card-inner p-6 flex flex-col items-center text-center h-full justify-start">
                    <div className="shiny-icon-badge mb-3">
                      <div className="shiny-icon-badge-inner">
                        <ShieldCheck className="h-6 w-6 text-emerald-500 group-hover:scale-110 transition-transform duration-300" />
                      </div>
                    </div>
                    <h3 className="text-lg font-bold tracking-tight text-foreground mb-2 group-hover:text-emerald-500 transition-colors">
                      Гарантия до 3 лет
                    </h3>
                    <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                      Официальная заводская гарантия на оборудование и до 1 года на выполненные монтажные работы
                    </p>
                  </div>
                </div>

                {/* Карточка 3: Монтаж за 1 день */}
                <div
                  className={`shiny-border-card group cursor-default ${
                    isVisible.whyChooseUs ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-10 scale-95'
                  } transition-all duration-700 ease-out delay-200`}
                >
                  <div className="shiny-border-card-inner p-6 flex flex-col items-center text-center h-full justify-start">
                    <div className="shiny-icon-badge mb-3">
                      <div className="shiny-icon-badge-inner">
                        <Wrench className="h-6 w-6 text-primary group-hover:scale-110 transition-transform duration-300" />
                      </div>
                    </div>
                    <h3 className="text-lg font-bold tracking-tight text-foreground mb-2 group-hover:text-primary transition-colors">
                      Чистый монтаж за 1 день
                    </h3>
                    <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                      Установка домофонной системы, доводчиков и замков под ключ с полной настройкой всех квартир
                    </p>
                  </div>
                </div>

                {/* Карточка 4: Рекордный сервис до 2 дней вместо недействительного 24/7 */}
                <div
                  className={`shiny-border-card group cursor-default ${
                    isVisible.whyChooseUs ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-10 scale-95'
                  } transition-all duration-700 ease-out delay-300`}
                >
                  <div className="shiny-border-card-inner p-6 flex flex-col items-center text-center h-full justify-start">
                    <div className="shiny-icon-badge mb-3">
                      <div className="shiny-icon-badge-inner">
                        <Zap className="h-6 w-6 text-amber-500 group-hover:scale-110 transition-transform duration-300" />
                      </div>
                    </div>
                    <h3 className="text-lg font-bold tracking-tight text-foreground mb-2 group-hover:text-amber-500 transition-colors">
                      Оперативный сервис
                    </h3>
                    <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                      Выполнение заявок на диагностику и ремонт до 2 рабочих дней — лучшая скорость сервиса в Краснодаре
                    </p>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default Domofony;
