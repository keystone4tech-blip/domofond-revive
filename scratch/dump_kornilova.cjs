/**
 * Скрипт для извлечения адресов по ул. Корнилова из удаленной БД.
 * Запуск: node scratch/dump_kornilova.cjs
 */
const POSTGREST_URL = 'https://domofondar.ru/api';

async function run() {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  try {
    const url = `${POSTGREST_URL}/accounts?address=ilike.%25%D0%9A%D0%BE%D1%80%D0%BD%D0%B8%D0%BB%D0%BE%D0%B2%25&limit=1000`;
    console.log(`Запрашиваем адреса по URL: ${url}`);
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Статус ${res.status}: ${await res.text()}`);
    }
    const data = await res.json();
    console.log(`Получено записей: ${data.length}\n`);

    // Сгруппируем адреса и посмотрим подъезды/квартиры
    const addressStats = {};
    data.forEach(item => {
      const addr = item.address || '';
      if (!addressStats[addr]) {
        addressStats[addr] = [];
      }
      addressStats[addr].push(item.apartment);
    });

    console.log("=== Статистика по адресам ===");
    for (const [addr, apartments] of Object.entries(addressStats)) {
      console.log(`Адрес: "${addr}"`);
      console.log(`  Квартир: ${apartments.length}`);
      console.log(`  Примеры квартир: ${apartments.slice(0, 10).join(', ')}`);
      
      // Попробуем извлечь подъезд
      const match = addr.match(/(?:подъезд|п\.?)\s*(\d+)/i);
      console.log(`  Извлеченный подъезд: ${match ? match[1] : 'НЕ НАЙДЕН'}`);
    }
  } catch (err) {
    console.error("Ошибка:", err);
  }
}

run();
