import { Phone, Mail, MapPin } from "lucide-react";

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t bg-muted/30">
      <div className="container py-8">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                <Phone className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="text-lg font-bold">Домофондар</span>
            </div>
            <p className="text-sm text-muted-foreground">
              ООО "Домофондар" - Профессиональное обслуживание домофонных систем с 2005 года.
            </p>
          </div>

          <div>
            <h3 className="font-semibold mb-4">Услуги</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <a href="#services" className="hover:text-foreground transition-colors">
                  Установка домофонов
                </a>
              </li>
              <li>
                <a href="#services" className="hover:text-foreground transition-colors">
                  Ремонт и диагностика
                </a>
              </li>
              <li>
                <a href="#services" className="hover:text-foreground transition-colors">
                  Техническое обслуживание
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-4">Компания</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <a href="#about" className="hover:text-foreground transition-colors">
                  О нас
                </a>
              </li>
              <li>
                <a href="#faq" className="hover:text-foreground transition-colors">
                  Вопросы и ответы
                </a>
              </li>
              <li>
                <a href="#contact" className="hover:text-foreground transition-colors">
                  Контакты
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-4">Контакты</h3>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <Phone className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <a href="tel:+79034118393" className="hover:text-foreground transition-colors">
                  +7 (903) 411-83-93
                </a>
              </li>
              <li className="flex items-start gap-2">
                <Mail className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <a href="mailto:domofondar@mail.ru" className="hover:text-foreground transition-colors">
                  domofondar@mail.ru
                </a>
              </li>
              <li className="flex items-start gap-2">
                <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>г. Краснодар, проезд Репина 1, 2 этаж, офис 134</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t mt-8 pt-8 text-center text-sm text-muted-foreground">
          <p>&copy; {currentYear} Домофондар. Все права защищены.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
