// app.config.ts — Конфигурация Expo для служебного мобильного приложения «Офис Работа»
// Универсальное приложение для сотрудников, инженеров, мастеров и диспетчеров
// Включает полный набор системных разрешений для фоновой работы, GPS, фото/видео и push-уведомлений

import { ExpoConfig, ConfigContext } from 'expo/config';
import { withAndroidManifest, ConfigPlugin } from '@expo/config-plugins';

// Плагин для гарантированного разрешения фонового трафика и системной установки APK-обновлений
const withStaffCustomManifest: ConfigPlugin = (config) => {
  return withAndroidManifest(config, async (manifestConfig) => {
    const androidManifest = manifestConfig.modResults.manifest;
    if (androidManifest.application && androidManifest.application[0]) {
      androidManifest.application[0].$['android:usesCleartextTraffic'] = 'true';
    }

    if (!androidManifest['uses-permission']) {
      androidManifest['uses-permission'] = [];
    }
    const perms = androidManifest['uses-permission'];

    // Проверяем и добавляем системные разрешения
    const ensurePerm = (name: string) => {
      const exists = perms.some((p: any) => p.$?.['android:name'] === name);
      if (!exists) {
        perms.push({ $: { 'android:name': name } } as any);
      }
    };

    ensurePerm('android.permission.REQUEST_INSTALL_PACKAGES');
    ensurePerm('android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS');
    ensurePerm('android.permission.WAKE_LOCK');
    ensurePerm('android.permission.FOREGROUND_SERVICE');
    ensurePerm('android.permission.FOREGROUND_SERVICE_LOCATION');
    ensurePerm('android.permission.ACCESS_BACKGROUND_LOCATION');

    return manifestConfig;
  });
};

export default ({ config }: ConfigContext): ExpoConfig => {
  const baseConfig: ExpoConfig = {
    ...config,

    // === Основные параметры приложения ===
    name: 'Офис Работа',                        // Отображаемое имя в меню телефона
    slug: 'office-work',                        // Уникальный идентификатор проекта
    version: '1.1.0',                           // Версия служебного приложения
    orientation: 'portrait',                    // Портретная ориентация
    icon: './assets/images/icon.png',           // Иконка приложения (1024x1024)
    scheme: 'officework',                       // URL-схема для deep linking (officework://)
    userInterfaceStyle: 'automatic',            // Поддержка системной тёмной/светлой темы

    // === Экран загрузки (Splash Screen) ===
    splash: {
      image: './assets/images/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#0F172A',               // Строгий глубокий тёмно-синий фон
    },

    // === Настройки iOS ===
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'ru.officework.app',
      buildNumber: '2',
      infoPlist: {
        NSCameraUsageDescription: 'Камера необходима для фотофиксации выполненных работ, нарядов и дефектов оборудования',
        NSPhotoLibraryUsageDescription: 'Доступ к галерее и медиафайлам необходим для прикрепления фото и видео к актам выполненных работ',
        NSLocationWhenInUseUsageDescription: 'Геопозиция необходима для навигации к обслуживаемым домам и подтверждения прибытия на объект',
        NSLocationAlwaysAndWhenInUseUsageDescription: 'Геолокация в фоновом режиме необходима для автоматической фиксации прибытия техника на аварийную заявку',
        NSMicrophoneUsageDescription: 'Микрофон необходим для записи аудиозаметок по дефектам и неисправностям',
        UIBackgroundModes: ['fetch', 'remote-notification', 'location'],
      },
    },

    // === Настройки Android ===
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/images/adaptive-icon.png',
        backgroundColor: '#0F172A',
      },
      package: 'ru.officework.app',             // Универсальный Package Name для Android
      versionCode: 2,                           // Инкремент версии для автообновления
      permissions: [
        // 1. Камера и запись звука
        'CAMERA',                               // Фотоотчеты «до/после» и дефекты
        'RECORD_AUDIO',                          // Аудиозаметки по нарядам

        // 2. Доступ к медиафайлам, фото, видео и актам
        'READ_MEDIA_IMAGES',                    // Фото (Android 13+)
        'READ_MEDIA_VIDEO',                     // Видео поломок (Android 13+)
        'READ_MEDIA_AUDIO',                     // Аудио (Android 13+)
        'READ_EXTERNAL_STORAGE',                // Совместимость с Android 12 и ниже
        'WRITE_EXTERNAL_STORAGE',               // Сохранение PDF актов на диск

        // 3. Точная и фоновая геолокация объектов
        'ACCESS_FINE_LOCATION',                 // Точный GPS
        'ACCESS_COARSE_LOCATION',               // Геопозиция по сотовой сети
        'ACCESS_BACKGROUND_LOCATION',           // Фоновый трекинг при выезде на вызов
        'FOREGROUND_SERVICE',                   // Фоновая служба работы
        'FOREGROUND_SERVICE_LOCATION',          // Фоновый сервис локации (Android 14+)

        // 4. Доставка Push-уведомлений и пробуждение устройства
        'POST_NOTIFICATIONS',                   // Пуши о новых нарядах и авариях (Android 13+)
        'VIBRATE',                              // Вибросигнал при назначении наряда
        'WAKE_LOCK',                            // Пробуждение экрана для срочных вызовов
        'RECEIVE_BOOT_COMPLETED',               // Запуск слушателя при включении смартфона
        'ACCESS_NETWORK_STATE',                 // Контроль интернет-соединения

        // 5. Установка обновлений и снятие ограничений энергосбережения
        'REQUEST_INSTALL_PACKAGES',             // Обновление APK прямо в приложении
        'REQUEST_IGNORE_BATTERY_OPTIMIZATIONS', // Бесперебойная работа пушей в фоне
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
          microphonePermission: 'Разрешите доступ к микрофону для аудиозаметок по дефектам',
        },
      ],
      [
        'expo-image-picker',
        {
          photosPermission: 'Разрешите доступ к галерее для выбора фото и видео выполненных работ',
          cameraPermission: 'Разрешите доступ к камере для съемки оборудования на объекте',
        },
      ],
      [
        'expo-location',
        {
          locationAlwaysAndWhenInUsePermission: 'Разрешите доступ к геолокации для навигации к объектам и фиксации прибытия',
          locationWhenInUsePermission: 'Разрешите доступ к геолокации для прокладки маршрута к дому',
          isAndroidBackgroundLocationEnabled: true,
        },
      ],
      [
        'expo-notifications',
        {
          icon: './assets/images/icon.png',
          color: '#3B82F6',                     // Синий фирменный цвет уведомлений мастера
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

  return withStaffCustomManifest(baseConfig);
};
