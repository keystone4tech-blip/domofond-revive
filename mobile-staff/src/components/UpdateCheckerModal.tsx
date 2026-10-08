// mobile-staff/src/components/UpdateCheckerModal.tsx
// Компонент автоматической проверки, фонового скачивания и установки обновлений приложения «Офис Работа»
// Реализует:
// 1. Проверку версий через защищенный API бэкенда (/api/app/version-staff)
// 2. Фоновое скачивание APK прямо внутри приложения с индикатором прогресса и МБ
// 3. Запуск системного мастера установки пакетов Android (Package Installer) через FileProvider
// 4. Резервную прямую загрузку при ограничениях ОС устройства

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Linking,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as IntentLauncher from 'expo-intent-launcher';
import { staffApiClient } from '../api/client';
import { APP_VERSION, APP_DOWNLOAD_URL, APP_NAME } from '../config/constants';

// Структура ответа API проверки версий
export interface StaffVersionInfo {
  latestVersion: string;
  versionCode: number;
  downloadUrl: string;
  directMediaUrl?: string;
  fallbackDownloadUrl?: string;
  releaseNotes?: string[];
  isMandatory?: boolean;
}

/**
 * Сравнивает две семантические версии (например: "1.0.1" > "1.0.0")
 * Возвращает 1 если v1 > v2, -1 если v1 < v2, 0 если равны
 */
