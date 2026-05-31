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
import { Loader2, LogOut, CheckCircle, AlertCircle, ClipboardList, Calendar, Shield, CreditCard, Wallet, Pencil, Trash2, UserCheck, Plus, Clock, Wrench, CheckCircle2, XCircle, Send, Smartphone, KeyRound, PhoneCall, DoorOpen } from "lucide-react";
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

      <Button className="w-full" size="lg" onClick={() => navigate("/payment")}>
        <CreditCard className="mr-2 h-4 w-4" />
        Оплатить и получить доступ
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
                      <div className="grid grid-cols-5 sm:grid-cols-8 gap-1.5">
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

            {/* История заявок - в конце страницы, чтобы не мешала основной информации */}
            {(phone || fullName) && (
              <MyRequestsCard phone={phone} fullName={fullName} />
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Cabinet;
