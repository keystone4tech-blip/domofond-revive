// mobile/app/(tabs)/profile/index.tsx — Экран профиля и данных жильца «Домофондар»
// Позволяет просматривать и редактировать адрес, квартиру и телефон для привязки лицевого счёта.
// Полностью поддерживает светлую/тёмную/системную тему.

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
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/auth.store';
import { useAppTheme } from '@/theme';
import { apiClient } from '@/api/client';
import { APP_VERSION, APP_DOWNLOAD_URL } from '@/config/constants';
import type { ThemeMode } from '@/store/theme.store';

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

  // Отправка изменений: у абонента с заведёнными данными — через модерацию диспетчера
  // (живые данные НЕ меняются до подтверждения, как на сайте); первичное заполнение — сразу.
  const submitProfileChange = async () => {
    setIsSaving(true);
    try {
      const isExisting = !!(user?.is_verified || (user as any)?.address || (user as any)?.account_number);
      if (isExisting) {
        await apiClient.post('/api/user/request-data-change', {
          full_name: fullName.trim(),
          phone: phone.trim(),
          address: address.trim(),
          apartment: apartment.trim(),
        });
        setIsEditModalOpen(false);
        Alert.alert(
          'Отправлено на проверку',
          'Заявка на изменение данных направлена диспетчеру. Новые данные вступят в силу после подтверждения.'
        );
      } else {
        await apiClient.put('/api/user/profile', {
          full_name: fullName.trim(),
          phone: phone.trim(),
          address: address.trim(),
          apartment: apartment.trim(),
        });
        await loadProfile();
        setIsEditModalOpen(false);
        Alert.alert('Сохранено', 'Данные профиля сохранены.');
      }
    } catch (err: any) {
      console.error('[Profile UI] Ошибка сохранения профиля:', err);
      const msg = err.response?.data?.error || 'Не удалось сохранить данные';
      Alert.alert('Ошибка', msg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveProfile = () => {
    if (!fullName.trim()) { Alert.alert('Внимание', 'Укажите ФИО'); return; }
    if (!address.trim()) { Alert.alert('Внимание', 'Укажите адрес'); return; }
    const isExisting = !!(user?.is_verified || (user as any)?.address || (user as any)?.account_number);
    if (isExisting) {
      // Предупреждение + модерация: данные не меняются молча
      Alert.alert(
        'Изменение данных абонента',
        'Данные меняются только после проверки диспетчером. Отправить заявку на изменение?',
        [
          { text: 'Отмена', style: 'cancel' },
          { text: 'Отправить на проверку', onPress: submitProfileChange },
        ]
      );
    } else {
      submitProfileChange();
    }
  };

  // Ручная проверка обновлений при нажатии на версию в профиле
  const handleCheckUpdateManual = async () => {
    try {
      console.log('[Профиль] Пользователь запросил проверку обновлений...');
      const response = await apiClient.get<any>('/api/app/version');
      const latest = response.data?.latestVersion;
      if (latest && latest !== APP_VERSION) {
        Alert.alert(
          'Доступно обновление',
          `Доступна версия ${latest}. Обновить приложение сейчас?`,
          [
            { text: 'Позже', style: 'cancel' },
            {
              text: 'Обновить',
              onPress: () => {
                const targetUrl = response.data?.downloadUrl || APP_DOWNLOAD_URL;
                console.log('[Профиль] Запуск скачивания APK с официального сайта:', targetUrl);
                Linking.openURL(targetUrl);
              },
            },
          ]
        );
      } else {
        Alert.alert('Обновление не требуется', `У вас установлена последняя версия (${APP_VERSION}).`);
      }
    } catch (e) {
      console.warn('[Профиль] Ошибка проверки обновлений:', e);
      Alert.alert('Версия приложения', `У вас установлена версия ${APP_VERSION}.`);
    }
  };

  const handleLogout = () => {
    Alert.alert('Выход из аккаунта', 'Вы действительно хотите выйти из своего личного кабинета?', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Выйти',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/(auth)/login');
        },
      },
    ]);
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

  const themeOptions: { mode: ThemeMode; label: string; icon: any }[] = [
    { mode: 'system', label: 'Система', icon: 'phone-portrait-outline' },
    { mode: 'light', label: 'Светлая', icon: 'sunny-outline' },
    { mode: 'dark', label: 'Тёмная', icon: 'moon-outline' },
  ];

  const MenuItem = ({ icon, title, value = '', isDestructive = false, onPress }: any) => (
    <TouchableOpacity style={styles.menuItem} onPress={onPress} activeOpacity={onPress ? 0.7 : 1}>
      <View style={styles.menuItemLeft}>
        <Ionicons name={icon} size={22} color={isDestructive ? colors.error : colors.textMuted} />
        <Text style={[styles.menuItemTitle, { color: isDestructive ? colors.error : colors.text }]}>{title}</Text>
      </View>
      <View style={styles.menuItemRight}>
        {value ? <Text style={[styles.menuItemValue, { color: colors.textSecondary }]}>{value}</Text> : null}
        {onPress ? <Ionicons name="chevron-forward" size={18} color={colors.textMuted} /> : null}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.safeArea, { backgroundColor: colors.background, paddingTop: Math.max(insets.top, 16) }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Профиль</Text>
      </View>

      <ScrollView contentContainerStyle={[styles.container, { paddingBottom: 90 + insets.bottom }]}>
        {/* Карточка пользователя */}
        <View style={[styles.profileHeader, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.avatar, { backgroundColor: isDark ? 'rgba(16,185,129,0.2)' : '#dcfce7', borderColor: colors.secondary }]}>
            <Text style={[styles.avatarText, { color: colors.secondary }]}>{initials}</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>{displayName}</Text>
            <Text style={[styles.phone, { color: colors.textSecondary }]}>{displayPhone}</Text>
            <Text style={[styles.addressSub, { color: colors.secondary }]} numberOfLines={1}>📍 {displayAddress}</Text>
          </View>
        </View>

        {/* Кнопка быстрого редактирования адреса */}
        <TouchableOpacity
          style={[styles.editAddressButton, { backgroundColor: isDark ? 'rgba(16,185,129,0.12)' : '#ecfdf5', borderColor: isDark ? 'rgba(16,185,129,0.3)' : colors.secondary }]}
          onPress={handleOpenEdit}
          activeOpacity={0.85}
        >
          <Ionicons name="home-outline" size={20} color={colors.secondary} style={{ marginRight: 8 }} />
          <Text style={[styles.editAddressButtonText, { color: colors.secondary }]}>Указать или изменить адрес квартиры</Text>
        </TouchableOpacity>

        {/* Данные абонента */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Данные абонента</Text>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <MenuItem icon="person-outline" title="ФИО и телефон" value={user?.full_name ? 'Заполнено' : 'Не указано'} onPress={handleOpenEdit} />
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <MenuItem icon="mail-outline" title="Электронная почта" value={(user as any)?.email || 'Не указана'} />
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <MenuItem icon="location-outline" title="Адрес подключения" value={(user as any)?.address ? 'Привязан' : 'Требуется'} onPress={handleOpenEdit} />
          </View>
        </View>

        {/* Оформление / тема */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Оформление</Text>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, padding: 12 }]}>
            <Text style={[styles.themeHint, { color: colors.textSecondary }]}>Тема приложения</Text>
            <View style={[styles.segment, { backgroundColor: isDark ? '#171b26' : '#eff4ff', borderColor: colors.border }]}>
              {themeOptions.map((opt) => {
                const active = colorScheme === opt.mode;
                return (
                  <TouchableOpacity
                    key={opt.mode}
                    style={[styles.segmentBtn, active && { backgroundColor: colors.primaryContainer }]}
                    onPress={() => setTheme(opt.mode)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name={opt.icon} size={16} color={active ? '#ffffff' : colors.textSecondary} style={{ marginRight: 5 }} />
                    <Text style={{ color: active ? '#ffffff' : colors.textSecondary, fontWeight: active ? '700' : '500', fontSize: 13 }}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        {/* О приложении */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>О приложении</Text>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <MenuItem icon="shield-checkmark-outline" title="Служба поддержки" value="+7 (903) 411-83-93" />
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <MenuItem
              icon="information-circle-outline"
              title="Версия приложения"
              value={APP_VERSION}
              onPress={handleCheckUpdateManual}
            />
          </View>
        </View>

        {/* Выход */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <MenuItem icon="log-out-outline" title="Выйти из аккаунта" isDestructive onPress={handleLogout} />
        </View>
      </ScrollView>

      {/* Модальное окно редактирования адреса и профиля */}
      <Modal visible={isEditModalOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Данные квартиры</Text>
              <TouchableOpacity onPress={() => setIsEditModalOpen(false)}>
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>ФИО абонента</Text>
              <TextInput
                style={[styles.modalInput, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
                value={fullName} onChangeText={setFullName}
                placeholder="Иванов Иван Иванович" placeholderTextColor={colors.textMuted}
              />

              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Номер телефона</Text>
              <TextInput
                style={[styles.modalInput, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
                value={phone} onChangeText={setPhone}
                placeholder="+7 (___) ___-__-__" placeholderTextColor={colors.textMuted}
                keyboardType="phone-pad"
              />

              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Адрес (город, улица, дом, подъезд)</Text>
              <TextInput
                style={[styles.modalInput, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
                value={address} onChangeText={setAddress}
                placeholder="например: г. Краснодар, ул. Казбекская, д. 13, п. 2" placeholderTextColor={colors.textMuted}
              />

              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Номер квартиры</Text>
              <TextInput
                style={[styles.modalInput, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
                value={apartment} onChangeText={setApartment}
                placeholder="например: 116" placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
              />

              <TouchableOpacity
                style={[styles.saveButton, { backgroundColor: colors.secondaryContainer }, isSaving && styles.saveButtonDisabled]}
                onPress={handleSaveProfile} disabled={isSaving} activeOpacity={0.85}
              >
                {isSaving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveButtonText}>Сохранить данные</Text>}
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
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  title: { fontSize: 28, fontWeight: 'bold' },
  container: { padding: 20 },
  profileHeader: {
    flexDirection: 'row', alignItems: 'center', borderRadius: 20, padding: 20,
    marginBottom: 16, borderWidth: 1,
  },
  avatar: {
    width: 60, height: 60, borderRadius: 30, borderWidth: 2,
    justifyContent: 'center', alignItems: 'center', marginRight: 16,
  },
  avatarText: { fontSize: 22, fontWeight: 'bold' },
  profileInfo: { flex: 1 },
  name: { fontSize: 18, fontWeight: 'bold' },
  phone: { fontSize: 14, marginTop: 4 },
  addressSub: { fontSize: 13, marginTop: 4 },
  editAddressButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderRadius: 14, paddingVertical: 14, marginBottom: 24,
  },
  editAddressButtonText: { fontSize: 14, fontWeight: '600' },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', marginBottom: 10, marginLeft: 4 },
  card: { borderRadius: 16, overflow: 'hidden', borderWidth: 1 },
  menuItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16, paddingHorizontal: 16 },
  menuItemLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  menuItemTitle: { fontSize: 15, marginLeft: 12, fontWeight: '500' },
  menuItemRight: { flexDirection: 'row', alignItems: 'center' },
  menuItemValue: { fontSize: 14, marginRight: 8 },
  divider: { height: 1, marginLeft: 50 },
  themeHint: { fontSize: 13, fontWeight: '600', marginBottom: 10, marginLeft: 4 },
  segment: { flexDirection: 'row', borderRadius: 12, borderWidth: 1, padding: 4, gap: 4 },
  segmentBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 9, borderRadius: 9 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.7)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '85%', borderWidth: 1 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold' },
  inputLabel: { fontSize: 13, fontWeight: '600', marginBottom: 6, marginTop: 12 },
  modalInput: { borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 15, borderWidth: 1 },
  saveButton: { borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 24, marginBottom: 20 },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
});
