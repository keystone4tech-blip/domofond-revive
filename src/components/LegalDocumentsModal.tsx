import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShieldCheck, FileText, Scale, Printer, ExternalLink, X } from "lucide-react";
import { ALL_LEGAL_DOCUMENTS, LegalDocumentItem } from "@/data/legalDocuments";
import { useNavigate } from "react-router-dom";

interface LegalDocumentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialDocumentId?: "privacy-policy" | "data-consent" | "public-offer";
}

/**
 * Универсальное модальное окно ознакомления с официальными документами ООО «ДомофонДар»
 * (Политика конфиденциальности по 152-ФЗ РФ, Согласие на обработку данных, Публичная оферта).
 * 
 * Преимущества:
 * - Пользователь не покидает текущую страницу (не теряет введенные данные при регистрации/заказе);
 * - Возможность быстрого переключения между связанными юридическими документами;
 * - Прямая ссылка на раздел официальных документов на странице «Контакты»;
 * - Поддержка функции печати документа.
 */
export const LegalDocumentsModal = ({
  isOpen,
  onClose,
  initialDocumentId = "privacy-policy"
}: LegalDocumentsModalProps) => {
  const navigate = useNavigate();
  const [activeDocId, setActiveDocId] = useState<string>(initialDocumentId);

  // При открытии модального окна синхронизируем выбранный документ с переданным в пропсах
  useEffect(() => {
    if (isOpen) {
      console.log(`[LegalModal] Открыто модальное окно документа: ${initialDocumentId}`);
      setActiveDocId(initialDocumentId);
    }
  }, [isOpen, initialDocumentId]);

  // Находим текущий выбранный документ
  const currentDoc: LegalDocumentItem =
    ALL_LEGAL_DOCUMENTS.find((d) => d.id === activeDocId) || ALL_LEGAL_DOCUMENTS[0];

  // Обработчик печати активного документа
  const handlePrint = () => {
    console.log(`[LegalModal] Печать документа: ${currentDoc.title}`);
    window.print();
  };

  // Переход в официальный раздел документов на странице Контакты
  const handleGoToDocumentsTab = () => {
    console.log("[LegalModal] Переход во вкладку «Документы» на странице Контакты");
    onClose();
    navigate("/kontakty?tab=documents");
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-3xl max-w-[95vw] max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden bg-background/95 backdrop-blur-xl border-border shadow-2xl rounded-2xl">
        {/* Шапка модального окна */}
        <DialogHeader className="p-4 sm:p-6 border-b border-border/60 bg-muted/30">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg sm:text-xl font-bold leading-tight">
                Официальные документы ООО «ДомофонДар»
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                В соответствии с требованиями Федерального закона № 152-ФЗ и ст. 437 ГК РФ
              </DialogDescription>
            </div>
          </div>

          {/* Вкладки переключения между 3 документами */}
          <Tabs value={activeDocId} onValueChange={setActiveDocId} className="w-full mt-2">
            <TabsList className="grid grid-cols-3 w-full h-auto p-1 bg-muted/60 rounded-xl">
              <TabsTrigger
                value="privacy-policy"
                className="text-[11px] sm:text-xs py-2 px-1 flex items-center justify-center gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-semibold rounded-lg"
              >
                <ShieldCheck className="h-3.5 w-3.5 hidden sm:inline" />
                <span className="truncate">Политика (152-ФЗ)</span>
              </TabsTrigger>
              <TabsTrigger
                value="data-consent"
                className="text-[11px] sm:text-xs py-2 px-1 flex items-center justify-center gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-semibold rounded-lg"
              >
                <FileText className="h-3.5 w-3.5 hidden sm:inline" />
                <span className="truncate">Согласие ПДн</span>
              </TabsTrigger>
              <TabsTrigger
                value="public-offer"
                className="text-[11px] sm:text-xs py-2 px-1 flex items-center justify-center gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-semibold rounded-lg"
              >
                <Scale className="h-3.5 w-3.5 hidden sm:inline" />
                <span className="truncate">Оферта</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </DialogHeader>

        {/* Текстовая область документа со скроллом */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 text-sm leading-relaxed text-foreground select-text print:overflow-visible">
          <div className="border-b border-border/40 pb-3">
            <h2 className="text-base sm:text-lg font-bold text-foreground">
              {currentDoc.title}
            </h2>
            <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-muted-foreground">
              <span>Редакция от: {currentDoc.updatedAt}</span>
              <span>•</span>
              <span>Оператор: ООО «ДомофонДар» (ИНН 2311283958)</span>
            </div>
          </div>

          {currentDoc.sections.map((sec, idx) => (
            <div key={idx} className="space-y-2">
              <h3 className="font-semibold text-foreground text-sm sm:text-base">
                {sec.title}
              </h3>
              <div className="space-y-2 text-muted-foreground text-xs sm:text-sm">
                {sec.content.map((p, pIdx) => (
                  <p key={pIdx} className="leading-relaxed">
                    {p}
                  </p>
                ))}
              </div>
            </div>
          ))}

          {/* Плашка с юридической силой */}
          <div className="p-3.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-800/40 text-xs text-blue-700 dark:text-blue-300 flex items-start gap-2.5">
            <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
            <p>
              Данный документ является юридически значимым официальным документом компании. Оригинал хранится по адресу местонахождения ООО «ДомофонДар».
            </p>
          </div>
        </div>

        {/* Подвал модального окна с действиями */}
        <div className="p-3.5 sm:p-4 border-t border-border/60 bg-muted/30 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="text-xs font-medium h-9 gap-1.5"
            >
              <Printer className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Печать</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleGoToDocumentsTab}
              className="text-xs font-medium h-9 gap-1.5 text-primary hover:text-primary hover:bg-primary/10"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span>Все документы в «Контактах»</span>
            </Button>
          </div>

          <Button
            type="button"
            onClick={onClose}
            className="text-xs font-semibold h-9 px-4 gradient-primary text-primary-foreground ml-auto shadow-sm"
          >
            Понятно, закрыть
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
