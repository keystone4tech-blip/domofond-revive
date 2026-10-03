// mobile/app/(tabs)/requests/create.tsx — Экран создания новой заявки абонента «Домофондар»
// Отправляет реальную заявку с обязательной маркировкой мобильного приложения: 📱 [Мобильное приложение Домофондар]

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@/store/auth.store';
import { useAppTheme } from '@/theme';
import { apiClient } from '@/api/client';

const REQUEST_TYPES = [
  'Ремонт домофона / не открывает дверь',
  'Не работает аудиотрубка в квартире',
  'Заказ дополнительных ключей (чипов)',
  'Заказ и замена трубки домофона',
  'Регулировка доводчика двери подъезда',
  'Другой вопрос по домофонии',
];

export default function CreateRequestScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const { colors, isDark } = useAppTheme();

  const [selectedType, setSelectedType] = useState(REQUEST_TYPES[0]);
  const [address, setAddress] = useState((user as any)?.address || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!address.trim()) {
      Alert.alert('Внимание', 'Пожалуйста, укажите адрес (улицу, дом, подъезд, квартиру)');
      return;
    }
    if (!phone.trim()) {
      Alert.alert('Внимание', 'Укажите контактный номер телефона для мастера');
      return;
    }
    if (!description.trim()) {
      Alert.alert('Внимание', 'Опишите суть неисправности');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        name: user?.full_name || 'Абонент',
        phone: phone.trim(),
        address: address.trim(),
        message: `[${selectedType}]\n${description.trim()}`,
        priority: 'medium',
        status: 'new',
        is_mobile: true,
        source: 'mobile_app',
      };

      console.log('[CreateRequest CyberShield] Отправка заявки на сервер:', payload);
      await apiClient.post('/api/requests', payload);

      Alert.alert(
        'Заявка принята!',
        'Ваша заявка успешно зарегистрирована в системе. Диспетчерская служба и мастер уведомлены.',
        [{ text: 'Отлично', onPress: () => router.back() }]
      );
    } catch (err: any) {
      console.error('[CreateRequest] Ошибка отправки заявки:', err);
      const msg = err.response?.data?.error || 'Не удалось отправить заявку. Проверьте интернет-соединение.';
      Alert.alert('Ошибка', msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const safeTop = Math.max(insets.top, 16) + 8;
  const safeBottom = Math.max(insets.bottom, 16) + 20;

  return (
    <View style={[styles.safeArea, { backgroundColor: colors.background, paddingTop: safeTop }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        {/* Шапка */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>Новая заявка</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView
          contentContainerStyle={[styles.container, { paddingBottom: safeBottom }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Тип заявки */}
          <Text style={[styles.label, { color: colors.textSecondary }]}>Тип обращения / неисправности</Text>
          <View style={styles.typesContainer}>
            {REQUEST_TYPES.map((t) => {
              const isSelected = selectedType === t;
              return (
                <TouchableOpacity
                  key={t}
                  style={[
                    styles.typeChip,
                    {
                      backgroundColor: isSelected
                        ? (isDark ? '#262a35' : '#e0f2fe')
                        : (isDark ? '#1c1f2a' : '#f8f9ff'),
                      borderColor: isSelected ? colors.primaryContainer : colors.border,
                    },
                  ]}
                  onPress={() => setSelectedType(t)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.typeChipText,
                      {
                        color: isSelected ? colors.primaryContainer : colors.text,
                        fontWeight: isSelected ? '700' : '500',
                      },
                    ]}
                  >
                    {t}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Адрес */}
          <Text style={[styles.label, { color: colors.textSecondary }]}>Адрес (улица, дом, подъезд, квартира)</Text>
          <TextInput
            style={[
              styles.input,
              { backgroundColor: isDark ? '#1c1f2a' : '#f8f9ff', borderColor: colors.border, color: colors.text },
            ]}
            value={address}
            onChangeText={setAddress}
            placeholder="г. Нальчик, ул. Ленина, д. 10, кв. 42"
            placeholderTextColor={colors.textMuted}
          />

          {/* Телефон */}
          <Text style={[styles.label, { color: colors.textSecondary }]}>Контактный телефон</Text>
          <TextInput
            style={[
              styles.input,
              { backgroundColor: isDark ? '#1c1f2a' : '#f8f9ff', borderColor: colors.border, color: colors.text },
            ]}
            value={phone}
            onChangeText={setPhone}
            placeholder="+7 (___) ___-__-__"
            placeholderTextColor={colors.textMuted}
            keyboardType="phone-pad"
          />

          {/* Описание проблемы */}
          <Text style={[styles.label, { color: colors.textSecondary }]}>Суть проблемы / описание</Text>
          <TextInput
            style={[
              styles.input,
              styles.textArea,
              { backgroundColor: isDark ? '#1c1f2a' : '#f8f9ff', borderColor: colors.border, color: colors.text },
            ]}
            value={description}
            onChangeText={setDescription}
            placeholder="Опишите, что происходит с домофоном, укажите код или удобное время"
            placeholderTextColor={colors.textMuted}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />

          {/* Кнопка отправки */}
          <TouchableOpacity
            style={[styles.submitButton, { backgroundColor: colors.primaryContainer }]}
            onPress={handleSubmit}
            disabled={isSubmitting}
            activeOpacity={0.8}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <>
                <Ionicons name="send-outline" size={20} color="#ffffff" style={{ marginRight: 8 }} />
                <Text style={styles.submitButtonText}>Отправить заявку мастеру</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  backButton: { padding: 4 },
  title: { fontSize: 20, fontWeight: '700' },
  container: { paddingHorizontal: 16 },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 14,
  },
  typesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 6,
  },
  typeChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  typeChipText: { fontSize: 13 },
  input: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontSize: 14,
  },
  textArea: {
    height: 100,
    paddingTop: 12,
    paddingBottom: 12,
  },
  submitButton: {
    height: 52,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    elevation: 3,
    shadowColor: '#0ea5e9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  submitButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
});
