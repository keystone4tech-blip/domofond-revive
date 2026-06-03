/**
 * Тестирование удаленного сопоставления лицевых счетов и автокомплита адресов
 * на боевом сервере https://domofondar.ru с кодированием параметров URL.
 * 
 * Запуск: node scratch/test_remote_addresses.cjs
 */

const BASE_URL = 'https://domofondar.ru';
const AUTH_URL = `${BASE_URL}/auth/api/auth/login`;
const POSTGREST_URL = `${BASE_URL}/api`;

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
    .replace(/корпус|корп|к/gi, "k") // приводим русское к к латинскому k
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

// Утилита для извлечения полной части дома (номер + корпус) из адреса вьюхи unique_houses
const extractHousePartFromCacheAddr = (cacheAddr) => {
  const parts = cacheAddr.split(",");
  if (parts.length < 3) return "";
  const fullHousePart = parts.slice(2).join(",").trim();
  return fullHousePart.replace(/^(д\.\s*|дом\s*)/i, "").trim();
};

async function runTests() {
  console.log("=== ЗАПУСК УДАЛЕННЫХ ТЕСТОВ АДРЕСОВ ===");
  console.log(`URL авторизации: ${AUTH_URL}`);
  console.log(`URL PostgREST: ${POSTGREST_URL}`);

  let token = null;
  
  // Шаг 1: Авторизуемся (отключаем проверку TLS на всякий случай, если дело в самоподписанном сертификате прокси)
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

  try {
    const loginRes = await fetch(AUTH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@domofond.ru', password: 'admin123' })
    });

    if (loginRes.ok) {
      const data = await loginRes.json();
      token = data.token;
      console.log("✓ Авторизация на VPS успешна!");
    } else {
      console.log(`⚠ Не удалось авторизоваться (статус ${loginRes.status}: ${await loginRes.text()}). Пробуем анонимные запросы.`);
    }
  } catch (err) {
    console.log(`⚠ Ошибка при авторизации: ${err.message}. Пробуем анонимные запросы.`);
    console.log(err.stack);
  }

  const headers = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Шаг 2: Проверяем unique_houses для улицы Корнилова и Бжегокайская
  console.log("\n--- Проверка unique_houses ---");
  try {
    const res = await fetch(`${POSTGREST_URL}/unique_houses`, { headers });
    if (!res.ok) {
      throw new Error(`Статус ${res.status}: ${await res.text()}`);
    }
    const data = await res.json();
    console.log(`Успешно получено ${data.length} уникальных адресов.`);

    // Выведем все дома для улицы Корнилова
    const kornilovaHouses = data
      .map(item => item.house_address)
      .filter(addr => addr && addr.toLowerCase().includes("корнилова"));
    console.log("\nАдреса на Корнилова в БД unique_houses:");
    kornilovaHouses.forEach(addr => {
      console.log(`  - Исходный: "${addr}"`);
      console.log(`    Извлеченный дом: "${extractHousePartFromCacheAddr(addr)}"`);
      console.log(`    Нормализованный: "${normalizeHouse(extractHousePartFromCacheAddr(addr))}"`);
    });

  } catch (err) {
    console.error("✗ Ошибка при запросе unique_houses:", err.message);
  }

  // Шаг 3: Проверяем поиск лицевого счета для Войсковая 6а кв 1
  console.log("\n--- Имитация loadDebt для Войсковая 6а, кв 1 ---");
  try {
    const street = "Войсковая";
    const house = "6а";
    const apartment = "1";
    const cleanStreetQuery = "Войсковая";

    // Кодируем параметр ilike
    const ilikeParam = `ilike.%${encodeURIComponent(cleanStreetQuery)}%`;
    const url = `${POSTGREST_URL}/accounts?address=${ilikeParam}&limit=300`;
    console.log(`Запрос лицевых счетов по URL: ${url}`);

    const res = await fetch(url, { headers });
    if (!res.ok) {
      throw new Error(`Статус ${res.status}: ${await res.text()}`);
    }
    const data = await res.json();
    console.log(`Получено ${data.length} лицевых счетов для улицы "${cleanStreetQuery}"`);

    const userStreetNorm = normalizeStreet(street);
    const userHouseNorm = normalizeHouse(house);
    const userAptNorm = normalizeApartment(apartment);

    console.log(`Нормализованный ввод пользователя: Улица="${userStreetNorm}", Дом="${userHouseNorm}", Квартира="${userAptNorm}"`);

    const filtered = data.filter((a) => {
      const dbParts = (a.address || "").split(",");
      if (dbParts.length < 3) return false;

      const dbStreetNorm = normalizeStreet(dbParts[1]);
      const dbHouseFull = dbParts.slice(2).join(", ")
        .replace(/,\s*(?:п(?:одъезд)?\.?\s*\d+).*$/i, "")
        .replace(/,\s*(?:кв\.?\s*\d+).*$/i, "");
      const dbHouseNorm = normalizeHouse(dbHouseFull);
      const dbAptNorm = normalizeApartment(a.apartment || "");

      const matchStreet = dbStreetNorm === userStreetNorm;
      const matchHouse = dbHouseNorm === userHouseNorm;
      const matchApt = dbAptNorm === userAptNorm;

      return matchStreet && matchHouse && matchApt;
    });

    if (filtered.length > 0) {
      console.log(`\n✓ УСПЕХ! Лицевой счет найден: ${filtered[0].account_number}`);
      console.log(`  Адрес: ${filtered[0].address}, кв. ${filtered[0].apartment}`);
      console.log(`  Сумма долга: ${filtered[0].debt_amount} ₽`);
    } else {
      console.log("\n✗ ОШИБКА: Лицевой счет не найден среди записей:");
      data.slice(0, 10).forEach(a => console.log(`  - "${a.address}", кв. "${a.apartment}"`));
    }
  } catch (err) {
    console.error("✗ Ошибка при проверке loadDebt:", err.message);
    console.log(err.stack);
  }
}

runTests();
