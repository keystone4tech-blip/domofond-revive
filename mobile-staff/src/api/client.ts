/**
 * HTTP-клиент Axios для служебного приложения «Офис Работа»
 * Поддерживает автоматическую подстановку JWT токена и обработку оффлайн-режима
 */

import axios from 'axios';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL, STORAGE_KEYS } from '../config/constants';

// Кроссплатформенное получение сохраненного токена (SecureStore на iOS/Android, AsyncStorage в Web)
export async function getStaffToken(): Promise<string | null> {
  try {
    if (Platform.OS === 'web') {
      return await AsyncStorage.getItem(STORAGE_KEYS.STAFF_TOKEN);
    }
    return await SecureStore.getItemAsync(STORAGE_KEYS.STAFF_TOKEN);
  } catch (err) {
    console.warn('[Staff API] Ошибка чтения токена:', err);
    return null;
  }
}

// Кроссплатформенное сохранение токена
export async function setStaffToken(token: string): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      await AsyncStorage.setItem(STORAGE_KEYS.STAFF_TOKEN, token);
    } else {
      await SecureStore.setItemAsync(STORAGE_KEYS.STAFF_TOKEN, token);
    }
  } catch (err) {
    console.warn('[Staff API] Ошибка сохранения токена:', err);
  }
}

// Кроссплатформенное удаление токена
export async function removeStaffToken(): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      await AsyncStorage.removeItem(STORAGE_KEYS.STAFF_TOKEN);
    } else {
      await SecureStore.deleteItemAsync(STORAGE_KEYS.STAFF_TOKEN);
    }
  } catch (err) {
    console.warn('[Staff API] Ошибка удаления токена:', err);
  }
}

// Создаем экземпляр Axios с базовой конфигурацией
export const staffApiClient = axios.create({
  baseURL: API_URL,
  timeout: 25000, // 25 секунд таймаут
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

// Добавление Bearer JWT заголовка перед каждым запросом
staffApiClient.interceptors.request.use(
  async (config) => {
    try {
      const token = await getStaffToken();
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      console.log(`[Staff API] ${config.method?.toUpperCase()} ${config.url}`);
    } catch (err) {
      console.error('[Staff API Request Error]', err);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Перехват ответов и обработка 401
staffApiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    if (error.response?.status === 401) {
      console.warn('[Staff API] Сессия истекла (401). Требуется повторный вход.');
      await removeStaffToken();
    }
    return Promise.reject(error);
  }
);
