// mobile/app/(auth)/login.tsx — Вход в личный кабинет «Домофондар»
// Стиль как на сайте: карточка, бренд-шапка со щитом, синий акцент; тема-зависимый.

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
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@/store/auth.store';
import { useAppTheme } from '@/theme';

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useAppTheme();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Умное форматирование телефона: если пользователь вводит цифры (начиная с 8 или 7),
  // автоматически форматируем в +7 (XXX) XXX-XX-XX. Если вводится email — сохраняем email без пробелов.
  const handleIdentifierChange = (text: string) => {
    if (text.includes('@') || /[a-zA-Z]/.test(text)) {
      setIdentifier(text.replace(/\s+/g, ''));
      return;
    }
    const digits = text.replace(/\D/g, '');
    if (digits.length === 0) {
      setIdentifier('');
      return;
    }
    let d = digits;
    if (d.startsWith('8')) d = '7' + d.slice(1);
    if (!d.startsWith('7')) d = '7' + d;
    d = d.slice(0, 11);

    let formatted = '+7';
    if (d.length > 1) formatted += ` (${d.slice(1, 4)}`;
    if (d.length >= 4) formatted += `) ${d.slice(4, 7)}`;
    if (d.length >= 7) formatted += `-${d.slice(7, 9)}`;
    if (d.length >= 9) formatted += `-${d.slice(9, 11)}`;
    setIdentifier(formatted);
  };

  const { login, isLoading } = useAuthStore();

  const handleLogin = async () => {
    if (!identifier.trim() || !password.trim()) {
      Alert.alert('Внимание', 'Пожалуйста, введите ваш Email или номер телефона и пароль');
      return;
    }
    try {
      await login(identifier.trim(), password.trim());
      router.replace('/(tabs)/home');
    } catch (error: any) {
      const serverMessage = error.response?.data?.error || error.message || 'Неверный логин или пароль. Проверьте введённые данные.';
      Alert.alert('Ошибка авторизации', serverMessage);
    }
  };

  const inputStyle = [styles.input, { backgroundColor: isDark ? '#1c1f2a' : '#f8f9ff', borderColor: colors.border, color: colors.text }];

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={[styles.container, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
        {/* Бренд-шапка */}
        <View style={styles.header}>
          <View style={[styles.logoBadge, { backgroundColor: colors.primaryContainer }]}>
            <Ionicons name="shield-checkmark" size={34} color="#ffffff" />
          </View>
          <Text style={[styles.logoTitle, { color: colors.text }]}>
            ДОМОФОН<Text style={{ color: colors.primaryContainer }}>ДАР</Text>
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Вход в личный кабинет абонента</Text>
        </View>

        {/* Карточка */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Телефон или Email</Text>
          <TextInput
            style={inputStyle}
            placeholder="+7 (999) 123-45-67 или mail@example.ru"
            placeholderTextColor={colors.textMuted}
            value={identifier}
            onChangeText={handleIdentifierChange}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
          />

          <Text style={[styles.label, { color: colors.textSecondary, marginTop: 14 }]}>Пароль</Text>
          <View style={[styles.passwordContainer, { backgroundColor: isDark ? '#1c1f2a' : '#f8f9ff', borderColor: colors.border }]}>
            <TextInput
              style={[styles.passwordInput, { color: colors.text }]}
              placeholder="Введите ваш пароль"
              placeholderTextColor={colors.textMuted}
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
              autoCapitalize="none"
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.loginButton, { backgroundColor: colors.primaryContainer }, isLoading && styles.disabled]}
            onPress={handleLogin}
            disabled={isLoading}
            activeOpacity={0.85}
          >
            {isLoading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.loginButtonText}>Войти в аккаунт</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={styles.registerLink} onPress={() => router.push('/(auth)/register')}>
            <Text style={[styles.registerLinkText, { color: colors.textSecondary }]}>
              Ещё нет аккаунта? <Text style={{ color: colors.primaryContainer, fontWeight: '700' }}>Зарегистрироваться</Text>
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.footerNote, { color: colors.textMuted }]}>
          Используйте тот же логин и пароль, что и на сайте домофондар.рф
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  header: { alignItems: 'center', marginBottom: 28 },
  logoBadge: {
    width: 68, height: 68, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 14,
    shadowColor: '#0ea5e9', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
  },
  logoTitle: { fontSize: 28, fontWeight: '800', letterSpacing: 0.5 },
  subtitle: { fontSize: 14, marginTop: 6 },
  card: { borderRadius: 20, padding: 22, borderWidth: 1 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 8 },
  input: { borderRadius: 12, paddingHorizontal: 16, paddingVertical: 13, fontSize: 15, borderWidth: 1 },
  passwordContainer: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1, paddingRight: 14 },
  passwordInput: { flex: 1, paddingHorizontal: 16, paddingVertical: 13, fontSize: 15 },
  loginButton: { borderRadius: 12, paddingVertical: 16, alignItems: 'center', justifyContent: 'center', marginTop: 22 },
  disabled: { opacity: 0.6 },
  loginButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  registerLink: { marginTop: 18, alignItems: 'center' },
  registerLinkText: { fontSize: 14 },
  footerNote: { fontSize: 12, textAlign: 'center', marginTop: 22, paddingHorizontal: 16, lineHeight: 18 },
});
