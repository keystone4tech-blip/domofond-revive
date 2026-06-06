import { useEffect } from "react";
import { ArrowRight, CheckCircle2, Camera, DoorOpen, Settings, BrainCircuit, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import heroImage from "@/assets/hero-image.jpg";
import { SplineScene } from "@/components/ui/splite";
import { Spotlight } from "@/components/ui/spotlight";

const Hero = () => {
  const navigate = useNavigate();

  // Логирование монтирования компонента Hero для отслеживания рендеринга на клиенте
  useEffect(() => {
    console.log("[Hero] Компонент Hero успешно смонтирован. Заголовок настроен с увеличенным pb-4 и leading-[1.15] для предотвращения обрезания букв.");
  }, []);

  const scrollToContact = () => {
    navigate("/kontakty");
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

      <div className="container px-4 py-6 md:py-8 lg:py-12 relative z-10">
        <div className="grid gap-4 md:gap-6 lg:grid-cols-2 lg:gap-8 items-center">
          <div className="flex flex-col gap-3 md:gap-4">
            {/* Бейдж сверху в стиле примера */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-medium mb-1.5 w-fit hover-scale animate-fade-in">
              <Shield className="h-3.5 w-3.5 text-blue-500 animate-pulse" />
              <span>Безопасность и контроль нового поколения</span>
            </div>

            <div className="space-y-2 md:space-y-3">
              {/* h1 заголовок: добавлен класс inline-block, pb-3 md:pb-4 и leading-[1.15] во избежание обрезания букв "у" и "р" */}
              <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-blue-950 to-blue-800 dark:from-white dark:to-neutral-400 leading-[1.15] pb-3 md:pb-4 inline-block animate-fade-in">
                Домофондар: <br />
                Безопасность дома <br />
                нового уровня
              </h1>
            </div>
            
            <p className="mt-2 text-slate-700 dark:text-neutral-300 text-sm sm:text-base md:text-lg leading-relaxed animate-fade-in" style={{ animationDelay: '0.2s' }}>
              Умные домофоны, видеонаблюдение, автоматические ворота и контроль доступа — 
              управляйте безопасностью вашего дома прямо с экрана смартфона.
            </p>

            <div className="flex flex-col gap-2 md:gap-3 animate-fade-in" style={{ animationDelay: '0.4s' }}>
              <div className="flex items-center gap-2 hover-scale">
                <CheckCircle2 className="h-4 w-4 md:h-5 md:w-5 text-primary flex-shrink-0" />
                <span className="text-xs sm:text-sm md:text-base text-slate-600 dark:text-neutral-300">Выезд мастера в течение 2 часов</span>
              </div>
              <div className="flex items-center gap-2 hover-scale">
                <CheckCircle2 className="h-4 w-4 md:h-5 md:w-5 text-primary flex-shrink-0" />
                <span className="text-xs sm:text-sm md:text-base text-slate-600 dark:text-neutral-300">Гарантия на все работы до 3 лет</span>
              </div>
              <div className="flex items-center gap-2 hover-scale">
                <CheckCircle2 className="h-4 w-4 md:h-5 md:w-5 text-primary flex-shrink-0" />
                <span className="text-xs sm:text-sm md:text-base text-slate-600 dark:text-neutral-300">Работаем с 2005 года, более 10 000 клиентов</span>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 animate-fade-in" style={{ animationDelay: '0.8s' }}>
              <div className="flex flex-col gap-4">
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
                  variant="secondary"
                  onClick={() => navigate("/payment")}
                  className="text-sm sm:text-base w-full sm:w-auto"
                >
                  Оплатить за техническое обслуживание
                </Button>
              </div>
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
          <div className="relative mt-6 md:mt-8 lg:mt-0 hidden md:block w-full h-[480px] lg:h-[560px]">
            {/* Spotlight подсветка с фирменным синим свечением бренда */}
            <Spotlight
              className="-top-20 left-0 md:left-20 md:-top-10"
              fill="rgba(37, 99, 235, 0.25)"
            />
            {/* Мягкое свечение за роботом */}
            <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 to-secondary/20 rounded-full blur-3xl opacity-50" />
            
            {/* Интерактивная 3D сцена, бесшовно встроенная прямо на фон секции Hero */}
            <div className="w-full h-full relative z-20">
              {/* 
                Интерактивная 3D сцена. По умолчанию отображает робота.
                Чтобы заменить на видеокамеру (CCTV):
                1. Откройте проект с 3D-камерой в редакторе Spline (https://spline.design/)
                2. Нажмите кнопку "Export" -> вкладка "Viewer" -> скопируйте полученную ссылку .splinecode
                3. Замените URL в параметре scene ниже.
              */}
              <SplineScene 
                scene="https://prod.spline.design/kZDDjO5HuC9GJUM2/scene.splinecode"
                className="w-full h-full"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
