import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const mockHistory = [
  { id: '1', amount: '150.00 ₽', date: '01.10.2023', status: 'succeeded', type: 'Оплата ТО' },
  { id: '2', amount: '150.00 ₽', date: '01.09.2023', status: 'succeeded', type: 'Оплата ТО' },
  { id: '3', amount: '150.00 ₽', date: '01.08.2023', status: 'canceled', type: 'Оплата ТО' },
];

export default function PaymentsScreen() {
  const handlePay = () => {
    console.log('Инициализация оплаты...');
  };

  const renderItem = ({ item }: { item: any }) => (
    <View style={styles.historyCard}>
      <View style={styles.historyIcon}>
        <Ionicons 
          name={item.status === 'succeeded' ? 'checkmark-circle' : 'close-circle'} 
          size={32} 
          color={item.status === 'succeeded' ? '#10B981' : '#EF4444'} 
        />
      </View>
      <View style={styles.historyInfo}>
        <Text style={styles.historyType}>{item.type}</Text>
        <Text style={styles.historyDate}>{item.date}</Text>
      </View>
      <View style={styles.historyRight}>
        <Text style={styles.historyAmount}>{item.amount}</Text>
        {item.status === 'succeeded' && (
          <TouchableOpacity>
            <Text style={styles.receiptText}>Чек</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.title}>Платежи</Text>
      </View>

      <FlatList
        data={mockHistory}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.container}
        ListHeaderComponent={
          <>
            <View style={styles.balanceCard}>
              <Text style={styles.accountTitle}>Лицевой счёт</Text>
              <Text style={styles.accountNumber}>12345 67890</Text>
              <View style={styles.divider} />
              <Text style={styles.balanceText}>К оплате:</Text>
              <Text style={styles.balanceAmount}>150.00 ₽</Text>
              <TouchableOpacity style={styles.payButton} onPress={handlePay}>
                <Text style={styles.payButtonText}>Оплатить картой</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.sectionTitle}>История платежей</Text>
          </>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0F172A' },
  header: { padding: 20, paddingTop: 10 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#F8FAFC' },
  container: { padding: 20, paddingBottom: 100 },
  balanceCard: { backgroundColor: 'rgba(30, 41, 59, 0.8)', padding: 20, borderRadius: 16, marginBottom: 30, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  accountTitle: { color: '#94A3B8', fontSize: 14 },
  accountNumber: { color: '#F8FAFC', fontSize: 18, fontWeight: 'bold', marginTop: 5 },
  divider: { height: 1, backgroundColor: '#334155', marginVertical: 15 },
  balanceText: { color: '#94A3B8', fontSize: 14 },
  balanceAmount: { color: '#EF4444', fontSize: 36, fontWeight: 'bold', marginVertical: 10 },
  payButton: { backgroundColor: '#10B981', padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 10 },
  payButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', color: '#F8FAFC', marginBottom: 15 },
  historyCard: { flexDirection: 'row', backgroundColor: 'rgba(30, 41, 59, 0.5)', padding: 15, borderRadius: 12, marginBottom: 10, alignItems: 'center' },
  historyIcon: { marginRight: 15 },
  historyInfo: { flex: 1 },
  historyType: { color: '#F8FAFC', fontSize: 16, fontWeight: '500' },
  historyDate: { color: '#94A3B8', fontSize: 12, marginTop: 4 },
  historyRight: { alignItems: 'flex-end' },
  historyAmount: { color: '#F8FAFC', fontSize: 16, fontWeight: 'bold' },
  receiptText: { color: '#10B981', fontSize: 12, marginTop: 5 }
});
