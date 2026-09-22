import { Home, Phone as PhoneIcon, Wrench, HelpCircle, User, LayoutDashboard, LogIn, Calculator, ShieldCheck } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User as SupabaseUser } from "@supabase/supabase-js";
import { AppRole } from "@/hooks/useUserRole";

interface NavItem {
  icon: React.ReactNode;
  label: string;
  action: () => void;
  isActive?: boolean;
}

const MobileBottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [userRoles, setUserRoles] = useState<AppRole[]>([]);

  useEffect(() => {
    const fetchRoles = async (userId: string) => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);
      setUserRoles((data || []).map((r) => r.role as AppRole));
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchRoles(session.user.id);
    });

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

  const isFSMUser = userRoles.some((r) => 
    ["admin", "director", "dispatcher", "master", "engineer", "manager", "superadmin"].includes(r)
  );

  const isAdmin = userRoles.some((r) => 
    ["admin", "director", "superadmin"].includes(r)
  );

  // Hide on FSM pages - they have their own nav
  if (location.pathname.startsWith("/fsm")) {
    return null;
  }

  const scrollToSection = (sectionId: string) => {
    if (location.pathname !== "/") {
      navigate("/");
      setTimeout(() => {
        const element = document.getElementById(sectionId);
        if (element) element.scrollIntoView({ behavior: "smooth" });
      }, 100);
    } else {
      const element = document.getElementById(sectionId);
      if (element) element.scrollIntoView({ behavior: "smooth" });
    }
  };

  const navItems: NavItem[] = [
    {
      icon: <Home className="h-5 w-5" />,
      label: "Главная",
      action: () => navigate("/"),
      isActive: location.pathname === "/",
    },
    {
      icon: <Wrench className="h-5 w-5" />,
      label: "Услуги",
      action: () => navigate("/domofony"),
      isActive: location.pathname === "/domofony" || location.pathname === "/videonablyudenie" || location.pathname === "/smart-intercom",
    },
    {
      icon: <PhoneIcon className="h-5 w-5" />,
      label: "Контакты",
      action: () => navigate("/kontakty"),
      isActive: location.pathname === "/kontakty",
    },
    {
      icon: <Calculator className="h-5 w-5" />,
      label: "Рассчет",
      action: () => navigate("/calculator"),
      isActive: location.pathname === "/calculator",
    },
    {
      icon: <HelpCircle className="h-5 w-5" />,
      label: "Вопросы",
      action: () => navigate("/voprosy"),
      isActive: location.pathname === "/voprosy",
    },
  ];

  // Добавляем кнопки Админки, FSM и Кабинета в зависимости от ролей
  if (user) {
    if (isAdmin) {
      navItems.push({
        icon: <ShieldCheck className="h-5 w-5 text-purple-600 dark:text-purple-400" />,
        label: "Админ панель",
        action: () => navigate("/admin"),
        isActive: location.pathname === "/admin",
      });
    }
    if (isFSMUser) {
      navItems.push({
        icon: <LayoutDashboard className="h-5 w-5 text-blue-600 dark:text-blue-400" />,
        label: "CRM",
        action: () => navigate("/fsm"),
        isActive: location.pathname === "/fsm",
      });
    }
    navItems.push({
      icon: <User className="h-5 w-5" />,
      label: "Кабинет",
      action: () => navigate("/cabinet"),
      isActive: location.pathname === "/cabinet",
    });
  } else {
    navItems.push({
      icon: <LogIn className="h-5 w-5" />,
      label: "Войти",
      action: () => navigate("/auth"),
      isActive: location.pathname === "/auth",
    });
  }

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-t border-border safe-area-inset-bottom shadow-lg">
      <div className="flex items-center justify-around h-16 px-1.5">
        {navItems.slice(0, 6).map((item, index) => {
          // Проверяем, является ли данный элемент кнопкой входа для неавторизованных пользователей
          const isLoginButton = item.label === "Войти";

          // Если это кнопка «Войти», выделяем её акцентной капсулой с бегущим переливом (shimmer)
          if (isLoginButton) {
            return (
              <button
                key={index}
                onClick={() => {
                  // Логируем нажатие акцентной кнопки авторизации
                  console.log("[MobileBottomNav] Нажата выделенная кнопка 'Войти'");
                  item.action();
                }}
                className="relative flex flex-col items-center justify-center flex-1 h-full py-1 px-1 transition-transform active:scale-95 group focus:outline-none"
                aria-label="Войти в личный кабинет"
              >
                {/* Капсула кнопки с неоновым дыханием границы и мягким градиентом */}
                <div className="relative flex flex-col items-center justify-center w-full max-w-[62px] py-1 px-1 rounded-xl bg-gradient-to-b from-blue-50 to-blue-100/80 dark:from-blue-950/80 dark:to-blue-900/50 border border-blue-500/50 dark:border-blue-400/50 overflow-hidden shadow-sm glow-shimmer-btn">
                  {/* Анимированный бегущий луч света (shimmer wave) */}
                  <div className="absolute inset-0 w-1/2 h-full bg-gradient-to-r from-transparent via-white/80 dark:via-white/30 to-transparent pointer-events-none animate-nav-shimmer" />

                  {/* Контрастная иконка входа */}
                  <LogIn className="h-4 w-4 text-blue-600 dark:text-blue-400 drop-shadow-sm mb-0.5 transition-transform group-hover:scale-110" />

                  {/* Акцентная жирная надпись */}
                  <span className="text-[10px] font-bold tracking-tight text-blue-600 dark:text-blue-400 leading-tight">
                    {item.label}
                  </span>
                </div>
              </button>
            );
          }

          // Стандартная отрисовка остальных кнопок нижнего меню
          return (
            <button
              key={index}
              onClick={() => {
                // Логируем выбор стандартного пункта мобильного меню
                console.log(`[MobileBottomNav] Нажат пункт меню: ${item.label}`);
                item.action();
              }}
              className={cn(
                "flex flex-col items-center justify-center flex-1 h-full gap-0.5 transition-colors",
                item.isActive
                  ? "text-primary font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {item.icon}
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default MobileBottomNav;
