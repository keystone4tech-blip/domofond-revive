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
import { Loader2, LogOut, CheckCircle, AlertCircle, ClipboardList, Calendar, Shield, CreditCard, Wallet, Pencil, Trash2, UserCheck, Plus, Minus, Clock, Wrench, CheckCircle2, XCircle, Send, Smartphone, KeyRound, PhoneCall, DoorOpen } from "lucide-react";
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

const DebtCard = ({ address, apartment, fullName, phone, embedded = false }: { address: string; apartment: string; fullName: string; phone: string; embedded?: boolean }) => {
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
      console.log(`[Баланс] Поиск лицевого счета для дома: "${address}", квартира: "${apartment}"`); // Логирование
      
      // Ищем лицевые счета по началу адреса дома
      let query = supabase
        .from("accounts")
        .select("account_number, period, debt_amount, address, apartment")
        .ilike("address", `${address}%`); // Ищем точное соответствие дома
        
      const { data } = await query.order("period", { ascending: false }).limit(200);

      // Фильтруем результаты, находя точное совпадение по номеру квартиры
      let best = null;
      if (data && data.length > 0 && apartment) {
        const aptDigits = (apartment.match(/\d+/) || [])[0];
        if (aptDigits) {
          const filtered = data.filter((a: any) => {
            if (a.apartment && String(a.apartment) === aptDigits) return true;
            const addr = (a.address || "").toLowerCase();
            return new RegExp(`кв\\.?\\s*${aptDigits}\\b`, "i").test(addr);
          });
          if (filtered.length > 0) {
            best = filtered[0];
            console.log(`[Баланс] Лицевой счет найден: ${best.account_number}, сумма: ${best.debt_amount} ₽`); // Логирование
          } else {
            console.log(`[Баланс] Адрес совпал, но квартира ${apartment} не найдена в базе`); // Логирование
          }
        }
      } else if (data && data.length > 0) {
        best = data[0];
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

    const inner = (
      <>
        <div className="flex items-center gap-2 mb-1">
          <Wallet className="h-5 w-5 text-primary" />
          <span className="font-semibold">Состояние лицевого счёта</span>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Лицевой счёт: <span className="font-mono font-medium text-foreground">{account.account_number}</span>
        </p>
        <div className="space-y-3">
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
        </div>
      </>
    );

    if (embedded) {
      return (
        <div className={`p-4 rounded-lg border ${isDebt ? "border-destructive/30" : "border-green-500/30"} bg-card`}>
          {inner}
        </div>
      );
    }

    return (
      <Card className={isDebt ? "border-destructive/30" : "border-green-500/30"}>
        <CardContent className="pt-6">{inner}</CardContent>
      </Card>
    );
  }

  // Not found — private client
  const privateInner = (
    <>
      <div className="flex items-start gap-3 mb-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <UserCheck className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="font-semibold">Частный клиент</p>
          <p className="text-sm text-muted-foreground mt-1">
            Ваш адрес не находится на обслуживании по абонентской системе.
            Вы можете оставить разовую заявку — мы свяжемся с вами.
          </p>
        </div>
      </div>
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
    </>
  );

  if (embedded) {
    return (
      <div className="p-4 rounded-lg border border-primary/30 bg-card">
        {privateInner}
      </div>
    );
  }

  return (
    <Card className="border-primary/30">
      <CardContent className="pt-6">{privateInner}</CardContent>
    </Card>
  );
};

