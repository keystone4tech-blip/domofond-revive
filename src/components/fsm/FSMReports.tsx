import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart3,
  Download,
  Loader2,
  TrendingUp,
  CreditCard,
  Banknote,
  Users,
  CheckCircle2,
  Clock,
  AlertCircle,
  Calendar,
  ShieldCheck,
  FileSpreadsheet,
  Layers,
  ShoppingBag,
  Wrench,
  UserCheck,
  Phone,
  MapPin,
  RefreshCw,
  UserX,
  Sparkles
} from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths, startOfYear, startOfDay } from "date-fns";

// --- Интерфейсы типизации данных отчётов ---

interface RequestItemWithProduct {
  id: string;
  request_id: string;
  product_id: string;
  quantity: number;
  price: number;
  created_at: string;
  products?: {
    id: string;
    name: string;
    category?: string | null;
    price?: number | null;
    unit?: string | null;
  } | null;
}

interface RequestRecord {
  id: string;
  name: string | null;
  phone: string | null;
  address: string | null;
  message: string | null;
  status: string;
  order_type: string | null;
  payment_status: string | null;
  payment_amount: number | null;
  payment_method: string | null;
  assigned_to: string | null;
  accepted_by: string | null;
  accepted_at: string | null;
  completed_at: string | null;
  notes: string | null;
  created_at: string;
  assigned_employee?: { id: string; full_name: string; phone?: string | null } | null;
  accepted_employee?: { id: string; full_name: string; phone?: string | null } | null;
}

interface ProfileRecord {
  id: string;
  full_name: string | null;
  phone: string | null;
  address: string | null;
  apartment: string | null;
  verification_status: string | null;
  created_at: string;
  verification_submitted_at?: string | null;
  verification_reviewed_at?: string | null;
}

interface EmployeeRecord {
  id: string;
  full_name: string;
  phone: string | null;
  role: string | null;
  is_active: boolean;
}

interface AccountRecord {
  id: string;
  account_number: string;
  address: string;
  debt_amount: number;
  payment_type: string | null;
  period: string;
  phone?: string | null;
  full_name?: string | null;
}

interface RegistryUploadRecord {
  id: string;
  filename: string;
  batch_number: number;
  period: string;
  total_records: number;
  total_debt_amount: number;
  uploaded_at: string;
}

