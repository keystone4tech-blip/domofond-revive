// mobile/app/(tabs)/requests/index.tsx — Список заявок абонента «Домофондар»
// Загружает реальные заявки из базы данных PostgreSQL через GET /api/requests

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '@/api/client';

export default function RequestsScreen() {
  const router = useRouter();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchRequests = useCallback(async () => {
    try {
      console.log('[Requests UI] Запрос списка заявок...');
      const res = await apiClient.get('/api/requests');
      if (Array.isArray(res.data)) {
        setRequests(res.data);
      }
    } catch (err) {
      console.warn('[Requests UI] Ошибка загрузки заявок:', err);
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
      case 'выполнена':
        return { label: 'Выполнена', color: '#10B981', bg: 'rgba(16, 185, 129, 0.15)' };
      case 'in_progress':
      case 'в работе':
        return { label: 'В работе', color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.15)' };
      case 'rejected':
      case 'отклонена':
        return { label: 'Отклонена', color: '#EF4444', bg: 'rgba(239, 68, 68, 0.15)' };
      default:
        return { label: 'Новая', color: '#38BDF8', bg: 'rgba(56, 189, 248, 0.15)' };
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

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {item.name ? `Заявка от ${item.name}` : 'Обращение в техподдержку'}
          </Text>
          <View style={[styles.badge, { backgroundColor: badge.bg }]}>
            <Text style={[styles.badgeText, { color: badge.color }]}>{badge.label}</Text>
          </View>
        </View>

        <Text style={styles.description}>
          {item.message || item.description || 'Без описания'}
        </Text>

        <View style={styles.cardFooter}>
          {item.address ? (
            <Text style={styles.addressText} numberOfLines={1}>
              📍 {item.address}
            </Text>
          ) : null}
          {dateStr ? <Text style={styles.dateText}>{dateStr}</Text> : null}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.title}>Мои заявки</Text>
        <TouchableOpacity
          style={styles.newButton}
          onPress={() => router.push('/(tabs)/requests/create')}
        >
          <Ionicons name="add" size={20} color="#FFFFFF" />
          <Text style={styles.newButtonText}>Создать</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color="#10B981" size="large" />
          <Text style={styles.loadingText}>Загрузка истории обращений...</Text>
        </View>
      ) : (
        <FlatList
          data={requests}
          renderItem={renderItem}
          keyExtractor={(item, idx) => item.id?.toString() || idx.toString()}
          contentContainerStyle={styles.listContainer}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#10B981" />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="clipboard-outline" size={48} color="#475569" />
              <Text style={styles.emptyTitle}>Заявок пока нет</Text>
              <Text style={styles.emptySubtitle}>
                Если домофон не работает или нужны ключи — создайте заявку
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0F172A' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  title: { fontSize: 26, fontWeight: 'bold', color: '#F8FAFC' },
  newButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10B981',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  newButtonText: { color: '#FFFFFF', fontWeight: 'bold', marginLeft: 4, fontSize: 14 },
  listContainer: { padding: 20, paddingBottom: 100 },
  card: {
    backgroundColor: 'rgba(30, 41, 59, 0.75)',
    padding: 16,
    borderRadius: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.1)',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardTitle: { color: '#F8FAFC', fontSize: 16, fontWeight: '700', flex: 1, marginRight: 8 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 12, fontWeight: 'bold' },
  description: { color: '#E2E8F0', fontSize: 14, lineHeight: 20, marginBottom: 12 },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(148, 163, 184, 0.08)',
    paddingTop: 10,
  },
  addressText: { color: '#94A3B8', fontSize: 12, flex: 1, marginRight: 8 },
  dateText: { color: '#64748B', fontSize: 12 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#94A3B8', marginTop: 12, fontSize: 14 },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyTitle: { color: '#F8FAFC', fontSize: 18, fontWeight: 'bold', marginTop: 16 },
  emptySubtitle: { color: '#64748B', fontSize: 14, textAlign: 'center', marginTop: 6, paddingHorizontal: 32 },
});
