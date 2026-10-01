import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Search, Filter, User, UserMinus, Loader2, RefreshCw,
  Phone, Cake, MapPin, CalendarClock, ClipboardCheck, UserCheck, LogOut, Clock, ListChecks,
} from "lucide-react";
import { CRMRole } from "@/types/crmRoles";

// ============================================================================
// Вкладка «Бывшие сотрудники» — архив уволенных (снятых с должности).
// Данные берём из журнала удалений (deletion_log, entity_type='employee'),
// где при снятии сохраняется полный снимок анкеты. Миграция не нужна.
// Позволяет в любой момент найти ушедшего сотрудника и посмотреть всю информацию.
// ============================================================================

interface FormerRow {
  id: string;             // id записи журнала
  entity_id: string;      // id бывшего сотрудника
  entity_label: string;   // ФИО
  snapshot: any;          // полный снимок данных сотрудника на момент увольнения
  deleted_by_name: string | null;
  deleted_at: string | null;
}

const fmtDate = (d?: string | null) => d ? new Date(d).toLocaleDateString("ru-RU") : "—";
const fmtDateTime = (d?: string | null) => d ? new Date(d).toLocaleString("ru-RU") : "—";

// Срок работы между двумя датами в читаемом виде
const tenure = (from?: string | null, to?: string | null): string => {
  if (!from || !to) return "—";
  const a = new Date(from).getTime();
  const b = new Date(to).getTime();
  if (isNaN(a) || isNaN(b) || b < a) return "—";
  const days = Math.floor((b - a) / (24 * 3600 * 1000));
  if (days < 1) return "меньше дня";
  const years = Math.floor(days / 365);
  const months = Math.floor((days % 365) / 30);
  const rem = days % 30;
  const parts: string[] = [];
  if (years) parts.push(`${years} г.`);
  if (months) parts.push(`${months} мес.`);
  if (!years && rem) parts.push(`${rem} дн.`);
  return parts.join(" ") || `${days} дн.`;
};

