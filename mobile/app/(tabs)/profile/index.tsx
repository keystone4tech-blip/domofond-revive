// mobile/app/(tabs)/profile/index.tsx — Экран профиля и данных жильца «Домофондар»
// Позволяет просматривать и редактировать адрес, квартиру и телефон для привязки лицевого счёта

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/auth.store';
import { apiClient } from '@/api/client';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout, loadProfile } = useAuthStore();

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
      console.log('[Profile UI] Сохранение данных профиля:', { fullName, phone, address, apartment });
      await apiClient.put('/api/user/profile', {
        full_name: fullName.trim(),
        phone: phone.trim(),
        address: address.trim(),
        apartment: apartment.trim(),
      });

      // Перезагружаем профиль в сторе
      await loadProfile();
      setIsEditModalOpen(false);
      Alert.alert('Успешно', 'Данные вашего адреса и профиля сохранены!');
    } catch (err: any) {
      console.error('[Profile UI] Ошибка сохранения профиля:', err);
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

  const MenuItem = ({ icon, title, value = '', isDestructive = false, onPress }: any) => (
    <TouchableOpacity style={styles.menuItem} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.menuItemLeft}>
        <Ionicons name={icon} size={22} color={isDestructive ? '#EF4444' : '#94A3B8'} />
        <Text style={[styles.menuItemTitle, isDestructive && { color: '#EF4444' }]}>{title}</Text>
      </View>
      <View style={styles.menuItemRight}>
        {value ? <Text style={styles.menuItemValue}>{value}</Text> : null}
        <Ionicons name="chevron-forward" size={18} color="#475569" />
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.title}>Профиль</Text>
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        {/* Карточка пользователя */}
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.name} numberOfLines={1}>{displayName}</Text>
            <Text style={styles.phone}>{displayPhone}</Text>
            <Text style={styles.addressSub} numberOfLines={1}>📍 {displayAddress}</Text>
          </View>
        </View>

        {/* Кнопка быстрого редактирования адреса */}
        <TouchableOpacity style={styles.editAddressButton} onPress={handleOpenEdit} activeOpacity={0.85}>
          <Ionicons name="home-outline" size={20} color="#10B981" style={{ marginRight: 8 }} />
          <Text style={styles.editAddressButtonText}>Указать или изменить адрес квартиры</Text>
        </TouchableOpacity>

        {/* Настройки */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Данные абонента</Text>
          <View style={styles.card}>
            <MenuItem
              icon="person-outline"
              title="ФИО и телефон"
              value={user?.full_name ? 'Заполнено' : 'Не указано'}
              onPress={handleOpenEdit}
            />
            <View style={styles.divider} />
            <MenuItem
              icon="mail-outline"
              title="Электронная почта"
              value={(user as any)?.email || 'Не указана'}
            />
            <View style={styles.divider} />
            <MenuItem
              icon="location-outline"
              title="Адрес подключения"
              value={(user as any)?.address ? 'Привязан' : 'Требуется'}
              onPress={handleOpenEdit}
            />
          </View>
        </View>

        {/* Приложение */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>О системе</Text>
          <View style={styles.card}>
            <MenuItem icon="server-outline" title="Сервер" value="45.8.99.238" />
            <View style={styles.divider} />
            <MenuItem icon="shield-checkmark-outline" title="Статус базы" value="Подключена" />
            <View style={styles.divider} />
            <MenuItem icon="information-circle-outline" title="Версия приложения" value="1.0.0" />
          </View>
        </View>

        {/* Выход */}
        <View style={styles.card}>
          <MenuItem
            icon="log-out-outline"
            title="Выйти из аккаунта"
            isDestructive
            onPress={handleLogout}
          />
        </View>
      </ScrollView>

      {/* Модальное окно редактирования адреса и профиля */}
      <Modal visible={isEditModalOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Данные квартиры</Text>
              <TouchableOpacity onPress={() => setIsEditModalOpen(false)}>
                <Ionicons name="close" size={24} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <ScrollView>
              <Text style={styles.inputLabel}>ФИО абонента</Text>
              <TextInput
                style={styles.modalInput}
                value={fullName}
                onChangeText={setFullName}
                placeholder="Иванов Иван Иванович"
                placeholderTextColor="#64748B"
              />

              <Text style={styles.inputLabel}>Номер телефона</Text>
              <TextInput
                style={styles.modalInput}
                value={phone}
                onChangeText={setPhone}
                placeholder="+7 (___) ___-__-__"
                placeholderTextColor="#64748B"
                keyboardType="phone-pad"
              />

              <Text style={styles.inputLabel}>Адрес (город, улица, номер дома)</Text>
              <TextInput
                style={styles.modalInput}
                value={address}
                onChangeText={setAddress}
                placeholder="например: г. Краснодар, ул. Красная, д. 15"
                placeholderTextColor="#64748B"
              />

              <Text style={styles.inputLabel}>Номер квартиры</Text>
              <TextInput
                style={styles.modalInput}
                value={apartment}
                onChangeText={setApartment}
                placeholder="например: 42"
                placeholderTextColor="#64748B"
                keyboardType="numeric"
              />

              <TouchableOpacity
                style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
                onPress={handleSaveProfile}
                disabled={isSaving}
                activeOpacity={0.85}
              >
                {isSaving ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveButtonText}>Сохранить данные</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0F172A' },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#F8FAFC' },
  container: { padding: 20, paddingBottom: 40 },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.1)',
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderWidth: 2,
    borderColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarText: { color: '#10B981', fontSize: 22, fontWeight: 'bold' },
  profileInfo: { flex: 1 },
  name: { fontSize: 18, fontWeight: 'bold', color: '#F8FAFC' },
  phone: { fontSize: 14, color: '#94A3B8', marginTop: 4 },
  addressSub: { fontSize: 13, color: '#10B981', marginTop: 4 },
  editAddressButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderRadius: 14,
    paddingVertical: 14,
    marginBottom: 24,
  },
  editAddressButtonText: { color: '#10B981', fontSize: 14, fontWeight: '600' },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: '#64748B', textTransform: 'uppercase', marginBottom: 10, marginLeft: 4 },
  card: {
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.1)',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  menuItemLeft: { flexDirection: 'row', alignItems: 'center' },
  menuItemTitle: { fontSize: 15, color: '#F8FAFC', marginLeft: 12, fontWeight: '500' },
  menuItemRight: { flexDirection: 'row', alignItems: 'center' },
  menuItemValue: { fontSize: 14, color: '#94A3B8', marginRight: 8 },
  divider: { height: 1, backgroundColor: 'rgba(148, 163, 184, 0.08)', marginLeft: 50 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '85%',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.15)',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#F8FAFC' },
  inputLabel: { color: '#E2E8F0', fontSize: 13, fontWeight: '600', marginBottom: 6, marginTop: 12 },
  modalInput: {
    backgroundColor: '#1E293B',
    color: '#F8FAFC',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#334155',
  },
  saveButton: {
    backgroundColor: '#10B981',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 20,
  },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
});
