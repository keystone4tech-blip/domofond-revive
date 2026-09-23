import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const mockRequests = [
  { id: '1', type: 'Ремонт', description: 'Не работает трубка', status: 'В работе', date: '11.10.2023', color: '#F59E0B' },
  { id: '2', type: 'Заказ ключей', description: '2 ключа для 45 кв', status: 'Выполнена', date: '05.10.2023', color: '#10B981' },
];

export default function RequestsScreen() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1500);
  }, []);

  const renderItem = ({ item }: { item: any }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.type}>{item.type}</Text>
        <View style={[styles.badge, { backgroundColor: `${item.color}20` }]}>
          <Text style={[styles.badgeText, { color: item.color }]}>{item.status}</Text>
        </View>
      </View>
      <Text style={styles.description}>{item.description}</Text>
      <Text style={styles.date}>{item.date}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.title}>Мои заявки</Text>
      </View>
      
      <FlatList
        data={mockRequests}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#10B981" />}
        ListEmptyComponent={<Text style={styles.emptyText}>У вас пока нет заявок</Text>}
      />

      <TouchableOpacity style={styles.fab} onPress={() => router.push('/(tabs)/requests/create')}>
        <Ionicons name="add" size={30} color="#FFF" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0F172A' },
  header: { padding: 20, paddingTop: 10 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#F8FAFC' },
  listContainer: { padding: 20, paddingBottom: 100 },
  card: { backgroundColor: 'rgba(30, 41, 59, 0.8)', padding: 15, borderRadius: 12, marginBottom: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  type: { color: '#F8FAFC', fontSize: 18, fontWeight: '600' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeText: { fontSize: 12, fontWeight: 'bold' },
  description: { color: '#CBD5E1', fontSize: 14, marginBottom: 10 },
  date: { color: '#94A3B8', fontSize: 12 },
  emptyText: { color: '#94A3B8', textAlign: 'center', marginTop: 50, fontSize: 16 },
  fab: { position: 'absolute', bottom: 90, right: 20, width: 60, height: 60, borderRadius: 30, backgroundColor: '#10B981', justifyContent: 'center', alignItems: 'center', elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 3 },
});
