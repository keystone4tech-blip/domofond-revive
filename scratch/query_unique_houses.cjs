const POSTGREST_URL = 'https://domofondar.ru/api';

async function run() {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  try {
    const res = await fetch(`${POSTGREST_URL}/unique_houses`);
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const data = await res.json();
    console.log(`Всего записей в unique_houses: ${data.length}`);
    
    console.log("\n=== Все адреса на Бжегокайскую ===");
    const bzh = data.filter(h => h.house_address && h.house_address.toLowerCase().includes("бжегокай"));
    bzh.forEach(h => console.log(`- "${h.house_address}"`));
    
    console.log("\n=== Все адреса на Корнилова ===");
    const kor = data.filter(h => h.house_address && h.house_address.toLowerCase().includes("корнилова"));
    kor.forEach(h => console.log(`- "${h.house_address}"`));
  } catch (err) {
    console.error("Ошибка:", err);
  }
}

run();
