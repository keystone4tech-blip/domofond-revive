// ============================================================================
// Компонент: InstallerSheetManager (Лист монтажника / Акт выдачи оборудования)
// Назначение: Формирование поквартирной ведомости оборудования (трубки, ключи, услуги)
//             по новым домам с экспортом в Excel и графой для личной подписи жильцов.
// Требование: Заказы попадают монтажникам ТОЛЬКО при подтверждении оплаты ('paid').
// ============================================================================

import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useUserRole } from "@/hooks/useUserRole";
import * as XLSX from "xlsx";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { cn } from "@/lib/utils";

// UI Компоненты
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import RequestDetails from "./RequestDetails";

// Иконки
import {
  ClipboardCheck,
  Building2,
  DoorClosed,
  Search,
  CheckCircle2,
  Package,
  Phone,
  User,
  KeyRound,
  Radio,
  AlertCircle,
  FileSpreadsheet,
  Check,
  Loader2,
  Eye,
  FileText,
  Layers,
  ChevronRight,
  ExternalLink,
} from "lucide-react";

// Интерфейс позиции заказа
interface RequestItem {
  id: string;
  request_id: string;
  product_id: string;
  quantity: number;
  price: number;
  product?: {
    id: string;
    name: string;
    unit: string;
    category: string | null;
  } | null;
}

// Интерфейс наряда/заявки оборудования
interface EquipmentOrder {
  id: string;
  name: string;
  phone: string;
  address: string;
  street: string | null;
  house: string | null;
  entrance: string | null;
  apartment: string | null;
  message: string;
  status: string;
  priority: string;
  order_type: string | null;
  payment_status: string | null;
  payment_amount: number | null;
  payment_method: string | null;
  created_at: string;
  updated_at?: string;
  assigned_to?: string | null;
  accepted_by?: string | null;
  accepted_at?: string | null;
  completed_at?: string | null;
  notes?: string | null;
  assigned_employee?: { id: string; full_name: string; phone: string | null } | null;
  accepted_employee?: { id: string; full_name: string; phone: string | null } | null;
  items?: RequestItem[];
}

// Вспомогательная функция нормализации улицы (убирает "(ул)", "ул.", "улица", лишние пробелы)
export const normalizeStreet = (s?: string | null): string => {
  if (!s) return "";
  return s
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/\(ул\)|ул\.?|улица/gi, "")
    .replace(/[^a-zа-я0-9]+/gi, " ")
    .trim()
    .replace(/\s+/g, " ");
};

// Вспомогательная функция нормализации номера дома (схлопывает "3, корп. 1", "3 к2" -> "3к1", "3к2")
export const normalizeHouse = (h?: string | null): string => {
  if (!h) return "";
  let clean = h.toLowerCase().replace(/ё/g, "е").trim();
  clean = clean.replace(/[,\.]/g, " ");
  clean = clean.replace(/(?:корпус|корп|к)\s*(\d+)/gi, "к$1");
  clean = clean.replace(/\s+/g, "");
  return clean;
};

/**
 * Очистка наименования переговорной трубки / ТКП от лишних сервисных пояснений,
 * длинных текстов в скобках ("(выбирайте если у вас...)", "(оплачиваете только...)")
 * и префиксов ("Оборудование:", "ТКП:").
 */
export const cleanHandsetName = (rawName?: string | null): string => {
  if (!rawName) return "Трубка ТКП";
  let name = rawName.trim();
  // Убираем технические префиксы
  name = name.replace(/^(?:оборудование|трубка|ткп|монитор|устройство|товар)\s*[:—\-]\s*/i, "");
  // Убираем длинные пояснения в скобках с условиями заказа
  name = name.replace(/\s*\([^)]*(?:выбирайт|установлен|оплачив|квартир|монтаж|замен|подключ|акци|льгот)[^)]*\)/gi, "");
  // Убираем указания штук в конце типа "(1 шт.)", ": 1 шт"
  name = name.replace(/\s*\(\d+\s*шт\.?\)/gi, "");
  name = name.replace(/\s*:\s*\d+\s*шт\.?/gi, "");
  // Схлопываем лишние пробелы и знаки препинания на концах
  name = name.replace(/^[\s,;—\-]+|[\s,;—\-]+$/g, "").trim();
  return name || "Трубка ТКП";
};

/**
 * Очистка наименования ключа домофона
 */
export const cleanKeyName = (rawName?: string | null): string => {
  if (!rawName) return "Ключ домофона";
  let name = rawName.trim();
  name = name.replace(/^(?:ключ[иа]?|ключ домофона)\s*[:—\-]\s*/i, "");
  name = name.replace(/\s*\([^)]*(?:дополнительн|для|от|вход|штук)[^)]*\)/gi, "");
  name = name.replace(/\s*\(\d+\s*шт\.?\)/gi, "");
  name = name.replace(/\s*:\s*\d+\s*шт\.?/gi, "");
  name = name.replace(/^[\s,;—\-]+|[\s,;—\-]+$/g, "").trim();
  return name || "Ключ домофона";
};

