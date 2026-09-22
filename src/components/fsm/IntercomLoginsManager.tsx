import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  KeyRound,
  Building2,
  ChevronRight,
  ChevronDown,
  Upload,
  Plus,
  Search,
  Trash2,
  RefreshCw,
  Eye,
  EyeOff,
  Copy,
  Check,
  Smartphone,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileSpreadsheet,
  Edit2,
  DoorClosed,
  Layers,
  Send,
  AlertTriangle
} from "lucide-react";

// Интерфейс для записи учетных данных умного домофона
export interface IntercomCredential {
  id: string;
  city: string;
  street: string;
  house: string;
  entrance: string;
  apartment: string;
  account_number: string | null; // Логин в приложении
  password: string;
  raw_address: string | null;
  entrance_id: string | null;
  account_id: string | null;
  is_purchased: boolean;
  purchased_at: string | null;
  purchased_by_user_id: string | null;
  payment_amount: number;
  created_at: string;
  updated_at: string;
}

// Вспомогательная функция парсинга строки адреса из шапки или названия файла
const parseAddressString = (raw: string) => {
  console.log("[Парсер адреса] Анализ строки:", raw);
  let clean = raw.replace(/_logins\.xls.*$/i, "").replace(/\.xls.*$/i, "").trim();
  
  // Убираем префикс "Список сгенерированных учетных данных для адреса:"
  clean = clean.replace(/^.*(?:для адреса|адрес)[:\s]*/i, "").trim();

  const parts = clean.split(/,\s*/);
  let city = "";
  let street = "";
  let house = "";
  let entrance = "";

  if (parts.length >= 4) {
    city = parts[0].trim();
    street = parts[1].trim();
    house = parts[2].trim().replace(/_/g, "/");
    entrance = parts[3].replace(/^(?:п\.|подъезд\s*|п\s*)/i, "").trim();
  } else if (parts.length === 3) {
    city = parts[0].trim();
    street = parts[1].trim();
    const houseMatch = parts[2].match(/^([^\s,]+)(?:\s+(?:п\.|подъезд)?\s*(\d+))?/i);
    if (houseMatch) {
      house = houseMatch[1].trim().replace(/_/g, "/");
      if (houseMatch[2]) entrance = houseMatch[2].trim();
    } else {
      house = parts[2].trim().replace(/_/g, "/");
    }
  } else if (parts.length === 2) {
    street = parts[0].trim();
    house = parts[1].trim().replace(/_/g, "/");
  }

  console.log("[Парсер адреса] Распознано:", { city, street, house, entrance });
  return { city, street, house, entrance };
};

