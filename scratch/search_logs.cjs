// Подключаем модули файловой системы и работы с путями
const fs = require('fs');
const path = require('path');

// Определяем путь к файлу логов
const logPath = 'C:\\Users\\Keystone-Tech\\.gemini\\antigravity\\brain\\15a19fb9-986a-4388-b053-c0c05ccebb40\\.system_generated\\logs\\transcript.jsonl';

console.log('Начало поиска инструкции в логах по пути:', logPath);

try {
  // Проверяем существование файла
  if (!fs.existsSync(logPath)) {
    console.error('Файл логов не найден!');
    process.exit(1);
  }

  // Читаем содержимое файла построчно
  const data = fs.readFileSync(logPath, 'utf8');
  const lines = data.split('\n');
  
  console.log(`Всего строк в логе: ${lines.length}`);
  
  let foundCount = 0;
  
  // Перебираем строки в поисках ключевых слов
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('Инструкция по настройке домена') || line.includes('настройке домена и SSL')) {
      foundCount++;
      console.log(`\n--- Найдено совпадение №${foundCount} на строке ${i + 1} ---`);
      
      try {
        const parsed = JSON.parse(line);
        // Выводим тип шага и его содержимое
        console.log('Тип шага:', parsed.type || 'Не указан');
        console.log('Источник:', parsed.source || 'Не указан');
        console.log('Содержимое:\n', parsed.content || 'Пусто');
      } catch (err) {
        // Если строка не валидный JSON, выводим как есть
        console.log('Не удалось распарсить JSON, сырая строка:\n', line.substring(0, 1000));
      }
    }
  }
  
  console.log(`\nПоиск завершен. Найдено совпадений: ${foundCount}`);
} catch (error) {
  console.error('Произошла ошибка при поиске:', error);
}
