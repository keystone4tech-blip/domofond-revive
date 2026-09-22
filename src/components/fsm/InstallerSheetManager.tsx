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
  items?: RequestItem[];
}

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

      const addAddress = (street?: string | null, house?: string | null, entrance?: string | null, serviceType?: string | null) => {
        if (!street || !house) return;
        const s = street.trim();
        const h = house.trim();
        const e = entrance ? entrance.trim() : "";
        const st = serviceType || "maintenance";

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
        if (e) {
          entranceServiceTypeMap.set(`${lowerS}___${lowerH}___${e}`, st);
        }
        if (!houseServiceTypeMap.has(`${lowerS}___${lowerH}`)) {
          houseServiceTypeMap.set(`${lowerS}___${lowerH}`, new Set());
        }
        houseServiceTypeMap.get(`${lowerS}___${lowerH}`)!.add(st);
      };

      entrances?.forEach(item => addAddress(item.street, item.house, item.entrance, item.service_type));
      reqAddresses?.forEach(item => addAddress(item.street, item.house, item.entrance));

      const streets = Array.from(streetMap.keys()).sort((a, b) => a.localeCompare(b, "ru"));

      return {
        streets,
        streetMap,
        houseEntranceMap,
        entranceServiceTypeMap,
        houseServiceTypeMap,
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

  // 2. Загрузка всех заказов оборудования
  const { data: rawOrders, isLoading: isOrdersLoading } = useQuery({
    queryKey: ["equipment-orders-all"],
    queryFn: async () => {
      console.log("[Лист монтажника] Загрузка заказов оборудования...");
      const { data, error } = await supabase
        .from("requests")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as EquipmentOrder[];
    },
  });

  // 3. Загрузка позиций заказов
  const { data: requestItems } = useQuery({
    queryKey: ["equipment-request-items"],
    queryFn: async () => {
      console.log("[Лист монтажника] Загрузка позиций товаров и услуг...");
      const { data, error } = await supabase
        .from("request_items")
        .select(`
          id, request_id, product_id, quantity, price,
          product:products (id, name, unit, category)
        `);
      if (error) throw error;
      return (data || []) as RequestItem[];
    },
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
    staleTime: 5 * 60 * 1000,
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
  const parseOrderDetails = (order: EquipmentOrder, isCredPurchased: boolean) => {
    const keysList: string[] = [];
    let keysCount = 0;

    const handsetsList: string[] = [];
    let handsetsCount = 0;

    const servicesList: string[] = [];
    let servicesCount = 0;

    let hasApp = isCredPurchased;

    // 1. Сначала извлекаем из связанных позиций request_items
    if (order.items && order.items.length > 0) {
      order.items.forEach(item => {
        const name = (item.product?.name || "Товар").trim();
        const cat = (item.product?.category || "").toLowerCase();
        const lower = name.toLowerCase();

        if (cat === "key" || lower.includes("ключ")) {
          keysList.push(`${name}: ${item.quantity} шт.`);
          keysCount += item.quantity;
        } else if (cat === "equipment" || lower.includes("ткп") || lower.includes("трубк") || lower.includes("домофон") || lower.includes("панель")) {
          handsetsList.push(`${name} (${item.quantity} шт.)`);
          handsetsCount += item.quantity;
        } else if (cat === "service" || lower.includes("установк") || lower.includes("монтаж") || lower.includes("замен") || lower.includes("подключ")) {
          servicesList.push(item.quantity > 1 ? `${name} (${item.quantity} шт.)` : name);
          servicesCount += item.quantity;
        } else if (lower.includes("личный кабинет") || lower.includes("приложение") || lower.includes("логин") || lower.includes("умный дом")) {
          hasApp = true;
        } else {
          servicesList.push(`${name} (${item.quantity} шт.)`);
          servicesCount += item.quantity;
        }
      });
    }

    // 2. Если в items не найдено позиций, аккуратно парсим текст order.message
    if (order.message) {
      const lines = order.message.split("\n");
      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line || line.includes("🛍️") || line.includes("Итоговая сумма") || line.toLowerCase().startsWith("заказ")) {
          continue;
        }
        const lowerLine = line.toLowerCase();

        // Проверка Личного кабинета / приложения
        if (lowerLine.includes("личный кабинет") || lowerLine.includes("приложение") || lowerLine.includes("умный дом") || lowerLine.includes("логин")) {
          hasApp = true;
        }

        // Оборудование / трубки
        if (handsetsList.length === 0 && (lowerLine.includes("оборудование") || lowerLine.includes("трубк") || lowerLine.includes("ткп"))) {
          const clean = line.replace(/^[—\-*•\s]*(?:Оборудование|Трубка)[^:]*:\s*/i, "").trim();
          const qtyMatch = clean.match(/\((\d+)\s*шт/i);
          const qty = qtyMatch ? parseInt(qtyMatch[1], 10) : 1;
          const name = clean.replace(/\s*\([^)]*\).*/, "").trim();
          if (name) {
            handsetsList.push(`${name} (${qty} шт.)`);
            handsetsCount += qty;
          }
          continue;
        }

        // Ключи
        if (keysList.length === 0 && lowerLine.includes("ключ")) {
          const clean = line.replace(/^[—\-*•\s]*(?:Ключи|Ключ)[^:]*:\s*/i, "").trim();
          const qtyMatch = clean.match(/\((\d+)\s*шт/i);
          const qty = qtyMatch ? parseInt(qtyMatch[1], 10) : 1;
          const name = clean.replace(/\s*\([^)]*\).*/, "").trim();
          if (name) {
            keysList.push(`${name}: ${qty} шт.`);
            keysCount += qty;
          }
          continue;
        }

        // Услуги монтажа
        if (servicesList.length === 0 && (lowerLine.includes("услуг") || lowerLine.includes("установк") || lowerLine.includes("монтаж") || lowerLine.includes("замен"))) {
          const clean = line.replace(/^[—\-*•\s]*(?:Услуга|Услуги)[^:]*:\s*/i, "").trim();
          const qtyMatch = clean.match(/\((\d+)\s*шт/i);
          const qty = qtyMatch ? parseInt(qtyMatch[1], 10) : 1;
          const name = clean.replace(/\s*\([^)]*\).*/, "").trim();
          if (name) {
            servicesList.push(qty > 1 ? `${name} (${qty} шт.)` : name);
            servicesCount += qty;
          }
          continue;
        }
      }
    }

    // Определение графы «Монтаж / Услуги»:
    // 1. Если оплачен монтаж/установка -> пишем «Монтаж»
    // 2. Если просто трубка (без оплаченной услуги монтажа) -> пишем «Замена»
    // 3. Иначе -> «—»
    let serviceDisplay = "—";
    const hasInstallation = servicesList.some(s => {
      const lower = s.toLowerCase();
      return lower.includes("установк") || lower.includes("монтаж") || lower.includes("подключ");
    });

    if (hasInstallation) {
      serviceDisplay = "Монтаж";
    } else if (handsetsCount > 0) {
      serviceDisplay = "Замена";
    } else if (servicesList.length > 0) {
      const sLower = servicesList.join(" ").toLowerCase();
      if (sLower.includes("замен")) {
        serviceDisplay = "Замена";
      } else {
        serviceDisplay = servicesList.join(", ");
      }
    }

    return {
      handset: handsetsList.length > 0 ? handsetsList.join(", ") : "—",
      handsetsCount,
      keys: keysList.length > 0 ? keysList.join(", ") : "—",
      keysCount,
      hasApp,
      services: serviceDisplay,
      servicesCount: serviceDisplay !== "—" ? 1 : 0,
      rawServices: servicesList.join(", "),
    };
  };

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
        const houseMatch = addr.match(/(?:д\.|дом)\s*([^,]+)/i);
        const entranceMatch = addr.match(/(?:п\.|подъезд)\s*([^,]+)/i);
        const aptMatch = addr.match(/(?:кв\.|квартира)\s*([^,]+)/i);

        if (!s && streetMatch) s = streetMatch[1].trim();
        if (!h && houseMatch) h = houseMatch[1].trim();
        if (!e && entranceMatch) e = entranceMatch[1].trim();
        if (!apt && aptMatch) apt = aptMatch[1].trim();
      }

      // Если подъезд не указан в заказе, автоопределяем его из базы лицевых счетов
      if (!e && apt && allAccounts && allAccounts.length > 0) {
        const cleanApt = apt.replace(/\D/g, "");
        const foundAcc = allAccounts.find(a => {
          const aClean = (a.apartment || "").trim().replace(/\D/g, "");
          if (aClean !== cleanApt) return false;
          const addrLower = (a.address || "").toLowerCase();
          if (s) {
            const cleanStreet = s.replace(/[()\/.,]/g, " ").toLowerCase();
            const streetWords = cleanStreet.split(/\s+/).filter(w => w.length > 2 && !["ул", "улица", "пос", "пер", "проезд"].includes(w));
            const matchesStreet = streetWords.some(w => addrLower.includes(w));
            if (!matchesStreet) return false;
          }
          if (h && !addrLower.includes(h.toLowerCase())) {
            return false;
          }
          return true;
        });
        if (foundAcc) {
          const matchEnt = foundAcc.address.match(/(?:п\.|п|подъезд)\s*(\d+)/i);
          if (matchEnt) e = matchEnt[1];
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
  }, [rawOrders, requestItems, allAccounts]);

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
    };
  }

  // Определение типа обслуживания для дома
  const getHouseServiceType = (street: string, house: string): string => {
    const key = `${street.trim().toLowerCase()}___${house.trim().toLowerCase()}`;
    const typesSet = addressData?.houseServiceTypeMap?.get(key);
    if (!typesSet || typesSet.size === 0) return "maintenance";
    const types = Array.from(typesSet);
    if (types.every(t => t === "installation")) return "installation";
    if (types.every(t => t === "rent")) return "rent";
    if (types.every(t => t === "maintenance")) return "maintenance";
    if (types.includes("installation")) return "mixed_installation";
    return "mixed";
  };

  // Определение типа обслуживания для подъезда
  const getEntranceServiceType = (street: string, house: string, entrance: string): string => {
    const key = `${street.trim().toLowerCase()}___${house.trim().toLowerCase()}___${entrance.trim()}`;
    return addressData?.entranceServiceTypeMap?.get(key) || "maintenance";
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

  // 7. Общая сводная статистика по отображаемым домам
  const stats = useMemo(() => {
    let apartmentsCount = 0;
    let totalKeys = 0;
    let totalHandsets = 0;
    let totalServices = 0;
    let totalApps = 0;
    let totalRevenue = 0;

    displayedHouses.forEach((hg) => {
      apartmentsCount += hg.stats.apartmentsCount;
      totalKeys += hg.stats.totalKeys;
      totalHandsets += hg.stats.totalHandsets;
      totalServices += hg.stats.totalServices;
      totalApps += hg.stats.totalApps;
      totalRevenue += hg.stats.totalRevenue;
    });

    return {
      apartmentsCount,
      totalKeys,
      totalHandsets,
      totalServices,
      totalApps,
      totalRevenue,
    };
  }, [displayedHouses]);

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
            // Простые и понятные столбцы
            [
              "№ п/п",
              "Квартира",
              "ФИО Абонента",
              "Контактный телефон",
              "Трубка",
              "Ключи",
              "Личный кабинет",
              "Монтаж / Услуги",
              "Сумма (₽)",
              "Статус оплаты",
              "Подпись абонента о получении оборудования",
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

            const paymentText = order.payment_status === "paid" 
              ? `Оплачено (${Number(order.payment_amount || 0).toFixed(0)} ₽)`
              : `Ожидает (${Number(order.payment_amount || 0).toFixed(0)} ₽)`;

            sheetData.push([
              index + 1,
              order.apartment ? `кв. ${order.apartment}` : "—",
              order.name || "Абонент",
              order.phone || "—",
              parsed.handset,
              parsed.keys,
              parsed.hasApp ? "+" : "—",
              parsed.services,
              Number(order.payment_amount || 0).toFixed(0),
              paymentText,
              "", // Пустая ячейка для подписи жильца
            ]);
          });

          // Итоговая строка подъезда
          sheetData.push([]);
          sheetData.push([
            `ИТОГО ПО ${entranceLabel.toUpperCase()}:`,
            `Квартир: ${entOrders.length}`,
            "",
            "",
            `Трубок: ${subHandsets}`,
            `Ключей: ${subKeys}`,
            `ЛК (+): ${subApp}`,
            `Услуг: ${subServices}`,
            `${subRevenue.toFixed(0)} ₽`,
            "Все заказы оплачены",
            "",
          ]);

          // Подписи ответственных лиц
          sheetData.push([]);
          sheetData.push(["Ответственный мастер / монтажник: ___________________________ / ___________________________ /"]);
          sheetData.push(["Дата проведения монтажных работ: «____» ____________________ 202___ г."]);

          const ws = XLSX.utils.aoa_to_sheet(sheetData);

          // Ширина колонок для печати
          ws["!cols"] = [
            { wch: 6 },  // № п/п
            { wch: 12 }, // Квартира
            { wch: 25 }, // ФИО Абонента
            { wch: 18 }, // Контактный телефон
            { wch: 22 }, // Трубка
            { wch: 22 }, // Ключи
            { wch: 16 }, // Личный кабинет
            { wch: 20 }, // Монтаж / Услуги
            { wch: 12 }, // Сумма (₽)
            { wch: 22 }, // Статус оплаты
            { wch: 38 }, // Подпись абонента о получении оборудования
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
        <div className="space-y-6">
          {displayedHouses.map((houseGroup) => (
            <Card key={houseGroup.houseKey} className="border-slate-200/80 dark:border-slate-800/80 shadow-md overflow-hidden bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm">
              {/* Заголовок дома: темный фон dark:bg-slate-800/70 для идеальной видимости белого текста */}
              <CardHeader className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-800/70 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Building2 className="h-5 w-5 text-primary shrink-0" />
                    <CardTitle className="text-base sm:text-lg font-black text-foreground">
                      {houseGroup.fullAddress}
                    </CardTitle>
                    {renderServiceTypeBadge(houseGroup.serviceType)}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                    <Badge variant="secondary" className="font-bold">
                      {houseGroup.stats.apartmentsCount} {houseGroup.stats.apartmentsCount === 1 ? "заказ" : "заказов"}
                    </Badge>
                    {houseGroup.stats.totalHandsets > 0 && (
                      <Badge variant="outline" className="text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800/60 bg-purple-50 dark:bg-purple-950/40">
                        <Radio className="h-3 w-3 mr-1 inline" />
                        Трубок: {houseGroup.stats.totalHandsets} шт.
                      </Badge>
                    )}
                    {houseGroup.stats.totalKeys > 0 && (
                      <Badge variant="outline" className="text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-950/40">
                        <KeyRound className="h-3 w-3 mr-1 inline" />
                        Ключей: {houseGroup.stats.totalKeys} шт.
                      </Badge>
                    )}
                    {houseGroup.stats.totalApps > 0 && (
                      <Badge variant="outline" className="text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60 bg-emerald-50 dark:bg-emerald-950/40">
                        <CheckCircle2 className="h-3 w-3 mr-1 inline" />
                        ЛК (+): {houseGroup.stats.totalApps}
                      </Badge>
                    )}
                    <span className="font-extrabold text-foreground ml-1">
                      {houseGroup.stats.totalRevenue.toFixed(0)} ₽
                    </span>
                  </div>
                </div>

                {/* Кнопка экспорта именно этого дома */}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleExportExcel(houseGroup)}
                  className="gap-1.5 text-xs font-bold border-emerald-600/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 shrink-0"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Скачать Excel дома</span>
                </Button>
              </CardHeader>

              {/* Секции по каждому подъезду дома */}
              <CardContent className="p-0 divide-y divide-slate-100 dark:divide-slate-800">
                {houseGroup.entrances.map((entGroup) => (
                  <div key={entGroup.entrance} className="p-4 sm:p-5 space-y-3">
                    {/* Заголовок подъезда */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <DoorClosed className="h-4 w-4 text-primary shrink-0" />
                        <h3 className="font-bold text-sm text-foreground">
                          {entGroup.entrance === "Без подъезда" ? "Подъезд не указан" : `Подъезд №${entGroup.entrance}`}
                        </h3>
                        {renderServiceTypeBadge(entGroup.serviceType, true)}
                        <Badge variant="secondary" className="text-[11px] font-semibold">
                          {entGroup.orders.length} {entGroup.orders.length === 1 ? "квартира" : "квартир"}
                        </Badge>
                      </div>

                      {/* Мини-сводка подъезда */}
                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        {entGroup.stats.totalHandsets > 0 && <span>Трубок: <strong className="text-foreground">{entGroup.stats.totalHandsets}</strong></span>}
                        {entGroup.stats.totalKeys > 0 && <span>Ключей: <strong className="text-foreground">{entGroup.stats.totalKeys}</strong></span>}
                        {entGroup.stats.totalApps > 0 && <span>ЛК: <strong className="text-foreground">{entGroup.stats.totalApps}</strong></span>}
                        <span>Сумма: <strong className="text-foreground">{entGroup.stats.totalRevenue.toFixed(0)} ₽</strong></span>
                      </div>
                    </div>

                    {/* Таблица нарядов подъезда */}
                    <div className="overflow-x-auto rounded-xl border border-slate-200/60 dark:border-slate-800/60">
                      <table className="w-full text-sm text-left border-collapse">
                        <thead className="text-[11px] font-bold uppercase bg-slate-100/80 dark:bg-slate-800/70 text-muted-foreground border-b border-slate-200/60 dark:border-slate-800/60">
                          <tr>
                            <th className="px-3 py-2.5 text-center w-14">Кв.</th>
                            <th className="px-3 py-2.5 text-center w-14">Подъезд</th>
                            <th className="px-4 py-2.5">Абонент / Телефон</th>
                            <th className="px-3 py-2.5">Трубка</th>
                            <th className="px-3 py-2.5">Ключи</th>
                            <th className="px-3 py-2.5 text-center">Личный кабинет</th>
                            <th className="px-3 py-2.5">Монтаж / Услуги</th>
                            <th className="px-3 py-2.5 text-right">Сумма</th>
                            <th className="px-3 py-2.5 text-center">Оплата</th>
                            <th className="px-3 py-2.5 text-center">Статус монтажа</th>
                            <th className="px-4 py-2.5 text-center">Действие</th>
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
                                className={cn(
                                  "hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-all",
                                  isCompleted && "bg-green-500/[0.04] dark:bg-green-500/[0.03]"
                                )}
                              >
                                {/* Квартира */}
                                <td className="px-3 py-2.5 text-center font-extrabold text-base text-foreground font-mono">
                                  {order.apartment || "—"}
                                </td>

                                {/* Подъезд */}
                                <td className="px-3 py-2.5 text-center font-semibold text-muted-foreground text-xs">
                                  {order.entrance ? `п. ${order.entrance}` : "—"}
                                </td>

                                {/* Абонент и телефон */}
                                <td className="px-4 py-2.5">
                                  <div className="font-bold text-foreground flex items-center gap-1.5">
                                    <User className="h-3.5 w-3.5 text-primary shrink-0" />
                                    <span>{order.name || "Абонент"}</span>
                                  </div>
                                  {order.phone && (
                                    <a
                                      href={`tel:${order.phone}`}
                                      className="text-xs text-primary hover:underline font-medium flex items-center gap-1 mt-0.5"
                                    >
                                      <Phone className="h-3 w-3" />
                                      <span>{order.phone}</span>
                                    </a>
                                  )}
                                </td>

                                {/* Трубка */}
                                <td className="px-3 py-2.5">
                                  {parsed.handset !== "—" ? (
                                    <Badge variant="outline" className="text-xs py-0.5 px-2 font-semibold text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/40 whitespace-nowrap">
                                      <Radio className="h-3 w-3 mr-1 inline shrink-0" />
                                      <span>{parsed.handset}</span>
                                    </Badge>
                                  ) : (
                                    <span className="text-muted-foreground text-xs">—</span>
                                  )}
                                </td>

                                {/* Ключи */}
                                <td className="px-3 py-2.5">
                                  {parsed.keys !== "—" ? (
                                    <Badge variant="outline" className="text-xs py-0.5 px-2 font-semibold text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 whitespace-nowrap">
                                      <KeyRound className="h-3 w-3 mr-1 inline shrink-0" />
                                      <span>{parsed.keys}</span>
                                    </Badge>
                                  ) : (
                                    <span className="text-muted-foreground text-xs">—</span>
                                  )}
                                </td>

                                {/* Личный кабинет */}
                                <td className="px-3 py-2.5 text-center">
                                  {parsed.hasApp ? (
                                    <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white font-extrabold text-xs py-0.5 px-2">
                                      + Оплачен
                                    </Badge>
                                  ) : (
                                    <span className="text-muted-foreground text-xs">—</span>
                                  )}
                                </td>

                                {/* Монтаж / Услуги */}
                                <td className="px-3 py-2.5">
                                  {parsed.services === "Монтаж" ? (
                                    <Badge className="bg-blue-600 hover:bg-blue-600 text-white font-bold text-xs py-0.5 px-2 whitespace-nowrap">
                                      Монтаж
                                    </Badge>
                                  ) : parsed.services === "Замена" ? (
                                    <Badge variant="outline" className="text-amber-700 dark:text-amber-300 border-amber-300 bg-amber-50 dark:bg-amber-950/40 font-bold text-xs py-0.5 px-2 whitespace-nowrap">
                                      Замена
                                    </Badge>
                                  ) : parsed.services !== "—" ? (
                                    <Badge variant="secondary" className="text-xs py-0.5 px-2 font-medium whitespace-nowrap">
                                      {parsed.services}
                                    </Badge>
                                  ) : (
                                    <span className="text-muted-foreground text-xs">—</span>
                                  )}
                                </td>

                                {/* Сумма */}
                                <td className="px-3 py-2.5 text-right font-extrabold text-foreground whitespace-nowrap">
                                  {Number(order.payment_amount || 0).toFixed(0)} ₽
                                </td>

                                {/* Статус оплаты */}
                                <td className="px-3 py-2.5 text-center whitespace-nowrap">
                                  {isPaid ? (
                                    <Badge className="bg-green-600 hover:bg-green-600 text-white font-bold text-[10px] py-0.5 px-2">
                                      ✓ Оплачено
                                    </Badge>
                                  ) : (
                                    <Badge className="bg-amber-500 hover:bg-amber-500 text-white font-bold text-[10px] py-0.5 px-2">
                                      ⏳ Ожидает
                                    </Badge>
                                  )}
                                </td>

                                {/* Статус монтажа */}
                                <td className="px-3 py-2.5 text-center whitespace-nowrap">
                                  {isCompleted ? (
                                    <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-300/40 font-bold text-xs">
                                      ✓ Выдано
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-amber-700 dark:text-amber-400 border-amber-300 font-semibold text-xs">
                                      В очереди
                                    </Badge>
                                  )}
                                </td>

                                {/* Действие */}
                                <td className="px-4 py-2.5 text-center">
                                  {isCompleted ? (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 text-xs text-muted-foreground hover:text-foreground"
                                      onClick={() => updateStatusMutation.mutate({ id: order.id, newStatus: "in_progress" })}
                                      disabled={updateStatusMutation.isPending}
                                    >
                                      Отменить
                                    </Button>
                                  ) : (
                                    <Button
                                      size="sm"
                                      className="h-7 text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground"
                                      onClick={() => updateStatusMutation.mutate({ id: order.id, newStatus: "completed" })}
                                      disabled={updateStatusMutation.isPending}
                                    >
                                      <Check className="h-3 w-3 mr-1" />
                                      Выдано
                                    </Button>
                                  )}
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
          ))}
        </div>
      )}
    </div>
  );
};

export default InstallerSheetManager;
