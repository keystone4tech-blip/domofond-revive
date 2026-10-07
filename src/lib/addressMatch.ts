// Единый устойчивый нормализатор адресов для сопоставления профилей с лицевыми счетами 1С.
// Используется и в кабинете (DebtCard), и в CRM («Личные кабинеты»), чтобы привязка совпадала 1:1.
//
// Учитывает реальные форматы данных:
//  - адрес с городом и без города ("Краснодар, ул Казбекская, д. 13" и "ул Казбекская, д. 13");
//  - префикс и суффикс типа улицы ("ул Казбекская" и "Казбекская (ул)");
//  - "им. генерала Корнилова (ул)";
//  - корпуса в разных формах ("д. 3к1", "д. 3 к2", "д. 3, корп. 1");
//  - подъезд с точкой и без ("п. 2" и "п 2").
// ВАЖНО: в JS \b не работает с кириллицей, поэтому типы улиц вырезаются по токенам, а не по \b.

const TYPE_TOKENS = new Set([
  "ул", "ул.", "улица", "пер", "пер.", "переулок", "проспект", "пр-кт", "пр", "пр.",
  "аллея", "бульвар", "тракт", "шоссе", "(ул)", "им", "им.", "имени",
  "генерала", "генерал", "академика", "маршала", "дом",
]);

const isCitySeg = (seg: string) =>
  /краснодар|^г\.|^город|^пос|^поселок|^аул\b|^х\.|^хутор|^ст\.|^станица/.test(seg);
const isHouseSeg = (seg: string) => /^д\.?\s*\d/.test(seg) || /^дом\s*\d/.test(seg);
const isCorpSeg = (seg: string) => /^корп/.test(seg) || /^к\s*\d/.test(seg) || /^к\d/.test(seg);
const isEntranceSeg = (seg: string) => /^п\.?\s*\d/.test(seg) || /^подъезд/.test(seg);
const isAptSeg = (seg: string) => /^кв/.test(seg) || /^квартира/.test(seg);

// Возвращает сегмент с названием улицы (токены типа улицы отфильтрованы).
const streetTokens = (addr: string): string[] => {
  if (!addr) return [];
  const s = addr.toLowerCase().replace(/ё/g, "е");
  const segs = s.split(",").map((x) => x.trim()).filter(Boolean);
  const streetSegs = segs.filter((seg) =>
    !isCitySeg(seg) && !isHouseSeg(seg) && !isCorpSeg(seg) &&
    !isEntranceSeg(seg) && !/^эт/.test(seg) && !isAptSeg(seg)
  );
  const seg = streetSegs[0] || "";
  return seg.replace(/[().]/g, " ").split(/\s+/).filter(Boolean)
    .filter((t) => !TYPE_TOKENS.has(t) && !TYPE_TOKENS.has(t.replace(/\.$/, "")));
};

// Нормализованное название улицы (только буквы/цифры, без пробелов), напр. "казбекская".
export const normStreet = (addr: string): string =>
  streetTokens(addr).join("").replace(/[^а-яa-z0-9]/g, "");

// Короткий фрагмент улицы для ilike-запроса к базе (первый значимый токен), напр. "казбекская".
export const streetQuery = (addr: string): string => {
  const t = streetTokens(addr);
  return (t[0] || "").replace(/[^а-яa-z0-9]/g, "");
};

// Выделяем «кусок дома» из адреса (от "д." до подъезда/квартиры).
const houseChunk = (addr: string): string => {
  const i = (addr || "").search(/д\.?\s*\d/i);
  if (i < 0) return "";
  let s = addr.slice(i);
  // подъезд вырезаем только когда "п" стоит после запятой (чтобы не задеть "корп.")
  s = s.replace(/,\s*(?:п(?:одъезд)?)\.?\s*\d+.*$/i, "")
       .replace(/,\s*(?:кв\.?|квартира)\s*.*$/i, "");
  return s;
};

// Нормализованный номер дома с корпусом: "13", "3к1", "9к2".
export const normHouse = (addr: string): string => {
  let s = houseChunk(addr).toLowerCase().replace(/ё/g, "е").replace(/^.*?д\.?\s*/, "");
  s = s.replace(/корп\.?|корпус/g, "к");
  const digits = s.match(/\d+/g) || [];
  const hasK = /к/.test(s);
  if (!digits.length) return "";
  let r = digits[0];
  if (hasK && digits[1]) r += "к" + digits[1];
  return r;
};

// Нормализованный номер квартиры.
export const normApt = (a: string): string =>
  (a || "").toString().toLowerCase()
    .replace(/^(кв\.\s*|квартира\s*)/i, "")
    .replace(/[^а-яa-z0-9]/g, "").trim();

// Вытаскиваем квартиру из полной строки адреса (если нет отдельного поля apartment).
export const extractApt = (addr: string): string => {
  const m = (addr || "").match(/,\s*(?:кв\.?|квартира)\s*([а-яa-z0-9-+]+)/i);
  return m ? m[1].trim() : "";
};

// Цифры квартиры для точного запроса apartment=eq.N к базе.
export const aptDigits = (apt: string, addr?: string): string => {
  const a = (apt || "").toString() || extractApt(addr || "");
  const m = a.match(/\d+/);
  return m ? m[0] : "";
};

export interface AddrLike { address?: string | null; apartment?: string | null }
export interface AccountLike { account_number: string; address?: string | null; apartment?: string | null }

// Подбор лицевого счёта из списка accounts по нормализованным улице+дому+квартире.
export const matchAccount = (profile: AddrLike, accounts: AccountLike[]): string | null => {
  const uStreet = normStreet(profile.address || "");
  const uHouse = normHouse(profile.address || "");
  const uApt = normApt((profile.apartment || "").toString() || extractApt(profile.address || ""));
  if (!uStreet || !uHouse || !uApt) return null;
  for (const a of accounts || []) {
    if (
      normStreet(a.address || "") === uStreet &&
      normHouse(a.address || "") === uHouse &&
      normApt((a.apartment || "").toString() || extractApt(a.address || "")) === uApt
    ) {
      return a.account_number;
    }
  }
  return null;
};

/**
 * Единая утилита форматирования полного адреса без дублирования номеров квартир.
 * Если в строке адреса уже присутствует номер квартиры (кв. 128, квартира 128),
 * повторно `, кв. ${apt}` не прибавляется!
 */
export const formatFullAddress = (address?: string | null, apartment?: string | null): string => {
  const addr = (address || "").trim();
  const apt = (apartment || "").toString().trim();
  if (!addr) return apt ? `кв. ${apt}` : "";
  if (!apt) return addr;
  const hasApt = /кв\.?\s*\d+/i.test(addr) || /квартира\s*\d+/i.test(addr);
  if (hasApt) return addr;
  return `${addr}, кв. ${apt}`;
};
