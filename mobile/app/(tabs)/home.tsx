import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@/store/auth.store';
import { apiClient } from '@/api/client';

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, loadProfile } = useAuthStore();

  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [account, setAccount] = useState<{
    account_number: string;
    debt_amount: number;
    address?: string;
    period?: string;
  } | null>(null);
  const [recentRequests, setRecentRequests] = useState<any[]>([]);

  // Загрузка реальных данных из базы данных сервера (строгая изоляция личного кабинета)
  const loadDashboardData = useCallback(async () => {
    try {
      console.log('[Home UI] Загрузка персональных данных абонента...');

      // 1. Обновляем профиль пользователя
      await loadProfile();

      // 2. Ищем лицевой счёт СТРОГО текущего жильца через защищенный эндпоинт
      try {
        const myAccRes = await apiClient.get('/api/user/my-account');
        if (myAccRes.data && myAccRes.data.account_number) {
          console.log(`[Home UI] Лицевой счёт абонента подтвержден: ${myAccRes.data.account_number}`);
          setAccount(myAccRes.data);
        } else {
          console.log('[Home UI] Лицевой счёт к профилю пока не привязан');
          setAccount(null);
        }
      } catch (accErr) {
        console.warn('[Home UI] Ошибка при запросе лицевого счёта:', accErr);
        setAccount(null);
      }

      // 3. Получаем последние заявки СТРОГО текущего жильца
      try {
        const requestsRes = await apiClient.get('/api/user/my-requests');
        if (Array.isArray(requestsRes.data)) {
          console.log(`[Home UI] Загружено личных заявок абонента: ${requestsRes.data.length}`);
          setRecentRequests(requestsRes.data.slice(0, 3));
        } else {
          setRecentRequests([]);
        }
      } catch (reqErr) {
        console.warn('[Home UI] Личные заявки пока отсутствуют');
        setRecentRequests([]);
      }
    } catch (err) {
      console.warn('[Home UI] Ошибка при загрузке данных с сервера:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [loadProfile]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadDashboardData();
  };

  const displayName = user?.full_name || (user as any)?.email?.split('@')[0] || 'Абонент';
  const debt = account ? Number(account.debt_amount || 0) : 0;
  const hasDebt = debt > 0;

  // Динамические безопасные отступы сверху и снизу
  const safeTopPadding = Math.max(insets.top, 16) + 10;
  const safeBottomPadding = 80 + (insets.bottom > 0 ? insets.bottom : 16);

  return (
    <View style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={[styles.container, { paddingTop: safeTopPadding, paddingBottom: safeBottomPadding }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#10B981" />}
      >
        {/* Шапка с приветствием */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Здравствуйте,</Text>
            <Text style={styles.name}>{displayName}!</Text>
          </View>
          <TouchableOpacity style={styles.avatar} onPress={() => router.push('/(tabs)/profile')}>
            <Ionicons name="person" size={22} color="#10B981" />
          </TouchableOpacity>
        </View>

        {/* Карточка лицевого счета и баланса */}
        {loading ? (
          <View style={[styles.balanceCard, styles.loadingCard]}>
            <ActivityIndicator color="#10B981" />
            <Text style={styles.loadingText}>Загрузка данных лицевого счёта...</Text>
          </View>
        ) : (
          <View style={styles.balanceCard}>
            <View style={styles.balanceHeader}>
              <Text style={styles.accountNumber}>
                {account ? `ЛС: ${account.account_number}` : 'Лицевой счет не привязан'}
              </Text>
              {account?.address ? (
                <Text style={styles.accountAddress} numberOfLines={1}>
                  📍 {account.address}
                </Text>
              ) : (
                <TouchableOpacity onPress={() => router.push('/(tabs)/profile')}>
                  <Text style={styles.setupAddressLink}>+ Укажите адрес в профиле</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.balanceBody}>
              <Text style={styles.balanceLabel}>
                {hasDebt ? 'Текущая задолженность:' : 'Состояние счета:'}
              </Text>
              <Text style={[styles.balanceAmount, { color: hasDebt ? '#EF4444' : '#10B981' }]}>
                {hasDebt ? `${debt.toFixed(2)} ₽` : 'Задолженности нет • 0.00 ₽'}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.payButton}
              onPress={() => router.push('/(tabs)/payments')}
              activeOpacity={0.85}
            >
              <Ionicons name="card-outline" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.payButtonText}>
                {hasDebt ? `Оплатить ТО (${debt.toFixed(2)} ₽)` : 'Оплатить обслуживание'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Секция быстрых действий */}
        <Text style={styles.sectionTitle}>Быстрые действия</Text>
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push('/(tabs)/requests/create')}
            activeOpacity={0.8}
          >
            <View style={styles.iconCircle}>
              <Ionicons name="construct-outline" size={24} color="#10B981" />
            </View>
            <Text style={styles.actionText}>Заявка на ремонт</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push('/(tabs)/payments')}
            activeOpacity={0.8}
          >
            <View style={styles.iconCircle}>
              <Ionicons name="receipt-outline" size={24} color="#10B981" />
            </View>
            <Text style={styles.actionText}>Оплата ТО</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push('/(tabs)/requests/create')}
            activeOpacity={0.8}
          >
            <View style={styles.iconCircle}>
              <Ionicons name="key-outline" size={24} color="#10B981" />
            </View>
            <Text style={styles.actionText}>Заказ ключей</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push('/(tabs)/profile')}
            activeOpacity={0.8}
          >
            <View style={styles.iconCircle}>
              <Ionicons name="home-outline" size={24} color="#10B981" />
            </View>
            <Text style={styles.actionText}>Мой адрес</Text>
          </TouchableOpacity>
        </View>

        {/* Секция последних обращений */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Последние обращения</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/requests')}>
            <Text style={styles.seeAllText}>Все</Text>
          </TouchableOpacity>
        </View>

        {recentRequests.length === 0 ? (
          <View style={styles.emptyRequests}>
            <Ionicons name="checkmark-circle-outline" size={36} color="#64748B" />
            <Text style={styles.emptyText}>У вас нет активных заявок</Text>
          </View>
        ) : (
          recentRequests.map((req, idx) => (
            <View key={req.id || idx} style={styles.requestCard}>
              <View style={styles.requestInfo}>
                <Text style={styles.requestTitle} numberOfLines={1}>{req.name ? `Заявка: ${req.name}` : 'Обращение'}</Text>
                <Text style={styles.requestDesc} numberOfLines={1}>
                  {req.message || req.address || 'Обращение зарегистрировано'}
                </Text>
              </View>
              <View style={styles.statusBadge}>
                <Text style={styles.statusText}>{req.status || 'Новая'}</Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0F172A' },
  container: { padding: 20 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 8,
  },
  greeting: { color: '#94A3B8', fontSize: 14 },
  name: { color: '#F8FAFC', fontSize: 24, fontWeight: 'bold' },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
  },
  balanceCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.15)',
    marginBottom: 28,
  },
  loadingCard: { alignItems: 'center', justifyContent: 'center', minHeight: 140 },
  loadingText: { color: '#94A3B8', marginTop: 12, fontSize: 14 },
  balanceHeader: { marginBottom: 16 },
  accountNumber: { color: '#F8FAFC', fontSize: 18, fontWeight: '700' },
  accountAddress: { color: '#94A3B8', fontSize: 13, marginTop: 4 },
  setupAddressLink: { color: '#10B981', fontSize: 13, marginTop: 4, fontWeight: '600' },
  balanceBody: { marginBottom: 20 },
  balanceLabel: { color: '#94A3B8', fontSize: 13 },
  balanceAmount: { fontSize: 28, fontWeight: 'bold', marginTop: 4 },
  payButton: {
    backgroundColor: '#10B981',
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  payButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  sectionTitle: { color: '#F8FAFC', fontSize: 18, fontWeight: '700', marginBottom: 16 },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  seeAllText: { color: '#10B981', fontSize: 14, fontWeight: '600' },
  quickActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  actionCard: {
    width: '48%',
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.1)',
    alignItems: 'center',
    marginBottom: 14,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  actionText: { color: '#E2E8F0', fontSize: 14, fontWeight: '600', textAlign: 'center' },
  emptyRequests: {
    backgroundColor: 'rgba(30, 41, 59, 0.4)',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginTop: 8,
  },
  emptyText: { color: '#64748B', fontSize: 14, marginTop: 8 },
  requestCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.08)',
  },
  requestInfo: { flex: 1, marginRight: 12 },
  requestTitle: { color: '#F8FAFC', fontSize: 15, fontWeight: '600' },
  requestDesc: { color: '#94A3B8', fontSize: 13, marginTop: 4 },
  statusBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: { color: '#10B981', fontSize: 12, fontWeight: '600' },
});