const RemoteAccessCard = ({ address, apartment }: { address: string; apartment: string }) => {
  // TODO: проверить наличие логина/пароля во внешней БД (будет добавлено позже).
  // Пока показываем предложение приобрести удалённый доступ всем верифицированным
  // пользователям, у которых есть адрес.
  const navigate = useNavigate();

  return (
    <div className="p-4 rounded-lg border border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
      <div className="flex items-start gap-3 mb-3">
        <div className="p-2 rounded-lg bg-primary/10 shrink-0">
          <Smartphone className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="font-semibold">Удалённый доступ к домофону</p>
          <p className="text-sm text-muted-foreground mt-1">
            Приобретите личный кабинет в мобильном приложении для удобного управления
            домофоном по адресу: <span className="font-medium text-foreground">{address}{apartment ? `, ${apartment}` : ""}</span>
          </p>
        </div>
      </div>

      <ul className="space-y-2 text-sm mb-4">
        <li className="flex items-center gap-2">
          <DoorOpen className="h-4 w-4 text-primary shrink-0" />
          <span>Открывайте дверь без ключей со смартфона</span>
        </li>
        <li className="flex items-center gap-2">
          <PhoneCall className="h-4 w-4 text-primary shrink-0" />
          <span>Принимайте звонки с домофона на мобильный телефон</span>
        </li>
        <li className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-primary shrink-0" />
          <span>Логин и пароль с инструкцией придут после оплаты</span>
        </li>
      </ul>

      <Button className="w-full whitespace-normal h-auto py-3 flex items-center justify-center gap-2" size="lg" onClick={() => navigate("/payment")}>
        <CreditCard className="h-5 w-5 shrink-0" />
        <span className="text-center">Оплатить и получить доступ</span>
      </Button>
    </div>
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

const normalizePhone = (p: string) => (p || "").replace(/\D/g, "").replace(/^8/, "7");

const MyRequestsCard = ({ phone, fullName }: { phone: string; fullName: string }) => {
  const [requests, setRequests] = useState<ClientRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const { toast } = useToast();

  const load = async () => {
    const normPhone = normalizePhone(phone);
    // Fetch a generous batch and filter by normalized phone or name in JS,
    // because phone formats may differ between submission sources.
    const { data } = await supabase
      .from("requests")
      .select("id, message, status, priority, created_at, accepted_at, completed_at, notes, phone, name")
      .order("created_at", { ascending: false })
      .limit(200);
    const filtered = ((data as any[]) || []).filter((r) => {
      if (normPhone && normalizePhone(r.phone || "") === normPhone) return true;
      if (fullName && r.name && r.name.trim().toLowerCase() === fullName.trim().toLowerCase()) return true;
      return false;
    });
    setRequests(filtered as ClientRequest[]);
    setLoading(false);
  };

  useEffect(() => {
    if (!phone && !fullName) { setLoading(false); return; }
    load();

    const channel = supabase
      .channel("my-requests")
      .on("postgres_changes",
        { event: "*", schema: "public", table: "requests" },
        () => load()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phone, fullName]);

  const handleCancel = async (id: string) => {
    setCancellingId(id);
    try {
      const { error } = await supabase
        .from("requests")
        .update({ status: "cancelled" })
        .eq("id", id);
      if (error) throw error;
      toast({ title: "Заявка отменена" });
      load();
    } catch (e: any) {
      toast({ title: "Не удалось отменить", description: e.message, variant: "destructive" });
    } finally {
      setCancellingId(null);
    }
  };

  if (loading) return null;

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
        {requests.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            У вас пока нет заявок
          </p>
        )}
        {requests.map((req) => {
          const meta = statusMeta[req.status] || statusMeta.pending;
          const Icon = meta.icon;
          const canCancel = req.status === "pending" || req.status === "accepted" || req.status === "in_progress";
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
              {canCancel && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:text-destructive w-full sm:w-auto"
                      disabled={cancellingId === req.id}
                    >
                      {cancellingId === req.id
                        ? <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        : <XCircle className="h-4 w-4 mr-1" />}
                      Отменить заявку
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Отменить заявку?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Заявка будет помечена как отменённая. Это действие нельзя отменить.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Назад</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleCancel(req.id)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Отменить заявку
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
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
  
  // --- СТЕЙТЫ ДЛЯ УМНОГО АВТОКОМПЛИТА АДРЕСОВ (accounts) ---
  const [allHouses, setAllHouses] = useState<string[]>([]); // Кэш всех уникальных домов
  const [allStreets, setAllStreets] = useState<string[]>([]); // Кэш уникальных улиц
  const [displayAddress, setDisplayAddress] = useState(""); // Красивый адрес для пользователя (без города)
  const [selectedStreet, setSelectedStreet] = useState<string | null>(null); // Выбранная улица
  const [streetSuggestions, setStreetSuggestions] = useState<string[]>([]); // Подсказки улиц
  const [houseSuggestions, setHouseSuggestions] = useState<string[]>([]); // Подсказки домов
  const [apartmentSuggestions, setApartmentSuggestions] = useState<string[]>([]); // Подсказки квартир
  const [showAddressSuggestions, setShowAddressSuggestions] = useState(false); // Показ подсказок адреса
  const [showApartmentSuggestions, setShowApartmentSuggestions] = useState(false); // Показ подсказок квартиры
  const [loadingAddressCache, setLoadingAddressCache] = useState(false); // Процесс загрузки кэша адресов
  const [editing, setEditing] = useState(false);
  const [isVisible, setIsVisible] = useState({
    header: false,
    content: false
  });
  const navigate = useNavigate();

  // --- СТЕЙТЫ ДЛЯ ФОРМЫ ЗАКАЗА УСЛУГ И ОБОРУДОВАНИЯ ---
  const [products, setProducts] = useState<any[]>([]); // Все товары и услуги из БД
  const [isOrderDialogOpen, setIsOrderDialogOpen] = useState(false); // Открытие диалога заказа
  const [orderType, setOrderType] = useState<"repair" | "order">("repair"); // Тип обращения: неисправность или заказ
  const [repairProblem, setRepairProblem] = useState(""); // Текст проблемы для бесплатной заявки
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null); // Выбранная услуга
  const [selectedEquipments, setSelectedEquipments] = useState<{ [id: string]: number }>({}); // Выбранное оборудование и количество
  const [keysQuantity, setKeysQuantity] = useState(0); // Количество дополнительных ключей
  const [isCabinetSetupChecked, setIsCabinetSetupChecked] = useState(false); // Выбран ли чекбокс настройки ЛК
  const [orderComment, setOrderComment] = useState(""); // Комментарий к платному заказу
  const [isSuccessPaymentOpen, setIsSuccessPaymentOpen] = useState(false); // Открытие окна с подтверждением перехода к оплате
  const [lastCreatedRequestId, setLastCreatedRequestId] = useState<string | null>(null); // ID созданной заявки для оплаты
  const [lastOrderTotals, setLastOrderTotals] = useState<any>(null); // Рассчитанные суммы платежа для передачи в шлюз

  // Загрузка активных товаров и услуг из БД
  const loadProducts = async () => {
    console.log("[Заказ] Загрузка списка товаров и услуг из products...");
    try {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("is_active", true);

      if (error) throw error;

      if (data) {
        setProducts(data);
        console.log(`[Заказ] Успешно загружено товаров и услуг: ${data.length}`);
      }
    } catch (err) {
      console.error("[Заказ] Ошибка загрузки списка продуктов:", err);
    }
  };

  // Функция для очистки полного адреса (убираем город "Краснодар, " или "пос. Южный, ") для отображения
  const getDisplayAddress = (fullAddr: string) => {
    if (!fullAddr) return "";
    const parts = fullAddr.split(",");
    if (parts.length >= 3) {
      // Возвращаем все части, кроме первой (город)
      return parts.slice(1).join(",").trim();
    }
    return fullAddr;
  };

  // Расчет схожести строк с поддержкой нечеткого поиска (биграммы)
  const scoreSimilarity = (input: string, target: string): number => {
    const cleanInput = input.toLowerCase().replace(/[^а-яa-z0-9]/g, "");
    const cleanTarget = target.toLowerCase().replace(/[^а-яa-z0-9]/g, "");
    
    if (!cleanInput) return 0;

    // Точное вхождение дает максимальный приоритет
    if (cleanTarget.includes(cleanInput)) {
      return 100 + (cleanInput.length / cleanTarget.length) * 10;
    }
    
    // Коэффициент Сёренсена-Диса для исправления опечаток
    const getBigrams = (str: string) => {
      const bigrams = new Set<string>();
      for (let i = 0; i < str.length - 1; i++) {
        bigrams.add(str.substring(i, i + 2));
      }
      return bigrams;
    };
    
    const inputBigrams = getBigrams(cleanInput);
    const targetBigrams = getBigrams(cleanTarget);
    
    let intersection = 0;
    inputBigrams.forEach((bg) => {
      if (targetBigrams.has(bg)) intersection++;
    });
    
    const total = inputBigrams.size + targetBigrams.size;
    if (total === 0) return 0;
    
    return ((2 * intersection) / total) * 100;
  };

  // Загрузка кэша уникальных домов из БД
  const loadAddressCache = async () => {
    setLoadingAddressCache(true);
    console.log("[Адрес] Загрузка кэша уникальных домов из unique_houses...");
    try {
      const { data, error } = await supabase
        .from("unique_houses")
        .select("house_address");

      if (error) throw error;

      if (data) {
        const houses = data.map((item: any) => item.house_address).filter(Boolean);
        setAllHouses(houses);
        
        // Извлекаем уникальные улицы (это 2-я часть в адресе)
        const streets = Array.from(new Set(houses.map((h: string) => {
          const parts = h.split(",");
          return parts[1] ? parts[1].trim() : "";
        }).filter(Boolean))) as string[];
        
        setAllStreets(streets);
        console.log(`[Адрес] Успешно кэшировано домов: ${houses.length}, улиц: ${streets.length}`);
      }
    } catch (err) {
      console.error("[Адрес] Ошибка загрузки кэша:", err);
    } finally {
      setLoadingAddressCache(false);
    }
  };

  // Обработка ручного ввода в строку адреса
  const handleAddressInputChange = (val: string) => {
    setDisplayAddress(val);
    setShowAddressSuggestions(true);
    
    if (val.trim().length === 0) {
      setStreetSuggestions([]);
      setHouseSuggestions([]);
      setSelectedStreet(null);
      return;
    }

    // Проверяем, вводит ли пользователь номер дома.
    // Если в строке есть запятая с пробелом или цифры, следующие за известной улицей
    const houseMatch = val.match(/(?:д\.|дом)?\s*(\d+.*)$/i);
    
    if (houseMatch && selectedStreet) {
      const enteredHouseNum = houseMatch[1].trim().toLowerCase();
      console.log(`[Автокомплит] Поиск дома "${enteredHouseNum}" на улице "${selectedStreet}"`);
      
      // Находим все номера домов для выбранной улицы
      const matchingHouses = allHouses
        .filter((h) => {
          const parts = h.split(",");
          const streetPart = parts[1] ? parts[1].trim() : "";
          return streetPart === selectedStreet;
        })
        .map((h) => {
          const parts = h.split(",");
          return parts[2] ? parts[2].trim() : ""; // Номер дома (например, "д. 50")
        })
        .filter(Boolean);

      // Фильтруем по введенному значению номера дома
      const filtered = matchingHouses.filter((houseNum) => 
        houseNum.toLowerCase().includes(enteredHouseNum)
      );
      
      setHouseSuggestions(filtered);
      setStreetSuggestions([]);
    } else {
      // Пользователь пишет название улицы, ищем с поддержкой опечаток (Dice Similarity)
      const scored = allStreets
        .map((street) => ({
          street,
          score: scoreSimilarity(val, street)
        }))
        .filter((item) => item.score > 15) // Порог совпадения
        .sort((a, b) => b.score - a.score)
        .slice(0, 5) // Выводим топ-5 подсказок
        .map((item) => item.street);

      setStreetSuggestions(scored);
      setHouseSuggestions([]);
      
      // Если ввод совпал с какой-то улицей, фиксируем её
      const exactMatch = allStreets.find(s => s.toLowerCase() === val.trim().toLowerCase());
      if (exactMatch) {
        setSelectedStreet(exactMatch);
      }
    }
  };

  // Выбор улицы из списка подсказок
  const handleSelectStreet = (street: string) => {
    console.log(`[Автокомплит] Выбрана улица: "${street}"`);
    setSelectedStreet(street);
    setDisplayAddress(`${street}, д. `);
    
    // Сразу выводим все доступные номера домов для этой улицы
    const matchingHouses = allHouses
      .filter((h) => {
        const parts = h.split(",");
        const streetPart = parts[1] ? parts[1].trim() : "";
        return streetPart === street;
      })
      .map((h) => {
        const parts = h.split(",");
        return parts[2] ? parts[2].trim() : "";
      })
      .filter(Boolean);
      
    setHouseSuggestions(matchingHouses);
    setStreetSuggestions([]);
  };

  // Выбор номера дома из списка подсказок
  const handleSelectHouse = (houseNumber: string) => {
    if (!selectedStreet) return;
    console.log(`[Автокомплит] Выбран дом: "${houseNumber}" на улице "${selectedStreet}"`);
    
    // Находим полный эталонный адрес в кэше
    const fullAddr = allHouses.find((h) => {
      const parts = h.split(",");
      const streetPart = parts[1] ? parts[1].trim() : "";
      const housePart = parts[2] ? parts[2].trim() : "";
      return streetPart === selectedStreet && housePart === houseNumber;
    });

    if (fullAddr) {
      setAddress(fullAddr); // Сохраняем полный эталонный адрес (с городом) для БД
      setDisplayAddress(`${selectedStreet}, ${houseNumber}`);
      setHouseSuggestions([]);
      setShowAddressSuggestions(false);
      
      // Загружаем квартиры для выбранного дома
      fetchApartmentSuggestions(fullAddr);
      
      // Автоматически выводим интерактивную сетку квартир!
      setShowApartmentSuggestions(true);
    }
  };

  // Функция для загрузки доступных квартир по выбранному адресу дома
  const fetchApartmentSuggestions = async (selectedAddr: string) => {
    if (!selectedAddr) return;
    console.log(`[Квартира] Загрузка списка квартир для дома: "${selectedAddr}"`); // Логирование
    try {
      const { data, error } = await supabase
        .from("accounts")
        .select("apartment")
        .ilike("address", `${selectedAddr}%`); // Ищем точное совпадение по префиксу адреса
        
      if (error) throw error;

      if (data) {
        // Извлекаем уникальные номера квартир и сортируем их по возрастанию
        const apts = data
          .map((item: any) => String(item.apartment || "").trim())
          .filter(Boolean);
        const uniqueApts = Array.from(new Set(apts)).sort((a, b) => {
          const numA = parseInt(a.replace(/\D/g, "")) || 0;
          const numB = parseInt(b.replace(/\D/g, "")) || 0;
          return numA - numB;
        });
        setApartmentSuggestions(uniqueApts);
        console.log(`[Квартира] Загружено уникальных квартир: ${uniqueApts.length}`); // Логирование
      }
    } catch (err) {
      console.error("[Квартира] Ошибка загрузки квартир:", err);
    }
  };

  // --- ЛОГИКА РАСЧЕТА СТОИМОСТИ ЗАКАЗА ДЛЯ ШЛЮЗА БАНКА ---
  const calculateTotals = () => {
    let sum1 = 0; // Ключи (SUMMA_OPL1)
    let sum2 = 0; // Установка и трубки (SUMMA_OPL2)
    let sum3 = 0; // Личный кабинет (SUMMA_OPL3)

    // Находим ключ
    const keyProduct = products.find(p => p.name.toLowerCase().includes("ключ"));
    if (keyProduct && keysQuantity > 0) {
      sum1 = Number(keyProduct.price) * keysQuantity;
    }

    // Выбранная услуга (установка или замена трубки)
    const selectedService = products.find(p => p.id === selectedServiceId);
    if (selectedService) {
      sum2 += Number(selectedService.price);
    }

    // Выбранные трубки (оборудование)
    Object.entries(selectedEquipments).forEach(([id, qty]) => {
      const prod = products.find(p => p.id === id);
      if (prod && qty > 0) {
        sum2 += Number(prod.price) * qty;
      }
    });

    // Настройка личного кабинета (300 руб)
    if (isCabinetSetupChecked) {
      const cabinetProduct = products.find(p => p.name.toLowerCase().includes("кабинет"));
      if (cabinetProduct) {
        sum3 = Number(cabinetProduct.price);
      } else {
        sum3 = 300; // Резервное значение, если товара нет в БД
      }
    }

    const total = sum1 + sum2 + sum3;

    return { sum1, sum2, sum3, total };
  };

  // --- ОТПРАВКА ЗАЯВКИ ИЛИ ЗАКАЗА В БД ---
  const handleCreateOrderRequest = async () => {
    if (orderType === "repair" && !repairProblem.trim()) {
      toast({ title: "Опишите проблему", variant: "destructive" });
      return;
    }

    const totals = calculateTotals();
    
    if (orderType === "order" && totals.total === 0) {
      toast({ title: "Выберите хотя бы одну платную услугу или оборудование", variant: "destructive" });
      return;
    }

    setSaving(true);
    console.log(`[Заказ] Создание обращения типа: "${orderType}"`);

    try {
      // 1. Формируем структурированное текстовое сообщение для FSM и Telegram-бота
      let messageText = "";
      if (orderType === "repair") {
        messageText = `🔧 НЕИСПРАВНОСТЬ (БЕСПЛАТНО)\n— Описание проблемы: ${repairProblem.trim()}`;
      } else {
        messageText = `🛍️ ЗАКАЗ УСЛУГ И ОБОРУДОВАНИЯ\n`;
        
        const selectedService = products.find(p => p.id === selectedServiceId);
        if (selectedService) {
          messageText += `— Услуга: ${selectedService.name} (${Number(selectedService.price).toFixed(2)} ₽)\n`;
        }
        
        let hasEquip = false;
        Object.entries(selectedEquipments).forEach(([id, qty]) => {
          const prod = products.find(p => p.id === id);
          if (prod && qty > 0) {
            messageText += `— Оборудование: ${prod.name} (${qty} шт. x ${Number(prod.price).toFixed(2)} ₽)\n`;
            hasEquip = true;
          }
        });
        
        const keyProduct = products.find(p => p.name.toLowerCase().includes("ключ"));
        if (keyProduct && keysQuantity > 0) {
          messageText += `— Ключи: ${keyProduct.name} (${keysQuantity} шт. x ${Number(keyProduct.price).toFixed(2)} ₽ = ${totals.sum1.toFixed(2)} ₽)\n`;
        }
        
        if (isCabinetSetupChecked) {
          messageText += `— Сервис: Настройка личного кабинета (300.00 ₽)\n`;
        }
        
        messageText += `💵 Итоговая сумма заказа: ${totals.total.toFixed(2)} ₽\n`;
        if (orderComment.trim()) {
          messageText += `\n💬 Комментарий клиента: ${orderComment.trim()}`;
        }
      }

      const fullAddress = `${address}${apartment ? `, кв. ${apartment}` : ""}`;

      // 2. Вставляем запись в таблицу requests
      const { data: requestData, error: requestError } = await supabase
        .from("requests")
        .insert({
          name: fullName || profile?.full_name || "Абонент ЛК",
          phone: phone || profile?.phone || "не указан",
          address: fullAddress,
          message: messageText,
          status: "pending",
          priority: orderType === "repair" ? "medium" : "low",
        })
        .select("id")
        .single();

      if (requestError) throw requestError;

      console.log(`[Заказ] Успешно создано обращение с ID: ${requestData.id}`);

      // 3. Если это платный заказ, вставляем позиции в request_items для детального учета товаров
      if (orderType === "order" && requestData?.id) {
        const itemsToInsert: any[] = [];
        
        // Вставка выбранной услуги
        if (selectedServiceId) {
          const prod = products.find(p => p.id === selectedServiceId);
          if (prod) {
            itemsToInsert.push({
              request_id: requestData.id,
              product_id: selectedServiceId,
              quantity: 1,
              price: Number(prod.price),
            });
          }
        }
        
        // Вставка выбранного оборудования (трубок)
        Object.entries(selectedEquipments).forEach(([id, qty]) => {
          const prod = products.find(p => p.id === id);
          if (prod && qty > 0) {
            itemsToInsert.push({
              request_id: requestData.id,
              product_id: id,
              quantity: qty,
              price: Number(prod.price),
            });
          }
        });
        
        // Вставка выбранных ключей
        if (keysQuantity > 0) {
          const keyProduct = products.find(p => p.name.toLowerCase().includes("ключ"));
          if (keyProduct) {
            itemsToInsert.push({
              request_id: requestData.id,
              product_id: keyProduct.id,
              quantity: keysQuantity,
              price: Number(keyProduct.price),
            });
          }
        }
        
        // Вставка настройки личного кабинета
        if (isCabinetSetupChecked) {
          const cabinetProduct = products.find(p => p.name.toLowerCase().includes("кабинет"));
          if (cabinetProduct) {
            itemsToInsert.push({
              request_id: requestData.id,
              product_id: cabinetProduct.id,
              quantity: 1,
              price: Number(cabinetProduct.price),
            });
          }
        }
        
        if (itemsToInsert.length > 0) {
          console.log(`[Заказ] Запись позиций заказа (всего: ${itemsToInsert.length} шт.) в request_items...`);
          const { error: itemsError } = await supabase
            .from("request_items")
            .insert(itemsToInsert);
          
          if (itemsError) throw itemsError;
        }
      }

      // 4. Отправляем уведомление в Telegram-бота
      try {
        await supabase.functions.invoke("notify", {
          body: {
            event: "request_created",
            data: { name: fullName, phone, address: fullAddress, message: messageText },
          },
        });
      } catch (e) {
        console.error("[Заказ] Ошибка отправки уведомления в Telegram:", e);
      }

      // 5. Обрабатываем успешное завершение
      if (orderType === "repair") {
        toast({
          title: "Заявка отправлена",
          description: "Наши мастера свяжутся с вами в ближайшее время.",
        });
        setIsOrderDialogOpen(false);
        setRepairProblem("");
      } else {
        // Для платного заказа закрываем форму оформления и открываем окно оплаты банка
        setIsOrderDialogOpen(false);
        setLastCreatedRequestId(requestData.id);
        setLastOrderTotals(totals);
        setIsSuccessPaymentOpen(true);
        
        // Сбрасываем выбранные стейты заказа
        setSelectedServiceId(null);
        setSelectedEquipments({});
        setKeysQuantity(0);
        setIsCabinetSetupChecked(false);
        setOrderComment("");
      }
    } catch (err: any) {
      console.error("[Заказ] Ошибка создания заказа:", err);
      toast({
        title: "Не удалось создать заявку",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

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
    loadAddressCache();
    loadProducts(); // Подгружаем товары и услуги при входе в ЛК
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
          setDisplayAddress(getDisplayAddress(updated.address || ""));
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
      setDisplayAddress(getDisplayAddress(data.address || ""));
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
      setFullName(""); setPhone(""); setAddress(""); setDisplayAddress(""); setSelectedStreet(null); setApartment("");
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
        <div className="container max-w-4xl mx-auto px-4">
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

            {/* Доступ к системе - в верху страницы */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Доступ к системе
                </CardTitle>
                <CardDescription>
                  {profile?.is_verified
                    ? "Информация о ваших услугах и удалённом доступе"
                    : "После верификации здесь появится информация о ваших подключенных услугах, видеоархив с домофона и другие функции."}
                </CardDescription>
              </CardHeader>
              {profile?.is_verified && address && (
                <CardContent className="space-y-4">
                  <DebtCard address={address} apartment={apartment} fullName={fullName} phone={phone} embedded />
                  <RemoteAccessCard address={address} apartment={apartment} />
                  
                  {/* Кнопка создания заявки / заказа платных услуг */}
                  <div className="p-4 rounded-lg border border-primary/20 bg-muted/20 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="text-left w-full">
                      <p className="font-semibold text-sm flex items-center gap-1.5"><Wrench className="h-4 w-4 text-primary shrink-0" /> Заявки и заказ услуг</p>
                      <p className="text-xs text-muted-foreground mt-1">Нужен ремонт трубки, новые ключи или установка оборудования? Оформить заявку прямо сейчас.</p>
                    </div>
                    <Button onClick={() => { setOrderType("repair"); setIsOrderDialogOpen(true); }} className="w-full sm:w-auto shrink-0 flex items-center gap-1.5 hover:scale-105 transition-transform">
                      <Plus className="h-4 w-4" />
                      Создать заявку
                    </Button>
                  </div>
                </CardContent>
              )}
            </Card>

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

                <div className="space-y-2 relative">
                  <Label htmlFor="address" className="text-sm font-semibold">Улица и дом</Label>
                  <div className="relative">
                    <Input
                      id="address"
                      value={displayAddress}
                      onChange={(e) => handleAddressInputChange(e.target.value)}
                      onFocus={() => setShowAddressSuggestions(true)}
                      onBlur={() => setTimeout(() => setShowAddressSuggestions(false), 250)}
                      placeholder="Напишите вашу улицу и дом (например: Душистая 50)"
                      disabled={isLocked}
                      className="pr-10 bg-background/50 border-border/80 focus:border-primary/50 transition-all font-medium"
                    />
                    {loadingAddressCache && (
                      <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                  </div>
                  
                  {/* Всплывающие подсказки для улиц и домов */}
                  {showAddressSuggestions && (streetSuggestions.length > 0 || houseSuggestions.length > 0) && (
                    <div className="absolute z-50 w-full mt-1 bg-background/95 backdrop-blur-md border rounded-lg shadow-xl max-h-60 overflow-y-auto divide-y animate-in fade-in-50 slide-in-from-top-1 duration-200">
                      
                      {/* Подсказки улиц */}
                      {streetSuggestions.map((street, index) => (
                        <button
                          key={`street-${index}`}
                          type="button"
                          className="w-full text-left px-4 py-3.5 text-sm hover:bg-primary/10 transition-colors focus:bg-primary/10 focus:outline-none flex items-center gap-2.5 font-semibold text-foreground"
                          onClick={() => handleSelectStreet(street)}
                        >
                          <span className="text-primary text-base">🛣️</span> {street}
                        </button>
                      ))}

                      {/* Подсказки домов */}
                      {houseSuggestions.map((house, index) => (
                        <button
                          key={`house-${index}`}
                          type="button"
                          className="w-full text-left px-4 py-3.5 text-sm hover:bg-primary/10 transition-colors focus:bg-primary/10 focus:outline-none flex items-center gap-2.5 font-semibold text-foreground"
                          onClick={() => handleSelectHouse(house)}
                        >
                          <span className="text-primary text-base">🏢</span> {house}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-2 relative">
                  <Label htmlFor="apartment">Квартира</Label>
                  <Input
                    id="apartment"
                    value={apartment}
                    onChange={(e) => setApartment(e.target.value)}
                    onFocus={() => {
                      fetchApartmentSuggestions(address);
                      setShowApartmentSuggestions(true);
                    }}
                    onBlur={() => setTimeout(() => setShowApartmentSuggestions(false), 200)}
                    placeholder="Номер квартиры (например: 12)"
                    disabled={isLocked}
                  />

                  {/* Всплывающая сетка доступных квартир для выбранного дома */}
                  {showApartmentSuggestions && apartmentSuggestions.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-background/95 backdrop-blur-md border rounded-lg shadow-xl max-h-48 overflow-y-auto p-3 animate-in fade-in-50 slide-in-from-top-1 duration-200">
                      <div className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                        <DoorOpen className="h-3.5 w-3.5 text-primary" />
                        <span>Доступные квартиры в этом доме:</span>
                      </div>
                      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-1.5">
                        {apartmentSuggestions.map((apt, index) => (
                          <button
                            key={index}
                            type="button"
                            className="px-1.5 py-1.5 text-xs text-center rounded border border-border/80 hover:bg-primary/10 hover:border-primary/30 transition-all focus:bg-primary/10 focus:outline-none font-semibold text-foreground hover:scale-105 active:scale-95"
                            onClick={() => {
                              setApartment(apt);
                              setShowApartmentSuggestions(false);
                            }}
                          >
                            {apt}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {!isLocked && (
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button onClick={handleSaveAndVerify} disabled={saving} className="flex-1 whitespace-normal h-auto py-2.5">
                      {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin shrink-0" />}
                      <span className="text-center">{profile?.is_verified ? "Сохранить и переотправить" : "Сохранить и отправить на верификацию"}</span>
                    </Button>
                    {editing && (
                      <Button variant="outline" onClick={() => {
                        setEditing(false);
                        setFullName(profile?.full_name || "");
                        setPhone(profile?.phone || "");
                        setAddress(profile?.address || "");
                        setDisplayAddress(getDisplayAddress(profile?.address || ""));
                        setSelectedStreet(null);
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
                      <Button variant="ghost" size="sm" className="w-full text-destructive hover:text-destructive whitespace-normal h-auto py-2 flex items-center justify-center gap-1">
                        <Trash2 className="h-4 w-4 shrink-0" />
                        <span className="text-center">Удалить данные верификации</span>
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

            {/* История заявок - в конце страницы, чтобы не мешала основной информации */}
            {(phone || fullName) && (
              <MyRequestsCard phone={phone} fullName={fullName} />
            )}

            {/* --- ДИАЛОГ ПОДАЧИ ЗАЯВКИ / ЗАКАЗА УСЛУГ --- */}
            <Dialog open={isOrderDialogOpen} onOpenChange={setIsOrderDialogOpen}>
              <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto p-4 sm:p-6 bg-background/95 backdrop-blur-md rounded-xl shadow-2xl border">
                <DialogHeader className="pb-3 border-b">
                  <DialogTitle className="text-xl font-bold flex items-center gap-2 text-foreground">
                    <Wrench className="h-5 w-5 text-primary" />
                    Создание новой заявки
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground mt-1">
                    Абонент: <span className="font-semibold text-foreground">{fullName || profile?.full_name}</span> | Адрес: <span className="font-semibold text-foreground">{address}{apartment ? `, кв. ${apartment}` : ""}</span>
                  </DialogDescription>
                </DialogHeader>

                {/* Переключатель вкладок типа обращения */}
                <div className="flex rounded-lg border p-1 bg-muted/40 w-full my-4">
                  <button
                    type="button"
                    onClick={() => setOrderType("repair")}
                    className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all flex items-center justify-center gap-1.5 ${
                      orderType === "repair"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    🔧 Неисправность
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setOrderType("order");
                      // Выберем первую доступную услугу по умолчанию, если ничего не выбрано
                      const service = products.find(p => p.category === "service");
                      if (service && !selectedServiceId) {
                        setSelectedServiceId(service.id);
                      }
                    }}
                    className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all flex items-center justify-center gap-1.5 ${
                      orderType === "order"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    🛍️ Заказ услуг и ТКП
                  </button>
                </div>

                {/* СОДЕРЖИМОЕ ТАБА: НЕИСПРАВНОСТЬ */}
                {orderType === "repair" && (
                  <div className="space-y-4 py-2">
                    <div className="space-y-2">
                      <Label htmlFor="problemText" className="text-sm font-semibold text-foreground">Что случилось?</Label>
                      <Textarea
                        id="problemText"
                        placeholder="Подробно опишите неисправность (например: не работает звук на трубке, сломался доводчик на двери, не реагирует на ключи...)"
                        value={repairProblem}
                        onChange={(e) => setRepairProblem(e.target.value)}
                        rows={4}
                        className="bg-background/50 border-border/80 focus:border-primary/50 focus:ring-1 focus:ring-primary/20 text-sm font-medium"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      * Заявки по неисправностям и техническому обслуживанию в рамках абонентской платы выполняются **бесплатно**.
                    </p>
                  </div>
                )}

                {/* СОДЕРЖИМОЕ ТАБА: ЗАКАЗ УСЛУГ И ОБОРУДОВАНИЯ */}
                {orderType === "order" && (
                  <div className="space-y-5 py-1">
                    
                    {/* Выбор услуги (установка / замена) */}
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold text-foreground flex items-center gap-1">🛠️ Выберите услугу</Label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {products
                          .filter(p => p.category === "service" && !p.name.toLowerCase().includes("кабинет"))
                          .map((service) => (
                            <button
                              key={service.id}
                              type="button"
                              onClick={() => setSelectedServiceId(service.id)}
                              className={`p-3 text-left rounded-lg border text-sm font-medium transition-all ${
                                selectedServiceId === service.id
                                  ? "border-primary bg-primary/5 text-foreground shadow-sm"
                                  : "border-border/80 bg-background/50 text-muted-foreground hover:text-foreground"
                              }`}
                            >
                              <div className="font-semibold text-foreground">{service.name}</div>
                              <div className="text-xs text-primary font-bold mt-1">
                                {Number(service.price) === 0 ? "Бесплатно" : `${Number(service.price).toFixed(0)} ₽`}
                              </div>
                            </button>
                          ))}
                        <button
                          type="button"
                          onClick={() => setSelectedServiceId(null)}
                          className={`p-3 text-left rounded-lg border text-sm font-medium transition-all ${
                            selectedServiceId === null
                              ? "border-primary bg-primary/5 text-foreground shadow-sm"
                              : "border-border/80 bg-background/50 text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          <div className="font-semibold text-foreground">Без услуги</div>
                          <div className="text-xs text-muted-foreground mt-1">Только покупка трубки/ключей</div>
                        </button>
                      </div>
                    </div>

                    {/* Выбор модели трубки */}
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold text-foreground flex items-center gap-1">🏢 Выберите трубку (ТКП)</Label>
                      <div className="space-y-2">
                        {products
                          .filter(p => p.category === "equipment" && !p.name.toLowerCase().includes("ключ"))
                          .map((equip) => {
                            const qty = selectedEquipments[equip.id] || 0;
                            return (
                              <div
                                key={equip.id}
                                className="flex items-center justify-between p-3 rounded-lg border border-border/80 bg-background/50"
                              >
                                <div>
                                  <div className="font-semibold text-sm text-foreground">{equip.name.toUpperCase()}</div>
                                  <div className="text-xs text-muted-foreground mt-0.5">{equip.description || "Абонентская трубка домофона"}</div>
                                  <div className="text-xs text-primary font-bold mt-1">{Number(equip.price).toFixed(0)} ₽</div>
                                </div>
                                
                                {/* Счетчик количества */}
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (qty > 0) {
                                        setSelectedEquipments(prev => ({ ...prev, [equip.id]: qty - 1 }));
                                      }
                                    }}
                                    className="p-1 rounded-md border hover:bg-muted text-muted-foreground active:scale-90 transition-all shrink-0"
                                  >
                                    <Minus className="h-3.5 w-3.5" />
                                  </button>
                                  <span className="w-6 text-center font-bold text-sm text-foreground">{qty}</span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedEquipments(prev => ({ ...prev, [equip.id]: qty + 1 }));
                                    }}
                                    className="p-1 rounded-md border hover:bg-muted text-muted-foreground active:scale-90 transition-all shrink-0"
                                  >
                                    <Plus className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>

                    {/* Заказ дополнительных ключей */}
                    {products
                      .filter(p => p.name.toLowerCase().includes("ключ"))
                      .map((keyProduct) => (
                        <div
                          key={keyProduct.id}
                          className="flex items-center justify-between p-3 rounded-lg border border-primary/20 bg-primary/5"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-xl">🔑</span>
                            <div>
                              <div className="font-semibold text-sm text-foreground">{keyProduct.name.toUpperCase()}</div>
                              <div className="text-xs text-muted-foreground mt-0.5">Ключ с повышенной защитой от копирования</div>
                              <div className="text-xs text-primary font-bold mt-1">{Number(keyProduct.price).toFixed(0)} ₽ за шт.</div>
                            </div>
                          </div>

                          {/* Счетчик количества ключей */}
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                if (keysQuantity > 0) setKeysQuantity(prev => prev - 1);
                              }}
                              className="p-1 rounded-md border bg-background hover:bg-muted text-muted-foreground active:scale-90 transition-all shrink-0"
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                            <span className="w-6 text-center font-bold text-sm text-foreground">{keysQuantity}</span>
                            <button
                              type="button"
                              onClick={() => setKeysQuantity(prev => prev + 1)}
                              className="p-1 rounded-md border bg-background hover:bg-muted text-muted-foreground active:scale-90 transition-all shrink-0"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}

                    {/* Подключение личного кабинета */}
                    {products
                      .filter(p => p.name.toLowerCase().includes("кабинет"))
                      .map((cabinetProduct) => (
                        <div
                          key={cabinetProduct.id}
                          className="flex items-start gap-3 p-3 rounded-lg border border-border/80 bg-background/50"
                        >
                          <input
                            id="cabinetSetup"
                            type="checkbox"
                            checked={isCabinetSetupChecked}
                            onChange={(e) => setIsCabinetSetupChecked(e.target.checked)}
                            className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary shrink-0 cursor-pointer"
                          />
                          <div className="text-left cursor-pointer" onClick={() => setIsCabinetSetupChecked(!isCabinetSetupChecked)}>
                            <Label htmlFor="cabinetSetup" className="font-semibold text-sm text-foreground cursor-pointer flex items-center gap-1.5">
                              📱 {cabinetProduct.name}
                            </Label>
                            <p className="text-xs text-muted-foreground mt-0.5">{cabinetProduct.description || "Единоразовое подключение и настройка личного кабинета"}</p>
                            <p className="text-xs text-primary font-bold mt-1">+{Number(cabinetProduct.price).toFixed(0)} ₽ единоразово</p>
                          </div>
                        </div>
                      ))}

                    {/* Комментарий к платному заказу */}
                    <div className="space-y-2">
                      <Label htmlFor="orderComment" className="text-sm font-semibold text-foreground">Желаемое время и примечания</Label>
                      <Textarea
                        id="orderComment"
                        placeholder="Укажите желаемое время визита мастера или любые дополнительные пожелания..."
                        value={orderComment}
                        onChange={(e) => setOrderComment(e.target.value)}
                        rows={2}
                        className="bg-background/50 border-border/80 focus:border-primary/50 text-xs font-medium"
                      />
                    </div>

                    {/* Смета заказа (Чек) */}
                    <div className="p-4 rounded-lg bg-muted/40 border border-dashed border-border/80 space-y-2 text-sm">
                      <div className="font-semibold text-xs text-muted-foreground uppercase tracking-wider pb-1.5 border-b border-border/40">Детализация расчета:</div>
                      
                      {/* Услуга */}
                      {selectedServiceId && (() => {
                        const s = products.find(p => p.id === selectedServiceId);
                        return s ? (
                          <div className="flex justify-between text-muted-foreground">
                            <span>{s.name}</span>
                            <span className="font-semibold text-foreground">{Number(s.price) === 0 ? "Бесплатно" : `${Number(s.price).toFixed(0)} ₽`}</span>
                          </div>
                        ) : null;
                      })()}

                      {/* Оборудование (трубки) */}
                      {Object.entries(selectedEquipments).map(([id, qty]) => {
                        const prod = products.find(p => p.id === id);
                        return prod && qty > 0 ? (
                          <div key={id} className="flex justify-between text-muted-foreground">
                            <span>{prod.name.toUpperCase()} (x{qty})</span>
                            <span className="font-semibold text-foreground">{(Number(prod.price) * qty).toFixed(0)} ₽</span>
                          </div>
                        ) : null;
                      })}

                      {/* Ключи */}
                      {keysQuantity > 0 && (() => {
                        const kp = products.find(p => p.name.toLowerCase().includes("ключ"));
                        return kp ? (
                          <div className="flex justify-between text-muted-foreground">
                            <span>🔑 Ключи Mifare (x{keysQuantity})</span>
                            <span className="font-semibold text-foreground">{(Number(kp.price) * keysQuantity).toFixed(0)} ₽</span>
                          </div>
                        ) : null;
                      })()}

                      {/* ЛК */}
                      {isCabinetSetupChecked && (() => {
                        const cp = products.find(p => p.name.toLowerCase().includes("кабинет"));
                        return cp ? (
                          <div className="flex justify-between text-muted-foreground">
                            <span>📱 Подключение личного кабинета</span>
                            <span className="font-semibold text-foreground">{Number(cp.price).toFixed(0)} ₽</span>
                          </div>
                        ) : null;
                      })()}

                      {/* Итого */}
                      <div className="flex justify-between font-bold text-base text-foreground pt-2 border-t">
                        <span>Итого к оплате:</span>
                        <span className="text-primary">{calculateTotals().total.toFixed(0)} ₽</span>
                      </div>
                    </div>

                  </div>
                )}

                {/* Кнопки диалога */}
                <DialogFooter className="pt-3 border-t flex flex-col sm:flex-row gap-2">
                  <Button variant="outline" onClick={() => setIsOrderDialogOpen(false)} className="w-full sm:w-auto">
                    Отмена
                  </Button>
                  <Button
                    onClick={handleCreateOrderRequest}
                    disabled={saving}
                    className="w-full sm:w-auto flex-1 flex items-center justify-center gap-1.5"
                  >
                    {saving ? (
                      <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                    ) : orderType === "repair" || calculateTotals().total === 0 ? (
                      <Send className="h-4 w-4 shrink-0" />
                    ) : (
                      <CreditCard className="h-4 w-4 shrink-0" />
                    )}
                    {orderType === "repair"
                      ? "Отправить заявку"
                      : calculateTotals().total === 0
                      ? "Оформить заявку"
                      : `Оплатить заказ (${calculateTotals().total.toFixed(0)} ₽)`}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* --- ДИАЛОГ ПОДТВЕРЖДЕНИЯ УСПЕШНОГО ОФОРМЛЕНИЯ И ОПЛАТЫ БАНКА --- */}
            <Dialog open={isSuccessPaymentOpen} onOpenChange={setIsSuccessPaymentOpen}>
              <DialogContent className="max-w-md p-6 bg-background rounded-xl shadow-2xl border text-center animate-in fade-in-50 zoom-in-95 duration-200">
                <div className="flex flex-col items-center justify-center space-y-4">
                  <div className="p-3 rounded-full bg-green-500/10 text-green-600 animate-bounce">
                    <CheckCircle2 className="h-12 w-12" />
                  </div>
                  <DialogTitle className="text-xl font-bold text-foreground">Заказ успешно оформлен!</DialogTitle>
                  <DialogDescription className="text-sm text-muted-foreground">
                    Заявка на подключение и доставку оборудования успешно зарегистрирована в нашей системе. 
                    Для завершения заказа перейдите к безопасной оплате на платежный шлюз банка **«Кубань Кредит»**.
                  </DialogDescription>

                  {/* Детализация для проверки */}
                  {lastOrderTotals && (
                    <div className="w-full p-4 rounded-lg bg-muted/40 border text-left text-xs space-y-2 font-medium">
                      <div className="text-muted-foreground border-b pb-1 flex justify-between">
                        <span>Лицевой счет:</span>
                        <span className="font-semibold text-foreground">{account?.account_number || "000000"}</span>
                      </div>
                      
                      {lastOrderTotals.sum1 > 0 && (
                        <div className="flex justify-between text-muted-foreground">
                          <span>Кодировка доп.ключа (сумма):</span>
                          <span className="font-semibold text-foreground">{lastOrderTotals.sum1.toFixed(2)} ₽</span>
                        </div>
                      )}
                      
                      {lastOrderTotals.sum2 > 0 && (
                        <div className="flex justify-between text-muted-foreground">
                          <span>Установка трубки (сумма):</span>
                          <span className="font-semibold text-foreground">{lastOrderTotals.sum2.toFixed(2)} ₽</span>
                        </div>
                      )}
                      
                      {lastOrderTotals.sum3 > 0 && (
                        <div className="flex justify-between text-muted-foreground">
                          <span>Настройка ЛК (сумма):</span>
                          <span className="font-semibold text-foreground">{lastOrderTotals.sum3.toFixed(2)} ₽</span>
                        </div>
                      )}

                      <div className="flex justify-between font-bold text-sm text-foreground pt-1.5 border-t">
                        <span>Итого к оплате (DENGI_F):</span>
                        <span className="text-primary text-base">{lastOrderTotals.total.toFixed(2)} ₽</span>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col gap-2 w-full pt-2">
                    <Button
                      onClick={() => {
                        if (!lastOrderTotals) return;
                        
                        // Парсим адрес на улицу, дом, корпус, подъезд и квартиру
                        const street = address ? address.split(",")[1]?.replace(/(?:ул\.?|улица)\s*/gi, "").trim() || address : "";
                        const house = address ? address.split(",")[2]?.replace(/(?:д\.?|дом)\s*/gi, "").trim() || "" : "";
                        
                        // Пытаемся вытащить подъезд из адреса
                        const entranceMatch = address ? address.match(/(?:подъезд|п\.?)\s*(\d+)/i) : null;
                        const entrance = entranceMatch ? entranceMatch[1] : "1";

                        const payUrl = `https://ref.kubankredit.ru/2?h=1A21EE45CCA81735A998DDFAA76BBB37` +
                          `&ACCOUNTNUMBER=${encodeURIComponent(account?.account_number || "000000")}` +
                          `&FIO=${encodeURIComponent(fullName || profile?.full_name || "")}` +
                          `&ADDRESS=${encodeURIComponent(street)}` +
                          `&HOUSE=${encodeURIComponent(house)}` +
                          `&FLAT=${encodeURIComponent(apartment || profile?.apartment || "")}` +
                          `&ENTRANCE=${encodeURIComponent(entrance)}` +
                          `&PHONE=${encodeURIComponent(phone || profile?.phone || "")}` +
                          `&SUMMA_OPL1=${lastOrderTotals.sum1.toFixed(2)}` +
                          `&SUMMA_OPL2=${lastOrderTotals.sum2.toFixed(2)}` +
                          `&SUMMA_OPL3=${lastOrderTotals.sum3.toFixed(2)}` +
                          `&DENGI_F=${lastOrderTotals.total.toFixed(2)}` +
                          `&INFO=${encodeURIComponent(`Оплата услуг по заявке #${lastCreatedRequestId}`)}`;

                        window.open(payUrl, "_blank");
                        setIsSuccessPaymentOpen(false);
                      }}
                      className="w-full py-2.5 flex items-center justify-center gap-2 hover:scale-105 transition-transform"
                      size="lg"
                    >
                      <CreditCard className="h-5 w-5 shrink-0" />
                      Оплатить банковской картой
                    </Button>
                    <Button variant="outline" onClick={() => setIsSuccessPaymentOpen(false)} className="w-full">
                      Оплатить позже
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Cabinet;
