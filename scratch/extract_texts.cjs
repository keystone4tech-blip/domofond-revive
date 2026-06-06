const fs = require('fs');
const path = require('path');

const bundlePath = path.join(__dirname, 'index_bundle.js');
if (!fs.existsSync(bundlePath)) {
  console.error("Bundle file not found!");
  process.exit(1);
}

const content = fs.readFileSync(bundlePath, 'utf8');
console.log("Bundle size:", content.length, "bytes");

// Ищем подстроки, связанные с тарифами
const keywords = ["тариф", "подписк", "месяц", "руб", "Бизнес", "Старт", "Премиум", "Mozhnovse", "помощник"];

console.log("\n=== ПОИСК КЛЮЧЕВЫХ ФРАГМЕНТОВ ===");
for (const kw of keywords) {
  let idx = 0;
  console.log(`\n--- Результаты для "${kw}": ---`);
  let count = 0;
  while ((idx = content.indexOf(kw, idx)) !== -1 && count < 8) {
    const start = Math.max(0, idx - 150);
    const end = Math.min(content.length, idx + 150);
    console.log(`[Pos ${idx}]: ... ${content.substring(start, end).replace(/\n/g, ' ')} ...`);
    idx += kw.length;
    count++;
  }
}
