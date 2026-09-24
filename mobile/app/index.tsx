// mobile/app/index.tsx — Стартовый шлюз приложения «Домофондар»
// Автоматически перенаправляет авторизованных абонентов на главную, а новых — на экран входа

import React from 'react';
import { Redirect } from 'expo-router';
import { useAuthStore } from '@/store/auth.store';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';

export default function Index() {
  const { isAuthenticated, isLoading } = useAuthStore();

  // Если стор еще проверяет токен из SecureStore
  if (isLoading) {
    return (
      <View style={styles.container}>
        <Text style={styles.logoText}>Домофондар</Text>
        <Text style={styles.subText}>Сервис умного доступа</Text>
        <ActivityIndicator size="large" color="#10B981" style={styles.loader} />
      </View>
    );
  }

  // Безопасный декларативный редирект Expo Router
  return <Redirect href={isAuthenticated ? '/(tabs)/home' : '/(auth)/login'} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F172A',
  },
  logoText: {
    color: '#10B981',
    fontSize: 34,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  subText: {
    color: '#94A3B8',
    fontSize: 15,
    marginTop: 8,
  },
  loader: {
    marginTop: 28,
  },
});
