/**
 * mobile-staff/src/components/PermissionsCenterModal.tsx
 * Интерактивный Центр разрешений и фоновой работы для мастеров «Офис Работа»
 * Отображает статус каждого разрешения с цветовой индикацией (зеленый/красный)
 * Позволяет в один клик запросить доступ или перейти в системные настройки Android/iOS
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
  checkAllStaffPermissions,
  requestLocationPermission,
  requestCameraPermission,
  requestMediaLibraryPermission,
  requestNotificationsPermission,
  openAppSettings,
  openBatteryOptimizationSettings,
  PermissionStatusSummary,
} from '../services/permissionsService';

interface PermissionsCenterModalProps {
  visible: boolean;
  onClose: () => void;
}

export function PermissionsCenterModal({ visible, onClose }: PermissionsCenterModalProps) {
  const [loading, setLoading] = useState(false);
  const [permissions, setPermissions] = useState<PermissionStatusSummary>({
    location: false,
    backgroundLocation: false,
    camera: false,
    mediaLibrary: false,
    notifications: false,
    allEssentialGranted: false,
  });

  useEffect(() => {
    if (visible) {
      loadPermissions();
    }
  }, [visible]);

  const loadPermissions = async () => {
    setLoading(true);
    const status = await checkAllStaffPermissions();
    setPermissions(status);
    setLoading(false);
  };

  const handleRequest = async (type: 'location' | 'camera' | 'media' | 'notifications') => {
    setLoading(true);
    if (type === 'location') await requestLocationPermission();
    if (type === 'camera') await requestCameraPermission();
    if (type === 'media') await requestMediaLibraryPermission();
    if (type === 'notifications') await requestNotificationsPermission();
    await loadPermissions();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Шапка модального окна */}
          <View style={styles.header}>
            <View style={styles.headerIconWrapper}>
              <Ionicons name="shield-checkmark" size={28} color="#3B82F6" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>Разрешения и фоновая работа</Text>
              <Text style={styles.headerSubtitle}>
                Необходимы для стабильной работы мастера на линии
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          {/* Индикатор загрузки */}
          {loading && (
            <View style={styles.loadingBanner}>
              <ActivityIndicator size="small" color="#3B82F6" />
              <Text style={styles.loadingText}>Проверка системных доступов...</Text>
            </View>
          )}

          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            {/* 1. Геолокация */}
            <View style={styles.card}>
              <View style={[styles.iconCircle, permissions.location ? styles.iconGreen : styles.iconRed]}>
                <Ionicons name="location" size={22} color={permissions.location ? '#10B981' : '#EF4444'} />
              </View>
              <View style={styles.cardContent}>
                <Text style={styles.cardTitle}>Геолокация (GPS)</Text>
                <Text style={styles.cardDesc}>
                  Построение маршрутов к домам МКД и подтверждение прибытия на наряд
                </Text>
              </View>
              {permissions.location ? (
                <View style={styles.statusBadgeGreen}>
                  <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                  <Text style={styles.statusTextGreen}>Вкл</Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => handleRequest('location')}
                >
                  <Text style={styles.actionBtnText}>Включить</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* 2. Камера */}
            <View style={styles.card}>
              <View style={[styles.iconCircle, permissions.camera ? styles.iconGreen : styles.iconRed]}>
                <Ionicons name="camera" size={22} color={permissions.camera ? '#10B981' : '#EF4444'} />
              </View>
              <View style={styles.cardContent}>
                <Text style={styles.cardTitle}>Камера</Text>
                <Text style={styles.cardDesc}>
                  Фотофиксация оборудования «до/после» и сканирование документов
                </Text>
              </View>
              {permissions.camera ? (
                <View style={styles.statusBadgeGreen}>
                  <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                  <Text style={styles.statusTextGreen}>Вкл</Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => handleRequest('camera')}
                >
                  <Text style={styles.actionBtnText}>Включить</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* 3. Медиатека (Фото, видео и файлы) */}
            <View style={styles.card}>
              <View style={[styles.iconCircle, permissions.mediaLibrary ? styles.iconGreen : styles.iconRed]}>
                <Ionicons name="images" size={22} color={permissions.mediaLibrary ? '#10B981' : '#EF4444'} />
              </View>
              <View style={styles.cardContent}>
                <Text style={styles.cardTitle}>Фото, видео и файлы</Text>
                <Text style={styles.cardDesc}>
                  Прикрепление видео поломок, выбор фото из галереи и сохранение актов
                </Text>
              </View>
              {permissions.mediaLibrary ? (
                <View style={styles.statusBadgeGreen}>
                  <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                  <Text style={styles.statusTextGreen}>Вкл</Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => handleRequest('media')}
                >
                  <Text style={styles.actionBtnText}>Включить</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* 4. Уведомления */}
            <View style={styles.card}>
              <View style={[styles.iconCircle, permissions.notifications ? styles.iconGreen : styles.iconRed]}>
                <Ionicons name="notifications" size={22} color={permissions.notifications ? '#10B981' : '#EF4444'} />
              </View>
              <View style={styles.cardContent}>
                <Text style={styles.cardTitle}>Push-уведомления</Text>
                <Text style={styles.cardDesc}>
                  Оповещения о новых нарядах, аварийных вызовах и сообщениях диспетчера
                </Text>
              </View>
              {permissions.notifications ? (
                <View style={styles.statusBadgeGreen}>
                  <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                  <Text style={styles.statusTextGreen}>Вкл</Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => handleRequest('notifications')}
                >
                  <Text style={styles.actionBtnText}>Включить</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* 5. Фоновый режим и оптимизация батареи */}
            <View style={[styles.card, styles.batteryCard]}>
              <View style={[styles.iconCircle, { backgroundColor: '#F59E0B20' }]}>
                <Ionicons name="battery-charging" size={22} color="#F59E0B" />
              </View>
              <View style={styles.cardContent}>
                <Text style={[styles.cardTitle, { color: '#FCD34D' }]}>
                  Работа в фоновом режиме (Батарея)
                </Text>
                <Text style={styles.cardDesc}>
                  Снимите ограничения батареи (Xiaomi, Samsung, Huawei), чтобы получать наряды, даже когда приложение выключено
                </Text>
              </View>
              <TouchableOpacity
                style={styles.batteryBtn}
                onPress={openBatteryOptimizationSettings}
              >
                <Text style={styles.batteryBtnText}>Настроить</Text>
              </TouchableOpacity>
            </View>

            {/* Подсказка */}
            <View style={styles.infoBox}>
              <Ionicons name="information-circle-outline" size={20} color="#94A3B8" />
              <Text style={styles.infoText}>
                Если переключатель не нажимается или был заблокирован ранее, перейдите в системные настройки телефона.
              </Text>
            </View>
          </ScrollView>

          {/* Подвал с кнопками */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.settingsBtn} onPress={openAppSettings}>
              <Ionicons name="settings-outline" size={18} color="#94A3B8" />
              <Text style={styles.settingsBtnText}>Настройки телефона</Text>
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
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  headerIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerTitle: {
    color: '#F8FAFC',
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
    backgroundColor: '#1E293B',
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
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  batteryCard: {
    borderColor: '#B4530940',
    backgroundColor: '#1E293B90',
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
    color: '#F8FAFC',
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
    backgroundColor: '#3B82F6',
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
    color: '#FCD34D',
    fontSize: 13,
    fontWeight: '600',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B60',
    borderRadius: 12,
    padding: 12,
    marginTop: 4,
    marginBottom: 16,
  },
  infoText: {
    color: '#94A3B8',
    fontSize: 12,
    marginLeft: 8,
    flex: 1,
    lineHeight: 16,
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
    gap: 12,
  },
  settingsBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  settingsBtnText: {
    color: '#E2E8F0',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  doneBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3B82F6',
    borderRadius: 12,
    paddingVertical: 14,
  },
  doneBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
