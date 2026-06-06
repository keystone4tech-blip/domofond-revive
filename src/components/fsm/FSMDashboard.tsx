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
  ArrowUpRight, Calendar, Search, Award, ShieldAlert, Zap, History
} from "lucide-react";
import { format, differenceInMinutes, parseISO, subDays } from "date-fns";
import { ru } from "date-fns/locale";

// Пропсы для дашборда аналитики
interface FSMDashboardProps {
  isManager: boolean;
  onNavigate?: (tab: string, filter?: string, id?: string) => void;
}

// Периоды аналитики
type AnalyticsPeriod = "current_month" | "last_month" | "30_days" | "90_days" | "all";

export const FSMDashboard = ({ isManager, onNavigate }: FSMDashboardProps) => {
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState<AnalyticsPeriod>("30_days");
  const [searchTerm, setSearchTerm] = useState("");

  // Запрос сырых данных для аналитики
  const { data: rawData, isLoading } = useQuery({
    queryKey: ["fsm-dashboard-raw-data"],
    queryFn: async () => {
      console.log("[FSMDashboard] Загрузка сырых данных для аналитики...");
      const [tasksRes, requestsRes, employeesRes, profilesRes] = await Promise.all([
        supabase.from("tasks").select("*").order("created_at", { ascending: false }),
        supabase.from("requests").select("*").order("created_at", { ascending: false }),
        supabase.from("employees").select("*"),
        supabase.from("profiles").select("id, full_name")
      ]);

      if (tasksRes.error) throw tasksRes.error;
      if (requestsRes.error) throw requestsRes.error;
      if (employeesRes.error) throw employeesRes.error;
      if (profilesRes.error) throw profilesRes.error;

      return {
        tasks: tasksRes.data || [],
        requests: requestsRes.data || [],
        employees: employeesRes.data || [],
        profiles: profilesRes.data || []
      };
    }
  });

  // Подписка на Supabase Realtime изменения в реальном времени
  useEffect(() => {
    console.log("[FSMDashboard] Подключение к realtime-каналам изменений таблиц...");
    const channel = supabase
      .channel("fsm-dashboard-realtime-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, (payload) => {
        console.log("[Realtime] Обнаружено изменение в таблице задач (tasks):", payload.eventType);
        queryClient.invalidateQueries({ queryKey: ["fsm-dashboard-raw-data"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "requests" }, (payload) => {
        console.log("[Realtime] Обнаружено изменение в таблице заявок (requests):", payload.eventType);
        queryClient.invalidateQueries({ queryKey: ["fsm-dashboard-raw-data"] });
      })
      .subscribe();

    return () => {
      console.log("[FSMDashboard] Отключение от каналов realtime...");
      supabase.removeChannel(channel);
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
      case "last_month":
        const lastMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
        const lastMonthYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
        return date.getMonth() === lastMonth && date.getFullYear() === lastMonthYear;
      case "30_days":
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(now.getDate() - 30);
        return date >= thirtyDaysAgo;
      case "90_days":
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(now.getDate() - 90);
        return date >= ninetyDaysAgo;
      case "all":
      default:
        return true;
    }
  };

  // Вычисляемые данные аналитики
  const analytics = useMemo(() => {
    if (!rawData) return null;

    const filteredTasks = rawData.tasks.filter(t => filterByPeriod(t.created_at));
    const filteredRequests = rawData.requests.filter(r => filterByPeriod(r.created_at));

    // Суммы платежей
    let totalRevenue = 0;
    let cashRevenue = 0;
    let onlineRevenue = 0;
    let pendingPayments = 0;

    filteredRequests.forEach(r => {
      const amount = Number(r.payment_amount) || 0;
      if (r.payment_status === "paid") {
        totalRevenue += amount;
        if (r.payment_method === "online") onlineRevenue += amount;
        else cashRevenue += amount;
      } else if (r.payment_status === "pending") {
        pendingPayments += amount;
      }
    });

    // Расчет KPI по Мастерам
    const masterStats = rawData.employees.map(emp => {
      const empTasks = filteredTasks.filter(t => t.assigned_to === emp.id || t.accepted_by === emp.id);
      const empRequests = filteredRequests.filter(r => r.assigned_to === emp.id || r.accepted_by === emp.id);

      const completedTasks = empTasks.filter(t => t.status === "completed").length;
      const completedRequests = empRequests.filter(r => r.status === "completed").length;
      
      const totalAssigned = empTasks.length + empRequests.length;
      const totalCompleted = completedTasks + completedRequests;

      // Сбор денег по закрытым платным заявкам мастера
      const cashCollected = empRequests
        .filter(r => r.status === "completed" && r.payment_status === "paid")
        .reduce((sum, r) => sum + (Number(r.payment_amount) || 0), 0);

      // Время выполнения (в минутах)
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

    // Расчет KPI по Диспетчерам (кто поставил задачи)
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

    // Статистика приоритетов для диаграммы
    const priorityData = [
      { name: "Срочно", value: filteredTasks.filter(t => t.priority === "urgent").length + filteredRequests.filter(r => r.priority === "urgent").length, color: "#ef4444" },
      { name: "Высокий", value: filteredTasks.filter(t => t.priority === "high").length + filteredRequests.filter(r => r.priority === "high").length, color: "#f97316" },
      { name: "Средний", value: filteredTasks.filter(t => t.priority === "medium").length + filteredRequests.filter(r => r.priority === "medium").length, color: "#3b82f6" },
      { name: "Низкий", value: filteredTasks.filter(t => t.priority === "low").length + filteredRequests.filter(r => r.priority === "low").length, color: "#94a3b8" },
    ].filter(item => item.value > 0);

    // Подготовка данных для графика динамики выполнения (последние 7 периодов)
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

    // Подготовка графика выручки по дням
    const financeGraphData = Array.from({ length: 7 }).map((_, idx) => {
      const d = subDays(new Date(), idx);
      const dateStr = format(d, "yyyy-MM-dd");
      const label = format(d, "dd MMM", { locale: ru });

      const dayRevenue = filteredRequests
        .filter(r => r.payment_status === "paid" && r.completed_at && format(new Date(r.completed_at), "yyyy-MM-dd") === dateStr)
        .reduce((sum, r) => sum + (Number(r.payment_amount) || 0), 0);

      return {
        name: label,
        "Выручка (₽)": dayRevenue
      };
    }).reverse();

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

      totalRevenue,
      cashRevenue,
      onlineRevenue,
      pendingPayments,
      urgentRequests,
      priorityData,
      dynamicsData,
      financeGraphData,
      masterStats,
      dispatcherStats,
      allRequests: filteredRequests
    };
  }, [rawData, period]);

  // Взаимодействие при переходе к конкретной задаче или заявке
  const handleItemClick = (type: "requests" | "tasks", status: string, id: string) => {
    console.log(`[FSMDashboard] Нажата ссылка для перехода к: ${type}, статус: ${status}, ID: ${id}`);
    if (onNavigate) {
      onNavigate(type, status, id);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-muted-foreground text-sm font-semibold">Загрузка аналитического дашборда...</p>
      </div>
    );
  }

  if (!analytics) return null;

  return (
    <div className="space-y-6 w-full overflow-x-hidden min-w-0">
      {/* Шапка дашборда и период аналитики */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md p-3 sm:p-4 rounded-2xl border border-slate-200/50 dark:border-slate-800/50">
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary animate-pulse" />
            Аналитика FSM (Режим Онлайн)
          </h2>
          <p className="text-xs text-muted-foreground">
            Полноэкранный контроль процессов, платежей и KPI мастеров
          </p>
        </div>
        
        {/* Выбор периода — flex-wrap для корректного отображения на мобильных */}
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
                className={`px-2 py-1.5 rounded-lg transition-all whitespace-nowrap ${
                  period === item.id 
                    ? "bg-white dark:bg-slate-700 text-foreground shadow-sm scale-105" 
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
        {/* Вкладки аналитики — w-full для адаптивности на мобильных */}
        <TabsList className="bg-slate-100 dark:bg-slate-800/60 p-1 rounded-xl w-full grid grid-cols-4 gap-1">
          <TabsTrigger value="overview" className="rounded-lg text-xs font-bold">Обзор</TabsTrigger>
          <TabsTrigger value="masters" className="rounded-lg text-xs font-bold">Мастера</TabsTrigger>
          {isManager && <TabsTrigger value="dispatchers" className="rounded-lg text-xs font-bold">Диспетчеры</TabsTrigger>}
          {isManager && <TabsTrigger value="finance" className="rounded-lg text-xs font-bold">Финансы</TabsTrigger>}
        </TabsList>

        {/* 1. ВКЛАДКА: ОБЗОР */}
        <TabsContent value="overview" className="space-y-6 outline-none">
          {/* Блоки KPI в стиле Jobie */}
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

            {/* Карточка 4: Выручка */}
            <Card className="border-border/50 bg-emerald-50/40 dark:bg-emerald-950/20 backdrop-blur-sm overflow-hidden relative group hover:border-emerald-500/30 transition-all duration-300">
              <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full translate-x-8 -translate-y-8 group-hover:scale-125 transition-transform duration-300" />
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Оплаты</span>
                  <h3 className="text-2xl font-black mt-1 text-foreground">
                    {analytics.totalRevenue.toLocaleString()} ₽
                  </h3>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Ожидает: {analytics.pendingPayments.toLocaleString()} ₽
                  </p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                  <Banknote className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Графики Recharts */}
          <div className="grid md:grid-cols-3 gap-6">
            
            {/* График 1: Динамика (Линейный/Областной) */}
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

        {/* 2. ВКЛАДКА: KPI МАСТЕРОВ */}
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

        {/* 3. ВКЛАДКА: АНАЛИТИКА ДИСПЕТЧЕРОВ */}
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

        {/* 4. ВКЛАДКА: ФИНАНСЫ И ПЛАТЕЖИ */}
        <TabsContent value="finance" className="space-y-6 outline-none">
          
          {/* Сводный баланс сборов */}
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="border-border/50 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md md:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Сборы за период</CardTitle>
                <CardDescription className="text-xs">Посуточный объем закрытых платных нарядов (выручка)</CardDescription>
              </CardHeader>
              <CardContent className="h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analytics.financeGraphData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148, 163, 184, 0.1)" />
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} />
                    <Tooltip contentStyle={{ background: "rgba(15, 23, 42, 0.9)", border: "none", borderRadius: "12px", color: "#fff", fontSize: "12px" }} formatter={(value) => [`${value} ₽`, "Выручка"]} />
                    <Bar dataKey="Выручка (₽)" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={30} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="border-border/50 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md flex flex-col justify-between">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Каналы поступления</CardTitle>
                <CardDescription className="text-xs">Способы закрытия платных заявок</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-3 bg-green-500/10 rounded-xl border border-green-500/20 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-green-600 dark:text-emerald-400 font-bold uppercase tracking-wider">Онлайн-платежи</p>
                    <p className="text-lg font-black text-foreground">{analytics.onlineRevenue.toLocaleString()} ₽</p>
                  </div>
                  <span className="text-xs font-bold bg-green-500/20 text-green-600 px-2 py-0.5 rounded">
                    {analytics.totalRevenue > 0 ? Math.round((analytics.onlineRevenue / analytics.totalRevenue) * 100) : 0}%
                  </span>
                </div>
                <div className="p-3 bg-blue-500/10 rounded-xl border border-blue-500/20 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-blue-600 dark:text-blue-400 font-bold uppercase tracking-wider">Наличными мастеру</p>
                    <p className="text-lg font-black text-foreground">{analytics.cashRevenue.toLocaleString()} ₽</p>
                  </div>
                  <span className="text-xs font-bold bg-blue-500/20 text-blue-600 px-2 py-0.5 rounded">
                    {analytics.totalRevenue > 0 ? Math.round((analytics.cashRevenue / analytics.totalRevenue) * 100) : 0}%
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* История финансовых операций по заявкам */}
          <Card className="border-border/50 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md">
            <CardHeader className="pb-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-base font-bold">История оплат по заявкам</CardTitle>
                <CardDescription className="text-xs">Все платные вызовы в выбранном периоде</CardDescription>
              </div>
              
              {/* Поиск платежа */}
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Имя, адрес..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 pr-4 py-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-medium border border-transparent focus:border-primary focus:outline-none"
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="w-full overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-800/80">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs font-bold uppercase bg-slate-50 dark:bg-slate-800/60 text-muted-foreground border-b">
                    <tr>
                      <th className="px-4 py-3">Имя клиента</th>
                      <th className="px-4 py-3">Адрес</th>
                      <th className="px-4 py-3 text-center">Метод</th>
                      <th className="px-4 py-3 text-center">Статус</th>
                      <th className="px-4 py-3 text-center">Дата операции</th>
                      <th className="px-4 py-3 text-right">Сумма (₽)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.allRequests
                      .filter(r => {
                        const amt = Number(r.payment_amount) || 0;
                        if (amt <= 0) return false;
                        if (!searchTerm) return true;
                        return r.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                               r.address.toLowerCase().includes(searchTerm.toLowerCase());
                      })
                      .map((req) => (
                        <tr 
                          key={req.id} 
                          onClick={() => handleItemClick("requests", "pending", req.id)}
                          className="border-b hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-all cursor-pointer"
                        >
                          <td className="px-4 py-3 font-semibold text-foreground flex items-center gap-1.5">
                            {req.name}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground max-w-[200px] truncate">{req.address}</td>
                          <td className="px-4 py-3 text-center text-xs">
                            {req.payment_method === "online" ? "💳 Онлайн" : "💵 Наличные"}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <Badge className={cn(
                              "text-[9px] h-5 py-0 px-2 font-bold",
                              req.payment_status === "paid" ? "bg-green-600 dark:bg-emerald-600 text-white" : "bg-orange-500 text-white animate-pulse"
                            )}>
                              {req.payment_status === "paid" ? "Оплачено" : "Ожидает"}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-center text-xs text-muted-foreground">
                            {format(new Date(req.created_at), "dd.MM.yyyy HH:mm")}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-foreground">
                            {Number(req.payment_amount).toFixed(0)} ₽
                          </td>
                        </tr>
                      ))}
                    {analytics.allRequests.filter(r => (Number(r.payment_amount) || 0) > 0).length === 0 && (
                      <tr>
                        <td colSpan={6} className="text-center py-6 text-muted-foreground text-xs">Нет оплат по заявкам в этом периоде</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default FSMDashboard;
