const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'components', 'Contact.tsx');
if (fs.existsSync(filePath)) {
  let content = fs.readFileSync(filePath, 'utf8');
  content = content.replace(/\r\n/g, '\n');

  // 1. Поиск кнопок телефона/WhatsApp
  const oldPhoneBlock = `                <div className="flex gap-2 mt-2">
                  <ShinyButton href="tel:+79034118393"`;
  const newPhoneBlock = `                <div className="flex flex-wrap gap-2 mt-2">
                  <ShinyButton href="tel:+79034118393"`;

  // 2. Поиск кнопок Telegram
  const oldTelegramBlock = `                <div className="flex gap-2 mt-2">
                  <ShinyButton href="https://t.me/domofondar123"`;
  const newTelegramBlock = `                <div className="flex flex-wrap gap-2 mt-2">
                  <ShinyButton href="https://t.me/domofondar123"`;

  // 3. Поиск кнопок Карт
  const oldMapBlock = `                <div className="flex gap-2 mt-2">
                  <ShinyButton href="https://yandex.ru/maps/-/CLhNYJYt"`;
  const newMapBlock = `                <div className="flex flex-wrap gap-2 mt-2">
                  <ShinyButton href="https://yandex.ru/maps/-/CLhNYJYt"`;

  let updated = 0;
  if (content.includes(oldPhoneBlock)) {
    content = content.replace(oldPhoneBlock, newPhoneBlock);
    updated++;
  }
  if (content.includes(oldTelegramBlock)) {
    content = content.replace(oldTelegramBlock, newTelegramBlock);
    updated++;
  }
  if (content.includes(oldMapBlock)) {
    content = content.replace(oldMapBlock, newMapBlock);
    updated++;
  }

  if (updated > 0) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Successfully added flex-wrap to ${updated} button wrappers in Contact.tsx`);
  } else {
    console.log("No button wrappers were matched in Contact.tsx!");
  }
} else {
  console.log("Contact.tsx not found!");
}
