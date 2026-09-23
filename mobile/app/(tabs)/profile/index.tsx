// mobile/app/(tabs)/profile/index.tsx — Экран профиля пользователя «Домофондар»
// Показывает реальные данные авторизованного жильца и обеспечивает безопасный выход

import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/auth.store';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuthStore();

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
        }
      }
    ]);
  };

  const displayName = user?.full_name || (user as any)?.email || 'Абонент';
  const displayPhone = user?.phone || 'Телефон не указан';
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
          </View>
        </View>

        {/* Настройки */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Личный кабинет</Text>
          <View style={styles.card}>
            <MenuItem 
              icon="person-outline" 
              title="Электронная почта" 
              value={(user as any)?.email || 'Не указана'} 
            />
            <View style={styles.divider} />
            <MenuItem 
              icon="shield-checkmark-outline" 
              title="Статус аккаунта" 
              value="Подтверждён" 
            />
            <View style={styles.divider} />
            <MenuItem 
              icon="notifications-outline" 
              title="Уведомления" 
              value="Включены" 
            />
          </View>
        </View>

        {/* Приложение */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Приложение</Text>
          <View style={styles.card}>
            <MenuItem icon="color-palette-outline" title="Тема оформления" value="Тёмная" />
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
    marginBottom: 24,
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
});
