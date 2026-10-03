import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { logDeletion } from "@/lib/audit";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Search, Users, Trash2, ShieldCheck, ShieldAlert, Phone, Mail, Hash, RefreshCw, Pencil, Loader2, Link2 } from "lucide-react";

// Нормализация адреса — ТА ЖЕ логика, что в кабинете (DebtCard), чтобы привязка совпадала 1:1.
const normStreet = (str: string) => {
  if (!str) return "";
  let c = str.toLowerCase().trim();
  if (c.includes(",")) { const parts = c.split(","); if (parts.length >= 2) c = parts[1].trim(); }
  return c
    .replace(/^(г\.|город|пос\.|поселок|аул|п\.|х\.|хутор|ст\.|станица)\s+[^,]+/gi, "")
    .replace(/(?:\b(?:ул\.?|улица|пер\.?|переулок|проспект|пр-кт|пр\.?|аллея|бульвар|тракт|шоссе)\b|\(ул\))\s*/gi, "")
    .replace(/(?:^|\s)(?:им\.?|имени|генерала?|академика?|маршала?|улице)(?:\s|$)/gi, "")
    .replace(/[^а-яa-z0-9]/g, "")
    .trim();
};
const normHouse = (h: string) =>
  (h || "").toLowerCase().trim()
    .replace(/^(д\.\s*|дом\s*)/i, "")
    .replace(/(?:корп\.?|корпус)\s*/gi, "к")
    .replace(/[^а-яa-z0-9]/g, "").trim();
const normApt = (a: string) =>
  (a || "").toLowerCase().trim()
    .replace(/^(кв\.\s*|квартира\s*)/i, "")
    .replace(/[^а-яa-z0-9]/g, "").trim();
const extractApt = (addr: string) => {
  const m = (addr || "").match(/,\s*(?:кв\.?|квартира)\s*([а-яa-z0-9-+]+)/i);
  return m ? m[1].trim() : "";
};
// Подбор лицевого счёта из списка accounts по нормализованным улице+дому+квартире.
const findAccountNumber = (u: any, accounts: any[]): string | null => {
  const uStreet = normStreet(u.address || "");
  const hm = (u.address || "").match(/д\.?\s*(\d+[а-яa-z]?)/i);
  const uHouse = normHouse(hm ? hm[1] : "");
  const uApt = normApt((u.apartment || "").toString() || extractApt(u.address || ""));
  if (!uStreet || !uHouse || !uApt) return null;
  for (const a of accounts) {
    const dbParts = (a.address || "").split(",");
    if (dbParts.length < 3) continue;
    const dbStreet = normStreet(dbParts[1]);
    const dbHouseFull = dbParts.slice(2).join(", ")
      .replace(/,\s*(?:п(?:одъезд)?\.?\s*\d+).*$/i, "")
      .replace(/,\s*(?:кв\.?\s*[а-яa-z0-9-+]+).*$/i, "");
    const dbHouse = normHouse(dbHouseFull);
    const dbApt = normApt((a.apartment || "").toString().trim() || extractApt(a.address || ""));
    if (dbStreet === uStreet && dbHouse === uHouse && dbApt === uApt) return a.account_number;
  }
  return null;
};

// Личные кабинеты: все зарегистрированные пользователи с полной информацией, поиском,
// фильтрами и мягким удалением (с подтверждением и записью «кто удалил»).
type FilterKey = "all" | "verified" | "unverified" | "with_account" | "no_account";

