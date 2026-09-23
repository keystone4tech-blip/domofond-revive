// ============================================================================
// Компонент: VerificationUploadDialog
// Назначение: Модальное окно загрузки жильцом документа, подтверждающего
//             право проживания в квартире (выписка ЕГРН, прописка в паспорте,
//             договор аренды) для верификации диспетчером в FSM.
// Примечание: Квитанции ЖКХ исключены из списка документов по требованию безопасности.
// ============================================================================

import React, { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Upload,
  FileText,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  X,
  Loader2,
  ShieldCheck,
  FileCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Допустимые надежные типы документов (без квитанций ЖКХ)
export const VERIFICATION_DOCUMENT_TYPES = [
  {
    id: "egrn",
    label: "Выписка из ЕГРН или Свидетельство о собственности",
    description: "Для собственников жилья (с указанием ФИО собственника и адреса квартиры)",
    badge: "Собственник",
  },
  {
    id: "passport",
    label: "Паспорт РФ со штампом постоянной/временной регистрации",
    description: "Разворот паспорта с фотографией и страница со штампом прописки по данному адресу",
    badge: "Прописка",
  },
  {
    id: "rent_contract",
    label: "Договор найма / аренды жилого помещения",
    description: "Действующий договор с подписями собственника и нанимателя с указанием квартиры",
    badge: "Арендатор",
  },
  {
    id: "other",
    label: "Иной подтверждающий документ",
    description: "Акт приема-передачи от застройщика, служебный ордер, свидетельство о наследстве",
    badge: "Другое",
  },
];

interface VerificationUploadDialogProps {
  isOpen: boolean;
  onClose: () => void;
  profile: any;
  onSuccess: (updatedProfile: any) => void;
}

export const VerificationUploadDialog: React.FC<VerificationUploadDialogProps> = ({
  isOpen,
  onClose,
  profile,
  onSuccess,
}) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Выбранный тип документа
  const [selectedDocType, setSelectedDocType] = useState<string>("egrn");
  // Загруженный файл и его Data URL
  const [fileDataUrl, setFileDataUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [fileSizeKb, setFileSizeKb] = useState<number>(0);
  const [isPdf, setIsPdf] = useState<boolean>(false);
  // Состояние процесса сжатия и отправки
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Сжатие изображения через HTML5 Canvas для быстрой передачи и надежного хранения
  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      console.log(`[Верификация] Старт сжатия изображения: ${file.name}, исходный размер: ${(file.size / 1024).toFixed(1)} КБ`);
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement("canvas");
          let width = img.width;
          let height = img.height;
          const maxDim = 1400; // Оптимальный размер для четкого чтения текста в документе

          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve(img.src);
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          // 82% качество JPEG для баланса между четкостью мелкого шрифта и объемом
          const compressedDataUrl = canvas.toDataURL("image/jpeg", 0.82);
          const compressedSizeKb = Math.round(compressedDataUrl.length * 0.75 / 1024);
          console.log(`[Верификация] Сжатие завершено: разрешение ${width}x${height}, размер: ${compressedSizeKb} КБ`);
          setFileSizeKb(compressedSizeKb);
          resolve(compressedDataUrl);
        };
        img.onerror = (err) => reject(err);
      };
      reader.onerror = (err) => reject(err);
    });
  };

  // Чтение PDF в Data URL
  const readPdf = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      console.log(`[Верификация] Чтение PDF документа: ${file.name}`);
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const sizeKb = Math.round(file.size / 1024);
        setFileSizeKb(sizeKb);
        resolve(dataUrl);
      };
      reader.onerror = (err) => reject(err);
    });
  };

  // Обработка выбора файла пользователем
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Проверка размера до 15 МБ
    if (file.size > 15 * 1024 * 1024) {
      toast({
        title: "Файл слишком большой",
        description: "Пожалуйста, выберите файл размером до 15 МБ.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsProcessing(true);
      setFileName(file.name);

      if (file.type === "application/pdf") {
        setIsPdf(true);
        const dataUrl = await readPdf(file);
        setFileDataUrl(dataUrl);
      } else if (file.type.startsWith("image/")) {
        setIsPdf(false);
        const dataUrl = await compressImage(file);
        setFileDataUrl(dataUrl);
      } else {
        toast({
          title: "Неподдерживаемый формат",
          description: "Поддерживаются файлы изображений (JPG, PNG, WEBP) или документы PDF.",
          variant: "destructive",
        });
        setFileDataUrl(null);
      }
    } catch (err: any) {
      console.error("[Верификация] Ошибка обработки файла:", err);
      toast({
        title: "Ошибка обработки файла",
        description: err.message || "Не удалось загрузить выбранный файл.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Сброс выбранного файла
  const handleRemoveFile = () => {
    setFileDataUrl(null);
    setFileName("");
    setFileSizeKb(0);
    setIsPdf(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Отправка документа диспетчеру на проверку
  const handleSubmit = async () => {
    if (!profile?.id) {
      toast({
        title: "Ошибка",
        description: "Профиль пользователя не найден. Пожалуйста, обновите страницу.",
        variant: "destructive",
      });
      return;
    }

    if (!profile.address || !profile.address.trim()) {
      toast({
        title: "Не заполнен адрес",
        description: "Укажите ваш адрес проживания в профиле перед отправкой документов.",
        variant: "destructive",
      });
      return;
    }

    if (!fileDataUrl) {
      toast({
        title: "Документ не прикреплен",
        description: "Пожалуйста, выберите фото или скан документа для отправки.",
        variant: "destructive",
      });
      return;
    }

    const docMeta = VERIFICATION_DOCUMENT_TYPES.find((d) => d.id === selectedDocType);
    const docLabel = docMeta?.label || "Подтверждающий документ";

    try {
      setIsSubmitting(true);
      console.log(`[Верификация] Отправка документа "${selectedDocType}" для профиля ID: ${profile.id}`);

      const submittedAt = new Date().toISOString();

      // 1. Обновляем статус профиля жильца в таблице profiles
      const { data: updatedProfile, error: profError } = await supabase
        .from("profiles")
        .update({
          verification_status: "pending",
          verification_document_url: fileDataUrl,
          verification_document_type: selectedDocType,
          verification_submitted_at: submittedAt,
          verification_reject_reason: null, // Сбрасываем старую причину отклонения, если была
        })
        .eq("id", profile.id)
        .select("*")
        .single();

      if (profError) throw profError;

      // 2. Создаем карточку наряда в журнале requests для диспетчера
      try {
        const fullAddr = `${profile.address}${profile.apartment ? `, кв. ${profile.apartment}` : ""}`;
        await supabase.from("requests").insert({
          client_id: profile.id,
          name: profile.full_name || "Жилец",
          phone: profile.phone || "",
          address: fullAddr,
          apartment: profile.apartment || "",
          order_type: "verification_request",
          message: `🛡️ Заявка на верификацию жильца (подтверждение права проживания) по адресу: ${fullAddr}. Тип документа: ${docLabel}.`,
          status: "pending",
          priority: "medium",
          document_url: fileDataUrl,
        });
        console.log("[Верификация] Заявка успешно зарегистрирована в таблице requests для диспетчера");
      } catch (reqErr) {
        console.warn("[Верификация] Предупреждение при создании наряда в requests (не критично):", reqErr);
      }

      // Оповещаем диспетчерскую панель и другие вкладки об отправке новой верификации
      try {
        localStorage.setItem("verification_last_update", Date.now().toString());
        window.dispatchEvent(new Event("verification_submitted"));
        console.log("[Верификация] Событие verification_submitted успешно отправлено в шину событий");
      } catch (evErr) {
        console.warn("[Верификация] Ошибка при отправке события в шину:", evErr);
      }

      toast({
        title: "🛡️ Документы отправлены!",
        description: "Заявка передана диспетчеру на проверку. Обычно рассмотрение занимает 15–30 минут.",
      });

      // Передаем обновленный профиль родителю
      onSuccess(updatedProfile);
      onClose();
    } catch (err: any) {
      console.error("[Верификация] Ошибка сохранения заявки:", err);
      toast({
        title: "Ошибка отправки",
        description: err.message || "Не удалось отправить документ на проверку.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">Подтверждение проживания</DialogTitle>
              <DialogDescription className="text-xs">
                Для доступа к видеодомофону и открытию замка подъезда подтвердите принадлежность к квартире.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Адрес квартиры */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-xs space-y-1">
            <span className="text-muted-foreground font-semibold block uppercase tracking-wider text-[10px]">
              Проверяемый адрес
            </span>
            <p className="font-bold text-sm text-foreground">
              {profile?.address || "Адрес не указан"}
              {profile?.apartment ? `, кв. ${profile.apartment}` : ""}
            </p>
            {profile?.full_name && (
              <p className="text-muted-foreground">Жилец: <strong className="text-foreground">{profile.full_name}</strong></p>
            )}
          </div>

          {/* Выбор типа документа */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold">Выберите тип подтверждающего документа:</Label>
            <div className="space-y-1.5">
              {VERIFICATION_DOCUMENT_TYPES.map((doc) => {
                const isSelected = selectedDocType === doc.id;
                return (
                  <div
                    key={doc.id}
                    onClick={() => setSelectedDocType(doc.id)}
                    className={cn(
                      "p-2.5 rounded-xl border text-left cursor-pointer transition-all flex items-start justify-between gap-2",
                      isSelected
                        ? "border-amber-500/60 bg-amber-500/10 shadow-xs"
                        : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/40"
                    )}
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className={cn("text-xs font-bold", isSelected ? "text-foreground" : "text-slate-700 dark:text-slate-300")}>
                          {doc.label}
                        </span>
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          {doc.badge}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-tight">
                        {doc.description}
                      </p>
                    </div>
                    <div className={cn(
                      "w-4 h-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5",
                      isSelected ? "border-amber-500 bg-amber-500 text-white" : "border-slate-300 dark:border-slate-700"
                    )}>
                      {isSelected && <CheckCircle2 className="h-3 w-3" />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Область прикрепления файла */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold">Прикрепите фото или скан документа:</Label>
            
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              onChange={handleFileChange}
              className="hidden"
            />

            {!fileDataUrl ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-amber-500 rounded-2xl p-6 text-center cursor-pointer transition-colors bg-slate-50/50 dark:bg-slate-900/20 hover:bg-amber-500/5 space-y-2"
              >
                {isProcessing ? (
                  <div className="flex flex-col items-center justify-center gap-2 py-2">
                    <Loader2 className="h-7 w-7 text-amber-500 animate-spin" />
                    <span className="text-xs font-medium text-muted-foreground">Оптимизация документа...</span>
                  </div>
                ) : (
                  <>
                    <div className="w-11 h-11 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 mx-auto flex items-center justify-center">
                      <Upload className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-bold text-sm text-foreground">Нажмите для выбора файла</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Форматы: JPG, PNG, WEBP или PDF (до 15 МБ)
                      </p>
                    </div>
                    <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium pt-1">
                      💡 Убедитесь, что текст, ФИО и адрес в документе отчетливо видны
                    </p>
                  </>
                )}
              </div>
            ) : (
              <div className="p-3 rounded-2xl border border-emerald-500/40 bg-emerald-500/5 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 overflow-hidden">
                    <div className="p-2 rounded-xl bg-emerald-500 text-white shrink-0">
                      {isPdf ? <FileText className="h-4 w-4" /> : <ImageIcon className="h-4 w-4" />}
                    </div>
                    <div className="truncate">
                      <p className="font-bold text-xs text-foreground truncate">{fileName}</p>
                      <p className="text-[10px] text-muted-foreground">Размер: ~{fileSizeKb} КБ • Готов к отправке</p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleRemoveFile}
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive rounded-lg"
                    title="Удалить и выбрать другой файл"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                {/* Предпросмотр изображения */}
                {!isPdf && fileDataUrl && (
                  <div className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 max-h-48 bg-black/5 flex items-center justify-center">
                    <img
                      src={fileDataUrl}
                      alt="Превью документа"
                      className="max-h-48 w-auto object-contain rounded-lg"
                    />
                  </div>
                )}

                {isPdf && (
                  <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center gap-2 text-xs text-muted-foreground">
                    <FileCheck className="h-4 w-4 text-emerald-600" />
                    <span>Документ PDF прикреплен и будет отправлен диспетчеру.</span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/50 text-[11px] text-muted-foreground leading-relaxed flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
            <span>
              Данные передаются по защищенному каналу и используются исключительно диспетчером для подтверждения права доступа к домофону вашего подъезда.
            </span>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting} className="rounded-xl">
            Отмена
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!fileDataUrl || isSubmitting || isProcessing}
            className="bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold flex items-center gap-1.5"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Отправка диспетчеру...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                <span>Отправить на проверку</span>
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
