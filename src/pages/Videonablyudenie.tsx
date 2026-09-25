import { useState, useEffect } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { ShinyButton } from "@/components/ui/shiny-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Camera, Check, Cloud, Shield, Smartphone } from "lucide-react";

const Videonablyudenie = () => {
  const [isVisible, setIsVisible] = useState({
    header: false,
    solutions: [false, false, false],
    features: [false, false, false, false],
    cta: false
  });

  useEffect(() => {
    console.log("[Videonablyudenie] Страница 'Видеонаблюдение' смонтирована. Заголовки переведены на единый градиентный стиль.");
    // Анимация заголовка (0.5 сек)
    setTimeout(() => setIsVisible(prev => ({ ...prev, header: true })), 500);

    // Анимация решений (1.0 сек)
    setTimeout(() => setIsVisible(prev => ({
      ...prev,
      solutions: [true, true, true]
    })), 1000);

    // Анимация возможностей (1.5 сек)
    setTimeout(() => setIsVisible(prev => ({
      ...prev,
      features: [true, true, true, true]
    })), 1500);

    // Анимация CTA (2.0 сек)
    setTimeout(() => setIsVisible(prev => ({ ...prev, cta: true })), 2000);
  }, []);

  const scrollToContact = () => {
    window.location.href = "/#contact";
  };

  const solutions = [
    {
      title: "Для квартиры",
      description: "Компактные решения для домашней безопасности",
      price: "от 12 000 ₽",
      features: [
        "2-4 камеры",
        "Облачное хранение 7 дней",
        "Мобильное приложение",
        "Быстрая установка",
      ],
    },
    {
      title: "Для коттеджа",
      description: "Полный контроль территории",
      price: "от 35 000 ₽",
      features: [
        "4-8 камер с ночным видением",
        "Хранение до 30 дней",
        "Детекция движения",
        "Интеграция с охранной системой",
      ],
    },
    {
      title: "Для бизнеса",
      description: "Профессиональные системы безопасности",
      price: "от 80 000 ₽",
      features: [
        "Неограниченное количество камер",
        "Аналитика и отчеты",
        "Серверное хранение",
        "Гарантия до 3 лет и выезд до 2 дней",
      ],
    },
  ];

  const features = [
    {
      icon: Camera,
      title: "HD качество",
      description: "Камеры с разрешением до 4K для четкой картинки",
    },
    {
      icon: Cloud,
      title: "Облачное хранение",
      description: "Безопасное хранение записей в облаке с доступом из любой точки",
    },
    {
      icon: Smartphone,
      title: "Удаленный доступ",
      description: "Просмотр в реальном времени через мобильное приложение",
    },
    {
      icon: Shield,
      title: "Защита данных",
      description: "Шифрование данных и защита от несанкционированного доступа",
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
                Видеонаблюдение
              </h1>
              <p
                className={`text-base sm:text-lg text-muted-foreground mt-4 mb-6 max-w-2xl mx-auto leading-relaxed ${
                  isVisible.header ? 'opacity-100' : 'opacity-0'
                } transition-opacity duration-700 delay-300`}
              >
                Современные системы видеонаблюдения для дома и бизнеса.
                Полный контроль безопасности объекта в режиме реального времени.
              </p>
              <ShinyButton
                onClick={scrollToContact}
                className={`gap-2 ${
                  isVisible.header ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
                } transition-all duration-300`}
              >
                <Camera className="h-5 w-5" />
                Заказать расчет системы
              </ShinyButton>
            </div>
          </div>
        </section>

        {/* Solutions */}
        <section className="py-8 md:py-12">
          <div className="container">
            <div className="text-center mb-8">
              {/* Унифицированный градиентный заголовок */}
              <h2
                className={`text-3xl sm:text-4xl mb-4 section-title-gradient ${
                  isVisible.solutions[0] ? 'opacity-100' : 'opacity-0'
                } transition-opacity duration-700`}
              >
                Готовые решения
              </h2>
              <p
                className={`text-lg text-muted-foreground max-w-2xl mx-auto ${
                  isVisible.solutions[0] ? 'opacity-100' : 'opacity-0'
                } transition-opacity duration-700 delay-200`}
              >
                Системы видеонаблюдения под ключ для любых задач
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {solutions.map((solution, index) => (
                <Card
                  key={index}
                  className={`hover:shadow-lg transition-shadow ${
                    isVisible.solutions[index]
                      ? 'opacity-100 translate-y-0 scale-100'
                      : 'opacity-0 translate-y-10 scale-95'
                  } transition-all duration-700 ease-out`}
                >
                  <CardHeader>
                    <CardTitle>{solution.title}</CardTitle>
                    <CardDescription>{solution.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="text-2xl font-bold text-primary">{solution.price}</div>
                    <ul className="space-y-2">
                      {solution.features.map((feature, idx) => (
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

        {/* Features */}
        <section className="py-8 md:py-12 bg-muted/30">
          <div className="container">
            <div className="text-center mb-8">
              {/* Унифицированный градиентный заголовок */}
              <h2
                className={`text-3xl sm:text-4xl mb-4 section-title-gradient ${
                  isVisible.features[0] ? 'opacity-100' : 'opacity-0'
                } transition-opacity duration-700`}
              >
                Возможности систем
              </h2>
              <p
                className={`text-lg text-muted-foreground max-w-2xl mx-auto ${
                  isVisible.features[0] ? 'opacity-100' : 'opacity-0'
                } transition-opacity duration-700 delay-200`}
              >
                Современные технологии для вашей безопасности
              </p>
            </div>

            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
              {features.map((feature, index) => (
                <div
                  key={index}
                  className={`shiny-border-card group cursor-default ${
                    isVisible.features[index]
                      ? 'opacity-100 translate-y-0 scale-100'
                      : 'opacity-0 translate-y-10 scale-95'
                  } transition-all duration-700 ease-out`}
                >
                  <div className="shiny-border-card-inner p-6 flex flex-col items-center text-center h-full justify-start">
                    {/* Переливающийся бейдж иконки */}
                    <div className="shiny-icon-badge mb-4">
                      <div className="shiny-icon-badge-inner">
                        <feature.icon className="h-6 w-6 text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform duration-300" />
                      </div>
                    </div>
                    
                    {/* Заголовок с легким переливом при наведении */}
                    <h3 className="text-lg font-bold tracking-tight text-foreground mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {feature.title}
                    </h3>

                    {/* Описание технологии */}
                    <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-8 md:py-12">
          <div className="container">
            <div className="max-w-3xl mx-auto text-center">
              {/* Унифицированный градиентный заголовок */}
              <h2
                className={`text-3xl sm:text-4xl mb-4 section-title-gradient ${
                  isVisible.cta ? 'opacity-100' : 'opacity-0'
                } transition-opacity duration-700`}
              >
                Бесплатный выезд специалиста
              </h2>
              <p
                className={`text-lg text-muted-foreground mb-8 ${
                  isVisible.cta ? 'opacity-100' : 'opacity-0'
                } transition-opacity duration-700 delay-200`}
              >
                Наш инженер произведет осмотр объекта и составит оптимальное решение
                с учетом всех ваших требований
              </p>
              <ShinyButton
                onClick={scrollToContact}
                className={`${
                  isVisible.cta ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
                } transition-all duration-300`}
              >
                Вызвать специалиста
              </ShinyButton>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default Videonablyudenie;
