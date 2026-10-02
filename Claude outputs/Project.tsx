import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Loader2, ShieldCheck, Home, Rocket, Wrench, Sparkles, Database, Code2,
  TrendingUp, Calendar, Lock, FileText, Building2, Scale,
} from "lucide-react";

// ============================================================================
// СТРАНИЦА «ПРОЕКТ» — приватный раздел ТОЛЬКО для суперадмина.
// Карта улучшений (changelog), статистика и рыночная оценка стоимости проекта.
// Для оценки и предоставления директору. Любой не-суперадмин → редирект на «/».
// Код и все компоненты — интеллектуальная собственность Можнова Владимира Сергеевича.
// ============================================================================

const SUPERADMIN_EMAIL = "viruscorp4@gmail.com";
const OWNER = "Можнов Владимир Сергеевич";

// Средняя ставка по рынку РФ (2026), middle/senior fullstack — для расчётов.
const HOURLY_RATE = 2500; // ₽/час

// Оценка воспроизведения базовой платформы «с нуля» студией (точка + диапазон).
const BASE_PLATFORM_COST = 2000000; // ₽
const BASE_PLATFORM_RANGE = "1 500 000 – 2 500 000 ₽";

// Старт проекта (отредактируйте при необходимости).
const PROJECT_START = "Май 2026";

type Kind = "feature" | "fix" | "improvement" | "infra";

interface Entry {
  date: string;
  title: string;
  kind: Kind;
  hours: number;      // оценка трудозатрат
  note?: string;
}

// ──────────────────────────────────────────────────────────────────────────
// КАРТА УЛУЧШЕНИЙ. Добавляйте новые записи СВЕРХУ. Стоимость считается
// автоматически: hours × ставка. Итоги пересчитываются сами.
// ──────────────────────────────────────────────────────────────────────────
const CHANGELOG: Entry[] = [
  { date: "2026-10-02", title: "Приватная страница «Проект»: карта улучшений, статистика и рыночная оценка (только суперадмин)", kind: "feature", hours: 8 },
  { date: "2026-10-02", title: "Компактный список заявок (строки-карточки) и уплотнённая карточка заявки по UX-практикам", kind: "improvement", hours: 12 },
  { date: "2026-10-02", title: "Финансовый журнал: показ только реальных платежей (убраны служебные нулевые заявки)", kind: "fix", hours: 4 },
  { date: "2026-10-02", title: "Исправление ложного статуса «Частный клиент» + определение адреса по нашему фонду", kind: "fix", hours: 8 },
  { date: "2026-10-01", title: "Раздел «Новые дома» (монтаж): заявки, контроль оборудования, итоги и выгрузка в Excel", kind: "feature", hours: 40 },
  { date: "2026-10-01", title: "История статусов подъездов (когда на монтаже / на обслуживании), таймлайн объекта", kind: "feature", hours: 10 },
  { date: "2026-10-01", title: "Фото сотрудника в анкете: селфи с камеры / загрузка + сжатие в браузере", kind: "feature", hours: 14 },
  { date: "2026-10-01", title: "Вкладка «Бывшие сотрудники»: архив с полной анкетой и возврат в штат", kind: "feature", hours: 14 },
  { date: "2026-09-30", title: "Анкета активации сотрудника + уведомление в кабинете + попап при входе в CRM", kind: "feature", hours: 20 },
  { date: "2026-09-30", title: "Модуль сотрудников: фильтры, «кто назначил / когда», карточка, удаление с журналом", kind: "feature", hours: 24 },
  { date: "2026-09-30", title: "Полное (безвозвратное) удаление пользователей и тестовых регистраций", kind: "feature", hours: 8 },
  { date: "2026-09-29", title: "Система удаления: мягкое удаление, журнал «кто удалил», вкладка «Удалённые», восстановление", kind: "feature", hours: 36 },
  { date: "2026-09-29", title: "Подтверждение + аудит удаления во всех справочниках и менеджерах", kind: "improvement", hours: 10 },
  { date: "2026-09-28", title: "Подбор оборудования: сценарии анкеты → услуги → привязанное оборудование", kind: "feature", hours: 20 },
  { date: "2026-09-28", title: "Карточка «Ваше обслуживание» в кабинете: компактный вид, скрытие внутренних тарифов", kind: "improvement", hours: 8 },
  { date: "2026-09-28", title: "Исправления: точный поиск лицевого счёта и корректная цена на ключи/монтаж", kind: "fix", hours: 10 },
];

