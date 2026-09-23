/**
 * Zustand store для управления темой приложения
 */
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '@/config/constants';
import { Appearance } from 'react-native';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeState {
  colorScheme: ThemeMode;
  resolvedTheme: 'light' | 'dark'; // Вычисленная тема, если выбрана системная
  
  // Действия
  setTheme: (mode: ThemeMode) => Promise<void>;
  loadTheme: () => Promise<void>;
  updateResolvedTheme: () => void;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  colorScheme: 'system',
  resolvedTheme: Appearance.getColorScheme() === 'dark' ? 'dark' : 'light',

  // Установка новой темы
  setTheme: async (mode: ThemeMode) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.THEME_MODE, mode);
      const isSystemDark = Appearance.getColorScheme() === 'dark';
      
      set({ 
        colorScheme: mode,
        resolvedTheme: mode === 'system' ? (isSystemDark ? 'dark' : 'light') : mode,
      });
      console.log(`[THEME] Тема изменена на: ${mode}`);
    } catch (error) {
      console.error('[THEME ERROR] Ошибка сохранения темы:', error);
    }
  },

  // Загрузка сохраненной темы при старте
  loadTheme: async () => {
    try {
      const savedMode = await AsyncStorage.getItem(STORAGE_KEYS.THEME_MODE) as ThemeMode | null;
      if (savedMode) {
        const isSystemDark = Appearance.getColorScheme() === 'dark';
        set({ 
          colorScheme: savedMode,
          resolvedTheme: savedMode === 'system' ? (isSystemDark ? 'dark' : 'light') : savedMode,
        });
      }
    } catch (error) {
      console.error('[THEME ERROR] Ошибка загрузки темы:', error);
    }
  },

  // Обновление вычисленной темы (например, при смене системной темы)
  updateResolvedTheme: () => {
    const { colorScheme } = get();
    if (colorScheme === 'system') {
      const isSystemDark = Appearance.getColorScheme() === 'dark';
      set({ resolvedTheme: isSystemDark ? 'dark' : 'light' });
    }
  }
}));
