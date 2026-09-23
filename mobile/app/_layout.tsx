import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { useColorScheme } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';

// Инициализация QueryClient для TanStack Query
const queryClient = new QueryClient();

// Предотвращаем автоматическое скрытие сплеш-скрина
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const segments = useSegments();
  
  // Загрузка пользовательских шрифтов
  const [loaded, error] = useFonts({
    // Здесь можно добавить пользовательские шрифты
  });

  // Эмуляция проверки авторизации (в реальном проекте используем store)
  const isAuthenticated = false; // Замените на реальную логику

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      // Скрываем сплеш-скрин после загрузки
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  useEffect(() => {
    if (!loaded) return;

    const inAuthGroup = segments[0] === '(auth)';
    
    // Перенаправление в зависимости от статуса авторизации
    if (!isAuthenticated && !inAuthGroup) {
      console.log('Пользователь не авторизован. Перенаправление на экран входа.');
      router.replace('/(auth)/login');
    } else if (isAuthenticated && inAuthGroup) {
      console.log('Пользователь авторизован. Перенаправление на главную.');
      router.replace('/(tabs)/home');
    }
  }, [isAuthenticated, segments, loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="staff" options={{ headerShown: false }} />
          <Stack.Screen name="admin" options={{ headerShown: false }} />
        </Stack>
        <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
