const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/pages/Cabinet.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Точный блок, который мы хотим заменить
const targetBlock = `                  {/* Переключатель типа помещения для заявки */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Тип недвижимости</Label>
                    <div className="flex rounded-xl border border-slate-200 dark:border-slate-800 p-0.5 bg-white/20 dark:bg-slate-900/20 max-w-xs">
                      <button
                        type="button"
                        onClick={() => {
                          setOrderPremiseType("apartment");
                          console.log("[Заявка] Выбран тип помещения: Квартира/Офис");
                        }}
                        className={\`flex-1 py-1 text-xs font-semibold rounded-lg transition-all \${
                          orderPremiseType === "apartment"
                            ? "bg-white dark:bg-slate-800 text-foreground shadow-sm font-bold"
                            : "text-muted-foreground hover:text-foreground"
                        }\`}
                      >
                        🏢 Кв. / Офис
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setOrderPremiseType("private");
                          console.log("[Заявка] Выбран тип помещения: Частный дом");
                        }}
                        className={\`flex-1 py-1 text-xs font-semibold rounded-lg transition-all \${
                          orderPremiseType === "private"
                            ? "bg-white dark:bg-slate-800 text-foreground shadow-sm font-bold"
                            : "text-muted-foreground hover:text-foreground"
                        }\`}
                      >
                        🏡 Частный дом
                      </button>
                    </div>
                  </div>

                  {/* Адрес: Улица, Дом, Квартира */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1.5 sm:col-span-1">
                      <Label htmlFor="orderStreet" className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-0.5">
                        Улица <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="orderStreet"
                        value={orderStreet}
                        onChange={(e) => setOrderStreet(e.target.value)}
                        placeholder="Название улицы"
                        className="bg-white/50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 h-9 text-sm font-medium transition-all rounded-xl focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="orderHouse" className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-0.5">
                        Дом <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="orderHouse"
                        value={orderHouse}
                        onChange={(e) => setOrderHouse(e.target.value)}
                        placeholder="Например: 58а"
                        className="bg-white/50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 h-9 text-sm font-medium transition-all rounded-xl focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                      />
                    </div>
                    {orderPremiseType === "apartment" && (
                      <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
                        <Label htmlFor="orderApartment" className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-0.5">
                          Кв. / Офис <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="orderApartment"
                          value={orderApartment}
                          onChange={(e) => setOrderApartment(e.target.value)}
                          placeholder="Например: 12"
                          className="bg-white/50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 h-9 text-sm font-medium transition-all rounded-xl focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                        />
                      </div>
                    )}
                  </div>`;

// Новый блок разметки
const replacementBlock = `                  {/* Адрес: Улица, Дом, Квартира в одной строке без ручного выбора типа недвижимости */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1.5 sm:col-span-1">
                      <Label htmlFor="orderStreet" className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-0.5">
                        Улица <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="orderStreet"
                        value={orderStreet}
                        onChange={(e) => setOrderStreet(e.target.value)}
                        placeholder="Название улицы"
                        className="bg-white/50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 h-9 text-sm font-medium transition-all rounded-xl focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="orderHouse" className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-0.5">
                        Дом <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="orderHouse"
                        value={orderHouse}
                        onChange={(e) => setOrderHouse(e.target.value)}
                        placeholder="Например: 58а"
                        className="bg-white/50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 h-9 text-sm font-medium transition-all rounded-xl focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                      />
                    </div>
                    <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
                      <Label htmlFor="orderApartment" className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-0.5">
                        Кв. / Офис
                      </Label>
                      <Input
                        id="orderApartment"
                        value={orderApartment}
                        onChange={(e) => setOrderApartment(e.target.value)}
                        placeholder="Например: 12"
                        className="bg-white/50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 h-9 text-sm font-medium transition-all rounded-xl focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                      />
                    </div>
                  </div>`;

const normalizedContent = content.replace(/\r\n/g, '\n');
const normalizedTarget = targetBlock.replace(/\r\n/g, '\n');
const normalizedReplacement = replacementBlock.replace(/\r\n/g, '\n');

if (normalizedContent.includes(normalizedTarget)) {
  const updatedContent = normalizedContent.replace(normalizedTarget, normalizedReplacement);
  fs.writeFileSync(filePath, updatedContent, 'utf8');
  console.log('SUCCESS: Order dialog replaced successfully!');
} else {
  console.error('ERROR: Target block for OrderDialog not found in file!');
  // Найдем наиболее длинный отрезок который совпадает чтобы понять где расхождение
  const lines = normalizedTarget.split('\n');
  let matchedBlock = '';
  for (let i = 0; i < lines.length; i++) {
    const testBlock = lines.slice(0, i + 1).join('\n');
    if (normalizedContent.includes(testBlock)) {
      matchedBlock = testBlock;
    } else {
      console.log('Failed to match starting from line:', i + 1, 'Content of line:', lines[i]);
      break;
    }
  }
}
