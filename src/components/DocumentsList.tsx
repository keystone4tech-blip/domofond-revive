import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { FileText, Download, X, ShieldCheck, Scale, Printer, CheckCircle } from "lucide-react";
import { ALL_LEGAL_DOCUMENTS, LegalDocumentItem } from "@/data/legalDocuments";

interface Document {
  id: string;
  title: string;
  description: string;
  path: string;
  isLegalDoc?: boolean;
  legalDocId?: "privacy-policy" | "data-consent" | "public-offer";
}

/**
 * Компонент "Документы" на странице Контакты ООО «ДомофонДар»
 * Содержит официальные юридические документы (152-ФЗ, Согласие, Публичная оферта)
 * и типовые проекты договоров с возможностью просмотра и скачивания.
 */
const DocumentsList = () => {
  // Логирование монтирования компонента DocumentsList
  useEffect(() => {
    console.log("[DocumentsList] Компонент документов смонтирован. Загружены документы 152-ФЗ и типовые договоры.");
  }, []);

  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // 1. Официальные регламенты и защита персональных данных (ФЗ-152 РФ)
  const legalDocuments: Document[] = [
    {
      id: "legal-1",
      title: "Политика обработки персональных данных (152-ФЗ)",
      description: "Официальный документ ООО «ДомофонДар» о порядке сбора, хранения и защиты персональных данных граждан РФ.",
      path: "/media/documents/contracts/Политика_обработки_персональных_данных_Домофондар_152-ФЗ.doc",
      isLegalDoc: true,
      legalDocId: "privacy-policy"
    },
    {
      id: "legal-2",
      title: "Согласие на обработку персональных данных",
      description: "Форма информированного согласия субъекта персональных данных при регистрации и получении услуг.",
      path: "/media/documents/contracts/Согласие_на_обработку_персональных_данных_Домофондар.doc",
      isLegalDoc: true,
      legalDocId: "data-consent"
    },
    {
      id: "legal-3",
      title: "Публичная оферта и Пользовательское соглашение",
      description: "Условия использования сервиса «Домофондар», правила оформления заявок и проведения онлайн-оплаты.",
      path: "/media/documents/contracts/Публичная_оферта_Домофондар.doc",
      isLegalDoc: true,
      legalDocId: "public-offer"
    }
  ];

  // 2. Типовые договоры на обслуживание и монтажные работы
  const contractDocuments: Document[] = [
    {
      id: "2",
      title: "Договор с представителем собственников",
      description: "Проект договора с представителем собственников помещений МКД",
      path: "/media/documents/contracts/Проект договора с предствителем собственников Домофондар.pdf"
    },
    {
      id: "3",
      title: "Договор с управляющей компанией",
      description: "Проект договора сотрудничества с управляющей организацией / ТСЖ",
      path: "/media/documents/contracts/Проект договора с УК Домофондар.pdf"
    },
    {
      id: "4",
      title: "Договор на установку СКУД, СОД, СВН",
      description: "Проект договора на установку систем контроля доступа и видеонаблюдения",
      path: "/media/documents/contracts/Проект договора установка СКУД СОД СВН Домофондар.pdf"
    },
    {
      id: "5",
      title: "Договор ТО (полное обслуживание)",
      description: "Типовой договор на комплексное техническое обслуживание",
      path: "/media/documents/contracts/full-maintenance-agreement.pdf"
    },
    {
      id: "6",
      title: "Договор ТО (только внеплановое обслуживание)",
      description: "Договор на внеплановое техническое обслуживание по заявкам",
      path: "/media/documents/contracts/emergency-maintenance-agreement.pdf"
    },
    {
      id: "7",
      title: "Договор временного пользования",
      description: "Договор на временное пользование оборудованием и услугами",
      path: "/media/documents/contracts/temporary-use-agreement.pdf"
    }
  ];

  const openDocument = (doc: Document) => {
    console.log(`[DocumentsList] Открытие документа: ${doc.title}`);
    setSelectedDocument(doc);
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setSelectedDocument(null);
  };

  const downloadDocument = () => {
    if (selectedDocument) {
      console.log(`[DocumentsList] Скачивание файла: ${selectedDocument.path}`);
      let downloadPath = selectedDocument.path;

      if (selectedDocument.path.endsWith('.pdf')) {
        const docPath = selectedDocument.path.replace('.pdf', '.doc');
        if (docPath.includes('представителем_собственников')) {
          downloadPath = '/media/documents/contracts/Проект договора с предствителем собственников Домофондар.doc';
        } else if (docPath.includes('УК')) {
          downloadPath = '/media/documents/contracts/Проект договора с УК Домофондар.doc';
        } else if (docPath.includes('СКУД_СОД_СВН')) {
          downloadPath = '/media/documents/contracts/Проект договора установка СКУД СОД СВН Домофондар.doc';
        }
      }

      const link = document.createElement("a");
      link.href = downloadPath;
      const filename = downloadPath.split('/').pop() || 'document';
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handlePrint = () => {
    console.log("[DocumentsList] Печать документа");
    window.print();
  };

  // Получаем данные юридического документа, если открыт документ 152-ФЗ/оферты
  const currentLegalItem: LegalDocumentItem | undefined = selectedDocument?.legalDocId
    ? ALL_LEGAL_DOCUMENTS.find(d => d.id === selectedDocument.legalDocId)
    : undefined;

  return (
    <div className="pt-6 space-y-10">
      <div className="text-center mb-8">
        <h2 className="text-2xl sm:text-3xl md:text-4xl mb-4 section-title-gradient">
          Документы и регламенты
        </h2>
        <p className="text-base text-muted-foreground max-w-2xl mx-auto">
          Официальные документы ООО «ДомофонДар», политика обработки персональных данных согласно ФЗ-152 РФ, оферта и проекты типовых договоров.
        </p>
      </div>

      {/* РАЗДЕЛ 1: Юридические регламенты и 152-ФЗ РФ (выделенный блок) */}
      <div className="space-y-4">
        <div className="flex items-center gap-2.5 pb-2 border-b border-border/60">
          <ShieldCheck className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          <h3 className="text-lg font-bold tracking-tight text-foreground">
            Защита персональных данных (ФЗ-152 РФ) и правовые документы
          </h3>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {legalDocuments.map((doc) => (
            <Card
              key={doc.id}
              className="hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5 cursor-pointer border-blue-200/60 dark:border-blue-900/40 bg-gradient-to-br from-blue-50/40 to-transparent dark:from-blue-950/20"
              onClick={() => openDocument(doc)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600/10 dark:bg-blue-400/10 text-blue-600 dark:text-blue-400 shrink-0">
                    {doc.legalDocId === "public-offer" ? (
                      <Scale className="h-5 w-5" />
                    ) : (
                      <ShieldCheck className="h-5 w-5" />
                    )}
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-base font-bold leading-snug">{doc.title}</CardTitle>
                    <span className="inline-block mt-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-100/70 dark:bg-blue-900/40 px-2 py-0.5 rounded-full">
                      ФЗ-152 РФ • Официально
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-xs text-muted-foreground leading-relaxed">{doc.description}</p>
                <div className="mt-3 flex items-center justify-between text-xs font-semibold text-primary pt-2 border-t border-border/40">
                  <span>Ознакомиться ➔</span>
                  <span className="text-[11px] text-muted-foreground font-normal">DOC / Печать</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* РАЗДЕЛ 2: Типовые проекты договоров */}
      <div className="space-y-4">
        <div className="flex items-center gap-2.5 pb-2 border-b border-border/60">
          <FileText className="h-5 w-5 text-slate-600 dark:text-slate-400" />
          <h3 className="text-lg font-bold tracking-tight text-foreground">
            Типовые договоры на обслуживание и монтажные работы
          </h3>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {contractDocuments.map((doc) => (
            <Card
              key={doc.id}
              className="hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5 cursor-pointer"
              onClick={() => openDocument(doc)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-base leading-tight font-semibold">{doc.title}</CardTitle>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-xs text-muted-foreground leading-relaxed">{doc.description}</p>
                <div className="mt-3 flex items-center justify-between text-xs font-semibold text-primary pt-2 border-t border-border/40">
                  <span>Открыть документ ➔</span>
                  <span className="text-[11px] text-muted-foreground font-normal">PDF / DOC</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Диалог просмотра и скачивания документа */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-2xl lg:max-w-3xl max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0 rounded-2xl bg-background/95 backdrop-blur-xl">
          <DialogHeader className="p-4 sm:p-6 border-b border-border/60 bg-muted/30">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                {selectedDocument?.isLegalDoc ? (
                  <ShieldCheck className="h-5 w-5" />
                ) : (
                  <FileText className="h-5 w-5" />
                )}
              </div>
              <div>
                <DialogTitle className="text-lg sm:text-xl font-bold leading-tight">
                  {selectedDocument?.title}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  {selectedDocument?.description}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
            {selectedDocument && (
              <>
                {/* Если это юридический документ 152-ФЗ — показываем красивый форматированный текст */}
                {currentLegalItem ? (
                  <div className="space-y-5 text-sm leading-relaxed text-foreground select-text print:overflow-visible">
                    <div className="p-3 bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-800/40 rounded-xl text-xs text-blue-800 dark:text-blue-300 flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
                      <span>
                        Официальная действующая редакция от {currentLegalItem.updatedAt} • ООО «ДомофонДар» (ИНН 2311283958)
                      </span>
                    </div>

                    {currentLegalItem.sections.map((sec, idx) => (
                      <div key={idx} className="space-y-2">
                        <h4 className="font-bold text-foreground text-sm sm:text-base border-b border-border/30 pb-1">
                          {sec.title}
                        </h4>
                        <div className="space-y-1.5 text-muted-foreground text-xs sm:text-sm">
                          {sec.content.map((p, pIdx) => (
                            <p key={pIdx} className="leading-relaxed">
                              {p}
                            </p>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  /* Иначе — стандартный просмотрщик файлов PDF / DOC */
                  <div className="bg-muted rounded-xl p-6 text-center">
                    {selectedDocument.path.endsWith('.doc') ? (
                      <>
                        <div className="h-16 w-16 text-blue-500 mx-auto mb-4 flex items-center justify-center">
                          <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
                            <polyline points="14 2 14 8 20 8"/>
                            <path d="M16 13H8"/>
                            <path d="M16 17H8"/>
                            <path d="M10 9H8"/>
                          </svg>
                        </div>
                        <p className="font-semibold text-foreground mb-1">Документ Microsoft Word (.doc)</p>
                        <p className="text-xs text-muted-foreground">Для просмотра и редактирования нажмите кнопку «Скачать Word» ниже.</p>
                      </>
                    ) : selectedDocument.path.endsWith('.pdf') ? (
                      <div className="w-full bg-white rounded-lg overflow-hidden shadow-inner" style={{ height: '60vh' }}>
                        <iframe
                          src={selectedDocument.path}
                          className="w-full h-full"
                          title="PDF Preview"
                        />
                      </div>
                    ) : (
                      <>
                        <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                        <p className="text-muted-foreground mb-2">Документ готов к загрузке</p>
                      </>
                    )}
                    <p className="text-[11px] text-muted-foreground mt-4 font-mono">Файл: {selectedDocument.path.split('/').pop()}</p>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between p-3.5 sm:p-4 border-t border-border/60 bg-muted/30 gap-2">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={closeDialog} className="text-xs h-9">
                <X className="h-3.5 w-3.5 mr-1.5" />
                Закрыть
              </Button>
              {currentLegalItem && (
                <Button variant="outline" size="sm" onClick={handlePrint} className="text-xs h-9">
                  <Printer className="h-3.5 w-3.5 mr-1.5" />
                  Печать
                </Button>
              )}
            </div>
            <Button onClick={downloadDocument} className="text-xs h-9 font-semibold gradient-primary text-primary-foreground">
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Скачать Word (.doc)
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DocumentsList;