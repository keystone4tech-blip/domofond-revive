/**
 * Глобальные константы служебного приложения «Офис Работа»
 * Универсальная конфигурация без жесткой привязки к одному бренду/городу
 */

// Базовый URL защищенного API сервера (боевой сервер компании)
export const API_URL = 'https://xn--80aha5afebav9a.xn--p1ai/backend-api';

// Название приложения в интерфейсе
export const APP_NAME = 'Офис Работа';

// Версия сборки
export const APP_VERSION = '1.0.0';

// Ссылка для прямого скачивания служебного приложения
export const APP_DOWNLOAD_URL = 'https://xn--80aha5afebav9a.xn--p1ai/backend-api/api/app/download-staff';
export const APP_DIRECT_MEDIA_URL = 'https://xn--80aha5afebav9a.xn--p1ai/media/app/office-work.apk';

// Ключи для безопасного локального хранилища
export const STORAGE_KEYS = {
  STAFF_TOKEN: 'officework_staff_auth_token',
  STAFF_USER: 'officework_staff_profile',
  ACTIVE_VIEW_ROLE: 'officework_active_view_role',
  SHIFT_STATUS: 'officework_shift_status',
  SAVED_LOGIN: 'officework_saved_phone',
};
