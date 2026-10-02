import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import {
  Loader2, ShieldCheck, Home, Rocket, Wrench, Sparkles, Database, Code2,
  TrendingUp, Calendar, Lock, FileText, Building2, Scale, Printer, Search,
  Filter, Layers, CheckCircle2, DollarSign, Award, Clock, ArrowRight, GitCommit,
  GitBranch, Laptop, Cpu, Check, SlidersHorizontal, Moon, Sun, Sunrise, Sunset,
  AlertTriangle, ChevronLeft, ChevronRight, X, Bot, Server, Flag
} from "lucide-react";
import {
  SUPERADMIN_EMAIL, OWNER,
  JUNIOR_HOURLY_RATE, MARKET_HOURLY_RATE,
  JUNIOR_BASE_COST, MARKET_BASE_COST,
  PROJECT_START, GITHUB_FIRST_COMMIT_DATE, GITHUB_FIRST_COMMIT_HASH,
  TOTAL_GIT_COMMITS, TOTAL_MONTHS_DEV,
  EXPENSES_GEMINI_MONTHLY, EXPENSES_CLAUDE_MONTHLY, EXPENSES_VPN_SERVER_MONTHLY,
  EXPENSES_TOTAL_MONTHLY, EXPENSES_TOTAL_PERIOD, EXPENSES_NOTE,
  PROJECT_CHANGELOG, MODULE_META, KIND_META, Kind, ProjectModule, ProjectEntry
} from "@/data/projectChangelog";
import {
  GIT_AUDIT_SUMMARY, CALENDAR_DAYS, ALL_AUDIT_COMMITS, RUSSIAN_HOLIDAYS_MAP,
  CommitAuditItem, DayAudit, TimeCategory
} from "@/data/gitCommitAudit";

// Вспомогательная функция форматирования рублей
const rub = (n: number) => Math.round(n).toLocaleString("ru-RU") + " ₽";

// Режим отображения стоимости
type PricingMode = "junior" | "market" | "compare";

// Фильтр списка коммитов аудита
type AuditCommitFilter = "all" | "off_hours" | "work_hours";

