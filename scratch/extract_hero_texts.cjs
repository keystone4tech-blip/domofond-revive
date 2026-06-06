const fs = require('fs');
const content = fs.readFileSync('scratch/index_bundle.js', 'utf8');

// Ищем ключевые слова главного экрана
const keywords = [
  "ИИ помошник",
  "ИИ-помощник",
  "Mr.",
  "Mozhnovse",
  "Клиент",
  "бизнес",
  "интеграци",
  "чат-бот"
];

console.log("=== Поиск текстов главного экрана ===");
for (const kw of keywords) {
  let idx = 0;
  let count = 0;
  while ((idx = content.indexOf(kw, idx)) !== -1 && count < 5) {
    const start = Math.max(0, idx - 200);
    const end = Math.min(content.length, idx + 200);
    console.log(`\n[Found "${kw}" at ${idx}]:`);
    console.log(content.substring(start, end).replace(/\n/g, ' '));
    idx += kw.length;
    count++;
  }
}
