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
import { Loader2, LogOut, CheckCircle, AlertCircle, AlertTriangle, ClipboardList, Calendar, Shield, CreditCard, Wallet, Pencil, Trash2, UserCheck, Plus, Minus, Clock, Wrench, CheckCircle2, XCircle, Send, Smartphone, KeyRound, PhoneCall, DoorOpen } from "lucide-react";
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

const normalizeStreet = (s: string) => 
  (s || "").toLowerCase()
    .replace(/^(г\.|город|пос\.|поселок)\s*[^,]+,\s*/i, "") // убираем город в начале если есть
    .replace(/(?:\(ул\)?|ул\.?|улица)\s*/gi, "") // убираем обозначения улицы
    .replace(/[^а-яa-z0-9]/g, "") // оставляем только буквы и цифры
    .trim();

const normalizeHouse = (h: string) => 
  (h || "").toLowerCase()
    .replace(/^(д\.\s*|дом\s*)/i, "") // убираем "д." или "дом"
    .replace(/(?:корп\.?|корпус)\s*/gi, "к") // унифицируем корпуса
    .replace(/[^а-яa-z0-9]/g, "") // оставляем только буквы и цифры
    .trim();

const normalizeApartment = (a: string) => 
  (a || "").toLowerCase()
    .replace(/^(кв\.\s*|квартира\s*)/i, "")
    .replace(/[^а-яa-z0-9]/g, "")
    .trim();

const parseAddressParts = (fullAddr: string) => {
  if (!fullAddr) return { street: "", house: "" };
  
  // Очищаем адрес от подъезда и квартиры
  const cleanAddr = fullAddr
    .replace(/,\s*(?:п(?:одъезд)?\.?\s*\d+).*$/i, "")
    .replace(/,\s*(?:кв\.?\s*\d+).*$/i, "");
    
  const parts = cleanAddr.split(",");
  let parsedStreet = "";
  let parsedHouse = "";
  
  if (parts.length >= 3) {
    parsedStreet = parts[1].trim();
    // Соединяем все последующие части (дом, корпус) через запятую и очищаем от "д."
    parsedHouse = parts.slice(2).join(", ").trim().replace(/^(д\.\s*|дом\s*)/i, "").trim();
  } else if (parts.length === 2) {
    parsedStreet = parts[0].trim();
    parsedHouse = parts[1].trim().replace(/^(д\.\s*|дом\s*)/i, "").trim();
  } else {
    parsedStreet = fullAddr || "";
  }
  return { street: parsedStreet, house: parsedHouse };
};

const DebtCard = ({ address, apartment, fullName, phone, embedded = false, setParentAccount }: { address: string; apartment: string; fullName: string; phone: string; embedded?: boolean; setParentAccount?: (acc: any) => void }) => {
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
      const { street, house } = parseAddressParts(address);
      const cleanStreetQuery = street.replace(/(?:\(ул\)?|ул\.?|улица)\s*/gi, "").trim();
      
      console.log(`[Баланс] Поиск счета. Улица: "${street}" (${cleanStreetQuery}), Дом: "${house}", Кв: "${apartment}"`); // Логирование
      
      // Ищем лицевые счета по названию улицы
      let query = supabase
        .from("accounts")
        .select("account_number, period, debt_amount, address, apartment")
        .ilike("address", `%${cleanStreetQuery}%`);
        
      const { data, error } = await query.order("period", { ascending: false }).limit(300);

      if (error) {
        console.error("[Баланс] Ошибка запроса лицевых счетов из БД:", error);
      }

      // Фильтруем результаты на фронтенде со 100% точностью по нормализованным частям адреса
      let best = null;
      if (data && data.length > 0) {
        const userStreetNorm = normalizeStreet(street);
        const userHouseNorm = normalizeHouse(house);
        const userAptNorm = normalizeApartment(apartment);

        console.log(`[Баланс] Из БД получено записей: ${data.length} для улицы "${cleanStreetQuery}". Точный подбор...`);
        
        const filtered = data.filter((a: any) => {
          const dbParts = (a.address || "").split(",");
          if (dbParts.length < 3) return false;

          const dbStreetNorm = normalizeStreet(dbParts[1]);
          const dbHouseFull = dbParts.slice(2).join(", ")
            .replace(/,\s*(?:п(?:одъезд)?\.?\s*\d+).*$/i, "")
            .replace(/,\s*(?:кв\.?\s*\d+).*$/i, "");
          const dbHouseNorm = normalizeHouse(dbHouseFull);
          const dbAptNorm = normalizeApartment(a.apartment || "");

          return dbStreetNorm === userStreetNorm && dbHouseNorm === userHouseNorm && dbAptNorm === userAptNorm;
        });

        if (filtered.length > 0) {
          best = filtered[0];
          console.log(`[Баланс] Лицевой счет найден: ${best.account_number}, сумма: ${best.debt_amount} ₽`); // Логирование
        } else {
          console.log(`[Баланс] Адрес совпал по улице и дому, но квартира ${apartment} не найдена в обслуживаемых лицевых счетах`); // Логирование
        }
      }
      setAccount(best);
      if (setParentAccount) {
        setParentAccount(best);
      }
      setLoading(false);
    };
    loadDebt();
  }, [address, apartment, setParentAccount]);

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

