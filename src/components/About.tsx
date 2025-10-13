import { Award, Users, Clock, Shield } from "lucide-react";

const stats = [
  {
    icon: Users,
    value: "10 000+",
    label: "Довольных клиентов"
  },
  {
    icon: Clock,
    value: "18 лет",
    label: "На рынке с 2005 года"
  },
  {
    icon: Award,
    value: "100%",
    label: "Гарантия качества"
  },
  {
    icon: Shield,
    value: "24/7",
    label: "Аварийная служба"
  }
];

const About = () => {
  return (
    <section id="about" className="py-16 md:py-24">
      <div className="container">
        <div className="grid gap-12 lg:grid-cols-2 items-center">
          <div>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl mb-6">
              Почему выбирают нас
            </h2>
            <div className="space-y-4 text-muted-foreground">
              <p className="text-lg">
                <span className="font-semibold text-foreground">Домофондар</span> — это профессиональная команда 
                специалистов с многолетним опытом работы в сфере установки и обслуживания домофонных систем.
              </p>
              <p>
                Мы работаем как с жилыми комплексами, так и с коммерческими объектами, предлагая индивидуальный 
                подход к каждому клиенту. Наши специалисты регулярно проходят обучение и сертификацию, чтобы 
                предоставлять услуги высочайшего качества.
              </p>
              <p>
                Используем только проверенное оборудование от ведущих производителей и предоставляем расширенную 
                гарантию на все выполненные работы.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            {stats.map((stat, index) => (
              <div
                key={index}
                className="flex flex-col items-center justify-center p-6 rounded-xl bg-gradient-to-br from-primary/5 to-secondary/5 border border-border hover:border-primary/50 transition-colors"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 mb-4">
                  <stat.icon className="h-7 w-7 text-primary" />
                </div>
                <div className="text-3xl font-bold text-primary mb-2">{stat.value}</div>
                <div className="text-sm text-center text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default About;
