// mobile/app/(tabs)/payments/index.tsx — Экран оплаты и истории платежей «Домофондар»
// В дизайне Domofondar CyberShield с поддержкой тем Cyber Dark и Clean Tech

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import { apiClient } from '@/api/client';
import { useAppTheme } from '@/theme';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';

export default function PaymentsScreen() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useAppTheme();

  const [account, setAccount] = useState<any>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [customAmount, setCustomAmount] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [paying, setPaying] = useState(false);

  // Загрузка персонального лицевого счета и истории платежей текущего жильца
  const loadPaymentData = useCallback(async () => {
    try {
      console.log('[Payments CyberShield] Загрузка данных счета абонента...');
      const accRes = await apiClient.get('/api/user/my-account');
      if (accRes.data && accRes.data.account_number) {
        const primaryAcc = accRes.data;
        setAccount(primaryAcc);

        try {
          const histRes = await apiClient.get(`/api/payments/yookassa/history/${primaryAcc.account_number}`);
          if (Array.isArray(histRes.data)) {
            setPayments(histRes.data);
          }
        } catch (histErr) {
          console.warn('[Payments CyberShield] История платежей пока пуста');
        }
      } else {
        setAccount(null);
      }
    } catch (err) {
      console.warn('[Payments CyberShield] Ошибка загрузки счетов:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadPaymentData();
  }, [loadPaymentData]);

  // Обновление баланса/истории «почти в реальном времени» (лёгкий опрос при активном экране)
  useAutoRefresh(() => { loadPaymentData(); });

  const onRefresh = () => {
    setRefreshing(true);
    loadPaymentData();
  };

  // Инициализация платежа через ЮKassa
  const handlePay = async (amountToPay: number) => {
    if (!amountToPay || isNaN(amountToPay) || amountToPay <= 0) {
      Alert.alert('Внимание', 'Пожалуйста, укажите корректную сумму к оплате');
      return;
    }

    setPaying(true);
    try {
      const accNum = account?.account_number || '';
      // Комиссия эквайринга 5% добавляется к сумме при переходе на ЮKassa (как на сайте):
      // клиент платит base + 5%, а в счёт ТО зачисляется именно base (credit_amount).
      const base = Math.round(amountToPay * 100) / 100;
      const fee = Math.round(base * 0.05 * 100) / 100;
      const total = Math.round((base + fee) * 100) / 100;
      console.log(`[Payments CyberShield] Оплата ${base} ₽ + 5% (${fee} ₽) = ${total} ₽ (л/с: ${accNum})...`);

      const payload = {
        amount: total,
        credit_amount: base,
        fee_amount: fee,
        account_number: accNum,
        description: `Оплата ТО домофона, л/с ${accNum || 'не указан'}`,
        return_url: 'https://домофондар.рф/cabinet?check_payment=1',
        is_order: false,
      };

      const res = await apiClient.post('/api/payments/yookassa/create', payload);
      const confirmationUrl = res.data?.confirmation_url || res.data?.payment?.confirmation?.confirmation_url;

      if (confirmationUrl) {
        console.log('[Payments CyberShield] Переход в шлюз ЮKassa:', confirmationUrl);
        await WebBrowser.openBrowserAsync(confirmationUrl);
        loadPaymentData();
      } else {
        Alert.alert('Ошибка', 'Не удалось получить ссылку на оплату от шлюза');
      }
    } catch (err: any) {
      console.error('[Payments CyberShield] Ошибка платежа:', err);
      const msg = err.response?.data?.error || 'Ошибка при обращении к платёжному шлюзу';
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
      <View style={[styles.historyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View
          style={[
            styles.historyIcon,
            {
              backgroundColor: isSuccess
                ? (isDark ? 'rgba(16, 185, 129, 0.15)' : '#ecfdf5')
                : isCanceled
                ? (isDark ? 'rgba(239, 68, 68, 0.15)' : '#fee2e2')
                : (isDark ? 'rgba(245, 158, 11, 0.15)' : '#fef3c7'),
            },
          ]}
        >
          <Ionicons
            name={isSuccess ? 'checkmark' : isCanceled ? 'close' : 'time'}
            size={20}
            color={isSuccess ? colors.secondary : isCanceled ? colors.error : colors.warning}
          />
        </View>
        <View style={styles.historyInfo}>
          <Text style={[styles.historyType, { color: colors.text }]} numberOfLines={1}>
            {item.description || 'Оплата ТО домофона'}
          </Text>
          <Text style={[styles.historyDate, { color: colors.textMuted }]}>{dateStr}</Text>
        </View>
        <View style={styles.historyRight}>
          <Text style={[styles.historyAmount, { color: isSuccess ? colors.secondary : colors.text }]}>
            {amountVal} ₽
          </Text>
          <Text
            style={[
              styles.historyStatus,
              { color: isSuccess ? colors.secondary : isCanceled ? colors.error : colors.warning },
            ]}
          >
            {isSuccess ? 'Зачислено' : isCanceled ? 'Отменён' : 'В обработке'}
          </Text>
        </View>
      </View>
    );
  };

  const safeTop = Math.max(insets.top, 16) + 8;
  const safeBottom = Math.max(insets.bottom, 12) + 75;

  return (
    <View style={[styles.safeArea, { backgroundColor: colors.background, paddingTop: safeTop }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Оплата и счета</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Техническое обслуживание домофонии
        </Text>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primaryContainer} size="large" />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Загрузка состояния лицевого счета...
          </Text>
        </View>
      ) : (
        <FlatList
          data={payments}
          keyExtractor={(item, idx) => item.id?.toString() || idx.toString()}
          renderItem={renderPaymentItem}
          contentContainerStyle={[styles.container, { paddingBottom: safeBottom }]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primaryContainer}
            />
          }
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <>
              {/* Карточка баланса в стиле CyberShield */}
              <View style={[styles.balanceCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.balanceTopRow}>
                  <View>
                    <Text style={[styles.accountTitle, { color: colors.textSecondary }]}>Номер лицевого счёта</Text>
                    <Text style={[styles.accountNumber, { color: colors.text }]}>
                      {account ? `№ ${account.account_number}` : 'Не привязан'}
                    </Text>
                  </View>
                  <View style={[styles.sbpBadge, { backgroundColor: isDark ? '#262a35' : '#eff4ff', borderColor: colors.border }]}>
                    <Ionicons name="card" size={14} color={colors.primaryContainer} style={{ marginRight: 4 }} />
                    <Text style={[styles.sbpBadgeText, { color: colors.primaryContainer }]}>СБП • Мир</Text>
                  </View>
                </View>

                {account?.address && (
                  <Text style={[styles.accountAddress, { color: colors.textMuted }]} numberOfLines={1}>
                    📍 {account.address}
                  </Text>
                )}

                <View style={[styles.divider, { backgroundColor: colors.border }]} />

                <Text style={[styles.balanceText, { color: colors.textSecondary }]}>
                  {hasDebt ? 'Текущая задолженность по ТО:' : 'Состояние счета:'}
                </Text>
                <Text
                  style={[
                    styles.balanceAmount,
                    { color: hasDebt ? colors.error : colors.primaryContainer },
                  ]}
                >
                  {hasDebt ? `${debt.toFixed(2)} ₽` : 'Задолженности нет • 0.00 ₽'}
                </Text>

                {/* Быстрая кнопка погашения долга */}
                {hasDebt && (
                  <TouchableOpacity
                    style={[styles.payButton, { backgroundColor: colors.error }]}
                    onPress={() => handlePay(debt)}
                    disabled={paying}
                    activeOpacity={0.85}
                  >
                    {paying ? (
                      <ActivityIndicator color="#ffffff" />
                    ) : (
                      <>
                        <Ionicons name="flash" size={18} color="#ffffff" style={{ marginRight: 8 }} />
                        <Text style={styles.payButtonText}>Погасить долг ({debt.toFixed(2)} ₽)</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}

                {/* Оплата произвольной суммы */}
                <View style={styles.customPayRow}>
                  <TextInput
                    style={[
                      styles.customInput,
                      { backgroundColor: isDark ? '#171b26' : '#f8f9ff', borderColor: colors.border, color: colors.text },
                    ]}
                    placeholder="Сумма, ₽"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="numeric"
                    value={customAmount}
                    onChangeText={setCustomAmount}
                  />
                  <TouchableOpacity
                    style={[styles.customPayButton, { backgroundColor: colors.primaryContainer }]}
                    onPress={() => handlePay(parseFloat(customAmount))}
                    disabled={paying}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.customPayButtonText}>Оплатить</Text>
                  </TouchableOpacity>
                </View>

                {/* Уведомление о возможной банковской комиссии (как на сайте) */}
                <Text style={[styles.feeNote, { color: colors.textMuted }]}>
                  Возможна комиссия банка при оплате
                </Text>
              </View>

              <Text style={[styles.sectionTitle, { color: colors.text }]}>История операций</Text>
            </>
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={[styles.emptyIconCircle, { backgroundColor: isDark ? '#1c1f2a' : '#eff4ff' }]}>
                <Ionicons name="receipt-outline" size={32} color={colors.primaryContainer} />
              </View>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                История платежей пока пуста
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: { paddingHorizontal: 16, marginBottom: 14 },
  title: { fontSize: 24, fontWeight: '800' },
  subtitle: { fontSize: 13, marginTop: 2 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  loadingText: { marginTop: 12, fontSize: 14 },
  container: { paddingHorizontal: 16 },
  balanceCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
    marginBottom: 20,
    elevation: 4,
    shadowColor: '#1e3a8a',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
  },
  balanceTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  accountTitle: { fontSize: 12, fontWeight: '500' },
  accountNumber: { fontSize: 18, fontWeight: '800', marginTop: 2 },
  sbpBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  sbpBadgeText: { fontSize: 11, fontWeight: '700' },
  accountAddress: { fontSize: 13, marginTop: 6 },
  divider: { height: 1, marginVertical: 12 },
  balanceText: { fontSize: 12, fontWeight: '500' },
  balanceAmount: { fontSize: 24, fontWeight: '800', marginVertical: 4 },
  payButton: {
    height: 48,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    marginBottom: 10,
    elevation: 3,
    shadowColor: '#0ea5e9',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
  },
  payButtonText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
  customPayRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  customInput: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 15,
    fontWeight: '600',
  },
  customPayButton: {
    paddingHorizontal: 20,
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#0ea5e9',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  customPayButtonText: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
  feeNote: { fontSize: 12, marginTop: 10, textAlign: 'center' },
  sectionTitle: { fontSize: 17, fontWeight: '700', marginBottom: 12 },
  emptyContainer: { alignItems: 'center', paddingVertical: 40 },
  emptyIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyText: { fontSize: 14 },
  historyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
    elevation: 2,
    shadowColor: '#1e3a8a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
  },
  historyIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  historyInfo: { flex: 1, marginRight: 8 },
  historyType: { fontSize: 14, fontWeight: '600' },
  historyDate: { fontSize: 11, marginTop: 2 },
  historyRight: { alignItems: 'flex-end' },
  historyAmount: { fontSize: 14, fontWeight: '700' },
  historyStatus: { fontSize: 11, marginTop: 2, fontWeight: '600' },
});
