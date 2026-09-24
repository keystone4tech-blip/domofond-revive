// mobile/app/_layout.tsx — Корневой компонент навигации приложения «Домофондар»
// Инициализирует глобальные провайдеры (React Query, тема), управляет жизненным циклом сплэш-скрина и роутингом

import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { useColorScheme, View, ActivityIndicator } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore } from '@/store/auth.store';

// Инициализация клиента кэширования серверных запросов
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 1000 * 60 * 5, // 5 минут актуальности данных
    },
  },
});

// Предотвращаем автоматическое скрытие сплэша до инициализации состояния
SplashScreen.preventAutoHideAsync().catch(() => {
  // Игнорируем ошибку, если сплэш уже скрыт
});

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const segments = useSegments();
  const [isReady, setIsReady] = useState(false);

  // Получаем состояние авторизации из глобального Zustand-стора
  const { isAuthenticated, loadProfile } = useAuthStore();

  useEffect(() => {
    // Асинхронная инициализация приложения (проверка токенов, загрузка настроек)
    async function prepareApp() {
      try {
        console.log('[App] Инициализация приложения Домофондар...');
        // Проверяем сохраненную сессию в SecureStore
        await loadProfile();
      } catch (err) {
        console.warn('[App] Ошибка фоновой загрузки профиля:', err);
      } finally {
        // Устанавливаем флаг готовности
        setIsReady(true);
        // Гарантированно скрываем нативную заставку (Splash Screen)
        console.log('[App] Скрытие сплэш-скрина');
        await SplashScreen.hideAsync().catch(() => {});
      }
    }

    prepareApp();
  }, []);

  // Защита приватных маршрутов: если сессия сброшена/не валидна, а пользователь внутри табов
  useEffect(() => {
    if (!isReady) return;

    if (!isAuthenticated && segments[0] === '(tabs)') {
      console.log('[App] Доступ запрещен. Переход на экран входа.');
      router.replace('/(auth)/login');
    }
  }, [isReady, isAuthenticated, segments]);

  // Пока идет начальная проверка, показываем фоновый цвет
  if (!isReady) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0F172A', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#10B981" />
      </View>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack screenOptions={{ headerShown: false }}>
          {/* Только реально существующие группы маршрутов */}
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        </Stack>
        <StatusBar style="light" backgroundColor="#0F172A" />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
