async function test() {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  const url = 'https://domofondar.ru/media/documents/contracts/requisites_domofondar.doc';
  console.log(`Проверяем URL: ${url}`);
  try {
    const res = await fetch(url, { method: 'HEAD' });
    console.log(`Статус ответа: ${res.status} ${res.statusText}`);
    if (res.ok) {
      console.log("УСПЕХ: Файл успешно доступен для скачивания!");
    } else {
      console.log("ОШИБКА: Файл не найден или недоступен.");
    }
  } catch (err) {
    console.error("Ошибка сети:", err.message);
  }
}
test();