export const FSMReports: React.FC = () => {
  // --- Состояния фильтров периода ---
  // По умолчанию ставим диапазон с начала текущего месяца по текущую дату
  const [dateFrom, setDateFrom] = useState(() => format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [selectedEmployeeFilter, setSelectedEmployeeFilter] = useState<string>("all");
  const [activeReportTab, setActiveReportTab] = useState<string>("finances");

  // --- Быстрые предустановки периодов ---
  const applyPresetPeriod = (preset: "all" | "today" | "this_month" | "last_month" | "this_year") => {
    const now = new Date();
    console.log(`[FSMReports] Применение пресета периода: ${preset}`);

    switch (preset) {
      case "all":
        setDateFrom("2024-01-01");
        setDateTo(format(now, "yyyy-MM-dd"));
        break;
      case "today":
        setDateFrom(format(startOfDay(now), "yyyy-MM-dd"));
        setDateTo(format(now, "yyyy-MM-dd"));
        break;
      case "this_month":
        setDateFrom(format(startOfMonth(now), "yyyy-MM-dd"));
        setDateTo(format(now, "yyyy-MM-dd"));
        break;
      case "last_month":
        const prevMonthDate = subMonths(now, 1);
        setDateFrom(format(startOfMonth(prevMonthDate), "yyyy-MM-dd"));
        setDateTo(format(endOfMonth(prevMonthDate), "yyyy-MM-dd"));
        break;
      case "this_year":
        setDateFrom(format(startOfYear(now), "yyyy-MM-dd"));
        setDateTo(format(now, "yyyy-MM-dd"));
        break;
    }
  };

  // --- 1. Загрузка сотрудников ---
  const { data: employees = [], isLoading: isLoadingEmployees } = useQuery({
    queryKey: ["reports-employees"],
    queryFn: async () => {
      console.log("[FSMReports] Загрузка списка сотрудников...");
      const { data, error } = await supabase
        .from("employees")
        .select("id, full_name, phone, role, is_active")
        .order("full_name");
      if (error) {
        console.error("[FSMReports] Ошибка загрузки сотрудников:", error);
        throw error;
      }
      return data as EmployeeRecord[];
    },
  });

  // --- 2. Загрузка всех заявок и заказов с джойнами сотрудников ---
  const { data: requests = [], isLoading: isLoadingRequests, refetch: refetchRequests } = useQuery({
    queryKey: ["reports-requests"],
    queryFn: async () => {
      console.log("[FSMReports] Загрузка всех заявок (requests)...");
      const { data, error } = await supabase
        .from("requests")
        .select(`
          *,
          assigned_employee:employees!requests_assigned_to_fkey (id, full_name, phone),
          accepted_employee:employees!requests_accepted_by_fkey (id, full_name, phone)
        `)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("[FSMReports] Ошибка загрузки requests:", error);
        throw error;
      }
      return (data || []) as RequestRecord[];
    },
  });

  // --- 3. Загрузка позиций заказов (request_items) с информацией о товарах ---
  const { data: requestItems = [], isLoading: isLoadingItems } = useQuery({
    queryKey: ["reports-request-items"],
    queryFn: async () => {
      console.log("[FSMReports] Загрузка позиций заказов (request_items)...");
      const { data, error } = await supabase
        .from("request_items")
        .select("*, products(*)");
      if (error) {
        console.error("[FSMReports] Ошибка загрузки request_items:", error);
        throw error;
      }
      return (data || []) as RequestItemWithProduct[];
    },
  });

  // --- 4. Загрузка профилей пользователей (регистрации и верификация) ---
  const { data: profiles = [], isLoading: isLoadingProfiles } = useQuery({
    queryKey: ["reports-profiles"],
    queryFn: async () => {
      console.log("[FSMReports] Загрузка профилей пользователей (profiles)...");
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, phone, address, apartment, verification_status, created_at, verification_submitted_at, verification_reviewed_at")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("[FSMReports] Ошибка загрузки profiles:", error);
        throw error;
      }
      return (data || []) as ProfileRecord[];
    },
  });

  // --- 5. Загрузка счетов и реестров абонентов 1С ---
  const { data: accountsData = [], isLoading: isLoadingAccounts } = useQuery({
    queryKey: ["reports-accounts"],
    queryFn: async () => {
      console.log("[FSMReports] Загрузка лицевых счетов абонентов 1С...");
      const { data, error } = await supabase
        .from("accounts")
        .select("id, account_number, address, debt_amount, payment_type, period, phone, full_name");
      if (error) {
        console.error("[FSMReports] Ошибка загрузки accounts:", error);
        throw error;
      }
      return (data || []) as AccountRecord[];
    },
  });

  const { data: lastRegistryUploads = [] } = useQuery({
    queryKey: ["reports-registry-uploads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("account_registry_uploads" as any)
        .select("*")
        .order("uploaded_at", { ascending: false })
        .limit(5);
      if (error) return [];
      return (data || []) as RegistryUploadRecord[];
    },
  });

  const isGlobalLoading = isLoadingRequests || isLoadingItems || isLoadingProfiles || isLoadingEmployees || isLoadingAccounts;

  // --- Фильтрация заявок и заказов по выбранному диапазону дат ---
  const filteredRequests = useMemo(() => {
    const fromTime = new Date(`${dateFrom}T00:00:00`).getTime();
    const toTime = new Date(`${dateTo}T23:59:59.999`).getTime();

    return requests.filter(r => {
      const itemTime = new Date(r.created_at).getTime();
      return itemTime >= fromTime && itemTime <= toTime;
    });
  }, [requests, dateFrom, dateTo]);

  // Фильтрация позиций товаров по отфильтрованным заказам
  const filteredRequestItems = useMemo(() => {
    const validRequestIds = new Set(filteredRequests.map(r => r.id));
    return requestItems.filter(item => validRequestIds.has(item.request_id));
  }, [filteredRequests, requestItems]);

  // Фильтрация профилей по выбранному диапазону дат регистрации
  const filteredProfiles = useMemo(() => {
    const fromTime = new Date(`${dateFrom}T00:00:00`).getTime();
    const toTime = new Date(`${dateTo}T23:59:59.999`).getTime();

    return profiles.filter(p => {
      const regTime = new Date(p.created_at).getTime();
      return regTime >= fromTime && regTime <= toTime;
    });
  }, [profiles, dateFrom, dateTo]);

  // --- Расчет агрегированных финансовых показателей ---
  const financialStats = useMemo(() => {
    let totalRevenue = 0; // Фактическая выручка (оплаченные заказы)
    let onlineRevenue = 0; // Оплачено онлайн (картой)
    let cashRevenue = 0; // Оплачено наличными мастеру
    let pendingRevenue = 0; // Ожидает оплаты
    let paidOrdersCount = 0; // Число оплаченных заказов
    let pendingOrdersCount = 0; // Число неоплаченных заказов

    filteredRequests.forEach(req => {
      const amount = Number(req.payment_amount) || 0;
      const isPaid = req.payment_status === "paid";
      const isOnline = req.payment_method === "online" || req.payment_method === "card";

      if (isPaid) {
        totalRevenue += amount;
        paidOrdersCount++;
        if (isOnline) {
          onlineRevenue += amount;
        } else {
          cashRevenue += amount;
        }
      } else {
        pendingRevenue += amount;
        pendingOrdersCount++;
      }
    });

    const averageCheck = paidOrdersCount > 0 ? Math.round(totalRevenue / paidOrdersCount) : 0;

    return {
      totalRevenue,
      onlineRevenue,
      cashRevenue,
      pendingRevenue,
      paidOrdersCount,
      pendingOrdersCount,
      averageCheck,
    };
  }, [filteredRequests]);

  // --- Расчет показателей заявок и работ ---
  const requestsStats = useMemo(() => {
    const total = filteredRequests.length;
    const completed = filteredRequests.filter(r => r.status === "completed").length;
    const inProgress = filteredRequests.filter(r => r.status === "in_progress").length;
    const newRequests = filteredRequests.filter(r => r.status === "new" || r.status === "pending").length;
    const cancelled = filteredRequests.filter(r => r.status === "cancelled").length;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    // Распределение по типам работ
    const byType: Record<string, number> = {};
    filteredRequests.forEach(r => {
      const type = r.order_type || "other";
      byType[type] = (byType[type] || 0) + 1;
    });

    return {
      total,
      completed,
      inProgress,
      newRequests,
      cancelled,
      completionRate,
      byType,
    };
  }, [filteredRequests]);

  // --- Детальная аналитика по сотрудникам (принятые, выполненные, выручка) ---
  const employeesAnalytics = useMemo(() => {
    // Карта статистики по сотрудникам
    const statsMap: Record<string, {
      id: string;
      fullName: string;
      phone: string | null;
      role: string | null;
      totalAssigned: number;
      acceptedCount: number;
      completedCount: number;
      inProgressCount: number;
      cancelledCount: number;
      earnedRevenue: number;
      completionRate: number;
    }> = {};

    // 1. Инициализируем зарегистрированных сотрудников
    employees.forEach(emp => {
      statsMap[emp.id] = {
        id: emp.id,
        fullName: emp.full_name,
        phone: emp.phone,
        role: emp.role,
        totalAssigned: 0,
        acceptedCount: 0,
        completedCount: 0,
        inProgressCount: 0,
        cancelledCount: 0,
        earnedRevenue: 0,
        completionRate: 0,
      };
    });

    // 2. Обрабатываем отфильтрованные заявки
    filteredRequests.forEach(req => {
      // Определяем ответственного мастера (по accepted_by или assigned_to)
      let empId = req.accepted_by || req.assigned_to;
      let empName = req.accepted_employee?.full_name || req.assigned_employee?.full_name;

      // Если в колонках ID не задан, но в notes зафиксировано "Принял: Имя..."
      if (!empId && req.notes && req.notes.includes("Принял:")) {
        const match = req.notes.match(/Принял:\s*([^,•]+)/i);
        if (match && match[1]) {
          const parsedName = match[1].trim();
          // Ищем в существующей карте или в сотрудниках
          const found = Object.values(statsMap).find(e => e.fullName.toLowerCase() === parsedName.toLowerCase());
          if (found) {
            empId = found.id;
          } else {
            empId = `parsed_${parsedName}`;
            empName = parsedName;
          }
        }
      }

      if (!empId) {
        empId = "unassigned";
        empName = "Не назначен (Диспетчерская)";
      }

      if (!statsMap[empId]) {
        statsMap[empId] = {
          id: empId,
          fullName: empName || "Сотрудник",
          phone: null,
          role: "master",
          totalAssigned: 0,
          acceptedCount: 0,
          completedCount: 0,
          inProgressCount: 0,
          cancelledCount: 0,
          earnedRevenue: 0,
          completionRate: 0,
        };
      }

      const st = statsMap[empId];
      st.totalAssigned++;
      if (req.accepted_by || req.accepted_at || req.notes?.includes("Принял:")) {
        st.acceptedCount++;
      }

      if (req.status === "completed") {
        st.completedCount++;
        st.earnedRevenue += Number(req.payment_amount) || 0;
      } else if (req.status === "in_progress") {
        st.inProgressCount++;
      } else if (req.status === "cancelled") {
        st.cancelledCount++;
      }
    });

    // Расчет конверсии для каждого
    Object.values(statsMap).forEach(st => {
      st.completionRate = st.totalAssigned > 0 ? Math.round((st.completedCount / st.totalAssigned) * 100) : 0;
    });

    // Сортировка по количеству выполненных заявок
    return Object.values(statsMap).sort((a, b) => b.completedCount - a.completedCount || b.totalAssigned - a.totalAssigned);
  }, [employees, filteredRequests]);

  // Заявки, отфильтрованные по выбранному в выпадающем списке сотруднику
  const requestsForSelectedEmployee = useMemo(() => {
    if (selectedEmployeeFilter === "all") return filteredRequests;
    return filteredRequests.filter(req => {
      const matchId = req.accepted_by === selectedEmployeeFilter || req.assigned_to === selectedEmployeeFilter;
      if (matchId) return true;
      if (req.notes?.includes("Принял:")) {
        const emp = employees.find(e => e.id === selectedEmployeeFilter);
        if (emp && req.notes.toLowerCase().includes(emp.full_name.toLowerCase())) {
          return true;
        }
      }
      return false;
    });
  }, [filteredRequests, selectedEmployeeFilter, employees]);

  // --- Анализ продаж оборудования по номенклатуре ---
  const productSalesStats = useMemo(() => {
    const productMap: Record<string, {
      name: string;
      category: string;
      totalQuantity: number;
      totalSum: number;
      unit: string;
    }> = {};

    filteredRequestItems.forEach(item => {
      const name = item.products?.name || `Товар #${item.product_id.slice(0, 8)}`;
      const category = item.products?.category || "Оборудование";
      const unit = item.products?.unit || "шт.";
      const qty = Number(item.quantity) || 1;
      const price = Number(item.price) || 0;
      const sum = qty * price;

      if (!productMap[name]) {
        productMap[name] = {
          name,
          category,
          totalQuantity: 0,
          totalSum: 0,
          unit,
        };
      }

      productMap[name].totalQuantity += qty;
      productMap[name].totalSum += sum;
    });

    return Object.values(productMap).sort((a, b) => b.totalSum - a.totalSum);
  }, [filteredRequestItems]);

  // --- Статистика верификаций и регистраций ---
  const registrationStats = useMemo(() => {
    const totalRegistered = profiles.length;
    const periodRegistered = filteredProfiles.length;
    const verified = profiles.filter(p => p.verification_status === "verified").length;
    const pendingVerification = profiles.filter(p => p.verification_status === "pending").length;
    const rejectedVerification = profiles.filter(p => p.verification_status === "rejected").length;
    const unverified = profiles.filter(p => !p.verification_status || p.verification_status === "unverified").length;

    return {
      totalRegistered,
      periodRegistered,
      verified,
      pendingVerification,
      rejectedVerification,
      unverified,
    };
  }, [profiles, filteredProfiles]);

  // --- Статистика по абонентской базе 1С (accounts) ---
  const billingStats = useMemo(() => {
    let totalDebt = 0;
    let totalOverpayment = 0;
    let debtorsCount = 0;
    const tariffCounts: Record<string, number> = {};

    // Топ домов по сумме долга
    const housesDebtMap: Record<string, { address: string; debt: number; count: number }> = {};

    accountsData.forEach(acc => {
      const debt = Number(acc.debt_amount) || 0;
      if (debt > 0) {
        totalDebt += debt;
        debtorsCount++;
      } else if (debt < 0) {
        totalOverpayment += Math.abs(debt);
      }

      const tariff = acc.payment_type || "Не указан";
      tariffCounts[tariff] = (tariffCounts[tariff] || 0) + 1;

      // Группировка долгов по домам
      const parts = (acc.address || "").split(",");
      const houseAddr = parts.length >= 3 ? `${parts[1]?.trim() || ""}, ${parts[2]?.trim() || ""}` : acc.address;
      if (!housesDebtMap[houseAddr]) {
        housesDebtMap[houseAddr] = { address: houseAddr, debt: 0, count: 0 };
      }
      housesDebtMap[houseAddr].debt += Math.max(0, debt);
      housesDebtMap[houseAddr].count++;
    });

    const topDebtorHouses = Object.values(housesDebtMap)
      .filter(h => h.debt > 0)
      .sort((a, b) => b.debt - a.debt)
      .slice(0, 10);

    return {
      totalAccounts: accountsData.length,
      totalDebt,
      totalOverpayment,
      debtorsCount,
      tariffCounts,
      topDebtorHouses,
    };
  }, [accountsData]);

  // --- Экспорт сводного отчета в CSV / Excel с русской кодировкой BOM ---
  const handleExportCSV = () => {
    console.log("[FSMReports] Формирование и выгрузка CSV отчёта...");
    const rows: string[][] = [];

    // Заголовок
    rows.push(["АНАЛИТИЧЕСКИЙ ОТЧЕТ СИСТЕМЫ «ДОМОФОНДАР»"]);
    rows.push([`Период: с ${dateFrom} по ${dateTo}`]);
    rows.push([`Дата выгрузки: ${format(new Date(), "dd.MM.yyyy HH:mm")}`]);
    rows.push([]);

    // 1. Финансы
    rows.push(["1. ФИНАНСОВЫЕ ПОКАЗАТЕЛИ"]);
    rows.push(["Показатель", "Значение"]);
    rows.push(["Общая сумма поступивших оплат (Выручка)", `${financialStats.totalRevenue.toFixed(2)} ₽`]);
    rows.push(["Оплачено онлайн (картой / эквайринг)", `${financialStats.onlineRevenue.toFixed(2)} ₽`]);
    rows.push(["Оплачено наличными мастеру", `${financialStats.cashRevenue.toFixed(2)} ₽`]);
    rows.push(["Сумма в ожидании оплаты", `${financialStats.pendingRevenue.toFixed(2)} ₽`]);
    rows.push(["Количество оплаченных заказов", String(financialStats.paidOrdersCount)]);
    rows.push(["Средний чек заказа", `${financialStats.averageCheck} ₽`]);
    rows.push([]);

    // 2. Заявки и работы
    rows.push(["2. ЗАЯВКИ И СЕРВИСНЫЕ РАБОТЫ"]);
    rows.push(["Показатель", "Значение"]);
    rows.push(["Всего обращений за период", String(requestsStats.total)]);
    rows.push(["Выполнено (завершено)", String(requestsStats.completed)]);
    rows.push(["В работе у мастеров", String(requestsStats.inProgress)]);
    rows.push(["Новые / на рассмотрении", String(requestsStats.newRequests)]);
    rows.push(["Отменено", String(requestsStats.cancelled)]);
    rows.push(["Процент выполнения (конверсия)", `${requestsStats.completionRate}%`]);
    rows.push([]);

    // 3. Показатели сотрудников
    rows.push(["3. ЭФФЕКТИВНОСТЬ СОТРУДНИКОВ И МАСТЕРОВ"]);
    rows.push(["Сотрудник", "Телефон", "Назначено", "Принято", "Выполнено", "В работе", "Выручка (₽)", "Конверсия"]);
    employeesAnalytics.forEach(emp => {
      rows.push([
        emp.fullName,
        emp.phone || "—",
        String(emp.totalAssigned),
        String(emp.acceptedCount),
        String(emp.completedCount),
        String(emp.inProgressCount),
        `${emp.earnedRevenue.toFixed(2)} ₽`,
        `${emp.completionRate}%`,
      ]);
    });
    rows.push([]);

    // 4. Продажи оборудования
    rows.push(["4. ПРОДАЖИ ОБОРУДОВАНИЯ И МАТЕРИАЛОВ"]);
    rows.push(["Наименование", "Категория", "Количество", "Ед. изм.", "Сумма продаж (₽)"]);
    productSalesStats.forEach(item => {
      rows.push([
        item.name,
        item.category,
        String(item.totalQuantity),
        item.unit,
        `${item.totalSum.toFixed(2)} ₽`,
      ]);
    });
    rows.push([]);

    // 5. Регистрации
    rows.push(["5. РЕГИСТРАЦИИ ЖИТЕЛЕЙ И ВЕРИФИКАЦИЯ"]);
    rows.push(["Показатель", "Значение"]);
    rows.push(["Всего зарегистрировано в системе", String(registrationStats.totalRegistered)]);
    rows.push(["Новых регистраций за период", String(registrationStats.periodRegistered)]);
    rows.push(["Верифицировано документов", String(registrationStats.verified)]);
    rows.push(["Ожидает проверки диспетчером", String(registrationStats.pendingVerification)]);
    rows.push(["Отклонено документов", String(registrationStats.rejectedVerification)]);
    rows.push([]);

    // Формируем CSV с поддержкой русской локали
    const csvString = rows
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(";"))
      .join("\r\n");

    const blob = new Blob(["\ufeff" + csvString], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Отчет_Домофондар_${dateFrom}_${dateTo}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Преобразование наименования типа заказа
  const formatOrderType = (type: string | null) => {
    switch (type) {
      case "equipment_order": return "Заказ оборудования";
      case "repair": return "Ремонт домофона";
      case "handset_sale": return "Продажа трубки";
      case "additional_keys": return "Дополнительные ключи";
      case "verification_request": return "Верификация аккаунта";
      case "intercom_login": return "Выдача логина/пароля";
      default: return type || "Заявка";
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* 1. ВЕРХНЯЯ ПАНЕЛЬ: Управление периодом, быстрые пресеты и выгрузка */}
      <Card className="glass-card rounded-2xl border border-slate-200/60 dark:border-slate-800 shadow-sm">
        <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-850">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-xl font-bold flex items-center gap-2">
                <BarChart3 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                Сводная аналитика и отчёты
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                Комплексные данные по выручке, платежам, работе сотрудников, заказам оборудования и абонентской базе 1С.
              </CardDescription>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetchRequests()}
                disabled={isGlobalLoading}
                className="h-9 rounded-xl text-xs flex items-center gap-1.5"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isGlobalLoading ? "animate-spin" : ""}`} />
                <span>Обновить</span>
              </Button>

              <Button
                onClick={handleExportCSV}
                disabled={isGlobalLoading}
                className="h-9 rounded-xl text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center gap-1.5 shadow-sm"
              >
                <Download className="h-4 w-4" />
                <span>Экспорт в Excel (CSV)</span>
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-4 space-y-3">
          {/* Быстрые кнопки пресетов */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs text-muted-foreground font-medium mr-1 flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              Период:
            </span>
            <Button variant="outline" size="sm" onClick={() => applyPresetPeriod("all")} className="h-7 text-xs rounded-lg px-2.5">
              За всё время
            </Button>
            <Button variant="outline" size="sm" onClick={() => applyPresetPeriod("today")} className="h-7 text-xs rounded-lg px-2.5">
              Сегодня
            </Button>
            <Button variant="outline" size="sm" onClick={() => applyPresetPeriod("this_month")} className="h-7 text-xs rounded-lg px-2.5">
              Текущий месяц
            </Button>
            <Button variant="outline" size="sm" onClick={() => applyPresetPeriod("last_month")} className="h-7 text-xs rounded-lg px-2.5">
              Прошлый месяц
            </Button>
            <Button variant="outline" size="sm" onClick={() => applyPresetPeriod("this_year")} className="h-7 text-xs rounded-lg px-2.5">
              Текущий год
            </Button>
          </div>

          {/* Ручной выбор диапазона дат и выбор сотрудника */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            <div className="space-y-1 text-left">
              <Label htmlFor="dateFrom" className="text-xs text-slate-500 font-medium">Дата с:</Label>
              <Input
                id="dateFrom"
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className="h-9 text-xs rounded-xl bg-white/60 dark:bg-slate-900/60"
              />
            </div>

            <div className="space-y-1 text-left">
              <Label htmlFor="dateTo" className="text-xs text-slate-500 font-medium">Дата по:</Label>
              <Input
                id="dateTo"
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                className="h-9 text-xs rounded-xl bg-white/60 dark:bg-slate-900/60"
              />
            </div>

            <div className="space-y-1 text-left">
              <Label className="text-xs text-slate-500 font-medium">Сотрудник (для фильтрации):</Label>
              <Select value={selectedEmployeeFilter} onValueChange={setSelectedEmployeeFilter}>
                <SelectTrigger className="h-9 text-xs rounded-xl bg-white/60 dark:bg-slate-900/60">
                  <SelectValue placeholder="Все сотрудники" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все сотрудники и мастера</SelectItem>
                  {employees.map(emp => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.full_name} ({emp.phone || "без тел."})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. СВОДНЫЕ ИНДИКАТОРЫ (KPI КАРТОЧКИ) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Карточка 1: Финансы / Оплаты */}
        <Card className="rounded-2xl border border-slate-200/60 dark:border-slate-800 shadow-sm bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                Поступившие оплаты
              </span>
              <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-600 flex items-center justify-center">
                <CreditCard className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-black text-foreground font-mono">
                {financialStats.totalRevenue.toLocaleString("ru-RU")} ₽
              </div>
              <p className="text-xs text-muted-foreground mt-1 flex items-center justify-between">
                <span>Оплачено заказов: <strong>{financialStats.paidOrdersCount}</strong></span>
                <span>Ср. чек: <strong>{financialStats.averageCheck} ₽</strong></span>
              </p>
            </div>
            {financialStats.pendingRevenue > 0 && (
              <div className="mt-2.5 pt-2 border-t border-emerald-500/20 text-[11px] text-amber-600 dark:text-amber-400 flex items-center justify-between">
                <span>Ожидает оплаты ({financialStats.pendingOrdersCount}):</span>
                <strong className="font-mono">{financialStats.pendingRevenue.toLocaleString("ru-RU")} ₽</strong>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Карточка 2: Заявки и Работы */}
        <Card className="rounded-2xl border border-slate-200/60 dark:border-slate-800 shadow-sm bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wider">
                Заявки и Работы
              </span>
              <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-600 flex items-center justify-center">
                <Wrench className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-black text-foreground font-mono">
                {requestsStats.total} <span className="text-sm font-normal text-muted-foreground">заявок</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1 flex items-center justify-between">
                <span>Выполнено: <strong className="text-green-600">{requestsStats.completed}</strong></span>
                <span>Конверсия: <strong className="text-blue-600">{requestsStats.completionRate}%</strong></span>
              </p>
            </div>
            <div className="mt-2.5 pt-2 border-t border-blue-500/20 text-[11px] text-slate-500 flex items-center justify-between">
              <span>В работе: <strong>{requestsStats.inProgress}</strong></span>
              <span>Новых / ожидают: <strong>{requestsStats.newRequests}</strong></span>
            </div>
          </CardContent>
        </Card>

        {/* Карточка 3: Регистрации и Верификация */}
        <Card className="rounded-2xl border border-slate-200/60 dark:border-slate-800 shadow-sm bg-gradient-to-br from-purple-500/10 via-purple-500/5 to-transparent">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-purple-700 dark:text-purple-400 uppercase tracking-wider">
                Жильцы в кабинете
              </span>
              <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-600 flex items-center justify-center">
                <Users className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-black text-foreground font-mono">
                {registrationStats.totalRegistered} <span className="text-sm font-normal text-muted-foreground">профилей</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1 flex items-center justify-between">
                <span>За период: <strong>+{registrationStats.periodRegistered}</strong></span>
                <span>Верифицировано: <strong className="text-emerald-600">{registrationStats.verified}</strong></span>
              </p>
            </div>
            <div className="mt-2.5 pt-2 border-t border-purple-500/20 text-[11px] flex items-center justify-between">
              <span className="text-amber-600 dark:text-amber-400">На проверке: <strong>{registrationStats.pendingVerification}</strong></span>
              <span className="text-slate-400">Не верифиц.: <strong>{registrationStats.unverified}</strong></span>
            </div>
          </CardContent>
        </Card>

        {/* Карточка 4: Абонентская база 1С и Дебиторская задолженность */}
        <Card className="rounded-2xl border border-slate-200/60 dark:border-slate-800 shadow-sm bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                База 1С и Долги
              </span>
              <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-600 flex items-center justify-center">
                <FileSpreadsheet className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-black text-foreground font-mono">
                {billingStats.totalAccounts.toLocaleString("ru-RU")} <span className="text-sm font-normal text-muted-foreground">счетов</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1 flex items-center justify-between">
                <span>Общий долг: <strong className="text-destructive font-mono">{billingStats.totalDebt.toLocaleString("ru-RU")} ₽</strong></span>
              </p>
            </div>
            <div className="mt-2.5 pt-2 border-t border-amber-500/20 text-[11px] flex items-center justify-between">
              <span>Должников: <strong className="text-destructive">{billingStats.debtorsCount}</strong></span>
              <span className="text-emerald-600">Переплаты: <strong className="font-mono">{billingStats.totalOverpayment.toLocaleString("ru-RU")} ₽</strong></span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 3. ДЕТАЛЬНЫЕ ВКЛАДКИ ОТЧЁТОВ */}
      <Tabs value={activeReportTab} onValueChange={setActiveReportTab} className="space-y-4">
        <TabsList className="bg-slate-100/80 dark:bg-slate-850 p-1 rounded-2xl flex flex-wrap gap-1 h-auto">
          <TabsTrigger value="finances" className="rounded-xl text-xs font-semibold flex items-center gap-1.5 py-2 px-3.5">
            <CreditCard className="h-4 w-4 text-emerald-600" />
            <span>Финансы и Оплаты ({filteredRequests.filter(r => r.payment_status === "paid").length})</span>
          </TabsTrigger>
          <TabsTrigger value="employees" className="rounded-xl text-xs font-semibold flex items-center gap-1.5 py-2 px-3.5">
            <Users className="h-4 w-4 text-blue-600" />
            <span>Отчётность по сотрудникам ({employeesAnalytics.length})</span>
          </TabsTrigger>
          <TabsTrigger value="orders" className="rounded-xl text-xs font-semibold flex items-center gap-1.5 py-2 px-3.5">
            <ShoppingBag className="h-4 w-4 text-amber-600" />
            <span>Заказы оборудования ({productSalesStats.length})</span>
          </TabsTrigger>
          <TabsTrigger value="registrations" className="rounded-xl text-xs font-semibold flex items-center gap-1.5 py-2 px-3.5">
            <UserCheck className="h-4 w-4 text-purple-600" />
            <span>Регистрации и Верификация ({filteredProfiles.length})</span>
          </TabsTrigger>
          <TabsTrigger value="billing" className="rounded-xl text-xs font-semibold flex items-center gap-1.5 py-2 px-3.5">
            <FileSpreadsheet className="h-4 w-4 text-teal-600" />
            <span>Реестры 1С и Задолженности</span>
          </TabsTrigger>
        </TabsList>

        {/* ======================================================== */}
        {/* ВКЛАДКА 1: ФИНАНСЫ И ОПЛАТЫ */}
        {/* ======================================================== */}
        <TabsContent value="finances" className="mt-0 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="rounded-2xl border border-slate-200/60 dark:border-slate-800 shadow-sm p-4 text-left">
              <span className="text-xs text-muted-foreground font-semibold uppercase">Оплачено Онлайн (Эквайринг)</span>
              <div className="text-xl font-bold font-mono text-emerald-600 mt-1">
                {financialStats.onlineRevenue.toLocaleString("ru-RU")} ₽
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">Банковские карты, ЮKassa, СБП в кабинете</p>
            </Card>

            <Card className="rounded-2xl border border-slate-200/60 dark:border-slate-800 shadow-sm p-4 text-left">
              <span className="text-xs text-muted-foreground font-semibold uppercase">Оплачено Мастеру (Наличные)</span>
              <div className="text-xl font-bold font-mono text-blue-600 mt-1">
                {financialStats.cashRevenue.toLocaleString("ru-RU")} ₽
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">Оплата на объекте при установке оборудования</p>
            </Card>

            <Card className="rounded-2xl border border-slate-200/60 dark:border-slate-800 shadow-sm p-4 text-left">
              <span className="text-xs text-muted-foreground font-semibold uppercase">Ожидает оплаты</span>
              <div className="text-xl font-bold font-mono text-amber-600 mt-1">
                {financialStats.pendingRevenue.toLocaleString("ru-RU")} ₽
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">Сформированные, но ещё не оплаченные счета ({financialStats.pendingOrdersCount} заказов)</p>
            </Card>
          </div>

          <Card className="glass-card rounded-2xl border border-slate-200/60 dark:border-slate-800 shadow-sm">
            <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-850">
              <CardTitle className="text-base font-bold flex items-center justify-between">
                <span>Журнал платёжных транзакций за период</span>
                <Badge variant="outline" className="font-mono text-xs">
                  Всего: {filteredRequests.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="text-xs bg-slate-50/50 dark:bg-slate-850/50">
                      <TableHead className="w-[120px]">№ Заказа</TableHead>
                      <TableHead>Абонент / Телефон</TableHead>
                      <TableHead>Адрес</TableHead>
                      <TableHead>Тип обращения</TableHead>
                      <TableHead>Сумма</TableHead>
                      <TableHead>Способ оплаты</TableHead>
                      <TableHead>Статус оплаты</TableHead>
                      <TableHead>Дата и время</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRequests.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground text-xs">
                          За выбранный период заказов и платежей не найдено.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredRequests.map(req => {
                        const isPaid = req.payment_status === "paid";
                        const amount = Number(req.payment_amount) || 0;

                        return (
                          <TableRow key={req.id} className="text-xs hover:bg-slate-50/80 dark:hover:bg-slate-850/80">
                            <TableCell className="font-mono font-bold text-foreground">
                              #{req.id.slice(0, 8)}
                            </TableCell>
                            <TableCell>
                              <div className="font-semibold text-foreground">{req.name || "Абонент"}</div>
                              <div className="text-[11px] text-muted-foreground font-mono">{req.phone || "—"}</div>
                            </TableCell>
                            <TableCell className="max-w-[220px] truncate" title={req.address || ""}>
                              {req.address || "Адрес не указан"}
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="text-[10px]">
                                {formatOrderType(req.order_type)}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-mono font-bold text-sm">
                              {amount > 0 ? `${amount.toFixed(2)} ₽` : "0.00 ₽"}
                            </TableCell>
                            <TableCell>
                              {req.payment_method === "online" || req.payment_method === "card" ? (
                                <span className="inline-flex items-center gap-1 text-emerald-600 font-medium text-[11px]">
                                  <CreditCard className="h-3 w-3" /> Онлайн (ЮKassa)
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-300 font-medium text-[11px]">
                                  <Banknote className="h-3 w-3 text-amber-500" /> Наличные мастеру
                                </span>
                              )}
                            </TableCell>
                            <TableCell>
                              {isPaid ? (
                                <Badge className="bg-emerald-600 text-white text-[10px] font-semibold">
                                  Оплачено
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-amber-600 border-amber-300 text-[10px]">
                                  В ожидании
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-[11px] whitespace-nowrap">
                              {new Date(req.created_at).toLocaleString("ru-RU")}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ======================================================== */}
        {/* ВКЛАДКА 2: ОТЧЁТНОСТЬ ПО СОТРУДНИКАМ */}
        {/* ======================================================== */}
        <TabsContent value="employees" className="mt-0 space-y-4">
          <Card className="glass-card rounded-2xl border border-slate-200/60 dark:border-slate-800 shadow-sm">
            <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-850">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <Users className="h-5 w-5 text-blue-600" />
                    Эффективность персонала и мастеров
                  </CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    Количество принятых и выполненных заявок, процент закрытия и выручка по каждому сотруднику.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="text-xs bg-slate-50/50 dark:bg-slate-850/50">
                      <TableHead>Сотрудник / Мастер</TableHead>
                      <TableHead>Телефон</TableHead>
                      <TableHead className="text-center">Назначено</TableHead>
                      <TableHead className="text-center">Принято</TableHead>
                      <TableHead className="text-center">Выполнено</TableHead>
                      <TableHead className="text-center">В работе</TableHead>
                      <TableHead className="text-center">Конверсия</TableHead>
                      <TableHead className="text-right">Выручка по заказам</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {employeesAnalytics.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground text-xs">
                          Сотрудники ещё не внесены в систему или не имеют назначенных заявок.
                        </TableCell>
                      </TableRow>
                    ) : (
                      employeesAnalytics.map(emp => (
                        <TableRow key={emp.id} className="text-xs hover:bg-slate-50/80 dark:hover:bg-slate-850/80">
                          <TableCell>
                            <div className="font-bold text-foreground flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-emerald-500" />
                              <span>{emp.fullName}</span>
                            </div>
                            <span className="text-[10px] text-muted-foreground uppercase">{emp.role || "Мастер"}</span>
                          </TableCell>
                          <TableCell className="font-mono text-muted-foreground">
                            {emp.phone || "—"}
                          </TableCell>
                          <TableCell className="text-center font-bold">
                            {emp.totalAssigned}
                          </TableCell>
                          <TableCell className="text-center font-semibold text-blue-600">
                            {emp.acceptedCount}
                          </TableCell>
                          <TableCell className="text-center font-bold text-green-600">
                            {emp.completedCount}
                          </TableCell>
                          <TableCell className="text-center font-semibold text-amber-600">
                            {emp.inProgressCount}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant={emp.completionRate >= 80 ? "default" : "secondary"} className="text-[10px]">
                              {emp.completionRate}%
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono font-bold text-foreground">
                            {emp.earnedRevenue.toLocaleString("ru-RU")} ₽
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Заявки сотрудника */}
          <Card className="glass-card rounded-2xl border border-slate-200/60 dark:border-slate-800 shadow-sm">
            <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-850">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold">
                  Заявки {selectedEmployeeFilter === "all" ? "всех сотрудников" : `выбранного сотрудника`} ({requestsForSelectedEmployee.length})
                </CardTitle>
                {selectedEmployeeFilter !== "all" && (
                  <Button variant="ghost" size="sm" onClick={() => setSelectedEmployeeFilter("all")} className="text-xs h-7">
                    Сбросить фильтр сотрудника
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="text-xs bg-slate-50/50 dark:bg-slate-850/50">
                      <TableHead>№ Заказа</TableHead>
                      <TableHead>Клиент</TableHead>
                      <TableHead>Адрес</TableHead>
                      <TableHead>Тип работы</TableHead>
                      <TableHead>Исполнитель / Принял</TableHead>
                      <TableHead>Статус</TableHead>
                      <TableHead>Дата</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {requestsForSelectedEmployee.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-6 text-muted-foreground text-xs">
                          Заявок не найдено.
                        </TableCell>
                      </TableRow>
                    ) : (
                      requestsForSelectedEmployee.map(req => (
                        <TableRow key={req.id} className="text-xs">
                          <TableCell className="font-mono font-bold">#{req.id.slice(0, 8)}</TableCell>
                          <TableCell>
                            <div className="font-semibold">{req.name || "Клиент"}</div>
                            <div className="text-[10px] text-muted-foreground font-mono">{req.phone}</div>
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate" title={req.address || ""}>{req.address || "—"}</TableCell>
                          <TableCell>{formatOrderType(req.order_type)}</TableCell>
                          <TableCell>
                            <span className="font-medium text-blue-600 dark:text-blue-400">
                              {req.accepted_employee?.full_name || req.assigned_employee?.full_name || req.notes || "Не назначен"}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge variant={req.status === "completed" ? "default" : req.status === "in_progress" ? "secondary" : "outline"} className="text-[10px]">
                              {req.status === "completed" ? "Выполнено" : req.status === "in_progress" ? "В работе" : "Новый"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-[11px] whitespace-nowrap">
                            {new Date(req.created_at).toLocaleDateString("ru-RU")}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ======================================================== */}
        {/* ВКЛАДКА 3: ЗАКАЗЫ И ПРОДАЖИ ОБОРУДОВАНИЯ */}
        {/* ======================================================== */}
        <TabsContent value="orders" className="mt-0 space-y-4">
          <Card className="glass-card rounded-2xl border border-slate-200/60 dark:border-slate-800 shadow-sm">
            <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-850">
              <CardTitle className="text-base font-bold flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="h-5 w-5 text-amber-600" />
                  <span>Статистика реализации оборудования и материалов</span>
                </div>
                <Badge variant="outline" className="text-xs">
                  Позиций в отчёте: {productSalesStats.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="text-xs bg-slate-50/50 dark:bg-slate-850/50">
                      <TableHead>Наименование товара / услуги</TableHead>
                      <TableHead>Категория</TableHead>
                      <TableHead className="text-center">Продано</TableHead>
                      <TableHead className="text-center">Ед. изм.</TableHead>
                      <TableHead className="text-right">Суммарная выручка</TableHead>
                      <TableHead className="text-right">Доля в продажах</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {productSalesStats.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground text-xs">
                          За выбранный период продаж оборудования не зафиксировано.
                        </TableCell>
                      </TableRow>
                    ) : (
                      productSalesStats.map((item, idx) => {
                        const totalProductsSum = productSalesStats.reduce((sum, i) => sum + i.totalSum, 0);
                        const sharePercent = totalProductsSum > 0 ? Math.round((item.totalSum / totalProductsSum) * 100) : 0;

                        return (
                          <TableRow key={idx} className="text-xs hover:bg-slate-50/80 dark:hover:bg-slate-850/80">
                            <TableCell className="font-semibold text-foreground">
                              {item.name}
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="text-[10px]">
                                {item.category}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center font-bold font-mono text-sm">
                              {item.totalQuantity}
                            </TableCell>
                            <TableCell className="text-center text-muted-foreground">
                              {item.unit}
                            </TableCell>
                            <TableCell className="text-right font-mono font-bold text-sm text-foreground">
                              {item.totalSum.toLocaleString("ru-RU")} ₽
                            </TableCell>
                            <TableCell className="text-right">
                              <span className="font-semibold text-emerald-600">{sharePercent}%</span>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ======================================================== */}
        {/* ВКЛАДКА 4: РЕГИСТРАЦИИ И ВЕРИФИКАЦИЯ */}
        {/* ======================================================== */}
        <TabsContent value="registrations" className="mt-0 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-left">
              <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 block">Верифицировано</span>
              <span className="text-2xl font-bold font-mono text-emerald-600 mt-1 block">{registrationStats.verified}</span>
              <span className="text-[11px] text-muted-foreground">Подтверждённые собственники</span>
            </div>
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-left">
              <span className="text-xs font-semibold text-amber-800 dark:text-amber-300 block">На проверке</span>
              <span className="text-2xl font-bold font-mono text-amber-600 mt-1 block">{registrationStats.pendingVerification}</span>
              <span className="text-[11px] text-muted-foreground">Ожидают решения диспетчера</span>
            </div>
            <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-left">
              <span className="text-xs font-semibold text-red-800 dark:text-red-300 block">Отклонено</span>
              <span className="text-2xl font-bold font-mono text-red-600 mt-1 block">{registrationStats.rejectedVerification}</span>
              <span className="text-[11px] text-muted-foreground">Некорректные документы</span>
            </div>
            <div className="p-4 rounded-2xl bg-slate-500/10 border border-slate-500/20 text-left">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">Не верифицировано</span>
              <span className="text-2xl font-bold font-mono text-foreground mt-1 block">{registrationStats.unverified}</span>
              <span className="text-[11px] text-muted-foreground">Без подтверждающих док-ов</span>
            </div>
          </div>

          <Card className="glass-card rounded-2xl border border-slate-200/60 dark:border-slate-800 shadow-sm">
            <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-850">
              <CardTitle className="text-base font-bold flex items-center justify-between">
                <span>Список зарегистрированных пользователей за период</span>
                <Badge variant="outline" className="font-mono text-xs">
                  {filteredProfiles.length} абонентов
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="text-xs bg-slate-50/50 dark:bg-slate-850/50">
                      <TableHead>ФИО жильца</TableHead>
                      <TableHead>Контактный телефон</TableHead>
                      <TableHead>Адрес подключения</TableHead>
                      <TableHead>Квартира</TableHead>
                      <TableHead>Статус верификации</TableHead>
                      <TableHead>Дата регистрации</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProfiles.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground text-xs">
                          За выбранный период регистраций пользователей не было.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredProfiles.map(p => (
                        <TableRow key={p.id} className="text-xs hover:bg-slate-50/80 dark:hover:bg-slate-850/80">
                          <TableCell className="font-semibold text-foreground">
                            {p.full_name || "Не заполнено"}
                          </TableCell>
                          <TableCell className="font-mono">
                            {p.phone || "—"}
                          </TableCell>
                          <TableCell className="max-w-[220px] truncate" title={p.address || ""}>
                            {p.address || "Адрес не указан"}
                          </TableCell>
                          <TableCell className="font-mono font-bold">
                            {p.apartment ? `кв. ${p.apartment}` : "—"}
                          </TableCell>
                          <TableCell>
                            {p.verification_status === "verified" ? (
                              <Badge className="bg-emerald-600 text-white text-[10px]">Верифицирован</Badge>
                            ) : p.verification_status === "pending" ? (
                              <Badge className="bg-amber-500 text-white text-[10px]">На проверке</Badge>
                            ) : p.verification_status === "rejected" ? (
                              <Badge variant="destructive" className="text-[10px]">Отклонен</Badge>
                            ) : (
                              <Badge variant="outline" className="text-slate-500 text-[10px]">Не верифицирован</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-[11px] whitespace-nowrap">
                            {new Date(p.created_at).toLocaleDateString("ru-RU")}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ======================================================== */}
        {/* ВКЛАДКА 5: РЕЕСТРЫ 1С И ЗАДОЛЖЕННОСТИ */}
        {/* ======================================================== */}
        <TabsContent value="billing" className="mt-0 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Распределение по тарифам */}
            <Card className="glass-card rounded-2xl border border-slate-200/60 dark:border-slate-800 shadow-sm">
              <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-850">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Layers className="h-4 w-4 text-emerald-600" />
                  Распределение абонентов по тарифам обслуживания (1С)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-2.5">
                {Object.entries(billingStats.tariffCounts).map(([tariff, count]) => {
                  const percent = billingStats.totalAccounts > 0 ? Math.round((count / billingStats.totalAccounts) * 100) : 0;
                  return (
                    <div key={tariff} className="flex items-center justify-between text-xs p-2 rounded-xl bg-slate-50/60 dark:bg-slate-850/60 border border-slate-100 dark:border-slate-800">
                      <span className="font-semibold text-foreground">{tariff}</span>
                      <div className="flex items-center gap-2 font-mono">
                        <span>{count.toLocaleString("ru-RU")} счетов</span>
                        <Badge variant="secondary" className="text-[10px]">{percent}%</Badge>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* Топ-10 домов по сумме задолженности */}
            <Card className="glass-card rounded-2xl border border-slate-200/60 dark:border-slate-800 shadow-sm">
              <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-850">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-destructive" />
                  Топ домов по сумме задолженности
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-2">
                {billingStats.topDebtorHouses.map((h, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs p-2 rounded-xl bg-red-50/30 dark:bg-red-950/20 border border-red-200/50 dark:border-red-900/30">
                    <div className="truncate max-w-[220px]">
                      <span className="font-bold text-foreground block truncate">{h.address}</span>
                      <span className="text-[10px] text-muted-foreground">{h.count} абонентов</span>
                    </div>
                    <span className="font-mono font-bold text-destructive text-sm whitespace-nowrap">
                      {h.debt.toFixed(2)} ₽
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default FSMReports;
