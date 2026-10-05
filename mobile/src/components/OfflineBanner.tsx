// mobile/src/components/OfflineBanner.tsx — Глобальная плашка «нет интернета»
// Показывается поверх всего приложения, когда пропадает связь с сервером.
// НЕ выкидывает пользователя из кабинета — просто информирует, что данные не обновляются.

import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import NetInfo from '@react-native-community/netinfo';
import { useAuthStore } from '@/store/auth.store';

export function OfflineBanner() {
  const insets = useSafeAreaInsets();
  const isOffline = useAuthStore((s) => s.isOffline);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const setOffline = useAuthStore((s) => s.setOffline);

  // Слушаем состояние сети устройства — мгновенно реагируем на потерю/восстановление связи
  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      const online = !!state.isConnected && state.isInternetReachable !== false;
      if (!online) {
        setOffline(true);
      }
      // Восстановление связи подтверждаем успешным ответом API (в client.ts),
      // поэтому здесь при online флаг НЕ снимаем принудительно.
    });
    return () => unsub();
  }, [setOffline]);

  // Плашку показываем только авторизованному пользователю в оффлайне
  if (!isAuthenticated || !isOffline) return null;

  return (
    <View style={[styles.wrap, { paddingTop: Math.max(insets.top, 8) }]} pointerEvents="none">
      <View style={styles.banner}>
        <Text style={styles.icon}>⚠️</Text>
        <Text style={styles.text}>Нет подключения к интернету — данные могут быть неактуальны</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    alignItems: 'center',
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#B45309',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    maxWidth: '96%',
    ...Platform.select({
      android: { elevation: 6 },
      default: { shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
    }),
  },
  icon: { fontSize: 13 },
  text: { color: '#fff', fontSize: 12, fontWeight: '600', flexShrink: 1 },
});
