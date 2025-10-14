import { Phone, Menu, X, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User as SupabaseUser } from "@supabase/supabase-js";
import { useNavigate } from "react-router-dom";
import { ThemeToggle } from "./ThemeToggle";

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
      setIsMenuOpen(false);
    }
  };

  const handleNavigation = (path: string) => {
    navigate(path);
    setIsMenuOpen(false);
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
            <Button
              onClick={() => navigate("/cabinet")}
              className="hidden md:inline-flex"
              size="sm"
            >
              <User className="h-4 w-4 md:mr-2" />
              <span className="hidden md:inline">Кабинет</span>
            </Button>
          ) : (
            <Button
              onClick={() => navigate("/auth")}
              className="hidden md:inline-flex gradient-primary text-primary-foreground hover:opacity-90 transition-opacity"
              size="sm"
            >
              Войти
            </Button>
          )}

          {/* Mobile Menu Button */}
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? <X className="h-5 w-5 sm:h-6 sm:w-6" /> : <Menu className="h-5 w-5 sm:h-6 sm:w-6" />}
          </Button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="lg:hidden border-t bg-background">
          <nav className="container px-4 flex flex-col gap-3 py-4">
            <button
              onClick={() => handleNavigation("/")}
              className="text-left text-sm font-medium text-muted-foreground hover:text-foreground transition-colors py-1"
            >
              Главная
            </button>
            <button
              onClick={() => handleNavigation("/domofony")}
              className="text-left text-sm font-medium text-muted-foreground hover:text-foreground transition-colors py-1"
            >
              Домофоны
            </button>
            <button
              onClick={() => handleNavigation("/videonablyudenie")}
              className="text-left text-sm font-medium text-muted-foreground hover:text-foreground transition-colors py-1"
            >
              Видеонаблюдение
            </button>
            <button
              onClick={() => handleNavigation("/nashi-raboty")}
              className="text-left text-sm font-medium text-muted-foreground hover:text-foreground transition-colors py-1"
            >
              Наши работы
            </button>
            <button
              onClick={() => scrollToSection("faq")}
              className="text-left text-sm font-medium text-muted-foreground hover:text-foreground transition-colors py-1"
            >
              Вопросы
            </button>
            <button
              onClick={() => scrollToSection("contact")}
              className="text-left text-sm font-medium text-muted-foreground hover:text-foreground transition-colors py-1"
            >
              Контакты
            </button>
            <a href="tel:+79034118393" className="flex items-center gap-2 text-sm font-semibold text-primary py-2 border-t mt-2 pt-3">
              <Phone className="h-4 w-4" />
              +7 (903) 411-83-93
            </a>
            {user ? (
              <Button onClick={() => { handleNavigation("/cabinet"); }} className="w-full md:hidden">
                <User className="h-4 w-4 mr-2" />
                Личный кабинет
              </Button>
            ) : (
              <Button onClick={() => { handleNavigation("/auth"); }} className="w-full md:hidden">
                Войти
              </Button>
            )}
          </nav>
        </div>
      )}
    </header>
  );
};

export default Header;
