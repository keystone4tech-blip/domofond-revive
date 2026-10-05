// mobile/src/components/RepairModal.tsx
// Полноэкранное окно бесплатного вызова мастера по ТО «Домофондар».
// Адрес, получатель и телефон берутся ИЗ ПРОФИЛЯ без возможности редактирования.
// Если телефона в профиле нет — обязательное поле контактного номера.

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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '@/theme';
import { apiClient } from '@/api/client';

interface RepairModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  user: any;
  account?: any;
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
  account,
  defaultAddress = '',
}) => {
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();

  const [selectedType, setSelectedType] = useState(REPAIR_TYPES[0].id);
  const [contactPhone, setContactPhone] = useState('');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Данные — строго из профиля зарегистрированного пользователя (без редактирования).
  // Телефон НЕ берём из чужого лицевого счёта — только собственный номер профиля.
  const recipientName = (user?.full_name || '').trim() || 'Получатель не указан';
  const profileAddress = (user?.address || account?.address || defaultAddress || '').trim();
  const profilePhone = (user?.phone || '').trim();
  const needContactPhone = !profilePhone;
  const effectivePhone = profilePhone || contactPhone.trim();

  useEffect(() => {
    if (visible) {
      setSelectedType(REPAIR_TYPES[0].id);
      setContactPhone('');
      setComment('');
    }
  }, [visible]);

  const handleSubmit = async () => {
    if (!profileAddress) {
      Alert.alert('Внимание', 'В вашем профиле не указан адрес. Привяжите адрес на главном экране.');
      return;
    }
    if (!effectivePhone) {
      Alert.alert('Укажите телефон', 'В профиле нет номера телефона. Введите контактный номер для связи.');
      return;
    }

    const typeObj = REPAIR_TYPES.find((t) => t.id === selectedType);
    const problemTitle = typeObj ? typeObj.title : 'Неисправность домофона';
    const fullMessage = comment.trim()
      ? `Неисправность: ${problemTitle}\nДетали: ${comment.trim()}`
      : `Неисправность: ${problemTitle}`;

    setSubmitting(true);
    try {
      const payload = {
        name: recipientName,
        phone: effectivePhone,
        address: profileAddress,
        message: fullMessage,
        priority: 'medium',
        status: 'pending',
        is_mobile: true,
        source: 'mobile_app',
      };

      const res = await apiClient.post('/api/requests', payload);
      console.log('[Ремонт ТО] Заявка успешно зарегистрирована:', res.data?.id);

      Alert.alert(
        'Заявка принята!',
        `Мастер дежурной службы «Домофондар» уведомлён. Мы свяжемся с вами по телефону ${effectivePhone} для согласования времени визита.`,
        [{ text: 'Понятно', onPress: () => { onSuccess(); onClose(); } }]
      );
    } catch (err: any) {
      console.error('[Ремонт ТО] Ошибка при отправке заявки:', err);
      const errMsg = err.response?.data?.error || 'Не удалось отправить заявку. Проверьте интернет-соединение.';
      Alert.alert('Ошибка', errMsg);
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
              <Ionicons name="construct-outline" size={20} color={colors.primaryContainer} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: colors.text }]}>Вызов мастера по ТО</Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]} numberOfLines={1}>
                Бесплатный ремонт в рамках обслуживания
              </Text>
            </View>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={24} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: 16 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
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
                        backgroundColor: isSelected ? (isDark ? '#262a35' : '#e0f2fe') : (isDark ? '#1c1f2a' : '#f8f9ff'),
                        borderColor: isSelected ? colors.primaryContainer : colors.border,
                      },
                    ]}
                    activeOpacity={0.8}
                  >
                    <View style={styles.typeRow}>
                      <Ionicons name={isSelected ? 'radio-button-on' : 'radio-button-off'} size={18} color={isSelected ? colors.primaryContainer : colors.textMuted} />
                      <Text style={[styles.typeTitle, { color: isSelected ? colors.primaryContainer : colors.text, fontWeight: isSelected ? '700' : '500' }]}>{t.title}</Text>
                    </View>
                    <Text style={[styles.typeDesc, { color: colors.textSecondary }]}>{t.desc}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Получатель, адрес и телефон — из профиля, без редактирования */}
            <Text style={[styles.label, { color: colors.textSecondary, marginTop: 16 }]}>Заявитель:</Text>
            <View style={[styles.readonlyField, { backgroundColor: isDark ? '#15181f' : '#f1f4fb', borderColor: colors.border }]}>
              <Ionicons name="person-outline" size={16} color={colors.textMuted} style={{ marginRight: 8 }} />
              <Text style={[styles.readonlyText, { color: colors.text }]} numberOfLines={1}>{recipientName}</Text>
            </View>

            <Text style={[styles.label, { color: colors.textSecondary, marginTop: 10 }]}>Адрес ремонта (из профиля):</Text>
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
                <Text style={[styles.label, { color: colors.textSecondary, marginTop: 10 }]}>Телефон для связи (из профиля):</Text>
                <View style={[styles.readonlyField, { backgroundColor: isDark ? '#15181f' : '#f1f4fb', borderColor: colors.border }]}>
                  <Ionicons name="call-outline" size={16} color={colors.textMuted} style={{ marginRight: 8 }} />
                  <Text style={[styles.readonlyText, { color: colors.text }]}>{profilePhone}</Text>
                </View>
              </>
            )}

            <Text style={[styles.label, { color: colors.textSecondary, marginTop: 10 }]}>Сообщите дополнительную информацию или дополнительный номер для связи:</Text>
            <TextInput
              style={[styles.input, { backgroundColor: isDark ? '#1c1f2a' : '#f8f9ff', borderColor: colors.border, color: colors.text }]}
              value={comment} onChangeText={setComment}
              placeholder="необязательно"
              placeholderTextColor={colors.textMuted}
            />

            <Text style={[styles.freeNote, { color: '#10b981' }]}>
              Выезд мастера включён в абонентское обслуживание (0 ₽).
            </Text>
          </ScrollView>

          {/* Нижние кнопки: Отменить + Отправить */}
          <View style={[styles.footer, { borderTopColor: colors.border, paddingBottom: botPad }]}>
            <TouchableOpacity style={[styles.cancelBtn, { borderColor: colors.border }]} onPress={onClose} activeOpacity={0.8} disabled={submitting}>
              <Text style={[styles.cancelBtnText, { color: colors.textSecondary }]}>Отменить</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.submitBtn, { backgroundColor: colors.primaryContainer }, submitting && { opacity: 0.6 }]} onPress={handleSubmit} disabled={submitting} activeOpacity={0.85}>
              {submitting ? <ActivityIndicator color="#ffffff" /> : (
                <>
                  <Ionicons name="send" size={18} color="#ffffff" style={{ marginRight: 8 }} />
                  <Text style={styles.submitBtnText}>Отправить заявку</Text>
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
  label: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  typesGrid: { gap: 8 },
  typeCard: { padding: 12, borderRadius: 12, borderWidth: 1 },
  typeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  typeTitle: { fontSize: 14 },
  typeDesc: { fontSize: 12, paddingLeft: 26 },
  input: { minHeight: 48, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, fontSize: 15 },
  textArea: { height: 84, paddingTop: 12, textAlignVertical: 'top' },
  readonlyField: { minHeight: 48, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center' },
  readonlyText: { fontSize: 15, flex: 1 },
  freeNote: { fontSize: 12, marginTop: 12, lineHeight: 16 },
  infoBadge: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 10, borderWidth: 1, marginTop: 16, marginBottom: 10 },
  infoBadgeText: { flex: 1, fontSize: 12, color: '#10b981', lineHeight: 16 },
  footer: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1 },
  cancelBtn: { flex: 1, height: 50, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  cancelBtnText: { fontSize: 15, fontWeight: '700' },
  submitBtn: { flex: 2, height: 50, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  submitBtnText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
});
