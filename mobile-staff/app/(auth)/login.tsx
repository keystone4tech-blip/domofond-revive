/**
 * Экран авторизации сотрудника — Приложение «Офис Работа»
 * Вход по номеру телефона и паролю от личного кабинета / CRM
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useStaffAuthStore } from '../../src/store/auth.store';
import { StaffRole } from '../../src/types/staff';

export default function LoginScreen() {
  const router = useRouter();
  const [phone, setPhone] = useState('+7 (909) 453-62-41');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const login = useStaffAuthStore((state) => state.login);
  const loginDemo = useStaffAuthStore((state) => state.loginDemo);
  const isLoading = useStaffAuthStore((state) => state.isLoading);
  const error = useStaffAuthStore((state) => state.error);
  const clearError = useStaffAuthStore((state) => state.clearError);

  // Обработка реального входа по логину и паролю
  const handleLogin = async () => {
    if (!phone.trim()) {
      Alert.alert('Ошибка', 'Введите номер телефона сотрудника');
      return;
    }
    if (!password.trim()) {
      Alert.alert('Ошибка', 'Введите пароль от личного кабинета');
      return;
    }

    clearError();
    const success = await login(phone, password);
    if (success) {
      router.replace('/(tabs)');
    }
  };

  // Быстрый демо-вход для тестирования ролей
  const handleDemoLogin = (role: StaffRole) => {
    loginDemo(role);
    router.replace('/(tabs)');
  };

  return (
    <KeyboardAvoidingView
      style={styles.keyboardContainer}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Верхний брендовый блок */}
        <View style={styles.headerBlock}>
          <View style={styles.badgeWrap}>
            <View style={styles.statusDot} />
            <Text style={styles.badgeText}>СЛУЖЕБНЫЙ ДОСТУП</Text>
          </View>
          <Text style={styles.appTitle}>Офис Работа</Text>
          <Text style={styles.appSubtitle}>
            Единое рабочее пространство для мастеров, монтажников и диспетчеров
          </Text>
        </View>

        {/* Форма авторизации */}
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Вход в рабочий кабинет</Text>

          {/* Сообщение об ошибке */}
          {error ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={18} color="#EF4444" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Поле: Номер телефона */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Номер телефона</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="call-outline" size={20} color="#64748B" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="+7 (999) 000-00-00"
                placeholderTextColor="#64748B"
                value={phone}
                onChangeText={(t) => {
                  setPhone(t);
                  if (error) clearError();
                }}
                keyboardType="phone-pad"
                autoCapitalize="none"
              />
            </View>
          </View>

          {/* Поле: Пароль */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Пароль от кабинета</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="lock-closed-outline" size={20} color="#64748B" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Введите пароль"
                placeholderTextColor="#64748B"
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={(t) => {
                  setPassword(t);
                  if (error) clearError();
                }}
                autoCapitalize="none"
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeBtn}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color="#64748B"
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Кнопка входа */}
          <TouchableOpacity
            style={[styles.submitBtn, isLoading && styles.submitBtnDisabled]}
            onPress={handleLogin}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Text style={styles.submitBtnText}>Войти на смену</Text>
                <Ionicons name="arrow-forward" size={18} color="#FFFFFF" style={{ marginLeft: 6 }} />
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Секция быстрого тестирования ролей */}
        <View style={styles.demoSection}>
          <Text style={styles.demoTitle}>⚡ БЫСТРЫЙ ВХОД ДЛЯ ТЕСТИРОВАНИЯ</Text>
          <Text style={styles.demoDesc}>
            Выберите роль для моментальной проверки соответствующего рабочего стола:
          </Text>

          <View style={styles.demoButtonsRow}>
            <TouchableOpacity
              style={[styles.demoBtn, styles.demoBtnMaster]}
              onPress={() => handleDemoLogin('master')}
            >
              <Ionicons name="build" size={20} color="#10B981" />
              <Text style={styles.demoBtnTitle}>Мастер / Техник</Text>
              <Text style={styles.demoBtnSubtitle}>Наряды, выезды, акты</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.demoBtn, styles.demoBtnDispatcher]}
              onPress={() => handleDemoLogin('dispatcher')}
            >
              <Ionicons name="headset" size={20} color="#3B82F6" />
              <Text style={styles.demoBtnTitle}>Диспетчер</Text>
              <Text style={styles.demoBtnSubtitle}>Очередь, назначение</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.demoButtonsRow}>
            <TouchableOpacity
              style={[styles.demoBtn, styles.demoBtnDirector]}
              onPress={() => handleDemoLogin('director')}
            >
              <Ionicons name="stats-chart" size={20} color="#8B5CF6" />
              <Text style={styles.demoBtnTitle}>Руководитель</Text>
              <Text style={styles.demoBtnSubtitle}>Сводка дня, контроль</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.demoBtn, styles.demoBtnAdmin]}
              onPress={() => handleDemoLogin('admin')}
            >
              <Ionicons name="shield-checkmark" size={20} color="#F59E0B" />
              <Text style={styles.demoBtnTitle}>Администратор</Text>
              <Text style={styles.demoBtnSubtitle}>Полный доступ FSM</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Подвал с копирайтом */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Универсальная FSM-платформа «Офис Работа» • v1.0.0
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 30,
  },
  headerBlock: {
    alignItems: 'center',
    marginBottom: 28,
  },
  badgeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginBottom: 12,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#3B82F6',
    marginRight: 6,
  },
  badgeText: {
    color: '#60A5FA',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  appTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: 0.3,
  },
  appSubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 6,
    paddingHorizontal: 20,
    lineHeight: 18,
  },
  formCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  formTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#F1F5F9',
    marginBottom: 16,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    padding: 10,
    borderRadius: 8,
    marginBottom: 14,
  },
  errorText: {
    color: '#F87171',
    fontSize: 13,
    marginLeft: 8,
    flex: 1,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 48,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    color: '#F8FAFC',
    fontSize: 15,
  },
  eyeBtn: {
    padding: 6,
  },
  submitBtn: {
    backgroundColor: '#2563EB',
    height: 48,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  demoSection: {
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 16,
    marginBottom: 20,
  },
  demoTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#38BDF8',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  demoDesc: {
    fontSize: 12,
    color: '#94A3B8',
    marginBottom: 14,
  },
  demoButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  demoBtn: {
    flex: 1,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    alignItems: 'flex-start',
  },
  demoBtnMaster: {
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  demoBtnDispatcher: {
    borderColor: 'rgba(59, 130, 246, 0.4)',
  },
  demoBtnDirector: {
    borderColor: 'rgba(139, 92, 246, 0.4)',
  },
  demoBtnAdmin: {
    borderColor: 'rgba(245, 158, 11, 0.4)',
  },
  demoBtnTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F1F5F9',
    marginTop: 6,
  },
  demoBtnSubtitle: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
  },
  footer: {
    alignItems: 'center',
    marginTop: 10,
  },
  footerText: {
    fontSize: 11,
    color: '#64748B',
  },
});
