// mobile/app/(auth)/register.tsx — Регистрация абонента «Домофондар»
// Стиль как на сайте: карточка, бренд-шапка, согласия (ФЗ-152 + оферта, обязательно) и
// рекламная рассылка (необязательно) с просмотром документов. Тема-зависимый.

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
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@/store/auth.store';
import { useAppTheme } from '@/theme';
import { apiClient } from '@/api/client';
import { LegalModal } from '@/components/LegalModal';

export default function RegisterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useAppTheme();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Согласия: обработка ПД + оферта (обязательно), рекламная рассылка (необязательно)
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [legalDocId, setLegalDocId] = useState<string | null>(null);

  const { register, isLoading } = useAuthStore();

  const handleRegister = async () => {
    if (!fullName.trim()) { Alert.alert('Внимание', 'Пожалуйста, укажите ваше ФИО'); return; }
    if (!phone.trim()) { Alert.alert('Внимание', 'Пожалуйста, укажите номер телефона'); return; }
    if (!password) { Alert.alert('Внимание', 'Введите пароль'); return; }
    if (password.length < 6) { Alert.alert('Внимание', 'Пароль должен содержать не менее 6 символов'); return; }
    if (password !== confirmPassword) { Alert.alert('Внимание', 'Введённые пароли не совпадают'); return; }
    if (!agreedToTerms) {
      Alert.alert('Необходимо согласие', 'Для создания личного кабинета необходимо согласие на обработку персональных данных (ФЗ-152) и принятие публичной оферты.');
      return;
    }

    try {
      await register(phone.trim(), password, fullName.trim(), email.trim());
      // Сохраняем согласие на рекламную рассылку (если отмечено) — после успешного входа
      if (marketingConsent) {
        try { await apiClient.post('/api/user/marketing-consent', { enabled: true }); }
        catch (e) { console.warn('[Register] Не удалось сохранить согласие на рассылку:', e); }
      }
      router.replace('/(tabs)/home');
    } catch (error: any) {
      const serverMessage = error.response?.data?.error || error.message || 'Не удалось зарегистрироваться. Попробуйте снова.';
      Alert.alert('Ошибка регистрации', serverMessage);
    }
  };

  const inputStyle = [styles.input, { backgroundColor: isDark ? '#1c1f2a' : '#f8f9ff', borderColor: colors.border, color: colors.text }];

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={[styles.container, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
        {/* Бренд-шапка */}
        <View style={styles.header}>
          <View style={[styles.logoBadge, { backgroundColor: colors.primaryContainer }]}>
            <Ionicons name="shield-checkmark" size={30} color="#ffffff" />
          </View>
          <Text style={[styles.logoTitle, { color: colors.text }]}>
            ДОМОФОН<Text style={{ color: colors.primaryContainer }}>ДАР</Text>
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Создание личного кабинета жильца</Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>ФИО</Text>
          <TextInput style={inputStyle} placeholder="Иванов Иван Иванович" placeholderTextColor={colors.textMuted} value={fullName} onChangeText={setFullName} />

          <Text style={[styles.label, { color: colors.textSecondary, marginTop: 12 }]}>Номер телефона</Text>
          <TextInput style={inputStyle} placeholder="+7 (999) 123-45-67" placeholderTextColor={colors.textMuted} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />

          <Text style={[styles.label, { color: colors.textSecondary, marginTop: 12 }]}>Электронная почта (необязательно)</Text>
          <TextInput style={inputStyle} placeholder="example@mail.ru" placeholderTextColor={colors.textMuted} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />

          <Text style={[styles.label, { color: colors.textSecondary, marginTop: 12 }]}>Пароль</Text>
          <TextInput style={inputStyle} placeholder="Не менее 6 символов" placeholderTextColor={colors.textMuted} secureTextEntry value={password} onChangeText={setPassword} />

          <Text style={[styles.label, { color: colors.textSecondary, marginTop: 12 }]}>Повторите пароль</Text>
          <TextInput style={inputStyle} placeholder="Повторите введённый пароль" placeholderTextColor={colors.textMuted} secureTextEntry value={confirmPassword} onChangeText={setConfirmPassword} />

          {/* Согласие на обработку ПД + оферта (обязательно) */}
          <TouchableOpacity style={styles.consentRow} activeOpacity={0.8} onPress={() => setAgreedToTerms(!agreedToTerms)}>
            <Ionicons name={agreedToTerms ? 'checkbox' : 'square-outline'} size={22} color={agreedToTerms ? colors.primaryContainer : colors.textMuted} style={{ marginTop: 1 }} />
            <Text style={[styles.consentText, { color: colors.textSecondary }]}>
              Я соглашаюсь на{' '}
              <Text style={[styles.link, { color: colors.primaryContainer }]} onPress={() => setLegalDocId('data-consent')}>обработку персональных данных</Text>
              {' '}(ФЗ-152) и принимаю условия{' '}
              <Text style={[styles.link, { color: colors.primaryContainer }]} onPress={() => setLegalDocId('public-offer')}>публичной оферты</Text>.
            </Text>
          </TouchableOpacity>

          {/* Согласие на рекламную рассылку (необязательно) */}
          <TouchableOpacity style={styles.consentRow} activeOpacity={0.8} onPress={() => setMarketingConsent(!marketingConsent)}>
            <Ionicons name={marketingConsent ? 'checkbox' : 'square-outline'} size={22} color={marketingConsent ? colors.primaryContainer : colors.textMuted} style={{ marginTop: 1 }} />
            <Text style={[styles.consentText, { color: colors.textSecondary }]}>
              Хочу получать информацию об акциях, скидках и новинках и даю{' '}
              <Text style={[styles.link, { color: colors.primaryContainer }]} onPress={() => setLegalDocId('advertising-consent')}>согласие на рекламную рассылку</Text>
              {' '}(необязательно, можно отключить в кабинете).
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, { backgroundColor: agreedToTerms ? colors.primaryContainer : colors.border }, (isLoading || !agreedToTerms) && styles.disabled]}
            onPress={handleRegister}
            disabled={isLoading || !agreedToTerms}
            activeOpacity={0.85}
          >
            {isLoading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={[styles.buttonText, { color: agreedToTerms ? '#fff' : colors.textMuted }]}>Создать личный кабинет</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={styles.loginLink} onPress={() => router.replace('/(auth)/login')}>
            <Text style={[styles.loginLinkText, { color: colors.textSecondary }]}>
              Уже есть аккаунт? <Text style={{ color: colors.primaryContainer, fontWeight: '700' }}>Войти</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <LegalModal visible={!!legalDocId} docId={legalDocId} onClose={() => setLegalDocId(null)} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  header: { alignItems: 'center', marginBottom: 20 },
  logoBadge: {
    width: 60, height: 60, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 12,
    shadowColor: '#0ea5e9', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
  },
  logoTitle: { fontSize: 26, fontWeight: '800', letterSpacing: 0.5 },
  subtitle: { fontSize: 14, marginTop: 6 },
  card: { borderRadius: 20, padding: 22, borderWidth: 1 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  input: { borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 15, borderWidth: 1 },
  consentRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 16 },
  consentText: { flex: 1, fontSize: 12.5, lineHeight: 18 },
  link: { fontWeight: '700' },
  button: { borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 18 },
  disabled: { opacity: 0.7 },
  buttonText: { fontSize: 16, fontWeight: '700' },
  loginLink: { marginTop: 16, alignItems: 'center' },
  loginLinkText: { fontSize: 14 },
});
