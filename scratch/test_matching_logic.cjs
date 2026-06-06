const BASE_URL = 'http://185.104.114.184:8080';
const AUTH_URL = `${BASE_URL}/auth/api/auth/login`;
const POSTGREST_URL = `${BASE_URL}/api`;

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// Функции нормализации из Cabinet.tsx
const normalizeStreet = (s) =>
  (s || "").toLowerCase()
    .trim()
    .replace(/^(г\.|город|пос\.|поселок)\s+[^,]+/i, "")
    .replace(/(?:\(ул\)?|ул\.?|улица|пер\.?|переулок|проспект|пр-кт|пр\.?)\s*/gi, "")
    .replace(/[^а-яa-z0-9]/g, "")
    .trim();

const normalizeHouse = (h) =>
  (h || "").toLowerCase()
    .trim()
    .replace(/^(д\.|дом)\s*/i, "")
    .replace(/\s+/g, "")
    .replace(/корпус|корп|к/gi, "k")
    .replace(/строение|стр|с/gi, "s")
    .replace(/дробь|\//g, "/")
    .replace(/[^а-яa-z0-9/]/g, "")
    .trim();

const normalizeApartment = (a) =>
  (a || "").toLowerCase()
    .trim()
    .replace(/^(кв\.\s*|квартира\s*)/i, "")
    .replace(/[^а-яa-z0-9]/g, "")
    .trim();

const extractApartmentFromAddress = (addr) => {
  if (!addr) return "";
  const match = addr.match(/,\s*(?:кв\.?|квартира)\s*([а-яa-z0-9-+]+)/i);
  return match ? match[1] : "";
};

const parseAddressParts = (fullAddr) => {
  if (!fullAddr) return { street: "", house: "" };
  const cleanAddr = fullAddr
    .replace(/,\s*(?:п(?:одъезд)?\.?\s*\d+).*$/i, "")
    .replace(/,\s*(?:кв\.?\s*[а-яa-z0-9-+]+).*$/i, "");
  const parts = cleanAddr.split(",");
  let parsedStreet = "";
  let parsedHouse = "";
  if (parts.length >= 3) {
    parsedStreet = parts[1].trim();
    parsedHouse = parts.slice(2).join(", ").trim().replace(/^(д\.\s*|дом\s*)/i, "").trim();
  } else if (parts.length === 2) {
    parsedStreet = parts[0].trim();
    parsedHouse = parts[1].trim().replace(/^(д\.\s*|дом\s*)/i, "").trim();
  } else {
    parsedStreet = fullAddr || "";
  }
  return { street: parsedStreet, house: parsedHouse };
};

async function testMatch() {
  console.log("=== Имитация фильтрации DebtCard для Л/С 0000000654 ===");
  
  // Ввод пользователя
  const inputAddress = "г. Краснодар, Куликова Поля (ул), д. 16, п 4";
  const inputApartment = "128";
  
  console.log(`Пользовательский ввод: address="${inputAddress}", apartment="${inputApartment}"`);

  // Шаг 1: Авторизуемся
  let token = null;
  const loginRes = await fetch(AUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@domofond.ru', password: 'admin123' })
  });
  if (loginRes.ok) {
    const data = await loginRes.json();
    token = data.token;
  }
  const headers = { 'Authorization': `Bearer ${token}` };

  // Шаг 2: Выполняем логику DebtCard
  const { street, house } = parseAddressParts(inputAddress);
  const cleanStreetQuery = street.replace(/(?:\(ул\)?|ул\.?|улица)\s*/gi, "").trim();
  console.log(`Распарсено: street="${street}" (query="${cleanStreetQuery}"), house="${house}"`);

  const url = `${POSTGREST_URL}/accounts?address=ilike.%${encodeURIComponent(cleanStreetQuery)}%&limit=300`;
  const res = await fetch(url, { headers });
  const data = await res.json();
  console.log(`Найдено записей по ilike: ${data.length}`);

  const userStreetNorm = normalizeStreet(street);
  const userHouseNorm = normalizeHouse(house);
  const userAptNorm = normalizeApartment(inputApartment);
  console.log(`Нормализованный ввод: street="${userStreetNorm}", house="${userHouseNorm}", apt="${userAptNorm}"`);

  const filtered = data.filter((a) => {
    const dbParts = (a.address || "").split(",");
    if (dbParts.length < 3) return false;

    const dbStreetNorm = normalizeStreet(dbParts[1]);
    const dbHouseFull = dbParts.slice(2).join(", ")
      .replace(/,\s*(?:п(?:одъезд)?\.?\s*\d+).*$/i, "")
      .replace(/,\s*(?:кв\.?\s*[а-яa-z0-9-+]+).*$/i, "");
    const dbHouseNorm = normalizeHouse(dbHouseFull);
    const dbApt = a.apartment?.trim() || extractApartmentFromAddress(a.address || "");
    const dbAptNorm = normalizeApartment(dbApt);

    const matchStreet = dbStreetNorm === userStreetNorm;
    const matchHouse = dbHouseNorm === userHouseNorm;
    const matchApt = dbAptNorm === userAptNorm;

    const isMatch = matchStreet && matchHouse && matchApt;
    if (a.account_number === "0000000654" || isMatch) {
      console.log(`\nПроверка записи ${a.account_number}:`);
      console.log(`  БД адрес: "${a.address}"`);
      console.log(`  БД кв: "${a.apartment}" (dbApt: "${dbApt}")`);
      console.log(`  dbStreetNorm: "${dbStreetNorm}" (совпало: ${matchStreet})`);
      console.log(`  dbHouseFull: "${dbHouseFull}" -> dbHouseNorm: "${dbHouseNorm}" (совпало: ${matchHouse})`);
      console.log(`  dbAptNorm: "${dbAptNorm}" (совпало: ${matchApt})`);
      console.log(`  ИТОГ СОВПАДЕНИЯ: ${isMatch}`);
    }
    return isMatch;
  });
}

testMatch();