export function compareVersions(v1: string, v2: string): number {
  const parts1 = (v1 || '').split('.').map((p) => parseInt(p, 10) || 0);
  const parts2 = (v2 || '').split('.').map((p) => parseInt(p, 10) || 0);
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
  const [updateInfo, setUpdateInfo] = useState<StaffVersionInfo | null>(null);

  // Состояния фоновой загрузки файла APK
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0); // 0..100%
  const [downloadBytesText, setDownloadBytesText] = useState('');
  const [downloadError, setDownloadError] = useState<string | null>(null);

  // Ссылка на объект загрузки для возможности отмены
  const downloadTaskRef = useRef<FileSystem.DownloadResumable | null>(null);
  // Аппаратный мьютекс от повторных нажатий
  const isDownloadingRef = useRef(false);

  useEffect(() => {
    // Выполняем проверку наличия обновлений при запуске приложения
    checkStaffUpdate();
  }, []);

  /**
   * Запрос к серверу для проверки актуальной версии
   */
  const checkStaffUpdate = async () => {
    try {
      console.log(`[StaffUpdateChecker] Текущая версия: v${APP_VERSION}. Проверяем сервер...`);
      
      // Запрашиваем выделенный эндпоинт версии приложения для персонала
      let response = await staffApiClient.get<StaffVersionInfo>('/api/app/version-staff').catch(async () => {
        // Резервный запрос с параметром app=staff
        return await staffApiClient.get<StaffVersionInfo>('/api/app/version?app=staff');
      });

      if (response && response.data && response.data.latestVersion) {
        const info = response.data;
        const isNewer = compareVersions(info.latestVersion, APP_VERSION) > 0;

        console.log(`[StaffUpdateChecker] Ответ сервера: v${info.latestVersion}. Требуется обновление: ${isNewer}`);

        if (isNewer) {
          setUpdateInfo(info);
          setVisible(true);
        }
      }
    } catch (err) {
      console.warn('[StaffUpdateChecker] Ошибка при проверке обновлений на сервере:', err);
    }
  };

  /**
   * Фоновое скачивание APK прямо в приложении с индикацией прогресса
   */
  const startNativeDownload = async () => {
    if (isDownloadingRef.current) {
      console.log('[StaffUpdateChecker] Скачивание уже выполняется');
      return;
    }
    isDownloadingRef.current = true;

    const targetUrl = updateInfo?.downloadUrl || APP_DOWNLOAD_URL;
    console.log('[StaffUpdateChecker] Старт скачивания APK по адресу:', targetUrl);

    setIsDownloading(true);
    setDownloadProgress(0);
    setDownloadBytesText('Подготовка к загрузке...');
    setDownloadError(null);

    // Локальный путь сохранения APK в файловой системе устройства
    const targetFilePath = `${FileSystem.cacheDirectory || FileSystem.documentDirectory}officework_${updateInfo?.latestVersion || 'latest'}.apk`;

    // 1. Принудительно очищаем старый локальный APK из кэша
    try {
      await FileSystem.deleteAsync(targetFilePath, { idempotent: true }).catch(() => {});
      console.log('[StaffUpdateChecker] Кэш APK очищен перед скачиванием');
    } catch (checkErr) {
      console.log('[StaffUpdateChecker] Очистка кэша APK:', checkErr);
    }

    try {
      const freshDownloadUrl = targetUrl.includes('?') ? `${targetUrl}&t=${Date.now()}` : `${targetUrl}?t=${Date.now()}`;
      const downloadResumable = FileSystem.createDownloadResumable(
        freshDownloadUrl,
        targetFilePath,
        {},
        (data) => {
          if (data.totalBytesExpectedToWrite > 0) {
            const fraction = data.totalBytesWritten / data.totalBytesExpectedToWrite;
            const percent = Math.min(100, Math.max(0, Math.round(fraction * 100)));
            setDownloadProgress(percent);

            const writtenMb = (data.totalBytesWritten / (1024 * 1024)).toFixed(1);
            const totalMb = (data.totalBytesExpectedToWrite / (1024 * 1024)).toFixed(1);
            setDownloadBytesText(`${writtenMb} МБ / ${totalMb} МБ`);
          } else {
            const writtenMb = (data.totalBytesWritten / (1024 * 1024)).toFixed(1);
            setDownloadBytesText(`${writtenMb} МБ`);
          }
        }
      );

      downloadTaskRef.current = downloadResumable;

      const result = await downloadResumable.downloadAsync();
      console.log('[StaffUpdateChecker] Загрузка APK завершена:', result?.uri);

      if (result && result.uri) {
        setDownloadProgress(100);
        setDownloadBytesText('Готово! Запуск установщика...');
        await launchApkInstaller(result.uri);
      } else {
        throw new Error('Файл не был сохранен на устройстве');
      }
    } catch (err: any) {
      console.error('[StaffUpdateChecker] Сбой при нативном скачивании APK:', err);
      setDownloadError('Не удалось автоматически загрузить файл. Попробуйте скачать через браузер.');
      setIsDownloading(false);
      isDownloadingRef.current = false;
    }
  };

  /**
   * Открытие скачанного файла через нативный установщик пакетов Android (Package Installer)
   */
  const launchApkInstaller = async (fileUri: string) => {
    try {
      console.log('[StaffUpdateChecker] Вызов системного установщика для:', fileUri);

      if (Platform.OS === 'android') {
        const contentUri = await FileSystem.getContentUriAsync(fileUri);
        console.log('[StaffUpdateChecker] Сформирован Android Content URI:', contentUri);

        await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
          data: contentUri,
          flags: 268435457, // FLAG_GRANT_READ_URI_PERMISSION + FLAG_ACTIVITY_NEW_TASK
          type: 'application/vnd.android.package-archive',
        });
        console.log('[StaffUpdateChecker] Установщик пакетов Android запущен');
        setVisible(false);
      } else {
        const isSharingAvailable = await Sharing.isAvailableAsync();
        if (isSharingAvailable) {
          await Sharing.shareAsync(fileUri, {
            mimeType: 'application/vnd.android.package-archive',
            dialogTitle: `Установка обновления ${APP_NAME}`,
          });
        } else {
          await Linking.openURL(fileUri);
        }
        setVisible(false);
      }
    } catch (openErr: any) {
      console.warn('[StaffUpdateChecker] Не удалось вызвать PackageInstaller:', openErr);
      try {
        await FileSystem.deleteAsync(fileUri, { idempotent: true });
      } catch {}
      await handleFallbackBrowserDownload();
    } finally {
      setIsDownloading(false);
      isDownloadingRef.current = false;
    }
  };

  /**
   * Резервное скачивание через внешний браузер
   */
  const handleFallbackBrowserDownload = async () => {
    const targetUrl = updateInfo?.downloadUrl || APP_DOWNLOAD_URL;
    console.log('[StaffUpdateChecker] Резервный запуск через браузер:', targetUrl);
    try {
      await Linking.openURL(targetUrl);
    } catch (linkErr) {
      if (updateInfo?.fallbackDownloadUrl) {
        await Linking.openURL(updateInfo.fallbackDownloadUrl).catch(() => {});
      }
    }
    setVisible(false);
  };

  /**
   * Отмена загрузки
   */
  const handleCancelDownload = async () => {
    try {
      if (downloadTaskRef.current) {
        await downloadTaskRef.current.pauseAsync();
      }
    } catch {}
    setIsDownloading(false);
    isDownloadingRef.current = false;
    setDownloadProgress(0);
    setDownloadBytesText('');
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
        if (!updateInfo.isMandatory && !isDownloading) {
          setVisible(false);
        }
      }}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Иконка и заголовок */}
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <Ionicons name="cloud-download-outline" size={32} color="#00F0FF" />
            </View>
            <Text style={styles.title}>Доступно обновление</Text>
            <Text style={styles.subtitle}>
              {APP_NAME} v{updateInfo.latestVersion}
            </Text>
            <Text style={styles.currentVersion}>
              Текущая версия на устройстве: v{APP_VERSION}
            </Text>
          </View>

          {/* Список изменений в релизе */}
          {updateInfo.releaseNotes && updateInfo.releaseNotes.length > 0 && (
            <View style={styles.notesContainer}>
              <Text style={styles.notesTitle}>Что нового в этой версии:</Text>
              {updateInfo.releaseNotes.map((note, idx) => (
                <View key={idx} style={styles.noteRow}>
                  <Ionicons name="checkmark-circle" size={16} color="#10B981" style={{ marginTop: 2, marginRight: 8 }} />
                  <Text style={styles.noteText}>{note}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Индикатор загрузки с прогресс-баром */}
          {isDownloading ? (
            <View style={styles.downloadContainer}>
              <View style={styles.progressHeader}>
                <Text style={styles.progressLabel}>Загрузка файла обновления...</Text>
                <Text style={styles.progressPercent}>{downloadProgress}%</Text>
              </View>

              {/* Полоса прогресса */}
              <View style={styles.progressBarTrack}>
                <View style={[styles.progressBarFill, { width: `${downloadProgress}%` }]} />
              </View>

              <Text style={styles.progressBytes}>{downloadBytesText}</Text>

              {downloadError ? (
                <Text style={styles.errorText}>{downloadError}</Text>
              ) : null}

              <TouchableOpacity
                style={styles.cancelDownloadBtn}
                onPress={handleCancelDownload}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelDownloadText}>Отменить загрузку</Text>
              </TouchableOpacity>
            </View>
          ) : (
            /* Кнопки действий при нормальном показе */
            <View style={styles.actions}>
              {downloadError ? (
                <Text style={styles.errorText}>{downloadError}</Text>
              ) : null}

              {/* Основная кнопка — Нативное скачивание и установка прямо в приложении */}
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={startNativeDownload}
                activeOpacity={0.8}
              >
                <Ionicons name="download-outline" size={20} color="#0B132B" style={{ marginRight: 8 }} />
                <Text style={styles.primaryButtonText}>Обновить приложение</Text>
              </TouchableOpacity>

              {/* Резервная кнопка — Прямое скачивание через веб-браузер */}
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={handleFallbackBrowserDownload}
                activeOpacity={0.7}
              >
                <Ionicons name="globe-outline" size={16} color="#94A3B8" style={{ marginRight: 6 }} />
                <Text style={styles.secondaryButtonText}>Скачать через браузер</Text>
              </TouchableOpacity>

              {/* Кнопка "Напомнить позже" (если обновление не критическое) */}
              {!updateInfo.isMandatory && (
                <TouchableOpacity
                  style={styles.laterButton}
                  onPress={() => setVisible(false)}
                  activeOpacity={0.6}
                >
                  <Text style={styles.laterButtonText}>Напомнить позже</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 10, 20, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#111D4A',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(0, 240, 255, 0.25)',
    shadowColor: '#00F0FF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  header: {
    alignItems: 'center',
    marginBottom: 16,
  },
  iconContainer: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(0, 240, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(0, 240, 255, 0.3)',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#00F0FF',
    marginTop: 4,
    textAlign: 'center',
  },
  currentVersion: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 4,
  },
  notesContainer: {
    backgroundColor: 'rgba(11, 19, 43, 0.7)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  notesTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#E2E8F0',
    marginBottom: 8,
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  noteText: {
    fontSize: 13,
    color: '#CBD5E1',
    lineHeight: 18,
    flex: 1,
  },
  downloadContainer: {
    backgroundColor: 'rgba(11, 19, 43, 0.8)',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 240, 255, 0.2)',
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#E2E8F0',
  },
  progressPercent: {
    fontSize: 15,
    fontWeight: '800',
    color: '#00F0FF',
  },
  progressBarTrack: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#00F0FF',
    borderRadius: 4,
  },
  progressBytes: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'right',
    marginBottom: 10,
  },
  cancelDownloadBtn: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  cancelDownloadText: {
    fontSize: 13,
    color: '#EF4444',
    fontWeight: '600',
  },
  actions: {
    gap: 10,
  },
  primaryButton: {
    backgroundColor: '#00F0FF',
    borderRadius: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#00F0FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0B132B',
  },
  secondaryButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  secondaryButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94A3B8',
  },
  laterButton: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  laterButtonText: {
    fontSize: 13,
    color: '#64748B',
  },
  errorText: {
    fontSize: 12,
    color: '#EF4444',
    textAlign: 'center',
    marginBottom: 8,
  },
});
