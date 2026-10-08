/**
 * Экран «Служебные оповещения» — Приложение «Офис Работа»
 * Уведомления о назначении нарядов, аварийных вызовах и сообщениях диспетчера
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface StaffNotification {
  id: string;
  title: string;
  message: string;
  time: string;
  type: 'urgent' | 'assignment' | 'system' | 'message';
  is_read: boolean;
}

const INITIAL_NOTIFICATIONS: StaffNotification[] = [
  {
    id: 'n-1',
    title: '⚡ Срочная авария по домофону',
    message: 'ул. Тургенева, 152: подъезд 2 — дверь заблокирована в открытом положении, жильцы вызывают мастера.',
    time: '12 минут назад',
    type: 'urgent',
    is_read: false,
  },
  {
    id: 'n-2',
    title: '📋 Назначен новый наряд',
    message: 'Вам назначен наряд № 4282: монтаж новой трубки по адресу ул. Ставропольская, 84/1, кв. 14.',
    time: '1 час назад',
    type: 'assignment',
    is_read: false,
  },
  {
    id: 'n-3',
    title: '💳 Оплата получена онлайн',
    message: 'Абонент Семенова О.И. (кв. 42) оплатила выставленный счет на 550 ₽ через СБП.',
    time: '3 часа назад',
    type: 'system',
    is_read: true,
  },
  {
    id: 'n-4',
    title: '💬 Сообщение диспетчера смены',
    message: 'Напоминание: после 18:00 дежурство по аварийным вызовам переходит экипажу №2.',
    time: 'Сегодня, 09:30',
    type: 'message',
    is_read: true,
  },
];

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState(INITIAL_NOTIFICATIONS);

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  const getIcon = (type: StaffNotification['type']) => {
    switch (type) {
      case 'urgent':
        return { name: 'warning', color: '#EF4444', bg: 'rgba(239, 68, 68, 0.15)' };
      case 'assignment':
        return { name: 'clipboard', color: '#38BDF8', bg: 'rgba(56, 189, 248, 0.15)' };
      case 'system':
        return { name: 'checkmark-circle', color: '#10B981', bg: 'rgba(16, 185, 129, 0.15)' };
      default:
        return { name: 'chatbubble-ellipses', color: '#A78BFA', bg: 'rgba(167, 139, 250, 0.15)' };
    }
  };

  const renderItem = ({ item }: { item: StaffNotification }) => {
    const iconMeta = getIcon(item.type);

    return (
      <View style={[styles.card, !item.is_read && styles.cardUnread]}>
        <View style={[styles.iconWrap, { backgroundColor: iconMeta.bg }]}>
          <Ionicons name={iconMeta.name as any} size={20} color={iconMeta.color} />
        </View>

        <View style={styles.cardContent}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardTime}>{item.time}</Text>
          </View>
          <Text style={styles.cardMessage}>{item.message}</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Оповещения</Text>
          <Text style={styles.headerSubtitle}>Рабочие уведомления и сигналы</Text>
        </View>
        <TouchableOpacity style={styles.readAllBtn} onPress={markAllAsRead}>
          <Text style={styles.readAllText}>Прочитать все</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B132B',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : 36,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  readAllBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#1E293B',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  readAllText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#38BDF8',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 30,
    gap: 10,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardUnread: {
    borderColor: 'rgba(56, 189, 248, 0.4)',
    backgroundColor: '#1E293B',
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cardContent: {
    flex: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F8FAFC',
    flex: 1,
    marginRight: 8,
  },
  cardTime: {
    fontSize: 10,
    color: '#64748B',
  },
  cardMessage: {
    fontSize: 12,
    color: '#94A3B8',
    lineHeight: 17,
  },
});
