import { useState, useEffect } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { ShieldCheck, CreditCard, Building2, Loader2, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

/**
 * Страница онлайн-оплаты технического обслуживания домофона.
 * Доступна без регистрации и верификации через защищенный платёжный шлюз Банка «Кубань Кредит».
 */
const Payment = () => {
  // Состояние отображения индикатора загрузки платежного фрейма
  const [iframeLoaded, setIframeLoaded] = useState(false);

  useEffect(() => {
    console.log("[Payment] Инициализация страницы оплаты через Банк «Кубань Кредит»");
    
    // Отправляем событие о завершении загрузки iframe
    const handleIframeLoad = () => {
      console.log("[Payment] Платежный фрейм Банка «Кубань Кредит» успешно загружен");
      setIframeLoaded(true);
    };

    // Слушатель загрузки
    const iframe = document.querySelector("iframe");
    if (iframe) {
      iframe.addEventListener("load", handleIframeLoad);
    }

    return () => {
      if (iframe) {
        iframe.removeEventListener("load", handleIframeLoad);
      }
    };
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950">
      <Header />
      <main className="flex-1 py-8 sm:py-12">
        <div className="container max-w-4xl mx-auto px-4">
          
          {/* Информационный заголовок и статус банка */}
          <div className="text-center mb-8 space-y-3">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <ShieldCheck className="h-4 w-4" />
              <span>Официальный платёжный шлюз КБ «Кубань Кредит»</span>
            </div>
            
            <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
              Оплата технического обслуживания
            </h1>
            
            <p className="text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto">
              Быстрая и безопасная оплата услуг ООО «Домофондар» без комиссии. Принимаются банковские карты любых российских банков (МИР, Visa, Mastercard). Регистрация на сайте не требуется.
            </p>
          </div>

          {/* Плашка с подсказкой для пользователей личного кабинета */}
          <div className="mb-6 p-4 rounded-2xl border border-amber-500/20 bg-amber-50/60 dark:bg-amber-950/20 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs sm:text-sm text-amber-900 dark:text-amber-200">
            <div className="flex items-center gap-2.5">
              <Sparkles className="h-5 w-5 text-amber-500 shrink-0" />
              <span>
                <strong>Уже зарегистрированы?</strong> Авторизованные и верифицированные жильцы могут оплачивать ТО в 1 клик через <strong>ЮKassa</strong> в личном кабинете.
              </span>
            </div>
            <Link
              to="/cabinet"
              className="shrink-0 px-3 py-1.5 rounded-lg bg-amber-500 text-white font-medium hover:bg-amber-600 transition-colors shadow-sm text-xs"
            >
              В личный кабинет →
            </Link>
          </div>

          {/* Контейнер фрейма оплаты Банка Кубань Кредит */}
          <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden min-h-[600px]">
            {/* Спиннер во время загрузки */}
            {!iframeLoaded && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm z-10">
                <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
                <p className="text-sm text-muted-foreground font-medium">
                  Загрузка платёжного терминала Банка «Кубань Кредит»...
                </p>
              </div>
            )}

            <iframe 
              src="https://pay.kk.bank/services/33936?hh" 
              frameBorder="0" 
              scrolling="no" 
              height="1000" 
              width="100%"
              title="Форма оплаты за техническое обслуживание Банка «Кубань Кредит»"
              onLoad={() => setIframeLoaded(true)}
              className="w-full"
            />
          </div>

          {/* Гарантия безопасности */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-6 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              Безопасное 256-битное SSL-соединение
            </span>
            <span className="flex items-center gap-1.5">
              <CreditCard className="h-4 w-4 text-primary" />
              Без дополнительных комиссий
            </span>
            <span className="flex items-center gap-1.5">
              <Building2 className="h-4 w-4 text-sky-500" />
              ПАО КБ «Кубань Кредит»
            </span>
          </div>

        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Payment;