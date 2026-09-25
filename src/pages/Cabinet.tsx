import React, { useEffect, useState, useMemo, useRef, Component, ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ShinyButton } from "@/components/ui/shiny-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useUserRole } from "@/hooks/useUserRole";
import { Loader2, LogOut, CheckCircle, AlertCircle, AlertTriangle, ClipboardList, Calendar, Shield, CreditCard, Wallet, Pencil, Trash2, UserCheck, Plus, Minus, Clock, Wrench, CheckCircle2, XCircle, Send, Smartphone, KeyRound, PhoneCall, Headphones, DoorOpen, DoorClosed, Info, User, Phone, Mail, Lock, Lightbulb, Hash, MapPin, Building, Home, Building2, History, FileSpreadsheet, Copy, Eye, EyeOff, ShieldCheck, Sparkles, LayoutDashboard, Zap, Printer, Receipt, FileText, ShoppingBag } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { VerificationUploadDialog } from "@/components/VerificationUploadDialog";
import { LegalDocumentsModal } from "@/components/LegalDocumentsModal";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { calculateKeyPriceDetails, parseTieredPricing } from "@/utils/pricing";

interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  scheduled_date: string | null;
  notes: string | null;
  clients: { name: string; address: string } | null;
}

const normalizeStreet = (s: string) => {
  if (!s) return "";
  let clean = s.toLowerCase().trim();
  // Если в строке есть запятая, то предполагаем, что первая часть — это город/населенный пункт, удаляем её
  if (clean.includes(",")) {
    const parts = clean.split(",");
    // В адресах БД: [0] = Город, [1] = Улица, [2] = Дом. Берем именно улицу!
    if (parts.length >= 2) {
      clean = parts[1].trim();
    }
  }
  return clean
    .replace(/^(г\.|город|пос\.|поселок|аул|п\.|х\.|хутор|ст\.|станица)\s+[^,]+/gi, "") // убираем населенный пункт, если остался в начале
    .replace(/(?:\b(?:ул\.?|улица|пер\.?|переулок|проспект|пр-кт|пр\.?|аллея|бульвар|тракт|шоссе)\b|\(ул\))\s*/gi, "") // убираем типы улиц
    .replace(/(?:^|\s)(?:им\.?|имени|генерала?|академика?|маршала?|улице)(?:\s|$)/gi, "") // убираем звания, инициалы и "имени"
    .replace(/[^а-яa-z0-9]/g, "") // оставляем только буквы и цифры
    .trim();
};

const normalizeHouse = (h: string) => 
  (h || "").toLowerCase()
    .trim()
    .replace(/^(д\.\s*|дом\s*)/i, "") // убираем "д." или "дом"
    .replace(/(?:корп\.?|корпус)\s*/gi, "к") // унифицируем корпуса
    .replace(/[^а-яa-z0-9]/g, "") // оставляем только буквы и цифры
    .trim();

const normalizeApartment = (a: string) => 
  (a || "").toLowerCase()
    .trim()
    .replace(/^(кв\.\s*|квартира\s*)/i, "")
    .replace(/[^а-яa-z0-9]/g, "")
    .trim();

// Вспомогательная функция для надежного извлечения квартиры из полной строки адреса.
// Помогает получить квартиру, если в БД accounts поле apartment пустое, но квартира записана в адресе.
const extractApartmentFromAddress = (addr: string): string => {
  if (!addr) return "";
  // Ищем ", кв. 15", ", кв.15", ", квартира 15", ", кв 15", ", кв. 15-а", ", кв. 15б" и т.д.
  // Поддерживаем русские/английские буквы, цифры, дефисы.
  const match = addr.match(/,\s*(?:кв\.?|квартира)\s*([а-яa-z0-9-+]+)/i);
  const result = match ? match[1].trim() : "";
  console.log(`[Адрес: Квартира] Извлечение из "${addr}" -> "${result}"`); // Логирование
  return result;
};

// Вспомогательная функция для динамического определения города для локальных улиц
const getCityForLocalStreet = (streetName: string, housesCache: string[]): string => {
  if (!streetName || !housesCache || housesCache.length === 0) return "г. Краснодар";
  
  // Ищем в кэше первый дом на этой улице
  const matchingHouse = housesCache.find(h => {
    const parts = h.split(",");
    const dbStreet = parts[1] ? parts[1].trim() : "";
    return normalizeStreet(dbStreet) === normalizeStreet(streetName);
  });
  
  if (matchingHouse) {
    const parts = matchingHouse.split(",");
    const city = parts[0] ? parts[0].trim() : "г. Краснодар";
    console.log(`[Улица] Для локальной улицы "${streetName}" определен город из БД: "${city}"`);
    return city;
  }
  
  return "г. Краснодар";
};

// Вспомогательная функция для сборки красивого и полного номера дома с корпусом/буквой/строением из DaData
const getHouseNumberFromDaData = (h: any): string => {
  if (!h) return "";
  if (h.data) {
    let num = h.data.house || "";
    // Если есть литера (буква) дома, и она не вшита в номер дома, добавляем её
    if (h.data.house_letter && !num.toLowerCase().includes(h.data.house_letter.toLowerCase())) {
      num += h.data.house_letter;
    }
    // Если есть блок/корпус/строение
    if (h.data.block) {
      const blockType = h.data.block_type === "к" ? "корп." : (h.data.block_type || "корп.");
      num += ` ${blockType} ${h.data.block}`;
    }
    if (num) return num.trim();
  }
  // Резервный вариант: пробуем вытащить из полного значения
  return h.value || "";
};

// Утилита для извлечения полной части дома (номер + корпус) из адреса вьюхи unique_houses или accounts
// Формат: "Город, Улица, д. 9, корп. 2, п 6, кв. 332" → "9, корп. 2"
// Формат: "Город, Улица, д. 6а" → "6а"
const extractHousePartFromCacheAddr = (cacheAddr: string): string => {
  const parts = cacheAddr.split(",");
  if (parts.length < 3) return "";
  // Берём ВСЕ части начиная с 3-й (индекс 2) и объединяем обратно через запятую
  let fullHousePart = parts.slice(2).join(",").trim();
  // Убираем приставку "д." или "дом" только из начала
  fullHousePart = fullHousePart.replace(/^(д\.\s*|дом\s*)/i, "").trim();
  // Принудительно очищаем от информации о подъездах и квартирах, если они попали сюда из сырого адреса accounts
  // Заменяем \w+ на [а-яa-z0-9-+]+ для корректной поддержки букв в квартирах при очистке
  fullHousePart = fullHousePart
    .replace(/,\s*(?:п(?:одъезд)?\.?\s*\d+).*$/i, "")
    .replace(/,\s*(?:кв\.?\s*[а-яa-z0-9-+]+).*$/i, "")
    .trim();
  return fullHousePart;
};

