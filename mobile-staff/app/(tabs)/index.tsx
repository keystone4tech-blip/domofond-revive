/**
 * Главный экран — Адаптивный рабочий стол по ролям сотрудников
 * Приложение «Офис Работа»
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useStaffAuthStore } from '../../src/store/auth.store';
import { useStaffTasksStore } from '../../src/store/tasks.store';
import { StaffRole } from '../../src/types/staff';
import { PermissionsCenterModal } from '../../src/components/PermissionsCenterModal';
import { checkAllStaffPermissions, initializeNotificationChannel } from '../../src/services/permissionsService';

export default function WorkspaceScreen() {
  const router = useRouter();
  const user = useStaffAuthStore((state) => state.user);
  const activeViewRole = useStaffAuthStore((state) => state.activeViewRole);
  const previewRole = useStaffAuthStore((state) => state.previewRole);
  const setPreviewRole = useStaffAuthStore((state) => state.setPreviewRole);
  const shiftStatus = useStaffAuthStore((state) => state.shiftStatus);
  const setShiftStatus = useStaffAuthStore((state) => state.setShiftStatus);

  const tasks = useStaffTasksStore((state) => state.tasks);
  const stats = useStaffTasksStore((state) => state.stats);
  const loadTasks = useStaffTasksStore((state) => state.loadTasks);
  const loadActs = useStaffTasksStore((state) => state.loadActs);
  const loadStats = useStaffTasksStore((state) => state.loadStats);
  const isLoading = useStaffTasksStore((state) => state.isLoading);
  const callPhone = useStaffTasksStore((state) => state.callPhone);

  const [refreshing, setRefreshing] = useState(false);
  const [permissionsModalVisible, setPermissionsModalVisible] = useState(false);
  const [hasMissingPermissions, setHasMissingPermissions] = useState(false);

  // Фоновая синхронизация с сервером при открытии экрана
  useEffect(() => {
    loadTasks();
    loadActs();
    loadStats();
    initializeNotificationChannel();
    checkAllStaffPermissions().then((status) => {
      setHasMissingPermissions(!status.allEssentialGranted);
    });
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadTasks(), loadActs(), loadStats()]);
    setRefreshing(false);
  };

  // Активный наряд мастера (в работе или в пути)
  const activeTask = tasks.find((t) => t.status === 'in_progress' || t.status === 'en_route') || tasks[0];
  const urgentCount = tasks.filter((t) => t.priority === 'urgent' && t.status !== 'done').length;
  const inProgressCount = tasks.filter((t) => t.status === 'in_progress' || t.status === 'en_route').length;
  const doneTodayCount = tasks.filter((t) => t.status === 'done').length;

  // Текстовая метка роли
  const getRoleLabel = (role: StaffRole): string => {
    switch (role) {
      case 'master':
      case 'technician':
      case 'installer':
        return 'Мастер / Техник';
      case 'dispatcher':
        return 'Диспетчер';
      case 'director':
        return 'Руководитель';
      case 'admin':
      case 'superadmin':
        return 'Администратор';
      default:
        return 'Сотрудник';
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#38BDF8"
          colors={['#38BDF8', '#10B981']}
        />
      }
    >
      {/* 1. Верхняя панель (Header) */}
      <View style={styles.header}>
        <View>
          <Text style={styles.companyName}>Офис Работа</Text>
          <Text style={styles.employeeName}>{user?.full_name || 'Сотрудник'}</Text>
        </View>

        {/* Тумблер смены */}
        <TouchableOpacity
          style={[styles.shiftToggle, shiftStatus === 'on_shift' ? styles.shiftOn : styles.shiftOff]}
          onPress={() => setShiftStatus(shiftStatus === 'on_shift' ? 'off_duty' : 'on_shift')}
        >
          <View style={[styles.shiftDot, shiftStatus === 'on_shift' ? styles.shiftDotOn : styles.shiftDotOff]} />
          <Text style={styles.shiftText}>
            {shiftStatus === 'on_shift' ? 'НА СМЕНЕ' : 'ОТДЫХ'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Бейдж текущей роли */}
      <View style={styles.roleBanner}>
        <Ionicons
          name={activeViewRole === 'dispatcher' ? 'headset' : activeViewRole === 'director' ? 'stats-chart' : 'build'}
          size={16}
          color="#38BDF8"
          style={{ marginRight: 6 }}
        />
        <Text style={styles.roleBannerText}>
          Рабочий стол: <Text style={styles.roleBannerBold}>{getRoleLabel(activeViewRole)}</Text>
        </Text>
      </View>

      {/* Баннер режима предпросмотра роли (супер-админ) */}
      {previewRole && (
        <TouchableOpacity style={styles.previewBanner} onPress={() => setPreviewRole(null)} activeOpacity={0.85}>
          <Ionicons name="eye" size={16} color="#FBBF24" style={{ marginRight: 8 }} />
          <Text style={styles.previewBannerText}>
            Предпросмотр роли: {getRoleLabel(activeViewRole)}. Нажмите, чтобы выйти.
          </Text>
        </TouchableOpacity>
      )}

      {/* Баннер проверки разрешений и фонового режима */}
      {hasMissingPermissions && (
        <TouchableOpacity
          style={styles.permissionsAlertBanner}
          onPress={() => setPermissionsModalVisible(true)}
          activeOpacity={0.8}
        >
          <View style={styles.permissionsAlertLeft}>
            <Ionicons name="warning" size={20} color="#F59E0B" />
            <View style={{ marginLeft: 10, flex: 1 }}>
              <Text style={styles.permissionsAlertTitle}>Включите системные разрешения</Text>
              <Text style={styles.permissionsAlertText}>
                Геолокация, фоновые пуши и фотоотчеты для стабильной работы мастера
              </Text>
            </View>
          </View>
          <View style={styles.permissionsAlertBtn}>
            <Text style={styles.permissionsAlertBtnText}>Настроить</Text>
          </View>
        </TouchableOpacity>
      )}

      {/* =========================================================================
          ВАРИАНТ 1: РАБОЧИЙ СТОЛ МАСТЕРА / ТЕХНИКА
         ========================================================================= */}
      {(activeViewRole === 'master' || activeViewRole === 'technician' || activeViewRole === 'installer') && (
        <View>
          {/* Плашка активного наряда на исполнении */}
          {activeTask ? (
            <View style={styles.activeTaskCard}>
              <View style={styles.activeTaskHeader}>
                <View style={styles.urgentBadge}>
                  <Text style={styles.urgentBadgeText}>
                    {activeTask.status === 'in_progress' ? '⚡ СЕЙЧАС В РАБОТЕ' : '🚗 В ПУТИ К ОБЪЕКТУ'}
                  </Text>
                </View>
                <Text style={styles.taskNumber}>{activeTask.task_number}</Text>
              </View>

              <Text style={styles.activeTaskTitle}>{activeTask.title}</Text>
              
              <View style={styles.addressRow}>
                <Ionicons name="location" size={18} color="#38BDF8" style={{ marginRight: 6 }} />
                <Text style={styles.addressText}>
                  {activeTask.address}{activeTask.apartment ? `, кв. ${activeTask.apartment}` : ''}
                </Text>
              </View>

              {activeTask.intercom_code ? (
                <View style={styles.infoPillRow}>
                  <View style={styles.infoPill}>
                    <Text style={styles.infoPillLabel}>Подъезд: </Text>
                    <Text style={styles.infoPillValue}>{activeTask.entrance || '-'}</Text>
                  </View>
                  <View style={styles.infoPill}>
                    <Text style={styles.infoPillLabel}>Код калитки: </Text>
                    <Text style={styles.infoPillValue}>{activeTask.intercom_code}</Text>
                  </View>
                </View>
              ) : null}

              <View style={styles.activeTaskActions}>
                <TouchableOpacity
                  style={styles.callClientBtn}
                  onPress={() => callPhone(activeTask.client_phone)}
                >
                  <Ionicons name="call" size={16} color="#FFFFFF" />
                  <Text style={styles.callClientBtnText}>Позвонить</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.detailsBtn}
                  onPress={() => router.push('/(tabs)/tasks')}
                >
                  <Text style={styles.detailsBtnText}>Открыть наряд</Text>
                  <Ionicons name="chevron-forward" size={16} color="#38BDF8" />
                </TouchableOpacity>
              </View>
            </View>
          ) : null}

          {/* Метрики выработки мастера за сегодня */}
          <Text style={styles.sectionTitle}>МОЯ ВЫРАБОТКА СЕГОДНЯ</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{doneTodayCount}</Text>
              <Text style={styles.statLabel}>Выполнено</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statValue, { color: '#F59E0B' }]}>{inProgressCount}</Text>
              <Text style={styles.statLabel}>В работе</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statValue, { color: '#10B981' }]}>
                {stats.total_earnings_today.toLocaleString('ru-RU')} ₽
              </Text>
              <Text style={styles.statLabel}>Начислено</Text>
            </View>
          </View>

          {/* Быстрые действия мастера */}
          <Text style={styles.sectionTitle}>БЫСТРЫЕ ДЕЙСТВИЯ</Text>
          <View style={styles.actionsGrid}>
            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => router.push('/(tabs)/tasks')}
            >
              <View style={[styles.actionIconWrap, { backgroundColor: 'rgba(59, 130, 246, 0.15)' }]}>
                <Ionicons name="list" size={22} color="#3B82F6" />
              </View>
              <Text style={styles.actionCardTitle}>Все наряды</Text>
              <Text style={styles.actionCardDesc}>{tasks.length} заявок в списке</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => router.push('/(tabs)/acts')}
            >
              <View style={[styles.actionIconWrap, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                <Ionicons name="document-text" size={22} color="#10B981" />
              </View>
              <Text style={styles.actionCardTitle}>Составить акт</Text>
              <Text style={styles.actionCardDesc}>С подписью жильца</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* =========================================================================
          ВАРИАНТ 2: РАБОЧИЙ СТОЛ ДИСПЕТЧЕРА
         ========================================================================= */}
      {activeViewRole === 'dispatcher' && (
        <View>
          {/* Сводка диспетчерской службы */}
          <View style={styles.dispatcherOverview}>
            <View style={styles.dispStatItem}>
              <Text style={styles.dispStatNumber}>{tasks.length}</Text>
              <Text style={styles.dispStatLabel}>В очереди</Text>
            </View>
            <View style={styles.dispStatDivider} />
            <View style={styles.dispStatItem}>
              <Text style={[styles.dispStatNumber, { color: '#EF4444' }]}>{urgentCount}</Text>
              <Text style={styles.dispStatLabel}>Срочные</Text>
            </View>
            <View style={styles.dispStatDivider} />
            <View style={styles.dispStatItem}>
              <Text style={[styles.dispStatNumber, { color: '#10B981' }]}>{doneTodayCount}</Text>
              <Text style={styles.dispStatLabel}>Выполнено</Text>
            </View>
          </View>

          {/* Очередь нераспределенных заявок */}
          <Text style={styles.sectionTitle}>СРОЧНЫЕ ВЫЗОВЫ ТРЕБУЮТ НАЗНАЧЕНИЯ</Text>
          {tasks.slice(0, 3).map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.queueCard}
              onPress={() => router.push('/(tabs)/tasks')}
            >
              <View style={styles.queueHeader}>
                <Text style={styles.queueAddress}>{item.address}</Text>
                <View style={styles.queuePriorityBadge}>
                  <Text style={styles.queuePriorityText}>{item.priority === 'urgent' ? 'СРОЧНО' : 'СТАНДАРТ'}</Text>
                </View>
              </View>
              <Text style={styles.queueTitle}>{item.title}</Text>
              <View style={styles.queueFooter}>
                <Text style={styles.queueClient}>{item.client_name} • {item.client_phone}</Text>
                <Text style={styles.assignLink}>Назначить ➔</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* =========================================================================
          ВАРИАНТ 3: РАБОЧИЙ СТОЛ РУКОВОДИТЕЛЯ / ДИРЕКТОРА
         ========================================================================= */}
      {(activeViewRole === 'director' || activeViewRole === 'admin' || activeViewRole === 'superadmin') && (
        <View>
          {/* Финансово-операционная сводка */}
          <View style={styles.directorHeaderCard}>
            <Text style={styles.directorCardSubtitle}>СВОДКА ЗА ТЕКУЩИЙ ДЕНЬ</Text>
            <Text style={styles.directorRevenue}>{(stats.total_earnings_today || 0).toLocaleString('ru-RU')} ₽</Text>
            <Text style={styles.directorRevenueDesc}>Выручка по подписанным актам за сегодня</Text>

            <View style={styles.directorMetricsRow}>
              <View style={styles.directorMetric}>
                <Text style={styles.dirMetricVal}>{doneTodayCount}</Text>
                <Text style={styles.dirMetricSub}>Выполнено</Text>
              </View>
              <View style={styles.directorMetric}>
                <Text style={styles.dirMetricVal}>{inProgressCount}</Text>
                <Text style={styles.dirMetricSub}>В работе</Text>
              </View>
              <View style={styles.directorMetric}>
                <Text style={styles.dirMetricVal}>{urgentCount}</Text>
                <Text style={styles.dirMetricSub}>Срочных</Text>
              </View>
            </View>
          </View>

          {/* Быстрый доступ к контролю */}
          <Text style={styles.sectionTitle}>КОНТРОЛЬ И АУДИТ</Text>
          <View style={styles.actionsGrid}>
            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => router.push('/(tabs)/acts')}
            >
              <View style={[styles.actionIconWrap, { backgroundColor: 'rgba(139, 92, 246, 0.15)' }]}>
                <Ionicons name="shield-checkmark" size={22} color="#8B5CF6" />
              </View>
              <Text style={styles.actionCardTitle}>Реестр актов</Text>
              <Text style={styles.actionCardDesc}>Подписанные документы</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => router.push('/(tabs)/tasks')}
            >
              <View style={[styles.actionIconWrap, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
                <Ionicons name="speedometer" size={22} color="#F59E0B" />
              </View>
              <Text style={styles.actionCardTitle}>Мониторинг</Text>
              <Text style={styles.actionCardDesc}>Все заявки филиала</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Переключение ролей перенесено в Профиль (только для супер-админа, режим предпросмотра). */}

      {/* Центр системных разрешений и фонового режима */}
      <PermissionsCenterModal
        visible={permissionsModalVisible}
        onClose={async () => {
          setPermissionsModalVisible(false);
          const s = await checkAllStaffPermissions();
          setHasMissingPermissions(!s.allEssentialGranted);
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B132B',
  },
  permissionsAlertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.4)',
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
  },
  permissionsAlertLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  permissionsAlertTitle: {
    color: '#FCD34D',
    fontSize: 13,
    fontWeight: '700',
  },
  permissionsAlertText: {
    color: '#CBD5E1',
    fontSize: 11,
    marginTop: 2,
    lineHeight: 14,
  },
  permissionsAlertBtn: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  permissionsAlertBtnText: {
    color: '#0F172A',
    fontSize: 12,
    fontWeight: '800',
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : 36,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  companyName: {
    fontSize: 12,
    fontWeight: '800',
    color: '#38BDF8',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  employeeName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F8FAFC',
    marginTop: 2,
  },
  shiftToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  shiftOn: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  shiftOff: {
    backgroundColor: 'rgba(100, 116, 139, 0.15)',
    borderColor: 'rgba(100, 116, 139, 0.4)',
  },
  shiftDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  shiftDotOn: {
    backgroundColor: '#10B981',
  },
  shiftDotOff: {
    backgroundColor: '#94A3B8',
  },
  shiftText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#F1F5F9',
    letterSpacing: 0.5,
  },
  roleBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 20,
  },
  roleBannerText: {
    fontSize: 12,
    color: '#94A3B8',
  },
  roleBannerBold: {
    color: '#F8FAFC',
    fontWeight: '700',
  },
  activeTaskCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
    marginBottom: 20,
  },
  activeTaskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  urgentBadge: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  urgentBadgeText: {
    color: '#EF4444',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  taskNumber: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  activeTaskTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 8,
    lineHeight: 22,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  addressText: {
    fontSize: 14,
    color: '#38BDF8',
    fontWeight: '600',
  },
  infoPillRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  infoPill: {
    flexDirection: 'row',
    backgroundColor: '#0F172A',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  infoPillLabel: {
    fontSize: 11,
    color: '#64748B',
  },
  infoPillValue: {
    fontSize: 11,
    color: '#F1F5F9',
    fontWeight: '700',
  },
  activeTaskActions: {
    flexDirection: 'row',
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: '#334155',
    paddingTop: 12,
  },
  callClientBtn: {
    backgroundColor: '#10B981',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    flex: 1,
  },
  callClientBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 6,
  },
  detailsBtn: {
    backgroundColor: '#0F172A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#38BDF8',
    flex: 1,
  },
  detailsBtnText: {
    color: '#38BDF8',
    fontSize: 13,
    fontWeight: '700',
    marginRight: 4,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  statLabel: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 4,
  },
  actionsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  actionCard: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  actionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  actionCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  actionCardDesc: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  dispatcherOverview: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 20,
    alignItems: 'center',
  },
  dispStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  dispStatDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#334155',
  },
  dispStatNumber: {
    fontSize: 22,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  dispStatLabel: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  queueCard: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 10,
  },
  queueHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  queueAddress: {
    fontSize: 14,
    fontWeight: '700',
    color: '#38BDF8',
  },
  queuePriorityBadge: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  queuePriorityText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#EF4444',
  },
  queueTitle: {
    fontSize: 13,
    color: '#F1F5F9',
    marginBottom: 8,
  },
  queueFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#334155',
    paddingTop: 8,
  },
  queueClient: {
    fontSize: 11,
    color: '#64748B',
  },
  assignLink: {
    fontSize: 12,
    fontWeight: '700',
    color: '#38BDF8',
  },
  directorHeaderCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
    marginBottom: 20,
  },
  directorCardSubtitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#A78BFA',
    letterSpacing: 0.8,
  },
  directorRevenue: {
    fontSize: 32,
    fontWeight: '800',
    color: '#F8FAFC',
    marginTop: 4,
  },
  directorRevenueDesc: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
    marginBottom: 16,
  },
  directorMetricsRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#334155',
    paddingTop: 14,
  },
  directorMetric: {
    flex: 1,
    alignItems: 'center',
  },
  dirMetricVal: {
    fontSize: 16,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  dirMetricSub: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
  },
  previewBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.4)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  previewBannerText: {
    flex: 1,
    color: '#FCD34D',
    fontSize: 12,
    fontWeight: '700',
  },
  roleSwitchBox: {
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 14,
    marginTop: 10,
  },
  roleSwitchTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#38BDF8',
    letterSpacing: 0.8,
    marginBottom: 10,
    textAlign: 'center',
  },
  roleTabsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  roleTab: {
    flex: 1,
    backgroundColor: '#0F172A',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  roleTabActive: {
    backgroundColor: '#2563EB',
    borderColor: '#38BDF8',
  },
  roleTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
  },
  roleTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
