import { useState, useEffect } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Phone, Check } from "lucide-react";

const Domofony = () => {
  const [isVisible, setIsVisible] = useState({
    header: false,
    systems: [false, false, false],
    whyChooseUs: false
  });

  useEffect(() => {
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
        <section className="py-8 md:py-12 bg-gradient-to-br from-primary/10 via-background to-primary/5">
          <div className="container">
            <div className="max-w-3xl mx-auto text-center">
              <h1
                className={`text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl ${
                  isVisible.header ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-10'
                } transition-all duration-700 ease-out`}
              >
                Домофонные системы
              </h1>
              <p
                className={`text-lg text-muted-foreground mt-4 mb-6 ${
                  isVisible.header ? 'opacity-100' : 'opacity-0'
                } transition-opacity duration-700 delay-300`}
              >
                Профессиональная установка и обслуживание домофонов любой сложности.
                Гарантия качества и надежности.
              </p>
              <Button
                onClick={scrollToContact}
                size="lg"
                className={`gap-2 ${
                  isVisible.header ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
                } transition-all duration-300 hover:scale-105 active:scale-95`}
              >
                <Phone className="h-5 w-5" />
                Получить консультацию
              </Button>
            </div>
          </div>
        </section>

        {/* Types of Systems */}
        <section className="py-8 md:py-12">
          <div className="container">
            <div className="text-center mb-8">
              <h2
                className={`text-3xl font-bold tracking-tight sm:text-4xl mb-4 ${
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
                  className={`hover:shadow-lg transition-shadow ${
                    isVisible.systems[index]
                      ? 'opacity-100 translate-y-0 scale-100'
                      : 'opacity-0 translate-y-10 scale-95'
                  } transition-all duration-700 ease-out`}
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
            <div className="max-w-3xl mx-auto">
              <h2
                className={`text-3xl font-bold tracking-tight sm:text-4xl mb-8 text-center ${
                  isVisible.whyChooseUs ? 'opacity-100' : 'opacity-0'
                } transition-opacity duration-700`}
              >
                Почему выбирают нас
              </h2>
              <div className="grid gap-4 md:grid-cols-2">
                <Card
                  className={`${
                    isVisible.whyChooseUs ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-10 scale-95'
                  } transition-all duration-700 ease-out`}
                >
                  <CardHeader>
                    <CardTitle className="text-lg">Опыт более 10 лет</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Установили более 5000 домофонных систем в Москве и области
                    </p>
                  </CardContent>
                </Card>

                <Card
                  className={`${
                    isVisible.whyChooseUs ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-10 scale-95'
                  } transition-all duration-700 ease-out delay-100`}
                >
                  <CardHeader>
                    <CardTitle className="text-lg">Гарантия качества</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Официальная гарантия на оборудование до 3 лет
                    </p>
                  </CardContent>
                </Card>

                <Card
                  className={`${
                    isVisible.whyChooseUs ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-10 scale-95'
                  } transition-all duration-700 ease-out delay-200`}
                >
                  <CardHeader>
                    <CardTitle className="text-lg">Быстрый монтаж</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Установка домофона за 1 день с полной настройкой
                    </p>
                  </CardContent>
                </Card>

                <Card
                  className={`${
                    isVisible.whyChooseUs ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-10 scale-95'
                  } transition-all duration-700 ease-out delay-300`}
                >
                  <CardHeader>
                    <CardTitle className="text-lg">Сервисная поддержка</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Техническая поддержка и обслуживание 24/7
                    </p>
                  </CardContent>
                </Card>
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
