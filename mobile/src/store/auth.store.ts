/**
 * Zustand store для управления состоянием авторизации и пользователя
 */
import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { apiClient } from '@/api/client';
import { STORAGE_KEYS } from '@/config/constants';

// Тип профиля пользователя
export interface UserProfile {
  id: string | number;
  phone: string;
  full_name: string;
  role?: string;
  email?: string;
  avatar_url?: string;
  is_verified?: boolean;
}

// Тип состояния и действий хранилища авторизации
interface AuthState {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  token: string | null;
  
  // Действия
  login: (phone: string, password: string) => Promise<void>;
  register: (phone: string, password: string, fullName: string) => Promise<void>;
  logout: () => Promise<void>;
  loadProfile: () => Promise<void>;
  setToken: (token: string) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  token: null,

  // Сохранение токена в стейт и SecureStore
  setToken: async (token: string) => {
    await SecureStore.setItemAsync(STORAGE_KEYS.AUTH_TOKEN, token);
    set({ token, isAuthenticated: true });
  },

  // Авторизация
  login: async (phone, password) => {
    set({ isLoading: true });
    try {
      console.log(`[AUTH] Попытка входа для телефона: ${phone}`);
      const response = await apiClient.post('/api/auth/login', { phone, password });
      
      const { token } = response.data;
      if (token) {
        await get().setToken(token);
        await get().loadProfile(); // Загружаем профиль после успешного логина
        console.log('[AUTH] Успешная авторизация');
      }
    } catch (error) {
      console.error('[AUTH ERROR] Ошибка при входе:', error);
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  // Регистрация
  register: async (phone, password, full_name) => {
    set({ isLoading: true });
    try {
      console.log(`[AUTH] Попытка регистрации для телефона: ${phone}`);
      await apiClient.post('/api/auth/register', { phone, password, full_name });
      
      // После успешной регистрации сразу логинимся
      await get().login(phone, password);
    } catch (error) {
      console.error('[AUTH ERROR] Ошибка при регистрации:', error);
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  // Выход из системы
  logout: async () => {
    try {
      await SecureStore.deleteItemAsync(STORAGE_KEYS.AUTH_TOKEN);
      set({ user: null, isAuthenticated: false, token: null });
      console.log('[AUTH] Выполнен выход из аккаунта');
    } catch (error) {
      console.error('[AUTH ERROR] Ошибка при выходе:', error);
    }
  },

  // Загрузка профиля пользователя
  loadProfile: async () => {
    try {
      // Проверяем токен перед запросом
      const token = await SecureStore.getItemAsync(STORAGE_KEYS.AUTH_TOKEN);
      if (!token) return;

      set({ token, isAuthenticated: true });

      const response = await apiClient.get('/api/user/profile');
      set({ user: response.data.user || response.data });
      console.log('[AUTH] Профиль успешно загружен');
    } catch (error) {
      console.error('[AUTH ERROR] Ошибка загрузки профиля:', error);
      // Если профиль не загрузился (например, токен протух), разлогиниваем
      await get().logout();
    }
  }
}));
