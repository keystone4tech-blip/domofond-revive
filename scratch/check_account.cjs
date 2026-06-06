const POSTGREST_URL = 'http://localhost:3000';

async function main() {
  console.log('--- Поиск лицевого счета 654 в PostgREST ---');
  try {
    // Поищем точное совпадение
    const padded = '0000000654';
    let res = await fetch(`${POSTGREST_URL}/accounts?account_number=eq.${padded}`);
    let data = await res.json();
    console.log(`Поиск по ${padded}:`, JSON.stringify(data, null, 2));

    // Поищем с частичным совпадением
    res = await fetch(`${POSTGREST_URL}/accounts?account_number=like.*654*`);
    data = await res.json();
    console.log('Поиск по *654*:', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Ошибка:', err.message);
  }
}

main();
