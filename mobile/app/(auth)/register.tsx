// mobile/app/(auth)/register.tsx — Экран регистрации абонента в мобильном приложении «Домофондар»
// Создает реального пользователя в базе данных PostgreSQL и сразу перенаправляет в личный кабинет

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store/auth.store';

export default function RegisterScreen() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const { register, isLoading } = useAuthStore();

  const handleRegister = async () => {
    if (!fullName.trim()) {
      Alert.alert('Внимание', 'Пожалуйста, укажите ваше ФИО');
      return;
    }
    if (!phone.trim()) {
      Alert.alert('Внимание', 'Пожалуйста, укажите номер телефона');
      return;
    }
    if (!password) {
      Alert.alert('Внимание', 'Введите пароль');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Внимание', 'Пароль должен содержать не менее 6 символов');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Внимание', 'Введённые пароли не совпадают');
      return;
    }

    try {
      console.log(`[UI Register] Регистрация жильца: ${fullName}, тел: ${phone}`);
      await register(phone.trim(), password, fullName.trim(), email.trim());
      console.log('[UI Register] Регистрация успешна! Переход в главное меню...');
      router.replace('/(tabs)/home');
    } catch (error: any) {
      console.error('[UI Register] Ошибка регистрации:', error);
      const serverMessage = error.response?.data?.error || error.message || 'Не удалось зарегистрироваться. Попробуйте снова.';
      Alert.alert('Ошибка регистрации', serverMessage);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: '#0F172A' }}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {/* Заголовок */}
        <View style={styles.header}>
          <Text style={styles.title}>Регистрация</Text>
          <Text style={styles.subtitle}>Создание личного кабинета жильца</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>ФИО</Text>
          <TextInput
            style={styles.input}
            placeholder="Иванов Иван Иванович"
            placeholderTextColor="#64748B"
            value={fullName}
            onChangeText={setFullName}
          />

          <Text style={styles.label}>Номер телефона</Text>
          <TextInput
            style={styles.input}
            placeholder="+7 (___) ___-__-__"
            placeholderTextColor="#64748B"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />

          <Text style={styles.label}>Электронная почта (необязательно)</Text>
          <TextInput
            style={styles.input}
            placeholder="example@mail.ru"
            placeholderTextColor="#64748B"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Text style={styles.label}>Пароль</Text>
          <TextInput
            style={styles.input}
            placeholder="Не менее 6 символов"
            placeholderTextColor="#64748B"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          <Text style={styles.label}>Повторите пароль</Text>
          <TextInput
            style={styles.input}
            placeholder="Повторите введённый пароль"
            placeholderTextColor="#64748B"
            secureTextEntry
            value={confirmPassword}
            onChangeText={setConfirmPassword}
          />

          <TouchableOpacity
            style={[styles.button, isLoading && styles.buttonDisabled]}
            onPress={handleRegister}
            disabled={isLoading}
            activeOpacity={0.85}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.buttonText}>Зарегистрироваться</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.loginLink}
            onPress={() => router.replace('/(auth)/login')}
          >
            <Text style={styles.loginLinkText}>
              Уже есть аккаунт? <Text style={styles.loginLinkAccent}>Войти</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  header: { alignItems: 'center', marginBottom: 28 },
  title: { fontSize: 32, fontWeight: 'bold', color: '#10B981', letterSpacing: 0.5 },
  subtitle: { fontSize: 15, color: '#94A3B8', marginTop: 6 },
  card: {
    backgroundColor: 'rgba(30, 41, 59, 0.75)',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.15)',
  },
  label: { color: '#E2E8F0', fontSize: 14, fontWeight: '600', marginBottom: 6 },
  input: {
    backgroundColor: '#1E293B',
    color: '#F8FAFC',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: 15,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  button: {
    backgroundColor: '#10B981',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
  loginLink: { marginTop: 20, alignItems: 'center' },
  loginLinkText: { color: '#94A3B8', fontSize: 14 },
  loginLinkAccent: { color: '#10B981', fontWeight: '600' },
});
