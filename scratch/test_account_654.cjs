const BASE_URL = 'http://185.104.114.184:8080';
const AUTH_URL = `${BASE_URL}/auth/api/auth/login`;
const POSTGREST_URL = `${BASE_URL}/api`;

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function main() {
  console.log("=== Проверка Л/С 0000000654 на боевом сервере ===");
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
      console.log("✓ Авторизация на VPS успешна!");
    } else {
      console.log(`⚠ Не удалось авторизоваться (статус ${loginRes.status}: ${await loginRes.text()})`);
      return;
    }
  } catch (err) {
    console.log(`⚠ Ошибка при авторизации: ${err.message}`);
    return;
  }

  const headers = { 'Authorization': `Bearer ${token}` };

  // 1. Ищем Л/С 0000000654
  try {
    const url = `${POSTGREST_URL}/accounts?account_number=eq.0000000654`;
    console.log(`Запрос: ${url}`);
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`Статус ${res.status}: ${await res.text()}`);
    const data = await res.json();
    console.log("Результат поиска Л/С 0000000654:", JSON.stringify(data, null, 2));

    if (data && data.length > 0) {
      const found = data[0];
      const address = found.address;
      console.log(`\nАдрес счета из БД: "${address}"`);
      
      // Попробуем распарсить
      const parts = address.split(",");
      console.log("Части адреса (split):", parts);
    }
  } catch (err) {
    console.error("Ошибка при запросе Л/С:", err.message);
  }
}

main();
