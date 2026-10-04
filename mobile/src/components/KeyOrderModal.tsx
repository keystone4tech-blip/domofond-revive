// mobile/src/components/KeyOrderModal.tsx
// Модальное окно заказа электронных ключей (чипов) «Домофондар»
// Реализует ступенчатый расчет скидок и оплату через ЮKassa со шлюзом СБП/карт

import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { useAppTheme } from '@/theme';
import { apiClient } from '@/api/client';
import { calculateKeyPriceDetails, parseTieredPricing } from '@/utils/pricing';

interface KeyOrderModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  user: any;
  account: any;
  defaultAddress?: string;
}

export const KeyOrderModal: React.FC<KeyOrderModalProps> = ({
  visible,
  onClose,
  onSuccess,
  user,
  account,
  defaultAddress = '',
}) => {
  const { colors, isDark } = useAppTheme();

  const [quantity, setQuantity] = useState(1); // Количество ключей (минимум 1)
  const [address, setAddress] = useState(defaultAddress);
  const [phone, setPhone] = useState(user?.phone || '');
  const [comment, setComment] = useState('');
  const [keyProduct, setKeyProduct] = useState<any>(null);
  const [isInstallation, setIsInstallation] = useState(false);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Загружаем каталог и привязанные ключи для дома жильца
  useEffect(() => {
    if (visible) {
      setAddress(defaultAddress || account?.address || '');
      setPhone(user?.phone || '');
      loadCatalogKeys();
    }
  }, [visible, defaultAddress, account, user]);

  const loadCatalogKeys = async () => {
    setLoadingCatalog(true);
    try {
      const res = await apiClient.get('/api/catalog/products', {
        params: { account_number: account?.account_number },
      });
      if (res.data?.keys && res.data.keys.length > 0) {
        setKeyProduct(res.data.keys[0]);
      }
      setIsInstallation(!!res.data?.is_installation);
    } catch (err) {
      console.warn('[Ключи] Ошибка загрузки каталога ключей:', err);
    } finally {
      setLoadingCatalog(false);
    }
  };

  // Реальные параметры цены из номенклатуры (как на сайте): ступени, акция, льгота монтажа
  const baseKeyPrice = Number(keyProduct?.base_price ?? keyProduct?.price ?? 300);
  const keyTiers = parseTieredPricing(keyProduct?.tiered_pricing);
  const promoEnabled = keyProduct ? !!keyProduct.is_tiered_promo : true;
  const keyInstallPrice = keyProduct?.installation_price != null ? Number(keyProduct.installation_price) : null;

  const calculateKeyPricing = (qty: number) => {
    const d = calculateKeyPriceDetails(qty, baseKeyPrice, isInstallation, keyInstallPrice, promoEnabled, keyTiers);
    const baseSum = d.totalPrice;
    const feeSum = Math.round(baseSum * 0.05 * 100) / 100; // эквайринг 5%, как на сайте
    const totalSum = Math.round((baseSum + feeSum) * 100) / 100;
    const tierText = isInstallation
      ? 'Льготная цена монтажа'
      : d.isPromoApplied ? `Акция • ${d.unitPrice} ₽/шт` : 'Базовый тариф';
    return { unitPrice: d.unitPrice, baseSum, feeSum, totalSum, tierText, discountPercent: 0 };
  };

  const pricing = calculateKeyPricing(quantity);
  // Цена ступени для отображения (из реальной сетки товара)
  const tierUnit = (minQty: number) =>
    calculateKeyPriceDetails(minQty, baseKeyPrice, isInstallation, keyInstallPrice, promoEnabled, keyTiers).unitPrice;

  const handleIncrement = () => {
    if (quantity < 20) setQuantity(quantity + 1);
  };

  const handleDecrement = () => {
    if (quantity > 1) setQuantity(quantity - 1);
  };

  // Оформление заказа и переход в платежный шлюз ЮKassa
  const handlePayment = async () => {
    if (!address.trim()) {
      Alert.alert('Внимание', 'Пожалуйста, укажите точный адрес доставки ключей');
      return;
    }
    if (!phone.trim()) {
      Alert.alert('Внимание', 'Укажите контактный номер телефона');
      return;
    }

    setSubmitting(true);
    try {
      console.log(`[Ключи] Инициализация заказа ${quantity} шт. на сумму ${pricing.totalSum} ₽...`);

      const messageText = `Заказ электронных ключей: ${quantity} шт. (${pricing.tierText})\nАдрес: ${address.trim()}\nТелефон: ${phone.trim()}${comment.trim() ? `\nКомментарий: ${comment.trim()}` : ''}`;

      const orderPayload = {
        name: user?.full_name || 'Абонент',
        phone: phone.trim(),
        address: address.trim(),
        message: messageText,
        amount: pricing.baseSum,
        user_id: user?.id,
        is_mobile: true,
        source: 'mobile_app',
        items: [
          {
            product_id: keyProduct?.id || null,
            name: keyProduct?.name || 'Электронный чип-ключ Домофондар',
            quantity: quantity,
            price: pricing.unitPrice,
          },
        ],
      };

      const paymentBody = {
        amount: pricing.totalSum,
        credit_amount: pricing.baseSum,
        fee_amount: pricing.feeSum,
        description: `Заказ ${quantity} ключей домофона, ${address.trim()}`,
        account_number: account?.account_number || undefined,
        is_order: true,
        order_data: orderPayload,
        return_url: 'https://домофондар.рф/cabinet?check_payment=1&is_order=1',
      };

      const res = await apiClient.post('/api/payments/yookassa/create', paymentBody);
      const confirmUrl = res.data?.confirmation_url || res.data?.payment?.confirmation?.confirmation_url;

      if (confirmUrl) {
        console.log('[Ключи] Открытие защищенного окна ЮKassa:', confirmUrl);
        onClose();
        await WebBrowser.openBrowserAsync(confirmUrl);
        onSuccess();
      } else {
        throw new Error('Платежный шлюз не вернул ссылку подтверждения');
      }
    } catch (err: any) {
      console.error('[Ключи] Ошибка оформления заказа:', err);
      const errMsg = err.response?.data?.error || err.message || 'Не удалось сформировать платёж';
      Alert.alert('Ошибка оплаты', errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <View style={[styles.sheet, { backgroundColor: isDark ? '#171b26' : '#ffffff', borderColor: colors.border }]}>
          {/* Заголовок */}
          <View style={styles.header}>
            <View style={styles.headerTitleWrap}>
              <View style={[styles.iconWrap, { backgroundColor: isDark ? '#262a35' : '#e5eeff' }]}>
                <Ionicons name="key-outline" size={20} color={colors.primaryContainer} />
              </View>
              <View>
                <Text style={[styles.title, { color: colors.text }]}>Заказ электронных ключей</Text>
                <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                  Оригинальные защищенные чипы с кодированием
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {/* Блок выбора количества со ступенчатой ценой */}
            <View style={[styles.counterBox, { backgroundColor: isDark ? '#1c1f2a' : '#f8f9ff', borderColor: colors.border }]}>
              <View style={styles.counterInfo}>
                <Text style={[styles.counterLabel, { color: colors.text }]}>Количество ключей</Text>
                <Text style={[styles.counterDesc, { color: colors.primaryContainer }]}>
                  {pricing.tierText} • {pricing.unitPrice} ₽/шт
                </Text>
              </View>
              <View style={styles.counterControls}>
                <TouchableOpacity
                  onPress={handleDecrement}
                  style={[styles.counterBtn, { backgroundColor: isDark ? '#262a35' : '#e2e8f0' }]}
                >
                  <Ionicons name="remove" size={18} color={colors.text} />
                </TouchableOpacity>
                <Text style={[styles.counterValue, { color: colors.text }]}>{quantity}</Text>
                <TouchableOpacity
                  onPress={handleIncrement}
                  style={[styles.counterBtn, { backgroundColor: colors.primaryContainer }]}
                >
                  <Ionicons name="add" size={18} color="#ffffff" />
                </TouchableOpacity>
              </View>
            </View>

            {isInstallation ? (
              /* Дом на монтаже — действует льготная единая цена, ступенчатая акция не применяется */
              <View style={[styles.installBanner, { backgroundColor: isDark ? 'rgba(16,185,129,0.12)' : '#ecfdf5', borderColor: colors.secondary }]}>
                <Ionicons name="pricetag" size={16} color={colors.secondary} style={{ marginRight: 6 }} />
                <Text style={[styles.installBannerText, { color: colors.secondary }]}>
                  Ваш дом на монтаже — льготная цена {pricing.unitPrice} ₽ за ключ
                </Text>
              </View>
            ) : (
              /* Ступени цен — реальная сетка из номенклатуры товара */
              <View style={styles.tiersRow}>
                {[
                  { label: '1 шт', q: 1, active: quantity === 1 },
                  { label: '2 шт', q: 2, active: quantity === 2 },
                  { label: '3+ шт', q: 3, active: quantity >= 3 },
                ].map((t) => (
                  <View
                    key={t.q}
                    style={[
                      styles.tierChip,
                      {
                        backgroundColor: t.active ? (isDark ? '#262a35' : '#dbeafe') : (isDark ? '#171b26' : '#f1f5f9'),
                        borderColor: t.active ? colors.primaryContainer : colors.border,
                      },
                    ]}
                  >
                    <Text style={[styles.tierTitle, { color: colors.text }]}>{t.label}</Text>
                    <Text style={[styles.tierPrice, { color: colors.textSecondary }]}>{tierUnit(t.q)} ₽</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Адрес и контакты */}
            <Text style={[styles.label, { color: colors.textSecondary, marginTop: 14 }]}>Куда доставить ключи:</Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: isDark ? '#1c1f2a' : '#f8f9ff',
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
              value={address}
              onChangeText={setAddress}
              placeholder="Адрес (подъезд, квартира)"
              placeholderTextColor={colors.textMuted}
            />

            <Text style={[styles.label, { color: colors.textSecondary, marginTop: 10 }]}>Телефон получателя:</Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: isDark ? '#1c1f2a' : '#f8f9ff',
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              placeholder="+7 (999) 000-00-00"
              placeholderTextColor={colors.textMuted}
            />

            <Text style={[styles.label, { color: colors.textSecondary, marginTop: 10 }]}>Примечание (необязательно):</Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: isDark ? '#1c1f2a' : '#f8f9ff',
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
              value={comment}
              onChangeText={setComment}
              placeholder="Удобное время передачи ключей"
              placeholderTextColor={colors.textMuted}
            />

            {/* Расчет стоимости (комиссия эквайринга 5% добавляется на стороне ЮKassa при оплате) */}
            <View style={[styles.summaryBox, { backgroundColor: isDark ? '#1c1f2a' : '#f8f9ff', borderColor: colors.border }]}>
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryText, { color: colors.textSecondary }]}>Ключи ({quantity} шт. × {pricing.unitPrice} ₽):</Text>
                <Text style={[styles.summaryText, { color: colors.text, fontWeight: '600' }]}>{pricing.baseSum} ₽</Text>
              </View>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <View style={styles.summaryRow}>
                <Text style={[styles.totalLabel, { color: colors.text }]}>Итого:</Text>
                <Text style={[styles.totalValue, { color: colors.primaryContainer }]}>{pricing.baseSum} ₽</Text>
              </View>
              <Text style={[styles.feeNote, { color: colors.textMuted }]}>
                При оплате картой ЮKassa добавит комиссию эквайринга 5%.
              </Text>
            </View>
          </ScrollView>

          {/* Кнопка оплаты */}
          <View style={[styles.footer, { borderTopColor: colors.border }]}>
            <TouchableOpacity
              style={[styles.submitBtn, { backgroundColor: colors.primaryContainer }]}
              onPress={handlePayment}
              disabled={submitting}
              activeOpacity={0.85}
            >
              {submitting ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <>
                  <Ionicons name="card" size={18} color="#ffffff" style={{ marginRight: 8 }} />
                  <Text style={styles.submitBtnText}>Оплатить {pricing.baseSum} ₽</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(10, 14, 24, 0.75)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    maxHeight: '90%',
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
  },
  headerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  closeBtn: {
    padding: 6,
  },
  body: {
    paddingHorizontal: 20,
  },
  counterBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
  },
  counterInfo: {
    flex: 1,
  },
  counterLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  counterDesc: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  counterControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  counterBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterValue: {
    fontSize: 18,
    fontWeight: '700',
    minWidth: 24,
    textAlign: 'center',
  },
  tiersRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
  },
  installBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 6,
  },
  installBannerText: {
    fontSize: 12.5,
    fontWeight: '700',
    textAlign: 'center',
  },
  tierChip: {
    flex: 1,
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  tierTitle: {
    fontSize: 11,
    fontWeight: '600',
  },
  tierPrice: {
    fontSize: 11,
    marginTop: 2,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  input: {
    height: 46,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  summaryBox: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 14,
    marginBottom: 10,
  },
  feeNote: {
    fontSize: 11,
    marginTop: 8,
    lineHeight: 15,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 3,
  },
  summaryText: {
    fontSize: 13,
  },
  divider: {
    height: 1,
    marginVertical: 6,
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 14,
    borderTopWidth: 1,
  },
  submitBtn: {
    height: 50,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0ea5e9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  submitBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
});
