// ============================================================================
// Компонент: ImportNomenclatureDialog
// Назначение: Модальное окно загрузки и импорта файла прайс-листа номенклатуры
//             с автоматическим распознаванием названий, розничных цен и цен по акции.
// Поддерживаемые форматы: .txt (TSV), .csv, .tsv
// Поддерживаемые кодировки: Windows-1251 (1C/Excel) и UTF-8
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
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  FileCheck,
} from "lucide-react";

interface ParsedItem {
  name: string;
  price: number;
  installation_price: number | null;
  unit: string;
  category: string;
}

interface ImportNomenclatureDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const ImportNomenclatureDialog: React.FC<ImportNomenclatureDialogProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fileName, setFileName] = useState<string>("");
  const [fileSizeKb, setFileSizeKb] = useState<number>(0);
  const [parsedItems, setParsedItems] = useState<ParsedItem[]>([]);
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [importProgress, setImportProgress] = useState<number>(0);
  const [importStats, setImportStats] = useState<{ total: number; success: number; updated: number }>({
    total: 0,
    success: 0,
    updated: 0,
  });

  // Функция парсинга числового значения цены из текстовой строки с пробелами и запятыми
  const parsePrice = (valStr: string): number | null => {
    if (!valStr) return null;
    // Очищаем пробелы, неразрывные пробелы и меняем запятую на точку
    const cleaned = valStr.replace(/[\s\u00A0]/g, "").replace(",", ".");
    const match = cleaned.match(/(\d+(?:\.\d+)?)/);
    if (match) {
      const num = parseFloat(match[1]);
      return isNaN(num) ? null : num;
    }
    return null;
  };

  // Чтение файла с поддержкой кодировок Windows-1251 и UTF-8
  const readFileWithEncoding = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      console.log(`[Импорт] Чтение файла: ${file.name}, размер: ${(file.size / 1024).toFixed(1)} КБ`);
      const reader = new FileReader();

      // Сначала пробуем прочитать как Windows-1251 (стандарт 1С в РФ)
      reader.readAsText(file, "windows-1251");
      reader.onload = (e) => {
        const text = e.target?.result as string;
        // Если при чтении windows-1251 появляются символы нераспознанной кодировки (), пробуем UTF-8
        if (text.includes("") && !text.includes("Прайс") && !text.includes("Номенклатура")) {
          console.log("[Импорт] Обнаружены ошибки декодирования CP1251, повторная попытка в UTF-8...");
          const utf8Reader = new FileReader();
          utf8Reader.readAsText(file, "utf-8");
          utf8Reader.onload = (e2) => resolve(e2.target?.result as string);
          utf8Reader.onerror = reject;
        } else {
          resolve(text);
        }
      };
      reader.onerror = reject;
    });
  };

  // Обработка выбора файла пользователем
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setFileSizeKb(Math.round(file.size / 1024));
    setIsParsing(true);
    setParsedItems([]);

    try {
      const rawText = await readFileWithEncoding(file);
      const lines = rawText.split(/\r?\n/);
      console.log(`[Импорт] Всего строк в загруженном файле: ${lines.length}`);

      const items: ParsedItem[] = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Разделяем по табуляции или по точке с запятой (CSV)
        const parts = line.includes("\t") ? line.split("\t") : line.split(";");
        if (parts.length < 2) continue;

        const code = parts[0]?.trim() || "";
        let name = parts[1]?.trim() || "";
        const pRetailRaw = parts[2]?.trim() || "";
        const pPromoRaw = parts[3]?.trim() || "";

        // Если в колонке 1 пусто, но есть текст в колонке 0 (без цифр)
        if (!name && code && !/^\d+$/.test(code)) {
          name = code;
        }

        if (!name) continue;

        // Фильтруем заголовочные строки
        const lowerName = name.toLowerCase();
        if (
          lowerName.includes("прайс-лист") ||
          lowerName.includes("ценовая группа") ||
          lowerName.includes("номенклатура") ||
          lowerName.includes("не включает ндс") ||
          lowerName.includes("цена")
        ) {
          continue;
        }

        const retailPrice = parsePrice(pRetailRaw);
        const promoPrice = parsePrice(pPromoRaw);

        if (retailPrice !== null || promoPrice !== null) {
          const price = retailPrice !== null ? retailPrice : (promoPrice || 0);
          const instPrice = promoPrice !== null ? promoPrice : price;

          // Автоматическая классификация категории и единицы измерения
          let category = "equipment";
          let unit = "шт";

          if (/(монтаж|установка|демонтаж|ремонт|выезд|настройка|программирование|услуга|то |диагностика)/i.test(name)) {
            category = "service";
            unit = "услуга";
          } else if (/(кабель|провод|витая пара|анкер|дюбель|саморез|бита|стяжка|изолента|гофра|короб)/i.test(name)) {
            category = "material";
            unit = /(кабель|провод|витая пара)/i.test(name) ? "м" : "шт";
          }

          items.push({
            name,
            price,
            installation_price: instPrice,
            unit,
            category,
          });
        }
      }

      console.log(`[Импорт] Успешно распознано валидных позиций: ${items.length}`);
      setParsedItems(items);

      if (items.length === 0) {
        toast({
          title: "Товары не найдены",
          description: "Не удалось распознать строки номенклатуры и цен в выбранном файле.",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      console.error("[Импорт] Ошибка парсинга файла:", err);
      toast({
        title: "Ошибка чтения файла",
        description: err.message || "Не удалось обработать файл.",
        variant: "destructive",
      });
    } finally {
      setIsParsing(false);
    }
  };

  // Сброс выбора файла
  const handleReset = () => {
    setFileName("");
    setFileSizeKb(0);
    setParsedItems([]);
    setImportProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Пакетная загрузка товаров в базу данных PostgreSQL через Supabase
  const handleExecuteImport = async () => {
    if (parsedItems.length === 0) return;

    setIsImporting(true);
    setImportProgress(0);
    console.log(`[Импорт] Старт сохранения ${parsedItems.length} позиций в базу данных...`);

    const BATCH_SIZE = 50;
    let savedCount = 0;

    try {
      for (let i = 0; i < parsedItems.length; i += BATCH_SIZE) {
        const batch = parsedItems.slice(i, i + BATCH_SIZE).map((item) => ({
          name: item.name,
          price: item.price,
          installation_price: item.installation_price,
          unit: item.unit,
          category: item.category,
          is_active: true,
          updated_at: new Date().toISOString(),
        }));

        // Вставляем или обновляем товары по имени
        const { error } = await supabase.from("products").upsert(batch, {
          onConflict: "name",
          ignoreDuplicates: false,
        });

        if (error) {
          // Если на таблице products нет уникального ограничения по name, выполняем обычный insert
          console.warn("[Импорт] Ошибка upsert, выполняем стандартный insert:", error.message);
          const { error: insertErr } = await supabase.from("products").insert(batch);
          if (insertErr) throw insertErr;
        }

        savedCount += batch.length;
        const progressPercent = Math.round((savedCount / parsedItems.length) * 100);
        setImportProgress(progressPercent);
      }

      console.log(`[Импорт] ✅ Успешно импортировано позиций: ${savedCount}`);
      setImportStats({ total: parsedItems.length, success: savedCount, updated: 0 });

      toast({
        title: "Импорт завершен!",
        description: `Успешно загружено ${savedCount} товаров и услуг с ценами.`,
      });

      onSuccess();
      onClose();
      handleReset();
    } catch (err: any) {
      console.error("[Импорт] Критическая ошибка при сохранении в БД:", err);
      toast({
        title: "Ошибка импорта в базу данных",
        description: err.message || "Сбой при записи товаров в БД.",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isImporting && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <FileSpreadsheet className="h-6 w-6" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">Импорт номенклатуры с ценами</DialogTitle>
              <DialogDescription className="text-xs">
                Загрузка прайс-листа оборудования, материалов и услуг из 1С / Excel в CRM.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2 text-left">
          {/* Область прикрепления файла */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.tsv,.csv"
            onChange={handleFileChange}
            disabled={isImporting}
            className="hidden"
          />

          {!fileName ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-amber-500 rounded-2xl p-6 text-center cursor-pointer transition-colors bg-slate-50/50 dark:bg-slate-900/20 hover:bg-amber-500/5 space-y-2"
            >
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 mx-auto flex items-center justify-center">
                <UploadCloud className="h-6 w-6" />
              </div>
              <div>
                <p className="font-bold text-sm text-foreground">Выберите файл номенклатуры</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Форматы: TXT, TSV или CSV (выгрузка прайса из 1С)
                </p>
              </div>
              <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium pt-1">
                ⚡ Файл будет прочитан с розничной ценой и ценой по акции
              </p>
            </div>
          ) : (
            <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 overflow-hidden">
                  <div className="p-2 rounded-xl bg-amber-500 text-white shrink-0">
                    <FileCheck className="h-5 w-5" />
                  </div>
                  <div className="truncate">
                    <p className="font-bold text-xs text-foreground truncate">{fileName}</p>
                    <p className="text-[10px] text-muted-foreground">
                      Размер: ~{fileSizeKb} КБ • Найдено позиций: <strong>{parsedItems.length}</strong>
                    </p>
                  </div>
                </div>
                {!isImporting && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleReset}
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive rounded-lg"
                    title="Выбрать другой файл"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>

              {/* Прогресс импорта */}
              {isImporting && (
                <div className="space-y-1.5 pt-2">
                  <div className="flex justify-between text-xs font-semibold">
                    <span>Импорт в базу данных...</span>
                    <span>{importProgress}%</span>
                  </div>
                  <Progress value={importProgress} className="h-2 rounded-full" />
                </div>
              )}

              {/* Предпросмотр распознанных строк */}
              {parsedItems.length > 0 && !isImporting && (
                <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                  <span className="text-[11px] font-semibold text-muted-foreground block uppercase tracking-wider">
                    Предпросмотр первых позиций:
                  </span>
                  <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                    {parsedItems.slice(0, 6).map((item, idx) => (
                      <div
                        key={idx}
                        className="p-2 rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-950 text-xs flex items-center justify-between gap-2"
                      >
                        <div className="truncate flex-1">
                          <p className="font-semibold text-foreground truncate">{item.name}</p>
                          <span className="text-[10px] text-muted-foreground">Категория: {item.category} • Ед: {item.unit}</span>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-bold text-foreground text-xs">{item.price.toFixed(0)} ₽</p>
                          {item.installation_price !== null && (
                            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold block">
                              акция: {item.installation_price.toFixed(0)} ₽
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  {parsedItems.length > 6 && (
                    <p className="text-[11px] text-muted-foreground text-center pt-1">
                      ... и ещё {parsedItems.length - 6} позиций готовы к импорту
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={isImporting} className="rounded-xl">
            Отмена
          </Button>
          <Button
            onClick={handleExecuteImport}
            disabled={parsedItems.length === 0 || isImporting || isParsing}
            className="bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold flex items-center gap-1.5"
          >
            {isImporting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Загрузка ({importProgress}%)...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                <span>Импортировать {parsedItems.length > 0 ? `(${parsedItems.length})` : ""}</span>
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
