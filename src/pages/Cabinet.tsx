import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, LogOut, CheckCircle, AlertCircle, ClipboardList, Calendar, Shield, CreditCard, Wallet, Pencil, Trash2, UserCheck, Plus, Clock, Wrench, CheckCircle2, XCircle, Send } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  scheduled_date: string | null;
  notes: string | null;
  clients: { name: string; address: string } | null;
}

const DebtCard = ({ address, apartment, fullName, phone }: { address: string; apartment: string; fullName: string; phone: string }) => {
  const [account, setAccount] = useState<{ account_number: string; period: string; debt_amount: number; address: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestText, setRequestText] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const loadDebt = async () => {
      setLoading(true);
      // Build a flexible query: street keywords first
      const streetWords = (address || "")
        .replace(/[,.\-]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 2 && !/^\d+$/.test(w));

      let query = supabase
        .from("accounts")
        .select("account_number, period, debt_amount, address, apartment");
      for (const word of streetWords) {
        query = query.ilike("address", `%${word}%`);
      }
      const { data } = await query.order("period", { ascending: false }).limit(20);

      // Try to filter by apartment in JS — apartment may be "1", "Офис 1" etc.
      let best = data && data.length > 0 ? data[0] : null;
      if (data && data.length > 0 && apartment) {
        const aptDigits = (apartment.match(/\d+/) || [])[0];
        if (aptDigits) {
          const filtered = data.filter((a: any) => {
            if (a.apartment && String(a.apartment) === aptDigits) return true;
            const addr = (a.address || "").toLowerCase();
            return new RegExp(`кв\\.?\\s*${aptDigits}\\b`, "i").test(addr);
          });
          if (filtered.length > 0) best = filtered[0];
          else best = null; // Address matches but apartment doesn't — treat as not found
        }
      }
      setAccount(best);
      setLoading(false);
    };
    loadDebt();
  }, [address, apartment]);

  const formatPeriod = (period: string) => {
    if (period.length === 4) {
      const month = period.substring(0, 2);
      const year = "20" + period.substring(2);
      const months = ["", "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
      return `${months[parseInt(month)] || month} ${year}`;
    }
    return period;
  };

  const handleCreateRequest = async () => {
    if (!requestText.trim()) {
      toast({ title: "Опишите задачу", variant: "destructive" });
      return;
    }
    setCreating(true);
    try {
      const fullAddress = `${address}${apartment ? `, ${apartment}` : ""}`;
      const { error } = await supabase.from("requests").insert({
        name: fullName || "Клиент",
        phone: phone || "не указан",
        address: fullAddress,
        message: `${requestText}\n\n— Частный клиент (адрес не на обслуживании)`,
        priority: "medium",
        status: "pending",
      });
      if (error) throw error;
      try {
        await supabase.functions.invoke("notify", {
          body: {
            event: "request_created",
            data: { name: fullName, phone, address: fullAddress, message: requestText },
          },
        });
      } catch (e) { console.error(e); }
      toast({ title: "Заявка отправлена", description: "Мы свяжемся с вами в ближайшее время" });
      setRequestText("");
      setRequestOpen(false);
    } catch (e: any) {
      toast({ title: "Ошибка", description: e.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  if (loading) return null;

  // Found in accounts — show debt info
  if (account) {
    const debt = Number(account.debt_amount) || 0;
    const isOverpayment = debt < 0;
    const isDebt = debt > 0;
    const absAmount = Math.abs(debt);

    return (
      <Card className={isDebt ? "border-destructive/30" : "border-green-500/30"}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Состояние лицевого счёта
          </CardTitle>
          <CardDescription>
            Лицевой счёт: <span className="font-mono font-medium">{account.account_number}</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
            <span className="text-sm text-muted-foreground">Период начисления</span>
            <span className="text-sm font-medium">{formatPeriod(account.period)}</span>
          </div>

          <div className={`flex items-center justify-between p-4 rounded-lg border ${
            isDebt
              ? "bg-destructive/10 border-destructive/20"
              : "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800"
          }`}>
            <span className="font-medium">
              {isDebt ? "Задолженность" : isOverpayment ? "Переплата" : "Баланс"}
            </span>
            <span className={`text-xl font-bold ${
              isDebt ? "text-destructive" : "text-green-600"
            }`}>
              {isDebt ? "−" : isOverpayment ? "+" : ""}{absAmount.toFixed(2)} ₽
            </span>
          </div>

          <Button className="w-full" size="lg" onClick={() => navigate("/payment")}>
            <CreditCard className="mr-2 h-4 w-4" />
            Оплатить
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Not found — private client
  return (
    <Card className="border-primary/30">
      <CardHeader>
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <UserCheck className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle>Частный клиент</CardTitle>
            <CardDescription className="mt-1">
              Ваш адрес не находится на обслуживании по абонентской системе.
              Вы можете оставить разовую заявку — мы свяжемся с вами.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Dialog open={requestOpen} onOpenChange={setRequestOpen}>
          <DialogTrigger asChild>
            <Button className="w-full" size="lg">
              <Plus className="mr-2 h-4 w-4" />
              Оставить заявку
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Новая заявка</DialogTitle>
              <DialogDescription>
                Опишите, что вам нужно: установка, ремонт, обслуживание и т. д.
                Контакты возьмём из вашего профиля.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="text-sm text-muted-foreground space-y-1">
                <div>👤 {fullName}</div>
                <div>📞 {phone}</div>
                <div>📍 {address}{apartment ? `, ${apartment}` : ""}</div>
              </div>
              <Textarea
                placeholder="Опишите задачу..."
                value={requestText}
                onChange={(e) => setRequestText(e.target.value)}
                rows={5}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRequestOpen(false)}>Отмена</Button>
              <Button onClick={handleCreateRequest} disabled={creating}>
                {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                <Send className="h-4 w-4 mr-2" />
                Отправить
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

interface ClientRequest {
  id: string;
  message: string;
  status: string;
  priority: string;
  created_at: string;
  accepted_at: string | null;
  completed_at: string | null;
  notes: string | null;
}

const statusMeta: Record<string, { label: string; icon: any; cls: string }> = {
  pending: { label: "Ожидает", icon: Clock, cls: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300" },
  accepted: { label: "Принята", icon: CheckCircle, cls: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" },
  in_progress: { label: "В работе", icon: Wrench, cls: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300" },
  completed: { label: "Выполнена", icon: CheckCircle2, cls: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" },
  cancelled: { label: "Отменена", icon: XCircle, cls: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
};

const MyRequestsCard = ({ phone }: { phone: string }) => {
  const [requests, setRequests] = useState<ClientRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!phone) { setLoading(false); return; }
    const load = async () => {
      const { data } = await supabase
        .from("requests")
        .select("id, message, status, priority, created_at, accepted_at, completed_at, notes")
        .eq("phone", phone)
        .order("created_at", { ascending: false })
        .limit(20);
      setRequests((data as ClientRequest[]) || []);
      setLoading(false);
    };
    load();

    const channel = supabase
      .channel("my-requests")
      .on("postgres_changes",
        { event: "*", schema: "public", table: "requests", filter: `phone=eq.${phone}` },
        () => load()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [phone]);

  if (loading) return null;
  if (requests.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5" />
          История заявок
        </CardTitle>
        <CardDescription>
          Здесь отображается статус всех ваших заявок в реальном времени
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {requests.map((req) => {
          const meta = statusMeta[req.status] || statusMeta.pending;
          const Icon = meta.icon;
          // Strip enrichment metadata appended by the bot
          const cleanMessage = (req.message || "").split(/\n+(ФИО:|—|⚠️)/)[0].trim();
          return (
            <div key={req.id} className="p-3 rounded-lg border bg-card space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <Badge className={meta.cls} variant="secondary">
                  <Icon className="h-3 w-3 mr-1" />
                  {meta.label}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {format(new Date(req.created_at), "dd MMM yyyy, HH:mm", { locale: ru })}
                </span>
              </div>
              <p className="text-sm">{cleanMessage}</p>
              {req.notes && (
                <p className="text-xs text-muted-foreground border-l-2 border-primary/40 pl-2">
                  Комментарий мастера: {req.notes}
                </p>
              )}
              {req.accepted_at && (
                <p className="text-xs text-muted-foreground">
                  Принята: {format(new Date(req.accepted_at), "dd MMM, HH:mm", { locale: ru })}
                </p>
              )}
              {req.completed_at && (
                <p className="text-xs text-green-600">
                  Выполнена: {format(new Date(req.completed_at), "dd MMM, HH:mm", { locale: ru })}
                </p>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

const Cabinet = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [apartment, setApartment] = useState("");
  const [isVisible, setIsVisible] = useState({
    header: false,
    content: false
  });
  const [editing, setEditing] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const hasAdminConsoleAccess = userRoles.some((role) => ["admin", "director"].includes(role));
  const isLocked = !!profile?.is_verified && !editing;

  useEffect(() => {
    if (!loading) {
      // Анимация заголовка (0.5 сек)
      setTimeout(() => setIsVisible(prev => ({ ...prev, header: true })), 500);

      // Анимация содержимого (1.0 сек)
      setTimeout(() => setIsVisible(prev => ({ ...prev, content: true })), 1000);
    }
  }, [loading]);

  useEffect(() => {
    checkUser();
  }, []);

  // Realtime subscription for profile updates
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel("cabinet-profile")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${userId}` },
        (payload) => {
          const updated = payload.new as any;
          setProfile(updated);
          setFullName(updated.full_name || "");
          setPhone(updated.phone || "");
          setAddress(updated.address || "");
          setApartment(updated.apartment || "");
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  const checkUser = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        navigate("/auth");
        return;
      }

      setUserId(session.user.id);

      // Получаем роли пользователя
      const { data: rolesData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id);

      if (rolesData) {
        setUserRoles(rolesData.map(r => r.role));
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single();

      if (error) throw error;

      setProfile(data);
      setFullName(data.full_name || "");
      setPhone(data.phone || "");
      setAddress(data.address || "");
      setApartment(data.apartment || "");
    } catch (error: any) {
      console.error("Error loading profile:", error);
    } finally {
      setLoading(false);
    }
  };

  // Получаем задачи пользователя (если он сотрудник)
  const { data: myTasks } = useQuery({
    queryKey: ["my-tasks", userId],
    queryFn: async () => {
      if (!userId) return [];
      
      // Сначала проверяем, есть ли запись сотрудника
      const { data: employee } = await supabase
        .from("employees")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();
      
      if (!employee) return [];

      const { data, error } = await supabase
        .from("tasks")
        .select(`
          id, title, status, priority, scheduled_date, notes,
          clients (name, address)
        `)
        .or(`assigned_to.eq.${employee.id},accepted_by.eq.${employee.id}`)
        .neq("status", "completed")
        .neq("status", "cancelled");

      if (error) throw error;
      
      // Сортировка по приоритету
      const priorityOrder: Record<string, number> = {
        urgent: 1,
        high: 2,
        medium: 3,
        low: 4,
      };
      
      return (data as Task[]).sort((a, b) => 
        (priorityOrder[a.priority] || 5) - (priorityOrder[b.priority] || 5)
      );
    },
    enabled: !!userId,
  });

  const handleSaveAndVerify = async () => {
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: fullName,
          phone,
          address,
          apartment,
          is_verified: false,
        })
        .eq("id", session.user.id);

      if (error) throw error;

      setProfile((prev: any) => prev ? { ...prev, full_name: fullName, phone, address, apartment, is_verified: false } : prev);

      try {
        await supabase.functions.invoke("notify", {
          body: {
            event: "verification_request",
            data: {
              full_name: fullName,
              user_id: session.user.id,
            },
          },
        });
      } catch (pushError) {
        console.error("Verification push error:", pushError);
      }

      toast({
        title: "Данные отправлены",
        description: "Ваши данные сохранены и отправлены на верификацию",
      });
      setEditing(false);
    } catch (error: any) {
      toast({
        title: "Ошибка сохранения",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const handleClearData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: "", phone: "", address: "", apartment: "", is_verified: false })
        .eq("id", session.user.id);
      if (error) throw error;
      setProfile((prev: any) => prev ? { ...prev, full_name: "", phone: "", address: "", apartment: "", is_verified: false } : prev);
      setFullName(""); setPhone(""); setAddress(""); setApartment("");
      setEditing(false);
      toast({ title: "Данные удалены", description: "Заполните форму заново для верификации" });
    } catch (e: any) {
      toast({ title: "Ошибка", description: e.message, variant: "destructive" });
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: "bg-yellow-100 text-yellow-800",
      assigned: "bg-blue-100 text-blue-800",
      in_progress: "bg-orange-100 text-orange-800",
    };
    const labels: Record<string, string> = {
      pending: "Ожидает",
      assigned: "Назначена",
      in_progress: "В работе",
    };
    return <Badge className={styles[status]} variant="secondary">{labels[status]}</Badge>;
  };

  const getPriorityBadge = (priority: string) => {
    const styles: Record<string, string> = {
      low: "bg-gray-100 text-gray-700",
      medium: "bg-blue-100 text-blue-700",
      high: "bg-orange-100 text-orange-700",
      urgent: "bg-red-100 text-red-700",
    };
    const labels: Record<string, string> = {
      low: "Низкий",
      medium: "Средний",
      high: "Высокий",
      urgent: "Срочно",
    };
    return <Badge className={styles[priority]} variant="secondary">{labels[priority]}</Badge>;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 bg-muted/30 py-8">
        <div className="container max-w-4xl">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
            <h1
              className={`text-2xl sm:text-3xl font-bold ${
                isVisible.header ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-10'
              } transition-all duration-700 ease-out`}
            >
              Личный кабинет
            </h1>
            <div
              className={`flex flex-wrap gap-2 ${
                isVisible.header ? 'opacity-100' : 'opacity-0'
              } transition-opacity duration-700 delay-300`}
            >
              {hasAdminConsoleAccess && (
                <Button variant="outline" size="sm" onClick={() => navigate("/admin")}>
                  <Shield className="h-4 w-4 mr-1" />
                  Панель
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-1" />
                Выйти
              </Button>
            </div>
          </div>

          <div className="grid gap-6">
            {/* Мои заявки - показываем если есть задачи */}
            {myTasks && myTasks.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ClipboardList className="h-5 w-5" />
                    Мои заявки
                  </CardTitle>
                  <CardDescription>
                    Активные заявки отсортированы по приоритету
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {myTasks.map((task) => (
                    <div 
                      key={task.id} 
                      className="p-4 rounded-lg border border-border/50 bg-card"
                    >
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className="font-medium">{task.title}</span>
                        {getStatusBadge(task.status)}
                        {getPriorityBadge(task.priority)}
                      </div>
                      {task.clients && (
                        <p className="text-sm text-muted-foreground">
                          📍 {task.clients.name} — {task.clients.address}
                        </p>
                      )}
                      {task.scheduled_date && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(task.scheduled_date), "dd MMMM yyyy", { locale: ru })}
                        </p>
                      )}
                      {task.notes && (
                        <p className="text-xs text-muted-foreground mt-2">
                          {task.notes}
                        </p>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Статус верификации</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    {profile?.is_verified ? (
                      <>
                        <CheckCircle className="h-5 w-5 text-green-600" />
                        <span className="text-green-600 font-medium">Верифицирован</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="h-5 w-5 text-orange-600" />
                        <span className="text-orange-600 font-medium">Ожидает верификации</span>
                      </>
                    )}
                  </div>
                  {!profile?.is_verified && (
                    <p className="text-sm text-muted-foreground">
                      Заполните данные ниже и нажмите «Сохранить и отправить на верификацию».
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Состояние счёта - показываем только верифицированным */}
            {profile?.is_verified && address && (
              <>
                <DebtCard address={address} apartment={apartment} fullName={fullName} phone={phone} />
                <MyRequestsCard phone={phone} />
              </>
            )}

            <Card>
              <CardHeader>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <CardTitle>Личная информация</CardTitle>
                    <CardDescription>
                      {isLocked
                        ? "Чтобы изменить адрес или другие данные — нажмите «Изменить»"
                        : "Заполните данные для верификации вашего аккаунта"}
                    </CardDescription>
                  </div>
                  {profile?.is_verified && !editing && (
                    <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                      <Pencil className="h-4 w-4 mr-1" />
                      Изменить
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Полное имя</Label>
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Иван Иванович Иванов"
                    disabled={isLocked}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Телефон</Label>
                  <Input
                    id="phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+7 (999) 123-45-67"
                    disabled={isLocked}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Адрес</Label>
                  <Input
                    id="address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="г. Москва, ул. Примерная, д. 1"
                    disabled={isLocked}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="apartment">Квартира</Label>
                  <Input
                    id="apartment"
                    value={apartment}
                    onChange={(e) => setApartment(e.target.value)}
                    placeholder="123"
                    disabled={isLocked}
                  />
                </div>

                {!isLocked && (
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button onClick={handleSaveAndVerify} disabled={saving} className="flex-1">
                      {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {profile?.is_verified ? "Сохранить и переотправить" : "Сохранить и отправить на верификацию"}
                    </Button>
                    {editing && (
                      <Button variant="outline" onClick={() => {
                        setEditing(false);
                        setFullName(profile?.full_name || "");
                        setPhone(profile?.phone || "");
                        setAddress(profile?.address || "");
                        setApartment(profile?.apartment || "");
                      }}>
                        Отмена
                      </Button>
                    )}
                  </div>
                )}

                {(profile?.is_verified || profile?.full_name) && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm" className="w-full text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4 mr-1" />
                        Удалить данные верификации
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Удалить данные?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Все данные профиля (ФИО, адрес, телефон, квартира) будут удалены, верификация снята.
                          Вы сможете заполнить форму заново.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Отмена</AlertDialogCancel>
                        <AlertDialogAction onClick={handleClearData} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                          Удалить
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Доступ к системе</CardTitle>
                <CardDescription>
                  Информация о подключенных услугах
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  После верификации здесь будет доступна информация о ваших подключенных услугах,
                  видеоархив с домофона и другие функции.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Cabinet;
