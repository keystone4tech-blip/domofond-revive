/**
 * Корневой макет приложения «Офис Работа»
 * Отвечает за инициализацию навигации, шрифтов и глобального состояния
 */

import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useStaffAuthStore } from '../src/store/auth.store';
import { useStaffTasksStore } from '../src/store/tasks.store';
import { UpdateCheckerModal } from '../src/components/UpdateCheckerModal';

export default function RootLayout() {
  const checkAuth = useStaffAuthStore((state) => state.checkAuth);
  const loadTasks = useStaffTasksStore((state) => state.loadTasks);

  useEffect(() => {
    // Проверяем сохраненную сессию при старте
    checkAuth();
    // Инициализируем реестр нарядов
    loadTasks();
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="light" backgroundColor="#0B132B" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#0B132B' },
          animation: 'fade',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)/login" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
      </Stack>
      {/* Модальное окно автопроверки и установки обновлений */}
      <UpdateCheckerModal />
    </SafeAreaProvider>
  );
}
