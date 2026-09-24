// mobile/app/(tabs)/requests/create.tsx — Экран создания новой заявки абонента «Домофондар»
// Отправляет реальную заявку в базу данных PostgreSQL через эндпоинт POST /api/requests

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/auth.store';
import { apiClient } from '@/api/client';

const REQUEST_TYPES = [
  'Ремонт домофона / не открывает',
  'Не работает аудиотрубка в квартире',
  'Заказ электронных ключей (чипов)',
  'Заказ и установка новой трубки',
  'Техническое обслуживание',
  'Другой вопрос',
];

export default function CreateRequestScreen() {
  const router = useRouter();
  const { user } = useAuthStore();

  const [selectedType, setSelectedType] = useState(REQUEST_TYPES[0]);
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState(user?.phone || '');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!address.trim()) {
      Alert.alert('Внимание', 'Пожалуйста, укажите адрес (улицу, дом, квартиру)');
      return;
    }
    if (!phone.trim()) {
      Alert.alert('Внимание', 'Укажите контактный номер телефона для мастера');
      return;
    }
    if (!description.trim()) {
      Alert.alert('Внимание', 'Опишите суть проблемы или количество ключей');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        name: user?.full_name || 'Абонент',
        phone: phone.trim(),
        address: address.trim(),
        message: `[${selectedType}] ${description.trim()}`,
        priority: 'medium',
        status: 'new',
      };

      console.log('[CreateRequest] Отправка заявки на сервер:', payload);
      await apiClient.post('/api/requests', payload);

      Alert.alert('Заявка принята!', 'Ваша заявка успешно зарегистрирована в системе. Диспетчер свяжется с вами.', [
        { text: 'Отлично', onPress: () => router.back() },
      ]);
    } catch (err: any) {
      console.error('[CreateRequest] Ошибка отправки заявки:', err);
      const msg = err.response?.data?.error || 'Не удалось отправить заявку. Проверьте интернет-соединение.';
      Alert.alert('Ошибка', msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        {/* Шапка */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#F8FAFC" />
          </TouchableOpacity>
          <Text style={styles.title}>Новая заявка</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          {/* Тип заявки */}
          <Text style={styles.label}>Тип обращения / заказа</Text>
          <View style={styles.typesContainer}>
            {REQUEST_TYPES.map((t) => {
              const isSelected = selectedType === t;
              return (
                <TouchableOpacity
                  key={t}
                  style={[styles.typeChip, isSelected && styles.typeChipSelected]}
                  onPress={() => setSelectedType(t)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.typeChipText, isSelected && styles.typeChipTextSelected]}>
                    {t}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Адрес */}
          <Text style={styles.label}>Адрес (улица, дом, подъезд, квартира)</Text>
          <TextInput
            style={styles.input}
            value={address}
            onChangeText={setAddress}
            placeholder="например: ул. Красная, д. 10, кв. 25"
            placeholderTextColor="#64748B"
          />

          {/* Телефон */}
          <Text style={styles.label}>Контактный телефон</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            placeholder="+7 (___) ___-__-__"
            placeholderTextColor="#64748B"
            keyboardType="phone-pad"
          />

          {/* Описание проблемы / заказ */}
          <Text style={styles.label}>Подробное описание</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            value={description}
            onChangeText={setDescription}
            placeholder="Опишите неисправность или укажите количество ключей для заказа..."
            placeholderTextColor="#64748B"
            multiline
            numberOfLines={4}
          />

          {/* Кнопка отправки */}
          <TouchableOpacity
            style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={isSubmitting}
            activeOpacity={0.85}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <View style={styles.buttonInner}>
                <Ionicons name="send" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={styles.submitButtonText}>Отправить диспетчеру</Text>
              </View>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0F172A' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148, 163, 184, 0.1)',
  },
  backButton: { padding: 4 },
  title: { fontSize: 20, fontWeight: 'bold', color: '#F8FAFC' },
  container: { padding: 20 },
  label: { color: '#E2E8F0', fontSize: 14, fontWeight: '600', marginBottom: 8, marginTop: 12 },
  typesContainer: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 },
  typeChip: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    marginRight: 8,
    marginBottom: 8,
  },
  typeChipSelected: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: '#10B981',
  },
  typeChipText: { color: '#94A3B8', fontSize: 13 },
  typeChipTextSelected: { color: '#10B981', fontWeight: 'bold' },
  input: {
    backgroundColor: '#1E293B',
    color: '#F8FAFC',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#334155',
  },
  multiline: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  submitButton: {
    backgroundColor: '#10B981',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 28,
  },
  submitButtonDisabled: { opacity: 0.6 },
  buttonInner: { flexDirection: 'row', alignItems: 'center' },
  submitButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
});
