// mobile/app/(tabs)/requests/index.tsx — Мои заявки + создание новой заявки через выбор действия
// Кнопка «Новая заявка» открывает выбор (Ремонт / Трубка / Ключи / Диспетчер), как плитки на главной.

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Modal,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { apiClient } from '@/api/client';
import { useAppTheme } from '@/theme';
import { useAuthStore } from '@/store/auth.store';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';
import { RepairModal } from '@/components/RepairModal';
import { KeyOrderModal } from '@/components/KeyOrderModal';
import { HandsetOrderModal } from '@/components/HandsetOrderModal';

const DISPATCHER_PHONE = '+79034118393';

export default function RequestsScreen() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useAppTheme();
  const { user } = useAuthStore();

  const [requests, setRequests] = useState<any[]>([]);
  const [account, setAccount] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [chooserOpen, setChooserOpen] = useState(false);
  const [repairOpen, setRepairOpen] = useState(false);
  const [keyOpen, setKeyOpen] = useState(false);
  const [handsetOpen, setHandsetOpen] = useState(false);

  const fetchRequests = useCallback(async () => {
    try {
      const res = await apiClient.get('/api/user/my-requests');
      if (Array.isArray(res.data)) setRequests(res.data);
    } catch (err) {
      console.warn('[Requests] Ошибка загрузки заявок:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const fetchAccount = useCallback(async () => {
    try {
      const res = await apiClient.get('/api/user/my-account');
      if (res.data && res.data.account_number) setAccount(res.data);
    } catch { /* нет л/с — не критично */ }
  }, []);

  useEffect(() => { fetchRequests(); fetchAccount(); }, [fetchRequests, fetchAccount]);

  // Обновление «почти в реальном времени»: лёгкий опрос при активном экране (25 сек),
  // мгновенно при открытии экрана и возврате из фона, без нагрузки в фоне/оффлайне.
  useAutoRefresh(() => { fetchRequests(); fetchAccount(); });

  const onRefresh = () => { setRefreshing(true); fetchRequests(); fetchAccount(); };

  const defaultAddress = account?.address || (user as any)?.address || '';

  const pick = (action: 'repair' | 'handset' | 'key' | 'dispatcher') => {
    setChooserOpen(false);
    if (action === 'dispatcher') {
      Linking.openURL(`tel:${DISPATCHER_PHONE}`);
      return;
    }
    // небольшая задержка, чтобы окно выбора успело закрыться
    setTimeout(() => {
      if (action === 'repair') setRepairOpen(true);
      else if (action === 'handset') setHandsetOpen(true);
      else if (action === 'key') setKeyOpen(true);
    }, 180);
  };

  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'done': case 'completed': case 'resolved': case 'выполнена':
        return { label: 'Выполнена', color: colors.secondary, bg: isDark ? 'rgba(16, 185, 129, 0.15)' : '#ecfdf5' };
      case 'in_progress': case 'в работе':
        return { label: 'В работе', color: colors.warning, bg: isDark ? 'rgba(245, 158, 11, 0.15)' : '#fef3c7' };
      case 'rejected': case 'cancelled': case 'отклонена':
        return { label: 'Отклонена', color: colors.error, bg: isDark ? 'rgba(239, 68, 68, 0.15)' : '#fee2e2' };
      default:
        return { label: 'Принята', color: colors.primaryContainer, bg: isDark ? 'rgba(14, 165, 233, 0.15)' : '#e0f2fe' };
    }
  };

  const renderItem = ({ item }: { item: any }) => {
    const badge = getStatusBadge(item.status);
    const dateStr = item.created_at ? new Date(item.created_at).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
    const cleanMessage = item.message?.replace(/📱.*?\]\n?/, '').replace(/🛡️|📝|🛍️/g, '').trim() || 'Обращение зарегистрировано';
    return (
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.cardHeader}>
          <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>{item.name ? `Заявка от ${item.name}` : 'Обращение'}</Text>
          <View style={[styles.badge, { backgroundColor: badge.bg }]}><Text style={[styles.badgeText, { color: badge.color }]}>{badge.label}</Text></View>
        </View>
        <Text style={[styles.description, { color: colors.textSecondary }]} numberOfLines={3}>{cleanMessage}</Text>
        <View style={[styles.cardFooter, { borderTopColor: colors.border }]}>
          {item.address ? <Text style={[styles.addressText, { color: colors.textMuted }]} numberOfLines={1}>📍 {item.address}</Text> : <View />}
          {dateStr ? <Text style={[styles.dateText, { color: colors.textMuted }]}>{dateStr}</Text> : null}
        </View>
      </View>
    );
  };

  const safeTop = Math.max(insets.top, 16) + 8;
  const safeBottom = Math.max(insets.bottom, 12) + 75;

  const actions = [
    { key: 'repair', icon: 'construct', title: 'Ремонт домофона', desc: 'Вызов мастера при поломке', color: colors.primaryContainer },
    { key: 'handset', icon: 'call', title: 'Заказ / замена трубки', desc: 'Оборудование и монтаж', color: colors.primaryContainer },
    { key: 'key', icon: 'key', title: 'Заказ ключей', desc: 'Электронные чипы', color: colors.warning },
    { key: 'dispatcher', icon: 'headset', title: 'Диспетчер', desc: '+7 (903) 411-83-93', color: colors.secondary },
  ] as const;

  return (
    <View style={[styles.safeArea, { backgroundColor: colors.background, paddingTop: safeTop }]}>
      <View style={styles.header}>
        <View style={{ flex: 1, marginRight: 12 }}>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>Мои заявки</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]} numberOfLines={1}>История обращений и нарядов</Text>
        </View>
        <TouchableOpacity style={[styles.createButton, { backgroundColor: colors.primaryContainer }]} onPress={() => setChooserOpen(true)} activeOpacity={0.85}>
          <Ionicons name="add" size={18} color="#ffffff" />
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
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>Создайте новую заявку — выберите нужное действие.</Text>
          <TouchableOpacity style={[styles.emptyButton, { backgroundColor: colors.primaryContainer }]} onPress={() => setChooserOpen(true)} activeOpacity={0.85}>
            <Text style={styles.emptyButtonText}>Новая заявка</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={[styles.listContainer, { paddingBottom: safeBottom }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primaryContainer} />}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Выбор действия для новой заявки */}
      <Modal visible={chooserOpen} animationType="slide" transparent onRequestClose={() => setChooserOpen(false)}>
        <TouchableOpacity style={styles.chooserOverlay} activeOpacity={1} onPress={() => setChooserOpen(false)}>
          <View style={[styles.chooserSheet, { backgroundColor: colors.background, borderColor: colors.border, paddingBottom: Math.max(insets.bottom, 16) }]}>
            <View style={styles.chooserHandle} />
            <Text style={[styles.chooserTitle, { color: colors.text }]}>Новая заявка</Text>
            <Text style={[styles.chooserSub, { color: colors.textSecondary }]}>Выберите, что вам нужно</Text>
            {actions.map((a) => (
              <TouchableOpacity key={a.key} style={[styles.actionRow, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => pick(a.key as any)} activeOpacity={0.8}>
                <View style={[styles.actionIcon, { backgroundColor: isDark ? '#262a35' : '#eff4ff' }]}>
                  <Ionicons name={a.icon as any} size={22} color={a.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.actionTitle, { color: colors.text }]}>{a.title}</Text>
                  <Text style={[styles.actionDesc, { color: colors.textSecondary }]}>{a.desc}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      <RepairModal visible={repairOpen} onClose={() => setRepairOpen(false)} onSuccess={fetchRequests} user={user} defaultAddress={defaultAddress} />
      <KeyOrderModal visible={keyOpen} onClose={() => setKeyOpen(false)} onSuccess={fetchRequests} user={user} account={account} defaultAddress={defaultAddress} />
      <HandsetOrderModal visible={handsetOpen} onClose={() => setHandsetOpen(false)} onSuccess={fetchRequests} user={user} account={account} defaultAddress={defaultAddress} />
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 16 },
  title: { fontSize: 24, fontWeight: '800' },
  subtitle: { fontSize: 13, marginTop: 2 },
  createButton: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, gap: 4 },
  createButtonText: { color: '#ffffff', fontWeight: '700', fontSize: 13 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  loadingText: { marginTop: 12, fontSize: 14 },
  emptyIconCircle: { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 17, fontWeight: '700', textAlign: 'center' },
  emptySubtitle: { fontSize: 13, textAlign: 'center', marginTop: 6, lineHeight: 18 },
  emptyButton: { marginTop: 20, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10 },
  emptyButtonText: { color: '#ffffff', fontWeight: '700', fontSize: 14 },
  listContainer: { paddingHorizontal: 16, gap: 12 },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    elevation: 3,
    shadowColor: '#1e3a8a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cardTitle: { fontSize: 15, fontWeight: '700', flex: 1, marginRight: 8 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  description: { fontSize: 13, lineHeight: 18, marginBottom: 12 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTopWidth: 1 },
  addressText: { fontSize: 12, flex: 1, marginRight: 8 },
  dateText: { fontSize: 11 },
  chooserOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  chooserSheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: 1, paddingHorizontal: 16, paddingTop: 10 },
  chooserHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(148,163,184,0.4)', alignSelf: 'center', marginBottom: 12 },
  chooserTitle: { fontSize: 18, fontWeight: '800' },
  chooserSub: { fontSize: 13, marginTop: 2, marginBottom: 14 },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 10,
    elevation: 2,
    shadowColor: '#1e3a8a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
  },
  actionIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  actionTitle: { fontSize: 15, fontWeight: '700' },
  actionDesc: { fontSize: 12, marginTop: 2 },
});
