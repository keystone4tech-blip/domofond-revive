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
  GitBranch, Laptop, Cpu, Check, SlidersHorizontal
} from "lucide-react";
import {
  SUPERADMIN_EMAIL, OWNER,
  JUNIOR_HOURLY_RATE, MARKET_HOURLY_RATE,
  JUNIOR_BASE_COST, MARKET_BASE_COST,
  PROJECT_START_PRE_GIT, GITHUB_FIRST_COMMIT_DATE, GITHUB_FIRST_COMMIT_HASH,
  TOTAL_GIT_COMMITS, GIT_MONTHS_DEV, PRE_GIT_MONTHS_DEV, TOTAL_MONTHS_DEV,
  PROJECT_CHANGELOG, MODULE_META, KIND_META, Kind, ProjectModule, ProjectEntry
} from "@/data/projectChangelog";

// Вспомогательная функция красивого форматирования рублей
const rub = (n: number) => Math.round(n).toLocaleString("ru-RU") + " ₽";

// Режим отображения стоимости
type PricingMode = "junior" | "market" | "compare";

const Project: React.FC = () => {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);

  // Режим оценки: 'junior' (минимальная ставка), 'market' (рыночная), 'compare' (сравнение)
  const [pricingMode, setPricingMode] = useState<PricingMode>("compare");

  // Интерактивная пользовательская ставка для калькулятора (по умолчанию 750 ₽/ч)
  const [customRate, setCustomRate] = useState<number>(JUNIOR_HOURLY_RATE);

  // Фильтры и поиск по журналу
  const [search, setSearch] = useState("");
  const [selectedKind, setSelectedKind] = useState<string>("all");
  const [selectedModule, setSelectedModule] = useState<string>("all");

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
    // Обогащаем каждую запись changelog расчетом по обеим ставкам
    const items = PROJECT_CHANGELOG.map(e => ({
      ...e,
      juniorCost: e.hours * JUNIOR_HOURLY_RATE,
      marketCost: e.hours * MARKET_HOURLY_RATE,
      customCost: e.hours * customRate,
    }));

    const totalHours = items.reduce((sum, e) => sum + e.hours, 0);

    // Часы по коммитам в Git (все записи кроме начального года до Git)
    const gitItems = items.filter(e => e.id !== "stage-2024-10-01-0000");
    const gitHours = gitItems.reduce((sum, e) => sum + e.hours, 0);
    const preGitHours = totalHours - gitHours;

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
      gitHours,
      preGitHours,
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

  // Фильтрованный список задач в журнале
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
          body { background: white !important; color: black !important; font-size: 11pt; }
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
              Персональный учет эволюции кодовой базы с осени 2024 года, 541 коммит в GitHub и расчет себестоимости разработки.
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

        {/* Интерактивный переключатель режима расчета цен */}
        <Card className="no-print border-border/60 bg-muted/20 rounded-2xl shadow-xs">
          <CardContent className="p-3 sm:p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground w-full sm:w-auto">
              <Scale className="h-4 w-4 text-primary shrink-0" />
              <span>Режим расчета стоимости:</span>
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
                Жизненный цикл
              </div>
              <p className="text-xl sm:text-2xl font-black mt-2 tracking-tight">~2 года</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">с осени 2024 г. по н.в.</p>
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
              <p className="text-[11px] text-muted-foreground mt-0.5">старт в Git: 13.10.2025 ({GITHUB_FIRST_COMMIT_HASH})</p>
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
              <p className="text-[11px] text-muted-foreground mt-0.5">эквивалент 7.5 мес. фуллтайма</p>
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

        {/* Блок «Исторический таймлайн: От закрытого старта до публикации на GitHub» */}
        <Card className="rounded-2xl border-border/60 shadow-xs card-print text-left overflow-hidden">
          <CardHeader className="pb-3 border-b border-border/30 bg-muted/20">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <GitBranch className="h-5 w-5 text-primary shrink-0" />
              Эволюция проекта: От проектирования до GitHub и сегодняшних релизов
            </CardTitle>
            <CardDescription className="text-xs">
              Фиксация ключевых этапов жизни кодовой базы: 1 год предварительной разработки до Git + 1 год непрерывных коммитов в GitHub.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 pb-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Фаза 1 */}
              <div className="p-3.5 rounded-xl border border-border/60 bg-muted/15 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-amber-600 dark:text-amber-400">ФАЗА 1: ДО GIT</span>
                  <Badge variant="outline" className="text-[10px] py-0 px-1.5">~12 месяцев</Badge>
                </div>
                <h4 className="text-xs font-bold text-foreground">Закрытая разработка и фундамент</h4>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Осень 2024 — Октябрь 2025. Проектирование FSM-бизнес-процессов домофонного предприятия, сбор требований абонентского учета, 
                  составление структуры базы данных PostgreSQL на 50+ таблиц и логики диспетчеризации.
                </p>
                <div className="pt-1 text-[11px] font-mono text-muted-foreground flex justify-between">
                  <span>Трудозатраты:</span>
                  <span className="font-bold text-foreground">380 часов</span>
                </div>
              </div>

              {/* Точка заливки на GitHub */}
              <div className="p-3.5 rounded-xl border-2 border-primary/50 bg-primary/5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-primary">ТОЧКА ИНИЦИАЛИЗАЦИИ</span>
                  <Badge className="text-[10px] py-0 px-1.5 bg-primary text-primary-foreground font-mono">c2cfbfc</Badge>
                </div>
                <h4 className="text-xs font-bold text-foreground">Выгрузка на GitHub: 13.10.2025</h4>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  <b>13 октября 2025 г. в 23:26</b> проект официально опубликован в репозитории GitHub. 
                  Кодовая база зафиксирована на стеке Vite + React + TypeScript + Supabase. 
                  С этой секунды запущен строгий версионный учет каждой правки.
                </p>
                <div className="pt-1 text-[11px] font-mono text-muted-foreground flex justify-between">
                  <span>Первый коммит:</span>
                  <span className="font-bold text-primary">13.10.2025 23:26</span>
                </div>
              </div>

              {/* Фаза 2 */}
              <div className="p-3.5 rounded-xl border border-border/60 bg-muted/15 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400">ФАЗА 2: В GITHUB</span>
                  <Badge variant="outline" className="text-[10px] py-0 px-1.5">12 месяцев</Badge>
                </div>
                <h4 className="text-xs font-bold text-foreground">Непрерывная эволюция и релизы</h4>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Октябрь 2025 — Октябрь 2026. Зафиксирован <b>541 коммит</b>. Созданы модули CRM/FSM, 
                  эквайринг ЮKassa с фискализацией 54-ФЗ, личные кабинеты жильцов, учет монтажа новых домов, голосования ОСС и кадры.
                </p>
                <div className="pt-1 text-[11px] font-mono text-muted-foreground flex justify-between">
                  <span>Коммитов в Git:</span>
                  <span className="font-bold text-foreground">{TOTAL_GIT_COMMITS} шт.</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

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
                      Архитектурное ядро и схема БД (1-й год до Git)
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
                      Разработка 8 модулей в Git (12 месяцев, {stats.gitHours} ч)
                      <span className="block text-[10px] text-muted-foreground">541 коммит: биллинг 54-ФЗ, ЛК жильца, мобильные мастера, монтаж</span>
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {rub(stats.gitHours * JUNIOR_HOURLY_RATE)}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold text-blue-600 dark:text-blue-400">
                      {rub(stats.gitHours * MARKET_HOURLY_RATE)}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold text-right text-primary">
                      +{rub(stats.gitHours * (MARKET_HOURLY_RATE - JUNIOR_HOURLY_RATE))}
                    </td>
                  </tr>

                  <tr className="bg-primary/5 font-black text-sm">
                    <td className="py-3 px-3 text-foreground">
                      ИТОГОВАЯ ОЦЕНКА ПЛАТФОРМЫ «ДОМОФОНДАР»
                      <span className="block text-[10px] text-muted-foreground font-normal">Полный цикл разработки (~2 года, 1 170+ часов)</span>
                    </td>
                    <td className="py-3 px-3 font-mono text-emerald-600 dark:text-emerald-400">
                      {rub(stats.juniorTotal)}
                    </td>
                    <td className="py-3 px-3 font-mono text-blue-600 dark:text-blue-400">
                      {rub(stats.marketTotal)}
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
                Инженерное резюме для себя:
              </p>
              <p>
                Даже если оценивать проект по предельно консервативной минимальной ставке начинающего стажера (<b>{JUNIOR_HOURLY_RATE} ₽/час</b>), 
                созданная кодовая база представляет собой самостоятельный цифровой актив стоимостью <b>{rub(stats.juniorTotal)}</b>.
              </p>
              <p>
                В случае обращения в коммерческую IT-студию разработка аналогичного комплекса под ключ с 541 коммитом и интеграцией платежей обошлась бы компании в <b>{rub(stats.marketTotal)}</b>. 
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
              <span className="text-muted-foreground">Оценочная стоимость системы при ставке <b>{customRate} ₽/ч</b>:</span>
              <span className="font-mono font-black text-primary text-base">
                {rub(stats.customTotal)}
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
                  Хронологический журнал доработок платформы
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Всего записей в реестре: <b>{stats.items.length}</b>. Каждая запись содержит дату, точное время, затраченные часы и оценку себестоимости.
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
          <p>© 2024–{new Date().getFullYear()} {OWNER}. Персональный дневник инженера.</p>
          <p className="text-[11px] text-muted-foreground/70">
            Система автоматизированного учета инженерных трудозатрат и хронологии платформы «Домофондар».
          </p>
        </div>

      </div>
    </div>
  );
};

export default Project;
