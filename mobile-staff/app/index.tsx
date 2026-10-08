/**
 * Входная точка приложения «Офис Работа»
 * Маршрутизация на основе статуса авторизации сотрудника
 */

import React, { useEffect } from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useStaffAuthStore } from '../src/store/auth.store';

export default function IndexScreen() {
  const router = useRouter();
  const isAuthenticated = useStaffAuthStore((state) => state.isAuthenticated);
  const isLoading = useStaffAuthStore((state) => state.isLoading);

  useEffect(() => {
    // Небольшая пауза для плавного перехода
    const timer = setTimeout(() => {
      if (isAuthenticated) {
        router.replace('/(tabs)');
      } else {
        router.replace('/(auth)/login');
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [isAuthenticated]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#3B82F6" />
      <Text style={styles.text}>Офис Работа</Text>
      <Text style={styles.subtext}>Служебная система FSM</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B132B',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  text: {
    marginTop: 20,
    fontSize: 22,
    fontWeight: '700',
    color: '#F8FAFC',
    letterSpacing: 0.5,
  },
  subtext: {
    marginTop: 8,
    fontSize: 14,
    color: '#94A3B8',
  },
});
