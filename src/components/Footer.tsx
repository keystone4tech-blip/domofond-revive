import { useState, useEffect } from "react";
import { Phone, Mail, MapPin, ShieldCheck, FileText, Scale, ExternalLink, HelpCircle, Wrench, Video, Smartphone } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { LegalDocumentsModal } from "@/components/LegalDocumentsModal";

/**
 * Подвал сайта (Footer) ООО «ДомофонДар»
 * Обеспечивает сквозную навигацию по разделам, услугам, документам и реквизитам.
 * Полностью совместим с Single Page Application (SPA), не сбрасывает состояние и работает на любых доменах.
 */
const Footer = () => {
  const currentYear = new Date().getFullYear();
  const navigate = useNavigate();
  const [legalModalOpen, setLegalModalOpen] = useState(false);
  const [legalDocId, setLegalDocId] = useState<"privacy-policy" | "data-consent" | "public-offer">("privacy-policy");

  // Открытие модального окна для конкретного юридического документа
  const openLegalDoc = (docId: "privacy-policy" | "data-consent" | "public-offer") => {
    console.log(`[Footer] Открытие документа: ${docId}`);
    setLegalDocId(docId);
    setLegalModalOpen(true);
  };

  // Универсальный обработчик навигации с поддержкой вкладок и скролла наверх
  const handleNav = (path: string, options?: { tab?: string; hash?: string }) => {
    console.log(`[Footer] Навигация: path=${path}, tab=${options?.tab}, hash=${options?.hash}`);

    // Если указана вкладка на странице контактов (?tab=documents или ?tab=requisites)
    if (options?.tab) {
      navigate(`/kontakty?tab=${options.tab}`);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    // Если указан якорь на главной странице (например, #about)
    if (options?.hash) {
      if (window.location.pathname === "/") {
        const el = document.getElementById(options.hash);
        if (el) {
          el.scrollIntoView({ behavior: "smooth" });
          return;
        }
      }
      navigate(`/#${options.hash}`);
      return;
    }

    // Обычный переход на маршрут
    navigate(path);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Логирование монтирования компонента Footer
  useEffect(() => {
    console.log("[Footer] Компонент Footer смонтирован. Ссылки привязаны к актуальным маршрутам приложения.");
  }, []);

  return (
    <footer className="border-t bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60">
      <div className="container py-8 md:py-12">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          
          {/* Блок 1: О компании и брендинг */}
          <div>
            <div 
              className="flex items-center gap-2 mb-4 cursor-pointer logo-container shrink-0" 
              onClick={() => handleNav("/")}
            >
              <ShieldCheck className="h-7 w-7 text-blue-600 dark:text-blue-400 logo-icon-glow shrink-0" />
              <span className="text-2xl font-extrabold tracking-tight text-shimmer font-logo select-none whitespace-nowrap">
                Домофондар
              </span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed mb-3">
              ООО «ДомофонДар» — Профессиональная установка, модернизация и техническое обслуживание домофонных систем, видеодомофонии и СКУД в Краснодаре с 2005 года.
            </p>
            <div className="text-xs text-muted-foreground font-mono">
              ИНН: 2311283958 • ОГРН: 1192375010904
            </div>
          </div>

          {/* Блок 2: Услуги компании (прямые ссылки на разделы сайта) */}
          <div>
            <h3 className="font-semibold mb-4 text-foreground text-sm uppercase tracking-wider">
              Услуги
            </h3>
            <ul className="space-y-2.5 text-sm text-muted-foreground">
              <li>
                <button
                  type="button"
                  onClick={() => handleNav("/domofony")}
                  className="hover:text-primary transition-colors text-left flex items-center gap-1.5"
                >
                  <span>Установка домофонов</span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => handleNav("/smart-intercom")}
                  className="hover:text-primary transition-colors text-left flex items-center gap-1.5"
                >
                  <Smartphone className="h-3.5 w-3.5 text-primary" />
                  <span>Умный домофон (SIP)</span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => handleNav("/videonablyudenie")}
                  className="hover:text-primary transition-colors text-left flex items-center gap-1.5"
                >
                  <Video className="h-3.5 w-3.5 text-primary" />
                  <span>Видеонаблюдение</span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => handleNav("/domofony")}
                  className="hover:text-primary transition-colors text-left flex items-center gap-1.5"
                >
                  <Wrench className="h-3.5 w-3.5 text-primary" />
                  <span>Ремонт и диагностика</span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => handleNav("/calculator")}
                  className="hover:text-primary transition-colors text-left flex items-center gap-1.5"
                >
                  <span>Техническое обслуживание (калькулятор)</span>
                </button>
              </li>
            </ul>
          </div>

          {/* Блок 3: Компания, регламенты и документы */}
          <div>
            <h3 className="font-semibold mb-4 text-foreground text-sm uppercase tracking-wider">
              Компания и документы
            </h3>
            <ul className="space-y-2.5 text-sm text-muted-foreground">
              <li>
                <button
                  type="button"
                  onClick={() => handleNav("/", { hash: "about" })}
                  className="hover:text-primary transition-colors text-left"
                >
                  О компании
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => handleNav("/nashi-raboty")}
                  className="hover:text-primary transition-colors text-left"
                >
                  Наши работы и портфолио
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => handleNav("/kontakty", { tab: "documents" })}
                  className="hover:text-primary transition-colors text-left flex items-center gap-1.5 font-medium text-foreground"
                >
                  <FileText className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                  <span>Документы и регламенты (152-ФЗ)</span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => handleNav("/kontakty", { tab: "requisites" })}
                  className="hover:text-primary transition-colors text-left flex items-center gap-1.5 font-medium text-foreground"
                >
                  <ShieldCheck className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                  <span>Реквизиты компании (Карта партнера)</span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => handleNav("/voprosy")}
                  className="hover:text-primary transition-colors text-left flex items-center gap-1.5"
                >
                  <HelpCircle className="h-3.5 w-3.5 text-primary" />
                  <span>Вопросы и ответы (FAQ)</span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => handleNav("/kontakty", { tab: "contact-form" })}
                  className="hover:text-primary transition-colors text-left"
                >
                  Контакты и обратная связь
                </button>
              </li>
            </ul>
          </div>

          {/* Блок 4: Прямые контакты */}
          <div>
            <h3 className="font-semibold mb-4 text-foreground text-sm uppercase tracking-wider">
              Контакты
            </h3>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li className="flex items-start gap-2.5">
                <Phone className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                <div>
                  <a href="tel:+79034118393" className="hover:text-primary font-semibold text-foreground transition-colors">
                    +7 (903) 411-83-93
                  </a>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Пн–пт: 9.00-17.00, сб: 9.00-15.00
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-2.5">
                <Mail className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                <a href="mailto:domofondar@mail.ru" className="hover:text-primary transition-colors">
                  domofondar@mail.ru
                </a>
              </li>
              <li className="flex items-start gap-2.5">
                <MapPin className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                <div>
                  <a
                    href="https://yandex.ru/maps/?text=г.+Краснодар,+проезд+Репина+1"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-primary transition-colors leading-tight inline-flex items-center gap-1"
                  >
                    <span>350090, г. Краснодар, проезд им. Репина 1, 2 этаж, офис 134</span>
                    <ExternalLink className="h-3 w-3 inline text-muted-foreground" />
                  </a>
                </div>
              </li>
            </ul>
          </div>
        </div>

        {/* Нижняя полоса: авторские права и ссылки на юридические документы */}
        <div className="border-t mt-8 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <p>&copy; {currentYear} ООО «ДомофонДар». Все права защищены.</p>

          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
            <button
              type="button"
              onClick={() => openLegalDoc("privacy-policy")}
              className="hover:text-primary transition-colors hover:underline cursor-pointer"
            >
              Политика конфиденциальности (152-ФЗ)
            </button>
            <span>•</span>
            <button
              type="button"
              onClick={() => openLegalDoc("data-consent")}
              className="hover:text-primary transition-colors hover:underline cursor-pointer"
            >
              Согласие на обработку данных
            </button>
            <span>•</span>
            <button
              type="button"
              onClick={() => openLegalDoc("public-offer")}
              className="hover:text-primary transition-colors hover:underline cursor-pointer"
            >
              Публичная оферта
            </button>
          </div>
        </div>
      </div>

      {/* Модальное окно официальных документов ООО «ДомофонДар» */}
      <LegalDocumentsModal
        isOpen={legalModalOpen}
        onClose={() => setLegalModalOpen(false)}
        initialDocumentId={legalDocId}
      />
    </footer>
  );
};

export default Footer;
