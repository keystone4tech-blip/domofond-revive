// mobile/src/components/UpdateCheckerModal.tsx
// Компонент автоматической проверки и уведомления об обновлениях мобильного приложения «Домофондар»
// Позволяет обновлять APK поверх установленного приложения в один клик без перехода на сторонние ресурсы

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Linking,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '@/api/client';
import { APP_VERSION } from '@/config/constants';

interface VersionInfo {
  latestVersion: string;
  versionCode: number;
  downloadUrl: string;
  fallbackDownloadUrl?: string;
  releaseNotes: string[];
  isMandatory: boolean;
}

/**
 * Сравнивает две семантические версии (например: "1.0.1" > "1.0.0")
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
  const [visible, setVisible] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<VersionInfo | null>(null);

  useEffect(() => {
    // Выполняем проверку обновлений при старте приложения
    checkAppUpdate();
  }, []);

  const checkAppUpdate = async () => {
    try {
      console.log(`[UpdateChecker] Текущая версия: v${APP_VERSION}. Проверка обновлений на сервере...`);
      const response = await apiClient.get<VersionInfo>('/api/app/version');

      if (response.data && response.data.latestVersion) {
        const info = response.data;
        const isNewer = compareVersions(info.latestVersion, APP_VERSION) > 0;

        console.log(`[UpdateChecker] Сервер вернул версию: v${info.latestVersion}. Есть обновление: ${isNewer}`);

        if (isNewer) {
          setUpdateInfo(info);
          setVisible(true);
        }
      }
    } catch (err) {
      console.warn('[UpdateChecker] Не удалось проверить обновления:', err);
    }
  };

  const handleUpdate = async () => {
    if (!updateInfo) return;

    const url = updateInfo.downloadUrl || updateInfo.fallbackDownloadUrl;
    if (url) {
      console.log('[UpdateChecker] Открытие ссылки на скачивание обновления APK:', url);
      try {
        await Linking.openURL(url);
      } catch (e) {
        console.error('[UpdateChecker] Ошибка открытия ссылки:', e);
        if (updateInfo.fallbackDownloadUrl) {
          await Linking.openURL(updateInfo.fallbackDownloadUrl);
        }
      }
    }

    // Если обновление не обязательное, скрываем модалку после перехода
    if (!updateInfo.isMandatory) {
      setVisible(false);
    }
  };

  const handleDismiss = () => {
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
        <View style={styles.card}>
          {/* Иконка обновления */}
          <View style={styles.iconCircle}>
            <Ionicons name="sparkles" size={32} color="#10B981" />
          </View>

          {/* Заголовок */}
          <Text style={styles.title}>Доступно обновление</Text>
          <View style={styles.badgeRow}>
            <View style={styles.versionBadge}>
              <Text style={styles.versionBadgeText}>Версия {updateInfo.latestVersion}</Text>
            </View>
            <Text style={styles.currentVersionText}>У вас: v{APP_VERSION}</Text>
          </View>

          <Text style={styles.subtitle}>
            Мы подготовили важное улучшение для стабильной работы и безопасности приложения:
          </Text>

          {/* Список изменений */}
          <ScrollView style={styles.notesContainer}>
            {updateInfo.releaseNotes?.map((note, index) => (
              <View key={index} style={styles.noteItem}>
                <Ionicons name="checkmark-circle" size={18} color="#10B981" style={styles.noteIcon} />
                <Text style={styles.noteText}>{note}</Text>
              </View>
            ))}
          </ScrollView>

          {/* Кнопки действий */}
          <View style={styles.actionsContainer}>
            <TouchableOpacity style={styles.updateButton} onPress={handleUpdate} activeOpacity={0.85}>
              <Ionicons name="cloud-download-outline" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.updateButtonText}>Обновить сейчас</Text>
            </TouchableOpacity>

            {!updateInfo.isMandatory && (
              <TouchableOpacity style={styles.laterButton} onPress={handleDismiss} activeOpacity={0.7}>
                <Text style={styles.laterButtonText}>Напомнить позже</Text>
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
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 10,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#F8FAFC',
    textAlign: 'center',
    marginBottom: 8,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  versionBadge: {
    backgroundColor: '#10B981',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginRight: 8,
  },
  versionBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  currentVersionText: {
    color: '#64748B',
    fontSize: 12,
  },
  subtitle: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },
  notesContainer: {
    maxHeight: 160,
    width: '100%',
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    borderRadius: 14,
    padding: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.08)',
  },
  noteItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  noteIcon: {
    marginTop: 2,
    marginRight: 8,
  },
  noteText: {
    fontSize: 13,
    color: '#E2E8F0',
    flex: 1,
    lineHeight: 18,
  },
  actionsContainer: {
    width: '100%',
  },
  updateButton: {
    backgroundColor: '#10B981',
    borderRadius: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  updateButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
  laterButton: {
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  laterButtonText: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '500',
  },
});
