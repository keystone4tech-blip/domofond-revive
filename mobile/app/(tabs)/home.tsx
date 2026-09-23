import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
// import { useQuery } from '@tanstack/react-query';

export default function HomeScreen() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    console.log('Обновление данных на главном экране...');
    // Эмуляция загрузки данных
    setTimeout(() => {
      setRefreshing(false);
    }, 1500);
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#10B981" />}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Здравствуйте,</Text>
            <Text style={styles.name}>Иван Иванов!</Text>
          </View>
          <View style={styles.avatar}>
            <Ionicons name="person" size={24} color="#0F172A" />
          </View>
        </View>

        <View style={styles.balanceCard}>
          <Text style={styles.accountNumber}>ЛС: 123456789</Text>
          <Text style={styles.balanceText}>Задолженность:</Text>
          <Text style={[styles.balanceAmount, { color: '#EF4444' }]}>150.00 ₽</Text>
          <TouchableOpacity style={styles.payButton} onPress={() => router.push('/(tabs)/payments')}>
            <Text style={styles.payButtonText}>Оплатить</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Быстрые действия</Text>
        <View style={styles.quickActions}>
          <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/(tabs)/requests/create')}>
            <Ionicons name="clipboard-outline" size={32} color="#10B981" />
            <Text style={styles.actionText}>Создать заявку</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/(tabs)/payments')}>
            <Ionicons name="card-outline" size={32} color="#10B981" />
            <Text style={styles.actionText}>Оплатить ТО</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/(tabs)/chat')}>
            <Ionicons name="chatbubbles-outline" size={32} color="#10B981" />
            <Text style={styles.actionText}>Диспетчер</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionCard}>
            <Ionicons name="key-outline" size={32} color="#10B981" />
            <Text style={styles.actionText}>Заказать ключи</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Последние заявки</Text>
        <View style={styles.requestCard}>
          <View style={styles.requestHeader}>
            <Text style={styles.requestType}>Не работает домофон</Text>
            <View style={[styles.badge, { backgroundColor: 'rgba(59, 130, 246, 0.2)' }]}>
              <Text style={[styles.badgeText, { color: '#3B82F6' }]}>Новая</Text>
            </View>
          </View>
          <Text style={styles.requestDate}>12.10.2023</Text>
        </View>
        
        <View style={{ height: 80 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0F172A' },
  container: { padding: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25, paddingTop: 10 },
  greeting: { fontSize: 16, color: '#94A3B8' },
  name: { fontSize: 24, fontWeight: 'bold', color: '#F8FAFC' },
  avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#10B981', justifyContent: 'center', alignItems: 'center' },
  balanceCard: { backgroundColor: 'rgba(30, 41, 59, 0.8)', padding: 20, borderRadius: 16, marginBottom: 25, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  accountNumber: { fontSize: 14, color: '#94A3B8', marginBottom: 5 },
  balanceText: { fontSize: 16, color: '#F8FAFC', marginBottom: 5 },
  balanceAmount: { fontSize: 32, fontWeight: 'bold', marginBottom: 15 },
  payButton: { backgroundColor: '#10B981', padding: 15, borderRadius: 8, alignItems: 'center' },
  payButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', color: '#F8FAFC', marginBottom: 15 },
  quickActions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 25 },
  actionCard: { width: '48%', backgroundColor: 'rgba(30, 41, 59, 0.6)', padding: 15, borderRadius: 12, alignItems: 'center', marginBottom: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  actionText: { color: '#F8FAFC', marginTop: 10, textAlign: 'center', fontSize: 14 },
  requestCard: { backgroundColor: 'rgba(30, 41, 59, 0.6)', padding: 15, borderRadius: 12, marginBottom: 10 },
  requestHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  requestType: { color: '#F8FAFC', fontSize: 16, fontWeight: '500' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeText: { fontSize: 12, fontWeight: 'bold' },
  requestDate: { color: '#94A3B8', fontSize: 12 }
});
