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
    ["admin", "director", "dispatcher", "master", "engineer"].includes(r)
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
      <div className="container px-4 flex h-16 items-center justify-between">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate("/")}>
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
            onClick={() => scrollToSection("faq")}
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Вопросы
          </button>
          <button
            onClick={() => scrollToSection("contact")}
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Контакты
          </button>
        </nav>

        <div className="flex items-center gap-2 sm:gap-3 lg:gap-4">
          <a href="tel:+79034118393" className="hidden xl:flex items-center gap-2 text-sm font-semibold text-primary whitespace-nowrap">
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
