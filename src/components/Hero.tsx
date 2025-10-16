import { ArrowRight, CheckCircle2, Camera, DoorOpen, Settings, BrainCircuit } from "lucide-react";
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
    <section className="relative overflow-hidden bg-background min-h-[600px] md:min-h-[700px]">
      {/* Animated security background with floating icons */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 via-cyan-500/20 to-blue-600/20 animate-gradient bg-[length:200%_200%]" />
        
        {/* Floating animated icons */}
        <div className="absolute inset-0 opacity-15">
          <Camera className="absolute top-[10%] left-[15%] w-12 h-12 md:w-16 md:h-16 text-primary animate-[float_6s_ease-in-out_infinite]" />
          <DoorOpen className="absolute top-[60%] left-[10%] w-16 h-16 md:w-20 md:h-20 text-blue-600 animate-[float_7s_ease-in-out_infinite]" style={{ animationDelay: '1s' }} />
          <Settings className="absolute top-[20%] right-[20%] w-14 h-14 md:w-18 md:h-18 text-cyan-600 animate-[float_8s_ease-in-out_infinite]" style={{ animationDelay: '2s' }} />
          <BrainCircuit className="absolute top-[70%] right-[15%] w-12 h-12 md:w-16 md:h-16 text-primary animate-[float_6.5s_ease-in-out_infinite]" style={{ animationDelay: '0.5s' }} />
          <Camera className="absolute top-[40%] right-[25%] w-10 h-10 md:w-12 md:h-12 text-blue-500 animate-[float_7.5s_ease-in-out_infinite]" style={{ animationDelay: '3s' }} />
          <Settings className="absolute top-[80%] left-[25%] w-10 h-10 md:w-14 md:h-14 text-cyan-500 animate-[float_6s_ease-in-out_infinite]" style={{ animationDelay: '1.5s' }} />
        </div>
        
        {/* Subtle grid */}
        <div className="absolute inset-0 opacity-5" style={{
          backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 3px, hsl(var(--primary) / 0.3) 3px, hsl(var(--primary) / 0.3) 6px),
                           repeating-linear-gradient(90deg, transparent, transparent 3px, hsl(var(--primary) / 0.3) 3px, hsl(var(--primary) / 0.3) 6px)`,
          backgroundSize: '60px 60px',
          animation: 'slide 25s linear infinite'
        }} />
      </div>

      <div className="container px-4 py-8 md:py-12 lg:py-24 relative z-10">
        <div className="grid gap-6 md:gap-8 lg:grid-cols-2 lg:gap-12 items-center">
          <div className="flex flex-col gap-4 md:gap-6">
            <div className="space-y-2 md:space-y-4">
              <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl animate-fade-in bg-gradient-to-r from-primary via-blue-600 to-primary bg-clip-text text-transparent bg-[length:200%_auto] animate-gradient drop-shadow-lg">
                Домофондар
              </h1>
              <h2 className="text-lg font-bold tracking-tight sm:text-xl md:text-2xl lg:text-3xl xl:text-4xl text-foreground/90 animate-fade-in drop-shadow-md" style={{ animationDelay: '0.2s' }}>
                Профессиональное обслуживание домофонов
              </h2>
            </div>
            <p className="text-sm sm:text-base md:text-lg text-foreground/80 animate-fade-in drop-shadow" style={{ animationDelay: '0.4s' }}>
              Обеспечиваем безопасность вашего дома. Установка, ремонт и техническое обслуживание домофонных систем, видеонаблюдения и систем контроля доступа любой сложности. 
              Работаем быстро, качественно и с гарантией.
            </p>
            <div className="flex flex-col gap-2 md:gap-3 animate-fade-in" style={{ animationDelay: '0.6s' }}>
              <div className="flex items-center gap-2 hover-scale">
                <CheckCircle2 className="h-4 w-4 md:h-5 md:w-5 text-primary flex-shrink-0" />
                <span className="text-xs sm:text-sm md:text-base text-foreground/80">Выезд мастера в течение 2 часов</span>
              </div>
              <div className="flex items-center gap-2 hover-scale">
                <CheckCircle2 className="h-4 w-4 md:h-5 md:w-5 text-primary flex-shrink-0" />
                <span className="text-xs sm:text-sm md:text-base text-foreground/80">Гарантия на все работы до 3 лет</span>
              </div>
              <div className="flex items-center gap-2 hover-scale">
                <CheckCircle2 className="h-4 w-4 md:h-5 md:w-5 text-primary flex-shrink-0" />
                <span className="text-xs sm:text-sm md:text-base text-foreground/80">Работаем с 2005 года, более 10 000 клиентов</span>
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
          <div className="relative mt-6 md:mt-8 lg:mt-0 hidden md:block">
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
