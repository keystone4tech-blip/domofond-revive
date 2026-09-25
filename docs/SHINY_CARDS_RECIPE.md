# Рецепт премиальных карточек «Shiny Card» (со светящимся бегущим лучом)

> **Назначение:** Быстрое создание карточек с вращающимся лазурно-сапфировым световым контуром, стеклянным эффектом и переливающимся бейджем иконки (как в блоке статистики на главной).

---

## 1. Необходимые CSS-классы (уже подключены в `src/index.css`)

* `.shiny-border-card` — Внешний контейнер карточки. Задает скругление (`rounded-2xl` / `1.25rem`), толщину контура (1.5px), микро-подъем при наведении (`hover:-translate-y-1`) и запускает анимацию вращения светового луча `@keyframes rotate-border-ray`.
* `.shiny-border-card-inner` — Внутреннее тело карточки:
  - **Светлая тема:** градиент `linear-gradient(145deg, #f0f9ff 0%, #ffffff 45%, #e0f2fe 100%)` с легким стеклянным лазурным оттенком и `backdrop-blur-md`.
  - **Темная тема:** сапфирово-синий градиент ночи `linear-gradient(145deg, #0f172a 0%, #1e293b 50%, #172554 100%)`.
* `.shiny-icon-badge` и `.shiny-icon-badge-inner` — Обертка для логотипа/иконки с собственным микро-лучом по контуру.
* `.hero-title-shimmer` — Класс для бегущего светового блика по тексту заголовка или крупной цифре.

---

## 2. Готовый сниппет компонента (React / Tailwind)

```tsx
import { Shield } from "lucide-react";

export const ExampleShinyCard = () => {
  return (
    <div className="shiny-border-card group cursor-default">
      <div className="shiny-border-card-inner">
        {/* 1. Бейдж иконки с бегущим лучом */}
        <div className="shiny-icon-badge mb-3 sm:mb-4">
          <div className="shiny-icon-badge-inner">
            <Shield className="h-6 w-6 sm:h-7 sm:w-7 transition-transform duration-500 group-hover:scale-110" />
          </div>
        </div>

        {/* 2. Крупный заголовок или показатель с переливом */}
        <div className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight hero-title-shimmer mb-2">
          100%
        </div>

        {/* 3. Описание / подпись */}
        <div className="text-xs sm:text-sm font-medium text-slate-700 dark:text-neutral-300 leading-snug">
          Гарантия качества
        </div>
      </div>
    </div>
  );
};
```

---

## 3. Сетка карточек (Grid)

Для гармоничного отображения на всех устройствах:

```tsx
<div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-5 md:gap-6">
  {/* Карточки */}
</div>
```

---

## 4. Где находится эталонная реализация:
- **Компонент:** [`src/components/Stats.tsx`](file:///c:/Users/Keystone-Tech/Desktop/Домофондар/src/components/Stats.tsx)
- **Стили и Keyframes:** [`src/index.css`](file:///c:/Users/Keystone-Tech/Desktop/Домофондар/src/index.css) (строки 738–860)
