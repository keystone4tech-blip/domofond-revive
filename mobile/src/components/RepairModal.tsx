// mobile/src/components/RepairModal.tsx
// Модальное окно бесплатного вызова мастера по ТО «Домофондар»
// Создает наряд в CRM с обязательной меткой: 📱 [Мобильное приложение Домофондар]

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
import { useAppTheme } from '@/theme';
import { apiClient } from '@/api/client';

interface RepairModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  user: any;
  defaultAddress?: string;
}

// Перечень типовых обращений по техническому обслуживанию домофона
const REPAIR_TYPES = [
  { id: 'handset_silent', title: 'Не работает трубка', desc: 'Нет сигнала вызова, молчит динамик' },
  { id: 'door_not_open', title: 'Не открывает дверь', desc: 'Кнопка на трубке не отпирает замок' },
  { id: 'noise_in_line', title: 'Помехи / плохая слышимость', desc: 'Шум, треск или тихий звук в трубке' },
  { id: 'panel_broken', title: 'Неисправна вызывная панель', desc: 'Сломана кнопка на подъезде, нет индикации' },
  { id: 'closer_door', title: 'Проблема с доводчиком', desc: 'Дверь хлопает или не закрывается до конца' },
  { id: 'other', title: 'Другая неисправность', desc: 'Опишите проблему своими словами' },
];

