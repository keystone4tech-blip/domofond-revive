import React, { useState, useEffect, useMemo, useRef } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
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
  FileSpreadsheet,
  Building2,
  ChevronRight,
  ChevronDown,
  Upload,
  Search,
  Trash2,
  RefreshCw,
  Copy,
  Check,
  Clock,
  AlertTriangle,
  Layers,
  History,
  AlertCircle,
  FileText,
  Loader2,
  Wallet,
  Home,
  Users,
  Phone,
  UserCheck,
  DoorOpen
} from "lucide-react";

// Интерфейс лицевого счета абонента
export interface Account {
  id: string;
  account_number: string;
  address: string;
  apartment: string | null;
  period: string;
  debt_amount: number;
  created_at: string;
  full_name?: string | null;
  phone?: string | null;
  entrance?: string | null;
  has_handset?: boolean | null;
  has_lk?: boolean | null; // Флаг наличия личного кабинета (из файла абонентов)
  payment_type?: string | null;
  street?: string | null;
  house?: string | null;
  housing?: string | null;
}

// Интерфейс разобранной строки реестра начислений
export interface ParsedRegistryRow {
  account_number: string;
  address: string;
  apartment: string | null;
  period: string;
  debt_amount: number;
  full_name?: string | null;
  street?: string | null;
  house?: string | null;
  housing?: string | null;
  entrance?: string | null;
}

// Интерфейс загруженного файла реестра
export interface RegistryUpload {
  id: string;
  filename: string;
  batch_number: number;
  period: string;
  total_records: number;
  total_debt_amount: number;
  uploaded_at: string;
}

