// ============================================================================
// Модуль: src/utils/pricing.ts
// Назначение: Модульный расчет цен, ступенчатых акций на ключи и скидок от объема.
// Особенности:
//   1. Поддержка ступенчатой шкалы цен (Tiered Pricing) для ключей домофона:
//      - 1 шт: базовая розничная цена (300 ₽)
//      - 2 шт: скидка от объема (250 ₽/шт, итого 500 ₽)
//      - от 3 шт и более: максимальная скидка (200 ₽/шт, итого 600 ₽, 800 ₽ и т.д.)
//   2. Автоматическое отключение ступенчатой акции, если дом находится на монтаже (льготный прайс 200 ₽).
//   3. Гибкое включение/выключение и редактирование ступеней через номенклатуру товаров (CRM).
// ============================================================================

export interface KeyPriceTier {
  min_qty: number; // Минимальный порог количества ключей
  price: number;   // Цена за 1 штуку при данном количестве
}

// Стандартные ступени акции по умолчанию
export const DEFAULT_KEY_TIERS: KeyPriceTier[] = [
  { min_qty: 1, price: 300 },
  { min_qty: 2, price: 250 },
  { min_qty: 3, price: 200 },
];

/**
 * Парсер настроек ступеней цен из БД (JSONB или массив)
 */
export const parseTieredPricing = (raw: any): KeyPriceTier[] => {
  if (!raw) return DEFAULT_KEY_TIERS;
  try {
    const list = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (Array.isArray(list) && list.length > 0) {
      return list
        .map((item: any) => ({
          min_qty: Number(item.min_qty || item.minQuantity || 1),
          price: Number(item.price || item.pricePerUnit || 300),
        }))
        .filter((item: KeyPriceTier) => !isNaN(item.min_qty) && !isNaN(item.price))
        .sort((a, b) => a.min_qty - b.min_qty);
    }
  } catch (err) {
    console.warn("[Pricing] Не удалось распарсить tiered_pricing, используем значения по умолчанию:", err);
  }
  return DEFAULT_KEY_TIERS;
};

export interface KeyPriceCalculation {
  unitPrice: number;              // Итоговая цена за 1 ключ с учетом условий
  totalPrice: number;             // Общая сумма за все ключи
  discountPerUnit: number;        // Размер скидки на единицу от базовой цены
  totalSavings: number;           // Суммарная экономия клиента
  isPromoApplied: boolean;        // Активна ли ступенчатая акция
  isInstallationApplied: boolean; // Активна ли льготная цена монтажа
  tierText: string;               // Описание для чека/заявки
}

/**
 * Комплексный расчет стоимости ключей
 * @param quantity Количество ключей
 * @param basePrice Базовая цена ключа (розница, обычно 300 ₽)
 * @param isInstallation Находится ли дом в статусе «Монтаж»
 * @param installationPrice Льготная цена на монтаже (если указана)
 * @param isTieredPromoEnabled Включен ли тумблер акции в номенклатуре товара
 * @param tiers Ступени цен из номенклатуры товара
 */
export const calculateKeyPriceDetails = (
  quantity: number,
  basePrice: number = 300,
  isInstallation: boolean = false,
  installationPrice?: number | null,
  isTieredPromoEnabled: boolean = true,
  tiers: KeyPriceTier[] = DEFAULT_KEY_TIERS
): KeyPriceCalculation => {
  // Если количество 0 или меньше — возвращаем нулевые значения
  if (quantity <= 0) {
    return {
      unitPrice: basePrice,
      totalPrice: 0,
      discountPerUnit: 0,
      totalSavings: 0,
      isPromoApplied: false,
      isInstallationApplied: false,
      tierText: "",
    };
  }

  // 1. СЛУЧАЙ А: Дом находится в статусе «Монтаж»
  // При монтаже ступенчатая акция НЕ действует, применяется фиксированная льготная цена монтажа
  if (isInstallation) {
    const installPrice = installationPrice != null && Number(installationPrice) > 0 
      ? Number(installationPrice) 
      : 200; // Резервная льготная цена монтажа 200 ₽

    const unitPrice = installPrice;
    const totalPrice = unitPrice * quantity;
    const discountPerUnit = Math.max(0, basePrice - unitPrice);
    const totalSavings = discountPerUnit * quantity;

    console.log(`[Pricing: Монтаж] Ключи (${quantity} шт.): льготная цена монтажа ${unitPrice} ₽/шт, итого: ${totalPrice} ₽`);

    return {
      unitPrice,
      totalPrice,
      discountPerUnit,
      totalSavings,
      isPromoApplied: false,
      isInstallationApplied: true,
      tierText: "(льготная цена монтажа)",
    };
  }

  // 2. СЛУЧАЙ Б: Дом на ТО/обслуживании — проверяем активность ступенчатой акции
  if (isTieredPromoEnabled && tiers && tiers.length > 0) {
    // Сортируем ступени по убыванию min_qty для поиска максимального подходящего порога
    const sortedTiers = [...tiers].sort((a, b) => b.min_qty - a.min_qty);
    const matchedTier = sortedTiers.find((t) => quantity >= t.min_qty);

    const unitPrice = matchedTier ? matchedTier.price : basePrice;
    const totalPrice = unitPrice * quantity;
    const discountPerUnit = Math.max(0, basePrice - unitPrice);
    const totalSavings = discountPerUnit * quantity;
    const isPromoApplied = discountPerUnit > 0;

    console.log(`[Pricing: Акция] Ключи (${quantity} шт.): ступень ${matchedTier?.min_qty || 1}+, цена ${unitPrice} ₽/шт, экономия: ${totalSavings} ₽`);

    return {
      unitPrice,
      totalPrice,
      discountPerUnit,
      totalSavings,
      isPromoApplied,
      isInstallationApplied: false,
      tierText: isPromoApplied ? "(по акции)" : "",
    };
  }

  // 3. СЛУЧАЙ В: Акция выключена — стандартный расчет по базовой цене
  const unitPrice = basePrice;
  const totalPrice = unitPrice * quantity;

  console.log(`[Pricing: Стандарт] Ключи (${quantity} шт.): базовая цена ${unitPrice} ₽/шт, итого: ${totalPrice} ₽`);

  return {
    unitPrice,
    totalPrice,
    discountPerUnit: 0,
    totalSavings: 0,
    isPromoApplied: false,
    isInstallationApplied: false,
    tierText: "",
  };
};
