/**
 * mobile/src/components/PermissionsCenterModal.tsx
 * Интерактивный Центр системных разрешений для жителей приложения «Домофондар»
 * Позволяет жильцу видеть статус уведомлений, камеры, галереи и геолокации,
 * а также настроить фоновую работу для гарантированной доставки push-уведомлений
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  checkAllUserPermissions,
  requestUserNotificationsPermission,
  requestUserCameraPermission,
  requestUserMediaLibraryPermission,
  requestUserLocationPermission,
  openUserAppSettings,
  openUserBatteryOptimizationSettings,
  UserPermissionStatusSummary,
} from '../services/permissionsService';
import { useAppTheme } from '../theme';

interface PermissionsCenterModalProps {
  visible: boolean;
  onClose: () => void;
}

export function PermissionsCenterModal({ visible, onClose }: PermissionsCenterModalProps) {
  const { colors, isDark } = useAppTheme();
  const [loading, setLoading] = useState(false);
  const [permissions, setPermissions] = useState<UserPermissionStatusSummary>({
    notifications: false,
    camera: false,
    mediaLibrary: false,
    location: false,
    allEssentialGranted: false,
  });

  useEffect(() => {
    if (visible) {
      loadPermissions();
    }
  }, [visible]);

  const loadPermissions = async () => {
    setLoading(true);
    const status = await checkAllUserPermissions();
    setPermissions(status);
    setLoading(false);
  };

  const handleRequest = async (type: 'notifications' | 'camera' | 'media' | 'location') => {
    setLoading(true);
    if (type === 'notifications') await requestUserNotificationsPermission();
    if (type === 'camera') await requestUserCameraPermission();
    if (type === 'media') await requestUserMediaLibraryPermission();
    if (type === 'location') await requestUserLocationPermission();
    await loadPermissions();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: isDark ? '#0F172A' : '#FFFFFF', borderColor: isDark ? '#1E293B' : '#E2E8F0' }]}>
          {/* Шапка */}
          <View style={[styles.header, { borderBottomColor: isDark ? '#1E293B' : '#F1F5F9' }]}>
            <View style={[styles.headerIconWrapper, { backgroundColor: isDark ? '#1E293B' : '#ECFDF5' }]}>
              <Ionicons name="notifications-circle" size={28} color="#10B981" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.headerTitle, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>
                Разрешения приложения
              </Text>
              <Text style={styles.headerSubtitle}>
                Для уведомлений о визитах мастера и отправки фото
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          {loading && (
            <View style={styles.loadingBanner}>
              <ActivityIndicator size="small" color="#10B981" />
              <Text style={styles.loadingText}>Проверка доступов...</Text>
            </View>
          )}

          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            {/* 1. Push-уведомления */}
            <View style={[styles.card, { backgroundColor: isDark ? '#1E293B' : '#F8FAFC', borderColor: isDark ? '#334155' : '#E2E8F0' }]}>
              <View style={[styles.iconCircle, permissions.notifications ? styles.iconGreen : styles.iconRed]}>
                <Ionicons name="notifications" size={22} color={permissions.notifications ? '#10B981' : '#EF4444'} />
              </View>
              <View style={styles.cardContent}>
                <Text style={[styles.cardTitle, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>
                  Push-уведомления
                </Text>
                <Text style={styles.cardDesc}>
                  Статус домофона, сообщения диспетчера, выезд мастера и квитанции
                </Text>
              </View>
              {permissions.notifications ? (
                <View style={styles.statusBadgeGreen}>
                  <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                  <Text style={styles.statusTextGreen}>Вкл</Text>
                </View>
              ) : (
                <TouchableOpacity style={styles.actionBtn} onPress={() => handleRequest('notifications')}>
                  <Text style={styles.actionBtnText}>Включить</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* 2. Камера */}
            <View style={[styles.card, { backgroundColor: isDark ? '#1E293B' : '#F8FAFC', borderColor: isDark ? '#334155' : '#E2E8F0' }]}>
              <View style={[styles.iconCircle, permissions.camera ? styles.iconGreen : styles.iconRed]}>
                <Ionicons name="camera" size={22} color={permissions.camera ? '#10B981' : '#EF4444'} />
              </View>
              <View style={styles.cardContent}>
                <Text style={[styles.cardTitle, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>
                  Камера
                </Text>
                <Text style={styles.cardDesc}>
                  Фото поломок оборудования и верификация документов на квартиру
                </Text>
              </View>
              {permissions.camera ? (
                <View style={styles.statusBadgeGreen}>
                  <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                  <Text style={styles.statusTextGreen}>Вкл</Text>
                </View>
              ) : (
                <TouchableOpacity style={styles.actionBtn} onPress={() => handleRequest('camera')}>
                  <Text style={styles.actionBtnText}>Включить</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* 3. Фото, видео и файлы */}
            <View style={[styles.card, { backgroundColor: isDark ? '#1E293B' : '#F8FAFC', borderColor: isDark ? '#334155' : '#E2E8F0' }]}>
              <View style={[styles.iconCircle, permissions.mediaLibrary ? styles.iconGreen : styles.iconRed]}>
                <Ionicons name="images" size={22} color={permissions.mediaLibrary ? '#10B981' : '#EF4444'} />
              </View>
              <View style={styles.cardContent}>
                <Text style={[styles.cardTitle, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>
                  Фото, видео и файлы
                </Text>
                <Text style={styles.cardDesc}>
                  Загрузка видео неисправностей из галереи и сохранение квитанций
                </Text>
              </View>
              {permissions.mediaLibrary ? (
                <View style={styles.statusBadgeGreen}>
                  <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                  <Text style={styles.statusTextGreen}>Вкл</Text>
                </View>
              ) : (
                <TouchableOpacity style={styles.actionBtn} onPress={() => handleRequest('media')}>
                  <Text style={styles.actionBtnText}>Включить</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* 4. Геолокация */}
            <View style={[styles.card, { backgroundColor: isDark ? '#1E293B' : '#F8FAFC', borderColor: isDark ? '#334155' : '#E2E8F0' }]}>
              <View style={[styles.iconCircle, permissions.location ? styles.iconGreen : styles.iconRed]}>
                <Ionicons name="location" size={22} color={permissions.location ? '#10B981' : '#EF4444'} />
              </View>
              <View style={styles.cardContent}>
                <Text style={[styles.cardTitle, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>
                  Геолокация (GPS)
                </Text>
                <Text style={styles.cardDesc}>
                  Автоматическое определение улицы и номера дома при подаче заявок
                </Text>
              </View>
              {permissions.location ? (
                <View style={styles.statusBadgeGreen}>
                  <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                  <Text style={styles.statusTextGreen}>Вкл</Text>
                </View>
              ) : (
                <TouchableOpacity style={styles.actionBtn} onPress={() => handleRequest('location')}>
                  <Text style={styles.actionBtnText}>Включить</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* 5. Фоновый режим и оптимизация батареи */}
            <View style={[styles.card, styles.batteryCard, { backgroundColor: isDark ? '#1E293B90' : '#FEF3C7' }]}>
              <View style={[styles.iconCircle, { backgroundColor: '#F59E0B20' }]}>
                <Ionicons name="battery-charging" size={22} color="#F59E0B" />
              </View>
              <View style={styles.cardContent}>
                <Text style={[styles.cardTitle, { color: isDark ? '#FCD34D' : '#92400E' }]}>
                  Фоновый режим (Батарея)
                </Text>
                <Text style={[styles.cardDesc, { color: isDark ? '#94A3B8' : '#78350F' }]}>
                  Отключите ограничения батареи, чтобы получать push-уведомления даже когда приложение закрыто
                </Text>
              </View>
              <TouchableOpacity style={styles.batteryBtn} onPress={openUserBatteryOptimizationSettings}>
                <Text style={styles.batteryBtnText}>Настроить</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>

          {/* Подвал */}
          <View style={[styles.footer, { borderTopColor: isDark ? '#1E293B' : '#F1F5F9' }]}>
            <TouchableOpacity style={[styles.settingsBtn, { backgroundColor: isDark ? '#1E293B' : '#F1F5F9', borderColor: isDark ? '#334155' : '#CBD5E1' }]} onPress={openUserAppSettings}>
              <Ionicons name="settings-outline" size={18} color={isDark ? '#E2E8F0' : '#334155'} />
              <Text style={[styles.settingsBtnText, { color: isDark ? '#E2E8F0' : '#334155' }]}>
                Настройки телефона
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.doneBtn} onPress={onClose}>
              <Text style={styles.doneBtnText}>Готово</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  container: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    borderWidth: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
  },
  headerIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  headerSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    padding: 8,
  },
  loadingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  loadingText: {
    color: '#94A3B8',
    fontSize: 12,
    marginLeft: 8,
  },
  scroll: {
    padding: 16,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
  },
  batteryCard: {
    borderColor: '#F59E0B60',
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  iconGreen: {
    backgroundColor: '#10B98120',
  },
  iconRed: {
    backgroundColor: '#EF444420',
  },
  cardContent: {
    flex: 1,
    marginRight: 8,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  cardDesc: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  statusBadgeGreen: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10B98120',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  statusTextGreen: {
    color: '#10B981',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 4,
  },
  actionBtn: {
    backgroundColor: '#10B981',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  batteryBtn: {
    backgroundColor: '#F59E0B25',
    borderWidth: 1,
    borderColor: '#F59E0B',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  batteryBtnText: {
    color: '#F59E0B',
    fontSize: 13,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    gap: 12,
  },
  settingsBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 14,
    borderWidth: 1,
  },
  settingsBtnText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  doneBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10B981',
    borderRadius: 12,
    paddingVertical: 14,
  },
  doneBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
