// mobile/app/(tabs)/profile/index.tsx — Экран профиля и настроек в стиле Domofondar CyberShield
// Поддерживает выбор темы (Clean Tech / Cyber Dark / Системная), редактирование адреса и проверку обновлений

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
  Linking,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@/store/auth.store';
import { useAppTheme } from '@/theme';
import { apiClient } from '@/api/client';
import { APP_VERSION } from '@/config/constants';

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, logout, loadProfile } = useAuthStore();
  const { colors, isDark, colorScheme, setTheme } = useAppTheme();

  // Состояние модального окна редактирования данных
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [address, setAddress] = useState((user as any)?.address || '');
  const [apartment, setApartment] = useState((user as any)?.apartment || '');
  const [isSaving, setIsSaving] = useState(false);

  const handleOpenEdit = () => {
    setFullName(user?.full_name || '');
    setPhone(user?.phone || '');
    setAddress((user as any)?.address || '');
    setApartment((user as any)?.apartment || '');
    setIsEditModalOpen(true);
  };

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      console.log('[Profile CyberShield] Сохранение данных профиля:', { fullName, phone, address, apartment });
      await apiClient.put('/api/user/profile', {
        full_name: fullName.trim(),
        phone: phone.trim(),
        address: address.trim(),
        apartment: apartment.trim(),
      });

      await loadProfile();
      setIsEditModalOpen(false);
      Alert.alert('Успешно', 'Данные адреса и профиля обновлены');
    } catch (err: any) {
      console.error('[Profile CyberShield] Ошибка сохранения профиля:', err);
      const msg = err.response?.data?.error || 'Не удалось сохранить данные';
      Alert.alert('Ошибка', msg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Выход из аккаунта', 'Вы действительно хотите выйти из своего личного кабинета?', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Выйти',
        style: 'destructive',
        onPress: async () => {
          console.log('[Profile] Очистка сессии и выход...');
          await logout();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  // Ручная проверка обновлений
  const handleCheckUpdate = async () => {
    try {
      console.log('[Profile] Проверка обновлений...');
      const res = await apiClient.get('/api/app/version');
      if (res.data && res.data.latestVersion) {
        const { latestVersion, downloadUrl, fallbackDownloadUrl, releaseNotes } = res.data;
        if (latestVersion !== APP_VERSION) {
          Alert.alert(
            `Доступна версия ${latestVersion}`,
            `Что нового:\n${(releaseNotes || []).map((n: string) => `• ${n}`).join('\n')}`,
            [
              { text: 'Позже', style: 'cancel' },
              {
                text: 'Скачать обновление',
                onPress: () => {
                  const targetUrl = downloadUrl || fallbackDownloadUrl;
                  if (targetUrl) Linking.openURL(targetUrl);
                },
              },
            ]
          );
        } else {
          Alert.alert('Обновлений нет', `У вас установлена самая актуальная версия Домофондар ${APP_VERSION}.`);
        }
      }
    } catch (e) {
      Alert.alert('Информация', `Текущая версия приложения: ${APP_VERSION}.`);
    }
  };

  const displayName = user?.full_name || (user as any)?.email || 'Абонент';
  const displayPhone = user?.phone || 'Телефон не указан';
  const displayAddress = (user as any)?.address
    ? `${(user as any).address}${(user as any)?.apartment ? `, кв. ${(user as any).apartment}` : ''}`
    : 'Адрес не заполнен';

  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w: string) => w[0].toUpperCase())
    .join('') || 'ДД';

  const safeTop = Math.max(insets.top, 16) + 8;
  const safeBottom = Math.max(insets.bottom, 12) + 75;

  return (
    <View style={[styles.safeArea, { backgroundColor: colors.background, paddingTop: safeTop }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Профиль абонента</Text>
      </View>

      <ScrollView contentContainerStyle={[styles.container, { paddingBottom: safeBottom }]} showsVerticalScrollIndicator={false}>
        {/* Карточка пользователя */}
        <View style={[styles.profileHeader, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.avatar, { backgroundColor: isDark ? '#262a35' : '#e0f2fe' }]}>
            <Text style={[styles.avatarText, { color: colors.primaryContainer }]}>{initials}</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>{displayName}</Text>
            <Text style={[styles.phone, { color: colors.textSecondary }]}>{displayPhone}</Text>
            <Text style={[styles.addressSub, { color: colors.primaryContainer }]} numberOfLines={1}>
              📍 {displayAddress}
            </Text>
          </View>
        </View>

        {/* Кнопка быстрого редактирования адреса */}
        <TouchableOpacity
          style={[styles.editAddressButton, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={handleOpenEdit}
          activeOpacity={0.85}
        >
          <Ionicons name="home-outline" size={20} color={colors.primaryContainer} style={{ marginRight: 8 }} />
          <Text style={[styles.editAddressButtonText, { color: colors.primaryContainer }]}>
            Указать или изменить адрес квартиры
          </Text>
        </TouchableOpacity>

        {/* Оформление темы приложения */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Тема оформления (CyberShield)</Text>
          <View style={[styles.themeSelectorBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <TouchableOpacity
              style={[
                styles.themeOptionBtn,
                colorScheme === 'dark' && [styles.themeOptionActive, { backgroundColor: isDark ? '#262a35' : '#eff4ff', borderColor: colors.primaryContainer }],
              ]}
              onPress={() => setTheme('dark')}
              activeOpacity={0.8}
            >
              <Ionicons name="moon" size={18} color={colorScheme === 'dark' ? colors.primaryContainer : colors.textMuted} />
              <Text style={[styles.themeOptionText, { color: colorScheme === 'dark' ? colors.text : colors.textSecondary, fontWeight: colorScheme === 'dark' ? '700' : '500' }]}>
                Cyber Dark
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.themeOptionBtn,
                colorScheme === 'light' && [styles.themeOptionActive, { backgroundColor: isDark ? '#262a35' : '#eff4ff', borderColor: colors.primaryContainer }],
              ]}
              onPress={() => setTheme('light')}
              activeOpacity={0.8}
            >
              <Ionicons name="sunny" size={18} color={colorScheme === 'light' ? colors.primaryContainer : colors.textMuted} />
              <Text style={[styles.themeOptionText, { color: colorScheme === 'light' ? colors.text : colors.textSecondary, fontWeight: colorScheme === 'light' ? '700' : '500' }]}>
                Clean Tech
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.themeOptionBtn,
                colorScheme === 'system' && [styles.themeOptionActive, { backgroundColor: isDark ? '#262a35' : '#eff4ff', borderColor: colors.primaryContainer }],
              ]}
              onPress={() => setTheme('system')}
              activeOpacity={0.8}
            >
              <Ionicons name="phone-portrait-outline" size={18} color={colorScheme === 'system' ? colors.primaryContainer : colors.textMuted} />
              <Text style={[styles.themeOptionText, { color: colorScheme === 'system' ? colors.text : colors.textSecondary, fontWeight: colorScheme === 'system' ? '700' : '500' }]}>
                Системная
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Данные абонента */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Данные абонента</Text>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <TouchableOpacity style={styles.menuItem} onPress={handleOpenEdit} activeOpacity={0.7}>
              <View style={styles.menuItemLeft}>
                <Ionicons name="person-outline" size={20} color={colors.primaryContainer} />
                <Text style={[styles.menuItemTitle, { color: colors.text }]}>ФИО и телефон</Text>
              </View>
              <View style={styles.menuItemRight}>
                <Text style={[styles.menuItemValue, { color: colors.textSecondary }]}>
                  {user?.full_name ? 'Заполнено' : 'Не указано'}
                </Text>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </View>
            </TouchableOpacity>

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            <View style={styles.menuItem}>
              <View style={styles.menuItemLeft}>
                <Ionicons name="mail-outline" size={20} color={colors.primaryContainer} />
                <Text style={[styles.menuItemTitle, { color: colors.text }]}>Электронная почта</Text>
              </View>
              <View style={styles.menuItemRight}>
                <Text style={[styles.menuItemValue, { color: colors.textSecondary }]}>
                  {(user as any)?.email || 'Не указана'}
                </Text>
              </View>
            </View>

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            <TouchableOpacity style={styles.menuItem} onPress={handleOpenEdit} activeOpacity={0.7}>
              <View style={styles.menuItemLeft}>
                <Ionicons name="location-outline" size={20} color={colors.primaryContainer} />
                <Text style={[styles.menuItemTitle, { color: colors.text }]}>Адрес подключения</Text>
              </View>
              <View style={styles.menuItemRight}>
                <Text style={[styles.menuItemValue, { color: colors.textSecondary }]}>
                  {(user as any)?.address ? 'Привязан' : 'Требуется'}
                </Text>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Версия приложения */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>О приложении</Text>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <TouchableOpacity style={styles.menuItem} onPress={handleCheckUpdate} activeOpacity={0.7}>
              <View style={styles.menuItemLeft}>
                <Ionicons name="information-circle-outline" size={20} color={colors.primaryContainer} />
                <Text style={[styles.menuItemTitle, { color: colors.text }]}>Версия приложения</Text>
              </View>
              <View style={styles.menuItemRight}>
                <Text style={[styles.menuItemValue, { color: colors.secondary, fontWeight: '700' }]}>
                  {APP_VERSION}
                </Text>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Выход из аккаунта */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, marginTop: 4 }]}>
          <TouchableOpacity style={styles.menuItem} onPress={handleLogout} activeOpacity={0.7}>
            <View style={styles.menuItemLeft}>
              <Ionicons name="log-out-outline" size={20} color={colors.error} />
              <Text style={[styles.menuItemTitle, { color: colors.error }]}>Выйти из аккаунта</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Модальное окно редактирования адреса и профиля */}
      <Modal visible={isEditModalOpen} animationType="slide" transparent onRequestClose={() => setIsEditModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: isDark ? '#171b26' : '#ffffff', borderColor: colors.border }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Данные квартиры</Text>
              <TouchableOpacity onPress={() => setIsEditModalOpen(false)}>
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>ФИО абонента</Text>
              <TextInput
                style={[styles.modalInput, { backgroundColor: isDark ? '#1c1f2a' : '#f8f9ff', borderColor: colors.border, color: colors.text }]}
                value={fullName}
                onChangeText={setFullName}
                placeholder="Иванов Иван Иванович"
                placeholderTextColor={colors.textMuted}
              />

              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Номер телефона</Text>
              <TextInput
                style={[styles.modalInput, { backgroundColor: isDark ? '#1c1f2a' : '#f8f9ff', borderColor: colors.border, color: colors.text }]}
                value={phone}
                onChangeText={setPhone}
                placeholder="+7 (___) ___-__-__"
                placeholderTextColor={colors.textMuted}
                keyboardType="phone-pad"
              />

              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Адрес (город, улица, номер дома)</Text>
              <TextInput
                style={[styles.modalInput, { backgroundColor: isDark ? '#1c1f2a' : '#f8f9ff', borderColor: colors.border, color: colors.text }]}
                value={address}
                onChangeText={setAddress}
                placeholder="например: г. Нальчик, ул. Ленина, д. 10"
                placeholderTextColor={colors.textMuted}
              />

              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Номер квартиры</Text>
              <TextInput
                style={[styles.modalInput, { backgroundColor: isDark ? '#1c1f2a' : '#f8f9ff', borderColor: colors.border, color: colors.text }]}
                value={apartment}
                onChangeText={setApartment}
                placeholder="например: 45"
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
              />

              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: colors.primaryContainer }]}
                onPress={handleSaveProfile}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.saveBtnText}>Сохранить адрес</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: { paddingHorizontal: 16, marginBottom: 12 },
  title: { fontSize: 24, fontWeight: '800' },
  container: { paddingHorizontal: 16 },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  avatarText: { fontSize: 20, fontWeight: '700' },
  profileInfo: { flex: 1 },
  name: { fontSize: 17, fontWeight: '700', marginBottom: 2 },
  phone: { fontSize: 13, marginBottom: 4 },
  addressSub: { fontSize: 12, fontWeight: '600' },
  editAddressButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  editAddressButtonText: { fontSize: 14, fontWeight: '600' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontWeight: '700', marginBottom: 8, paddingHorizontal: 4 },
  themeSelectorBox: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
  themeOptionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  themeOptionActive: {},
  themeOptionText: { fontSize: 12 },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  menuItemTitle: { fontSize: 14, fontWeight: '500' },
  menuItemValue: { fontSize: 13 },
  divider: { height: 1 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(10, 14, 24, 0.75)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    padding: 20,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  inputLabel: { fontSize: 13, fontWeight: '600', marginBottom: 6, marginTop: 10 },
  modalInput: {
    height: 46,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  saveBtn: {
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    marginBottom: Platform.OS === 'ios' ? 20 : 10,
  },
  saveBtnText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
});
