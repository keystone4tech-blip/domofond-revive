import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import heroImage from "@/assets/hero-image.jpg";

const Hero = () => {
  const scrollToContact = () => {
    const element = document.getElementById("contact");
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <section className="relative overflow-hidden bg-background">
      {/* Animated security background */}
      <div className="absolute inset-0 overflow-hidden opacity-10">
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-secondary to-primary animate-[gradient_8s_ease_infinite] bg-[length:200%_200%]" />
        <div className="absolute inset-0" style={{
          backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 2px, hsl(var(--primary) / 0.1) 2px, hsl(var(--primary) / 0.1) 4px),
                           repeating-linear-gradient(90deg, transparent, transparent 2px, hsl(var(--primary) / 0.1) 2px, hsl(var(--primary) / 0.1) 4px)`,
          backgroundSize: '50px 50px',
          animation: 'slide 20s linear infinite'
        }} />
      </div>

      <div className="container px-4 py-12 md:py-24 relative z-10">
        <div className="grid gap-8 lg:grid-cols-2 lg:gap-12 items-center">
          <div className="flex flex-col gap-6">
            <div className="space-y-4">
              <h1 className="text-5xl font-extrabold tracking-tight sm:text-6xl md:text-7xl lg:text-8xl animate-fade-in">
                ООО <span className="text-primary">"Домофондар"</span>
              </h1>
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl lg:text-5xl text-muted-foreground animate-fade-in" style={{ animationDelay: '0.2s' }}>
                Профессиональное обслуживание домофонов
              </h2>
            </div>
            <p className="text-base text-muted-foreground md:text-lg animate-fade-in" style={{ animationDelay: '0.4s' }}>
              Обеспечиваем безопасность вашего дома. Установка, ремонт и техническое обслуживание домофонных систем, видеонаблюдения и систем контроля доступа любой сложности. 
              Работаем быстро, качественно и с гарантией.
            </p>
            <div className="flex flex-col gap-3 animate-fade-in" style={{ animationDelay: '0.6s' }}>
              <div className="flex items-center gap-2 hover-scale">
                <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                <span className="text-sm md:text-base">Выезд мастера в течение 2 часов</span>
              </div>
              <div className="flex items-center gap-2 hover-scale">
                <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                <span className="text-sm md:text-base">Гарантия на все работы до 3 лет</span>
              </div>
              <div className="flex items-center gap-2 hover-scale">
                <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                <span className="text-sm md:text-base">Работаем с 2005 года, более 10 000 клиентов</span>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 animate-fade-in" style={{ animationDelay: '0.8s' }}>
              <Button 
                size="lg" 
                className="gradient-primary text-primary-foreground hover:opacity-90 transition-opacity shadow-lg text-sm sm:text-base w-full sm:w-auto"
                onClick={scrollToContact}
              >
                Заказать звонок
                <ArrowRight className="ml-2 h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
              <Button 
                size="lg" 
                variant="outline"
                onClick={() => {
                  const element = document.getElementById("services");
                  if (element) element.scrollIntoView({ behavior: "smooth" });
                }}
                className="text-sm sm:text-base w-full sm:w-auto"
              >
                Наши услуги
              </Button>
            </div>
          </div>
          <div className="relative mt-8 lg:mt-0">
            <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 to-secondary/20 rounded-2xl blur-3xl" />
            <img
              src={heroImage}
              alt="Профессиональная установка домофонов"
              className="relative rounded-2xl shadow-2xl w-full h-auto object-cover"
            />
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
