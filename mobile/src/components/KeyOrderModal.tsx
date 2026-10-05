// mobile/src/components/KeyOrderModal.tsx
// Заказ электронных ключей «Домофондар». Полноэкранное окно, карточки выбора количества
// с суммами из базы (ступени/акции/монтаж), своё количество, авто-телефон, оплата ЮKassa.

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
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  visible, onClose, onSuccess, user, account, defaultAddress = '',
}) => {
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();

  const [quantity, setQuantity] = useState(1);
  const [customQty, setCustomQty] = useState('');
  const [contactPhone, setContactPhone] = useState(''); // только если в профиле нет телефона
  const [comment, setComment] = useState('');
  const [keyProduct, setKeyProduct] = useState<any>(null);
  const [isInstallation, setIsInstallation] = useState(false);
  const [noEntrance, setNoEntrance] = useState(false);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Данные получателя берём ИЗ ПРОФИЛЯ зарегистрированного пользователя (без редактирования).
  // Телефон НЕ подтягиваем из чужого лицевого счёта — только собственный номер профиля.
  const recipientName = (user?.full_name || '').trim() || 'Получатель не указан';
  const profileAddress = (user?.address || account?.address || defaultAddress || '').trim();
  const profilePhone = (user?.phone || '').trim();
  const needContactPhone = !profilePhone; // в профиле нет телефона — просим обязательный контактный номер
  const effectivePhone = profilePhone || contactPhone.trim();

  useEffect(() => {
    if (visible) {
      setQuantity(1);
      setCustomQty('');
      setContactPhone('');
      loadCatalogKeys();
    }
  }, [visible, defaultAddress, account, user]);

  const loadCatalogKeys = async () => {
    setLoadingCatalog(true);
    try {
      const res = await apiClient.get('/api/catalog/products', {
        params: { account_number: account?.account_number, address: defaultAddress || account?.address || user?.address },
      });
      if (res.data?.keys && res.data.keys.length > 0) setKeyProduct(res.data.keys[0]);
      setIsInstallation(!!res.data?.is_installation);
      setNoEntrance(!!res.data?.no_entrance || !(res.data?.keys?.length));
    } catch (err) {
      console.warn('[Ключи] Ошибка загрузки каталога ключей:', err);
    } finally {
      setLoadingCatalog(false);
    }
  };

  // Реальные параметры цены из номенклатуры (как на сайте)
  const baseKeyPrice = Number(keyProduct?.base_price ?? keyProduct?.price ?? 300);
  const keyTiers = parseTieredPricing(keyProduct?.tiered_pricing);
  const promoEnabled = keyProduct ? !!keyProduct.is_tiered_promo : true;
  const keyInstallPrice = keyProduct?.installation_price != null ? Number(keyProduct.installation_price) : null;

  const calc = (qty: number) =>
    calculateKeyPriceDetails(qty, baseKeyPrice, isInstallation, keyInstallPrice, promoEnabled, keyTiers);

  const d = calc(quantity);
  const baseSum = d.totalPrice;
  const feeSum = Math.round(baseSum * 0.05 * 100) / 100; // комиссия эквайринга добавляется на ЮKassa
  const totalSum = Math.round((baseSum + feeSum) * 100) / 100;
  const unitPrice = d.unitPrice;
  const tierText = isInstallation
    ? 'Льготная цена монтажа'
    : d.isPromoApplied ? `Акция • ${unitPrice} ₽/шт` : 'Базовый тариф';

  const setQty = (n: number) => {
    setQuantity(n);
    setCustomQty('');
  };
  const onCustomChange = (t: string) => {
    const digits = t.replace(/\D/g, '');
    setCustomQty(digits);
    const n = parseInt(digits, 10);
    if (!isNaN(n) && n > 0) setQuantity(Math.min(n, 999));
  };

  const handlePayment = async () => {
    if (!quantity || quantity < 1) { Alert.alert('Внимание', 'Укажите количество ключей'); return; }
    if (!profileAddress) { Alert.alert('Внимание', 'В вашем профиле не указан адрес. Привяжите адрес на главном экране.'); return; }
    if (!effectivePhone) { Alert.alert('Укажите телефон', 'В профиле нет номера телефона. Введите контактный номер для связи.'); return; }

    setSubmitting(true);
    try {
      const messageText = `Заказ электронных ключей: ${quantity} шт. (${tierText})\nПолучатель: ${recipientName}\nАдрес: ${profileAddress}\nТелефон: ${effectivePhone}${comment.trim() ? `\nДоп. информация: ${comment.trim()}` : ''}`;
      const orderPayload = {
        name: recipientName, phone: effectivePhone, address: profileAddress,
        message: messageText, amount: baseSum, user_id: user?.id, is_mobile: true, source: 'mobile_app',
        items: [{ product_id: keyProduct?.id || null, name: keyProduct?.name || 'Электронный чип-ключ Домофондар', quantity, price: unitPrice }],
      };
      const paymentBody = {
        amount: totalSum, credit_amount: baseSum, fee_amount: feeSum,
        description: `Заказ ${quantity} ключей домофона, ${profileAddress}`.slice(0, 128),
        account_number: account?.account_number || undefined,
        is_order: true, order_data: orderPayload,
        return_url: 'https://домофондар.рф/cabinet?check_payment=1&is_order=1',
      };
      const res = await apiClient.post('/api/payments/yookassa/create', paymentBody);
      const confirmUrl = res.data?.confirmation_url || res.data?.payment?.confirmation?.confirmation_url;
      if (confirmUrl) {
        onClose();
        await WebBrowser.openBrowserAsync(confirmUrl);
        onSuccess();
      } else {
        throw new Error('Платёжный шлюз не вернул ссылку подтверждения');
      }
    } catch (err: any) {
      const errMsg = err.response?.data?.error || err.message || 'Не удалось сформировать платёж';
      Alert.alert('Ошибка оплаты', errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const topPad = Math.max(insets.top, 12) + 4;
  const botPad = Math.max(insets.bottom, 12);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="fullScreen">
      <View style={[styles.screen, { backgroundColor: colors.background, paddingTop: topPad }]}>
        {/* Шапка */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <View style={styles.headerTitleWrap}>
            <View style={[styles.iconWrap, { backgroundColor: isDark ? '#262a35' : '#e5eeff' }]}>
              <Ionicons name="key-outline" size={20} color={colors.primaryContainer} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: colors.text }]}>Заказ электронных ключей</Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]} numberOfLines={1}>Защищённые чипы с кодированием</Text>
            </View>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={24} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: 16 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {loadingCatalog ? (
              <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                <ActivityIndicator color={colors.primaryContainer} />
              </View>
            ) : null}

            {!loadingCatalog && noEntrance ? (
              <View style={[styles.officeCard, { backgroundColor: isDark ? '#1c1f2a' : '#f8f9ff', borderColor: colors.border }]}>
                <Ionicons name="business-outline" size={28} color={colors.primaryContainer} />
                <Text style={[styles.officeTitle, { color: colors.text }]}>Заказ по вашему адресу — через офис</Text>
                <Text style={[styles.officeText, { color: colors.textSecondary }]}>
                  Чтобы заказать ключи по вашему адресу, обратитесь в офис — менеджер поможет с оформлением.
                </Text>
                <TouchableOpacity style={[styles.officeBtn, { backgroundColor: colors.primaryContainer }]} onPress={() => Linking.openURL('tel:+79034118393')} activeOpacity={0.85}>
                  <Ionicons name="call" size={16} color="#fff" style={{ marginRight: 6 }} />
                  <Text style={styles.officeBtnText}>+7 (903) 411-83-93</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {!noEntrance ? (<>
            {isInstallation ? (
              <View style={[styles.installBanner, { backgroundColor: isDark ? 'rgba(16,185,129,0.12)' : '#ecfdf5', borderColor: colors.secondary }]}>
                <Ionicons name="pricetag" size={16} color={colors.secondary} style={{ marginRight: 6 }} />
                <Text style={[styles.installBannerText, { color: colors.secondary }]}>Ваш дом на монтаже — льготная цена {unitPrice} ₽ за ключ</Text>
              </View>
            ) : null}

            {/* Карточки выбора количества (суммы из базы) */}
            <Text style={[styles.label, { color: colors.textSecondary }]}>Выберите количество ключей:</Text>
            <View style={styles.cardsGrid}>
              {[1, 2, 3, 4, 5, 6].map((n) => {
                const total = calc(n).totalPrice;
                const active = quantity === n;
                return (
                  <TouchableOpacity
                    key={n}
                    onPress={() => setQty(n)}
                    activeOpacity={0.85}
                    style={[
                      styles.qtyCard,
                      {
                        backgroundColor: active ? colors.primaryContainer : (isDark ? '#1c1f2a' : '#f8f9ff'),
                        borderColor: active ? colors.primaryContainer : colors.border,
                      },
                    ]}
                  >
                    <Text style={[styles.qtyCardNum, { color: active ? '#fff' : colors.text }]}>{n} шт</Text>
                    <Text style={[styles.qtyCardSum, { color: active ? '#fff' : colors.primaryContainer }]}>{total} ₽</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Своё количество */}
            <Text style={[styles.label, { color: colors.textSecondary, marginTop: 14 }]}>Или своё количество:</Text>
            <TextInput
              style={[styles.input, { backgroundColor: isDark ? '#1c1f2a' : '#f8f9ff', borderColor: quantity > 6 ? colors.primaryContainer : colors.border, color: colors.text }]}
              value={customQty}
              onChangeText={onCustomChange}
              keyboardType="number-pad"
              placeholder="например: 10"
              placeholderTextColor={colors.textMuted}
            />

            {/* Получатель, адрес и телефон — строго из профиля, без возможности редактирования */}
            <Text style={[styles.label, { color: colors.textSecondary, marginTop: 14 }]}>Получатель:</Text>
            <View style={[styles.readonlyField, { backgroundColor: isDark ? '#15181f' : '#f1f4fb', borderColor: colors.border }]}>
              <Ionicons name="person-outline" size={16} color={colors.textMuted} style={{ marginRight: 8 }} />
              <Text style={[styles.readonlyText, { color: colors.text }]} numberOfLines={1}>{recipientName}</Text>
            </View>

            <Text style={[styles.label, { color: colors.textSecondary, marginTop: 10 }]}>Куда доставить ключи (адрес из профиля):</Text>
            <View style={[styles.readonlyField, { backgroundColor: isDark ? '#15181f' : '#f1f4fb', borderColor: colors.border }]}>
              <Ionicons name="location-outline" size={16} color={colors.textMuted} style={{ marginRight: 8 }} />
              <Text style={[styles.readonlyText, { color: profileAddress ? colors.text : colors.error }]} numberOfLines={2}>
                {profileAddress || 'Адрес не указан — привяжите адрес на главном экране'}
              </Text>
            </View>

            {needContactPhone ? (
              <>
                <Text style={[styles.label, { color: colors.error, marginTop: 10 }]}>Контактный номер для связи (обязательно):</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: isDark ? '#1c1f2a' : '#f8f9ff', borderColor: contactPhone.trim() ? colors.border : colors.error, color: colors.text }]}
                  value={contactPhone} onChangeText={setContactPhone} keyboardType="phone-pad"
                  placeholder="+7 (999) 000-00-00" placeholderTextColor={colors.textMuted}
                />
              </>
            ) : (
              <>
                <Text style={[styles.label, { color: colors.textSecondary, marginTop: 10 }]}>Телефон получателя (из профиля):</Text>
                <View style={[styles.readonlyField, { backgroundColor: isDark ? '#15181f' : '#f1f4fb', borderColor: colors.border }]}>
                  <Ionicons name="call-outline" size={16} color={colors.textMuted} style={{ marginRight: 8 }} />
                  <Text style={[styles.readonlyText, { color: colors.text }]}>{profilePhone}</Text>
                </View>
              </>
            )}

            <Text style={[styles.label, { color: colors.textSecondary, marginTop: 10 }]}>Сообщите дополнительную информацию или дополнительный номер для связи:</Text>
            <TextInput
              style={[styles.input, { backgroundColor: isDark ? '#1c1f2a' : '#f8f9ff', borderColor: colors.border, color: colors.text }]}
              value={comment} onChangeText={setComment} placeholder="необязательно" placeholderTextColor={colors.textMuted}
            />

            {/* Итог */}
            <View style={[styles.summaryBox, { backgroundColor: isDark ? '#1c1f2a' : '#f8f9ff', borderColor: colors.border }]}>
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryText, { color: colors.textSecondary }]}>Ключи ({quantity} шт. × {unitPrice} ₽):</Text>
                <Text style={[styles.summaryText, { color: colors.text, fontWeight: '600' }]}>{baseSum} ₽</Text>
              </View>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <View style={styles.summaryRow}>
                <Text style={[styles.totalLabel, { color: colors.text }]}>Итого:</Text>
                <Text style={[styles.totalValue, { color: colors.primaryContainer }]}>{baseSum} ₽</Text>
              </View>
              <Text style={[styles.feeNote, { color: colors.textMuted }]}>Возможна комиссия банка при оплате.</Text>
            </View>
            </>) : null}
          </ScrollView>

          {/* Нижние кнопки: Отменить + Оплатить */}
          <View style={[styles.footer, { borderTopColor: colors.border, paddingBottom: botPad }]}>
            <TouchableOpacity style={[styles.cancelBtn, { borderColor: colors.border }]} onPress={onClose} activeOpacity={0.8} disabled={submitting}>
              <Text style={[styles.cancelBtnText, { color: colors.textSecondary }]}>Отменить</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.submitBtn, { backgroundColor: colors.primaryContainer }, (submitting || noEntrance) && { opacity: 0.6 }]} onPress={handlePayment} disabled={submitting || noEntrance} activeOpacity={0.85}>
              {submitting ? <ActivityIndicator color="#fff" /> : (
                <>
                  <Ionicons name="card" size={18} color="#fff" style={{ marginRight: 8 }} />
                  <Text style={styles.submitBtnText}>Оплатить {baseSum} ₽</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  headerTitleWrap: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  iconWrap: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 17, fontWeight: '700' },
  subtitle: { fontSize: 12, marginTop: 1 },
  closeBtn: { padding: 6 },
  body: { flex: 1, paddingHorizontal: 16, paddingTop: 14 },
  installBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 10, borderRadius: 10, borderWidth: 1, marginBottom: 12 },
  installBannerText: { fontSize: 12.5, fontWeight: '700', textAlign: 'center' },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 8 },
  cardsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  qtyCard: { width: '31.5%', paddingVertical: 14, borderRadius: 12, borderWidth: 1, alignItems: 'center' },
  qtyCardNum: { fontSize: 15, fontWeight: '700' },
  qtyCardSum: { fontSize: 14, fontWeight: '700', marginTop: 4 },
  input: { height: 48, borderRadius: 12, borderWidth: 1, paddingHorizontal: 16, fontSize: 15 },
  readonlyField: { minHeight: 48, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center' },
  readonlyText: { fontSize: 15, flex: 1 },
  summaryBox: { padding: 14, borderRadius: 12, borderWidth: 1, marginTop: 16 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 3 },
  summaryText: { fontSize: 13 },
  divider: { height: 1, marginVertical: 6 },
  totalLabel: { fontSize: 15, fontWeight: '700' },
  totalValue: { fontSize: 18, fontWeight: '700' },
  feeNote: { fontSize: 11, marginTop: 8, lineHeight: 15 },
  officeCard: { alignItems: 'center', padding: 20, borderRadius: 14, borderWidth: 1, gap: 8 },
  officeTitle: { fontSize: 16, fontWeight: '700', textAlign: 'center', marginTop: 4 },
  officeText: { fontSize: 13, lineHeight: 19, textAlign: 'center' },
  officeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12, marginTop: 6 },
  officeBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  footer: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1 },
  cancelBtn: { flex: 1, height: 50, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  cancelBtnText: { fontSize: 15, fontWeight: '700' },
  submitBtn: { flex: 2, height: 50, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  submitBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
