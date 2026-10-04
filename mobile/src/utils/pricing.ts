// mobile/src/utils/pricing.ts
// Расчёт цен на ключи — ПОЛНАЯ КОПИЯ логики сайта (src/utils/pricing.ts),
// чтобы цены в приложении совпадали с кабинетом 1:1:
//  - ступенчатая акция (tiered_pricing) из номенклатуры товара;
//  - льготная цена на домах в статусе «Монтаж» (installation);
//  - отключение акции тумблером is_tiered_promo.

export interface KeyPriceTier {
  min_qty: number;
  price: number;
}

export const DEFAULT_KEY_TIERS: KeyPriceTier[] = [
  { min_qty: 1, price: 300 },
  { min_qty: 2, price: 250 },
  { min_qty: 3, price: 200 },
];

export const parseTieredPricing = (raw: any): KeyPriceTier[] => {
  if (!raw) return DEFAULT_KEY_TIERS;
  try {
    const list = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (Array.isArray(list) && list.length > 0) {
      return list
        .map((item: any) => ({
          min_qty: Number(item.min_qty || item.minQuantity || 1),
          price: Number(item.price || item.pricePerUnit || 300),
        }))
        .filter((item: KeyPriceTier) => !isNaN(item.min_qty) && !isNaN(item.price))
        .sort((a, b) => a.min_qty - b.min_qty);
    }
  } catch {
    // игнорируем — вернём значения по умолчанию
  }
  return DEFAULT_KEY_TIERS;
};

export interface KeyPriceCalculation {
  unitPrice: number;
  totalPrice: number;
  discountPerUnit: number;
  totalSavings: number;
  isPromoApplied: boolean;
  isInstallationApplied: boolean;
  tierText: string;
}

export const calculateKeyPriceDetails = (
  quantity: number,
  basePrice: number = 300,
  isInstallation: boolean = false,
  installationPrice?: number | null,
  isTieredPromoEnabled: boolean = true,
  tiers: KeyPriceTier[] = DEFAULT_KEY_TIERS
): KeyPriceCalculation => {
  if (quantity <= 0) {
    let previewUnit = basePrice;
    if (isInstallation) {
      previewUnit = installationPrice != null && Number(installationPrice) > 0 ? Number(installationPrice) : 200;
    } else if (isTieredPromoEnabled && tiers && tiers.length > 0) {
      const t1 = tiers.find((t) => t.min_qty === 1);
      previewUnit = t1 ? t1.price : basePrice;
    }
    return {
      unitPrice: previewUnit, totalPrice: 0,
      discountPerUnit: Math.max(0, basePrice - previewUnit), totalSavings: 0,
      isPromoApplied: false, isInstallationApplied: isInstallation, tierText: '',
    };
  }

  // Дом на монтаже — фиксированная льготная цена, акция не действует
  if (isInstallation) {
    const unitPrice = installationPrice != null && Number(installationPrice) > 0 ? Number(installationPrice) : 200;
    const totalPrice = unitPrice * quantity;
    const discountPerUnit = Math.max(0, basePrice - unitPrice);
    return {
      unitPrice, totalPrice, discountPerUnit, totalSavings: discountPerUnit * quantity,
      isPromoApplied: false, isInstallationApplied: true, tierText: '(льготная цена монтажа)',
    };
  }

  // Ступенчатая акция
  if (isTieredPromoEnabled && tiers && tiers.length > 0) {
    const sortedTiers = [...tiers].sort((a, b) => b.min_qty - a.min_qty);
    const matchedTier = sortedTiers.find((t) => quantity >= t.min_qty);
    const unitPrice = matchedTier ? matchedTier.price : basePrice;
    const totalPrice = unitPrice * quantity;
    const discountPerUnit = Math.max(0, basePrice - unitPrice);
    const isPromoApplied = discountPerUnit > 0;
    return {
      unitPrice, totalPrice, discountPerUnit, totalSavings: discountPerUnit * quantity,
      isPromoApplied, isInstallationApplied: false, tierText: isPromoApplied ? '(по акции)' : '',
    };
  }

  // Без акции — базовая цена
  const unitPrice = basePrice;
  return {
    unitPrice, totalPrice: unitPrice * quantity, discountPerUnit: 0, totalSavings: 0,
    isPromoApplied: false, isInstallationApplied: false, tierText: '',
  };
};
