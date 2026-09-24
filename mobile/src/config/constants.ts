/**
 * Глобальные константы приложения Домофондар
 */

// Базовый URL для API бэкенда (боевой сервер Domofondar)
export const API_URL = 'http://45.8.99.238/backend-api';

// WebSocket URL
export const WS_URL = 'ws://45.8.99.238/ws';

// Текущая версия приложения
export const APP_VERSION = '1.0.0';

// URL для возврата после оплаты через YooKassa
export const YOOKASSA_RETURN_URL = 'domofondar://payment/return';

// Ключи для хранилищ данных (SecureStore / AsyncStorage)
export const STORAGE_KEYS = {
  AUTH_TOKEN: 'domofondar_auth_token',
  THEME_MODE: 'domofondar_theme_mode',
};
