// mobile/src/components/UpdateCheckerModal.tsx
// Компонент автоматической проверки, фонового скачивания и установки обновлений приложения «Домофондар»
// Реализует:
// 1. Проверку версий через защищенный API бэкенда
// 2. Скачивание APK прямо внутри приложения с отображением прогресс-бара и процентов
// 3. Запуск системного мастера установки пакетов без ошибки 404 и лишних переходов
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
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
 * Сравнивает две семантические версии (например: "1.1.2" > "1.1.1")
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

  // Состояния фоновой загрузки файла APK
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0); // 0..100%
  const [downloadBytesText, setDownloadBytesText] = useState('');
  const [downloadError, setDownloadError] = useState<string | null>(null);

  // Ссылка на объект загрузки для возможности отмены
  const downloadTaskRef = useRef<FileSystem.DownloadResumable | null>(null);
  // Аппаратный мьютекс от дребезга нажатий (исключает 2-3 параллельных скачивания при повторных кликах)
  const isDownloadingRef = useRef(false);

  useEffect(() => {
    // Выполняем проверку наличия обновлений при запуске приложения
    checkAppUpdate();
  }, []);

  /**
   * Запрос к серверу для проверки актуальной версии
   */
  const checkAppUpdate = async () => {
    try {
      console.log(`[UpdateChecker] Текущая версия приложения: v${APP_VERSION}. Проверяем сервер...`);
      const response = await apiClient.get<VersionInfo>('/api/app/version');

      if (response.data && response.data.latestVersion) {
        const info = response.data;
        const isNewer = compareVersions(info.latestVersion, APP_VERSION) > 0;

        console.log(`[UpdateChecker] Ответ сервера: v${info.latestVersion}. Требуется обновление: ${isNewer}`);

        if (isNewer) {
          setUpdateInfo(info);
          setVisible(true);
        }
      }
    } catch (err) {
      console.warn('[UpdateChecker] Ошибка при проверке обновлений на сервере:', err);
    }
  };

  /**
   * Фоновое скачивание APK прямо в приложении с индикацией прогресса
   */
  const startNativeDownload = async () => {
    // Строгая блокировка от повторных параллельных вызовов
    if (isDownloadingRef.current) {
      console.log('[UpdateChecker] Скачивание уже выполняется, повторный клик отклонён');
      return;
    }
    isDownloadingRef.current = true;

    // Целевой URL для загрузки (гарантированный бэкенд эндпоинт без перехвата Service Worker)
    const targetUrl = updateInfo?.downloadUrl || APP_DOWNLOAD_URL;

    console.log('[UpdateChecker] Старт нативного скачивания APK по адресу:', targetUrl);
    setIsDownloading(true);
    setDownloadProgress(0);
    setDownloadBytesText('Подготовка к загрузке...');
    setDownloadError(null);

    // Локальный путь сохранения APK в файловой системе устройства
    const targetFilePath = `${FileSystem.cacheDirectory || FileSystem.documentDirectory}domofondar_${updateInfo?.latestVersion || 'latest'}.apk`;

    // 1. Проверяем, возможно файл этой версии уже полностью скачан
    try {
      const existing = await FileSystem.getInfoAsync(targetFilePath);
      if (existing.exists && existing.size && existing.size > 20 * 1024 * 1024) {
        console.log('[UpdateChecker] Файл обновления уже сохранен на диске:', targetFilePath);
        setDownloadProgress(100);
        setDownloadBytesText('Файл готов к установке');
        await launchApkInstaller(targetFilePath);
        return;
      }
    } catch (checkErr) {
      console.log('[UpdateChecker] Проверка имеющегося файла:', checkErr);
    }

    try {
      const downloadResumable = FileSystem.createDownloadResumable(
        targetUrl,
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
      console.log('[UpdateChecker] Загрузка файла успешно завершена:', result?.uri);

      if (result && result.uri) {
        setDownloadProgress(100);
        setDownloadBytesText('Готово! Запуск установщика...');

        // Запуск установки APK через системный диалог Android
        await launchApkInstaller(result.uri);
      } else {
        throw new Error('Файл не был сохранен на устройстве');
      }
    } catch (err: any) {
      console.error('[UpdateChecker] Сбой при нативном скачивании APK:', err);
      setDownloadError('Не удалось автоматически загрузить файл. Попробуйте скачать через браузер.');
      setIsDownloading(false);
      isDownloadingRef.current = false;
    }
  };

  /**
   * Открытие скачанного файла через установщик пакетов Android
   */
  const launchApkInstaller = async (fileUri: string) => {
    try {
      console.log('[UpdateChecker] Открытие APK для установки:', fileUri);

      // Проверяем доступность системного шаринга/открытия файлов
      const isSharingAvailable = await Sharing.isAvailableAsync();

      if (isSharingAvailable) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/vnd.android.package-archive',
          dialogTitle: 'Установка обновления Домофондар',
          UTI: 'com.android.package-archive',
        });
      } else {
        // Если модуль недоступен, открываем локальный URI через Linking
        await Linking.openURL(fileUri);
      }
    } catch (openErr) {
      console.warn('[UpdateChecker] Не удалось напрямую вызвать установщик:', openErr);
      Alert.alert(
        'Файл загружен',
        'Обновление сохранено на устройстве. Если установка не началась автоматически, откройте файл из папки "Загрузки" или воспользуйтесь прямой ссылкой.',
        [
          { text: 'Открыть ссылку', onPress: handleFallbackBrowserDownload },
          { text: 'Понятно', style: 'cancel' }
        ]
      );
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
    console.log('[UpdateChecker] Резервный запуск скачивания через браузер:', targetUrl);
    try {
      await Linking.openURL(targetUrl);
    } catch (e) {
      console.error('[UpdateChecker] Ошибка открытия резервной ссылки:', e);
      if (updateInfo?.fallbackDownloadUrl) {
        await Linking.openURL(updateInfo.fallbackDownloadUrl);
      }
    }

    if (!updateInfo?.isMandatory) {
      setVisible(false);
    }
  };

  /**
   * Отмена активного скачивания
   */
  const handleCancelDownload = async () => {
    if (downloadTaskRef.current) {
      try {
        await downloadTaskRef.current.cancelAsync();
      } catch (e) {
        console.log('[UpdateChecker] Ошибка при отмене загрузки:', e);
      }
    }
    setIsDownloading(false);
    isDownloadingRef.current = false;
    setDownloadProgress(0);
    setDownloadBytesText('');
    setDownloadError(null);
  };

  /**
   * Закрытие окна по кнопке «Позже»
   */
  const handleDismiss = () => {
    if (isDownloading) {
      handleCancelDownload();
    }
    console.log('[UpdateChecker] Пользователь закрыл диалог обновления');
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
          {/* Иконка обновления или индикатор загрузки */}
          <View style={[
            styles.iconCircle,
            {
              backgroundColor: isDark ? 'rgba(78, 222, 163, 0.12)' : 'rgba(16, 185, 129, 0.1)',
              borderColor: isDark ? 'rgba(78, 222, 163, 0.25)' : 'rgba(16, 185, 129, 0.2)',
            }
          ]}>
            {isDownloading ? (
              <ActivityIndicator size="small" color={isDark ? '#4EDE93' : '#10B981'} />
            ) : (
              <Ionicons name="cloud-download-outline" size={32} color={isDark ? '#4EDE93' : '#10B981'} />
            )}
          </View>

          {/* Заголовок */}
          <Text style={[styles.title, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
            {isDownloading ? 'Загрузка обновления...' : 'Доступно обновление'}
          </Text>

          {/* Информационный текст */}
          <Text style={[styles.subtitle, { color: isDark ? '#94A3B8' : '#64748B' }]}>
            {isDownloading
              ? `Пожалуйста, подождите завершения скачивания новой версии ${updateInfo.latestVersion}.`
              : `Пожалуйста, обновите приложение до актуальной версии ${updateInfo.latestVersion} для стабильной и быстрой работы.`}
          </Text>

          {/* Блок прогресса скачивания */}
          {isDownloading && (
            <View style={styles.progressContainer}>
              <View style={[styles.progressBarTrack, { backgroundColor: isDark ? '#262A35' : '#E2E8F0' }]}>
                <View
                  style={[
                    styles.progressBarFill,
                    {
                      width: `${downloadProgress}%`,
                      backgroundColor: isDark ? '#4EDE93' : '#10B981',
                    }
                  ]}
                />
              </View>
              <View style={styles.progressLabels}>
                <Text style={[styles.progressPercent, { color: isDark ? '#4EDE93' : '#10B981' }]}>
                  {downloadProgress}%
                </Text>
                <Text style={[styles.progressBytes, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                  {downloadBytesText}
                </Text>
              </View>
            </View>
          )}

          {/* Блок сообщения об ошибке */}
          {downloadError && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{downloadError}</Text>
            </View>
          )}

          {/* Блок действий */}
          <View style={styles.actionsContainer}>
            {isDownloading ? (
              <TouchableOpacity
                style={[styles.cancelButton, { borderColor: isDark ? '#333A48' : '#CBD5E1' }]}
                onPress={handleCancelDownload}
                activeOpacity={0.7}
              >
                <Text style={[styles.cancelButtonText, { color: isDark ? '#CBD5E1' : '#475569' }]}>
                  Отменить загрузку
                </Text>
              </TouchableOpacity>
            ) : (
              <>
                <TouchableOpacity
                  style={[
                    styles.updateButton,
                    { backgroundColor: isDark ? '#4EDE93' : '#10B981' },
                    isDownloading && { opacity: 0.6 }
                  ]}
                  onPress={startNativeDownload}
                  disabled={isDownloading}
                  activeOpacity={0.85}
                >
                  <Ionicons name="download-outline" size={20} color={isDark ? '#081510' : '#FFFFFF'} style={{ marginRight: 8 }} />
                  <Text style={[
                    styles.updateButtonText,
                    { color: isDark ? '#081510' : '#FFFFFF' }
                  ]}>
                    Обновить сейчас
                  </Text>
                </TouchableOpacity>

                {downloadError && (
                  <TouchableOpacity
                    style={[styles.browserFallbackButton, { borderColor: isDark ? '#38BDF8' : '#0284C7' }]}
                    onPress={handleFallbackBrowserDownload}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="globe-outline" size={16} color={isDark ? '#38BDF8' : '#0284C7'} style={{ marginRight: 6 }} />
                    <Text style={[styles.browserFallbackText, { color: isDark ? '#38BDF8' : '#0284C7' }]}>
                      Скачать через браузер
                    </Text>
                  </TouchableOpacity>
                )}

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
              </>
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
    paddingTop: 26,
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
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
    borderWidth: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13.5,
    textAlign: 'center',
    marginBottom: 18,
    lineHeight: 19,
    paddingHorizontal: 4,
  },
  progressContainer: {
    width: '100%',
    marginBottom: 18,
  },
  progressBarTrack: {
    width: '100%',
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 5,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  progressPercent: {
    fontSize: 13,
    fontWeight: '700',
  },
  progressBytes: {
    fontSize: 12,
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
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
    fontSize: 15.5,
    fontWeight: '700',
  },
  cancelButton: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    borderWidth: 1,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  browserFallbackButton: {
    marginTop: 10,
    borderRadius: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    borderWidth: 1,
  },
  browserFallbackText: {
    fontSize: 13,
    fontWeight: '600',
  },
  laterButton: {
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  laterButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
