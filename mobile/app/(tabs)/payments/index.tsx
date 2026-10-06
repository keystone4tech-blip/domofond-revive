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
import { LinearGradient } from 'expo-linear-gradient';
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
              {/* Карта-герой счёта (в стиле главного экрана) */}
              <LinearGradient
                colors={debt > 0
                  ? ['#f97316', '#ea580c', '#b91c1c']
                  : debt < 0
                  ? ['#10b981', '#059669', '#047857']
                  : ['#0ea5e9', '#0276c4', '#0b3f78']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.heroCard}
              >
                <View style={styles.heroGlow} />

                <View style={styles.heroTopRow}>
                  <View style={styles.heroAcctBlock}>
                    <Text style={styles.heroAcctLabel}>Лицевой счёт</Text>
                    <Text style={styles.heroAcctNum} numberOfLines={1}>
                      {account ? `№ ${account.account_number}` : 'Не привязан'}
                    </Text>
                  </View>
                  <View style={styles.heroSbp}>
                    <Ionicons name="card" size={13} color="#fff" style={{ marginRight: 4 }} />
                    <Text style={styles.heroSbpText}>СБП • Мир</Text>
                  </View>
                </View>

                {account?.address ? (
                  <View style={styles.heroAddrRow}>
                    <Ionicons name="location-outline" size={13} color="rgba(255,255,255,0.85)" style={{ marginRight: 5 }} />
                    <Text style={styles.heroAddrText} numberOfLines={2}>{account.address}</Text>
                  </View>
                ) : null}

                <Text style={styles.heroBalLabel}>
                  {hasDebt ? 'Задолженность по ТО' : debt < 0 ? 'Баланс (переплата)' : 'Состояние счёта'}
                </Text>
                <Text style={styles.heroBalValue}>
                  {hasDebt ? `${debt.toFixed(2)} ₽` : debt < 0 ? `+${Math.abs(debt).toFixed(2)} ₽` : 'Задолженности нет'}
                </Text>

                {/* Быстрая кнопка погашения долга */}
                {hasDebt && (
                  <TouchableOpacity style={styles.heroPayDebt} onPress={() => handlePay(debt)} disabled={paying} activeOpacity={0.85}>
                    {paying ? <ActivityIndicator color="#b91c1c" /> : (
                      <>
                        <Ionicons name="flash" size={17} color="#b91c1c" style={{ marginRight: 8 }} />
                        <Text style={styles.heroPayDebtText}>Погасить долг ({debt.toFixed(2)} ₽)</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}

                {/* Пояснение про оплату сверх суммы */}
                <Text style={styles.heroHint}>
                  Можно оплатить больше — переплата зачислится на баланс и автоматически спишется в счёт следующего ТО.
                </Text>

                {/* Оплата произвольной суммы */}
                <View style={styles.heroPayRow}>
                  <TextInput
                    style={styles.heroInput}
                    placeholder="Сумма, ₽"
                    placeholderTextColor="rgba(255,255,255,0.7)"
                    keyboardType="numeric"
                    value={customAmount}
                    onChangeText={setCustomAmount}
                  />
                  <TouchableOpacity style={styles.heroPayBtn} onPress={() => handlePay(parseFloat(customAmount))} disabled={paying} activeOpacity={0.85}>
                    <Text style={styles.heroPayBtnText}>Оплатить</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.heroFeeNote}>Возможна комиссия банка при оплате</Text>
              </LinearGradient>

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
  // ===== Карта-герой счёта =====
  heroCard: {
    borderRadius: 26,
    padding: 20,
    marginBottom: 20,
    position: 'relative',
    overflow: 'hidden',
    elevation: 10,
    shadowColor: '#0b3f78',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
  },
  heroGlow: {
    position: 'absolute', top: -60, right: -40, width: 180, height: 180,
    borderRadius: 90, backgroundColor: 'rgba(78,222,163,0.35)',
  },
  heroTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  heroAcctBlock: { flexShrink: 1, minWidth: 0 },
  heroAcctLabel: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.82)' },
  heroAcctNum: { fontSize: 17, fontWeight: '800', color: '#fff', marginTop: 2 },
  heroSbp: {
    flexShrink: 0, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.2)',
  },
  heroSbpText: { fontSize: 10.5, fontWeight: '700', color: '#fff' },
  heroAddrRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  heroAddrText: { flexShrink: 1, fontSize: 12, color: 'rgba(255,255,255,0.85)' },
  heroBalLabel: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.82)', marginTop: 16 },
  heroBalValue: { fontSize: 28, fontWeight: '800', color: '#fff', letterSpacing: -0.5, marginTop: 2 },
  heroPayDebt: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#fff', paddingVertical: 13, borderRadius: 14, marginTop: 16,
  },
  heroPayDebtText: { color: '#b91c1c', fontSize: 14, fontWeight: '800' },
  heroHint: { color: 'rgba(255,255,255,0.85)', fontSize: 11.5, lineHeight: 16, marginTop: 10 },
  heroPayRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  heroInput: {
    flex: 1, height: 46, borderRadius: 12, paddingHorizontal: 14, fontSize: 15, fontWeight: '600',
    color: '#fff', backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
  },
  heroPayBtn: {
    paddingHorizontal: 20, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#fff',
  },
  heroPayBtnText: { color: '#0276c4', fontSize: 14, fontWeight: '800' },
  heroFeeNote: { fontSize: 11, color: 'rgba(255,255,255,0.8)', textAlign: 'center', marginTop: 12 },
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
