import { Phone, Menu, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
      setIsMenuOpen(false);
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
            <Phone className="h-6 w-6 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold text-foreground">Домофондар</span>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-6">
          <button
            onClick={() => scrollToSection("services")}
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Услуги
          </button>
          <button
            onClick={() => scrollToSection("about")}
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            О компании
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

        <div className="flex items-center gap-4">
          <a href="tel:+74951234567" className="hidden md:flex items-center gap-2 text-sm font-semibold text-primary">
            <Phone className="h-4 w-4" />
            +7 (495) 123-45-67
          </a>
          <Button
            onClick={() => scrollToSection("contact")}
            className="hidden md:inline-flex gradient-primary text-primary-foreground hover:opacity-90 transition-opacity"
          >
            Заказать звонок
          </Button>

          {/* Mobile Menu Button */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </Button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="md:hidden border-t bg-background">
          <nav className="container flex flex-col gap-4 py-4">
            <button
              onClick={() => scrollToSection("services")}
              className="text-left text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Услуги
            </button>
            <button
              onClick={() => scrollToSection("about")}
              className="text-left text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              О компании
            </button>
            <button
              onClick={() => scrollToSection("faq")}
              className="text-left text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Вопросы
            </button>
            <button
              onClick={() => scrollToSection("contact")}
              className="text-left text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Контакты
            </button>
            <a href="tel:+74951234567" className="flex items-center gap-2 text-sm font-semibold text-primary">
              <Phone className="h-4 w-4" />
              +7 (495) 123-45-67
            </a>
          </nav>
        </div>
      )}
    </header>
  );
};

export default Header;
