import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { notify } from "@/lib/notify";
import {
  Loader2, User, Hash, MapPin, Building2, Home, DoorOpen, ArrowLeft, ArrowRight,
  Check, CheckCircle2, Search, ClipboardList, Pencil, Layers,
} from "lucide-react";

// ============================================================================
// Пошаговый мастер заполнения данных абонента в личном кабинете.
// Поиск адреса/счёта идёт через серверные эндпоинты /backend-api/api/lookup/*
// (индексированные поля accounts) — без тяжёлого ILIKE и нагрузки на БД.
// ============================================================================

type Mode = "create" | "edit";

interface AccountRow {
  account_number: string;
  address?: string;
  street?: string;
  house?: string;
  housing?: string | null;
  entrance?: string;
  apartment?: string;
  full_name?: string;
  phone?: string;
}

interface Props {
  userId: string;
  phone: string;
  initialFullName?: string;
  mode: Mode;
  existingProfile?: any;
  onDone: () => void;
  onCancel?: () => void;
}

const api = (path: string) => `/backend-api/api/lookup/${path}`;

async function getJSON(url: string) {
  // Эндпоинты поиска требуют авторизации — передаём JWT абонента
  let token = "";
  try { token = localStorage.getItem("auth_token") || sessionStorage.getItem("auth_token") || ""; } catch { /* ignore */ }
  const r = await fetch(url, token ? { headers: { Authorization: `Bearer ${token}` } } : {});
  if (!r.ok) throw new Error("Ошибка запроса");
  return r.json();
}

// Подсказки адресов по Краснодару из справочника DaData/КЛАДР (чтобы жильцы выбирали из списка,
// а не плодили опечатки). Ключ вшит в бандл (VITE_DADATA_API_KEY).
const DADATA_KEY = ((import.meta as any).env?.VITE_DADATA_API_KEY as string) || "e2f68637298d357a2555d582480cddb18e671f6a";
async function dadataSuggest(query: string, bound: "street" | "house") {
  try {
    const r = await fetch("https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json", "Authorization": `Token ${DADATA_KEY}` },
      body: JSON.stringify({ query, count: 8, from_bound: { value: bound }, to_bound: { value: bound }, locations: [{ region: "краснодарский", city: "краснодар" }] }),
    });
    const j = await r.json();
    return (j.suggestions || []) as any[];
  } catch { return []; }
}
const normStreet = (s: string) => (s || "").toLowerCase().replace(/[^а-яё0-9]/gi, "");

// Красивый номер лицевого счёта → нормализованный вид для показа
const composeAddress = (street: string, house: string, housing: string, entrance: string) => {
  let a = street.trim();
  if (house) a += `, д. ${house.trim()}${housing ? ` к${housing.trim()}` : ""}`;
  if (entrance) a += `, п ${entrance.trim()}`;
  return a;
};

type Step =
  | "name" | "method"
  | "account"
  | "street" | "house" | "entrance" | "apartment" | "floor"
  | "review";