export const FormerEmployeesManager = () => {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [detail, setDetail] = useState<FormerRow | null>(null);
  const [taskStats, setTaskStats] = useState<{ loading: boolean; count: number | null }>({ loading: false, count: null });

  // Роли — для читаемых названий должностей
  const { data: crmRoles = [] } = useQuery<CRMRole[]>({
    queryKey: ["crm_roles"],
    queryFn: async () => {
      const { data } = await supabase.from("crm_roles").select("*");
      return (data || []) as CRMRole[];
    },
  });

  // Архив бывших сотрудников из журнала удалений
  const { data: rows = [], isLoading, refetch } = useQuery<FormerRow[]>({
    queryKey: ["former_employees"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deletion_log")
        .select("*")
        .eq("entity_type", "employee")
        .order("deleted_at", { ascending: false })
        .limit(5000);
      if (error) throw error;
      return (data || []) as FormerRow[];
    },
  });

  const roleName = (snap: any): string => {
    if (!snap) return "—";
    if (snap.role) {
      const found = crmRoles.find((r) => r.id === snap.role);
      if (found) return found.name;
    }
    return snap.position || snap.role || "—";
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      const snap = r.snapshot || {};
      if (roleFilter !== "all") {
        const byPos = crmRoles.find((x) => x.name.toLowerCase() === String(snap.position || "").toLowerCase());
        if (snap.role !== roleFilter && byPos?.id !== roleFilter) return false;
      }
      if (q) {
        const hay = [r.entity_label, snap.phone, snap.contact_phone, snap.residence_address, r.deleted_by_name]
          .map((x) => String(x || "").toLowerCase()).join(" ");
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, search, roleFilter, crmRoles]);

  // При открытии карточки — подтягиваем статистику (кол-во задач бывшего сотрудника)
  const openDetail = async (r: FormerRow) => {
    setDetail(r);
    setTaskStats({ loading: true, count: null });
    try {
      const empId = r.entity_id;
      const { count } = await supabase
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .or(`assigned_to.eq.${empId},accepted_by.eq.${empId}`);
      setTaskStats({ loading: false, count: count ?? 0 });
    } catch {
      setTaskStats({ loading: false, count: null });
    }
  };

  const snap = detail?.snapshot || {};

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-base font-bold flex items-center gap-2">
            <UserMinus className="h-5 w-5 text-muted-foreground" /> Бывшие сотрудники
          </h2>
          <p className="text-sm text-muted-foreground">
            Архив уволенных с полной анкетой. Записей: {filtered.length}.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-1.5">
          <RefreshCw className="h-4 w-4" /> Обновить
        </Button>
      </div>

      {/* Поиск и фильтр */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Поиск по ФИО, телефону, адресу, кто снял…" className="pl-10 h-9" />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="h-9 w-[190px]">
            <div className="flex items-center gap-1.5 text-sm">
              <Filter className="h-3.5 w-3.5 text-muted-foreground" />
              <SelectValue />
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все роли</SelectItem>
            {crmRoles.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card className="border-border/60 shadow-sm">
        <CardHeader className="py-3 px-4 border-b">
          <CardTitle className="text-base">Архив</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" /></div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">Пока нет бывших сотрудников</div>
          ) : (
            <div className="divide-y max-h-[640px] overflow-y-auto">
              {filtered.map((r) => {
                const s = r.snapshot || {};
                return (
                  <div key={r.id} className="p-3 flex items-center gap-3 hover:bg-muted/40 cursor-pointer" onClick={() => openDetail(r)}>
                    {s.photo_url ? (
                      <img src={s.photo_url} alt={r.entity_label} className="w-10 h-10 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                        <User className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">{r.entity_label || "—"}</span>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">{roleName(s)}</Badge>
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        Снят: {fmtDate(r.deleted_at)}{r.deleted_by_name ? ` · ${r.deleted_by_name}` : ""}
                      </div>
                    </div>
                    <Badge variant="secondary" className="shrink-0 gap-1"><LogOut className="h-3 w-3" /> Уволен</Badge>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Карточка бывшего сотрудника */}
      <Dialog open={!!detail} onOpenChange={(o) => { if (!o) setDetail(null); }}>
        <DialogContent className="max-w-lg">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle className="text-lg font-bold flex items-center gap-2">
                  <User className="h-5 w-5 text-primary" /> {detail.entity_label}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-3">
                {/* Фото */}
                <div className="flex justify-center">
                  {snap.photo_url ? (
                    <img src={snap.photo_url} alt={detail.entity_label} className="w-24 h-24 rounded-full object-cover border-2 border-muted shadow-sm" />
                  ) : (
                    <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center border-2 border-muted">
                      <User className="h-10 w-10 text-muted-foreground" />
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap justify-center">
                  <Badge variant="outline" className="bg-muted/50">{roleName(snap)}</Badge>
                  <Badge variant="secondary" className="gap-1"><LogOut className="h-3 w-3" /> Уволен {fmtDate(detail.deleted_at)}</Badge>
                </div>

                {/* Личные данные */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-sm">
                  <div className="flex items-start gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[11px] text-muted-foreground">Телефон</p>
                      <p className="font-medium">{snap.contact_phone || snap.phone || "—"}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Cake className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[11px] text-muted-foreground">Дата рождения</p>
                      <p className="font-medium">{fmtDate(snap.date_of_birth)}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 sm:col-span-2">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[11px] text-muted-foreground">Адрес проживания</p>
                      <p className="font-medium">{snap.residence_address || "—"}</p>
                    </div>
                  </div>
                </div>

                {/* Трудовая хронология + статистика */}
                <div className="border-t pt-3 grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-sm">
                  <div className="flex items-start gap-2">
                    <ClipboardCheck className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[11px] text-muted-foreground">Кто назначил</p>
                      <p className="font-medium">{snap.assigned_by_name || "—"}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <CalendarClock className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[11px] text-muted-foreground">Назначен</p>
                      <p className="font-medium">{fmtDate(snap.assigned_at || snap.created_at)}</p>
                    </div>
                  </div>
                  {snap.activated_at && (
                    <div className="flex items-start gap-2">
                      <UserCheck className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                      <div>
                        <p className="text-[11px] text-muted-foreground">Активирован</p>
                        <p className="font-medium">{fmtDateTime(snap.activated_at)}</p>
                      </div>
                    </div>
                  )}
                  <div className="flex items-start gap-2">
                    <LogOut className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[11px] text-muted-foreground">Снят с должности</p>
                      <p className="font-medium">{fmtDate(detail.deleted_at)}{detail.deleted_by_name ? ` · ${detail.deleted_by_name}` : ""}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[11px] text-muted-foreground">Срок работы</p>
                      <p className="font-medium">{tenure(snap.assigned_at || snap.created_at, detail.deleted_at)}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <ListChecks className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[11px] text-muted-foreground">Задач в работе/истории</p>
                      <p className="font-medium">
                        {taskStats.loading ? "…" : taskStats.count === null ? "—" : taskStats.count}
                      </p>
                    </div>
                  </div>
                </div>

                <p className="text-[11px] text-muted-foreground border-t pt-2">
                  Это архивная запись. Учётная запись пользователя на сайте сохранена — при необходимости сотрудника можно назначить заново во вкладке «Сотрудники».
                </p>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FormerEmployeesManager;