export const IntercomLoginsManager: React.FC = () => {
  const { toast } = useToast();

  // --- Состояния данных ---
  const [credentials, setCredentials] = useState<IntercomCredential[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPurchased, setFilterPurchased] = useState<"all" | "purchased" | "pending">("all");

  // --- Выбранный узел дерева (Город, Дом, Подъезд) ---
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [selectedHouseKey, setSelectedHouseKey] = useState<string | null>(null); // "street|||house"
  const [selectedEntrance, setSelectedEntrance] = useState<string | null>(null);

  // --- Раскрытые узлы дерева ---
  const [expandedCities, setExpandedCities] = useState<Record<string, boolean>>({});
  const [expandedHouses, setExpandedHouses] = useState<Record<string, boolean>>({});

  // --- Видимость паролей (по id записи) ---
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});

  // --- Модальное окно загрузки файла ---
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<Array<{ apartment: string; account_number: string; password: string }>>([]);
  
  // Поля адреса изначально ПУСТЫЕ (без дефолтных значений по требованию)
  const [uploadCity, setUploadCity] = useState("");
  const [uploadStreet, setUploadStreet] = useState("");
  const [uploadHouse, setUploadHouse] = useState("");
  const [uploadEntrance, setUploadEntrance] = useState("");

  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [isSavingBatch, setIsSavingBatch] = useState(false);
  const [previewSearch, setPreviewSearch] = useState("");

  // Предупреждение о дубликатах подъезда
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);
  const [existingDuplicatesCount, setExistingDuplicatesCount] = useState(0);

  // --- Модальное окно создания / редактирования записи ---
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingCred, setEditingCred] = useState<IntercomCredential | null>(null);
  const [editApartment, setEditApartment] = useState("");
  const [editAccountNumber, setEditAccountNumber] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editIsPurchased, setEditIsPurchased] = useState(false);

  // --- Загрузка списка логопасов из Supabase без ограничений ---
  const fetchCredentials = async () => {
    try {
      setLoading(true);
      console.log("[Логопасы] Загрузка данных из таблицы intercom_credentials...");
      const { data, error } = await supabase
        .from("intercom_credentials" as any)
        .select("*")
        .order("city", { ascending: true })
        .order("street", { ascending: true })
        .order("house", { ascending: true })
        .order("entrance", { ascending: true })
        .order("apartment", { ascending: true })
        .limit(10000); // Снимаем дефолтный лимит

      if (error) throw error;

      console.log(`[Логопасы] Загружено записей: ${data?.length || 0}`);
      setCredentials(data || []);

      // Автоматически разворачиваем первый адрес при первой загрузке
      if (data && data.length > 0 && !selectedCity) {
        const firstCity = data[0].city;
        const firstHouseKey = `${data[0].street}|||${data[0].house}`;
        setExpandedCities(prev => ({ ...prev, [firstCity]: true }));
        setExpandedHouses(prev => ({ ...prev, [firstHouseKey]: true }));
        setSelectedCity(firstCity);
        setSelectedHouseKey(firstHouseKey);
        setSelectedEntrance(data[0].entrance || "1");
      }
    } catch (err: any) {
      console.error("[Логопасы] Ошибка при загрузке данных:", err);
      toast({
        title: "Ошибка загрузки данных",
        description: err.message || "Не удалось загрузить учетные данные умного домофона",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCredentials();
  }, []);

  // --- Построение древовидной структуры адресов ---
  const addressTree = useMemo(() => {
    const tree: Record<string, Record<string, Record<string, IntercomCredential[]>>> = {};

    credentials.forEach(cred => {
      const city = cred.city || "Не указан";
      const houseKey = `${cred.street}|||${cred.house}`;
      const entranceKey = cred.entrance || "1";

      if (!tree[city]) tree[city] = {};
      if (!tree[city][houseKey]) tree[city][houseKey] = {};
      if (!tree[city][houseKey][entranceKey]) tree[city][houseKey][entranceKey] = [];

      tree[city][houseKey][entranceKey].push(cred);
    });

    return tree;
  }, [credentials]);

  // --- Фильтрация квартир в выбранном подъезде/доме ---
  const currentCredentials = useMemo(() => {
    let list = credentials;

    if (selectedCity) {
      list = list.filter(c => c.city === selectedCity);
    }
    if (selectedHouseKey) {
      const [st, hs] = selectedHouseKey.split("|||");
      list = list.filter(c => c.street === st && c.house === hs);
    }
    if (selectedEntrance) {
      list = list.filter(c => (c.entrance || "1") === selectedEntrance);
    }

    // Фильтр по поисковой строке (квартира или логин)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(c => 
        (c.apartment && c.apartment.toLowerCase().includes(q)) ||
        (c.account_number && c.account_number.toLowerCase().includes(q)) ||
        (c.password && c.password.toLowerCase().includes(q))
      );
    }

    // Фильтр по оплате
    if (filterPurchased === "purchased") {
      list = list.filter(c => c.is_purchased);
    } else if (filterPurchased === "pending") {
      list = list.filter(c => !c.is_purchased);
    }

    // Сортировка по номеру квартиры числовым образом
    return list.sort((a, b) => {
      const numA = parseInt(a.apartment, 10);
      const numB = parseInt(b.apartment, 10);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return (a.apartment || "").localeCompare(b.apartment || "");
    });
  }, [credentials, selectedCity, selectedHouseKey, selectedEntrance, searchQuery, filterPurchased]);

  // --- Обработка выбора файла Excel для парсинга ---
  const handleFileSelect = async (file: File) => {
    setUploadFile(file);
    setIsProcessingFile(true);
    console.log(`[Парсер Excel] Выбран файл: ${file.name}, размер: ${file.size} байт`);

    try {
      // 1. Извлекаем адрес из имени файла
      const fromFilename = parseAddressString(file.name);
      if (fromFilename.street) setUploadStreet(fromFilename.street);
      if (fromFilename.house) setUploadHouse(fromFilename.house);
      if (fromFilename.entrance) setUploadEntrance(fromFilename.entrance);
      if (fromFilename.city) setUploadCity(fromFilename.city);

      // 2. Читаем файл через библиотеку XLSX
      const dataBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(dataBuffer, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];

      const rawRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      console.log(`[Парсер Excel] Лист: ${sheetName}, всего строк в файле: ${rawRows.length}`);

      if (rawRows.length === 0) {
        throw new Error("Файл пуст или не содержит таблицы");
      }

      // Проверяем строку 0 на наличие адреса
      const firstRowStr = (rawRows[0] || []).filter(Boolean).join(" ");
      if (firstRowStr.includes("адрес") || firstRowStr.includes(",")) {
        const fromHeader = parseAddressString(firstRowStr);
        if (fromHeader.street && !uploadStreet) setUploadStreet(fromHeader.street);
        if (fromHeader.house && !uploadHouse) setUploadHouse(fromHeader.house);
        if (fromHeader.entrance && !uploadEntrance) setUploadEntrance(fromHeader.entrance);
        if (fromHeader.city && !uploadCity) setUploadCity(fromHeader.city);
      }

      // Ищем строку с заголовками "Договор"/"Логин", "Пароль", "Квартира"
      let headerRowIndex = 1;
      let colContract = 0;
      let colPassword = 1;
      let colApartment = 2;

      for (let r = 0; r < Math.min(rawRows.length, 5); r++) {
        const row = rawRows[r];
        if (!row) continue;
        for (let c = 0; c < row.length; c++) {
          const val = String(row[c] || "").toLowerCase().trim();
          if (val.includes("договор") || val.includes("логин") || val.includes("счет")) colContract = c;
          if (val.includes("парол")) colPassword = c;
          if (val.includes("квартир") || val.includes("кв")) colApartment = c;
        }
        if (row.some((cell: any) => {
          const s = String(cell || "").toLowerCase();
          return s.includes("договор") || s.includes("логин");
        })) {
          headerRowIndex = r;
          break;
        }
      }

      // Извлекаем ВСЕ строки без ограничений
      const extracted: Array<{ apartment: string; account_number: string; password: string }> = [];
      for (let r = headerRowIndex + 1; r < rawRows.length; r++) {
        const row = rawRows[r];
        if (!row || row.length === 0) continue;

        const contractVal = String(row[colContract] || "").trim();
        const passwordVal = String(row[colPassword] || "").trim();
        let apartmentVal = String(row[colApartment] || "").trim();

        // Очищаем формат квартиры от дробей Excel (например 1.0 -> 1)
        if (apartmentVal.endsWith(".0")) {
          apartmentVal = apartmentVal.replace(".0", "");
        }

        if (apartmentVal && passwordVal) {
          extracted.push({
            apartment: apartmentVal,
            account_number: contractVal,
            password: passwordVal,
          });
        }
      }

      console.log(`[Парсер Excel] Успешно распознано ВСЕХ записей квартир: ${extracted.length}`);
      setParsedRows(extracted);

      if (extracted.length === 0) {
        toast({
          title: "Внимание",
          description: "Не удалось найти строки с номерами квартир и паролями. Проверьте структуру файла.",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      console.error("[Парсер Excel] Ошибка парсинга файла:", err);
      toast({
        title: "Ошибка при чтении файла",
        description: err.message || "Не удалось прочитать Excel файл",
        variant: "destructive",
      });
    } finally {
      setIsProcessingFile(false);
    }
  };

  // --- Проверка на дубликаты перед сохранением ---
  const handlePreSaveCheck = async () => {
    if (!uploadCity.trim() || !uploadStreet.trim() || !uploadHouse.trim() || !uploadEntrance.trim()) {
      toast({
        title: "Заполните все поля адреса",
        description: "Укажите город, улицу, номер дома и номер подъезда",
        variant: "destructive",
      });
      return;
    }

    if (parsedRows.length === 0) {
      toast({
        title: "Нет данных для сохранения",
        description: "Файл не содержит записей с квартирами и паролями",
        variant: "destructive",
      });
      return;
    }

    // Проверяем, есть ли уже записи для этого города, улицы, дома и подъезда
    try {
      const { data: existing, error } = await supabase
        .from("intercom_credentials" as any)
        .select("id")
        .eq("city", uploadCity.trim())
        .eq("street", uploadStreet.trim())
        .eq("house", uploadHouse.trim())
        .eq("entrance", uploadEntrance.trim());

      if (error) throw error;

      if (existing && existing.length > 0) {
        // Найдены существующие записи — показываем предупреждение о дубликатах
        setExistingDuplicatesCount(existing.length);
        setShowDuplicateWarning(true);
        return;
      }

      // Дубликатов нет — сохраняем напрямую
      await executeSaveBatch();
    } catch (err: any) {
      console.error("[Логопасы] Ошибка проверки дубликатов:", err);
      // Если проверка завершилась ошибкой, сохраняем с upsert
      await executeSaveBatch();
    }
  };

  // --- Выполнение пакетного сохранения в БД ---
  const executeSaveBatch = async () => {
    setShowDuplicateWarning(false);
    setIsSavingBatch(true);
    console.log(`[Логопасы] Сохранение ${parsedRows.length} записей для адреса: ${uploadCity}, ${uploadStreet}, ${uploadHouse}, п.${uploadEntrance}`);

    try {
      const recordsToInsert = parsedRows.map(row => ({
        city: uploadCity.trim(),
        street: uploadStreet.trim(),
        house: uploadHouse.trim(),
        entrance: uploadEntrance.trim(),
        apartment: row.apartment.trim(),
        account_number: row.account_number.trim() || null,
        password: row.password.trim(),
        raw_address: `${uploadCity.trim()}, ${uploadStreet.trim()}, ${uploadHouse.trim()}, п.${uploadEntrance.trim()}`,
      }));

      // Сохраняем пакетами по 100 записей для гарантированной стабильности
      const batchSize = 100;
      for (let i = 0; i < recordsToInsert.length; i += batchSize) {
        const batch = recordsToInsert.slice(i, i + batchSize);
        const { error } = await supabase
          .from("intercom_credentials" as any)
          .upsert(batch, {
            onConflict: "city,street,house,entrance,apartment",
            ignoreDuplicates: false,
          });

        if (error) throw error;
      }

      toast({
        title: "Данные успешно загружены!",
        description: `Импортировано все ${recordsToInsert.length} квартир по адресу ${uploadStreet}, д. ${uploadHouse}, п. ${uploadEntrance}`,
      });

      // Закрываем окно и сбрасываем файл
      setIsUploadOpen(false);
      setUploadFile(null);
      setParsedRows([]);
      setUploadCity("");
      setUploadStreet("");
      setUploadHouse("");
      setUploadEntrance("");

      // Устанавливаем выбранный узел на загруженный адрес
      setSelectedCity(uploadCity.trim());
      setSelectedHouseKey(`${uploadStreet.trim()}|||${uploadHouse.trim()}`);
      setSelectedEntrance(uploadEntrance.trim());

      // Обновляем список
      await fetchCredentials();
    } catch (err: any) {
      console.error("[Логопасы] Ошибка при сохранении записей:", err);
      toast({
        title: "Ошибка сохранения",
        description: err.message || "Не удалось сохранить записи в базу данных",
        variant: "destructive",
      });
    } finally {
      setIsSavingBatch(false);
    }
  };

  // --- Копирование готового сообщения для отправки абоненту ---
  const handleCopyClientMessage = (cred: IntercomCredential) => {
    const msg = 
`Здравствуйте! Ваши данные для доступа к умному домофону (кв. ${cred.apartment}):

🔑 Логин: ${cred.account_number || "—"}
🔒 Пароль: ${cred.password}

📲 Установите официальное приложение «Мой умный дом»:
• Google Play (Android): https://play.google.com/store/apps/details?id=ru.ufanet.smarthome
• App Store (iPhone): https://apps.apple.com/ru/app/мой-умный-дом/id1450280459
• RuStore: https://www.rustore.ru/catalog/app/ru.ufanet.smarthome

В приложении нажмите «Войти по номеру договора/логину» и укажите эти данные.`;

    navigator.clipboard.writeText(msg);
    toast({
      title: "Готовое сообщение скопировано!",
      description: `Данные для кв. ${cred.apartment} со ссылками на приложение готовы к отправке в WhatsApp/Telegram/СМС.`,
    });
  };

  // --- Переключение статуса оплаты (is_purchased) вручную сотрудником ---
  const handleTogglePurchased = async (cred: IntercomCredential) => {
    const newStatus = !cred.is_purchased;
    console.log(`[Логопасы] Изменение статуса оплаты ID ${cred.id} на: ${newStatus}`);

    try {
      const { error } = await supabase
        .from("intercom_credentials" as any)
        .update({
          is_purchased: newStatus,
          purchased_at: newStatus ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", cred.id);

      if (error) throw error;

      setCredentials(prev =>
        prev.map(c => (c.id === cred.id ? { ...c, is_purchased: newStatus } : c))
      );

      toast({
        title: newStatus ? "Доступ оплачен" : "Оплата отменена",
        description: `Квартира ${cred.apartment}: статус успешно изменен`,
      });
    } catch (err: any) {
      console.error("[Логопасы] Ошибка переключения статуса:", err);
      toast({
        title: "Ошибка",
        description: err.message || "Не удалось изменить статус оплаты",
        variant: "destructive",
      });
    }
  };

  // --- Удаление одной записи ---
  const handleDeleteCredential = async (id: string, apt: string) => {
    if (!confirm(`Вы действительно хотите удалить логопас для квартиры № ${apt}?`)) return;

    try {
      const { error } = await supabase
        .from("intercom_credentials" as any)
        .delete()
        .eq("id", id);

      if (error) throw error;

      setCredentials(prev => prev.filter(c => c.id !== id));
      toast({ title: "Запись удалена", description: `Квартира ${apt} успешно удалена` });
    } catch (err: any) {
      console.error("[Логопасы] Ошибка удаления:", err);
      toast({ title: "Ошибка удаления", description: err.message, variant: "destructive" });
    }
  };

  // --- Удаление всех записей текущего подъезда ---
  const handleDeleteEntranceCredentials = async () => {
    if (!selectedHouseKey || !selectedEntrance) return;
    const [st, hs] = selectedHouseKey.split("|||");
    const count = currentCredentials.length;

    if (!confirm(`ВНИМАНИЕ! Удалить ВСЕ ${count} записей логопасов по адресу: ${st}, д.${hs}, подъезд ${selectedEntrance}?`)) {
      return;
    }

    try {
      setLoading(true);
      const { error } = await supabase
        .from("intercom_credentials" as any)
        .delete()
        .eq("city", selectedCity || "")
        .eq("street", st)
        .eq("house", hs)
        .eq("entrance", selectedEntrance);

      if (error) throw error;

      toast({
        title: "Подъезд очищен",
        description: `Удалено ${count} записей логопасов`,
      });
      await fetchCredentials();
    } catch (err: any) {
      console.error("[Логопасы] Ошибка очистки подъезда:", err);
      toast({ title: "Ошибка очистки", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // --- Сохранение редактирования записи ---
  const handleSaveEdit = async () => {
    if (!editingCred) return;

    try {
      const { error } = await supabase
        .from("intercom_credentials" as any)
        .update({
          apartment: editApartment.trim(),
          account_number: editAccountNumber.trim() || null,
          password: editPassword.trim(),
          is_purchased: editIsPurchased,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editingCred.id);

      if (error) throw error;

      setCredentials(prev =>
        prev.map(c =>
          c.id === editingCred.id
            ? {
                ...c,
                apartment: editApartment.trim(),
                account_number: editAccountNumber.trim() || null,
                password: editPassword.trim(),
                is_purchased: editIsPurchased,
              }
            : c
        )
      );

      setIsEditOpen(false);
      setEditingCred(null);
      toast({ title: "Сохранено", description: `Данные квартиры ${editApartment} обновлены` });
    } catch (err: any) {
      console.error("[Логопасы] Ошибка сохранения записи:", err);
      toast({ title: "Ошибка сохранения", description: err.message, variant: "destructive" });
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Скопировано", description: `${label}: ${text}` });
  };

  // Фильтрация строк в предпросмотре загрузки
  const filteredPreviewRows = useMemo(() => {
    if (!previewSearch.trim()) return parsedRows;
    const q = previewSearch.toLowerCase().trim();
    return parsedRows.filter(
      r => r.apartment.toLowerCase().includes(q) || r.account_number.toLowerCase().includes(q)
    );
  }, [parsedRows, previewSearch]);

  return (
    <div className="space-y-6">
      {/* Шапка раздела */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold font-display flex items-center gap-2">
            <KeyRound className="h-6 w-6 text-amber-500" />
            Логопасы умного домофона
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Загрузка и управление учетными данными (логины и пароли) мобильного приложения «Мой умный дом» для жильцов
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchCredentials}
            disabled={loading}
            className="rounded-xl h-9"
          >
            <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Обновить
          </Button>

          <Button
            onClick={() => {
              setUploadFile(null);
              setParsedRows([]);
              setUploadCity("");
              setUploadStreet("");
              setUploadHouse("");
              setUploadEntrance("");
              setPreviewSearch("");
              setShowDuplicateWarning(false);
              setIsUploadOpen(true);
            }}
            className="rounded-xl h-9 bg-amber-500 hover:bg-amber-600 text-white font-medium"
          >
            <Upload className="h-4 w-4 mr-1.5" />
            Загрузить файл выгрузки
          </Button>
        </div>
      </div>

      {/* Двухколоночный макет */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* ЛЕВАЯ КОЛОНКА: Дерево адресов */}
        <div className="lg:col-span-4 space-y-4">
          <Card className="glass-card rounded-[20px] border border-slate-200/60 dark:border-slate-800 shadow-sm">
            <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-amber-500" />
                  Адреса с логопасами
                </CardTitle>
                <Badge variant="secondary" className="font-mono text-xs">
                  {credentials.length} записей
                </Badge>
              </div>
              <CardDescription className="text-xs mt-1">
                Выберите подъезд для просмотра и отправки данных клиентам
              </CardDescription>
            </CardHeader>

            <CardContent className="p-3 max-h-[640px] overflow-y-auto space-y-1">
              {Object.keys(addressTree).length === 0 ? (
                <div className="p-6 text-center text-muted-foreground text-xs">
                  <FileSpreadsheet className="h-8 w-8 mx-auto mb-2 text-slate-300 dark:text-slate-700" />
                  Логопасы еще не загружены. Нажмите кнопку «Загрузить файл выгрузки» вверху.
                </div>
              ) : (
                Object.entries(addressTree).map(([city, houses]) => {
                  const isCityExpanded = !!expandedCities[city];
                  const totalInCity = Object.values(houses).reduce(
                    (acc, entrances) => acc + Object.values(entrances).reduce((sum, list) => sum + list.length, 0),
                    0
                  );

                  return (
                    <div key={city} className="space-y-1">
                      {/* Узел города */}
                      <button
                        onClick={() => setExpandedCities(prev => ({ ...prev, [city]: !prev[city] }))}
                        className={`w-full flex items-center justify-between p-2 rounded-xl text-left text-sm font-semibold transition-colors ${
                          selectedCity === city
                            ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                            : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200"
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          {isCityExpanded ? (
                            <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
                          ) : (
                            <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                          )}
                          <span className="truncate">{city}</span>
                        </div>
                        <Badge variant="outline" className="text-[11px] font-mono px-1.5 py-0 h-5 shrink-0">
                          {totalInCity}
                        </Badge>
                      </button>

                      {/* Дома в городе */}
                      {isCityExpanded && (
                        <div className="pl-4 space-y-1 border-l-2 border-slate-100 dark:border-slate-800 ml-3">
                          {Object.entries(houses).map(([houseKey, entrances]) => {
                            const [street, house] = houseKey.split("|||");
                            const isHouseExpanded = !!expandedHouses[houseKey];
                            const totalInHouse = Object.values(entrances).reduce(
                              (sum, list) => sum + list.length,
                              0
                            );

                            return (
                              <div key={houseKey} className="space-y-1">
                                {/* Узел дома */}
                                <button
                                  onClick={() => setExpandedHouses(prev => ({ ...prev, [houseKey]: !prev[houseKey] }))}
                                  className={`w-full flex items-center justify-between p-1.5 rounded-lg text-left text-xs font-medium transition-colors ${
                                    selectedHouseKey === houseKey
                                      ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 font-semibold"
                                      : "hover:bg-slate-100 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300"
                                  }`}
                                >
                                  <div className="flex items-center gap-1.5 truncate">
                                    {isHouseExpanded ? (
                                      <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                                    ) : (
                                      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                                    )}
                                    <span className="truncate">{street}, д. {house}</span>
                                  </div>
                                  <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                                    {totalInHouse}
                                  </span>
                                </button>

                                {/* Подъезды в доме */}
                                {isHouseExpanded && (
                                  <div className="pl-4 space-y-0.5 border-l-2 border-slate-100 dark:border-slate-800 ml-2">
                                    {Object.entries(entrances).map(([entranceNum, credsList]) => {
                                      const isSelected =
                                        selectedCity === city &&
                                        selectedHouseKey === houseKey &&
                                        selectedEntrance === entranceNum;
                                      const purchasedCount = credsList.filter(c => c.is_purchased).length;

                                      return (
                                        <button
                                          key={entranceNum}
                                          onClick={() => {
                                            setSelectedCity(city);
                                            setSelectedHouseKey(houseKey);
                                            setSelectedEntrance(entranceNum);
                                          }}
                                          className={`w-full flex items-center justify-between p-1.5 rounded-lg text-left text-xs transition-all ${
                                            isSelected
                                              ? "bg-amber-500 text-white font-semibold shadow-sm"
                                              : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
                                          }`}
                                        >
                                          <div className="flex items-center gap-1.5 truncate">
                                            <DoorClosed className="h-3 w-3 shrink-0" />
                                            <span>Подъезд {entranceNum}</span>
                                          </div>
                                          <div className="flex items-center gap-1 shrink-0">
                                            {purchasedCount > 0 && (
                                              <span
                                                className={`text-[9px] px-1 py-0.2 rounded font-bold ${
                                                  isSelected
                                                    ? "bg-white/30 text-white"
                                                    : "bg-green-100 text-green-700 dark:bg-green-950/60 dark:text-green-300"
                                                }`}
                                              >
                                                {purchasedCount} опл.
                                              </span>
                                            )}
                                            <span className={`text-[10px] font-mono ${isSelected ? "text-white/90" : "text-slate-400"}`}>
                                              {credsList.length}
                                            </span>
                                          </div>
                                        </button>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>

        {/* ПРАВАЯ КОЛОНКА: Список всех квартир выбранного подъезда */}
        <div className="lg:col-span-8 space-y-4">
          <Card className="glass-card rounded-[20px] border border-slate-200/60 dark:border-slate-800 shadow-sm">
            <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold text-amber-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5" />
                    {selectedCity || "Город"} / {selectedHouseKey ? selectedHouseKey.replace("|||", ", д. ") : "Дом"} / Подъезд {selectedEntrance || "1"}
                  </div>
                  <CardTitle className="text-lg font-bold mt-1">
                    Учетные данные квартир ({currentCredentials.length})
                  </CardTitle>
                </div>

                {selectedHouseKey && selectedEntrance && currentCredentials.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDeleteEntranceCredentials}
                    className="text-destructive hover:bg-destructive/10 rounded-xl h-8 text-xs shrink-0"
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" />
                    Очистить подъезд
                  </Button>
                )}
              </div>

              {/* Поиск и фильтры */}
              <div className="flex flex-col sm:flex-row items-center gap-2 pt-3">
                <div className="relative w-full sm:flex-1">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Поиск по квартире или логину..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="pl-9 h-9 rounded-xl text-xs bg-white/50 dark:bg-slate-900/50"
                  />
                </div>

                <div className="flex items-center gap-1 w-full sm:w-auto shrink-0">
                  <Button
                    variant={filterPurchased === "all" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFilterPurchased("all")}
                    className="rounded-xl h-9 text-xs flex-1 sm:flex-initial"
                  >
                    Все ({currentCredentials.length})
                  </Button>
                  <Button
                    variant={filterPurchased === "purchased" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFilterPurchased("purchased")}
                    className="rounded-xl h-9 text-xs text-green-600 flex-1 sm:flex-initial"
                  >
                    Оплачено ({credentials.filter(c => c.is_purchased && (!selectedHouseKey || (c.street === selectedHouseKey.split("|||")[0] && c.house === selectedHouseKey.split("|||")[1]))).length})
                  </Button>
                  <Button
                    variant={filterPurchased === "pending" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFilterPurchased("pending")}
                    className="rounded-xl h-9 text-xs flex-1 sm:flex-initial"
                  >
                    Ожидает
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-4">
              {currentCredentials.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <KeyRound className="h-10 w-10 mx-auto mb-2 text-slate-300 dark:text-slate-700" />
                  <p className="text-sm font-medium">Квартиры не найдены</p>
                  <p className="text-xs mt-1">
                    {searchQuery ? "По вашему запросу ничего не найдено" : "В этом подъезде еще нет загруженных логопасов"}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[640px] overflow-y-auto pr-1">
                  {currentCredentials.map(cred => {
                    const isPassVisible = !!visiblePasswords[cred.id];

                    return (
                      <div
                        key={cred.id}
                        className={`p-3.5 rounded-2xl border transition-all ${
                          cred.is_purchased
                            ? "bg-green-50/50 dark:bg-green-950/20 border-green-200 dark:border-green-800/60"
                            : "bg-white/60 dark:bg-slate-900/60 border-slate-200/80 dark:border-slate-800"
                        } hover:shadow-sm`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold flex items-center justify-center text-sm">
                              {cred.apartment}
                            </div>
                            <div>
                              <div className="font-semibold text-sm flex items-center gap-1.5">
                                Квартира {cred.apartment}
                              </div>
                              <div className="text-[11px] text-muted-foreground font-mono">
                                Логин: <span className="font-semibold text-foreground">{cred.account_number || "—"}</span>
                              </div>
                            </div>
                          </div>

                          {/* Статус оплаты */}
                          <button
                            onClick={() => handleTogglePurchased(cred)}
                            title="Нажмите, чтобы переключить статус"
                            className="cursor-pointer"
                          >
                            {cred.is_purchased ? (
                              <Badge className="bg-green-600 hover:bg-green-700 text-white text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3" />
                                Оплачен доступ
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] px-2 py-0.5 rounded-full text-slate-500 hover:bg-slate-100 flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                Ожидает покупки
                              </Badge>
                            )}
                          </button>
                        </div>

                        {/* Блок пароля */}
                        <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-400 text-[11px]">Пароль:</span>
                            <span className="font-mono font-bold tracking-wider">
                              {isPassVisible ? cred.password : "••••••••••"}
                            </span>
                            <button
                              onClick={() => setVisiblePasswords(prev => ({ ...prev, [cred.id]: !prev[cred.id] }))}
                              className="text-slate-400 hover:text-slate-600 p-0.5 rounded"
                              title={isPassVisible ? "Скрыть" : "Показать"}
                            >
                              {isPassVisible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                            </button>
                          </div>

                          <div className="flex items-center gap-1">
                            {/* Главная кнопка: скопировать готовое сообщение для клиента */}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleCopyClientMessage(cred)}
                              className="h-7 px-2 text-xs bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700 rounded-lg flex items-center gap-1 font-semibold"
                              title="Скопировать логин, пароль и ссылки на приложение для клиента"
                            >
                              <Send className="h-3.5 w-3.5" />
                              <span>Клиенту</span>
                            </Button>

                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyToClipboard(cred.password, "Пароль")}
                              className="h-7 px-1.5 text-xs text-slate-500 rounded-lg"
                              title="Скопировать только пароль"
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </Button>

                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingCred(cred);
                                setEditApartment(cred.apartment);
                                setEditAccountNumber(cred.account_number || "");
                                setEditPassword(cred.password);
                                setEditIsPurchased(cred.is_purchased);
                                setIsEditOpen(true);
                              }}
                              className="h-7 px-1.5 text-xs text-slate-500 rounded-lg"
                              title="Редактировать"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>

                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteCredential(cred.id, cred.apartment)}
                              className="h-7 px-1.5 text-xs text-destructive rounded-lg hover:bg-destructive/10"
                              title="Удалить"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ДИАЛОГ ЗАГРУЗКИ ФАЙЛА ВЫГРУЗКИ EXCEL */}
      <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <FileSpreadsheet className="h-5 w-5 text-amber-500" />
              Загрузка файла с логопасами (Excel)
            </DialogTitle>
            <DialogDescription>
              Загрузите файл выгрузки (.xls / .xlsx / .csv). Адрес и все квартиры будут распознаны автоматически.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 flex-1 overflow-y-auto pr-1">
            {/* Поле выбора / перетаскивания файла */}
            <div
              className={`border-2 border-dashed rounded-2xl p-5 text-center transition-colors ${
                uploadFile
                  ? "border-green-500/50 bg-green-50/20 dark:bg-green-950/20"
                  : "border-slate-200 dark:border-slate-800 hover:border-amber-500/50"
              }`}
            >
              <input
                type="file"
                id="excelFileInput"
                accept=".xls,.xlsx,.csv"
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) handleFileSelect(f);
                }}
                className="hidden"
              />
              <label htmlFor="excelFileInput" className="cursor-pointer block">
                <Upload className="h-7 w-7 mx-auto text-amber-500 mb-2" />
                <span className="font-semibold text-sm block">
                  {uploadFile ? uploadFile.name : "Нажмите для выбора файла или перетащите его сюда"}
                </span>
                <p className="text-xs text-muted-foreground mt-1">
                  Поддерживаются: .xls, .xlsx, .csv (например: Краснодар, Беговая, 56_1, п.1_logins.xls)
                </p>
              </label>
            </div>

            {/* Поля адреса — ИЗНАЧАЛЬНО ПУСТЫЕ, заполняются только из файла или вручную */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-slate-50 dark:bg-slate-900/50 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800">
              <div>
                <Label className="text-xs text-muted-foreground">Город *</Label>
                <Input
                  value={uploadCity}
                  onChange={e => setUploadCity(e.target.value)}
                  placeholder="Введите город"
                  className="h-8 text-xs rounded-lg mt-1"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Улица *</Label>
                <Input
                  value={uploadStreet}
                  onChange={e => setUploadStreet(e.target.value)}
                  placeholder="Введите улицу"
                  className="h-8 text-xs rounded-lg mt-1"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Дом / Корпус *</Label>
                <Input
                  value={uploadHouse}
                  onChange={e => setUploadHouse(e.target.value)}
                  placeholder="Номер дома"
                  className="h-8 text-xs rounded-lg mt-1"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Подъезд *</Label>
                <Input
                  value={uploadEntrance}
                  onChange={e => setUploadEntrance(e.target.value)}
                  placeholder="Номер подъезда"
                  className="h-8 text-xs rounded-lg mt-1"
                />
              </div>
            </div>

            {/* Предупреждение о дубликатах подъезда */}
            {showDuplicateWarning && (
              <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1.5 flex-1">
                  <p className="font-bold text-sm">Внимание: подъезд уже существует в базе!</p>
                  <p>
                    По адресу <strong>{uploadCity}, {uploadStreet}, д. {uploadHouse}, подъезд {uploadEntrance}</strong> уже сохранено <strong>{existingDuplicatesCount} квартир</strong>.
                  </p>
                  <p>
                    Вы хотите <strong>обновить (перезаписать)</strong> существующие логопасы новыми данными из этого файла?
                  </p>
                  <div className="pt-2 flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={executeSaveBatch}
                      disabled={isSavingBatch}
                      className="h-8 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold"
                    >
                      {isSavingBatch ? "Сохранение..." : "Да, обновить логопасы"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowDuplicateWarning(false)}
                      className="h-8 rounded-lg text-xs"
                    >
                      Отмена
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Предпросмотр ВСЕХ строк файла с прокруткой и поиском */}
            {parsedRows.length > 0 && (
              <div className="space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <span className="font-semibold text-foreground flex items-center gap-1.5">
                    <span>Всего квартир в файле:</span>
                    <Badge className="bg-amber-500 font-bold text-xs">{parsedRows.length}</Badge>
                  </span>

                  <div className="relative w-full sm:w-60">
                    <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Быстрый поиск по списку..."
                      value={previewSearch}
                      onChange={e => setPreviewSearch(e.target.value)}
                      className="pl-8 h-7 text-xs rounded-lg"
                    />
                  </div>
                </div>

                {/* Прокручиваемая таблица СО ВСЕМИ строками */}
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden max-h-[320px] overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-muted-foreground sticky top-0 z-10">
                      <tr>
                        <th className="p-2.5 font-bold">№ п/п</th>
                        <th className="p-2.5 font-bold">Квартира</th>
                        <th className="p-2.5 font-bold">Логин (Номер договора)</th>
                        <th className="p-2.5 font-bold">Пароль</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredPreviewRows.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                          <td className="p-2.5 text-muted-foreground font-mono text-[11px]">{idx + 1}</td>
                          <td className="p-2.5 font-bold text-foreground">{row.apartment}</td>
                          <td className="p-2.5 font-mono text-foreground">{row.account_number || "—"}</td>
                          <td className="p-2.5 font-mono text-muted-foreground">{row.password}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Button variant="outline" onClick={() => setIsUploadOpen(false)} className="rounded-xl">
              Отмена
            </Button>
            <Button
              onClick={handlePreSaveCheck}
              disabled={isSavingBatch || parsedRows.length === 0 || !uploadStreet.trim() || !uploadHouse.trim() || !uploadEntrance.trim()}
              className="bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold"
            >
              {isSavingBatch ? "Сохранение..." : `Импортировать все ${parsedRows.length} квартир`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ДИАЛОГ РЕДАКТИРОВАНИЯ ОДНОЙ ЗАПИСИ */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Редактирование логопаса</DialogTitle>
            <DialogDescription>
              Изменение параметров доступа для квартиры {editingCred?.apartment}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs">Номер квартиры</Label>
              <Input
                value={editApartment}
                onChange={e => setEditApartment(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Логин (Номер договора)</Label>
              <Input
                value={editAccountNumber}
                onChange={e => setEditAccountNumber(e.target.value)}
                placeholder="DFDM00003594"
                className="mt-1 font-mono"
              />
            </div>
            <div>
              <Label className="text-xs">Пароль</Label>
              <Input
                value={editPassword}
                onChange={e => setEditPassword(e.target.value)}
                className="mt-1 font-mono"
              />
            </div>
            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="editPurchasedCheckbox"
                checked={editIsPurchased}
                onChange={e => setEditIsPurchased(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-amber-500 focus:ring-amber-400"
              />
              <label htmlFor="editPurchasedCheckbox" className="text-sm font-medium cursor-pointer">
                Услуга удаленного доступа оплачена жильцом
              </label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>Отмена</Button>
            <Button onClick={handleSaveEdit} className="bg-amber-500 hover:bg-amber-600 text-white">
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default IntercomLoginsManager;