// MyRequestsCard удален, так как история обращений перенесена во встроенный блок ЛК;


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
  const [floor, setFloor] = useState("");
  const [email, setEmail] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [emailVerified, setEmailVerified] = useState(false);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);

  
  const { toast } = useToast();
  const hasAdminConsoleAccess = userRoles.some((role) => ["admin", "director"].includes(role));
  const isLocked = !!profile?.is_verified && !editing;

  // --- НОВЫЕ СТЕЙТЫ: ТИП ПОМЕЩЕНИЯ, СОГЛАСИЕ ФЗ-152, ДИАЛОГ ВАЛИДАЦИИ И DaData ---
  const [premiseType, setPremiseType] = useState<"apartment" | "private">("apartment"); // Тип недвижимости: apartment (кв./офис) vs private (частный дом)
  const [agreedToTerms, setAgreedToTerms] = useState(true); // Согласие по ФЗ-152 РФ (по умолчанию включено)
  const [showValidationDialog, setShowValidationDialog] = useState(false); // Красивая модалка для ошибок
  const [validationErrors, setValidationErrors] = useState<string[]>([]); // Массив текстов незаполненных граф
  const [dadataStreetSuggestions, setDadataStreetSuggestions] = useState<any[]>([]); // Подсказки улиц от DaData
  const [dadataHouseSuggestions, setDadataHouseSuggestions] = useState<any[]>([]); // Подсказки домов от DaData

  // Стейты контактных полей внутри диалога заявки
  const [orderName, setOrderName] = useState("");
  const [orderPhone, setOrderPhone] = useState("");
  const [orderStreet, setOrderStreet] = useState("");
  const [orderHouse, setOrderHouse] = useState("");
  const [orderApartment, setOrderApartment] = useState("");
  const [orderPremiseType, setOrderPremiseType] = useState<"apartment" | "private">("apartment");
  
  // --- СТЕЙТЫ ДЛЯ УМНОГО АВТОКОМПЛИТА АДРЕСОВ (accounts) ---
  const [allHouses, setAllHouses] = useState<string[]>([]); // Кэш всех уникальных домов
  const [allStreets, setAllStreets] = useState<string[]>([]); // Кэш уникальных улиц
  const [displayAddress, setDisplayAddress] = useState(""); // Красивый адрес для пользователя (без города)
  const [displayStreet, setDisplayStreet] = useState(""); // Стейт для раздельного ввода названия улицы
  const [displayHouse, setDisplayHouse] = useState(""); // Стейт для раздельного ввода/выбора номера дома
  const [selectedStreet, setSelectedStreet] = useState<string | null>(null); // Выбранная улица
  const [selectedCity, setSelectedCity] = useState("г. Краснодар"); // Город, выбранный из DaData для точного контекста домов
  const [streetSuggestions, setStreetSuggestions] = useState<string[]>([]); // Подсказки улиц
  const [houseSuggestions, setHouseSuggestions] = useState<string[]>([]); // Подсказки домов
  const [apartmentSuggestions, setApartmentSuggestions] = useState<string[]>([]); // Подсказки квартир
  const [showAddressSuggestions, setShowAddressSuggestions] = useState(false); // Показ подсказок адреса (устарело)
  const [showStreetSuggestions, setShowStreetSuggestions] = useState(false); // Флаг показа выпадающего списка улиц
  const [showHouseSuggestions, setShowHouseSuggestions] = useState(false); // Флаг показа выпадающего списка домов
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
  const [userAccount, setUserAccount] = useState<any>(null); // Лицевой счет пользователя, проброшенный из карточки баланса

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

    // 1. Точное совпадение начала строки дает максимальный приоритет
    if (cleanTarget.startsWith(cleanInput)) {
      return 150 + (cleanInput.length / cleanTarget.length) * 20;
    }

    // 2. Точное вхождение в любой части строки
    if (cleanTarget.includes(cleanInput)) {
      return 100 + (cleanInput.length / cleanTarget.length) * 10;
    }
    
    // Для коротких запросов (меньше 3 символов) опечатки не ищем, только точное совпадение
    if (cleanInput.length < 3) return 0;
    
    // 3. Коэффициент Сёренсена-Диса для исправления опечаток
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
    
    const diceScore = ((2 * intersection) / total) * 100;
    
    // Если пересечение биграмм слишком маленькое (меньше половины длины ввода),
    // то это случайное совпадение слогов, сбрасываем балл в 0
    if (intersection < Math.floor(cleanInput.length / 2)) {
      return 0;
    }

    return diceScore;
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

  // Вспомогательная функция для парсинга полного адреса при загрузке профиля
  // Формат в БД: "г. Краснодар, Улица, д. Дом"
  const parseAndSetAddress = (fullAddr: string) => {
    if (!fullAddr) {
      console.log("[Адрес] Пустой адрес в профиле, сброс полей");
      setDisplayStreet("");
      setDisplayHouse("");
      setSelectedStreet(null);
      return;
    }
    console.log(`[Адрес] Парсинг адреса из профиля: "${fullAddr}"`);
    const parts = fullAddr.split(",");
    if (parts.length >= 3) {
      const streetPart = parts[1].trim();
      const housePart = parts[2].trim().replace(/^(д\.\s*|дом\s*)/i, ""); // Очищаем от приставки "д."
      
      setDisplayStreet(streetPart);
      setDisplayHouse(housePart);
      setSelectedStreet(streetPart);
      console.log(`[Адрес] Успешно распарсено: улица "${streetPart}", дом "${housePart}"`);
    } else {
      // Если формат не совпадает, выводим его целиком в поле улицы
      const cleanAddr = getDisplayAddress(fullAddr);
      setDisplayStreet(cleanAddr);
      setDisplayHouse("");
      setSelectedStreet(cleanAddr);
      console.log(`[Адрес] Нетипичный формат адреса, выведен целиком: "${cleanAddr}"`);
    }
  };

  // --- ИНТЕГРАЦИЯ УМНОГО АВТОКОМПЛИТА АДРЕСОВ DADATA (КРАСНОДАРСКИЙ КРАЙ И АДЫГЕЯ) ---
  
  // Асинхронный запрос к API DaData Подсказок
  const fetchDaDataSuggestions = async (queryText: string, type: "street" | "house", streetContext?: string) => {
    // Бесплатный и надежный рабочий API-токен DaData
    const token = import.meta.env.VITE_DADATA_API_KEY || "ffc54d5b244795b5463f82cb8dcfbb1eb4f46ff7";
    
    // Формируем тело запроса
    const body: any = {
      query: queryText,
      count: 7,
      // Жестко ограничиваем географию поиска Краснодарским краем (регион 23) и Республикой Адыгея (регион 01).
      // Используем 13-значные КЛАДР-коды регионов через kladr_id, чтобы DaData гарантированно отсекала Москву и другие города РФ!
      locations: [
        { kladr_id: "2300000000000" }, // Краснодарский край
        { kladr_id: "0100000000000" }  // Республика Адыгея
      ],
      from_bound: { value: type },
      to_bound: { value: type }
    };

    // Если ищем номера домов, то сужаем поиск до конкретной выбранной улицы и города
    if (type === "house" && streetContext) {
      body.locations = [
        { 
          region_kladr_id: "23", 
          city: selectedCity.replace(/^(г\.\s*|город\s*)/i, ""),
          street: streetContext.replace(/(?:\(ул\)?|ул\.?|улица)\s*/gi, "").trim()
        },
        { 
          region_kladr_id: "01", 
          city: selectedCity.replace(/^(г\.\s*|город\s*)/i, ""),
          street: streetContext.replace(/(?:\(ул\)?|ул\.?|улица)\s*/gi, "").trim()
        },
        {
          region_kladr_id: "23",
          street: streetContext.replace(/(?:\(ул\)?|ул\.?|улица)\s*/gi, "").trim()
        },
        {
          region_kladr_id: "01",
          street: streetContext.replace(/(?:\(ул\)?|ул\.?|улица)\s*/gi, "").trim()
        }
      ];
      body.from_bound = { value: "house" };
      body.to_bound = { value: "house" };
    }

    try {
      console.log(`[DaData API] Запрос (${type}) для: "${queryText}", контекст города: "${selectedCity}"`);
      const response = await fetch("https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "Authorization": `Token ${token}`
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) throw new Error(`DaData API returned status ${response.status}`);
      const resData = await response.json();
      return resData.suggestions || [];
    } catch (err) {
      console.error("[DaData API] Не удалось получить подсказки:", err);
      return [];
    }
  };

  // Обработка ручного ввода в поле «Улица»
  const handleStreetInputChange = async (val: string) => {
    setDisplayStreet(val);
    setSelectedStreet(val); // Сохраняем текущий ручной ввод улицы для разблокировки инпута дома и передачи контекста в DaData
    setDisplayHouse(""); // Сбрасываем дом при смене улицы
    setHouseSuggestions([]);
    setShowStreetSuggestions(true);
    setShowHouseSuggestions(false);
    
    if (val.trim().length === 0) {
      setSelectedStreet(null);
      setStreetSuggestions([]);
      setDadataStreetSuggestions([]);
      return;
    }

    // 1. Ищем по нашей локальной кэш-базе подключенных улиц (Fuzzy Search)
    console.log(`[Автокомплит Улиц: Локальный] Поиск для ввода: "${val}"`);
    const localMatches = allStreets
      .map((street) => ({
        streetName: street,
        city: "г. Краснодар", // Локальные адреса по умолчанию Краснодарские
        isLocal: true,
        score: scoreSimilarity(val, street)
      }))
      .filter((item) => item.score > 40) // Повышенный порог схожести (отсекает левые адреса вроде Ратных Славы при вводе Главной)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4);

    setStreetSuggestions(localMatches as any);

    // 2. Параллельно запрашиваем подсказки DaData по всему Краснодарскому краю и Адыгее
    try {
      const dadataRes = await fetchDaDataSuggestions(val, "street");
      const formattedDadata = dadataRes
        .map((s: any) => {
          const streetName = s.data.street_with_type || s.data.street || s.value;
          const city = s.data.city_with_type || s.data.settlement_with_type || s.data.area_with_type || "Краснодарский край";
          
          // Проверяем, нет ли уже этой улицы в наших локальных подсказках
          const isAlreadyLocal = localMatches.some(l => l.streetName.toLowerCase() === streetName.toLowerCase());
          if (isAlreadyLocal) return null;

          return {
            streetName,
            city,
            isLocal: false
          };
        })
        .filter(Boolean);

      setDadataStreetSuggestions(formattedDadata as any);
    } catch (e) {
      console.error("[Автокомплит Улиц: DaData] Сбой:", e);
    }
  };

  // Выбор улицы из списка подсказок
  const handleSelectStreet = async (streetObj: { streetName: string, city: string, isLocal: boolean }) => {
    console.log(`[Автокомплит Улиц] Пользователь выбрал улицу: "${streetObj.streetName}", город: "${streetObj.city}", статус локальной: ${streetObj.isLocal}`);
    setSelectedStreet(streetObj.streetName);
    setSelectedCity(streetObj.city);
    setDisplayStreet(streetObj.streetName);
    setDisplayHouse(""); // При переключении улицы сбрасываем выбранный ранее дом
    setShowStreetSuggestions(false);
    setStreetSuggestions([]);
    setDadataStreetSuggestions([]);
    
    // Загружаем все доступные дома для этой улицы
    setLoadingAddressCache(true);
    const houseList: any[] = [];

    // 1. Сначала ищем подключенные дома в локальной кэш-базе unique_houses
    if (streetObj.isLocal) {
      const localHouses = allHouses
        .filter((h) => {
          const parts = h.split(",");
          const streetPart = parts[1] ? parts[1].trim() : "";
          return streetPart.toLowerCase() === streetObj.streetName.toLowerCase();
        })
        .map((h) => {
          const parts = h.split(",");
          return {
            houseNumber: parts[2] ? parts[2].trim().replace(/^(д\.\s*|дом\s*)/i, "") : "",
            isLocal: true
          };
        })
        .filter(h => h.houseNumber);
      
      houseList.push(...localHouses);
      console.log(`[Автокомплит Домов] Найдено подключенных домов в локальной БД: ${localHouses.length}`);
    }

    // 2. Подгружаем все реально существующие дома на этой улице через API DaData
    try {
      const dadataHouses = await fetchDaDataSuggestions(streetObj.streetName, "house", streetObj.streetName);
      const formattedDadata = dadataHouses
        .map((h: any) => {
          const houseNum = h.data.house || h.value;
          // Исключаем дубликаты, которые уже есть в локальной БД
          const exists = houseList.some(lh => lh.houseNumber.toLowerCase() === houseNum.toLowerCase());
          if (exists) return null;

          return {
            houseNumber: houseNum,
            isLocal: false
          };
        })
        .filter(Boolean);

      houseList.push(...formattedDadata);
      console.log(`[Автокомплит Домов] Подгружено домов из DaData: ${formattedDadata.length}`);
    } catch (e) {
      console.error("[Автокомплит Домов: DaData] Сбой загрузки домов:", e);
    }

    // Сортируем дома (по числовому значению, чтобы шел ряд: 1, 2, 3, 10...)
    const sortedHouses = houseList.sort((a, b) => {
      const numA = parseInt(a.houseNumber.replace(/\D/g, "")) || 0;
      const numB = parseInt(b.houseNumber.replace(/\D/g, "")) || 0;
      return numA - numB;
    });

    setHouseSuggestions(sortedHouses);
    setLoadingAddressCache(false);
  };

  // Обработка ручного ввода в поле «Дом»
  const handleHouseInputChange = async (val: string) => {
    setDisplayHouse(val);
    setShowHouseSuggestions(true);
    setShowStreetSuggestions(false);

    if (!selectedStreet) {
      console.log("[Автокомплит Домов] Улица не выбрана, блокируем поиск домов");
      setHouseSuggestions([]);
      return;
    }

    // Фильтруем дома для выбранной улицы по введенному значению
    // 1. Поиск по локально кэшированным
    const matchingLocal = allHouses
      .filter((h) => {
        const parts = h.split(",");
        const streetPart = parts[1] ? parts[1].trim() : "";
        return streetPart.toLowerCase() === selectedStreet.toLowerCase();
      })
      .map((h) => {
        const parts = h.split(",");
        return {
          houseNumber: parts[2] ? parts[2].trim().replace(/^(д\.\s*|дом\s*)/i, "") : "",
          isLocal: true
        };
      })
      .filter((h) => h.houseNumber.toLowerCase().includes(val.trim().toLowerCase()));

    const filteredSuggestions = [...matchingLocal];

    // 2. Поиск по DaData Подсказкам
    try {
      const dadataRes = await fetchDaDataSuggestions(val, "house", selectedStreet);
      dadataRes.forEach((h: any) => {
        const houseNum = h.data.house || h.value;
        const exists = filteredSuggestions.some(fs => fs.houseNumber.toLowerCase() === houseNum.toLowerCase());
        if (!exists) {
          filteredSuggestions.push({
            houseNumber: houseNum,
            isLocal: false
          });
        }
      });
    } catch (e) {
      console.error("[Автокомплит Домов: DaData] Сбой фильтрации:", e);
    }

    // Сортируем
    const sorted = filteredSuggestions.sort((a, b) => {
      const numA = parseInt(a.houseNumber.replace(/\D/g, "")) || 0;
      const numB = parseInt(b.houseNumber.replace(/\D/g, "")) || 0;
      return numA - numB;
    });

    setHouseSuggestions(sorted);
  };

  // Выбор дома из списка подсказок
  const handleSelectHouse = (houseObj: { houseNumber: string, isLocal: boolean }) => {
    if (!selectedStreet) return;
    console.log(`[Автокомплит Домов] Выбран дом: "${houseObj.houseNumber}", подключен к сети: ${houseObj.isLocal}`);
    setDisplayHouse(houseObj.houseNumber);
    setShowHouseSuggestions(false);
    setHouseSuggestions([]);
    
    if (houseObj.isLocal) {
      // 1. Если дом подключен, находим его полный эталонный адрес в кэше для записи в БД
      const fullAddr = allHouses.find((h) => {
        const parts = h.split(",");
        const streetPart = parts[1] ? parts[1].trim() : "";
        const housePart = parts[2] ? parts[2].trim().replace(/^(д\.\s*|дом\s*)/i, "") : "";
        return streetPart.toLowerCase() === selectedStreet.toLowerCase() && housePart.toLowerCase() === houseObj.houseNumber.toLowerCase();
      });

      if (fullAddr) {
        console.log(`[Адрес] Зафиксирован подключенный эталонный адрес для БД: "${fullAddr}"`);
        setAddress(fullAddr); // Сохраняем полный адрес в БД
        
        // Загружаем квартиры для выбранного дома
        fetchApartmentSuggestions(fullAddr);
        setShowApartmentSuggestions(true); // Автоматически выводим интерактивную сетку квартир
      }
    } else {
      // 2. Если дом НЕ подключен (Частный клиент / DaData адрес), формируем адрес динамически
      const customAddr = `${selectedCity}, ${selectedStreet}, д. ${houseObj.houseNumber}`;
      console.log(`[Адрес] Сгенерирован новый неподключенный адрес для БД: "${customAddr}"`);
      setAddress(customAddr);
      setApartmentSuggestions([]); // У неподключенного дома квартир в нашей СУБД нет
    }
  };

    // Функция для загрузки доступных квартир по выбранному адресу дома
  const fetchApartmentSuggestions = async (selectedAddr: string) => {
    if (!selectedAddr) return;
    const { street, house } = parseAddressParts(selectedAddr);
    const cleanStreetQuery = street.replace(/(?:\(ул\)?|ул\.?|улица)\s*/gi, "").trim();
    
    console.log(`[Квартира] Загрузка квартир. Улица: "${street}" (${cleanStreetQuery}), Дом: "${house}"`); // Логирование
    try {
      // Ищем все лицевые счета по корню названия улицы
      const { data, error } = await supabase
        .from("accounts")
        .select("address, apartment")
        .ilike("address", `%${cleanStreetQuery}%`);
        
      if (error) error;

      if (data) {
        const userStreetNorm = normalizeStreet(street);
        const userHouseNorm = normalizeHouse(house);

        // Точно фильтруем только те квартиры, у которых совпадают нормализованные улица и дом
        const filtered = data.filter((a: any) => {
          const dbParts = (a.address || "").split(",");
          if (dbParts.length < 3) return false;

          const dbStreetNorm = normalizeStreet(dbParts[1]);
          const dbHouseFull = dbParts.slice(2).join(", ")
            .replace(/,\s*(?:п(?:одъезд)?\.?\s*\d+).*$/i, "")
            .replace(/,\s*(?:кв\.?\s*\d+).*$/i, "");
          const dbHouseNorm = normalizeHouse(dbHouseFull);

          return dbStreetNorm === userStreetNorm && dbHouseNorm === userHouseNorm;
        });

        // Извлекаем уникальные номера квартир и сортируем их по возрастанию
        const apts = filtered
          .map((item: any) => String(item.apartment || "").trim())
          .filter(Boolean);
        const uniqueApts = Array.from(new Set(apts)).sort((a, b) => {
          const numA = parseInt(a.replace(/\D/g, "")) || 0;
          const numB = parseInt(b.replace(/\D/g, "")) || 0;
          return numA - numB;
        });
        setApartmentSuggestions(uniqueApts);
        console.log(`[Квартира] Загружено уникальных квартир для дома: ${uniqueApts.length}`); // Логирование
      }
    } catch (err) {
      console.error("[Квартира] Ошибка загрузки квартир:", err);
    }
  };

  // Эффект плавного появления элементов
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

  // Polling вместо Supabase Realtime для обновления профиля
  // PostgREST не поддерживает WebSocket, поэтому используем setInterval
  useEffect(() => {
    if (!userId) return;

    const pollProfile = async () => {
      // КРИТИЧЕСКИ ВАЖНО: Если пользователь сейчас редактирует форму (editing === true),
      // мы полностью пропускаем обновление стейтов ввода, чтобы введенные им новые данные не сбрасывались на старые из БД!
      if (editing) {
        console.log("[Кабинет] Polling: пропуск синхронизации с БД во время активного редактирования"); // Логирование
        return;
      }

      try {
        const { data } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", userId)
          .single();

        // Двойная проверка на случай, если пользователь нажал "Изменить" во время асинхронного REST-запроса
        if (data && !editing) {
          setProfile(data);
          setFullName(data.full_name || ""); // Инициализируем ФИО абонента
          setPhone(data.phone || ""); // Инициализируем контактный телефон
          setAddress(data.address || ""); // Инициализируем полный адрес для БД
          
          // Разделяем адрес на улицу и дом с помощью кастомного парсера
          parseAndSetAddress(data.address || "");
          
          setApartment(data.apartment || ""); // Инициализируем квартиру
          
          // Динамически определяем тип недвижимости при polling
          if (data.apartment && data.apartment.trim()) {
            setPremiseType("apartment");
          } else if (data.address && data.address.includes(", д. ")) {
            setPremiseType("private");
          } else {
            setPremiseType("apartment"); // По умолчанию многоквартирный
          }
          
          setFloor(data.floor || ""); // Инициализируем этаж
          
          // Инициализируем Email из профиля, а если там пусто — подставляем из сессии
          const defaultEmail = data.email || "";
          setEmail(defaultEmail);
          setEmailInput(defaultEmail);
          setEmailVerified(!!data.email_verified);
        }
      } catch (err) {
        console.error("[Кабинет] Ошибка polling профиля:", err); // Логирование
      }
    };

    // Обновляем профиль каждые 60 секунд
    const pollInterval = setInterval(() => {
      console.log("[Кабинет] Polling: обновление профиля..."); // Логирование
      pollProfile();
    }, 60000);

    return () => { clearInterval(pollInterval); }; // Очистка при размонтировании
  }, [userId, editing]); // Добавили editing в зависимости, чтобы эффект перезапускался и видел актуальное состояние редактирования

  // Эффект перехвата успешной оплаты из банка (Success URL)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const paymentSuccess = urlParams.get("payment_success");
    const reqId = urlParams.get("request_id");
    
    if (paymentSuccess === "true" && reqId) {
      const confirmPayment = async () => {
        console.log(`[Оплата] Подтверждение успешной оплаты для заявки: ${reqId}`);
        
        const { error } = await supabase
          .from("requests")
          .update({ 
            payment_status: "paid",
            status: "pending" // оставляем активным в FSM, но помечаем как оплаченный
          })
          .eq("id", reqId);
          
        if (error) {
          console.error("[Оплата] Ошибка подтверждения оплаты:", error);
          toast({
            title: "Ошибка подтверждения",
            description: "Не удалось обновить статус оплаты в базе данных.",
            variant: "destructive"
          });
        } else {
          console.log("[Оплата] Статус оплаты успешно обновлен на 'paid'!");
          toast({
            title: "🎉 Оплата успешно получена!",
            description: "Ваш заказ оплачен картой. Наряд передан в службу FSM.",
            variant: "default",
          });
          // Перезагружаем историю заявок
          if (refetchUserRequests) refetchUserRequests();
          
          // Очищаем URL-параметры из строки браузера
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      };
      confirmPayment();
    }
  }, []);

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      setRuntimeError(event.message + " in " + event.filename + ":" + event.lineno);
    };
    const handleRejection = (event: PromiseRejectionEvent) => {
      setRuntimeError("Promise Rejection: " + String(event.reason));
    };
    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleRejection);
    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, []);

  const checkUser = async () => {
    try {
      // Получаем текущую сессию пользователя из Supabase
      const { data: { session } } = await supabase.auth.getSession();

      // Если сессия отсутствует (токен недействителен, истек или отсутствует в БД)
      if (!session) {
        console.warn("[Cabinet Auth] Сессия отсутствует или недействительна! Очищаем локальные токены и перенаправляем на /auth для прерывания бесконечного цикла...");
        
        // Принудительно очищаем localStorage, чтобы страница /auth не пыталась сразу же редиректить обратно
        localStorage.removeItem("auth_token");
        localStorage.removeItem("user");
        
        // Перенаправляем пользователя на страницу авторизации
        navigate("/auth");
        return;
      }

      console.log(`[Cabinet Auth] Сессия успешно подтверждена для пользователя: ${session.user.id}`);
      setUserId(session.user.id);

      // Получаем роли пользователя из таблицы user_roles
      console.log("[Cabinet Auth] Запрос ролей пользователя...");
      const { data: rolesData, error: rolesError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id);

      if (rolesError) {
        console.error("[Cabinet Auth] Ошибка при получении ролей пользователя:", rolesError);
      }

      if (rolesData) {
        const roles = rolesData.map(r => r.role);
        console.log(`[Cabinet Auth] Роли пользователя успешно загружены: ${JSON.stringify(roles)}`);
        setUserRoles(roles);
      }

      // Загружаем профиль пользователя из таблицы profiles
      console.log("[Cabinet Auth] Загрузка профиля пользователя...");
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single();

      if (error) {
        console.error("[Cabinet Auth] Не удалось загрузить профиль пользователя из БД:", error);
        throw error;
      }

      console.log("[Cabinet Auth] Профиль пользователя успешно загружен, инициализируем стейты...");
      setProfile(data);
      setFullName(data.full_name || ""); // Инициализируем ФИО абонента
      setPhone(data.phone || ""); // Инициализируем контактный телефон
      setAddress(data.address || ""); // Инициализируем полный адрес
      
      // Разделяем адрес на улицу и дом с помощью кастомного парсера
      parseAndSetAddress(data.address || "");
      
      setApartment(data.apartment || ""); // Инициализируем квартиру
      
      // Динамически определяем тип недвижимости при первоначальной загрузке
      if (data.apartment && data.apartment.trim()) {
        setPremiseType("apartment");
        console.log("[Cabinet Auth] Тип помещения определен как: Квартира");
      } else if (data.address && data.address.includes(", д. ")) {
        setPremiseType("private");
        console.log("[Cabinet Auth] Тип помещения определен как: Частный дом");
      } else {
        setPremiseType("apartment"); // По умолчанию многоквартирный
        console.log("[Cabinet Auth] Тип помещения определен по умолчанию: Квартира");
      }
      
      setFloor(data.floor || ""); // Инициализируем этаж
      
      // Автоподстановка Email из сессии регистрации, если в профиле пусто
      const defaultEmail = data.email || session.user.email || "";
      setEmail(defaultEmail);
      setEmailInput(defaultEmail);
      setEmailVerified(!!data.email_verified || !!session.user.email);
      console.log(`[Cabinet Auth] Почта инициализирована: "${defaultEmail}" (верифицирована: ${!!data.email_verified || !!session.user.email})`);
    } catch (error: any) {
      console.error("[Cabinet Auth] Критическая ошибка при инициализации пользователя в кабинете:", error);
    } finally {
      // Гарантируем отключение экрана загрузки (Loader2) и отображение интерфейса ЛК
      console.log("[Cabinet Auth] Инициализация завершена, выключаем экран загрузки...");
      setLoading(false);
    }
  };

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

  // Эффект инициализации полей новой заявки при открытии диалогового окна
  useEffect(() => {
    if (isOrderDialogOpen) {
      console.log("[Заявка] Инициализация контактных полей формы...");
      setOrderPhone(phone || profile?.phone || "");
      setOrderStreet(displayStreet || "");
      setOrderHouse(displayHouse || "");
      setOrderApartment(apartment || "");
      setOrderName(fullName || profile?.full_name || "");
      setOrderPremiseType(premiseType || "apartment");
    }
  }, [isOrderDialogOpen, phone, profile, displayStreet, displayHouse, apartment, fullName, premiseType]);

  // --- ОТПРАВКА ЗАЯВКИ ИЛИ ЗАКАЗА В БД ---
  const handleCreateOrderRequest = async () => {
    // 1. Валидируем обязательные поля для связи (Телефон и Полный адрес)
    if (!orderPhone || !orderPhone.trim()) {
      toast({ 
        title: "Не указан телефон для связи", 
        description: "Пожалуйста, заполните номер телефона, чтобы наш мастер мог оперативно связаться с вами.",
        variant: "destructive" 
      });
      return;
    }

    if (!orderStreet || !orderStreet.trim() || !orderHouse || !orderHouse.trim()) {
      toast({ 
        title: "Не указан адрес вызова", 
        description: "Пожалуйста, обязательно заполните название улицы и номер дома.",
        variant: "destructive" 
      });
      return;
    }

    if (orderPremiseType === "apartment" && (!orderApartment || !orderApartment.trim())) {
      toast({ 
        title: "Укажите номер квартиры/офиса", 
        description: "Для многоквартирных домов и офисных помещений номер квартиры, офиса или кабинета является обязательным.",
        variant: "destructive" 
      });
      return;
    }

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
      // 2. Формируем структурированное текстовое сообщение для FSM и Telegram-бота
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

      // Составляем полный адрес для заявки
      const cleanOrderStreet = orderStreet.trim();
      const cleanOrderHouse = orderHouse.trim();
      const cleanOrderApartment = orderPremiseType === "private" ? "" : orderApartment.trim();
      
      const orderFullAddress = `г. Краснодар, ${cleanOrderStreet}, д. ${cleanOrderHouse}${
        cleanOrderApartment ? `, кв. ${cleanOrderApartment}` : ""
      }`;

      console.log(`[Заказ] Запись в БД по адресу: "${orderFullAddress}", телефон: "${orderPhone}"`);

      // 3. Вставляем запись в таблицу requests с параметрами оплаты
      const isPaidOrder = orderType === "order";
      const { data: requestData, error: requestError } = await supabase
        .from("requests")
        .insert({
          name: orderName.trim() || "Абонент ЛК",
          phone: orderPhone.trim(),
          address: orderFullAddress,
          message: messageText,
          status: "pending",
          priority: orderType === "repair" ? "medium" : "low",
          payment_status: isPaidOrder ? "pending" : null,
          payment_amount: isPaidOrder ? totals.total : 0,
          payment_method: isPaidOrder ? "online" : null,
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
      if (refetchUserRequests) {
        refetchUserRequests();
      }
      
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

  const handlePayLaterOnSite = async () => {
    if (!lastCreatedRequestId) return;
    
    setSaving(true);
    console.log(`[Оплата] Перевод заявки ${lastCreatedRequestId} на оплату на месте`);
    try {
      const { error } = await supabase
        .from("requests")
        .update({
          payment_method: "cash",
          payment_status: "on_site"
        })
        .eq("id", lastCreatedRequestId);
        
      if (error) throw error;
      
      toast({
        title: "Заказ оформлен!",
        description: "Выбран способ оплаты на месте. Наряд передан в службу FSM.",
        variant: "default"
      });
      
      if (refetchUserRequests) {
        refetchUserRequests();
      }
      setIsSuccessPaymentOpen(false);
    } catch (err: any) {
      console.error("[Оплата] Ошибка перевода на оплату на месте:", err);
      toast({
        title: "Ошибка",
        description: "Не удалось изменить способ оплаты.",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
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

  // Получаем историю заявок абонента по его номеру телефона для отображения в Личном кабинете
  const userPhoneForHistory = phone || profile?.phone;
  const { data: userRequests, refetch: refetchUserRequests } = useQuery({
    queryKey: ["user-requests", userPhoneForHistory],
    enabled: !!userPhoneForHistory,
    queryFn: async () => {
      console.log(`[История] Загрузка истории заявок для телефона: "${userPhoneForHistory}"`);
      const { data, error } = await supabase
        .from("requests")
        .select("*")
        .eq("phone", userPhoneForHistory)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  // Функция сохранения личной информации и автоматической верификации профиля
  const handleSaveAndVerify = async () => {
    setSaving(true);
    console.log("[Верификация] Инициация валидации и сохранения профиля..."); // Логирование

    // КРИТИЧЕСКИ ВАЖНО: Всегда собираем актуальный эталонный адрес на основе текущих полей ввода (Улица и Дом),
    // чтобы при редактировании существующего профиля (когда address в стейте не пустой) изменения гарантированно
    // применились и записались в БД, а также запустили реактивный поиск лицевого счета в DebtCard!
    let currentAddress = "";
    if (displayStreet?.trim() && displayHouse?.trim()) {
      currentAddress = `${selectedCity || "г. Краснодар"}, ${displayStreet.trim()}, д. ${displayHouse.trim()}`;
      setAddress(currentAddress); // Синхронизируем стейт адреса для мгновенного поиска лицевого счета в DebtCard
      console.log(`[Верификация] Актуальный эталонный адрес успешно собран: "${currentAddress}"`); // Логирование
    } else {
      currentAddress = address; // Резервный вариант, если поля ввода пусты
    }

    // 1. Проверяем обязательные поля и собираем список пустых граф для вывода пользователю
    const missingFields: string[] = [];
    if (!fullName || !fullName.trim()) missingFields.push("Фамилия, Имя, Отчество (ФИО)");
    if (!phone || !phone.trim()) missingFields.push("Контактный телефон");
    if (!displayStreet || !displayStreet.trim()) missingFields.push("Улица");
    if (!displayHouse || !displayHouse.trim()) missingFields.push("Номер дома");
    
    // Номер квартиры и этаж обязательны только для многоквартирных домов / офисов
    if (premiseType === "apartment") {
      if (!apartment || !apartment.trim()) missingFields.push("Номер квартиры/офиса");
      if (!floor || !floor.trim()) missingFields.push("Этаж");
    }
    
    if (!emailInput || !emailInput.trim()) missingFields.push("Электронная почта (Email)");
    
    // Проверка согласия с обработкой персональных данных
    if (!agreedToTerms) {
      missingFields.push("Согласие на обработку персональных данных (ФЗ-152 РФ)");
    }

    if (missingFields.length > 0) {
      console.warn(`[Верификация] Отклонено: не заполнены обязательные поля: ${missingFields.join(", ")}`);
      setValidationErrors(missingFields);
      setShowValidationDialog(true);
      setSaving(false);
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Сессия пользователя не найдена. Пожалуйста, авторизуйтесь заново.");
      }

      console.log(`[Верификация] Запись данных профиля в БД для ID: ${session.user.id}`); // Логирование
      // 2. Записываем данные в базу данных с флагом мгновенной автоматической верификации
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: fullName.trim(),
          phone: phone.trim(),
          address: currentAddress, // Полный эталонный адрес (улица + дом)
          apartment: premiseType === "private" ? "" : apartment.trim(),
          floor: premiseType === "private" ? "" : floor.trim(),
          email: emailInput.trim(),
          email_verified: true, // Автоматически подтверждаем email
          is_verified: true, // Временно авто-верифицируем аккаунт для бесшовного UX
        })
        .eq("id", session.user.id);

      if (error) throw error;

      // Обновляем локальный стейт профиля
      setProfile((prev: any) => prev ? { 
        ...prev, 
        full_name: fullName.trim(), 
        phone: phone.trim(), 
        address: currentAddress, 
        apartment: premiseType === "private" ? "" : apartment.trim(), 
        floor: premiseType === "private" ? "" : floor.trim(),
        email: emailInput.trim(),
        email_verified: true,
        is_verified: true 
      } : prev);

      // Синхронизируем Email и Address в стейтах
      setEmail(emailInput.trim());
      setEmailVerified(true);
      setAddress(currentAddress);

      // 3. Отправляем пуш-уведомление (если настроено) о верификации
      try {
        await supabase.functions.invoke("notify", {
          body: {
            event: "verification_request",
            data: {
              full_name: fullName.trim(),
              user_id: session.user.id,
              status: "auto_verified"
            },
          },
        });
      } catch (pushError) {
        console.error("[Верификация] Ошибка уведомления о верификации:", pushError);
      }

      toast({
        title: "🛡️ Профиль верифицирован!",
        description: "Ваш личный кабинет успешно активирован, статус верифицирован автоматически.",
      });
      
      setEditing(false); // Выходим из режима редактирования
    } catch (error: any) {
      console.error("[Верификация] Ошибка сохранения данных профиля:", error); // Логирование
      toast({
        title: "Ошибка верификации",
        description: error.message || "Не удалось сохранить данные профиля.",
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
      
      // Сохраняем текущую почту пользователя из сессии входа!
      const userEmail = session.user.email || "";
      console.log(`[Сброс данных] Очистка данных профиля, email сохраняется: ${userEmail}`); // Логирование
      
      const { error } = await supabase
        .from("profiles")
        .update({ 
          full_name: "", 
          phone: "", 
          address: "", 
          apartment: "", 
          floor: "", 
          email: userEmail, // Записываем email из сессии обратно
          email_verified: true, // Он остается верифицированным
          is_verified: false 
        })
        .eq("id", session.user.id);
        
      if (error) throw error;
      
      setProfile((prev: any) => prev ? { 
        ...prev, 
        full_name: "", 
        phone: "", 
        address: "", 
        apartment: "", 
        floor: "", 
        email: userEmail, 
        email_verified: true, 
        is_verified: false 
      } : prev);
      
      setFullName(""); 
      setPhone(""); 
      setAddress(""); 
      setDisplayAddress(""); 
      setSelectedStreet(null); 
      setApartment(""); 
      setFloor(""); 
      setEmail(userEmail); 
      setEmailInput(userEmail); // Сохраняем в стейте ввода почты
      setEmailVerified(true);
      setEditing(false);
      toast({ title: "Данные удалены", description: "Заполните форму заново для верификации" });
    } catch (e: any) {
      toast({ title: "Ошибка", description: e.message, variant: "destructive" });
    }
  };

  const handleLinkEmail = async (newEmail: string) => {
    if (!newEmail || !newEmail.includes("@")) {
      toast({
        title: "Некорректный Email",
        description: "Пожалуйста, введите корректный адрес электронной почты",
        variant: "destructive"
      });
      return;
    }
    
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { error } = await supabase
        .from("profiles")
        .update({
          email: newEmail,
          email_verified: false
        })
        .eq("id", session.user.id);

      if (error) throw error;

      setEmail(newEmail);
      setEmailVerified(false);
      setProfile((prev: any) => prev ? { ...prev, email: newEmail, email_verified: false } : prev);

      toast({
        title: "Почта привязана",
        description: "Email успешно сохранен. Теперь вы можете подтвердить его."
      });
    } catch (err: any) {
      toast({
        title: "Ошибка сохранения",
        description: err.message,
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const handleVerifyEmail = async () => {
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { error } = await supabase
        .from("profiles")
        .update({
          email_verified: true
        })
        .eq("id", session.user.id);

      if (error) throw error;

      setEmailVerified(true);
      setProfile((prev: any) => prev ? { ...prev, email_verified: true } : prev);

      toast({
        title: "Почта подтверждена",
        description: "Электронная почта успешно верифицирована!"
      });
    } catch (err: any) {
      toast({
        title: "Ошибка верификации",
        description: err.message,
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveEmail = async () => {
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { error } = await supabase
        .from("profiles")
        .update({
          email: "",
          email_verified: false
        })
        .eq("id", session.user.id);

      if (error) throw error;

      setEmail("");
      setEmailVerified(false);
      setProfile((prev: any) => prev ? { ...prev, email: "", email_verified: false } : prev);

      toast({
        title: "Почта удалена",
        description: "Контактный Email успешно удален"
      });
    } catch (err: any) {
      toast({
        title: "Ошибка удаления",
        description: err.message,
        variant: "destructive"
      });
    } finally {
      setSaving(false);
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

  if (runtimeError) {
    return (
      <div className="min-h-screen bg-slate-900 text-white p-8 flex flex-col items-center justify-center text-center">
        <h1 className="text-2xl font-bold text-red-500 mb-4 font-display">⚠️ Обнаружена рантайм-ошибка ЛК</h1>
        <p className="text-sm text-slate-400 max-w-md mb-6">Пожалуйста, скопируйте текст ошибки ниже и передайте его разработчику для мгновенного исправления.</p>
        <pre className="bg-slate-950 p-4 rounded-xl text-xs max-w-xl overflow-auto border border-red-900/50 text-red-400 font-mono text-left">
          {runtimeError}
        </pre>
        <Button onClick={() => window.location.reload()} className="mt-6 btn-premium-gold hover:shadow-gold-glow">
          Перезагрузить кабинет
        </Button>
      </div>
    );
  }

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

            <Card className="glass-premium rounded-[24px] border-none shadow-lg">
              <CardHeader className="pb-3">
                <CardTitle className="font-display text-lg font-bold">Статус верификации</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    {profile?.is_verified ? (
                      <>
                        <CheckCircle className="h-5 w-5 text-green-500 animate-bounce" />
                        <span className="text-green-500 font-semibold text-sm">Профиль подтверждён</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="h-5 w-5 text-amber-500 animate-pulse" />
                        <span className="text-amber-500 font-semibold text-sm">Ожидает верификации</span>
                      </>
                    )}
                  </div>
                  {!profile?.is_verified && (
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Заполните данные ниже и нажмите «Сохранить и отправить на верификацию».
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Доступ к системе - в верху страницы */}
            <Card className="glass-premium rounded-[24px] border-none shadow-lg">
              <CardHeader className="pb-4 border-b border-slate-100 dark:border-slate-800">
                <CardTitle className="flex items-center gap-2 font-display text-lg font-bold text-slate-800 dark:text-slate-100">
                  <Shield className="h-5 w-5 text-amber-500 animate-pulse" />
                  Доступ к системе
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  {profile?.is_verified
                    ? userAccount
                      ? "Информация о ваших услугах и удалённом доступе"
                      : "Статус обслуживания вашего адреса в компании «Домофондар»"
                    : "После верификации здесь появится информация о ваших подключенных услугах, видеоархив с домофона и другие функции."}
                </CardDescription>
              </CardHeader>
              {profile?.is_verified && address && (
                <CardContent className="space-y-4 pt-4">
                  {/* Карточка задолженности/статуса. Если адреса нет в БД обслуживания, она сама выведет блок "Частный клиент" */}
                  <DebtCard address={address} apartment={apartment} fullName={fullName} phone={phone} embedded setParentAccount={setUserAccount} />
                  
                  {/* Отображаем плашки удаленного доступа и заказа услуг исключительно для абонентов на обслуживании (у которых есть лицевой счет) */}
                  {userAccount && (
                    <>
                      {/* Удаленный доступ к домофону */}
                      <RemoteAccessCard address={address} apartment={apartment} />
                      
                      {/* Кнопка создания заявки / заказа платных услуг */}
                      <div className="p-4 rounded-2xl border border-slate-200/50 dark:border-slate-700/50 bg-slate-50/30 dark:bg-slate-900/30 flex flex-col sm:flex-row items-center justify-between gap-4 transition-all hover:border-primary/20">
                        <div className="text-left w-full">
                          <p className="font-semibold text-sm flex items-center gap-1.5"><Wrench className="h-4 w-4 text-primary shrink-0" /> Заявки и заказ услуг</p>
                          <p className="text-xs text-muted-foreground mt-1">Нужен ремонт трубки, новые ключи или установка оборудования? Оформить заявку прямо сейчас.</p>
                        </div>
                        <Button onClick={() => { setOrderType("repair"); setIsOrderDialogOpen(true); }} className="w-full sm:w-auto shrink-0 flex items-center gap-1.5 btn-premium-gold px-5 py-2.5 h-10">
                          <Plus className="h-4 w-4" />
                          Создать заявку
                        </Button>
                      </div>
                    </>
                  )}
                </CardContent>
              )}
            </Card>



            <Card className="glass-premium rounded-[24px] border-none shadow-xl">
              <CardHeader className="pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <CardTitle className="text-xl font-bold text-foreground font-display">Личная информация</CardTitle>
                    <CardDescription className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      {isLocked
                        ? "Данные профиля верифицированы. Чтобы внести изменения — нажмите «Изменить»."
                        : "Пожалуйста, заполните обязательные графы для отправки профиля на верификацию."}
                    </CardDescription>
                  </div>
                  {profile?.is_verified && !editing && (
                    <Button onClick={() => { setEditing(true); setAgreedToTerms(true); }} className="btn-premium-gold hover:shadow-gold-glow px-4 h-9">
                      <Pencil className="h-4 w-4 mr-1.5" />
                      Изменить
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-5 pt-5">
                
                {/* 1. ФИО Абонента */}
                <div className="space-y-2 text-left">
                  <Label htmlFor="fullName" className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">👤 Полное имя (ФИО) *</Label>
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Иван Иванович Иванов"
                    disabled={isLocked}
                    className="bg-white/40 dark:bg-slate-900/40 border-slate-200 dark:border-slate-700 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 font-medium h-10 transition-all rounded-xl placeholder-slate-400"
                  />
                </div>

                {/* 2. Контактный Телефон */}
                <div className="space-y-2 text-left">
                  <Label htmlFor="phone" className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">📞 Контактный телефон *</Label>
                  <Input
                    id="phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+7 (999) 123-45-67"
                    disabled={isLocked}
                    className="bg-white/40 dark:bg-slate-900/40 border-slate-200 dark:border-slate-700 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 font-medium h-10 transition-all rounded-xl placeholder-slate-400"
                  />
                </div>

                {/* 3. Электронная почта (заполнено при регистрации, только для чтения) */}
                <div className="space-y-2 text-left">
                  <Label htmlFor="emailInput" className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">📧 Электронная почта (Email) *</Label>
                  <div className="relative">
                    <Input
                      id="emailInput"
                      type="email"
                      value={emailInput}
                      placeholder="your-email@example.com"
                      disabled={true} // Всегда заблокировано, так как берется из регистрации
                      className="bg-slate-100/50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 text-muted-foreground font-medium h-10 cursor-not-allowed pr-32 rounded-xl"
                    />
                    <span className="absolute right-3 top-2.5 text-[9px] text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 font-semibold select-none">
                      🔒 Регистрация
                    </span>
                  </div>
                </div>

                {/* 4. Выбор Типа Недвижимости (Квартира/Офис vs Частный дом) */}
                <div className="space-y-2 text-left">
                  <Label className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">🏠 Тип недвижимости *</Label>
                  <div className="flex rounded-xl border border-slate-200 dark:border-slate-700 p-1 bg-white/20 dark:bg-slate-900/20 w-full">
                    <button
                      type="button"
                      disabled={isLocked}
                      onClick={() => setPremiseType("apartment")}
                      className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 disabled:opacity-70 ${
                        premiseType === "apartment"
                          ? "bg-white dark:bg-slate-800 text-foreground shadow-sm font-bold"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      🏢 Квартира / Офис
                    </button>
                    <button
                      type="button"
                      disabled={isLocked}
                      onClick={() => {
                        setPremiseType("private");
                        setApartment(""); // Очищаем квартиру для частного сектора
                        setFloor(""); // Очищаем этаж
                      }}
                      className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 disabled:opacity-70 ${
                        premiseType === "private"
                          ? "bg-white dark:bg-slate-800 text-foreground shadow-sm font-bold"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      🏡 Частный дом / Здание
                    </button>
                  </div>
                </div>

                {/* 5. Раздельные поля Улицы и Дома с DaData-автокомплитом */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Поле «Улица» */}
                  <div className="space-y-2 relative text-left">
                    <Label htmlFor="street" className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">🛣️ Улица *</Label>
                    <div className="relative">
                      <Input
                        id="street"
                        value={displayStreet}
                        onChange={(e) => handleStreetInputChange(e.target.value)}
                        onFocus={() => { if (!isLocked) setShowStreetSuggestions(true); }}
                        onBlur={() => setTimeout(() => setShowStreetSuggestions(false), 250)}
                        placeholder="Начните вводить название улицы"
                        disabled={isLocked}
                        className="bg-white/40 dark:bg-slate-900/40 border-slate-200 dark:border-slate-700 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 font-medium h-10 transition-all rounded-xl placeholder-slate-400"
                      />
                      {loadingAddressCache && (
                        <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin text-primary" />
                      )}
                    </div>
                    
                    {/* Подсказки улиц */}
                    {showStreetSuggestions && (streetSuggestions.length > 0 || dadataStreetSuggestions.length > 0) && (
                      <div className="absolute z-50 w-full mt-1.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200/50 dark:border-slate-700/50 rounded-2xl shadow-2xl max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 animate-in fade-in-50 slide-in-from-top-1 duration-200">
                        
                        {/* Подключенные улицы */}
                        {streetSuggestions.map((item: any, idx) => (
                          <button
                            key={`local-st-${idx}`}
                            type="button"
                            className="w-full text-left px-4 py-3 text-xs sm:text-sm hover:bg-amber-500/5 transition-colors focus:bg-amber-500/5 focus:outline-none flex items-center justify-between font-semibold text-foreground"
                            onClick={() => handleSelectStreet(item)}
                          >
                            <span className="flex items-center gap-2"><span className="text-base">🏠</span> {item.streetName}</span>
                            <span className="text-[9px] bg-green-500/10 text-green-600 dark:text-green-400 px-2 py-0.5 rounded border border-green-200/50 font-bold">Подключен</span>
                          </button>
                        ))}

                        {/* Другие улицы Краснодарского края и Адыгеи из DaData */}
                        {dadataStreetSuggestions.map((item: any, idx) => (
                          <button
                            key={`dadata-st-${idx}`}
                            type="button"
                            className="w-full text-left px-4 py-3 text-xs sm:text-sm hover:bg-primary/5 transition-colors focus:bg-primary/5 focus:outline-none flex items-center justify-between font-medium text-muted-foreground hover:text-foreground"
                            onClick={() => handleSelectStreet(item)}
                          >
                            <span className="flex items-center gap-2"><span className="text-base">🛣️</span> {item.streetName}</span>
                            <span className="text-[9px] text-muted-foreground bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200/40">{item.city}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Поле «Номер дома» */}
                  <div className="space-y-2 relative text-left">
                    <Label htmlFor="house" className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">🏢 Номер дома *</Label>
                    <div className="relative">
                      <Input
                        id="house"
                        value={displayHouse}
                        onChange={(e) => handleHouseInputChange(e.target.value)}
                        onFocus={() => { if (!isLocked && displayStreet?.trim()) setShowHouseSuggestions(true); }}
                        onBlur={() => setTimeout(() => setShowHouseSuggestions(false), 250)}
                        placeholder={displayStreet?.trim() ? "Введите номер дома" : "Сначала введите улицу"}
                        disabled={isLocked || !displayStreet?.trim()}
                        className="bg-white/40 dark:bg-slate-900/40 border-slate-200 dark:border-slate-700 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 font-medium h-10 transition-all rounded-xl placeholder-slate-400 disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                    </div>
                    
                    {/* Подсказки домов */}
                    {showHouseSuggestions && houseSuggestions.length > 0 && (
                      <div className="absolute z-50 w-full mt-1.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200/50 dark:border-slate-700/50 rounded-2xl shadow-2xl max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 animate-in fade-in-50 slide-in-from-top-1 duration-200">
                        {houseSuggestions.map((item: any, idx) => (
                          <button
                            key={`house-${idx}`}
                            type="button"
                            className="w-full text-left px-4 py-3 text-xs sm:text-sm hover:bg-amber-500/5 transition-colors focus:bg-amber-500/5 focus:outline-none flex items-center justify-between font-semibold text-foreground"
                            onClick={() => handleSelectHouse(item)}
                          >
                            <span className="flex items-center gap-2">
                              <span>{item.isLocal ? "🛡️" : "🏢"}</span> {item.houseNumber}
                            </span>
                            <span className={`text-[9px] px-2 py-0.5 rounded border font-bold ${
                              item.isLocal 
                                ? "bg-green-500/10 text-green-600 dark:text-green-400 border-green-200/50" 
                                : "bg-slate-100 dark:bg-slate-800 text-muted-foreground border-slate-200/40"
                            }`}>
                              {item.isLocal ? "Обслуживается" : "Доступен"}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* 6. Помещение (Квартира/Офис) */}
                {premiseType === "apartment" && (
                  <div className="space-y-2 relative text-left animate-in fade-in slide-in-from-top-1 duration-300">
                    <Label htmlFor="apartment" className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">🏢 Квартира / Офис / Помещение *</Label>
                    <Input
                      id="apartment"
                      value={apartment}
                      onChange={(e) => setApartment(e.target.value)}
                      onFocus={() => {
                        if (!isLocked) {
                          fetchApartmentSuggestions(address);
                          setShowApartmentSuggestions(true);
                        }
                      }}
                      onBlur={() => setTimeout(() => setShowApartmentSuggestions(false), 200)}
                      placeholder={displayHouse?.trim() ? "Номер квартиры, офиса или бокса" : "Сначала введите номер дома"}
                      disabled={isLocked || !displayStreet?.trim() || !displayHouse?.trim()}
                      className="bg-white/40 dark:bg-slate-900/40 border-slate-200 dark:border-slate-700 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 font-medium h-10 transition-all rounded-xl placeholder-slate-400 disabled:opacity-50 disabled:cursor-not-allowed"
                    />

                    {/* Всплывающая сетка доступных квартир */}
                    {showApartmentSuggestions && apartmentSuggestions.length > 0 && (
                      <div className="absolute z-50 w-full mt-1.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200/50 dark:border-slate-700/50 rounded-2xl shadow-2xl max-h-48 overflow-y-auto p-3 animate-in fade-in-50 slide-in-from-top-1 duration-200">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                          <DoorOpen className="h-3.5 w-3.5 text-primary" />
                          <span>Подключенные абоненты в этом доме:</span>
                        </div>
                        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-1.5">
                          {apartmentSuggestions.map((apt, index) => (
                            <button
                              key={index}
                              type="button"
                              className="px-1.5 py-1.5 text-xs text-center rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-amber-500/10 hover:border-amber-500/30 transition-all focus:bg-amber-500/10 focus:outline-none font-semibold text-foreground hover:scale-105 active:scale-95"
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
                )}

                {/* 7. Этаж */}
                {premiseType === "apartment" && (
                  <div className="space-y-2 text-left animate-in fade-in slide-in-from-top-1 duration-300">
                    <Label htmlFor="floor" className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">🏢 Этаж *</Label>
                    <Input
                      id="floor"
                      value={floor}
                      onChange={(e) => setFloor(e.target.value)}
                      placeholder={apartment?.trim() ? "Номер этажа" : "Сначала введите номер квартиры"}
                      disabled={isLocked || !displayStreet?.trim() || !displayHouse?.trim() || !apartment?.trim()}
                      className="bg-white/40 dark:bg-slate-900/40 border-slate-200 dark:border-slate-700 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 font-medium h-10 transition-all rounded-xl placeholder-slate-400 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  </div>
                )}

                {/* 8. Согласие ФЗ-152 РФ */}
                {!isLocked && (
                  <div className="flex items-start gap-2.5 py-1 text-left animate-in fade-in duration-300">
                    <input
                      id="agreedToTerms"
                      type="checkbox"
                      checked={agreedToTerms}
                      onChange={(e) => setAgreedToTerms(e.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-amber-500 focus:ring-amber-500/20 shrink-0 cursor-pointer"
                    />
                    <Label htmlFor="agreedToTerms" className="text-[11px] text-muted-foreground leading-normal cursor-pointer select-none font-semibold hover:text-foreground transition-colors">
                      Я соглашаюсь на <span className="text-primary hover:underline font-bold">обработку персональных данных</span> в соответствии с ФЗ-152 РФ и принимаю условия <span className="text-primary hover:underline font-bold">публичной оферты</span> при использовании сервиса «Домофондар».
                    </Label>
                  </div>
                )}

                {/* 9. Кнопки сохранения/отмены */}
                {!isLocked && (() => {
                  const isFormValid = !!(
                    fullName?.trim() &&
                    phone?.trim() &&
                    displayStreet?.trim() &&
                    displayHouse?.trim() &&
                    (premiseType === "private" || (apartment?.trim() && floor?.trim())) && // Этаж обязателен для квартир/офисов
                    emailInput?.trim() &&
                    agreedToTerms
                  );

                  return (
                    <div className="flex flex-col sm:flex-row gap-3 pt-2">
                      <Button 
                        onClick={handleSaveAndVerify} 
                        disabled={saving} 
                        className={`flex-1 whitespace-normal h-11 transition-all duration-300 rounded-xl ${
                          isFormValid 
                            ? "btn-premium-gold hover:shadow-gold-glow scale-100 font-bold" 
                            : "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600 border border-dashed border-slate-200 dark:border-slate-700 opacity-60 cursor-not-allowed"
                        }`}
                      >
                        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin shrink-0" />}
                        <span className="text-center">
                          {profile?.is_verified ? "Сохранить и переотправить" : "Сохранить и отправить на верификацию"}
                        </span>
                      </Button>
                      {editing && (
                        <Button variant="outline" onClick={() => {
                          setEditing(false);
                          setAgreedToTerms(true); // Принудительно возвращаем согласие
                          setFullName(profile?.full_name || "");
                          setPhone(profile?.phone || "");
                          setAddress(profile?.address || "");
                          setDisplayAddress(getDisplayAddress(profile?.address || ""));
                          setSelectedStreet(null);
                          setApartment(profile?.apartment || "");
                          setFloor(profile?.floor || "");
                        }} className="font-semibold rounded-xl h-11 hover:bg-slate-50 dark:hover:bg-slate-900">
                          Отмена
                        </Button>
                      )}
                    </div>
                  );
                })()}

                {/* 10. Кнопка удаления верификации */}
                {(profile?.is_verified || profile?.full_name) && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm" className="w-full text-red-500 hover:text-red-600 hover:bg-red-500/10 whitespace-normal h-auto py-2 flex items-center justify-center gap-1 font-semibold rounded-xl">
                        <Trash2 className="h-4 w-4 shrink-0" />
                        <span className="text-center">Удалить данные верификации</span>
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="glass-premium border-none rounded-3xl shadow-2xl p-6">
                      <AlertDialogHeader>
                        <AlertDialogTitle className="text-lg font-bold text-foreground font-display">Удалить данные профиля?</AlertDialogTitle>
                        <AlertDialogDescription className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                          Все заполненные вами данные профиля (ФИО, адрес, телефон, помещение) будут безвозвратно удалены из базы, а статус верификации аннулирован.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter className="mt-4 gap-2">
                        <AlertDialogCancel className="font-semibold rounded-xl h-10 border border-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900">Отмена</AlertDialogCancel>
                        <AlertDialogAction onClick={handleClearData} className="bg-red-500 hover:bg-red-600 text-white font-semibold rounded-xl h-10">
                          Удалить данные
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </CardContent>
            </Card>


            {/* --- РАЗДЕЛ: ИСТОРИЯ ЗАЯВОК И ОПЛАТ (в самом низу страницы) --- */}
            {userRequests && userRequests.length > 0 && (() => {
              // RULE 2: Логируем отрисовку блока истории обращений в Личном Кабинете
              console.log("[ЛК Кабинет] Отрисовка карточки истории обращений и оплат абонента, найдено записей:", userRequests.length);
              
              return (
                <Card className="glass-premium border-none rounded-[24px] shadow-2xl animate-in fade-in-50 duration-300">
                  <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
                    <CardTitle className="text-lg font-bold flex items-center gap-2 text-foreground font-display">
                      <ClipboardList className="h-5 w-5 text-amber-500" />
                      История ваших обращений и оплат
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-500 dark:text-slate-400">
                      Список всех ваших заявок, их статус выполнения в службе FSM и статус оплаты
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-4 px-3 sm:px-6">
                    <div className="space-y-4 max-h-[480px] overflow-y-auto pr-1">
                      {userRequests.map((req: any) => {
                        const isPaid = req.payment_status === "paid";
                        const isOnSite = req.payment_status === "on_site";
                        const isPending = req.payment_status === "pending";
                        const isOrder = Number(req.payment_amount) > 0;
                        
                        // Форматируем статус заявки
                        const getStatusBadge = (status: string) => {
                          switch (status) {
                            case "pending":
                              return <Badge className="bg-orange-500/10 text-orange-600 dark:text-orange-400 hover:bg-orange-500/10 border-orange-200/50 rounded-lg">Новая</Badge>;
                            case "in_progress":
                              return <Badge className="bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 border-blue-200/50 rounded-lg">В работе</Badge>;
                            case "completed":
                              return <Badge className="bg-green-500/10 text-green-600 dark:text-green-400 hover:bg-green-500/10 border-green-200/50 rounded-lg">Выполнена</Badge>;
                            case "cancelled":
                              return <Badge className="bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/10 border-red-200/50 rounded-lg">Отклонена</Badge>;
                            default:
                              return <Badge variant="outline" className="rounded-lg">{status}</Badge>;
                          }
                        };

                        // Форматируем статус оплаты
                        const getPaymentBadge = () => {
                          if (!isOrder) return null;
                          if (isPaid) {
                            return <Badge className="bg-green-600 text-white dark:bg-green-700 hover:bg-green-600 border-none rounded-lg font-bold">✓ Оплачено онлайн</Badge>;
                          }
                          if (isOnSite) {
                            return <Badge className="bg-blue-600 text-white dark:bg-blue-700 hover:bg-blue-600 border-none rounded-lg font-bold">💵 Оплата на месте</Badge>;
                          }
                          if (isPending) {
                            return <Badge className="bg-orange-500 text-white dark:bg-orange-600 hover:bg-orange-500 border-none rounded-lg font-bold">⏳ Ожидает оплаты</Badge>;
                          }
                          return null;
                        };

                        return (
                          <div key={req.id} className="p-4 rounded-2xl border border-slate-100 dark:border-slate-800/80 bg-white/40 dark:bg-slate-900/40 hover:bg-white/60 dark:hover:bg-slate-900/60 transition-all shadow-sm hover:shadow-md flex flex-col md:flex-row justify-between gap-4">
                            <div className="space-y-2 flex-1 text-left">
                              <div className="flex items-center justify-between sm:justify-start gap-3 flex-wrap">
                                <span className="text-xs font-mono text-slate-500 dark:text-slate-400 font-semibold">
                                  {format(new Date(req.created_at), "dd MMMM yyyy, HH:mm", { locale: ru })}
                                </span>
                                <div className="flex gap-1.5 items-center">
                                  {getStatusBadge(req.status)}
                                  {getPaymentBadge()}
                                </div>
                              </div>
                              
                              <p className="text-sm font-semibold text-foreground border-b border-slate-100 dark:border-slate-800 pb-1">
                                {req.address}
                              </p>
                              
                              <p className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-line leading-relaxed">
                                {req.message}
                              </p>
                            </div>

                            {/* Кнопка "Оплатить сейчас" для неоплаченных онлайн-заявок */}
                            {isOrder && isPending && (
                              <div className="flex items-center justify-end shrink-0 pt-2 md:pt-0 md:pl-4 border-t md:border-t-0 md:border-l border-slate-100 dark:border-slate-800/80">
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    // RULE 2: Логируем инициацию оплаты заявки из истории обращений
                                    console.log("[ЛК Кабинет] Абонент инициировал оплату заявки ID:", req.id, "сумма:", req.payment_amount);
                                    
                                    // Парсим суммы из сообщения или берем payment_amount
                                    const totalAmount = Number(req.payment_amount) || 0;
                                    
                                    // Парсим адрес на улицу, дом, корпус, подъезд и квартиру
                                    const street = address ? address.split(",")[1]?.replace(/(?:ул\.?|улица)\s*/gi, "").trim() || address : "";
                                    const house = address ? address.split(",")[2]?.replace(/(?:д\.?|дом)\s*/gi, "").trim() || "" : "";
                                    const entranceMatch = address ? address.match(/(?:подъезд|п\.?)\s*(\d+)/i) : null;
                                    const entrance = entranceMatch ? entranceMatch[1] : "1";

                                    // Передаем всю сумму в SUMMA_OPL2 (услуги)
                                    const payUrl = `https://pay.kk.ru/services/117425?` +
                                      `&ACCOUNTNUMBER=${encodeURIComponent(userAccount?.account_number || "000000")}` +
                                      `&FIO=${encodeURIComponent(fullName || profile?.full_name || "")}` +
                                      `&ADDRESS=${encodeURIComponent(street)}` +
                                      `&HOUSE=${encodeURIComponent(house)}` +
                                      `&FLAT=${encodeURIComponent(apartment || profile?.apartment || "")}` +
                                      `&ENTRANCE=${encodeURIComponent(entrance)}` +
                                      `&FLOOR=${encodeURIComponent(floor || profile?.floor || "")}` +
                                      `&EMAIL=${encodeURIComponent(email || profile?.email || "")}` +
                                      `&PHONE=${encodeURIComponent(phone || profile?.phone || "")}` +
                                      `&SUMMA_OPL1=0.00` +
                                      `&SUMMA_OPL2=${totalAmount.toFixed(2)}` +
                                      `&SUMMA_OPL3=0.00` +
                                      `&DENGI_F=${totalAmount.toFixed(2)}` +
                                      `&INFO=${encodeURIComponent(`Оплата услуг по заявке #${req.id}`)}` +
                                      `&SuccessURL=${encodeURIComponent(`https://domofondar.ru/cabinet?payment_success=true&request_id=${req.id}`)}`;

                                    window.open(payUrl, "_blank");
                                  }}
                                  className="w-full md:w-auto flex items-center justify-center gap-1.5 btn-premium-gold px-4 py-2 hover:shadow-gold-glow text-xs shrink-0 font-bold"
                                >
                                  <CreditCard className="h-3.5 w-3.5" />
                                  Оплатить сейчас
                                </Button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              );
            })()}

            {/* --- ДИАЛОГ ПОДАЧИ ЗАЯВКИ / ЗАКАЗА УСЛУГ --- */}
            <Dialog open={isOrderDialogOpen} onOpenChange={(openState) => {
              // RULE 2: Логируем состояние диалога создания заявки
              console.log("[ЛК Кабинет] Изменение состояния диалога заявки, открыт:", openState);
              setIsOrderDialogOpen(openState);
            }}>
              <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto p-4 sm:p-6 glass-premium border-none rounded-[24px] shadow-2xl animate-in fade-in duration-200">
                <DialogHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
                  <DialogTitle className="text-xl font-bold flex items-center gap-2 text-foreground font-display">
                    <Wrench className="h-5 w-5 text-amber-500" />
                    Создание новой заявки
                  </DialogTitle>
                  <DialogDescription className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Абонент: <span className="font-semibold text-foreground">{fullName || profile?.full_name}</span> | Адрес: <span className="font-semibold text-foreground">{address}{apartment ? `, кв. ${apartment}` : ""}</span>
                  </DialogDescription>
                </DialogHeader>

                {/* --- БЛОК КОНТАКТОВ И АДРЕСА ВЫЗОВА ДЛЯ ЗАЯВКИ --- */}
                <div className="p-4 bg-white/40 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/80 rounded-2xl space-y-4 my-2 text-left animate-in fade-in duration-300">
                  <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 dark:border-slate-800/80 pb-1.5 font-display">
                    <Smartphone className="h-4 w-4 text-amber-500" />
                    <span>Контакты и адрес вызова для этой заявки</span>
                  </div>

                  {/* Имя и Телефон */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="orderName" className="text-xs font-semibold text-slate-500 dark:text-slate-400">ФИО клиента</Label>
                      <Input
                        id="orderName"
                        value={orderName}
                        onChange={(e) => setOrderName(e.target.value)}
                        placeholder="Иванов Иван Иванович"
                        className="bg-white/50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 h-9 text-sm font-medium transition-all rounded-xl focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="orderPhone" className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-0.5">
                        Телефон для связи <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="orderPhone"
                        value={orderPhone}
                        onChange={(e) => setOrderPhone(e.target.value)}
                        placeholder="+7 (999) 999-99-99"
                        className="bg-white/50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 h-9 text-sm font-medium transition-all rounded-xl focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                      />
                    </div>
                  </div>

                  {/* Переключатель типа помещения для заявки */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Тип недвижимости</Label>
                    <div className="flex rounded-xl border border-slate-200 dark:border-slate-800 p-0.5 bg-white/20 dark:bg-slate-900/20 max-w-xs">
                      <button
                        type="button"
                        onClick={() => {
                          setOrderPremiseType("apartment");
                          console.log("[Заявка] Выбран тип помещения: Квартира/Офис");
                        }}
                        className={`flex-1 py-1 text-xs font-semibold rounded-lg transition-all ${
                          orderPremiseType === "apartment"
                            ? "bg-white dark:bg-slate-800 text-foreground shadow-sm font-bold"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        🏢 Кв. / Офис
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setOrderPremiseType("private");
                          console.log("[Заявка] Выбран тип помещения: Частный дом");
                        }}
                        className={`flex-1 py-1 text-xs font-semibold rounded-lg transition-all ${
                          orderPremiseType === "private"
                            ? "bg-white dark:bg-slate-800 text-foreground shadow-sm font-bold"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        🏡 Частный дом
                      </button>
                    </div>
                  </div>

                  {/* Адрес: Улица, Дом, Квартира */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1.5 sm:col-span-1">
                      <Label htmlFor="orderStreet" className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-0.5">
                        Улица <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="orderStreet"
                        value={orderStreet}
                        onChange={(e) => setOrderStreet(e.target.value)}
                        placeholder="Название улицы"
                        className="bg-white/50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 h-9 text-sm font-medium transition-all rounded-xl focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="orderHouse" className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-0.5">
                        Дом <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="orderHouse"
                        value={orderHouse}
                        onChange={(e) => setOrderHouse(e.target.value)}
                        placeholder="Например: 58а"
                        className="bg-white/50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 h-9 text-sm font-medium transition-all rounded-xl focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                      />
                    </div>
                    {orderPremiseType === "apartment" && (
                      <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
                        <Label htmlFor="orderApartment" className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-0.5">
                          Кв. / Офис <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="orderApartment"
                          value={orderApartment}
                          onChange={(e) => setOrderApartment(e.target.value)}
                          placeholder="Например: 12"
                          className="bg-white/50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 h-9 text-sm font-medium transition-all rounded-xl focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Переключатель вкладок типа обращения */}
                <div className="flex rounded-xl border border-slate-200 dark:border-slate-850 p-1 bg-white/20 dark:bg-slate-900/20 w-full my-4">
                  <button
                    type="button"
                    onClick={() => {
                      // RULE 2: Логируем переключение на ремонт
                      console.log("[Заявка] Абонент переключил таб на: Неисправность");
                      setOrderType("repair");
                    }}
                    className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                      orderType === "repair"
                        ? "bg-white dark:bg-slate-800 text-foreground shadow-sm font-bold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    🔧 Неисправность
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      // RULE 2: Логируем переключение на заказ
                      console.log("[Заявка] Абонент переключил таб на: Заказ услуг и оборудования");
                      setOrderType("order");
                      const service = products.find(p => p.category === "service");
                      if (service && !selectedServiceId) {
                        setSelectedServiceId(service.id);
                      }
                    }}
                    className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                      orderType === "order"
                        ? "bg-white dark:bg-slate-800 text-foreground shadow-sm font-bold"
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
                        className="bg-white/50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 text-sm font-medium rounded-xl transition-all placeholder-slate-400"
                      />
                    </div>
                    <p className="text-xs text-slate-400 dark:text-slate-500">
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
                              onClick={() => {
                                console.log("[Заявка] Выбрана услуга ID:", service.id, "цена:", service.price);
                                setSelectedServiceId(service.id);
                              }}
                              className={`p-3.5 text-left rounded-xl border text-sm transition-all hover:scale-[1.01] ${
                                selectedServiceId === service.id
                                  ? "border-amber-500 bg-amber-500/5 text-foreground shadow-sm font-semibold"
                                  : "border-slate-200 dark:border-slate-800 bg-white/20 dark:bg-slate-900/20 text-muted-foreground hover:text-foreground"
                              }`}
                            >
                              <div className="font-semibold text-foreground">{service.name}</div>
                              <div className="text-xs text-amber-500 font-bold mt-1">
                                {Number(service.price) === 0 ? "Бесплатно" : `${Number(service.price).toFixed(0)} ₽`}
                              </div>
                            </button>
                          ))}
                        <button
                          type="button"
                          onClick={() => {
                            console.log("[Заявка] Сброс выбора услуги");
                            setSelectedServiceId(null);
                          }}
                          className={`p-3.5 text-left rounded-xl border text-sm transition-all hover:scale-[1.01] ${
                            selectedServiceId === null
                              ? "border-amber-500 bg-amber-500/5 text-foreground shadow-sm font-semibold"
                              : "border-slate-200 dark:border-slate-800 bg-white/20 dark:bg-slate-900/20 text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          <div className="font-semibold text-foreground">Без услуги</div>
                          <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">Только покупка трубки/ключей</div>
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
                                className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/20 dark:bg-slate-900/20"
                              >
                                <div className="text-left">
                                  <div className="font-semibold text-sm text-foreground">{equip.name.toUpperCase()}</div>
                                  <div className="text-xs text-slate-500 dark:text-slate-450 mt-0.5">{equip.description || "Абонентская трубка домофона"}</div>
                                  <div className="text-xs text-amber-500 font-bold mt-1">{Number(equip.price).toFixed(0)} ₽</div>
                                </div>
                                
                                {/* Счетчик количества */}
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (qty > 0) {
                                        console.log("[Заявка] Уменьшено кол-во трубок", equip.name, "до:", qty - 1);
                                        setSelectedEquipments(prev => ({ ...prev, [equip.id]: qty - 1 }));
                                      }
                                    }}
                                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-400 dark:text-slate-550 active:scale-90 transition-all shrink-0 bg-white/40 dark:bg-slate-950/40"
                                  >
                                    <Minus className="h-3.5 w-3.5" />
                                  </button>
                                  <span className="w-6 text-center font-bold text-sm text-foreground">{qty}</span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      console.log("[Заявка] Увеличено кол-во трубок", equip.name, "до:", qty + 1);
                                      setSelectedEquipments(prev => ({ ...prev, [equip.id]: qty + 1 }));
                                    }}
                                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-400 dark:text-slate-550 active:scale-90 transition-all shrink-0 bg-white/40 dark:bg-slate-950/40"
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
                          className="flex items-center justify-between p-3.5 rounded-xl border border-amber-500/20 bg-amber-500/5 shadow-sm shadow-amber-500/5"
                        >
                          <div className="flex items-center gap-2 text-left">
                            <span className="text-xl">🔑</span>
                            <div>
                              <div className="font-semibold text-sm text-foreground">{keyProduct.name.toUpperCase()}</div>
                              <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Ключ с повышенной защитой от копирования</div>
                              <div className="text-xs text-amber-500 font-bold mt-1">{Number(keyProduct.price).toFixed(0)} ₽ за шт.</div>
                            </div>
                          </div>

                          {/* Счетчик количества ключей */}
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                if (keysQuantity > 0) {
                                  console.log("[Заявка] Уменьшено кол-во ключей до:", keysQuantity - 1);
                                  setKeysQuantity(prev => prev - 1);
                                }
                              }}
                              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-400 dark:text-slate-550 active:scale-90 transition-all shrink-0 bg-white/40 dark:bg-slate-950/40"
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                            <span className="w-6 text-center font-bold text-sm text-foreground">{keysQuantity}</span>
                            <button
                              type="button"
                              onClick={() => {
                                console.log("[Заявка] Увеличено кол-во ключей до:", keysQuantity + 1);
                                setKeysQuantity(prev => prev + 1);
                              }}
                              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-400 dark:text-slate-550 active:scale-90 transition-all shrink-0 bg-white/40 dark:bg-slate-950/40"
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
                          className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/20 dark:bg-slate-900/20"
                        >
                          <input
                            id="cabinetSetup"
                            type="checkbox"
                            checked={isCabinetSetupChecked}
                            onChange={(e) => {
                              console.log("[Заявка] Подключение ЛК:", e.target.checked);
                              setIsCabinetSetupChecked(e.target.checked);
                            }}
                            className="mt-1 h-4 w-4 rounded border-slate-300 text-amber-500 focus:ring-amber-500/20 shrink-0 cursor-pointer"
                          />
                          <div className="text-left cursor-pointer" onClick={() => setIsCabinetSetupChecked(!isCabinetSetupChecked)}>
                            <Label htmlFor="cabinetSetup" className="font-semibold text-sm text-foreground cursor-pointer flex items-center gap-1.5">
                              📱 {cabinetProduct.name}
                            </Label>
                            <p className="text-xs text-slate-500 dark:text-slate-450 mt-0.5">{cabinetProduct.description || "Единоразовое подключение и настройка личного кабинета"}</p>
                            <p className="text-xs text-amber-500 font-bold mt-1">+{Number(cabinetProduct.price).toFixed(0)} ₽ единоразово</p>
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
                        className="bg-white/50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 text-xs font-medium rounded-xl placeholder-slate-450"
                      />
                    </div>

                    {/* Смета заказа (Чек) */}
                    <div className="p-4 rounded-2xl bg-white/40 dark:bg-slate-900/40 border border-dashed border-slate-200 dark:border-slate-800 space-y-2 text-sm">
                      <div className="font-semibold text-xs text-slate-450 dark:text-slate-400 uppercase tracking-wider pb-1.5 border-b border-slate-100 dark:border-slate-800/80">Детализация расчета:</div>
                      
                      {/* Услуга */}
                      {selectedServiceId && (() => {
                        const s = products.find(p => p.id === selectedServiceId);
                        return s ? (
                          <div className="flex justify-between text-slate-500 dark:text-slate-400">
                            <span>{s.name}</span>
                            <span className="font-semibold text-foreground">{Number(s.price) === 0 ? "Бесплатно" : `${Number(s.price).toFixed(0)} ₽`}</span>
                          </div>
                        ) : null;
                      })()}

                      {/* Оборудование (трубки) */}
                      {Object.entries(selectedEquipments).map(([id, qty]) => {
                        const prod = products.find(p => p.id === id);
                        return prod && qty > 0 ? (
                          <div key={id} className="flex justify-between text-slate-500 dark:text-slate-400">
                            <span>{prod.name.toUpperCase()} (x{qty})</span>
                            <span className="font-semibold text-foreground">{(Number(prod.price) * qty).toFixed(0)} ₽</span>
                          </div>
                        ) : null;
                      })}

                      {/* Ключи */}
                      {keysQuantity > 0 && (() => {
                        const kp = products.find(p => p.name.toLowerCase().includes("ключ"));
                        return kp ? (
                          <div className="flex justify-between text-slate-500 dark:text-slate-400">
                            <span>🔑 Ключи Mifare (x{keysQuantity})</span>
                            <span className="font-semibold text-foreground">{(Number(kp.price) * keysQuantity).toFixed(0)} ₽</span>
                          </div>
                        ) : null;
                      })()}

                      {/* ЛК */}
                      {isCabinetSetupChecked && (() => {
                        const cp = products.find(p => p.name.toLowerCase().includes("кабинет"));
                        return cp ? (
                          <div className="flex justify-between text-slate-500 dark:text-slate-400">
                            <span>📱 Подключение личного кабинета</span>
                            <span className="font-semibold text-foreground">{Number(cp.price).toFixed(0)} ₽</span>
                          </div>
                        ) : null;
                      })()}

                      {/* Итого */}
                      <div className="flex justify-between font-bold text-base text-foreground pt-2 border-t border-slate-100 dark:border-slate-800">
                        <span>Итого к оплате:</span>
                        <span className="text-amber-500">{calculateTotals().total.toFixed(0)} ₽</span>
                      </div>
                    </div>

                  </div>
                )}

                {/* Кнопки диалога */}
                <DialogFooter className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row gap-2">
                  <Button variant="outline" onClick={() => {
                    console.log("[Заявка] Абонент закрыл диалог заявки");
                    setIsOrderDialogOpen(false);
                  }} className="w-full sm:w-auto font-semibold rounded-xl h-11 border border-slate-250 hover:bg-slate-5 hover:text-foreground">
                    Отмена
                  </Button>
                  <Button
                    onClick={() => {
                      console.log("[Заявка] Абонент нажал отправить/оплатить заявку, итого:", calculateTotals().total);
                      handleCreateOrderRequest();
                    }}
                    disabled={saving}
                    className="w-full sm:w-auto flex-1 flex items-center justify-center gap-1.5 btn-premium-gold hover:shadow-gold-glow rounded-xl h-11 font-bold"
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

            {/* --- ДИАЛОГ ОШИБОК ВАЛИДАЦИИ ФОРМЫ (ФЗ-152, ОБЯЗАТЕЛЬНЫЕ ПОЛЯ) --- */}
            <AlertDialog open={showValidationDialog} onOpenChange={setShowValidationDialog}>
              <AlertDialogContent className="glass-premium border-none rounded-[24px] shadow-2xl max-w-md p-6 text-left">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-xl font-bold flex items-center gap-2 text-destructive font-display">
                    <AlertTriangle className="h-6 w-6 text-destructive animate-bounce" />
                    Внимание! Заполните все поля
                  </AlertDialogTitle>
                  <AlertDialogDescription className="text-sm text-slate-600 dark:text-slate-350 pt-2 space-y-3 leading-relaxed">
                    <p>Для отправки профиля на верификацию необходимо заполнить все обязательные графы.</p>
                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-left">
                      <p className="font-semibold text-destructive mb-1.5 text-xs uppercase tracking-wider font-display">Не заполнены следующие поля:</p>
                      <ul className="list-disc list-inside space-y-1 text-sm text-foreground/90 font-medium">
                        {validationErrors.map((err, i) => (
                          <li key={i}>{err}</li>
                        ))}
                      </ul>
                    </div>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="pt-4 border-t border-slate-100 dark:border-slate-800/80 mt-4">
                  <AlertDialogAction onClick={() => setShowValidationDialog(false)} className="btn-premium-gold hover:shadow-gold-glow text-white font-semibold w-full sm:w-auto h-11 rounded-xl">
                    Хорошо, заполню
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            {/* --- ДИАЛОГ ПОДТВЕРЖДЕНИЯ УСПЕШНОГО ОФОРМЛЕНИЯ И ОПЛАТЫ БАНКА --- */}
            <Dialog open={isSuccessPaymentOpen} onOpenChange={setIsSuccessPaymentOpen}>
              <DialogContent className="max-w-md p-6 glass-premium border-none rounded-[24px] shadow-2xl text-center animate-in fade-in-50 zoom-in-95 duration-200">
                <div className="flex flex-col items-center justify-center space-y-4">
                  <div className="p-3 rounded-full bg-green-500/10 text-green-600 animate-bounce">
                    <CheckCircle2 className="h-12 w-12" />
                  </div>
                  <DialogTitle className="text-xl font-bold text-foreground font-display">Заказ успешно оформлен!</DialogTitle>
                  <DialogDescription className="text-sm text-slate-500 dark:text-slate-400">
                    Заявка на подключение и доставку оборудования успешно зарегистрирована в нашей системе. 
                    Для завершения заказа перейдите к безопасной оплате на платежный шлюз банка **«Кубань Кредит»**.
                  </DialogDescription>

                  {/* Детализация для проверки */}
                  {lastOrderTotals && (
                    <div className="w-full p-4 rounded-xl bg-white/40 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/80 text-left text-xs space-y-2 font-medium">
                      <div className="text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800 pb-1 flex justify-between">
                        <span>Лицевой счет:</span>
                        <span className="font-semibold text-foreground">{userAccount?.account_number || "000000"}</span>
                      </div>
                      
                      {lastOrderTotals.sum1 > 0 && (
                        <div className="flex justify-between text-slate-500 dark:text-slate-400">
                          <span>Кодировка доп.ключа (сумма):</span>
                          <span className="font-semibold text-foreground">{lastOrderTotals.sum1.toFixed(2)} ₽</span>
                        </div>
                      )}
                      
                      {lastOrderTotals.sum2 > 0 && (
                        <div className="flex justify-between text-slate-500 dark:text-slate-400">
                          <span>Установка трубки (сумма):</span>
                          <span className="font-semibold text-foreground">{lastOrderTotals.sum2.toFixed(2)} ₽</span>
                        </div>
                      )}
                      
                      {lastOrderTotals.sum3 > 0 && (
                        <div className="flex justify-between text-slate-500 dark:text-slate-400">
                          <span>Настройка ЛК (сумма):</span>
                          <span className="font-semibold text-foreground">{lastOrderTotals.sum3.toFixed(2)} ₽</span>
                        </div>
                      )}

                      <div className="flex justify-between font-bold text-sm text-foreground pt-1.5 border-t border-slate-100 dark:border-slate-800">
                        <span>Итого к оплате (DENGI_F):</span>
                        <span className="text-amber-500 text-base">{lastOrderTotals.total.toFixed(2)} ₽</span>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col gap-2 w-full pt-2">
                    <Button
                      onClick={() => {
                        if (!lastOrderTotals) return;
                        
                        console.log("[Заявка] Абонент переходит к шлюзу банка Кубань Кредит, сумма:", lastOrderTotals.total);
                        
                        // Парсим адрес на улицу, дом, корпус, подъезд и квартиру
                        const street = address ? address.split(",")[1]?.replace(/(?:ул\.?|улица)\s*/gi, "").trim() || address : "";
                        const house = address ? address.split(",")[2]?.replace(/(?:д\.?|дом)\s*/gi, "").trim() || "" : "";
                        
                        // Пытаемся вытащить подъезд из адреса
                        const entranceMatch = address ? address.match(/(?:подъезд|п\.?)\s*(\d+)/i) : null;
                        const entrance = entranceMatch ? entranceMatch[1] : "1";

                        const payUrl = `https://pay.kk.ru/services/117425?` +
                          `&ACCOUNTNUMBER=${encodeURIComponent(userAccount?.account_number || "000000")}` +
                          `&FIO=${encodeURIComponent(fullName || profile?.full_name || "")}` +
                          `&ADDRESS=${encodeURIComponent(street)}` +
                          `&HOUSE=${encodeURIComponent(house)}` +
                          `&FLAT=${encodeURIComponent(apartment || profile?.apartment || "")}` +
                          `&ENTRANCE=${encodeURIComponent(entrance)}` +
                          `&FLOOR=${encodeURIComponent(floor || profile?.floor || "")}` +
                          `&EMAIL=${encodeURIComponent(email || profile?.email || "")}` +
                          `&PHONE=${encodeURIComponent(phone || profile?.phone || "")}` +
                          `&SUMMA_OPL1=${lastOrderTotals.sum1.toFixed(2)}` +
                          `&SUMMA_OPL2=${lastOrderTotals.sum2.toFixed(2)}` +
                          `&SUMMA_OPL3=${lastOrderTotals.sum3.toFixed(2)}` +
                          `&DENGI_F=${lastOrderTotals.total.toFixed(2)}` +
                          `&INFO=${encodeURIComponent(`Оплата услуг по заявке #${lastCreatedRequestId}`)}` +
                          `&SuccessURL=${encodeURIComponent(`https://domofondar.ru/cabinet?payment_success=true&request_id=${lastCreatedRequestId}`)}`;

                        window.open(payUrl, "_blank");
                        setIsSuccessPaymentOpen(false);
                      }}
                      className="w-full py-2.5 flex items-center justify-center gap-2 hover:scale-105 transition-transform btn-premium-gold hover:shadow-gold-glow rounded-xl h-11 font-bold"
                      size="lg"
                    >
                      <CreditCard className="h-5 w-5 shrink-0" />
                      Оплатить сейчас (картой онлайн)
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        console.log("[Заявка] Абонент выбрал оплату на месте мастеру");
                        handlePayLaterOnSite();
                      }}
                      disabled={saving}
                      className="w-full flex items-center justify-center gap-1.5 font-semibold rounded-xl h-11 border border-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900"
                    >
                      {saving && <Loader2 className="h-4 w-4 animate-spin shrink-0" />}
                      Оплатить позже наличными (мастеру)
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