export const InstallerSheetManager: React.FC = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isManager } = useUserRole();

  // Состояния фильтрации адреса
  const [selectedStreet, setSelectedStreet] = useState<string>("");
  const [selectedHouse, setSelectedHouse] = useState<string>("");
  const [selectedEntrance, setSelectedEntrance] = useState<string>("all"); // "all" или номер подъезда
  const [selectedServiceType, setSelectedServiceType] = useState<string>("all"); // "all", "installation", "maintenance", "rent"
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [onlyPaid, setOnlyPaid] = useState<boolean>(true); // По умолчанию только оплаченные

  // Иерархическая навигация по вкладкам: активный дом и активный подъезд
  const [selectedHouseKey, setSelectedHouseKey] = useState<string | null>(null);
  const [activeEntranceTab, setActiveEntranceTab] = useState<string>("all"); // "all" или номер подъезда

  // Состояние модального окна наряда (заявка для открытия в RequestDetails)
  const [selectedOrderForModal, setSelectedOrderForModal] = useState<EquipmentOrder | null>(null);

  // 1. Загрузка справочника адресов (из подъездов entrances и существующих заявок requests)
  const { data: addressData, isLoading: isAddressesLoading } = useQuery({
    queryKey: ["installer-addresses"],
    queryFn: async () => {
      console.log("[Лист монтажника] Загрузка доступных адресов и статусов обслуживания...");
      
      // Запрашиваем уникальные адреса и статусы обслуживания из таблицы entrances
      const { data: entrances, error: entErr } = await supabase
        .from("entrances")
        .select("city, street, house, entrance, service_type")
        .order("street");
      if (entErr) console.warn("[Лист монтажника] Ошибка загрузки entrances:", entErr);

      // Запрашиваем адреса из requests для подстраховки
      const { data: reqAddresses, error: reqErr } = await supabase
        .from("requests")
        .select("street, house, entrance")
        .not("street", "is", null);
      if (reqErr) console.warn("[Лист монтажника] Ошибка загрузки requests addresses:", reqErr);

      // Собираем уникальные улицы, дома и типы обслуживания
      const streetMap = new Map<string, Set<string>>();
      const houseEntranceMap = new Map<string, Set<string>>();
      const entranceServiceTypeMap = new Map<string, string>();
      const houseServiceTypeMap = new Map<string, Set<string>>();
      
      // Карты с нормализованными ключами для надежного сопоставления корпусов ("3, корп. 1" <-> "3к1")
      const normHouseServiceTypeMap = new Map<string, Set<string>>();
      const normEntranceServiceTypeMap = new Map<string, string>();
      const canonicalHouseMap = new Map<string, string>(); // normStreet___normHouse -> оригинальный house из entrances

      const addAddress = (street?: string | null, house?: string | null, entrance?: string | null, serviceType?: string | null) => {
        if (!street || !house) return;
        const s = street.trim();
        const h = house.trim();
        const e = entrance ? entrance.trim() : "";

        if (!streetMap.has(s)) {
          streetMap.set(s, new Set());
        }
        streetMap.get(s)!.add(h);

        const key = `${s}___${h}`;
        if (!houseEntranceMap.has(key)) {
          houseEntranceMap.set(key, new Set());
        }
        if (e) houseEntranceMap.get(key)!.add(e);

        const lowerS = s.toLowerCase();
        const lowerH = h.toLowerCase();
        const normS = normalizeStreet(s);
        const normH = normalizeHouse(h);
        const normKey = `${normS}___${normH}`;

        // Фиксируем канонический вид дома из реестра entrances
        if (serviceType && !canonicalHouseMap.has(normKey)) {
          canonicalHouseMap.set(normKey, h);
        }

        // ВАЖНО: Привязываем serviceType ТОЛЬКО если он явно передан из таблицы entrances!
        // Ни в коем случае не подмешиваем дефолтный "maintenance" из requests, иначе монтажные объекты получают статус "Частично монтаж"!
        if (serviceType) {
          if (e) {
            entranceServiceTypeMap.set(`${lowerS}___${lowerH}___${e}`, serviceType);
            normEntranceServiceTypeMap.set(`${normKey}___${e}`, serviceType);
          }
          if (!houseServiceTypeMap.has(`${lowerS}___${lowerH}`)) {
            houseServiceTypeMap.set(`${lowerS}___${lowerH}`, new Set());
          }
          houseServiceTypeMap.get(`${lowerS}___${lowerH}`)!.add(serviceType);

          if (!normHouseServiceTypeMap.has(normKey)) {
            normHouseServiceTypeMap.set(normKey, new Set());
          }
          normHouseServiceTypeMap.get(normKey)!.add(serviceType);
        }
      };

      // 1. Сначала загружаем официальный реестр подъездов с точными статусами (ТО / Монтаж / Аренда)
      entrances?.forEach(item => addAddress(item.street, item.house, item.entrance, item.service_type));
      // 2. Для адресов из requests передаем serviceType = null (только для выпадающих списков фильтра, не портя статусы!)
      reqAddresses?.forEach(item => addAddress(item.street, item.house, item.entrance, null));

      const streets = Array.from(streetMap.keys()).sort((a, b) => a.localeCompare(b, "ru"));

      return {
        streets,
        streetMap,
        houseEntranceMap,
        entranceServiceTypeMap,
        houseServiceTypeMap,
        normHouseServiceTypeMap,
        normEntranceServiceTypeMap,
        canonicalHouseMap,
      };
    },
  });

  // Доступные дома (по выбранной конкретной улице либо по всем улицам базы)
  const availableHouses = useMemo(() => {
    if (!addressData?.streetMap) return [];
    if (selectedStreet && selectedStreet !== "all") {
      const houseSet = addressData.streetMap.get(selectedStreet);
      return houseSet ? Array.from(houseSet).sort((a, b) => a.localeCompare(b, "ru", { numeric: true })) : [];
    }
    // Если улица не выбрана (Все улицы), возвращаем уникальные дома со всех улиц
    const allHouses = new Set<string>();
    addressData.streetMap.forEach((houses) => {
      houses.forEach((h) => allHouses.add(h));
    });
    return Array.from(allHouses).sort((a, b) => a.localeCompare(b, "ru", { numeric: true }));
  }, [selectedStreet, addressData]);

  // Доступные подъезды по выбранной улице и дому
  const availableEntrances = useMemo(() => {
    if (!addressData?.houseEntranceMap) return [];
    if (selectedStreet && selectedStreet !== "all" && selectedHouse && selectedHouse !== "all") {
      const key = `${selectedStreet}___${selectedHouse}`;
      const entSet = addressData.houseEntranceMap.get(key);
      return entSet ? Array.from(entSet).sort((a, b) => (parseInt(a) || 0) - (parseInt(b) || 0)) : [];
    }
    // Если выбран конкретный дом без жесткой привязки к улице
    if (selectedHouse && selectedHouse !== "all") {
      const entSet = new Set<string>();
      addressData.houseEntranceMap.forEach((ents, key) => {
        if (key.endsWith(`___${selectedHouse}`)) {
          ents.forEach((e) => entSet.add(e));
        }
      });
      return Array.from(entSet).sort((a, b) => (parseInt(a) || 0) - (parseInt(b) || 0));
    }
    return [];
  }, [selectedStreet, selectedHouse, addressData]);

  // При смене улицы сбрасываем дом и подъезд на "Все"
  const handleStreetChange = (newStreet: string) => {
    const val = newStreet === "all" ? "" : newStreet;
    console.log(`[Лист монтажника] Выбрана улица: ${val || "Все улицы"}`);
    setSelectedStreet(val);
    setSelectedHouse("");
    setSelectedEntrance("all");
  };

  // 2. Загрузка всех заказов оборудования (с умным кэшированием и легким фоновым опросом)
  const { data: rawOrders, isLoading: isOrdersLoading } = useQuery({
    queryKey: ["equipment-orders-all"],
    queryFn: async () => {
      console.log("[Лист монтажника] Фоновая загрузка заказов оборудования...");
      const { data, error } = await supabase
        .from("requests")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as EquipmentOrder[];
    },
    staleTime: 3 * 60 * 1000, // 3 минуты данные мгновенно берутся из оперативной памяти
    refetchInterval: 15 * 1000, // Каждые 15 сек тихий фоновый опрос для режима онлайн
  });

  // 3. Загрузка позиций заказов
  const { data: requestItems } = useQuery({
    queryKey: ["equipment-request-items"],
    queryFn: async () => {
      console.log("[Лист монтажника] Фоновая загрузка позиций товаров и услуг...");
      const { data, error } = await supabase
        .from("request_items")
        .select(`
          id, request_id, product_id, quantity, price,
          product:products (id, name, unit, category)
        `);
      if (error) throw error;
      return (data || []) as RequestItem[];
    },
    staleTime: 3 * 60 * 1000, // 3 минуты в кэше
    refetchInterval: 20 * 1000,
  });

  // Загрузка адресов квартир из accounts для автоопределения подъезда по номеру квартиры для всех объектов
  const { data: allAccounts } = useQuery({
    queryKey: ["accounts-entrances-lookup"],
    queryFn: async () => {
      console.log("[Лист монтажника] Загрузка базы лицевых счетов для автоопределения подъездов...");
      const { data, error } = await supabase
        .from("accounts")
        .select("apartment, address")
        .limit(50000);
      if (error) {
        console.warn("[Лист монтажника] Ошибка загрузки accounts:", error);
        return [];
      }
      return data || [];
    },
    staleTime: 10 * 60 * 1000, // 10 минут в кэше (справочник редко меняется)
  });

  // Загрузка оплаченных учетных данных умного домофона (Личный кабинет) по всей компании
  const { data: allCredentials } = useQuery({
    queryKey: ["all-credentials-purchased"],
    queryFn: async () => {
      console.log("[Лист монтажника] Загрузка оплаченных доступов к Личному кабинету...");
      const { data, error } = await supabase
        .from("intercom_credentials")
        .select("street, house, apartment, is_purchased")
        .eq("is_purchased", true);
      if (error) {
        console.warn("[Лист монтажника] Ошибка загрузки intercom_credentials:", error);
        return [];
      }
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Маппинг оплаченных квартир в приложении (Личный кабинет)
  const purchasedAppsMap = useMemo(() => {
    const map = new Map<string, boolean>();
    allCredentials?.forEach(c => {
      if (c.apartment) {
        const aptKey = c.apartment.trim();
        map.set(aptKey, true);
        if (c.street && c.house) {
          const fullKey = `${c.street.trim().toLowerCase()}___${c.house.trim().toLowerCase()}___${aptKey.toLowerCase()}`;
          map.set(fullKey, true);
        }
      }
    });
    return map;
  }, [allCredentials]);

  // Универсальный надежный парсер позиций заказа (из связанных items или текста message)
  // ВАЖНО: Строго исключает «Личный кабинет» из графы трубок/ТКП
  // Вспомогательный парсер структуры заказа (оборудование, ключи, услуги, ЛК)
  const parseOrderDetails = (order: EquipmentOrder, isCredPurchased: boolean) => {
    const keysList: string[] = [];
    let keysCount = 0;
    const keyItems: { name: string; quantity: number }[] = [];

    const handsetsList: string[] = [];
    let handsetsCount = 0;
    const handsetItems: { name: string; quantity: number }[] = [];

    const servicesList: string[] = [];
    let servicesCount = 0;
    const serviceItems: { name: string; quantity: number }[] = [];

    let hasApp = isCredPurchased;

    // Вспомогательная функция: проверка принадлежности к Личному кабинету / приложению
    const isAppItem = (name: string, cat?: string | null): boolean => {
      const lower = name.toLowerCase();
      const catLower = (cat || "").toLowerCase();
      return (
        lower.includes("личный кабинет") ||
        lower.includes("приложение") ||
        lower.includes("умный дом") ||
        lower.includes("логин") ||
        lower.includes("пароль") ||
        lower.includes("доступ в лк") ||
        lower.includes("подключение к приложению") ||
        catLower.includes("app")
      );
    };

    // Вспомогательная функция: проверка ключей (исключаем выключатели, переключатели)
    const isKeyItem = (name: string, cat?: string | null): boolean => {
      const lower = name.toLowerCase();
      const catLower = (cat || "").toLowerCase();
      return (
        catLower === "key" ||
        (/(?:^|\s)ключ/i.test(lower) &&
          !lower.includes("выключатель") &&
          !lower.includes("переключатель") &&
          !lower.includes("подключ"))
      );
    };

    // Вспомогательная функция: проверка услуг монтажа, замены, установки и работ
    const isServiceItem = (name: string, cat?: string | null): boolean => {
      const lower = name.toLowerCase();
      const catLower = (cat || "").toLowerCase();
      if (catLower === "service") return true;
      return (
        lower.includes("замен") ||
        lower.includes("монтаж") ||
        lower.includes("установк") ||
        lower.includes("демонтаж") ||
        lower.includes("подключ") ||
        lower.includes("настройк") ||
        lower.includes("ремонт") ||
        lower.includes("выбирайте если") ||
        lower.includes("оплачиваете только")
      );
    };

    // Вспомогательная функция: проверка переговорных трубок и ТКП (квартирное оборудование)
    const isHandsetItem = (name: string, cat?: string | null): boolean => {
      // Личный кабинет, ключи и УСЛУГИ ни при каких условиях не могут быть трубкой!
      if (isAppItem(name, cat) || isKeyItem(name, cat) || isServiceItem(name, cat)) return false;

      const lower = name.toLowerCase();
      const catLower = (cat || "").toLowerCase();

      // Явные ключевые слова для трубок / ТКП / мониторов
      const isExplicitHandset =
        lower.includes("ткп") ||
        lower.includes("трубк") ||
        lower.includes("аудиотрубк") ||
        lower.includes("видеомонитор") ||
        lower.includes("монитор") ||
        lower.includes("укп") ||
        lower.includes("vizit") ||
        lower.includes("визит") ||
        lower.includes("цифрал") ||
        lower.includes("cyfral") ||
        lower.includes("метаком") ||
        lower.includes("metakom") ||
        lower.includes("voice") ||
        lower.includes("факториал");

      if (isExplicitHandset) return true;

      // Если в категории указано equipment, но это не общеподъездная панель, замок или кнопка
      if (catLower === "equipment") {
        const isCommonHardware =
          lower.includes("панель") ||
          lower.includes("бвд") ||
          lower.includes("бп") ||
          lower.includes("коммутатор") ||
          lower.includes("доводчик") ||
          lower.includes("замок") ||
          lower.includes("кнопк");
        return !isCommonHardware;
      }

      return false;
    };

    // 1. Сначала извлекаем из связанных позиций request_items
    if (order.items && order.items.length > 0) {
      order.items.forEach(item => {
        const name = (item.product?.name || "Товар").trim();
        const cat = item.product?.category || "";
        const lower = name.toLowerCase();

        // 1.1 Личный кабинет / мобильное приложение (строгий приоритет)
        if (isAppItem(name, cat)) {
          hasApp = true;
          return;
        }

        // 1.2 Ключи домофона
        if (isKeyItem(name, cat)) {
          const cleanK = cleanKeyName(name);
          keysList.push(item.quantity > 1 ? `${cleanK}: ${item.quantity} шт.` : `${cleanK} (1 шт.)`);
          keysCount += item.quantity;
          keyItems.push({ name: cleanK, quantity: item.quantity });
          return;
        }

        // 1.3 Услуги монтажа / подключения / замены
        if (isServiceItem(name, cat)) {
          servicesList.push(item.quantity > 1 ? `${name} (${item.quantity} шт.)` : name);
          servicesCount += item.quantity;
          serviceItems.push({ name, quantity: item.quantity });
          return;
        }

        // 1.4 Переговорная трубка / ТКП (физическое устройство)
        if (isHandsetItem(name, cat)) {
          const cleanH = cleanHandsetName(name);
          handsetsList.push(item.quantity > 1 ? `${cleanH} (${item.quantity} шт.)` : `${cleanH} (1 шт.)`);
          handsetsCount += item.quantity;
          handsetItems.push({ name: cleanH, quantity: item.quantity });
          return;
        }

        // Прочие позиции
        servicesList.push(`${name} (${item.quantity} шт.)`);
        servicesCount += item.quantity;
      });
    }

    // 2. Если в items не найдено позиций (старый формат), аккуратно парсим текст order.message
    // ВАЖНО: Если у заказа уже есть структурированные items, текст message для номенклатуры НЕ парсим!
    const hasStructuredItems = Boolean(order.items && order.items.length > 0);

    if (!hasStructuredItems && order.message) {
      const lines = order.message.split("\n");
      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line || line.includes("🛍️") || line.includes("Итоговая сумма") || line.toLowerCase().startsWith("заказ")) {
          continue;
        }
        const lowerLine = line.toLowerCase();

        // 2.0 КАТЕГОРИЧЕСКИЙ ФИЛЬТР: Комментарии клиента, примечания и переписка НИ ПРИ КАКИХ УСЛОВИЯХ не являются оборудованием!
        const isCommentOrNote =
          lowerLine.includes("комментар") ||
          lowerLine.includes("примечан") ||
          lowerLine.includes("пожелан") ||
          lowerLine.includes("клиент:") ||
          lowerLine.includes("клиент написал") ||
          lowerLine.includes("здравствуй") ||
          lowerLine.includes("хотим") ||
          lowerLine.includes("просьб") ||
          lowerLine.includes("сообщен") ||
          line.includes("💬") ||
          line.includes("❓") ||
          line.includes("ℹ️") ||
          line.includes("📝");

        if (isCommentOrNote) {
          continue; // Пропускаем строки комментариев клиента!
        }

        // 2.1 Проверка Личного кабинета / приложения
        if (isAppItem(lowerLine)) {
          hasApp = true;
          continue; // Ни в коем случае не обрабатывать как оборудование!
        }

        // 2.2 Ключи
        if (isKeyItem(lowerLine)) {
          if (keysList.length === 0) {
            const clean = line.replace(/^[—\-*•\s]*(?:Ключи|Ключ)[^:]*:\s*/i, "").trim();
            const qtyMatch = clean.match(/\((\d+)\s*шт/i) || clean.match(/:\s*(\d+)\s*шт/i);
            const qty = qtyMatch ? parseInt(qtyMatch[1], 10) : 1;
            const rawKName = clean.replace(/\s*\([^)]*\).*/, "").replace(/:\s*\d+\s*шт.*/, "").trim();
            const cleanK = cleanKeyName(rawKName);
            if (cleanK) {
              keysList.push(qty > 1 ? `${cleanK}: ${qty} шт.` : `${cleanK} (1 шт.)`);
              keysCount += qty;
              keyItems.push({ name: cleanK, quantity: qty });
            }
          }
          continue;
        }

        // 2.3 Услуги монтажа / замены
        if (isServiceItem(lowerLine)) {
          if (servicesList.length === 0) {
            const clean = line.replace(/^[—\-*•\s]*(?:Услуга|Услуги|Работа)[^:]*:\s*/i, "").trim();
            const qtyMatch = clean.match(/\((\d+)\s*шт/i);
            const qty = qtyMatch ? parseInt(qtyMatch[1], 10) : 1;
            const name = clean.replace(/\s*\([^)]*\).*/, "").trim();
            if (name) {
              servicesList.push(qty > 1 ? `${name} (${qty} шт.)` : name);
              servicesCount += qty;
              serviceItems.push({ name, quantity: qty });
            }
          }
          continue;
        }

        // 2.4 Переговорные трубки / ТКП (только если не приложение, не ключ, не услуга и не длинный связный текст)
        if (handsetsList.length === 0 && isHandsetItem(lowerLine)) {
          // Защита от связных предложений и переписки: название оборудования не может быть длинным связным предложением
          const isSentence = line.split(/\s+/).length > 7;
          if (isSentence) {
            continue;
          }

          const clean = line.replace(/^[—\-*•\s]*(?:Оборудование|Трубка|ТКП|Модель|Устройство)[^:]*:\s*/i, "").trim();
          const qtyMatch = clean.match(/\((\d+)\s*шт/i);
          const qty = qtyMatch ? parseInt(qtyMatch[1], 10) : 1;
          const rawHName = clean.replace(/\s*\([^)]*\).*/, "").trim();
          const cleanH = cleanHandsetName(rawHName);
          if (cleanH && !isAppItem(cleanH)) {
            handsetsList.push(qty > 1 ? `${cleanH} (${qty} шт.)` : `${cleanH} (1 шт.)`);
            handsetsCount += qty;
            handsetItems.push({ name: cleanH, quantity: qty });
          }
          continue;
        }
      }
    }

    // Определение графы «Монтаж / Замена»:
    // ПРАВИЛО: Графа относится ИСКЛЮЧИТЕЛЬНО к трубкам в квартирах!
    // 1. Если трубка НЕ заказана (handsetsCount === 0) -> СТРОГО «—» (для ключей, ЛК и взносов никаких монтажей/замен нет)
    // 2. Если трубка заказана (handsetsCount > 0):
    //    - Если оплачена услуга монтажа/прокладки -> пишем «Монтаж»
    //    - Иначе (только замена трубки или покупка без кабеля) -> пишем «Замена»
    let serviceDisplay = "—";
    if (handsetsCount > 0) {
      const hasInstallation = servicesList.some(s => {
        const lower = s.toLowerCase();
        return (
          lower.includes("монтаж ткп") ||
          lower.includes("монтаж трубки") ||
          lower.includes("установка ткп") ||
          lower.includes("установка трубки") ||
          lower.includes("прокладка") ||
          (lower.includes("монтаж") && !lower.includes("замен")) ||
          (lower.includes("установк") && !lower.includes("замен"))
        );
      });

      if (hasInstallation) {
        serviceDisplay = "Монтаж";
      } else {
        serviceDisplay = "Замена";
      }
    } else {
      // Трубка не заказана -> строго прочерк «—»
      serviceDisplay = "—";
    }

    return {
      handset: handsetsList.length > 0 ? handsetsList.join(", ") : "—",
      handsetsCount,
      handsetItems,
      keys: keysList.length > 0 ? keysList.join(", ") : "—",
      keysCount,
      keyItems,
      hasApp,
      services: serviceDisplay,
      servicesCount: serviceDisplay !== "—" ? 1 : 0,
      serviceItems,
      rawServices: servicesList.join(", "),
    };
  };

  // Высокоскоростной хеш-индекс квартир O(1): группирует адреса по номеру квартиры
  // Сокращает объем перебора с 50 000 записей до 1-2 кандидатов, исключая подвисание интерфейса
  const accountsByAptIndex = useMemo(() => {
    const map = new Map<string, { addressLower: string; entrance: string }[]>();
    if (!allAccounts || allAccounts.length === 0) return map;

    allAccounts.forEach(a => {
      const aptClean = (a.apartment || "").trim().replace(/\D/g, "");
      if (!aptClean || !a.address) return;
      const matchEnt = a.address.match(/(?:п\.|п|подъезд)\s*(\d+)/i);
      if (!matchEnt) return;

      const list = map.get(aptClean) || [];
      list.push({ addressLower: a.address.toLowerCase(), entrance: matchEnt[1] });
      map.set(aptClean, list);
    });
    return map;
  }, [allAccounts]);

  // Привязываем позиции к заказам и парсим адресные поля при отсутствии
  const enrichedOrders = useMemo(() => {
    if (!rawOrders) return [];
    const itemsByReq = new Map<string, RequestItem[]>();
    requestItems?.forEach(item => {
      if (!itemsByReq.has(item.request_id)) {
        itemsByReq.set(item.request_id, []);
      }
      itemsByReq.get(item.request_id)!.push(item);
    });

    return rawOrders.map(order => {
      const items = itemsByReq.get(order.id) || [];
      
      // Если поля адреса не заполнены в явном виде, извлекаем их из строки address
      let s = order.street;
      let h = order.house;
      let e = order.entrance;
      let apt = order.apartment;

      if (!s || !h || !apt) {
        const addr = order.address || "";
        const streetMatch = addr.match(/(?:ул\.|улица)\s*([^,]+)/i) || addr.match(/,\s*([^,]+?)\s*\(ул\)/i);
        // Улучшенный парсер номера дома: захватывает номер дома целиком с корпусом ("3, корп. 1", "3 к2") до подъезда или квартиры
        const houseMatch = addr.match(/(?:д\.|дом)\s*([0-9a-zа-я\s\/\.,\-_]+?)(?=,?\s*(?:п\.|подъезд|кв\.|квартира|$))/i);
        const entranceMatch = addr.match(/(?:п\.|подъезд)\s*([^,]+)/i);
        const aptMatch = addr.match(/(?:кв\.|квартира)\s*([^,]+)/i);

        if (!s && streetMatch) s = streetMatch[1].trim();
        if (!h && houseMatch) h = houseMatch[1].trim();
        if (!e && entranceMatch) e = entranceMatch[1].trim();
        if (!apt && aptMatch) apt = aptMatch[1].trim();
      }

      // Канонизация номера дома по справочнику entrances (например, "3, корп. 1" -> "3к1")
      if (s && h && addressData?.canonicalHouseMap) {
        const normKey = `${normalizeStreet(s)}___${normalizeHouse(h)}`;
        const canonicalH = addressData.canonicalHouseMap.get(normKey);
        if (canonicalH) {
          h = canonicalH;
        }
      }

      // Высокоскоростное автоопределение подъезда через сгруппированный хеш-индекс (O(1) вместо 50,000 итераций)
      if (!e && apt && accountsByAptIndex.size > 0) {
        const cleanApt = apt.replace(/\D/g, "");
        const candidates = accountsByAptIndex.get(cleanApt);
        if (candidates && candidates.length > 0) {
          const matched = candidates.find(cand => {
            if (s) {
              const cleanStreet = s.replace(/[()\/.,]/g, " ").toLowerCase();
              const streetWords = cleanStreet.split(/\s+/).filter(w => w.length > 2 && !["ул", "улица", "пос", "пер", "проезд"].includes(w));
              const matchesStreet = streetWords.some(w => cand.addressLower.includes(w));
              if (!matchesStreet) return false;
            }
            if (h && !cand.addressLower.includes(h.toLowerCase())) {
              return false;
            }
            return true;
          });
          if (matched) {
            e = matched.entrance;
          }
        }
      }

      return {
        ...order,
        street: s,
        house: h,
        entrance: e,
        apartment: apt,
        items,
      };
    });
  }, [rawOrders, requestItems, accountsByAptIndex, addressData]);

  // 4. Фильтрация заказов по выбранному дому, подъезду, статусу оплаты и мгновенному онлайн-поиску
  const filteredOrders = useMemo(() => {
    if (!enrichedOrders) return [];

    const q = searchQuery.toLowerCase().trim();

    return enrichedOrders.filter(order => {
      // 1. Фильтр: только заказы оборудования или заказы с позициями/оплатой
      const isEquipment = order.order_type === "equipment_order" || (order.items && order.items.length > 0) || Number(order.payment_amount) > 0;
      if (!isEquipment) return false;

      // 2. Требование: только оплаченные заказы (для монтажников)
      if (onlyPaid && order.payment_status !== "paid") {
        return false;
      }

      // 3. Совпадение улицы и дома (если они заданы в фильтре и не равны "all")
      if (selectedStreet && selectedStreet !== "all" && order.street && !order.street.toLowerCase().includes(selectedStreet.toLowerCase())) {
        return false;
      }
      if (selectedHouse && selectedHouse !== "all" && order.house && order.house.toLowerCase() !== selectedHouse.toLowerCase()) {
        return false;
      }

      // 4. Совпадение подъезда
      if (selectedEntrance && selectedEntrance !== "all" && order.entrance && order.entrance !== selectedEntrance) {
        return false;
      }

      // 5. Мгновенный онлайн-поиск при вводе по любым введенным реквизитам
      if (q) {
        const aptMatch = order.apartment && order.apartment.toLowerCase().includes(q);
        const nameMatch = order.name && order.name.toLowerCase().includes(q);
        const phoneMatch = order.phone && order.phone.toLowerCase().includes(q);
        const streetMatch = order.street && order.street.toLowerCase().includes(q);
        const houseMatch = order.house && order.house.toLowerCase().includes(q);
        const addressMatch = order.address && order.address.toLowerCase().includes(q);
        const descMatch = order.description && order.description.toLowerCase().includes(q);
        const msgMatch = order.message && order.message.toLowerCase().includes(q);
        const itemsMatch = order.items?.some(it => it.product?.name?.toLowerCase().includes(q));

        if (!aptMatch && !nameMatch && !phoneMatch && !streetMatch && !houseMatch && !addressMatch && !descMatch && !msgMatch && !itemsMatch) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => {
      // Первичная сортировка по адресу дома, подъезду и номеру квартиры
      const streetComp = (a.street || "").localeCompare(b.street || "", "ru");
      if (streetComp !== 0) return streetComp;

      const houseComp = (a.house || "").localeCompare(b.house || "", "ru", { numeric: true });
      if (houseComp !== 0) return houseComp;

      const entA = parseInt(a.entrance || "0") || 0;
      const entB = parseInt(b.entrance || "0") || 0;
      if (entA !== entB) return entA - entB;

      const aptA = parseInt(a.apartment || "0") || 0;
      const aptB = parseInt(b.apartment || "0") || 0;
      return aptA - aptB;
    });
  }, [enrichedOrders, selectedStreet, selectedHouse, selectedEntrance, onlyPaid, searchQuery]);

  // Структуры для иерархической группировки по домам и подъездам
  interface EntranceGroup {
    entrance: string;
    serviceType: string;
    orders: EquipmentOrder[];
    stats: {
      apartmentsCount: number;
      totalKeys: number;
      totalHandsets: number;
      totalServices: number;
      totalApps: number;
      totalRevenue: number;
      handsetsByType: Record<string, number>;
      keysByType: Record<string, number>;
    };
  }

  interface HouseGroup {
    houseKey: string;
    street: string;
    house: string;
    fullAddress: string;
    serviceType: string;
    entrances: EntranceGroup[];
    stats: {
      apartmentsCount: number;
      totalKeys: number;
      totalHandsets: number;
      totalServices: number;
      totalApps: number;
      totalRevenue: number;
      handsetsByType: Record<string, number>;
      keysByType: Record<string, number>;
    };
  }

  // Определение типа обслуживания для дома (с нормализованным поиском по реестру entrances)
  const getHouseServiceType = (street: string, house: string): string => {
    const directKey = `${street.trim().toLowerCase()}___${house.trim().toLowerCase()}`;
    const normKey = `${normalizeStreet(street)}___${normalizeHouse(house)}`;
    
    // Ищем точный набор типов подъездов дома
    const typesSet = addressData?.houseServiceTypeMap?.get(directKey) || addressData?.normHouseServiceTypeMap?.get(normKey);
    if (!typesSet || typesSet.size === 0) return "maintenance";
    const types = Array.from(typesSet);
    if (types.every(t => t === "installation")) return "installation";
    if (types.every(t => t === "rent")) return "rent";
    if (types.every(t => t === "maintenance")) return "maintenance";
    if (types.includes("installation")) return "mixed_installation";
    return "mixed";
  };

  // Определение типа обслуживания для подъезда (с нормализованным поиском по реестру entrances)
  const getEntranceServiceType = (street: string, house: string, entrance: string): string => {
    const directKey = `${street.trim().toLowerCase()}___${house.trim().toLowerCase()}___${entrance.trim()}`;
    const normKey = `${normalizeStreet(street)}___${normalizeHouse(house)}___${entrance.trim()}`;
    return addressData?.entranceServiceTypeMap?.get(directKey) || addressData?.normEntranceServiceTypeMap?.get(normKey) || "maintenance";
  };

  // Визуальный бейдж статуса дома / подъезда
  const renderServiceTypeBadge = (serviceType: string, isSmall: boolean = false) => {
    switch (serviceType) {
      case "installation":
        return (
          <Badge className={cn("bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30", isSmall ? "text-[10px] px-1.5 py-0" : "text-xs font-bold")}>
            🟡 На монтаже (льготный)
          </Badge>
        );
      case "rent":
        return (
          <Badge className={cn("bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30", isSmall ? "text-[10px] px-1.5 py-0" : "text-xs font-bold")}>
            🔵 Аренда
          </Badge>
        );
      case "mixed_installation":
        return (
          <Badge className={cn("bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30", isSmall ? "text-[10px] px-1.5 py-0" : "text-xs font-bold")}>
            🟡 Частично монтаж
          </Badge>
        );
      case "maintenance":
      default:
        return (
          <Badge className={cn("bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30", isSmall ? "text-[10px] px-1.5 py-0" : "text-xs font-bold")}>
            🟢 На ТО
          </Badge>
        );
    }
  };

  // 5. Группировка всех отфильтрованных заказов по домам и подъездам
  const groupedHouses = useMemo((): HouseGroup[] => {
    if (!filteredOrders || filteredOrders.length === 0) return [];

    const houseMap = new Map<string, {
      street: string;
      house: string;
      fullAddress: string;
      ordersByEntrance: Map<string, EquipmentOrder[]>;
    }>();

    filteredOrders.forEach((order) => {
      const street = (order.street || "Адрес не указан").trim();
      const house = (order.house || "").trim();
      const entrance = (order.entrance || "").trim() || "Без подъезда";
      const houseKey = `${street}___${house}`;

      if (!houseMap.has(houseKey)) {
        let fullAddress = street;
        if (house) fullAddress += `, д. ${house}`;
        houseMap.set(houseKey, {
          street,
          house,
          fullAddress,
          ordersByEntrance: new Map(),
        });
      }

      const houseEntry = houseMap.get(houseKey)!;
      if (!houseEntry.ordersByEntrance.has(entrance)) {
        houseEntry.ordersByEntrance.set(entrance, []);
      }
      houseEntry.ordersByEntrance.get(entrance)!.push(order);
    });

    const result: HouseGroup[] = [];

    houseMap.forEach((val, houseKey) => {
      const entranceGroups: EntranceGroup[] = [];
      let houseKeys = 0;
      let houseHandsets = 0;
      let houseServices = 0;
      let houseApps = 0;
      let houseRevenue = 0;
      const houseHandsetsByType: Record<string, number> = {};
      const houseKeysByType: Record<string, number> = {};

      // Сортировка подъездов: 1, 2, 3... затем "Без подъезда"
      const sortedEntKeys = Array.from(val.ordersByEntrance.keys()).sort((a, b) => {
        const numA = parseInt(a, 10);
        const numB = parseInt(b, 10);
        if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
        if (!isNaN(numA)) return -1;
        if (!isNaN(numB)) return 1;
        return a.localeCompare(b, "ru");
      });

      sortedEntKeys.forEach((entKey) => {
        const entOrders = val.ordersByEntrance.get(entKey) || [];
        entOrders.sort((a, b) => (parseInt(a.apartment || "0") || 0) - (parseInt(b.apartment || "0") || 0));

        let entKeysCount = 0;
        let entHandsetsCount = 0;
        let entServicesCount = 0;
        let entAppsCount = 0;
        let entRevenueCount = 0;
        const entHandsetsByType: Record<string, number> = {};
        const entKeysByType: Record<string, number> = {};

        entOrders.forEach((ord) => {
          entRevenueCount += Number(ord.payment_amount || 0);
          const isCredPurchased = Boolean(
            purchasedAppsMap.get(`${(ord.street || "").toLowerCase()}___${(ord.house || "").toLowerCase()}___${(ord.apartment || "").trim().toLowerCase()}`) ||
            purchasedAppsMap.get((ord.apartment || "").trim())
          );
          const parsed = parseOrderDetails(ord, isCredPurchased);
          entKeysCount += parsed.keysCount;
          entHandsetsCount += parsed.handsetsCount;
          entServicesCount += parsed.servicesCount;
          if (parsed.hasApp) entAppsCount += 1;

          // Детализация по типам/моделям трубок и ключей
          parsed.handsetItems.forEach((hi) => {
            entHandsetsByType[hi.name] = (entHandsetsByType[hi.name] || 0) + hi.quantity;
            houseHandsetsByType[hi.name] = (houseHandsetsByType[hi.name] || 0) + hi.quantity;
          });
          parsed.keyItems.forEach((ki) => {
            entKeysByType[ki.name] = (entKeysByType[ki.name] || 0) + ki.quantity;
            houseKeysByType[ki.name] = (houseKeysByType[ki.name] || 0) + ki.quantity;
          });
        });

        houseKeys += entKeysCount;
        houseHandsets += entHandsetsCount;
        houseServices += entServicesCount;
        houseApps += entAppsCount;
        houseRevenue += entRevenueCount;

        entranceGroups.push({
          entrance: entKey,
          serviceType: getEntranceServiceType(val.street, val.house, entKey),
          orders: entOrders,
          stats: {
            apartmentsCount: entOrders.length,
            totalKeys: entKeysCount,
            totalHandsets: entHandsetsCount,
            totalServices: entServicesCount,
            totalApps: entAppsCount,
            totalRevenue: entRevenueCount,
            handsetsByType: entHandsetsByType,
            keysByType: entKeysByType,
          },
        });
      });

      result.push({
        houseKey,
        street: val.street,
        house: val.house,
        fullAddress: val.fullAddress,
        serviceType: getHouseServiceType(val.street, val.house),
        entrances: entranceGroups,
        stats: {
          apartmentsCount: Array.from(val.ordersByEntrance.values()).reduce((sum, list) => sum + list.length, 0),
          totalKeys: houseKeys,
          totalHandsets: houseHandsets,
          totalServices: houseServices,
          totalApps: houseApps,
          totalRevenue: houseRevenue,
          handsetsByType: houseHandsetsByType,
          keysByType: houseKeysByType,
        },
      });
    });

    return result.sort((a, b) => a.fullAddress.localeCompare(b.fullAddress, "ru", { numeric: true }));
  }, [filteredOrders, purchasedAppsMap, addressData]);

  // 6. Фильтрация сгруппированных домов по выбранному статусу объекта (На монтаже, На ТО, Аренда)
  const displayedHouses = useMemo(() => {
    if (selectedServiceType === "all") return groupedHouses;
    return groupedHouses.filter(hg => {
      if (selectedServiceType === "installation") {
        return hg.serviceType === "installation" || hg.serviceType === "mixed_installation";
      }
      return hg.serviceType === selectedServiceType;
    });
  }, [groupedHouses, selectedServiceType]);

  // 7. Общая сводная статистика по отображаемым домам (включая модели оборудования)
  const stats = useMemo(() => {
    let apartmentsCount = 0;
    let totalKeys = 0;
    let totalHandsets = 0;
    let totalServices = 0;
    let totalApps = 0;
    let totalRevenue = 0;
    const handsetsByType: Record<string, number> = {};
    const keysByType: Record<string, number> = {};

    displayedHouses.forEach((hg) => {
      apartmentsCount += hg.stats.apartmentsCount;
      totalKeys += hg.stats.totalKeys;
      totalHandsets += hg.stats.totalHandsets;
      totalServices += hg.stats.totalServices;
      totalApps += hg.stats.totalApps;
      totalRevenue += hg.stats.totalRevenue;

      Object.entries(hg.stats.handsetsByType).forEach(([name, count]) => {
        handsetsByType[name] = (handsetsByType[name] || 0) + count;
      });
      Object.entries(hg.stats.keysByType).forEach(([name, count]) => {
        keysByType[name] = (keysByType[name] || 0) + count;
      });
    });

    return {
      apartmentsCount,
      totalKeys,
      totalHandsets,
      totalServices,
      totalApps,
      totalRevenue,
      handsetsByType,
      keysByType,
    };
  }, [displayedHouses]);

  // 7.1 Активный дом для вкладочной навигации (Дома -> Подъезды -> Квартиры)
  const activeHouse = useMemo(() => {
    if (displayedHouses.length === 0) return null;
    if (selectedHouseKey) {
      const found = displayedHouses.find(h => h.houseKey === selectedHouseKey);
      if (found) return found;
    }
    return displayedHouses[0];
  }, [displayedHouses, selectedHouseKey]);

  // Автоматическая синхронизация выбранного дома при смене фильтров
  React.useEffect(() => {
    if (displayedHouses.length > 0) {
      const exists = displayedHouses.some(h => h.houseKey === selectedHouseKey);
      if (!exists) {
        setSelectedHouseKey(displayedHouses[0].houseKey);
        setActiveEntranceTab("all");
      }
    } else {
      setSelectedHouseKey(null);
      setActiveEntranceTab("all");
    }
  }, [displayedHouses, selectedHouseKey]);

  // 7. Мутация смены статуса выполнения наряда
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, newStatus }: { id: string; newStatus: string }) => {
      console.log(`[Лист монтажника] Обновление статуса заказа ${id} -> ${newStatus}`);
      const { error } = await supabase
        .from("requests")
        .update({
          status: newStatus,
          completed_at: newStatus === "completed" ? new Date().toISOString() : null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["equipment-orders-all"] });
      queryClient.invalidateQueries({ queryKey: ["requests"] });
      toast({
        title: "Статус наряда обновлен",
        description: "Изменения успешно сохранены в системе FSM.",
      });
    },
    onError: (err: any) => {
      toast({
        title: "Ошибка обновления",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  // 8. Экспорт листа монтажника в Excel (.xlsx) с делением по вкладкам подъездов
  const handleExportExcel = (targetHouse?: HouseGroup) => {
    const housesToExport = targetHouse ? [targetHouse] : groupedHouses;

    console.log(`[Лист монтажника] Экспорт в Excel... Домов: ${housesToExport.length}`);
    if (housesToExport.length === 0 || filteredOrders.length === 0) {
      toast({
        title: "Нет данных для выгрузки",
        description: "Отсутствуют заказы, соответствующие заданным критериям.",
        variant: "destructive",
      });
      return;
    }

    try {
      const wb = XLSX.utils.book_new();
      const isSingleHouse = housesToExport.length === 1;

      housesToExport.forEach((hGroup) => {
        hGroup.entrances.forEach((entGroup) => {
          const entOrders = entGroup.orders;
          if (entOrders.length === 0) return;

          const entranceLabel = entGroup.entrance === "Без подъезда" ? "Подъезд не указан" : `Подъезд №${entGroup.entrance}`;
          const titleHeader = "МОНТАЖНЫЙ ЛИСТ / АКТ ВЫДАЧИ ОБОРУДОВАНИЯ";
          const addressHeader = `Адрес: г. Краснодар, ${hGroup.fullAddress} (${entranceLabel})`;
          const dateHeader = `Дата формирования ведомости: ${format(new Date(), "dd.MM.yyyy HH:mm", { locale: ru })}`;

          // Шапка листа ведомости
          const sheetData: any[][] = [
            ["ООО «ДОМОФОНДАР» — УМНЫЙ ДОМОФОН И СЕРВИС"],
            [titleHeader],
            [addressHeader],
            [dateHeader],
            [], // Пустая строка-разделитель
            // Простые и понятные столбцы без сумм и оплат жильцов
            [
              "№ п/п",
              "Квартира",
              "ФИО Абонента",
              "Контактный телефон",
              "Монтаж / Замена", // Поставлено сразу после телефона, перед трубкой
              "Трубка",
              "Ключи (шт.)",
              "Личный кабинет",
              "Подпись собственника",
            ],
          ];

          let subKeys = 0;
          let subHandsets = 0;
          let subServices = 0;
          let subApp = 0;
          let subRevenue = 0;

          // Наполнение строками по квартирам
          entOrders.forEach((order, index) => {
            const isCredPurchased = Boolean(
              purchasedAppsMap.get(`${(order.street || "").toLowerCase()}___${(order.house || "").toLowerCase()}___${(order.apartment || "").trim().toLowerCase()}`) ||
              purchasedAppsMap.get((order.apartment || "").trim())
            );
            const parsed = parseOrderDetails(order, isCredPurchased);

            subKeys += parsed.keysCount;
            subHandsets += parsed.handsetsCount;
            subServices += parsed.servicesCount;
            if (parsed.hasApp) subApp += 1;
            subRevenue += Number(order.payment_amount || 0);

            // Ключи: прописываем просто количество штук (без названия "Ключ UID электронный:")
            const keysDisplay = parsed.keysCount > 0 ? `${parsed.keysCount} шт.` : "—";

            sheetData.push([
              index + 1,
              order.apartment ? `кв. ${order.apartment}` : "—",
              order.name || "Абонент",
              order.phone || "—",
              parsed.services !== "—" ? parsed.services : "—", // Монтаж / Замена
              parsed.handset !== "—" ? parsed.handset : "—",   // Трубка
              keysDisplay,
              parsed.hasApp ? "✓ Подключен" : "—",
              "", // Пустая широкая ячейка для личной подписи собственника
            ]);
          });

          // Итоговая строка подъезда
          sheetData.push([]);
          sheetData.push([
            `ИТОГО ПО ${entranceLabel.toUpperCase()}:`,
            `Квартир: ${entOrders.length}`,
            "",
            "",
            `Трубок: ${subHandsets} шт.`,
            `Ключей: ${subKeys} шт.`,
            `ЛК: ${subApp} шт.`,
            "",
            "",
          ]);

          // Блок со списком оборудования и точным количеством штук к выдаче
          sheetData.push([]);
          sheetData.push(["СПИСОК ОБОРУДОВАНИЯ И МАТЕРИАЛОВ К ВЫДАЧЕ НА ПОДЪЕЗД:"]);
          sheetData.push(["№", "Наименование оборудования / материала", "Количество"]);

          let itemIndex = 1;

          // 1. Конкретные модели трубок и мониторов
          if (Object.keys(entGroup.stats.handsetsByType).length > 0) {
            Object.entries(entGroup.stats.handsetsByType).forEach(([model, count]) => {
              sheetData.push([itemIndex++, model, `${count} шт.`]);
            });
          } else {
            sheetData.push([itemIndex++, "Трубки переговорные (не требуются)", "0 шт."]);
          }

          // 2. Ключи домофона
          if (subKeys > 0) {
            sheetData.push([itemIndex++, "Ключи домофона (электронные)", `${subKeys} шт.`]);
          }

          // 3. Личный кабинет (приложение)
          if (subApp > 0) {
            sheetData.push([itemIndex++, "Доступ к Личному кабинету умного дома", `${subApp} шт.`]);
          }

          // Подписи ответственных лиц
          sheetData.push([]);
          sheetData.push(["Ответственный мастер / монтажник: ___________________________ / ___________________________ /"]);
          sheetData.push(["Дата проведения монтажных работ: «____» ____________________ 202___ г."]);

          const ws = XLSX.utils.aoa_to_sheet(sheetData);

          // Ширина колонок для печати листа А4 (увеличены для гарантированной читаемости)
          ws["!cols"] = [
            { wch: 6 },  // № п/п
            { wch: 12 }, // Квартира
            { wch: 28 }, // ФИО Абонента
            { wch: 20 }, // Контактный телефон
            { wch: 18 }, // Монтаж / Замена (между телефоном и трубкой)
            { wch: 32 }, // Трубка
            { wch: 14 }, // Ключи (шт.)
            { wch: 18 }, // Личный кабинет
            { wch: 34 }, // Подпись собственника
          ];

          // Формируем имя листа Excel (макс 31 символ)
          let sheetTitle = "";
          if (isSingleHouse) {
            sheetTitle = entGroup.entrance === "Без подъезда" ? "Без подъезда" : `Подъезд ${entGroup.entrance}`;
          } else {
            const shortStreet = hGroup.street.replace(/(?:ул\.|улица|\(ул\))/gi, "").trim();
            const rawTitle = `${shortStreet} ${hGroup.house} п.${entGroup.entrance}`;
            sheetTitle = rawTitle.slice(0, 31).replace(/[/\\?%*:|"<>]/g, "_");
          }

          // Устраняем возможные дубликаты имен листов
          let finalTitle = sheetTitle;
          let counter = 1;
          while (wb.SheetNames.includes(finalTitle)) {
            finalTitle = `${sheetTitle.slice(0, 27)}_${counter}`;
            counter++;
          }

          XLSX.utils.book_append_sheet(wb, ws, finalTitle);
        });
      });

      // Формируем имя файла
      let fileName = "";
      if (isSingleHouse) {
        const safeStreet = (housesToExport[0].street || "дом").replace(/[/\\?%*:|"<>]/g, "_");
        const safeHouse = (housesToExport[0].house || "").replace(/[/\\?%*:|"<>]/g, "_");
        fileName = `Лист_монтажника_${safeStreet}_д${safeHouse}_${format(new Date(), "yyyy-MM-dd")}.xlsx`;
      } else {
        fileName = `Лист_монтажника_все_дома_${format(new Date(), "yyyy-MM-dd")}.xlsx`;
      }

      XLSX.writeFile(wb, fileName);

      toast({
        title: "Ведомость сформирована!",
        description: `Файл «${fileName}» успешно выгружен с разбивкой по вкладкам.`,
      });
    } catch (err: any) {
      console.error("[Лист монтажника] Ошибка генерации Excel:", err);
      toast({
        title: "Ошибка экспорта",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-300">
      {/* 1. Верхний блок заголовка и быстрых действий */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/60 dark:bg-slate-900/60 p-5 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm backdrop-blur-md">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <ClipboardCheck className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-foreground tracking-tight font-display">
                Лист монтажника
              </h1>
              <p className="text-xs text-muted-foreground">
                Поквартирная ведомость оборудования по домам и подъездам с онлайн-поиском и экспортом в Excel
              </p>
            </div>
          </div>
        </div>

        {/* Кнопка общего экспорта в Excel */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            onClick={() => handleExportExcel()}
            className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2 shadow-md shadow-emerald-600/20 rounded-xl"
            disabled={filteredOrders.length === 0}
          >
            <FileSpreadsheet className="h-4 w-4" />
            <span>Выгрузить в Excel (.xlsx)</span>
          </Button>
        </div>
      </div>

      {/* 2. Карточка фильтрации: Улица, Дом, Подъезд, Онлайн-поиск */}
      <Card className="border-slate-200/60 dark:border-slate-800/60 shadow-sm">
        <CardContent className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Выбор улицы */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-primary" />
                <span>Улица</span>
              </Label>
              <Select value={selectedStreet || "all"} onValueChange={handleStreetChange}>
                <SelectTrigger className="rounded-xl h-10 font-medium">
                  <SelectValue placeholder="Все улицы" />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  <SelectItem value="all" className="font-semibold text-primary">
                    Все улицы
                  </SelectItem>
                  {addressData?.streets.map(street => (
                    <SelectItem key={street} value={street} className="font-medium">
                      {street}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Выбор дома */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-primary" />
                <span>Дом</span>
              </Label>
              <Select
                value={selectedHouse || "all"}
                onValueChange={(val) => {
                  const newVal = val === "all" ? "" : val;
                  console.log(`[Лист монтажника] Выбран дом: ${newVal || "Все дома"}`);
                  setSelectedHouse(newVal);
                  setSelectedEntrance("all");
                }}
              >
                <SelectTrigger className="rounded-xl h-10 font-medium">
                  <SelectValue placeholder="Все дома" />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  <SelectItem value="all" className="font-semibold text-primary">
                    Все дома
                  </SelectItem>
                  {availableHouses.map(house => (
                    <SelectItem key={house} value={house} className="font-medium">
                      д. {house}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Выбор подъезда */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <DoorClosed className="h-3.5 w-3.5 text-primary" />
                <span>Подъезд</span>
              </Label>
              <Select
                value={selectedEntrance}
                onValueChange={(val) => {
                  console.log(`[Лист монтажника] Выбран подъезд: ${val}`);
                  setSelectedEntrance(val);
                }}
                disabled={availableEntrances.length === 0}
              >
                <SelectTrigger className="rounded-xl h-10 font-medium">
                  <SelectValue placeholder="Все подъезды" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="font-medium">Все подъезды</SelectItem>
                  {availableEntrances.map(ent => (
                    <SelectItem key={ent} value={ent} className="font-medium">
                      Подъезд №{ent}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Мгновенный онлайн-поиск */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <Search className="h-3.5 w-3.5 text-primary" />
                <span>Онлайн-поиск</span>
              </Label>
              <div className="relative">
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="№ кв., телефон, ФИО, улица, дом..."
                  className="rounded-xl h-10 pr-8 text-sm"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-2.5 text-xs text-muted-foreground hover:text-foreground"
                    title="Очистить поиск"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Дополнительный фильтр по оплате и статусу объекта */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800 text-xs gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-muted-foreground font-semibold">Оплата:</span>
              <button
                onClick={() => setOnlyPaid(true)}
                className={cn(
                  "px-2.5 py-1 rounded-lg font-semibold transition-all",
                  onlyPaid 
                    ? "bg-green-600 text-white shadow-sm" 
                    : "bg-slate-100 dark:bg-slate-800 text-muted-foreground hover:text-foreground"
                )}
              >
                ✓ Оплаченные
              </button>
              {isManager && (
                <button
                  onClick={() => setOnlyPaid(false)}
                  className={cn(
                    "px-2.5 py-1 rounded-lg font-semibold transition-all",
                    !onlyPaid 
                      ? "bg-amber-600 text-white shadow-sm" 
                      : "bg-slate-100 dark:bg-slate-800 text-muted-foreground hover:text-foreground"
                  )}
                >
                  Все наряды
                </button>
              )}
            </div>

            {/* Фильтр по статусу объекта (На монтаже, На ТО, Аренда) */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-muted-foreground font-semibold">Объект:</span>
              <button
                onClick={() => setSelectedServiceType("all")}
                className={cn(
                  "px-2.5 py-1 rounded-lg font-semibold transition-all",
                  selectedServiceType === "all"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-slate-100 dark:bg-slate-800 text-muted-foreground hover:text-foreground"
                )}
              >
                Все
              </button>
              <button
                onClick={() => setSelectedServiceType("installation")}
                className={cn(
                  "px-2.5 py-1 rounded-lg font-semibold transition-all",
                  selectedServiceType === "installation"
                    ? "bg-amber-500 text-white shadow-sm font-bold"
                    : "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40 hover:bg-amber-100 dark:hover:bg-amber-900/50"
                )}
              >
                🟡 На монтаже
              </button>
              <button
                onClick={() => setSelectedServiceType("maintenance")}
                className={cn(
                  "px-2.5 py-1 rounded-lg font-semibold transition-all",
                  selectedServiceType === "maintenance"
                    ? "bg-emerald-600 text-white shadow-sm font-bold"
                    : "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/50"
                )}
              >
                🟢 На ТО
              </button>
              <button
                onClick={() => setSelectedServiceType("rent")}
                className={cn(
                  "px-2.5 py-1 rounded-lg font-semibold transition-all",
                  selectedServiceType === "rent"
                    ? "bg-blue-600 text-white shadow-sm font-bold"
                    : "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/40 hover:bg-blue-100 dark:hover:bg-blue-900/50"
                )}
              >
                🔵 Аренда
              </button>
            </div>

            <span className="font-semibold text-foreground shrink-0">
              {selectedStreet ? `${selectedStreet}, д. ${selectedHouse || "все дома"}` : "Все адреса"}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* 3. Сводные метрики по отобранным заказам */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="p-4 rounded-2xl bg-white/70 dark:bg-slate-900/70 border border-slate-200/60 dark:border-slate-800/60 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <DoorClosed className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">Квартир</span>
            <span className="text-lg font-extrabold text-foreground">{stats.apartmentsCount}</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white/70 dark:bg-slate-900/70 border border-slate-200/60 dark:border-slate-800/60 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
            <Radio className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">Трубок</span>
            <span className="text-lg font-extrabold text-purple-600 dark:text-purple-400">{stats.totalHandsets} шт.</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white/70 dark:bg-slate-900/70 border border-slate-200/60 dark:border-slate-800/60 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <KeyRound className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">Ключей</span>
            <span className="text-lg font-extrabold text-amber-600 dark:text-amber-400">{stats.totalKeys} шт.</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white/70 dark:bg-slate-900/70 border border-slate-200/60 dark:border-slate-800/60 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">ЛК (+)</span>
            <span className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400">{stats.totalApps} шт.</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white/70 dark:bg-slate-900/70 border border-slate-200/60 dark:border-slate-800/60 shadow-sm flex items-center gap-3 col-span-2 sm:col-span-1">
          <div className="w-10 h-10 rounded-xl bg-green-500/10 text-green-600 dark:text-green-400 flex items-center justify-center shrink-0">
            <Package className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">Сумма</span>
            <span className="text-lg font-extrabold text-green-600 dark:text-green-400">{stats.totalRevenue.toFixed(0)} ₽</span>
          </div>
        </div>
      </div>

      {/* 3.1 Складские карточки по конкретным моделям оборудования */}
      {(Object.keys(stats.handsetsByType).length > 0 || Object.keys(stats.keysByType).length > 0) && (
        <Card className="border-slate-200/80 dark:border-slate-800/80 shadow-sm bg-gradient-to-r from-purple-500/5 via-slate-50/50 to-amber-500/5 dark:from-purple-950/20 dark:via-slate-900/40 dark:to-amber-950/20">
          <CardHeader className="p-3.5 pb-2 border-b border-slate-200/50 dark:border-slate-800/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1.5">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-foreground">
                Потребность в оборудовании для монтажа (Склад для выезда)
              </CardTitle>
            </div>
            <span className="text-[11px] text-muted-foreground font-medium">
              Всего позиций к выдаче: <strong className="text-foreground">{stats.totalHandsets + stats.totalKeys + stats.totalApps} шт.</strong>
            </span>
          </CardHeader>
          <CardContent className="p-3.5 pt-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
              {/* Карточки моделей трубок */}
              {Object.entries(stats.handsetsByType).map(([modelName, count]) => (
                <div
                  key={`handset-${modelName}`}
                  className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-purple-200/70 dark:border-purple-800/50 shadow-xs flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                      <Radio className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs font-bold text-foreground block truncate" title={modelName}>
                        {modelName}
                      </span>
                      <span className="text-[10px] text-purple-600 dark:text-purple-400 font-semibold uppercase">
                        Трубка / ТКП
                      </span>
                    </div>
                  </div>
                  <Badge className="bg-purple-600 hover:bg-purple-600 text-white font-black text-xs px-2 py-0.5 shrink-0">
                    {count} шт.
                  </Badge>
                </div>
              ))}

              {/* Карточки ключей */}
              {Object.entries(stats.keysByType).map(([keyName, count]) => (
                <div
                  key={`key-${keyName}`}
                  className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-amber-200/70 dark:border-amber-800/50 shadow-xs flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                      <KeyRound className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs font-bold text-foreground block truncate" title={keyName}>
                        {keyName}
                      </span>
                      <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold uppercase">
                        Ключи
                      </span>
                    </div>
                  </div>
                  <Badge className="bg-amber-600 hover:bg-amber-600 text-white font-black text-xs px-2 py-0.5 shrink-0">
                    {count} шт.
                  </Badge>
                </div>
              ))}

              {/* Карточка доступа в Личный кабинет */}
              {stats.totalApps > 0 && (
                <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-emerald-200/70 dark:border-emerald-800/50 shadow-xs flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs font-bold text-foreground block truncate" title="Личный кабинет умного домофона">
                        Личный кабинет умного дома
                      </span>
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold uppercase">
                        Доступ к приложению
                      </span>
                    </div>
                  </div>
                  <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white font-black text-xs px-2 py-0.5 shrink-0">
                    {stats.totalApps} шт.
                  </Badge>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 4. Отображение актов/нарядов с разбивкой по домам и подъездам */}
      {isOrdersLoading || isAddressesLoading ? (
        <div className="flex items-center justify-center h-48 bg-white/60 dark:bg-slate-900/60 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : displayedHouses.length === 0 ? (
        <Card className="border-slate-200/60 dark:border-slate-800/60 shadow-sm">
          <CardContent className="py-12 text-center space-y-2">
            <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto" />
            <p className="font-bold text-foreground text-sm">Заказов не найдено</p>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              По заданным критериям фильтрации {searchQuery ? `и поисковому запросу «${searchQuery}»` : ""} наряды отсутствуют.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-5">
          {/* УРОВЕНЬ 1: Вкладки домов со сводной информацией */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" />
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Дома в работе ({displayedHouses.length})
                </span>
              </div>
              <span className="text-[11px] text-muted-foreground hidden sm:inline">
                Выберите дом для просмотра подъездов и квартир
              </span>
            </div>

            {/* Горизонтальная лента вкладок домов */}
            <div className="flex gap-2.5 overflow-x-auto pb-2 pt-0.5 scrollbar-thin">
              {displayedHouses.map((hg) => {
                const isSelected = activeHouse?.houseKey === hg.houseKey;
                return (
                  <button
                    key={hg.houseKey}
                    onClick={() => {
                      setSelectedHouseKey(hg.houseKey);
                      setActiveEntranceTab("all");
                    }}
                    className={cn(
                      "text-left p-3 rounded-xl border transition-all shrink-0 flex flex-col justify-between gap-2 min-w-[220px] sm:min-w-[260px]",
                      isSelected
                        ? "bg-primary/10 border-primary text-foreground shadow-md ring-2 ring-primary/40 dark:bg-primary/20"
                        : "bg-white/80 dark:bg-slate-900/80 border-slate-200/80 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700 text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <div className="flex items-start justify-between gap-1.5 w-full">
                      <span className="font-bold text-sm text-foreground line-clamp-1">
                        {hg.fullAddress}
                      </span>
                      {renderServiceTypeBadge(hg.serviceType, true)}
                    </div>

                    <div className="flex items-center justify-between gap-2 text-xs w-full pt-1 border-t border-slate-100 dark:border-slate-800/60">
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-semibold">
                        {hg.stats.apartmentsCount} кв. ({hg.entrances.length} п.)
                      </Badge>

                      <div className="flex items-center gap-2 text-[11px]">
                        {hg.stats.totalHandsets > 0 && (
                          <span className="text-purple-600 dark:text-purple-400 font-semibold" title={
                            Object.entries(hg.stats.handsetsByType).map(([m, c]) => `${m}: ${c} шт.`).join(", ")
                          }>
                            📞 {hg.stats.totalHandsets}
                          </span>
                        )}
                        {hg.stats.totalKeys > 0 && (
                          <span className="text-amber-600 dark:text-amber-400 font-semibold" title={
                            Object.entries(hg.stats.keysByType).map(([k, c]) => `${k}: ${c} шт.`).join(", ")
                          }>
                            🔑 {hg.stats.totalKeys}
                          </span>
                        )}
                        <span className="font-extrabold text-foreground ml-1">
                          {hg.stats.totalRevenue.toFixed(0)} ₽
                        </span>
                      </div>
                    </div>

                    {/* Детализация моделей трубок для дома во вкладке */}
                    {Object.keys(hg.stats.handsetsByType).length > 0 && (
                      <div className="text-[10px] text-purple-700 dark:text-purple-300 font-medium truncate w-full pt-1 border-t border-slate-100/70 dark:border-slate-800/60" title={Object.entries(hg.stats.handsetsByType).map(([m, c]) => `${m}: ${c} шт.`).join(", ")}>
                        {Object.entries(hg.stats.handsetsByType).map(([m, c]) => `${m}: ${c} шт.`).join(", ")}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* УРОВЕНЬ 2: Выбранный дом и его подъезды */}
          {activeHouse && (
            <Card className="border-slate-200/80 dark:border-slate-800/80 shadow-md overflow-hidden bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm">
              {/* Шапка активного дома */}
              <CardHeader className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-800/70 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Building2 className="h-5 w-5 text-primary shrink-0" />
                    <CardTitle className="text-base sm:text-lg font-black text-foreground">
                      {activeHouse.fullAddress}
                    </CardTitle>
                    {renderServiceTypeBadge(activeHouse.serviceType)}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <Badge variant="secondary" className="font-bold">
                      {activeHouse.stats.apartmentsCount} {activeHouse.stats.apartmentsCount === 1 ? "квартира" : "квартир"}
                    </Badge>
                    <Badge variant="outline" className="font-semibold">
                      {activeHouse.entrances.length} {activeHouse.entrances.length === 1 ? "подъезд" : "подъездов"}
                    </Badge>
                    {activeHouse.stats.totalHandsets > 0 && (
                      <div className="flex flex-wrap items-center gap-1">
                        <Badge variant="outline" className="font-bold text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/40">
                          <Radio className="h-3 w-3 mr-1 inline" />
                          Трубок: {activeHouse.stats.totalHandsets} шт.
                        </Badge>
                        {Object.entries(activeHouse.stats.handsetsByType).map(([m, c]) => (
                          <Badge
                            key={m}
                            variant="secondary"
                            className="text-[11px] font-semibold bg-purple-100/90 dark:bg-purple-900/50 text-purple-800 dark:text-purple-200 border border-purple-200 dark:border-purple-700"
                          >
                            {m}: <strong>{c} шт.</strong>
                          </Badge>
                        ))}
                      </div>
                    )}
                    {activeHouse.stats.totalKeys > 0 && (
                      <div className="flex flex-wrap items-center gap-1">
                        <Badge variant="outline" className="font-bold text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40">
                          <KeyRound className="h-3 w-3 mr-1 inline" />
                          Ключей: {activeHouse.stats.totalKeys} шт.
                        </Badge>
                        {Object.entries(activeHouse.stats.keysByType).map(([k, c]) => (
                          <Badge
                            key={k}
                            variant="secondary"
                            className="text-[11px] font-semibold bg-amber-100/90 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-700"
                          >
                            {k}: <strong>{c} шт.</strong>
                          </Badge>
                        ))}
                      </div>
                    )}
                    {activeHouse.stats.totalApps > 0 && (
                      <Badge variant="outline" className="text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60 bg-emerald-50 dark:bg-emerald-950/40">
                        <CheckCircle2 className="h-3 w-3 mr-1 inline" />
                        ЛК (+): {activeHouse.stats.totalApps}
                      </Badge>
                    )}
                    <span className="font-extrabold text-foreground ml-1">
                      {activeHouse.stats.totalRevenue.toFixed(0)} ₽
                    </span>
                  </div>
                </div>

                {/* Кнопка выгрузки Excel именно по этому дому */}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleExportExcel(activeHouse)}
                  className="gap-1.5 text-xs font-bold border-emerald-600/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 shrink-0"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Скачать Excel дома</span>
                </Button>
              </CardHeader>

              {/* Вкладки подъездов выбранного дома */}
              <div className="p-3 sm:p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/50">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-muted-foreground mr-1 flex items-center gap-1">
                    <DoorClosed className="h-3.5 w-3.5 text-primary" />
                    Подъезды:
                  </span>
                  {/* Кнопка "Все подъезды" */}
                  <button
                    onClick={() => setActiveEntranceTab("all")}
                    className={cn(
                      "px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border",
                      activeEntranceTab === "all"
                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                        : "bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <span>Все подъезды</span>
                    <Badge
                      variant="secondary"
                      className={cn(
                        "text-[10px] px-1.5 py-0",
                        activeEntranceTab === "all" ? "bg-primary-foreground/20 text-white" : ""
                      )}
                    >
                      {activeHouse.stats.apartmentsCount}
                    </Badge>
                  </button>

                  {/* Кнопки отдельных подъездов */}
                  {activeHouse.entrances.map((entGroup) => {
                    const isTabActive = activeEntranceTab === entGroup.entrance;
                    return (
                      <button
                        key={entGroup.entrance}
                        onClick={() => setActiveEntranceTab(entGroup.entrance)}
                        className={cn(
                          "px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border",
                          isTabActive
                            ? "bg-primary text-primary-foreground border-primary shadow-sm"
                            : "bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <DoorClosed className="h-3.5 w-3.5" />
                        <span>
                          {entGroup.entrance === "Без подъезда" ? "Без подъезда" : `Подъезд №${entGroup.entrance}`}
                        </span>
                        <Badge
                          variant="secondary"
                          className={cn(
                            "text-[10px] px-1.5 py-0",
                            isTabActive ? "bg-primary-foreground/20 text-white" : ""
                          )}
                        >
                          {entGroup.orders.length}
                        </Badge>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* УРОВЕНЬ 3: Компактная таблица нарядов квартир */}
              <CardContent className="p-0">
                {activeHouse.entrances
                  .filter((entGroup) => activeEntranceTab === "all" || activeEntranceTab === entGroup.entrance)
                  .map((entGroup) => (
                    <div key={entGroup.entrance} className="border-b last:border-b-0 border-slate-100 dark:border-slate-800">
                      {/* Шапка секции подъезда */}
                      <div className="px-4 py-2.5 bg-slate-100/60 dark:bg-slate-800/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-200/50 dark:border-slate-800/50">
                        <div className="flex flex-wrap items-center gap-2">
                          <DoorClosed className="h-4 w-4 text-primary shrink-0" />
                          <h3 className="font-extrabold text-sm text-foreground">
                            {entGroup.entrance === "Без подъезда" ? "Подъезд не указан" : `Подъезд №${entGroup.entrance}`}
                          </h3>
                          {renderServiceTypeBadge(entGroup.serviceType, true)}
                          <Badge variant="secondary" className="text-[11px] font-semibold">
                            {entGroup.orders.length} {entGroup.orders.length === 1 ? "квартира" : "квартир"}
                          </Badge>
                        </div>

                        {/* Сводка по подъезду с подробными моделями */}
                        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          {entGroup.stats.totalHandsets > 0 && (
                            <span className="flex items-center gap-1 text-purple-700 dark:text-purple-300 font-medium">
                              <span>Трубок: <strong>{entGroup.stats.totalHandsets} шт.</strong></span>
                              <span className="text-[11px] text-muted-foreground">
                                ({Object.entries(entGroup.stats.handsetsByType).map(([m, c]) => `${m}: ${c} шт.`).join(", ")})
                              </span>
                            </span>
                          )}
                          {entGroup.stats.totalKeys > 0 && (
                            <span className="flex items-center gap-1 text-amber-700 dark:text-amber-300 font-medium">
                              <span>Ключей: <strong>{entGroup.stats.totalKeys} шт.</strong></span>
                              {Object.keys(entGroup.stats.keysByType).length > 1 && (
                                <span className="text-[11px] text-muted-foreground">
                                  ({Object.entries(entGroup.stats.keysByType).map(([k, c]) => `${k}: ${c} шт.`).join(", ")})
                                </span>
                              )}
                            </span>
                          )}
                          {entGroup.stats.totalApps > 0 && (
                            <span>ЛК: <strong className="text-foreground">{entGroup.stats.totalApps}</strong></span>
                          )}
                          <span>Сумма: <strong className="text-foreground">{entGroup.stats.totalRevenue.toFixed(0)} ₽</strong></span>
                        </div>
                      </div>

                      {/* Компактная таблица нарядов в стиле раздела заявок */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left border-collapse">
                          <thead className="text-[11px] font-bold uppercase bg-slate-50 dark:bg-slate-850 text-muted-foreground border-b border-slate-200/60 dark:border-slate-800/60">
                            <tr>
                              <th className="px-3 py-2.5 text-center w-12 font-extrabold">Кв.</th>
                              {activeEntranceTab === "all" && (
                                <th className="px-2 py-2.5 text-center w-16 font-semibold">Подъезд</th>
                              )}
                              <th className="px-3 py-2.5 font-semibold min-w-[170px]">Абонент / Телефон</th>
                              <th className="px-2.5 py-2.5 text-center font-semibold w-28">Монтаж / Замена</th>
                              <th className="px-3 py-2.5 font-semibold min-w-[190px]">Трубка (ТКП)</th>
                              <th className="px-3 py-2.5 font-semibold min-w-[130px]">Ключи</th>
                              <th className="px-2 py-2.5 text-center font-semibold w-16">ЛК</th>
                              <th className="px-3 py-2.5 text-right font-semibold w-24">Сумма</th>
                              <th className="px-3 py-2.5 text-center font-semibold w-28">Статус</th>
                              <th className="px-3 py-2.5 text-center w-20 font-semibold">Наряд</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 bg-white dark:bg-slate-900/60">
                            {entGroup.orders.map((order) => {
                              const isCompleted = order.status === "completed";
                              const isPaid = order.payment_status === "paid";
                              const isCredPurchased = Boolean(
                                purchasedAppsMap.get(`${(order.street || "").toLowerCase()}___${(order.house || "").toLowerCase()}___${(order.apartment || "").trim().toLowerCase()}`) ||
                                purchasedAppsMap.get((order.apartment || "").trim())
                              );
                              const parsed = parseOrderDetails(order, isCredPurchased);

                              return (
                                <tr
                                  key={order.id}
                                  onClick={() => setSelectedOrderForModal(order)}
                                  className={cn(
                                    "cursor-pointer hover:bg-primary/[0.06] transition-colors group",
                                    isCompleted && "bg-green-500/[0.03] dark:bg-green-500/[0.02]"
                                  )}
                                  title="Нажмите, чтобы открыть подробный наряд"
                                >
                                  {/* Номер квартиры */}
                                  <td className="px-3 py-2.5 text-center font-black text-sm text-foreground font-mono bg-slate-50/40 dark:bg-slate-800/30 align-middle">
                                    {order.apartment || "—"}
                                  </td>

                                  {/* Подъезд (если смотрим все подъезды) */}
                                  {activeEntranceTab === "all" && (
                                    <td className="px-2 py-2.5 text-center font-semibold text-muted-foreground text-xs align-middle">
                                      {order.entrance ? `п. ${order.entrance}` : "—"}
                                    </td>
                                  )}

                                  {/* Абонент и телефон (без обрезания ФИО) */}
                                  <td className="px-3 py-2.5 min-w-[170px] align-middle">
                                    <div className="font-bold text-foreground text-xs flex items-center gap-1.5 break-words">
                                      <User className="h-3.5 w-3.5 text-primary shrink-0" />
                                      <span className="break-words leading-tight">{order.name || "Абонент"}</span>
                                    </div>
                                    {order.phone && (
                                      <a
                                        href={`tel:${order.phone}`}
                                        onClick={(e) => e.stopPropagation()}
                                        className="text-[11px] text-primary hover:underline font-semibold flex items-center gap-1 mt-1 inline-flex"
                                      >
                                        <Phone className="h-2.5 w-2.5 shrink-0" />
                                        <span>{order.phone}</span>
                                      </a>
                                    )}
                                  </td>

                                  {/* Монтаж / Замена (перенесено перед трубками) */}
                                  <td className="px-2.5 py-2.5 text-center w-28 align-middle">
                                    {parsed.services === "Монтаж" ? (
                                      <Badge className="bg-blue-600 hover:bg-blue-600 text-white font-extrabold text-[11px] py-0.5 px-2.5 shadow-sm">
                                        Монтаж
                                      </Badge>
                                    ) : parsed.services === "Замена" ? (
                                      <Badge className="bg-amber-600 hover:bg-amber-600 text-white font-extrabold text-[11px] py-0.5 px-2.5 shadow-sm">
                                        Замена
                                      </Badge>
                                    ) : parsed.services !== "—" ? (
                                      <Badge variant="secondary" className="text-[11px] py-0.5 px-2 font-medium">
                                        {parsed.services}
                                      </Badge>
                                    ) : (
                                      <span className="text-muted-foreground text-xs font-medium">—</span>
                                    )}
                                  </td>

                                  {/* Трубка (ТКП) — строго без личного кабинета, с полным переносом без обрезаний */}
                                  <td className="px-3 py-2.5 min-w-[190px] align-middle">
                                    {parsed.handset !== "—" ? (
                                      <Badge
                                        variant="outline"
                                        className="text-[11px] py-1 px-2.5 font-semibold text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/40 whitespace-normal text-left inline-flex items-start gap-1.5 leading-snug break-words max-w-full"
                                      >
                                        <Radio className="h-3 w-3 mt-0.5 text-purple-600 dark:text-purple-400 shrink-0" />
                                        <span className="break-words">{parsed.handset}</span>
                                      </Badge>
                                    ) : (
                                      <span className="text-muted-foreground text-xs font-medium">—</span>
                                    )}
                                  </td>

                                  {/* Ключи — с полным отображением названий */}
                                  <td className="px-3 py-2.5 min-w-[130px] align-middle">
                                    {parsed.keys !== "—" ? (
                                      <Badge
                                        variant="outline"
                                        className="text-[11px] py-1 px-2.5 font-semibold text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 whitespace-normal text-left inline-flex items-start gap-1.5 leading-snug break-words max-w-full"
                                      >
                                        <KeyRound className="h-3 w-3 mt-0.5 text-amber-600 dark:text-amber-400 shrink-0" />
                                        <span className="break-words">{parsed.keys}</span>
                                      </Badge>
                                    ) : (
                                      <span className="text-muted-foreground text-xs font-medium">—</span>
                                    )}
                                  </td>

                                  {/* Личный кабинет */}
                                  <td className="px-2 py-2.5 text-center w-16 align-middle">
                                    {parsed.hasApp ? (
                                      <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white font-extrabold text-[10px] py-0.5 px-2">
                                        ✓ ЛК
                                      </Badge>
                                    ) : (
                                      <span className="text-muted-foreground text-xs font-medium">—</span>
                                    )}
                                  </td>

                                  {/* Сумма и статус оплаты */}
                                  <td className="px-3 py-2.5 text-right w-24 align-middle">
                                    <div className="font-extrabold text-foreground text-xs whitespace-nowrap">
                                      {Number(order.payment_amount || 0).toFixed(0)} ₽
                                    </div>
                                    <div className="mt-0.5">
                                      {isPaid ? (
                                        <span className="text-[10px] font-semibold text-green-600 dark:text-green-400 whitespace-nowrap">
                                          ✓ Оплачено
                                        </span>
                                      ) : (
                                        <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 whitespace-nowrap">
                                          ⏳ Ожидает
                                        </span>
                                      )}
                                    </div>
                                  </td>

                                  {/* Статус монтажа и быстрая отметка */}
                                  <td className="px-3 py-2 text-center">
                                    <div className="flex items-center justify-center gap-1.5">
                                      {isCompleted ? (
                                        <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-300/40 font-bold text-[11px] py-0 px-1.5">
                                          ✓ Выдано
                                        </Badge>
                                      ) : (
                                        <Badge variant="outline" className="text-amber-700 dark:text-amber-400 border-amber-300 font-semibold text-[11px] py-0 px-1.5">
                                          В очереди
                                        </Badge>
                                      )}

                                      {/* Быстрая кнопка смены статуса (без открытия модалки) */}
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground shrink-0"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          updateStatusMutation.mutate({
                                            id: order.id,
                                            newStatus: isCompleted ? "in_progress" : "completed",
                                          });
                                        }}
                                        disabled={updateStatusMutation.isPending}
                                        title={isCompleted ? "Вернуть в очередь" : "Отметить как выдано"}
                                      >
                                        <Check className={cn("h-3 w-3", isCompleted ? "text-emerald-600" : "text-muted-foreground")} />
                                      </Button>
                                    </div>
                                  </td>

                                  {/* Кнопка открытия наряда */}
                                  <td className="px-3 py-2 text-center">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-6 px-2 text-[11px] font-semibold gap-1 text-primary hover:text-primary hover:bg-primary/10 border-primary/30"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedOrderForModal(order);
                                      }}
                                    >
                                      <FileText className="h-3 w-3" />
                                      <span>Наряд</span>
                                    </Button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* МОДАЛЬНОЕ ОКНО: Подробный наряд из заявок */}
      <Dialog
        open={!!selectedOrderForModal}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedOrderForModal(null);
            // Инвалидируем запросы для обновления статусов
            queryClient.invalidateQueries({ queryKey: ["equipment-orders-all"] });
            queryClient.invalidateQueries({ queryKey: ["requests"] });
          }
        }}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <ClipboardCheck className="h-5 w-5 text-primary" />
              <span>
                Наряд монтажника — Заявка #{selectedOrderForModal?.id.slice(0, 8)}
                {selectedOrderForModal?.apartment ? ` (кв. ${selectedOrderForModal.apartment})` : ""}
              </span>
            </DialogTitle>
          </DialogHeader>
          {selectedOrderForModal && (
            <RequestDetails
              request={selectedOrderForModal as any}
              onBack={() => {
                setSelectedOrderForModal(null);
                queryClient.invalidateQueries({ queryKey: ["equipment-orders-all"] });
                queryClient.invalidateQueries({ queryKey: ["requests"] });
              }}
              isManager={isManager}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default InstallerSheetManager;
