const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'components', 'Contact.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Нормализуем переводы строк к LF (\n) для стабильного поиска
content = content.replace(/\r\n/g, '\n');

// 1. Замена блока Телефон / WhatsApp
const targetPhone = `                <div className="flex gap-2 mt-2">
                  <Button asChild size="sm" variant="outline">
                    <a href="tel:+79034118393">
                      <Phone className="h-4 w-4 mr-1" />
                      Позвонить
                    </a>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <a href="https://wa.me/79034118393" target="_blank" rel="noopener noreferrer">
                      <MessageCircle className="h-4 w-4 mr-1" />
                      WhatsApp
                    </a>
                  </Button>
                </div>`;

const replacementPhone = `                <div className="flex gap-2 mt-2">
                  <ShinyButton href="tel:+79034118393" className="w-full sm:w-auto py-1.5 px-3 text-xs rounded-xl">
                    <Phone className="h-3.5 w-3.5" />
                    Позвонить
                  </ShinyButton>
                  <ShinyButton href="https://wa.me/79034118393" target="_blank" rel="noopener noreferrer" className="w-full sm:w-auto py-1.5 px-3 text-xs rounded-xl">
                    <MessageCircle className="h-3.5 w-3.5" />
                    WhatsApp
                  </ShinyButton>
                </div>`;

// 2. Замена блока Telegram
const targetTelegram = `                <div className="flex gap-2 mt-2">
                  <Button asChild size="sm" variant="outline">
                    <a href="https://t.me/domofondar123" target="_blank" rel="noopener noreferrer">
                      <Send className="h-4 w-4 mr-1" />
                      Открыть чат
                    </a>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <a href="https://t.me/Domofondar_bot" target="_blank" rel="noopener noreferrer">
                      Telegram бот
                    </a>
                  </Button>
                </div>`;

const replacementTelegram = `                <div className="flex gap-2 mt-2">
                  <ShinyButton href="https://t.me/domofondar123" target="_blank" rel="noopener noreferrer" className="w-full sm:w-auto py-1.5 px-3 text-xs rounded-xl">
                    <Send className="h-3.5 w-3.5" />
                    Открыть чат
                  </ShinyButton>
                  <ShinyButton href="https://t.me/Domofondar_bot" target="_blank" rel="noopener noreferrer" className="w-full sm:w-auto py-1.5 px-3 text-xs rounded-xl">
                    Telegram бот
                  </ShinyButton>
                </div>`;

// 3. Замена блока Email
const targetEmail = `                <div className="mt-2">
                  <Button asChild size="sm" variant="outline">
                    <a href="mailto:domofondar@mail.ru">
                      <Mail className="h-4 w-4 mr-1" />
                      Написать
                    </a>
                  </Button>
                </div>`;

const replacementEmail = `                <div className="mt-2">
                  <ShinyButton href="mailto:domofondar@mail.ru" className="w-full sm:w-auto py-1.5 px-3 text-xs rounded-xl">
                    <Mail className="h-3.5 w-3.5" />
                    Написать
                  </ShinyButton>
                </div>`;

// 4. Замена блока Адрес офиса
const targetAddress = `                <div className="flex gap-2 mt-2">
                  <Button asChild size="sm" variant="outline">
                    <a href="https://yandex.ru/maps/-/CLhNYJYt" target="_blank" rel="noopener noreferrer">
                      <MapPin className="h-4 w-4 mr-1" />
                      Яндекс Карты
                    </a>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <a href="https://go.2gis.com/Morvu" target="_blank" rel="noopener noreferrer">
                      <MapPin className="h-4 w-4 mr-1" />
                      2GIS
                    </a>
                  </Button>
                </div>`;

const replacementAddress = `                <div className="flex gap-2 mt-2">
                  <ShinyButton href="https://yandex.ru/maps/-/CLhNYJYt" target="_blank" rel="noopener noreferrer" className="w-full sm:w-auto py-1.5 px-3 text-xs rounded-xl">
                    <MapPin className="h-3.5 w-3.5" />
                    Яндекс Карты
                  </ShinyButton>
                  <ShinyButton href="https://go.2gis.com/Morvu" target="_blank" rel="noopener noreferrer" className="w-full sm:w-auto py-1.5 px-3 text-xs rounded-xl">
                    <MapPin className="h-3.5 w-3.5" />
                    2GIS
                  </ShinyButton>
                </div>`;

// 5. Замена кнопки Отправить заявку
const targetSubmit = `              <Button type="submit" size="lg" className="w-full gradient-primary text-primary-foreground">
                Отправить заявку
              </Button>`;

const replacementSubmit = `              <ShinyButton type="submit" className="w-full py-3.5 rounded-xl text-base font-semibold">
                Отправить заявку
              </ShinyButton>`;

// Проверяем наличие подстрок и заменяем
let replacedCount = 0;

if (content.includes(targetPhone)) {
  content = content.replace(targetPhone, replacementPhone);
  replacedCount++;
} else {
  console.log("Phone block not found!");
}

if (content.includes(targetTelegram)) {
  content = content.replace(targetTelegram, replacementTelegram);
  replacedCount++;
} else {
  console.log("Telegram block not found!");
}

if (content.includes(targetEmail)) {
  content = content.replace(targetEmail, replacementEmail);
  replacedCount++;
} else {
  console.log("Email block not found!");
}

if (content.includes(targetAddress)) {
  content = content.replace(targetAddress, replacementAddress);
  replacedCount++;
} else {
  console.log("Address block not found!");
}

if (content.includes(targetSubmit)) {
  content = content.replace(targetSubmit, replacementSubmit);
  replacedCount++;
} else {
  console.log("Submit block not found!");
}

if (replacedCount > 0) {
  // Сохраняем обратно с переносами строк \n (Vite и Git отлично с этим работают)
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Successfully updated ${replacedCount} buttons in Contact.tsx`);
} else {
  console.log("No buttons were updated in Contact.tsx");
}
