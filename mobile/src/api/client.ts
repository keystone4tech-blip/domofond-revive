/**
 * HTTP-клиент Axios для взаимодействия с бэкендом
 */
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { API_URL, STORAGE_KEYS } from '@/config/constants';

// Создаем инстанс axios с базовой конфигурацией
export const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 30000, // Тайм-аут запросов: 30 секунд
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

// Interceptor для исходящих запросов: автоматическое добавление Bearer токена
apiClient.interceptors.request.use(
  async (config) => {
    try {
      // Получаем JWT токен из защищенного хранилища
      const token = await SecureStore.getItemAsync(STORAGE_KEYS.AUTH_TOKEN);
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      // Логируем запрос для отладки
      console.log(`[API REQUEST] ${config.method?.toUpperCase()} ${config.url}`);
    } catch (error) {
      console.error('[API REQUEST ERROR] Ошибка получения токена:', error);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor для входящих ответов: обработка ошибок и логирование
apiClient.interceptors.response.use(
  (response) => {
    // Логируем успешный ответ
    console.log(`[API RESPONSE] ${response.config.method?.toUpperCase()} ${response.config.url} - Status: ${response.status}`);
    return response;
  },
  async (error) => {
    if (error.response) {
      console.error(`[API ERROR] ${error.config?.method?.toUpperCase()} ${error.config?.url} - Status: ${error.response.status}`, error.response.data);
      
      // Обработка 401 Unauthorized (ошибка авторизации)
      if (error.response.status === 401) {
        console.log('[API] Получен статус 401. Требуется повторная авторизация.');
        // Очищаем токен из хранилища (в реальном приложении здесь также вызывается logout из zustand)
        await SecureStore.deleteItemAsync(STORAGE_KEYS.AUTH_TOKEN);
        // Редирект на логин обычно обрабатывается на уровне навигации (например, прослушивая состояние авторизации)
      }
    } else if (error.request) {
      // Сетевая ошибка (нет ответа от сервера)
      console.error('[API NETWORK ERROR] Нет ответа от сервера:', error.request);
    } else {
      console.error('[API ERROR] Ошибка при настройке запроса:', error.message);
    }
    return Promise.reject(error);
  }
);
