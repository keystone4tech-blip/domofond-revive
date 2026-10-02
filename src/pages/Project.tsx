import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Loader2, ShieldCheck, Home, Rocket, Wrench, Sparkles, Database, Code2,
  TrendingUp, Calendar, Lock, FileText, Building2, Scale, Printer, Search,
  Filter, Layers, CheckCircle2, DollarSign, Award, Clock
} from "lucide-react";
import {
  SUPERADMIN_EMAIL, OWNER, HOURLY_RATE, BASE_PLATFORM_COST, BASE_PLATFORM_RANGE,
  PROJECT_START, TOTAL_GIT_COMMITS, TOTAL_MONTHS_DEV,
  PROJECT_CHANGELOG, MODULE_META, KIND_META, Kind, ProjectModule, ProjectEntry
} from "@/data/projectChangelog";

const rub = (n: number) => n.toLocaleString("ru-RU") + " ₽";

const Project: React.FC = () => {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);

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
        const email = (user?.email || "").toLowerCase();
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
      } catch (err) {
        if (!cancelled) navigate("/", { replace: true });
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();

    return () => { cancelled = true; };
  }, [navigate]);

  // Расчет суммарной аналитики и стоимости
  const stats = useMemo(() => {
    const items = PROJECT_CHANGELOG.map(e => ({
      ...e,
      cost: e.hours * HOURLY_RATE,
    }));

    const totalHours = items.reduce((sum, e) => sum + e.hours, 0);
    const totalDevelopmentCost = items.reduce((sum, e) => sum + e.cost, 0);
    const totalMarketValue = BASE_PLATFORM_COST + totalDevelopmentCost;

    // Распределение по категориям
    const byKind: Record<Kind, { hours: number; cost: number; count: number }> = {
      feature: { hours: 0, cost: 0, count: 0 },
      improvement: { hours: 0, cost: 0, count: 0 },
      fix: { hours: 0, cost: 0, count: 0 },
      infra: { hours: 0, cost: 0, count: 0 },
    };

    // Распределение по модулям
    const byModule: Record<string, { hours: number; cost: number; count: number }> = {};

    items.forEach(e => {
      byKind[e.kind].hours += e.hours;
      byKind[e.kind].cost += e.cost;
      byKind[e.kind].count += 1;

      if (!byModule[e.module]) {
        byModule[e.module] = { hours: 0, cost: 0, count: 0 };
      }
      byModule[e.module].hours += e.hours;
      byModule[e.module].cost += e.cost;
      byModule[e.module].count += 1;
    });

    return {
      items,
      totalHours,
      totalDevelopmentCost,
      totalMarketValue,
      byKind,
      byModule,
    };
  }, []);

  // Фильтрованный список задач
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
      {/* Стили для печати официального отчета А4 */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; color: black !important; font-size: 11pt; }
          .print-break { page-break-after: always; }
          .card-print { border: 1px solid #ccc !important; box-shadow: none !important; }
        }
      `}</style>

      <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        
        {/* Шапка дашборда */}
        <div className="flex items-center justify-between flex-wrap gap-4 no-print border-b border-border/40 pb-5">
          <div>
            <div className="flex items-center gap-2.5">
              <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-400/30 text-xs px-2.5 py-0.5 font-bold">
                👑 ПРИВАТНЫЙ АУДИТ
              </Badge>
              <span className="text-xs text-muted-foreground font-mono">ID: DOMOFONDAR-INVEST-REPORT</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight mt-1.5 flex items-center gap-2">
              <ShieldCheck className="h-7 w-7 text-primary shrink-0" />
              Паспорт и коммерческая оценка проекта «Домофондар»
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Оцифровка 12 месяцев непрерывной инженерной разработки, трудозатрат и рыночной стоимости.
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

        {/* Официальный юридический статус правообладателя */}
        <Card className="border-primary/40 bg-gradient-to-r from-primary/10 via-sky-500/5 to-primary/10 rounded-2xl shadow-sm card-print">
          <CardContent className="py-4 px-5 flex items-start gap-3.5 text-left">
            <Lock className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div className="text-xs sm:text-sm space-y-1">
              <p className="font-bold text-foreground">
                Интеллектуальная собственность и авторство:
              </p>
              <p className="text-muted-foreground leading-relaxed">
                Архитектурный фундамент, база данных, бизнес-логика FSM/CRM, мобильные сервисы и исходный код платформы «Домофондар» 
                являются авторской разработкой и <b>интеллектуальной собственностью разработчика {OWNER}</b>. 
                Настоящий документ сформирован для официального отчёта перед директором и инвесторами.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 4 Главных сводных KPI */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          <Card className="rounded-2xl border-border/60 shadow-xs card-print">
            <CardContent className="p-4 text-left">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Calendar className="h-4 w-4 text-primary" />
                Срок разработки
              </div>
              <p className="text-xl sm:text-2xl font-black mt-2 tracking-tight">{TOTAL_MONTHS_DEV} месяцев</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">с {PROJECT_START}</p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/60 shadow-xs card-print">
            <CardContent className="p-4 text-left">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Code2 className="h-4 w-4 text-blue-500" />
                Коммитов в Git
              </div>
              <p className="text-xl sm:text-2xl font-black mt-2 tracking-tight">{TOTAL_GIT_COMMITS} коммитов</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">непрерывная эволюция кодовой базы</p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/60 shadow-xs card-print">
            <CardContent className="p-4 text-left">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="h-4 w-4 text-purple-500" />
                Трудозатраты человека
              </div>
              <p className="text-xl sm:text-2xl font-black mt-2 tracking-tight text-purple-600 dark:text-purple-400">
                {stats.totalHours} часов
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">эквивалент 7.5 мес. фуллтайма</p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-primary/50 bg-primary/5 shadow-md shadow-primary/5 card-print">
            <CardContent className="p-4 text-left">
              <div className="flex items-center gap-1.5 text-xs text-primary font-bold">
                <Scale className="h-4 w-4" />
                Рыночная стоимость
              </div>
              <p className="text-xl sm:text-2xl font-black mt-2 tracking-tight text-primary">
                {rub(stats.totalMarketValue)}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">оценка коммерческой студии</p>
            </CardContent>
          </Card>
        </div>

        {/* Блок «Экономическое обоснование и методология для руководства» */}
        <Card className="rounded-2xl border-border/60 shadow-sm card-print text-left">
          <CardHeader className="pb-3 border-b border-border/30">
            <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
              <Award className="h-5 w-5 text-amber-500 shrink-0" />
              Экономическое обоснование и методология расчёта для руководства
            </CardTitle>
            <CardDescription className="text-xs">
              Почему программный комплекс «Домофондар» обладает высокой капитализацией и как окупаются инвестиции.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-4 text-xs sm:text-sm leading-relaxed text-muted-foreground">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
              <div className="p-3.5 rounded-xl border border-border/60 bg-muted/20 space-y-1.5">
                <p className="font-bold text-foreground flex items-center gap-1.5">
                  <Building2 className="h-4 w-4 text-primary" />
                  Вариант 1: Заказ в IT-студии
                </p>
                <p className="text-[11px] leading-snug">
                  Разработка системы такого масштаба (с 50+ таблицами БД, чеками 54-ФЗ, RLS, мобильным приложением и 1С-парсером) 
                  в аккредитованных студиях стоит <b>от 3 500 000 до 5 000 000 ₽</b> со сроками 1.5–2 года и штатом из 4 специалистов.
                </p>
              </div>

              <div className="p-3.5 rounded-xl border border-border/60 bg-muted/20 space-y-1.5">
                <p className="font-bold text-foreground flex items-center gap-1.5">
                  <DollarSign className="h-4 w-4 text-emerald-500" />
                  Вариант 2: Аренда SaaS-решений
                </p>
                <p className="text-[11px] leading-snug">
                  Подписка на готовые платформы (Битрикс24 Энтерпрайз + МойСклад + сервис для ЖКХ) на 20+ сотрудников 
                  обходится компании в <b>от 60 000 до 120 000 ₽ в месяц</b> (до 1 440 000 ₽ ежегодно) без права владения кодом и базой.
                </p>
              </div>

              <div className="p-3.5 rounded-xl border-2 border-emerald-500/40 bg-emerald-500/5 space-y-1.5">
                <p className="font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  Решение: Собственный комплекс
                </p>
                <p className="text-[11px] leading-snug text-foreground">
                  Компания <b>полностью владеет независимым активом</b>, не платит ежемесячную арендную дань сторонним платформам, 
                  а база клиентов на 12 600+ счетов надёжно защищена на собственных выделенных серверах.
                </p>
              </div>
            </div>

            <div className="pt-2 border-t border-border/30 text-[11px] space-y-1">
              <p>
                <b>Методика расчёта трудозатрат:</b> Все человеко-часы оценены по консервативной рыночной ставке квалифицированного Senior Fullstack-разработчика 
                (<b>{rub(HOURLY_RATE)}/час</b>), действующей на IT-рынке РФ в 2025–2026 гг.
              </p>
              <p>
                В трудозатраты каждого этапа заложено реальное время живого специалиста: проектирование схемы данных, написание чистого отказоустойчивого кода, 
                тестирование крайних случаев, обеспечение безопасности персональных данных (ФЗ-152), адаптивная вёрстка и деплой на сервере.
              </p>
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
                Распределение трудозатрат по модулям
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-2.5">
              {Object.keys(MODULE_META).map(mKey => {
                const mod = mKey as ProjectModule;
                const data = stats.byModule[mod] || { hours: 0, cost: 0, count: 0 };
                if (data.hours === 0) return null;
                const percent = Math.round((data.hours / stats.totalHours) * 100);

                return (
                  <div key={mod} className="space-y-1">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-foreground">{MODULE_META[mod].label}</span>
                      <span className="text-muted-foreground font-mono">{data.hours} ч · {rub(data.cost)} ({percent}%)</span>
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

          {/* По категориям работ */}
          <Card className="rounded-2xl border-border/60 shadow-xs card-print text-left">
            <CardHeader className="pb-3 border-b border-border/30">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Wrench className="h-4 w-4 text-primary" />
                Структура инженерных работ
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-2.5">
              {(Object.keys(KIND_META) as Kind[]).map(k => {
                const data = stats.byKind[k];
                if (data.hours === 0) return null;
                const percent = Math.round((data.hours / stats.totalHours) * 100);

                return (
                  <div key={k} className="space-y-1">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-foreground">{KIND_META[k].label}</span>
                      <span className="text-muted-foreground font-mono">{data.hours} ч · {rub(data.cost)} ({percent}%)</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div 
                        className="h-full bg-blue-600 rounded-full transition-all duration-500" 
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>

        {/* Карта выполненных работ (Changelog с фильтрами) */}
        <Card className="rounded-2xl border-border/60 shadow-sm card-print text-left">
          <CardHeader className="pb-4 border-b border-border/30">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  Хронологическая карта выполненных улучшений
                </CardTitle>
                <CardDescription className="text-xs">
                  Всего зафиксировано {stats.items.length} ключевых производственных этапов с датами, временем и трудозатратами.
                </CardDescription>
              </div>

              <div className="flex items-center gap-2 font-mono text-xs">
                <Badge variant="outline" className="px-3 py-1 font-bold">
                  Показано: {filteredItems.length} из {stats.items.length}
                </Badge>
              </div>
            </div>

            {/* Фильтры и поиск (скрываются при печати) */}
            <div className="no-print pt-4 flex flex-wrap items-center gap-2.5">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Поиск по названию или описанию задачи..."
                  className="pl-9 h-9 text-xs rounded-xl bg-muted/40"
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
                  По заданным фильтрам задач не найдено.
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
                        <span className="text-base sm:text-lg font-black text-primary font-mono">
                          {rub(item.cost)}
                        </span>
                        <span className="text-xs text-muted-foreground font-mono">
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
                {rub(filteredItems.reduce((acc, cur) => acc + cur.cost, 0))} ({filteredItems.reduce((acc, cur) => acc + cur.hours, 0)} ч)
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Подвал с копирайтом */}
        <div className="text-center text-xs text-muted-foreground pt-4 pb-8 space-y-1">
          <p>© 2025–{new Date().getFullYear()} {OWNER}. Все исключительные права защищены.</p>
          <p className="text-[11px] text-muted-foreground/70">
            Система автоматизированного учета инженерных трудозатрат платформы «Домофондар».
          </p>
        </div>

      </div>
    </div>
  );
};

export default Project;
