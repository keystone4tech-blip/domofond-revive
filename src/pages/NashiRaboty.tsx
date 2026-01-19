import { useState, useEffect } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const NashiRaboty = () => {
  const [isVisible, setIsVisible] = useState({
    header: false,
    projects: Array(6).fill(false), // 6 проектов
    stats: [false, false, false, false]
  });

  useEffect(() => {
    // Анимация заголовка (0.5 сек)
    setTimeout(() => setIsVisible(prev => ({ ...prev, header: true })), 500);

    // Анимация проектов (1.0 сек)
    setTimeout(() => setIsVisible(prev => ({
      ...prev,
      projects: Array(6).fill(true)
    })), 1000);

    // Анимация статистики (1.5 сек)
    setTimeout(() => setIsVisible(prev => ({
      ...prev,
      stats: [true, true, true, true]
    })), 1500);
  }, []);

  const projects = [
    {
      title: "ЖК «Комфорт»",
      location: "Москва, ул. Тверская",
      type: "Многоквартирный дом",
      description: "Установка 156 видеодомофонов с IP-технологией и облачным хранением",
      features: ["IP-домофоны", "Облачное хранение", "Мобильное приложение"],
    },
    {
      title: "Коттеджный поселок «Зеленый бор»",
      location: "Московская область",
      type: "Коттеджный поселок",
      description: "Комплексная система: видеонаблюдение, домофоны, СКУД с автоматическими шлагбаумами",
      features: ["45 камер видеонаблюдения", "Шлагбаумы", "СКУД"],
    },
    {
      title: "Бизнес-центр «Столица»",
      location: "Москва, ММДЦ",
      type: "Бизнес-центр",
      description: "Профессиональная система безопасности с распознаванием лиц",
      features: ["Распознавание лиц", "Интеграция с СКУД", "Серверное хранение"],
    },
    {
      title: "ТЦ «Европейский»",
      location: "Москва, Площадь Киевского вокзала",
      type: "Торговый центр",
      description: "200+ камер видеонаблюдения с аналитикой посещаемости",
      features: ["200+ камер", "Аналитика", "Детекция движения"],
    },
    {
      title: "Жилой комплекс «Парк»",
      location: "Москва, ул. Ленинградская",
      type: "ЖК премиум-класса",
      description: "Умные домофоны с видеозвонками на телефон и архивом записей",
      features: ["Умные домофоны", "Видеозвонки", "Облачный архив"],
    },
    {
      title: "Производственный комплекс",
      location: "Московская область, Химки",
      type: "Производство",
      description: "Периметральное видеонаблюдение и контроль доступа сотрудников",
      features: ["Периметральная защита", "Биометрия", "Интеграция с 1C"],
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
                Наши работы
              </h1>
              <p
                className={`text-lg text-muted-foreground mt-4 mb-6 ${
                  isVisible.header ? 'opacity-100' : 'opacity-0'
                } transition-opacity duration-700 delay-300`}
              >
                Более 500 успешно реализованных проектов в Москве и Московской области
              </p>
            </div>
          </div>
        </section>

        {/* Projects Grid */}
        <section className="py-8 md:py-12">
          <div className="container">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {projects.map((project, index) => (
                <Card
                  key={index}
                  className={`hover:shadow-lg transition-shadow overflow-hidden ${
                    isVisible.projects[index]
                      ? 'opacity-100 translate-y-0 scale-100'
                      : 'opacity-0 translate-y-10 scale-95'
                  } transition-all duration-700 ease-out`}
                >
                  <div className="h-48 bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                    <div className="text-6xl font-bold text-primary/20">
                      {(index + 1).toString().padStart(2, '0')}
                    </div>
                  </div>
                  <CardContent className="p-6 space-y-4">
                    <div>
                      <Badge variant="secondary" className="mb-2">
                        {project.type}
                      </Badge>
                      <h3 className="text-xl font-bold mb-2">{project.title}</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        {project.location}
                      </p>
                    </div>

                    <p className="text-sm">{project.description}</p>

                    <div className="flex flex-wrap gap-2 pt-2">
                      {project.features.map((feature, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {feature}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Stats Section */}
        <section className="py-8 md:py-12 bg-muted/30">
          <div className="container">
            <div className="grid gap-4 md:grid-cols-4 text-center">
              <div
                className={`${
                  isVisible.stats[0] ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-10 scale-95'
                } transition-all duration-700 ease-out`}
              >
                <div className="text-4xl font-bold text-primary mb-2">500+</div>
                <div className="text-sm text-muted-foreground">Завершенных проектов</div>
              </div>
              <div
                className={`${
                  isVisible.stats[1] ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-10 scale-95'
                } transition-all duration-700 ease-out delay-100`}
              >
                <div className="text-4xl font-bold text-primary mb-2">10+</div>
                <div className="text-sm text-muted-foreground">Лет на рынке</div>
              </div>
              <div
                className={`${
                  isVisible.stats[2] ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-10 scale-95'
                } transition-all duration-700 ease-out delay-200`}
              >
                <div className="text-4xl font-bold text-primary mb-2">5000+</div>
                <div className="text-sm text-muted-foreground">Установленных систем</div>
              </div>
              <div
                className={`${
                  isVisible.stats[3] ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-10 scale-95'
                } transition-all duration-700 ease-out delay-300`}
              >
                <div className="text-4xl font-bold text-primary mb-2">98%</div>
                <div className="text-sm text-muted-foreground">Довольных клиентов</div>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default NashiRaboty;
