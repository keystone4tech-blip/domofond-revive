import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Phone, Check } from "lucide-react";

const Domofony = () => {
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
        <section className="py-16 md:py-24 bg-gradient-to-br from-primary/10 via-background to-primary/5">
          <div className="container">
            <div className="max-w-3xl mx-auto text-center">
              <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl mb-6">
                Домофонные системы
              </h1>
              <p className="text-xl text-muted-foreground mb-8">
                Профессиональная установка и обслуживание домофонов любой сложности.
                Гарантия качества и надежности.
              </p>
              <Button onClick={scrollToContact} size="lg" className="gap-2">
                <Phone className="h-5 w-5" />
                Получить консультацию
              </Button>
            </div>
          </div>
        </section>

        {/* Types of Systems */}
        <section className="py-16 md:py-24">
          <div className="container">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">
                Типы домофонных систем
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Подберем оптимальное решение для вашего объекта
              </p>
            </div>

            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
              {systems.map((system, index) => (
                <Card key={index} className="hover:shadow-lg transition-shadow">
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
        <section className="py-16 md:py-24 bg-muted/30">
          <div className="container">
            <div className="max-w-3xl mx-auto">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-8 text-center">
                Почему выбирают нас
              </h2>
              <div className="grid gap-6 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Опыт более 10 лет</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Установили более 5000 домофонных систем в Москве и области
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Гарантия качества</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Официальная гарантия на оборудование до 3 лет
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Быстрый монтаж</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Установка домофона за 1 день с полной настройкой
                    </p>
                  </CardContent>
                </Card>

                <Card>
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