// Форматирование периода (например "0526" -> "Май 2026")
const formatPeriod = (period: string) => {
  if (!period) return "—";
  if (period.length === 4) {
    const month = period.substring(0, 2);
    const year = "20" + period.substring(2);
    const months = ["", "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
    return `${months[parseInt(month, 10)] || month} ${year}`;
  }
  return period;
};

// Извлечение номера реестра из названия файла (например "2311283958_40702810200490000233_097" -> 97)
const parseBatchNumberFromFilename = (filename: string): number | null => {
  const clean = filename.replace(/\.(txt|csv)$/i, "").trim();
  const parts = clean.split("_");
  if (parts.length >= 3) {
    const lastPart = parts[parts.length - 1];
    const num = parseInt(lastPart, 10);
    if (!isNaN(num)) return num;
  }
  // Запасной поиск числа в конце
  const match = clean.match(/(\d+)$/);
  if (match) {
    const num = parseInt(match[1], 10);
    if (!isNaN(num)) return num;
  }
  return null;
};

// Извлечение города, улицы и точного дома с корпусом/литерами из адреса
const extractAddressParts = (rawAddr: string) => {
  if (!rawAddr) return { city: "Краснодар", houseKey: "Не указан" };
  const parts = rawAddr.split(",").map(p => p.trim());
  const city = parts[0] || "Краснодар";

  // Отфильтровываем город (первая часть), а также части с подъездом и квартирой
  const houseParts = parts.slice(1).filter(p => {
    return !/^(?:п\.|п\s*\d+|подъезд|кв\.|кв\s*\d+|квартира)/i.test(p);
  });

  const houseKey = houseParts.length > 0 ? houseParts.join(", ") : (parts[1] || parts[0] || "Не указан");

  return { city, houseKey };
};

// Извлечение номера подъезда из данных счёта или строки адреса
const getAccountEntrance = (acc: { entrance?: string | null; address?: string | null }): string => {
  // 1. Если подъезд явно задан в столбце entrance (из каталога абонентов 1С)
  if (acc.entrance && String(acc.entrance).trim()) {
    return String(acc.entrance).trim();
  }
  // 2. Иначе парсим из строки адреса (п. 1, подъезд 1, п 1)
  if (acc.address) {
    const match = acc.address.match(/(?:^|,|\s)(?:подъезд|п\.?)\s*(\d+)/i);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  return "";
};

export const AccountsManager: React.FC = () => {
  const { toast } = useToast();

  // --- Состояния данных ---
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [lastRegistry, setLastRegistry] = useState<RegistryUpload | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "debt" | "overpayment" | "zero">("all");

  // --- Выбранный узел дерева ---
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [selectedHouse, setSelectedHouse] = useState<string | null>(null); // null = Все адреса
  const [selectedEntrance, setSelectedEntrance] = useState<string | null>(null); // null = Все подъезды выбранного дома

  // --- Раскрытые узлы дерева ---
  const [expandedCities, setExpandedCities] = useState<Record<string, boolean>>({});
  const [expandedHouses, setExpandedHouses] = useState<Record<string, boolean>>({}); // Раскрытые дома в дереве

  // --- Модальное окно загрузки реестра ---
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedRegistryRow[]>([]);
  const [parsedBatchNum, setParsedBatchNum] = useState<number | null>(null);
  const [parsedPeriod, setParsedPeriod] = useState<string>("");
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [isSavingBatch, setIsSavingBatch] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Предупреждение о версии реестра
  const [showVersionWarning, setShowVersionWarning] = useState(false);
  const [versionWarningMsg, setVersionWarningMsg] = useState("");

  // --- Модальное окно загрузки базы абонентов (Список всех абонентов .txt) ---
  const [isSubscribersUploadOpen, setIsSubscribersUploadOpen] = useState(false);
  const [subscribersFile, setSubscribersFile] = useState<File | null>(null);
  const [parsedSubscribers, setParsedSubscribers] = useState<any[]>([]);
  const [isProcessingSubscribersFile, setIsProcessingSubscribersFile] = useState(false);
  const [isSavingSubscribers, setIsSavingSubscribers] = useState(false);
  const [subscribersProgress, setSubscribersProgress] = useState(0);

  // --- Модальное окно истории счета ---
  const [selectedAccountForHistory, setSelectedAccountForHistory] = useState<Account | null>(null);
  const [accountHistoryRows, setAccountHistoryRows] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // --- Загрузка счетов и последнего реестра из Supabase ---
  const loadData = async () => {
    try {
      setLoading(true);
      console.log("[AccountsManager] Загрузка счетов и истории реестров...");

      // 1. Получаем информацию о последнем загруженном реестре
      const { data: regData } = await supabase
        .from("account_registry_uploads" as any)
        .select("*")
        .order("batch_number", { ascending: false })
        .limit(1);

      if (regData && regData.length > 0) {
        setLastRegistry(regData[0]);
        console.log("[AccountsManager] Последний загруженный реестр:", regData[0]);
      }

      // 2. Загружаем все лицевые счета (без лимита 100 строк)
      const { data, error } = await supabase
        .from("accounts")
        .select("*")
        .order("address", { ascending: true })
        .limit(50000);

      if (error) throw error;

      console.log(`[AccountsManager] Успешно загружено счетов: ${data?.length || 0}`);
      setAccounts(data || []);

      // Автоматически раскрываем первый город
      if (data && data.length > 0) {
        const { city } = extractAddressParts(data[0].address);
        setExpandedCities(prev => ({ ...prev, [city]: true }));
        if (!selectedCity) setSelectedCity(city);
      }
    } catch (err: any) {
      console.error("[AccountsManager] Ошибка при загрузке:", err);
      toast({
        title: "Ошибка загрузки",
        description: err.message || "Не удалось загрузить список лицевых счетов",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // --- Построение дерева адресов: Город -> Дом -> Подъезды со счетчиками ---
  const addressTree = useMemo(() => {
    // tree: city -> houseKey -> { all: Account[], entrances: Record<string, Account[]> }
    const tree: Record<string, Record<string, { all: Account[]; entrances: Record<string, Account[]> }>> = {};

    accounts.forEach(acc => {
      const { city, houseKey } = extractAddressParts(acc.address);
      const entrance = getAccountEntrance(acc);

      if (!tree[city]) tree[city] = {};
      if (!tree[city][houseKey]) {
        tree[city][houseKey] = { all: [], entrances: {} };
      }
      tree[city][houseKey].all.push(acc);

      if (entrance) {
        if (!tree[city][houseKey].entrances[entrance]) {
          tree[city][houseKey].entrances[entrance] = [];
        }
        tree[city][houseKey].entrances[entrance].push(acc);
      }
    });

    return tree;
  }, [accounts]);

  // Список доступных подъездов для выбранного дома, отсортированный по возрастанию
  const availableEntrancesForSelectedHouse = useMemo(() => {
    if (!selectedHouse || !selectedCity || !addressTree[selectedCity] || !addressTree[selectedCity][selectedHouse]) {
      return [];
    }
    const houseObj = addressTree[selectedCity][selectedHouse];
    const entranceKeys = Object.keys(houseObj.entrances);
    return entranceKeys.sort((a, b) => {
      const numA = parseInt(a, 10) || 0;
      const numB = parseInt(b, 10) || 0;
      return numA - numB;
    });
  }, [selectedHouse, selectedCity, addressTree]);

  // --- Фильтрация счетов в правой колонке ---
  const displayedAccounts = useMemo(() => {
    let list = accounts;

    // Если в строке поиска есть запрос - производим сквозной поиск по всей базе (независимо от выбранной папки)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = accounts.filter(acc => 
        acc.account_number.toLowerCase().includes(q) ||
        acc.address.toLowerCase().includes(q) ||
        (acc.apartment && acc.apartment.toLowerCase().includes(q)) ||
        (acc.full_name && acc.full_name.toLowerCase().includes(q)) ||
        (acc.phone && acc.phone.toLowerCase().includes(q)) ||
        (acc.payment_type && acc.payment_type.toLowerCase().includes(q)) ||
        acc.period.toLowerCase().includes(q) ||
        acc.debt_amount.toString().includes(q)
      );
    } else {
      // Если поиск пустой, фильтруем по выбранному узлу дерева слева
      if (selectedHouse) {
        list = list.filter(acc => {
          const { houseKey } = extractAddressParts(acc.address);
          if (houseKey !== selectedHouse) return false;
          // Фильтрация по подъезду, если выбран конкретный подъезд
          if (selectedEntrance) {
            const ent = getAccountEntrance(acc);
            return ent === selectedEntrance;
          }
          return true;
        });
      } else if (selectedCity) {
        list = list.filter(acc => {
          const { city } = extractAddressParts(acc.address);
          return city === selectedCity;
        });
      }
    }

    // Фильтр по задолженности
    if (filterType === "debt") {
      list = list.filter(acc => Number(acc.debt_amount) > 0);
    } else if (filterType === "overpayment") {
      list = list.filter(acc => Number(acc.debt_amount) < 0);
    } else if (filterType === "zero") {
      list = list.filter(acc => Number(acc.debt_amount) === 0);
    }

    // Сортировка по номеру квартиры
    return list.sort((a, b) => {
      const numA = parseInt(a.apartment || "0", 10);
      const numB = parseInt(b.apartment || "0", 10);
      if (!isNaN(numA) && !isNaN(numB) && numA !== numB) return numA - numB;
      return a.address.localeCompare(b.address);
    });
  }, [accounts, selectedCity, selectedHouse, selectedEntrance, searchQuery, filterType]);

  // Статистика по отображаемым счетам
  const stats = useMemo(() => {
    let totalDebt = 0;
    let totalOverpayment = 0;
    let debtorsCount = 0;

    displayedAccounts.forEach(acc => {
      const val = Number(acc.debt_amount) || 0;
      if (val > 0) {
        totalDebt += val;
        debtorsCount++;
      } else if (val < 0) {
        totalOverpayment += Math.abs(val);
      }
    });

    return { totalDebt, totalOverpayment, debtorsCount };
  }, [displayedAccounts]);

  // --- Чтение и парсинг файла реестра (.txt / .csv / Взаиморасчеты общие) ---
  const handleFileSelect = async (file: File) => {
    setUploadFile(file);
    setIsProcessingFile(true);
    setShowVersionWarning(false);
    console.log(`[AccountsManager] Выбран файл реестра: ${file.name}, размер: ${file.size} байт`);

    try {
      // 1. Извлекаем номер реестра из имени файла
      const batchNum = parseBatchNumberFromFilename(file.name);
      setParsedBatchNum(batchNum);
      console.log(`[AccountsManager] Распознан номер реестра: ${batchNum}`);

      // Проверка на дублирование / устаревшую версию реестра
      if (batchNum !== null && lastRegistry && lastRegistry.batch_number !== null) {
        if (batchNum < lastRegistry.batch_number) {
          setVersionWarningMsg(
            `Внимание! Вы пытаетесь загрузить реестр № ${batchNum}, хотя в системе уже загружен более свежий реестр № ${lastRegistry.batch_number} (${lastRegistry.filename}). Загрузка старого реестра перезапишет актуальные задолженности.`
          );
          setShowVersionWarning(true);
        } else if (batchNum === lastRegistry.batch_number) {
          setVersionWarningMsg(
            `Внимание! Реестр № ${batchNum} уже был загружен ранее (${new Date(lastRegistry.uploaded_at).toLocaleString("ru-RU")}). Повторная загрузка обновит текущие данные.`
          );
          setShowVersionWarning(true);
        }
      }

      // 2. Читаем файл с автоопределением кодировки (Windows-1251 -> UTF-8)
      const buffer = await file.arrayBuffer();
      let text = "";
      try {
        const decoder1251 = new TextDecoder("windows-1251");
        const text1251 = decoder1251.decode(buffer);
        const decoderUtf8 = new TextDecoder("utf-8");
        const textUtf8 = decoderUtf8.decode(buffer);

        const cyr1251 = (text1251.match(/[а-яА-ЯёЁ]/g) || []).length;
        const cyrUtf8 = (textUtf8.match(/[а-яА-ЯёЁ]/g) || []).length;
        const utf8Errors = (textUtf8.match(/\uFFFD/g) || []).length;

        if (utf8Errors > 0 || cyr1251 >= cyrUtf8) {
          text = text1251;
          console.log("[AccountsManager: Реестр] Использована кодировка Windows-1251");
        } else {
          text = textUtf8;
          console.log("[AccountsManager: Реестр] Использована кодировка UTF-8");
        }
      } catch {
        text = await file.text();
      }

      // Разбиваем на строки, удаляя только хвостовые символы перевода строк \r и \n,
      // сохраняя концевые разделители табуляции \t для точного определения пустых колонок
      const rawLines = text.split("\n");
      const records: ParsedRegistryRow[] = [];
      let detectedPeriod = "";

      // Вспомогательная функция очистки денежной суммы (удаление неразрывных пробелов \xa0 и пробелов)
      const cleanAmountStr = (s: string) => (s || "").replace(/\xa0/g, "").replace(/\s/g, "").replace(",", ".");

      // Определяем формат файла: если есть разделитель табуляция \t, это формат TSV (Взаиморасчеты общие 1С)
      const isTsvFormat = rawLines.some(l => l.includes("\t"));

      console.log(`[AccountsManager: Реестр] Формат файла: ${isTsvFormat ? "TSV (Взаиморасчеты общие 1С)" : "Разделитель ';'"}`);

      const now = new Date();
      const defaultPer = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

      if (isTsvFormat) {
        // Формат «Взаиморасчеты общие.txt»:
        // Строка 0: Лицевой счет \t Абонент \t Адрес \t Долг абонента \t Наш долг
        // Строка 1: \t \t Город, Улица, Дом, Корпус, Подъезд, Квартира \t \t
        // Данные: 0000000001 \t Иванов И.И. \t Краснодар, Душистая (ул), 50, , 1, 1 \t 150,00 \t 0,00
        detectedPeriod = defaultPer;

        for (const line of rawLines) {
          // Удаляем ТОЛЬКО переводы строк (\r, \n), НЕ обрезая хвостовые знаки табуляции (\t)
          const cleanLine = line.replace(/[\r\n]+$/, "");
          if (!cleanLine.trim()) continue;

          // Пропускаем строки заголовков
          if (cleanLine.includes("Лицевой счет") || cleanLine.includes("Город, Улица") || cleanLine.includes("Долг абонента") || cleanLine.includes("Наш долг")) {
            continue;
          }

          const parts = cleanLine.split("\t");
          if (parts.length < 4) continue;

          const rawAcc = parts[0].trim().replace(/\D/g, "");
          if (!rawAcc) continue;
          const accNum = rawAcc.padStart(10, "0");
          if (accNum === "0000000000") continue;

          // Правое позиционирование в TSV:
          // Последняя колонка [length - 1] = Наш долг (переплата абонента со знаком минус)
          // Предпоследняя колонка [length - 2] = Долг абонента (положительный долг)
          // Колонка [length - 3] = Адрес (Город, Улица, Дом, Корпус, Подъезд, Квартира)
          const debtOurRaw = parts[parts.length - 1]?.trim() || "";
          const debtSubRaw = parts[parts.length - 2]?.trim() || "";
          const rawAddr = parts[parts.length - 3]?.trim() || "";

          const subDebt = parseFloat(cleanAmountStr(debtSubRaw)) || 0;
          const ourDebt = parseFloat(cleanAmountStr(debtOurRaw)) || 0;

          let debtAmount = 0;
          if (subDebt > 0) {
            debtAmount = subDebt; // Долг абонента (положительное число)
          } else if (ourDebt > 0) {
            debtAmount = -ourDebt; // Наш долг = переплата абонента (отрицательное число)
          }

          const addrParts = rawAddr.split(",").map(s => s.trim());
          const city = addrParts[0] || "Краснодар";
          const street = addrParts[1] || "";
          const house = addrParts[2] || "";
          const housing = addrParts[3] || null;
          const entrance = addrParts[4] || null;
          const apartment = addrParts[5] || null;

          let fullAddr = `${city}, ${street}`;
          if (house) fullAddr += `, д. ${house}`;
          if (housing) fullAddr += `, корп. ${housing}`;
          if (entrance) fullAddr += `, п. ${entrance}`;
          if (apartment) fullAddr += `, кв. ${apartment}`;

          // ФИО абонента: все колонки между лицевым счетом и адресом
          const fullName = parts.slice(1, parts.length - 3).map(p => p.trim()).filter(Boolean).join(" ") || null;

          records.push({
            account_number: accNum,
            address: fullAddr,
            apartment,
            period: defaultPer,
            debt_amount: debtAmount,
            full_name: fullName,
            street,
            house,
            housing,
            entrance,
          });
        }
      } else {
        // Классический формат с разделителем ';'
        // счет;флаг;адрес;период;сумма
        for (const line of rawLines) {
          const parts = line.trim().replace(/\r$/, "").split(";");
          if (parts.length < 5) continue;

          const accNum = parts[0].trim().replace(/\D/g, "").padStart(10, "0");
          if (!accNum || accNum === "0000000000") continue;

          const addr = parts[2].trim();
          const per = parts[3].trim();
          const debt = parseFloat(cleanAmountStr(parts[4])) || 0;

          if (!detectedPeriod && per) detectedPeriod = per;

          // Извлекаем номер квартиры
          const aptMatch = addr.match(/(?:кв\.|квартира|кв)\s*([a-zA-Zа-яА-Я0-9_-]+)/i);
          const apartment = aptMatch ? aptMatch[1] : null;

          if (accNum && addr) {
            records.push({
              account_number: accNum,
              address: addr,
              apartment,
              period: per,
              debt_amount: debt,
            });
          }
        }
      }

      console.log(`[AccountsManager] Успешно распознано записей в реестре: ${records.length}, период: ${detectedPeriod}`);
      setParsedRows(records);
      setParsedPeriod(detectedPeriod);

      if (records.length === 0) {
        toast({
          title: "Ошибка формата",
          description: "Не удалось распознать записи в файле реестра. Проверьте разделитель (табуляция или ';').",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      console.error("[AccountsManager] Ошибка чтения файла:", err);
      toast({
        title: "Ошибка чтения файла",
        description: err.message || "Не удалось прочитать файл реестра",
        variant: "destructive",
      });
    } finally {
      setIsProcessingFile(false);
    }
  };

  // --- Сохранение реестра в базу данных (с автодобавлением новых счетов и адресов) ---
  const handleSaveRegistry = async () => {
    if (!uploadFile || parsedRows.length === 0) return;

    setIsSavingBatch(true);
    setUploadProgress(0);
    console.log(`[AccountsManager] Старт сохранения ${parsedRows.length} записей реестра...`);

    try {
      const now = new Date();
      const defaultPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      const period = parsedPeriod || defaultPeriod;
      const totalAmount = parsedRows.reduce((sum, r) => sum + r.debt_amount, 0);

      // 1. Фиксируем запись о загрузке реестра в account_registry_uploads
      await supabase.from("account_registry_uploads" as any).insert({
        filename: uploadFile.name,
        batch_number: batchNum,
        period: period,
        total_records: parsedRows.length,
        total_debt_amount: totalAmount,
      });

      // 2. Пакетная вставка/обновление в accounts (батчами по 200 записей)
      // При этом новые лицевые счета автоматически создаются с адресом, подъездом, квартирой и ФИО!
      const batchSize = 200;
      for (let i = 0; i < parsedRows.length; i += batchSize) {
        const chunk = parsedRows.slice(i, i + batchSize);

        // Готовим записи для accounts
        const accountsToUpsert = chunk.map(c => {
          const item: any = {
            account_number: c.account_number,
            address: c.address,
            apartment: c.apartment,
            period: c.period || period,
            debt_amount: c.debt_amount,
            updated_at: new Date().toISOString(),
          };

          // Добавляем структурированные поля адреса и абонента, если они были распарсены
          if (c.full_name) item.full_name = c.full_name;
          if (c.street) item.street = c.street;
          if (c.house) item.house = c.house;
          if (c.housing) item.housing = c.housing;
          if (c.entrance) item.entrance = c.entrance;

          return item;
        });

        // Upsert в accounts
        const { error: accErr } = await supabase
          .from("accounts")
          .upsert(accountsToUpsert, { onConflict: "account_number" });

        if (accErr) {
          console.error("[AccountsManager] Ошибка upsert в accounts:", accErr);
          throw accErr;
        }

        // Фиксация в account_history (срезы начислений)
        await supabase
          .from("account_history" as any)
          .upsert(
            chunk.map(c => ({
              account_number: c.account_number,
              period: c.period || period,
              debt_amount: c.debt_amount,
              batch_number: batchNum,
            })),
            { onConflict: "account_number,batch_number" }
          );

        setUploadProgress(Math.round(((i + chunk.length) / parsedRows.length) * 100));
      }

      // 3. Автоматическая синхронизация подъездов
      try {
        console.log("[AccountsManager] Запуск синхронизации подъездов...");
        await supabase.rpc("sync_entrances_from_accounts");
      } catch (syncErr) {
        console.warn("[AccountsManager] Предупреждение синхронизации:", syncErr);
      }

      toast({
        title: "Реестр успешно загружен!",
        description: `Загружено/обновлено ${parsedRows.length} счетов (Реестр № ${batchNum}, период ${formatPeriod(period)})`,
      });

      setIsUploadOpen(false);
      setUploadFile(null);
      setParsedRows([]);
      setShowVersionWarning(false);
      await loadData();
    } catch (err: any) {
      console.error("[AccountsManager] Ошибка при сохранении реестра:", err);
      toast({
        title: "Ошибка сохранения",
        description: err.message || "Не удалось сохранить реестр в базу данных",
        variant: "destructive",
      });
    } finally {
      setIsSavingBatch(false);
      setUploadProgress(0);
    }
  };

  // --- Чтение и разбор файла "Список всех абонентов .txt" (TSV) ---
  const handleSubscribersFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSubscribersFile(file);
    setIsProcessingSubscribersFile(true);
    console.log(`[AccountsManager: Абоненты] Выбран файл: ${file.name}, размер: ${file.size} байт`);

    try {
      // 1. Читаем файл в бинарный буфер для поддержки кодировок Windows-1251 (1C) и UTF-8
      const buffer = await file.arrayBuffer();
      let text = "";

      try {
        // Декодируем в Windows-1251 (основная кодировка выгрузок 1С на Windows)
        const decoder1251 = new TextDecoder("windows-1251");
        const text1251 = decoder1251.decode(buffer);

        // Также декодируем в UTF-8 для сравнительного анализа
        const decoderUtf8 = new TextDecoder("utf-8");
        const textUtf8 = decoderUtf8.decode(buffer);

        // Подсчитываем количество распознанных кириллических букв и символов искажения
        const cyr1251 = (text1251.match(/[а-яА-ЯёЁ]/g) || []).length;
        const cyrUtf8 = (textUtf8.match(/[а-яА-ЯёЁ]/g) || []).length;
        const utf8Errors = (textUtf8.match(/\uFFFD/g) || []).length;

        console.log(`[AccountsManager: Кодировка] Cyrillic 1251: ${cyr1251}, Cyrillic UTF-8: ${cyrUtf8}, UTF-8 Errors: ${utf8Errors}`);

        // Если в UTF-8 обнаружены спецсимволы ошибок или в Windows-1251 кириллицы значительно больше
        if (utf8Errors > 0 || cyr1251 > cyrUtf8) {
          text = text1251;
          console.log("[AccountsManager: Абоненты] Использована кодировка Windows-1251 (1C)");
        } else {
          text = textUtf8;
          console.log("[AccountsManager: Абоненты] Использована кодировка UTF-8");
        }
      } catch (decErr) {
        console.warn("[AccountsManager: Кодировка] Ошибка декодера, fallback на file.text():", decErr);
        text = await file.text();
      }

      // Разделяем на строки и удаляем пустые
      const lines = text.split("\n").filter(l => l.trim());
      console.log(`[AccountsManager: Абоненты] Всего строк в файле: ${lines.length}`);

      const recordsMap = new Map<string, any>();

      for (let i = 1; i < lines.length; i++) {
        // Очищаем строку от символов возврата каретки Windows \r
        const cleanLine = lines[i].replace(/\r$/, "");
        const p = cleanLine.split("\t");
        if (p.length < 5 || !p[0].trim()) continue;

        const accNum = p[0].trim().replace(/\D/g, "").padStart(10, "0");
        if (!accNum || accNum === "0000000000") continue;

        const fullName = p[1]?.trim() || null;
        const phone = p[2]?.trim() || null;
        
        // Гибкое определение наличия трубки: "Да", "да", "1", "+", "true", "есть"
        const rawHandset = p[3]?.trim().toLowerCase() || "";
        const hasHandset = rawHandset === "да" || rawHandset === "1" || rawHandset === "+" || rawHandset === "true" || rawHandset === "есть" || rawHandset.includes("да");

        // Определение наличия ЛК (колонка 4 «Есть ЛК»): "Да", "да", "1", "+", "true", "есть"
        const rawLk = p[4]?.trim().toLowerCase() || "";
        const hasLk = rawLk === "да" || rawLk === "1" || rawLk === "+" || rawLk === "true" || rawLk === "есть" || rawLk.includes("да");
        
        const street = p[5]?.trim() || "";
        const house = p[6]?.trim() || "";
        const housing = p[7]?.trim() || null;
        const entrance = p[8]?.trim() || null;
        const apartment = p[9]?.trim() || null;
        const paymentType = p[10]?.trim() || null;

        let fullAddr = `Краснодар, ${street}`;
        if (house) fullAddr += `, д. ${house}`;
        if (housing) fullAddr += `, корп. ${housing}`;
        if (entrance) fullAddr += `, п. ${entrance}`;
        if (apartment) fullAddr += `, кв. ${apartment}`;

        const newRec = {
          account_number: accNum,
          full_name: fullName,
          phone: phone,
          has_handset: hasHandset,
          has_lk: hasLk,
          street: street,
          house: house,
          housing: housing,
          entrance: entrance,
          apartment: apartment,
          payment_type: paymentType,
          address: fullAddr,
        };

        if (recordsMap.has(accNum)) {
          const existing = recordsMap.get(accNum);
          if (!existing.full_name && fullName) {
            recordsMap.set(accNum, newRec);
          } else if (existing.phone && phone && !existing.phone.includes(phone)) {
            existing.phone = `${existing.phone}, ${phone}`;
          }
        } else {
          recordsMap.set(accNum, newRec);
        }
      }

      const parsed = Array.from(recordsMap.values());
      const handsetsCount = parsed.filter(s => s.has_handset).length;
      const lkCount = parsed.filter(s => s.has_lk).length;
      console.log(`[AccountsManager: Абоненты] Распознано уникальных счетов: ${parsed.length}, с трубками: ${handsetsCount}, с ЛК: ${lkCount}`);
      setParsedSubscribers(parsed);

      if (parsed.length === 0) {
        toast({
          title: "Ошибка формата",
          description: "Не удалось распознать строки с табуляцией в файле абонентов.",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      console.error("[AccountsManager: Абоненты] Ошибка чтения файла:", err);
      toast({
        title: "Ошибка чтения файла",
        description: err.message || "Не удалось прочитать файл абонентов",
        variant: "destructive",
      });
    } finally {
      setIsProcessingSubscribersFile(false);
    }
  };

  // --- Сохранение базы абонентов в accounts (Upsert батчами без затирания долгов) ---
  const handleSaveSubscribers = async () => {
    if (!subscribersFile || parsedSubscribers.length === 0) return;

    setIsSavingSubscribers(true);
    setSubscribersProgress(0);
    console.log(`[AccountsManager: Абоненты] Старт сохранения ${parsedSubscribers.length} абонентов в базу данных...`);

    try {
      const batchSize = 200;
      for (let i = 0; i < parsedSubscribers.length; i += batchSize) {
        const chunk = parsedSubscribers.slice(i, i + batchSize);

        const { error: upsertErr } = await supabase
          .from("accounts")
          .upsert(
            chunk.map(c => ({
              account_number: c.account_number,
              address: c.address,
              apartment: c.apartment,
              full_name: c.full_name,
              phone: c.phone,
              has_handset: c.has_handset,
              has_lk: c.has_lk,
              street: c.street,
              house: c.house,
              housing: c.housing,
              entrance: c.entrance,
              payment_type: c.payment_type,
              period: "",
              updated_at: new Date().toISOString(),
            })),
            { onConflict: "account_number" }
          );

        if (upsertErr) throw upsertErr;

        // Для абонентов с подключенным ЛК обновляем статус доступа в intercom_credentials
        const lkAccounts = chunk.filter(c => c.has_lk).map(c => c.account_number);
        if (lkAccounts.length > 0) {
          try {
            await supabase
              .from("intercom_credentials" as any)
              .update({
                has_lk: true,
                is_purchased: true,
                updated_at: new Date().toISOString(),
              })
              .in("account_number", lkAccounts);
          } catch (credErr) {
            console.warn("[AccountsManager: Абоненты] Предупреждение обновления intercom_credentials:", credErr);
          }
        }

        setSubscribersProgress(Math.round(((i + chunk.length) / parsedSubscribers.length) * 100));
      }

      // Синхронизируем подъезды
      try {
        console.log("[AccountsManager: Абоненты] Запуск синхронизации подъездов...");
        await supabase.rpc("sync_entrances_from_accounts");
      } catch (syncErr) {
        console.warn("[AccountsManager: Абоненты] Предупреждение синхронизации:", syncErr);
      }

      toast({
        title: "База абонентов успешно сохранена!",
        description: `Синхронизировано ${parsedSubscribers.length} абонентов со всеми контактами и тарифами.`,
      });

      setIsSubscribersUploadOpen(false);
      setSubscribersFile(null);
      setParsedSubscribers([]);
      await loadData();
    } catch (err: any) {
      console.error("[AccountsManager: Абоненты] Ошибка сохранения:", err);
      toast({
        title: "Ошибка сохранения абонентов",
        description: err.message || "Не удалось сохранить абонентов в базу",
        variant: "destructive",
      });
    } finally {
      setIsSavingSubscribers(false);
      setSubscribersProgress(0);
    }
  };

  // --- Просмотр истории начислений конкретного лицевого счета ---
  const handleOpenAccountHistory = async (acc: Account) => {
    setSelectedAccountForHistory(acc);
    setLoadingHistory(true);
    console.log(`[AccountsManager] Загрузка истории для счета: ${acc.account_number}`);

    try {
      const { data, error } = await supabase
        .from("account_history" as any)
        .select("*")
        .eq("account_number", acc.account_number)
        .order("batch_number", { ascending: false });

      if (error) throw error;
      setAccountHistoryRows(data || []);
    } catch (err) {
      console.error("[AccountsManager] Ошибка загрузки истории:", err);
      setAccountHistoryRows([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Копирование в буфер обмена
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Скопировано", description: `${label}: ${text}` });
  };

  return (
    <div className="space-y-6">
      {/* Шапка раздела */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold font-display flex items-center gap-2">
            <FileSpreadsheet className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            Лицевые счета абонентов
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Учет начислений и задолженностей по договорам на обслуживание домофона компании «Домофондар»
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={loading}
            className="rounded-xl h-9"
          >
            <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Обновить
          </Button>

          <Button
            onClick={() => {
              setSubscribersFile(null);
              setParsedSubscribers([]);
              setIsSubscribersUploadOpen(true);
            }}
            variant="outline"
            className="rounded-xl h-9 border-emerald-600/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 font-medium shadow-xs"
          >
            <Users className="h-4 w-4 mr-1.5" />
            Загрузить базу абонентов (список)
          </Button>

          <Button
            onClick={() => {
              setUploadFile(null);
              setParsedRows([]);
              setShowVersionWarning(false);
              setIsUploadOpen(true);
            }}
            className="rounded-xl h-9 bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-sm"
          >
            <Upload className="h-4 w-4 mr-1.5" />
            Загрузить реестр долгов (.txt)
          </Button>
        </div>
      </div>

      {/* Информационная плашка последнего загруженного реестра */}
      {lastRegistry && (
        <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Badge className="bg-emerald-600 text-white font-mono text-xs">
              Реестр № {lastRegistry.batch_number}
            </Badge>
            <span className="font-semibold text-foreground">
              {formatPeriod(lastRegistry.period)} ({lastRegistry.filename})
            </span>
          </div>
          <div className="text-muted-foreground">
            Всего счетов: <strong className="text-foreground">{lastRegistry.total_records}</strong> • Загружен: {new Date(lastRegistry.uploaded_at).toLocaleDateString("ru-RU")}
          </div>
        </div>
      )}

      {/* Двухколоночный макет: Слева дерево адресов, Справа лицевые счета */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* ЛЕВАЯ КОЛОНКА: Дерево адресов (4 колонки) */}
        <div className="lg:col-span-4 space-y-4">
          <Card className="glass-card rounded-[20px] border border-slate-200/60 dark:border-slate-800 shadow-sm">
            <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-emerald-600" />
                  Адреса домов
                </CardTitle>
                <Badge variant="secondary" className="font-mono text-xs">
                  {accounts.length} счетов
                </Badge>
              </div>
              <CardDescription className="text-xs mt-1">
                Выберите дом для просмотра счетов или нажмите «Все адреса»
              </CardDescription>
            </CardHeader>

            <CardContent className="p-3 max-h-[640px] overflow-y-auto space-y-1">
              {/* Кнопка "Все адреса" */}
              <button
                onClick={() => {
                  console.log("[AccountsManager] Сброс фильтра: выбраны Все адреса");
                  setSelectedCity(null);
                  setSelectedHouse(null);
                  setSelectedEntrance(null);
                }}
                className={`w-full flex items-center justify-between p-2 rounded-xl text-left text-xs font-semibold transition-all mb-1 ${
                  selectedHouse === null
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 shrink-0" />
                  <span>Все адреса (сквозной поиск)</span>
                </div>
                <Badge variant={selectedHouse === null ? "outline" : "secondary"} className="text-[10px] font-mono">
                  {accounts.length}
                </Badge>
              </button>

              {Object.keys(addressTree).length === 0 ? (
                <div className="p-6 text-center text-muted-foreground text-xs">
                  <FileText className="h-8 w-8 mx-auto mb-2 text-slate-300 dark:text-slate-700" />
                  Лицевые счета еще не загружены.
                </div>
              ) : (
                Object.entries(addressTree).map(([city, houses]) => {
                  const isCityExpanded = !!expandedCities[city];
                  const totalInCity = Object.values(houses).reduce((sum, h) => sum + h.all.length, 0);

                  return (
                    <div key={city} className="space-y-1">
                      {/* Узел города */}
                      <button
                        onClick={() => {
                          setExpandedCities(prev => ({ ...prev, [city]: !prev[city] }));
                        }}
                        className={`w-full flex items-center justify-between p-2 rounded-xl text-left text-sm font-semibold transition-colors ${
                          selectedCity === city && selectedHouse === null
                            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
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
                        <div className="pl-3 space-y-1 border-l-2 border-slate-100 dark:border-slate-800 ml-3">
                          {Object.entries(houses).map(([houseKey, houseData]) => {
                            const isSelected = selectedHouse === houseKey;
                            const isHouseExpanded = !!expandedHouses[houseKey] || (isSelected && selectedEntrance !== null);
                            const accList = houseData.all;
                            const debtors = accList.filter(a => Number(a.debt_amount) > 0).length;
                            const entranceKeys = Object.keys(houseData.entrances).sort((a, b) => (parseInt(a, 10) || 0) - (parseInt(b, 10) || 0));
                            const hasEntrances = entranceKeys.length > 0;

                            return (
                              <div key={houseKey} className="space-y-0.5">
                                {/* Кнопка выбора дома / раскрытия подъездов */}
                                <button
                                  onClick={() => {
                                    console.log(`[AccountsManager] Выбран дом: ${houseKey}`);
                                    setSelectedCity(city);
                                    setSelectedHouse(houseKey);
                                    setSelectedEntrance(null);
                                    if (hasEntrances) {
                                      setExpandedHouses(prev => ({ ...prev, [houseKey]: !prev[houseKey] }));
                                    }
                                  }}
                                  className={`w-full flex items-center justify-between p-1.5 rounded-lg text-left text-xs transition-all ${
                                    isSelected && selectedEntrance === null
                                      ? "bg-emerald-600 text-white font-semibold shadow-sm"
                                      : isSelected
                                        ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 font-semibold border border-emerald-200 dark:border-emerald-800"
                                        : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                                  }`}
                                >
                                  <div className="flex items-center gap-1.5 truncate">
                                    {hasEntrances ? (
                                      isHouseExpanded ? (
                                        <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-70" />
                                      ) : (
                                        <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-70" />
                                      )
                                    ) : (
                                      <Home className="h-3.5 w-3.5 shrink-0" />
                                    )}
                                    <span className="truncate">{houseKey}</span>
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0">
                                    {debtors > 0 && (
                                      <span
                                        className={`text-[9px] px-1 rounded font-bold ${
                                          isSelected && selectedEntrance === null
                                            ? "bg-white/30 text-white"
                                            : "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300"
                                        }`}
                                      >
                                        {debtors} долг
                                      </span>
                                    )}
                                    <span className={`text-[10px] font-mono ${isSelected && selectedEntrance === null ? "text-white/90" : "text-slate-400"}`}>
                                      {accList.length}
                                    </span>
                                  </div>
                                </button>

                                {/* Вложенный список подъездов дома */}
                                {hasEntrances && isHouseExpanded && (
                                  <div className="pl-3.5 space-y-0.5 border-l-2 border-emerald-300/60 dark:border-emerald-800/60 ml-2.5 my-0.5">
                                    {/* Вариант "Все подъезды дома" */}
                                    <button
                                      onClick={() => {
                                        console.log(`[AccountsManager] Выбраны все подъезды дома: ${houseKey}`);
                                        setSelectedCity(city);
                                        setSelectedHouse(houseKey);
                                        setSelectedEntrance(null);
                                      }}
                                      className={`w-full flex items-center justify-between py-1 px-2 rounded-md text-left text-[11px] transition-colors ${
                                        isSelected && selectedEntrance === null
                                          ? "bg-emerald-600 text-white font-bold shadow-xs"
                                          : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
                                      }`}
                                    >
                                      <span className="truncate">Все подъезды</span>
                                      <span className="font-mono text-[10px]">{accList.length}</span>
                                    </button>

                                    {/* Список конкретных подъездов */}
                                    {entranceKeys.map(entKey => {
                                      const entAccounts = houseData.entrances[entKey] || [];
                                      const entDebtors = entAccounts.filter(a => Number(a.debt_amount) > 0).length;
                                      const isEntSelected = isSelected && selectedEntrance === entKey;

                                      return (
                                        <button
                                          key={entKey}
                                          onClick={() => {
                                            console.log(`[AccountsManager] В дереве выбран дом: ${houseKey}, подъезд: ${entKey}`);
                                            setSelectedCity(city);
                                            setSelectedHouse(houseKey);
                                            setSelectedEntrance(entKey);
                                          }}
                                          className={`w-full flex items-center justify-between py-1 px-2 rounded-md text-left text-[11px] transition-colors ${
                                            isEntSelected
                                              ? "bg-emerald-600 text-white font-bold shadow-xs"
                                              : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                                          }`}
                                        >
                                          <div className="flex items-center gap-1.5 truncate">
                                            <DoorOpen className="h-3 w-3 shrink-0 text-emerald-500" />
                                            <span>Подъезд {entKey}</span>
                                          </div>
                                          <div className="flex items-center gap-1 shrink-0">
                                            {entDebtors > 0 && (
                                              <span
                                                className={`text-[8px] px-1 rounded font-bold ${
                                                  isEntSelected
                                                    ? "bg-white/30 text-white"
                                                    : "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300"
                                                }`}
                                              >
                                                {entDebtors} д.
                                              </span>
                                            )}
                                            <span className={`text-[10px] font-mono ${isEntSelected ? "text-white" : "text-slate-400"}`}>
                                              {entAccounts.length}
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

        {/* ПРАВАЯ КОЛОНКА: Список всех лицевых счетов выбранного адреса (8 колонок) */}
        <div className="lg:col-span-8 space-y-4">
          <Card className="glass-card rounded-[20px] border border-slate-200/60 dark:border-slate-800 shadow-sm">
            <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold text-emerald-600 uppercase tracking-wider flex items-center gap-1.5 flex-wrap">
                    <Layers className="h-3.5 w-3.5 shrink-0" />
                    <span>{selectedCity || "Краснодар"} / {selectedHouse || "Все адреса"}</span>
                    {selectedEntrance && (
                      <Badge className="bg-emerald-600 text-white text-[10px] px-1.5 py-0">
                        Подъезд {selectedEntrance}
                      </Badge>
                    )}
                  </div>
                  <CardTitle className="text-lg font-bold mt-1">
                    Лицевые счета ({displayedAccounts.length})
                  </CardTitle>
                </div>

                {/* Сводные показатели */}
                <div className="flex items-center gap-2 text-xs flex-wrap">
                  <Badge variant="outline" className="text-destructive font-semibold">
                    Долг: {stats.totalDebt.toFixed(2)} ₽ ({stats.debtorsCount})
                  </Badge>
                  {stats.totalOverpayment > 0 && (
                    <Badge variant="outline" className="text-green-600 font-semibold">
                      Переплата: {stats.totalOverpayment.toFixed(2)} ₽
                    </Badge>
                  )}
                </div>
              </div>

              {/* Мгновенный быстрый поиск по любым введенным данным */}
              <div className="flex flex-col sm:flex-row items-center gap-2 pt-3">
                <div className="relative w-full sm:flex-1">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Поиск по номеру лицевого счета, адресу, улице, квартире, сумме..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="pl-9 h-9 rounded-xl text-xs bg-white/50 dark:bg-slate-900/50"
                  />
                </div>

                <div className="flex items-center gap-1 w-full sm:w-auto shrink-0">
                  <Button
                    variant={filterType === "all" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFilterType("all")}
                    className="rounded-xl h-9 text-xs flex-1 sm:flex-initial"
                  >
                    Все ({displayedAccounts.length})
                  </Button>
                  <Button
                    variant={filterType === "debt" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFilterType("debt")}
                    className="rounded-xl h-9 text-xs text-destructive flex-1 sm:flex-initial"
                  >
                    Должники ({stats.debtorsCount})
                  </Button>
                  <Button
                    variant={filterType === "overpayment" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFilterType("overpayment")}
                    className="rounded-xl h-9 text-xs text-green-600 flex-1 sm:flex-initial"
                  >
                    Переплата
                  </Button>
                </div>
              </div>

              {/* Интерактивная полоса выбора подъезда для выбранного дома */}
              {selectedHouse && availableEntrancesForSelectedHouse.length > 0 && (
                <div className="pt-2.5 mt-1 border-t border-slate-100 dark:border-slate-800 flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider shrink-0 mr-1 flex items-center gap-1">
                    <DoorOpen className="h-3.5 w-3.5 text-emerald-600" />
                    Подъезд:
                  </span>
                  
                  {/* Кнопка "Все" */}
                  <Button
                    variant={selectedEntrance === null ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      console.log("[AccountsManager] Быстрый фильтр: выбраны Все подъезды дома:", selectedHouse);
                      setSelectedEntrance(null);
                    }}
                    className={`h-7 px-2.5 rounded-lg text-xs font-semibold shrink-0 transition-all ${
                      selectedEntrance === null ? "bg-emerald-600 text-white" : ""
                    }`}
                  >
                    Все ({addressTree[selectedCity || "Краснодар"]?.[selectedHouse]?.all.length || 0})
                  </Button>

                  {/* Кнопки каждого конкретного подъезда */}
                  {availableEntrancesForSelectedHouse.map(ent => {
                    const entAccounts = addressTree[selectedCity || "Краснодар"]?.[selectedHouse]?.entrances[ent] || [];
                    const entDebtors = entAccounts.filter(a => Number(a.debt_amount) > 0).length;
                    const isEntSelected = selectedEntrance === ent;

                    return (
                      <Button
                        key={ent}
                        variant={isEntSelected ? "default" : "outline"}
                        size="sm"
                        onClick={() => {
                          console.log(`[AccountsManager] Быстрый фильтр: выбран подъезд ${ent} для дома ${selectedHouse}`);
                          setSelectedEntrance(ent);
                        }}
                        className={`h-7 px-2.5 rounded-lg text-xs shrink-0 transition-all flex items-center gap-1.5 ${
                          isEntSelected ? "bg-emerald-600 text-white font-bold" : ""
                        }`}
                      >
                        <span>Подъезд {ent}</span>
                        <Badge 
                          variant={isEntSelected ? "secondary" : "outline"} 
                          className={`text-[9px] px-1 py-0 h-4 ${
                            isEntSelected ? "bg-white/20 text-white" : ""
                          }`}
                        >
                          {entAccounts.length}
                        </Badge>
                        {entDebtors > 0 && (
                          <span className={`text-[9px] px-1 rounded font-bold ${
                            isEntSelected ? "bg-red-500 text-white" : "text-destructive"
                          }`}>
                            {entDebtors} долг
                          </span>
                        )}
                      </Button>
                    );
                  })}
                </div>
              )}
            </CardHeader>

            <CardContent className="p-4">
              {displayedAccounts.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <FileSpreadsheet className="h-10 w-10 mx-auto mb-2 text-slate-300 dark:text-slate-700" />
                  <p className="text-sm font-medium">Счета не найдены</p>
                  <p className="text-xs mt-1">
                    {searchQuery ? "По вашему поисковому запросу ничего не найдено" : "Выберите дом слева или загрузите файл реестра"}
                  </p>
                </div>
              ) : (
                /* Снято ограничение 100 строк — выводятся ВСЕ квартиры дома */
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[640px] overflow-y-auto pr-1">
                  {displayedAccounts.map(acc => {
                    const debt = Number(acc.debt_amount) || 0;
                    const isDebt = debt > 0;
                    const isOverpayment = debt < 0;

                    return (
                      <div
                        key={acc.id}
                        className={`p-3.5 rounded-2xl border transition-all ${
                          isDebt
                            ? "bg-red-50/30 dark:bg-red-950/10 border-red-200/80 dark:border-red-900/40"
                            : isOverpayment
                            ? "bg-green-50/30 dark:bg-green-950/10 border-green-200/80 dark:border-green-900/40"
                            : "bg-white/60 dark:bg-slate-900/60 border-slate-200/80 dark:border-slate-800"
                        } hover:shadow-xs`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-sm text-foreground">
                                {acc.account_number}
                              </span>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => copyToClipboard(acc.account_number, "Лицевой счет")}
                                className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                                title="Скопировать лицевой счет"
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                            <div className="text-[11px] text-muted-foreground truncate max-w-[240px] mt-0.5" title={acc.address}>
                              {acc.address}
                            </div>
                          </div>

                          {/* Сальдо / Задолженность */}
                          <div className="text-right shrink-0">
                            <span
                              className={`font-bold text-sm ${
                                isDebt ? "text-destructive" : isOverpayment ? "text-green-600" : "text-slate-500"
                              }`}
                            >
                              {isDebt ? `−${debt.toFixed(2)} ₽` : isOverpayment ? `+${Math.abs(debt).toFixed(2)} ₽` : "0.00 ₽"}
                            </span>
                            <span className="block text-[10px] text-muted-foreground">
                              {isDebt ? "долг" : isOverpayment ? "переплата" : "баланс"}
                            </span>
                          </div>
                        </div>

                        {/* Дополнительная информация об абоненте */}
                        {(() => {
                          const accEntrance = getAccountEntrance(acc);
                          const hasDetails = acc.full_name || acc.phone || accEntrance || (acc.has_handset !== null && acc.has_handset !== undefined) || acc.payment_type;
                          if (!hasDetails) return null;

                          return (
                            <div className="mt-2.5 text-[11px] space-y-1 bg-slate-50/80 dark:bg-slate-800/40 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800/60">
                              {acc.full_name && (
                                <div className="font-semibold text-foreground flex items-center gap-1.5 truncate">
                                  <Users className="h-3 w-3 text-emerald-600 shrink-0" />
                                  <span className="truncate">{acc.full_name}</span>
                                </div>
                              )}
                              <div className="flex items-center gap-3 text-muted-foreground flex-wrap text-[11px]">
                                {acc.phone && (
                                  <span className="flex items-center gap-1 font-mono text-slate-700 dark:text-slate-300">
                                    <Phone className="h-3 w-3 text-emerald-500" />
                                    <span>{acc.phone}</span>
                                  </span>
                                )}
                                {accEntrance && (
                                  <span className="font-medium flex items-center gap-1">
                                    <DoorOpen className="h-3 w-3 text-emerald-600 shrink-0" />
                                    <span>Подъезд:</span> <strong className="text-foreground">{accEntrance}</strong>
                                  </span>
                                )}
                                {acc.has_handset !== null && acc.has_handset !== undefined && (
                                  <span className="font-medium">
                                    Трубка: {acc.has_handset ? (
                                      <strong className="text-emerald-600 dark:text-emerald-400">Есть</strong>
                                    ) : (
                                      <span className="text-slate-400">Нет</span>
                                    )}
                                  </span>
                                )}
                                {acc.has_lk && (
                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-300 bg-amber-50/50 dark:bg-amber-950/30 font-semibold">
                                    ЛК активен
                                  </Badge>
                                )}
                              </div>
                              {acc.payment_type && (
                                <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                                  Тариф: {acc.payment_type}
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        {/* Нижняя плашка: подъезд, квартира, период и кнопка истории */}
                        <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {getAccountEntrance(acc) && (
                              <Badge variant="outline" className="text-[10px] font-semibold border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300">
                                П. {getAccountEntrance(acc)}
                              </Badge>
                            )}
                            {acc.apartment && (
                              <Badge variant="secondary" className="text-[10px] font-bold">
                                Кв. {acc.apartment}
                              </Badge>
                            )}
                            <span className="text-slate-400 text-[11px]">
                              {formatPeriod(acc.period)}
                            </span>
                          </div>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenAccountHistory(acc)}
                            className="h-6 px-2 text-[11px] text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-lg flex items-center gap-1"
                            title="Посмотреть историю начислений по реестрам"
                          >
                            <History className="h-3 w-3" />
                            <span>История начислений</span>
                          </Button>
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

      {/* ДИАЛОГ ЗАГРУЗКИ ФАЙЛА РЕЕСТРА (.TXT) */}
      <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <Upload className="h-5 w-5 text-emerald-600" />
              Загрузка реестра начислений (.txt)
            </DialogTitle>
            <DialogDescription>
              Загрузите ежемесячный файл формата <code>2311283958_40702810200490000233_097.txt</code>. Номер реестра и период будут определены автоматически.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 flex-1 overflow-y-auto pr-1">
            {/* Поле выбора файла */}
            <div
              className={`border-2 border-dashed rounded-2xl p-6 text-center transition-colors ${
                uploadFile
                  ? "border-emerald-500/50 bg-emerald-50/20 dark:bg-emerald-950/20"
                  : "border-slate-200 dark:border-slate-800 hover:border-emerald-500/50"
              }`}
            >
              <input
                type="file"
                id="registryFileInput"
                accept=".txt,.csv"
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) handleFileSelect(f);
                }}
                className="hidden"
              />
              <label htmlFor="registryFileInput" className="cursor-pointer block">
                <FileText className="h-8 w-8 mx-auto text-emerald-600 mb-2" />
                <span className="font-semibold text-sm block">
                  {uploadFile ? uploadFile.name : "Нажмите для выбора файла реестра (.txt)"}
                </span>
                <p className="text-xs text-muted-foreground mt-1">
                  Формат строки: <code>счет;флаг;адрес;период;сумма</code> (кодировка CP1251 или UTF-8)
                </p>
              </label>
            </div>

            {/* Предупреждение о версионировании реестров */}
            {showVersionWarning && (
              <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1 flex-1">
                  <p className="font-bold text-sm">Внимание по версии реестра!</p>
                  <p>{versionWarningMsg}</p>
                </div>
              </div>
            )}

            {/* Предпросмотр распознанных данных реестра */}
            {parsedRows.length > 0 && (() => {
              const regDebts = parsedRows.filter(r => r.debt_amount > 0);
              const regOverpayments = parsedRows.filter(r => r.debt_amount < 0);
              const regZeros = parsedRows.filter(r => r.debt_amount === 0);
              const totalDebtsSum = regDebts.reduce((s, r) => s + r.debt_amount, 0);
              const totalOverpaymentsSum = regOverpayments.reduce((s, r) => s + Math.abs(r.debt_amount), 0);

              return (
                <div className="space-y-3">
                  {/* Информация о реестре и периоде */}
                  <div className="flex items-center justify-between text-xs bg-slate-50 dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
                    <div>
                      Реестр №: <strong className="text-emerald-600 font-mono text-sm">{parsedBatchNum || "—"}</strong> • Период: <strong className="text-foreground">{formatPeriod(parsedPeriod)}</strong>
                    </div>
                    <div>
                      Всего счетов: <strong className="text-foreground font-mono">{parsedRows.length}</strong>
                    </div>
                  </div>

                  {/* Карточки детальной статистики долгов и переплат */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                    <div className="p-2.5 rounded-xl bg-red-50/60 dark:bg-red-950/20 border border-red-200/80 dark:border-red-900/50">
                      <span className="text-[10px] text-muted-foreground block">Должники</span>
                      <div className="flex items-baseline justify-between mt-0.5">
                        <strong className="text-sm font-mono text-destructive">{regDebts.length}</strong>
                        <span className="text-[11px] font-bold text-destructive">−{totalDebtsSum.toFixed(2)} ₽</span>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-green-50/60 dark:bg-green-950/20 border border-green-200/80 dark:border-green-900/50">
                      <span className="text-[10px] text-muted-foreground block">Переплата</span>
                      <div className="flex items-baseline justify-between mt-0.5">
                        <strong className="text-sm font-mono text-emerald-600">{regOverpayments.length}</strong>
                        <span className="text-[11px] font-bold text-emerald-600">+{totalOverpaymentsSum.toFixed(2)} ₽</span>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-50/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 col-span-2 sm:col-span-1">
                      <span className="text-[10px] text-muted-foreground block">Баланс 0.00 ₽</span>
                      <div className="mt-0.5">
                        <strong className="text-sm font-mono text-foreground">{regZeros.length}</strong>
                        <span className="text-[10px] text-muted-foreground ml-1.5">без задолженности</span>
                      </div>
                    </div>
                  </div>

                  {/* Таблица с первыми записями */}
                  <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden max-h-[240px] overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 dark:bg-slate-800 text-muted-foreground sticky top-0">
                        <tr>
                          <th className="p-2">Лицевой счет</th>
                          <th className="p-2">Адрес / Абонент</th>
                          <th className="p-2 text-right">Сальдо</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                        {parsedRows.slice(0, 20).map((row, idx) => {
                          const isDebt = row.debt_amount > 0;
                          const isOver = row.debt_amount < 0;

                          return (
                            <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                              <td className="p-2 font-bold text-foreground">{row.account_number}</td>
                              <td className="p-2 font-sans truncate max-w-[280px]">
                                <div>{row.address}</div>
                                {row.full_name && (
                                  <div className="text-[10px] text-muted-foreground truncate">{row.full_name}</div>
                                )}
                              </td>
                              <td className="p-2 text-right font-bold">
                                {isDebt ? (
                                  <span className="text-destructive">−{row.debt_amount.toFixed(2)} ₽</span>
                                ) : isOver ? (
                                  <span className="text-emerald-600">+{Math.abs(row.debt_amount).toFixed(2)} ₽</span>
                                ) : (
                                  <span className="text-slate-400">0.00 ₽</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {parsedRows.length > 20 && (
                    <p className="text-[11px] text-center text-muted-foreground">
                      Показаны первые 20 счетов из {parsedRows.length} распознанных.
                    </p>
                  )}
                </div>
              );
            })()}

            {/* Индикатор сохранения */}
            {isSavingBatch && (
              <div className="space-y-1.5 pt-2">
                <div className="flex justify-between text-xs font-semibold">
                  <span>Сохранение счетов в базу данных...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-600 transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Button variant="outline" onClick={() => setIsUploadOpen(false)} disabled={isSavingBatch} className="rounded-xl">
              Отмена
            </Button>
            <Button
              onClick={handleSaveRegistry}
              disabled={isSavingBatch || parsedRows.length === 0}
              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold"
            >
              {isSavingBatch ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                  Сохранение ({uploadProgress}%)...
                </>
              ) : (
                `Импортировать реестр (${parsedRows.length} счетов)`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ДИАЛОГ ИСТОРИИ НАЧИСЛЕНИЙ ПО РЕЕСТРАМ ДЛЯ ВЫБРАННОГО СЧЕТА */}
      <Dialog open={!!selectedAccountForHistory} onOpenChange={open => !open && setSelectedAccountForHistory(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <History className="h-5 w-5 text-emerald-600" />
              История начислений по реестрам
            </DialogTitle>
            <DialogDescription>
              Лицевой счет: <strong className="font-mono text-foreground">{selectedAccountForHistory?.account_number}</strong>
              <span className="block text-xs mt-0.5">{selectedAccountForHistory?.address}</span>
            </DialogDescription>
          </DialogHeader>

          <div className="py-2 space-y-2 max-h-[360px] overflow-y-auto">
            {loadingHistory ? (
              <div className="py-8 text-center text-muted-foreground text-xs flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
                Загрузка истории...
              </div>
            ) : accountHistoryRows.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground text-xs">
                По этому лицевому счету пока нет архивных реестров начислений. Текущий баланс: {selectedAccountForHistory?.debt_amount.toFixed(2)} ₽ ({formatPeriod(selectedAccountForHistory?.period || "")}).
              </div>
            ) : (
              <div className="space-y-2">
                {accountHistoryRows.map(hist => (
                  <div key={hist.id} className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-semibold text-foreground">
                        Реестр № {hist.batch_number} ({formatPeriod(hist.period)})
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        Зафиксировано: {new Date(hist.created_at).toLocaleDateString("ru-RU")}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className={`font-bold font-mono ${Number(hist.debt_amount) > 0 ? "text-destructive" : "text-green-600"}`}>
                        {Number(hist.debt_amount) > 0 ? `−${Number(hist.debt_amount).toFixed(2)} ₽` : `${Number(hist.debt_amount).toFixed(2)} ₽`}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedAccountForHistory(null)} className="rounded-xl">
              Закрыть
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ДИАЛОГ ЗАГРУЗКИ БАЗЫ АБОНЕНТОВ (СПИСОК ВСЕХ АБОНЕНТОВ .TXT) */}
      <Dialog open={isSubscribersUploadOpen} onOpenChange={setIsSubscribersUploadOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <Users className="h-5 w-5 text-emerald-600" />
              Загрузка базы абонентов (картотека 1С)
            </DialogTitle>
            <DialogDescription>
              Загрузка паспорта абонентской базы из файла «Список всех абонентов .txt» (ФИО, телефоны, адреса, подъезды, трубки, тарифы).
              <span className="block mt-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                ✓ Текущие суммы задолженности и периоды начислений не затираются.
              </span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 flex-1 overflow-y-auto">
            {/* Поле выбора файла */}
            <div className="p-6 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-center hover:border-emerald-500/50 transition-all bg-slate-50/50 dark:bg-slate-900/50">
              <input
                type="file"
                accept=".txt,.tsv,.csv"
                onChange={handleSubscribersFileSelect}
                className="hidden"
                id="subscribers-file-input"
              />
              <label
                htmlFor="subscribers-file-input"
                className="cursor-pointer flex flex-col items-center justify-center gap-2"
              >
                <div className="h-12 w-12 rounded-full bg-emerald-100 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600">
                  <Users className="h-6 w-6" />
                </div>
                <div className="text-sm font-semibold">
                  {subscribersFile ? subscribersFile.name : "Выберите файл «Список всех абонентов .txt»"}
                </div>
                <div className="text-xs text-muted-foreground">
                  Формат TSV с разделителем табуляцией. Поддерживаются файлы любого размера.
                </div>
              </label>
            </div>

            {isProcessingSubscribersFile && (
              <div className="p-4 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs flex items-center justify-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
                Идет чтение и анализ структуры абонентской базы...
              </div>
            )}

            {/* Статистика распознанных данных */}
            {parsedSubscribers.length > 0 && (
              <div className="space-y-3 animate-in fade-in duration-200">
                <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 text-xs">
                  <div className="font-bold text-sm text-emerald-900 dark:text-emerald-100 flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-600" />
                    Файл успешно распознан!
                  </div>
                  <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                    <div className="p-2 rounded-xl bg-white/70 dark:bg-slate-900/70 border border-emerald-100 dark:border-slate-800">
                      <span className="text-[10px] text-muted-foreground block">Всего абонентов</span>
                      <strong className="text-sm font-mono text-foreground">{parsedSubscribers.length}</strong>
                    </div>
                    <div className="p-2 rounded-xl bg-white/70 dark:bg-slate-900/70 border border-emerald-100 dark:border-slate-800">
                      <span className="text-[10px] text-muted-foreground block">С телефонами</span>
                      <strong className="text-sm font-mono text-foreground">
                        {parsedSubscribers.filter(s => !!s.phone).length}
                      </strong>
                    </div>
                    <div className="p-2 rounded-xl bg-white/70 dark:bg-slate-900/70 border border-emerald-100 dark:border-slate-800">
                      <span className="text-[10px] text-muted-foreground block">С трубками</span>
                      <strong className="text-sm font-mono text-emerald-600">
                        {parsedSubscribers.filter(s => s.has_handset).length}
                      </strong>
                    </div>
                    <div className="p-2 rounded-xl bg-white/70 dark:bg-slate-900/70 border border-emerald-100 dark:border-slate-800">
                      <span className="text-[10px] text-muted-foreground block">С доступом в ЛК</span>
                      <strong className="text-sm font-mono text-amber-600">
                        {parsedSubscribers.filter(s => s.has_lk).length}
                      </strong>
                    </div>
                    <div className="p-2 rounded-xl bg-white/70 dark:bg-slate-900/70 border border-emerald-100 dark:border-slate-800 col-span-2 sm:col-span-1">
                      <span className="text-[10px] text-muted-foreground block">С тарифом</span>
                      <strong className="text-sm font-mono text-foreground">
                        {parsedSubscribers.filter(s => !!s.payment_type).length}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Превью первых 3 строк */}
                <div className="text-xs font-semibold text-muted-foreground">
                  Предварительный просмотр (первые 3 абонента):
                </div>
                <div className="space-y-1.5 max-h-[160px] overflow-y-auto">
                  {parsedSubscribers.slice(0, 3).map((sub, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs bg-slate-50/50 dark:bg-slate-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                    >
                      <div>
                        <span className="font-mono font-bold text-foreground mr-2">{sub.account_number}</span>
                        <span className="font-semibold text-slate-700 dark:text-slate-300">{sub.full_name || "ФИО не указано"}</span>
                        <span className="block text-[11px] text-muted-foreground">{sub.address}</span>
                      </div>
                      <div className="text-right text-[11px] shrink-0 text-muted-foreground">
                        {sub.phone && <div className="font-mono">{sub.phone}</div>}
                        {sub.payment_type && <div className="text-emerald-600 font-medium">{sub.payment_type}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Button
              variant="outline"
              onClick={() => setIsSubscribersUploadOpen(false)}
              disabled={isSavingSubscribers}
              className="rounded-xl"
            >
              Отмена
            </Button>
            <Button
              onClick={handleSaveSubscribers}
              disabled={isSavingSubscribers || parsedSubscribers.length === 0}
              className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
            >
              {isSavingSubscribers ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                  Сохранение ({subscribersProgress}%)...
                </>
              ) : (
                `Импортировать базу (${parsedSubscribers.length} абонентов)`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AccountsManager;
