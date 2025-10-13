import { Wrench, Settings, Shield } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import serviceInstall from "@/assets/service-install.jpg";
import serviceRepair from "@/assets/service-repair.jpg";
import serviceMaintenance from "@/assets/service-maintenance.jpg";

const services = [
  {
    icon: Settings,
    title: "Установка домофонов",
    description: "Монтаж и настройка современных домофонных систем с гарантией качества",
    image: serviceInstall,
    features: ["Цифровые и аналоговые системы", "Видеодомофоны", "Система контроля доступа"]
  },
  {
    icon: Wrench,
    title: "Ремонт и диагностика",
    description: "Оперативный ремонт любых неисправностей домофонного оборудования",
    image: serviceRepair,
    features: ["Замена трубок и панелей", "Ремонт электронных блоков", "Восстановление связи"]
  },
  {
    icon: Shield,
    title: "Техническое обслуживание",
    description: "Регулярное сервисное обслуживание для бесперебойной работы систем",
    image: serviceMaintenance,
    features: ["Профилактические работы", "Чистка и настройка", "Замена расходников"]
  },
];

const Services = () => {
  return (
    <section id="services" className="py-16 md:py-24 bg-muted/30">
      <div className="container">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl mb-4">
            Наши услуги
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Полный спектр услуг по обслуживанию домофонных систем для жилых и коммерческих объектов
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {services.map((service, index) => (
            <Card 
              key={index} 
              className="group hover:shadow-xl transition-all duration-300 hover:-translate-y-1 overflow-hidden"
            >
              <div className="relative h-48 overflow-hidden">
                <img 
                  src={service.image} 
                  alt={service.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background/90 to-transparent" />
                <div className="absolute bottom-4 left-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary shadow-lg">
                    <service.icon className="h-6 w-6 text-primary-foreground" />
                  </div>
                </div>
              </div>
              <CardHeader>
                <CardTitle className="text-xl">{service.title}</CardTitle>
                <CardDescription className="text-base">{service.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {service.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm">
                      <span className="text-primary mt-0.5">✓</span>
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
