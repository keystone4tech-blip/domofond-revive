// src/components/crm/CRMDashboard.tsx
// Аналитический дашборд CRM / FSM с комплексным финансовым модулем (ТО, заказы, онлайн-платежи)
// Включает учет ЮKassa (СБП, Карты, SberPay), абонентской платы по лицевым счетам и нарядов мастеров

import { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, 
  CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell, BarChart, Bar 
} from "recharts";
import { 
  ClipboardList, CheckCircle2, Clock, AlertTriangle, Users, 
  Building2, Loader2, FileText, Banknote, HandMetal, XCircle, 
  ArrowUpRight, Calendar, Search, Award, ShieldAlert, Zap, History,
  CreditCard, Filter, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  TrendingUp, RefreshCw, X, Receipt, Smartphone, Check, ExternalLink,
  Layers, ShoppingBag, Wrench, ShieldCheck, ArrowDownRight, Wallet
} from "lucide-react";
import { 
  format, differenceInMinutes, parseISO, subDays, 
  startOfMonth, endOfMonth, eachDayOfInterval 
} from "date-fns";
import { ru } from "date-fns/locale";

// Пропсы для дашборда аналитики CRM
export interface CRMDashboardProps {
  isManager: boolean;
  onNavigate?: (tab: string, filter?: string, id?: string) => void;
}

export type FSMDashboardProps = CRMDashboardProps;

// Периоды аналитики
type AnalyticsPeriod = "current_month" | "last_month" | "30_days" | "90_days" | "all";

// Типы операций в едином реестре платежей
export type PaymentItemType = "maintenance" | "order" | "request";
export type PaymentItemStatus = "succeeded" | "pending" | "canceled";
export type PaymentItemMethod = "bank_card" | "sbp" | "sberbank" | "cash" | "online";

// Единая унифицированная запись финансовой операции
export interface UnifiedPaymentItem {
  id: string;
  source: "payment_gateway" | "request_cash";
  type: PaymentItemType;
  typeLabel: string;
  accountNumber?: string;
  clientName: string;
  address: string;
  phone?: string;
  method: PaymentItemMethod;
  methodLabel: string;
  status: PaymentItemStatus;
  statusLabel: string;
  amount: number;
  createdAt: string;
  description?: string;
  transactionId?: string;
  requestId?: string;
}

