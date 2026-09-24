// mobile/app/(tabs)/payments/index.tsx — Экран оплаты и истории платежей «Домофондар»
// Интегрирован с ЮKassa (СБП, банковские карты, SberPay) и базой данных PostgreSQL

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { apiClient } from '@/api/client';
import { useAuthStore } from '@/store/auth.store';

export default function PaymentsScreen() {
  const { user } = useAuthStore();
  const [account, setAccount] = useState<any>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [customAmount, setCustomAmount] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [paying, setPaying] = useState(false);

  // Загрузка лицевого счета и истории платежей
  const loadPaymentData = useCallback(async () => {
    try {
      console.log('[Payments UI] Загрузка счетов и истории платежей...');
      // 1. Получаем лицевой счёт жильца
      const accRes = await apiClient.get('/api/accounts');
      if (Array.isArray(accRes.data) && accRes.data.length > 0) {
        const primaryAcc = accRes.data[0];
        setAccount(primaryAcc);
        console.log(`[Payments UI] Лицевой счёт: ${primaryAcc.account_number}`);

        // 2. Получаем историю платежей по этому лицевому счету
        if (primaryAcc.account_number) {
          try {
            const histRes = await apiClient.get(`/api/payments/yookassa/history/${primaryAcc.account_number}`);
            if (Array.isArray(histRes.data)) {
              setPayments(histRes.data);
            }
          } catch (histErr) {
            console.warn('[Payments UI] История платежей пока пуста');
          }
        }
      }
    } catch (err) {
      console.warn('[Payments UI] Ошибка загрузки счетов:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadPaymentData();
  }, [loadPaymentData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadPaymentData();
  };

  // Инициализация платежа через ЮKassa
  const handlePay = async (amountToPay: number) => {
    if (!amountToPay || amountToPay <= 0) {
      Alert.alert('Внимание', 'Пожалуйста, укажите сумму к оплате');
      return;
    }

    setPaying(true);
    try {
      const accNum = account?.account_number || '';
      console.log(`[Payments UI] Инициализация платежа на сумму: ${amountToPay} ₽ (л/с: ${accNum})`);

      const payload = {
        amount: amountToPay,
        account_number: accNum,
        description: `Оплата обслуживания домофона, л/с ${accNum || 'не указан'}`,
        return_url: 'http://45.8.99.238/cabinet?check_payment=1',
      };

      const res = await apiClient.post('/api/payments/yookassa/create', payload);
      const confirmationUrl = res.data?.confirmation_url || res.data?.payment?.confirmation?.confirmation_url;

      if (confirmationUrl) {
        console.log('[Payments UI] Открытие платёжного шлюза ЮKassa:', confirmationUrl);
        // Открываем защищенное окно браузера с поддержкой СБП и банковских карт
        await WebBrowser.openBrowserAsync(confirmationUrl);
        // После закрытия окна обновляем баланс
        loadPaymentData();
      } else {
        Alert.alert('Ошибка', 'Не удалось получить ссылку на оплату от шлюза');
      }
    } catch (err: any) {
      console.error('[Payments UI] Ошибка создания платежа:', err);
      const msg = err.response?.data?.error || 'Ошибка при обращении к платежному шлюзу ЮKassa';
      Alert.alert('Ошибка оплаты', msg);
    } finally {
      setPaying(false);
    }
  };

  const debt = account ? Number(account.debt_amount || 0) : 0;
  const hasDebt = debt > 0;

  const renderPaymentItem = ({ item }: { item: any }) => {
    const isSuccess = item.status === 'succeeded';
    const isCanceled = item.status === 'canceled';
    const amountVal = item.amount ? Number(item.amount).toFixed(2) : '0.00';
    const dateStr = item.created_at
      ? new Date(item.created_at).toLocaleDateString('ru-RU', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        })
      : '';

    return (
      <View style={styles.historyCard}>
        <View style={styles.historyIcon}>
          <Ionicons
            name={isSuccess ? 'checkmark-circle' : isCanceled ? 'close-circle' : 'time'}
            size={28}
            color={isSuccess ? '#10B981' : isCanceled ? '#EF4444' : '#F59E0B'}
          />
        </View>
        <View style={styles.historyInfo}>
          <Text style={styles.historyType}>{item.description || 'Оплата ТО'}</Text>
          <Text style={styles.historyDate}>{dateStr}</Text>
        </View>
        <View style={styles.historyRight}>
          <Text style={[styles.historyAmount, { color: isSuccess ? '#10B981' : '#F8FAFC' }]}>
            {amountVal} ₽
          </Text>
          <Text style={[styles.historyStatus, { color: isSuccess ? '#10B981' : isCanceled ? '#EF4444' : '#F59E0B' }]}>
            {isSuccess ? 'Оплачено' : isCanceled ? 'Отменён' : 'В обработке'}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.title}>Оплата и счета</Text>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color="#10B981" size="large" />
          <Text style={styles.loadingText}>Загрузка данных лицевого счета...</Text>
        </View>
      ) : (
        <FlatList
          data={payments}
          keyExtractor={(item, idx) => item.id?.toString() || idx.toString()}
          renderItem={renderPaymentItem}
          contentContainerStyle={styles.container}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#10B981" />}
          ListHeaderComponent={
            <>
              {/* Карточка баланса */}
              <View style={styles.balanceCard}>
                <View style={styles.balanceTopRow}>
                  <View>
                    <Text style={styles.accountTitle}>Лицевой счёт</Text>
                    <Text style={styles.accountNumber}>
                      {account ? account.account_number : 'Не привязан'}
                    </Text>
                  </View>
                  <View style={styles.bankLogos}>
                    <Text style={styles.sbpBadge}>СБП • Мир</Text>
                  </View>
                </View>

                {account?.address && (
                  <Text style={styles.accountAddress} numberOfLines={1}>
                    📍 {account.address}
                  </Text>
                )}

                <View style={styles.divider} />

                <Text style={styles.balanceText}>
                  {hasDebt ? 'Текущая задолженность:' : 'Баланс счета:'}
                </Text>
                <Text style={[styles.balanceAmount, { color: hasDebt ? '#EF4444' : '#10B981' }]}>
                  {hasDebt ? `${debt.toFixed(2)} ₽` : 'Задолженности нет • 0.00 ₽'}
                </Text>

                {/* Быстрая кнопка оплаты задолженности */}
                {hasDebt && (
                  <TouchableOpacity
                    style={[styles.payButton, paying && styles.payButtonDisabled]}
                    onPress={() => handlePay(debt)}
                    disabled={paying}
                    activeOpacity={0.85}
                  >
                    {paying ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <>
                        <Ionicons name="flash" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                        <Text style={styles.payButtonText}>Погасить долг ({debt.toFixed(2)} ₽)</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}

                {/* Оплата произвольной суммы */}
                <View style={styles.customPayRow}>
                  <TextInput
                    style={styles.customInput}
                    placeholder="Сумма, ₽"
                    placeholderTextColor="#64748B"
                    keyboardType="numeric"
                    value={customAmount}
                    onChangeText={setCustomAmount}
                  />
                  <TouchableOpacity
                    style={[styles.customPayButton, paying && styles.payButtonDisabled]}
                    onPress={() => handlePay(parseFloat(customAmount))}
                    disabled={paying}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.customPayButtonText}>Оплатить</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <Text style={styles.sectionTitle}>История операций</Text>
            </>
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="receipt-outline" size={40} color="#475569" />
              <Text style={styles.emptyText}>История платежей пока пуста</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0F172A' },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  title: { fontSize: 26, fontWeight: 'bold', color: '#F8FAFC' },
  container: { padding: 20, paddingBottom: 100 },
  balanceCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.15)',
    marginBottom: 28,
  },
  balanceTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  accountTitle: { color: '#94A3B8', fontSize: 13 },
  accountNumber: { color: '#F8FAFC', fontSize: 20, fontWeight: 'bold', marginTop: 2 },
  accountAddress: { color: '#94A3B8', fontSize: 13, marginTop: 6 },
  bankLogos: { flexDirection: 'row', alignItems: 'center' },
  sbpBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    color: '#10B981',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 'bold',
  },
  divider: { height: 1, backgroundColor: 'rgba(148, 163, 184, 0.1)', marginVertical: 16 },
  balanceText: { color: '#94A3B8', fontSize: 13 },
  balanceAmount: { fontSize: 28, fontWeight: 'bold', marginTop: 4, marginBottom: 16 },
  payButton: {
    backgroundColor: '#10B981',
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  payButtonDisabled: { opacity: 0.6 },
  payButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: 'bold' },
  customPayRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  customInput: {
    flex: 1,
    backgroundColor: '#1E293B',
    color: '#F8FAFC',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#334155',
    marginRight: 10,
  },
  customPayButton: {
    backgroundColor: '#334155',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 13,
    justifyContent: 'center',
    alignItems: 'center',
  },
  customPayButtonText: { color: '#F8FAFC', fontSize: 14, fontWeight: '600' },
  sectionTitle: { color: '#F8FAFC', fontSize: 18, fontWeight: '700', marginBottom: 16 },
  historyCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.08)',
  },
  historyIcon: { marginRight: 14 },
  historyInfo: { flex: 1 },
  historyType: { color: '#F8FAFC', fontSize: 15, fontWeight: '600' },
  historyDate: { color: '#94A3B8', fontSize: 12, marginTop: 4 },
  historyRight: { alignItems: 'flex-end' },
  historyAmount: { fontSize: 15, fontWeight: 'bold' },
  historyStatus: { fontSize: 12, marginTop: 2 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#94A3B8', marginTop: 12, fontSize: 14 },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingTop: 40 },
  emptyText: { color: '#64748B', fontSize: 14, marginTop: 10 },
});
