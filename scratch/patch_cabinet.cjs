// Подключаем модуль файловой системы Node.js
const fs = require('fs');
const path = require('path');

const targetFilePath = path.join(__dirname, '..', 'src', 'pages', 'Cabinet.tsx');
console.log('Начало авто-патча Cabinet.tsx по пути:', targetFilePath);

try {
  // Читаем содержимое файла Cabinet.tsx в кодировке utf8
  let content = fs.readFileSync(targetFilePath, 'utf8');

  // Регулярное выражение для поиска функции fetchApartmentSuggestions
  const regex = /\/\/\s*Функция\s+для\s+загрузки\s+доступных\s+квартир[\s\S]+?const\s+fetchApartmentSuggestions[\s\S]+?\n\s*\};/;

  // Новая функция
  const newFunction = `  // Функция для загрузки доступных квартир по выбранному адресу дома
  const fetchApartmentSuggestions = async (selectedAddr: string) => {
    if (!selectedAddr) return;
    const { street, house } = parseAddressParts(selectedAddr);
    const cleanStreetQuery = street.replace(/(?:\\(ул\\)?|ул\\.?|улица)\\s*/gi, "").trim();
    
    console.log(\`[Квартира] Загрузка квартир. Улица: "\${street}" (\${cleanStreetQuery}), Дом: "\${house}"\`); // Логирование
    try {
      // Ищем все лицевые счета по корню названия улицы
      const { data, error } = await supabase
        .from("accounts")
        .select("address, apartment")
        .ilike("address", \`%\${cleanStreetQuery}%\`);
        
      if (error) throw error;

      if (data) {
        const userStreetNorm = normalizeStreet(street);
        const userHouseNorm = normalizeHouse(house);

        // Точно фильтруем только те квартиры, у которых совпадают нормализованные улица и дом
        const filtered = data.filter((a: any) => {
          const dbParts = (a.address || "").split(",");
          if (dbParts.length < 3) return false;

          const dbStreetNorm = normalizeStreet(dbParts[1]);
          const dbHouseNorm = normalizeHouse(dbParts[2]);

          return dbStreetNorm === userStreetNorm && dbHouseNorm === userHouseNorm;
        });

        // Извлекаем уникальные номера квартир и сортируем их по возрастанию
        const apts = filtered
          .map((item: any) => String(item.apartment || "").trim())
          .filter(Boolean);
        const uniqueApts = Array.from(new Set(apts)).sort((a, b) => {
          const numA = parseInt(a.replace(/\\D/g, "")) || 0;
          const numB = parseInt(b.replace(/\\D/g, "")) || 0;
          return numA - numB;
        });
        setApartmentSuggestions(uniqueApts);
        console.log(\`[Квартира] Загружено уникальных квартир для дома: \${uniqueApts.length}\`); // Логирование
      }
    } catch (err) {
      console.error("[Квартира] Ошибка загрузки квартир:", err);
    }
  };`;

  if (regex.test(content)) {
    console.log('Старая функция найдена по регулярному выражению. Производим замену...');
    content = content.replace(regex, newFunction);
    
    // Записываем обновленное содержимое обратно в файл
    fs.writeFileSync(targetFilePath, content, 'utf8');
    console.log('Патч успешно применен по регулярному выражению!');
  } else {
    console.error('Ошибка: функция fetchApartmentSuggestions не найдена даже по регулярному выражению!');
    process.exit(1);
  }
} catch (error) {
  console.error('Произошла непредвиденная ошибка при патчинге:', error);
  process.exit(1);
}
