// mobile/src/components/HandsetOrderModal.tsx
// Модальное окно заказа и установки трубки домофона «Домофондар»
// Реализует выбор «Установка / Замена», выбор привязанной трубки ТКП и оплату ЮKassa

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
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { useAppTheme } from '@/theme';
import { apiClient } from '@/api/client';

interface HandsetOrderModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  user: any;
  account: any;
  defaultAddress?: string;
}

export const HandsetOrderModal: React.FC<HandsetOrderModalProps> = ({
  visible,
  onClose,
  onSuccess,
  user,
  account,
  defaultAddress = '',
}) => {
  const { colors, isDark } = useAppTheme();

  const [address, setAddress] = useState(defaultAddress);
  const [phone, setPhone] = useState(user?.phone || '');
  const [comment, setComment] = useState('');

  const [handsets, setHandsets] = useState<any[]>([]);
  const [selectedHandsetId, setSelectedHandsetId] = useState<string | null>(null);
  const [services, setServices] = useState<any[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [zoomImage, setZoomImage] = useState<string | null>(null);

  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible) {
      setAddress(defaultAddress || account?.address || '');
      setPhone(user?.phone || '');
      loadCatalog();
    }
  }, [visible, defaultAddress, account, user]);

  const loadCatalog = async () => {
    setLoadingCatalog(true);
    try {
      console.log('[Заказ трубки] Загрузка совместимых моделей оборудования...');
      const res = await apiClient.get('/api/catalog/products', {
        params: { account_number: account?.account_number },
      });
      if (res.data) {
        const hList = res.data.handsets || [];
        setHandsets(hList);
        if (hList.length > 0) {
          setSelectedHandsetId(hList[0].id);
        }
        const sList = res.data.services || [];
        setServices(sList);
        if (sList.length > 0) setSelectedServiceId(sList[0].id);
      }
    } catch (err) {
      console.warn('[Заказ трубки] Ошибка загрузки каталога:', err);
    } finally {
      setLoadingCatalog(false);
    }
  };

  // Эффективная цена с учётом акции (promo_price), как на сайте
  const effectivePrice = (p: any) => {
    const base = Number(p?.price || 0);
    const promo = p?.promo_price != null ? Number(p.promo_price) : null;
    return promo != null && promo > 0 && promo < base ? promo : base;
  };

  // Услуга — реальная позиция из каталога подъезда (никакого хардкода)
  const activeService = services.find((s) => s.id === selectedServiceId) || services[0] || null;
  const installServiceCost = activeService ? effectivePrice(activeService) : 0;
  const serviceTitle = activeService?.name || '';

  // Выбранная модель трубки
  const selectedHandset = handsets.find((h) => h.id === selectedHandsetId) || handsets[0];
  const handsetPrice = selectedHandset ? effectivePrice(selectedHandset) : 0;

  // Базовая сумма (без комиссии — её показываем абоненту). Комиссия 5% добавляется
  // ТОЛЬКО при создании платежа ЮKassa, как на сайте (amount = база + 5%).
  const baseAmount = handsetPrice + installServiceCost;
  const feeAmount = Math.round(baseAmount * 0.05 * 100) / 100;
  const totalAmount = Math.round((baseAmount + feeAmount) * 100) / 100;

  // Оформление заказа и переход к оплате через ЮKassa
  const handlePayment = async () => {
    if (!address.trim()) {
      Alert.alert('Внимание', 'Пожалуйста, укажите точный адрес для установки');
      return;
    }
    if (!phone.trim()) {
      Alert.alert('Внимание', 'Укажите контактный номер телефона');
      return;
    }

    setSubmitting(true);
    try {
      console.log(`[Заказ трубки] Оформление: ${selectedHandset?.name || 'Трубка'} (${serviceTitle}) на ${totalAmount} ₽...`);

      const messageText = `Заказ трубки домофона:\n• Модель: ${selectedHandset?.name || 'Аудиотрубка'}\n• Тип услуги: ${serviceTitle}\n• Адрес: ${address.trim()}\n• Телефон: ${phone.trim()}${comment.trim() ? `\n• Примечание: ${comment.trim()}` : ''}`;

      const itemsToInsert = [
        {
          product_id: selectedHandset?.id || null,
          name: selectedHandset?.name || 'Аудиотрубка домофона',
          quantity: 1,
          price: handsetPrice,
        },
        {
          product_id: activeService?.id || null,
          name: serviceTitle,
          quantity: 1,
          price: installServiceCost,
        },
      ];

      const orderPayload = {
        name: user?.full_name || 'Абонент',
        phone: phone.trim(),
        address: address.trim(),
        message: messageText,
        amount: baseAmount,
        user_id: user?.id,
        is_mobile: true,
        source: 'mobile_app',
        items: itemsToInsert,
      };

      const paymentBody = {
        amount: totalAmount,
        credit_amount: baseAmount,
        fee_amount: feeAmount,
        description: `Заказ трубки домофона${serviceTitle ? ` (${serviceTitle})` : ''}, ${address.trim()}`.slice(0, 128),
        account_number: account?.account_number || undefined,
        is_order: true,
        order_data: orderPayload,
        return_url: 'https://домофондар.рф/cabinet?check_payment=1&is_order=1',
      };

      const res = await apiClient.post('/api/payments/yookassa/create', paymentBody);
      const confirmUrl = res.data?.confirmation_url || res.data?.payment?.confirmation?.confirmation_url;

      if (confirmUrl) {
        console.log('[Заказ трубки] Открытие шлюза ЮKassa:', confirmUrl);
        onClose();
        await WebBrowser.openBrowserAsync(confirmUrl);
        onSuccess();
      } else {
        throw new Error('Не получена ссылка подтверждения от платёжного шлюза');
      }
    } catch (err: any) {
      console.error('[Заказ трубки] Ошибка оформления:', err);
      const errMsg = err.response?.data?.error || err.message || 'Не удалось сформировать платёж';
      Alert.alert('Ошибка оплаты', errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
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
                <Ionicons name="call-outline" size={20} color={colors.primaryContainer} />
              </View>
              <View>
                <Text style={[styles.title, { color: colors.text }]}>Заказ аудиотрубки</Text>
                <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                  Оборудование и выезд мастера на монтаж
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {/* Тип работ — реальные услуги из каталога подъезда (без выдуманных цен) */}
            <Text style={[styles.label, { color: colors.textSecondary }]}>Тип работ:</Text>
            {services.length === 0 ? (
              <Text style={[styles.handsetDesc, { color: colors.textMuted }]}>
                Для вашего подъезда услугу монтажа подберёт диспетчер после оформления заявки.
              </Text>
            ) : (
              <View style={{ gap: 8 }}>
                {services.map((s) => {
                  const sel = activeService?.id === s.id;
                  const price = effectivePrice(s);
                  return (
                    <TouchableOpacity
                      key={s.id}
                      onPress={() => setSelectedServiceId(s.id)}
                      activeOpacity={0.8}
                      style={[
                        styles.serviceCard,
                        {
                          backgroundColor: sel ? (isDark ? '#262a35' : '#e0f2fe') : (isDark ? '#1c1f2a' : '#f8f9ff'),
                          borderColor: sel ? colors.primaryContainer : colors.border,
                        },
                      ]}
                    >
                      <Ionicons name={sel ? 'radio-button-on' : 'radio-button-off'} size={20} color={sel ? colors.primaryContainer : colors.textMuted} style={{ marginTop: 1 }} />
                      <Text style={[styles.serviceName, { color: colors.text }]}>{s.name}</Text>
                      <Text style={[styles.servicePrice, { color: colors.primaryContainer }]}>{price} ₽</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* Выбор совместимой модели трубки */}
            <Text style={[styles.label, { color: colors.textSecondary, marginTop: 14 }]}>
              Выберите модель трубки:
            </Text>

            {loadingCatalog ? (
              <View style={styles.catalogLoading}>
                <ActivityIndicator color={colors.primaryContainer} />
                <Text style={[styles.catalogLoadingText, { color: colors.textSecondary }]}>
                  Подбор оборудования для вашего подъезда...
                </Text>
              </View>
            ) : handsets.length === 0 ? (
              <View
                style={[
                  styles.handsetCard,
                  { backgroundColor: isDark ? '#1c1f2a' : '#f8f9ff', borderColor: colors.primaryContainer },
                ]}
              >
                <View style={styles.handsetRow}>
                  <Ionicons name="call" size={24} color={colors.primaryContainer} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.handsetName, { color: colors.text }]}>
                      Универсальная координатная трубка ТКП
                    </Text>
                    <Text style={[styles.handsetDesc, { color: colors.textSecondary }]}>
                      Совместима со всеми вызывными панелями Домофондар
                    </Text>
                  </View>
                  <Text style={[styles.handsetPrice, { color: colors.primaryContainer }]}>1 200 ₽</Text>
                </View>
              </View>
            ) : (
              <View style={{ gap: 8 }}>
                {handsets.map((item) => {
                  const isSelected = selectedHandsetId === item.id;
                  return (
                    <TouchableOpacity
                      key={item.id}
                      onPress={() => setSelectedHandsetId(item.id)}
                      style={[
                        styles.handsetCard,
                        {
                          backgroundColor: isSelected
                            ? (isDark ? '#262a35' : '#e0f2fe')
                            : (isDark ? '#1c1f2a' : '#f8f9ff'),
                          borderColor: isSelected ? colors.primaryContainer : colors.border,
                        },
                      ]}
                      activeOpacity={0.8}
                    >
                      <View style={styles.handsetRow}>
                        <TouchableOpacity
                          activeOpacity={item.image_url ? 0.7 : 1}
                          onPress={() => { if (item.image_url) setZoomImage(item.image_url); }}
                          style={[styles.handsetThumb, { backgroundColor: isDark ? '#0f131d' : '#eef4ff', borderColor: colors.border }]}
                        >
                          {item.image_url ? (
                            <>
                              <Image source={{ uri: item.image_url }} style={styles.handsetThumbImg} resizeMode="contain" />
                              <View style={styles.zoomBadge}>
                                <Ionicons name="expand" size={11} color="#ffffff" />
                              </View>
                            </>
                          ) : (
                            <Ionicons name="call" size={24} color={colors.primaryContainer} />
                          )}
                        </TouchableOpacity>
                        <View style={{ flex: 1, paddingHorizontal: 8 }}>
                          <Text style={[styles.handsetName, { color: colors.text }]} numberOfLines={2}>{item.name}</Text>
                          {item.description ? (
                            <Text style={[styles.handsetDesc, { color: colors.textSecondary }]} numberOfLines={1}>
                              {item.description}
                            </Text>
                          ) : null}
                          <View style={styles.handsetPriceRow}>
                            {effectivePrice(item) < Number(item.price || 0) ? (
                              <Text style={[styles.handsetOldPrice, { color: colors.textMuted }]}>{Number(item.price)} ₽</Text>
                            ) : null}
                            <Text style={[styles.handsetPrice, { color: colors.primaryContainer }]}>{effectivePrice(item)} ₽</Text>
                          </View>
                        </View>
                        <Ionicons
                          name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                          size={22}
                          color={isSelected ? colors.primaryContainer : colors.textMuted}
                        />
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* Адрес и контакты */}
            <Text style={[styles.label, { color: colors.textSecondary, marginTop: 14 }]}>Адрес установки:</Text>
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
              placeholder="Адрес (подъезд, этаж, квартира)"
              placeholderTextColor={colors.textMuted}
            />

            <Text style={[styles.label, { color: colors.textSecondary, marginTop: 10 }]}>Телефон для связи:</Text>
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

            <Text style={[styles.label, { color: colors.textSecondary, marginTop: 10 }]}>Комментарий мастеру:</Text>
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
              placeholder="Удобные дни и часы для монтажа"
              placeholderTextColor={colors.textMuted}
            />

            {/* Итоговый расчет (комиссия эквайринга 5% добавляется на стороне ЮKassa при оплате) */}
            <View style={[styles.summaryBox, { backgroundColor: isDark ? '#1c1f2a' : '#f8f9ff', borderColor: colors.border }]}>
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryText, { color: colors.textSecondary }]} numberOfLines={1}>Трубка:</Text>
                <Text style={[styles.summaryText, { color: colors.text, fontWeight: '600' }]}>{handsetPrice} ₽</Text>
              </View>
              {activeService ? (
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryText, { color: colors.textSecondary, flex: 1, marginRight: 10 }]} numberOfLines={2}>{serviceTitle}:</Text>
                  <Text style={[styles.summaryText, { color: colors.text, fontWeight: '600' }]}>{installServiceCost} ₽</Text>
                </View>
              ) : null}
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <View style={styles.summaryRow}>
                <Text style={[styles.totalLabel, { color: colors.text }]}>Итого:</Text>
                <Text style={[styles.totalValue, { color: colors.primaryContainer }]}>{baseAmount} ₽</Text>
              </View>
              <Text style={[styles.feeNote, { color: colors.textMuted }]}>
                При оплате картой ЮKassa добавит комиссию эквайринга 5%.
              </Text>
            </View>
          </ScrollView>

          {/* Кнопка оплаты — показываем базовую сумму, комиссия добавится на ЮKassa */}
          <View style={[styles.footer, { borderTopColor: colors.border }]}>
            <TouchableOpacity
              style={[styles.submitBtn, { backgroundColor: colors.primaryContainer }, (submitting || !selectedHandset) && { opacity: 0.6 }]}
              onPress={handlePayment}
              disabled={submitting || !selectedHandset}
              activeOpacity={0.85}
            >
              {submitting ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <>
                  <Ionicons name="card" size={18} color="#ffffff" style={{ marginRight: 8 }} />
                  <Text style={styles.submitBtnText}>Оплатить {baseAmount} ₽</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>

    {/* Полноэкранный просмотр фото трубки */}
    <Modal visible={!!zoomImage} transparent animationType="fade" onRequestClose={() => setZoomImage(null)}>
      <TouchableOpacity style={styles.zoomOverlay} activeOpacity={1} onPress={() => setZoomImage(null)}>
        {zoomImage ? <Image source={{ uri: zoomImage }} style={styles.zoomImage} resizeMode="contain" /> : null}
        <View style={styles.zoomClose}>
          <Ionicons name="close" size={26} color="#ffffff" />
        </View>
      </TouchableOpacity>
    </Modal>
    </>
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
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  switchContainer: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
  switchBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
  },
  switchBtnActive: {
    shadowColor: '#0ea5e9',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  switchBtnText: {
    fontSize: 12,
  },
  catalogLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
  },
  catalogLoadingText: {
    fontSize: 13,
  },
  handsetCard: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  handsetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  handsetName: {
    fontSize: 14,
    fontWeight: '700',
  },
  handsetDesc: {
    fontSize: 11,
    marginTop: 2,
  },
  handsetPrice: {
    fontSize: 15,
    fontWeight: '700',
  },
  handsetThumb: {
    width: 48,
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  handsetThumbImg: {
    width: '100%',
    height: '100%',
  },
  handsetPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 3,
  },
  handsetOldPrice: {
    fontSize: 12,
    textDecorationLine: 'line-through',
  },
  serviceCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  serviceName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  servicePrice: {
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 6,
  },
  feeNote: {
    fontSize: 11,
    marginTop: 8,
    lineHeight: 15,
  },
  zoomBadge: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 6,
    paddingHorizontal: 3,
    paddingVertical: 2,
  },
  zoomOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomImage: {
    width: '92%',
    height: '80%',
  },
  zoomClose: {
    position: 'absolute',
    top: 48,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
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
