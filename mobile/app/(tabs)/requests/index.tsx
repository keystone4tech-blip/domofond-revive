// mobile/app/(tabs)/requests/index.tsx — Список обращений абонента в стиле Domofondar CyberShield
// Загружает персональные заявки текущего пользователя и позволяет создать новое обращение

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { apiClient } from '@/api/client';
import { useAppTheme } from '@/theme';

export default function RequestsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useAppTheme();

  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Загружаем только обращения авторизованного пользователя
  const fetchRequests = useCallback(async () => {
    try {
      console.log('[Requests CyberShield] Запрос личных заявок через /api/user/my-requests...');
      const res = await apiClient.get('/api/user/my-requests');
      if (Array.isArray(res.data)) {
        setRequests(res.data);
      }
    } catch (err) {
      console.warn('[Requests CyberShield] Ошибка загрузки личных заявок:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchRequests();
  };

  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'done':
      case 'completed':
      case 'resolved':
      case 'выполнена':
        return { label: 'Выполнена', color: colors.secondary, bg: isDark ? 'rgba(16, 185, 129, 0.15)' : '#ecfdf5' };
      case 'in_progress':
      case 'в работе':
        return { label: 'В работе', color: colors.warning, bg: isDark ? 'rgba(245, 158, 11, 0.15)' : '#fef3c7' };
      case 'rejected':
      case 'отклонена':
        return { label: 'Отклонена', color: colors.error, bg: isDark ? 'rgba(239, 68, 68, 0.15)' : '#fee2e2' };
      default:
        return { label: 'Принята', color: colors.primaryContainer, bg: isDark ? 'rgba(14, 165, 233, 0.15)' : '#e0f2fe' };
    }
  };

  const renderItem = ({ item }: { item: any }) => {
    const badge = getStatusBadge(item.status);
    const dateStr = item.created_at
      ? new Date(item.created_at).toLocaleDateString('ru-RU', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        })
      : '';

    // Очищаем служебный префикс мобильного приложения для аккуратного чтения жильцом
    const cleanMessage = item.message?.replace(/📱 \[Мобильное приложение.*?\]\n?/, '') || 'Обращение зарегистрировано';

    return (
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.cardHeader}>
          <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>
            {item.name ? `Заявка от ${item.name}` : 'Обращение в техподдержку'}
          </Text>
          <View style={[styles.badge, { backgroundColor: badge.bg }]}>
            <Text style={[styles.badgeText, { color: badge.color }]}>{badge.label}</Text>
          </View>
        </View>

        <Text style={[styles.description, { color: colors.textSecondary }]}>
          {cleanMessage}
        </Text>

        <View style={[styles.cardFooter, { borderTopColor: colors.border }]}>
          {item.address ? (
            <Text style={[styles.addressText, { color: colors.textMuted }]} numberOfLines={1}>
              📍 {item.address}
            </Text>
          ) : <View />}
          {dateStr ? <Text style={[styles.dateText, { color: colors.textMuted }]}>{dateStr}</Text> : null}
        </View>
      </View>
    );
  };

  const safeTop = Math.max(insets.top, 16) + 8;
  const safeBottom = Math.max(insets.bottom, 12) + 75;

  return (
    <View style={[styles.safeArea, { backgroundColor: colors.background, paddingTop: safeTop }]}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: colors.text }]}>Мои заявки</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            История обращений и нарядов мастеров
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.createButton, { backgroundColor: colors.primaryContainer }]}
          onPress={() => router.push('/(tabs)/requests/create')}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={20} color="#ffffff" />
          <Text style={styles.createButtonText}>Новая</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primaryContainer} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Загрузка ваших обращений...</Text>
        </View>
      ) : requests.length === 0 ? (
        <View style={styles.centerContainer}>
          <View style={[styles.emptyIconCircle, { backgroundColor: isDark ? '#1c1f2a' : '#eff4ff' }]}>
            <Ionicons name="clipboard-outline" size={36} color={colors.primaryContainer} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>У вас нет открытых заявок</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            Если домофон работает со сбоями или вам нужны ключи, создайте заявку в один клик.
          </Text>
          <TouchableOpacity
            style={[styles.emptyButton, { backgroundColor: colors.primaryContainer }]}
            onPress={() => router.push('/(tabs)/requests/create')}
            activeOpacity={0.8}
          >
            <Text style={styles.emptyButtonText}>Создать заявку</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={[styles.listContainer, { paddingBottom: safeBottom }]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primaryContainer}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  title: { fontSize: 24, fontWeight: '800' },
  subtitle: { fontSize: 13, marginTop: 2 },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 4,
    elevation: 2,
    shadowColor: '#0ea5e9',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  createButtonText: { color: '#ffffff', fontWeight: '700', fontSize: 13 },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: { marginTop: 12, fontSize: 14 },
  emptyIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: { fontSize: 17, fontWeight: '700', textAlign: 'center' },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  emptyButton: {
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  emptyButtonText: { color: '#ffffff', fontWeight: '700', fontSize: 14 },
  listContainer: { paddingHorizontal: 16, gap: 12 },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', flex: 1, marginRight: 8 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  description: { fontSize: 13, lineHeight: 18, marginBottom: 12 },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
  },
  addressText: { fontSize: 12, flex: 1, marginRight: 8 },
  dateText: { fontSize: 11 },
});
