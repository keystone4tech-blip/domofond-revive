/**
 * Скрипт для замены регулярных выражений подъезда в Cabinet.tsx.
 * Запуск: node scratch/replace_entrance.cjs
 */
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/pages/Cabinet.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Точные подстроки для замены
const searchStr = 'const entranceMatch = address ? address.match(/(?:подъезд|п\\.?)\\s*(\\d+)/i) : null;';
const replaceStr = 'const entranceMatch = address ? address.match(/(?:^|,|\\s)(?:подъезд|п\\.?)\\s*(\\d+)/i) : null;';

// Проверим, сколько вхождений
const occurrences = content.split(searchStr).length - 1;
console.log(`Найдено вхождений для замены: ${occurrences}`);

if (occurrences > 0) {
  content = content.replaceAll(searchStr, replaceStr);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Замена успешно произведена!');
} else {
  console.log('Вхождения не найдены, возможно замена уже была произведена.');
}
