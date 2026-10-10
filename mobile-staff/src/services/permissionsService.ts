/**
 * mobile-staff/src/services/permissionsService.ts
 * Сервис управления системными разрешениями служебного приложения «Офис Работа»
 * Отвечает за:
 * 1. Проверку и запрос разрешений на Геолокацию (GPS в фоне для навигации к домам)
 * 2. Доступ к Камере и Медиатеке (фото и видео фиксация дефектов, сканирование документов)
 * 3. Push-уведомления с максимальным приоритетом звука и вибрации
 * 4. Настройку фонового режима и отключение энергосбережения/оптимизации батареи (Xiaomi, Samsung, Huawei)
 */

import { Platform, Linking, Alert } from 'react-native';
import * as Location from 'expo-location';
import { Camera } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as Notifications from 'expo-notifications';
import * as IntentLauncher from 'expo-intent-launcher';

export interface PermissionStatusSummary {
  location: boolean;
  backgroundLocation: boolean;
  camera: boolean;
  mediaLibrary: boolean;
  notifications: boolean;
  allEssentialGranted: boolean;
}

/**
 * Идентификатор высокоприоритетного канала уведомлений для персонала
 */
export const STAFF_NOTIFICATION_CHANNEL_ID = 'staff_orders_channel_v1';

/**
 * Настройка глобального поведения системных уведомлений
 */
export function setupNotificationHandler() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

/**
 * Инициализация звукового канала уведомлений на Android
 */
export async function initializeNotificationChannel(): Promise<void> {
  if (Platform.OS === 'android') {
    try {
      await Notifications.setNotificationChannelAsync(STAFF_NOTIFICATION_CHANNEL_ID, {
        name: 'Срочные наряды и аварии',
        description: 'Оповещения о новых назначениях заявок, аварийных вызовах и сообщениях диспетчера',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#3B82F6',
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        bypassDnd: true, // Пробивать режим "Не беспокоить" для срочных аварийных заявок
        sound: 'default',
      });
      console.log('[PermissionsService] Высокоприоритетный канал уведомлений настроен');
    } catch (err) {
      console.warn('[PermissionsService] Ошибка настройки канала уведомлений:', err);
    }
  }
}

/**
 * Комплексная проверка всех разрешений приложения
 */
export async function checkAllStaffPermissions(): Promise<PermissionStatusSummary> {
  let locationGranted = false;
  let bgLocationGranted = false;
  let cameraGranted = false;
  let mediaGranted = false;
  let notifGranted = false;

  try {
    const loc = await Location.getForegroundPermissionsAsync();
    locationGranted = loc.status === 'granted';
  } catch (e) {
    console.warn('[PermissionsService] Проверка локации:', e);
  }

  try {
    const bgLoc = await Location.getBackgroundPermissionsAsync();
    bgLocationGranted = bgLoc.status === 'granted';
  } catch (e) {
    // Фоновая локация может быть недоступна на эмуляторах
  }

  try {
    const cam = await Camera.getCameraPermissionsAsync();
    cameraGranted = cam.status === 'granted';
  } catch (e) {
    console.warn('[PermissionsService] Проверка камеры:', e);
  }

  try {
    const media = await ImagePicker.getMediaLibraryPermissionsAsync();
    mediaGranted = media.status === 'granted';
  } catch (e) {
    console.warn('[PermissionsService] Проверка медиатеки:', e);
  }

  try {
    const notif = await Notifications.getPermissionsAsync();
    notifGranted = notif.status === 'granted';
  } catch (e) {
    console.warn('[PermissionsService] Проверка уведомлений:', e);
  }

  const allEssentialGranted = locationGranted && cameraGranted && mediaGranted && notifGranted;

  return {
    location: locationGranted,
    backgroundLocation: bgLocationGranted,
    camera: cameraGranted,
    mediaLibrary: mediaGranted,
    notifications: notifGranted,
    allEssentialGranted,
  };
}

/**
 * Запрос доступа к геолокации (передний план)
 */
export async function requestLocationPermission(): Promise<boolean> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    return status === 'granted';
  } catch (e) {
    console.warn('[PermissionsService] Ошибка запроса локации:', e);
    return false;
  }
}

/**
 * Запрос фоновой геолокации (для непрерывного трекинга на выезде)
 */
export async function requestBackgroundLocationPermission(): Promise<boolean> {
  try {
    const fg = await Location.requestForegroundPermissionsAsync();
    if (fg.status !== 'granted') return false;

    const bg = await Location.requestBackgroundPermissionsAsync();
    return bg.status === 'granted';
  } catch (e) {
    console.warn('[PermissionsService] Ошибка запроса фоновой локации:', e);
    return false;
  }
}

/**
 * Запрос доступа к камере
 */
export async function requestCameraPermission(): Promise<boolean> {
  try {
    const { status } = await Camera.requestCameraPermissionsAsync();
    return status === 'granted';
  } catch (e) {
    console.warn('[PermissionsService] Ошибка запроса камеры:', e);
    return false;
  }
}

/**
 * Запрос доступа к фото, видео и файлам галереи
 */
export async function requestMediaLibraryPermission(): Promise<boolean> {
  try {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    return status === 'granted';
  } catch (e) {
    console.warn('[PermissionsService] Ошибка запроса медиатеки:', e);
    return false;
  }
}

/**
 * Запрос системных push-уведомлений
 */
export async function requestNotificationsPermission(): Promise<boolean> {
  try {
    const { status } = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
        allowAnnouncements: true,
      },
    });
    if (status === 'granted') {
      await initializeNotificationChannel();
      return true;
    }
    return false;
  } catch (e) {
    console.warn('[PermissionsService] Ошибка запроса уведомлений:', e);
    return false;
  }
}

/**
 * Открытие экрана системных настроек приложения
 */
export async function openAppSettings(): Promise<void> {
  try {
    await Linking.openSettings();
  } catch (err) {
    console.warn('[PermissionsService] Не удалось открыть системные настройки:', err);
    Alert.alert(
      'Настройки телефона',
      'Пожалуйста, откройте «Настройки» -> «Приложения» -> «Офис Работа» и включите необходимые разрешения вручную.'
    );
  }
}

/**
 * Запрос снятия ограничений оптимизации батареи (Android)
 * Позволяет получать уведомления о нарядах ДАЖЕ когда приложение закрыто и экран выключен
 */
export async function openBatteryOptimizationSettings(): Promise<void> {
  if (Platform.OS !== 'android') {
    Alert.alert(
      'Фоновая работа на iOS',
      'Убедитесь, что в «Настройки» -> «Офис Работа» включен переключатель «Обновление контента».'
    );
    return;
  }

  try {
    // Открываем системный экран игнорирования оптимизации батареи
    await IntentLauncher.startActivityAsync(
      IntentLauncher.ActivityAction.IGNORE_BATTERY_OPTIMIZATION_SETTINGS
    );
  } catch (e) {
    try {
      // Резервный переход в общие настройки приложения
      await Linking.openSettings();
    } catch (err) {
      Alert.alert(
        'Оптимизация батареи',
        'Откройте: «Настройки» -> «Батарея» -> «Оптимизация» -> выберите «Офис Работа» и установите «Не экономить».'
      );
    }
  }
}