const Project: React.FC = () => {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);

  // Режим оценки: 'junior' (минимальная ставка), 'market' (рыночная), 'compare' (сравнение)
  const [pricingMode, setPricingMode] = useState<PricingMode>("compare");

  // Интерактивная пользовательская ставка для калькулятора (по умолчанию 750 ₽/ч)
  const [customRate, setCustomRate] = useState<number>(JUNIOR_HOURLY_RATE);

  // Фильтры и поиск по общему реестру этапов changelog
  const [search, setSearch] = useState("");
  const [selectedKind, setSelectedKind] = useState<string>("all");
  const [selectedModule, setSelectedModule] = useState<string>("all");

  // --------------------------------------------------------------------------
  // Стейты для юридического календаря и аудита времени
  // --------------------------------------------------------------------------
  // Выбранный месяц для календаря в формате "YYYY-MM"
  const [selectedMonth, setSelectedMonth] = useState<string>("2026-10");
  // Выбранный день в календаре (при клике показываем поминутный список коммитов)
  const [selectedDayDate, setSelectedDayDate] = useState<string | null>(null);
  // Фильтр коммитов в таблице аудита
  const [auditFilter, setAuditFilter] = useState<AuditCommitFilter>("all");
  const [auditSearch, setAuditSearch] = useState<string>("");

  // Список всех месяцев разработки платформы (с октября 2025 по октябрь 2026)
  const availableMonths = useMemo(() => [
    { key: "2025-10", label: "Октябрь 2025 (Старт проекта 14.10)" },
    { key: "2025-11", label: "Ноябрь 2025 (Праздник 4 ноября)" },
    { key: "2025-12", label: "Декабрь 2025 (Новый год 31.12)" },
    { key: "2026-01", label: "Январь 2026 (Новогодние каникулы 1–8 янв)" },
    { key: "2026-02", label: "Февраль 2026 (Праздник 23 февраля)" },
    { key: "2026-03", label: "Март 2026 (Праздник 8 марта)" },
    { key: "2026-04", label: "Апрель 2026 (Пик разработки)" },
    { key: "2026-05", label: "Май 2026 (Праздники 1–4 и 9–11 мая)" },
    { key: "2026-06", label: "Июнь 2026 (День России 12 июня)" },
    { key: "2026-07", label: "Июль 2026" },
    { key: "2026-08", label: "Август 2026" },
    { key: "2026-09", label: "Сентябрь 2026 (Монтаж, ЮKassa)" },
    { key: "2026-10", label: "Октябрь 2026 (Аналитика, 1 год)" },
  ], []);

  // СТРОГАЯ ЗАЩИТА ДОСТУПА: доступ открыт ТОЛЬКО суперадмину viruscorp4@gmail.com
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const email = (user?.email || "").toLowerCase().trim();
        let isSuperadmin = email === SUPERADMIN_EMAIL;

        if (!isSuperadmin && user) {
          try {
            const { data } = await supabase
              .from("user_roles")
              .select("role")
              .eq("user_id", user.id)
              .eq("role", "superadmin")
              .limit(1);
            isSuperadmin = !!(data && data.length > 0);
          } catch {
            isSuperadmin = false;
          }
        }

        if (cancelled) return;
        if (!isSuperadmin) {
          console.warn("[Project Guard] Доступ запрещен для пользователя:", email);
          navigate("/", { replace: true });
          return;
        }

        setAllowed(true);
      } catch (e) {
        console.error("[Project Guard] Ошибка верификации доступа:", e);
        if (!cancelled) navigate("/", { replace: true });
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  // Расчет суммарной аналитики и двух моделей оценки (Junior vs Рынок)
  const stats = useMemo(() => {
    const items = PROJECT_CHANGELOG.map(e => ({
      ...e,
      juniorCost: e.hours * JUNIOR_HOURLY_RATE,
      marketCost: e.hours * MARKET_HOURLY_RATE,
      customCost: e.hours * customRate,
    }));

    const totalHours = items.reduce((sum, e) => sum + e.hours, 0);

    // Стоимости по минимальной ставке (Junior)
    const juniorDevCost = items.reduce((sum, e) => sum + e.juniorCost, 0);
    const juniorBaseCost = JUNIOR_BASE_COST;
    const juniorTotal = juniorBaseCost + juniorDevCost;

    // Стоимости по рыночной ставке (Студия / Senior)
    const marketDevCost = items.reduce((sum, e) => sum + e.marketCost, 0);
    const marketBaseCost = MARKET_BASE_COST;
    const marketTotal = marketBaseCost + marketDevCost;

    // Стоимость по кастомной интерактивной ставке ползунка
    const customDevCost = items.reduce((sum, e) => sum + e.customCost, 0);
    const customBaseRatio = customRate / JUNIOR_HOURLY_RATE;
    const customTotal = (juniorBaseCost * customBaseRatio) + customDevCost;

    // Экономия (разница между рынком и минимальной оценкой)
    const diff = marketTotal - juniorTotal;
    const diffPercent = Math.round((diff / marketTotal) * 100);

    // Распределение по категориям
    const byKind: Record<Kind, { hours: number; juniorCost: number; marketCost: number; count: number }> = {
      feature: { hours: 0, juniorCost: 0, marketCost: 0, count: 0 },
      improvement: { hours: 0, juniorCost: 0, marketCost: 0, count: 0 },
      fix: { hours: 0, juniorCost: 0, marketCost: 0, count: 0 },
      infra: { hours: 0, juniorCost: 0, marketCost: 0, count: 0 },
    };

    // Распределение по модулям
    const byModule: Record<string, { hours: number; juniorCost: number; marketCost: number; count: number }> = {};

    items.forEach(e => {
      byKind[e.kind].hours += e.hours;
      byKind[e.kind].juniorCost += e.juniorCost;
      byKind[e.kind].marketCost += e.marketCost;
      byKind[e.kind].count += 1;

      if (!byModule[e.module]) {
        byModule[e.module] = { hours: 0, juniorCost: 0, marketCost: 0, count: 0 };
      }
      byModule[e.module].hours += e.hours;
      byModule[e.module].juniorCost += e.juniorCost;
      byModule[e.module].marketCost += e.marketCost;
      byModule[e.module].count += 1;
    });

    return {
      items,
      totalHours,
      juniorTotal,
      juniorDevCost,
      juniorBaseCost,
      marketTotal,
      marketDevCost,
      marketBaseCost,
      customTotal,
      diff,
      diffPercent,
      byKind,
      byModule,
    };
  }, [customRate]);

  // Фильтрованный список задач в общем changelog
  const filteredItems = useMemo(() => {
    return stats.items.filter(item => {
      const matchSearch = !search.trim() || 
        item.title.toLowerCase().includes(search.toLowerCase()) ||
        item.description.toLowerCase().includes(search.toLowerCase()) ||
        item.datetime.includes(search);
      
      const matchKind = selectedKind === "all" || item.kind === selectedKind;
      const matchModule = selectedModule === "all" || item.module === selectedModule;

      return matchSearch && matchKind && matchModule;
    });
  }, [stats.items, search, selectedKind, selectedModule]);

  // --------------------------------------------------------------------------
  // Логика календаря: генерация сетки с учетом официальных праздников РФ
  // --------------------------------------------------------------------------
  const calendarGrid = useMemo(() => {
    const [yearStr, monthStr] = selectedMonth.split("-");
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10); // 1-12

    // Количество дней в месяце
    const daysInMonth = new Date(year, month, 0).getDate();
    // День недели первого дня месяца (0=Вс, 1=Пн, ... 6=Сб) -> переводим в 0=Пн, 6=Вс
    const firstDayWeekdayRaw = new Date(year, month - 1, 1).getDay();
    const firstDayOffset = (firstDayWeekdayRaw + 6) % 7; // Сдвиг для Пн=0

    // Карта данных по датам из CALENDAR_DAYS
    const daysDataMap = new Map<string, DayAudit>();
    CALENDAR_DAYS.forEach(d => daysDataMap.set(d.date, d));

    const cells: Array<{
      dayNum: number | null;
      dateStr: string | null;
      data: DayAudit | null;
      isWeekend: boolean;
      isHoliday: boolean;
      holidayName: string | null;
    }> = [];

    // Пустые ячейки до 1-го числа
    for (let i = 0; i < firstDayOffset; i++) {
      cells.push({ dayNum: null, dateStr: null, data: null, isWeekend: false, isHoliday: false, holidayName: null });
    }

    // Дни месяца
    for (let day = 1; day <= daysInMonth; day++) {
      const dayStr = String(day).padStart(2, "0");
      const dateStr = `${yearStr}-${monthStr}-${dayStr}`;
      const dayOfWeekRaw = new Date(year, month - 1, day).getDay();
      const isWeekend = dayOfWeekRaw === 0 || dayOfWeekRaw === 6; // Вс или Сб

      const holidayName = RUSSIAN_HOLIDAYS_MAP[dateStr] || null;
      const isHoliday = !!holidayName;

      const data = daysDataMap.get(dateStr) || null;
      cells.push({
        dayNum: day,
        dateStr,
        data,
        isWeekend,
        isHoliday,
        holidayName,
      });
    }

    return cells;
  }, [selectedMonth]);

  // Данные выбранного в календаре дня
  const activeDayData = useMemo(() => {
    if (!selectedDayDate) return null;
    return CALENDAR_DAYS.find(d => d.date === selectedDayDate) || null;
  }, [selectedDayDate]);

  // Фильтрованный список коммитов для таблицы аудита
  const filteredAuditCommits = useMemo(() => {
    return ALL_AUDIT_COMMITS.filter(item => {
      // Фильтр по типу времени
      if (auditFilter === "off_hours" && item.isWorkTime) return false;
      if (auditFilter === "work_hours" && !item.isWorkTime) return false;

      // Поиск
      if (auditSearch.trim()) {
        const q = auditSearch.toLowerCase();
        const match = item.hash.toLowerCase().includes(q) ||
          item.datetime.includes(q) ||
          item.subject.toLowerCase().includes(q) ||
          item.catLabel.toLowerCase().includes(q) ||
          item.dayOfWeek.toLowerCase().includes(q);
        if (!match) return false;
      }

      return true;
    });
  }, [auditFilter, auditSearch]);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!allowed) return null;

  return (
    <div className="min-h-screen bg-background print:bg-white text-foreground">
      {/* Стили для чистой печати сводки на лист А4 */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; color: black !important; font-size: 10pt; }
          .print-break { page-break-after: always; }
          .card-print { border: 1px solid #ddd !important; box-shadow: none !important; }
        }
      `}</style>

      <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        
        {/* Шапка дашборда */}
        <div className="flex items-center justify-between flex-wrap gap-4 no-print border-b border-border/40 pb-5">
          <div>
            <div className="flex items-center gap-2.5">
              <Badge className="bg-primary/10 text-primary border-primary/20 text-xs px-2.5 py-0.5 font-bold">
                🛠️ ЛИЧНЫЙ ИНЖЕНЕРНЫЙ ПАСПОРТ
              </Badge>
              <span className="text-xs text-muted-foreground font-mono">АВТОР: МОЖНОВ В. С.</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight mt-1.5 flex items-center gap-2">
              <Code2 className="h-7 w-7 text-primary shrink-0" />
              Дневник разработки и аналитический паспорт «Домофондар»
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Персональный учет времени: точный старт <b>14 октября 2025 г. в 02:26</b> (ночь), 542 коммита и аудит нерабочих часов по производственному календарю РФ.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <Button 
              variant="outline" 
              onClick={() => window.print()}
              className="gap-1.5 rounded-xl border-border/60 hover:bg-muted font-semibold text-xs h-10 px-4"
            >
              <Printer className="h-4 w-4" />
              Печать в PDF (А4)
            </Button>
            <Button 
              onClick={() => navigate("/cabinet")} 
              className="gap-1.5 rounded-xl btn-premium-gold font-bold text-xs h-10 px-4"
            >
              <Home className="h-4 w-4" />
              В кабинет
            </Button>
          </div>
        </div>

        {/* ================================================================== */}
        {/* ГЛАВНЫЙ БЛОК: ЮРИДИЧЕСКИЙ АУДИТ ВНЕРАБОЧЕГО ВРЕМЕНИ И КАЛЕНДАРЬ     */}
        {/* ================================================================== */}
        <Card className="rounded-2xl border-2 border-primary/40 bg-gradient-to-b from-primary/5 via-background to-background shadow-md card-print text-left overflow-hidden">
          <CardHeader className="pb-4 border-b border-border/40 bg-muted/20">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="space-y-1">
                <CardTitle className="text-lg sm:text-xl font-black flex items-center gap-2">
                  <ShieldCheck className="h-6 w-6 text-emerald-600 shrink-0" />
                  Юридический аудит времени: Разработка во внерабочие часы
                </CardTitle>
                <CardDescription className="text-xs">
                  Поминутный анализ всех <b>542 коммитов</b> Git с учетом <b>официального производственного календаря РФ</b> (праздники 1–8 янв, 23 фев, 8 мар, 1–4 мая, 9–11 мая, 12 июня, сб/вс).
                </CardDescription>
              </div>

              <div className="flex items-center gap-2">
                <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-400/30 text-xs px-2.5 py-1 font-bold">
                  🟢 {GIT_AUDIT_SUMMARY.offHours} ч ({GIT_AUDIT_SUMMARY.offPct}%) вне работы
                </Badge>
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-5 space-y-6">
            
            {/* Ключевые метрики распределения часов */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              {/* Внерабочее время (Личное) */}
              <div className="p-4 rounded-xl border-2 border-emerald-500/40 bg-emerald-500/5 space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold text-emerald-700 dark:text-emerald-300">
                  <span className="flex items-center gap-1.5">
                    <Moon className="h-4 w-4" />
                    Внерабочее (Личное) время
                  </span>
                  <span className="font-mono text-sm">{GIT_AUDIT_SUMMARY.offPct}%</span>
                </div>
                <p className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                  {GIT_AUDIT_SUMMARY.offHours} <span className="text-sm font-semibold">часов</span>
                </p>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  <b>{GIT_AUDIT_SUMMARY.offCommits} из 542 коммитов</b> сделаны в праздничные дни РФ (1–4 мая, 9–11 мая, новогодние каникулы), субботы, воскресенья, ночи и вечера.
                </p>
              </div>

              {/* Рабочее окно (Обычные будни 09:00 - 17:00) */}
              <div className="p-4 rounded-xl border border-border/60 bg-muted/20 space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold text-amber-700 dark:text-amber-300">
                  <span className="flex items-center gap-1.5">
                    <Sun className="h-4 w-4" />
                    Рабочее окно (Будни 09–17)
                  </span>
                  <span className="font-mono text-sm">{GIT_AUDIT_SUMMARY.workPct}%</span>
                </div>
                <p className="text-2xl sm:text-3xl font-black text-foreground font-mono">
                  {GIT_AUDIT_SUMMARY.workHours} <span className="text-sm font-semibold">часов</span>
                </p>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  <b>{GIT_AUDIT_SUMMARY.workCommits} коммитов</b> (точечные хотфиксы, обеденное время, отпуска). Зафиксированы с точностью до минуты.
                </p>
              </div>

              {/* Точка старта */}
              <div className="p-4 rounded-xl border border-border/60 bg-muted/20 space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold text-primary">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="h-4 w-4" />
                    Первый коммит проекта
                  </span>
                  <span className="font-mono text-xs">{GITHUB_FIRST_COMMIT_HASH}</span>
                </div>
                <p className="text-xl sm:text-2xl font-black text-primary font-mono pt-0.5">
                  14.10.2025 <span className="text-sm">02:26</span>
                </p>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  Проект начат <b>глубокой ночью в 02:26</b> во вторник, 14 октября 2025 года (нерабочее время).
                </p>
              </div>
            </div>

            {/* Визуальная шкала соотношения времени */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                  Личное время: {GIT_AUDIT_SUMMARY.offHours} ч ({GIT_AUDIT_SUMMARY.offPct}%)
                </span>
                <span className="font-bold flex items-center gap-1.5 text-amber-700 dark:text-amber-300">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
                  Рабочее окно: {GIT_AUDIT_SUMMARY.workHours} ч ({GIT_AUDIT_SUMMARY.workPct}%)
                </span>
              </div>

              <div className="h-4 rounded-full bg-muted overflow-hidden flex shadow-inner">
                <div 
                  className="h-full bg-emerald-500 transition-all duration-500" 
                  style={{ width: `${GIT_AUDIT_SUMMARY.offPct}%` }}
                  title={`Внерабочее время: ${GIT_AUDIT_SUMMARY.offHours} ч (${GIT_AUDIT_SUMMARY.offPct}%)`}
                />
                <div 
                  className="h-full bg-amber-500/80 transition-all duration-500" 
                  style={{ width: `${GIT_AUDIT_SUMMARY.workPct}%` }}
                  title={`Рабочее окно: ${GIT_AUDIT_SUMMARY.workHours} ч (${GIT_AUDIT_SUMMARY.workPct}%)`}
                />
              </div>
            </div>

            {/* Детализация по 6 категориям (включая государственные праздники РФ) */}
            <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-xs">
              {/* Праздники РФ */}
              <div className="p-2.5 rounded-xl border border-rose-500/40 bg-rose-500/10 space-y-1">
                <span className="text-[10px] text-rose-700 dark:text-rose-300 font-bold flex items-center gap-1">
                  <Flag className="h-3 w-3 text-rose-600 shrink-0" /> Праздники РФ
                </span>
                <p className="font-mono font-black text-rose-600 dark:text-rose-400">
                  {GIT_AUDIT_SUMMARY.byCategory.holiday.hours} ч
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {GIT_AUDIT_SUMMARY.byCategory.holiday.count} коммитов
                </p>
              </div>

              {/* Выходные */}
              <div className="p-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/5 space-y-1">
                <span className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1">
                  <Calendar className="h-3 w-3 text-emerald-600 shrink-0" /> Выходные (Сб/Вс)
                </span>
                <p className="font-mono font-bold text-foreground">
                  {GIT_AUDIT_SUMMARY.byCategory.weekend.hours} ч
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {GIT_AUDIT_SUMMARY.byCategory.weekend.count} коммитов
                </p>
              </div>

              {/* Ночь */}
              <div className="p-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/5 space-y-1">
                <span className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1">
                  <Moon className="h-3 w-3 text-emerald-600 shrink-0" /> Ночь (00–06)
                </span>
                <p className="font-mono font-bold text-foreground">
                  {GIT_AUDIT_SUMMARY.byCategory.night.hours} ч
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {GIT_AUDIT_SUMMARY.byCategory.night.count} коммитов
                </p>
              </div>

              {/* Утро */}
              <div className="p-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/5 space-y-1">
                <span className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1">
                  <Sunrise className="h-3 w-3 text-emerald-600 shrink-0" /> Утро (06–09)
                </span>
                <p className="font-mono font-bold text-foreground">
                  {GIT_AUDIT_SUMMARY.byCategory.morning.hours} ч
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {GIT_AUDIT_SUMMARY.byCategory.morning.count} коммитов
                </p>
              </div>

              {/* Вечер */}
              <div className="p-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/5 space-y-1">
                <span className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1">
                  <Sunset className="h-3 w-3 text-emerald-600 shrink-0" /> Вечер (17–00)
                </span>
                <p className="font-mono font-bold text-foreground">
                  {GIT_AUDIT_SUMMARY.byCategory.evening.hours} ч
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {GIT_AUDIT_SUMMARY.byCategory.evening.count} коммитов
                </p>
              </div>

              {/* Будни */}
              <div className="p-2.5 rounded-xl border border-amber-500/30 bg-amber-500/5 space-y-1">
                <span className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1">
                  <Sun className="h-3 w-3 text-amber-600 shrink-0" /> Будни (09–17)
                </span>
                <p className="font-mono font-bold text-foreground">
                  {GIT_AUDIT_SUMMARY.byCategory.work_hours.hours} ч
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {GIT_AUDIT_SUMMARY.byCategory.work_hours.count} коммитов
                </p>
              </div>
            </div>

            {/* -------------------------------------------------------------- */}
            {/* ИНТЕРАКТИВНЫЙ КАЛЕНДАРЬ РАЗРАБОТКИ С ГОС. ПРАЗДНИКАМИ РФ       */}
            {/* -------------------------------------------------------------- */}
            <div className="pt-3 border-t border-border/40 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="text-sm font-bold flex items-center gap-2 text-foreground">
                  <Calendar className="h-4 w-4 text-primary" />
                  Интерактивный календарь с производственным календарем РФ
                </h3>

                {/* Выбор месяца */}
                <div className="flex items-center gap-2 no-print">
                  <select
                    value={selectedMonth}
                    onChange={e => {
                      setSelectedMonth(e.target.value);
                      setSelectedDayDate(null);
                    }}
                    className="h-8 text-xs rounded-xl border border-input bg-background px-3 font-semibold cursor-pointer"
                  >
                    {availableMonths.map(m => (
                      <option key={m.key} value={m.key}>{m.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Легенда цветов */}
              <div className="flex items-center gap-4 flex-wrap text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-rose-500 inline-block" />
                  Официальный государственный праздник РФ (Нерабочий день)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" />
                  Только внерабочее время (ночи/вечера или Сб/Вс)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-amber-500 inline-block" />
                  Есть коммиты в интервале 09:00–17:00 (обычные будни)
                </span>
                <span className="flex items-center gap-1.5 text-primary font-medium">
                  💡 Нажмите на день для поминутного протокола
                </span>
              </div>

              {/* Сетка календаря */}
              <div className="border border-border/50 rounded-xl overflow-hidden bg-background">
                {/* Дни недели */}
                <div className="grid grid-cols-7 text-center font-bold text-xs py-2 bg-muted/30 border-b border-border/40">
                  <span className="text-foreground">Пн</span>
                  <span className="text-foreground">Вт</span>
                  <span className="text-foreground">Ср</span>
                  <span className="text-foreground">Чт</span>
                  <span className="text-foreground">Пт</span>
                  <span className="text-rose-500 font-black">Сб</span>
                  <span className="text-rose-500 font-black">Вс</span>
                </div>

                {/* Ячейки дней */}
                <div className="grid grid-cols-7 gap-px bg-border/40">
                  {calendarGrid.map((cell, idx) => {
                    if (cell.dayNum === null) {
                      return <div key={`empty-${idx}`} className="bg-background min-h-[58px] opacity-25" />;
                    }

                    const hasData = !!cell.data;
                    const isSelected = selectedDayDate === cell.dateStr;
                    const hasWork = cell.data?.hasWorkCommits;

                    return (
                      <button
                        key={cell.dateStr}
                        type="button"
                        onClick={() => {
                          if (hasData) {
                            setSelectedDayDate(selectedDayDate === cell.dateStr ? null : cell.dateStr);
                          }
                        }}
                        className={`p-1.5 text-left min-h-[58px] transition-all flex flex-col justify-between relative ${
                          isSelected 
                            ? "ring-2 ring-primary bg-primary/10 z-10" 
                            : cell.isHoliday
                              ? "bg-rose-500/5 hover:bg-rose-500/10 cursor-pointer"
                              : hasData 
                                ? "bg-background hover:bg-muted/30 cursor-pointer" 
                                : "bg-background/60 opacity-60 cursor-default"
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className={`text-xs font-bold flex items-center gap-1 ${
                            cell.isHoliday 
                              ? "text-rose-600 dark:text-rose-400 font-black" 
                              : cell.isWeekend 
                                ? "text-rose-500" 
                                : "text-foreground"
                          }`}>
                            {cell.dayNum}
                            {cell.isHoliday && <Flag className="h-2.5 w-2.5 text-rose-500 inline shrink-0" />}
                          </span>

                          {hasData && (
                            <span className="text-[10px] font-mono text-muted-foreground font-bold">
                              {cell.data?.totalCommits} комм.
                            </span>
                          )}
                        </div>

                        {cell.isHoliday && (
                          <div className="text-[8px] text-rose-600 dark:text-rose-400 font-semibold truncate leading-tight mt-0.5" title={cell.holidayName || ""}>
                            {cell.holidayName?.split(" ")[0]}
                          </div>
                        )}

                        {hasData && (
                          <div className="mt-1">
                            {hasWork ? (
                              <Badge className="text-[9px] py-0 px-1 bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-400/40 w-full justify-center">
                                🟡 раб: {cell.data?.workHours}ч
                              </Badge>
                            ) : (
                              <Badge className="text-[9px] py-0 px-1 bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-400/40 w-full justify-center">
                                🟢 личн: {cell.data?.offHours}ч
                              </Badge>
                            )}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Детальный протокол выбранного дня */}
              {activeDayData && (
                <div className="p-4 rounded-xl border-2 border-primary/50 bg-primary/5 space-y-3 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <h4 className="text-sm font-bold text-foreground flex items-center gap-2 flex-wrap">
                        <span>📅 Протокол за {activeDayData.date} ({activeDayData.dayOfWeek})</span>
                        {activeDayData.isHoliday && (
                          <Badge className="text-[10px] bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-400/30">
                            🚩 {activeDayData.holidayName} (Нерабочий день РФ)
                          </Badge>
                        )}
                        {activeDayData.isWeekend && !activeDayData.isHoliday && (
                          <Badge variant="outline" className="text-[10px] text-rose-500 border-rose-300">
                            Выходной день
                          </Badge>
                        )}
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        Всего коммитов: <b>{activeDayData.totalCommits}</b> | Личное время: <b>{activeDayData.offHours} ч</b> | Рабочее окно: <b>{activeDayData.workHours} ч</b>
                      </p>
                    </div>

                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => setSelectedDayDate(null)}
                      className="h-7 w-7 p-0 rounded-full"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="divide-y divide-border/40 border border-border/40 rounded-lg overflow-hidden bg-background">
                    {activeDayData.commits.map((c, i) => (
                      <div key={c.hash + i} className="p-2.5 text-xs flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className="font-mono font-bold text-primary shrink-0">
                            ⏰ {c.time}
                          </span>
                          <span className="font-mono text-muted-foreground text-[11px] shrink-0">
                            [{c.hash}]
                          </span>
                          <span className="text-foreground truncate" title={c.subject}>
                            {c.subject}
                          </span>
                        </div>

                        <div className="shrink-0 flex items-center gap-2">
                          {c.isWorkTime ? (
                            <Badge className="text-[10px] bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-400/30">
                              🟡 {c.catLabel} (~{c.sessionMins} мин)
                            </Badge>
                          ) : (
                            <Badge className="text-[10px] bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-400/30">
                              🟢 {c.catLabel} (~{c.sessionMins} мин)
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* -------------------------------------------------------------- */}
            {/* ПОМИНУТНЫЙ РЕЕСТР КОММИТОВ С ФИЛЬТРОМ                          */}
            {/* -------------------------------------------------------------- */}
            <div className="pt-3 border-t border-border/40 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="text-sm font-bold flex items-center gap-2 text-foreground">
                  <FileText className="h-4 w-4 text-primary" />
                  Поминутный реестр коммитов (542 записи)
                </h3>

                <Badge variant="outline" className="text-xs font-mono">
                  {filteredAuditCommits.length} коммитов отобрано
                </Badge>
              </div>

              {/* Фильтры и поиск реестра аудита */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 no-print">
                <div className="relative">
                  <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={auditSearch}
                    onChange={e => setAuditSearch(e.target.value)}
                    placeholder="Поиск по хэшу, дате или названию..."
                    className="pl-8 text-xs h-9 rounded-xl"
                  />
                </div>

                <div className="grid grid-cols-3 gap-1 bg-muted/40 p-1 rounded-xl border border-border/40 col-span-2">
                  <button
                    type="button"
                    onClick={() => setAuditFilter("all")}
                    className={`text-xs py-1 rounded-lg font-bold transition-all ${
                      auditFilter === "all" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Все (542)
                  </button>

                  <button
                    type="button"
                    onClick={() => setAuditFilter("off_hours")}
                    className={`text-xs py-1 rounded-lg font-bold transition-all ${
                      auditFilter === "off_hours" ? "bg-emerald-500 text-white shadow-xs" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    🟢 Личное время (351)
                  </button>

                  <button
                    type="button"
                    onClick={() => setAuditFilter("work_hours")}
                    className={`text-xs py-1 rounded-lg font-bold transition-all ${
                      auditFilter === "work_hours" ? "bg-amber-500 text-white shadow-xs" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    🟡 Рабочие часы (191)
                  </button>
                </div>
              </div>

              {/* Таблица/список коммитов */}
              <div className="border border-border/40 rounded-xl overflow-hidden max-h-96 overflow-y-auto divide-y divide-border/30 bg-background text-xs">
                {filteredAuditCommits.length === 0 ? (
                  <div className="p-6 text-center text-muted-foreground">
                    Коммитов по заданным параметрам не найдено.
                  </div>
                ) : (
                  filteredAuditCommits.map((item, idx) => (
                    <div key={item.hash + idx} className="p-3 hover:bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="space-y-0.5 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-bold text-foreground">
                            📅 {item.datetime} ({item.dayShort})
                          </span>
                          <span className="font-mono text-primary font-bold text-[11px] bg-primary/10 px-1.5 py-0.5 rounded">
                            {item.hash}
                          </span>
                          {item.isHoliday ? (
                            <Badge className="text-[10px] py-0 px-1.5 bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-400/30">
                              🚩 {item.catLabel}
                            </Badge>
                          ) : item.isWorkTime ? (
                            <Badge className="text-[10px] py-0 px-1.5 bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-400/30">
                              🟡 {item.catLabel}
                            </Badge>
                          ) : (
                            <Badge className="text-[10px] py-0 px-1.5 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-400/30">
                              🟢 {item.catLabel}
                            </Badge>
                          )}
                          <span className="text-[10px] text-muted-foreground font-mono">
                            ~{item.sessionMins} мин
                          </span>
                        </div>
                        <p className="text-muted-foreground text-xs pt-0.5 truncate">
                          {item.subject}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

          </CardContent>
        </Card>

        {/* ================================================================== */}
        {/* ПРЯМЫЕ ФИНАНСОВЫЕ РАСХОДЫ АВТОРА (AI-ПОДПИСКИ И СЕРВЕРЫ)          */}
        {/* ================================================================== */}
        <Card className="rounded-2xl border-border/60 shadow-xs card-print text-left">
          <CardHeader className="pb-3 border-b border-border/30">
            <CardTitle className="text-base sm:text-lg font-bold flex items-center justify-between flex-wrap gap-2">
              <span className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-emerald-500 shrink-0" />
                Прямые финансовые расходы автора: AI-инструменты и серверная инфраструктура
              </span>
              <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-400/30 text-xs font-mono font-bold">
                {rub(EXPENSES_TOTAL_PERIOD)} за 12 месяцев
              </Badge>
            </CardTitle>
            <CardDescription className="text-xs">
              Регулярные ежемесячные оплаты из личных средств автора на обеспечение процесса разработки и независимости платформы.
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Gemini AI */}
              <div className="p-3.5 rounded-xl border border-border/60 bg-muted/15 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Bot className="h-4 w-4 text-blue-500" />
                    Gemini AI (Google)
                  </span>
                  <Badge variant="outline" className="text-[10px]">Подписка</Badge>
                </div>
                <p className="text-lg font-black font-mono text-primary pt-1">
                  {rub(EXPENSES_GEMINI_MONTHLY)} <span className="text-xs font-normal text-muted-foreground">/ мес</span>
                </p>
                <p className="text-[11px] text-muted-foreground">
                  За 12 месяцев: <b>{rub(EXPENSES_GEMINI_MONTHLY * TOTAL_MONTHS_DEV)}</b>
                </p>
              </div>

              {/* Claude AI */}
              <div className="p-3.5 rounded-xl border border-border/60 bg-muted/15 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Sparkles className="h-4 w-4 text-amber-500" />
                    Claude AI (Anthropic)
                  </span>
                  <Badge variant="outline" className="text-[10px]">Подписка</Badge>
                </div>
                <p className="text-lg font-black font-mono text-primary pt-1">
                  {rub(EXPENSES_CLAUDE_MONTHLY)} <span className="text-xs font-normal text-muted-foreground">/ мес</span>
                </p>
                <p className="text-[11px] text-muted-foreground">
                  За 12 месяцев: <b>{rub(EXPENSES_CLAUDE_MONTHLY * TOTAL_MONTHS_DEV)}</b>
                </p>
              </div>

              {/* VPN Server */}
              <div className="p-3.5 rounded-xl border border-border/60 bg-muted/15 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Server className="h-4 w-4 text-purple-500" />
                    Выделенный сервер VPN
                  </span>
                  <Badge variant="outline" className="text-[10px]">Инфраструктура</Badge>
                </div>
                <p className="text-lg font-black font-mono text-primary pt-1">
                  {rub(EXPENSES_VPN_SERVER_MONTHLY)} <span className="text-xs font-normal text-muted-foreground">/ мес</span>
                </p>
                <p className="text-[11px] text-muted-foreground">
                  За 12 месяцев: <b>{rub(EXPENSES_VPN_SERVER_MONTHLY * TOTAL_MONTHS_DEV)}</b>
                </p>
              </div>
            </div>

            {/* Итоговая полоса расходов */}
            <div className="p-3.5 rounded-xl bg-muted/30 border border-border/50 flex items-center justify-between flex-wrap gap-2 text-xs">
              <span className="text-muted-foreground">
                Суммарные прямые расходы в месяц: <b className="text-foreground">{rub(EXPENSES_TOTAL_MONTHLY)} / мес</b>
              </span>
              <span className="font-mono font-black text-emerald-600 dark:text-emerald-400 text-sm sm:text-base">
                Итого за 1 год разработки: {rub(EXPENSES_TOTAL_PERIOD)}
              </span>
            </div>

            {/* Юридическая сноска автора */}
            <p className="text-[11px] text-muted-foreground/80 leading-relaxed italic border-l-2 border-primary/40 pl-3">
              💡 <b>Заметка автора:</b> {EXPENSES_NOTE}
            </p>
          </CardContent>
        </Card>

        {/* Интерактивный переключатель режима расчета цен */}
        <Card className="no-print border-border/60 bg-muted/20 rounded-2xl shadow-xs">
          <CardContent className="p-3 sm:p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground w-full sm:w-auto">
              <Scale className="h-4 w-4 text-primary shrink-0" />
              <span>Режим расчета стоимости разработки:</span>
            </div>

            <div className="grid grid-cols-3 gap-1.5 w-full sm:w-auto bg-background/80 p-1 rounded-xl border border-border/50">
              <button
                type="button"
                onClick={() => setPricingMode("junior")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  pricingMode === "junior"
                    ? "bg-emerald-500 text-white shadow-xs"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                🌱 Минималка ({JUNIOR_HOURLY_RATE} ₽/ч)
              </button>

              <button
                type="button"
                onClick={() => setPricingMode("market")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  pricingMode === "market"
                    ? "bg-blue-600 text-white shadow-xs"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                🏢 Рынок ({MARKET_HOURLY_RATE} ₽/ч)
              </button>

              <button
                type="button"
                onClick={() => setPricingMode("compare")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  pricingMode === "compare"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                ⚖️ Сравнение двух цен
              </button>
            </div>
          </CardContent>
        </Card>

        {/* 4 Главных сводных KPI карточки */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Срок разработки */}
          <Card className="rounded-2xl border-border/60 shadow-xs card-print">
            <CardContent className="p-4 text-left">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Calendar className="h-4 w-4 text-primary" />
                Срок разработки
              </div>
              <p className="text-xl sm:text-2xl font-black mt-2 tracking-tight">12 месяцев</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">с 14.10.2025 по 02.10.2026</p>
            </CardContent>
          </Card>

          {/* Коммиты в Git */}
          <Card className="rounded-2xl border-border/60 shadow-xs card-print">
            <CardContent className="p-4 text-left">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <GitCommit className="h-4 w-4 text-blue-500" />
                Коммитов в GitHub
              </div>
              <p className="text-xl sm:text-2xl font-black mt-2 tracking-tight text-blue-600 dark:text-blue-400">
                {TOTAL_GIT_COMMITS} коммитов
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">старт 14.10.2025 02:26 ({GITHUB_FIRST_COMMIT_HASH})</p>
            </CardContent>
          </Card>

          {/* Затраченное время человека */}
          <Card className="rounded-2xl border-border/60 shadow-xs card-print">
            <CardContent className="p-4 text-left">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="h-4 w-4 text-purple-500" />
                Трудозатраты автора
              </div>
              <p className="text-xl sm:text-2xl font-black mt-2 tracking-tight text-purple-600 dark:text-purple-400">
                {stats.totalHours} часов
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">экспертный объем платформы</p>
            </CardContent>
          </Card>

          {/* Оценка стоимости системы (динамическая) */}
          <Card className="rounded-2xl border-primary/50 bg-primary/5 shadow-md shadow-primary/5 card-print">
            <CardContent className="p-4 text-left">
              <div className="flex items-center gap-1.5 text-xs text-primary font-bold">
                <DollarSign className="h-4 w-4" />
                {pricingMode === "junior" && "По минимальной цене"}
                {pricingMode === "market" && "По рыночной цене"}
                {pricingMode === "compare" && "Сравнение оценки"}
              </div>

              {pricingMode === "junior" && (
                <>
                  <p className="text-xl sm:text-2xl font-black mt-2 tracking-tight text-emerald-600 dark:text-emerald-400">
                    {rub(stats.juniorTotal)}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">по ставке Junior ({JUNIOR_HOURLY_RATE} ₽/ч)</p>
                </>
              )}

              {pricingMode === "market" && (
                <>
                  <p className="text-xl sm:text-2xl font-black mt-2 tracking-tight text-blue-600 dark:text-blue-400">
                    {rub(stats.marketTotal)}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">по ставке студии ({MARKET_HOURLY_RATE} ₽/ч)</p>
                </>
              )}

              {pricingMode === "compare" && (
                <>
                  <div className="mt-1 space-y-0.5">
                    <p className="text-sm font-black text-emerald-600 dark:text-emerald-400 leading-tight">
                      {rub(stats.juniorTotal)} <span className="text-[10px] text-muted-foreground font-normal">(Junior)</span>
                    </p>
                    <p className="text-xs font-bold text-muted-foreground line-through">
                      {rub(stats.marketTotal)} <span className="text-[10px] font-normal">(Рынок)</span>
                    </p>
                  </div>
                  <p className="text-[11px] text-primary font-bold mt-1">
                    Экономия: {rub(stats.diff)}
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Подробное сравнение: «Моя разработка (Junior) vs Рынок IT-студий» */}
        <Card className="rounded-2xl border-border/60 shadow-sm card-print text-left">
          <CardHeader className="pb-3 border-b border-border/30">
            <CardTitle className="text-base sm:text-lg font-bold flex items-center justify-between flex-wrap gap-2">
              <span className="flex items-center gap-2">
                <Award className="h-5 w-5 text-amber-500 shrink-0" />
                Сравнение: Моя разработка по минимальной ставке vs Рыночная стоимость IT-студии
              </span>
              <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-400/30 text-xs">
                Экономия: {rub(stats.diff)} ({stats.diffPercent}%)
              </Badge>
            </CardTitle>
            <CardDescription className="text-xs">
              Объективное сопоставление себестоимости разработки платформы по минимальной ставке начинающего специалиста и коммерческой оценки заказной IT-студии.
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-4 space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-border/40 text-muted-foreground bg-muted/20">
                    <th className="py-2.5 px-3 font-semibold">Компонент / Этап платформы</th>
                    <th className="py-2.5 px-3 font-semibold text-emerald-600 dark:text-emerald-400">
                      Моя разработка (Junior, {JUNIOR_HOURLY_RATE} ₽/ч)
                    </th>
                    <th className="py-2.5 px-3 font-semibold text-blue-600 dark:text-blue-400">
                      Рыночная стоимость (Студия, {MARKET_HOURLY_RATE} ₽/ч)
                    </th>
                    <th className="py-2.5 px-3 font-semibold text-right text-primary">
                      Разница / Сбережение
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  <tr>
                    <td className="py-2.5 px-3 font-medium">
                      Базовое ядро, база данных PostgreSQL и архитектурный каркас
                      <span className="block text-[10px] text-muted-foreground">PostgreSQL 50+ таблиц, авторизация, логика FSM, RLS-защита</span>
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {rub(stats.juniorBaseCost)}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold text-blue-600 dark:text-blue-400">
                      {rub(stats.marketBaseCost)}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold text-right text-primary">
                      +{rub(stats.marketBaseCost - stats.juniorBaseCost)}
                    </td>
                  </tr>

                  <tr>
                    <td className="py-2.5 px-3 font-medium">
                      Разработка 8 модулей в Git (12 месяцев, {stats.totalHours} ч)
                      <span className="block text-[10px] text-muted-foreground">542 коммита: биллинг 54-ФЗ, ЛК жильца, мобильные мастера, монтаж</span>
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {rub(stats.juniorDevCost)}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold text-blue-600 dark:text-blue-400">
                      {rub(stats.marketDevCost)}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold text-right text-primary">
                      +{rub(stats.marketDevCost - stats.juniorDevCost)}
                    </td>
                  </tr>

                  <tr>
                    <td className="py-2.5 px-3 font-medium">
                      Прямые расходы автора на инструменты (Gemini, Claude, VPN)
                      <span className="block text-[10px] text-muted-foreground">12 месяцев ежемесячных оплат из личных средств (3 338 ₽/мес)</span>
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {rub(EXPENSES_TOTAL_PERIOD)}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold text-blue-600 dark:text-blue-400">
                      {rub(EXPENSES_TOTAL_PERIOD)}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold text-right text-muted-foreground">
                      0 ₽
                    </td>
                  </tr>

                  <tr className="bg-primary/5 font-black text-sm">
                    <td className="py-3 px-3 text-foreground">
                      ИТОГОВАЯ ОЦЕНКА ПЛАТФОРМЫ «ДОМОФОНДАР»
                      <span className="block text-[10px] text-muted-foreground font-normal">1 год непрерывной разработки (14.10.2025 — 02.10.2026)</span>
                    </td>
                    <td className="py-3 px-3 font-mono text-emerald-600 dark:text-emerald-400">
                      {rub(stats.juniorTotal + EXPENSES_TOTAL_PERIOD)}
                    </td>
                    <td className="py-3 px-3 font-mono text-blue-600 dark:text-blue-400">
                      {rub(stats.marketTotal + EXPENSES_TOTAL_PERIOD)}
                    </td>
                    <td className="py-3 px-3 font-mono text-right text-primary">
                      +{rub(stats.diff)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/5 text-xs text-muted-foreground leading-relaxed space-y-1">
              <p className="font-bold text-foreground flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                Инженерный вывод:
              </p>
              <p>
                Даже если оценивать проект по предельно низкой ставке начинающего стажера (<b>{JUNIOR_HOURLY_RATE} ₽/час</b>), 
                созданная кодовая база представляет собой самостоятельный цифровой актив стоимостью <b>{rub(stats.juniorTotal + EXPENSES_TOTAL_PERIOD)}</b>.
              </p>
              <p>
                В случае обращения в коммерческую IT-студию разработка аналогичного комплекса под ключ с 542 коммитами и интеграцией платежей обошлась бы компании в <b>{rub(stats.marketTotal + EXPENSES_TOTAL_PERIOD)}</b>. 
                Реализация платформы собственными силами сберегла <b>{rub(stats.diff)}</b>.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Интерактивный калькулятор ставки (no-print) */}
        <Card className="no-print rounded-2xl border-border/60 shadow-xs text-left">
          <CardHeader className="pb-3 border-b border-border/30">
            <CardTitle className="text-sm font-bold flex items-center justify-between">
              <span className="flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-primary" />
                Калькулятор: Оценка проекта при произвольной ставке часа
              </span>
              <span className="font-mono text-primary font-black text-sm">
                {customRate} ₽ / час
              </span>
            </CardTitle>
            <CardDescription className="text-xs">
              Перемещайте ползунок, чтобы увидеть перерасчет общей стоимости платформы и трудозатрат в реальном времени.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-3">
            <div className="space-y-2">
              <Slider
                value={[customRate]}
                min={500}
                max={4000}
                step={50}
                onValueChange={(val) => setCustomRate(val[0])}
                className="cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
                <span>500 ₽/ч (Стажер)</span>
                <span className="text-emerald-600 font-bold">750 ₽/ч (Junior)</span>
                <span>1 500 ₽/ч (Middle)</span>
                <span className="text-blue-600 font-bold">2 500 ₽/ч (Senior)</span>
                <span>4 000 ₽/ч (Lead)</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-muted/30 border border-border/40 flex items-center justify-between flex-wrap gap-2 text-xs">
              <span className="text-muted-foreground">Оценочная стоимость системы при ставке <b>{customRate} ₽/ч</b> (+ AI и серверы):</span>
              <span className="font-mono font-black text-primary text-base">
                {rub(stats.customTotal + EXPENSES_TOTAL_PERIOD)}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Структура трудозатрат по направлениям */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* По модулям */}
          <Card className="rounded-2xl border-border/60 shadow-xs card-print text-left">
            <CardHeader className="pb-3 border-b border-border/30">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Layers className="h-4 w-4 text-primary" />
                Распределение времени по 8 модулям платформы
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-2.5">
              {Object.keys(MODULE_META).map(mKey => {
                const mod = mKey as ProjectModule;
                const data = stats.byModule[mod] || { hours: 0, juniorCost: 0, marketCost: 0, count: 0 };
                if (data.hours === 0) return null;
                const percent = Math.round((data.hours / stats.totalHours) * 100);

                const displayCost = pricingMode === "junior" 
                  ? data.juniorCost 
                  : pricingMode === "market" 
                    ? data.marketCost 
                    : data.juniorCost;

                return (
                  <div key={mod} className="space-y-1">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-foreground">{MODULE_META[mod].label}</span>
                      <span className="text-muted-foreground font-mono">
                        {data.hours} ч · {rub(displayCost)} ({percent}%)
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div 
                        className="h-full bg-primary rounded-full transition-all duration-500" 
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* По типам задач и технологический стек */}
          <Card className="rounded-2xl border-border/60 shadow-xs card-print text-left">
            <CardHeader className="pb-3 border-b border-border/30">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Cpu className="h-4 w-4 text-primary" />
                Типы работ и технологический стек
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="space-y-2.5">
                {Object.keys(KIND_META).map(kKey => {
                  const kind = kKey as Kind;
                  const data = stats.byKind[kind] || { hours: 0, juniorCost: 0, marketCost: 0, count: 0 };
                  if (data.hours === 0) return null;
                  const percent = Math.round((data.hours / stats.totalHours) * 100);

                  return (
                    <div key={kind} className="space-y-1">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-semibold text-foreground">{KIND_META[kind].label}</span>
                        <span className="text-muted-foreground font-mono">{data.hours} ч ({percent}%)</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div 
                          className="h-full bg-blue-500 rounded-full transition-all duration-500" 
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Стек платформы */}
              <div className="pt-2 border-t border-border/30">
                <p className="text-[11px] font-bold text-muted-foreground mb-2">АРХИТЕКТУРНЫЙ СТЕК:</p>
                <div className="flex flex-wrap gap-1.5">
                  {["React 18", "TypeScript", "Vite", "Tailwind CSS", "Supabase / PostgreSQL", "Docker & Nginx", "ЮKassa 54-ФЗ", "DaData API", "PWA"].map(t => (
                    <span key={t} className="text-[10px] px-2 py-0.5 rounded-md bg-muted/60 border border-border/40 font-mono">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Хронологическая лента доработок (Timeline) */}
        <Card className="rounded-2xl border-border/60 shadow-sm card-print text-left">
          <CardHeader className="pb-4 border-b border-border/30 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Хронологический журнал этапов разработки
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Ключевые вехи с 14 октября 2025 г. по 2 октября 2026 г. Всего записей: <b>{stats.items.length}</b>.
                </CardDescription>
              </div>

              <Badge variant="outline" className="text-xs font-mono font-bold">
                {filteredItems.length} из {stats.items.length} отобрано
              </Badge>
            </div>

            {/* Фильтры и поиск (no-print) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 no-print">
              <div className="relative">
                <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Поиск по названию или описанию..."
                  className="pl-8 text-xs h-9 rounded-xl"
                />
              </div>

              <select
                value={selectedKind}
                onChange={e => setSelectedKind(e.target.value)}
                className="h-9 text-xs rounded-xl border border-input bg-background px-3 font-medium cursor-pointer"
              >
                <option value="all">Все категории работ</option>
                <option value="feature">Новые фичи / модули</option>
                <option value="improvement">Улучшения UX</option>
                <option value="fix">Исправления</option>
                <option value="infra">Инфраструктура</option>
              </select>

              <select
                value={selectedModule}
                onChange={e => setSelectedModule(e.target.value)}
                className="h-9 text-xs rounded-xl border border-input bg-background px-3 font-medium cursor-pointer"
              >
                <option value="all">Все модули системы</option>
                {Object.keys(MODULE_META).map(mKey => (
                  <option key={mKey} value={mKey}>
                    {MODULE_META[mKey as ProjectModule].label}
                  </option>
                ))}
              </select>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <div className="divide-y divide-border/30">
              {filteredItems.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground">
                  По заданным фильтрам записей не найдено.
                </div>
              ) : (
                filteredItems.map(item => {
                  const kMeta = KIND_META[item.kind];
                  const mMeta = MODULE_META[item.module];

                  return (
                    <div 
                      key={item.id} 
                      className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-3.5 hover:bg-muted/20 transition-colors"
                    >
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-mono font-bold text-muted-foreground">
                            📅 {item.datetime}
                          </span>
                          <Badge variant="outline" className={`text-[10px] py-0 px-2 font-bold ${kMeta.badgeCls}`}>
                            {kMeta.label}
                          </Badge>
                          <Badge variant="outline" className={`text-[10px] py-0 px-2 font-medium ${mMeta.color}`}>
                            {mMeta.label}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground font-semibold px-2 py-0.5 rounded-md bg-muted">
                            Сложность: {item.difficulty}
                          </span>
                        </div>

                        <h3 className="text-sm font-bold text-foreground pt-0.5">
                          {item.title}
                        </h3>

                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {item.description}
                        </p>
                      </div>

                      <div className="sm:text-right shrink-0 flex sm:flex-col items-center sm:items-end justify-between border-t sm:border-t-0 pt-2 sm:pt-0">
                        {pricingMode === "junior" && (
                          <span className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400 font-mono">
                            {rub(item.juniorCost)}
                          </span>
                        )}

                        {pricingMode === "market" && (
                          <span className="text-base sm:text-lg font-black text-blue-600 dark:text-blue-400 font-mono">
                            {rub(item.marketCost)}
                          </span>
                        )}

                        {pricingMode === "compare" && (
                          <div className="sm:text-right">
                            <span className="text-sm sm:text-base font-black text-emerald-600 dark:text-emerald-400 font-mono block">
                              {rub(item.juniorCost)}
                            </span>
                            <span className="text-[10px] text-muted-foreground font-mono block">
                              рынок: {rub(item.marketCost)}
                            </span>
                          </div>
                        )}

                        <span className="text-xs text-muted-foreground font-mono mt-0.5">
                          {item.hours} чел.-ч
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="p-4 border-t border-border/40 bg-muted/30 flex items-center justify-between font-bold text-xs sm:text-sm">
              <span>Итого по отображаемым записям ({filteredItems.length}):</span>
              <span className="text-primary font-black font-mono text-base">
                {pricingMode === "junior" && rub(filteredItems.reduce((acc, cur) => acc + cur.juniorCost, 0))}
                {pricingMode === "market" && rub(filteredItems.reduce((acc, cur) => acc + cur.marketCost, 0))}
                {pricingMode === "compare" && (
                  `${rub(filteredItems.reduce((acc, cur) => acc + cur.juniorCost, 0))} (рынок: ${rub(filteredItems.reduce((acc, cur) => acc + cur.marketCost, 0))})`
                )}
                {" "}({filteredItems.reduce((acc, cur) => acc + cur.hours, 0)} ч)
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Подвал */}
        <div className="text-center text-xs text-muted-foreground pt-4 pb-8 space-y-1">
          <p>© 2025–{new Date().getFullYear()} {OWNER}. Персональный дневник инженера.</p>
          <p className="text-[11px] text-muted-foreground/70">
            Система автоматизированного учета инженерных трудозатрат и хронологии платформы «Домофондар».
          </p>
        </div>

      </div>
    </div>
  );
};

export default Project;