export const CRMDashboard = ({ isManager, onNavigate }: CRMDashboardProps) => {
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState<AnalyticsPeriod>("30_days");

  // Состояния фильтров и поиска в модуле финансов
  const [paymentSearchTerm, setPaymentSearchTerm] = useState("");
  const [paymentTypeFilter, setPaymentTypeFilter] = useState<"all" | PaymentItemType>("all");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<"all" | PaymentItemStatus>("all");
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<"all" | PaymentItemMethod>("all");
  const [paymentPage, setPaymentPage] = useState(1);
  const [paymentPageSize, setPaymentPageSize] = useState(10);

  // Запрос сырых данных для аналитики (с фоновым опросом и прямым подключением платежей ЮKassa)
  const { data: rawData, isLoading } = useQuery({
    queryKey: ["crm-dashboard-raw-data"],
    queryFn: async () => {
      console.log("[CRMDashboard] Фоновая загрузка данных аналитики CRM и реестра платежей...");
      
      // Запрашиваем задачи, заявки, сотрудников, профили и все транзакции платежей
      const [tasksRes, requestsRes, employeesRes, profilesRes, paymentsRes] = await Promise.all([
        supabase.from("tasks").select("*").order("created_at", { ascending: false }),
        supabase.from("requests").select("*").order("created_at", { ascending: false }),
        supabase.from("employees").select("*"),
        supabase.from("profiles").select("id, full_name"),
        (supabase.from as any)("payments").select("*").order("created_at", { ascending: false })
      ]);

      if (tasksRes.error) throw tasksRes.error;
      if (requestsRes.error) throw requestsRes.error;
      if (employeesRes.error) throw employeesRes.error;
      if (profilesRes.error) throw profilesRes.error;

      const rawPayments = paymentsRes?.data || [];
      console.log(`[CRMDashboard] Загружено платежей из БД: ${rawPayments.length} записей`);

      // Извлекаем уникальные номера лицевых счетов для быстрого точечного запроса
      const accNumbers = Array.from(
        new Set(rawPayments.map((p: any) => p.account_number).filter(Boolean))
      ) as string[];

      let relatedAccounts: any[] = [];
      if (accNumbers.length > 0) {
        // Запрашиваем только аккаунты, фигурирующие в платежах (быстро, < 15 мс)
        const accRes = await supabase
          .from("accounts")
          .select("account_number, full_name, address, apartment, phone, debt_amount, tariff_name, tariff_price")
          .in("account_number", accNumbers);
        if (accRes.data) {
          relatedAccounts = accRes.data;
        }
      }

      return {
        tasks: tasksRes.data || [],
        requests: requestsRes.data || [],
        employees: employeesRes.data || [],
        profiles: profilesRes.data || [],
        payments: rawPayments,
        relatedAccounts
      };
    },
    staleTime: 3 * 60 * 1000, // 3 минуты мгновенно из памяти при смене табов
    refetchInterval: 25 * 1000, // Каждые 25 сек тихое фоновое обновление для режима онлайн
  });

  // Кросс-таб синхронизация событий между открытыми вкладками браузера
  useEffect(() => {
    const handleSync = (e: StorageEvent) => {
      if (e.key === "verification_last_update" || e.key === "crm_data_sync" || e.key === "payment_last_update") {
        console.log("[CRMDashboard] Получен кросс-таб сигнал синхронизации данных, инвалидация кэша...");
        queryClient.invalidateQueries({ queryKey: ["crm-dashboard-raw-data"] });
      }
    };
    window.addEventListener("storage", handleSync);
    return () => {
      window.removeEventListener("storage", handleSync);
    };
  }, [queryClient]);

  // Фильтрация данных по выбранному периоду
  const filterByPeriod = (dateStr: string | null) => {
    if (!dateStr) return false;
    const date = new Date(dateStr);
    const now = new Date();
    
    switch (period) {
      case "current_month":
        return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
      case "last_month": {
        const lastMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
        const lastMonthYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
        return date.getMonth() === lastMonth && date.getFullYear() === lastMonthYear;
      }
      case "30_days": {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(now.getDate() - 30);
        return date >= thirtyDaysAgo;
      }
      case "90_days": {
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(now.getDate() - 90);
        return date >= ninetyDaysAgo;
      }
      case "all":
      default:
        return true;
    }
  };

  // Вычисляемые данные комплексной аналитики
  const analytics = useMemo(() => {
    if (!rawData) return null;

    const filteredTasks = rawData.tasks.filter(t => filterByPeriod(t.created_at));
    const filteredRequests = rawData.requests.filter(r => filterByPeriod(r.created_at));

    // 1. Создаем индекс лицевых счетов для быстрого поиска O(1)
    const accountMap = new Map<string, any>();
    (rawData.relatedAccounts || []).forEach((acc: any) => {
      if (acc.account_number) accountMap.set(acc.account_number, acc);
    });

    // 2. Унификация всех транзакций платежей (ЮKassa + закрытые заявки с оплатой)
    const allTransactions: UnifiedPaymentItem[] = [];

    // Платежи из таблицы payments (ЮKassa / СБП / Карты / Сбер)
    (rawData.payments || []).forEach((p: any) => {
      const acc = p.account_number ? accountMap.get(p.account_number) : null;
      
      let meta: any = {};
      try {
        meta = typeof p.metadata === "string" ? JSON.parse(p.metadata) : (p.metadata || {});
      } catch (err) {
        meta = {};
      }

      const isOrder = meta.is_order === true || meta.is_order === "true" || meta.order_type === "equipment_order";
      const isRequest = !isOrder && Boolean(p.request_id);

      let type: PaymentItemType = "maintenance";
      let typeLabel = "Абонентская плата (ТО)";
      if (isOrder) {
        type = "order";
        typeLabel = "Заказ оборудования";
      } else if (isRequest) {
        type = "request";
        typeLabel = "Платная заявка";
      }

      let method: PaymentItemMethod = "online";
      let methodLabel = "Онлайн-эквайринг";
      if (p.payment_method === "sbp") {
        method = "sbp";
        methodLabel = "СБП";
      } else if (p.payment_method === "bank_card") {
        method = "bank_card";
        methodLabel = "Банковская карта";
      } else if (p.payment_method === "sberbank") {
        method = "sberbank";
        methodLabel = "SberPay";
      }

      let status: PaymentItemStatus = "pending";
      let statusLabel = "Ожидает";
      if (p.status === "succeeded") {
        status = "succeeded";
        statusLabel = "Оплачено";
      } else if (p.status === "canceled") {
        status = "canceled";
        statusLabel = "Отменено";
      }

      // Определяем имя плательщика
      let clientName = meta.full_name || meta.client_name || acc?.full_name || (p.account_number ? `Абонент л/с ${p.account_number}` : "Плательщик");
      
      // Определяем адрес
      let address = meta.address || "";
      if (!address && acc) {
        address = `${acc.address || ""}${acc.apartment ? `, кв. ${acc.apartment}` : ""}`;
      }
      if (!address && p.description) {
        address = p.description;
      }

      allTransactions.push({
        id: p.id,
        source: "payment_gateway",
        type,
        typeLabel,
        accountNumber: p.account_number || acc?.account_number || "",
        clientName,
        address: address || "Адрес не указан",
        phone: meta.phone || acc?.phone || "",
        method,
        methodLabel,
        status,
        statusLabel,
        amount: Number(p.amount) || 0,
        createdAt: p.created_at,
        description: p.description || "",
        transactionId: p.yookassa_payment_id || p.id,
        requestId: p.request_id || undefined,
      });
    });

    // Добавляем платные закрытые заявки мастеров (наличные мастеру или оформленные без шлюза)
    const existingReqIds = new Set((rawData.payments || []).map((p: any) => p.request_id).filter(Boolean));
    filteredRequests.forEach(r => {
      const amt = Number(r.payment_amount) || 0;
      if (amt <= 0) return;
      if (existingReqIds.has(r.id)) return; // Уже учтен через payments

      const isCash = r.payment_method !== "online";
      const isPaid = r.payment_status === "paid";

      allTransactions.push({
        id: `req-${r.id}`,
        source: "request_cash",
        type: "request",
        typeLabel: "Платная заявка",
        accountNumber: "",
        clientName: r.name || "Клиент",
        address: r.address || "Адрес не указан",
        phone: r.phone || "",
        method: isCash ? "cash" : "online",
        methodLabel: isCash ? "Наличные мастеру" : "Онлайн-оплата",
        status: isPaid ? "succeeded" : "pending",
        statusLabel: isPaid ? "Оплачено" : "Ожидает",
        amount: amt,
        createdAt: r.completed_at || r.created_at,
        description: r.message || `Вызов мастера #${r.id.substring(0, 8)}`,
        transactionId: r.id,
        requestId: r.id,
      });
    });

    // 3. Фильтрация транзакций по выбранному периоду
    const periodTransactions = allTransactions.filter(t => filterByPeriod(t.createdAt));

    // 4. Подсчет финансовых показателей
    let totalRevenue = 0;
    let maintenanceRevenue = 0;
    let servicesRevenue = 0;
    let orderRevenue = 0;
    let requestRevenue = 0;

    let cardRevenue = 0;
    let sbpRevenue = 0;
    let sberRevenue = 0;
    let cashRevenue = 0;
    let onlineRevenue = 0;

    let pendingPayments = 0;
    let canceledPayments = 0;
    let succeededCount = 0;
    let maintenanceCount = 0;
    let servicesCount = 0;

    periodTransactions.forEach(t => {
      if (t.status === "succeeded") {
        totalRevenue += t.amount;
        succeededCount++;

        if (t.type === "maintenance") {
          maintenanceRevenue += t.amount;
          maintenanceCount++;
        } else {
          servicesRevenue += t.amount;
          servicesCount++;
          if (t.type === "order") orderRevenue += t.amount;
          else requestRevenue += t.amount;
        }

        if (t.method === "bank_card") {
          cardRevenue += t.amount;
          onlineRevenue += t.amount;
        } else if (t.method === "sbp") {
          sbpRevenue += t.amount;
          onlineRevenue += t.amount;
        } else if (t.method === "sberbank") {
          sberRevenue += t.amount;
          onlineRevenue += t.amount;
        } else if (t.method === "cash") {
          cashRevenue += t.amount;
        } else {
          onlineRevenue += t.amount;
        }
      } else if (t.status === "pending") {
        pendingPayments += t.amount;
      } else if (t.status === "canceled") {
        canceledPayments += t.amount;
      }
    });

    const avgCheck = succeededCount > 0 ? Math.round(totalRevenue / succeededCount) : 0;

    // 5. Расчет динамики выполнения задач
    const dynamicsData = Array.from({ length: 7 }).map((_, idx) => {
      const d = subDays(new Date(), idx);
      const dateStr = format(d, "yyyy-MM-dd");
      const label = format(d, "dd MMM", { locale: ru });

      const dayTasks = filteredTasks.filter(t => format(new Date(t.created_at), "yyyy-MM-dd") === dateStr);
      const dayReqs = filteredRequests.filter(r => format(new Date(r.created_at), "yyyy-MM-dd") === dateStr);
      
      const dayCompletedTasks = filteredTasks.filter(t => t.status === "completed" && t.completed_at && format(new Date(t.completed_at), "yyyy-MM-dd") === dateStr);
      const dayCompletedReqs = filteredRequests.filter(r => r.status === "completed" && r.completed_at && format(new Date(r.completed_at), "yyyy-MM-dd") === dateStr);

      return {
        name: label,
        "Поступило заявок": dayReqs.length + dayTasks.length,
        "Выполнено": dayCompletedReqs.length + dayCompletedTasks.length
      };
    }).reverse();

    // 6. Подготовка точек графика динамики выручки (с разбивкой: Абонплата ТО vs Заказы и услуги)
    let financeGraphData: Array<{
      name: string;
      dateKey: string;
      "Абонплата ТО (₽)": number;
      "Заказы и услуги (₽)": number;
      "Выручка (₽)": number;
    }> = [];

    const now = new Date();
    if (period === "current_month") {
      const start = startOfMonth(now);
      const days = eachDayOfInterval({ start, end: now });
      financeGraphData = days.map(d => {
        const dateStr = format(d, "yyyy-MM-dd");
        const label = format(d, "d MMM", { locale: ru });
        const dayTx = periodTransactions.filter(t => t.status === "succeeded" && format(new Date(t.createdAt), "yyyy-MM-dd") === dateStr);
        const maintenance = dayTx.filter(t => t.type === "maintenance").reduce((s, t) => s + t.amount, 0);
        const services = dayTx.filter(t => t.type !== "maintenance").reduce((s, t) => s + t.amount, 0);
        return {
          name: label,
          dateKey: dateStr,
          "Абонплата ТО (₽)": maintenance,
          "Заказы и услуги (₽)": services,
          "Выручка (₽)": maintenance + services
        };
      });
    } else if (period === "last_month") {
      const prevMonthDate = subDays(startOfMonth(now), 1);
      const start = startOfMonth(prevMonthDate);
      const end = endOfMonth(prevMonthDate);
      const days = eachDayOfInterval({ start, end });
      financeGraphData = days.map(d => {
        const dateStr = format(d, "yyyy-MM-dd");
        const label = format(d, "d MMM", { locale: ru });
        const dayTx = periodTransactions.filter(t => t.status === "succeeded" && format(new Date(t.createdAt), "yyyy-MM-dd") === dateStr);
        const maintenance = dayTx.filter(t => t.type === "maintenance").reduce((s, t) => s + t.amount, 0);
        const services = dayTx.filter(t => t.type !== "maintenance").reduce((s, t) => s + t.amount, 0);
        return {
          name: label,
          dateKey: dateStr,
          "Абонплата ТО (₽)": maintenance,
          "Заказы и услуги (₽)": services,
          "Выручка (₽)": maintenance + services
        };
      });
    } else if (period === "30_days") {
      financeGraphData = Array.from({ length: 30 }).map((_, idx) => {
        const d = subDays(now, 29 - idx);
        const dateStr = format(d, "yyyy-MM-dd");
        const label = format(d, "d MMM", { locale: ru });
        const dayTx = periodTransactions.filter(t => t.status === "succeeded" && format(new Date(t.createdAt), "yyyy-MM-dd") === dateStr);
        const maintenance = dayTx.filter(t => t.type === "maintenance").reduce((s, t) => s + t.amount, 0);
        const services = dayTx.filter(t => t.type !== "maintenance").reduce((s, t) => s + t.amount, 0);
        return {
          name: label,
          dateKey: dateStr,
          "Абонплата ТО (₽)": maintenance,
          "Заказы и услуги (₽)": services,
          "Выручка (₽)": maintenance + services
        };
      });
    } else if (period === "90_days") {
      financeGraphData = Array.from({ length: 30 }).map((_, idx) => {
        const d = subDays(now, (29 - idx) * 3);
        const dateStr = format(d, "yyyy-MM-dd");
        const label = format(d, "d MMM", { locale: ru });
        const dStart = subDays(d, 2);
        const dayTx = periodTransactions.filter(t => {
          if (t.status !== "succeeded") return false;
          const txDate = new Date(t.createdAt);
          return txDate >= dStart && txDate <= d;
        });
        const maintenance = dayTx.filter(t => t.type === "maintenance").reduce((s, t) => s + t.amount, 0);
        const services = dayTx.filter(t => t.type !== "maintenance").reduce((s, t) => s + t.amount, 0);
        return {
          name: label,
          dateKey: dateStr,
          "Абонплата ТО (₽)": maintenance,
          "Заказы и услуги (₽)": services,
          "Выручка (₽)": maintenance + services
        };
      });
    } else {
      // all: берем срез последних 30 точек
      financeGraphData = Array.from({ length: 30 }).map((_, idx) => {
        const d = subDays(now, (29 - idx) * 2);
        const dateStr = format(d, "yyyy-MM-dd");
        const label = format(d, "d MMM", { locale: ru });
        const dStart = subDays(d, 1);
        const dayTx = periodTransactions.filter(t => {
          if (t.status !== "succeeded") return false;
          const txDate = new Date(t.createdAt);
          return txDate >= dStart && txDate <= d;
        });
        const maintenance = dayTx.filter(t => t.type === "maintenance").reduce((s, t) => s + t.amount, 0);
        const services = dayTx.filter(t => t.type !== "maintenance").reduce((s, t) => s + t.amount, 0);
        return {
          name: label,
          dateKey: dateStr,
          "Абонплата ТО (₽)": maintenance,
          "Заказы и услуги (₽)": services,
          "Выручка (₽)": maintenance + services
        };
      });
    }

    // 7. Расчет KPI по Мастерам
    const masterStats = rawData.employees.map(emp => {
      const empTasks = filteredTasks.filter(t => t.assigned_to === emp.id || t.accepted_by === emp.id);
      const empRequests = filteredRequests.filter(r => r.assigned_to === emp.id || r.accepted_by === emp.id);

      const completedTasks = empTasks.filter(t => t.status === "completed").length;
      const completedRequests = empRequests.filter(r => r.status === "completed").length;
      
      const totalAssigned = empTasks.length + empRequests.length;
      const totalCompleted = completedTasks + completedRequests;

      const cashCollected = empRequests
        .filter(r => r.status === "completed" && r.payment_status === "paid")
        .reduce((sum, r) => sum + (Number(r.payment_amount) || 0), 0);

      let totalMinutes = 0;
      let ratedCount = 0;
      empTasks.concat(empRequests as any[]).forEach(item => {
        if (item.status === "completed" && item.completed_at && item.accepted_at) {
          const diff = differenceInMinutes(new Date(item.completed_at), new Date(item.accepted_at));
          if (diff > 0) {
            totalMinutes += diff;
            ratedCount++;
          }
        }
      });

      const avgTimeMinutes = ratedCount > 0 ? Math.round(totalMinutes / ratedCount) : 0;
      const successRate = totalAssigned > 0 ? Math.round((totalCompleted / totalAssigned) * 100) : 0;

      return {
        id: emp.id,
        name: emp.full_name,
        position: emp.position || "Мастер",
        isActive: emp.is_active,
        assigned: totalAssigned,
        completed: totalCompleted,
        successRate,
        cashCollected,
        avgTimeMinutes
      };
    }).sort((a, b) => b.completed - a.completed);

    // 8. Расчет KPI по Диспетчерам
    const dispatcherMap = new Map<string, { name: string; created: number; completed: number }>();
    filteredTasks.forEach(task => {
      const creatorId = task.assigned_by;
      if (creatorId) {
        const profile = rawData.profiles.find(p => p.id === creatorId);
        const name = profile?.full_name || `Сотрудник ${creatorId.substring(0, 4)}`;
        if (!dispatcherMap.has(creatorId)) {
          dispatcherMap.set(creatorId, { name, created: 0, completed: 0 });
        }
        const record = dispatcherMap.get(creatorId)!;
        record.created += 1;
        if (task.status === "completed") {
          record.completed += 1;
        }
      }
    });

    const dispatcherStats = Array.from(dispatcherMap.entries()).map(([id, val]) => ({
      id,
      name: val.name,
      created: val.created,
      completed: val.completed,
      successRate: val.created > 0 ? Math.round((val.completed / val.created) * 100) : 0
    })).sort((a, b) => b.created - a.created);

    // Срочные активные заявки
    const urgentRequests = filteredRequests.filter(r => r.priority === "urgent" && (r.status === "pending" || r.status === "in_progress"));

    // Статистика приоритетов
    const priorityData = [
      { name: "Срочно", value: filteredTasks.filter(t => t.priority === "urgent").length + filteredRequests.filter(r => r.priority === "urgent").length, color: "#ef4444" },
      { name: "Высокий", value: filteredTasks.filter(t => t.priority === "high").length + filteredRequests.filter(r => r.priority === "high").length, color: "#f97316" },
      { name: "Средний", value: filteredTasks.filter(t => t.priority === "medium").length + filteredRequests.filter(r => r.priority === "medium").length, color: "#3b82f6" },
      { name: "Низкий", value: filteredTasks.filter(t => t.priority === "low").length + filteredRequests.filter(r => r.priority === "low").length, color: "#94a3b8" },
    ].filter(item => item.value > 0);

    return {
      totalTasks: filteredTasks.length,
      completedTasks: filteredTasks.filter(t => t.status === "completed").length,
      inProgressTasks: filteredTasks.filter(t => t.status === "in_progress").length,
      pendingTasks: filteredTasks.filter(t => t.status === "pending" || t.status === "assigned").length,
      cancelledTasks: filteredTasks.filter(t => t.status === "cancelled").length,
      
      totalRequests: filteredRequests.length,
      completedRequests: filteredRequests.filter(r => r.status === "completed").length,
      inProgressRequests: filteredRequests.filter(r => r.status === "in_progress").length,
      pendingRequests: filteredRequests.filter(r => r.status === "pending").length,
      cancelledRequests: filteredRequests.filter(r => r.status === "cancelled").length,

      // Финансовая аналитика
      totalRevenue,
      maintenanceRevenue,
      servicesRevenue,
      orderRevenue,
      requestRevenue,
      cardRevenue,
      sbpRevenue,
      sberRevenue,
      cashRevenue,
      onlineRevenue,
      pendingPayments,
      canceledPayments,
      succeededCount,
      maintenanceCount,
      servicesCount,
      avgCheck,
      financeGraphData,
      allTransactions: periodTransactions,

      urgentRequests,
      priorityData,
      dynamicsData,
      masterStats,
      dispatcherStats,
      allRequests: filteredRequests
    };
  }, [rawData, period]);

  // Фильтрация и поиск по реестру платежей
  const filteredPayments = useMemo(() => {
    if (!analytics?.allTransactions) return [];

    return analytics.allTransactions.filter(item => {
      // Фильтр по типу операции
      if (paymentTypeFilter !== "all" && item.type !== paymentTypeFilter) {
        return false;
      }
      // Фильтр по статусу платежа
      if (paymentStatusFilter !== "all" && item.status !== paymentStatusFilter) {
        return false;
      }
      // Фильтр по способу оплаты
      if (paymentMethodFilter !== "all" && item.method !== paymentMethodFilter) {
        return false;
      }
      // Текстовый поиск
      if (paymentSearchTerm.trim()) {
        const query = paymentSearchTerm.trim().toLowerCase();
        const inAcc = item.accountNumber?.toLowerCase().includes(query);
        const inName = item.clientName?.toLowerCase().includes(query);
        const inAddr = item.address?.toLowerCase().includes(query);
        const inPhone = item.phone?.toLowerCase().includes(query);
        const inDesc = item.description?.toLowerCase().includes(query);
        const inTx = item.transactionId?.toLowerCase().includes(query);
        const inAmt = item.amount.toString().includes(query);

        if (!inAcc && !inName && !inAddr && !inPhone && !inDesc && !inTx && !inAmt) {
          return false;
        }
      }
      return true;
    });
  }, [analytics?.allTransactions, paymentTypeFilter, paymentStatusFilter, paymentMethodFilter, paymentSearchTerm]);

  // Пагинация таблицы платежей
  const totalPaymentPages = Math.ceil(filteredPayments.length / paymentPageSize) || 1;
  const paginatedPayments = useMemo(() => {
    const startIndex = (paymentPage - 1) * paymentPageSize;
    return filteredPayments.slice(startIndex, startIndex + paymentPageSize);
  }, [filteredPayments, paymentPage, paymentPageSize]);

  // Сброс страницы при изменении фильтров или поиска
  useEffect(() => {
    setPaymentPage(1);
  }, [paymentTypeFilter, paymentStatusFilter, paymentMethodFilter, paymentSearchTerm, paymentPageSize]);

  // Взаимодействие при переходе к конкретной задаче или заявке
  const handleItemClick = (type: "requests" | "tasks", status: string, id: string) => {
    console.log(`[CRMDashboard] Переход к объекту: ${type}, статус: ${status}, ID: ${id}`);
    if (onNavigate) {
      onNavigate(type, status, id);
    }
  };

  // Взаимодействие при переходе к лицевому счету
  const handleAccountClick = (accNumber?: string) => {
    if (!accNumber) return;
    console.log(`[CRMDashboard] Переход к лицевому счету: ${accNumber}`);
    if (onNavigate) {
      onNavigate("accounts", accNumber);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-muted-foreground text-sm font-semibold">Загрузка аналитического дашборда и платежей...</p>
      </div>
    );
  }

  if (!analytics) return null;

  return (
    <div className="space-y-6 w-full overflow-x-hidden min-w-0">
      {/* Шапка дашборда и выбор периода аналитики */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md p-3 sm:p-4 rounded-2xl border border-slate-200/50 dark:border-slate-800/50">
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary animate-pulse" />
            Аналитика FSM (Режим Онлайн)
          </h2>
          <p className="text-xs text-muted-foreground">
            Полноэкранный контроль процессов, платежей и абонентской платы ТО
          </p>
        </div>
        
        {/* Выбор периода анализа */}
        <div className="flex items-center gap-2 flex-wrap">
          <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="flex flex-wrap gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl text-xs font-semibold">
            {[
              { id: "current_month", label: "Месяц" },
              { id: "last_month", label: "Прошлый" },
              { id: "30_days", label: "30 дн" },
              { id: "90_days", label: "90 дн" },
              { id: "all", label: "Все" }
            ].map(item => (
              <button
                key={item.id}
                onClick={() => setPeriod(item.id as AnalyticsPeriod)}
                className={`px-2.5 py-1.5 rounded-lg transition-all whitespace-nowrap ${
                  period === item.id 
                    ? "bg-white dark:bg-slate-700 text-foreground shadow-sm scale-105 font-bold" 
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Вкладки аналитики */}
      <Tabs defaultValue="overview" className="w-full space-y-4">
        {/* Список вкладок — адаптивный грид на 4 колонки */}
        <TabsList className="bg-slate-100 dark:bg-slate-800/60 p-1 rounded-xl w-full grid grid-cols-4 gap-1">
          <TabsTrigger value="overview" className="rounded-lg text-xs font-bold flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5" />
            Обзор
          </TabsTrigger>
          <TabsTrigger value="masters" className="rounded-lg text-xs font-bold flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" />
            Мастера
          </TabsTrigger>
          <TabsTrigger value="dispatchers" className="rounded-lg text-xs font-bold flex items-center gap-1.5">
            <Award className="h-3.5 w-3.5" />
            Диспетчеры
          </TabsTrigger>
          <TabsTrigger value="finance" className="rounded-lg text-xs font-bold flex items-center gap-1.5">
            <Banknote className="h-3.5 w-3.5 text-emerald-500" />
            Финансы
          </TabsTrigger>
        </TabsList>

        {/* ========================================================================= */}
        {/* 1. ВКЛАДКА: ОБЗОР */}
        {/* ========================================================================= */}
        <TabsContent value="overview" className="space-y-6 outline-none">
          {/* Блоки KPI */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* Карточка 1: Поступило */}
            <Card className="border-border/50 bg-blue-50/40 dark:bg-blue-950/20 backdrop-blur-sm overflow-hidden relative group hover:border-blue-500/30 transition-all duration-300">
              <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full translate-x-8 -translate-y-8 group-hover:scale-125 transition-transform duration-300" />
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Поступило</span>
                  <h3 className="text-2xl font-black mt-1 text-foreground">
                    {analytics.totalRequests + analytics.totalTasks}
                  </h3>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {analytics.totalRequests} заявок • {analytics.totalTasks} задач
                  </p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
              </CardContent>
            </Card>

            {/* Карточка 2: Выполнено */}
            <Card className="border-border/50 bg-green-50/40 dark:bg-emerald-950/10 backdrop-blur-sm overflow-hidden relative group hover:border-green-500/30 transition-all duration-300">
              <div className="absolute top-0 right-0 w-24 h-24 bg-green-500/10 rounded-full translate-x-8 -translate-y-8 group-hover:scale-125 transition-transform duration-300" />
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-green-600 dark:text-emerald-400 uppercase tracking-wider">Выполнено</span>
                  <h3 className="text-2xl font-black mt-1 text-foreground">
                    {analytics.completedRequests + analytics.completedTasks}
                  </h3>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Успешность: {((analytics.totalRequests + analytics.totalTasks) > 0) 
                      ? Math.round(((analytics.completedRequests + analytics.completedTasks) / (analytics.totalRequests + analytics.totalTasks)) * 100) 
                      : 0}%
                  </p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-emerald-400" />
                </div>
              </CardContent>
            </Card>

            {/* Карточка 3: В работе */}
            <Card className="border-border/50 bg-orange-50/40 dark:bg-orange-950/10 backdrop-blur-sm overflow-hidden relative group hover:border-orange-500/30 transition-all duration-300">
              <div className="absolute top-0 right-0 w-24 h-24 bg-orange-500/10 rounded-full translate-x-8 -translate-y-8 group-hover:scale-125 transition-transform duration-300" />
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wider">В процессе</span>
                  <h3 className="text-2xl font-black mt-1 text-foreground">
                    {analytics.inProgressRequests + analytics.inProgressTasks}
                  </h3>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Мастера на выезде прямо сейчас
                  </p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center">
                  <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                </div>
              </CardContent>
            </Card>

            {/* Карточка 4: Оплаты */}
            <Card className="border-border/50 bg-emerald-50/40 dark:bg-emerald-950/20 backdrop-blur-sm overflow-hidden relative group hover:border-emerald-500/30 transition-all duration-300">
              <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full translate-x-8 -translate-y-8 group-hover:scale-125 transition-transform duration-300" />
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Собрано</span>
                  <h3 className="text-2xl font-black mt-1 text-foreground">
                    {analytics.totalRevenue.toLocaleString()} ₽
                  </h3>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    ТО: {analytics.maintenanceRevenue.toLocaleString()} ₽ • Услуги: {analytics.servicesRevenue.toLocaleString()} ₽
                  </p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                  <Banknote className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Графики динамики и приоритетов */}
          <div className="grid md:grid-cols-3 gap-6">
            
            {/* График 1: Динамика обработки задач */}
            <Card className="md:col-span-2 border-border/50 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Динамика обработки задач</CardTitle>
                <CardDescription className="text-xs">Сравнение новых поступлений и завершенных нарядов за неделю</CardDescription>
              </CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={analytics.dynamicsData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorIn" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorOut" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148, 163, 184, 0.1)" />
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} />
                    <Tooltip contentStyle={{ background: "rgba(15, 23, 42, 0.9)", border: "none", borderRadius: "12px", color: "#fff", fontSize: "12px" }} />
                    <Legend iconSize={8} wrapperStyle={{ fontSize: "10px" }} />
                    <Area type="monotone" dataKey="Поступило заявок" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorIn)" />
                    <Area type="monotone" dataKey="Выполнено" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorOut)" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* График 2: Круговая диаграмма по уровням приоритета */}
            <Card className="border-border/50 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md flex flex-col justify-between">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Уровни важности задач</CardTitle>
                <CardDescription className="text-xs">Распределение по критичности нарядов</CardDescription>
              </CardHeader>
              <CardContent className="h-48 flex items-center justify-center">
                {analytics.priorityData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={analytics.priorityData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={70}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {analytics.priorityData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => [`${value} задач`, "Количество"]} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-xs text-muted-foreground">Нет данных для вывода</p>
                )}
              </CardContent>
              {analytics.priorityData.length > 0 && (
                <div className="p-4 grid grid-cols-2 gap-2 text-[10px] font-semibold border-t border-slate-100 dark:border-slate-800/80">
                  {analytics.priorityData.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-1.5 truncate">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                      <span className="text-muted-foreground truncate">{item.name}:</span>
                      <span>{item.value}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Срочные активные заявки */}
          <Card className="border-border/50 bg-red-500/5 dark:bg-red-950/10 backdrop-blur-md border-2 border-red-500/20">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-red-600 dark:text-red-400 flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-red-500 animate-bounce" />
                  Критические заявки (Требуют реагирования)
                </CardTitle>
                <CardDescription className="text-xs">Заявки со статусом «Срочно», ожидающие выполнения</CardDescription>
              </div>
              <Badge variant="destructive" className="animate-pulse">{analytics.urgentRequests.length}</Badge>
            </CardHeader>
            <CardContent>
              {analytics.urgentRequests.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">Нет срочных необработанных заявок</p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                  {analytics.urgentRequests.map(req => (
                    <div 
                      key={req.id} 
                      onClick={() => handleItemClick("requests", "pending", req.id)}
                      className="flex items-center justify-between p-3 rounded-xl bg-white/50 dark:bg-slate-900/60 border border-red-200/50 dark:border-red-900/30 hover:border-red-500/50 hover:scale-[1.005] transition-all cursor-pointer"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-foreground truncate">{req.name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">📍 {req.address}</p>
                        <p className="text-[10px] text-red-500 dark:text-red-400 mt-1 italic line-clamp-1">💬 {req.message}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground">
                          {format(new Date(req.created_at), "dd.MM.yyyy HH:mm")}
                        </span>
                        <ArrowUpRight className="h-4 w-4 text-red-500 shrink-0" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========================================================================= */}
        {/* 2. ВКЛАДКА: KPI МАСТЕРОВ */}
        {/* ========================================================================= */}
        <TabsContent value="masters" className="space-y-4 outline-none">
          <Card className="border-border/50 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-bold">Рейтинг эффективности мастеров</CardTitle>
              <CardDescription className="text-xs">
                Показатели закрытия нарядов, среднего времени реагирования и сбора наличных
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="w-full overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-800/80">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs font-bold uppercase bg-slate-50 dark:bg-slate-800/60 text-muted-foreground border-b">
                    <tr>
                      <th className="px-4 py-3">Имя мастера</th>
                      <th className="px-4 py-3 text-center">Назначено</th>
                      <th className="px-4 py-3 text-center">Выполнено</th>
                      <th className="px-4 py-3 text-center">Успешность (KPI)</th>
                      <th className="px-4 py-3 text-center">Среднее время</th>
                      <th className="px-4 py-3 text-right">Сбор (₽)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.masterStats.map((master, idx) => (
                      <tr key={master.id} className="border-b hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-all">
                        <td className="px-4 py-3 flex items-center gap-2">
                          {idx === 0 && <Award className="h-4 w-4 text-yellow-500" />}
                          <div>
                            <p className="font-bold text-foreground">{master.name}</p>
                            <p className="text-[10px] text-muted-foreground">{master.position}</p>
                          </div>
                          {!master.isActive && <Badge variant="secondary" className="text-[8px] h-4">Неактивен</Badge>}
                        </td>
                        <td className="px-4 py-3 text-center font-semibold">{master.assigned}</td>
                        <td className="px-4 py-3 text-center font-bold text-emerald-600 dark:text-emerald-400">{master.completed}</td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <div className="w-12 bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                              <div className="bg-primary h-full" style={{ width: `${master.successRate}%` }} />
                            </div>
                            <span className="font-bold text-xs">{master.successRate}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center text-muted-foreground text-xs">
                          {master.avgTimeMinutes > 0 
                            ? `${Math.floor(master.avgTimeMinutes / 60)}ч ${master.avgTimeMinutes % 60}м`
                            : "—"
                          }
                        </td>
                        <td className="px-4 py-3 text-right font-black text-blue-600 dark:text-blue-400">
                          {master.cashCollected.toLocaleString()} ₽
                        </td>
                      </tr>
                    ))}
                    {analytics.masterStats.length === 0 && (
                      <tr>
                        <td colSpan={6} className="text-center py-6 text-muted-foreground text-xs">Нет данных по мастерам</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========================================================================= */}
        {/* 3. ВКЛАДКА: АНАЛИТИКА ДИСПЕТЧЕРОВ */}
        {/* ========================================================================= */}
        <TabsContent value="dispatchers" className="space-y-4 outline-none">
          <Card className="border-border/50 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-bold">Активность диспетчеров</CardTitle>
              <CardDescription className="text-xs">
                Показатели создания задач и назначения исполнителей
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="w-full overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-800/80">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs font-bold uppercase bg-slate-50 dark:bg-slate-800/60 text-muted-foreground border-b">
                    <tr>
                      <th className="px-4 py-3">Имя сотрудника</th>
                      <th className="px-4 py-3 text-center">Создано задач</th>
                      <th className="px-4 py-3 text-center">Выполнено из них</th>
                      <th className="px-4 py-3 text-center">Эффективность назначения</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.dispatcherStats.map((disp) => (
                      <tr key={disp.id} className="border-b hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-all">
                        <td className="px-4 py-3 font-bold text-foreground">{disp.name}</td>
                        <td className="px-4 py-3 text-center font-bold">{disp.created}</td>
                        <td className="px-4 py-3 text-center font-semibold text-emerald-600 dark:text-emerald-400">{disp.completed}</td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <div className="w-12 bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                              <div className="bg-primary h-full" style={{ width: `${disp.successRate}%` }} />
                            </div>
                            <span className="font-bold text-xs">{disp.successRate}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {analytics.dispatcherStats.length === 0 && (
                      <tr>
                        <td colSpan={4} className="text-center py-6 text-muted-foreground text-xs">Нет данных по диспетчерам</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========================================================================= */}
        {/* 4. ВКЛАДКА: ФИНАНСЫ, АБОНЕНТСКАЯ ПЛАТА И ОНЛАЙН-ПЛАТЕЖИ */}
        {/* ========================================================================= */}
        <TabsContent value="finance" className="space-y-6 outline-none">
          
          {/* Сводные финансовые показатели за выбранный период */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* Карточка 1: Общая выручка */}
            <Card className="border-border/50 bg-emerald-50/50 dark:bg-emerald-950/20 backdrop-blur-sm overflow-hidden relative group hover:border-emerald-500/40 transition-all duration-300">
              <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full translate-x-8 -translate-y-8 group-hover:scale-125 transition-transform duration-300" />
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Всего собрано</span>
                  <h3 className="text-2xl font-black mt-1 text-foreground">
                    {analytics.totalRevenue.toLocaleString()} ₽
                  </h3>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Успешно: {analytics.succeededCount} оп. • Ср. чек: {analytics.avgCheck.toLocaleString()} ₽
                  </p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                  <Wallet className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
              </CardContent>
            </Card>

            {/* Карточка 2: Абонентская плата ТО */}
            <Card className="border-border/50 bg-blue-50/50 dark:bg-blue-950/20 backdrop-blur-sm overflow-hidden relative group hover:border-blue-500/40 transition-all duration-300">
              <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full translate-x-8 -translate-y-8 group-hover:scale-125 transition-transform duration-300" />
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Абонплата (ТО)</span>
                  <h3 className="text-2xl font-black mt-1 text-foreground">
                    {analytics.maintenanceRevenue.toLocaleString()} ₽
                  </h3>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {analytics.maintenanceCount} оплат • {analytics.totalRevenue > 0 ? Math.round((analytics.maintenanceRevenue / analytics.totalRevenue) * 100) : 0}% от суммы
                  </p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                  <ShieldCheck className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
              </CardContent>
            </Card>

            {/* Карточка 3: Заказы оборудования и услуги */}
            <Card className="border-border/50 bg-purple-50/50 dark:bg-purple-950/20 backdrop-blur-sm overflow-hidden relative group hover:border-purple-500/40 transition-all duration-300">
              <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/10 rounded-full translate-x-8 -translate-y-8 group-hover:scale-125 transition-transform duration-300" />
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider">Заказы и услуги</span>
                  <h3 className="text-2xl font-black mt-1 text-foreground">
                    {analytics.servicesRevenue.toLocaleString()} ₽
                  </h3>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Заказы: {analytics.orderRevenue.toLocaleString()} ₽ • Вызовы: {analytics.requestRevenue.toLocaleString()} ₽
                  </p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                  <ShoppingBag className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
              </CardContent>
            </Card>

            {/* Карточка 4: В обработке / Ожидают */}
            <Card className="border-border/50 bg-amber-50/50 dark:bg-amber-950/20 backdrop-blur-sm overflow-hidden relative group hover:border-amber-500/40 transition-all duration-300">
              <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full translate-x-8 -translate-y-8 group-hover:scale-125 transition-transform duration-300" />
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">В обработке</span>
                  <h3 className="text-2xl font-black mt-1 text-foreground">
                    {analytics.pendingPayments.toLocaleString()} ₽
                  </h3>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Счета выставлены клиентам
                  </p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Интерактивный график сборов и разбивка по каналам поступлений */}
          <div className="grid md:grid-cols-3 gap-6">
            
            {/* График динамики выручки (Областной AreaChart с градиентами) */}
            <Card className="border-border/50 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md md:col-span-2">
              <CardHeader className="pb-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-emerald-500" />
                    Динамика финансовых поступлений
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Посуточный объем платежей с разделением на абонплату ТО и заказы
                  </CardDescription>
                </div>
                <div className="flex items-center gap-3 text-xs font-semibold">
                  <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                    ТО ({analytics.maintenanceRevenue.toLocaleString()} ₽)
                  </span>
                  <span className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400">
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block" />
                    Заказы ({analytics.servicesRevenue.toLocaleString()} ₽)
                  </span>
                </div>
              </CardHeader>
              <CardContent className="h-64 sm:h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={analytics.financeGraphData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorMaintenance" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.05}/>
                      </linearGradient>
                      <linearGradient id="colorServices" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0.05}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148, 163, 184, 0.15)" />
                    <XAxis 
                      dataKey="name" 
                      stroke="#94a3b8" 
                      fontSize={10} 
                      tickLine={false} 
                      minTickGap={20}
                    />
                    <YAxis 
                      stroke="#94a3b8" 
                      fontSize={10} 
                      tickLine={false} 
                      tickFormatter={(val) => `${val.toLocaleString()} ₽`}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        background: "rgba(15, 23, 42, 0.95)", 
                        border: "1px solid rgba(255, 255, 255, 0.1)", 
                        borderRadius: "12px", 
                        color: "#fff", 
                        fontSize: "12px",
                        boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.3)"
                      }} 
                      formatter={(value: any, name: string) => [`${Number(value).toLocaleString()} ₽`, name]} 
                    />
                    <Legend iconSize={8} wrapperStyle={{ fontSize: "11px", paddingTop: "6px" }} />
                    <Area 
                      type="monotone" 
                      dataKey="Абонплата ТО (₽)" 
                      stroke="#10b981" 
                      strokeWidth={2.5} 
                      fillOpacity={1} 
                      fill="url(#colorMaintenance)" 
                    />
                    <Area 
                      type="monotone" 
                      dataKey="Заказы и услуги (₽)" 
                      stroke="#6366f1" 
                      strokeWidth={2.5} 
                      fillOpacity={1} 
                      fill="url(#colorServices)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Карточка каналов поступлений */}
            <Card className="border-border/50 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md flex flex-col justify-between">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-blue-500" />
                  Каналы поступления
                </CardTitle>
                <CardDescription className="text-xs">Способы внесения средств клиентами</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Банковские карты */}
                <div className="p-3 bg-blue-500/10 rounded-xl border border-blue-500/20 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-blue-600 dark:text-blue-400 font-bold uppercase tracking-wider">💳 Банковские карты</p>
                    <p className="text-base font-black text-foreground">{analytics.cardRevenue.toLocaleString()} ₽</p>
                  </div>
                  <span className="text-xs font-bold bg-blue-500/20 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded">
                    {analytics.totalRevenue > 0 ? Math.round((analytics.cardRevenue / analytics.totalRevenue) * 100) : 0}%
                  </span>
                </div>

                {/* СБП */}
                <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider">⚡ СБП (быстрые платежи)</p>
                    <p className="text-base font-black text-foreground">{analytics.sbpRevenue.toLocaleString()} ₽</p>
                  </div>
                  <span className="text-xs font-bold bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded">
                    {analytics.totalRevenue > 0 ? Math.round((analytics.sbpRevenue / analytics.totalRevenue) * 100) : 0}%
                  </span>
                </div>

                {/* SberPay */}
                <div className="p-3 bg-green-500/10 rounded-xl border border-green-500/20 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-green-700 dark:text-green-400 font-bold uppercase tracking-wider">🟢 SberPay (Сбербанк)</p>
                    <p className="text-base font-black text-foreground">{analytics.sberRevenue.toLocaleString()} ₽</p>
                  </div>
                  <span className="text-xs font-bold bg-green-500/20 text-green-700 dark:text-green-400 px-2 py-0.5 rounded">
                    {analytics.totalRevenue > 0 ? Math.round((analytics.sberRevenue / analytics.totalRevenue) * 100) : 0}%
                  </span>
                </div>

                {/* Наличные мастеру */}
                <div className="p-3 bg-amber-500/10 rounded-xl border border-amber-500/20 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-amber-600 dark:text-amber-400 font-bold uppercase tracking-wider">💵 Наличные мастеру</p>
                    <p className="text-base font-black text-foreground">{analytics.cashRevenue.toLocaleString()} ₽</p>
                  </div>
                  <span className="text-xs font-bold bg-amber-500/20 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded">
                    {analytics.totalRevenue > 0 ? Math.round((analytics.cashRevenue / analytics.totalRevenue) * 100) : 0}%
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Реестр финансовых операций и абонентской платы с фильтрами и поиском */}
          <Card className="border-border/50 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md">
            <CardHeader className="pb-3 flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <Receipt className="h-5 w-5 text-primary" />
                    Реестр платежей и абонентской платы
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Все операции эквайринга, оплат по лицевым счетам и платных вызовов ({filteredPayments.length} записей на {filteredPayments.reduce((s, p) => s + (p.status === 'succeeded' ? p.amount : 0), 0).toLocaleString()} ₽)
                  </CardDescription>
                </div>
                
                {/* Строка быстрого поиска онлайн */}
                <div className="relative w-full sm:w-80">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Поиск по л/с, ФИО, адресу, тел, ID..."
                    value={paymentSearchTerm}
                    onChange={(e) => setPaymentSearchTerm(e.target.value)}
                    className="pl-9 pr-8 py-2 w-full bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-medium border border-transparent focus:border-primary focus:outline-none transition-all"
                  />
                  {paymentSearchTerm && (
                    <button 
                      onClick={() => setPaymentSearchTerm("")}
                      className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Панель фильтров: по типу, статусу и способу оплаты */}
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200/50 dark:border-slate-800/50">
                <span className="text-xs font-bold text-muted-foreground flex items-center gap-1 shrink-0">
                  <Filter className="h-3.5 w-3.5" /> Фильтры:
                </span>

                {/* Фильтр: Тип операции */}
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-xs">
                  <button
                    onClick={() => setPaymentTypeFilter("all")}
                    className={cn(
                      "px-2 py-1 rounded-md transition-all font-medium",
                      paymentTypeFilter === "all" ? "bg-white dark:bg-slate-700 font-bold shadow-xs text-foreground" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Все типы
                  </button>
                  <button
                    onClick={() => setPaymentTypeFilter("maintenance")}
                    className={cn(
                      "px-2 py-1 rounded-md transition-all font-medium flex items-center gap-1",
                      paymentTypeFilter === "maintenance" ? "bg-white dark:bg-slate-700 font-bold shadow-xs text-blue-600 dark:text-blue-400" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    🏷️ ТО (абонплата)
                  </button>
                  <button
                    onClick={() => setPaymentTypeFilter("order")}
                    className={cn(
                      "px-2 py-1 rounded-md transition-all font-medium flex items-center gap-1",
                      paymentTypeFilter === "order" ? "bg-white dark:bg-slate-700 font-bold shadow-xs text-purple-600 dark:text-purple-400" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    📦 Заказы
                  </button>
                  <button
                    onClick={() => setPaymentTypeFilter("request")}
                    className={cn(
                      "px-2 py-1 rounded-md transition-all font-medium flex items-center gap-1",
                      paymentTypeFilter === "request" ? "bg-white dark:bg-slate-700 font-bold shadow-xs text-emerald-600 dark:text-emerald-400" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    🔧 Заявки мастеров
                  </button>
                </div>

                {/* Фильтр: Статус платежа */}
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-xs">
                  <button
                    onClick={() => setPaymentStatusFilter("all")}
                    className={cn(
                      "px-2 py-1 rounded-md transition-all font-medium",
                      paymentStatusFilter === "all" ? "bg-white dark:bg-slate-700 font-bold shadow-xs text-foreground" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Все статусы
                  </button>
                  <button
                    onClick={() => setPaymentStatusFilter("succeeded")}
                    className={cn(
                      "px-2 py-1 rounded-md transition-all font-medium text-emerald-600 dark:text-emerald-400",
                      paymentStatusFilter === "succeeded" ? "bg-white dark:bg-slate-700 font-bold shadow-xs" : "hover:text-foreground"
                    )}
                  >
                    ✅ Оплачено
                  </button>
                  <button
                    onClick={() => setPaymentStatusFilter("pending")}
                    className={cn(
                      "px-2 py-1 rounded-md transition-all font-medium text-amber-600 dark:text-amber-400",
                      paymentStatusFilter === "pending" ? "bg-white dark:bg-slate-700 font-bold shadow-xs" : "hover:text-foreground"
                    )}
                  >
                    ⏳ Ожидает
                  </button>
                  <button
                    onClick={() => setPaymentStatusFilter("canceled")}
                    className={cn(
                      "px-2 py-1 rounded-md transition-all font-medium text-red-600 dark:text-red-400",
                      paymentStatusFilter === "canceled" ? "bg-white dark:bg-slate-700 font-bold shadow-xs" : "hover:text-foreground"
                    )}
                  >
                    ❌ Отменено
                  </button>
                </div>

                {/* Фильтр: Метод оплаты */}
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-xs">
                  <button
                    onClick={() => setPaymentMethodFilter("all")}
                    className={cn(
                      "px-2 py-1 rounded-md transition-all font-medium",
                      paymentMethodFilter === "all" ? "bg-white dark:bg-slate-700 font-bold shadow-xs text-foreground" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Все методы
                  </button>
                  <button
                    onClick={() => setPaymentMethodFilter("bank_card")}
                    className={cn(
                      "px-2 py-1 rounded-md transition-all font-medium",
                      paymentMethodFilter === "bank_card" ? "bg-white dark:bg-slate-700 font-bold shadow-xs text-blue-600" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    💳 Карта
                  </button>
                  <button
                    onClick={() => setPaymentMethodFilter("sbp")}
                    className={cn(
                      "px-2 py-1 rounded-md transition-all font-medium",
                      paymentMethodFilter === "sbp" ? "bg-white dark:bg-slate-700 font-bold shadow-xs text-emerald-600" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    ⚡ СБП
                  </button>
                  <button
                    onClick={() => setPaymentMethodFilter("sberbank")}
                    className={cn(
                      "px-2 py-1 rounded-md transition-all font-medium",
                      paymentMethodFilter === "sberbank" ? "bg-white dark:bg-slate-700 font-bold shadow-xs text-green-700" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    🟢 SberPay
                  </button>
                  <button
                    onClick={() => setPaymentMethodFilter("cash")}
                    className={cn(
                      "px-2 py-1 rounded-md transition-all font-medium",
                      paymentMethodFilter === "cash" ? "bg-white dark:bg-slate-700 font-bold shadow-xs text-amber-600" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    💵 Наличные
                  </button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="w-full overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-800/80">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs font-bold uppercase bg-slate-50 dark:bg-slate-800/60 text-muted-foreground border-b">
                    <tr>
                      <th className="px-4 py-3">Дата / Время</th>
                      <th className="px-4 py-3">Тип & Назначение</th>
                      <th className="px-4 py-3">Плательщик & Адрес</th>
                      <th className="px-4 py-3 text-center">Способ оплаты</th>
                      <th className="px-4 py-3 text-center">Статус</th>
                      <th className="px-4 py-3 text-right">Сумма (₽)</th>
                      <th className="px-4 py-3 text-center">Действие</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedPayments.map((item) => (
                      <tr 
                        key={item.id} 
                        className="border-b hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-all"
                      >
                        {/* Дата и время */}
                        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                          <p className="font-semibold text-foreground">
                            {format(new Date(item.createdAt), "dd.MM.yyyy")}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {format(new Date(item.createdAt), "HH:mm")}
                          </p>
                        </td>

                        {/* Тип и лицевой счёт / номер заказа */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Badge className={cn(
                              "text-[9px] h-5 py-0 px-2 font-bold",
                              item.type === "maintenance" 
                                ? "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30" 
                                : item.type === "order"
                                ? "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30"
                                : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                            )} variant="outline">
                              {item.typeLabel}
                            </Badge>
                          </div>
                          {item.accountNumber ? (
                            <button
                              onClick={() => handleAccountClick(item.accountNumber)}
                              className="text-xs font-mono font-bold text-primary hover:underline mt-1 flex items-center gap-1"
                              title="Открыть лицевой счет"
                            >
                              л/с {item.accountNumber}
                              <ExternalLink className="h-3 w-3" />
                            </button>
                          ) : item.requestId ? (
                            <button
                              onClick={() => handleItemClick("requests", "pending", item.requestId!)}
                              className="text-xs font-mono text-muted-foreground hover:text-primary hover:underline mt-1 flex items-center gap-1"
                              title="Открыть заявку"
                            >
                              Заявка #{item.requestId.substring(0, 8)}
                              <ExternalLink className="h-3 w-3" />
                            </button>
                          ) : null}
                        </td>

                        {/* Плательщик, адрес и телефон */}
                        <td className="px-4 py-3 max-w-[280px]">
                          <p className="font-semibold text-foreground truncate">{item.clientName}</p>
                          <p className="text-[11px] text-muted-foreground truncate" title={item.address}>
                            📍 {item.address}
                          </p>
                          {item.phone && (
                            <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                              📞 {item.phone}
                            </p>
                          )}
                        </td>

                        {/* Способ оплаты */}
                        <td className="px-4 py-3 text-center text-xs whitespace-nowrap">
                          {item.method === "bank_card" ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-medium text-[11px]">
                              💳 Банк. карта
                            </span>
                          ) : item.method === "sbp" ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-medium text-[11px]">
                              ⚡ СБП
                            </span>
                          ) : item.method === "sberbank" ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300 font-medium text-[11px]">
                              🟢 SberPay
                            </span>
                          ) : item.method === "cash" ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 font-medium text-[11px]">
                              💵 Наличные
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium text-[11px]">
                              Онлайн
                            </span>
                          )}
                        </td>

                        {/* Статус */}
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          <Badge className={cn(
                            "text-[10px] h-5 py-0 px-2 font-bold",
                            item.status === "succeeded" 
                              ? "bg-emerald-600 dark:bg-emerald-600 text-white" 
                              : item.status === "pending"
                              ? "bg-amber-500 text-white animate-pulse"
                              : "bg-red-500 text-white"
                          )}>
                            {item.statusLabel}
                          </Badge>
                        </td>

                        {/* Сумма */}
                        <td className="px-4 py-3 text-right font-black text-foreground whitespace-nowrap">
                          <span className={cn(
                            "text-sm font-black",
                            item.status === "succeeded" ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
                          )}>
                            {item.amount.toLocaleString()} ₽
                          </span>
                        </td>

                        {/* Действие / переход */}
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          {item.accountNumber ? (
                            <button
                              onClick={() => handleAccountClick(item.accountNumber)}
                              className="px-2.5 py-1 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-xs font-semibold transition-all"
                            >
                              К счёту
                            </button>
                          ) : item.requestId ? (
                            <button
                              onClick={() => handleItemClick("requests", "pending", item.requestId!)}
                              className="px-2.5 py-1 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 text-xs font-semibold transition-all"
                            >
                              К заявке
                            </button>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </td>
                      </tr>
                    ))}

                    {paginatedPayments.length === 0 && (
                      <tr>
                        <td colSpan={7} className="text-center py-10 text-muted-foreground text-xs">
                          <div className="flex flex-col items-center justify-center gap-2">
                            <Receipt className="h-8 w-8 text-muted-foreground/40" />
                            <p className="font-semibold">Платежи не найдены</p>
                            <p className="text-[11px] text-muted-foreground">
                              Попробуйте изменить поисковый запрос или сбросить фильтры
                            </p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Постраничная пагинация */}
              {filteredPayments.length > 0 && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-slate-200/50 dark:border-slate-800/50">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>
                      Показано {((paymentPage - 1) * paymentPageSize) + 1}–{Math.min(paymentPage * paymentPageSize, filteredPayments.length)} из {filteredPayments.length} платежей
                    </span>
                    <span className="text-slate-300 dark:text-slate-700">•</span>
                    <div className="flex items-center gap-1.5">
                      <span>На странице:</span>
                      <select
                        value={paymentPageSize}
                        onChange={(e) => setPaymentPageSize(Number(e.target.value))}
                        className="bg-slate-100 dark:bg-slate-800 text-xs font-bold rounded-md px-1.5 py-0.5 border-none focus:outline-none"
                      >
                        <option value={10}>10</option>
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                      </select>
                    </div>
                  </div>

                  {/* Кнопки навигации по страницам */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPaymentPage(1)}
                      disabled={paymentPage === 1}
                      className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                      title="В начало"
                    >
                      <ChevronsLeft className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setPaymentPage(p => Math.max(1, p - 1))}
                      disabled={paymentPage === 1}
                      className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                      title="Предыдущая"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>

                    <span className="px-3 py-1 text-xs font-bold bg-slate-100 dark:bg-slate-800 rounded-lg">
                      Стр. {paymentPage} из {totalPaymentPages}
                    </span>

                    <button
                      onClick={() => setPaymentPage(p => Math.min(totalPaymentPages, p + 1))}
                      disabled={paymentPage === totalPaymentPages}
                      className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                      title="Следующая"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setPaymentPage(totalPaymentPages)}
                      disabled={paymentPage === totalPaymentPages}
                      className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                      title="В конец"
                    >
                      <ChevronsRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export const FSMDashboard = CRMDashboard;
export default CRMDashboard;
