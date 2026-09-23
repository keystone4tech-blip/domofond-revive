// mobile/app/(auth)/login.tsx — Экран авторизации абонента в мобильном приложении «Домофондар»
// Поддерживает вход как по номеру телефона, так и по Email с проверкой в базе данных сайта

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store/auth.store';

export default function LoginScreen() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState(''); // Email или номер телефона
  const [password, setPassword] = useState('');     // Пароль от личного кабинета
  const [showPassword, setShowPassword] = useState(false);

  // Достаем функцию реальной авторизации и флаг загрузки из стора
  const { login, isLoading } = useAuthStore();

  const handleLogin = async () => {
    if (!identifier.trim() || !password.trim()) {
      Alert.alert('Внимание', 'Пожалуйста, введите ваш Email или номер телефона и пароль');
      return;
    }

    console.log(`[UI Login] Запуск входа для: ${identifier.trim()}`);

    try {
      // Реальный сетевой запрос через Axios к серверу https://домофондар.рф/backend-api/api/auth/login
      await login(identifier.trim(), password.trim());
      console.log('[UI Login] Авторизация успешна!');
      // Переход на главный экран
      router.replace('/(tabs)/home');
    } catch (error: any) {
      console.error('[UI Login] Ошибка входа:', error);
      const serverMessage = error.response?.data?.error || error.message || 'Неверный логин или пароль. Проверьте введенные данные.';
      Alert.alert('Ошибка авторизации', serverMessage);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: '#0F172A' }}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {/* Логотип и заголовок */}
        <View style={styles.header}>
          <Text style={styles.logoTitle}>Домофондар</Text>
          <Text style={styles.subtitle}>Вход в личный кабинет абонента</Text>
        </View>

        {/* Форма авторизации */}
        <View style={styles.card}>
          <Text style={styles.label}>Телефон или Email</Text>
          <TextInput
            style={styles.input}
            placeholder="например: +79991234567 или mail@example.ru"
            placeholderTextColor="#64748B"
            value={identifier}
            onChangeText={setIdentifier}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
          />

          <Text style={styles.label}>Пароль</Text>
          <View style={styles.passwordContainer}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Введите ваш пароль"
              placeholderTextColor="#64748B"
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
              autoCapitalize="none"
            />
            <TouchableOpacity
              onPress={() => setShowPassword(!showPassword)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.showHideText}>{showPassword ? 'Скрыть' : 'Показать'}</Text>
            </TouchableOpacity>
          </View>

          {/* Кнопка входа с индикатором загрузки */}
          <TouchableOpacity
            style={[styles.loginButton, isLoading && styles.loginButtonDisabled]}
            onPress={handleLogin}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.loginButtonText}>Войти в аккаунт</Text>
            )}
          </TouchableOpacity>

          {/* Переход к регистрации */}
          <TouchableOpacity
            style={styles.registerLink}
            onPress={() => router.push('/(auth)/register')}
          >
            <Text style={styles.registerLinkText}>
              Ещё нет аккаунта? <Text style={styles.registerLinkAccent}>Зарегистрироваться</Text>
            </Text>
          </TouchableOpacity>
        </View>

        {/* Поясняющая подсказка */}
        <Text style={styles.footerNote}>
          Используйте тот же логин и пароль, с которыми вы заходите на официальный сайт домофондар.рф
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoTitle: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#10B981',
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 15,
    color: '#94A3B8',
    marginTop: 8,
  },
  card: {
    backgroundColor: 'rgba(30, 41, 59, 0.75)',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 5,
  },
  label: {
    color: '#E2E8F0',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#1E293B',
    color: '#F8FAFC',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 24,
    paddingRight: 16,
  },
  passwordInput: {
    flex: 1,
    color: '#F8FAFC',
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
  },
  showHideText: {
    color: '#10B981',
    fontSize: 13,
    fontWeight: '600',
  },
  loginButton: {
    backgroundColor: '#10B981',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  registerLink: {
    marginTop: 20,
    alignItems: 'center',
  },
  registerLinkText: {
    color: '#94A3B8',
    fontSize: 14,
  },
  registerLinkAccent: {
    color: '#10B981',
    fontWeight: '600',
  },
  footerNote: {
    color: '#64748B',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 24,
    paddingHorizontal: 16,
    lineHeight: 18,
  },
});