const parseAddressParts = (fullAddr: string) => {
  if (!fullAddr) return { street: "", house: "" };
  
  // Очищаем адрес от подъезда и квартиры
  // Заменяем \d+ на [а-яa-z0-9-+]+ для корректного вырезания квартир с литерами (например, "15а")
  const cleanAddr = fullAddr
    .replace(/,\s*(?:п(?:одъезд)?\.?\s*\d+).*$/i, "")
    .replace(/,\s*(?:кв\.?\s*[а-яa-z0-9-+]+).*$/i, "");
    
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

const DebtCard = ({ 
  address, 
  apartment, 
  fullName, 
  phone, 
  embedded = false, 
  setParentAccount,
  isVerified = false,
  userId = null,
  onOpenOrderDialog,
}: { 
  address: string; 
  apartment: string; 
  fullName: string; 
  phone: string; 
  embedded?: boolean; 
  setParentAccount?: (acc: any) => void;
  isVerified?: boolean;
  userId?: string | null;
  onOpenOrderDialog?: (type?: "repair" | "order") => void;
}) => {
  const [account, setAccount] = useState<{ account_number: string; period: string; debt_amount: number; address: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestText, setRequestText] = useState("");
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [accountHistory, setAccountHistory] = useState<any[]>([]);
  const [onlinePayments, setOnlinePayments] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<any | null>(null);

  // Стейты для быстрой онлайн-оплаты через платёжный шлюз ЮKassa
  const [isYooKassaOpen, setIsYooKassaOpen] = useState(false);
  const [payAmount, setPayAmount] = useState<string>("300");
  const [isPayingYooKassa, setIsPayingYooKassa] = useState(false);

  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const loadDebt = async () => {
      setLoading(true);
      // RULE 2: Запоминаем факт возврата со шлюза ЮKassa до любых асинхронных операций
      const initialParams = new URLSearchParams(window.location.search);
      const isReturningFromPayment = initialParams.get("check_payment") === "1" || initialParams.get("payment") === "success";

      const { street, house } = parseAddressParts(address);
      const cleanStreetQuery = street.replace(/(?:\b(?:ул\.?|улица)\b|\(ул\))\s*/gi, "").trim();
      
      console.log(`[Баланс] Поиск счета. Улица: "${street}" (${cleanStreetQuery}), Дом: "${house}", Кв: "${apartment}"`); // Логирование
      
      // Ищем лицевые счета по названию улицы И номеру дома для исключения обрезки лимитом PostgREST
      console.log(`[Баланс: БД Запрос] Отправка запроса к accounts с ilike по адресу: "%${cleanStreetQuery}%${house}%"`); // Подробное логирование запроса
      let query = supabase
        .from("accounts")
        .select("account_number, period, debt_amount, address, apartment")
        .ilike("address", `%${cleanStreetQuery}%${house}%`);
        
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
          
          // Вырезаем подъезды и квартиры (с поддержкой буквенных квартир) из номера дома
          const dbHouseFull = dbParts.slice(2).join(", ")
            .replace(/,\s*(?:п(?:одъезд)?\.?\s*\d+).*$/i, "")
            .replace(/,\s*(?:кв\.?\s*[а-яa-z0-9-+]+).*$/i, "");
          const dbHouseNorm = normalizeHouse(dbHouseFull);
          
          // Надежно извлекаем номер квартиры (из поля `apartment` или из строки адреса)
          const dbApt = a.apartment?.trim() || extractApartmentFromAddress(a.address || "");
          const dbAptNorm = normalizeApartment(dbApt);

          const isMatch = dbStreetNorm === userStreetNorm && dbHouseNorm === userHouseNorm && dbAptNorm === userAptNorm;
          
          if (isMatch) {
            console.log(`[Баланс: Сравнение] ✅ Совпадение! БД улица: "${dbStreetNorm}" (ввод: "${userStreetNorm}"), БД дом: "${dbHouseNorm}" (ввод: "${userHouseNorm}"), БД кв: "${dbAptNorm}" (ввод: "${userAptNorm}")`);
          }

          return isMatch;
        });

        if (filtered.length > 0) {
          best = filtered[0];
          console.log(`[Баланс] Лицевой счет найден: ${best.account_number}, сумма в БД: ${best.debt_amount} ₽`);

          // Фоновая синхронизация платежей ЮKassa с бэкендом
          let syncedPayments: any[] = [];
          try {
            const syncRes = await fetch(`/backend-api/api/payments/yookassa/sync/${best.account_number}`);
            const syncData = await syncRes.json();
            if (syncData.success && syncData.account) {
              best.debt_amount = Number(syncData.account.debt_amount);
              console.log(`[Баланс: ЮKassa Синхронизация] Актуализирован долг счета ${best.account_number}: ${best.debt_amount} ₽`);
              if (syncData.payments) {
                syncedPayments = syncData.payments;
                setOnlinePayments(syncData.payments);
              }
            }
          } catch (syncErr) {
            console.warn("[Баланс: Синхронизация ЮKassa]", syncErr);
          }

          const currentDebt = Number(best.debt_amount) || 0;
          setPayAmount(currentDebt > 0 ? currentDebt.toFixed(2) : "300");

          // Проверка возврата после платежа в системе ЮKassa (проверяем РЕАЛЬНЫЙ статус транзакции)
          if (isReturningFromPayment) {
            console.log("[ЮKassa] Пользователь вернулся со страницы платежа. Проверка фактического статуса...");
            window.history.replaceState({}, document.title, window.location.pathname);

            const isOrderParam = initialParams.get("is_order") === "1" || initialParams.get("isOrder") === "true";
            const lastP = syncedPayments[0];
            const isOrderPayment = isOrderParam || 
                                   !!lastP?.request_id || 
                                   lastP?.metadata?.is_order === true || 
                                   lastP?.metadata?.is_order === "true" || 
                                   !!lastP?.metadata?.order_data ||
                                   (lastP?.description && lastP.description.toLowerCase().includes("заказ"));

            if (lastP) {
              if (lastP.status === "succeeded") {
                if (isOrderPayment) {
                  toast({
                    title: "✅ Заказ успешно оплачен!",
                    description: `Платёж на сумму ${Number(lastP.amount).toFixed(2)} ₽ успешно проведён через ЮKassa. Заявка передана мастеру в работу! Детали наряда и электронный чек доступны в истории заказов.`,
                  });
                } else {
                  toast({
                    title: "✅ Оплата успешно зачислена!",
                    description: `Платёж на сумму ${Number(lastP.amount).toFixed(2)} ₽ успешно проведён через ЮKassa, баланс обновлён. Электронный чек доступен в истории платежей.`,
                  });
                }
              } else if (lastP.status === "canceled") {
                toast({
                  title: "Платёж отменён",
                  description: isOrderPayment
                    ? "Оплата заказа оборудования не была завершена. Средства с вашей карты не списывались."
                    : "Оплата не была завершена. Средства с вашей карты не списывались.",
                  variant: "destructive",
                });
              } else {
                toast({
                  title: "⏳ Платёж ожидает оплаты",
                  description: "Платёж не был завершён или ожидает подтверждения банка. Средства не списаны.",
                });
              }
            }
          }
        } else {
          console.log(`[Баланс] Адрес совпал по улице и дому, но квартира ${apartment} не найдена в обслуживаемых лицевых счетах`);
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

  // Обработчик создания платежа через шлюз ЮKassa с комиссией эквайринга 5%
  const handleYooKassaPay = async () => {
    if (!account) return;
    const baseAmount = parseFloat(payAmount);
    if (isNaN(baseAmount) || baseAmount < 10) {
      toast({
        title: "Некорректная сумма",
        description: "Минимальная сумма для онлайн-оплаты через ЮKassa — 10 ₽",
        variant: "destructive",
      });
      return;
    }

    // Расчет 5% комиссии эквайринга
    const feeAmount = Math.round(baseAmount * 0.05 * 100) / 100;
    const totalAmountWithFee = Math.round((baseAmount + feeAmount) * 100) / 100;

    setIsPayingYooKassa(true);
    console.log(`[ЮKassa: Оплата] Создание платежной сессии: базовая сумма ${baseAmount} ₽, комиссия 5% ${feeAmount} ₽, итого к списанию ${totalAmountWithFee} ₽, л/с ${account.account_number}`);

    try {
      const resp = await fetch("/backend-api/api/payments/yookassa/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: totalAmountWithFee, // Сумма с учетом комиссии 5%
          credit_amount: baseAmount,  // Базовая сумма к зачислению на лицевой счет без комиссии
          fee_amount: feeAmount,      // Комиссия эквайринга
          description: `Оплата ТО домофона, л/с ${account.account_number}, ${address}${apartment ? `, кв. ${apartment}` : ""}`,
          account_number: account.account_number,
          accountNumber: account.account_number,
          user_id: userId || undefined,
          userId: userId || undefined,
          return_url: `${window.location.origin}/cabinet?check_payment=1&account=${account.account_number}`,
          returnUrl: `${window.location.origin}/cabinet?check_payment=1&account=${account.account_number}`,
        }),
      });

      const data = await resp.json();
      console.log("[ЮKassa: Ответ бэкенда]", data);

      if (!resp.ok || !data.success) {
        throw new Error(data.error || "Не удалось инициализировать оплату ЮKassa");
      }

      // Поддерживаем как camelCase (confirmationUrl), так и snake_case (confirmation_url)
      const confirmationRedirectUrl = data.confirmationUrl || data.confirmation_url;

      if (confirmationRedirectUrl) {
        console.log(`[ЮKassa] Переход по платежной ссылке: ${confirmationRedirectUrl}`);
        window.location.href = confirmationRedirectUrl;
      } else {
        throw new Error("Не получен URL подтверждения оплаты");
      }
    } catch (err: any) {
      console.error("[ЮKassa: Ошибка]", err);
      toast({
        title: "Ошибка оплаты",
        description: err.message || "Не удалось создать платёж в ЮKassa. Попробуйте оплатить через Банк «Кубань Кредит».",
        variant: "destructive",
      });
    } finally {
      setIsPayingYooKassa(false);
    }
  };

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

          {/* Блок кнопок оплаты:
              - Если абонент верифицирован: доступна Быстрая оплата картой/СБП через ЮKassa и кнопка Банка «Кубань Кредит».
              - Если не верифицирован: кнопка Банка «Кубань Кредит» + подсказка о доступности ЮKassa после подтверждения адреса. */}
          <div className="space-y-2.5">
            {isVerified ? (
              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  className="flex-1 justify-center rounded-xl bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-white font-bold shadow-md shadow-amber-500/20 hover:shadow-amber-500/30 transition-all gap-2"
                  onClick={() => {
                    const currentDebt = Number(account.debt_amount) || 0;
                    setPayAmount(currentDebt > 0 ? currentDebt.toFixed(2) : "300");
                    setIsYooKassaOpen(true);
                  }}
                >
                  <Zap className="h-4 w-4 fill-current" />
                  <span>Быстрая оплата ЮKassa</span>
                </Button>
                <Button
                  variant="outline"
                  className="rounded-xl text-xs flex items-center justify-center gap-1.5 border-slate-300 dark:border-slate-700"
                  onClick={() => navigate("/payment")}
                  title="Оплата через платёжный терминал Банка «Кубань Кредит»"
                >
                  <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>Банк «Кубань Кредит»</span>
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <ShinyButton className="w-full justify-center rounded-xl" onClick={() => navigate("/payment")}>
                  <CreditCard className="mr-2 h-4 w-4" />
                  Оплатить (Банк «Кубань Кредит»)
                </ShinyButton>
                <div className="p-2.5 rounded-xl border border-amber-500/20 bg-amber-500/5 flex items-center gap-2 text-[11px] text-amber-800 dark:text-amber-300">
                  <Zap className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                  <span>Быстрая онлайн-оплата картой через <strong>ЮKassa</strong> станет доступна после подтверждения адреса (верификации).</span>
                </div>
              </div>
            )}

            {/* Кнопка «Оставить заявку» во всю ширину под блоком оплаты в едином фирменном стиле ShinyButton */}
            {onOpenOrderDialog && (
              <ShinyButton
                onClick={() => {
                  console.log("[DebtCard] Нажата кнопка 'Оставить заявку' во всю ширину под кнопкой оплаты");
                  onOpenOrderDialog("repair");
                }}
                className="w-full justify-center rounded-xl h-10 text-xs sm:text-sm font-semibold flex items-center gap-2 mt-1 shadow-sm"
              >
                <Wrench className="h-4 w-4 text-amber-500 shrink-0" />
                <span>Оставить заявку</span>
              </ShinyButton>
            )}
          </div>

          {/* Диалог быстрой оплаты через платёжный шлюз ЮKassa */}
          <Dialog open={isYooKassaOpen} onOpenChange={setIsYooKassaOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-base font-bold">
                  <div className="h-8 w-8 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                    <Zap className="h-4 w-4 fill-current" />
                  </div>
                  Быстрая оплата ЮKassa
                </DialogTitle>
                <DialogDescription>
                  Безопасная онлайн-оплата банковской картой, СБП или SberPay
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2">
                {/* Сведения о лицевом счете */}
                <div className="p-3.5 rounded-xl border bg-muted/40 space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Лицевой счёт:</span>
                    <span className="font-mono font-bold text-foreground">{account.account_number}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Адрес:</span>
                    <span className="font-medium text-foreground text-right truncate max-w-[240px]">{address}{apartment ? `, кв. ${apartment}` : ""}</span>
                  </div>
                  <div className="flex justify-between pt-1 border-t">
                    <span className="text-muted-foreground">{isDebt ? "Текущий долг:" : "Баланс:"}</span>
                    <span className={`font-bold ${isDebt ? "text-destructive" : "text-green-600"}`}>
                      {debt.toFixed(2)} ₽
                    </span>
                  </div>
                </div>

                {/* Выбор суммы */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Сумма к оплате (₽)</Label>
                  <Input
                    type="number"
                    min="10"
                    step="10"
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    placeholder="Введите сумму"
                    className="text-lg font-bold font-mono"
                  />

                  {/* Быстрые пресеты */}
                  <div className="grid grid-cols-4 gap-1.5 pt-1">
                    {debt > 0 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-xs h-7 px-1 truncate"
                        onClick={() => setPayAmount(debt.toFixed(2))}
                        title={`Весь долг: ${debt.toFixed(2)} ₽`}
                      >
                        Долг ({debt.toFixed(0)} ₽)
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-xs h-7 px-1"
                      onClick={() => setPayAmount("300")}
                    >
                      300 ₽
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-xs h-7 px-1"
                      onClick={() => setPayAmount("900")}
                    >
                      900 ₽
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-xs h-7 px-1"
                      onClick={() => setPayAmount("1800")}
                    >
                      1800 ₽
                    </Button>
                  </div>
                  {/* Подсказка о возможности внесения авансового платежа */}
                  <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[12px] text-emerald-800 dark:text-emerald-300 flex items-start gap-2">
                    <span className="text-base leading-none select-none">💡</span>
                    <p className="leading-snug">
                      Вы можете оплатить любую большую сумму (например, на несколько месяцев или год вперёд). Она зачислится как переплата на ваш лицевой счёт и будет автоматически списываться каждый месяц в счёт абонентской платы.
                    </p>
                  </div>
                </div>

                {/* Итоговая сумма к оплате ТО */}
                {(() => {
                  const base = parseFloat(payAmount) || 0;
                  return (
                    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs space-y-1.5 text-left">
                      <div className="flex justify-between items-center font-bold text-foreground text-sm">
                        <span>Итого к оплате:</span>
                        <span className="font-mono font-extrabold text-amber-600 dark:text-amber-400 text-base">{base.toFixed(2)} ₽</span>
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 pt-1 leading-snug">
                        💡 Возможна оплата за транзакцию.
                      </p>
                    </div>
                  );
                })()}

                {/* Преимущества и безопасность */}
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border text-[11px] text-muted-foreground space-y-1">
                  <div className="flex items-center gap-1.5 text-foreground font-medium">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                    Защищено стандартами безопасности PCI DSS
                  </div>
                  <p>Оплата зачисляется мгновенно. После завершения платежа вы вернётесь в личный кабинет.</p>
                </div>
              </div>

              <DialogFooter className="flex-col sm:flex-row gap-2">
                <Button
                  variant="outline"
                  onClick={() => setIsYooKassaOpen(false)}
                  disabled={isPayingYooKassa}
                  className="rounded-xl"
                >
                  Отмена
                </Button>
                <Button
                  onClick={handleYooKassaPay}
                  disabled={isPayingYooKassa || !payAmount || parseFloat(payAmount) <= 0}
                  className="rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-white font-bold gap-2"
                >
                  {isPayingYooKassa ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Подготовка...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="h-4 w-4 fill-current" />
                      <span>
                        Оплатить {(() => {
                          const base = parseFloat(payAmount) || 0;
                          const fee = Math.round(base * 0.05 * 100) / 100;
                          return `${(base + fee).toFixed(2)} ₽`;
                        })()}
                      </span>
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Диалог истории онлайн-оплат и чеков для жильца (без лишних реестров) */}
          <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-base font-bold">
                  <Receipt className="h-5 w-5 text-emerald-600" />
                  История платежей и электронные чеки
                </DialogTitle>
                <DialogDescription>
                  Лицевой счёт: <strong className="font-mono text-foreground">{account.account_number}</strong>
                </DialogDescription>
              </DialogHeader>

              {/* Список онлайн-платежей ЮKassa и просмотр чеков */}
              <div className="space-y-3">
                {loadingHistory ? (
                  <div className="py-8 text-center text-xs text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2 text-primary" />
                    Синхронизация и загрузка платежей...
                  </div>
                ) : onlinePayments.length === 0 ? (
                  <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-900 border text-center space-y-1.5">
                    <Receipt className="h-8 w-8 text-muted-foreground mx-auto mb-1 opacity-40" />
                    <p className="text-xs font-semibold text-foreground">Онлайн-платежей пока не зафиксировано</p>
                    <p className="text-[11px] text-muted-foreground max-w-xs mx-auto">
                      После оплаты через кнопку «Быстрая оплата ЮKassa» платежи и официальные электронные чеки сразу отобразятся здесь.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                    {onlinePayments.map((p: any) => {
                      const isSucceeded = p.status === "succeeded";
                      const isPending = p.status === "pending";
                      return (
                        <div
                          key={p.id || p.yookassa_payment_id}
                          className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs hover:border-emerald-500/40 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-foreground font-mono">
                                {Number(p.amount).toFixed(2)} ₽
                              </span>
                              {isSucceeded ? (
                                <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 text-[10px] py-0 font-medium">
                                  <CheckCircle2 className="h-3 w-3 mr-1 text-emerald-600 inline" />
                                  Зачислен
                                </Badge>
                              ) : isPending ? (
                                <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 text-[10px] py-0 font-medium">
                                  <Clock className="h-3 w-3 mr-1 text-amber-600 inline" />
                                  В обработке
                                </Badge>
                              ) : (
                                <Badge variant="destructive" className="text-[10px] py-0 font-medium">
                                  Отменён
                                </Badge>
                              )}
                            </div>
                            <p className="text-[11px] text-muted-foreground">
                              {new Date(p.created_at).toLocaleString("ru-RU", {
                                day: "2-digit",
                                month: "2-digit",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })} • ЮKassa (СБП/Карта)
                            </p>
                            {p.yookassa_payment_id && (
                              <p className="text-[10px] font-mono text-muted-foreground/80 truncate max-w-[260px]">
                                № {p.yookassa_payment_id}
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {isSucceeded && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setSelectedReceipt(p)}
                                className="h-8 px-2.5 text-xs rounded-xl flex items-center gap-1.5 border-emerald-500/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 font-medium"
                              >
                                <Receipt className="h-3.5 w-3.5 text-emerald-600" />
                                <span>Электронный чек</span>
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-800 dark:text-emerald-300 leading-relaxed flex items-start gap-2">
                  <span className="text-sm leading-none select-none">💡</span>
                  <span>
                    Оплаты через защищенный шлюз ЮKassa зачисляются мгновенно. Электронный чек подтверждает успешное списание и зачисление средств на ваш лицевой счёт.
                  </span>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsHistoryOpen(false)} className="rounded-xl">
                  Закрыть
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Диалог просмотра и печати официального электронного чека */}
          <Dialog open={!!selectedReceipt} onOpenChange={(open) => !open && setSelectedReceipt(null)}>
            <DialogContent className="max-w-md print:p-0 print:border-none print:shadow-none">
              <DialogHeader className="print:hidden">
                <DialogTitle className="flex items-center gap-2 text-base font-bold">
                  <Receipt className="h-5 w-5 text-emerald-600" />
                  Электронный чек оплаты
                </DialogTitle>
                <DialogDescription>
                  Официальная квитанция об оплате ТО домофона через платёжный шлюз ЮKassa
                </DialogDescription>
              </DialogHeader>

              {selectedReceipt && (
                <div id="payment-receipt" className="space-y-4 py-2 text-xs">
                  {/* Шапка чека */}
                  <div className="text-center pb-3 border-b border-dashed border-slate-300 dark:border-slate-700">
                    <div className="font-extrabold text-sm uppercase tracking-wider text-foreground">ООО «ДОМОФОНДАР»</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">ИНН: 2311283958 • ОГРН: 1192375010904</div>
                    <div className="text-[10px] text-muted-foreground">г. Краснодар, проезд им. Репина, д. 1, пом. 134 • Тел.: +7 (903) 411-83-93</div>
                    {selectedReceipt.status === "succeeded" ? (
                      <div className="mt-2.5 inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-semibold text-[11px] border border-emerald-500/20">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                        ОПЛАЧЕНО ОНЛАЙН • ЧЕК ПРОВЕДЁН
                      </div>
                    ) : selectedReceipt.status === "pending" ? (
                      <div className="mt-2.5 inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 font-semibold text-[11px] border border-amber-500/20">
                        <Clock className="h-3.5 w-3.5 text-amber-600" />
                        ПЛАТЁЖ В ОБРАБОТКЕ • НЕ ОПЛАЧЕНО
                      </div>
                    ) : (
                      <div className="mt-2.5 inline-flex items-center gap-1 px-3 py-1 rounded-full bg-red-500/10 text-red-700 dark:text-red-400 font-semibold text-[11px] border border-red-500/20">
                        <XCircle className="h-3.5 w-3.5 text-red-600" />
                        ПЛАТЁЖ ОТМЕНЁН • СРЕДСТВА НЕ СПИСАНЫ
                      </div>
                    )}
                  </div>

                  {/* Детали платежа */}
                  <div className="space-y-2 py-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Номер транзакции:</span>
                      <span className="font-mono font-medium text-foreground select-all text-right text-[11px]">
                        {selectedReceipt.yookassa_payment_id || selectedReceipt.id}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Лицевой счёт:</span>
                      <span className="font-mono font-bold text-foreground">
                        {selectedReceipt.account_number || account?.account_number}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Дата и время:</span>
                      <span className="font-medium text-foreground">
                        {new Date(selectedReceipt.created_at).toLocaleString("ru-RU")}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Способ оплаты:</span>
                      <span className="font-medium text-foreground">
                        ЮKassa (Карта / СБП / SberPay)
                      </span>
                    </div>
                    <div className="flex justify-between items-start">
                      <span className="text-muted-foreground shrink-0">Назначение:</span>
                      <span className="font-medium text-foreground text-right max-w-[240px]">
                        {selectedReceipt.description || "Оплата ТО домофона"}
                      </span>
                    </div>
                  </div>

                  {/* Итоговая сумма */}
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex justify-between items-center">
                    <div>
                      <span className="text-[11px] text-muted-foreground block">Сумма платежа:</span>
                      <span className="text-[10px] text-muted-foreground">НДС не облагается (УСН)</span>
                    </div>
                    <span className="text-lg font-black font-mono text-emerald-600 dark:text-emerald-400">
                      {Number(selectedReceipt.amount).toFixed(2)} ₽
                    </span>
                  </div>

                  {/* Подвал чека с защитной отметкой */}
                  <div className="pt-2 text-center text-[10px] text-muted-foreground space-y-1">
                    <p>Платежный оператор: ООО НКО «ЮМани» (лицензия ЦБ РФ № 3510-К)</p>
                    <p>
                      {selectedReceipt.status === "succeeded" 
                        ? "Квитанция сформирована автоматически в ЛК «Домофондар» и подтверждает зачисление средств."
                        : "Данная транзакция не завершена. Официальный чек формируется только после зачисления средств."}
                    </p>
                  </div>
                </div>
              )}

              <DialogFooter className="flex-col sm:flex-row gap-2 pt-2 print:hidden">
                <Button
                  variant="outline"
                  onClick={() => setSelectedReceipt(null)}
                  className="rounded-xl"
                >
                  Закрыть
                </Button>
                <Button
                  onClick={() => window.print()}
                  disabled={selectedReceipt?.status !== "succeeded"}
                  className="rounded-xl bg-primary text-primary-foreground font-semibold flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Printer className="h-4 w-4" />
                  Распечатать чек
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
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
        <ShinyButton className="w-full justify-center rounded-xl" onClick={() => setRequestOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Оставить заявку
        </ShinyButton>
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

// --- КОМПОНЕНТ УДАЛЕННОГО ДОСТУПА К УМНОМУ ДОМОФОНУ ---
const RemoteAccessCard = ({ 
  address, 
  apartment, 
  accountNumber, 
  userId, 
  profile,
  hasLk = false,
  isCabinetPurchased = false,
  onCredentialsLoaded,
  hasSmartIntercom = false,
  entranceNumber,
  onOpenOrderDialog,
  onOpenVerification
}: { 
  address: string; 
  apartment: string; 
  accountNumber?: string; 
  userId?: string; 
  profile?: any;
  hasLk?: boolean;
  isCabinetPurchased?: boolean;
  onCredentialsLoaded?: (cred: any) => void;
  hasSmartIntercom?: boolean;
  entranceNumber?: string | number;
  onOpenOrderDialog?: () => void;
  onOpenVerification?: () => void;
}) => {
  const { toast } = useToast();
  const [cred, setCred] = useState<any | null>(null);
  const [loadingCred, setLoadingCred] = useState(true);
  const [isPassVisible, setIsPassVisible] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  // Локальный стейт доступности умного домофона с поддержкой быстрой прямой проверки
  const [smartIntercomAvailable, setSmartIntercomAvailable] = useState<boolean>(hasSmartIntercom);
  const [detectedEntrance, setDetectedEntrance] = useState<string | number | undefined>(entranceNumber);

  // Синхронизируем локальный стейт при изменении пропсов
  useEffect(() => {
    if (hasSmartIntercom) setSmartIntercomAvailable(true);
    if (entranceNumber) setDetectedEntrance(entranceNumber);
  }, [hasSmartIntercom, entranceNumber]);

  // Формируем чистый адрес без дублирования номера квартиры
  const cleanAddressDisplay = useMemo(() => {
    if (!address) return "";
    // Очищаем адрес от уже имеющегося суффикса квартиры для исключения дублирования
    const baseAddr = address.replace(/,\s*(?:кв\.?|квартира)\s*[а-яa-z0-9-+]+/gi, "").trim();
    return apartment ? `${baseAddr}, кв. ${apartment}` : baseAddr;
  }, [address, apartment]);

  // Загрузка учетных данных умного домофона (логопасов) для данного жильца
  const loadCredentials = async () => {
    if (!address && !accountNumber) {
      setLoadingCred(false);
      return;
    }

    try {
      setLoadingCred(true);
      console.log("[Умный домофон] Поиск логопасов для адреса:", address, "кв:", apartment, "счет:", accountNumber);

      let found: any = null;

      // 1. Сначала ищем по номеру договора / лицевого счета, если он есть
      if (accountNumber) {
        const { data: byAcc, error: errAcc } = await supabase
          .from("intercom_credentials" as any)
          .select("*")
          .eq("account_number", accountNumber)
          .limit(1);

        if (!errAcc && byAcc && byAcc.length > 0) {
          found = byAcc[0];
          console.log("[Умный домофон] Найдена запись по номеру договора:", found);
        }
      }

      // 2. Если по номеру договора не нашли, ищем по нормализованному адресу и номеру квартиры
      if (!found && apartment) {
        const cleanApt = normalizeApartment(apartment);
        const streetPart = normalizeStreet(address);
        const housePart = normalizeHouse(address);

        console.log(`[Умный домофон] Поиск по адресу: улица "${streetPart}", дом "${housePart}", кв "${cleanApt}"`);

        const { data: byAddr, error: errAddr } = await supabase
          .from("intercom_credentials" as any)
          .select("*")
          .eq("apartment", cleanApt)
          .limit(10);

        if (!errAddr && byAddr && byAddr.length > 0) {
          // Ищем среди записей ту, где совпадает улица и дом
          const matched = byAddr.find((item: any) => {
            const itemStreet = normalizeStreet(item.street);
            const itemHouse = normalizeHouse(item.house);
            return (
              (streetPart.includes(itemStreet) || itemStreet.includes(streetPart)) &&
              (housePart.includes(itemHouse) || itemHouse.includes(housePart))
            );
          });

          if (matched) {
            found = matched;
            console.log("[Умный домофон] Найдена запись по совпадению адреса:", found);
          }
        }
      }

      // 3. Прямая онлайн-проверка статуса умного домофона в таблице entrances
      // Если пропс hasSmartIntercom еще не успел обновиться, проверяем напрямую подъезд и дом
      try {
        const { street, house } = parseAddressParts(address);
        const cleanStreetQuery = street.replace(/(?:\b(?:ул\.?|улица)\b|\(ул\))\s*/gi, "").trim();
        
        let ent = entranceNumber;
        if (!ent && address) {
          const m = address.match(/(?:^|,|\s)(?:п|подъезд|под\.?|п\.)\s*(\d+)/i);
          if (m) ent = m[1];
        }

        if (cleanStreetQuery && house) {
          console.log(`[Умный домофон] Прямой запрос к entrances: улица "${cleanStreetQuery}", дом "${house}", подъезд "${ent || 'любой'}"`);
          let q = supabase
            .from("entrances")
            .select("id, entrance, has_smart_intercom")
            .ilike("street", `%${cleanStreetQuery}%`)
            .eq("house", house);

          if (ent) {
            q = q.eq("entrance", ent);
          }

          const { data: entList } = await q;
          if (entList && entList.length > 0) {
            const hasSmart = entList.some((e: any) => e.has_smart_intercom === true);
            if (hasSmart) {
              console.log("[Умный домофон] ✅ Подтверждено наличие умного домофона в таблице entrances");
              setSmartIntercomAvailable(true);
              if (ent) setDetectedEntrance(ent);
            }
          }
        }
      } catch (checkErr) {
        console.warn("[Умный домофон] Не удалось выполнить прямую проверку entrances:", checkErr);
      }

      setCred(found);
      if (onCredentialsLoaded) {
        onCredentialsLoaded(found);
      }
    } catch (err) {
      console.error("[Умный домофон] Ошибка при проверке учетных данных:", err);
    } finally {
      setLoadingCred(false);
    }
  };

  useEffect(() => {
    loadCredentials();
  }, [address, apartment, accountNumber, entranceNumber]);

  // Обработчик покупки доступа к приложению
  const handlePurchaseAccess = async () => {
    if (!cred) return;

    try {
      setIsProcessingPayment(true);
      console.log(`[Умный домофон] Инициализация оплаты удаленного доступа для ID: ${cred.id}`);

      // Вызываем RPC-функцию покупки или обновляем запись
      const { data, error } = await supabase.rpc("purchase_intercom_access", {
        p_credential_id: cred.id,
        p_user_id: userId || null,
        p_amount: 300.00,
      });

      // Обновляем статус в intercom_credentials (is_purchased и has_lk)
      const { error: updErr } = await supabase
        .from("intercom_credentials" as any)
        .update({
          is_purchased: true,
          has_lk: true,
          purchased_at: new Date().toISOString(),
          purchased_by_user_id: userId || null,
          payment_amount: 300.00,
          updated_at: new Date().toISOString(),
        })
        .eq("id", cred.id);

      if (updErr && error) throw updErr;

      // Также синхронизируем флаг has_lk в accounts
      const targetAcc = cred.account_number || accountNumber;
      if (targetAcc) {
        try {
          await supabase
            .from("accounts")
            .update({ has_lk: true, updated_at: new Date().toISOString() })
            .eq("account_number", targetAcc);
        } catch (accErr) {
          console.warn("[Умный домофон] Не удалось обновить has_lk в accounts:", accErr);
        }
      }

      // Создаем запись заявки / чека в таблице requests
      try {
        await supabase.from("requests").insert({
          client_id: userId || null,
          message: `📱 Онлайн-оплата: Услуга «Удалённый доступ к умному домофону» (адрес: ${cleanAddressDisplay}). Договор: ${cred.account_number || "—"}`,
          status: "completed",
          priority: "low",
          payment_status: "paid",
          payment_method: "card_online",
        });
      } catch (reqErr) {
        console.warn("[Умный домофон] Запись в requests не создана (некритично):", reqErr);
      }

      toast({
        title: "Оплата прошла успешно!",
        description: profile?.is_verified 
          ? "Удалённый доступ к умному домофону активирован. Ваши данные для входа отображены ниже."
          : "Оплата 300 ₽ подтверждена. Для отображения пароля подтвердите проживание (пройдите верификацию).",
      });

      setIsPaymentOpen(false);
      // Обновляем локальное состояние
      setCred((prev: any) => {
        const next = prev ? { ...prev, is_purchased: true, has_lk: true } : prev;
        if (onCredentialsLoaded) onCredentialsLoaded(next);
        return next;
      });
    } catch (err: any) {
      console.error("[Умный домофон] Ошибка при проведении оплаты:", err);
      toast({
        title: "Ошибка оплаты",
        description: err.message || "Не удалось завершить транзакцию",
        variant: "destructive",
      });
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const copyText = (txt: string, label: string) => {
    navigator.clipboard.writeText(txt);
    toast({ title: "Скопировано", description: `${label}: ${txt}` });
  };

  if (loadingCred) {
    return (
      <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-amber-500 mr-2" />
        <span className="text-xs text-muted-foreground">Проверка доступности умного домофона...</span>
      </div>
    );
  }

  // СЛУЧАЙ 1: Логопасы еще не загружены для этого адреса/квартиры
  const isSmartAvailable = smartIntercomAvailable || hasSmartIntercom;
  if (!cred) {
    if (isSmartAvailable) {
      // Если личный кабинет уже приобретен (предзаказ на этапе запуска дома)
      if (isCabinetPurchased || hasLk) {
        return (
          <div className="p-4 rounded-2xl border border-emerald-500/30 bg-emerald-50/40 dark:bg-emerald-950/20 flex items-start gap-3.5 text-left animate-in fade-in duration-300">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div className="space-y-1.5 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold text-sm text-foreground">Личный кабинет приобретен</p>
                <Badge className="bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Предзаказ оплачен
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                По вашему адресу ({cleanAddressDisplay}){detectedEntrance ? ` в подъезде №${detectedEntrance}` : ""} подключение личного кабинета оплачено. Учётные записи (логин и пароль) формируются оператором и автоматически отобразятся здесь сразу после запуска системы.
              </p>
            </div>
          </div>
        );
      }

      return (
        <div className="p-4 rounded-2xl border border-indigo-200/80 dark:border-indigo-800/80 bg-indigo-50/40 dark:bg-indigo-950/30 flex items-start gap-3.5">
          <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shrink-0">
            <Smartphone className="h-5 w-5" />
          </div>
          <div className="text-left space-y-1.5 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-sm text-foreground">Умный домофон подключен</p>
              <Badge className="bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-400/30 text-[10px] font-bold">
                📱 На стадии запуска
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              По вашему адресу ({cleanAddressDisplay}){detectedEntrance ? ` в подъезде №${detectedEntrance}` : ""} установлен умный домофон. Учётные записи (логин и пароль) формируются оператором.
            </p>
            <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-900 dark:text-indigo-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span>
                💡 Вы можете заблаговременно оформить подключение личного кабинета (300 ₽). Доступ активируется автоматически после загрузки базы.
              </span>
              {onOpenOrderDialog && (
                <Button 
                  size="sm" 
                  onClick={onOpenOrderDialog}
                  className="rounded-xl h-8 px-3 text-xs font-bold btn-premium-gold shrink-0 self-start sm:self-auto"
                >
                  Купить ЛК (300 ₽) ➔
                </Button>
              )}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40 flex items-start gap-3.5">
        <div className="p-2.5 rounded-xl bg-slate-500/10 text-slate-600 dark:text-slate-400 shrink-0">
          <Smartphone className="h-5 w-5" />
        </div>
        <div className="text-left space-y-1">
          <p className="font-semibold text-sm text-foreground">Удалённый доступ к домофону</p>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            По вашему адресу ({cleanAddressDisplay}) отсутствует умный домофон. Если хотите установить на ваш дом умную систему, обратитесь к нам в офис.
          </p>
        </div>
      </div>
    );
  }

  // СЛУЧАЙ 2: Услуга ОПЛАЧЕНА или ВКЛЮЧЕНА В ТАРИФ (is_purchased = true или has_lk = true)
  const isUnlocked = !!(cred.is_purchased || cred.has_lk || hasLk || isCabinetPurchased);
  const isFromTariff = !!(cred.has_lk || hasLk);

  if (isUnlocked) {
    const isVerified = !!profile?.is_verified;
    const vStatus = profile?.verification_status || (isVerified ? "verified" : "unverified");

    return (
      <div className={`p-5 rounded-2xl border ${isVerified ? "border-emerald-500/40 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent" : "border-amber-500/40 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent"} shadow-sm space-y-4 text-left`}>
        {/* Шапка со статусом */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${isVerified ? "bg-emerald-500" : "bg-amber-500"} text-white shrink-0 shadow-sm`}>
              <Smartphone className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-bold text-sm text-foreground">
                  {isVerified ? "Удалённый доступ активен" : isFromTariff ? "Удалённый доступ включен в тариф" : "Удалённый доступ оплачен"}
                </p>
                {isFromTariff ? (
                  <Badge className="bg-emerald-600 text-white text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Подключено (по тарифу)
                  </Badge>
                ) : (
                  <Badge className="bg-emerald-600 text-white text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Оплата подтверждена
                  </Badge>
                )}
                {isVerified ? (
                  <Badge className="bg-emerald-600 text-white text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" />
                    Верифицирован
                  </Badge>
                ) : (
                  <Badge className="bg-amber-600 text-white text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Lock className="h-3 w-3" />
                    Требуется верификация
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Квартира № {cred.apartment} • Приложение «Мой умный дом»
              </p>
            </div>
          </div>
        </div>

        {/* Информационный баннер при отсутствии верификации */}
        {!isVerified && (
          <div className="p-3.5 rounded-xl border border-amber-300/60 dark:border-amber-700/50 bg-amber-500/10 dark:bg-amber-950/20 text-xs space-y-2">
            <div className="flex items-start gap-2.5">
              {vStatus === "pending" ? (
                <Clock className="h-4 w-4 text-amber-600 shrink-0 mt-0.5 animate-pulse" />
              ) : vStatus === "rejected" ? (
                <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              ) : (
                <ShieldCheck className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              )}
              <div className="space-y-1">
                <p className="font-semibold text-foreground">
                  {vStatus === "pending"
                    ? "⏳ Документы на проверке у диспетчера"
                    : vStatus === "rejected"
                    ? "⚠️ Заявка на верификацию отклонена"
                    : "🔒 Подтвердите проживание для получения доступа"}
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  {vStatus === "pending"
                    ? "Вы успешно оплатили доступ. Диспетчер проверяет предоставленные документы. Логин и пароль от домофона откроются автоматически сразу после одобрения."
                    : vStatus === "rejected"
                    ? `Причина отклонения: ${profile?.verification_reject_reason || "Документ не соответствует требованиям"}. Пожалуйста, загрузите подтверждающий документ повторно.`
                    : "Оплата доступа зафиксирована. В целях безопасности жильцов данные доступа к домофону (логин и пароль) предоставляются только после проверки подтверждающего документа (выписка ЕГРН, паспорт с постоянной или временной регистрацией, либо официальный договор найма)."}
                </p>
              </div>
            </div>

            {vStatus !== "pending" && onOpenVerification && (
              <div className="pt-1 flex justify-end">
                <ShinyButton
                  onClick={onOpenVerification}
                  className="px-4 py-1.5 h-8 text-xs rounded-xl flex items-center gap-1.5 font-semibold"
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  {vStatus === "rejected" ? "Загрузить документ повторно" : "Пройти верификацию"}
                </ShinyButton>
              </div>
            )}
          </div>
        )}

        {/* Карточки с логином и паролем для быстрого копирования */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
          {/* Логин (скрыт до прохождения верификации) */}
          <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-900/60 flex items-center justify-between shadow-xs">
            <div>
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
                Логин для входа
              </span>
              <span className="font-mono font-bold text-sm text-foreground">
                {isVerified ? (cred.account_number || "—") : "••••••••••"}
              </span>
            </div>
            {isVerified ? (
              cred.account_number && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyText(cred.account_number, "Логин")}
                  className="h-8 px-2 text-xs text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-lg"
                  title="Скопировать логин"
                >
                  <Copy className="h-3.5 w-3.5 mr-1" />
                  Копировать
                </Button>
              )
            ) : (
              <div className="flex items-center gap-1 text-muted-foreground text-xs">
                <Lock className="h-3.5 w-3.5 text-amber-500 mr-1" />
                <span className="text-[11px]">Нужна верификация</span>
              </div>
            )}
          </div>

          {/* Пароль */}
          <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-900/60 flex items-center justify-between shadow-xs">
            <div>
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
                Пароль для входа
              </span>
              <span className="font-mono font-bold text-sm text-foreground">
                {isVerified ? (isPassVisible ? cred.password : "••••••••••") : "••••••••••"}
              </span>
            </div>
            {isVerified ? (
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsPassVisible(!isPassVisible)}
                  className="h-8 px-2 text-xs text-slate-500 rounded-lg"
                  title={isPassVisible ? "Скрыть" : "Показать"}
                >
                  {isPassVisible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyText(cred.password, "Пароль")}
                  className="h-8 px-2 text-xs text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-lg"
                  title="Скопировать пароль"
                >
                  <Copy className="h-3.5 w-3.5 mr-1" />
                  Копировать
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-1 text-muted-foreground text-xs">
                <Lock className="h-3.5 w-3.5 text-amber-500 mr-1" />
                <span className="text-[11px]">Нужна верификация</span>
              </div>
            )}
          </div>
        </div>

        {/* Кнопка скопировать все данные доступа сразу (только при верификации) */}
        {isVerified && (
          <div className="pt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const fullMsg = 
`Мой умный дом (кв. ${cred.apartment})
🔑 Логин: ${cred.account_number || "—"}
🔒 Пароль: ${cred.password}

Скачать приложение:
• Google Play: https://play.google.com/store/apps/details?id=ru.ufanet.smarthome
• App Store: https://apps.apple.com/ru/app/мой-умный-дом/id1450280459
• RuStore: https://www.rustore.ru/catalog/app/ru.ufanet.smarthome`;
                copyText(fullMsg, "Данные для входа со ссылками");
              }}
              className="w-full h-8 text-xs bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 rounded-xl font-semibold flex items-center justify-center gap-1.5"
            >
              <Copy className="h-3.5 w-3.5" />
              <span>Скопировать логин, пароль и ссылки на приложение</span>
            </Button>
          </div>
        )}

        {/* Ссылки на официальные маркеты приложений для смартфонов */}
        <div className="pt-2 border-t border-emerald-200/50 dark:border-emerald-900/30">
          <p className="text-xs font-semibold text-foreground mb-2">
            Установите приложение «Мой умный дом» на ваш смартфон:
          </p>
          <div className="grid grid-cols-3 gap-2">
            <a
              href="https://play.google.com/store/apps/details?id=ru.ufanet.smarthome"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-500 transition-colors text-xs font-medium text-foreground shadow-2xs"
            >
              <Smartphone className="h-3.5 w-3.5 text-emerald-600" />
              <span>Google Play</span>
            </a>

            <a
              href="https://apps.apple.com/ru/app/%D0%BC%D0%BE%D0%B9-%D1%83%D0%BC%D0%BD%D1%8B%D0%B9-%D0%B4%D0%BE%D0%BC/id1450280459"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-500 transition-colors text-xs font-medium text-foreground shadow-2xs"
            >
              <Smartphone className="h-3.5 w-3.5 text-emerald-600" />
              <span>App Store</span>
            </a>

            <a
              href="https://www.rustore.ru/catalog/app/ru.ufanet.smarthome"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-500 transition-colors text-xs font-medium text-foreground shadow-2xs"
            >
              <Smartphone className="h-3.5 w-3.5 text-emerald-600" />
              <span>RuStore</span>
            </a>
          </div>
        </div>

        {/* Раскрывающаяся инструкция прямо на нашем сайте (без ухода на внешние сайты) */}
        <div className="pt-2">
          <button
            onClick={() => setShowInstructions(!showInstructions)}
            className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:underline flex items-center gap-1"
          >
            <Info className="h-3.5 w-3.5" />
            {showInstructions ? "Скрыть инструкцию по входу" : "Инструкция: как войти в приложение"}
          </button>

          {showInstructions && (
            <div className="mt-2 p-3.5 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-emerald-100 dark:border-emerald-900/40 text-xs text-slate-700 dark:text-slate-300 space-y-2 leading-relaxed">
              <p className="font-semibold text-foreground">Пошаговое руководство:</p>
              <ol className="list-decimal pl-4 space-y-1.5">
                <li>
                  Установите приложение <strong>«Мой умный дом»</strong> из Google Play, App Store или RuStore по кнопкам выше.
                </li>
                <li>
                  Откройте приложение на телефоне и нажмите кнопку <strong>«Войти по номеру договора/логину»</strong>.
                </li>
                <li>
                  В поле логина укажите ваш логин:{" "}
                  {isVerified ? (
                    <span className="font-mono font-bold text-foreground">{cred.account_number}</span>
                  ) : (
                    <span className="font-mono text-muted-foreground font-semibold">•••••••••• (будет доступен после верификации)</span>
                  )}.
                </li>
                <li>
                  В поле пароля укажите ваш пароль из карточки выше (доступен после подтверждения верификации).
                </li>
                <li>
                  Разрешите приложению доступ к уведомлениям и микрофону, чтобы принимать видеозвонки с панели домофона на смартфон.
                </li>
                <li>
                  Готово! Теперь вы можете открывать дверь подъезда нажатием одной кнопки в телефоне и просматривать видеокамеру в реальном времени.
                </li>
              </ol>
            </div>
          )}
        </div>
      </div>
    );
  }

  // СЛУЧАЙ 3: Логопас есть, но еще НЕ оплачен — яркая карточка с предложением купить услугу
  return (
    <div className="p-5 rounded-2xl border border-amber-500/40 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent shadow-sm text-left space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500 text-white shrink-0 shadow-sm">
            <Smartphone className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-bold text-sm text-foreground">Удалённый доступ к домофону</p>
              <Badge className="bg-amber-500 text-white text-[10px] px-2 py-0.5 rounded-full">
                Доступен к подключению
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Для вашей квартиры № {cred.apartment} сформированы ключи доступа в мобильное приложение «Мой умный дом».
            </p>
          </div>
        </div>
      </div>

      <ul className="space-y-2 text-xs text-slate-700 dark:text-slate-300">
        <li className="flex items-center gap-2">
          <DoorOpen className="h-4 w-4 text-amber-500 shrink-0" />
          <span>Открывайте дверь подъезда со смартфона без ключей</span>
        </li>
        <li className="flex items-center gap-2">
          <PhoneCall className="h-4 w-4 text-amber-500 shrink-0" />
          <span>Принимайте видеовызовы с домофона прямо на мобильный телефон</span>
        </li>
        <li className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-amber-500 shrink-0" />
          <span>Просматривайте онлайн-камеру домофона и архив посетителей</span>
        </li>
      </ul>

      {/* Статус готовности к верификации */}
      <div className="p-3 rounded-xl bg-slate-50/70 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 text-xs flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {profile?.is_verified ? (
            <>
              <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
              <span className="text-muted-foreground">Профиль верифицирован. Доступ откроется сразу после оплаты.</span>
            </>
          ) : profile?.verification_status === "pending" ? (
            <>
              <Clock className="h-4 w-4 text-amber-500 shrink-0 animate-pulse" />
              <span className="text-muted-foreground">Документы на проверке. Пароль откроется после подтверждения и оплаты.</span>
            </>
          ) : (
            <>
              <ShieldCheck className="h-4 w-4 text-amber-500 shrink-0" />
              <span className="text-muted-foreground">Для выдачи пароля также потребуется подтвердить проживание.</span>
            </>
          )}
        </div>
        {!profile?.is_verified && profile?.verification_status !== "pending" && onOpenVerification && (
          <button
            onClick={onOpenVerification}
            className="text-xs text-amber-600 dark:text-amber-400 font-semibold hover:underline shrink-0"
          >
            Подтвердить →
          </button>
        )}
      </div>

      <div className="pt-2 border-t border-amber-200/50 dark:border-amber-900/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <span className="text-[11px] text-muted-foreground block">Стоимость подключения:</span>
          <span className="text-lg font-bold text-foreground font-display">
            300.00 ₽ <span className="text-xs font-normal text-muted-foreground">(единоразово)</span>
          </span>
        </div>

        <ShinyButton
          onClick={() => setIsPaymentOpen(true)}
          className="w-full sm:w-auto px-5 py-2.5 rounded-xl h-10 flex items-center justify-center gap-2 font-bold"
        >
          <CreditCard className="h-4 w-4" />
          <span>Оплатить и получить доступ</span>
        </ShinyButton>
      </div>

      {/* Диалог онлайн-оплаты удаленного доступа */}
      <Dialog open={isPaymentOpen} onOpenChange={setIsPaymentOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <CreditCard className="h-5 w-5 text-amber-500" />
              Оплата удалённого доступа
            </DialogTitle>
            <DialogDescription>
              Подключение мобильного приложения «Мой умный дом» для {cleanAddressDisplay}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-3 text-sm">
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Услуга:</span>
                <span className="font-semibold text-foreground">Удалённый доступ к домофону</span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Адрес:</span>
                <span className="text-foreground">{cleanAddressDisplay}</span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Номер договора:</span>
                <span className="font-mono text-foreground">{cred.account_number || "Формируется"}</span>
              </div>
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex justify-between font-bold text-base text-foreground">
                <span>Итого к оплате:</span>
                <span className="text-amber-500">300.00 ₽</span>
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground text-center">
              После подтверждения оплаты ваши логин и пароль сразу отобразятся в личном кабинете вместе со ссылками на скачивание приложения.
            </p>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsPaymentOpen(false)} className="rounded-xl">
              Отмена
            </Button>
            <Button
              onClick={handlePurchaseAccess}
              disabled={isProcessingPayment}
              className="bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold flex items-center gap-1.5"
            >
              {isProcessingPayment ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Обработка платежа...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  Оплатить 300.00 ₽
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
  // Проверяем права пользователя: администратор, директор, сотрудник FSM
  const { isFSMUser, isAdmin } = useUserRole();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [apartment, setApartment] = useState("");
  const [floor, setFloor] = useState("");
  const [entrance, setEntrance] = useState(""); // Выбранный или введённый подъезд
  const [entranceSuggestions, setEntranceSuggestions] = useState<string[]>([]); // Доступные подъезды в доме
  const [showEntranceSuggestions, setShowEntranceSuggestions] = useState(false); // Показ списка подъездов
  const [houseAccounts, setHouseAccounts] = useState<any[]>([]); // Кэш лицевых счетов выбранного дома для фильтрации квартир по подъездам
  const [email, setEmail] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [emailVerified, setEmailVerified] = useState(false);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [isVerificationDialogOpen, setIsVerificationDialogOpen] = useState(false);

  // --- НОВЫЕ СТЕЙТЫ: ТИП ПОМЕЩЕНИЯ, СОГЛАСИЕ ФЗ-152, ДИАЛОГ ВАЛИДАЦИИ И DaData ---
  const [premiseType, setPremiseType] = useState<"apartment" | "private">("apartment"); // Тип недвижимости: apartment (кв./офис) vs private (частный дом)
  const [agreedToTerms, setAgreedToTerms] = useState(true); // Согласие по ФЗ-152 РФ (по умолчанию включено)
  const [legalModalOpen, setLegalModalOpen] = useState(false); // Модалка документов 152-ФЗ
  const [legalDocId, setLegalDocId] = useState<"privacy-policy" | "data-consent" | "public-offer">("data-consent"); // Выбранный документ

  const openLegalDoc = (docId: "privacy-policy" | "data-consent" | "public-offer") => {
    console.log(`[Cabinet] Открытие документа: ${docId}`);
    setLegalDocId(docId);
    setLegalModalOpen(true);
  };

  const [showValidationDialog, setShowValidationDialog] = useState(false); // Красивая модалка для ошибок
  const [validationErrors, setValidationErrors] = useState<string[]>([]); // Массив текстов незаполненных граф
  const [dadataStreetSuggestions, setDadataStreetSuggestions] = useState<any[]>([]); // Подсказки улиц от DaData
  const [dadataHouseSuggestions, setDadataHouseSuggestions] = useState<any[]>([]); // Подсказки домов от DaData

  // Стейты контактных полей внутри диалога заявки
  const [orderName, setOrderName] = useState("");
  const [orderPhone, setOrderPhone] = useState("");
  const [orderStreet, setOrderStreet] = useState("");
  const [orderHouse, setOrderHouse] = useState("");
  const [orderEntrance, setOrderEntrance] = useState("1"); // Номер подъезда для точной привязки оборудования
  const [orderApartment, setOrderApartment] = useState("");
  const [orderPremiseType, setOrderPremiseType] = useState<"apartment" | "private">("apartment");
  const [allEntrances, setAllEntrances] = useState<any[]>([]); // Кэш подъездов из БД
  const [productBindings, setProductBindings] = useState<Record<string, string[]>>({}); // product_id -> entrance_id[]
  const [entrancePricingMap, setEntrancePricingMap] = useState<Record<string, Record<string, { price_type: string; custom_price: number | null }>>>({}); // entrance_id -> product_id -> pricing
  
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

  // --- СТЕЙТЫ ДЛЯ ПОИСКА ПО ЛИЦЕВОМУ СЧЁТУ ---
  const [accountSearchInput, setAccountSearchInput] = useState(""); // Введённый пользователем лицевой счёт
  const [accountSearchLoading, setAccountSearchLoading] = useState(false); // Индикатор загрузки при поиске по л/с
  const [accountSearchError, setAccountSearchError] = useState<string | null>(null); // Текст ошибки если л/с не найден
  const [accountSearchFound, setAccountSearchFound] = useState(false); // Флаг: счёт успешно найден и адрес подставлен
  
  // --- СТЕЙТЫ ДЛЯ АВТОПОИСКА АБОНЕНТА ПО НОМЕРУ ТЕЛЕФОНА И ПРИВЕТСТВИЯ ---
  const [showPhoneWelcomeDialog, setShowPhoneWelcomeDialog] = useState(false); // Флаг показа приветственного окна
  const [matchedSubscriberData, setMatchedSubscriberData] = useState<any>(null); // Данные найденного по телефону абонента
  const [welcomeFullName, setWelcomeFullName] = useState(""); // ФИО для подтверждения в диалоговом окне
  const [savingWelcomeData, setSavingWelcomeData] = useState(false); // Индикатор сохранения данных из всплывающего окна
  const [hasSearchedPhoneOnce, setHasSearchedPhoneOnce] = useState(false); // Флаг однократного поиска при загрузке

  const [isVisible, setIsVisible] = useState({
    header: false,
    content: false
  });
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Глобальные переменные и утилиты, вынесенные ниже объявлений всех стейтов для предотвращения ReferenceError (temporal dead zone)
  const { toast } = useToast();
  const queryClient = useQueryClient();


  const hasAdminConsoleAccess = userRoles.some((role) => ["admin", "director"].includes(role));
  const isLocked = !!profile?.is_verified && !editing;
  const [isConfirmChangeDialogOpen, setIsConfirmChangeDialogOpen] = useState(false); // Открытие диалога подтверждения перед редактированием профиля

  // --- СТЕЙТЫ ДЛЯ ФОРМЫ ЗАКАЗА УСЛУГ И ОБОРУДОВАНИЯ ---
  const [products, setProducts] = useState<any[]>([]); // Для товаров и услуг
  const [previewImage, setPreviewImage] = useState<string | null>(null); // Все товары и услуги из БД
  const [isOrderDialogOpen, setIsOrderDialogOpen] = useState(false); // Открытие диалога заказа
  const [orderType, setOrderType] = useState<"repair" | "order">("repair"); // Тип обращения: неисправность или заказ
  const [repairProblem, setRepairProblem] = useState(""); // Текст проблемы для бесплатной заявки
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null); // Выбранная услуга
  const [selectedEquipments, setSelectedEquipments] = useState<{ [id: string]: number }>({}); // Выбранное оборудование и количество (для обратной совместимости)
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string | null>(null); // Выбранная трубка (строго 1 шт на квартиру)
  const [selectedKeyProductId, setSelectedKeyProductId] = useState<string | null>(null); // Жестко привязанный ID ключа подъезда (UUID)
  const [hasEntranceCredentials, setHasEntranceCredentials] = useState(false); // Загружены ли логопасы для подъезда
  const [keysQuantity, setKeysQuantity] = useState(0); // Количество дополнительных ключей
  const [isCabinetSetupChecked, setIsCabinetSetupChecked] = useState(false); // Выбран ли чекбокс настройки ЛК
  const [orderComment, setOrderComment] = useState(""); // Комментарий к платному заказу
  const [isSuccessPaymentOpen, setIsSuccessPaymentOpen] = useState(false); // Открытие окна с подтверждением перехода к оплате
  const [lastCreatedRequestId, setLastCreatedRequestId] = useState<string | null>(null); // ID созданной заявки для оплаты
  const [lastOrderTotals, setLastOrderTotals] = useState<any>(null); // Рассчитанные суммы платежа для передачи в шлюз
  const [userAccount, setUserAccount] = useState<any>(null); // Лицевой счет пользователя, проброшенный из карточки баланса
  const [apartmentIntercomCred, setApartmentIntercomCred] = useState<any | null>(null); // Загруженные учетные данные умного домофона для квартиры
  const equipmentSectionRef = useRef<HTMLDivElement>(null); // Ссылка на блок выбора трубок для плавного автоскролла

  // Загрузка активных товаров и услуг из БД, а также привязок оборудования к подъездам
  const loadProducts = async () => {
    console.log("[Заказ] Загрузка списка товаров, услуг и привязок к подъездам...");
    try {
      const [prodRes, bindingsRes, entrancesRes] = await Promise.all([
        supabase.from("products").select("*").eq("is_active", true),
        supabase.from("entrance_products" as any).select("product_id, entrance_id, price_type, custom_price"),
        supabase.from("entrances" as any).select("id, city, street, house, entrance, intercom_type, service_type, has_smart_intercom")
      ]);

      if (prodRes.error) throw prodRes.error;

      if (prodRes.data) {
        setProducts(prodRes.data);
        console.log(`[Заказ] Успешно загружено товаров и услуг: ${prodRes.data.length}`);
      }

      if (bindingsRes.data) {
        // Карта: product_id -> entrance_id[] и entrance_id -> product_id -> pricing
        const pMap: Record<string, string[]> = {};
        const prMap: Record<string, Record<string, { price_type: string; custom_price: number | null }>> = {};

        bindingsRes.data.forEach((b: any) => {
          if (!pMap[b.product_id]) pMap[b.product_id] = [];
          pMap[b.product_id].push(b.entrance_id);

          if (!prMap[b.entrance_id]) prMap[b.entrance_id] = {};
          prMap[b.entrance_id][b.product_id] = {
            price_type: b.price_type || "retail",
            custom_price: b.custom_price != null ? Number(b.custom_price) : null,
          };
        });
        setProductBindings(pMap);
        setEntrancePricingMap(prMap);
        console.log(`[Заказ] Загружено связей товаров с подъездами: ${bindingsRes.data.length}`);
      }

      if (entrancesRes.data) {
        setAllEntrances(entrancesRes.data);
      }
    } catch (err) {
      console.error("[Заказ] Ошибка загрузки списка продуктов и подъездов:", err);
    }
  };

  // Определение соответствующего подъезда жителя для показа совместимого оборудования
  const currentMatchedEntrance = useMemo(() => {
    // 1. Извлекаем эффективную улицу, дом и подъезд из стейта формы или профиля жильца
    let effStreet = orderStreet || displayStreet || "";
    let effHouse = orderHouse || displayHouse || "";
    let effEntrance = orderEntrance || entrance || userAccount?.entrance || profile?.entrance || "";

    // Фоллбек: если поля формы пусты, извлекаем напрямую из адреса договора или профиля
    const rawAddress = userAccount?.address || profile?.address || address || "";
    if ((!effStreet || !effHouse) && rawAddress) {
      const parts = rawAddress.split(",");
      if (parts.length >= 3) {
        if (!effStreet) effStreet = parts[1].trim();
        if (!effHouse) effHouse = extractHousePartFromCacheAddr(rawAddress);
      }
    }
    if (!effEntrance && rawAddress) {
      const entMatch = rawAddress.match(/(?:^|,|\s)(?:п|подъезд|под\.?|п\.)\s*(\d+)/i);
      if (entMatch) effEntrance = entMatch[1];
    }

    if (!effStreet || !effHouse || !allEntrances.length) return null;

    // Вспомогательная функция нормализации улицы (убираем приставки ул, пер, пос, скобки и спецсимволы)
    const normalizeStreetName = (str: string) => {
      return str
        .toLowerCase()
        .replace(/\b(ул|улица|пер|переулок|проезд|пр-кт|проспект|туп|тупик|бульвар|б-р|пос|поселок|п)\b/gi, "")
        .replace(/[^а-яa-z0-9]/gi, "");
    };

    const cleanStreet = normalizeStreetName(effStreet);
    const cleanHouse = effHouse.toLowerCase().replace(/[^а-яa-z0-9]/gi, "").replace(/^д/, "");
    const cleanEnt = effEntrance ? String(effEntrance).replace(/[^0-9]/g, "") : "";

    // 1. Попытка точного совпадения: улица + дом + подъезд (если подъезд известен)
    if (cleanEnt) {
      const exactMatch = allEntrances.find(e => {
        const eStreet = normalizeStreetName(e.street);
        const eHouse = e.house.toLowerCase().replace(/[^а-яa-z0-9]/gi, "").replace(/^д/, "");
        const eEnt = String(e.entrance).replace(/[^0-9]/g, "");

        const streetMatch = eStreet.includes(cleanStreet) || cleanStreet.includes(eStreet);
        const houseMatch = eHouse === cleanHouse;
        const entMatch = eEnt === cleanEnt;

        return streetMatch && houseMatch && entMatch;
      });

      if (exactMatch) {
        console.log(`[Cabinet] Точно определен подъезд: ${exactMatch.street}, д. ${exactMatch.house}, п. ${exactMatch.entrance} (ID: ${exactMatch.id}, Умный дом: ${exactMatch.has_smart_intercom})`);
        return exactMatch;
      }
    }

    // 2. Если точный подъезд не найден или не указан, но дом есть в базе:
    // Ищем подъезд этого дома, отдавая приоритет подъезду с умным домофоном или привязанными товарами
    const houseMatches = allEntrances.filter(e => {
      const eStreet = normalizeStreetName(e.street);
      const eHouse = e.house.toLowerCase().replace(/[^а-яa-z0-9]/gi, "").replace(/^д/, "");
      return (eStreet.includes(cleanStreet) || cleanStreet.includes(eStreet)) && eHouse === cleanHouse;
    });

    if (houseMatches.length > 0) {
      const withSmart = houseMatches.find(e => e.has_smart_intercom === true);
      const withBindings = houseMatches.find(e => 
        Object.values(productBindings).some(eIds => eIds && eIds.includes(e.id))
      );
      const chosen = withSmart || withBindings || houseMatches[0];
      console.log(`[Cabinet] Подъезд подобран по дому: ${chosen.street}, д. ${chosen.house}, п. ${chosen.entrance} (ID: ${chosen.id}, Умный дом: ${chosen.has_smart_intercom})`);
      return chosen;
    }

    return null;
  }, [orderStreet, displayStreet, orderHouse, displayHouse, orderEntrance, entrance, userAccount, profile, address, allEntrances, productBindings]);

  // Список товаров, доступных для текущего подъезда (СТРОГАЯ изоляция: ТОЛЬКО привязанные товары)
  const availableProducts = useMemo(() => {
    if (!products || products.length === 0) return [];

    // Если подъезд абонента успешно определен
    if (currentMatchedEntrance) {
      // Собираем множество ID товаров, которые оператор привязал конкретно к этому подъезду
      const boundToThisEntrance = new Set<string>();
      Object.entries(productBindings).forEach(([prodId, entranceIds]) => {
        if (entranceIds && entranceIds.includes(currentMatchedEntrance.id)) {
          boundToThisEntrance.add(prodId);
        }
      });

      // ЕСЛИ К ПОДЪЕЗДУ ПРИВЯЗАНО ОБОРУДОВАНИЕ ИЛИ УСЛУГИ:
      // Возвращаем СТРОГО И ТОЛЬКО позиции, привязанные оператором к данному подъезду!
      if (boundToThisEntrance.size > 0) {
        console.log(`[Cabinet] Для подъезда ${currentMatchedEntrance.street}, д. ${currentMatchedEntrance.house}, п. ${currentMatchedEntrance.entrance} найдено ${boundToThisEntrance.size} привязанных позиций.`);
        return products.filter(product => boundToThisEntrance.has(product.id));
      }
    }

    // Если к подъезду ничего не привязано или подъезд ещё не определен — возвращаем ПУСТОЙ массив!
    // Никаких «универсальных» непривязанных товаров жильцам не показывается.
    console.log("[Cabinet] К данному подъезду оператор пока не привязал оборудование. Выдача пуста.");
    return [];
  }, [products, productBindings, currentMatchedEntrance]);

  // Проверка наличия загруженных логопасов (учетных записей) для текущего подъезда
  useEffect(() => {
    const checkEntranceCredentials = async () => {
      if (!currentMatchedEntrance) {
        setHasEntranceCredentials(false);
        return;
      }
      try {
        console.log(`[Cabinet] Проверка наличия логопасов для подъезда: ${currentMatchedEntrance.street}, д. ${currentMatchedEntrance.house}, п. ${currentMatchedEntrance.entrance}`);
        
        // 1. Проверяем по entrance_id
        const { count, error } = await supabase
          .from("intercom_credentials" as any)
          .select("id", { count: "exact", head: true })
          .eq("entrance_id", currentMatchedEntrance.id);

        if (!error && count && count > 0) {
          console.log(`[Cabinet] Для подъезда найдено ${count} логопасов по entrance_id`);
          setHasEntranceCredentials(true);
          return;
        }

        // 2. Резервная проверка по улице, дому и подъезду
        const cleanStreetPart = currentMatchedEntrance.street.replace(/\b(ул|улица|пос|п|пер)\b/gi, "").trim();
        const { count: countByAddr } = await supabase
          .from("intercom_credentials" as any)
          .select("id", { count: "exact", head: true })
          .ilike("street", `%${cleanStreetPart}%`)
          .eq("house", currentMatchedEntrance.house)
          .eq("entrance", currentMatchedEntrance.entrance);

        const hasAny = !!(countByAddr && countByAddr > 0);
        console.log(`[Cabinet] Результат проверки логопасов по адресу: ${hasAny} (найдено: ${countByAddr || 0})`);
        setHasEntranceCredentials(hasAny);
      } catch (err) {
        console.error("[Cabinet] Ошибка при проверке логопасов подъезда:", err);
        setHasEntranceCredentials(false);
      }
    };

    checkEntranceCredentials();
  }, [currentMatchedEntrance]);

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

  // =================================================================
  // ПОИСК ПО ЛИЦЕВОМУ СЧЁТУ
  // Нормализует ввод (например, "654" → "0000000654") и ищет
  // соответствующий адрес в таблице accounts. После нахождения
  // автоматически заполняет поля улицы, дома и квартиры.
  // =================================================================
  const searchByAccountNumber = async () => {
    const rawInput = accountSearchInput.trim();
    if (!rawInput) {
      console.log("[Л/С Поиск] Поле лицевого счёта пустое");
      return;
    }

    setAccountSearchLoading(true);
    setAccountSearchError(null);
    setAccountSearchFound(false);

    // Нормализуем лицевой счёт: убираем лишние символы, дополняем нулями до 10 знаков слева
    // Пример: "654" → "0000000654", "0000000654" → "0000000654"
    const digitsOnly = rawInput.replace(/\D/g, ""); // Оставляем только цифры
    const paddedAccount = digitsOnly.padStart(10, "0"); // Дополняем нулями до 10 цифр

    console.log(`[Л/С Поиск] Ввод: "${rawInput}" → нормализован до: "${paddedAccount}"`);

    try {
      // Ищем в базе сначала точное совпадение (с нулями)
      let { data, error } = await supabase
        .from("accounts")
        .select("account_number, address, apartment, debt_amount, period")
        .eq("account_number", paddedAccount)
        .order("period", { ascending: false })
        .limit(1);

      // Если не нашли с нулями — ищем без нулей (на случай нестандартного формата в БД)
      if ((!data || data.length === 0) && !error) {
        console.log(`[Л/С Поиск] Не найден с нулями, пробуем без: "${rawInput}"`);
        const result = await supabase
          .from("accounts")
          .select("account_number, address, apartment, debt_amount, period")
          .eq("account_number", rawInput)
          .order("period", { ascending: false })
          .limit(1);
        data = result.data;
        error = result.error;
      }

      // Дополнительный поиск: ilike для частичного совпадения (если нужно)
      if ((!data || data.length === 0) && !error) {
        console.log(`[Л/С Поиск] Точный поиск не дал результатов, пробуем ilike...`);
        const result = await supabase
          .from("accounts")
          .select("account_number, address, apartment, debt_amount, period")
          .ilike("account_number", `%${digitsOnly}%`)
          .order("period", { ascending: false })
          .limit(1);
        data = result.data;
        error = result.error;
      }

      if (error) throw error;

      if (data && data.length > 0) {
        const found = data[0];
        console.log(`[Л/С Поиск] ✅ Найден лицевой счёт: ${found.account_number}, адрес: ${found.address}, квартира: ${found.apartment}`);

        // Автоматически подставляем адрес из найденного счёта
        setAddress(found.address || "");
        
        // Надежно определяем квартиру: если в специальном поле apartment пусто, 
        // пробуем распарсить её из строки полного адреса (например, "..., кв. 15")
        const apt = found.apartment?.trim() || extractApartmentFromAddress(found.address || "");
        setApartment(apt);
        
        parseAndSetAddress(found.address || "");

        // Загружаем список квартир для найденного дома
        if (found.address) {
          fetchApartmentSuggestions(found.address);
        }

        setAccountSearchFound(true);
        setAccountSearchError(null);

        toast({
          title: "✅ Лицевой счёт найден!",
          description: `Адрес заполнен автоматически. Счёт: ${found.account_number}`,
        });
      } else {
        // Счёт не найден — показываем понятное сообщение
        console.log(`[Л/С Поиск] ❌ Лицевой счёт "${paddedAccount}" не найден в базе`);
        setAccountSearchError(
          `Лицевой счёт «${paddedAccount}» не найден. Проверьте правильность ввода или заполните адрес вручную.`
        );
        setAccountSearchFound(false);
      }
    } catch (err: any) {
      console.error("[Л/С Поиск] Ошибка поиска лицевого счёта:", err);
      setAccountSearchError("Ошибка при поиске. Попробуйте позже или заполните адрес вручную.");
    } finally {
      setAccountSearchLoading(false);
    }
  };

  // --- АВТОПОИСК АБОНЕНТА ПО НОМЕРУ ТЕЛЕФОНА (при регистрации или вводе телефона) ---
  const searchSubscriberByPhone = async (rawPhone: string) => {
    if (!rawPhone) return;
    const digits = rawPhone.replace(/\D/g, "");
    if (digits.length < 10) return;
    const last10 = digits.slice(-10);

    console.log(`[ЛК: Поиск по телефону] Старт поиска по номеру: "${rawPhone}" (10 цифр: "${last10}")...`);

    try {
      // Ищем точное совпадение 10 цифр по очищенному полю phone_clean
      const { data, error } = await supabase
        .from("accounts")
        .select("*")
        .ilike("phone_clean", `%${last10}%`)
        .order("debt_amount", { ascending: false })
        .limit(1);

      if (error) {
        console.error("[ЛК: Поиск по телефону] Ошибка запроса к accounts:", error);
        return;
      }

      if (data && data.length > 0) {
        const found = data[0];
        console.log(`[ЛК: Поиск по телефону] ✅ Найден абонент по телефону ${rawPhone}! Л/С: ${found.account_number}, Адрес: ${found.address}`);

        // Автоматически заполняем данные адреса и лицевого счета
        setAddress(found.address || "");

        const apt = found.apartment?.trim() || extractApartmentFromAddress(found.address || "");
        setApartment(apt);

        if (found.street) setDisplayStreet(found.street);
        if (found.house) setDisplayHouse(found.house);
        if (found.housing) setDisplayHousing(found.housing);
        if (found.entrance) setEntrance(found.entrance);

        parseAndSetAddress(found.address || "");

        if (found.address) {
          fetchApartmentSuggestions(found.address);
        }

        setUserAccount(found);
        setAccountSearchInput(found.account_number);
        setAccountSearchFound(true);

        // Предзаполняем ФИО найденного абонента для модального окна подтверждения
        setWelcomeFullName(found.full_name || fullName || "");
        setMatchedSubscriberData(found);
        setShowPhoneWelcomeDialog(true);
      } else {
        console.log(`[ЛК: Поиск по телефону] Номер "${last10}" не найден среди зарегистрированных договоров.`);
      }
    } catch (err) {
      console.error("[ЛК: Поиск по телефону] Ошибка выполнения поиска:", err);
    }
  };

  // Обработчик подтверждения данных найденного по номеру телефона договора
  const handleConfirmFoundSubscriber = async () => {
    if (!matchedSubscriberData || !userId) {
      setShowPhoneWelcomeDialog(false);
      return;
    }

    const finalName = welcomeFullName.trim() || matchedSubscriberData.full_name || fullName || "";
    if (!finalName) {
      toast({
        title: "Введите ФИО",
        description: "Пожалуйста, введите ваше ФИО для сохранения и привязки данных договора.",
        variant: "destructive",
      });
      return;
    }

    try {
      setSavingWelcomeData(true);
      console.log(`[ЛК: Договор по телефону] Сохраняем: ФИО "${finalName}", адрес "${matchedSubscriberData.address}", л/с "${matchedSubscriberData.account_number}"`);
      
      const apt = matchedSubscriberData.apartment?.trim() || extractApartmentFromAddress(matchedSubscriberData.address || "");
      
      const { error: updErr } = await supabase
        .from("profiles")
        .update({
          full_name: finalName,
          address: matchedSubscriberData.address,
          apartment: apt,
          phone: phone || matchedSubscriberData.phone,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);

      if (updErr) throw updErr;

      setFullName(finalName);
      setAddress(matchedSubscriberData.address);
      setApartment(apt);
      setProfile((prev: any) => ({
        ...prev,
        full_name: finalName,
        address: matchedSubscriberData.address,
        apartment: apt,
        phone: phone || matchedSubscriberData.phone,
      }));

      setShowPhoneWelcomeDialog(false);
      toast({
        title: "Данные успешно привязаны!",
        description: `Адрес ${matchedSubscriberData.address} и лицевой счёт ${matchedSubscriberData.account_number} сохранены в профиле.`,
      });
    } catch (err: any) {
      console.error("[ЛК: Договор по телефону] Ошибка сохранения данных:", err);
      toast({
        title: "Ошибка сохранения",
        description: err.message || "Не удалось сохранить данные профиля",
        variant: "destructive",
      });
    } finally {
      setSavingWelcomeData(false);
    }
  };

  // Обработчик отмены сохранения найденных данных договора
  const handleCancelFoundSubscriber = () => {
    setShowPhoneWelcomeDialog(false);
    toast({
      title: "Сохранение отменено",
      description: "Вы можете ввести адрес и данные вручную в карточке профиля.",
    });
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
  // Формат в БД: "г. Краснодар, Улица, д. Дом" или "Город, Улица, д. 9, корп. 2"
  const parseAndSetAddress = (fullAddr: string) => {
    if (!fullAddr) {
      console.log("[Адрес] Пустой адрес в профиле, сброс полей");
      setDisplayStreet("");
      setDisplayHouse("");
      setSelectedStreet(null);
      setEntrance("");
      return;
    }
    console.log(`[Адрес] Парсинг адреса из профиля: "${fullAddr}"`);
    const parts = fullAddr.split(",");
    if (parts.length >= 3) {
      const streetPart = parts[1].trim();
      // Используем extractHousePartFromCacheAddr для корректного извлечения полной части дома
      // включая корпуса, буквы и дроби (д. 9, корп. 2 → "9, корп. 2", подъезды/квартиры очищаются)
      const housePart = extractHousePartFromCacheAddr(fullAddr);
      
      // Парсим подъезд с помощью регулярного выражения из адреса
      const entranceMatch = fullAddr.match(/,\s*(?:п(?:одъезд)?\.?\s*(\d+))/i);
      const parsedEntrance = entranceMatch ? entranceMatch[1] : "";
      
      setDisplayStreet(streetPart);
      setDisplayHouse(housePart);
      setSelectedStreet(streetPart);
      setEntrance(parsedEntrance);
      console.log(`[Адрес] Успешно распарсено: улица "${streetPart}", дом "${housePart}", подъезд "${parsedEntrance}"`);
    } else {
      // Если формат не совпадает, выводим его целиком в поле улицы
      const cleanAddr = getDisplayAddress(fullAddr);
      setDisplayStreet(cleanAddr);
      setDisplayHouse("");
      setSelectedStreet(cleanAddr);
      setEntrance("");
      console.log(`[Адрес] Нетипичный формат адреса, выведен целиком: "${cleanAddr}"`);
    }
  };

  // --- ИНТЕГРАЦИЯ УМНОГО АВТОКОМПЛИТА АДРЕСОВ DADATA (КРАСНОДАРСКИЙ КРАЙ И АДЫГЕЯ) ---
  
  // Асинхронный запрос к API DaData Подсказок
  const fetchDaDataSuggestions = async (queryText: string, type: "street" | "house", streetContext?: string, cityContext?: string) => {
    // Бесплатный и надежный рабочий API-токен DaData
    const token = import.meta.env.VITE_DADATA_API_KEY || "ffc54d5b244795b5463f82cb8dcfbb1eb4f46ff7";
    
    // Определяем город для контекста (сначала переданный явно cityContext, затемselectedCity)
    const targetCity = cityContext || selectedCity || "г. Краснодар";
    const cleanCity = targetCity.replace(/^(г\.\s*|город\s*)/i, "").trim();

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
          city: cleanCity,
          street: streetContext.replace(/(?:\b(?:ул\.?|улица)\b|\(ул\))\s*/gi, "").trim()
        },
        { 
          region_kladr_id: "01", 
          city: cleanCity,
          street: streetContext.replace(/(?:\b(?:ул\.?|улица)\b|\(ул\))\s*/gi, "").trim()
        },
        {
          region_kladr_id: "23",
          street: streetContext.replace(/(?:\b(?:ул\.?|улица)\b|\(ул\))\s*/gi, "").trim()
        },
        {
          region_kladr_id: "01",
          street: streetContext.replace(/(?:\b(?:ул\.?|улица)\b|\(ул\))\s*/gi, "").trim()
        }
      ];
      body.from_bound = { value: "house" };
      body.to_bound = { value: "house" };
    }

    try {
      console.log(`[DaData API] Запрос (${type}) для: "${queryText}", контекст города: "${targetCity}"`);
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
    setEntrance("");
    setApartment("");
    setFloor("");
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
        city: getCityForLocalStreet(street, allHouses), // Динамически определяем город из БД (например, Новая Адыгея)
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
    setEntrance("");
    setApartment("");
    setFloor("");
    setDisplayHouse(""); // При переключении улицы сбрасываем выбранный ранее дом
    setShowStreetSuggestions(false);
    setStreetSuggestions([]);
    setDadataStreetSuggestions([]);
    
    // Загружаем все доступные дома для этой улицы
    setLoadingAddressCache(true);
    const houseList: any[] = [];

    // 1. Сначала ищем подключенные дома в локальной кэш-базе unique_houses
    // Ищем их всегда для любой выбранной улицы (даже если из DaData пришел статус isLocal = false),
    // используя сравнение нормализованных названий улиц через normalizeStreet
    const localHouses = allHouses
      .filter((h) => {
        const parts = h.split(",");
        const streetPart = parts[1] ? parts[1].trim() : "";
        return normalizeStreet(streetPart) === normalizeStreet(streetObj.streetName);
      })
      .map((h) => {
        // Извлекаем полную часть дома (включая корпуса, буквы, дроби)
        // Пример: "Краснодар, Корнилова (ул), д. 9, korp. 2" → "9, корп. 2"
        return {
          houseNumber: extractHousePartFromCacheAddr(h),
          isLocal: true
        };
      })
      .filter(h => h.houseNumber);
    
    houseList.push(...localHouses);
    console.log(`[Автокомплит Домов] Найдено подключенных домов в локальной БД: ${localHouses.length}`);

    // 2. Подгружаем все реально существующие дома на этой улице через API DaData
    try {
      const dadataHouses = await fetchDaDataSuggestions(streetObj.streetName, "house", streetObj.streetName, streetObj.city);
      const formattedDadata = dadataHouses
        .map((h: any) => {
          const houseNum = getHouseNumberFromDaData(h);
          if (!houseNum) return null;
          
          // Исключаем дубликаты, которые уже есть в локальной БД на основе интеллектуального сопоставления номеров домов через normalizeHouse
          const exists = houseList.some(lh => normalizeHouse(lh.houseNumber) === normalizeHouse(houseNum));
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

    // Сортируем дома: сначала на обслуживании (isLocal), затем по числовому значению,
    // затем по суффиксу (корпус, буква). Например: 6, 6А, 9, 9 корп. 1, 9 корп. 2, 31/1
    const parseHouseNum = (h: string) => {
      // Извлекаем основной номер дома (числовая часть перед любыми буквами/корпусами)
      const mainNum = parseInt(h.replace(/[^0-9]/g, "").slice(0, 5)) || 0;
      // Извлекаем суффикс (буква, корпус, дробь) для вторичной сортировки
      const suffix = h.replace(/^\d+/, "").replace(/[^а-яa-z0-9/]/gi, "").toLowerCase();
      return { mainNum, suffix };
    };

    const sortedHouses = houseList.sort((a, b) => {
      // 1. Сначала идут дома "на обслуживании"
      if (a.isLocal && !b.isLocal) return -1;
      if (!a.isLocal && b.isLocal) return 1;

      // 2. Сортируем по основному номеру дома
      const { mainNum: numA, suffix: sufA } = parseHouseNum(a.houseNumber);
      const { mainNum: numB, suffix: sufB } = parseHouseNum(b.houseNumber);
      if (numA !== numB) return numA - numB;

      // 3. При одинаковых номерах — сортируем по суффиксу (корпус, буква)
      return sufA.localeCompare(sufB, "ru", { numeric: true, sensitivity: "base" });
    });

    setHouseSuggestions(sortedHouses);
    setLoadingAddressCache(false);
  };

  // Обработка ручного ввода в поле «Дом»
  const handleHouseInputChange = async (val: string) => {
    setDisplayHouse(val);
    setEntrance("");
    setApartment("");
    setFloor("");
    setShowHouseSuggestions(true);
    setShowStreetSuggestions(false);

    if (!selectedStreet) {
      console.log("[Автокомплит Домов] Улица не выбрана, блокируем поиск домов");
      setHouseSuggestions([]);
      return;
    }

    // Фильтруем дома для выбранной улицы по введенному значению
    // 1. Поиск по локально кэшированным (сопоставляем по нормализованному значению улицы)
    const matchingLocal = allHouses
      .filter((h) => {
        const parts = h.split(",");
        const streetPart = parts[1] ? parts[1].trim() : "";
        return normalizeStreet(streetPart) === normalizeStreet(selectedStreet);
      })
      .map((h) => {
        // Извлекаем полную часть дома (включая корпуса, буквы, дроби)
        return {
          houseNumber: extractHousePartFromCacheAddr(h),
          isLocal: true
        };
      })
      .filter((h) => {
        // Интеллектуальный поиск: приводим и вводимое значение, и номер дома к нормализованному виду
        const normHouse = normalizeHouse(h.houseNumber);
        const normInput = normalizeHouse(val);
        return normHouse.includes(normInput);
      });

    const filteredSuggestions = [...matchingLocal];

    // 2. Поиск по DaData Подсказкам
    try {
      const dadataRes = await fetchDaDataSuggestions(val, "house", selectedStreet);
      dadataRes.forEach((h: any) => {
        const houseNum = getHouseNumberFromDaData(h);
        if (!houseNum) return;

        // Исключаем дубликаты на основе интеллектуального сопоставления номеров домов через normalizeHouse.
        // Это предотвратит повторное появление обслуживаемых локальных домов в качестве обычных ("Доступен") подсказок.
        const exists = filteredSuggestions.some(fs => normalizeHouse(fs.houseNumber) === normalizeHouse(houseNum));
        
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

    // Сортируем дома: сначала на обслуживании (isLocal), затем по числовому значению,
    // затем по суффиксу (корпус, буква). Пример: 6, 6А, 9 корп.1, 9 корп.2, 31/1
    const parseHouseNumFilter = (h: string) => {
      const mainNum = parseInt(h.replace(/[^0-9]/g, "").slice(0, 5)) || 0;
      const suffix = h.replace(/^\d+/, "").replace(/[^а-яa-z0-9/]/gi, "").toLowerCase();
      return { mainNum, suffix };
    };

    const sorted = filteredSuggestions.sort((a, b) => {
      // 1. Дома на обслуживании — первые
      if (a.isLocal && !b.isLocal) return -1;
      if (!a.isLocal && b.isLocal) return 1;

      // 2. Сортировка по основному номеру дома
      const { mainNum: numA, suffix: sufA } = parseHouseNumFilter(a.houseNumber);
      const { mainNum: numB, suffix: sufB } = parseHouseNumFilter(b.houseNumber);
      if (numA !== numB) return numA - numB;

      // 3. При одинаковых номерах — по корпусу/букве
      return sufA.localeCompare(sufB, "ru", { numeric: true, sensitivity: "base" });
    });

    setHouseSuggestions(sorted);
  };

  // Выбор дома из списка подсказок
  const handleSelectHouse = (houseObj: { houseNumber: string, isLocal: boolean }) => {
    if (!selectedStreet) return;
    console.log(`[Автокомплит Домов] Выбран дом: "${houseObj.houseNumber}", подключен к сети: ${houseObj.isLocal}`);
    setDisplayHouse(houseObj.houseNumber);
    setEntrance("");
    setApartment("");
    setFloor("");
    setShowHouseSuggestions(false);
    setHouseSuggestions([]);
    
    if (houseObj.isLocal) {
      // 1. Если дом подключен, находим его полный эталонный адрес в кэше для записи в БД
      const fullAddr = allHouses.find((h) => {
        const parts = h.split(",");
        const streetPart = parts[1] ? parts[1].trim() : "";
        // Извлекаем полную часть дома для точного сопоставления (включая корпуса)
        const housePart = extractHousePartFromCacheAddr(h);
        // Сравниваем с использованием normalizeStreet и normalizeHouse для нечувствительности к формату
        return normalizeStreet(streetPart) === normalizeStreet(selectedStreet) && normalizeHouse(housePart) === normalizeHouse(houseObj.houseNumber);
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

  // Реактивное обновление подсказок квартир на основе выбранного подъезда и загруженных счетов дома
  useEffect(() => {
    if (houseAccounts.length === 0) {
      setApartmentSuggestions([]);
      return;
    }

    let filtered = houseAccounts;
    
    // Если подъезд выбран, фильтруем квартиры по этому подъезду
    if (entrance && entrance.trim()) {
      filtered = houseAccounts.filter((acc: any) => {
        // Безопасная регулярка: исключаем ложные совпадения буквы "п" с окончанием слова "корп."
        const match = acc.address ? acc.address.match(/(?:^|,|\s)(?:подъезд|п\.?)\s*(\d+)/i) : null;
        const parsedEntrance = match ? match[1] : "";
        return parsedEntrance === entrance.trim();
      });
    }

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
    console.log(`[Квартиры] Реактивно отфильтровано квартир для подъезда "${entrance}": ${uniqueApts.length}`);
  }, [entrance, houseAccounts]);

  // Автоматическое заполнение подъезда при вводе или выборе номера квартиры
  useEffect(() => {
    if (!apartment || !apartment.trim() || houseAccounts.length === 0) return;
    
    // Ищем лицевой счет с совпадающей квартирой в кэше дома
    const targetAptNorm = normalizeApartment(apartment);
    const foundAccount = houseAccounts.find((acc: any) => normalizeApartment(acc.apartment) === targetAptNorm);
    
    if (foundAccount && foundAccount.address) {
      // Извлекаем подъезд с помощью безопасной регулярки
      const match = foundAccount.address.match(/(?:^|,|\s)(?:подъезд|п\.?)\s*(\d+)/i);
      if (match) {
        const autoEntrance = match[1];
        // Заполняем подъезд автоматически, только если он еще не заполнен
        if (autoEntrance && autoEntrance !== entrance && !entrance) {
          console.log(`[Автозаполнение Подъезда] Для квартиры "${apartment}" автоматически определён подъезд "${autoEntrance}"`);
          setEntrance(autoEntrance);
        }
      }
    }
  }, [apartment, houseAccounts, entrance]);

  // Функция для загрузки доступных квартир и подъездов по выбранному адресу дома
  const fetchApartmentSuggestions = async (selectedAddr: string) => {
    if (!selectedAddr) return;
    const { street, house } = parseAddressParts(selectedAddr);
    const cleanStreetQuery = street.replace(/(?:\b(?:ул\.?|улица)\b|\(ул\))\s*/gi, "").trim();
    
    console.log(`[Квартира/Подъезд] Загрузка данных для улицы: "${street}" (${cleanStreetQuery}), Дом: "${house}"`);
    try {
      // Ищем все лицевые счета по корню названия улицы И номеру дома для исключения обрезки лимитом PostgREST
      console.log(`[Квартира/Подъезд: БД Запрос] Отправка запроса к accounts с ilike по адресу: "%${cleanStreetQuery}%${house}%"`); // Подробное логирование запроса
      const { data, error } = await supabase
        .from("accounts")
        .select("address, apartment")
        .ilike("address", `%${cleanStreetQuery}%${house}%`);
        
      if (error) throw error;

      if (data) {
        const userStreetNorm = normalizeStreet(street);
        const userHouseNorm = normalizeHouse(house);

        // Точечно фильтруем только те записи, у которых совпадают нормализованные улица и дом
        const filtered = data.filter((a: any) => {
          const dbParts = (a.address || "").split(",");
          if (dbParts.length < 3) return false;

          const dbStreetNorm = normalizeStreet(dbParts[1]);
          const dbHouseFull = dbParts.slice(2).join(", ")
            .replace(/,\s*(?:п(?:одъезд)?\.?\s*\d+).*$/i, "")
            .replace(/,\s*(?:кв\.?\s*[а-яa-z0-9-+]+).*$/i, "");
          const dbHouseNorm = normalizeHouse(dbHouseFull);

          return dbStreetNorm === userStreetNorm && dbHouseNorm === userHouseNorm;
        });

        // Сохраняем отфильтрованные аккаунты дома в стейт для реактивной фильтрации квартир
        setHouseAccounts(filtered);

        // Извлекаем уникальные номера подъездов и сортируем их по возрастанию
        const entrances = filtered
          .map((item: any) => {
            // Безопасная регулярка: исключаем совпадения с окончанием слова "корп."
            const match = item.address ? item.address.match(/(?:^|,|\s)(?:подъезд|п\.?)\s*(\d+)/i) : null;
            return match ? match[1] : "";
          })
          .filter(Boolean);
        
        const uniqueEntrances = Array.from(new Set(entrances)).sort((a, b) => {
          return (parseInt(a) || 0) - (parseInt(b) || 0);
        });
        
        setEntranceSuggestions(uniqueEntrances);
        console.log(`[Подъезды] Загружено уникальных подъездов для дома: ${uniqueEntrances.length}`);
      }
    } catch (err) {
      console.error("[Квартира/Подъезд] Ошибка загрузки данных:", err);
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
    const isApartment = !!apartment?.trim();
    setPremiseType(isApartment ? "apartment" : "private");
  }, [apartment]);

  useEffect(() => {
    const isApartment = !!orderApartment?.trim();
    setOrderPremiseType(isApartment ? "apartment" : "private");
  }, [orderApartment]);

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
      // RULE 2: Фоновый опрос профиля предназначен ИСКЛЮЧИТЕЛЬНО для синхронизации
      // системных статусов (верификация документов, одобрение заявки, проверка ролей).
      // Он НИКОГДА не должен затирать введённые абонентом поля формы (ФИО, телефон, адрес, квартиру)!
      try {
        const { data } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", userId)
          .single();

        if (data) {
          // Обновляем только состояние профиля и статус верификации для реактивных карточек
          setProfile(data);
          console.log("[Кабинет: Polling] Статус профиля синхронизирован (верификация:", data.verification_status, ")");
        }
      } catch (err) {
        console.warn("[Кабинет: Polling] Предупреждение при проверке профиля:", err);
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
      
      // Автоподстановка Email из профиля, сессии регистрации или localStorage
      // RULE 2: Исключаем технический системный email phone_XXXXXXXXXX@domofondar.ru / @домофондар.рф
      const storedUser = localStorage.getItem("user") || sessionStorage.getItem("user");
      const parsedUser = storedUser ? JSON.parse(storedUser) : null;
      const rawCandidateEmail = (data.email || session.user?.email || parsedUser?.email || "").trim();
      const isSystemPhoneEmail = !rawCandidateEmail || rawCandidateEmail.startsWith("phone_") || rawCandidateEmail.endsWith("@domofondar.ru") || rawCandidateEmail.endsWith("@домофондар.рф");
      const realEmail = isSystemPhoneEmail ? "" : rawCandidateEmail;

      if (realEmail) {
        setEmail(realEmail);
        setEmailInput(realEmail);
        setEmailVerified(!!data.email_verified || true);
      } else {
        setEmail("");
        setEmailInput("");
        setEmailVerified(false);
      }
      console.log(`[Cabinet Auth] Почта инициализирована: "${realEmail || 'не указана (по желанию)'}"`);

      // Автоматический поиск адреса по номеру телефона, если адрес еще не заполнен
      const targetPhone = data.phone || parsedUser?.phone || "";
      if (!data.address && targetPhone && !hasSearchedPhoneOnce) {
        setHasSearchedPhoneOnce(true);
        console.log(`[Cabinet Auth] Адрес не заполнен, запускаем автопоиск договора по номеру телефона: "${targetPhone}"...`);
        searchSubscriberByPhone(targetPhone);
      }
    } catch (error: any) {
      console.error("[Cabinet Auth] Критическая ошибка при инициализации пользователя в кабинете:", error);
    } finally {
      // Гарантируем отключение экрана загрузки (Loader2) и отображение интерфейса ЛК
      console.log("[Cabinet Auth] Инициализация завершена, выключаем экран загрузки...");
      setLoading(false);
    }
  };

  // Получение актуальной цены товара с учетом настроек для подъезда и статуса дома
  const getEffectiveProductPrice = (prod: any) => {
    if (!prod) return 0;

    // 1. Приоритет: точная настройка цены для текущего подъезда жильца
    if (currentMatchedEntrance && entrancePricingMap[currentMatchedEntrance.id]?.[prod.id]) {
      const pricing = entrancePricingMap[currentMatchedEntrance.id][prod.id];
      if (pricing.price_type === "custom" && pricing.custom_price != null && !isNaN(Number(pricing.custom_price))) {
        return Number(pricing.custom_price);
      }
      if (pricing.price_type === "promo" && prod.promo_price != null && !isNaN(Number(prod.promo_price))) {
        return Number(prod.promo_price);
      }
      if (pricing.price_type === "installation" && prod.installation_price != null && !isNaN(Number(prod.installation_price))) {
        return Number(prod.installation_price);
      }
      if (pricing.price_type === "retail") {
        return Number(prod.price || 0);
      }
    }

    // 2. Стандартная логика для домов со статусом "монтаж"
    const isInstallation = currentMatchedEntrance?.service_type === "installation";
    if (isInstallation && prod.installation_price != null && !isNaN(Number(prod.installation_price))) {
      return Number(prod.installation_price);
    }

    // 3. Базовая цена товара
    return Number(prod.price || 0);
  };

  // RULE 2: Надежная функция проверки принадлежности товара к ключам домофона
  // Исключает ложные срабатывания на подстроку "ключ" в словах "выключатель", "переключатель", "подключение"
  const isKeyProduct = (p: any) => {
    if (!p || !p.name) return false;
    const name = p.name.toLowerCase();
    if (name.includes("выключатель") || name.includes("переключатель") || name.includes("подключ")) {
      return false;
    }
    return p.category === "key" || /(?:^|\s)ключ/i.test(name);
  };

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

  // RULE 2: Комплексная проверка факта покупки / владения личным кабинетом (Умный домофон)
  // Проверяет 3 независимых источника:
  // 1) Флаг has_lk в таблице accounts (лицевой счет абонента)
  // 2) Флаг is_purchased или has_lk в intercom_credentials (данные домофона для квартиры)
  // 3) Оплаченную заявку на подключение ЛК / умного домофона в requests
  const isCabinetPurchased = useMemo(() => {
    // 1. Проверка по лицевому счету
    if (userAccount?.has_lk === true) {
      console.log("[Cabinet: ЛК Статус] Личный кабинет подтвержден по лицевому счету (accounts.has_lk = true)");
      return true;
    }
    // 2. Проверка по учетной записи домофона
    if (apartmentIntercomCred?.is_purchased === true || apartmentIntercomCred?.has_lk === true) {
      console.log("[Cabinet: ЛК Статус] Личный кабинет подтвержден по данным домофона (intercom_credentials)");
      return true;
    }
    // 3. Проверка по оплаченным заявкам пользователя
    if (Array.isArray(userRequests) && userRequests.length > 0) {
      const hasPaidCabinetOrder = userRequests.some((r: any) => {
        if (r.payment_status !== "paid") return false;
        const msg = (r.message || "").toLowerCase();
        return msg.includes("кабинет") || msg.includes("умный домофон") || msg.includes("удалённый доступ");
      });
      if (hasPaidCabinetOrder) {
        console.log("[Cabinet: ЛК Статус] Личный кабинет подтвержден по оплаченной заявке в requests");
        return true;
      }
    }
    return false;
  }, [userAccount?.has_lk, apartmentIntercomCred?.is_purchased, apartmentIntercomCred?.has_lk, userRequests]);

  // Автоматический сброс выбора чекбокса подключения ЛК, если он уже приобретен
  useEffect(() => {
    if (isCabinetPurchased && isCabinetSetupChecked) {
      console.log("[Cabinet: ЛК] Личный кабинет уже приобретен, деактивация чекбокса добавления ЛК в заказ");
      setIsCabinetSetupChecked(false);
    }
  }, [isCabinetPurchased, isCabinetSetupChecked]);

  const calculateTotals = () => {
    let sum1 = 0; // Ключи (SUMMA_OPL1)
    let sum2 = 0; // Установка и трубки (SUMMA_OPL2)
    let sum3 = 0; // Личный кабинет (SUMMA_OPL3)

    // RULE 2: Жесткая привязка номенклатуры ключа по уникальному ID (UUID) с расчетом ступенчатой акции
    const keyProduct = selectedKeyProductId 
      ? (availableProducts.find(p => p.id === selectedKeyProductId) || products.find(p => p.id === selectedKeyProductId))
      : (availableProducts.find(p => p.category === "key") || availableProducts.find(isKeyProduct));
    if (keyProduct && keysQuantity > 0) {
      const isInstallation = currentMatchedEntrance?.service_type === "installation";
      const basePrice = Number(keyProduct.price || 300);
      const installPrice = keyProduct.installation_price != null ? Number(keyProduct.installation_price) : 200;
      const isPromoEnabled = !!keyProduct.is_tiered_promo;
      const keyTiers = parseTieredPricing(keyProduct.tiered_pricing);

      const keyCalc = calculateKeyPriceDetails(
        keysQuantity,
        basePrice,
        isInstallation,
        installPrice,
        isPromoEnabled,
        keyTiers
      );
      sum1 = keyCalc.totalPrice;
      console.log(`[Расчет заказа] Ключи "${keyProduct.name}" (ID: ${keyProduct.id}): ${keysQuantity} шт. x ${keyCalc.unitPrice} ₽ = ${sum1} ₽ ${keyCalc.tierText}`);
    }

    // Выбранная услуга (установка или замена трубки) - только если реально выбрана
    if (selectedServiceId) {
      const selectedService = availableProducts.find(p => p.id === selectedServiceId)
        || products.find(p => p.id === selectedServiceId);
      if (selectedService) {
        const sPrice = getEffectiveProductPrice(selectedService);
        sum2 += sPrice;
        console.log(`[Расчет заказа] Услуга "${selectedService.name}": ${sPrice} ₽`);
      }
    }

    // Выбранная трубка (ТКП) - строго 1 шт на квартиру
    if (selectedEquipmentId) {
      const prod = availableProducts.find(p => p.id === selectedEquipmentId) || products.find(p => p.id === selectedEquipmentId);
      if (prod) {
        const prodPrice = getEffectiveProductPrice(prod);
        sum2 += prodPrice;
        console.log(`[Расчет заказа] Выбрана трубка "${prod.name}": 1 шт. x ${prodPrice} ₽ = ${prodPrice} ₽`);
      }
    } else {
      // Резервная поддержка selectedEquipments
      Object.entries(selectedEquipments).forEach(([id, qty]) => {
        const prod = availableProducts.find(p => p.id === id) || products.find(p => p.id === id);
        if (prod && qty > 0) {
          const prodPrice = getEffectiveProductPrice(prod);
          sum2 += prodPrice * qty;
          console.log(`[Расчет заказа] Трубка "${prod.name}": ${qty} шт. x ${prodPrice} ₽ = ${prodPrice * qty} ₽`);
        }
      });
    }

    // Настройка личного кабинета (300 руб) - доступна при наличии логопасов ИЛИ активном статусе Умный дом (если ЛК еще не приобретен)
    const canPurchaseCabinet = !isCabinetPurchased && (hasEntranceCredentials || !!currentMatchedEntrance?.has_smart_intercom);
    if (isCabinetSetupChecked && canPurchaseCabinet) {
      const cabinetProduct = products.find(p => p.name.toLowerCase().includes("кабинет"));
      if (cabinetProduct) {
        sum3 = getEffectiveProductPrice(cabinetProduct);
      } else {
        sum3 = 300; // Резервное значение, если товара нет в БД
      }
      console.log(`[Расчет заказа] Личный кабинет: ${sum3} ₽`);
    }

    const total = sum1 + sum2 + sum3;

    return { sum1, sum2, sum3, total };
  };

  // Реф для отслеживания момента открытия диалога (переход false -> true)
  const prevIsOrderDialogOpenRef = useRef(false);

  // RULE 2: Эффект инициализации полей заявки СТРОГО в момент открытия диалогового окна
  useEffect(() => {
    // Срабатываем строго один раз в момент открытия диалога (когда он был закрыт, а стал открыт)
    if (isOrderDialogOpen && !prevIsOrderDialogOpenRef.current) {
      console.log("[Заявка] Первоначальное открытие диалога заявки, инициализация полей...");
      // RULE 2: Сбрасываем выбранные позиции только при НОВОМ открытии диалога
      setSelectedServiceId(null);
      setSelectedEquipmentId(null);
      setSelectedEquipments({});
      setKeysQuantity(0);
      setIsCabinetSetupChecked(false);
      setRepairProblem("");
      setOrderPhone(phone || profile?.phone || "");
      
      // RULE 2: Жестко находим и привязываем точный ID ключа подъезда (UUID)
      const attachedKey = availableProducts.find(p => p.category === "key") || availableProducts.find(isKeyProduct);
      setSelectedKeyProductId(attachedKey ? attachedKey.id : null);
      if (attachedKey) {
        console.log(`[Заявка] К подъезду жестко привязан ключ: "${attachedKey.name}" (ID: ${attachedKey.id})`);
      }
      
      let streetVal = displayStreet || "";
      let houseVal = displayHouse || "";
      let entVal = entrance || "";

      // Если displayStreet или displayHouse пустые, пробуем извлечь из сырого адреса
      const rawAddress = userAccount?.address || profile?.address || address || "";
      if ((!streetVal || !houseVal) && rawAddress) {
        const parts = rawAddress.split(",");
        if (parts.length >= 3) {
          if (!streetVal) streetVal = parts[1].trim();
          if (!houseVal) houseVal = extractHousePartFromCacheAddr(rawAddress);
        }
      }

      // Автоматическое определение номера подъезда из лицевого счета или профиля
      if (!entVal && rawAddress) {
        const entMatch = rawAddress.match(/(?:^|,|\s)(?:п|подъезд)\.?\s*(\d+)/i);
        if (entMatch) entVal = entMatch[1];
      }

      setOrderStreet(streetVal);
      setOrderHouse(houseVal);
      setOrderEntrance(entVal || "1");
      setOrderApartment(apartment || "");
      setOrderName(fullName || profile?.full_name || "");
      setOrderPremiseType(premiseType || "apartment");
      console.log(`[Заявка] Поля формы инициализированы: Улица="${streetVal}", Дом="${houseVal}", Подъезд="${entVal || "1"}"`);
    }

    // Сохраняем текущее состояние открытия для следующего рендера
    prevIsOrderDialogOpenRef.current = isOrderDialogOpen;
  }, [isOrderDialogOpen]); // ВАЖНО: Зависимость СТРОГО только от [isOrderDialogOpen], чтобы асинхронные обновления профиля, лицевого счета и DaData не сбрасывали выбранные пользователем товары!

  // RULE 2: Если при первоначальном открытии диалога список availableProducts еще подгружался из сети,
  // привязываем ключ подъезда по мере завершения загрузки БЕЗ сброса выбора оборудования абонентом
  useEffect(() => {
    if (isOrderDialogOpen && !selectedKeyProductId && availableProducts.length > 0) {
      const attachedKey = availableProducts.find(p => p.category === "key") || availableProducts.find(isKeyProduct);
      if (attachedKey) {
        console.log(`[Заявка] Фоновая допривязка ключа подъезда: "${attachedKey.name}" (ID: ${attachedKey.id})`);
        setSelectedKeyProductId(attachedKey.id);
      }
    }
  }, [isOrderDialogOpen, selectedKeyProductId, availableProducts]);

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
        
        const selectedService = availableProducts.find(p => p.id === selectedServiceId) || products.find(p => p.id === selectedServiceId);
        if (selectedService) {
          messageText += `— Услуга: ${selectedService.name} (${getEffectiveProductPrice(selectedService).toFixed(2)} ₽)\n`;
        }
        
        if (selectedEquipmentId) {
          const prod = availableProducts.find(p => p.id === selectedEquipmentId) || products.find(p => p.id === selectedEquipmentId);
          if (prod) {
            messageText += `— Оборудование: ${prod.name} (1 шт. x ${getEffectiveProductPrice(prod).toFixed(2)} ₽)\n`;
          }
        }
        
        // RULE 2: Позиция ключа строго по уникальному ID (selectedKeyProductId) с расчетом ступенчатой акции
        const keyProduct = selectedKeyProductId 
          ? (availableProducts.find(p => p.id === selectedKeyProductId) || products.find(p => p.id === selectedKeyProductId))
          : (availableProducts.find(p => p.category === "key") || availableProducts.find(isKeyProduct));
        if (keyProduct && keysQuantity > 0) {
          const isInstallation = currentMatchedEntrance?.service_type === "installation";
          const basePrice = Number(keyProduct.price || 300);
          const installPrice = keyProduct.installation_price != null ? Number(keyProduct.installation_price) : 200;
          const isPromoEnabled = !!keyProduct.is_tiered_promo;
          const keyTiers = parseTieredPricing(keyProduct.tiered_pricing);

          const keyCalc = calculateKeyPriceDetails(
            keysQuantity,
            basePrice,
            isInstallation,
            installPrice,
            isPromoEnabled,
            keyTiers
          );
          messageText += `— Ключи: ${keyProduct.name} (${keysQuantity} шт. x ${keyCalc.unitPrice.toFixed(2)} ₽ = ${keyCalc.totalPrice.toFixed(2)} ₽ ${keyCalc.tierText})\n`;
        }
        
        const canBuyCabinet = !isCabinetPurchased && (hasEntranceCredentials || !!currentMatchedEntrance?.has_smart_intercom);
        if (isCabinetSetupChecked && canBuyCabinet) {
          const cabinetProduct = products.find(p => p.name.toLowerCase().includes("кабинет"));
          const cPrice = cabinetProduct ? getEffectiveProductPrice(cabinetProduct) : 300;
          messageText += `— Сервис: Подключение личного кабинета (${cPrice.toFixed(2)} ₽)\n`;
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
        orderEntrance ? `, п. ${orderEntrance}` : ""
      }${
        cleanOrderApartment ? `, кв. ${cleanOrderApartment}` : ""
      }`;

      console.log(`[Заказ] Запись в БД по адресу: "${orderFullAddress}", телефон: "${orderPhone}"`);

      // RULE 2: АВТОСОХРАНЕНИЕ В ПРОФИЛЬ АБОНЕНТА
      // Если профиль пользователя ещё не заполнен, автоматически сохраняем введённые им в заявке данные!
      if (userId && (!profile?.address || !profile?.full_name)) {
        try {
          console.log("[Заказ] ⚡ Автоматическое сохранение реквизитов заявки в профиль абонента...");
          const finalProfileName = (orderName.trim() || fullName.trim());
          const finalProfilePhone = (orderPhone.trim() || phone.trim());
          
          const profileAutoData: any = {
            updated_at: new Date().toISOString()
          };
          if (!profile?.full_name && finalProfileName) {
            profileAutoData.full_name = finalProfileName;
          }
          if (!profile?.phone && finalProfilePhone) {
            profileAutoData.phone = finalProfilePhone;
          }
          if (!profile?.address && orderFullAddress) {
            profileAutoData.address = orderFullAddress;
          }
          if (!profile?.apartment && cleanOrderApartment) {
            profileAutoData.apartment = cleanOrderApartment;
          }
          if (floor) {
            profileAutoData.floor = String(floor).trim();
          }

          if (Object.keys(profileAutoData).length > 1) {
            const { error: profUpdErr } = await supabase
              .from("profiles")
              .update(profileAutoData)
              .eq("id", userId);

            if (!profUpdErr) {
              setProfile((prev: any) => prev ? { ...prev, ...profileAutoData } : prev);
              if (profileAutoData.full_name) setFullName(profileAutoData.full_name);
              if (profileAutoData.phone) setPhone(profileAutoData.phone);
              if (profileAutoData.address) setAddress(profileAutoData.address);
              if (cleanOrderStreet) setDisplayStreet(cleanOrderStreet);
              if (cleanOrderHouse) setDisplayHouse(cleanOrderHouse);
              if (orderEntrance) setEntrance(orderEntrance);
              if (cleanOrderApartment) setApartment(cleanOrderApartment);
              console.log("[Заказ] ✅ Профиль абонента успешно обновлен данными из заявки!");
            }
          }
        } catch (syncErr) {
          console.warn("[Заказ] Предупреждение при автосохранении профиля:", syncErr);
        }
      }

      // 3. Обработка обращения в зависимости от типа (бесплатный ремонт или платный заказ)
      if (orderType === "repair") {
        // Бесплатная заявка по ТО — сразу создаем наряд в таблице requests
        console.log(`[Заявка: Ремонт] Создание бесплатной заявки в БД по адресу: "${orderFullAddress}"`);
        const { data: requestData, error: requestError } = await supabase
          .from("requests")
          .insert({
            name: orderName.trim() || fullName || profile?.full_name || "Абонент ЛК",
            phone: orderPhone.trim() || phone || profile?.phone || "не указан",
            address: orderFullAddress,
            message: messageText,
            status: "pending",
            priority: "medium",
            order_type: "repair",
            street: cleanOrderStreet || null,
            house: cleanOrderHouse || null,
            entrance: orderEntrance ? String(orderEntrance).trim() : null,
            floor: floor ? String(floor).trim() : null,
            apartment: cleanOrderApartment ? String(cleanOrderApartment).trim() : null,
            payment_status: null,
            payment_amount: 0,
            payment_method: null,
            client_id: userId || undefined,
          })
          .select("id")
          .single();

        if (requestError) throw requestError;

        console.log(`[Заявка: Ремонт] Успешно создан наряд с ID: ${requestData?.id}`);

        // Отправка уведомления диспетчерам в Telegram
        try {
          await supabase.functions.invoke("notify", {
            body: {
              event: "request_created",
              data: { name: fullName || orderName, phone: orderPhone, address: orderFullAddress, message: messageText },
            },
          });
        } catch (e) {
          console.error("[Заявка: Ремонт] Ошибка отправки уведомления в Telegram:", e);
        }

        if (refetchUserRequests) {
          refetchUserRequests();
        }

        toast({
          title: "Заявка отправлена мастерам",
          description: "Наши специалисты свяжутся с вами в ближайшее время.",
        });
        setIsOrderDialogOpen(false);
        setRepairProblem("");
      } else {
        // Платный заказ оборудования/ключей — заявка составляется СТРОГО ПОСЛЕ успешной оплаты через ЮKassa!
        const itemsToInsert: any[] = [];
        
        // Вставка выбранной услуги (сначала ищем в доступных товарах подъезда)
        if (selectedServiceId) {
          const prod = availableProducts.find(p => p.id === selectedServiceId) || products.find(p => p.id === selectedServiceId);
          if (prod) {
            itemsToInsert.push({
              product_id: selectedServiceId,
              quantity: 1,
              price: getEffectiveProductPrice(prod),
              name: prod.name,
            });
            console.log(`[Заказ: Позиция] Добавлена услуга: "${prod.name}" за ${getEffectiveProductPrice(prod)} ₽`);
          }
        }
        
        // Вставка выбранного оборудования (одиночная трубка ТКП)
        if (selectedEquipmentId) {
          const prod = availableProducts.find(p => p.id === selectedEquipmentId) || products.find(p => p.id === selectedEquipmentId);
          if (prod) {
            itemsToInsert.push({
              product_id: selectedEquipmentId,
              quantity: 1,
              price: getEffectiveProductPrice(prod),
              name: prod.name,
            });
            console.log(`[Заказ: Позиция] Добавлена трубка ТКП: "${prod.name}" (1 шт.) за ${getEffectiveProductPrice(prod)} ₽`);
          }
        } else {
          // Резервная поддержка множественного выбора
          Object.entries(selectedEquipments).forEach(([id, qty]) => {
            const prod = availableProducts.find(p => p.id === id) || products.find(p => p.id === id);
            if (prod && qty > 0) {
              itemsToInsert.push({
                product_id: id,
                quantity: qty,
                price: getEffectiveProductPrice(prod),
                name: prod.name,
              });
              console.log(`[Заказ: Позиция] Добавлено оборудование: "${prod.name}" (${qty} шт.) за ${getEffectiveProductPrice(prod)} ₽`);
            }
          });
        }
        
        // Вставка выбранных ключей (строго по уникальному ID selectedKeyProductId с расчетом ступеней акции)
        if (keysQuantity > 0) {
          const keyProduct = selectedKeyProductId 
            ? (availableProducts.find(p => p.id === selectedKeyProductId) || products.find(p => p.id === selectedKeyProductId))
            : (availableProducts.find(p => p.category === "key") || availableProducts.find(isKeyProduct));
          if (keyProduct) {
            const isInstallation = currentMatchedEntrance?.service_type === "installation";
            const basePrice = Number(keyProduct.price || 300);
            const installPrice = keyProduct.installation_price != null ? Number(keyProduct.installation_price) : 200;
            const isPromoEnabled = !!keyProduct.is_tiered_promo;
            const keyTiers = parseTieredPricing(keyProduct.tiered_pricing);

            const keyCalc = calculateKeyPriceDetails(
              keysQuantity,
              basePrice,
              isInstallation,
              installPrice,
              isPromoEnabled,
              keyTiers
            );

            itemsToInsert.push({
              product_id: keyProduct.id,
              quantity: keysQuantity,
              price: keyCalc.unitPrice,
              name: keyProduct.name,
            });
            console.log(`[Заказ: Позиция] Добавлены ключи: "${keyProduct.name}" (ID: ${keyProduct.id}, ${keysQuantity} шт.) по ${keyCalc.unitPrice} ₽/шт (${keyCalc.tierText})`);
          }
        }
        
        // Вставка настройки личного кабинета (если есть логопасы ИЛИ активен Умный дом, и ЛК еще не куплен)
        const canBuyCabinet = !isCabinetPurchased && (hasEntranceCredentials || !!currentMatchedEntrance?.has_smart_intercom);
        if (isCabinetSetupChecked && canBuyCabinet) {
          const cabinetProduct = products.find(p => p.name.toLowerCase().includes("кабинет"));
          const cPrice = cabinetProduct ? getEffectiveProductPrice(cabinetProduct) : 300;
          itemsToInsert.push({
            product_id: cabinetProduct?.id || null,
            quantity: 1,
            price: cPrice,
            name: cabinetProduct?.name || "Подключение личного кабинета",
          });
          console.log(`[Заказ: Позиция] Добавлен Личный кабинет за ${cPrice} ₽`);
        }

        // Расчет 5% комиссии эквайринга
        const baseAmount = totals.total;
        const feeAmount = Math.round(baseAmount * 0.05 * 100) / 100;
        const totalAmountWithFee = Math.round((baseAmount + feeAmount) * 100) / 100;

        const orderPayload = {
          name: orderName.trim() || fullName || profile?.full_name || "Абонент ЛК",
          phone: orderPhone.trim() || phone || profile?.phone || "не указан",
          address: orderFullAddress,
          street: cleanOrderStreet,
          house: cleanOrderHouse,
          entrance: orderEntrance ? String(orderEntrance).trim() : null,
          floor: floor ? String(floor).trim() : null,
          apartment: cleanOrderApartment ? String(cleanOrderApartment).trim() : null,
          message: messageText,
          amount: baseAmount,
          user_id: userId || undefined,
          items: itemsToInsert,
        };

        console.log("[Заказ: ЮKassa] Инициализация оплаты (заявка будет создана после успеха):", {
          baseAmount,
          feeAmount,
          totalAmountWithFee,
          orderPayload,
        });

        toast({
          title: "Переход к оплате заказа",
          description: "Перенаправляем на платежный шлюз ЮKassa...",
        });

        const resp = await fetch("/backend-api/api/payments/yookassa/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: totalAmountWithFee,
            credit_amount: baseAmount,
            fee_amount: feeAmount,
            description: `Оплата заказа оборудования и услуг, ${orderFullAddress}`,
            account_number: userAccount?.account_number || undefined,
            accountNumber: userAccount?.account_number || undefined,
            user_id: userId || undefined,
            userId: userId || undefined,
            return_url: `${window.location.origin}/cabinet?check_payment=1&is_order=1&account=${encodeURIComponent(userAccount?.account_number || "")}`,
            returnUrl: `${window.location.origin}/cabinet?check_payment=1&is_order=1&account=${encodeURIComponent(userAccount?.account_number || "")}`,
            order_data: orderPayload,
            orderData: orderPayload,
            is_order: true,
            isOrder: true,
          }),
        });

        const data = await resp.json();
        if (!resp.ok || !data.success) {
          throw new Error(data.error || "Не удалось инициализировать оплату ЮKassa");
        }

        const redirectUrl = data.confirmationUrl || data.confirmation_url;
        if (redirectUrl) {
          console.log(`[Заказ: ЮKassa] Переход по платежной ссылке: ${redirectUrl}`);
          window.location.href = redirectUrl;
          return;
        } else {
          throw new Error("Не получен URL подтверждения оплаты от платёжного шлюза");
        }
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

  // Получаем историю платежей за ТО (ЮKassa) для отображения чеков и оплат ТО
  const userAccountNum = userAccount?.account_number;
  const { data: toPayments = [], refetch: refetchTOPayments } = useQuery({
    queryKey: ["user-to-payments", userAccountNum, userId],
    enabled: !!(userAccountNum || userId),
    queryFn: async () => {
      console.log(`[История: Оплата ТО] Запрос оплат ТО для л/с "${userAccountNum}", userId: "${userId}"`);
      let allPayments: any[] = [];

      // 1. Синхронизация и получение через эндпоинт бэкенда по лицевому счету
      if (userAccountNum) {
        try {
          const res = await fetch(`/backend-api/api/payments/yookassa/sync/${userAccountNum}`);
          const data = await res.json();
          if (data.success && Array.isArray(data.payments)) {
            allPayments = data.payments;
          }
        } catch (err) {
          console.warn("[История: Оплата ТО] Ошибка sync через бэкенд:", err);
        }
      }

      // 2. Если бэкенд вернул пустой список, получаем напрямую из БД Supabase
      if (allPayments.length === 0) {
        try {
          let query = supabase.from("payments").select("*").order("created_at", { ascending: false });
          if (userAccountNum) {
            query = query.eq("account_number", userAccountNum);
          } else if (userId) {
            query = query.eq("user_id", userId);
          }
          const { data, error } = await query;
          if (!error && data) allPayments = data;
        } catch (e) {
          console.warn("[История: Оплата ТО] Ошибка выборки из БД Supabase:", e);
        }
      }

      // RULE 2: Изоляция истории — новому владельцу с тем же л/с показываем только его собственные платежи
      // Все транзакции остаются в БД, но в кабинете отображаются только платежи текущего авторизованного пользователя
      return allPayments.filter((p: any) => {
        if (!p.user_id) return true; // Платёж без привязки к конкретному пользователю
        return p.user_id === userId; // Платёж текущего пользователя
      });
    },
  });

  // RULE 2: Автоматический рефетч заявок и оплат при возврате со шлюза оплаты ЮKassa
  useEffect(() => {
    const isCheckPayment = searchParams.get("check_payment") === "1" || searchParams.get("payment") === "success";
    if (!isCheckPayment) return;

    const reqId = searchParams.get("request_id");
    const accountNum = searchParams.get("account");

    console.log(`[Cabinet: ЮKassa] Возврат со шлюза оплаты. Л/С: ${accountNum || "—"}, ID заявки: ${reqId || "—"}`);

    (async () => {
      // 1. Всегда актуализируем заявки и платежи в ЛК
      if (refetchUserRequests) await refetchUserRequests();
      if (refetchTOPayments) await refetchTOPayments();

      // 2. Если оплачивался конкретный заказ оборудования / монтажа
      if (reqId) {
        try {
          if (accountNum) {
            await fetch(`/backend-api/api/payments/yookassa/sync/${accountNum}`);
          }
          const { data: updatedReq } = await supabase.from("requests").select("payment_status").eq("id", reqId).single();
          if (updatedReq?.payment_status === "paid") {
            toast({
              title: "✅ Заказ успешно оплачен!",
              description: `Оплата по заказу #${reqId} успешно зачислена. Электронный чек доступен во вкладке «Заказы».`,
            });
          } else {
            toast({
              title: "Статус оплаты заказа",
              description: "Платёж по заказу не был завершён или ожидает подтверждения банка. Средства с карты не списывались.",
            });
          }
        } catch (e) {
          console.warn("[Cabinet: ЮKassa] Ошибка проверки статуса заказа:", e);
        } finally {
          navigate("/cabinet", { replace: true });
        }
      }
    })();
  }, [searchParams, navigate, refetchUserRequests, refetchTOPayments]);

  // Стейт для просмотра и печати официального электронного чека из нижней истории (ТО или Заказы)
  const [cabinetReceipt, setCabinetReceipt] = useState<any | null>(null);

  // Вычисляем, обязателен ли этаж для ввода.
  // Обязателен, если:
  // 1. Успешно найден лицевой счет (accountSearchFound === true)
  // 2. ИЛИ в базе подключенных домов (houseAccounts) есть лицевой счет с такой же квартирой
  const isFloorRequired = !!(
    accountSearchFound || 
    (houseAccounts.length > 0 && apartment?.trim() && houseAccounts.some((acc: any) => {
      const dbApt = acc.apartment?.trim() || extractApartmentFromAddress(acc.address || "");
      return normalizeApartment(dbApt) === normalizeApartment(apartment);
    }))
  );

  // Функция сохранения личной информации и автоматической верификации профиля
  const handleSaveAndVerify = async () => {
    setSaving(true);
    console.log(`[Верификация] Инициация сохранения. Обязательность этажа (isFloorRequired): ${isFloorRequired}`); // Логирование

    // КРИТИЧЕСКИ ВАЖНО: Всегда собираем актуальный эталонный адрес на основе текущих полей ввода (Улица и Дом),
    // чтобы при редактировании существующего профиля (когда address в стейте не пустой) изменения гарантированно
    // применились и записались в БД, а также запустили реактивный поиск лицевого счета в DebtCard!
    let currentAddress = "";
    if (displayStreet?.trim() && displayHouse?.trim()) {
      const entrancePart = entrance?.trim() ? `, п ${entrance.trim()}` : "";
      currentAddress = `${selectedCity || "г. Краснодар"}, ${displayStreet.trim()}, д. ${displayHouse.trim()}${entrancePart}`;
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
    
    // Номер квартиры, подъезд, этаж и email не являются обязательными полями.
    // Если пользователь указал email, сохраняем его в стейте
    let finalEmail = (emailInput || "").trim();
    if (!finalEmail) {
      const storedUser = localStorage.getItem("user") || sessionStorage.getItem("user");
      const parsedUser = storedUser ? JSON.parse(storedUser) : null;
      finalEmail = (email || parsedUser?.email || "").trim();
      if (finalEmail) {
        setEmailInput(finalEmail);
        setEmail(finalEmail);
      }
    }
    
    // Проверка согласия с обработкой персональных данных (ФЗ-152 РФ)
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

      // Если профиль уже верифицирован, формируем заявку на согласование изменения данных!
      // Основные боевые реквизиты профиля НЕ перезаписываются, чтобы абонент сохранил старый доступ, начисления и оплату
      if (profile?.is_verified) {
        const isDataChanged = 
          fullName.trim() !== (profile.full_name || "").trim() ||
          phone.trim() !== (profile.phone || "").trim() ||
          currentAddress.trim() !== (profile.address || "").trim() ||
          apartment.trim() !== (profile.apartment || "").trim() ||
          (accountSearchInput?.trim() && accountSearchInput.trim() !== (userAccount?.account_number || ""));

        if (!isDataChanged) {
          toast({
            title: "Данные не изменились",
            description: "Вы не внесли никаких изменений в профиль.",
          });
          setEditing(false);
          setSaving(false);
          return;
        }

        console.log("[Кабинет] Зафиксированы изменения верифицированного профиля. Создаем pending_data_change...");
        const pendingChange = {
          full_name: fullName.trim(),
          phone: phone.trim(),
          address: currentAddress,
          apartment: premiseType === "private" ? "" : apartment.trim(),
          floor: premiseType === "private" ? "" : floor.trim(),
          account_number: accountSearchInput?.trim() || userAccount?.account_number || "",
          submitted_at: new Date().toISOString(),
          old_data: {
            full_name: profile.full_name || "",
            phone: profile.phone || "",
            address: profile.address || "",
            apartment: profile.apartment || "",
            account_number: userAccount?.account_number || "",
          }
        };

        // Сохраняем pending_data_change в profiles
        const { error: profErr } = await supabase
          .from("profiles")
          .update({
            pending_data_change: pendingChange,
            data_change_notification: null, // Сбрасываем старое уведомление
          })
          .eq("id", session.user.id);

        if (profErr) throw profErr;

        // Создаем карточку наряда в таблице requests для CRM
        try {
          const fullAddr = `${currentAddress}${apartment.trim() ? `, кв. ${apartment.trim()}` : ""}`;
          await supabase.from("requests").insert({
            client_id: session.user.id,
            name: fullName.trim(),
            phone: phone.trim(),
            address: fullAddr,
            apartment: premiseType === "private" ? "" : apartment.trim(),
            street: displayStreet?.trim() || null,
            house: displayHouse?.trim() || null,
            entrance: entrance?.trim() || null,
            floor: floor?.trim() || null,
            order_type: "data_change_request",
            message: `📝 Заявка на изменение данных абонента.
Старый адрес: ${profile.address || "Не указан"}, кв. ${profile.apartment || "-"}
Новый адрес: ${currentAddress}, кв. ${apartment.trim() || "-"}
Старое ФИО: ${profile.full_name || "-"} ➔ Новое ФИО: ${fullName.trim()}
Лицевой счет: ${accountSearchInput?.trim() || userAccount?.account_number || "-"}`,
            notes: JSON.stringify(pendingChange),
            status: "pending",
            priority: "medium",
          });
        } catch (reqErr) {
          console.warn("[Кабинет] Ошибка создания наряда в requests:", reqErr);
        }

        // Обновляем локальный стейт профиля
        setProfile((prev: any) => prev ? {
          ...prev,
          pending_data_change: pendingChange,
          data_change_notification: null,
        } : prev);

        // Возвращаем поля ввода формы к текущим утвержденным реквизитам абонента
        setFullName(profile.full_name || "");
        setPhone(profile.phone || "");
        setAddress(profile.address || "");
        setDisplayAddress(getDisplayAddress(profile.address || ""));
        setSelectedStreet(null);
        setApartment(profile.apartment || "");
        setFloor(profile.floor || "");

        toast({
          title: "Заявка отправлена оператору",
          description: "Запрос на изменение данных передан на согласование. До подтверждения действуют ваши прежние реквизиты.",
        });

        setEditing(false);
        setSaving(false);
        return;
      }

      console.log(`[Верификация] Запись данных профиля в БД для ID: ${session.user.id}, Email: ${finalEmail}`); // Логирование
      // 2. Записываем данные в базу данных для не верифицированного профиля
      const currentIsVerified = profile?.is_verified ?? false;
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: fullName.trim(),
          phone: phone.trim(),
          address: currentAddress, // Полный эталонный адрес (улица + дом)
          apartment: premiseType === "private" ? "" : apartment.trim(),
          floor: premiseType === "private" ? "" : floor.trim(),
          email: finalEmail || null,
          email_verified: !!finalEmail, // Подтверждаем только если email реально указан
          is_verified: currentIsVerified, // Сохраняем текущий статус верификации
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
        email: finalEmail || null,
        email_verified: !!finalEmail,
        is_verified: currentIsVerified 
      } : prev);

      // Синхронизируем Email и Address в стейтах
      setEmail(finalEmail);
      setEmailVerified(!!finalEmail);
      setAddress(currentAddress);

      toast({
        title: "Данные сохранены",
        description: currentIsVerified 
          ? "Данные профиля успешно обновлены." 
          : "Данные профиля успешно сохранены. Для получения пароля к домофону подтвердите проживание.",
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
      
      const userEmail = session.user.email || "";
      console.log(`[Сброс данных] Очистка профиля для пользователя ID: ${session.user.id}, email: ${userEmail}`);
      
      // RULE 2: Очищаем только персональные данные профиля пользователя в таблице profiles.
      // Все транзакции (payments), наряды (requests) и архивные документы сохраняются в БД.
      const { error } = await supabase
        .from("profiles")
        .update({ 
          full_name: "", 
          phone: "", 
          address: "", 
          apartment: "", 
          floor: "", 
          email: userEmail, 
          email_verified: true, 
          is_verified: false,
          verification_status: "unverified",
          verification_document_url: null,
          verification_document_type: null,
          verification_reject_reason: null,
          verification_submitted_at: null,
          verified_at: null,
          verified_by: null,
        })
        .eq("id", session.user.id);
        
      if (error) throw error;
      
      // Обновляем локальный стейт профиля
      setProfile((prev: any) => prev ? { 
        ...prev, 
        full_name: "", 
        phone: "", 
        address: "", 
        apartment: "", 
        floor: "", 
        email: userEmail, 
        email_verified: true, 
        is_verified: false,
        verification_status: "unverified",
        verification_document_url: null,
        verification_document_type: null,
        verification_reject_reason: null,
        verification_submitted_at: null,
        verified_at: null,
        verified_by: null,
      } : prev);
      
      // Сбрасываем поля формы
      setFullName(""); 
      setPhone(""); 
      setAddress(""); 
      setDisplayAddress(""); 
      setSelectedStreet(null); 
      setApartment(""); 
      setFloor(""); 
      setEntrance("");
      setEntranceSuggestions([]);
      setHouseAccounts([]);
      setEmail(userEmail); 
      setEmailInput(userEmail); 
      setEmailVerified(true);
      setEditing(false);

      // Сбрасываем привязанный лицевой счет и локальные списки оплат
      setUserAccount(null);
      setAccountSearchInput("");
      setAccountSearchFound(false);
      setAccountSearchError(null);
      setOnlinePayments([]);

      // Очищаем кэш запросов истории, чтобы новый профиль отображался с чистого листа
      queryClient.removeQueries({ queryKey: ["user-requests"] });
      queryClient.removeQueries({ queryKey: ["user-to-payments"] });
      queryClient.invalidateQueries({ queryKey: ["user-requests"] });
      queryClient.invalidateQueries({ queryKey: ["user-to-payments"] });

      toast({ 
        title: "Данные профиля очищены", 
        description: "Ваш личный кабинет сброшен. Вы можете заполнить данные заново с чистого листа." 
      });
    } catch (e: any) {
      console.error("[Сброс данных] Ошибка:", e);
      toast({ title: "Ошибка сброса данных", description: e.message, variant: "destructive" });
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
              className={`flex flex-wrap items-center gap-2 ${
                isVisible.header ? 'opacity-100' : 'opacity-0'
              } transition-opacity duration-700 delay-300`}
            >
              {/* Кнопка быстрого перехода в CRM Панель управления (FSM) */}
              {isFSMUser && (
                <ShinyButton 
                  onClick={() => navigate("/fsm")} 
                  className="py-1 px-3 text-xs rounded-xl h-9 bg-blue-600/10 text-blue-600 hover:bg-blue-600/20 dark:bg-blue-500/10 dark:text-blue-400 border border-blue-500/20"
                >
                  <LayoutDashboard className="h-3.5 w-3.5 mr-1" />
                  CRM Панель
                </ShinyButton>
              )}
              {/* Кнопка быстрого перехода в Админ панель */}
              {isAdmin && (
                <ShinyButton 
                  onClick={() => navigate("/admin")} 
                  className="py-1 px-3 text-xs rounded-xl h-9 bg-purple-600/10 text-purple-600 hover:bg-purple-600/20 dark:bg-purple-500/10 dark:text-purple-400 border border-purple-500/20"
                >
                  <Shield className="h-3.5 w-3.5 mr-1" />
                  Админ панель
                </ShinyButton>
              )}
              {/* Кнопка выхода из системы */}
              <ShinyButton onClick={handleLogout} className="py-1 px-3 text-xs rounded-xl h-9">
                <LogOut className="h-3.5 w-3.5 mr-1" />
                Выйти
              </ShinyButton>
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



            <Card className="glass-premium rounded-[24px] border-none shadow-xl">
              <CardHeader className="pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <CardTitle className="text-xl font-bold text-foreground font-display">Личная информация</CardTitle>
                      
                      {/* RULE 2: Статус верификации профиля жильца */}
                      {profile?.is_verified ? (
                        <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 text-xs px-2.5 py-0.5 font-semibold flex items-center gap-1.5 shadow-xs">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                          <span>Информация подтверждена</span>
                        </Badge>
                      ) : profile?.verification_status === "pending" ? (
                        <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 text-xs px-2.5 py-0.5 font-semibold flex items-center gap-1.5 animate-pulse shadow-xs">
                          <Clock className="h-3.5 w-3.5 text-amber-600" />
                          <span>Документы на проверке</span>
                        </Badge>
                      ) : profile?.verification_status === "rejected" ? (
                        <Badge variant="destructive" className="text-xs px-2.5 py-0.5 font-semibold flex items-center gap-1.5 shadow-xs">
                          <XCircle className="h-3.5 w-3.5" />
                          <span>Верификация отклонена</span>
                        </Badge>
                      ) : (
                        <Badge className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 text-xs px-2.5 py-0.5 font-semibold flex items-center gap-1.5 shadow-xs">
                          <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                          <span>Информация не подтверждена</span>
                        </Badge>
                      )}
                    </div>

                    <CardDescription className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                      {isLocked
                        ? "Данные профиля подтверждены. Чтобы внести изменения — воспользуйтесь кнопкой «Изменить персональные данные» внизу карточки."
                        : profile?.verification_status === "pending"
                        ? "Ваши документы проверяются диспетчером. Доступ к услугам откроется сразу после проверки."
                        : profile?.verification_status === "rejected"
                        ? `Причина отклонения: ${profile?.verification_reject_reason || "Документ не соответствует требованиям"}. Пожалуйста, загрузите подтверждающий документ повторно.`
                        : "Пожалуйста, заполните обязательные графы для отправки профиля на верификацию."}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-5 pt-5">
                
                {/* 0. СИСТЕМНОЕ ПИСЬМО-УВЕДОМЛЕНИЕ: Ответ оператора CRM по заявке на изменение данных */}
                {profile?.data_change_notification && (
                  <div className={cn(
                    "p-4 rounded-2xl border flex items-start gap-3.5 text-left animate-in fade-in slide-in-from-top-2 duration-300 shadow-sm",
                    profile.data_change_notification.type === "approved"
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-900 dark:text-emerald-200"
                      : "bg-red-500/10 border-red-500/30 text-red-900 dark:text-red-200"
                  )}>
                    {profile.data_change_notification.type === "approved" ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 text-xs">
                      <div className="font-bold text-sm mb-1 flex items-center justify-between">
                        <span>
                          {profile.data_change_notification.type === "approved"
                            ? "✅ Ваши персональные данные успешно обновлены"
                            : "❌ Заявка на изменение данных отклонена"}
                        </span>
                        {profile.data_change_notification.timestamp && (
                          <span className="text-[10px] text-muted-foreground font-normal">
                            {new Date(profile.data_change_notification.timestamp).toLocaleDateString("ru-RU")}
                          </span>
                        )}
                      </div>
                      <p className="leading-relaxed">
                        {profile.data_change_notification.message || (
                          profile.data_change_notification.type === "approved"
                            ? "Оператор проверил и утвердил новые реквизиты. Все данные профиля обновлены."
                            : `Причина: ${profile.data_change_notification.reason || "Несоответствие данных"}. Ваши прежние реквизиты сохранены.`
                        )}
                      </p>
                      <div className="mt-2.5 flex justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs px-3.5 rounded-lg border-current/20 hover:bg-current/10 font-semibold"
                          onClick={async () => {
                            try {
                              console.log("[Кабинет] Жилец подтвердил прочтение письма об изменении данных");
                              await supabase.from("profiles").update({ data_change_notification: null }).eq("id", userId);
                              setProfile((prev: any) => prev ? { ...prev, data_change_notification: null } : prev);
                            } catch (e) {
                              console.warn("[Кабинет] Ошибка закрытия уведомления:", e);
                            }
                          }}
                        >
                          Понятно
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* 0.1. СТАТУС НАХОЖДЕНИЯ ЗАЯВКИ НА ПРОВЕРКЕ У ОПЕРАТОРА */}
                {profile?.pending_data_change && (
                  <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3.5 text-left animate-in fade-in duration-300">
                    <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5 animate-pulse" />
                    <div className="flex-1 text-xs">
                      <div className="font-bold text-amber-800 dark:text-amber-300 text-sm mb-1">
                        ⏳ Заявка на изменение данных находится на проверке
                      </div>
                      <div className="text-amber-700 dark:text-amber-400 space-y-1">
                        <p>Вы отправили оператору запрос на смену реквизитов:</p>
                        {profile.pending_data_change.full_name && (
                          <p>• ФИО: <span className="font-semibold text-foreground">{profile.pending_data_change.full_name}</span></p>
                        )}
                        {profile.pending_data_change.address && (
                          <p>• Адрес: <span className="font-semibold text-foreground">{profile.pending_data_change.address}{profile.pending_data_change.apartment ? `, кв. ${profile.pending_data_change.apartment}` : ""}</span></p>
                        )}
                        {profile.pending_data_change.account_number && (
                          <p>• Лицевой счёт: <span className="font-semibold font-mono text-foreground">{profile.pending_data_change.account_number}</span></p>
                        )}
                        <p className="text-[11px] text-muted-foreground mt-1.5 pt-1 border-t border-amber-500/20">
                          До момента одобрения оператором CRM действуют ваши текущие реквизиты, расчет задолженности и доступ.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* RULE 2: Состояние лицевого счёта и оплата ТО (в самом верху личной информации) */}
                {profile?.address ? (
                  <div className="space-y-2.5 pb-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                        <CreditCard className="h-4 w-4 text-emerald-600" />
                        Лицевой счёт и оплата ТО
                      </span>
                      {userAccount?.account_number && (
                        <Badge variant="outline" className="font-mono text-xs border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-bold">
                          л/с {userAccount.account_number}
                        </Badge>
                      )}
                    </div>
                    <DebtCard 
                      address={profile.address} 
                      apartment={profile.apartment || ""} 
                      fullName={profile.full_name || fullName} 
                      phone={profile.phone || phone} 
                      embedded 
                      setParentAccount={setUserAccount}
                      isVerified={profile?.is_verified === true || profile?.verification_status === "verified"}
                      userId={userId}
                      onOpenOrderDialog={(type) => {
                        setOrderType(type || "repair");
                        setIsOrderDialogOpen(true);
                      }}
                    />
                  </div>
                ) : (
                  <div className="p-4 mb-2 rounded-2xl bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-amber-500/5 border border-amber-500/30 shadow-sm text-left space-y-3 animate-in fade-in duration-300">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-start gap-2.5">
                        <div className="h-8 w-8 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                          <Wrench className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-bold text-xs sm:text-sm text-foreground flex items-center gap-1.5">
                            ⚡ Быстрый старт: подайте заявку сразу!
                          </p>
                          <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                            Вы можете сразу оставить заявку на вызов мастера или заказ оборудования — введённый адрес и имя сохранятся в вашем профиле автоматически.
                          </p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => {
                          setOrderType("repair");
                          setIsOrderDialogOpen(true);
                        }}
                        className="btn-premium-gold shrink-0 h-9 px-3.5 text-xs font-bold rounded-xl shadow-md shadow-amber-500/15 self-start sm:self-auto"
                      >
                        <Wrench className="h-3.5 w-3.5 mr-1.5" />
                        Оставить заявку ➔
                      </Button>
                    </div>
                  </div>
                )}

                {/* 1. ФИО Абонента */}
                <div className="space-y-2 text-left">
                  <div className="flex justify-between items-center">
                    <Label htmlFor="fullName" className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">👤 Полное имя (ФИО) *</Label>
                    {!isLocked && !fullName?.trim() && (
                      <span className="text-[10px] bg-amber-500/15 text-amber-700 dark:text-amber-400 font-bold px-2 py-0.5 rounded-full border border-amber-400/30">
                        Обязательно
                      </span>
                    )}
                  </div>
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Иван Иванович Иванов"
                    disabled={isLocked}
                    className={`font-medium h-10 transition-all rounded-xl placeholder-slate-400 ${
                      !isLocked && !fullName?.trim()
                        ? "border-amber-400/80 dark:border-amber-500/80 bg-amber-500/5 focus:border-amber-500"
                        : !isLocked && fullName?.trim()
                        ? "border-emerald-500/40 bg-emerald-500/5 dark:bg-emerald-950/10"
                        : "bg-white/40 dark:bg-slate-900/40 border-slate-200 dark:border-slate-700"
                    }`}
                  />
                </div>

                {/* 2. Контактный Телефон */}
                <div className="space-y-2 text-left">
                  <div className="flex justify-between items-center">
                    <Label htmlFor="phone" className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">📞 Контактный телефон *</Label>
                    {!isLocked && !phone?.trim() ? (
                      <span className="text-[10px] bg-amber-500/15 text-amber-700 dark:text-amber-400 font-bold px-2 py-0.5 rounded-full border border-amber-400/30">
                        Обязательно
                      </span>
                    ) : (
                      !address && (
                        <span className="text-[10px] text-primary font-medium">Автопоиск адреса ⚡</span>
                      )
                    )}
                  </div>
                  <Input
                    id="phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    onBlur={() => {
                      if (!address && phone && phone.replace(/\D/g, "").length >= 10) {
                        searchSubscriberByPhone(phone);
                      }
                    }}
                    placeholder="+7 (999) 123-45-67"
                    disabled={isLocked}
                    className={`font-medium h-10 transition-all rounded-xl placeholder-slate-400 font-mono ${
                      !isLocked && !phone?.trim()
                        ? "border-amber-400/80 dark:border-amber-500/80 bg-amber-500/5 focus:border-amber-500"
                        : !isLocked && phone?.trim()
                        ? "border-emerald-500/40 bg-emerald-500/5 dark:bg-emerald-950/10"
                        : "bg-white/40 dark:bg-slate-900/40 border-slate-200 dark:border-slate-700"
                    }`}
                  />
                </div>

                {/* 3. Электронная почта (необязательно) */}
                <div className="space-y-2 text-left">
                  <div className="flex justify-between items-center">
                    <Label htmlFor="emailInput" className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">📧 Электронная почта (Email)</Label>
                    <span className="text-[10px] text-muted-foreground font-normal">необязательно (по желанию)</span>
                  </div>
                  <div className="relative">
                    <Input
                      id="emailInput"
                      type="email"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      placeholder="your-email@example.com"
                      disabled={isLocked}
                      className="bg-white/40 dark:bg-slate-900/40 border-slate-200 dark:border-slate-700 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 font-medium h-10 transition-all rounded-xl placeholder-slate-400 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <span className="absolute right-3 top-2.5 text-[9px] text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200/50 dark:border-slate-700 font-semibold select-none">
                      По желанию
                    </span>
                  </div>
                </div>

                {/* 3.5. БЛОК БЫСТРОГО ВВОДА ЛИЦЕВОГО СЧЁТА — показываем только в режиме редактирования */}
                {!isLocked && (
                  <div className="space-y-3 text-left animate-in fade-in slide-in-from-top-2 duration-300">
                    {/* Информационный баннер с инструкцией и премиальным градиентным контуром */}
                    <div className="p-[1.5px] rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-500 shadow-md shadow-amber-500/5 dark:shadow-amber-500/2">
                      <div className="flex items-start gap-3.5 p-4 rounded-[14px] bg-white/95 dark:bg-slate-900/95 backdrop-blur-md">
                        {/* Иконка подсказки */}
                        <div className="p-2 rounded-xl bg-amber-500/10 shrink-0 mt-0.5">
                          <CreditCard className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-bold text-blue-700 dark:text-amber-400 mb-1 flex items-center gap-1.5">
                            <span>💡</span> Знаете свой лицевой счёт?
                          </p>
                          {/* Текст баннера: на светлой теме text-slate-900 (черный) с выделением text-blue-600 (синий), на темной теме text-slate-200 (белый) с выделением text-amber-400 (желтый) */}
                          <p className="text-[10px] text-slate-900 dark:text-slate-200 leading-relaxed">
                            Введите его ниже — адрес заполнится автоматически. Лицевой счёт можно найти
                            в <span className="font-bold text-blue-600 dark:text-amber-400">квитанции об оплате</span> или
                            узнать, позвонив диспетчеру.{" "}
                            <span className="text-blue-600 dark:text-amber-400 font-bold">Можно вводить без ведущих нулей</span> — например, «654» вместо «0000000654».
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Поле ввода лицевого счёта */}
                    <div className="flex gap-2 items-start">
                      <div className="flex-1 relative">
                        <Label
                          htmlFor="accountSearchInput"
                          className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1 mb-1.5"
                        >
                          🔢 Лицевой счёт (необязательно)
                        </Label>
                        <Input
                          id="accountSearchInput"
                          value={accountSearchInput}
                          onChange={(e) => {
                            // Принимаем только цифры и пробелы для удобства ввода
                            setAccountSearchInput(e.target.value);
                            // Сбрасываем статус поиска при новом вводе
                            setAccountSearchFound(false);
                            setAccountSearchError(null);
                          }}
                          onKeyDown={(e) => {
                            // Поиск по нажатию Enter для удобства
                            if (e.key === "Enter") {
                              e.preventDefault();
                              searchByAccountNumber();
                            }
                          }}
                          placeholder="Например: 654 или 0000000654"
                          className={`bg-white/40 dark:bg-slate-900/40 border-slate-200 dark:border-slate-700 focus:ring-2 font-medium h-10 transition-all rounded-xl placeholder-slate-400 ${
                            accountSearchFound
                              ? "border-green-400 focus:border-green-500 focus:ring-green-500/20"
                              : accountSearchError
                              ? "border-red-400 focus:border-red-500 focus:ring-red-500/20"
                              : "focus:border-amber-500 focus:ring-amber-500/20"
                          }`}
                          disabled={accountSearchLoading}
                        />
                        {/* Иконка статуса справа */}
                        {accountSearchFound && (
                          <CheckCircle className="absolute right-3 top-[2.1rem] h-4 w-4 text-green-500 pointer-events-none" />
                        )}
                        {accountSearchLoading && (
                          <Loader2 className="absolute right-3 top-[2.1rem] h-4 w-4 animate-spin text-primary pointer-events-none" />
                        )}
                      </div>
                      {/* Кнопка «Найти» */}
                      <Button
                        type="button"
                        onClick={searchByAccountNumber}
                        disabled={accountSearchLoading || !accountSearchInput.trim()}
                        className="mt-7 h-10 px-4 btn-premium-gold hover:shadow-gold-glow shrink-0 rounded-xl font-semibold"
                      >
                        {accountSearchLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          "Найти"
                        )}
                      </Button>
                    </div>

                    {/* Сообщение об успехе */}
                    {accountSearchFound && (
                      <div className="flex items-center gap-2 text-[11px] text-green-700 dark:text-green-300 bg-green-50/80 dark:bg-green-950/30 border border-green-200/60 dark:border-green-800/40 px-3 py-2 rounded-xl animate-in fade-in duration-300">
                        <CheckCircle className="h-3.5 w-3.5 shrink-0" />
                        <span>Адрес успешно найден и заполнен автоматически. Проверьте данные ниже.</span>
                      </div>
                    )}

                    {/* Сообщение об ошибке */}
                    {accountSearchError && (
                      <div className="flex items-start gap-2 text-[11px] text-red-600 dark:text-red-400 bg-red-50/80 dark:bg-red-950/30 border border-red-200/60 dark:border-red-800/40 px-3 py-2 rounded-xl animate-in fade-in duration-300">
                        <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                        <span>{accountSearchError}</span>
                      </div>
                    )}

                    {/* Разделительная линия */}
                    <div className="flex items-center gap-3 py-1">
                      <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
                      <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap">или заполните адрес вручную</span>
                      <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
                    </div>
                  </div>
                )}



                {/* 5. Раздельные поля Улицы и Дома с DaData-автокомплитом */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Поле «Улица» */}
                  <div className="space-y-2 relative text-left">
                    <div className="flex justify-between items-center">
                      <Label htmlFor="street" className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">🛣️ Улица *</Label>
                      {!isLocked && !displayStreet?.trim() && (
                        <span className="text-[10px] bg-amber-500/15 text-amber-700 dark:text-amber-400 font-bold px-2 py-0.5 rounded-full border border-amber-400/30">
                          Обязательно
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <Input
                        id="street"
                        value={displayStreet}
                        onChange={(e) => handleStreetInputChange(e.target.value)}
                        onFocus={() => { if (!isLocked) setShowStreetSuggestions(true); }}
                        onBlur={() => setTimeout(() => setShowStreetSuggestions(false), 250)}
                        placeholder="Начните вводить название улицы"
                        disabled={isLocked}
                        className={`font-medium h-10 transition-all rounded-xl placeholder-slate-400 ${
                          !isLocked && !displayStreet?.trim()
                            ? "border-amber-400/80 dark:border-amber-500/80 bg-amber-500/5 focus:border-amber-500"
                            : !isLocked && displayStreet?.trim()
                            ? "border-emerald-500/40 bg-emerald-500/5 dark:bg-emerald-950/10"
                            : "bg-white/40 dark:bg-slate-900/40 border-slate-200 dark:border-slate-700"
                        }`}
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
                    <div className="flex justify-between items-center">
                      <Label htmlFor="house" className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">🏢 Номер дома *</Label>
                      {!isLocked && !displayHouse?.trim() && (
                        <span className="text-[10px] bg-amber-500/15 text-amber-700 dark:text-amber-400 font-bold px-2 py-0.5 rounded-full border border-amber-400/30">
                          Обязательно
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <Input
                        id="house"
                        value={displayHouse}
                        onChange={(e) => handleHouseInputChange(e.target.value)}
                        onFocus={() => { if (!isLocked && displayStreet?.trim()) setShowHouseSuggestions(true); }}
                        onBlur={() => setTimeout(() => setShowHouseSuggestions(false), 250)}
                        placeholder={displayStreet?.trim() ? "Введите номер дома" : "Сначала введите улицу"}
                        disabled={isLocked || !displayStreet?.trim()}
                        className={`font-medium h-10 transition-all rounded-xl placeholder-slate-400 disabled:opacity-50 disabled:cursor-not-allowed ${
                          !isLocked && !displayHouse?.trim()
                            ? "border-amber-400/80 dark:border-amber-500/80 bg-amber-500/5 focus:border-amber-500"
                            : !isLocked && displayHouse?.trim()
                            ? "border-emerald-500/40 bg-emerald-500/5 dark:bg-emerald-950/10"
                            : "bg-white/40 dark:bg-slate-900/40 border-slate-200 dark:border-slate-700"
                        }`}
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

                {/* RULE 2: Информационная подсказка скрывается, как только указаны подъезд и квартира */}
                {!isLocked && (displayStreet?.trim() && displayHouse?.trim()) && (!entrance?.trim() || !apartment?.trim()) && (
                  <div className="flex items-start gap-2.5 text-[11px] text-blue-700 dark:text-blue-300 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/50 dark:border-blue-800/30 px-3.5 py-3 rounded-xl animate-in fade-in duration-300 text-left my-2">
                    <Info className="h-4 w-4 shrink-0 mt-0.5 text-blue-500" />
                    <div>
                      <span className="font-bold">Пожалуйста, укажите полные данные</span> (подъезд и квартира), если они у вас есть. Это позволит нам значительно быстрее реагировать на ваши заявки по ремонту и доставке ключей.
                    </div>
                  </div>
                )}

                {/* Поля Подъезд, Квартира и Этаж в единой сетке */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 animate-in fade-in duration-300">
                  {/* 5.5. Помещение (Подъезд) */}
                  <div className="space-y-2 relative text-left">
                    <Label htmlFor="entrance" className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                      <DoorOpen className="h-3.5 w-3.5 text-primary/70 shrink-0" />
                      Номер подъезда
                    </Label>
                    <Input
                      id="entrance"
                      value={entrance}
                      onChange={(e) => setEntrance(e.target.value)}
                      onFocus={() => {
                        if (!isLocked) {
                          fetchApartmentSuggestions(address);
                          setShowEntranceSuggestions(true);
                        }
                      }}
                      onBlur={() => setTimeout(() => setShowEntranceSuggestions(false), 200)}
                      placeholder={displayHouse?.trim() ? (entranceSuggestions.length > 0 ? "Выберите подъезд" : "Номер подъезда") : "Сначала введите дом"}
                      disabled={isLocked || !displayStreet?.trim() || !displayHouse?.trim()}
                      className="bg-white/40 dark:bg-slate-900/40 border-slate-200 dark:border-slate-700 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 font-medium h-10 transition-all rounded-xl placeholder-slate-400 disabled:opacity-50 disabled:cursor-not-allowed"
                    />

                    {/* Всплывающая сетка доступных подъездов */}
                    {showEntranceSuggestions && entranceSuggestions.length > 0 && (
                      <div className="absolute z-50 w-full mt-1.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200/50 dark:border-slate-700/50 rounded-2xl shadow-2xl max-h-48 overflow-y-auto p-3 animate-in fade-in-50 slide-in-from-top-1 duration-200">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                          <DoorOpen className="h-3.5 w-3.5 text-primary" />
                          <span>Выберите подъезд в этом доме:</span>
                        </div>
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                          {entranceSuggestions.map((ent, index) => (
                            <button
                              key={index}
                              type="button"
                              className={`px-1.5 py-1.5 text-xs text-center rounded-lg border transition-all focus:outline-none font-semibold ${
                                entrance === ent
                                  ? "bg-amber-500 text-white border-amber-500 scale-102"
                                  : "border-slate-200 dark:border-slate-700 hover:bg-amber-500/10 hover:border-amber-500/30 text-foreground"
                              }`}
                              onClick={() => {
                                setEntrance(ent);
                                setShowEntranceSuggestions(false);
                              }}
                            >
                              Подъезд {ent}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 6. Помещение (Квартира/Офис) */}
                  <div className="space-y-2 relative text-left">
                    <Label htmlFor="apartment" className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                      <Home className="h-3.5 w-3.5 text-primary/70 shrink-0" />
                      Квартира / Офис / Помещение
                    </Label>
                    <Input
                      id="apartment"
                      value={apartment}
                      onChange={(e) => {
                        setApartment(e.target.value);
                        setFloor(""); // Сбрасываем этаж при изменении квартиры вручную
                      }}
                      onFocus={() => {
                        if (!isLocked) {
                          fetchApartmentSuggestions(address);
                          setShowApartmentSuggestions(true);
                        }
                      }}
                      onBlur={() => setTimeout(() => setShowApartmentSuggestions(false), 200)}
                      placeholder={
                        !displayHouse?.trim() 
                          ? "Сначала введите дом" 
                          : "Квартира или офис"
                      }
                      disabled={isLocked || !displayStreet?.trim() || !displayHouse?.trim()}
                      className="bg-white/40 dark:bg-slate-900/40 border-slate-200 dark:border-slate-700 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 font-medium h-10 transition-all rounded-xl placeholder-slate-400 disabled:opacity-50 disabled:cursor-not-allowed"
                    />

                    {/* Всплывающая сетка доступных квартир */}
                    {showApartmentSuggestions && apartmentSuggestions.length > 0 && (
                      <div className="absolute z-50 w-full mt-1.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200/50 dark:border-slate-700/50 rounded-2xl shadow-2xl max-h-48 overflow-y-auto p-3 animate-in fade-in-50 slide-in-from-top-1 duration-200">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                          <DoorOpen className="h-3.5 w-3.5 text-primary" />
                          <span>
                            {entrance ? `Квартиры подъезда ${entrance}:` : "Подключенные абоненты в этом доме:"}
                          </span>
                        </div>
                        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-1.5">
                          {apartmentSuggestions.map((apt, index) => (
                            <button
                              key={index}
                              type="button"
                              className="px-1.5 py-1.5 text-xs text-center rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-amber-500/10 hover:border-amber-500/30 transition-all focus:bg-amber-500/10 focus:outline-none font-semibold text-foreground hover:scale-105 active:scale-95"
                              onClick={() => {
                                setApartment(apt);
                                setFloor(""); // Сбрасываем этаж при выборе квартиры из подсказок
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

                  {/* 7. Этаж (необязательно) */}
                  <div className="space-y-2 text-left">
                    <Label htmlFor="floor" className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5 text-primary/70 shrink-0" />
                      Этаж (необязательно)
                    </Label>
                    <Input
                      id="floor"
                      value={floor}
                      onChange={(e) => setFloor(e.target.value)}
                      placeholder="Номер этажа"
                      disabled={isLocked || !displayStreet?.trim() || !displayHouse?.trim()}
                      className="bg-white/40 dark:bg-slate-900/40 border-slate-200 dark:border-slate-700 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 font-medium h-10 transition-all rounded-xl placeholder-slate-400 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  </div>
                </div>

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
                    <Label htmlFor="agreedToTerms" className="text-[11px] text-muted-foreground leading-normal select-none font-semibold">
                      Я соглашаюсь на{" "}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          openLegalDoc("data-consent");
                        }}
                        className="text-primary hover:underline font-bold focus:outline-none inline cursor-pointer text-left"
                      >
                        обработку персональных данных
                      </button>{" "}
                      в соответствии с ФЗ-152 РФ и принимаю условия{" "}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          openLegalDoc("public-offer");
                        }}
                        className="text-primary hover:underline font-bold focus:outline-none inline cursor-pointer text-left"
                      >
                        публичной оферты
                      </button>{" "}
                      при использовании сервиса «Домофондар».
                    </Label>
                  </div>
                )}

                {/* 9. Кнопки сохранения / отмены данных профиля */}
                {!isLocked && (() => {
                  // Валидируем форму перед активацией кнопки сохранения (почта и этаж не обязательны).
                  const isFormValid = !!(
                    fullName?.trim() &&
                    phone?.trim() &&
                    displayStreet?.trim() &&
                    displayHouse?.trim() &&
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
                          {profile?.is_verified ? "Сохранить изменения" : "Сохранить данные профиля"}
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
                          // Сбрасываем стейты поиска по лицевому счёту
                          setAccountSearchInput("");
                          setAccountSearchFound(false);
                          setAccountSearchError(null);
                          // Сбрасываем подъезд к сохраненному в профиле значению
                          const entMatch = (profile?.address || "").match(/,\s*(?:п(?:одъезд)?\.?\s*(\d+))/i);
                          setEntrance(entMatch ? entMatch[1] : "");
                          setEntranceSuggestions([]);
                          setHouseAccounts([]);
                        }} className="font-semibold rounded-xl h-11 hover:bg-slate-50 dark:hover:bg-slate-900">
                          Отмена
                        </Button>
                      )}
                    </div>
                  );
                })()}

                {/* 10. Кнопка подтверждения данных для не верифицированного профиля */}
                {!profile?.is_verified && (
                  <div className="pt-2">
                    {profile?.verification_status === "pending" ? (
                      <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs flex items-center gap-2.5 text-amber-800 dark:text-amber-300 animate-in fade-in duration-300">
                        <Clock className="h-4 w-4 shrink-0 text-amber-600 animate-pulse" />
                        <span>Документы находятся на проверке у диспетчера. Обычно это занимает до 1 рабочего дня.</span>
                      </div>
                    ) : (
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-slate-50/50 dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-800/60">
                        <div className="text-left space-y-0.5">
                          <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                            <ShieldCheck className="h-4 w-4 text-primary" />
                            <span>Подтверждение проживания</span>
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {profile?.verification_status === "rejected"
                              ? `Верификация отклонена: ${profile?.verification_reject_reason || "документ не принят"}. Прикрепите новый документ.`
                              : "Загрузите фото или скан документа, подтверждающего проживание или собственность."}
                          </p>
                        </div>
                        <ShinyButton
                          type="button"
                          onClick={() => {
                            // RULE 2: Строгая проверка заполнения профиля перед открытием окна верификации
                            const missing: string[] = [];
                            if (!profile?.full_name?.trim() && !fullName?.trim()) missing.push("ФИО");
                            if (!profile?.phone?.trim() && !phone?.trim()) missing.push("Телефон");
                            if (!profile?.address?.trim() && (!displayStreet?.trim() || !displayHouse?.trim())) missing.push("Адрес проживания");

                            if (missing.length > 0) {
                              console.warn("[Верификация] Попытка открыть диалог с незаполненными данными:", missing);
                              toast({
                                title: "Заполните данные профиля",
                                description: `Перед отправкой документов заполните и сохраните в профиле: ${missing.join(", ")}.`,
                                variant: "destructive",
                              });
                              return;
                            }
                            setIsVerificationDialogOpen(true);
                          }}
                          className="px-5 py-2 rounded-xl h-10 flex items-center justify-center gap-1.5 font-bold shrink-0 text-xs shadow-md"
                        >
                          <ShieldCheck className="h-4 w-4" />
                          <span>{profile?.verification_status === "rejected" ? "Загрузить повторно" : "Подтвердить данные"}</span>
                        </ShinyButton>
                      </div>
                    )}
                  </div>
                )}

                {/* 10. КНОПКА «ИЗМЕНИТЬ ПЕРСОНАЛЬНЫЕ ДАННЫЕ» (перенесена в нижнюю часть раздела) */}
                {profile?.is_verified && !editing && (
                  <div className="pt-4 border-t border-slate-100 dark:border-slate-800/60 flex flex-col items-center gap-2">
                    <AlertDialog open={isConfirmChangeDialogOpen} onOpenChange={setIsConfirmChangeDialogOpen}>
                      <AlertDialogTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          className="rounded-xl font-bold border-amber-500/40 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10 h-10 px-5 gap-2 shadow-xs transition-all"
                        >
                          <Pencil className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                          <span>Изменить персональные данные</span>
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="glass-premium border-none rounded-3xl shadow-2xl p-6">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="text-lg font-bold text-foreground font-display flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
                            <span>Изменение персональных данных</span>
                          </AlertDialogTitle>
                          <AlertDialogDescription className="text-xs text-slate-600 dark:text-slate-300 mt-2 leading-relaxed space-y-2 text-left">
                            <p>
                              Внимание! Изменение персональных данных (адрес, лицевой счёт, ФИО) потребует обязательной повторной проверки и верификации оператором.
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              До момента подтверждения оператором продолжают действовать ваши текущие реквизиты, расчет задолженности и доступ.
                            </p>
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter className="mt-4 gap-2">
                          <AlertDialogCancel className="font-semibold rounded-xl h-10">
                            Отмена
                          </AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={() => {
                              console.log("[Кабинет] Жилец подтвердил предупреждение и открыл форму редактирования профиля");
                              setEditing(true);
                              setAgreedToTerms(true);
                            }} 
                            className="bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-xl h-10"
                          >
                            Да, продолжить
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                )}

                {/* 11. Маленькая неброская кнопка сброса профиля */}
                {(profile?.is_verified || profile?.full_name || profile?.address) && (
                  <div className="pt-2 flex justify-center">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <button
                          type="button"
                          className="text-[11px] text-muted-foreground/50 hover:text-destructive/80 transition-colors inline-flex items-center gap-1 cursor-pointer py-1 px-2.5 rounded-lg hover:bg-slate-100/60 dark:hover:bg-slate-800/60 select-none font-normal"
                        >
                          <Trash2 className="h-3 w-3 opacity-60" />
                          <span>Сбросить данные профиля</span>
                        </button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="glass-premium border-none rounded-3xl shadow-2xl p-6">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="text-lg font-bold text-foreground font-display flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
                            <span>Удалить данные из личного кабинета?</span>
                          </AlertDialogTitle>
                          <AlertDialogDescription className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed space-y-2 text-left">
                            <p>
                              Внимание! Все привязанные данные профиля (ФИО, адрес, телефон, помещение) будут безвозвратно удалены из вашего личного кабинета, а статус верификации аннулирован.
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              Все ранее проведённые транзакции, наряды и документы сохраняются в архиве системы «Домофондар».
                            </p>
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter className="mt-4 gap-2">
                          <AlertDialogCancel className="font-semibold rounded-xl h-10 border border-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900">
                            Отмена
                          </AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={handleClearData} 
                            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground font-semibold rounded-xl h-10"
                          >
                            Да, удалить данные
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Доступ к системе: только информация и оплата по умному домофону (больше НЕ исчезает при редактировании!) */}
            <Card className="glass-premium rounded-[24px] border-none shadow-lg">
              <CardHeader className="pb-4 border-b border-slate-100 dark:border-slate-800">
                <CardTitle className="flex items-center gap-2 font-display text-lg font-bold text-slate-800 dark:text-slate-100">
                  <Shield className="h-5 w-5 text-amber-500 animate-pulse" />
                  Доступ к системе (Умный домофон)
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  {profile?.address
                    ? "Информация о подключении к умному домофону и оплата доступа к личному кабинету"
                    : "Доступ к домофону и оплата отображаются после сохранения данных профиля."}
                </CardDescription>
              </CardHeader>
              {profile?.address ? (
                <CardContent className="space-y-4 pt-4">
                  {/* Удаленный доступ к домофону: статус подключения, приложение и оплата подписки на личные кабинеты */}
                  <RemoteAccessCard 
                    address={profile.address} 
                    apartment={profile.apartment || ""} 
                    accountNumber={userAccount?.account_number} 
                    userId={userId || undefined} 
                    profile={profile}
                    hasSmartIntercom={!!currentMatchedEntrance?.has_smart_intercom}
                    entranceNumber={currentMatchedEntrance?.entrance || userAccount?.entrance || profile?.entrance || (profile.address?.match(/(?:^|,|\s)(?:п|подъезд|под\.?|п\.)\s*(\d+)/i)?.[1])}
                    onOpenOrderDialog={() => {
                      setOrderType("order");
                      if (!isCabinetPurchased) {
                        setIsCabinetSetupChecked(true);
                      }
                      setIsOrderDialogOpen(true);
                    }}
                    onOpenVerification={() => {
                      const missing: string[] = [];
                      if (!profile?.full_name?.trim() && !fullName?.trim()) missing.push("ФИО");
                      if (!profile?.phone?.trim() && !phone?.trim()) missing.push("Телефон");
                      if (!profile?.address?.trim() && (!displayStreet?.trim() || !displayHouse?.trim())) missing.push("Адрес проживания");

                      if (missing.length > 0) {
                        console.warn("[Верификация: RemoteAccess] Незаполненные поля:", missing);
                        toast({
                          title: "Заполните данные профиля",
                          description: `Перед отправкой документов заполните и сохраните в профиле: ${missing.join(", ")}.`,
                          variant: "destructive",
                        });
                        return;
                      }
                      setIsVerificationDialogOpen(true);
                    }}
                    hasLk={userAccount?.has_lk || false}
                    isCabinetPurchased={isCabinetPurchased}
                    onCredentialsLoaded={(c) => {
                      console.log("[Cabinet: Домофон] Получены учетные данные домофона квартиры:", c);
                      setApartmentIntercomCred(c);
                      if (c?.id) {
                        setHasEntranceCredentials(true);
                      }
                    }}
                  />
                </CardContent>
              ) : (
                <CardContent className="pt-4 pb-5">
                  <div className="p-4 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/30 text-center space-y-1">
                    <p className="text-xs font-semibold text-foreground">
                      Данные профиля ещё не сохранены
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Для доступа к умному домофону и личному кабинету заполните и сохраните данные адреса выше.
                    </p>
                  </div>
                </CardContent>
              )}
            </Card>

            {/* --- РАЗДЕЛ: ИСТОРИЯ ВАШИХ ОБРАЩЕНИЙ И ОПЛАТ (в самом низу страницы) --- */}
            {(() => {
              // Фильтруем заявки на 2 категории:
              // 1. Обычные заявки (ремонт, диагностика, бесплатные)
              const regularRequests = (userRequests || []).filter((r: any) => 
                r.status !== "draft" && r.order_type !== "equipment_order" && (!Number(r.payment_amount) || Number(r.payment_amount) === 0)
              );
              // 2. Заказы оборудования / платных услуг
              const orderRequests = (userRequests || []).filter((r: any) => 
                r.status !== "draft" && (r.order_type === "equipment_order" || Number(r.payment_amount) > 0)
              );
              // 3. Платежи за техническое обслуживание (ТО) - строго абонентская плата, без заказов оборудования и услуг
              const maintenancePayments = (toPayments || []).filter((p: any) => {
                const isOrder = !!p.request_id || 
                                p.metadata?.is_order === true || 
                                p.metadata?.is_order === "true" || 
                                !!p.metadata?.order_data ||
                                (p.description && p.description.toLowerCase().includes("заказ"));
                return !isOrder;
              });

              console.log("[ЛК Кабинет: История] Отрисовка блока с 3 вкладками:", {
                regular: regularRequests.length,
                orders: orderRequests.length,
                to: maintenancePayments.length,
              });

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

              // Форматируем статус оплаты для заказов
              const getPaymentBadge = (req: any) => {
                const isPaid = req.payment_status === "paid";
                const isOnSite = req.payment_status === "on_site";
                const isPending = req.payment_status === "pending";

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
                <Card className="glass-premium border-none rounded-[24px] shadow-2xl animate-in fade-in-50 duration-300">
                  <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left">
                      <div>
                        <CardTitle className="text-lg font-bold flex items-center gap-2 text-foreground font-display">
                          <ClipboardList className="h-5 w-5 text-amber-500" />
                          История ваших обращений и оплат
                        </CardTitle>
                        <CardDescription className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          Отслеживайте статус обращений, заказов оборудования и квитанции об оплате ТО
                        </CardDescription>
                      </div>
                      {/* Кнопка «Оставить заявку» в едином стиле кнопки «Изменить» (ShinyButton) */}
                      <ShinyButton
                        onClick={() => {
                          console.log("[История] Нажата кнопка 'Оставить заявку' в шапке истории");
                          setOrderType("repair");
                          setIsOrderDialogOpen(true);
                        }}
                        className="rounded-xl px-4 h-9 font-semibold text-xs flex items-center gap-1.5 shrink-0 self-start sm:self-auto"
                      >
                        <Plus className="h-4 w-4" />
                        <span>Оставить заявку</span>
                      </ShinyButton>
                    </div>
                  </CardHeader>

                  <CardContent className="pt-4 px-3 sm:px-6">
                    {/* Переключатель вкладок: по умолчанию открыта вкладка «Заявки» */}
                    <Tabs defaultValue="requests" className="w-full space-y-4">
                      <div className="flex justify-center">
                        <TabsList className="glass-premium border border-slate-200/50 dark:border-slate-800/50 p-1.5 rounded-2xl grid grid-cols-3 gap-2 w-full max-w-2xl shadow-lg h-auto">
                          <TabsTrigger 
                            value="requests" 
                            className="flex items-center justify-center gap-1.5 sm:gap-2 py-2.5 px-2 sm:px-4 rounded-xl text-xs sm:text-sm font-semibold transition-all data-[state=active]:bg-amber-500 data-[state=active]:text-white data-[state=active]:shadow-md text-slate-500 dark:text-slate-400"
                          >
                            <ClipboardList className="h-4 w-4 shrink-0" />
                            <span>Заявки</span>
                            {regularRequests.length > 0 && (
                              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200/70 dark:bg-slate-700 font-mono">
                                {regularRequests.length}
                              </span>
                            )}
                          </TabsTrigger>

                          <TabsTrigger 
                            value="orders" 
                            className="flex items-center justify-center gap-1.5 sm:gap-2 py-2.5 px-2 sm:px-4 rounded-xl text-xs sm:text-sm font-semibold transition-all data-[state=active]:bg-amber-500 data-[state=active]:text-white data-[state=active]:shadow-md text-slate-500 dark:text-slate-400"
                          >
                            <ShoppingBag className="h-4 w-4 shrink-0" />
                            <span>Заказы</span>
                            {orderRequests.length > 0 && (
                              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200/70 dark:bg-slate-700 font-mono">
                                {orderRequests.length}
                              </span>
                            )}
                          </TabsTrigger>

                          <TabsTrigger 
                            value="to" 
                            className="flex items-center justify-center gap-1.5 sm:gap-2 py-2.5 px-2 sm:px-4 rounded-xl text-xs sm:text-sm font-semibold transition-all data-[state=active]:bg-amber-500 data-[state=active]:text-white data-[state=active]:shadow-md text-slate-500 dark:text-slate-400"
                          >
                            <Receipt className="h-4 w-4 shrink-0" />
                            <span>Оплата ТО</span>
                            {maintenancePayments.length > 0 && (
                              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200/70 dark:bg-slate-700 font-mono">
                                {maintenancePayments.length}
                              </span>
                            )}
                          </TabsTrigger>
                        </TabsList>
                      </div>

                      {/* ВКЛАДКА 1: ЗАЯВКИ (обычные без оплат) */}
                      <TabsContent value="requests" className="mt-2 focus:outline-none">
                        {regularRequests.length === 0 ? (
                          <div className="p-8 rounded-2xl bg-white/40 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800 text-center space-y-3">
                            <ClipboardList className="h-8 w-8 text-muted-foreground mx-auto opacity-40" />
                            <p className="text-xs font-semibold text-foreground">Заявок на обслуживание пока нет</p>
                            <p className="text-[11px] text-muted-foreground max-w-sm mx-auto">
                              Если возникла неисправность с домофоном или дверью, оставьте заявку — мастер выполнит ремонт бесплатно по договору ТО.
                            </p>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setOrderType("repair");
                                setIsOrderDialogOpen(true);
                              }}
                              className="rounded-xl text-xs font-semibold text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
                            >
                              <Wrench className="h-3.5 w-3.5 mr-1" />
                              Сообщить о неисправности (бесплатно)
                            </Button>
                          </div>
                        ) : (
                          <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
                            {regularRequests.map((req: any) => (
                              <div key={req.id} className="p-4 rounded-2xl border border-slate-100 dark:border-slate-800/80 bg-white/40 dark:bg-slate-900/40 hover:bg-white/60 dark:hover:bg-slate-900/60 transition-all shadow-sm hover:shadow-md flex flex-col justify-between gap-3 text-left">
                                <div className="flex items-center justify-between sm:justify-start gap-3 flex-wrap">
                                  <span className="text-xs font-mono text-slate-500 dark:text-slate-400 font-semibold">
                                    {format(new Date(req.created_at), "dd MMMM yyyy, HH:mm", { locale: ru })}
                                  </span>
                                  {getStatusBadge(req.status)}
                                </div>
                                <p className="text-sm font-semibold text-foreground border-b border-slate-100 dark:border-slate-800 pb-1">
                                  {req.address}
                                </p>
                                <p className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-line leading-relaxed">
                                  {req.message}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </TabsContent>

                      {/* ВКЛАДКА 2: ЗАКАЗЫ (с оборудованием и оплатой) */}
                      <TabsContent value="orders" className="mt-2 focus:outline-none">
                        {orderRequests.length === 0 ? (
                          <div className="p-8 rounded-2xl bg-white/40 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800 text-center space-y-3">
                            <ShoppingBag className="h-8 w-8 text-muted-foreground mx-auto opacity-40" />
                            <p className="text-xs font-semibold text-foreground">Заказов оборудования или ключей пока нет</p>
                            <p className="text-[11px] text-muted-foreground max-w-sm mx-auto">
                              Вы можете заказать дополнительные ключи, аудиотрубку или настройку личного кабинета с безопасной онлайн-оплатой через ЮKassa.
                            </p>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setOrderType("order");
                                setIsOrderDialogOpen(true);
                              }}
                              className="rounded-xl text-xs font-semibold text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/10"
                            >
                              <Plus className="h-3.5 w-3.5 mr-1" />
                              Заказать оборудование или ключи
                            </Button>
                          </div>
                        ) : (
                          <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
                            {orderRequests.map((req: any) => {
                              const isPaid = req.payment_status === "paid";
                              const isPending = req.payment_status === "pending";
                              const orderSum = Number(req.payment_amount) || 0;

                              return (
                                <div key={req.id} className="p-4 rounded-2xl border border-slate-100 dark:border-slate-800/80 bg-white/40 dark:bg-slate-900/40 hover:bg-white/60 dark:hover:bg-slate-900/60 transition-all shadow-sm hover:shadow-md flex flex-col md:flex-row justify-between gap-4">
                                  <div className="space-y-2 flex-1 text-left">
                                    <div className="flex items-center justify-between sm:justify-start gap-3 flex-wrap">
                                      <span className="text-xs font-mono text-slate-500 dark:text-slate-400 font-semibold">
                                        {format(new Date(req.created_at), "dd MMMM yyyy, HH:mm", { locale: ru })}
                                      </span>
                                      <div className="flex gap-1.5 items-center">
                                        {getStatusBadge(req.status)}
                                        {getPaymentBadge(req)}
                                      </div>
                                    </div>
                                    
                                    <div className="text-sm font-semibold text-foreground border-b border-slate-100 dark:border-slate-800 pb-1 flex justify-between items-center">
                                      <span>{req.address}</span>
                                      {orderSum > 0 && (
                                        <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                                          {orderSum.toFixed(2)} ₽
                                        </span>
                                      )}
                                    </div>
                                    
                                    <p className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-line leading-relaxed">
                                      {req.message}
                                    </p>
                                  </div>

                                  {/* Действия: Электронный чек для оплаченных, либо оплата для ожидающих */}
                                  <div className="flex md:flex-col items-center justify-end md:justify-center shrink-0 pt-2 md:pt-0 md:pl-4 border-t md:border-t-0 md:border-l border-slate-100 dark:border-slate-800/80 gap-2">
                                    {isPaid && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => {
                                          console.log("[ЛК Кабинет: Заказы] Просмотр электронного чека по заказу ID:", req.id);
                                          // Ищем платёж в базе (по полному списку транзакций toPayments) либо генерируем объект чека
                                          const matchedPayment = (toPayments || []).find((p: any) => p.request_id === req.id || String(p.request_id) === String(req.id));
                                          setCabinetReceipt(matchedPayment || {
                                            id: `REQ-${req.id}`,
                                            yookassa_payment_id: req.payment_id || `REQ-${req.id}`,
                                            account_number: userAccount?.account_number || "—",
                                            amount: orderSum,
                                            created_at: req.updated_at || req.created_at,
                                            description: `Оплата заказа по заявке #${req.id}`,
                                            status: "succeeded",
                                          });
                                        }}
                                        className="h-8 px-3 text-xs rounded-xl flex items-center gap-1.5 border-emerald-500/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 font-medium"
                                      >
                                        <Receipt className="h-3.5 w-3.5 text-emerald-600" />
                                        <span>Электронный чек</span>
                                      </Button>
                                    )}

                                    {isPending && (
                                      <Button
                                        size="sm"
                                        onClick={async () => {
                                          const baseAmount = orderSum;
                                          const feeAmount = Math.round(baseAmount * 0.05 * 100) / 100;
                                          const totalAmountWithFee = Math.round((baseAmount + feeAmount) * 100) / 100;

                                          console.log(`[ЛК Кабинет: Оплата Заказа] Инициация оплаты заказа #${req.id}: база ${baseAmount} ₽, комиссия 5% ${feeAmount} ₽, итог ${totalAmountWithFee} ₽`);
                                          toast({
                                            title: "Переход к оплате",
                                            description: "Перенаправляем на платежный шлюз ЮKassa...",
                                          });

                                          try {
                                            const resp = await fetch("/backend-api/api/payments/yookassa/create", {
                                              method: "POST",
                                              headers: { "Content-Type": "application/json" },
                                              body: JSON.stringify({
                                                amount: totalAmountWithFee,
                                                credit_amount: baseAmount,
                                                fee_amount: feeAmount,
                                                description: `Оплата заказа по заявке #${req.id}, адрес: ${req.address}`,
                                                account_number: userAccount?.account_number || undefined,
                                                accountNumber: userAccount?.account_number || undefined,
                                                request_id: req.id,
                                                requestId: req.id,
                                                user_id: userId || undefined,
                                                userId: userId || undefined,
                                                return_url: `${window.location.origin}/cabinet?check_payment=1&request_id=${req.id}${userAccount?.account_number ? `&account=${userAccount.account_number}` : ''}`,
                                                returnUrl: `${window.location.origin}/cabinet?check_payment=1&request_id=${req.id}${userAccount?.account_number ? `&account=${userAccount.account_number}` : ''}`,
                                              }),
                                            });

                                            const pData = await resp.json();
                                            if (!resp.ok || !pData.success) {
                                              throw new Error(pData.error || "Ошибка инициализации оплаты");
                                            }
                                            const redirectUrl = pData.confirmationUrl || pData.confirmation_url;
                                            if (redirectUrl) {
                                              window.location.href = redirectUrl;
                                            } else {
                                              throw new Error("Не получен URL подтверждения от ЮKassa");
                                            }
                                          } catch (err: any) {
                                            console.error("[Оплата заказа]", err);
                                            toast({
                                              title: "Ошибка оплаты",
                                              description: err.message || "Не удалось связаться со шлюзом оплаты ЮKassa",
                                              variant: "destructive",
                                            });
                                          }
                                        }}
                                        className="w-full md:w-auto flex items-center justify-center gap-1.5 btn-premium-gold px-3.5 py-1.5 hover:shadow-gold-glow text-xs shrink-0 font-bold rounded-xl"
                                      >
                                        <CreditCard className="h-3.5 w-3.5" />
                                        <span>
                                          Оплатить сейчас ({(() => {
                                            const f = Math.round(orderSum * 0.05 * 100) / 100;
                                            return (orderSum + f).toFixed(2);
                                          })()} ₽)
                                        </span>
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </TabsContent>

                      {/* ВКЛАДКА 3: ОПЛАТА ТО (история оплат технического обслуживания и электронные чеки) */}
                      <TabsContent value="to" className="mt-2 focus:outline-none">
                        {maintenancePayments.length === 0 ? (
                          <div className="p-8 rounded-2xl bg-white/40 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800 text-center space-y-2">
                            <Receipt className="h-8 w-8 text-muted-foreground mx-auto opacity-40" />
                            <p className="text-xs font-semibold text-foreground">Онлайн-платежей за ТО пока нет</p>
                            <p className="text-[11px] text-muted-foreground max-w-sm mx-auto">
                              После быстрой оплаты технического обслуживания через ЮKassa в блоке «Баланс и абонентская плата» все электронные чеки появятся здесь.
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-2.5 max-h-[480px] overflow-y-auto pr-1">
                            {maintenancePayments.map((p: any) => {
                              const isSucceeded = p.status === "succeeded";
                              const isPending = p.status === "pending";

                              return (
                                <div
                                  key={p.id || p.yookassa_payment_id}
                                  className="p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800/80 bg-white/40 dark:bg-slate-900/40 hover:bg-white/60 dark:hover:bg-slate-900/60 transition-all shadow-sm hover:shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left"
                                >
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                      <span className="font-bold text-sm text-foreground font-mono">
                                        {Number(p.amount).toFixed(2)} ₽
                                      </span>
                                      {isSucceeded ? (
                                        <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 text-[10px] py-0 font-medium">
                                          <CheckCircle2 className="h-3 w-3 mr-1 text-emerald-600 inline" />
                                          Оплачен
                                        </Badge>
                                      ) : isPending ? (
                                        <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 text-[10px] py-0 font-medium">
                                          <Clock className="h-3 w-3 mr-1 text-amber-600 inline" />
                                          В обработке
                                        </Badge>
                                      ) : (
                                        <Badge variant="destructive" className="text-[10px] py-0 font-medium">
                                          Отменён
                                        </Badge>
                                      )}
                                    </div>
                                    <p className="text-[11px] text-muted-foreground">
                                      {new Date(p.created_at).toLocaleString("ru-RU", {
                                        day: "2-digit",
                                        month: "2-digit",
                                        year: "numeric",
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      })} • {p.description || "Оплата ТО домофона (ЮKassa)"}
                                    </p>
                                    {p.yookassa_payment_id && (
                                      <p className="text-[10px] font-mono text-muted-foreground/80 truncate max-w-[280px]">
                                        Транзакция: {p.yookassa_payment_id}
                                      </p>
                                    )}
                                  </div>

                                  {/* RULE 2: Кнопка чека доступна ТОЛЬКО для успешно завершённых и зачисленных оплат */}
                                  <div className="flex items-center gap-2 shrink-0">
                                    {isSucceeded && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => {
                                          console.log("[ЛК Кабинет: ТО] Открытие электронного чека ТО для платежа:", p.id || p.yookassa_payment_id);
                                          setCabinetReceipt(p);
                                        }}
                                        className="h-8 px-3 text-xs rounded-xl flex items-center gap-1.5 border-emerald-500/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 font-medium shadow-xs"
                                      >
                                        <Receipt className="h-3.5 w-3.5 text-emerald-600" />
                                        <span>Электронный чек</span>
                                      </Button>
                                    )}


                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </TabsContent>
                    </Tabs>
                  </CardContent>
                </Card>
              );
            })()}

            {/* Диалог просмотра и печати официального электронного чека из нижней истории */}
            <Dialog open={!!cabinetReceipt} onOpenChange={(open) => !open && setCabinetReceipt(null)}>
              <DialogContent className="max-w-md print:p-0 print:border-none print:shadow-none">
                <DialogHeader className="print:hidden">
                  <DialogTitle className="flex items-center gap-2 text-base font-bold">
                    <Receipt className="h-5 w-5 text-emerald-600" />
                    Электронный чек оплаты
                  </DialogTitle>
                  <DialogDescription>
                    Официальная квитанция через платёжный шлюз ЮKassa
                  </DialogDescription>
                </DialogHeader>

                {cabinetReceipt && (
                  <div id="cabinet-payment-receipt" className="space-y-4 py-2 text-xs">
                    {/* Шапка чека */}
                    <div className="text-center pb-3 border-b border-dashed border-slate-300 dark:border-slate-700">
                      <div className="font-extrabold text-sm uppercase tracking-wider text-foreground">ООО «ДОМОФОНДАР»</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">ИНН: 2311283958 • ОГРН: 1192375010904</div>
                      <div className="text-[10px] text-muted-foreground">г. Краснодар, проезд им. Репина, д. 1, пом. 134 • Тел.: +7 (903) 411-83-93</div>
                      {/* RULE 2: Динамический статус проведения платежа в чеке */}
                      {cabinetReceipt.status === "succeeded" ? (
                        <div className="mt-2.5 inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-semibold text-[11px] border border-emerald-500/20">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                          ОПЛАЧЕНО ОНЛАЙН • ЧЕК ПРОВЕДЁН
                        </div>
                      ) : cabinetReceipt.status === "canceled" ? (
                        <div className="mt-2.5 inline-flex items-center gap-1 px-3 py-1 rounded-full bg-rose-500/10 text-rose-700 dark:text-rose-400 font-semibold text-[11px] border border-rose-500/20">
                          <AlertCircle className="h-3.5 w-3.5 text-rose-600" />
                          ПЛАТЁЖ ОТМЕНЁН • СРЕДСТВА НЕ СПИСАНЫ
                        </div>
                      ) : (
                        <div className="mt-2.5 inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 font-semibold text-[11px] border border-amber-500/20">
                          <Clock className="h-3.5 w-3.5 text-amber-600" />
                          В ОБРАБОТКЕ • ОЖИДАЕТ ОПЛАТЫ
                        </div>
                      )}
                    </div>

                    {/* Детали платежа */}
                    <div className="space-y-2 py-1">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Номер транзакции:</span>
                        <span className="font-mono font-medium text-foreground select-all text-right text-[11px]">
                          {cabinetReceipt.yookassa_payment_id || cabinetReceipt.id}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Лицевой счёт:</span>
                        <span className="font-mono font-bold text-foreground">
                          {cabinetReceipt.account_number || userAccount?.account_number || "—"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Дата и время:</span>
                        <span className="font-medium text-foreground">
                          {new Date(cabinetReceipt.created_at).toLocaleString("ru-RU")}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Способ оплаты:</span>
                        <span className="font-medium text-foreground">
                          ЮKassa (Карта / СБП / SberPay)
                        </span>
                      </div>
                      <div className="flex justify-between items-start">
                        <span className="text-muted-foreground shrink-0">Назначение:</span>
                        <span className="font-medium text-foreground text-right max-w-[240px]">
                          {cabinetReceipt.description || "Оплата ТО домофона"}
                        </span>
                      </div>
                    </div>

                    {/* Итоговая сумма */}
                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex justify-between items-center">
                      <div>
                        <span className="text-[11px] text-muted-foreground block">Сумма платежа:</span>
                        <span className="text-[10px] text-muted-foreground">НДС не облагается (УСН)</span>
                      </div>
                      <span className="text-lg font-black font-mono text-emerald-600 dark:text-emerald-400">
                        {Number(cabinetReceipt.amount).toFixed(2)} ₽
                      </span>
                    </div>

                    {/* Подвал чека с защитной отметкой */}
                    <div className="pt-2 text-center text-[10px] text-muted-foreground space-y-1">
                      <p>Платежный оператор: ООО НКО «ЮМани» (лицензия ЦБ РФ № 3510-К)</p>
                      <p>Квитанция сформирована автоматически в ЛК «Домофондар» и подтверждает зачисление средств.</p>
                    </div>
                  </div>
                )}

                <DialogFooter className="flex-col sm:flex-row gap-2 pt-2 print:hidden">
                  <Button
                    variant="outline"
                    onClick={() => setCabinetReceipt(null)}
                    className="rounded-xl"
                  >
                    Закрыть
                  </Button>
                  <Button
                    onClick={() => window.print()}
                    disabled={cabinetReceipt?.status !== "succeeded"}
                    className="rounded-xl bg-primary text-primary-foreground font-semibold flex items-center gap-1.5"
                  >
                    <Printer className="h-4 w-4" />
                    Распечатать чек
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* --- ДИАЛОГ ПОДАЧИ ЗАЯВКИ / ЗАКАЗА УСЛУГ --- */}
            <Dialog open={isOrderDialogOpen} onOpenChange={(openState) => {
              // RULE 2: Логируем состояние диалога создания заявки и очищаем выбранные позиции при закрытии
              console.log("[ЛК Кабинет] Изменение состояния диалога заявки, открыт:", openState);
              setIsOrderDialogOpen(openState);
              if (!openState) {
                console.log("[ЛК Кабинет] Диалог закрыт, сброс выбора услуг и оборудования");
                setSelectedServiceId(null);
                setSelectedEquipmentId(null);
                setSelectedEquipments({});
                setKeysQuantity(0);
                setIsCabinetSetupChecked(false);
                setRepairProblem("");
              }
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
                  <div className="space-y-4 py-2 text-left">
                    {/* Зеленый инфоблок: ремонт бесплатно */}
                    <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2 font-medium">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span>Вызов мастера, диагностика и ремонт домофона выполняются <strong>бесплатно</strong> в рамках абонентской платы ТО.</span>
                    </div>

                    {/* Быстрые кнопки частых поломок */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Быстрый выбор проблемы в 1 клик:</Label>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          "Не открывает дверь с трубки",
                          "Нет звука / вызова в квартире",
                          "Хлопает дверь",
                          "Сломан доводчик входной двери",
                          "Не срабатывает электронный ключ",
                          "Повреждена вызывная панель",
                        ].map((chip, idx) => {
                          // RULE 2: Проверяем, выбран ли чип в текущем тексте для подсветки и предотвращения дублирования
                          const isSelected = repairProblem.toLowerCase().includes(chip.toLowerCase());
                          return (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => {
                                setRepairProblem(prev => {
                                  const trimmed = prev.trim();
                                  if (!trimmed) return chip;
                                  
                                  const lowerChip = chip.toLowerCase();
                                  // Если чип уже есть в тексте - аккуратно удаляем его при повторном клике (умный toggle)
                                  if (trimmed.toLowerCase().includes(lowerChip)) {
                                    const filtered = trimmed
                                      .split(/,\s*/)
                                      .filter(part => part.trim().toLowerCase() !== lowerChip);
                                    return filtered.join(", ");
                                  }
                                  
                                  // Иначе добавляем к описанию через запятую
                                  return `${trimmed}, ${chip}`;
                                });
                              }}
                              className={`px-2.5 py-1 rounded-lg text-xs border transition-all font-medium active:scale-95 flex items-center gap-1 ${
                                isSelected
                                  ? "border-amber-500 bg-amber-500/20 text-amber-800 dark:text-amber-200 font-bold shadow-xs"
                                  : "border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 hover:border-amber-500/50 hover:bg-amber-500/10 text-slate-700 dark:text-slate-300"
                              }`}
                            >
                              <span>{isSelected ? "✓" : "+"}</span>
                              <span>{chip}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="problemText" className="text-sm font-semibold text-foreground">Подробное описание неисправности</Label>
                      <Textarea
                        id="problemText"
                        placeholder="Опишите, что произошло (или выберите варианты выше)..."
                        value={repairProblem}
                        onChange={(e) => setRepairProblem(e.target.value)}
                        rows={4}
                        className="bg-white/50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 text-sm font-medium rounded-xl transition-all placeholder-slate-400"
                      />
                    </div>
                  </div>
                )}

                {/* СОДЕРЖИМОЕ ТАБА: ЗАКАЗ УСЛУГ И ОБОРУДОВАНИЯ */}
                {orderType === "order" && (
                  <div className="space-y-5 py-1">
                    {/* Если к подъезду не привязано оборудование и услуги — информационный блок связи с диспетчером */}
                    {availableProducts.length === 0 ? (
                      <div className="py-6 px-4 text-center space-y-4 rounded-2xl bg-amber-500/5 border border-amber-500/20 my-2">
                        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto shadow-sm">
                          <Headphones className="w-7 h-7" />
                        </div>
                        <div className="space-y-1.5 max-w-sm mx-auto">
                          <h4 className="font-bold text-base text-foreground">
                            Индивидуальный подбор оборудования
                          </h4>
                          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                            Для заказа оборудования, ключей и получения подробной информации свяжитесь с нашим диспетчером по номеру телефона:
                          </p>
                        </div>

                        {/* Кнопка быстрого вызова диспетчера по клику */}
                        <div className="pt-1 flex flex-col sm:flex-row items-center justify-center gap-2 max-w-xs mx-auto">
                          <a
                            href="tel:+79034118393"
                            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm shadow-md transition-all active:scale-95"
                          >
                            <Phone className="w-4 h-4" />
                            <span>+7 (903) 411-83-93</span>
                          </a>
                        </div>

                        <p className="text-[11px] text-muted-foreground">
                          Круглосуточная диспетчерская служба ООО «ДомофонДар»
                        </p>

                        {/* Навигационные кнопки перехода в Контакты и переключения на Ремонт */}
                        <div className="pt-2 border-t border-amber-500/15 flex flex-col sm:flex-row items-center justify-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              console.log("[Заказ] Переход на страницу контактов");
                              setIsOrderDialogOpen(false);
                              navigate("/kontakty");
                            }}
                            className="w-full sm:w-auto text-xs font-semibold rounded-xl h-9 flex items-center gap-1.5 border-amber-500/30 hover:bg-amber-500/10"
                          >
                            <MapPin className="w-3.5 h-3.5 text-amber-500" />
                            <span>Страница «Контакты»</span>
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => {
                              console.log("[Заказ] Переключение на форму бесплатного ремонта");
                              setOrderType("repair");
                            }}
                            className="w-full sm:w-auto text-xs text-muted-foreground hover:text-foreground h-9"
                          >
                            <span>Оставить заявку на ремонт</span>
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* Баннер льготных цен на этапе монтажа */}
                        {currentMatchedEntrance?.service_type === "installation" && (
                          <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-transparent border border-amber-500/30 text-amber-900 dark:text-amber-200 flex items-start gap-3">
                        <Sparkles className="h-5 w-5 text-amber-500 shrink-0 mt-0.5 animate-pulse" />
                        <div>
                          <div className="font-bold text-xs flex items-center gap-1.5">
                            <span>Ваш дом на этапе подключения!</span>
                            <Badge className="bg-amber-500 text-white font-bold text-[9px] px-1.5 py-0">Льготный прайс</Badge>
                          </div>
                          <p className="text-[11px] text-amber-800/90 dark:text-amber-300/90 mt-0.5 leading-relaxed">
                            Для жителей вашего адреса действуют специальные сниженные цены на оборудование и установку на период монтажа.
                          </p>
                        </div>
                      </div>
                    )}
                    
                    {/* 1. БЛОК: КЛЮЧИ ОТ ДОМОФОНА (ПОДНЯТ В САМЫЙ ВЕРХ) */}
                    {availableProducts.filter(isKeyProduct).length > 0 && (
                      <div className="space-y-2.5 text-left">
                        <Label className="text-sm font-semibold text-foreground flex items-center gap-1.5 font-display">
                          🔑 Дополнительные ключи от домофона
                        </Label>
                        {availableProducts
                          .filter(isKeyProduct)
                          .map((keyProduct) => {
                            const isInstallation = currentMatchedEntrance?.service_type === "installation";
                            const basePrice = Number(keyProduct.price || 300);
                            const installPrice = keyProduct.installation_price != null ? Number(keyProduct.installation_price) : 200;
                            const isPromoActive = !isInstallation && !!keyProduct.is_tiered_promo;
                            const keyTiers = parseTieredPricing(keyProduct.tiered_pricing);
                            const tier1 = keyTiers.find(t => t.min_qty === 1)?.price ?? basePrice;
                            const tier2 = keyTiers.find(t => t.min_qty === 2)?.price ?? 250;
                            const tier3 = keyTiers.find(t => t.min_qty === 3)?.price ?? 200;

                            const keyCalc = calculateKeyPriceDetails(
                              keysQuantity,
                              basePrice,
                              isInstallation,
                              installPrice,
                              isPromoActive,
                              keyTiers
                            );

                            return (
                              <div key={keyProduct.id} className="space-y-2">
                                {/* Акционный баннер: отображается ТОЛЬКО если дом НЕ на монтаже и акция включена */}
                                {isPromoActive && (
                                  <div className="p-2.5 px-3.5 rounded-xl bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-transparent border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-xs text-amber-900 dark:text-amber-200">
                                    <span className="flex items-center gap-1.5 font-semibold">
                                      <span className="text-sm">🎁</span>
                                      <span>Акция на ключи: 1 шт — {tier1} ₽ | 2 шт — по {tier2} ₽/шт | от 3 шт — по {tier3} ₽/шт</span>
                                    </span>
                                    {keyCalc.totalSavings > 0 && (
                                      <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white font-bold text-[10px] px-2 py-0.5 self-start sm:self-auto shrink-0 shadow-xs">
                                        ✨ Экономия: -{keyCalc.totalSavings} ₽
                                      </Badge>
                                    )}
                                  </div>
                                )}

                                <div className="flex items-center justify-between p-3.5 rounded-xl border border-amber-500/20 bg-amber-500/5 shadow-sm shadow-amber-500/5">
                                  <div className="flex items-center gap-3 text-left">
                                    {keyProduct.image_url ? (
                                      <img 
                                        src={keyProduct.image_url} 
                                        alt={keyProduct.name} 
                                        className="h-12 w-12 object-cover rounded-lg flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity" 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setPreviewImage(keyProduct.image_url);
                                        }}
                                      />
                                    ) : (
                                      <div className="w-12 h-12 rounded-lg bg-amber-500/10 flex items-center justify-center text-xl shrink-0">
                                        🔑
                                      </div>
                                    )}
                                    <div>
                                      <div className="font-semibold text-sm text-foreground">{keyProduct.name.toUpperCase()}</div>
                                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Ключ с повышенной защитой от копирования</div>
                                      <div className="text-xs text-amber-500 font-bold mt-1 flex items-center gap-1.5 flex-wrap">
                                        {isInstallation ? (
                                          <>
                                            <span className="text-sm">{keyCalc.unitPrice.toFixed(0)} ₽ за шт.</span>
                                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 font-semibold">
                                              Монтаж
                                            </span>
                                          </>
                                        ) : isPromoActive ? (
                                          <>
                                            <span className="text-sm">
                                              {keysQuantity > 0 
                                                ? `${keyCalc.unitPrice.toFixed(0)} ₽ за шт. (Итого: ${keyCalc.totalPrice.toFixed(0)} ₽)`
                                                : `${tier1.toFixed(0)} ₽ за шт.`}
                                            </span>
                                            {keysQuantity >= 2 && (
                                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-semibold">
                                                Акция от объема
                                              </span>
                                            )}
                                          </>
                                        ) : (
                                          <span className="text-sm">{basePrice.toFixed(0)} ₽ за шт.</span>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Счетчик количества ключей */}
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSelectedKeyProductId(keyProduct.id);
                                        if (keysQuantity > 0) {
                                          console.log("[Заявка] Уменьшено кол-во ключей до:", keysQuantity - 1, "ID:", keyProduct.id);
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
                                        setSelectedKeyProductId(keyProduct.id);
                                        console.log("[Заявка] Увеличено кол-во ключей до:", keysQuantity + 1, "ID:", keyProduct.id);
                                        setKeysQuantity(prev => prev + 1);
                                      }}
                                      className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-400 dark:text-slate-550 active:scale-90 transition-all shrink-0 bg-white/40 dark:bg-slate-950/40"
                                    >
                                      <Plus className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    )}

                    {/* 2. БЛОК: ВЫБОР УСЛУГИ (установка / замена) */}
                    {availableProducts.some(p => p.category === "service" && !p.name.toLowerCase().includes("кабинет")) && (
                      <div className="space-y-2 text-left">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-semibold text-foreground flex items-center gap-1.5 font-display">
                            🛠️ Выберите услугу
                          </Label>
                          {selectedServiceId && (
                            <button
                              type="button"
                              onClick={() => {
                                // RULE 2: Логируем сброс услуги для раскрытия всех вариантов
                                console.log("[Заявка] Сброс услуги абонентом для изменения выбора");
                                setSelectedServiceId(null);
                                setSelectedEquipmentId(null);
                              }}
                              className="text-xs text-amber-600 dark:text-amber-400 font-semibold hover:underline"
                            >
                              Изменить выбор
                            </button>
                          )}
                        </div>
                        <div className={`grid gap-2.5 ${selectedServiceId ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2"}`}>
                          {availableProducts
                            .filter(p => p.category === "service" && !p.name.toLowerCase().includes("кабинет"))
                            .filter(service => !selectedServiceId || service.id === selectedServiceId)
                            .map((service) => {
                              const effPrice = getEffectiveProductPrice(service);
                              const hasDiscount = currentMatchedEntrance?.service_type === "installation" && 
                                service.installation_price != null && 
                                Number(service.installation_price) < Number(service.price);
                              const isSelected = selectedServiceId === service.id;

                              return (
                                <div
                                  key={service.id}
                                  onClick={() => {
                                    if (isSelected) {
                                      console.log("[Заявка] Отмена выбора услуги:", service.name);
                                      setSelectedServiceId(null);
                                      setSelectedEquipmentId(null); // Сбрасываем и трубку при отмене услуги
                                    } else {
                                      console.log("[Заявка] Выбрана услуга ID:", service.id, "цена:", effPrice);
                                      setSelectedServiceId(service.id);
                                      // Автоскролл к блоку выбора трубок
                                      setTimeout(() => {
                                        if (equipmentSectionRef.current) {
                                          equipmentSectionRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
                                        }
                                      }, 150);
                                    }
                                  }}
                                  className={`p-3.5 rounded-xl border text-left cursor-pointer transition-all flex flex-col justify-between ${
                                    isSelected
                                      ? "border-amber-500 bg-amber-500/10 shadow-sm ring-1 ring-amber-500/30"
                                      : "border-slate-200 dark:border-slate-800 bg-white/20 dark:bg-slate-900/20 hover:border-amber-500/50 hover:bg-white/40"
                                  }`}
                                >
                                  {service.image_url && (
                                    <img 
                                      src={service.image_url} 
                                      alt={service.name} 
                                      className="w-full h-24 object-cover rounded-lg mb-2.5 cursor-pointer hover:opacity-85 transition-opacity" 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setPreviewImage(service.image_url);
                                      }}
                                    />
                                  )}
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="font-semibold text-sm text-foreground leading-snug">{service.name}</div>
                                    <div className={`w-5 h-5 rounded-full shrink-0 flex items-center justify-center transition-all ${
                                      isSelected
                                        ? "bg-amber-500 text-white"
                                        : "border border-slate-300 dark:border-slate-700"
                                    }`}>
                                      {isSelected && <CheckCircle2 className="w-5 h-5 fill-amber-500 text-white" />}
                                    </div>
                                  </div>
                                  <div className="text-xs text-amber-500 font-bold mt-2 flex items-center gap-1.5">
                                    {hasDiscount && (
                                      <span className="line-through text-slate-400 font-normal text-[11px]">
                                        {Number(service.price).toFixed(0)} ₽
                                      </span>
                                    )}
                                    <span className="text-sm">{effPrice === 0 ? "Бесплатно" : `${effPrice.toFixed(0)} ₽`}</span>
                                    {hasDiscount && (
                                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 font-semibold">
                                        Монтаж
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    )}

                    {/* 3. БЛОК: ВЫБОР ТРУБКИ (ТКП) - РАЗВОРАЧИВАЕТСЯ СТРОГО ПОСЛЕ ВЫБОРА УСЛУГИ */}
                    {selectedServiceId && availableProducts.some(p => p.category === "equipment" && !isKeyProduct(p)) && (
                      <div ref={equipmentSectionRef} className="space-y-2 text-left animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-semibold text-foreground flex items-center gap-1.5 font-display">
                            🏢 Выберите трубку (ТКП) под ваш домофон
                          </Label>
                          {selectedEquipmentId && (
                            <button
                              type="button"
                              onClick={() => {
                                // RULE 2: Логируем сброс трубки для отображения всех моделей
                                console.log("[Заявка] Сброс трубки абонентом для изменения выбора модели");
                                setSelectedEquipmentId(null);
                              }}
                              className="text-xs text-amber-600 dark:text-amber-400 font-semibold hover:underline"
                            >
                              Выбрать другую
                            </button>
                          )}
                        </div>
                        <div className="space-y-2">
                          {availableProducts
                            .filter(p => p.category === "equipment" && !isKeyProduct(p))
                            .filter(equip => !selectedEquipmentId || equip.id === selectedEquipmentId)
                            .map((equip) => {
                              const effPrice = getEffectiveProductPrice(equip);
                              const hasDiscount = currentMatchedEntrance?.service_type === "installation" && 
                                equip.installation_price != null && 
                                Number(equip.installation_price) < Number(equip.price);
                              const isSelected = selectedEquipmentId === equip.id;

                              return (
                                <div
                                  key={equip.id}
                                  onClick={() => {
                                    if (isSelected) {
                                      console.log("[Заявка] Снятие выбора трубки:", equip.name);
                                      setSelectedEquipmentId(null);
                                    } else {
                                      console.log("[Заявка] Выбрана трубка:", equip.name, "цена:", effPrice);
                                      setSelectedEquipmentId(equip.id);
                                    }
                                  }}
                                  className={`flex items-center justify-between p-3.5 rounded-xl border cursor-pointer transition-all ${
                                    isSelected
                                      ? "border-amber-500 bg-amber-500/10 shadow-sm ring-1 ring-amber-500/30"
                                      : "border-slate-200 dark:border-slate-800 bg-white/20 dark:bg-slate-900/20 hover:border-amber-500/50 hover:bg-white/40"
                                  }`}
                                >
                                  <div className="flex items-center gap-3">
                                    {equip.image_url && (
                                      <img 
                                        src={equip.image_url} 
                                        alt={equip.name} 
                                        className="h-16 w-16 object-cover rounded-lg flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity" 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setPreviewImage(equip.image_url);
                                        }}
                                      />
                                    )}
                                    <div className="text-left">
                                      <div className="font-semibold text-sm text-foreground">{equip.name.toUpperCase()}</div>
                                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{equip.description || "Абонентская трубка домофона"}</div>
                                      <div className="text-xs text-amber-500 font-bold mt-1 flex items-center gap-1.5">
                                        {hasDiscount && (
                                          <span className="line-through text-slate-400 font-normal text-[11px]">
                                            {Number(equip.price).toFixed(0)} ₽
                                          </span>
                                        )}
                                        <span className="text-sm">{effPrice.toFixed(0)} ₽</span>
                                        {hasDiscount && (
                                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 font-semibold">
                                            Монтаж
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  
                                  {/* Индикатор выбора трубки (одиночный выбор) */}
                                  <div className={`w-5 h-5 rounded-full shrink-0 flex items-center justify-center transition-all ${
                                    isSelected
                                      ? "bg-amber-500 text-white"
                                      : "border border-slate-300 dark:border-slate-700"
                                  }`}>
                                    {isSelected && <CheckCircle2 className="w-5 h-5 fill-amber-500 text-white" />}
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    )}

                    {/* 4. БЛОК: ПОДКЛЮЧИТЬ УМНЫЙ ДОМОФОН (если есть учетные записи ИЛИ активен Умный дом, и ЛК еще не приобретен) */}
                    {(() => {
                      // Если личный кабинет уже приобретен пользователем, не отображаем его в форме заказа
                      if (isCabinetPurchased) return null;

                      const canBuyCabinet = hasEntranceCredentials || !!currentMatchedEntrance?.has_smart_intercom;
                      if (!canBuyCabinet) return null;

                      const cabinetProduct = products.find(p => p.name.toLowerCase().includes("кабинет"));
                      const cabinetPrice = cabinetProduct ? getEffectiveProductPrice(cabinetProduct) : 300;

                      return (
                        <div className="space-y-2 text-left">
                          <Label className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                            <Smartphone className="h-4 w-4 text-amber-500" />
                            Доступ к умному домофону
                          </Label>

                          <div
                            onClick={() => {
                              console.log("[Заявка] Выбор подключения Умного домофона:", !isCabinetSetupChecked);
                              setIsCabinetSetupChecked(!isCabinetSetupChecked);
                            }}
                            className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all cursor-pointer select-none ${
                              isCabinetSetupChecked
                                ? "bg-amber-500/10 border-amber-500 shadow-sm shadow-amber-500/10"
                                : "bg-white/40 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`h-12 w-12 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                                isCabinetSetupChecked
                                  ? "bg-amber-500 text-white"
                                  : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                              }`}>
                                <Smartphone className="h-6 w-6" />
                              </div>
                              <div className="text-left space-y-0.5">
                                <p className="font-bold text-sm text-foreground">
                                  Подключить Умный домофон
                                </p>
                                <p className="text-xs text-muted-foreground leading-snug">
                                  Регистрация личного кабинета для доступа к умному дому и мобильному приложению
                                </p>
                                <p className="text-sm font-bold text-amber-600 dark:text-amber-400 pt-0.5">
                                  +{cabinetPrice.toFixed(0)} ₽ <span className="text-[11px] font-normal text-muted-foreground">(единоразово)</span>
                                </p>
                              </div>
                            </div>

                            {/* Индикатор выбора в едином стиле с выбором трубки */}
                            <div className={`w-5 h-5 rounded-full shrink-0 flex items-center justify-center transition-all ${
                              isCabinetSetupChecked
                                ? "bg-amber-500 text-white"
                                : "border border-slate-300 dark:border-slate-700"
                            }`}>
                              {isCabinetSetupChecked && <CheckCircle2 className="w-5 h-5 fill-amber-500 text-white" />}
                            </div>
                          </div>

                          {/* Поясняющая плашка при заблаговременной оплате (когда дом умный, но учетки еще заливаются) */}
                          {!hasEntranceCredentials && currentMatchedEntrance?.has_smart_intercom && isCabinetSetupChecked && (
                            <div className="p-2.5 px-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-800 dark:text-blue-300 text-xs flex items-center gap-2 animate-in fade-in">
                              <Info className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
                              <span>Доступ к приложению и логин/пароль будут автоматически активированы после загрузки базы оператором.</span>
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* Комментарий к платному заказу */}
                    <div className="space-y-2 text-left">
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
                      <div className="font-semibold text-xs text-slate-450 dark:text-slate-400 uppercase tracking-wider pb-1.5 border-b border-slate-100 dark:border-slate-800/80 text-left">Детализация расчета:</div>
                      
                      {/* Услуга */}
                      {selectedServiceId && (() => {
                        const s = availableProducts.find(p => p.id === selectedServiceId) || products.find(p => p.id === selectedServiceId);
                        if (!s) return null;
                        const sPrice = getEffectiveProductPrice(s);
                        return (
                          <div className="flex justify-between text-slate-500 dark:text-slate-400">
                            <span>{s.name}</span>
                            <span className="font-semibold text-foreground">{sPrice === 0 ? "Бесплатно" : `${sPrice.toFixed(0)} ₽`}</span>
                          </div>
                        );
                      })()}

                      {/* Оборудование (трубка) */}
                      {selectedEquipmentId && (() => {
                        const prod = availableProducts.find(p => p.id === selectedEquipmentId) || products.find(p => p.id === selectedEquipmentId);
                        if (!prod) return null;
                        const pPrice = getEffectiveProductPrice(prod);
                        return (
                          <div className="flex justify-between text-slate-500 dark:text-slate-400">
                            <span>{prod.name.toUpperCase()} (1 шт.)</span>
                            <span className="font-semibold text-foreground">{pPrice.toFixed(0)} ₽</span>
                          </div>
                        );
                      })()}

                      {/* Ключи */}
                      {keysQuantity > 0 && (() => {
                        const kp = selectedKeyProductId 
                          ? (availableProducts.find(p => p.id === selectedKeyProductId) || products.find(p => p.id === selectedKeyProductId))
                          : (availableProducts.find(p => p.category === "key") || availableProducts.find(isKeyProduct));
                        if (!kp) return null;
                        
                        const isInstallation = currentMatchedEntrance?.service_type === "installation";
                        const basePrice = Number(kp.price || 300);
                        const installPrice = kp.installation_price != null ? Number(kp.installation_price) : 200;
                        const isPromoEnabled = !!kp.is_tiered_promo;
                        const keyTiers = parseTieredPricing(kp.tiered_pricing);
                        const keyCalc = calculateKeyPriceDetails(
                          keysQuantity,
                          basePrice,
                          isInstallation,
                          installPrice,
                          isPromoEnabled,
                          keyTiers
                        );

                        return (
                          <div className="flex justify-between items-center text-slate-500 dark:text-slate-400">
                            <span className="flex items-center gap-1.5">
                              <span>🔑 {kp.name} (x{keysQuantity})</span>
                              {keyCalc.hasDiscount && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold">
                                  по {keyCalc.unitPrice.toFixed(0)} ₽/шт
                                </span>
                              )}
                            </span>
                            <div className="flex items-center gap-1.5">
                              {keyCalc.hasDiscount && (
                                <span className="line-through text-xs text-slate-400 font-normal">
                                  {(basePrice * keysQuantity).toFixed(0)} ₽
                                </span>
                              )}
                              <span className="font-semibold text-foreground">{keyCalc.totalPrice.toFixed(0)} ₽</span>
                            </div>
                          </div>
                        );
                      })()}

                      {/* ЛК (только если еще не приобретен) */}
                      {!isCabinetPurchased && isCabinetSetupChecked && (hasEntranceCredentials || !!currentMatchedEntrance?.has_smart_intercom) && (() => {
                        const cp = products.find(p => p.name.toLowerCase().includes("кабинет"));
                        const cPrice = cp ? getEffectiveProductPrice(cp) : 300;
                        return (
                          <div className="flex justify-between items-center text-slate-500 dark:text-slate-400">
                            <div>
                              <span>📱 Подключить Умный домофон</span>
                              {!hasEntranceCredentials && currentMatchedEntrance?.has_smart_intercom && (
                                <div className="text-[10px] text-blue-500">Доступ активируется после загрузки оператором</div>
                              )}
                            </div>
                            <span className="font-semibold text-foreground">{cPrice.toFixed(0)} ₽</span>
                          </div>
                        );
                      })()}

                      {/* Итоговая сумма заказа оборудования */}
                      {(() => {
                        const base = calculateTotals().total || 0;
                        return (
                          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5 text-left">
                            <div className="flex justify-between font-bold text-base text-foreground pt-1">
                              <span>Итого к оплате:</span>
                              <span className="text-amber-500 font-mono text-lg font-black">{base.toFixed(2)} ₽</span>
                            </div>
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-snug">
                              💡 Возможна оплата за транзакцию. Оплата производится онлайн через ЮKassa.
                            </p>
                          </div>
                        );
                      })()}
                    </div>
                      </>
                    )}

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
                  {orderType === "order" && availableProducts.length === 0 ? (
                    <Button
                      type="button"
                      onClick={() => {
                        console.log("[Заказ] Переход на страницу контактов из футера диалога");
                        setIsOrderDialogOpen(false);
                        navigate("/kontakty");
                      }}
                      className="w-full sm:w-auto flex-1 flex items-center justify-center gap-1.5 btn-premium-gold hover:shadow-gold-glow rounded-xl h-11 font-bold"
                    >
                      <MapPin className="h-4 w-4 shrink-0" />
                      <span>Перейти в Контакты</span>
                    </Button>
                  ) : (
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
                        ? "Отправить заявку мастеру (бесплатно)"
                        : calculateTotals().total === 0
                        ? "Оформить заявку"
                        : `Оплатить заказ (${(() => {
                            const b = calculateTotals().total || 0;
                            const f = Math.round(b * 0.05 * 100) / 100;
                            return (b + f).toFixed(2);
                          })()} ₽) через ЮKassa`}
                    </Button>
                  )}
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
          </div>
        </div>
      </main>

      {/* Диалог предпросмотра фото */}
      <Dialog open={!!previewImage} onOpenChange={(open) => !open && setPreviewImage(null)}>
        <DialogContent className="max-w-3xl p-1 bg-transparent border-none shadow-none">
          {previewImage && (
            <img src={previewImage} alt="Предпросмотр" className="w-full h-auto max-h-[85vh] object-contain rounded-lg" />
          )}
        </DialogContent>
      </Dialog>

      {/* Всплывающее окно автоподтягивания адреса и лицевого счёта по номеру телефона */}
      <Dialog open={showPhoneWelcomeDialog} onOpenChange={setShowPhoneWelcomeDialog}>
        <DialogContent className="max-w-lg p-0 overflow-hidden border-0 shadow-2xl rounded-3xl bg-white dark:bg-slate-900">
          {/* Верхний градиентный баннер */}
          <div className="bg-gradient-to-br from-emerald-600 via-teal-600 to-emerald-800 p-6 text-white text-left relative overflow-hidden">
            <div className="absolute -right-6 -bottom-6 opacity-15">
              <ShieldCheck className="h-36 w-36" />
            </div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-xs font-semibold mb-3">
              <Sparkles className="h-3.5 w-3.5 text-amber-300 animate-pulse" />
              <span>Договор найден по номеру телефона</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold font-display leading-tight">
              Найден договор по вашему номеру
            </h2>
            <p className="text-white/90 text-xs sm:text-sm mt-1.5 leading-relaxed">
              По вашему номеру найден адрес и лицевой счёт. Введите ФИО и подтвердите или отмените сохранение данных.
            </p>
          </div>

          <div className="p-6 space-y-4 text-left">
            {/* Карточка найденных данных из базы договоров */}
            <div className="p-4 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/50 space-y-2.5">
              <div className="flex items-start gap-2.5">
                <MapPin className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <span className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider block">
                    Адрес подключения:
                  </span>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-100 mt-0.5">
                    {matchedSubscriberData?.address}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2.5 border-t border-emerald-200/50 dark:border-emerald-800/40 text-xs">
                <div>
                  <span className="text-slate-500 dark:text-slate-400 text-[11px] block">Лицевой счёт:</span>
                  <span className="font-mono font-bold text-foreground text-sm">{matchedSubscriberData?.account_number}</span>
                </div>
                {matchedSubscriberData?.payment_type && (
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 text-[11px] block">Тариф:</span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400 truncate block">
                      {matchedSubscriberData?.payment_type}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Поле ввода ФИО */}
            <div className="space-y-1.5 text-left">
              <Label htmlFor="welcomeFullNameInput" className="text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                <User className="h-4 w-4 text-emerald-600" />
                <span>Фамилия, Имя и Отчество (ФИО) *</span>
              </Label>
              <Input
                id="welcomeFullNameInput"
                value={welcomeFullName}
                onChange={(e) => setWelcomeFullName(e.target.value)}
                placeholder="Например: Иванов Иван Иванович"
                className="bg-white/80 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 font-medium h-11 transition-all rounded-xl"
              />
              <p className="text-[11px] text-muted-foreground">
                Укажите полные ФИО собственника или проживающего для оформления лицевого счёта.
              </p>
            </div>

            {/* Две кнопки: «Подтвердить» и «Отменить» */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <Button
                type="button"
                onClick={handleConfirmFoundSubscriber}
                disabled={savingWelcomeData}
                className="w-full h-11 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm shadow-md flex items-center justify-center gap-1.5"
              >
                {savingWelcomeData ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                <span>Подтвердить</span>
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={handleCancelFoundSubscriber}
                disabled={savingWelcomeData}
                className="w-full h-11 rounded-2xl border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold text-sm"
              >
                Отменить
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Диалог загрузки документов для верификации */}
      <VerificationUploadDialog
        isOpen={isVerificationDialogOpen}
        onClose={() => setIsVerificationDialogOpen(false)}
        profile={profile}
        onSuccess={(updated) => {
          setProfile((prev: any) => ({ ...prev, ...updated }));
        }}
      />

      {/* Модальное окно с официальными документами (152-ФЗ, Согласие, Оферта) */}
      <LegalDocumentsModal
        isOpen={legalModalOpen}
        onClose={() => setLegalModalOpen(false)}
        initialDocumentId={legalDocId}
      />

      <Footer />
    </div>
  );
};

// Классовый предохранитель ошибок (CabinetErrorBoundary) для перехвата любых критических рантайм-сбоев в Личном кабинете
class CabinetErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: any }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  // Метод жизненного цикла для обновления стейта при возникновении ошибки
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  // Логирование ошибки в консоль
  componentDidCatch(error: any, errorInfo: any) {
    console.error("[Cabinet ErrorBoundary] Перехвачена критическая рантайм-ошибка:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 text-white p-8 flex flex-col items-center justify-center text-center">
          <h1 className="text-2xl font-bold text-red-500 mb-4 font-display">⚠️ Критическая ошибка рендеринга ЛК</h1>
          <p className="text-sm text-slate-400 max-w-md mb-6">Произошел сбой при отрисовке интерфейса. Пожалуйста, передайте разработчику текст ошибки ниже:</p>
          <pre className="bg-slate-950 p-4 rounded-xl text-xs max-w-xl overflow-auto border border-red-900/50 text-red-400 font-mono text-left">
            {this.state.error?.stack || String(this.state.error)}
          </pre>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-6 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-all"
          >
            Перезагрузить страницу
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Обертка компонента Cabinet в предохранитель ошибок для предотвращения "белого экрана" у пользователя
const CabinetWithErrorBoundary = () => (
  <CabinetErrorBoundary>
    <Cabinet />
  </CabinetErrorBoundary>
);

export default CabinetWithErrorBoundary;
