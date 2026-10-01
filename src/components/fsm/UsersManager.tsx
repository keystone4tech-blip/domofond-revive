import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { logDeletion } from "@/lib/audit";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Search, Users, Trash2, ShieldCheck, ShieldAlert, Phone, Mail, Hash, RefreshCw } from "lucide-react";

// Личные кабинеты: все зарегистрированные пользователи с полной информацией, поиском,
// фильтрами и мягким удалением (с подтверждением и записью «кто удалил»).
type FilterKey = "all" | "verified" | "unverified" | "with_account" | "no_account";

export const UsersManager: React.FC = () => {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [deleting, setDeleting] = useState<string | null>(null);

  const { data: users = [], isLoading, refetch } = useQuery({
    queryKey: ["cabinet_users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, phone, email, address, apartment, account_number, is_verified, verification_status, has_intercom, created_at, deleted_at")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(100000);
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (filter === "verified" && !u.is_verified) return false;
      if (filter === "unverified" && u.is_verified) return false;
      if (filter === "with_account" && !u.account_number) return false;
      if (filter === "no_account" && u.account_number) return false;
      if (!q) return true;
      const hay = [u.full_name, u.phone, u.email, u.address, u.account_number].map((x) => String(x || "").toLowerCase()).join(" ");
      return hay.includes(q);
    });
  }, [users, search, filter]);

  const softDelete = async (u: any) => {
    setDeleting(u.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const uid = session?.user?.id || null;
      const { error } = await supabase
        .from("profiles")
        .update({ deleted_at: new Date().toISOString(), deleted_by: uid })
        .eq("id", u.id);
      if (error) throw error;
      await logDeletion("user", u.id, u.full_name || u.phone || u.email || u.id, {
        full_name: u.full_name, phone: u.phone, email: u.email, address: u.address, account_number: u.account_number,
      });
      toast({ title: "Кабинет удалён", description: `${u.full_name || u.phone || u.email}. Можно восстановить во вкладке «Удалённые» (админка).` });
      refetch();
    } catch (e: any) {
      toast({ title: "Ошибка удаления", description: e.message, variant: "destructive" });
    } finally {
      setDeleting(null);
    }
  };

  const filters: { key: FilterKey; label: string }[] = [
    { key: "all", label: "Все" },
    { key: "verified", label: "Подтверждённые" },
    { key: "unverified", label: "Без верификации" },
    { key: "with_account", label: "С лицевым счётом" },
    { key: "no_account", label: "Без счёта" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2"><Users className="h-5 w-5 text-primary" /> Личные кабинеты</h2>
          <p className="text-sm text-muted-foreground">Все зарегистрированные пользователи. Найдено: {filtered.length} из {users.length}.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-1.5"><RefreshCw className="h-4 w-4" /> Обновить</Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Поиск по ФИО, телефону, email, адресу, счёту…" className="pl-9 h-9" />
        </div>
        <div className="flex gap-1 flex-wrap">
          {filters.map((f) => (
            <Button key={f.key} variant={filter === f.key ? "default" : "outline"} size="sm" onClick={() => setFilter(f.key)} className="h-9 text-xs">
              {f.label}
            </Button>
          ))}
        </div>
      </div>

      <Card className="shadow-sm">
        <CardHeader className="py-3 px-4 border-b"><CardTitle className="text-base">Пользователи</CardTitle></CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 text-center text-muted-foreground text-sm">Загрузка…</div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground text-sm">Ничего не найдено</div>
          ) : (
            <div className="divide-y max-h-[640px] overflow-y-auto">
              {filtered.map((u) => (
                <div key={u.id} className="p-3 flex items-start justify-between gap-3 hover:bg-muted/40">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{u.full_name || "Без имени"}</span>
                      {u.is_verified ? (
                        <Badge className="bg-emerald-600 text-white gap-1 text-[10px] px-1.5 py-0"><ShieldCheck className="h-3 w-3" /> Подтверждён</Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1 text-[10px] px-1.5 py-0 text-amber-600 border-amber-300"><ShieldAlert className="h-3 w-3" /> Не подтверждён</Badge>
                      )}
                      {u.account_number && <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono gap-1"><Hash className="h-3 w-3" />{u.account_number}</Badge>}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-3 flex-wrap">
                      {u.phone && <span className="flex items-center gap-1 font-mono"><Phone className="h-3 w-3" />{u.phone}</span>}
                      {u.email && !String(u.email).startsWith("phone_") && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{u.email}</span>}
                      {u.created_at && <span>рег. {new Date(u.created_at).toLocaleDateString("ru-RU")}</span>}
                    </div>
                    {u.address && <div className="text-[11px] text-muted-foreground mt-0.5 truncate max-w-[520px]">{u.address}{u.apartment ? `, кв. ${u.apartment}` : ""}</div>}
                  </div>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0 h-8 gap-1">
                        <Trash2 className="h-4 w-4" /> Удалить
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Удалить личный кабинет?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Кабинет <b>{u.full_name || u.phone || u.email}</b> будет удалён (мягко). Данные сохранятся, удаление попадёт в журнал с вашим именем, и его можно восстановить во вкладке «Удалённые» (админ-панель).
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Отмена</AlertDialogCancel>
                        <AlertDialogAction onClick={() => softDelete(u)} disabled={deleting === u.id}
                          className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
                          Да, удалить
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default UsersManager;
