/**
 * Скрипт для детальной инспекции адресов на Корнилова и Бжегокайской в БД accounts
 * 
 * Запуск: node scratch/query_db.cjs
 */

const BASE_URL = 'https://domofondar.ru';
const POSTGREST_URL = `${BASE_URL}/api`;

async function queryDB() {
  console.log("=== ИНСПЕКЦИЯ АДРЕСОВ В БД ===");

  try {
    // 1. Запрос всех уникальных адресов из accounts по улице Корнилова
    const resK = await fetch(`${POSTGREST_URL}/accounts?address=ilike.*Корнилова*&select=address,apartment&limit=1000`);
    if (resK.ok) {
      const dataK = await resK.json();
      const uniqueAddressesK = Array.from(new Set(dataK.map(a => a.address)));
      console.log(`\nНайдено записей для Корнилова: ${dataK.length}`);
      console.log("Уникальные адреса Корнилова из таблицы accounts:");
      uniqueAddressesK.forEach(addr => console.log(`  - "${addr}"`));
    } else {
      console.log(`Ошибка Корнилова: ${resK.status}`);
    }

    // 2. Запрос всех уникальных адресов из accounts по улице Бжегокайская
    const resB = await fetch(`${POSTGREST_URL}/accounts?address=ilike.*Бжегокай*&select=address,apartment&limit=1000`);
    if (resB.ok) {
      const dataB = await resB.json();
      const uniqueAddressesB = Array.from(new Set(dataB.map(a => a.address)));
      console.log(`\nНайдено записей для Бжегокайской: ${dataB.length}`);
      console.log("Уникальные адреса Бжегокайской из таблицы accounts:");
      uniqueAddressesB.forEach(addr => console.log(`  - "${addr}"`));
    } else {
      console.log(`Ошибка Бжегокайской: ${resB.status}`);
    }

    // 3. Запрос unique_houses
    const resUH = await fetch(`${POSTGREST_URL}/unique_houses`);
    if (resUH.ok) {
      const dataUH = await resUH.json();
      console.log(`\nВсего во вьюхе unique_houses записей: ${dataUH.length}`);
      
      console.log("Вьюха unique_houses для Корнилова:");
      dataUH.filter(h => h.house_address.toLowerCase().includes("корнилова"))
        .forEach(h => console.log(`  - "${h.house_address}"`));

      console.log("Вьюха unique_houses для Бжегокайской:");
      dataUH.filter(h => h.house_address.toLowerCase().includes("бжегокай"))
        .forEach(h => console.log(`  - "${h.house_address}"`));
    }

  } catch (err) {
    console.error("Ошибка сети:", err.message);
  }
}

queryDB();