const KIND_META: Record<Kind, { label: string; cls: string; icon: typeof Rocket }> = {
  feature: { label: "Новая функция", cls: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-200", icon: Rocket },
  fix: { label: "Исправление", cls: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200", icon: Wrench },
  improvement: { label: "Улучшение", cls: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200", icon: Sparkles },
  infra: { label: "Инфраструктура", cls: "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-200", icon: Database },
};

const rub = (n: number) => n.toLocaleString("ru-RU") + " ₽";
const fmtDate = (d: string) => new Date(d).toLocaleDateString("ru-RU", { day: "2-digit", month: "long", year: "numeric" });

const Project = () => {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);

  // ЗАЩИТА ДОСТУПА: только суперадмин. Иначе — редирект на главную.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const email = (user?.email || "").toLowerCase();
        let ok = email === SUPERADMIN_EMAIL;
        if (!ok && user) {
          // запасная проверка роли в БД
          try {
            const { data } = await supabase
              .from("user_roles").select("role").eq("user_id", user.id).eq("role", "superadmin").limit(1);
            ok = !!(data && data.length);
          } catch { /* ignore */ }
        }
        if (cancelled) return;
        if (!ok) { navigate("/", { replace: true }); return; }
        setAllowed(true);
      } catch {
        if (!cancelled) navigate("/", { replace: true });
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => { cancelled = true; };
  }, [navigate]);

  const stats = useMemo(() => {
    const items = CHANGELOG.map(e => ({ ...e, cost: e.hours * HOURLY_RATE }));
    const improvementsTotal = items.reduce((s, e) => s + e.cost, 0);
    const hoursTotal = items.reduce((s, e) => s + e.hours, 0);
    const byKind: Record<Kind, number> = { feature: 0, fix: 0, improvement: 0, infra: 0 };
    items.forEach(e => { byKind[e.kind] += e.cost; });
    const marketTotal = BASE_PLATFORM_COST + improvementsTotal;
    return { items, improvementsTotal, hoursTotal, byKind, marketTotal };
  }, []);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!allowed) return null;

  const maxKind = Math.max(...Object.values(stats.byKind), 1);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Шапка */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-extrabold flex items-center gap-2">
              <ShieldCheck className="h-6 w-6 text-primary" /> Проект «Домофондар»
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Карта улучшений, статистика и рыночная оценка. Приватный раздел — виден только суперадмину.
            </p>
          </div>
          <Button variant="outline" onClick={() => navigate("/cabinet")} className="gap-1.5">
            <Home className="h-4 w-4" /> В кабинет
          </Button>
        </div>

        {/* Собственность / интеллектуальная собственность */}
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="py-4 flex items-start gap-3">
            <Lock className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <p className="text-sm">
              Исходный код сайта и все его компоненты (CRM, FSM, личные кабинеты, интеграции)
              являются собственностью и <b>интеллектуальной собственностью {OWNER}</b>.
              Любое копирование, распространение или использование без письменного согласия владельца запрещено.
            </p>
          </CardContent>
        </Card>

        {/* Ключевые показатели */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatTile icon={Calendar} label="Старт проекта" value={PROJECT_START} sub="начало сборки платформы" />
          <StatTile icon={Code2} label="Улучшений в карте" value={String(stats.items.length)} sub={`${stats.hoursTotal} ч работ`} />
          <StatTile icon={TrendingUp} label="Стоимость доработок" value={rub(stats.improvementsTotal)} sub={`по ставке ${rub(HOURLY_RATE)}/час`} />
          <StatTile icon={Scale} label="Рыночная оценка" value={rub(stats.marketTotal)} sub="платформа + доработки" highlight />
        </div>

        {/* Оценка стоимости */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Building2 className="h-5 w-5 text-primary" /> Рыночная оценка проекта</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              <div className="rounded-xl border p-3">
                <p className="text-xs text-muted-foreground">Базовая платформа (воспроизведение «с нуля»)</p>
                <p className="font-bold text-lg mt-1">{rub(BASE_PLATFORM_COST)}</p>
                <p className="text-[11px] text-muted-foreground">диапазон: {BASE_PLATFORM_RANGE}</p>
              </div>
              <div className="rounded-xl border p-3">
                <p className="text-xs text-muted-foreground">Доработки и улучшения</p>
                <p className="font-bold text-lg mt-1">{rub(stats.improvementsTotal)}</p>
                <p className="text-[11px] text-muted-foreground">{stats.items.length} позиций, {stats.hoursTotal} ч</p>
              </div>
              <div className="rounded-xl border-2 border-primary/40 bg-primary/5 p-3">
                <p className="text-xs text-muted-foreground">Итоговая рыночная стоимость</p>
                <p className="font-extrabold text-xl mt-1 text-primary">{rub(stats.marketTotal)}</p>
                <p className="text-[11px] text-muted-foreground">для оценки и презентации директору</p>
              </div>
            </div>

            {/* Разбивка доработок по типам */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase">Доработки по типам</p>
              {(Object.keys(stats.byKind) as Kind[]).filter(k => stats.byKind[k] > 0).map(k => {
                const meta = KIND_META[k];
                return (
                  <div key={k} className="flex items-center gap-3">
                    <span className="w-32 text-xs shrink-0">{meta.label}</span>
                    <div className="flex-1 h-5 rounded-md bg-muted overflow-hidden">
                      <div className="h-full bg-primary/70 rounded-md" style={{ width: `${(stats.byKind[k] / maxKind) * 100}%` }} />
                    </div>
                    <span className="w-28 text-right text-xs font-semibold shrink-0">{rub(stats.byKind[k])}</span>
                  </div>
                );
              })}
            </div>

            <p className="text-[11px] text-muted-foreground border-t pt-3">
              Цены — средние по рынку РФ (2026), ориентировочная ставка {rub(HOURLY_RATE)}/час. Оценка носит
              информационный характер для внутренней презентации и не является публичной офертой.
            </p>
          </CardContent>
        </Card>

        {/* Карта улучшений */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><FileText className="h-5 w-5 text-primary" /> Карта улучшений</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {stats.items.map((e, i) => {
                const meta = KIND_META[e.kind];
                const Icon = meta.icon;
                return (
                  <div key={i} className="px-4 py-3 flex items-start gap-3 hover:bg-muted/30">
                    <div className="shrink-0 mt-0.5"><Icon className="h-4 w-4 text-muted-foreground" /></div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{e.title}</p>
                      <div className="flex items-center gap-2 flex-wrap mt-1">
                        <Badge variant="outline" className={`text-[10px] ${meta.cls}`}>{meta.label}</Badge>
                        <span className="text-[11px] text-muted-foreground">{fmtDate(e.date)}</span>
                        <span className="text-[11px] text-muted-foreground">· {e.hours} ч</span>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <span className="text-sm font-bold text-primary">{rub(e.cost)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="px-4 py-3 border-t flex items-center justify-between bg-muted/30">
              <span className="font-semibold text-sm">Итого доработок ({stats.items.length})</span>
              <span className="font-extrabold text-primary">{rub(stats.improvementsTotal)}</span>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-[11px] text-muted-foreground pb-4">
          © {new Date().getFullYear()} {OWNER}. Все права защищены.
        </p>
      </div>
    </div>
  );
};

const StatTile = ({ icon: Icon, label, value, sub, highlight }: { icon: typeof Rocket; label: string; value: string; sub?: string; highlight?: boolean }) => (
  <Card className={highlight ? "border-primary/40 bg-primary/5" : ""}>
    <CardContent className="py-4">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Icon className="h-3.5 w-3.5" /> {label}</div>
      <p className={`font-extrabold mt-1 ${highlight ? "text-primary text-lg" : "text-base"}`}>{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
    </CardContent>
  </Card>
);

export default Project;
