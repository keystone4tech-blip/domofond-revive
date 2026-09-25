import { useEffect } from "react";
import { 
  CreditCard, 
  User, 
  Calculator, 
  PhoneCall, 
  Shield, 
  Zap, 
  ShieldCheck, 
  Users, 
  Camera, 
  DoorOpen, 
  Settings, 
  BrainCircuit,
  ArrowRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ShinyButton } from "@/components/ui/shiny-button";
import { SmartIntercomTerminal } from "@/components/ui/SmartIntercomTerminal";

/**
 * Главная Hero-секция сайта
 * Включает:
 * - Технологичный заголовок с эффектом перелива hero-title-shimmer
 * - Реальные преимущества компании (заявки до 2 дней, гарантия 3 года, 11 200+ абонентов)
 * - Единый ряд быстрых действий: «Оплатить ТО», «Личный кабинет», «Сделать расчет», «Контакты»
 * - Высокотехнологичный интерактивный 3D-терминал домофона и видеонаблюдения со сканером Face ID
 */
const Hero = () => {
  const navigate = useNavigate();

  // Логирование монтирования компонента Hero
  useEffect(() => {
    console.log("[Hero] Компонент Hero успешно смонтирован с обновленным интерактивным терминалом безопасности.");
  }, []);

  return (
    <section className="relative overflow-hidden bg-background min-h-[600px] md:min-h-[680px]">
      {/* Анимированный технологичный фон с плавающими иконками безопасности */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Градиентный фон */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/15 via-sky-500/15 to-blue-600/15 animate-gradient bg-[length:200%_200%]" />
        
        {/* Плавающие фоновые иконки безопасности */}
        <div className="absolute inset-0 opacity-15 pointer-events-none">
          <Camera className="absolute top-[10%] left-[15%] w-12 h-12 md:w-16 md:h-16 text-primary animate-[float_6s_ease-in-out_infinite]" />
          <DoorOpen className="absolute top-[60%] left-[10%] w-16 h-16 md:w-20 md:h-20 text-blue-600 animate-[float_7s_ease-in-out_infinite]" style={{ animationDelay: '1s' }} />
          <Settings className="absolute top-[20%] right-[20%] w-14 h-14 md:w-18 md:h-18 text-cyan-600 animate-[float_8s_ease-in-out_infinite]" style={{ animationDelay: '2s' }} />
          <BrainCircuit className="absolute top-[70%] right-[15%] w-12 h-12 md:w-16 md:h-16 text-primary animate-[float_6.5s_ease-in-out_infinite]" style={{ animationDelay: '0.5s' }} />
          <Camera className="absolute top-[40%] right-[25%] w-10 h-10 md:w-12 md:h-12 text-blue-500 animate-[float_7.5s_ease-in-out_infinite]" style={{ animationDelay: '3s' }} />
          <Settings className="absolute top-[80%] left-[25%] w-10 h-10 md:w-14 md:h-14 text-cyan-500 animate-[float_6s_ease-in-out_infinite]" style={{ animationDelay: '1.5s' }} />
        </div>
        
        {/* Тонкая кибер-сетка */}
        <div className="absolute inset-0 opacity-5 pointer-events-none" style={{
          backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 3px, hsl(var(--primary) / 0.3) 3px, hsl(var(--primary) / 0.3) 6px),
                           repeating-linear-gradient(90deg, transparent, transparent 3px, hsl(var(--primary) / 0.3) 3px, hsl(var(--primary) / 0.3) 6px)`,
          backgroundSize: '60px 60px',
          animation: 'slide 25s linear infinite'
        }} />
      </div>

      <div className="container px-4 py-6 md:py-8 lg:py-12 relative z-10">
        <div className="grid gap-6 lg:grid-cols-2 lg:gap-8 items-center">
          
          {/* ЛЕВАЯ КОЛОНКА: ЗАГОЛОВОК, ПРЕИМУЩЕСТВА И КНОПКИ ДЕЙСТВИЙ */}
          <div className="flex flex-col gap-3 md:gap-4">
            {/* Верхний бейдж безопасности */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-medium mb-1 w-fit hover-scale animate-fade-in">
              <Shield className="h-3.5 w-3.5 text-blue-500 animate-pulse" />
              <span>Безопасность и контроль нового поколения</span>
            </div>

            {/* Главный заголовок с бегущим лучом Shimmer */}
            <div className="space-y-1 md:space-y-2">
              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-5xl font-extrabold tracking-tight hero-title-shimmer leading-[1.18] pb-1 inline-block animate-fade-in">
                Домофондар: <br />
                Безопасность дома <br />
                нового уровня
              </h1>
            </div>
            
            <p className="text-slate-700 dark:text-neutral-300 text-xs sm:text-sm md:text-base leading-relaxed animate-fade-in max-w-xl" style={{ animationDelay: '0.2s' }}>
              Умные домофоны, видеонаблюдение, автоматические ворота и контроль доступа — 
              управляйте безопасностью вашего дома прямо с экрана смартфона.
            </p>

            {/* РЕАЛЬНЫЕ ПРЕИМУЩЕСТВА КОМПАНИИ В СТЕКЛЯННЫХ МИКРО-ПЛАШКАХ */}
            <div className="flex flex-col gap-2 animate-fade-in" style={{ animationDelay: '0.4s' }}>
              {/* Преимущество 1: Скорость выполнения заявок */}
              <div className="flex items-center gap-2.5 p-2 sm:p-2.5 rounded-xl bg-card/65 backdrop-blur-md border border-border/80 hover:border-sky-500/50 shadow-sm transition-all duration-300 hover:translate-x-1">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-500/15 text-sky-500 shrink-0">
                  <Zap className="h-4 w-4" />
                </div>
                <div className="text-xs sm:text-sm text-slate-700 dark:text-neutral-200">
                  <strong className="text-foreground font-semibold">Выполнение заявок до 2 дней</strong> — рекордная скорость сервиса в Краснодаре
                </div>
              </div>

              {/* Преимущество 2: Гарантия по официальному договору */}
              <div className="flex items-center gap-2.5 p-2 sm:p-2.5 rounded-xl bg-card/65 backdrop-blur-md border border-border/80 hover:border-emerald-500/50 shadow-sm transition-all duration-300 hover:translate-x-1">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-500 shrink-0">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <div className="text-xs sm:text-sm text-slate-700 dark:text-neutral-200">
                  <strong className="text-foreground font-semibold">Гарантия на оборудование до 3 лет</strong>, на монтажные работы — 1 год
                </div>
              </div>

              {/* Преимущество 3: Надежность и количество абонентов */}
              <div className="flex items-center gap-2.5 p-2 sm:p-2.5 rounded-xl bg-card/65 backdrop-blur-md border border-border/80 hover:border-blue-500/50 shadow-sm transition-all duration-300 hover:translate-x-1">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/15 text-blue-500 shrink-0">
                  <Users className="h-4 w-4" />
                </div>
                <div className="text-xs sm:text-sm text-slate-700 dark:text-neutral-200">
                  <strong className="text-foreground font-semibold">11 200+ абонентов</strong> на обслуживании • Опыт работы команды с 2004 года
                </div>
              </div>
            </div>

            {/* ЕДИНЫЙ РЯД БЫСТРЫХ ДЕЙСТВИЙ (ОПЛАТИТЬ ТО, ЛК, СДЕЛАТЬ РАСЧЕТ, КОНТАКТЫ) */}
            <div className="mt-2 animate-fade-in" style={{ animationDelay: '0.6s' }}>
              <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 sm:gap-2.5">
                
                {/* 1. Кнопка «Оплатить ТО» (Главное целевое действие с переливом ShinyButton) */}
                <ShinyButton
                  onClick={() => navigate("/payment")}
                  className="py-2.5 px-3 sm:px-4 text-xs sm:text-sm rounded-xl font-bold flex items-center justify-center gap-1.5 shadow-md"
                >
                  <CreditCard className="h-4 w-4 shrink-0" />
                  <span>Оплатить ТО</span>
                </ShinyButton>

                {/* 2. Кнопка «Личный кабинет» */}
                <Button
                  variant="secondary"
                  onClick={() => navigate("/cabinet")}
                  className="py-2.5 px-3 sm:px-4 text-xs sm:text-sm rounded-xl font-semibold flex items-center justify-center gap-1.5 border border-border/60 hover:border-primary/40 transition-colors shadow-sm"
                >
                  <User className="h-4 w-4 text-primary shrink-0" />
                  <span>Личный кабинет</span>
                </Button>

                {/* 3. Кнопка «Сделать расчет» */}
                <Button
                  variant="outline"
                  onClick={() => navigate("/calculator")}
                  className="py-2.5 px-3 sm:px-4 text-xs sm:text-sm rounded-xl font-semibold flex items-center justify-center gap-1.5 hover:bg-primary/5 hover:border-primary/40 transition-colors shadow-sm"
                >
                  <Calculator className="h-4 w-4 text-sky-500 shrink-0" />
                  <span>Сделать расчет</span>
                </Button>

                {/* 4. Кнопка «Контакты» */}
                <Button
                  variant="outline"
                  onClick={() => navigate("/kontakty")}
                  className="py-2.5 px-3 sm:px-4 text-xs sm:text-sm rounded-xl font-semibold flex items-center justify-center gap-1.5 hover:bg-primary/5 hover:border-primary/40 transition-colors shadow-sm"
                >
                  <PhoneCall className="h-4 w-4 text-emerald-500 shrink-0" />
                  <span>Контакты</span>
                </Button>

              </div>
            </div>

          </div>

          {/* ПРАВАЯ КОЛОНКА: ИНТЕРАКТИВНЫЙ ТЕРМИНАЛ «УМНЫЙ ДОМОФОН» (МГНОВЕННАЯ ЗАГРУЗКА 0 СЕК) */}
          <div className="relative mt-2 lg:mt-0 flex items-center justify-center w-full">
            <SmartIntercomTerminal />
          </div>

        </div>
      </div>
    </section>
  );
};

export default Hero;
