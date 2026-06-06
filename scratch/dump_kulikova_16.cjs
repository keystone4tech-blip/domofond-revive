const BASE_URL = 'http://185.104.114.184:8080';
const AUTH_URL = `${BASE_URL}/auth/api/auth/login`;
const POSTGREST_URL = `${BASE_URL}/api`;

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function main() {
  console.log("=== Запрос лицевых счетов для ул. Куликова Поля, д. 16 ===");
  let token = null;

  try {
    const loginRes = await fetch(AUTH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@domofond.ru', password: 'admin123' })
    });

    if (loginRes.ok) {
      const data = await loginRes.json();
      token = data.token;
    }
  } catch (err) {
    console.log(`⚠ Ошибка при авторизации: ${err.message}`);
    return;
  }

  const headers = { 'Authorization': `Bearer ${token}` };

  try {
    const url = `${POSTGREST_URL}/accounts?address=ilike.%25Куликова Поля%2516%25&limit=500`;
    console.log(`Запрос: ${url}`);
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`Статус ${res.status}: ${await res.text()}`);
    const data = await res.json();
    console.log(`Найдено записей: ${data.length}`);

    // Выведем первые 20 записей
    console.log("\nПримеры записей из БД (первые 30):");
    data.slice(0, 30).forEach(a => {
      console.log(`  - Л/С: ${a.account_number} | Адрес: "${a.address}" | Кв: "${a.apartment}" | Период: "${a.period}"`);
    });

    // Давайте посчитаем уникальные подъезды, которые определяются регулярками
    const parseEntrance = (addr) => {
      const match = addr ? addr.match(/(?:^|,|\s)(?:подъезд|п\.?)\s*(\d+)/i) : null;
      return match ? match[1] : null;
    };

    const parsedEntrances = data.map(a => parseEntrance(a.address)).filter(Boolean);
    const uniqueEntrances = Array.from(new Set(parsedEntrances)).sort((a,b) => a - b);
    console.log("\nУникальные подъезды, распарсенные из адресов:");
    console.log(uniqueEntrances);

  } catch (err) {
    console.error("Ошибка:", err.message);
  }
}

main();
