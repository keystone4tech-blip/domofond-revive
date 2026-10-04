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

  const [serviceAction, setServiceAction] = useState<'install' | 'replace'>('replace');
  const [address, setAddress] = useState(defaultAddress);
  const [phone, setPhone] = useState(user?.phone || '');
  const [comment, setComment] = useState('');

  const [handsets, setHandsets] = useState<any[]>([]);
  const [selectedHandsetId, setSelectedHandsetId] = useState<string | null>(null);
  const [services, setServices] = useState<any[]>([]);

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
        setServices(res.data.services || []);
      }
    } catch (err) {
      console.warn('[Заказ трубки] Ошибка загрузки каталога:', err);
    } finally {
      setLoadingCatalog(false);
    }
  };

  // Стоимость услуги монтажа — из реального каталога подъезда (как на сайте), не хардкод
  const installService = services.find((s) => /установ|монтаж|проклад/i.test(s.name));
  const replaceService = services.find((s) => /замен/i.test(s.name));
  const activeService = serviceAction === 'install' ? installService : replaceService;
  const installServiceCost = activeService ? Number(activeService.price) : (serviceAction === 'install' ? 500 : 300);
  const serviceTitle = activeService?.name || (serviceAction === 'install' ? 'Установка трубки с прокладкой кабеля' : 'Замена существующей трубки');

  // Эффективная цена трубки с учётом акции (promo_price), как на сайте
  const effectivePrice = (p: any) => {
    const base = Number(p?.price || 0);
    const promo = p?.promo_price != null ? Number(p.promo_price) : null;
    return promo != null && promo > 0 && promo < base ? promo : base;
  };

  // Выбранная модель трубки
  const selectedHandset = handsets.find((h) => h.id === selectedHandsetId) || handsets[0];
  const handsetPrice = selectedHandset ? effectivePrice(selectedHandset) : 1200;

  // Расчет сумм с эквайрингом 5%
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
        description: `Заказ трубки домофона (${serviceAction === 'install' ? 'установка' : 'замена'}), ${address.trim()}`,
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
            {/* Переключатель: Установка / Замена */}
            <Text style={[styles.label, { color: colors.textSecondary }]}>Тип необходимых работ:</Text>
            <View style={[styles.switchContainer, { backgroundColor: isDark ? '#1c1f2a' : '#f1f5f9', borderColor: colors.border }]}>
              <TouchableOpacity
                style={[
                  styles.switchBtn,
                  serviceAction === 'replace' && [styles.switchBtnActive, { backgroundColor: colors.primaryContainer }],
                ]}
                onPress={() => setServiceAction('replace')}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="sync"
                  size={16}
                  color={serviceAction === 'replace' ? '#ffffff' : colors.textSecondary}
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={[
                    styles.switchBtnText,
                    { color: serviceAction === 'replace' ? '#ffffff' : colors.textSecondary, fontWeight: serviceAction === 'replace' ? '700' : '500' },
                  ]}
                >
                  Замена старой (300 ₽)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.switchBtn,
                  serviceAction === 'install' && [styles.switchBtnActive, { backgroundColor: colors.primaryContainer }],
                ]}
                onPress={() => setServiceAction('install')}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="hammer"
                  size={16}
                  color={serviceAction === 'install' ? '#ffffff' : colors.textSecondary}
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={[
                    styles.switchBtnText,
                    { color: serviceAction === 'install' ? '#ffffff' : colors.textSecondary, fontWeight: serviceAction === 'install' ? '700' : '500' },
                  ]}
                >
                  Монтаж с нуля (500 ₽)
                </Text>
              </TouchableOpacity>
            </View>

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
                        <View style={[styles.handsetThumb, { backgroundColor: isDark ? '#0f131d' : '#eef4ff', borderColor: colors.border }]}>
                          {item.image_url ? (
                            <Image source={{ uri: item.image_url }} style={styles.handsetThumbImg} resizeMode="contain" />
                          ) : (
                            <Ionicons name="call" size={24} color={colors.primaryContainer} />
                          )}
                        </View>
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

            {/* Итоговый расчет */}
            <View style={[styles.summaryBox, { backgroundColor: isDark ? '#1c1f2a' : '#f8f9ff', borderColor: colors.border }]}>
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryText, { color: colors.textSecondary }]}>Аудиотрубка:</Text>
                <Text style={[styles.summaryText, { color: colors.text, fontWeight: '600' }]}>{handsetPrice} ₽</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryText, { color: colors.textSecondary }]}>Работа мастера:</Text>
                <Text style={[styles.summaryText, { color: colors.text, fontWeight: '600' }]}>{installServiceCost} ₽</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryText, { color: colors.textSecondary }]}>Эквайринг ЮKassa (5%):</Text>
                <Text style={[styles.summaryText, { color: colors.textSecondary }]}>{feeAmount} ₽</Text>
              </View>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <View style={styles.summaryRow}>
                <Text style={[styles.totalLabel, { color: colors.text }]}>Итого к оплате:</Text>
                <Text style={[styles.totalValue, { color: colors.primaryContainer }]}>{totalAmount} ₽</Text>
              </View>
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
                  <Text style={styles.submitBtnText}>Оплатить {totalAmount} ₽ (ЮKassa)</Text>
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
