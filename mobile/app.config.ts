// app.config.ts — Конфигурация Expo для приложения «Домофондар»
// Определяет настройки для Android и iOS: иконки, разрешения, плагины, deep linking

import { ExpoConfig, ConfigContext } from 'expo/config';
import { withAndroidManifest, withAppBuildGradle, withGradleProperties, ConfigPlugin } from '@expo/config-plugins';

// Плагин для гарантированного разрешения HTTP-трафика и установки APK обновлений
const withAppCustomManifest: ConfigPlugin = (config) => {
  return withAndroidManifest(config, async (manifestConfig) => {
    const androidManifest = manifestConfig.modResults.manifest;
    if (androidManifest.application && androidManifest.application[0]) {
      androidManifest.application[0].$['android:usesCleartextTraffic'] = 'true';
    }

    // Добавляем системные разрешения
    if (!androidManifest['uses-permission']) {
      androidManifest['uses-permission'] = [];
    }
    const perms = androidManifest['uses-permission'];
    const ensurePerm = (name: string) => {
      const exists = perms.some((p: any) => p.$?.['android:name'] === name);
      if (!exists) {
        perms.push({ $: { 'android:name': name } } as any);
      }
    };
    ensurePerm('android.permission.REQUEST_INSTALL_PACKAGES');
    ensurePerm('android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS');
    ensurePerm('android.permission.WAKE_LOCK');

    return manifestConfig;
  });
};

// Плагин для оптимизации размера APK: сжатие библиотек .so и исключение эмуляторных x86 архитектур
// Это сокращает размер APK со 140 МБ до стабильных ~38-42 МБ и устраняет обрывы скачивания
const withCustomGradleProperties: ConfigPlugin = (config) => {
  return withGradleProperties(config, (propertiesConfig) => {
    propertiesConfig.modResults = propertiesConfig.modResults.filter(
      (item) => item.type !== 'property' || (item.key !== 'expo.useLegacyPackaging' && item.key !== 'reactNativeArchitectures')
    );
    propertiesConfig.modResults.push(
      {
        type: 'property',
        key: 'expo.useLegacyPackaging',
        value: 'true',
      },
      {
        type: 'property',
        key: 'reactNativeArchitectures',
        value: 'arm64-v8a,armeabi-v7a',
      }
    );
    return propertiesConfig;
  });
};

// Плагин для гарантированной подписи Release APK (исключает неподписанные артефакты и сбои установки на Android)
const withReleaseSigning: ConfigPlugin = (config) => {
  return withAppBuildGradle(config, (gradleConfig) => {
    let contents = gradleConfig.modResults.contents;
    // Если в release нет signingConfig, подключаем signingConfigs.debug с v1 и v2 схемами
    if (!contents.includes('signingConfig signingConfigs.release') && !contents.includes('signingConfig signingConfigs.debug')) {
      contents = contents.replace(
        /release\s*\{/,
        `release {\n            signingConfig signingConfigs.debug\n            v1SigningEnabled true\n            v2SigningEnabled true`
      );
      gradleConfig.modResults.contents = contents;
    }
    return gradleConfig;
  });
};

export default ({ config }: ConfigContext): ExpoConfig => {
  const baseConfig: ExpoConfig = {
    ...config,

  // === Основные параметры приложения ===
  name: 'Домофондар',                         // Название в меню телефона
  slug: 'domofondar',                          // Уникальный идентификатор проекта
  version: '1.4.0',                            // Версия приложения (надежный загрузчик APK, синхронизация с сайтом)
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
    buildNumber: '18',                         // Номер сборки
    infoPlist: {
      // Описания для запросов разрешений (обязательно для App Store)
      NSCameraUsageDescription: 'Камера нужна для фото заявок и верификации документов',
      NSPhotoLibraryUsageDescription: 'Доступ к фото и видео для загрузки документов и медиафайлов к заявкам',
      NSFaceIDUsageDescription: 'Face ID используется для быстрого и безопасного входа в приложение',
      NSMicrophoneUsageDescription: 'Микрофон нужен для записи голосовых сообщений в чате',
      NSLocationWhenInUseUsageDescription: 'Геопозиция используется для определения адреса и удобства оформления заявок',
      UIBackgroundModes: ['fetch', 'remote-notification'],
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
    versionCode: 18,                           // Код версии 18 (v1.4.0)
    permissions: [
      'CAMERA',                                // Камера для фото
      'READ_MEDIA_IMAGES',                     // Чтение изображений (Android 13+)
      'READ_MEDIA_VIDEO',                      // Чтение видео (Android 13+)
      'READ_MEDIA_AUDIO',                      // Чтение аудио (Android 13+)
      'READ_EXTERNAL_STORAGE',                 // Совместимость со старыми версиями
      'WRITE_EXTERNAL_STORAGE',                // Сохранение квитанций
      'RECORD_AUDIO',                          // Запись аудио для голосовых сообщений
      'USE_BIOMETRIC',                         // Биометрическая аутентификация
      'USE_FINGERPRINT',                       // Сканер отпечатков пальцев
      'RECEIVE_BOOT_COMPLETED',                // Автозапуск для фоновой синхронизации
      'ACCESS_NETWORK_STATE',                  // Проверка состояния сети
      'VIBRATE',                               // Вибрация для уведомлений
      'WAKE_LOCK',                             // Пробуждение для срочных пушей
      'POST_NOTIFICATIONS',                    // Push-уведомления (Android 13+)
      'ACCESS_FINE_LOCATION',                  // Геопозиция по GPS
      'ACCESS_COARSE_LOCATION',                // Геопозиция по сети/Wi-Fi
      'REQUEST_INSTALL_PACKAGES',              // Разрешение на установку APK обновлений
      'REQUEST_IGNORE_BATTERY_OPTIMIZATIONS',  // Снятие ограничений батареи для пушей
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
      'expo-location',
      {
        locationWhenInUsePermission: 'Геопозиция используется для определения адреса и удобства оформления заявок',
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
    // URL основного API сервера (бэкенд Домофондар, HTTPS через домен домофондар.рф / punycode)
    apiUrl: process.env.EXPO_PUBLIC_API_URL || 'https://xn--80aha5afebav9a.xn--p1ai/backend-api',
    // URL WebSocket сервера (для чата, защищённый wss)
    wsUrl: process.env.EXPO_PUBLIC_WS_URL || 'wss://xn--80aha5afebav9a.xn--p1ai/ws',
  },
  };

  return withCustomGradleProperties(withReleaseSigning(withAppCustomManifest(baseConfig)));
};
