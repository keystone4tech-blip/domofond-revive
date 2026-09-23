/**
 * Глобальные константы приложения Домофондар
 */

// Базовый URL для API бэкенда
export const API_URL = 'https://xn--80aha5afebav9a.xn--p1ai/backend-api';

// WebSocket URL (если потребуется в будущем, например для чата или уведомлений в реальном времени)
export const WS_URL = 'wss://xn--80aha5afebav9a.xn--p1ai/ws';

// Текущая версия приложения
export const APP_VERSION = '1.0.0';

// URL для возврата после оплаты через YooKassa
export const YOOKASSA_RETURN_URL = 'domofondar://payment/return';

// Ключи для хранилищ данных (SecureStore / AsyncStorage)
export const STORAGE_KEYS = {
  AUTH_TOKEN: 'domofondar_auth_token',
  THEME_MODE: 'domofondar_theme_mode',
};
