// app.config.ts — Конфигурация Expo для служебного мобильного приложения «Офис Работа»
// Универсальное приложение для сотрудников, инженеров, мастеров и диспетчеров

import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
  return {
    ...config,

    // === Основные параметры приложения ===
    name: 'Офис Работа',                        // Универсальное отображаемое имя в меню телефона
    slug: 'office-work',                        // Уникальный идентификатор проекта
    version: '1.0.0',                           // Первая версия служебного приложения
    orientation: 'portrait',                    // Портретная ориентация
    icon: './assets/images/icon.png',           // Иконка приложения (1024x1024)
    scheme: 'officework',                       // URL-схема для deep linking (officework://)
    userInterfaceStyle: 'automatic',            // Поддержка системной тёмной/светлой темы

    // === Экран загрузки (Splash Screen) ===
    splash: {
      image: './assets/images/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#0F172A',               // Строгий глубокий синий фон
    },

    // === Настройки iOS ===
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'ru.officework.app',
      buildNumber: '1',
      infoPlist: {
        NSCameraUsageDescription: 'Камера необходима для фотофиксации выполненных работ, нарядов и дефектов оборудования',
        NSPhotoLibraryUsageDescription: 'Доступ к галерее необходим для прикрепления фотоотчетов к актам работ',
        NSLocationWhenInUseUsageDescription: 'Геопозиция необходима для построения маршрута к объекту и подтверждения прибытия на заявку',
        NSMicrophoneUsageDescription: 'Микрофон необходим для записи голосовых заметок по заявкам',
      },
    },

    // === Настройки Android ===
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/images/adaptive-icon.png',
        backgroundColor: '#0F172A',
      },
      package: 'ru.officework.app',             // Универсальный Package Name для Android
      versionCode: 1,
      permissions: [
        'CAMERA',                               // Фотоотчеты «до/после»
        'READ_MEDIA_IMAGES',                    // Доступ к фото
        'ACCESS_FINE_LOCATION',                 // Точная геолокация объектов
        'ACCESS_COARSE_LOCATION',
        'POST_NOTIFICATIONS',                   // Пуши о новых нарядах и авариях
        'VIBRATE',
        'RECEIVE_BOOT_COMPLETED',
        'ACCESS_NETWORK_STATE',
        'REQUEST_INSTALL_PACKAGES',             // Обновление APK внутри приложения
      ],
    },

    // === Плагины Expo ===
    plugins: [
      'expo-router',
      'expo-font',
      'expo-secure-store',
      [
        'expo-camera',
        {
          cameraPermission: 'Разрешите доступ к камере для фотофиксации нарядов и составления актов',
        },
      ],
      [
        'expo-location',
        {
          locationWhenInUsePermission: 'Разрешите доступ к геолокации для навигации к обслуживаемым домам',
        },
      ],
    ],

    // === Экспериментальные функции ===
    experiments: {
      typedRoutes: true,
    },

    // === Дополнительные метаданные ===
    extra: {
      eas: {
        projectId: 'office-work-fsm',
      },
      appName: 'Офис Работа',
      apiUrl: 'https://xn--80aha5afebav9a.xn--p1ai/backend-api',
    },
  };
};
