// mobile/src/components/UpdateCheckerModal.tsx
// Компонент автоматической проверки и уведомления об обновлениях мобильного приложения «Домофондар»
// Реализует чистое и лаконичное окно уведомления и прямое скачивание APK с официального сайта компании

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '@/api/client';
import { APP_VERSION, APP_DOWNLOAD_URL } from '@/config/constants';
import { useAppTheme } from '@/theme';

interface VersionInfo {
  latestVersion: string;
  versionCode: number;
  downloadUrl: string;
  fallbackDownloadUrl?: string;
  releaseNotes?: string[];
  isMandatory?: boolean;
}

/**
 * Сравнивает две семантические версии (например: "1.1.1" > "1.1.0")
 * Возвращает 1 если v1 > v2, -1 если v1 < v2, 0 если равны
 */
function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.split('.').map((p) => parseInt(p, 10) || 0);
  const parts2 = v2.split('.').map((p) => parseInt(p, 10) || 0);
  const maxLength = Math.max(parts1.length, parts2.length);

  for (let i = 0; i < maxLength; i++) {
    const num1 = parts1[i] || 0;
    const num2 = parts2[i] || 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  return 0;
}

export function UpdateCheckerModal() {
  const { colors, isDark } = useAppTheme();
  const [visible, setVisible] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<VersionInfo | null>(null);

  useEffect(() => {
    // Выполняем проверку наличия обновлений при запуске приложения
    checkAppUpdate();
  }, []);

  const checkAppUpdate = async () => {
    try {
      console.log(`[UpdateChecker] Текущая установленная версия: v${APP_VERSION}. Проверяем сервер...`);
      const response = await apiClient.get<VersionInfo>('/api/app/version');

      if (response.data && response.data.latestVersion) {
        const info = response.data;
        const isNewer = compareVersions(info.latestVersion, APP_VERSION) > 0;

        console.log(`[UpdateChecker] Сервер вернул версию: v${info.latestVersion}. Требуется обновление: ${isNewer}`);

        if (isNewer) {
          setUpdateInfo(info);
          setVisible(true);
        }
      }
    } catch (err) {
      console.warn('[UpdateChecker] Не удалось проверить обновления на сервере:', err);
    }
  };

  /**
   * Обработчик нажатия кнопки «Обновить»
   * Гарантирует прямое скачивание APK с официального сайта компании
   */
  const handleUpdate = async () => {
    // В приоритете используем прямую ссылку на APK с нашего сайта
    const targetUrl = updateInfo?.downloadUrl?.includes('домофондар') || updateInfo?.downloadUrl?.includes('xn--80aha5afebav9a')
      ? updateInfo.downloadUrl
      : APP_DOWNLOAD_URL;

    console.log('[UpdateChecker] Запуск прямого скачивания APK с официального сайта:', targetUrl);

    try {
      await Linking.openURL(targetUrl);
    } catch (e) {
      console.error('[UpdateChecker] Ошибка открытия прямой ссылки:', e);
      // Если возникла непредвиденная ошибка, пробуем запасной адрес
      if (updateInfo?.downloadUrl) {
        await Linking.openURL(updateInfo.downloadUrl);
      }
    }

    // Если обновление не принудительное, закрываем окно
    if (!updateInfo?.isMandatory) {
      setVisible(false);
    }
  };

  /**
   * Закрытие окна по кнопке «Позже»
   */
  const handleDismiss = () => {
    console.log('[UpdateChecker] Пользователь отложил обновление');
    setVisible(false);
  };

  if (!visible || !updateInfo) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (!updateInfo.isMandatory) handleDismiss();
      }}
    >
      <View style={styles.overlay}>
        <View style={[
          styles.card,
          {
            backgroundColor: isDark ? '#161922' : '#FFFFFF',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
          }
        ]}>
          {/* Аккуратная иконка обновления */}
          <View style={[
            styles.iconCircle,
            {
              backgroundColor: isDark ? 'rgba(78, 222, 163, 0.12)' : 'rgba(16, 185, 129, 0.1)',
              borderColor: isDark ? 'rgba(78, 222, 163, 0.25)' : 'rgba(16, 185, 129, 0.2)',
            }
          ]}>
            <Ionicons name="cloud-download-outline" size={32} color={isDark ? '#4EDE93' : '#10B981'} />
          </View>

          {/* Лаконичный заголовок */}
          <Text style={[styles.title, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
            Доступно обновление
          </Text>

          {/* Простое понятное описание без лишних списков */}
          <Text style={[styles.subtitle, { color: isDark ? '#94A3B8' : '#64748B' }]}>
            Пожалуйста, обновите приложение до актуальной версии {updateInfo.latestVersion} для стабильной и быстрой работы сервисов.
          </Text>

          {/* Блок кнопок */}
          <View style={styles.actionsContainer}>
            <TouchableOpacity
              style={[
                styles.updateButton,
                { backgroundColor: isDark ? '#4EDE93' : '#10B981' }
              ]}
              onPress={handleUpdate}
              activeOpacity={0.85}
            >
              <Ionicons name="download-outline" size={20} color={isDark ? '#081510' : '#FFFFFF'} style={{ marginRight: 8 }} />
              <Text style={[
                styles.updateButtonText,
                { color: isDark ? '#081510' : '#FFFFFF' }
              ]}>
                Обновить
              </Text>
            </TouchableOpacity>

            {!updateInfo.isMandatory && (
              <TouchableOpacity
                style={styles.laterButton}
                onPress={handleDismiss}
                activeOpacity={0.7}
              >
                <Text style={[styles.laterButtonText, { color: isDark ? '#828C9E' : '#64748B' }]}>
                  Позже
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(7, 10, 16, 0.78)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 20,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 12,
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 10,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
    paddingHorizontal: 4,
  },
  actionsContainer: {
    width: '100%',
  },
  updateButton: {
    borderRadius: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  updateButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  laterButton: {
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  laterButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