export const RepairModal: React.FC<RepairModalProps> = ({
  visible,
  onClose,
  onSuccess,
  user,
  defaultAddress = '',
}) => {
  const { colors, isDark } = useAppTheme();

  const [selectedType, setSelectedType] = useState(REPAIR_TYPES[0].id);
  const [address, setAddress] = useState(defaultAddress);
  const [phone, setPhone] = useState(user?.phone || '');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (defaultAddress && !address) {
      setAddress(defaultAddress);
    }
    if (user?.phone && !phone) {
      setPhone(user.phone);
    }
  }, [defaultAddress, user]);

  const handleSubmit = async () => {
    if (!address.trim()) {
      Alert.alert('Внимание', 'Пожалуйста, укажите адрес (улицу, дом, подъезд и квартиру)');
      return;
    }
    if (!phone.trim()) {
      Alert.alert('Внимание', 'Укажите контактный номер телефона для мастера');
      return;
    }

    const typeObj = REPAIR_TYPES.find((t) => t.id === selectedType);
    const problemTitle = typeObj ? typeObj.title : 'Неисправность домофона';
    const fullMessage = comment.trim()
      ? `Неисправность: ${problemTitle}\nДетали: ${comment.trim()}`
      : `Неисправность: ${problemTitle}`;

    setSubmitting(true);
    try {
      console.log('[Ремонт ТО] Отправка бесплатной заявки мастера из мобильного приложения...');
      
      const payload = {
        name: user?.full_name || 'Абонент',
        phone: phone.trim(),
        address: address.trim(),
        message: fullMessage,
        priority: 'medium',
        status: 'new',
        is_mobile: true,
        source: 'mobile_app',
      };

      const res = await apiClient.post('/api/requests', payload);
      console.log('[Ремонт ТО] Заявка успешно зарегистрирована:', res.data?.id);

      Alert.alert(
        'Заявка принята!',
        `Мастер дежурной службы «Домофондар» уведомлен. Мы свяжемся с вами по телефону ${phone.trim()} для согласования времени визита.`,
        [
          {
            text: 'Понятно',
            onPress: () => {
              setComment('');
              onSuccess();
              onClose();
            },
          },
        ]
      );
    } catch (err: any) {
      console.error('[Ремонт ТО] Ошибка при отправке заявки:', err);
      const errMsg = err.response?.data?.error || 'Не удалось отправить заявку. Проверьте интернет-соединение.';
      Alert.alert('Ошибка', errMsg);
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
          {/* Шапка модального окна */}
          <View style={styles.header}>
            <View style={styles.headerTitleWrap}>
              <View style={[styles.iconWrap, { backgroundColor: isDark ? '#262a35' : '#e5eeff' }]}>
                <Ionicons name="construct-outline" size={20} color={colors.primaryContainer} />
              </View>
              <View>
                <Text style={[styles.title, { color: colors.text }]}>Вызов мастера по ТО</Text>
                <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                  Бесплатный ремонт в рамках обслуживания
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {/* Выбор характера неисправности */}
            <Text style={[styles.label, { color: colors.textSecondary }]}>Что именно не работает?</Text>
            <View style={styles.typesGrid}>
              {REPAIR_TYPES.map((t) => {
                const isSelected = selectedType === t.id;
                return (
                  <TouchableOpacity
                    key={t.id}
                    onPress={() => setSelectedType(t.id)}
                    style={[
                      styles.typeCard,
                      {
                        backgroundColor: isSelected
                          ? (isDark ? '#262a35' : '#e0f2fe')
                          : (isDark ? '#1c1f2a' : '#f8f9ff'),
                        borderColor: isSelected ? colors.primaryContainer : colors.border,
                      },
                    ]}
                    activeOpacity={0.8}
                  >
                    <View style={styles.typeRow}>
                      <Ionicons
                        name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                        size={18}
                        color={isSelected ? colors.primaryContainer : colors.textMuted}
                      />
                      <Text
                        style={[
                          styles.typeTitle,
                          { color: isSelected ? colors.primaryContainer : colors.text, fontWeight: isSelected ? '700' : '500' },
                        ]}
                      >
                        {t.title}
                      </Text>
                    </View>
                    <Text style={[styles.typeDesc, { color: colors.textSecondary }]}>{t.desc}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Контактные данные */}
            <Text style={[styles.label, { color: colors.textSecondary, marginTop: 14 }]}>Адрес ремонта:</Text>
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
              placeholder="г. Нальчик, ул. Ленина, д. 10, под. 2, кв. 45"
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

            <Text style={[styles.label, { color: colors.textSecondary, marginTop: 10 }]}>
              Дополнительный комментарий (необязательно):
            </Text>
            <TextInput
              style={[
                styles.input,
                styles.textArea,
                {
                  backgroundColor: isDark ? '#1c1f2a' : '#f8f9ff',
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
              value={comment}
              onChangeText={setComment}
              multiline
              numberOfLines={3}
              placeholder="Укажите код домофона, этаж или удобное время для визита мастера"
              placeholderTextColor={colors.textMuted}
            />

            {/* Информационный бейдж гарантии ТО */}
            <View
              style={[
                styles.infoBadge,
                { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.1)' : '#ecfdf5', borderColor: 'rgba(16, 185, 129, 0.25)' },
              ]}
            >
              <Ionicons name="shield-checkmark" size={18} color="#10b981" />
              <Text style={styles.infoBadgeText}>
                Выезд мастера и устранение неполадок включены в договор абонентского обслуживания (0 ₽).
              </Text>
            </View>
          </ScrollView>

          {/* Нижняя кнопка отправки */}
          <View style={[styles.footer, { borderTopColor: colors.border }]}>
            <TouchableOpacity
              style={[styles.submitBtn, { backgroundColor: colors.primaryContainer }]}
              onPress={handleSubmit}
              disabled={submitting}
              activeOpacity={0.85}
            >
              {submitting ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <>
                  <Ionicons name="send" size={18} color="#ffffff" style={{ marginRight: 8 }} />
                  <Text style={styles.submitBtnText}>Отправить заявку мастеру</Text>
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
  typesGrid: {
    gap: 8,
  },
  typeCard: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  typeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  typeTitle: {
    fontSize: 14,
  },
  typeDesc: {
    fontSize: 12,
    paddingLeft: 26,
  },
  input: {
    height: 46,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  textArea: {
    height: 76,
    paddingTop: 10,
    textAlignVertical: 'top',
  },
  infoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 14,
    marginBottom: 10,
  },
  infoBadgeText: {
    flex: 1,
    fontSize: 12,
    color: '#10b981',
    lineHeight: 16,
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
