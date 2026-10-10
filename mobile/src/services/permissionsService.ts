/**
 * mobile/src/services/permissionsService.ts
 * Сервис управления системными разрешениями мобильного приложения «Домофондар» (для жителей)
 * Обеспечивает:
 * 1. Получение push-уведомлений о приезде мастера, статусе заявок и начислениях
 * 2. Доступ к камере и медиатеке (фото и видео фиксация поломок, фото документов)
 * 3. Геолокацию для автоподстановки адреса дома при подаче заявки
 * 4. Снятие ограничений батареи для гарантированной доставки уведомлений при закрытом приложении
 */

import { Platform, Linking, Alert } from 'react-native';
import * as Location from 'expo-location';
import { Camera } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as Notifications from 'expo-notifications';
import * as IntentLauncher from 'expo-intent-launcher';

export interface UserPermissionStatusSummary {
  notifications: boolean;
  camera: boolean;
  mediaLibrary: boolean;
  location: boolean;
  allEssentialGranted: boolean;
}

/**
 * Идентификатор системного канала уведомлений для жителей
 */
export const USER_NOTIFICATION_CHANNEL_ID = 'domofondar_user_channel_v1';

/**
 * Настройка глобального поведения системных уведомлений
 */
export function setupUserNotificationHandler() {
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
export async function initializeUserNotificationChannel(): Promise<void> {
  if (Platform.OS === 'android') {
    try {
      await Notifications.setNotificationChannelAsync(USER_NOTIFICATION_CHANNEL_ID, {
        name: 'Уведомления жильцов',
        description: 'Оповещения о выезде мастера, статусе домофона, сообщениях диспетчера и начислениях',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 200, 100, 200],
        lightColor: '#10B981',
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        sound: 'default',
      });
      console.log('[PermissionsService] Канал уведомлений жильцов настроен');
    } catch (err) {
      console.warn('[PermissionsService] Ошибка настройки канала уведомлений жильцов:', err);
    }
  }
}

/**
 * Комплексная проверка разрешений для жильца
 */
export async function checkAllUserPermissions(): Promise<UserPermissionStatusSummary> {
  let notifGranted = false;
  let cameraGranted = false;
  let mediaGranted = false;
  let locationGranted = false;

  try {
    const notif = await Notifications.getPermissionsAsync();
    notifGranted = notif.status === 'granted';
  } catch (e) {
    console.warn('[PermissionsService] Ошибка проверки уведомлений:', e);
  }

  try {
    const cam = await Camera.getCameraPermissionsAsync();
    cameraGranted = cam.status === 'granted';
  } catch (e) {
    console.warn('[PermissionsService] Ошибка проверки камеры:', e);
  }

  try {
    const media = await ImagePicker.getMediaLibraryPermissionsAsync();
    mediaGranted = media.status === 'granted';
  } catch (e) {
    console.warn('[PermissionsService] Ошибка проверки медиатеки:', e);
  }

  try {
    const loc = await Location.getForegroundPermissionsAsync();
    locationGranted = loc.status === 'granted';
  } catch (e) {
    console.warn('[PermissionsService] Ошибка проверки локации:', e);
  }

  const allEssentialGranted = notifGranted && cameraGranted && mediaGranted;

  return {
    notifications: notifGranted,
    camera: cameraGranted,
    mediaLibrary: mediaGranted,
    location: locationGranted,
    allEssentialGranted,
  };
}

/**
 * Запрос системных push-уведомлений
 */
export async function requestUserNotificationsPermission(): Promise<boolean> {
  try {
    const { status } = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
      },
    });
    if (status === 'granted') {
      await initializeUserNotificationChannel();
      return true;
    }
    return false;
  } catch (e) {
    console.warn('[PermissionsService] Ошибка запроса уведомлений:', e);
    return false;
  }
}

/**
 * Запрос камеры для фото поломок и верификации
 */
export async function requestUserCameraPermission(): Promise<boolean> {
  try {
    const { status } = await Camera.requestCameraPermissionsAsync();
    return status === 'granted';
  } catch (e) {
    console.warn('[PermissionsService] Ошибка запроса камеры:', e);
    return false;
  }
}

/**
 * Запрос доступа к фото и видео для прикрепления к заявкам
 */
export async function requestUserMediaLibraryPermission(): Promise<boolean> {
  try {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    return status === 'granted';
  } catch (e) {
    console.warn('[PermissionsService] Ошибка запроса медиатеки:', e);
    return false;
  }
}

/**
 * Запрос геолокации для подстановки адреса
 */
export async function requestUserLocationPermission(): Promise<boolean> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    return status === 'granted';
  } catch (e) {
    console.warn('[PermissionsService] Ошибка запроса геолокации:', e);
    return false;
  }
}

/**
 * Открытие системных настроек приложения
 */
export async function openUserAppSettings(): Promise<void> {
  try {
    await Linking.openSettings();
  } catch (err) {
    Alert.alert(
      'Настройки телефона',
      'Откройте системные «Настройки» -> «Приложения» -> «Домофондар» и включите необходимые разрешения.'
    );
  }
}

/**
 * Снятие ограничений батареи на Android для доставки уведомлений
 */
export async function openUserBatteryOptimizationSettings(): Promise<void> {
  if (Platform.OS !== 'android') {
    Alert.alert(
      'Фоновые уведомления на iOS',
      'Убедитесь, что в «Настройки» -> «Домофондар» включены переключатели «Уведомления» и «Обновление контента».'
    );
    return;
  }

  try {
    await IntentLauncher.startActivityAsync(
      IntentLauncher.ActivityAction.IGNORE_BATTERY_OPTIMIZATION_SETTINGS
    );
  } catch (e) {
    await openUserAppSettings();
  }
}