export const ProfileWizard: React.FC<Props> = ({ userId, phone, initialFullName, mode, existingProfile, onDone, onCancel }) => {
  const { toast } = useToast();

  const [step, setStep] = useState<Step>("name");
  const [history, setHistory] = useState<Step[]>([]);
  const [saving, setSaving] = useState(false);

  // Собираемые данные
  const [fullName, setFullName] = useState(initialFullName || existingProfile?.full_name || "");
  const [phoneNum, setPhoneNum] = useState(phone || existingProfile?.phone || "");
  const [accountNumber, setAccountNumber] = useState<string>(existingProfile?.account_number || "");
  const [streetServed, setStreetServed] = useState(true); // выбрана ли обслуживаемая улица (из нашей базы)
  const [dadataStreetOpts, setDadataStreetOpts] = useState<any[]>([]); // подсказки улиц из справочника
  const [dadataStreetValue, setDadataStreetValue] = useState(""); // полный контекст улицы DaData (для поиска домов)
  const [dadataHouseOpts, setDadataHouseOpts] = useState<any[]>([]); // подсказки домов из справочника
  const [street, setStreet] = useState("");
  const [house, setHouse] = useState("");
  const [housing, setHousing] = useState("");
  const [entrance, setEntrance] = useState("");
  const [apartment, setApartment] = useState("");
  const [floor, setFloor] = useState("");
  const [addressText, setAddressText] = useState("");

  // Поиск по телефону (автоподстановка)
  const [phoneMatch, setPhoneMatch] = useState<AccountRow | null>(null);
  const [phoneChecked, setPhoneChecked] = useState(false);

  // Списки для шагов
  const [streetQuery, setStreetQuery] = useState("");
  const [streetOpts, setStreetOpts] = useState<string[]>([]);
  const [houseQuery, setHouseQuery] = useState("");
  const [houseOpts, setHouseOpts] = useState<{ house: string; housing: string | null; label: string }[]>([]);
  const [entranceOpts, setEntranceOpts] = useState<{ entrance: string; has_smart_intercom: boolean }[]>([]);
  const [apartmentOpts, setApartmentOpts] = useState<{ apartment: string; account_number: string }[]>([]);
  const [manualEntrance, setManualEntrance] = useState(false);
  const [manualApartment, setManualApartment] = useState(false);
  const [loadingList, setLoadingList] = useState(false);
  const [accountInput, setAccountInput] = useState("");
  const [accountLoading, setAccountLoading] = useState(false);
  const [accountError, setAccountError] = useState("");

  const go = (next: Step) => { setHistory((h) => [...h, step]); setStep(next); };
  const back = () => { setHistory((h) => { const c = [...h]; const prev = c.pop(); if (prev) setStep(prev); return c; }); };

  // Прогресс (для шкалы)
  const stepIndex = useMemo(() => {
    const order: Step[] = ["name", "method", "street", "house", "entrance", "apartment", "floor", "review"];
    const i = order.indexOf(step === "account" ? "review" : step);
    return i < 0 ? 1 : i + 1;
  }, [step]);
  const totalSteps = 8;

  // Автопоиск по телефону при входе на шаг «method»
  useEffect(() => {
    if (step !== "method" || phoneChecked || !phone) return;
    setPhoneChecked(true);
    getJSON(api(`by-phone?phone=${encodeURIComponent(phone)}`))
      .then((row: AccountRow | null) => { if (row && row.account_number) setPhoneMatch(row); })
      .catch(() => {});
  }, [step, phone, phoneChecked]);

  // Загрузка улиц: НАШИ обслуживаемые (приоритет) + подсказки по Краснодару из справочника
  useEffect(() => {
    if (step !== "street") return;
    const q = streetQuery.trim();
    if (q.length < 2) { setStreetOpts([]); setDadataStreetOpts([]); return; }
    setLoadingList(true);
    const t = setTimeout(async () => {
      const [served, dd] = await Promise.all([
        getJSON(api(`streets?q=${encodeURIComponent(q)}`)).catch(() => []),
        dadataSuggest(q, "street"),
      ]);
      setStreetOpts(served);
      const servedNorm = new Set((served as string[]).map(normStreet));
      // Оставляем из справочника только те улицы, которых нет среди обслуживаемых
      setDadataStreetOpts(dd.filter((x) => {
        const sw = x.data?.street_with_type || x.data?.settlement_with_type || x.value;
        return !servedNorm.has(normStreet(sw));
      }));
      setLoadingList(false);
    }, 300);
    return () => clearTimeout(t);
  }, [streetQuery, step]);

  // Дома из справочника DaData (для домов, которых нет в нашей базе / новых клиентов)
  useEffect(() => {
    if (step !== "house") return;
    const q = houseQuery.trim();
    if (q.length < 1) { setDadataHouseOpts([]); return; }
    const ctx = streetServed ? `Краснодар, ${street.replace(/\s*\(ул\)\s*/i, "")}` : (dadataStreetValue || `Краснодар, ${street}`);
    const t = setTimeout(async () => {
      const dd = await dadataSuggest(`${ctx}, ${q}`, "house");
      setDadataHouseOpts(dd);
    }, 300);
    return () => clearTimeout(t);
  }, [houseQuery, step, streetServed, dadataStreetValue, street]);

  const loadHouses = async (st: string) => {
    setLoadingList(true);
    try { setHouseOpts(await getJSON(api(`houses?street=${encodeURIComponent(st)}`))); }
    catch { setHouseOpts([]); } finally { setLoadingList(false); }
  };
  const loadEntrances = async (st: string, ho: string, hg: string) => {
    setLoadingList(true);
    try {
      const rows = await getJSON(api(`entrances?street=${encodeURIComponent(st)}&house=${encodeURIComponent(ho)}&housing=${encodeURIComponent(hg)}`));
      setEntranceOpts(rows); setManualEntrance(rows.length === 0);
    } catch { setEntranceOpts([]); setManualEntrance(true); } finally { setLoadingList(false); }
  };
  const loadApartments = async (st: string, ho: string, hg: string, en: string) => {
    setLoadingList(true);
    try {
      const rows = await getJSON(api(`apartments?street=${encodeURIComponent(st)}&house=${encodeURIComponent(ho)}&housing=${encodeURIComponent(hg)}&entrance=${encodeURIComponent(en)}`));
      setApartmentOpts(rows); setManualApartment(rows.length === 0);
    } catch { setApartmentOpts([]); setManualApartment(true); } finally { setLoadingList(false); }
  };

  // Применить найденный по счёту/телефону адрес и перейти к проверке
  const applyAccountRow = (row: AccountRow) => {
    setAccountNumber(row.account_number || "");
    setStreet(row.street || "");
    setHouse(row.house || "");
    setHousing(row.housing || "");
    setEntrance(row.entrance || "");
    setApartment(row.apartment || "");
    setAddressText(row.address || composeAddress(row.street || "", row.house || "", row.housing || "", row.entrance || ""));
    go("review");
  };

  const findAccount = async () => {
    const raw = accountInput.replace(/\D/g, "");
    if (!raw) { setAccountError("Введите номер лицевого счёта"); return; }
    setAccountLoading(true); setAccountError("");
    try {
      const row: AccountRow | null = await getJSON(api(`account?number=${encodeURIComponent(raw)}`));
      if (row && row.account_number) applyAccountRow(row);
      else setAccountError(`Лицевой счёт «${raw}» не найден. Проверьте номер или введите адрес вручную.`);
    } catch { setAccountError("Ошибка поиска. Попробуйте позже."); }
    finally { setAccountLoading(false); }
  };

  // Финальное сохранение
  const finalAddress = addressText || composeAddress(street, house, housing, entrance);
  const save = async () => {
    if (!fullName.trim()) { toast({ title: "Укажите ФИО", variant: "destructive" }); setStep("name"); return; }
    if (!finalAddress.trim()) { toast({ title: "Укажите адрес", variant: "destructive" }); return; }
    setSaving(true);
    try {
      if (mode === "edit" && existingProfile) {
        // Изменение сохранённого профиля — через диспетчера (pending_data_change)
        const pending = {
          full_name: fullName.trim(), phone: (phoneNum || phone || "").trim(),
          address: finalAddress, apartment: apartment.trim(), floor: floor.trim(),
          account_number: accountNumber || null,
          submitted_at: new Date().toISOString(),
          old_data: {
            full_name: existingProfile.full_name || "", phone: existingProfile.phone || "",
            address: existingProfile.address || "", apartment: existingProfile.apartment || "",
            account_number: existingProfile.account_number || "",
          },
        };
        const { error } = await supabase.from("profiles").update({ pending_data_change: pending, data_change_notification: null }).eq("id", userId);
        if (error) throw error;
        try {
          await supabase.from("requests").insert({
            client_id: userId, name: fullName.trim(), phone,
            address: `${finalAddress}${apartment ? `, кв. ${apartment}` : ""}`,
            apartment: apartment.trim() || null, street: street || null, house: house || null, entrance: entrance || null,
            order_type: "data_change_request", status: "pending", priority: "medium",
            message: `📝 Заявка на изменение данных.\nНовый адрес: ${finalAddress}, кв. ${apartment || "-"}\nЛицевой счёт: ${accountNumber || "-"}`,
            notes: JSON.stringify(pending),
          });
        } catch { /* заявка не критична для UX */ }
        notify("verification_request", { full_name: fullName.trim(), user_id: userId });
        toast({ title: "Заявка отправлена оператору", description: "Новые данные вступят в силу после подтверждения диспетчером." });
      } else {
        // Первичное заполнение — сохраняем сразу
        const { error } = await supabase.from("profiles").update({
          full_name: fullName.trim(), phone: (phoneNum || phone || "").trim() || null,
          address: finalAddress, apartment: apartment.trim() || null, floor: floor.trim() || null,
          account_number: accountNumber || null,
        }).eq("id", userId);
        if (error) throw error;
        toast({ title: "Данные сохранены ✅", description: "Профиль заполнен. Для доступа к домофону подтвердите проживание." });
      }
      onDone();
    } catch (e: any) {
      toast({ title: "Ошибка сохранения", description: e.message || "Не удалось сохранить данные", variant: "destructive" });
    } finally { setSaving(false); }
  };

  // ---- UI ----
  const StepShell: React.FC<{ icon: React.ReactNode; title: string; subtitle?: string; children: React.ReactNode }> = ({ icon, title, subtitle, children }) => (
    <div className="animate-in fade-in slide-in-from-right-2 duration-300">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2.5 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-sky-400">{icon}</div>
        <div>
          <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100">{title}</h3>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  );

  const Tile: React.FC<{ active?: boolean; onClick: () => void; children: React.ReactNode; badge?: React.ReactNode }> = ({ active, onClick, children, badge }) => (
    <button type="button" onClick={onClick}
      className={cn("relative h-12 min-w-[3.5rem] px-3 rounded-xl border font-semibold text-sm transition-all",
        active ? "border-blue-500 bg-blue-500/10 text-blue-700 dark:text-sky-300 ring-1 ring-blue-500/30"
               : "border-slate-200 dark:border-slate-700 hover:border-blue-400 hover:bg-blue-500/5")}>
      {children}{badge}
    </button>
  );

  return (
    <div className="glass-premium rounded-[24px] border-none shadow-lg p-5 sm:p-6">
      {/* Прогресс */}
      <div className="mb-5">
        <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1.5">
          <span>Заполнение профиля</span>
          <span>Шаг {Math.min(stepIndex, totalSteps)} из {totalSteps}</span>
        </div>
        <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
          <div className="h-full bg-gradient-to-r from-blue-500 to-sky-400 transition-all duration-500"
               style={{ width: `${(Math.min(stepIndex, totalSteps) / totalSteps) * 100}%` }} />
        </div>
      </div>

      {/* Дружелюбное приглашение — заметный выделенный блок */}
      {step === "name" && (
        <div className="mb-5 p-4 rounded-2xl bg-gradient-to-r from-blue-500/15 via-sky-500/10 to-blue-500/5 border border-blue-500/30 text-center">
          <p className="text-base sm:text-lg font-extrabold text-blue-700 dark:text-sky-300">
            👋 Давайте мы поможем вам заполнить ваши данные
          </p>
          <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
            Это займёт меньше минуты — просто отвечайте по шагам.
          </p>
        </div>
      )}

      {/* ШАГ: ФИО + телефон */}
      {step === "name" && (
        <StepShell icon={<User className="h-5 w-5" />} title="Как вас зовут?" subtitle="Укажите фамилию, имя и отчество">
          <Input autoFocus value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Иванов Иван Иванович"
            className="h-12 rounded-xl text-base" />
          <div className="mt-4">
            <Label className="text-xs font-semibold text-slate-500 dark:text-slate-400">📞 Контактный телефон</Label>
            <Input value={phoneNum} onChange={(e) => setPhoneNum(e.target.value)} placeholder="+7 (999) 000-00-00"
              type="tel" inputMode="tel" className="h-12 rounded-xl text-base mt-1" />
            <p className="text-[11px] text-muted-foreground mt-1">Подставлен из вашей регистрации — при необходимости поправьте.</p>
          </div>
          <div className="flex justify-end mt-5">
            <Button disabled={!fullName.trim()} onClick={() => go("method")} className="rounded-xl h-11 px-6 gap-2 bg-blue-600 hover:bg-blue-700">
              Далее <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </StepShell>
      )}

      {/* ШАГ: выбор способа */}
      {step === "method" && (
        <StepShell icon={<ClipboardList className="h-5 w-5" />} title="Укажем ваш адрес" subtitle="Выберите удобный способ">
          {phoneMatch && (
            <button type="button" onClick={() => applyAccountRow(phoneMatch)}
              className="w-full text-left p-4 mb-3 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/15 transition-all">
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 font-bold text-sm mb-1">
                <CheckCircle2 className="h-4 w-4" /> Это вы?
              </div>
              <div className="text-sm text-slate-700 dark:text-slate-200">{phoneMatch.address}</div>
              <div className="text-[11px] text-muted-foreground mt-1">Нашли по вашему номеру телефона — нажмите, чтобы подтвердить</div>
            </button>
          )}
          <div className="grid gap-3">
            <button type="button" onClick={() => go("account")}
              className="flex items-center gap-3 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 hover:border-blue-400 hover:bg-blue-500/5 transition-all text-left">
              <Hash className="h-5 w-5 text-blue-600 dark:text-sky-400 shrink-0" />
              <div>
                <div className="font-semibold text-sm">По лицевому счёту</div>
                <div className="text-[11px] text-muted-foreground">Номер с квитанции об оплате — быстрее всего</div>
              </div>
            </button>
            <button type="button" onClick={() => { setStreetQuery(""); go("street"); }}
              className="flex items-center gap-3 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 hover:border-blue-400 hover:bg-blue-500/5 transition-all text-left">
              <MapPin className="h-5 w-5 text-blue-600 dark:text-sky-400 shrink-0" />
              <div>
                <div className="font-semibold text-sm">Ввести адрес вручную</div>
                <div className="text-[11px] text-muted-foreground">Пошагово: улица → дом → подъезд → квартира</div>
              </div>
            </button>
          </div>
          <div className="flex justify-start mt-5">
            <Button variant="ghost" onClick={back} className="rounded-xl h-10 gap-2 text-muted-foreground"><ArrowLeft className="h-4 w-4" /> Назад</Button>
          </div>
        </StepShell>
      )}

      {/* ШАГ: лицевой счёт */}
      {step === "account" && (
        <StepShell icon={<Hash className="h-5 w-5" />} title="Номер лицевого счёта" subtitle="Указан в вашей квитанции об оплате">
          <div className="flex gap-2">
            <Input autoFocus value={accountInput} onChange={(e) => { setAccountInput(e.target.value); setAccountError(""); }}
              onKeyDown={(e) => e.key === "Enter" && findAccount()} placeholder="например, 654" inputMode="numeric"
              className="h-12 rounded-xl text-base font-mono" />
            <Button onClick={findAccount} disabled={accountLoading} className="h-12 rounded-xl px-5 bg-blue-600 hover:bg-blue-700 gap-2">
              {accountLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Найти
            </Button>
          </div>
          {accountError && <p className="text-xs text-destructive mt-2">{accountError}</p>}
          <div className="flex justify-between mt-5">
            <Button variant="ghost" onClick={back} className="rounded-xl h-10 gap-2 text-muted-foreground"><ArrowLeft className="h-4 w-4" /> Назад</Button>
            <Button variant="outline" onClick={() => { setStreetQuery(""); go("street"); }} className="rounded-xl h-10">Ввести адрес вручную</Button>
          </div>
        </StepShell>
      )}

      {/* ШАГ: улица (наши обслуживаемые — первыми, затем справочник Краснодара) */}
      {step === "street" && (
        <StepShell icon={<MapPin className="h-5 w-5" />} title="Улица" subtitle="Начните вводить — выберите из списка">
          <Input autoFocus value={streetQuery} onChange={(e) => setStreetQuery(e.target.value)} placeholder="например, Главная"
            className="h-12 rounded-xl text-base" />
          <div className="mt-2 max-h-72 overflow-auto rounded-xl">
            {loadingList && <div className="p-3 text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Поиск…</div>}
            {/* Обслуживаемые улицы — приоритет */}
            {!loadingList && streetOpts.map((s) => (
              <button key={"srv-" + s} type="button"
                onClick={() => { setStreet(s); setStreetServed(true); setDadataStreetValue(""); setHouseQuery(""); setHouseOpts([]); setDadataHouseOpts([]); loadHouses(s); go("house"); }}
                className="w-full text-left px-4 py-3 rounded-lg hover:bg-blue-500/10 text-sm border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                <span>{s}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold shrink-0">✓ обслуживаем</span>
              </button>
            ))}
            {/* Остальные улицы Краснодара из справочника */}
            {!loadingList && dadataStreetOpts.map((x, i) => {
              const settlement = x.data?.settlement_with_type ? `${x.data.settlement_with_type}, ` : "";
              const label = (settlement + (x.data?.street_with_type || "")).trim() || x.value.replace(/^г\s+Краснодар,\s*/i, "");
              return (
                <button key={"dd-" + i} type="button"
                  onClick={() => { setStreet(label); setStreetServed(false); setDadataStreetValue(x.value); setHouseQuery(""); setHouse(""); setHousing(""); setEntrance(""); setApartment(""); setDadataHouseOpts([]); go("house"); }}
                  className="w-full text-left px-4 py-3 rounded-lg hover:bg-blue-500/10 text-sm border-b border-slate-100 dark:border-slate-800 last:border-0 text-slate-600 dark:text-slate-300">
                  {label}
                </button>
              );
            })}
            {!loadingList && streetQuery.trim().length >= 2 && streetOpts.length === 0 && dadataStreetOpts.length === 0 && (
              <p className="p-3 text-sm text-muted-foreground">Ничего не найдено. Проверьте написание.</p>
            )}
          </div>
          <div className="flex justify-start mt-5">
            <Button variant="ghost" onClick={back} className="rounded-xl h-10 gap-2 text-muted-foreground"><ArrowLeft className="h-4 w-4" /> Назад</Button>
          </div>
        </StepShell>
      )}

      {/* ШАГ: дом (наши дома плитками; при вводе — подсказки домов из справочника) */}
      {step === "house" && (
        <StepShell icon={<Home className="h-5 w-5" />} title="Номер дома" subtitle={street}>
          <Input autoFocus value={houseQuery} onChange={(e) => setHouseQuery(e.target.value)} placeholder="например, 50"
            className="h-12 rounded-xl text-base" />
          {/* Наши дома — плитки (для обслуживаемой улицы) */}
          {streetServed && (
            <div className="mt-3 flex flex-wrap gap-2">
              {loadingList && <div className="p-1 text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Загрузка…</div>}
              {!loadingList && houseOpts
                .filter((h) => !houseQuery.trim() || h.label.toLowerCase().includes(houseQuery.trim().toLowerCase()))
                .map((h) => (
                  <Tile key={h.label} onClick={() => { setHouse(h.house); setHousing(h.housing || ""); setEntranceOpts([]); loadEntrances(street, h.house, h.housing || ""); go("entrance"); }}
                    badge={<span className="absolute -top-1.5 -right-1.5 text-[9px]" title="Обслуживаем">✓</span>}>
                    {h.label}
                  </Tile>
                ))}
            </div>
          )}
          {/* Дома из справочника (для новых адресов / если дома нет среди наших) */}
          {dadataHouseOpts.length > 0 && (
            <div className="mt-3">
              <p className="text-[11px] text-muted-foreground mb-1.5">Из справочника Краснодара:</p>
              <div className="flex flex-wrap gap-2">
                {dadataHouseOpts.map((x, i) => {
                  const hn = x.data?.house || "";
                  const bl = x.data?.block || "";
                  const lbl = bl ? `${hn} к${bl}` : hn;
                  if (!hn) return null;
                  return (
                    <Tile key={"ddh-" + i} onClick={() => { setHouse(hn); setHousing(bl || ""); setManualEntrance(true); setEntranceOpts([]); go("entrance"); }}>
                      {lbl}
                    </Tile>
                  );
                })}
              </div>
            </div>
          )}
          <div className="flex justify-start mt-5">
            <Button variant="ghost" onClick={back} className="rounded-xl h-10 gap-2 text-muted-foreground"><ArrowLeft className="h-4 w-4" /> Назад</Button>
          </div>
        </StepShell>
      )}

      {/* ШАГ: подъезд */}
      {step === "entrance" && (
        <StepShell icon={<Building2 className="h-5 w-5" />} title="Подъезд" subtitle={composeAddress(street, house, housing, "")}>
          {loadingList && <div className="p-1 text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Загрузка…</div>}
          {!loadingList && !manualEntrance && (
            <div className="flex flex-wrap gap-2">
              {entranceOpts.map((e) => (
                <Tile key={e.entrance} active={entrance === e.entrance}
                  onClick={() => { setEntrance(e.entrance); setApartmentOpts([]); loadApartments(street, house, housing, e.entrance); go("apartment"); }}
                  badge={e.has_smart_intercom ? <span className="absolute -top-1.5 -right-1.5 text-[9px]" title="Умный домофон">📱</span> : undefined}>
                  {e.entrance}
                </Tile>
              ))}
            </div>
          )}
          {!loadingList && manualEntrance && (
            <div>
              <Label className="text-xs text-muted-foreground">Подъезды не найдены в базе — введите номер</Label>
              <div className="flex gap-2 mt-1">
                <Input value={entrance} onChange={(e) => setEntrance(e.target.value)} placeholder="№ подъезда" inputMode="numeric" className="h-11 rounded-xl w-32" />
                <Button disabled={!entrance.trim()} onClick={() => { setApartmentOpts([]); setManualApartment(true); go("apartment"); }} className="h-11 rounded-xl bg-blue-600 hover:bg-blue-700 gap-2">Далее <ArrowRight className="h-4 w-4" /></Button>
              </div>
            </div>
          )}
          <div className="flex justify-start mt-5">
            <Button variant="ghost" onClick={back} className="rounded-xl h-10 gap-2 text-muted-foreground"><ArrowLeft className="h-4 w-4" /> Назад</Button>
          </div>
        </StepShell>
      )}

      {/* ШАГ: квартира */}
      {step === "apartment" && (
        <StepShell icon={<DoorOpen className="h-5 w-5" />} title="Квартира" subtitle={`${composeAddress(street, house, housing, entrance)}`}>
          {loadingList && <div className="p-1 text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Загрузка…</div>}
          {!loadingList && !manualApartment && (
            <div className="flex flex-wrap gap-2 max-h-64 overflow-auto">
              {apartmentOpts.map((a) => (
                <Tile key={a.apartment} active={apartment === a.apartment}
                  onClick={() => { setApartment(a.apartment); setAccountNumber(a.account_number || ""); go("floor"); }}>
                  {a.apartment}
                </Tile>
              ))}
            </div>
          )}
          {!loadingList && manualApartment && (
            <div>
              <Label className="text-xs text-muted-foreground">Квартиры не найдены — введите номер</Label>
              <div className="flex gap-2 mt-1">
                <Input value={apartment} onChange={(e) => setApartment(e.target.value)} placeholder="№ квартиры" inputMode="numeric" className="h-11 rounded-xl w-32" />
                <Button disabled={!apartment.trim()} onClick={() => go("floor")} className="h-11 rounded-xl bg-blue-600 hover:bg-blue-700 gap-2">Далее <ArrowRight className="h-4 w-4" /></Button>
              </div>
            </div>
          )}
          <div className="flex justify-start mt-5">
            <Button variant="ghost" onClick={back} className="rounded-xl h-10 gap-2 text-muted-foreground"><ArrowLeft className="h-4 w-4" /> Назад</Button>
          </div>
        </StepShell>
      )}

      {/* ШАГ: этаж (необязательно) */}
      {step === "floor" && (
        <StepShell icon={<Layers className="h-5 w-5" />} title="Этаж" subtitle="Необязательно — можно пропустить">
          <Input autoFocus value={floor} onChange={(e) => setFloor(e.target.value)} placeholder="например, 5" inputMode="numeric"
            className="h-12 rounded-xl text-base w-40" />
          <div className="flex justify-between mt-5">
            <Button variant="ghost" onClick={back} className="rounded-xl h-10 gap-2 text-muted-foreground"><ArrowLeft className="h-4 w-4" /> Назад</Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => go("review")} className="rounded-xl h-11 px-5">Пропустить</Button>
              <Button onClick={() => go("review")} className="rounded-xl h-11 px-6 gap-2 bg-blue-600 hover:bg-blue-700">Далее <ArrowRight className="h-4 w-4" /></Button>
            </div>
          </div>
        </StepShell>
      )}

      {/* ШАГ: проверка и сохранение */}
      {step === "review" && (
        <StepShell icon={<CheckCircle2 className="h-5 w-5" />} title="Проверьте данные" subtitle="Всё верно? Тогда сохраняем">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
            <Row label="ФИО" value={fullName} onEdit={() => setStep("name")} />
            <Row label="Телефон" value={phoneNum || phone} onEdit={() => setStep("name")} />
            {accountNumber && <Row label="Лицевой счёт" value={accountNumber} mono />}
            <Row label="Адрес" value={finalAddress} onEdit={() => { setStreetQuery(""); setStep("street"); }} />
            {apartment && <Row label="Квартира" value={apartment} onEdit={() => setStep("apartment")} />}
            {floor && <Row label="Этаж" value={floor} onEdit={() => setStep("floor")} />}
          </div>
          {mode === "edit" && (
            <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-3 flex items-start gap-1.5">
              <ClipboardList className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              Изменения вступят в силу после подтверждения диспетчером. До этого действуют ваши текущие данные.
            </p>
          )}
          <div className="flex justify-between mt-5">
            <Button variant="ghost" onClick={back} className="rounded-xl h-11 gap-2 text-muted-foreground"><ArrowLeft className="h-4 w-4" /> Назад</Button>
            <Button onClick={save} disabled={saving} className="rounded-xl h-11 px-7 gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {mode === "edit" ? "Отправить на подтверждение" : "Сохранить данные"}
            </Button>
          </div>
        </StepShell>
      )}

      {onCancel && step === "name" && (
        <div className="mt-4 text-center">
          <button type="button" onClick={onCancel} className="text-[11px] text-muted-foreground/70 hover:text-foreground">Отмена</button>
        </div>
      )}
    </div>
  );
};

const Row: React.FC<{ label: string; value: string; mono?: boolean; onEdit?: () => void }> = ({ label, value, mono, onEdit }) => (
  <div className="flex items-center justify-between px-4 py-3 gap-3">
    <div className="min-w-0">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className={cn("text-sm text-slate-800 dark:text-slate-100 truncate", mono && "font-mono")}>{value || "—"}</div>
    </div>
    {onEdit && (
      <button type="button" onClick={onEdit} className="text-blue-600 dark:text-sky-400 hover:underline text-xs flex items-center gap-1 shrink-0">
        <Pencil className="h-3 w-3" /> Изменить
      </button>
    )}
  </div>
);

export default ProfileWizard;
