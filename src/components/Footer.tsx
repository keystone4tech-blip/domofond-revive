import { useState, useEffect } from "react";
import { Phone, Mail, MapPin, ShieldCheck, FileText, Scale } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { LegalDocumentsModal } from "@/components/LegalDocumentsModal";

const Footer = () => {
  const currentYear = new Date().getFullYear();
  const navigate = useNavigate();
  const [legalModalOpen, setLegalModalOpen] = useState(false);
  const [legalDocId, setLegalDocId] = useState<"privacy-policy" | "data-consent" | "public-offer">("privacy-policy");

  const openLegalDoc = (docId: "privacy-policy" | "data-consent" | "public-offer") => {
    console.log(`[Footer] Открытие документа: ${docId}`);
    setLegalDocId(docId);
    setLegalModalOpen(true);
  };

  // Логирование монтирования компонента Footer
  useEffect(() => {
    console.log("[Footer] Компонент Footer смонтирован. Логотип обновлен: установлен 3D-значок ShieldCheck со свечением и переливающийся текст.");
  }, []);

  return (
    <footer className="border-t bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60">
      <div className="container py-8">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="flex items-center gap-2 mb-4 cursor-pointer logo-container shrink-0" onClick={() => navigate("/")}>
              <ShieldCheck className="h-7 w-7 text-blue-600 dark:text-blue-400 logo-icon-glow shrink-0" />
              <span className="text-2xl font-extrabold tracking-tight text-shimmer font-logo select-none whitespace-nowrap">
                Домофондар
              </span>
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
            <h3 className="font-semibold mb-4">Компания и документы</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <a href="#about" className="hover:text-foreground transition-colors">
                  О нас
                </a>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => navigate("/kontakty?tab=documents")}
                  className="hover:text-foreground transition-colors text-left flex items-center gap-1.5"
                >
                  <FileText className="h-3.5 w-3.5 text-primary" />
                  <span>Документы и регламенты</span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => navigate("/kontakty?tab=requisites")}
                  className="hover:text-foreground transition-colors text-left flex items-center gap-1.5"
                >
                  <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                  <span>Реквизиты компании</span>
                </button>
              </li>
              <li>
                <a href="#faq" className="hover:text-foreground transition-colors">
                  Вопросы и ответы
                </a>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => navigate("/kontakty")}
                  className="hover:text-foreground transition-colors text-left"
                >
                  Контакты
                </button>
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

        <div className="border-t mt-8 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <p>&copy; {currentYear} ООО «ДомофонДар». Все права защищены.</p>

          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
            <button
              type="button"
              onClick={() => openLegalDoc("privacy-policy")}
              className="hover:text-foreground transition-colors hover:underline"
            >
              Политика конфиденциальности (152-ФЗ)
            </button>
            <span>•</span>
            <button
              type="button"
              onClick={() => openLegalDoc("data-consent")}
              className="hover:text-foreground transition-colors hover:underline"
            >
              Согласие на обработку данных
            </button>
            <span>•</span>
            <button
              type="button"
              onClick={() => openLegalDoc("public-offer")}
              className="hover:text-foreground transition-colors hover:underline"
            >
              Публичная оферта
            </button>
          </div>
        </div>
      </div>

      {/* Модальное окно официальных документов */}
      <LegalDocumentsModal
        isOpen={legalModalOpen}
        onClose={() => setLegalModalOpen(false)}
        initialDocumentId={legalDocId}
      />
    </footer>
  );
};

export default Footer;
