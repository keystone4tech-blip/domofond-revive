import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings, Camera, Smartphone, CreditCard, Wrench } from "lucide-react";
import intercomSystem from "@/assets/intercom-system.jpg";
import cctvCamera from "@/assets/cctv-camera.jpg";
import smartphoneApp from "@/assets/repair-work.jpg"; // используем существующее изображение
import paymentSystem from "@/assets/maintenance-service.jpg"; // используем существующее изображение
import installationService from "@/assets/barrier-gate.jpg"; // используем существующее изображение

const SmartIntercom = () => {
  const navigate = useNavigate();
  const [isVisible, setIsVisible] = useState({
    header: false,
    text: false,
    columns: [false, false, false, false, false],
    infoBox: false,
  });

  useEffect(() => {
    // Анимация заголовка (0.5 сек)
    setTimeout(() => setIsVisible(prev => ({ ...prev, header: true })), 500);

    // Анимация текста (1.1 сек)
    setTimeout(() => setIsVisible(prev => ({ ...prev, text: true })), 1100);

    // Анимация колонок (1.4 сек)
    setTimeout(() => setIsVisible(prev => ({
      ...prev,
      columns: [true, true, true, true, true]
    })), 1400);

    // Анимация информационного блока (2.0 сек)
    setTimeout(() => setIsVisible(prev => ({ ...prev, infoBox: true })), 2000);
  }, []);

  const columnsData = [
    {
      icon: Settings,
      title: "Современное оборудование",
      description: "На подъезде появится новое современное оборудование, ключи от которого не сможет сделать посторонний человек, только собственник.",
      image: intercomSystem,
      features: ["Защита от подделки", "Только для собственников", "Надежное оборудование"]
    },
    {
      icon: Camera,
      title: "Камеры наблюдения",
      description: "Над Вашим подъездом появятся камеры, подключенные к общей диспетчерской службе города.",
      image: cctvCamera,
      features: ["Более 5000 камер", "Доступ МВД и МЧС", "Ежедневный контроль"]
    },
    {
      icon: Smartphone,
      title: "Управление с телефона",
      description: "Вашим домофоном можно управлять с телефона! Больше не нужна трубка и ключи.",
      image: smartphoneApp,
      features: ["Мобильное приложение", "Открытие двери удаленно", "Архив посетителей"]
    },
    {
      icon: CreditCard,
      title: "Удобная оплата",
      description: "Вам не нужно оплачивать все новое оборудование — мы установим его сами.",
      image: paymentSystem,
      features: ["Ежемесячная оплата", "Без предоплаты", "Для абонентов бесплатно"]
    },
    {
      icon: Wrench,
      title: "Обслуживание",
      description: "При монтаже системы мы произведем весь необходимый ремонт входной подъездной двери.",
      image: installationService,
      features: ["Ремонт двери", "Покраска", "Обслуживание оборудования"]
    }
  ];

  const scrollToContact = () => {
    navigate("/kontakty");
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      
      <main className="flex-1">
        {/* Шапка страницы */}
        <section className="py-8 md:py-12 bg-gradient-to-br from-primary/10 via-background to-primary/5">
          <div className="container">
            <div className="max-w-3xl mx-auto text-center">
              <h1
                className={`text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl ${
                  isVisible.header ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-10'
                } transition-all duration-700 ease-out`}
              >
                УМНЫЙ ДОМОФОН
              </h1>
              <p
                className={`text-lg text-muted-foreground mt-4 mb-6 ${
                  isVisible.text ? 'opacity-100' : 'opacity-0'
                } transition-opacity duration-700 delay-300`}
              >
                «Умный домофон — это уже давно не просто «замок» на двери, а комплексное решение для безопасности дома. Что входит в систему?»
              </p>
              <Button onClick={scrollToContact} size="lg" className="mt-4 gap-2">
                <Smartphone className="h-5 w-5" />
                Получить консультацию
              </Button>
            </div>
          </div>
        </section>

        {/* Сетка из 5 колонок */}
        <section className="py-8 md:py-16">
          <div className="container">
            <div className="grid gap-6 sm:gap-8 md:grid-cols-2 lg:grid-cols-3">
              {columnsData.map((column, index) => (
                <Card
                  key={index}
                  className={`group hover:shadow-xl transition-all duration-300 hover:-translate-y-1 overflow-hidden ${
                    isVisible.columns[index] 
                      ? 'opacity-100 translate-y-0 scale-100' 
                      : 'opacity-0 translate-y-10 scale-95'
                  } transition-all duration-700 ease-out`}
                >
                  <div className="relative h-40 sm:h-48 overflow-hidden">
                    <img
                      src={column.image}
                      alt={column.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-background/90 to-transparent" />
                    <div className="absolute bottom-3 left-3 sm:bottom-4 sm:left-4">
                      <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-lg bg-primary shadow-lg">
                        <column.icon className="h-5 w-5 sm:h-6 sm:w-6 text-primary-foreground" />
                      </div>
                    </div>
                  </div>
                  <CardHeader className="p-4 sm:p-6">
                    <CardTitle className="text-lg sm:text-xl">{column.title}</CardTitle>
                    <CardDescription className="text-sm sm:text-base">{column.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="p-4 sm:p-6 pt-0">
                    <ul className="space-y-2">
                      {column.features.map((feature, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-xs sm:text-sm">
                          <span className="text-primary mt-0.5 flex-shrink-0">✓</span>
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

        {/* Информационное сообщение */}
        <section className="py-16 md:py-24 bg-muted/30">
          <div className="container">
            <div className="max-w-3xl mx-auto">
              <div 
                className={`flex items-start gap-4 p-6 rounded-lg bg-background border border-border ${
                  isVisible.infoBox ? 'opacity-100' : 'opacity-0'
                } transition-opacity duration-700`}
              >
                <div className="text-2xl font-bold text-primary flex-shrink-0">i</div>
                <p className="text-muted-foreground">
                  Если при подключении новой системы вы хотите отказаться от старых трубок и поставить видеомониторы в квартирах или подключить мобильное приложение, то обязательно укажите эту информацию менеджеру, мы все согласуем с Вами и проведем все необходимые работы.
                </p>
              </div>
            </div>
          </div>
        </section>

      </main>
      
      <Footer />
    </div>
  );
};

export default SmartIntercom;