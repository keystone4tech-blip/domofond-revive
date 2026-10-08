import React, { useState, useEffect } from "react";
import {
  Zap,
  TrendingUp,
  CreditCard,
  Users,
  AlertCircle,
  CheckCircle2,
  Clock,
  Search,
  RefreshCw,
  Play,
  ArrowUpRight,
  ShieldCheck,
  Calendar,
  Phone,
  Home,
  UserCheck,
  ChevronRight,
  FileText,
  XCircle,
  Receipt
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

// RULE 2: Интерфейсы типов данных для строгой типизации и логирования
interface AutopayStats {
  currentPeriod: string;
  totalSubscriptions: number;
  activeSubscriptions: number;
  inactiveSubscriptions: number;
  totalAccounts: number;
  conversionPercent: number;
  expectedMonthly: number;
  currentMonthCharged: number;
  currentMonthChargesCount: number;
  allTimeCharged: number;
  succeededCount: number;
  failedCount: number;
  processingCount: number;
}

interface AutopaySubscriber {
  id: number;
  account_number: string;
  user_id: string | null;
  card_first6: string | null;
  card_last4: string | null;
  card_type: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  full_name: string;
  phone: string;
  email: string;
  address: string;
  apartment: string;
  tariff_price: number | null;
  tariff_name: string | null;
  debt_amount: number | null;
  total_charged: number;
  last_charge_at: string | null;
  last_charge_status: string | null;
  last_charge_amount: number | null;
}

interface AutopayCharge {
  id: number;
  account_number: string;
  user_id: string | null;
  period: string;
  amount: number;
  status: string;
  yookassa_payment_id: string | null;
  detail: string | null;
  created_at: string;
  card_last4: string | null;
  card_type: string | null;
  subscription_active: boolean | null;
  full_name: string;
  phone: string;
  address: string;
  apartment: string;
}

export const AutopayAnalytics: React.FC = () => {
  const { toast } = useToast();

  // Состояния данных
  const [stats, setStats] = useState<AutopayStats | null>(null);
  const [subscribers, setSubscribers] = useState<AutopaySubscriber[]>([]);
  const [charges, setCharges] = useState<AutopayCharge[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Фильтры и поиск
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [activeTab, setActiveTab] = useState<"subscribers" | "charges">("subscribers");

  // Детализация абонента в модалке
  const [selectedSubscriber, setSelectedSubscriber] = useState<AutopaySubscriber | null>(null);
  const [subscriberCharges, setSubscriberCharges] = useState<AutopayCharge[]>([]);
  const [loadingSubscriberDetails, setLoadingSubscriberDetails] = useState(false);

  // Запуск списания
  const [isRunningCharges, setIsRunningCharges] = useState(false);

  // RULE 2: Загрузка всей статистики и данных аналитики с бэкенда
  const loadData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      console.log("[Автоплатежи: Аналитика] Загрузка актуальных данных статистики и транзакций...");
      const token = localStorage.getItem("token") || sessionStorage.getItem("token");
      const headers = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      };

      // 1. Статистика KPI
      const statsRes = await fetch("/backend-api/api/admin/autopay/stats", { headers });
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
        console.log("[Автоплатежи: Аналитика] Статистика получена:", statsData);
      }

      // 2. Список подписчиков
      const subsRes = await fetch(`/backend-api/api/admin/autopay/subscribers?status=${statusFilter}&q=${encodeURIComponent(searchQuery)}`, { headers });
      if (subsRes.ok) {
        const subsData = await subsRes.json();
        setSubscribers(subsData.subscribers || []);
      }

      // 3. Журнал списаний
      const chargesRes = await fetch("/backend-api/api/admin/autopay/charges?limit=150", { headers });
      if (chargesRes.ok) {
        const chargesData = await chargesRes.json();
        setCharges(chargesData.charges || []);
      }
    } catch (err: any) {
      console.error("[Автоплатежи: Аналитика] Ошибка загрузки:", err);
      toast({
        title: "Ошибка загрузки",
        description: err.message || "Не удалось загрузить данные аналитики автоплатежей",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  // Загрузка детальной истории списаний по конкретному абоненту
  const handleOpenSubscriberDetails = async (sub: AutopaySubscriber) => {
    setSelectedSubscriber(sub);
    setLoadingSubscriberDetails(true);
    try {
      console.log(`[Автоплатежи: Аналитика] Загрузка деталей для л/с ${sub.account_number}`);
      const token = localStorage.getItem("token") || sessionStorage.getItem("token");
      const headers = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      };
      const res = await fetch(`/backend-api/api/admin/autopay/subscriber/${encodeURIComponent(sub.account_number)}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setSubscriberCharges(data.charges || []);
      }
    } catch (err: any) {
      console.error("[Автоплатежи: Аналитика] Ошибка деталей абонента:", err);
    } finally {
      setLoadingSubscriberDetails(false);
    }
  };

  // Ручной запуск автосписания (тест или внеплановый прогон)
  const handleTriggerRun = async () => {
    if (!window.confirm("Запустить автосписание абонентской платы по всем активным подпискам сейчас?")) {
      return;
    }

    setIsRunningCharges(true);
    try {
      console.log("[Автоплатежи: Аналитика] Инициация ручного запуска автосписаний...");
      const token = localStorage.getItem("token") || sessionStorage.getItem("token");
      const headers = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      };
      const res = await fetch("/backend-api/api/admin/autopay/run", {
        method: "POST",
        headers
      });
      const data = await res.json();
      if (res.ok) {
        toast({
          title: "Автосписание запущено",
          description: `Процесс списания запущен для периода ${data.period}. Обновите страницу через 30 секунд для просмотра результатов.`
        });
        setTimeout(() => loadData(true), 4000);
      } else {
        throw new Error(data.error || "Не удалось запустить автосписание");
      }
    } catch (err: any) {
      toast({
        title: "Ошибка запуска",
        description: err.message,
        variant: "destructive"
      });
    } finally {
      setIsRunningCharges(false);
    }
  };

  // Фильтрация подписчиков по поисковой строке
  const filteredSubscribers = subscribers.filter(s => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      s.account_number.toLowerCase().includes(q) ||
      (s.full_name && s.full_name.toLowerCase().includes(q)) ||
      (s.phone && s.phone.toLowerCase().includes(q)) ||
      (s.address && s.address.toLowerCase().includes(q))
    );
  });

  // Фильтрация транзакций по поисковой строке
  const filteredCharges = charges.filter(c => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.account_number.toLowerCase().includes(q) ||
      (c.full_name && c.full_name.toLowerCase().includes(q)) ||
      (c.address && c.address.toLowerCase().includes(q)) ||
      (c.period && c.period.toLowerCase().includes(q))
    );
  });

  const formatMoney = (val: number | null | undefined) => {
    return (Number(val) || 0).toLocaleString("ru-RU", { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + " ₽";
  };

  const formatDate = (iso: string | null | undefined) => {
    if (!iso) return "—";
    try {
      const d = new Date(iso);
      return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch {
      return iso;
    }
  };

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case "succeeded":
        return <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 gap-1"><CheckCircle2 className="h-3 w-3" /> Успешно</Badge>;
      case "processing":
      case "pending":
        return <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 gap-1"><Clock className="h-3 w-3" /> В обработке</Badge>;
      case "canceled":
      case "error":
        return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Ошибка</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Верхний заголовок и кнопки управления */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2.5">
            <div className="h-10 w-10 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Zap className="h-5 w-5 fill-current" />
            </div>
            <span>Аналитика автоплатежей (Рекурренты ЮKassa)</span>
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Мониторинг привязанных карт, статистика ежемесячных списаний и контроль абонентской платы
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadData(true)}
            disabled={refreshing || loading}
            className="gap-2 rounded-xl"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            <span>Обновить</span>
          </Button>

          <Button
            size="sm"
            onClick={handleTriggerRun}
            disabled={isRunningCharges}
            className="gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-white font-bold shadow-sm"
          >
            <Play className="h-4 w-4 fill-current" />
            <span>{isRunningCharges ? "Списание идёт..." : "Запустить списание"}</span>
          </Button>
        </div>
      </div>

      {/* Карточки KPI и ключевых метрик */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Карточка 1: Активные подписки */}
        <Card className="rounded-2xl border-slate-200/80 dark:border-slate-800 shadow-xs relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-sky-500/10 rounded-full blur-2xl pointer-events-none" />
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-semibold flex items-center justify-between">
              <span>Подключено автоплатежей</span>
              <Users className="h-4 w-4 text-sky-500" />
            </CardDescription>
            <CardTitle className="text-3xl font-black text-slate-900 dark:text-white font-mono">
              {stats?.activeSubscriptions ?? 0}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-1">
            <div className="flex justify-between items-center">
              <span>Конверсия базы:</span>
              <span className="font-bold text-sky-600 dark:text-sky-400">{stats?.conversionPercent ?? 0}%</span>
            </div>
            <div className="flex justify-between items-center">
              <span>Отключено жильцами:</span>
              <span className="font-medium">{stats?.inactiveSubscriptions ?? 0}</span>
            </div>
          </CardContent>
        </Card>

        {/* Карточка 2: Списано за текущий месяц */}
        <Card className="rounded-2xl border-slate-200/80 dark:border-slate-800 shadow-xs relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-semibold flex items-center justify-between">
              <span>Списано в этом месяце ({stats?.currentPeriod || "период"})</span>
              <TrendingUp className="h-4 w-4 text-emerald-500" />
            </CardDescription>
            <CardTitle className="text-3xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
              {formatMoney(stats?.currentMonthCharged)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-1">
            <div className="flex justify-between items-center">
              <span>Успешных транзакций:</span>
              <span className="font-bold text-foreground">{stats?.currentMonthChargesCount ?? 0} шт.</span>
            </div>
            <div className="flex justify-between items-center">
              <span>Дата списания:</span>
              <span className="font-medium text-slate-700 dark:text-slate-300">4-е число (автоматически)</span>
            </div>
          </CardContent>
        </Card>

        {/* Карточка 3: Ожидаемый сбор / мес */}
        <Card className="rounded-2xl border-slate-200/80 dark:border-slate-800 shadow-xs relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-semibold flex items-center justify-between">
              <span>Ожидаемый сбор в месяц</span>
              <CreditCard className="h-4 w-4 text-amber-500" />
            </CardDescription>
            <CardTitle className="text-3xl font-black text-amber-600 dark:text-amber-400 font-mono">
              {formatMoney(stats?.expectedMonthly)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-1">
            <div className="flex justify-between items-center">
              <span>По активным тарифам:</span>
              <span className="font-bold text-foreground">{stats?.activeSubscriptions ?? 0} счетов</span>
            </div>
            <div className="flex justify-between items-center">
              <span>Оборот за всё время:</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatMoney(stats?.allTimeCharged)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Карточка 4: Качество транзакций */}
        <Card className="rounded-2xl border-slate-200/80 dark:border-slate-800 shadow-xs relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/10 rounded-full blur-2xl pointer-events-none" />
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-semibold flex items-center justify-between">
              <span>Успешность списаний</span>
              <ShieldCheck className="h-4 w-4 text-purple-500" />
            </CardDescription>
            <CardTitle className="text-3xl font-black text-slate-900 dark:text-white font-mono">
              {stats?.succeededCount ?? 0}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-1">
            <div className="flex justify-between items-center">
              <span>Ошибок банка / отмен:</span>
              <span className={`font-bold ${(stats?.failedCount ?? 0) > 0 ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground"}`}>
                {stats?.failedCount ?? 0}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span>В обработке ЮKassa:</span>
              <span className="font-bold text-amber-600">{stats?.processingCount ?? 0}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Панель вкладок: Подписчики и Журнал списаний */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <TabsList className="rounded-xl p-1 bg-muted/60">
            <TabsTrigger value="subscribers" className="rounded-lg gap-2 text-xs font-bold">
              <Users className="h-3.5 w-3.5" />
              <span>Абоненты с автоплатежом ({subscribers.length})</span>
            </TabsTrigger>
            <TabsTrigger value="charges" className="rounded-lg gap-2 text-xs font-bold">
              <Receipt className="h-3.5 w-3.5" />
              <span>Журнал списаний ({charges.length})</span>
            </TabsTrigger>
          </TabsList>

          {/* Поиск и быстрые фильтры */}
          <div className="flex items-center gap-2">
            <div className="relative w-64 sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Поиск по счёту, ФИО, адресу..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-xs rounded-xl"
              />
            </div>

            {activeTab === "subscribers" && (
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="h-9 px-2.5 rounded-xl border border-input bg-background text-xs font-medium"
              >
                <option value="all">Все статусы</option>
                <option value="active">Только активные</option>
                <option value="inactive">Только отключенные</option>
              </select>
            )}
          </div>
        </div>

        {/* Вкладка 1: Таблица абонентов с автоплатежом */}
        <TabsContent value="subscribers">
          <Card className="rounded-2xl border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/40 border-b border-border/50 text-muted-foreground font-semibold">
                  <tr>
                    <th className="py-3 px-4">Лицевой счёт</th>
                    <th className="py-3 px-4">Абонент и адрес</th>
                    <th className="py-3 px-4">Привязанная карта</th>
                    <th className="py-3 px-4">Тариф</th>
                    <th className="py-3 px-4">Списано всего</th>
                    <th className="py-3 px-4">Последнее списание</th>
                    <th className="py-3 px-4">Статус</th>
                    <th className="py-3 px-4 text-right">Действие</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {filteredSubscribers.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-muted-foreground">
                        <CreditCard className="h-8 w-8 mx-auto mb-2 opacity-30" />
                        <p className="font-medium">Абоненты с автоплатежом не найдены</p>
                        <p className="text-[11px] mt-0.5">Попробуйте изменить поисковый запрос или фильтр</p>
                      </td>
                    </tr>
                  ) : (
                    filteredSubscribers.map((sub) => (
                      <tr key={sub.id} className="hover:bg-muted/20 transition-colors">
                        {/* Лицевой счёт */}
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-900 dark:text-white">
                          № {sub.account_number}
                        </td>

                        {/* Абонент и адрес */}
                        <td className="py-3.5 px-4 max-w-[240px]">
                          <div className="font-semibold text-foreground truncate">{sub.full_name}</div>
                          <div className="text-[11px] text-muted-foreground truncate">{sub.address || "Адрес не указан"}</div>
                          {sub.phone && (
                            <div className="text-[10px] text-slate-500 font-mono mt-0.5 flex items-center gap-1">
                              <Phone className="h-2.5 w-2.5 text-emerald-500" />
                              <span>{sub.phone}</span>
                            </div>
                          )}
                        </td>

                        {/* Карта */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5 font-mono font-medium">
                            <CreditCard className="h-3.5 w-3.5 text-sky-500 shrink-0" />
                            <span>•••• {sub.card_last4 || "карта"}</span>
                          </div>
                          <div className="text-[10px] text-muted-foreground uppercase">{sub.card_type || "банковская карта"}</div>
                        </td>

                        {/* Тариф */}
                        <td className="py-3.5 px-4">
                          <span className="font-bold text-foreground">{sub.tariff_price ? `${sub.tariff_price} ₽/мес` : "70 ₽/мес"}</span>
                          {sub.tariff_name && <div className="text-[10px] text-muted-foreground truncate">{sub.tariff_name}</div>}
                        </td>

                        {/* Всего списано */}
                        <td className="py-3.5 px-4 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          {formatMoney(sub.total_charged)}
                        </td>

                        {/* Последнее списание */}
                        <td className="py-3.5 px-4">
                          {sub.last_charge_at ? (
                            <div>
                              <div className="font-semibold text-foreground">{formatMoney(sub.last_charge_amount)}</div>
                              <div className="text-[10px] text-muted-foreground">{formatDate(sub.last_charge_at)}</div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-[11px]">Ещё не списано</span>
                          )}
                        </td>

                        {/* Статус подписки */}
                        <td className="py-3.5 px-4">
                          {sub.is_active ? (
                            <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 gap-1 font-semibold">
                              <Zap className="h-3 w-3 fill-current text-amber-500" />
                              Активен
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-slate-400 border-slate-300 dark:border-slate-700">
                              Отключен
                            </Badge>
                          )}
                        </td>

                        {/* Действие: История списаний */}
                        <td className="py-3.5 px-4 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenSubscriberDetails(sub)}
                            className="h-8 px-2.5 text-xs text-sky-600 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-950/40 rounded-xl gap-1"
                          >
                            <span>История</span>
                            <ChevronRight className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* Вкладка 2: Журнал всех списаний ЮKassa */}
        <TabsContent value="charges">
          <Card className="rounded-2xl border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/40 border-b border-border/50 text-muted-foreground font-semibold">
                  <tr>
                    <th className="py-3 px-4">Дата и время</th>
                    <th className="py-3 px-4">Период</th>
                    <th className="py-3 px-4">Лицевой счёт и абонент</th>
                    <th className="py-3 px-4">Сумма списания</th>
                    <th className="py-3 px-4">Карта</th>
                    <th className="py-3 px-4">Статус ЮKassa</th>
                    <th className="py-3 px-4">ID транзакции и примечание</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {filteredCharges.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-muted-foreground">
                        <Receipt className="h-8 w-8 mx-auto mb-2 opacity-30" />
                        <p className="font-medium">Записи о списаниях отсутствуют</p>
                        <p className="text-[11px] mt-0.5">Списания будут отражаться здесь автоматически 4-го числа каждого месяца</p>
                      </td>
                    </tr>
                  ) : (
                    filteredCharges.map((charge) => (
                      <tr key={charge.id} className="hover:bg-muted/20 transition-colors">
                        {/* Дата */}
                        <td className="py-3.5 px-4 font-mono text-muted-foreground">
                          {formatDate(charge.created_at)}
                        </td>

                        {/* Период */}
                        <td className="py-3.5 px-4 font-bold text-foreground font-mono">
                          {charge.period}
                        </td>

                        {/* Абонент */}
                        <td className="py-3.5 px-4 max-w-[220px]">
                          <div className="font-mono font-bold text-foreground">№ {charge.account_number}</div>
                          <div className="text-[11px] text-muted-foreground truncate">{charge.full_name}</div>
                          <div className="text-[10px] text-slate-400 truncate">{charge.address}</div>
                        </td>

                        {/* Сумма */}
                        <td className="py-3.5 px-4 font-mono font-bold text-base text-slate-900 dark:text-white">
                          {formatMoney(charge.amount)}
                        </td>

                        {/* Карта */}
                        <td className="py-3.5 px-4 font-mono text-xs">
                          •••• {charge.card_last4 || "карта"}
                        </td>

                        {/* Статус */}
                        <td className="py-3.5 px-4">
                          {renderStatusBadge(charge.status)}
                        </td>

                        {/* Детали */}
                        <td className="py-3.5 px-4 max-w-[240px]">
                          {charge.yookassa_payment_id && (
                            <div className="font-mono text-[10px] text-muted-foreground truncate" title={charge.yookassa_payment_id}>
                              ID: {charge.yookassa_payment_id}
                            </div>
                          )}
                          <div className="text-[11px] text-slate-600 dark:text-slate-300 leading-snug">
                            {charge.detail || "Автоматическое списание ТО домофона"}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Модальное окно детализации абонента */}
      <Dialog open={!!selectedSubscriber} onOpenChange={(open) => !open && setSelectedSubscriber(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-6 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <Zap className="h-5 w-5 text-amber-500 fill-amber-500" />
              <span>Автоплатёж абонента № {selectedSubscriber?.account_number}</span>
            </DialogTitle>
            <DialogDescription>
              {selectedSubscriber?.full_name} · {selectedSubscriber?.address}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 py-2">
            {/* Карточка параметров подписки */}
            <div className="p-4 rounded-xl border bg-muted/40 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <span className="text-muted-foreground block">Привязанная карта:</span>
                <span className="font-bold text-foreground font-mono flex items-center gap-1 mt-0.5">
                  <CreditCard className="h-3.5 w-3.5 text-sky-500" />
                  •••• {selectedSubscriber?.card_last4 || "карта"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block">Тариф абонплаты:</span>
                <span className="font-bold text-foreground mt-0.5 block">
                  {selectedSubscriber?.tariff_price ? `${selectedSubscriber.tariff_price} ₽/мес` : "70 ₽/мес"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block">Дата подключения:</span>
                <span className="font-medium text-foreground mt-0.5 block">
                  {formatDate(selectedSubscriber?.created_at)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block">Статус автоплатежа:</span>
                <span className="mt-0.5 block">
                  {selectedSubscriber?.is_active ? (
                    <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">Активен</Badge>
                  ) : (
                    <Badge variant="outline">Отключен</Badge>
                  )}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block">Всего списано:</span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm mt-0.5 block">
                  {formatMoney(selectedSubscriber?.total_charged)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block">Текущий долг в 1С:</span>
                <span className="font-mono font-bold text-foreground mt-0.5 block">
                  {formatMoney(selectedSubscriber?.debt_amount)}
                </span>
              </div>
            </div>

            {/* Таблица истории списаний этого абонента */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                <Receipt className="h-3.5 w-3.5" />
                <span>История списаний лицевого счёта</span>
              </h4>

              {loadingSubscriberDetails ? (
                <div className="py-8 text-center text-xs text-muted-foreground">Загрузка истории списаний...</div>
              ) : subscriberCharges.length === 0 ? (
                <div className="py-6 text-center text-xs text-muted-foreground border rounded-xl bg-slate-50/50 dark:bg-slate-900/50">
                  Списаний по этому счёту ещё не проводилось. Первое списание произойдет 4-го числа.
                </div>
              ) : (
                <div className="border rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted/40 border-b border-border/50 text-muted-foreground font-semibold">
                      <tr>
                        <th className="py-2.5 px-3">Дата</th>
                        <th className="py-2.5 px-3">Период</th>
                        <th className="py-2.5 px-3">Сумма</th>
                        <th className="py-2.5 px-3">Статус</th>
                        <th className="py-2.5 px-3">Детали</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {subscriberCharges.map((c) => (
                        <tr key={c.id}>
                          <td className="py-2.5 px-3 font-mono text-muted-foreground">{formatDate(c.created_at)}</td>
                          <td className="py-2.5 px-3 font-bold font-mono">{c.period}</td>
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-900 dark:text-white">{formatMoney(c.amount)}</td>
                          <td className="py-2.5 px-3">{renderStatusBadge(c.status)}</td>
                          <td className="py-2.5 px-3 text-[11px] text-muted-foreground">{c.detail || "ТО домофона"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="pt-2 border-t">
            <Button variant="outline" onClick={() => setSelectedSubscriber(null)}>
              Закрыть
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AutopayAnalytics;
