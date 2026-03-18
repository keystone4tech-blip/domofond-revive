import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileText, Download, X } from "lucide-react";

interface Document {
  id: string;
  title: string;
  description: string;
  path: string;
}

const DocumentsList = () => {
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const documents: Document[] = [
    {
      id: "1",
      title: "Реквизиты",
      description: "Банковские реквизиты организации",
      path: "/media/documents/contracts/requisites.pdf"
    },
    {
      id: "2",
      title: "Договор с представителем собственников",
      description: "Проект договора с представителем собственников",
      path: "/media/documents/contracts/Проект договора с предствителем собственников Домофондар.pdf"
    },
    {
      id: "3",
      title: "Договор с управляющей компанией",
      description: "Проект договора с управляющей компанией",
      path: "/media/documents/contracts/Проект договора с УК Домофондар.pdf"
    },
    {
      id: "4",
      title: "Договор на установку СКУД, СОД, СВН",
      description: "Проект договора на установку систем контроля и управления доступом",
      path: "/media/documents/contracts/Проект договора установка СКУД СОД СВН Домофондар.pdf"
    },
    {
      id: "5",
      title: "Договор ТО (полное обслуживание)",
      description: "Договор на полное техническое обслуживание",
      path: "/media/documents/contracts/full-maintenance-agreement.pdf"
    },
    {
      id: "6",
      title: "Договор ТО (только внеплановое обслуживание)",
      description: "Договор на внеплановое техническое обслуживание",
      path: "/media/documents/contracts/emergency-maintenance-agreement.pdf"
    },
    {
      id: "7",
      title: "Договор временного пользования",
      description: "Договор на временное пользование услугами",
      path: "/media/documents/contracts/temporary-use-agreement.pdf"
    }
  ];

  const openDocument = (doc: Document) => {
    setSelectedDocument(doc);
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setSelectedDocument(null);
  };

  const downloadDocument = () => {
    if (selectedDocument) {
      // Для PDF-файлов оставляем текущую логику, для DOC-файлов - меняем путь на .doc
      let downloadPath = selectedDocument.path;

      // Если это PDF-файл, но у нас есть соответствующий DOC-файл, меняем путь
      if (selectedDocument.path.endsWith('.pdf')) {
        const docPath = selectedDocument.path.replace('.pdf', '.doc');
        // Проверяем, есть ли DOC-версия файла
        if (docPath.includes('представителем_собственников')) {
          downloadPath = '/media/documents/contracts/Проект договора с предствителем собственников Домофондар.doc';
        } else if (docPath.includes('УК')) {
          downloadPath = '/media/documents/contracts/Проект договора с УК Домофондар.doc';
        } else if (docPath.includes('СКУД_СОД_СВН')) {
          downloadPath = '/media/documents/contracts/Проект договора установка СКУД СОД СВН Домофондар.doc';
        }
      }

      window.open(downloadPath, '_blank');
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold tracking-tight">Документы</h2>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {documents.map((doc) => (
          <Card
            key={doc.id}
            className="hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5 cursor-pointer"
            onClick={() => openDocument(doc)}
          >
            <CardHeader className="pb-3">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-lg leading-tight">{doc.title}</CardTitle>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-sm text-muted-foreground">{doc.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-2xl lg:max-w-3xl max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-xl">{selectedDocument?.title}</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-auto">
            {selectedDocument && (
              <div className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  {selectedDocument.description}
                </div>

                <div className="bg-muted rounded-lg p-6">
                  <div className="text-center">
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
                        <p className="text-muted-foreground mb-2">Документ Microsoft Word</p>
                        <p className="text-sm text-muted-foreground">Для просмотра содержимого документа нажмите кнопку "Скачать" и откройте файл на своем устройстве</p>
                      </>
                    ) : selectedDocument.path.endsWith('.pdf') ? (
                      <>
                        <div className="w-full bg-white rounded-lg overflow-hidden shadow-inner" style={{ height: '60vh' }}>
                          <iframe
                            src={selectedDocument.path}
                            className="w-full h-full"
                            title="PDF Preview"
                          />
                        </div>
                      </>
                    ) : (
                      <>
                        <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                        <p className="text-muted-foreground mb-2">Документ</p>
                        <p className="text-sm text-muted-foreground">Для просмотра содержимого документа нажмите кнопку "Скачать"</p>
                      </>
                    )}
                    <p className="text-xs text-muted-foreground mt-4">Файл: {selectedDocument.path.split('/').pop()}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-between pt-4 border-t">
            <Button variant="outline" onClick={closeDialog}>
              <X className="h-4 w-4 mr-2" />
              Закрыть
            </Button>
            <Button onClick={downloadDocument}>
              <Download className="h-4 w-4 mr-2" />
              Скачать
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DocumentsList;