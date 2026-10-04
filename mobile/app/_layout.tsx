// mobile/app/_layout.tsx — Корневой компонент навигации приложения «Домофондар»
// Инициализирует глобальные провайдеры (React Query, тема), управляет жизненным циклом сплэш-скрина и роутингом

import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { Appearance, View, ActivityIndicator } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore } from '@/store/auth.store';
import { useThemeStore } from '@/store/theme.store';
import { UpdateCheckerModal } from '@/components/UpdateCheckerModal';

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
  const router = useRouter();
  const segments = useSegments();
  const [isReady, setIsReady] = useState(false);

  // Получаем состояние авторизации из глобального Zustand-стора
  const { isAuthenticated, loadProfile } = useAuthStore();

  // Тема приложения из стора: по умолчанию системная (с откатом на светлую)
  const resolvedTheme = useThemeStore((s) => s.resolvedTheme);
  const loadTheme = useThemeStore((s) => s.loadTheme);
  const updateResolvedTheme = useThemeStore((s) => s.updateResolvedTheme);
  const isDark = resolvedTheme === 'dark';

  // Реагируем на смену системной темы в реальном времени (когда выбран режим «система»)
  useEffect(() => {
    const sub = Appearance.addChangeListener(() => updateResolvedTheme());
    return () => sub.remove();
  }, [updateResolvedTheme]);

  useEffect(() => {
    // Асинхронная инициализация приложения (проверка токенов, загрузка настроек)
    async function prepareApp() {
      try {
        console.log('[App] Инициализация приложения Домофондар...');
        // Загружаем сохранённый выбор темы (по умолчанию — системная)
        await loadTheme();
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

  // Пока идет начальная проверка, показываем фоновый цвет (тёмный сплэш как на сайте)
  if (!isReady) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0F172A', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#10B981" />
      </View>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
        <Stack screenOptions={{ headerShown: false }}>
          {/* Только реально существующие группы маршрутов */}
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        </Stack>
        {/* Иконки статус-бара следуют теме: светлые на тёмной, тёмные на светлой */}
        <StatusBar style={isDark ? 'light' : 'dark'} />
        {/* Глобальное модальное окно автопроверки и установки обновлений приложения */}
        <UpdateCheckerModal />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
