import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Copy, Check, Download, FileText, ShieldCheck } from "lucide-react";

/**
 * Компонент "Реквизиты" (Карта партнера) ООО «ДомофонДар»
 * Представляет банковские и юридические реквизиты компании в премиальном стиле Glassmorphism.
 * Содержит функции быстрого копирования полей и скачивания оригинального DOC-файла.
 */
const Requisites = () => {
  const { toast } = useToast();
  // Стейт для отслеживания скопированных полей (чтобы показывать Check вместо Copy)
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Список реквизитов для отображения и копирования
  const requisitesData = [
    { label: "Полное наименование", value: "Общество с ограниченной ответственностью «ДомофонДар»", id: "fullName" },
    { label: "Сокращенное наименование", value: "ООО «ДомофонДар»", id: "shortName" },
    { label: "ИНН", value: "2311283958", id: "inn" },
    { label: "КПП", value: "231101001", id: "kpp" },
    { label: "ОГРН", value: "1192375010904", id: "ogrn" },
    { label: "Адрес (местоположение)", value: "350090, г. Краснодар, проезд им. Репина, дом. 1, пом. 134", id: "address" },
    { label: "Расчетный счет", value: "40702810200490000233", id: "account" },
    { label: "Банк", value: "КБ «КУБАНЬКРЕДИТ» ООО Г. Краснодар", id: "bank" },
    { label: "Корреспондентский счет", value: "30101810200000000722", id: "corrAccount" },
    { label: "БИК", value: "040349722", id: "bik" },
    { label: "Генеральный директор", value: "Ивлев Илья Андреевич (действует на основании Устава)", id: "director" },
    { label: "Телефон", value: "8-903-411-83-93", id: "phone" },
    { label: "Электронная почта", value: "domofondar@mail.ru", id: "email" },
    { label: "ОКВЭД (основной)", value: "95.12 (Ремонт коммуникационного оборудования)", id: "okved" },
    { label: "ОКВЭД (дополнительные)", value: "95.12, 47.43, 43.99.5, 43.34.1, 43.29, 43.22, 43.21", id: "okvedExtra" }
  ];

  // Функция копирования в буфер обмена
  const handleCopy = (value: string, id: string, label: string) => {
    console.log(`[Реквизиты] Копирование поля "${label}": "${value}"`);
    navigator.clipboard.writeText(value);
    setCopiedField(id);
    
    toast({
      title: "Скопировано!",
      description: `${label} успешно скопирован в буфер обмена.`,
    });

    // Сбрасываем иконку галочки через 2 секунды
    setTimeout(() => {
      setCopiedField(null);
    }, 2000);
  };

  // Функция скачивания DOC-файла
  const handleDownloadDoc = () => {
    console.log("[Реквизиты] Запрос на скачивание оригинального DOC-файла реквизитов");
    const docPath = "/media/documents/contracts/РЕКВИЗИТЫ ООО ДомофонДар.doc";
    window.open(docPath, "_blank");
  };

  return (
    <div className="space-y-8 animate-in fade-in-50 duration-500">
      <div className="text-center md:text-left mb-6">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl mb-3 flex items-center justify-center md:justify-start gap-2">
          <ShieldCheck className="h-8 w-8 text-amber-500" />
          Карта партнера
        </h2>
        <p className="text-base text-muted-foreground max-w-2xl">
          Официальные реквизиты компании ООО «ДомофонДар» для заключения договоров и выставления счетов.
        </p>
      </div>

      <Card className="glass-premium border-slate-200/50 dark:border-slate-800/50 shadow-xl overflow-hidden rounded-2xl">
        <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800/50 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="text-lg font-semibold text-foreground">Карточка Клиента (Реквизиты)</CardTitle>
            <CardDescription className="text-xs">Актуально на {new Date().getFullYear()} год</CardDescription>
          </div>
          <Button 
            onClick={handleDownloadDoc}
            className="btn-premium-gold bg-amber-500 hover:bg-amber-600 text-white flex items-center gap-2 h-9 text-xs font-semibold px-4 rounded-xl shadow-md transition-all duration-300"
          >
            <Download className="h-4 w-4" />
            Скачать DOC
          </Button>
        </CardHeader>
        <CardContent className="p-0 divide-y divide-slate-100 dark:divide-slate-800/80">
          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-100 dark:divide-slate-800/80">
            
            {/* Левая колонка */}
            <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {requisitesData.slice(0, 8).map((item) => (
                <div key={item.id} className="flex items-center justify-between p-4 hover:bg-slate-50/20 dark:hover:bg-slate-800/10 transition-colors">
                  <div className="space-y-1 pr-4">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">{item.label}</span>
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 break-words">{item.value}</p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleCopy(item.value, item.id, item.label)}
                    className="h-8 w-8 hover:bg-amber-500/10 hover:text-amber-500 dark:hover:bg-amber-500/20 text-slate-400 rounded-lg flex-shrink-0 transition-colors"
                    title={`Копировать ${item.label}`}
                  >
                    {copiedField === item.id ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              ))}
            </div>

            {/* Правая колонка */}
            <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {requisitesData.slice(8).map((item) => (
                <div key={item.id} className="flex items-center justify-between p-4 hover:bg-slate-50/20 dark:hover:bg-slate-800/10 transition-colors">
                  <div className="space-y-1 pr-4">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">{item.label}</span>
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 break-words">{item.value}</p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleCopy(item.value, item.id, item.label)}
                    className="h-8 w-8 hover:bg-amber-500/10 hover:text-amber-500 dark:hover:bg-amber-500/20 text-slate-400 rounded-lg flex-shrink-0 transition-colors"
                    title={`Копировать ${item.label}`}
                  >
                    {copiedField === item.id ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              ))}
            </div>

          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Requisites;
