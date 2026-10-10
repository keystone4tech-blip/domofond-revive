/**
 * Экран «Профиль сотрудника» — Приложение «Офис Работа»
 * Управление сменой, просмотр личной статистики, переключение роли и выход
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Alert,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useStaffAuthStore } from '../../src/store/auth.store';
import { StaffRole } from '../../src/types/staff';
import { staffApiClient } from '../../src/api/client';
import { APP_VERSION, APP_DOWNLOAD_URL } from '../../src/config/constants';
import { compareVersions } from '../../src/components/UpdateCheckerModal';
import { PermissionsCenterModal } from '../../src/components/PermissionsCenterModal';

export default function ProfileScreen() {
  const router = useRouter();
  const [permissionsVisible, setPermissionsVisible] = useState(false);
  const user = useStaffAuthStore((state) => state.user);
  const activeViewRole = useStaffAuthStore((state) => state.activeViewRole);
  const setActiveViewRole = useStaffAuthStore((state) => state.setActiveViewRole);
  const shiftStatus = useStaffAuthStore((state) => state.shiftStatus);
  const setShiftStatus = useStaffAuthStore((state) => state.setShiftStatus);
  const logout = useStaffAuthStore((state) => state.logout);

  const handleCheckUpdateManual = async () => {
    try {
      const response = await staffApiClient.get<any>('/api/app/version-staff').catch(async () => {
        return await staffApiClient.get<any>('/api/app/version?app=staff');
      });
      const latest = response.data?.latestVersion;
      if (latest && compareVersions(latest, APP_VERSION) > 0) {
        Alert.alert(
          'Доступно обновление',
          `Вышла новая версия v${latest}. Обновить сейчас?`,
          [
            { text: 'Позже', style: 'cancel' },
            {
              text: 'Обновить',
              onPress: () => {
                Linking.openURL(response.data?.downloadUrl || APP_DOWNLOAD_URL);
              },
            },
          ]
        );
      } else {
        Alert.alert('Обновление не требуется', `У вас установлена актуальная версия (${APP_VERSION}).`);
      }
    } catch {
      Alert.alert('Офис Работа', `Текущая версия приложения: ${APP_VERSION}`);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Выход из аккаунта',
      'Вы уверены, что хотите завершить сессию в приложении «Офис Работа»?',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Выйти',
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/(auth)/login');
          },
        },
      ]
    );
  };

  const rolesList: { role: StaffRole; title: string; desc: string; icon: string }[] = [
    {
      role: 'master',
      title: 'Мастер / Техник',
      desc: 'Наряды на выезд, акты, фотоотчеты, выработка',
      icon: 'build',
    },
    {
      role: 'dispatcher',
      title: 'Диспетчер',
      desc: 'Очередь входящих заявок, распределение по мастерам',
      icon: 'headset',
    },
    {
      role: 'director',
      title: 'Руководитель',
      desc: 'Сводка выручки дня, контроль SLA, ревизия филиала',
      icon: 'stats-chart',
    },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Профиль сотрудника</Text>
      </View>

      {/* Карточка сотрудника */}
      <View style={styles.userCard}>
        <View style={styles.avatarWrap}>
          <Text style={styles.avatarText}>
            {user?.full_name ? user.full_name.charAt(0) : 'С'}
          </Text>
        </View>

        <View style={styles.userInfo}>
          <Text style={styles.userName}>{user?.full_name || 'Шибаев Сергей Викторович'}</Text>
          <Text style={styles.userPhone}>{user?.phone || '+7 (909) 453-62-41'}</Text>

          <View style={styles.badgeRow}>
            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>
                {user?.role === 'director' ? 'Генеральный директор' : 'Сервисный мастер'}
              </Text>
            </View>
            <View style={styles.ratingBadge}>
              <Ionicons name="star" size={12} color="#F59E0B" />
              <Text style={styles.ratingText}>4.96</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Статус смены */}
      <Text style={styles.sectionTitle}>СТАТУС СМЕНЫ</Text>
      <View style={styles.shiftCard}>
        <View style={styles.shiftLeft}>
          <Ionicons
            name={shiftStatus === 'on_shift' ? 'radio-button-on' : 'moon'}
            size={24}
            color={shiftStatus === 'on_shift' ? '#10B981' : '#64748B'}
          />
          <View style={{ marginLeft: 12 }}>
            <Text style={styles.shiftCardTitle}>
              {shiftStatus === 'on_shift' ? 'На смене (принимаю вызовы)' : 'Отдых / Не беспокоить'}
            </Text>
            <Text style={styles.shiftCardSubtitle}>
              {shiftStatus === 'on_shift'
                ? 'Новые срочные заявки поступают в приложении'
                : 'Вызовы автоматически передаются дежурному экипажу'}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.shiftBtn, shiftStatus === 'on_shift' ? styles.shiftBtnOff : styles.shiftBtnOn]}
          onPress={() => setShiftStatus(shiftStatus === 'on_shift' ? 'off_duty' : 'on_shift')}
        >
          <Text style={styles.shiftBtnText}>
            {shiftStatus === 'on_shift' ? 'Сдать смену' : 'Выйти на смену'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Переключение роли интерфейса (для тестирования) */}
      <Text style={styles.sectionTitle}>РЕЖИМ РАБОЧЕГО СТОЛА (ТЕСТИРОВАНИЕ РОЛЕЙ)</Text>
      <View style={styles.rolesContainer}>
        {rolesList.map((item) => (
          <TouchableOpacity
            key={item.role}
            style={[styles.roleOptionCard, activeViewRole === item.role && styles.roleOptionActive]}
            onPress={() => {
              setActiveViewRole(item.role);
              Alert.alert('Роль переключена', `Рабочий стол адаптирован под роль «${item.title}»`);
            }}
          >
            <View style={styles.roleIconWrap}>
              <Ionicons
                name={item.icon as any}
                size={22}
                color={activeViewRole === item.role ? '#38BDF8' : '#94A3B8'}
              />
            </View>
            <View style={styles.roleTextWrap}>
              <Text style={[styles.roleTitle, activeViewRole === item.role && styles.roleTitleActive]}>
                {item.title}
              </Text>
              <Text style={styles.roleDesc}>{item.desc}</Text>
            </View>
            {activeViewRole === item.role && (
              <Ionicons name="checkmark-circle" size={20} color="#38BDF8" />
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* О приложении */}
      <Text style={styles.sectionTitle}>О СИСТЕМЕ</Text>
      <View style={styles.infoBox}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Приложение:</Text>
          <Text style={styles.infoValue}>Офис Работа</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Версия:</Text>
          <Text style={styles.infoValue}>v1.1.0 (FSM Mobile Core)</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Среда:</Text>
          <Text style={styles.infoValue}>Производственный сервер (HTTPS)</Text>
        </View>

        {/* Кнопка открытия Центра разрешений и фоновой работы */}
        <TouchableOpacity
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: 12,
            marginTop: 10,
            borderTopWidth: 1,
            borderTopColor: '#334155',
          }}
          onPress={() => setPermissionsVisible(true)}
          activeOpacity={0.7}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="shield-checkmark-outline" size={18} color="#38BDF8" />
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#38BDF8' }}>
              Разрешения и фоновая работа
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#64748B" />
        </TouchableOpacity>

        {/* Кнопка ручной проверки обновлений */}
        <TouchableOpacity
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: 12,
            marginTop: 10,
            borderTopWidth: 1,
            borderTopColor: '#334155',
          }}
          onPress={handleCheckUpdateManual}
          activeOpacity={0.7}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="cloud-download-outline" size={18} color="#00F0FF" />
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#00F0FF' }}>Проверить обновления</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#64748B" />
        </TouchableOpacity>
      </View>

      {/* Кнопка выхода */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={20} color="#EF4444" />
        <Text style={styles.logoutBtnText}>Выйти из аккаунта</Text>
      </TouchableOpacity>

      {/* Центр системных разрешений и фонового режима */}
      <PermissionsCenterModal
        visible={permissionsVisible}
        onClose={() => setPermissionsVisible(false)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B132B',
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : 36,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  userCard: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 20,
  },
  avatarWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  avatarText: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  userPhone: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  roleBadge: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  roleBadgeText: {
    fontSize: 11,
    color: '#38BDF8',
    fontWeight: '700',
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 3,
  },
  ratingText: {
    fontSize: 11,
    color: '#F59E0B',
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  shiftCard: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 20,
  },
  shiftLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  shiftCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  shiftCardSubtitle: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  shiftBtn: {
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  shiftBtnOff: {
    backgroundColor: '#334155',
  },
  shiftBtnOn: {
    backgroundColor: '#10B981',
  },
  shiftBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  rolesContainer: {
    gap: 10,
    marginBottom: 20,
  },
  roleOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  roleOptionActive: {
    borderColor: '#38BDF8',
    backgroundColor: 'rgba(30, 41, 59, 0.9)',
  },
  roleIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  roleTextWrap: {
    flex: 1,
  },
  roleTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F1F5F9',
  },
  roleTitleActive: {
    color: '#38BDF8',
  },
  roleDesc: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  infoBox: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 8,
    marginBottom: 24,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  infoLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  infoValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#E2E8F0',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 10,
    paddingVertical: 12,
    gap: 8,
    marginBottom: 20,
  },
  logoutBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#EF4444',
  },
});
