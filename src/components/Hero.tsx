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
    <section className="relative overflow-hidden bg-gradient-subtle">
      <div className="container px-4 py-12 md:py-24">
        <div className="grid gap-8 lg:grid-cols-2 lg:gap-12 items-center">
          <div className="flex flex-col gap-6">
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl md:text-5xl lg:text-6xl">
              Профессиональное обслуживание{" "}
              <span className="text-primary">домофонов</span>
            </h1>
            <p className="text-base text-muted-foreground md:text-lg">
              Установка, ремонт и техническое обслуживание домофонных систем любой сложности. 
              Работаем быстро, качественно и с гарантией.
            </p>
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                <span className="text-sm md:text-base">Выезд мастера в течение 2 часов</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                <span className="text-sm md:text-base">Гарантия на все работы до 3 лет</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                <span className="text-sm md:text-base">Работаем с 2005 года, более 10 000 клиентов</span>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-4">
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
