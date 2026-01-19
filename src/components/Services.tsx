import { Wrench, Settings, Shield, Camera, DoorClosed, Building } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import intercomSystem from "@/assets/intercom-system.jpg";
import cctvCamera from "@/assets/cctv-camera.jpg";
import barrierGate from "@/assets/barrier-gate.jpg";
import repairWork from "@/assets/repair-work.jpg";
import maintenanceService from "@/assets/maintenance-service.jpg";
import constructionWork from "@/assets/construction-work.jpg";

const services = [
  {
    icon: Settings,
    title: "Установка домофонов",
    description: "Монтаж и настройка современных домофонных систем с гарантией качества",
    image: intercomSystem,
    features: ["Цифровые и аналоговые системы", "Видеодомофоны", "Система контроля доступа"]
  },
  {
    icon: Camera,
    title: "Видеонаблюдение",
    description: "Проектирование и установка систем видеонаблюдения для объектов любой сложности",
    image: cctvCamera,
    features: ["IP и аналоговые камеры", "Удаленный доступ", "Облачное хранилище"]
  },
  {
    icon: DoorClosed,
    title: "Шлагбаумы и СКУД",
    description: "Установка автоматических шлагбаумов и систем контроля управления доступом",
    image: barrierGate,
    features: ["Автоматические шлагбаумы", "RFID-системы", "Интеграция с домофонами"]
  },
  {
    icon: Wrench,
    title: "Ремонт и диагностика",
    description: "Оперативный ремонт любых неисправностей домофонного оборудования",
    image: repairWork,
    features: ["Замена трубок и панелей", "Ремонт электронных блоков", "Восстановление связи"]
  },
  {
    icon: Shield,
    title: "Техническое обслуживание",
    description: "Регулярное сервисное обслуживание для бесперебойной работы систем",
    image: maintenanceService,
    features: ["Профилактические работы", "Чистка и настройка", "Замена расходников"]
  },
  {
    icon: Building,
    title: "Сотрудничество и подрядные работы",
    description: "Выполнение монтажных работ и проектов любой сложности на взаимовыгодных условиях",
    image: constructionWork,
    features: ["Подрядные работы", "Монтаж сложных систем", "Гибкие условия сотрудничества"]
  },
];

const Services = () => {
  return (
    <section id="services" className="py-8 md:py-12 bg-muted/30">
      <div className="container">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl mb-4">
            Наши услуги
          </h2>
          <p className="text-base text-muted-foreground max-w-2xl mx-auto">
            Полный спектр услуг по обслуживанию домофонных систем для жилых и коммерческих объектов
          </p>
        </div>

        <div className="grid gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
          {services.map((service, index) => (
            <Card 
              key={index} 
              className="group hover:shadow-xl transition-all duration-300 hover:-translate-y-1 overflow-hidden"
            >
              <div className="relative h-40 sm:h-48 overflow-hidden">
                <img 
                  src={service.image} 
                  alt={service.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background/90 to-transparent" />
                <div className="absolute bottom-3 left-3 sm:bottom-4 sm:left-4">
                  <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-lg bg-primary shadow-lg">
                    <service.icon className="h-5 w-5 sm:h-6 sm:w-6 text-primary-foreground" />
                  </div>
                </div>
              </div>
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="text-lg sm:text-xl">{service.title}</CardTitle>
                <CardDescription className="text-sm sm:text-base">{service.description}</CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 pt-0">
                <ul className="space-y-2">
                  {service.features.map((feature, idx) => (
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
  );
};

export default Services;
