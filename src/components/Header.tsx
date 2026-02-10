import { Phone, User, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User as SupabaseUser } from "@supabase/supabase-js";
import { useNavigate } from "react-router-dom";
import { ThemeToggle } from "./ThemeToggle";
import { AppRole } from "@/hooks/useUserRole";

const Header = () => {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [userRoles, setUserRoles] = useState<AppRole[]>([]);
  const navigate = useNavigate();

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
    ["admin", "director", "dispatcher", "master", "engineer", "manager"].includes(r)
  );

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  const handleNavigation = (path: string) => {
    navigate(path);
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      {/* Верхняя строка с логотипом, телефоном, графиком и адресом */}
      <div className="container px-4 py-1 hidden md:flex items-center justify-between border-b border-border/50">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate("/")}>
          <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-primary">
            <Phone className="h-5 w-5 sm:h-6 sm:w-6 text-primary-foreground" />
          </div>
          <span className="text-lg sm:text-xl font-bold text-foreground">Домофондар</span>
        </div>

        <div className="flex items-center gap-6">
          <a href="tel:+79034118393" className="text-sm text-muted-foreground flex items-center gap-2 hover:text-primary transition-colors">
            <Phone className="h-4 w-4 text-primary" />
            <span>+7 (903) 411-83-93</span>
          </a>

          <div className="text-xs text-muted-foreground">
            Пн–пт: 9.00-17.00, сб: 9.00-15.00
          </div>

          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-primary">
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
            <span>г. Краснодар, проезд Репина 1, 2 этаж, офис 134</span>
          </div>
        </div>
      </div>

      {/* Нижняя строка с навигацией */}
      <div className="container px-4 flex h-14 items-center justify-between">
        <div className="flex items-center gap-2 cursor-pointer md:hidden" onClick={() => navigate("/")}>
          <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-primary">
            <Phone className="h-5 w-5 sm:h-6 sm:w-6 text-primary-foreground" />
          </div>
          <span className="text-lg sm:text-xl font-bold text-foreground">Домофондар</span>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden lg:flex items-center gap-4 xl:gap-6">
          <button
            onClick={() => handleNavigation("/")}
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Главная
          </button>
          <button
            onClick={() => handleNavigation("/domofony")}
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Домофоны
          </button>
          <button
            onClick={() => handleNavigation("/smart-intercom")}
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Умный домофон
          </button>
          <button
            onClick={() => handleNavigation("/videonablyudenie")}
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Видеонаблюдение
          </button>
          <button
            onClick={() => handleNavigation("/nashi-raboty")}
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Наши работы
          </button>
          <button
            onClick={() => handleNavigation("/voprosy")}
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Вопросы
          </button>
          <button
            onClick={() => handleNavigation("/kontakty")}
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Контакты
          </button>
        </nav>

        <div className="flex items-center gap-2 sm:gap-3 lg:gap-4">
          <a href="tel:+79034118393" className="flex md:hidden items-center gap-2 text-sm font-semibold text-primary whitespace-nowrap">
            <Phone className="h-4 w-4" />
            +7 (903) 411-83-93
          </a>
          <ThemeToggle />
          {user ? (
            <div className="hidden md:flex items-center gap-2">
              {isFSMUser && (
                <Button
                  onClick={() => navigate("/fsm")}
                  variant="outline"
                  size="sm"
                >
                  <LayoutDashboard className="h-4 w-4 md:mr-2" />
                  <span className="hidden lg:inline">FSM</span>
                </Button>
              )}
              <Button
                onClick={() => navigate("/cabinet")}
                size="sm"
              >
                <User className="h-4 w-4 md:mr-2" />
                <span className="hidden lg:inline">Кабинет</span>
              </Button>
            </div>
          ) : (
            <Button
              onClick={() => navigate("/auth")}
              className="hidden md:inline-flex gradient-primary text-primary-foreground hover:opacity-90 transition-opacity"
              size="sm"
            >
              Войти
            </Button>
          )}

        </div>
      </div>
    </header>
  );
};

export default Header;
