const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/pages/Cabinet.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Точный блок, который мы хотим заменить (начиная от комментария 5.5 и заканчивая концом блока этажа)
const targetBlock = `                {/* 5.5 и 6. Подъезд и Квартира на одной строке */}
                {premiseType === "apartment" && (
                  <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-1 duration-300">
                    {/* 5.5. Помещение (Подъезд) */}
                    <div className="space-y-2 relative text-left">
                      <Label htmlFor="entrance" className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                        🚪 Номер подъезда {entranceSuggestions.length > 0 && "*"}
                      </Label>
                      <Input
                        id="entrance"
                        value={entrance}
                        onChange={(e) => setEntrance(e.target.value)}
                        onFocus={() => {
                          if (!isLocked) {
                            fetchApartmentSuggestions(address);
                            setShowEntranceSuggestions(true);
                          }
                        }}
                        onBlur={() => setTimeout(() => setShowEntranceSuggestions(false), 200)}
                        placeholder={displayHouse?.trim() ? (entranceSuggestions.length > 0 ? "Выберите или введите подъезд" : "Номер подъезда (необязательно)") : "Сначала введите номер дома"}
                        disabled={isLocked || !displayStreet?.trim() || !displayHouse?.trim()}
                        className="bg-white/40 dark:bg-slate-900/40 border-slate-200 dark:border-slate-700 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 font-medium h-10 transition-all rounded-xl placeholder-slate-400 disabled:opacity-50 disabled:cursor-not-allowed"
                      />

                      {/* Всплывающая сетка доступных подъездов */}
                      {showEntranceSuggestions && entranceSuggestions.length > 0 && (
                        <div className="absolute z-50 w-full mt-1.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200/50 dark:border-slate-700/50 rounded-2xl shadow-2xl max-h-48 overflow-y-auto p-3 animate-in fade-in-50 slide-in-from-top-1 duration-200">
                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <DoorOpen className="h-3.5 w-3.5 text-primary" />
                            <span>Выберите подъезд в этом доме:</span>
                          </div>
                          <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                            {entranceSuggestions.map((ent, index) => (
                              <button
                                key={index}
                                type="button"
                                className={\`px-1.5 py-1.5 text-xs text-center rounded-lg border transition-all focus:outline-none font-semibold \${
                                  entrance === ent
                                    ? "bg-amber-500 text-white border-amber-500 scale-102"
                                    : "border-slate-200 dark:border-slate-700 hover:bg-amber-500/10 hover:border-amber-500/30 text-foreground"
                                }\`}
                                onClick={() => {
                                  setEntrance(ent);
                                  setShowEntranceSuggestions(false);
                                }}
                              >
                                Подъезд {ent}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 6. Помещение (Квартира/Офис) */}
                    <div className="space-y-2 relative text-left">
                      <Label htmlFor="apartment" className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">🏢 Квартира / Офис / Помещение *</Label>
                      <Input
                        id="apartment"
                        value={apartment}
                        onChange={(e) => setApartment(e.target.value)}
                        onFocus={() => {
                          if (!isLocked) {
                            fetchApartmentSuggestions(address);
                            setShowApartmentSuggestions(true);
                          }
                        }}
                        onBlur={() => setTimeout(() => setShowApartmentSuggestions(false), 200)}
                        placeholder={
                          !displayHouse?.trim() 
                            ? "Сначала введите номер дома" 
                            : (entranceSuggestions.length > 0 && !entrance)
                            ? "Рекомендуется выбрать подъезд"
                            : "Номер квартиры, офиса или бокса"
                        }
                        disabled={isLocked || !displayStreet?.trim() || !displayHouse?.trim()}
                        className="bg-white/40 dark:bg-slate-900/40 border-slate-200 dark:border-slate-700 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 font-medium h-10 transition-all rounded-xl placeholder-slate-400 disabled:opacity-50 disabled:cursor-not-allowed"
                      />

                      {/* Всплывающая сетка доступных квартир */}
                      {showApartmentSuggestions && apartmentSuggestions.length > 0 && (
                        <div className="absolute z-50 w-full mt-1.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200/50 dark:border-slate-700/50 rounded-2xl shadow-2xl max-h-48 overflow-y-auto p-3 animate-in fade-in-50 slide-in-from-top-1 duration-200">
                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <DoorOpen className="h-3.5 w-3.5 text-primary" />
                            <span>
                              {entrance ? \`Квартиры подъезда \${entrance}:\` : "Подключенные абоненты в этом доме:"}
                            </span>
                          </div>
                          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-1.5">
                            {apartmentSuggestions.map((apt, index) => (
                              <button
                                key={index}
                                type="button"
                                className="px-1.5 py-1.5 text-xs text-center rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-amber-500/10 hover:border-amber-500/30 transition-all focus:bg-amber-500/10 focus:outline-none font-semibold text-foreground hover:scale-105 active:scale-95"
                                onClick={() => {
                                  setApartment(apt);
                                  setShowApartmentSuggestions(false);
                                }}
                              >
                                {apt}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 7. Этаж */}
                {premiseType === "apartment" && (
                  <div className="space-y-2 text-left animate-in fade-in slide-in-from-top-1 duration-300">
                    <Label htmlFor="floor" className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">🏢 Этаж *</Label>
                    <Input
                      id="floor"
                      value={floor}
                      onChange={(e) => setFloor(e.target.value)}
                      placeholder={apartment?.trim() ? "Номер этажа" : "Сначала введите номер квартиры"}
                      disabled={isLocked || !displayStreet?.trim() || !displayHouse?.trim() || !apartment?.trim()}
                      className="bg-white/40 dark:bg-slate-900/40 border-slate-200 dark:border-slate-700 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 font-medium h-10 transition-all rounded-xl placeholder-slate-400 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  </div>
                )}`;

