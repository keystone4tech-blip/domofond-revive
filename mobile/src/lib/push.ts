// mobile/src/lib/push.ts — Push-уведомления мобильного приложения (Expo)
//
// Регистрирует устройство в облаке Expo, получает ExponentPushToken и отправляет его
// на сервер (/api/user/push-token). Благодаря этому уведомления о заявках/оплатах
// приходят на телефон ДАЖЕ когда приложение полностью закрыто.
//
// Android: доставка идёт через FCM — в проекте EAS должен быть настроен FCM
// (google-services.json / ключ FCM в учётке Expo). См. инструкцию, переданную отдельно.
// iOS: доставка через APNs — настраивается автоматически при сборке через EAS с push-ключом.

import { Platform } from 'react-native';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { apiClient } from '@/api/client';

// Как показывать уведомление, когда приложение открыто (foreground)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    // Новые поля SDK 52 (баннер/список) — на всякий случай дублируем поведение
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

let lastToken: string | null = null;

/**
 * Запрашивает разрешение, получает Expo push-токен и регистрирует его на сервере.
 * Вызывается после успешного входа (когда есть JWT-токен для авторизованного запроса).
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  try {
    // Push работает только на реальном устройстве (не в симуляторе/эмуляторе без Google Services)
    if (!Device.isDevice) {
      console.log('[Push] Пропуск регистрации: не физическое устройство');
      return null;
    }

    // Канал уведомлений Android (обязателен для корректного отображения и звука)
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Уведомления Домофондар',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#10B981',
        sound: 'default',
      });
    }

    // Проверяем/запрашиваем разрешение
    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.log('[Push] Разрешение на уведомления не выдано');
      return null;
    }

    // projectId нужен для getExpoPushTokenAsync в dev-/production-сборках
    const projectId =
      (Constants as any)?.expoConfig?.extra?.eas?.projectId ||
      (Constants as any)?.easConfig?.projectId ||
      undefined;

    const tokenResp = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined as any
    );
    const token = tokenResp?.data || null;
    if (!token) return null;

    lastToken = token;
    console.log('[Push] Получен Expo push-токен:', token);

    // Отправляем токен на сервер (требуется авторизация)
    try {
      await apiClient.post('/api/user/push-token', { token, platform: Platform.OS });
      console.log('[Push] Токен успешно зарегистрирован на сервере');
    } catch (err) {
      console.warn('[Push] Не удалось зарегистрировать токен на сервере (повторим позже):', err);
    }

    return token;
  } catch (e) {
    console.warn('[Push] Ошибка регистрации push-уведомлений:', e);
    return null;
  }
}

/** Снять регистрацию токена на сервере (при выходе из аккаунта) */
export async function unregisterPushToken(): Promise<void> {
  try {
    if (lastToken) {
      await apiClient.post('/api/user/push-token/remove', { token: lastToken });
    }
  } catch { /* no-op */ }
}
