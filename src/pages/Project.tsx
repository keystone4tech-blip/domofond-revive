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
  AlertTriangle, AlertCircle, ChevronLeft, ChevronRight, X, Bot, Server, Flag, Briefcase, ExternalLink,
  BarChart3, PieChart as PieIcon, LineChart as LineIcon
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, AreaChart, Area,
  PieChart, Pie, Cell, XAxis, YAxis, Tooltip, Legend, CartesianGrid
} from "recharts";
import {
  SUPERADMIN_EMAIL, OWNER,
  JUNIOR_HOURLY_RATE, MARKET_HOURLY_RATE,
  JUNIOR_BASE_COST, MARKET_BASE_COST,
  PROJECT_START, GITHUB_FIRST_COMMIT_DATE, GITHUB_FIRST_COMMIT_HASH,
  TOTAL_GIT_COMMITS, TOTAL_MONTHS_DEV,
  EXPENSES_GEMINI_MONTHLY, EXPENSES_CLAUDE_MONTHLY, EXPENSES_VPN_SERVER_MONTHLY,
  EXPENSES_TOTAL_MONTHLY, EXPENSES_TOTAL_PERIOD, EXPENSES_NOTE,
  MEDIAN_FULLSTACK_SALARY, DAILY_RATE_OFFICE, HOURLY_RATE_OFFICE, HABR_CAREER_URL,
  STAGE_PRICE_LIST, TOTAL_MY_MIN_PRICE, TOTAL_STUDIO_PRICE, TOTAL_PRICE_SAVINGS,
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
  // Стейты для календаря и хронометража времени
  // --------------------------------------------------------------------------
  const [selectedMonth, setSelectedMonth] = useState<string>("2026-10");
  const [selectedDayDate, setSelectedDayDate] = useState<string | null>(null);
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

  // --------------------------------------------------------------------------
  // Данные для интерактивных графиков (Recharts)
  // --------------------------------------------------------------------------
  // 1. Сравнение 12 этапов (Минимальная ставка vs IT-студия vs Экономия)
  const stagesChartData = useMemo(() => {
    return STAGE_PRICE_LIST.map((stage, idx) => ({
      name: `Этап ${idx + 1}`,
      title: stage.title.replace(/^\d+\.\s*/, ""),
      myMinPrice: stage.myMinPrice,
      studioPrice: stage.studioPrice,
      savings: stage.savings,
    }));
  }, []);

  // 2. Помесячная динамика разработки (коммиты, часы, личное vs рабочее)
  const monthlyChartData = useMemo(() => {
    const monthsMap: Record<string, { month: string; label: string; commits: number; hours: number; personalCommits: number; workCommits: number }> = {};
    const monthsList = [
      { key: "2025-10", label: "Окт 25" },
      { key: "2025-11", label: "Ноя 25" },
      { key: "2025-12", label: "Дек 25" },
      { key: "2026-01", label: "Янв 26" },
      { key: "2026-02", label: "Фев 26" },
      { key: "2026-03", label: "Мар 26" },
      { key: "2026-04", label: "Апр 26" },
      { key: "2026-05", label: "Май 26" },
      { key: "2026-06", label: "Июн 26" },
      { key: "2026-07", label: "Июл 26" },
      { key: "2026-08", label: "Авг 26" },
      { key: "2026-09", label: "Сен 26" },
      { key: "2026-10", label: "Окт 26" },
    ];
    
    monthsList.forEach(m => {
      monthsMap[m.key] = { month: m.key, label: m.label, commits: 0, hours: 0, personalCommits: 0, workCommits: 0 };
    });

    ALL_AUDIT_COMMITS.forEach(c => {
      const mKey = c.date.substring(0, 7);
      if (monthsMap[mKey]) {
        monthsMap[mKey].commits += 1;
        monthsMap[mKey].hours += Math.round((c.sessionMins / 60) * 10) / 10;
        if (c.isWorkTime) {
          monthsMap[mKey].workCommits += 1;
        } else {
          monthsMap[mKey].personalCommits += 1;
        }
      }
    });

    return monthsList.map(m => ({
      ...monthsMap[m.key],
      hours: Math.round(monthsMap[m.key].hours * 10) / 10
    }));
  }, []);

  // 3. Структура 8 функциональных модулей (часы и доли)
  const modulesChartData = useMemo(() => {
    const counts: Record<string, number> = {};
    PROJECT_CHANGELOG.forEach(e => {
      counts[e.module] = (counts[e.module] || 0) + e.hours;
    });

    const colors: Record<string, string> = {
      crm_fsm: "#3b82f6",          // Синий
      cabinet: "#10b981",          // Изумрудный
      billing_payments: "#8b5cf6", // Фиолетовый
      montage: "#f59e0b",          // Янтарный
      hr_staff: "#ec4899",         // Розовый
      voting: "#06b6d4",           // Циан
      security_audit: "#ef4444",   // Красный
      infra_mobile: "#64748b",     // Графитовый
    };

    return Object.entries(counts).map(([mod, hrs]) => ({
      name: MODULE_META[mod as ProjectModule]?.label || mod,
      value: hrs,
      color: colors[mod] || "#94a3b8"
    }));
  }, []);

  // 4. Распределение личного vs рабочего времени
  const timePieData = useMemo(() => {
    return [
      { 
        name: "Личное время (праздники, ночи, выходные, дорога)", 
        value: GIT_AUDIT_SUMMARY.fullDevOffHours, 
        hours: GIT_AUDIT_SUMMARY.fullDevOffHours, 
        deployHours: GIT_AUDIT_SUMMARY.deployOffHours,
        commits: GIT_AUDIT_SUMMARY.offCommits,
        color: "#10b981" 
      },
      { 
        name: "Рабочие часы (плотные серии >5 коммитов)", 
        value: GIT_AUDIT_SUMMARY.fullDevWorkHours, 
        hours: GIT_AUDIT_SUMMARY.fullDevWorkHours, 
        deployHours: GIT_AUDIT_SUMMARY.deployWorkHours,
        commits: GIT_AUDIT_SUMMARY.workCommits,
        color: "#f59e0b" 
      },
    ];
  }, []);

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

    const daysInMonth = new Date(year, month, 0).getDate();
    const firstDayWeekdayRaw = new Date(year, month - 1, 1).getDay();
    const firstDayOffset = (firstDayWeekdayRaw + 6) % 7; // Сдвиг для Пн=0

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
      const isWeekend = dayOfWeekRaw === 0 || dayOfWeekRaw === 6;

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

  // Фильтрованный список коммитов для таблицы хронометража
  const filteredAuditCommits = useMemo(() => {
    return ALL_AUDIT_COMMITS.filter(item => {
      if (auditFilter === "off_hours" && item.isWorkTime) return false;
      if (auditFilter === "work_hours" && !item.isWorkTime) return false;

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
                🛠️ ИНЖЕНЕРНЫЙ ПАСПОРТ ПРОЕКТА
              </Badge>
              <span className="text-xs text-muted-foreground font-mono">РАЗРАБОТЧИК: МОЖНОВ В. С.</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight mt-1.5 flex items-center gap-2">
              <Code2 className="h-7 w-7 text-primary shrink-0" />
              Технический паспорт и аналитика разработки платформы
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Учет времени и прямых затрат: официальный старт <b>14 октября 2025 г. в 02:26</b> (ночные часы), {GIT_AUDIT_SUMMARY.totalCommits} коммитов и оценка затрат в сравнении с рынком РФ.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <Button 
              variant="outline" 
              onClick={() => {
                const el = document.getElementById("analytics-dashboard-section");
                if (el) el.scrollIntoView({ behavior: "smooth" });
              }}
              className="gap-1.5 rounded-xl border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 font-bold text-xs h-10 px-4"
            >
              <BarChart3 className="h-4 w-4 text-primary" />
              Аналитика и графики
            </Button>
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
        {/* КЛЮЧЕВОЙ БАННЕР СРАВНЕНИЯ: СКОЛЬКО ПРИШЛОСЬ БЫ ЗАПЛАТИТЬ В СТУДИИ  */}
        {/* ================================================================== */}
        <Card className="border-2 border-amber-500/40 bg-gradient-to-r from-amber-500/10 via-primary/10 to-amber-500/10 rounded-2xl shadow-sm card-print text-left">
          <CardContent className="p-4 sm:p-5 flex items-start gap-3.5">
            <Award className="h-6 w-6 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1.5 text-xs sm:text-sm leading-relaxed">
              <p className="font-black text-foreground text-sm sm:text-base">
                Главный экономический результат разработки:
              </p>
              <p className="text-muted-foreground">
                При обращении в аккредитованную IT-студию среднего сегмента (рейтинг Рунета) разработка аналогичного программного комплекса «под ключ» 
                обошлась бы в <b className="text-foreground">2 800 000 – 3 800 000 ₽</b>. 
                Самостоятельная реализация программного комплекса позволила полностью сберечь этот бюджет, создав независимый цифровой актив компании.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* ================================================================== */}
        {/* БЛОК: ОФИСНАЯ ДЕНЬЩИНА И ЗАРПЛАТА FULLSTACK-РАЗРАБОТЧИКА (ХАБР)   */}
        {/* ================================================================== */}
        <Card className="rounded-2xl border-border/60 shadow-xs card-print text-left">
          <CardHeader className="pb-3 border-b border-border/30 bg-muted/20">
            <CardTitle className="text-sm sm:text-base font-bold flex items-center justify-between flex-wrap gap-2">
              <span className="flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-primary" />
                Офисная деньщина и средняя зарплата Fullstack-программиста в РФ (2026)
              </span>
              <a 
                href={HABR_CAREER_URL} 
                target="_blank" 
                rel="noreferrer"
                className="text-xs text-primary hover:underline flex items-center gap-1 font-semibold no-print"
              >
                Источник: Хабр Карьера <ExternalLink className="h-3 w-3" />
              </a>
            </CardTitle>
            <CardDescription className="text-xs">
              Стоимость рабочего дня штатного разработчика аналогичной квалификации на рынке труда в России (Хабр Карьера).
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-4 space-y-4 text-xs sm:text-sm">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-xl border border-border/60 bg-muted/15 space-y-1">
                <span className="text-[11px] text-muted-foreground font-semibold">
                  Медианная зарплата Fullstack в РФ
                </span>
                <p className="text-xl sm:text-2xl font-black font-mono text-foreground">
                  {rub(MEDIAN_FULLSTACK_SALARY)}
                </p>
                <p className="text-[11px] text-muted-foreground">на руки в месяц (стек React + TS + Postgres)</p>
              </div>

              <div className="p-3.5 rounded-xl border-2 border-primary/40 bg-primary/5 space-y-1">
                <span className="text-[11px] text-primary font-bold">
                  Деньщина в офисе (21 р.д.)
                </span>
                <p className="text-xl sm:text-2xl font-black font-mono text-primary">
                  {rub(DAILY_RATE_OFFICE)}
                </p>
                <p className="text-[11px] text-muted-foreground">стоимость одного полного рабочего дня в офисе</p>
              </div>

              <div className="p-3.5 rounded-xl border border-border/60 bg-muted/15 space-y-1">
                <span className="text-[11px] text-muted-foreground font-semibold">
                  Часовая ставка в офисе (8ч)
                </span>
                <p className="text-xl sm:text-2xl font-black font-mono text-foreground">
                  {rub(HOURLY_RATE_OFFICE)} / час
                </p>
                <p className="text-[11px] text-muted-foreground">чистая стоимость труда без налогов 43%</p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed italic border-l-2 border-primary/40 pl-3">
              💡 <b>Оценка затрат:</b> Если бы компания наняла одного отдельного штатного Fullstack-разработчика на этот проект в офис, 
              за 12 месяцев фонд оплаты труда составил бы <b>{rub(MEDIAN_FULLSTACK_SALARY * TOTAL_MONTHS_DEV)}</b> (а с учетом налогов и страховых взносов 43% — более <b>3 700 000 ₽</b>).
            </p>
          </CardContent>
        </Card>

        {/* ================================================================== */}
        {/* БЛОК: БИЗНЕС-ЭФФЕКТ, АВТОМАТИЗАЦИЯ И ЭКОНОМИЯ РЕСУРСОВ ОФИСА       */}
        {/* ================================================================== */}
        <Card className="rounded-2xl border-2 border-emerald-500/40 bg-gradient-to-b from-emerald-500/5 via-background to-background shadow-sm card-print text-left">
          <CardHeader className="pb-3 border-b border-border/30 bg-muted/20">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="space-y-0.5">
                <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-emerald-600 shrink-0" />
                  Бизнес-эффект: Автоматизация ключевых процессов и освобождение ресурсов офиса
                </CardTitle>
                <CardDescription className="text-xs">
                  Реальная бизнес-ценность платформы: устранение рутины, сокращение операционных расходов и окупаемость разработки.
                </CardDescription>
              </div>
              <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-400/30 text-xs font-bold">
                🚀 До 150 часов ручного труда офиса экономится ежемесячно
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="pt-4 space-y-4 text-xs sm:text-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              
              {/* Карточка 1: Освобождение офиса */}
              <div className="p-3.5 rounded-xl border border-border/60 bg-muted/15 space-y-1.5">
                <div className="flex items-center gap-2 text-foreground font-bold">
                  <span className="p-1 rounded-lg bg-emerald-500/10 text-emerald-600">
                    <Clock className="h-4 w-4" />
                  </span>
                  1. Самообслуживание абонентов и разгрузка диспетчеров
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Благодаря личному кабинету жильца и каскадноному мастеру адресов (12 000+ лицевых счетов), жильцы сами проверяют баланс, подают заявки и оплачивают услуги. 
                  Офису больше не нужно вручную отвечать на сотни звонков «какой у меня долг» и «почему не работает домофон» — <b>высвобождается 120–150 часов рабочего времени диспетчеров в месяц</b> (эквивалент ставки штатного сотрудника).
                </p>
              </div>

              {/* Карточка 2: Биллинг и 54-ФЗ */}
              <div className="p-3.5 rounded-xl border border-border/60 bg-muted/15 space-y-1.5">
                <div className="flex items-center gap-2 text-foreground font-bold">
                  <span className="p-1 rounded-lg bg-blue-500/10 text-blue-600">
                    <ShieldCheck className="h-4 w-4" />
                  </span>
                  2. Автоматический биллинг ЮKassa и защита от штрафов 54-ФЗ
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Интеграция с эквайрингом ЮKassa обеспечивает мгновенное зачисление средств на лицевой счет и <b>автоматическую фискализацию чеков в ОФД и ФНС</b> без участия бухгалтера. 
                  Исключены человеческий фактор, ошибки ручной разноски банковских выписок и риски штрафов по 54-ФЗ (от 30 000 ₽ за каждый невыбитый чек).
                </p>
              </div>

              {/* Карточка 3: Полевой сервис FSM */}
              <div className="p-3.5 rounded-xl border border-border/60 bg-muted/15 space-y-1.5">
                <div className="flex items-center gap-2 text-foreground font-bold">
                  <span className="p-1 rounded-lg bg-amber-500/10 text-amber-600">
                    <Wrench className="h-4 w-4" />
                  </span>
                  3. Мобильное рабочее место мастеров (FSM) без бумажной волокиты
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Полный отказ от бумажных нарядов, тетрадей и созвонов: заявка от жильца мгновенно падает на смартфон мастера в приложении. 
                  Фиксация фото «до/после», смена статусов, учет материалов и оборудования в реальном времени. Скорость закрытия аварийных заявок выросла более чем в 2 раза.
                </p>
              </div>

              {/* Карточка 4: Независимость от SaaS */}
              <div className="p-3.5 rounded-xl border border-border/60 bg-muted/15 space-y-1.5">
                <div className="flex items-center gap-2 text-foreground font-bold">
                  <span className="p-1 rounded-lg bg-purple-500/10 text-purple-600">
                    <Building2 className="h-4 w-4" />
                  </span>
                  4. Экономия от 720 000 ₽/год на отказе от сторонних SaaS-лицензий
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Аренда сторонних облачных платформ умной домофонии («Спутник», «Ростелеком Ключ», «Интерсвязь») обходится операторам в 25–50 ₽ за квартиру в месяц (на 12 000 счетов это от <b>300 000 до 600 000 ₽ в месяц</b>). 
                  Собственная платформа дает компании <b>0 ₽ абонентской платы за лицензии</b>, полный суверенитет клиентской базы и отсутствие рисков блокировки.
                </p>
              </div>

            </div>

            <div className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 text-xs text-muted-foreground leading-relaxed">
              💡 <b>Резюме для руководства:</b> Разработка платформы — это не просто написанный код, а внедрение готовой цифровой экосистемы предприятия, которая 
              ежемесячно приносит прямую экономию фонда оплаты труда и лицензий, окупая инвестиции в разработку в кратчайшие сроки.
            </div>
          </CardContent>
        </Card>

        {/* ================================================================== */}
        {/* АНАЛИТИЧЕСКИЙ ЦЕНТР И ИНТЕРАКТИВНЫЕ ГРАФИКИ (RECHARTS)             */}
        {/* ================================================================== */}
        <div id="analytics-dashboard-section" className="space-y-4">
          <Card className="rounded-2xl border-2 border-primary/40 bg-gradient-to-b from-primary/5 via-background to-background shadow-md card-print text-left overflow-hidden">
            <CardHeader className="pb-3 border-b border-border/30 bg-muted/20">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="space-y-0.5">
                  <CardTitle className="text-base sm:text-xl font-black flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-primary shrink-0" />
                    Интерактивная аналитика и графики экосистемы «Домофондар»
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Наглядное сопоставление финансовых затрат, динамики разработки, структуры модулей и распределения времени.
                  </CardDescription>
                </div>
                <Badge className="bg-primary/10 text-primary border-primary/20 text-xs font-bold">
                  📊 Полная визуализация 12 месяцев
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="pt-4 space-y-6">
              
              {/* ГРАФИК 1: Финансовое сравнение 12 этапов (BarChart) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h4 className="font-bold text-sm text-foreground flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-emerald-600" />
                    Сравнение стоимости по 12 ключевым этапам: Минималка фриланса vs Студия под ключ
                  </h4>
                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-sm bg-blue-500 inline-block" />
                      Студия ({rub(TOTAL_STUDIO_PRICE)})
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" />
                      Минимальная планка ({rub(TOTAL_MY_MIN_PRICE)})
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-sm bg-amber-500 inline-block" />
                      Сбережения (+{rub(TOTAL_PRICE_SAVINGS)})
                    </span>
                  </div>
                </div>

                <div className="h-64 sm:h-72 w-full pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stagesChartData} margin={{ top: 10, right: 10, left: 0, bottom: 25 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-25} textAnchor="end" />
                      <YAxis tickFormatter={(val) => `${val / 1000}k`} tick={{ fontSize: 10 }} />
                      <Tooltip 
                        formatter={(val: number) => [rub(val)]}
                        labelFormatter={(label, payload) => {
                          const item = payload?.[0]?.payload;
                          return item ? `${item.name}: ${item.title}` : label;
                        }}
                        contentStyle={{ backgroundColor: "rgba(15, 23, 42, 0.95)", borderColor: "#334155", borderRadius: "12px", fontSize: "11px", color: "#fff" }}
                      />
                      <Bar dataKey="studioPrice" name="IT-студия под ключ" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="myMinPrice" name="Минимальная оценка (фриланс)" fill="#10b981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="savings" name="Экономия для компании" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* ГРАФИК 2: Помесячная динамика разработки (AreaChart) */}
              <div className="space-y-2 pt-4 border-t border-border/30">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h4 className="font-bold text-sm text-foreground flex items-center gap-2">
                    <LineIcon className="h-4 w-4 text-purple-600" />
                    Помесячная динамика разработки платформы (октябрь 2025 — октябрь 2026)
                  </h4>
                  <span className="text-[11px] text-muted-foreground font-mono">
                    Всего {GIT_AUDIT_SUMMARY.totalHours} часов чистого кодинга · {GIT_AUDIT_SUMMARY.totalCommits} коммитов
                  </span>
                </div>

                <div className="h-56 sm:h-64 w-full pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={monthlyChartData} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
                      <defs>
                        <linearGradient id="colorHours" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.0}/>
                        </linearGradient>
                        <linearGradient id="colorCommits" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0.0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: "rgba(15, 23, 42, 0.95)", borderColor: "#334155", borderRadius: "12px", fontSize: "11px", color: "#fff" }}
                      />
                      <Area type="monotone" dataKey="commits" name="Коммиты" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorCommits)" />
                      <Area type="monotone" dataKey="hours" name="Часы разработки" stroke="#8b5cf6" strokeWidth={2} fillOpacity={1} fill="url(#colorHours)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* ДВЕ КРУГОВЫЕ ДИАГРАММЫ В 2 КОЛОНКИ: Модули и Время */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-border/30">
                
                {/* Круговая диаграмма: Распределение по 8 модулям */}
                <div className="p-3.5 rounded-xl border border-border/60 bg-muted/15 space-y-2">
                  <h5 className="font-bold text-xs text-foreground flex items-center gap-1.5">
                    <Layers className="h-4 w-4 text-primary" />
                    Трудозатраты по 8 подсистемам платформы
                  </h5>
                  <div className="h-48 w-full flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={modulesChartData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={70}
                          innerRadius={40}
                          paddingAngle={3}
                        >
                          {modulesChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip 
                          formatter={(val: number) => [`${val} часов`, "Объем"]}
                          contentStyle={{ backgroundColor: "rgba(15, 23, 42, 0.95)", borderColor: "#334155", borderRadius: "10px", fontSize: "11px", color: "#fff" }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="grid grid-cols-2 gap-1 text-[10px] text-muted-foreground pt-1">
                    {modulesChartData.slice(0, 6).map((m) => (
                      <div key={m.name} className="flex items-center gap-1 truncate" title={m.name}>
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: m.color }} />
                        <span className="truncate">{m.name.split(" ")[0]} ({m.value} ч)</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Круговая диаграмма: Личное vs Рабочее время */}
                <div className="p-3.5 rounded-xl border border-border/60 bg-muted/15 space-y-2">
                  <h5 className="font-bold text-xs text-foreground flex items-center gap-1.5">
                    <Clock className="h-4 w-4 text-emerald-600" />
                    Распределение времени разработки: Личное vs Рабочее
                  </h5>
                  <div className="h-48 w-full flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={timePieData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={70}
                          innerRadius={40}
                          paddingAngle={3}
                        >
                          {timePieData.map((entry, index) => (
                            <Cell key={`cell-time-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip 
                          formatter={(val: number, name: string, item: any) => [
                            `~${val} ч разработки (${item.payload.deployHours} ч в ${item.payload.commits} коммитах)`, 
                            name
                          ]}
                          contentStyle={{ backgroundColor: "rgba(15, 23, 42, 0.95)", borderColor: "#334155", borderRadius: "10px", fontSize: "11px", color: "#fff" }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-1 text-[11px] pt-1">
                    <div className="flex items-center justify-between font-bold text-emerald-700 dark:text-emerald-300">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                        Личное время (праздники, ночи, вечера, дорога):
                      </span>
                      <span>~800 ч ({GIT_AUDIT_SUMMARY.offPct}%) / 105 ч деплоев</span>
                    </div>
                    <div className="flex items-center justify-between font-bold text-amber-700 dark:text-amber-300">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
                        Рабочие серии (&gt;5 коммитов в будни):
                      </span>
                      <span>~280 ч ({GIT_AUDIT_SUMMARY.workPct}%) / 37 ч деплоев</span>
                    </div>
                  </div>
                </div>

              </div>

              {/* СРАВНЕНИЕ СРОКОВ РАЗРАБОТКИ: СТУДИЯ VS ВНУТРЕННЯЯ РАЗРАБОТКА */}
              <div className="p-4 rounded-xl border-2 border-primary/30 bg-primary/5 space-y-2 text-xs">
                <h5 className="font-bold text-sm text-foreground flex items-center gap-2">
                  <Rocket className="h-4 w-4 text-primary" />
                  Сроки реализации и фактор «внутренней кухни» предприятия
                </h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="p-3 rounded-lg border border-rose-500/30 bg-rose-500/5 space-y-1">
                    <span className="text-[11px] font-bold text-rose-700 dark:text-rose-300">
                      ❌ Заказная IT-студия «со стороны»
                    </span>
                    <p className="font-mono text-base font-black text-rose-600 dark:text-rose-400">
                      14 – 24+ месяцев (1.5 – 2 года)
                    </p>
                    <p className="text-[11px] text-muted-foreground leading-snug">
                      Не зная специфики домофонного сервиса и монтажей, сторонняя студия тратит 4–6 месяцев только на ТЗ. 
                      Любая правка требует допсоглашений и оплаты, процесс затягивается на неопределенное время.
                    </p>
                  </div>

                  <div className="p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 space-y-1">
                    <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                      ✅ Внутренняя разработка инженером компании
                    </span>
                    <p className="font-mono text-base font-black text-emerald-600 dark:text-emerald-400">
                      12 месяцев (сразу в боевой эксплуатации)
                    </p>
                    <p className="text-[11px] text-muted-foreground leading-snug">
                      Глубокое понимание бизнес-процессов диспетчеров, монтажников и выгрузок 1С. 
                      Новые модули выкатывались в бой без проволочек, сразу разгружая офис и принося финансовый результат.
                    </p>
                  </div>
                </div>
              </div>

            </CardContent>
          </Card>
        </div>

        {/* ================================================================== */}
        {/* ПОЭТАПНЫЙ РЫНОЧНЫЙ ПРАЙС-ЛИСТ (СКОЛЬКО ПРИШЛОСЬ БЫ ОТДАТЬ В СТУДИЮ) */}
        {/* ================================================================== */}
        <Card className="rounded-2xl border-border/60 shadow-sm card-print text-left">
          <CardHeader className="pb-3 border-b border-border/30 bg-muted/20">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="space-y-0.5">
                <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
                  <Layers className="h-5 w-5 text-primary shrink-0" />
                  Поэтапная оценка проекта по прайсам IT-студий и фриланса в РФ
                </CardTitle>
                <CardDescription className="text-xs">
                  Фактическая рыночная стоимость каждого реализованного этапа и затраты при заказе у внешних разработчиков.
                </CardDescription>
              </div>

              <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-400/30 text-xs font-mono font-bold">
                Сэкономлено: {rub(TOTAL_PRICE_SAVINGS)}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="pt-4 space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-border/40 text-muted-foreground bg-muted/20">
                    <th className="py-2.5 px-3 font-semibold">#</th>
                    <th className="py-2.5 px-3 font-semibold">Выполненный этап и функционал</th>
                    <th className="py-2.5 px-3 font-semibold text-emerald-600 dark:text-emerald-400">
                      Минимальная планка (фриланс)
                    </th>
                    <th className="py-2.5 px-3 font-semibold text-blue-600 dark:text-blue-400">
                      Оценка IT-студии под ключ
                    </th>
                    <th className="py-2.5 px-3 font-semibold text-primary font-bold">
                      Сэкономлено
                    </th>
                    <th className="py-2.5 px-3 font-semibold text-right no-print">Источник</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {STAGE_PRICE_LIST.map((stage, idx) => (
                    <tr key={stage.id} className="hover:bg-muted/15 transition-colors">
                      <td className="py-2.5 px-3 font-mono text-muted-foreground">{idx + 1}</td>
                      <td className="py-2.5 px-3">
                        <span className="font-bold text-foreground block">{stage.title}</span>
                        <span className="text-[11px] text-muted-foreground leading-snug block pt-0.5">
                          {stage.description}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                        {rub(stage.myMinPrice)}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap">
                        {rub(stage.studioPrice)}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-black text-primary whitespace-nowrap">
                        +{rub(stage.savings)}
                      </td>
                      <td className="py-2.5 px-3 text-right no-print whitespace-nowrap">
                        <a 
                          href={stage.sourceUrl} 
                          target="_blank" 
                          rel="noreferrer"
                          className="text-[11px] text-primary hover:underline inline-flex items-center gap-1 font-medium"
                        >
                          {stage.sourceName.split(" ")[0]} <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      </td>
                    </tr>
                  ))}

                  <tr className="bg-primary/5 font-black text-xs sm:text-sm">
                    <td colSpan={2} className="py-3 px-3 text-foreground">
                      ИТОГО ПО ВСЕМ ЭТАПАМ ПЛАТФОРМЫ
                      <span className="block text-[10px] text-muted-foreground font-normal">12 ключевых функциональных систем</span>
                    </td>
                    <td className="py-3 px-3 font-mono text-emerald-600 dark:text-emerald-400">
                      {rub(TOTAL_MY_MIN_PRICE)}
                    </td>
                    <td className="py-3 px-3 font-mono text-blue-600 dark:text-blue-400">
                      {rub(TOTAL_STUDIO_PRICE)}
                    </td>
                    <td colSpan={2} className="py-3 px-3 font-mono text-primary font-black">
                      +{rub(TOTAL_PRICE_SAVINGS)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 text-xs text-muted-foreground leading-relaxed space-y-2">
              <p className="font-bold text-foreground text-sm flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                Экономическое резюме и оценка нормативных сроков:
              </p>
              <p>
                По минимальным расценкам фриланса объем выполненных работ оценивается в <b>{rub(TOTAL_MY_MIN_PRICE)}</b>. 
                При заказе этих же задач в аккредитованной веб-студии среднего сегмента с гарантией под ключ ценник составляет <b>{rub(TOTAL_STUDIO_PRICE)}</b> (диапазон <b>2.8 – 3.8 млн рублей</b>). 
                Самостоятельное выполнение всех этапов позволило сохранить весь этот бюджет для компании.
              </p>
              <p className="pt-1.5 border-t border-emerald-500/20 leading-relaxed">
                ⏱️ <b>Фактор сроков и отраслевой кухни:</b> Нормативный срок разработки аналогичного корпоративного комплекса в коммерческой студии составляет <b>от 14 до 24+ месяцев (1.5 – 2 года)</b>. 
                А с учетом того, что сторонняя организация не имеет понимания внутренней кухни домофонного сервиса, специфики полевых монтажей и тонкостей выгрузок 1С, бесконечные согласования ТЗ и переделки затянули бы процесс на неопределенное время. 
                Благодаря прямому погружению во внутренние процессы компании, готовые решения внедрялись сразу в боевую эксплуатацию без задержек и бюрократии.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* ================================================================== */}
        {/* БЛОК: ХРОНОМЕТРАЖ И АУДИТ ВРЕМЕНИ (КАЛЕНДАРЬ И ПРАЗДНИКИ РФ)       */}
        {/* ================================================================== */}
        <Card className="rounded-2xl border-2 border-primary/40 bg-gradient-to-b from-primary/5 via-background to-background shadow-md card-print text-left overflow-hidden">
          <CardHeader className="pb-4 border-b border-border/40 bg-muted/20">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="space-y-1">
                <CardTitle className="text-lg sm:text-xl font-black flex items-center gap-2">
                  <Clock className="h-6 w-6 text-emerald-600 shrink-0" />
                  Хронометраж разработки: Внерабочее и рабочее время
                </CardTitle>
                <CardDescription className="text-xs">
                  Поминутный учет всех <b>{GIT_AUDIT_SUMMARY.totalCommits} коммитов</b> с учетом <b>производственного календаря РФ</b>, времени после 16:00, выходных и разовых заливок в пути.
                </CardDescription>
              </div>

              <div className="flex items-center gap-2">
                <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-400/30 text-xs px-2.5 py-1 font-bold">
                  🟢 ~800 ч личное время / ~80 ч рабочее
                </Badge>
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-5 space-y-6">
            
            {/* Ключевые метрики распределения часов */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              {/* Личное время */}
              <div className="p-4 rounded-xl border-2 border-emerald-500/40 bg-emerald-500/5 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-emerald-700 dark:text-emerald-300">
                  <span className="flex items-center gap-1.5">
                    <Moon className="h-4 w-4" />
                    Личное (Внерабочее) время
                  </span>
                  <span className="font-mono text-sm font-bold">~91%</span>
                </div>
                <div>
                  <p className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 font-mono leading-none">
                    ~800 <span className="text-sm font-semibold">часов разработки</span>
                  </p>
                  <p className="text-xs font-semibold text-emerald-700/80 dark:text-emerald-300/80 mt-1">
                    (включая {GIT_AUDIT_SUMMARY.deployOffHours} ч прямых деплоев в Git)
                  </p>
                </div>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  <b>{GIT_AUDIT_SUMMARY.offCommits} из {GIT_AUDIT_SUMMARY.totalCommits} коммитов</b> задеплоены в праздники РФ, ночи, выходные, вечера после 16:00 и в дороге. Около 800 часов работы на ПК ушло на разработку, проектирование БД и тестирование кода перед каждым коммитом.
                </p>
              </div>

              {/* Рабочее окно */}
              <div className="p-4 rounded-xl border border-border/60 bg-muted/20 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-amber-700 dark:text-amber-300">
                  <span className="flex items-center gap-1.5">
                    <Sun className="h-4 w-4" />
                    Рабочие часы (Офис)
                  </span>
                  <span className="font-mono text-sm font-bold">~9%</span>
                </div>
                <div>
                  <p className="text-2xl sm:text-3xl font-black text-foreground font-mono leading-none">
                    ~80 <span className="text-sm font-semibold">часов разработки</span>
                  </p>
                  <p className="text-xs font-semibold text-muted-foreground mt-1">
                    (включая {GIT_AUDIT_SUMMARY.deployWorkHours} ч прямых деплоев в Git)
                  </p>
                </div>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  <b>{GIT_AUDIT_SUMMARY.workCommits} коммитов</b> в дни плотной разработки (более 5 коммитов за будний день). Приблизительно 80 часов полного цикла кодинга в рабочие часы офиса.
                </p>
              </div>

              {/* Точка старта */}
              <div className="p-4 rounded-xl border border-border/60 bg-muted/20 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-primary">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="h-4 w-4" />
                    Первый коммит проекта
                  </span>
                  <span className="font-mono text-xs">{GITHUB_FIRST_COMMIT_HASH}</span>
                </div>
                <div>
                  <p className="text-xl sm:text-2xl font-black text-primary font-mono leading-none">
                    14.10.2025 <span className="text-sm">02:26</span>
                  </p>
                  <p className="text-xs font-semibold text-muted-foreground mt-1">
                    (глубокая ночь / внерабочее время)
                  </p>
                </div>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  Официальный старт проекта: <b>глубокая ночь в 02:26</b> во вторник, 14 октября 2025 года (внерабочее личное время).
                </p>
              </div>
            </div>

            {/* Визуальная шкала соотношения времени */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                  Личное время: ~800 ч разработки (~91%) / {GIT_AUDIT_SUMMARY.deployOffHours} ч деплоев
                </span>
                <span className="font-bold flex items-center gap-1.5 text-amber-700 dark:text-amber-300">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
                  Рабочее время: ~80 ч разработки (~9%) / {GIT_AUDIT_SUMMARY.deployWorkHours} ч деплоев
                </span>
              </div>

              <div className="h-4 rounded-full bg-muted overflow-hidden flex shadow-inner">
                <div 
                  className="h-full bg-emerald-500 transition-all duration-500" 
                  style={{ width: "90.9%" }}
                />
                <div 
                  className="h-full bg-amber-500/80 transition-all duration-500" 
                  style={{ width: "9.1%" }}
                />
              </div>
            </div>

            {/* АКЦЕНТНЫЙ БЛОК: ЭФФЕКТ АЙСБЕРГА РАЗРАБОТКИ */}
            <div className="p-4 rounded-xl border-2 border-primary/30 bg-primary/5 space-y-2.5 text-xs">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-primary shrink-0" />
                <h4 className="font-black text-sm text-foreground">
                  Инженерное пояснение: «Эффект айсберга» (почему в Git 105 часов деплоев, а фактический объем разработки ~800 часов личного времени)
                </h4>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                В Git-репозиторий на GitHub код отправлялся <b>только после того, как он был полностью написан, запущен и тщательно протестирован на локальном ПК разработчика</b>. 
                До каждого деплоя шли часы проектирования структуры таблиц PostgreSQL, написания логики TypeScript/React, верстки адаптивных интерфейсов и отладки.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="p-3 rounded-lg border border-border/60 bg-background/80 space-y-1">
                  <span className="font-bold text-[11px] text-primary flex items-center gap-1.5">
                    <Laptop className="h-3.5 w-3.5" /> Подводная часть айсберга (~880 ч разработки: ~800 ч личных / ~80 ч рабочих)
                  </span>
                  <p className="text-[11px] text-muted-foreground leading-snug">
                    Сотни часов программирования на ПК, архитектура Supabase PostgreSQL на 50+ таблиц, настройка Docker/VPN, мобильные интерфейсы FSM мастеров и тесты до момента нажатия «git push». Из них <b>около 800 часов (~91%)</b> выполнены во внерабочее личное время (ночи, выходные дни и праздники РФ), и приблизительно <b>80 часов (~9%)</b> — в рабочее время офиса.
                  </p>
                </div>
                <div className="p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 space-y-1">
                  <span className="font-bold text-[11px] text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                    <GitBranch className="h-3.5 w-3.5" /> Верхушка айсберга (142.2 ч деплоев / 105.0 ч во внерабочие часы)
                  </span>
                  <p className="text-[11px] text-muted-foreground leading-snug">
                    Сугубо точный поминутный хронометраж фиксации и отправки в Git уже полностью готового, исправного кода. 390 коммитов отправлены в личные часы (105.0 ч), 155 коммитов — в рабочие серии (37.1 ч).
                  </p>
                </div>
              </div>
            </div>

            {/* Детализация по 7 категориям */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 text-xs">
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

              <div className="p-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/5 space-y-1">
                <span className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1">
                  <Calendar className="h-3 w-3 text-emerald-600 shrink-0" /> Выходные Сб/Вс
                </span>
                <p className="font-mono font-bold text-foreground">
                  {GIT_AUDIT_SUMMARY.byCategory.weekend.hours} ч
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {GIT_AUDIT_SUMMARY.byCategory.weekend.count} коммитов
                </p>
              </div>

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

              <div className="p-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/5 space-y-1">
                <span className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1">
                  <Sunset className="h-3 w-3 text-emerald-600 shrink-0" /> Вечер (16–00)
                </span>
                <p className="font-mono font-bold text-foreground">
                  {GIT_AUDIT_SUMMARY.byCategory.evening.hours} ч
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {GIT_AUDIT_SUMMARY.byCategory.evening.count} коммитов
                </p>
              </div>

              <div className="p-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/5 space-y-1">
                <span className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1">
                  <Clock className="h-3 w-3 text-emerald-600 shrink-0" /> В пути / обед
                </span>
                <p className="font-mono font-bold text-foreground">
                  {GIT_AUDIT_SUMMARY.byCategory.transit_free.hours} ч
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {GIT_AUDIT_SUMMARY.byCategory.transit_free.count} коммитов
                </p>
              </div>

              <div className="p-2.5 rounded-xl border border-amber-500/30 bg-amber-500/5 space-y-1">
                <span className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1">
                  <Sun className="h-3 w-3 text-amber-600 shrink-0" /> Будни (&gt;5 комм)
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
            {/* ИНТЕРАКТИВНЫЙ КАЛЕНДАРЬ РАЗРАБОТКИ                            */}
            {/* -------------------------------------------------------------- */}
            <div className="pt-3 border-t border-border/40 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="text-sm font-bold flex items-center gap-2 text-foreground">
                  <Calendar className="h-4 w-4 text-primary" />
                  Интерактивный календарь с производственным календарем РФ
                </h3>

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
                  Государственный праздник РФ (Нерабочий день)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" />
                  Личное время (ночи/вечера или Сб/Вс)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-amber-500 inline-block" />
                  Коммиты в интервале 09:00–17:00 (будни)
                </span>
              </div>

              {/* Сетка календаря */}
              <div className="border border-border/50 rounded-xl overflow-hidden bg-background">
                <div className="grid grid-cols-7 text-center font-bold text-xs py-2 bg-muted/30 border-b border-border/40">
                  <span className="text-foreground">Пн</span>
                  <span className="text-foreground">Вт</span>
                  <span className="text-foreground">Ср</span>
                  <span className="text-foreground">Чт</span>
                  <span className="text-foreground">Пт</span>
                  <span className="text-rose-500 font-black">Сб</span>
                  <span className="text-rose-500 font-black">Вс</span>
                </div>

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

              {/* Фильтры и поиск реестра */}
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
                    Все ({GIT_AUDIT_SUMMARY.totalCommits})
                  </button>

                  <button
                    type="button"
                    onClick={() => setAuditFilter("off_hours")}
                    className={`text-xs py-1 rounded-lg font-bold transition-all ${
                      auditFilter === "off_hours" ? "bg-emerald-500 text-white shadow-xs" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    🟢 Личное время ({GIT_AUDIT_SUMMARY.offCommits})
                  </button>

                  <button
                    type="button"
                    onClick={() => setAuditFilter("work_hours")}
                    className={`text-xs py-1 rounded-lg font-bold transition-all ${
                      auditFilter === "work_hours" ? "bg-amber-500 text-white shadow-xs" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    🟡 Рабочие часы ({GIT_AUDIT_SUMMARY.workCommits})
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
                          ) : item.category === "transit_free" ? (
                            <Badge className="text-[10px] py-0 px-1.5 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-400/30">
                              🚗 {item.catLabel}
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
        {/* ПРЯМЫЕ РАСХОДЫ НА ИНФРАСТРУКТУРУ И AI-ИНСТРУМЕНТЫ                   */}
        {/* ================================================================== */}
        <Card className="rounded-2xl border-border/60 shadow-xs card-print text-left">
          <CardHeader className="pb-3 border-b border-border/30">
            <CardTitle className="text-base sm:text-lg font-bold flex items-center justify-between flex-wrap gap-2">
              <span className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-emerald-500 shrink-0" />
                Прямые финансовые расходы: подписки на AI и серверная инфраструктура
              </span>
              <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-400/30 text-xs font-mono font-bold">
                {rub(EXPENSES_TOTAL_PERIOD)} за 12 месяцев
              </Badge>
            </CardTitle>
            <CardDescription className="text-xs">
              Регулярные ежемесячные оплаты из личных средств на обеспечение непрерывной разработки и независимости платформы.
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

            {/* Примечание */}
            <p className="text-[11px] text-muted-foreground/80 leading-relaxed italic border-l-2 border-primary/40 pl-3">
              💡 <b>Примечание по учету:</b> {EXPENSES_NOTE}
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

          {/* Затраченное время разработки */}
          <Card className="rounded-2xl border-border/60 shadow-xs card-print">
            <CardContent className="p-4 text-left">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="h-4 w-4 text-purple-500" />
                Трудозатраты разработки
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

        {/* Подробное сравнение: «Разработка по минимальной ставке (Junior) vs Рынок IT-студий» */}
        <Card className="rounded-2xl border-border/60 shadow-sm card-print text-left">
          <CardHeader className="pb-3 border-b border-border/30">
            <CardTitle className="text-base sm:text-lg font-bold flex items-center justify-between flex-wrap gap-2">
              <span className="flex items-center gap-2">
                <Award className="h-5 w-5 text-amber-500 shrink-0" />
                Сравнение: Разработка по минимальной ставке vs Рыночная стоимость IT-студии
              </span>
              <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-400/30 text-xs">
                Экономия: {rub(stats.diff)} ({stats.diffPercent}%)
              </Badge>
            </CardTitle>
            <CardDescription className="text-xs">
              Объективное сопоставление: сколько проект стоит по минимальной ставке и сколько пришлось бы отдать разработчикам/студии под ключ (<b>2.8 – 3.8 млн ₽</b>).
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-4 space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-border/40 text-muted-foreground bg-muted/20">
                    <th className="py-2.5 px-3 font-semibold">Компонент / Этап платформы</th>
                    <th className="py-2.5 px-3 font-semibold text-emerald-600 dark:text-emerald-400">
                      Разработка по минимальной ставке (Junior, {JUNIOR_HOURLY_RATE} ₽/ч)
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
                      <span className="block text-[10px] text-muted-foreground">{TOTAL_GIT_COMMITS} коммитов: биллинг 54-ФЗ, ЛК жильца, мобильные мастера, монтаж</span>
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
                      Прямые расходы на инструменты (Gemini, Claude, VPN)
                      <span className="block text-[10px] text-muted-foreground">12 месяцев оплат из личных средств (3 338 ₽/мес)</span>
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
                Экономический итог для руководства:
              </p>
              <p>
                Даже при расчете по минимальной ставке начинающего разработчика (<b>{JUNIOR_HOURLY_RATE} ₽/час</b>), 
                созданный функционал и программный комплекс представляют собой ликвидный цифровой актив компании стоимостью <b>{rub(stats.juniorTotal + EXPENSES_TOTAL_PERIOD)}</b>.
              </p>
              <p>
                В случае обращения в коммерческую IT-студию разработка аналогичного комплекса под ключ (с 12 автоматизированными подсистемами, личным кабинетом абонента, мобильным приложением и эквайрингом 54-ФЗ) обошлась бы компании в <b>{rub(stats.marketTotal + EXPENSES_TOTAL_PERIOD)}</b> (диапазон <b>2.8 – 3.8 млн рублей</b>). 
                Самостоятельная реализация полного функционала позволила сберечь для компании <b>{rub(stats.diff)}</b> прямых расходов, полностью избавив предприятие от необходимости платить за сторонние SaaS-лицензии и автоматизировав рутину офиса.
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
