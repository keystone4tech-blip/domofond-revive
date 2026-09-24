// app.config.ts — Конфигурация Expo для приложения «Домофондар»
// Определяет настройки для Android и iOS: иконки, разрешения, плагины, deep linking

import { ExpoConfig, ConfigContext } from 'expo/config';
import { withAndroidManifest, ConfigPlugin } from '@expo/config-plugins';

// Плагин для гарантированного разрешения HTTP-трафика (порт 80) к боевому серверу 45.8.99.238
const withCleartextTraffic: ConfigPlugin = (config) => {
  return withAndroidManifest(config, async (manifestConfig) => {
    const androidManifest = manifestConfig.modResults.manifest;
    if (androidManifest.application && androidManifest.application[0]) {
      androidManifest.application[0].$['android:usesCleartextTraffic'] = 'true';
    }
    return manifestConfig;
  });
};

export default ({ config }: ConfigContext): ExpoConfig => {
  const baseConfig: ExpoConfig = {
    ...config,

  // === Основные параметры приложения ===
  name: 'Домофондар',                         // Название в меню телефона
  slug: 'domofondar',                          // Уникальный идентификатор проекта
  version: '1.0.0',                            // Версия приложения
  orientation: 'portrait',                     // Портретная ориентация
  icon: './assets/images/icon.png',            // Иконка приложения (1024x1024)
  scheme: 'domofondar',                        // URL-схема для deep linking (domofondar://)
  userInterfaceStyle: 'automatic',             // Автоматическая светлая/тёмная тема

  // === Экран загрузки (Splash Screen) ===
  splash: {
    image: './assets/images/splash-icon.png',  // Изображение на экране загрузки
    resizeMode: 'contain',                     // Масштабирование без обрезки
    backgroundColor: '#0F172A',                // Тёмный фон (как на сайте)
  },

  // === Настройки iOS ===
  ios: {
    supportsTablet: true,                      // Поддержка iPad
    bundleIdentifier: 'ru.domofondar.app',     // Уникальный Bundle ID для App Store
    buildNumber: '1',                          // Номер сборки
    infoPlist: {
      // Описания для запросов разрешений (обязательно для App Store)
      NSCameraUsageDescription: 'Камера нужна для фото заявок и верификации документов',
      NSPhotoLibraryUsageDescription: 'Доступ к фото для загрузки документов и фото к заявкам',
      NSFaceIDUsageDescription: 'Face ID используется для быстрого и безопасного входа в приложение',
      NSMicrophoneUsageDescription: 'Микрофон нужен для записи голосовых сообщений в чате',
    },
    config: {
      usesNonExemptEncryption: false,          // Без экспортного шифрования
    },
  },

  // === Настройки Android ===
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/images/adaptive-icon.png', // Адаптивная иконка
      backgroundColor: '#0F172A',                           // Фон адаптивной иконки
    },
    package: 'ru.domofondar.app',              // Уникальный Package Name для Google Play
    versionCode: 1,                            // Код версии (увеличивать при каждом релизе)
    permissions: [
      'CAMERA',                                // Камера для фото
      'READ_MEDIA_IMAGES',                     // Чтение изображений (Android 13+)
      'RECORD_AUDIO',                          // Запись аудио для голосовых сообщений
      'USE_BIOMETRIC',                         // Биометрическая аутентификация
      'USE_FINGERPRINT',                       // Сканер отпечатков пальцев
      'RECEIVE_BOOT_COMPLETED',                // Автозапуск для фоновой синхронизации
      'ACCESS_NETWORK_STATE',                  // Проверка состояния сети
      'VIBRATE',                               // Вибрация для уведомлений
      'POST_NOTIFICATIONS',                    // Push-уведомления (Android 13+)
    ],
  },

  // === Плагины Expo ===
  plugins: [
    'expo-router',                             // Файловая маршрутизация
    'expo-font',                               // Кастомные шрифты
    'expo-secure-store',                       // Безопасное хранилище токенов
    'expo-local-authentication',               // Биометрия (Face ID / Touch ID)
    [
      'expo-camera',
      {
        cameraPermission: 'Разрешите доступ к камере для фото заявок и документов',
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission: 'Разрешите доступ к галерее для загрузки фото к заявкам',
      },
    ],
    [
      'expo-notifications',
      {
        icon: './assets/images/notification-icon.png',  // Иконка уведомления (Android)
        color: '#10B981',                               // Цвет иконки уведомления
      },
    ],
    [
      'expo-splash-screen',
      {
        image: './assets/images/splash-icon.png',
        imageWidth: 200,
        resizeMode: 'contain',
        backgroundColor: '#0F172A',
      },
    ],
  ],

  // === Дополнительные настройки ===
  experiments: {
    typedRoutes: true,                         // Типизированные маршруты для TypeScript
  },

  extra: {
    // URL основного API сервера (бэкенд Домофондар)
    apiUrl: process.env.EXPO_PUBLIC_API_URL || 'http://45.8.99.238/backend-api',
    // URL WebSocket сервера (для чата)
    wsUrl: process.env.EXPO_PUBLIC_WS_URL || 'ws://45.8.99.238/ws',
  },
  };

  return withCleartextTraffic(baseConfig);
};