// Новый блок разметки
const replacementBlock = `                {/* Информационная подсказка о важности полных данных */}
                {((displayStreet?.trim() && displayHouse?.trim()) || entrance || apartment || floor) && (
                  <div className="flex items-start gap-2.5 text-[11px] text-blue-700 dark:text-blue-300 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/50 dark:border-blue-800/30 px-3.5 py-3 rounded-xl animate-in fade-in duration-300 text-left my-2">
                    <Info className="h-4 w-4 shrink-0 mt-0.5 text-blue-500" />
                    <div>
                      <span className="font-bold">Пожалуйста, укажите полные данные</span> (подъезд, квартира, этаж), если они у вас есть. Это позволит нам значительно быстрее реагировать на ваши заявки по ремонту и доставке ключей.
                    </div>
                  </div>
                )}

                {/* Поля Подъезд, Квартира и Этаж в единой сетке */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 animate-in fade-in duration-300">
                  {/* 5.5. Помещение (Подъезд) */}
                  <div className="space-y-2 relative text-left">
                    <Label htmlFor="entrance" className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                      🚪 Номер подъезда
                    </Label>
                    <Input
                      id="entrance"
                      value={entrance}
                      onChange={(e) => setEntrance(e.target.value)}
                      onFocus={() => {
                        if (!isLocked) {
                          fetchApartmentSuggestions(address);
                          setShowEntranceSuggestions(true);
                        }
                      }}
                      onBlur={() => setTimeout(() => setShowEntranceSuggestions(false), 200)}
                      placeholder={displayHouse?.trim() ? (entranceSuggestions.length > 0 ? "Выберите подъезд" : "Номер подъезда") : "Сначала введите дом"}
                      disabled={isLocked || !displayStreet?.trim() || !displayHouse?.trim()}
                      className="bg-white/40 dark:bg-slate-900/40 border-slate-200 dark:border-slate-700 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 font-medium h-10 transition-all rounded-xl placeholder-slate-400 disabled:opacity-50 disabled:cursor-not-allowed"
                    />

                    {/* Всплывающая сетка доступных подъездов */}
                    {showEntranceSuggestions && entranceSuggestions.length > 0 && (
                      <div className="absolute z-50 w-full mt-1.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200/50 dark:border-slate-700/50 rounded-2xl shadow-2xl max-h-48 overflow-y-auto p-3 animate-in fade-in-50 slide-in-from-top-1 duration-200">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                          <DoorOpen className="h-3.5 w-3.5 text-primary" />
                          <span>Выберите подъезд в этом доме:</span>
                        </div>
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                          {entranceSuggestions.map((ent, index) => (
                            <button
                              key={index}
                              type="button"
                              className={\`px-1.5 py-1.5 text-xs text-center rounded-lg border transition-all focus:outline-none font-semibold \${
                                entrance === ent
                                  ? "bg-amber-500 text-white border-amber-500 scale-102"
                                  : "border-slate-200 dark:border-slate-700 hover:bg-amber-500/10 hover:border-amber-500/30 text-foreground"
                              }\`}
                              onClick={() => {
                                setEntrance(ent);
                                setShowEntranceSuggestions(false);
                              }}
                            >
                              Подъезд {ent}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 6. Помещение (Квартира/Офис) */}
                  <div className="space-y-2 relative text-left">
                    <Label htmlFor="apartment" className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">🏢 Квартира / Офис / Помещение</Label>
                    <Input
                      id="apartment"
                      value={apartment}
                      onChange={(e) => {
                        setApartment(e.target.value);
                        setFloor(""); // Сбрасываем этаж при изменении квартиры вручную
                      }}
                      onFocus={() => {
                        if (!isLocked) {
                          fetchApartmentSuggestions(address);
                          setShowApartmentSuggestions(true);
                        }
                      }}
                      onBlur={() => setTimeout(() => setShowApartmentSuggestions(false), 200)}
                      placeholder={
                        !displayHouse?.trim() 
                          ? "Сначала введите дом" 
                          : "Квартира или офис"
                      }
                      disabled={isLocked || !displayStreet?.trim() || !displayHouse?.trim()}
                      className="bg-white/40 dark:bg-slate-900/40 border-slate-200 dark:border-slate-700 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 font-medium h-10 transition-all rounded-xl placeholder-slate-400 disabled:opacity-50 disabled:cursor-not-allowed"
                    />

                    {/* Всплывающая сетка доступных квартир */}
                    {showApartmentSuggestions && apartmentSuggestions.length > 0 && (
                      <div className="absolute z-50 w-full mt-1.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200/50 dark:border-slate-700/50 rounded-2xl shadow-2xl max-h-48 overflow-y-auto p-3 animate-in fade-in-50 slide-in-from-top-1 duration-200">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                          <DoorOpen className="h-3.5 w-3.5 text-primary" />
                          <span>
                            {entrance ? \`Квартиры подъезда \${entrance}:\` : "Подключенные абоненты в этом доме:"}
                          </span>
                        </div>
                        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-1.5">
                          {apartmentSuggestions.map((apt, index) => (
                            <button
                              key={index}
                              type="button"
                              className="px-1.5 py-1.5 text-xs text-center rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-amber-500/10 hover:border-amber-500/30 transition-all focus:bg-amber-500/10 focus:outline-none font-semibold text-foreground hover:scale-105 active:scale-95"
                              onClick={() => {
                                setApartment(apt);
                                setFloor(""); // Сбрасываем этаж при выборе квартиры из подсказок
                                setShowApartmentSuggestions(false);
                              }}
                            >
                              {apt}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 7. Этаж */}
                  <div className="space-y-2 text-left">
                    <Label htmlFor="floor" className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">🏢 Этаж</Label>
                    <Input
                      id="floor"
                      value={floor}
                      onChange={(e) => setFloor(e.target.value)}
                      placeholder="Номер этажа"
                      disabled={isLocked || !displayStreet?.trim() || !displayHouse?.trim()}
                      className="bg-white/40 dark:bg-slate-900/40 border-slate-200 dark:border-slate-700 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 font-medium h-10 transition-all rounded-xl placeholder-slate-400 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  </div>
                </div>`;

const normalizedContent = content.replace(/\r\n/g, '\n');
const normalizedTarget = targetBlock.replace(/\r\n/g, '\n');
const normalizedReplacement = replacementBlock.replace(/\r\n/g, '\n');

if (normalizedContent.includes(normalizedTarget)) {
  const updatedContent = normalizedContent.replace(normalizedTarget, normalizedReplacement);
  // Записываем обратно в UTF-8
  fs.writeFileSync(filePath, updatedContent, 'utf8');
  console.log('SUCCESS: Layout replaced successfully!');
} else {
  console.error('ERROR: Target block not found in file!');
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
