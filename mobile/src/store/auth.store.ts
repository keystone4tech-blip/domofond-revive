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
  register: (phone: string, password: string, fullName: string, email?: string) => Promise<void>;
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

  // Авторизация (по номеру телефона или Email)
  login: async (identifier, password) => {
    set({ isLoading: true });
    try {
      console.log(`[AUTH] Попытка входа для пользователя: ${identifier}`);
      const response = await apiClient.post('/api/auth/login', { login: identifier, password });
      
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
  register: async (phone: string, password: string, full_name: string, userEmail?: string) => {
    set({ isLoading: true });
    try {
      const cleanDigits = phone.replace(/\D/g, '');
      const email = userEmail && userEmail.trim().length > 0
        ? userEmail.trim().toLowerCase()
        : `${cleanDigits || 'resident_' + Date.now()}@domofondar.ru`;

      console.log(`[AUTH] Регистрация нового жильца: email=${email}, phone=${phone}`);
      const response = await apiClient.post('/api/auth/register', {
        email,
        password,
        full_name: full_name.trim(),
        phone: phone.trim(),
      });
      
      const token = response.data?.token;
      if (token) {
        await get().setToken(token);
        await get().loadProfile();
      } else {
        // Логинимся по созданному аккаунту
        await get().login(email, password);
      }
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
