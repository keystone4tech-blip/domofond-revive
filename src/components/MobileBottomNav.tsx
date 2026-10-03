import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { 
  Home, Wrench, User, LogIn, Calculator, Menu, X, 
  ShieldCheck, Smartphone, Camera, PhoneCall, HelpCircle, 
  Briefcase, LogOut, ChevronRight, LayoutDashboard, FileCode2,
  Sparkles
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { User as SupabaseUser } from "@supabase/supabase-js";
import { AppRole } from "@/hooks/useUserRole";

/**
 * Нижняя мобильная панель навигации для смартфонов и планшетов.
 * Включает:
 * 1. Главная (/)
 * 2. Услуги (открывает подменю: Домофоны, Умный домофон, Видеонаблюдение)
 * 3. Центральная акцентная кнопка Кабинет / Войти (с шиммер-анимацией)
 * 4. Калькулятор (/calculator)
 * 5. Меню / Ещё (открывает шторку со всеми разделами, контактами, CRM и Админкой для персонала)
 *
 * Скрывается на страницах /admin и /fsm для исключения наложения панелей.
 */
const MobileBottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Состояние авторизованного пользователя и ролей
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [userRoles, setUserRoles] = useState<AppRole[]>([]);

  // Состояние открытых шторок
  const [isServicesOpen, setIsServicesOpen] = useState(false);
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  useEffect(() => {
    // Получение ролей пользователя из базы данных
    const fetchRoles = async (userId: string) => {
      try {
        const { data } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", userId);
        setUserRoles((data || []).map((r) => r.role as AppRole));
      } catch (err) {
        console.error("[MobileBottomNav] Ошибка при загрузке ролей пользователя:", err);
      }
    };

    // Проверка текущей сессии
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchRoles(session.user.id);
    });

    // Слушатель изменения состояния авторизации
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        setTimeout(() => fetchRoles(session.user.id), 0);
      } else {
        setUserRoles([]);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Закрываем шторки при переходе на любую другую страницу
  useEffect(() => {
    setIsServicesOpen(false);
    setIsMoreOpen(false);
  }, [location.pathname]);

  // Проверка прав доступа сотрудника CRM
  const isFSMUser = userRoles.some((r) => 
    ["admin", "director", "dispatcher", "master", "engineer", "manager", "superadmin"].includes(r)
  );

  // Проверка прав доступа администратора
  const isAdmin = userRoles.some((r) => 
    ["admin", "director", "superadmin"].includes(r)
  );

  // На страницах админки (/admin) и CRM (/fsm) глобальную нижнюю панель скрываем,
  // так как там используются свои специализированные мобильные тулбары
  if (location.pathname.startsWith("/fsm") || location.pathname.startsWith("/admin")) {
    return null;
  }

  // Плавный скролл к блоку оплаты на главной странице
  const handleScrollToPayment = () => {
    setIsMoreOpen(false);
    if (location.pathname !== "/") {
      navigate("/");
      setTimeout(() => {
        const heroPaymentBtn = document.querySelector("section");
        if (heroPaymentBtn) {
          heroPaymentBtn.scrollIntoView({ behavior: "smooth" });
        }
      }, 150);
    } else {
      window.scrollTo({ top: 380, behavior: "smooth" });
    }
  };

  // Переход на страницу с закрытием всех шторок
  const handleNavigate = (path: string) => {
    console.log(`[MobileBottomNav] Переход в раздел: ${path}`);
    setIsServicesOpen(false);
    setIsMoreOpen(false);
    navigate(path);
  };

  // Выход из системы
  const handleLogout = async () => {
    console.log("[MobileBottomNav] Выход пользователя из системы...");
    setIsMoreOpen(false);
    await supabase.auth.signOut();
    navigate("/");
  };

  // Активность кнопок
  const isHomeActive = location.pathname === "/";
  const isServicesActive = ["/domofony", "/smart-intercom", "/videonablyudenie"].includes(location.pathname);
  const isCabinetActive = location.pathname === "/cabinet" || location.pathname === "/auth";
  const isCalcActive = location.pathname === "/calculator";
  const isMoreActive = ["/nashi-raboty", "/voprosy", "/kontakty", "/project"].includes(location.pathname);

  return (
    <>
      {/* Затемняющая подложка (Backdrop) при открытии шторок Услуг или Меню */}
      {(isServicesOpen || isMoreOpen) && (
        <div 
          onClick={() => {
            setIsServicesOpen(false);
            setIsMoreOpen(false);
          }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 lg:hidden transition-opacity duration-300"
          aria-label="Закрыть шторку меню"
        />
      )}

      {/* ШТОРКА 1: Подменю «Услуги» */}
      {isServicesOpen && (
        <div className="fixed bottom-20 left-3 right-3 z-50 lg:hidden bg-card/95 dark:bg-slate-900/95 backdrop-blur-xl border border-border/80 dark:border-slate-800 rounded-3xl shadow-2xl p-4 animate-in slide-in-from-bottom-5 duration-300">
          <div className="flex items-center justify-between pb-3 border-b border-border/60">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-xl bg-blue-500/10 text-primary">
                <Wrench className="h-4 w-4" />
              </div>
              <h3 className="font-bold text-sm text-foreground tracking-tight">Услуги компании</h3>
            </div>
            <button
              onClick={() => setIsServicesOpen(false)}
              className="p-1 rounded-full text-muted-foreground hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-2 pt-3">
            {/* 1. Домофоны */}
            <button
              onClick={() => handleNavigate("/domofony")}
              className={cn(
                "flex items-center justify-between p-3 rounded-2xl text-left transition-all active:scale-[0.98]",
                location.pathname === "/domofony"
                  ? "bg-primary/10 text-primary border border-primary/20"
                  : "bg-slate-50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800 text-foreground"
              )}
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-bold text-xs sm:text-sm">Подъездные домофоны</div>
                  <div className="text-[11px] text-muted-foreground">Обслуживание, ремонт, установка с нуля</div>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground/60" />
            </button>

            {/* 2. Умный домофон */}
            <button
              onClick={() => handleNavigate("/smart-intercom")}
              className={cn(
                "flex items-center justify-between p-3 rounded-2xl text-left transition-all active:scale-[0.98]",
                location.pathname === "/smart-intercom"
                  ? "bg-primary/10 text-primary border border-primary/20"
                  : "bg-slate-50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800 text-foreground"
              )}
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-cyan-500/15 text-cyan-600 dark:text-cyan-400">
                  <Smartphone className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-bold text-xs sm:text-sm flex items-center gap-1.5">
                    <span>Умный домофон</span>
                    <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-700 dark:text-cyan-300">Face ID</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground">Видеозвонки на смартфон, открытие без ключа</div>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground/60" />
            </button>

            {/* 3. Видеонаблюдение */}
            <button
              onClick={() => handleNavigate("/videonablyudenie")}
              className={cn(
                "flex items-center justify-between p-3 rounded-2xl text-left transition-all active:scale-[0.98]",
                location.pathname === "/videonablyudenie"
                  ? "bg-primary/10 text-primary border border-primary/20"
                  : "bg-slate-50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800 text-foreground"
              )}
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                  <Camera className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-bold text-xs sm:text-sm">Видеонаблюдение</div>
                  <div className="text-[11px] text-muted-foreground">Дворы, парковки, подъезды с записью 24/7</div>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground/60" />
            </button>
          </div>
        </div>
      )}

      {/* ШТОРКА 2: «Все разделы / Меню» */}
      {isMoreOpen && (
        <div className="fixed bottom-20 left-3 right-3 z-50 lg:hidden bg-card/95 dark:bg-slate-900/95 backdrop-blur-xl border border-border/80 dark:border-slate-800 rounded-3xl shadow-2xl p-4 animate-in slide-in-from-bottom-5 duration-300 max-h-[75vh] overflow-y-auto">
          <div className="flex items-center justify-between pb-3 border-b border-border/60">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-xl bg-primary/10 text-primary">
                <Menu className="h-4 w-4" />
              </div>
              <h3 className="font-bold text-sm text-foreground tracking-tight">Все разделы сайта</h3>
            </div>
            <button
              onClick={() => setIsMoreOpen(false)}
              className="p-1 rounded-full text-muted-foreground hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Публичные страницы */}
          <div className="grid grid-cols-2 gap-2 pt-3">
            {/* Наши работы / Портфолио */}
            <button
              onClick={() => handleNavigate("/nashi-raboty")}
              className={cn(
                "flex flex-col items-start p-3 rounded-2xl text-left transition-all active:scale-95 bg-slate-50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800",
                location.pathname === "/nashi-raboty" && "bg-primary/10 text-primary border border-primary/20"
              )}
            >
              <Briefcase className="h-5 w-5 text-indigo-500 mb-1.5" />
              <span className="text-xs font-bold text-foreground">Наши работы</span>
              <span className="text-[10px] text-muted-foreground">Фото готовых объектов</span>
            </button>

            {/* Вопросы и ответы */}
            <button
              onClick={() => handleNavigate("/voprosy")}
              className={cn(
                "flex flex-col items-start p-3 rounded-2xl text-left transition-all active:scale-95 bg-slate-50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800",
                location.pathname === "/voprosy" && "bg-primary/10 text-primary border border-primary/20"
              )}
            >
              <HelpCircle className="h-5 w-5 text-amber-500 mb-1.5" />
              <span className="text-xs font-bold text-foreground">Вопросы и ответы</span>
              <span className="text-[10px] text-muted-foreground">База знаний для жителей</span>
            </button>

            {/* Контакты */}
            <button
              onClick={() => handleNavigate("/kontakty")}
              className={cn(
                "flex flex-col items-start p-3 rounded-2xl text-left transition-all active:scale-95 bg-slate-50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800",
                location.pathname === "/kontakty" && "bg-primary/10 text-primary border border-primary/20"
              )}
            >
              <PhoneCall className="h-5 w-5 text-emerald-500 mb-1.5" />
              <span className="text-xs font-bold text-foreground">Контакты</span>
              <span className="text-[10px] text-muted-foreground">Офис, схема проезда</span>
            </button>

            {/* Оплатить ТО на главной */}
            <button
              onClick={handleScrollToPayment}
              className="flex flex-col items-start p-3 rounded-2xl text-left transition-all active:scale-95 bg-emerald-500/10 hover:bg-emerald-500/15 border border-emerald-500/20"
            >
              <Sparkles className="h-5 w-5 text-emerald-600 dark:text-emerald-400 mb-1.5" />
              <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300">Оплатить ТО</span>
              <span className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80">Оплата на главной</span>
            </button>
          </div>

          {/* Прямой звонок в диспетчерскую */}
          <div className="mt-3 p-3 rounded-2xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200/50 dark:border-blue-900/40 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-blue-600 text-white">
                <PhoneCall className="h-4 w-4" />
              </div>
              <div>
                <div className="text-[11px] text-muted-foreground font-medium">Диспетчерская служба</div>
                <a href="tel:+79034118393" className="text-xs sm:text-sm font-extrabold text-blue-600 dark:text-blue-400">
                  +7 (903) 411-83-93
                </a>
              </div>
            </div>
            <a 
              href="tel:+79034118393"
              className="px-3 py-1.5 text-xs font-bold rounded-xl bg-blue-600 text-white shadow-sm active:scale-95 transition-transform"
            >
              Вызов
            </a>
          </div>

          {/* Служебный блок для сотрудников и администратора */}
          {(isFSMUser || isAdmin) && (
            <div className="mt-4 pt-3 border-t border-border/60 space-y-2">
              <div className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider px-1">
                Служебный доступ персонала
              </div>

              {/* FSM CRM для сотрудников */}
              {isFSMUser && (
                <button
                  onClick={() => handleNavigate("/fsm")}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 font-semibold text-xs border border-blue-500/20 active:scale-95 transition-transform"
                >
                  <div className="flex items-center gap-2.5">
                    <LayoutDashboard className="h-4 w-4 shrink-0" />
                    <span>CRM Панель (Заявки и наряды)</span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-blue-500/60" />
                </button>
              )}

              {/* Панель администратора */}
              {isAdmin && (
                <button
                  onClick={() => handleNavigate("/admin")}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400 font-semibold text-xs border border-purple-500/20 active:scale-95 transition-transform"
                >
                  <div className="flex items-center gap-2.5">
                    <ShieldCheck className="h-4 w-4 shrink-0" />
                    <span>Панель администратора</span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-purple-500/60" />
                </button>
              )}

              {/* Инженерный паспорт — строго ТОЛЬКО ДЛЯ АДМИНИСТРАТОРА (по требованию) */}
              {isAdmin && (
                <button
                  onClick={() => handleNavigate("/project")}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 font-semibold text-xs border border-amber-500/20 active:scale-95 transition-transform"
                >
                  <div className="flex items-center gap-2.5">
                    <FileCode2 className="h-4 w-4 shrink-0" />
                    <span>Инженерный паспорт проекта (Паспорт разработки)</span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-amber-500/60" />
                </button>
              )}
            </div>
          )}

          {/* Кнопка выхода для авторизованных пользователей */}
          {user && (
            <div className="mt-3 pt-2 border-t border-border/60">
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 p-2.5 rounded-xl text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 font-semibold text-xs transition-colors"
              >
                <LogOut className="h-4 w-4" />
                <span>Выйти из учетной записи</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* ОСНОВНАЯ ФИКСИРОВАННАЯ ПАНЕЛЬ (5 КНОПОК) */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-t border-border safe-area-inset-bottom shadow-lg">
        <div className="flex items-center justify-around h-16 px-1">
          
          {/* 1. Главная */}
          <button
            onClick={() => {
              console.log("[MobileBottomNav] Нажата кнопка 'Главная'");
              setIsServicesOpen(false);
              setIsMoreOpen(false);
              if (location.pathname === "/") {
                window.scrollTo({ top: 0, behavior: "smooth" });
              } else {
                navigate("/");
              }
            }}
            className={cn(
              "flex flex-col items-center justify-center flex-1 h-full gap-0.5 transition-colors active:scale-95",
              isHomeActive && !isServicesOpen && !isMoreOpen
                ? "text-primary font-bold"
                : "text-muted-foreground hover:text-foreground"
            )}
            aria-label="Главная страница"
          >
            <Home className="h-5 w-5" />
            <span className="text-[10px] font-medium leading-tight">Главная</span>
          </button>

          {/* 2. Услуги (открывает шторку всех услуг) */}
          <button
            onClick={() => {
              console.log("[MobileBottomNav] Нажата кнопка 'Услуги'");
              setIsMoreOpen(false);
              setIsServicesOpen(!isServicesOpen);
            }}
            className={cn(
              "flex flex-col items-center justify-center flex-1 h-full gap-0.5 transition-colors active:scale-95 relative",
              isServicesOpen || isServicesActive
                ? "text-primary font-bold"
                : "text-muted-foreground hover:text-foreground"
            )}
            aria-label="Услуги компании"
          >
            <Wrench className="h-5 w-5" />
            <span className="text-[10px] font-medium leading-tight">Услуги</span>
            {isServicesOpen && (
              <span className="absolute bottom-1 w-1 h-1 rounded-full bg-primary" />
            )}
          </button>

          {/* 3. Центр: Кабинет (если вошел) или Войти (с акцентным шиммером) */}
          {user ? (
            // Авторизованный пользователь: кнопка «Кабинет» с элегантным акцентом
            <button
              onClick={() => {
                console.log("[MobileBottomNav] Нажата кнопка 'Кабинет'");
                handleNavigate("/cabinet");
              }}
              className={cn(
                "relative flex flex-col items-center justify-center flex-1 h-full py-1 px-1 transition-transform active:scale-95 group focus:outline-none"
              )}
              aria-label="Перейти в личный кабинет"
            >
              <div className={cn(
                "relative flex flex-col items-center justify-center w-full max-w-[62px] py-1 px-1 rounded-xl transition-all",
                isCabinetActive
                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/25 font-bold"
                  : "bg-primary/10 text-primary border border-primary/20 hover:bg-primary/15 font-semibold"
              )}>
                <User className="h-4 w-4 mb-0.5" />
                <span className="text-[10px] tracking-tight leading-tight">Кабинет</span>
              </div>
            </button>
          ) : (
            // Неавторизованный гость: кнопка «Войти» с анимированным шиммер-переливом
            <button
              onClick={() => {
                console.log("[MobileBottomNav] Нажата кнопка 'Войти'");
                handleNavigate("/auth");
              }}
              className="relative flex flex-col items-center justify-center flex-1 h-full py-1 px-1 transition-transform active:scale-95 group focus:outline-none"
              aria-label="Войти в систему"
            >
              <div className="relative flex flex-col items-center justify-center w-full max-w-[62px] py-1 px-1 rounded-xl bg-gradient-to-b from-blue-50 to-blue-100/80 dark:from-blue-950/80 dark:to-blue-900/50 border border-blue-500/50 dark:border-blue-400/50 overflow-hidden shadow-sm glow-shimmer-btn">
                {/* Анимированный бегущий луч света */}
                <div className="absolute inset-0 w-1/2 h-full bg-gradient-to-r from-transparent via-white/80 dark:via-white/30 to-transparent pointer-events-none animate-nav-shimmer" />
                <LogIn className="h-4 w-4 text-blue-600 dark:text-blue-400 drop-shadow-sm mb-0.5 transition-transform group-hover:scale-110" />
                <span className="text-[10px] font-bold tracking-tight text-blue-600 dark:text-blue-400 leading-tight">
                  Войти
                </span>
              </div>
            </button>
          )}

          {/* 4. Калькулятор */}
          <button
            onClick={() => {
              console.log("[MobileBottomNav] Нажата кнопка 'Калькулятор'");
              handleNavigate("/calculator");
            }}
            className={cn(
              "flex flex-col items-center justify-center flex-1 h-full gap-0.5 transition-colors active:scale-95",
              isCalcActive && !isServicesOpen && !isMoreOpen
                ? "text-primary font-bold"
                : "text-muted-foreground hover:text-foreground"
            )}
            aria-label="Калькулятор стоимости"
          >
            <Calculator className="h-5 w-5" />
            <span className="text-[10px] font-medium leading-tight">Расчёт</span>
          </button>

          {/* 5. Меню (Ещё) */}
          <button
            onClick={() => {
              console.log("[MobileBottomNav] Нажата кнопка 'Меню / Ещё'");
              setIsServicesOpen(false);
              setIsMoreOpen(!isMoreOpen);
            }}
            className={cn(
              "flex flex-col items-center justify-center flex-1 h-full gap-0.5 transition-colors active:scale-95 relative",
              isMoreOpen || isMoreActive
                ? "text-primary font-bold"
                : "text-muted-foreground hover:text-foreground"
            )}
            aria-label="Все разделы меню"
          >
            <Menu className="h-5 w-5" />
            <span className="text-[10px] font-medium leading-tight">Меню</span>
            {isMoreOpen && (
              <span className="absolute bottom-1 w-1 h-1 rounded-full bg-primary" />
            )}
          </button>

        </div>
      </nav>
    </>
  );
};

export default MobileBottomNav;