export const UsersManager: React.FC = () => {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [deleting, setDeleting] = useState<string | null>(null);

  // Редактирование профиля пользователя (ФИО, телефон, адрес с подъездом, квартира, этаж, лицевой счёт)
  const [editUser, setEditUser] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({ full_name: "", phone: "", address: "", apartment: "", floor: "", account_number: "" });
  const [saving, setSaving] = useState(false);

  // Массовая автопривязка лицевых счетов по адресу (решает backlog непривязанных профилей)
  const [linking, setLinking] = useState(false);
  const [linkPreview, setLinkPreview] = useState<{ matches: any[] } | null>(null);

  const openEdit = (u: any) => {
    setEditForm({
      full_name: u.full_name || "",
      phone: u.phone || "",
      address: u.address || "",
      apartment: u.apartment || "",
      floor: u.floor || "",
      account_number: u.account_number || "",
    });
    setEditUser(u);
  };

  const saveEdit = async () => {
    if (!editUser) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: editForm.full_name.trim() || null,
          phone: editForm.phone.trim() || null,
          address: editForm.address.trim() || null,
          apartment: editForm.apartment.trim() || null,
          floor: editForm.floor.trim() || null,
          account_number: editForm.account_number.trim() || null,
        })
        .eq("id", editUser.id);
      if (error) throw error;
      toast({ title: "Данные сохранены", description: editForm.full_name || editUser.id });
      setEditUser(null);
      refetch();
    } catch (e: any) {
      toast({ title: "Ошибка сохранения", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // Подбор счетов: для каждого профиля без account_number ищем совпадение в accounts по адресу.
  const scanAccounts = async () => {
    setLinking(true);
    try {
      const candidates = users.filter((u) => !u.account_number && u.address);
      const matches: any[] = [];
      for (const u of candidates) {
        const uStreet = normStreet(u.address || "");
        const hm = (u.address || "").match(/д\.?\s*(\d+[а-яa-z]?)/i);
        const house = hm ? hm[1] : "";
        const uApt = normApt((u.apartment || "").toString() || extractApt(u.address || ""));
        if (!uStreet || !house || !uApt) continue;
        const rawStreet = ((u.address || "").split(",")[1] || "").replace(/(?:\bул\.?\b|улица|\(ул\))/gi, "").trim();
        if (!rawStreet) continue;
        const { data: accs } = await supabase
          .from("accounts")
          .select("account_number, address, apartment")
          .ilike("address", `%${rawStreet}%${house}%`)
          .limit(500);
        const acc = findAccountNumber(u, accs || []);
        if (acc) matches.push({ id: u.id, name: u.full_name || u.phone || u.id, address: u.address, apartment: u.apartment, account_number: acc });
      }
      setLinkPreview({ matches });
    } catch (e: any) {
      toast({ title: "Ошибка подбора счетов", description: e.message, variant: "destructive" });
    } finally {
      setLinking(false);
    }
  };

  // Применяем подобранные привязки: записываем account_number в профили.
  const applyLink = async () => {
    if (!linkPreview) return;
    setLinking(true);
    let ok = 0, fail = 0;
    for (const m of linkPreview.matches) {
      try {
        const { error } = await supabase.from("profiles").update({ account_number: m.account_number }).eq("id", m.id);
        if (error) throw error;
        ok++;
      } catch { fail++; }
    }
    toast({ title: "Привязка завершена", description: `Привязано счетов: ${ok}${fail ? `, ошибок: ${fail}` : ""}.` });
    setLinkPreview(null);
    setLinking(false);
    refetch();
  };

  const { data: users = [], isLoading, refetch } = useQuery({
    queryKey: ["cabinet_users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, phone, email, address, apartment, floor, account_number, is_verified, verification_status, has_intercom, created_at, deleted_at")
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
        <div className="flex gap-1.5">
          <Button variant="outline" size="sm" onClick={scanAccounts} disabled={linking} className="gap-1.5" title="Автоматически найти и привязать лицевые счета по адресу для профилей без счёта">
            {linking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />} Привязать счета
          </Button>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-1.5"><RefreshCw className="h-4 w-4" /> Обновить</Button>
        </div>
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

                  <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="sm" className="h-8 gap-1" onClick={() => openEdit(u)}>
                    <Pencil className="h-4 w-4" /> Изменить
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 gap-1">
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
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Диалог редактирования профиля пользователя */}
      <Dialog open={!!editUser} onOpenChange={(o) => { if (!o) setEditUser(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Pencil className="h-4 w-4 text-primary" /> Редактировать данные</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">ФИО</Label>
              <Input value={editForm.full_name} onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Телефон</Label>
              <Input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} placeholder="+7 (___) ___-__-__" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Адрес (улица, дом, подъезд)</Label>
              <Input value={editForm.address} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} placeholder="напр.: Казбекская (ул), д. 13, п. 2" />
              <p className="text-[11px] text-muted-foreground">Подъезд указывается здесь, в тексте адреса (например «п. 2»).</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Квартира</Label>
                <Input value={editForm.apartment} onChange={(e) => setEditForm({ ...editForm, apartment: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Этаж</Label>
                <Input value={editForm.floor} onChange={(e) => setEditForm({ ...editForm, floor: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Лицевой счёт</Label>
              <Input value={editForm.account_number} onChange={(e) => setEditForm({ ...editForm, account_number: e.target.value })} placeholder="напр.: 0000011155" className="font-mono" />
              <p className="text-[11px] text-muted-foreground">Привязка лицевого счёта уберёт статус «частный клиент» и подтянет баланс.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)} disabled={saving}>Отмена</Button>
            <Button onClick={saveEdit} disabled={saving} className="gap-1.5">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />} Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Диалог предпросмотра и подтверждения массовой привязки счетов */}
      <Dialog open={!!linkPreview} onOpenChange={(o) => { if (!o) setLinkPreview(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Link2 className="h-4 w-4 text-primary" /> Привязка лицевых счетов</DialogTitle>
          </DialogHeader>
          {linkPreview && linkPreview.matches.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">
              Автоматических совпадений по адресу не найдено. Лицевой счёт можно привязать вручную через кнопку «Изменить» у нужного пользователя.
            </p>
          ) : (
            <div className="space-y-2">
              <p className="text-sm">
                Найдено совпадений по адресу: <b>{linkPreview?.matches.length}</b>. Проверьте список — счёт будет записан в профиль, и баланс подтянется и в кабинете, и в заявках.
              </p>
              <div className="max-h-[320px] overflow-y-auto divide-y border rounded-md">
                {linkPreview?.matches.map((m) => (
                  <div key={m.id} className="p-2 text-xs flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{m.name}</div>
                      <div className="text-muted-foreground truncate">{m.address}{m.apartment ? `, кв. ${m.apartment}` : ""}</div>
                    </div>
                    <Badge variant="outline" className="font-mono gap-1 shrink-0"><Hash className="h-3 w-3" />{m.account_number}</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkPreview(null)} disabled={linking}>Закрыть</Button>
            {linkPreview && linkPreview.matches.length > 0 && (
              <Button onClick={applyLink} disabled={linking} className="gap-1.5">
                {linking && <Loader2 className="h-4 w-4 animate-spin" />} Привязать {linkPreview.matches.length}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UsersManager;
