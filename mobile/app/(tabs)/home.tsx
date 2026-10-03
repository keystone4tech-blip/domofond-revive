// mobile/app/(tabs)/home.tsx
// Главный экран мобильного приложения «Домофондар» в дизайне Domofondar CyberShield
// Поддерживает темы Cyber Dark и Clean Tech с мгновенным переключением темы ☀️ / 🌙
// Включает 4 реальных действия абонента: Ремонт домофона, Заказ трубки, Заказ ключей и Диспетчерская

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Linking,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@/store/auth.store';
import { useAppTheme } from '@/theme';
import { apiClient } from '@/api/client';
import { RepairModal } from '@/components/RepairModal';
import { KeyOrderModal } from '@/components/KeyOrderModal';
import { HandsetOrderModal } from '@/components/HandsetOrderModal';

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, loadProfile } = useAuthStore();
  const { colors, isDark, toggleTheme } = useAppTheme();

  // Состояния данных
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [account, setAccount] = useState<{
    account_number: string;
    debt_amount: number;
    address?: string;
    period?: string;
  } | null>(null);
  const [recentRequests, setRecentRequests] = useState<any[]>([]);

  // Состояния модальных окон
  const [isRepairModalOpen, setIsRepairModalOpen] = useState(false);
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
  const [isHandsetModalOpen, setIsHandsetModalOpen] = useState(false);

  // Загрузка изолированных персональных данных абонента
  const loadDashboardData = useCallback(async () => {
    try {
      console.log('[Home CyberShield] Загрузка данных кабинета абонента...');
      await loadProfile();

      // 1. Получаем персональный лицевой счет
      try {
        const myAccRes = await apiClient.get('/api/user/my-account');
        if (myAccRes.data && myAccRes.data.account_number) {
          console.log(`[Home CyberShield] Лицевой счет подтвержден: ${myAccRes.data.account_number}`);
          setAccount(myAccRes.data);
        } else {
          setAccount(null);
        }
      } catch (accErr) {
        console.warn('[Home CyberShield] Лицевой счет не найден:', accErr);
        setAccount(null);
      }

      // 2. Получаем персональные заявки
      try {
        const requestsRes = await apiClient.get('/api/user/my-requests');
        if (Array.isArray(requestsRes.data)) {
          console.log(`[Home CyberShield] Загружено личных заявок: ${requestsRes.data.length}`);
          setRecentRequests(requestsRes.data.slice(0, 3));
        } else {
          setRecentRequests([]);
        }
      } catch (reqErr) {
        console.warn('[Home CyberShield] Заявки пока отсутствуют');
        setRecentRequests([]);
      }
    } catch (err) {
      console.warn('[Home CyberShield] Ошибка загрузки дашборда:', err);
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

  // Звонок дежурному диспетчеру компании
  const handleCallDispatcher = () => {
    const phoneNumber = '+79034118393';
    Alert.alert(
      'Звонок в диспетчерскую',
      'Связаться с дежурной службой «Домофондар» по номеру +7 (903) 411-83-93?',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Позвонить',
          onPress: () => {
            console.log('[Home CyberShield] Набор диспетчера:', phoneNumber);
            Linking.openURL(`tel:${phoneNumber}`).catch((err) => {
              console.error('[Home CyberShield] Не удалось совершить вызов:', err);
              Alert.alert('Ошибка', 'Не удалось открыть набор номера на телефоне');
            });
          },
        },
      ]
    );
  };

  const displayName = user?.full_name || (user as any)?.email?.split('@')[0] || 'Абонент';
  const debt = account ? Number(account.debt_amount || 0) : 0;
  const hasDebt = debt > 0;
  const userAddress = account?.address || (user as any)?.address || '';

  // Безопасные отступы под челку и полоску жестов
  const safeTopPadding = Math.max(insets.top, 16) + 6;
  const safeBottomPadding = 80 + (insets.bottom > 0 ? insets.bottom : 16);

  return (
    <View style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingTop: safeTopPadding, paddingBottom: safeBottomPadding },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primaryContainer}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* =================================================================== */}
        {/* 1. ШАПКА В СТИЛЕ CYBERSHIELD */}
        {/* =================================================================== */}
        <View style={styles.cyberHeader}>
          {/* Бренд и пульсирующий индикатор безопасности */}
          <View style={styles.brandContainer}>
            <View style={styles.brandRow}>
              <View style={[styles.logoBadge, { backgroundColor: isDark ? '#1c1f2a' : '#e0f2fe', borderColor: colors.border }]}>
                <Ionicons name="shield-checkmark" size={18} color={colors.primaryContainer} />
              </View>
              <View>
                <Text style={[styles.brandTitle, { color: colors.text }]}>ДОМОФОНДАР</Text>
                <View style={styles.statusIndicatorRow}>
                  <View style={styles.statusPulseWrapper}>
                    <View style={styles.statusDotPulse} />
                    <View style={styles.statusDotMain} />
                  </View>
                  <Text style={[styles.statusIndicatorText, { color: colors.secondary }]}>
                    СИСТЕМА АКТИВНА // В НОРМЕ
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Кнопки переключения темы и перехода в профиль */}
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={[styles.headerIconBtn, { backgroundColor: isDark ? '#1c1f2a' : '#ffffff', borderColor: colors.border }]}
              onPress={toggleTheme}
              activeOpacity={0.8}
              accessibilityLabel="Переключить тему"
            >
              <Ionicons
                name={isDark ? 'sunny-outline' : 'moon-outline'}
                size={20}
                color={isDark ? '#fbbf24' : '#0284c7'}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.headerIconBtn, { backgroundColor: isDark ? '#1c1f2a' : '#ffffff', borderColor: colors.border }]}
              onPress={() => router.push('/(tabs)/profile')}
              activeOpacity={0.8}
            >
              <Ionicons name="person-outline" size={19} color={colors.primaryContainer} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Приветствие абонента */}
        <View style={styles.greetingSection}>
          <Text style={[styles.greetingLabel, { color: colors.textSecondary }]}>Личный кабинет жильца</Text>
          <Text style={[styles.greetingName, { color: colors.text }]} numberOfLines={1}>
            Здравствуйте, {displayName}!
          </Text>
        </View>

        {/* =================================================================== */}
        {/* 2. КАРТОЧКА ЛИЦЕВОГО СЧЕТА И БАЛАНСА */}
        {/* =================================================================== */}
        {loading ? (
          <View style={[styles.accountCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <ActivityIndicator color={colors.primaryContainer} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
              Загрузка состояния лицевого счёта...
            </Text>
          </View>
        ) : (
          <View style={[styles.accountCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {/* Декоративное высокотехнологичное свечение */}
            <View
              style={[
                styles.glowDeco,
                { backgroundColor: hasDebt ? 'rgba(239, 68, 68, 0.08)' : 'rgba(14, 165, 233, 0.08)' },
              ]}
            />

            {/* Верхняя строка: номер ЛС и статус */}
            <View style={styles.accountTopRow}>
              <View style={styles.accountNumberBlock}>
                <Ionicons name="card-outline" size={16} color={colors.primaryContainer} style={{ marginRight: 6 }} />
                <Text style={[styles.accountNumberText, { color: colors.textSecondary }]}>
                  {account ? `Л/С № ${account.account_number}` : 'Л/С не привязан'}
                </Text>
              </View>

              <View
                style={[
                  styles.accountStatusBadge,
                  {
                    backgroundColor: hasDebt
                      ? (isDark ? 'rgba(239, 68, 68, 0.15)' : '#fee2e2')
                      : (isDark ? 'rgba(16, 185, 129, 0.15)' : '#dcfce7'),
                    borderColor: hasDebt ? colors.error : colors.secondary,
                  },
                ]}
              >
                <View
                  style={[
                    styles.statusDotSmall,
                    { backgroundColor: hasDebt ? colors.error : colors.secondary },
                  ]}
                />
                <Text
                  style={[
                    styles.accountStatusText,
                    { color: hasDebt ? colors.error : colors.secondary },
                  ]}
                >
                  {hasDebt ? 'Задолженность' : 'ТО оплачено'}
                </Text>
              </View>
            </View>

            {/* Адрес квартиры */}
            <View style={styles.addressBlock}>
              <Ionicons name="location-outline" size={16} color={colors.textMuted} style={{ marginRight: 6, marginTop: 1 }} />
              <Text style={[styles.addressText, { color: colors.text }]} numberOfLines={2}>
                {userAddress || 'Адрес квартиры не указан (нажмите, чтобы добавить)'}
              </Text>
            </View>

            {/* Блок баланса */}
            <View style={[styles.balanceBox, { backgroundColor: isDark ? '#171b26' : '#eff4ff', borderColor: colors.border }]}>
              <View>
                <Text style={[styles.balanceSub, { color: colors.textSecondary }]}>
                  {hasDebt ? 'Сумма к оплате ТО:' : 'Текущий баланс:'}
                </Text>
                <Text
                  style={[
                    styles.balanceMain,
                    { color: hasDebt ? colors.error : colors.primaryContainer },
                  ]}
                >
                  {hasDebt ? `${debt.toFixed(2)} ₽` : '0.00 ₽'}
                </Text>
              </View>

              <TouchableOpacity
                style={[
                  styles.payActionBtn,
                  { backgroundColor: hasDebt ? colors.error : colors.primaryContainer },
                ]}
                onPress={() => router.push('/(tabs)/payments')}
                activeOpacity={0.85}
              >
                <Ionicons name="qr-code-outline" size={16} color="#ffffff" style={{ marginRight: 6 }} />
                <Text style={styles.payActionBtnText}>
                  {hasDebt ? 'Оплатить ТО' : 'Пополнить'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* =================================================================== */}
        {/* 3. ЧЕТЫРЕ КЛЮЧЕВЫХ ДЕЙСТВИЯ АБОНЕНТА (СЕТКА 2x2) */}
        {/* =================================================================== */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Быстрые действия</Text>
          <Text style={[styles.sectionHint, { color: colors.textMuted }]}>Услуги домофонии</Text>
        </View>

        <View style={styles.actionsGrid}>
          {/* Плитка 1: Ремонт домофона (вызов мастера по ТО) */}
          <TouchableOpacity
            style={[styles.actionCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => setIsRepairModalOpen(true)}
            activeOpacity={0.85}
          >
            <View style={styles.actionCardHeader}>
              <View style={[styles.actionIconWrapper, { backgroundColor: isDark ? '#262a35' : '#eff4ff' }]}>
                <Ionicons name="construct" size={22} color={colors.primaryContainer} />
              </View>
              <View style={[styles.actionTag, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#ecfdf5' }]}>
                <Text style={[styles.actionTagText, { color: colors.secondary }]}>0 ₽ по ТО</Text>
              </View>
            </View>
            <View style={styles.actionCardBody}>
              <Text style={[styles.actionCardTitle, { color: colors.text }]}>Ремонт домофона</Text>
              <Text style={[styles.actionCardSubtitle, { color: colors.textSecondary }]}>
                Вызов мастера на дом при поломке
              </Text>
            </View>
            <View style={[styles.actionCardButton, { backgroundColor: isDark ? '#262a35' : '#eff4ff' }]}>
              <Text style={[styles.actionCardButtonText, { color: colors.primaryContainer }]}>Вызвать</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.primaryContainer} />
            </View>
          </TouchableOpacity>

          {/* Плитка 2: Заказ трубки */}
          <TouchableOpacity
            style={[styles.actionCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => setIsHandsetModalOpen(true)}
            activeOpacity={0.85}
          >
            <View style={styles.actionCardHeader}>
              <View style={[styles.actionIconWrapper, { backgroundColor: isDark ? '#262a35' : '#eff4ff' }]}>
                <Ionicons name="call" size={22} color={colors.primaryContainer} />
              </View>
              <View style={[styles.actionTag, { backgroundColor: isDark ? '#262a35' : '#e0f2fe' }]}>
                <Text style={[styles.actionTagText, { color: colors.primaryContainer }]}>Монтаж</Text>
              </View>
            </View>
            <View style={styles.actionCardBody}>
              <Text style={[styles.actionCardTitle, { color: colors.text }]}>Заказ трубки</Text>
              <Text style={[styles.actionCardSubtitle, { color: colors.textSecondary }]}>
                Установка новой или замена старой
              </Text>
            </View>
            <View style={[styles.actionCardButton, { backgroundColor: isDark ? '#262a35' : '#eff4ff' }]}>
              <Text style={[styles.actionCardButtonText, { color: colors.primaryContainer }]}>Выбрать</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.primaryContainer} />
            </View>
          </TouchableOpacity>

          {/* Плитка 3: Заказ ключей */}
          <TouchableOpacity
            style={[styles.actionCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => setIsKeyModalOpen(true)}
            activeOpacity={0.85}
          >
            <View style={styles.actionCardHeader}>
              <View style={[styles.actionIconWrapper, { backgroundColor: isDark ? '#262a35' : '#eff4ff' }]}>
                <Ionicons name="key" size={22} color={colors.primaryContainer} />
              </View>
              <View style={[styles.actionTag, { backgroundColor: isDark ? 'rgba(245, 158, 11, 0.15)' : '#fef3c7' }]}>
                <Text style={[styles.actionTagText, { color: colors.warning }]}>до -24%</Text>
              </View>
            </View>
            <View style={styles.actionCardBody}>
              <Text style={[styles.actionCardTitle, { color: colors.text }]}>Заказ ключей</Text>
              <Text style={[styles.actionCardSubtitle, { color: colors.textSecondary }]}>
                Электронные чипы с кодированием
              </Text>
            </View>
            <View style={[styles.actionCardButton, { backgroundColor: isDark ? '#262a35' : '#eff4ff' }]}>
              <Text style={[styles.actionCardButtonText, { color: colors.primaryContainer }]}>Заказать</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.primaryContainer} />
            </View>
          </TouchableOpacity>

          {/* Плитка 4: Диспетчерская */}
          <TouchableOpacity
            style={[styles.actionCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={handleCallDispatcher}
            activeOpacity={0.85}
          >
            <View style={styles.actionCardHeader}>
              <View style={[styles.actionIconWrapper, { backgroundColor: isDark ? '#262a35' : '#eff4ff' }]}>
                <Ionicons name="headset" size={22} color={colors.secondary} />
              </View>
              <View style={[styles.actionTag, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#ecfdf5' }]}>
                <Text style={[styles.actionTagText, { color: colors.secondary }]}>24/7</Text>
              </View>
            </View>
            <View style={styles.actionCardBody}>
              <Text style={[styles.actionCardTitle, { color: colors.text }]}>Диспетчер</Text>
              <Text style={[styles.actionCardSubtitle, { color: colors.textSecondary }]}>
                +7 (903) 411-83-93
              </Text>
            </View>
            <View style={[styles.actionCardButton, { backgroundColor: isDark ? '#262a35' : '#ecfdf5' }]}>
              <Text style={[styles.actionCardButtonText, { color: colors.secondary }]}>Позвонить</Text>
              <Ionicons name="call-outline" size={14} color={colors.secondary} />
            </View>
          </TouchableOpacity>
        </View>

        {/* =================================================================== */}
        {/* 4. СЕКЦИЯ ПОСЛЕДНИХ ОБРАЩЕНИЙ АБОНЕНТА */}
        {/* =================================================================== */}
        <View style={[styles.sectionHeaderRow, { marginTop: 24 }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Мои обращения</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/requests')}>
            <Text style={[styles.seeAllLink, { color: colors.primaryContainer }]}>Все заявки →</Text>
          </TouchableOpacity>
        </View>

        {recentRequests.length === 0 ? (
          <View style={[styles.emptyRequestsBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.emptyIconCircle, { backgroundColor: isDark ? '#171b26' : '#eff4ff' }]}>
              <Ionicons name="checkmark-done" size={28} color={colors.secondary} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>Все системы работают в норме</Text>
            <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>
              У вас нет активных заявок. Если возникнет неисправность, вызовите мастера в 1 клик.
            </Text>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {recentRequests.map((req, idx) => {
              const isDone = req.status === 'completed' || req.status === 'resolved';
              const isProgress = req.status === 'in_progress';

              return (
                <View
                  key={req.id || idx}
                  style={[
                    styles.requestItemCard,
                    { backgroundColor: colors.card, borderColor: colors.border },
                  ]}
                >
                  <View style={styles.requestItemLeft}>
                    <View
                      style={[
                        styles.requestStatusIcon,
                        {
                          backgroundColor: isDone
                            ? (isDark ? 'rgba(16, 185, 129, 0.15)' : '#ecfdf5')
                            : (isDark ? 'rgba(14, 165, 233, 0.15)' : '#eff4ff'),
                        },
                      ]}
                    >
                      <Ionicons
                        name={isDone ? 'checkmark' : (isProgress ? 'construct' : 'time-outline')}
                        size={18}
                        color={isDone ? colors.secondary : colors.primaryContainer}
                      />
                    </View>
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <Text style={[styles.requestItemTitle, { color: colors.text }]} numberOfLines={1}>
                        {req.message?.replace(/📱 \[Мобильное приложение.*?\]\n?/, '') || 'Обращение в службу ТО'}
                      </Text>
                      <Text style={[styles.requestItemDate, { color: colors.textMuted }]}>
                        {req.created_at ? new Date(req.created_at).toLocaleDateString('ru-RU') : 'Недавно'}
                        {req.address ? ` • ${req.address}` : ''}
                      </Text>
                    </View>
                  </View>

                  <View
                    style={[
                      styles.requestStatusBadge,
                      {
                        backgroundColor: isDone
                          ? (isDark ? 'rgba(16, 185, 129, 0.15)' : '#ecfdf5')
                          : (isDark ? 'rgba(14, 165, 233, 0.15)' : '#e0f2fe'),
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.requestStatusBadgeText,
                        { color: isDone ? colors.secondary : colors.primaryContainer },
                      ]}
                    >
                      {req.status === 'completed'
                        ? 'Выполнена'
                        : req.status === 'in_progress'
                        ? 'В работе'
                        : 'Принята'}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Модальное окно вызова мастера по ТО */}
      <RepairModal
        visible={isRepairModalOpen}
        onClose={() => setIsRepairModalOpen(false)}
        onSuccess={loadDashboardData}
        user={user}
        defaultAddress={userAddress}
      />

      {/* Модальное окно заказа электронных ключей */}
      <KeyOrderModal
        visible={isKeyModalOpen}
        onClose={() => setIsKeyModalOpen(false)}
        onSuccess={loadDashboardData}
        user={user}
        account={account}
        defaultAddress={userAddress}
      />

      {/* Модальное окно заказа трубки */}
      <HandsetOrderModal
        visible={isHandsetModalOpen}
        onClose={() => setIsHandsetModalOpen(false)}
        onSuccess={loadDashboardData}
        user={user}
        account={account}
        defaultAddress={userAddress}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    paddingHorizontal: 16,
  },
  cyberHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  brandContainer: {
    flex: 1,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoBadge: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  statusIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  statusPulseWrapper: {
    width: 8,
    height: 8,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusDotPulse: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10b981',
    opacity: 0.4,
  },
  statusDotMain: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
  },
  statusIndicatorText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  greetingSection: {
    marginBottom: 16,
  },
  greetingLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  greetingName: {
    fontSize: 22,
    fontWeight: '700',
    marginTop: 2,
  },
  accountCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    position: 'relative',
    overflow: 'hidden',
    marginBottom: 20,
    elevation: 3,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  glowDeco: {
    position: 'absolute',
    top: -30,
    right: -30,
    width: 140,
    height: 140,
    borderRadius: 70,
  },
  loadingText: {
    fontSize: 13,
    marginTop: 8,
    textAlign: 'center',
  },
  accountTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  accountNumberBlock: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  accountNumberText: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  accountStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusDotSmall: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  accountStatusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  addressBlock: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  addressText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
  },
  balanceBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  balanceSub: {
    fontSize: 11,
    fontWeight: '500',
  },
  balanceMain: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginTop: 2,
  },
  payActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    shadowColor: '#0ea5e9',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  payActionBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  sectionHint: {
    fontSize: 12,
    fontWeight: '500',
  },
  seeAllLink: {
    fontSize: 13,
    fontWeight: '600',
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionCard: {
    width: '48%',
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    justifyContent: 'space-between',
    minHeight: 140,
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  actionCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  actionIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  actionTagText: {
    fontSize: 10,
    fontWeight: '700',
  },
  actionCardBody: {
    marginBottom: 10,
  },
  actionCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  actionCardSubtitle: {
    fontSize: 11,
    lineHeight: 14,
  },
  actionCardButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  actionCardButtonText: {
    fontSize: 12,
    fontWeight: '700',
  },
  emptyRequestsBox: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    textAlign: 'center',
  },
  emptyIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  emptyDesc: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
  },
  requestItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  requestItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  requestStatusIcon: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  requestItemTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  requestItemDate: {
    fontSize: 11,
    marginTop: 2,
  },
  requestStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  requestStatusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
