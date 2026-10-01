import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Trash2, RotateCcw, User, RefreshCw } from "lucide-react";

// Вкладка «Удалённые» (админ-панель): единый журнал удалений — что, кто, когда.
// Для мягко удалённых личных кабинетов (entity_type='user') доступно восстановление.
const TYPE_LABELS: Record<string, string> = {
  user: "Личный кабинет",
  role: "Роль",
  product: "Товар/услуга",
  address: "Адрес/подъезд",
  request: "Заявка",
  task: "Задача",
  client: "Клиент",
  login: "Логопас",
  category: "Категория",
  device_type: "Тип устройства",
};

export const DeletedItemsManager: React.FC = () => {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const { data: rows = [], isLoading, refetch } = useQuery({
    queryKey: ["deletion_log"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deletion_log")
        .select("*")
        .order("deleted_at", { ascending: false })
        .limit(5000);
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const types = useMemo(() => Array.from(new Set(rows.map((r) => r.entity_type))), [rows]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (typeFilter !== "all" && r.entity_type !== typeFilter) return false;
      if (!q) return true;
      const hay = [r.entity_label, r.deleted_by_name, r.entity_type].map((x) => String(x || "").toLowerCase()).join(" ");
      return hay.includes(q);
    });
  }, [rows, search, typeFilter]);

  const [purgingId, setPurgingId] = useState<string | null>(null);

  const restoreUser = async (r: any) => {
    try {
      const { error } = await supabase.from("profiles").update({ deleted_at: null, deleted_by: null }).eq("id", r.entity_id);
      if (error) throw error;
      await supabase.from("deletion_log").delete().eq("id", r.id);
      toast({ title: "Кабинет восстановлен", description: r.entity_label || r.entity_id });
      refetch();
    } catch (e: any) {
      toast({ title: "Ошибка восстановления", description: e.message, variant: "destructive" });
    }
  };

  // Полное (безвозвратное) удаление пользователя через серверный эндпоинт.
  // Двойное подтверждение: удаляются профиль, учётка, ПЛАТЕЖИ, заявки, роли —
  // пользователь полностью исчезает из статистики.
  const purgeUser = async (r: any) => {
    const label = r.entity_label || r.entity_id;
    if (!window.confirm(
      `ПОЛНОЕ УДАЛЕНИЕ без возможности восстановления.\n\n` +
      `Пользователь «${label}» и ВСЕ его данные (профиль, учётная запись, платежи, заявки, роли) будут удалены навсегда и исчезнут из статистики.\n\n` +
      `Это действие необратимо. Продолжить?`
    )) return;
    if (!window.confirm(`Подтвердите ещё раз: удалить «${label}» НАВСЕГДА?`)) return;

    setPurgingId(r.id);
    try {
      let token = "";
      try { token = localStorage.getItem("auth_token") || sessionStorage.getItem("auth_token") || ""; } catch { /* ignore */ }
      const resp = await fetch(`/backend-api/api/admin/users/${r.entity_id}/purge`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(json?.error || `Ошибка ${resp.status}`);
      // Журнал мог ещё содержать запись (если удаляли не из журнала) — подчищаем на всякий случай
      try { await supabase.from("deletion_log").delete().eq("id", r.id); } catch { /* ignore */ }
      toast({ title: "Удалено полностью", description: `«${label}» и связанные данные удалены навсегда` });
      refetch();
    } catch (e: any) {
      toast({ title: "Ошибка полного удаления", description: e.message, variant: "destructive" });
    } finally {
      setPurgingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2"><Trash2 className="h-5 w-5 text-destructive" /> Удалённые</h2>
          <p className="text-sm text-muted-foreground">Журнал удалений: что удалено, кем и когда. Записей: {filtered.length}.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-1.5"><RefreshCw className="h-4 w-4" /> Обновить</Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Поиск по названию или сотруднику…" className="pl-9 h-9" />
        </div>
        <div className="flex gap-1 flex-wrap">
          <Button variant={typeFilter === "all" ? "default" : "outline"} size="sm" onClick={() => setTypeFilter("all")} className="h-9 text-xs">Все</Button>
          {types.map((t) => (
            <Button key={t} variant={typeFilter === t ? "default" : "outline"} size="sm" onClick={() => setTypeFilter(t)} className="h-9 text-xs">
              {TYPE_LABELS[t] || t}
            </Button>
          ))}
        </div>
      </div>

      <Card className="shadow-sm">
        <CardHeader className="py-3 px-4 border-b"><CardTitle className="text-base">История удалений</CardTitle></CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 text-center text-muted-foreground text-sm">Загрузка…</div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground text-sm">Пока ничего не удаляли</div>
          ) : (
            <div className="divide-y max-h-[640px] overflow-y-auto">
              {filtered.map((r) => (
                <div key={r.id} className="p-3 flex items-start justify-between gap-3 hover:bg-muted/40">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">{TYPE_LABELS[r.entity_type] || r.entity_type}</Badge>
                      <span className="font-semibold text-sm">{r.entity_label || r.entity_id}</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                      <span className="flex items-center gap-1"><User className="h-3 w-3" /> удалил: <b className="text-foreground">{r.deleted_by_name || "—"}</b></span>
                      <span>· {r.deleted_at ? new Date(r.deleted_at).toLocaleString("ru-RU") : ""}</span>
                    </div>
                  </div>
                  {r.entity_type === "user" && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button variant="outline" size="sm" onClick={() => restoreUser(r)} className="h-8 gap-1 text-emerald-700 border-emerald-300 hover:bg-emerald-50">
                        <RotateCcw className="h-4 w-4" /> Восстановить
                      </Button>
                      <Button variant="outline" size="sm" disabled={purgingId === r.id} onClick={() => purgeUser(r)} className="h-8 gap-1 text-destructive border-destructive/40 hover:bg-destructive/10">
                        <Trash2 className="h-4 w-4" /> {purgingId === r.id ? "Удаление…" : "Удалить полностью"}
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DeletedItemsManager;
