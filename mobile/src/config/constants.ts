/**
 * Глобальные константы приложения Домофондар
 */

// Базовый URL для API бэкенда (боевой сервер Domofondar, HTTPS через домен домофондар.рф)
// Используется punycode-хост, т.к. SSL-сертификат Let's Encrypt выдан именно на него.
export const API_URL = 'https://xn--80aha5afebav9a.xn--p1ai/backend-api';

// WebSocket URL (защищённый wss)
export const WS_URL = 'wss://xn--80aha5afebav9a.xn--p1ai/ws';

// Текущая версия приложения
export const APP_VERSION = '1.2.2';

// Прямая ссылка для скачивания последней версии APK с официального сервера компании
// Используется бэкенд-эндпоинт с заголовками attachment для предотвращения перехвата Service Worker браузера
export const APP_DOWNLOAD_URL = 'https://xn--80aha5afebav9a.xn--p1ai/backend-api/api/app/download';

// URL для возврата после оплаты через YooKassa
export const YOOKASSA_RETURN_URL = 'domofondar://payment/return';

// Ключи для хранилищ данных (SecureStore / AsyncStorage)
export const STORAGE_KEYS = {
  AUTH_TOKEN: 'domofondar_auth_token',
  THEME_MODE: 'domofondar_theme_mode',
};
