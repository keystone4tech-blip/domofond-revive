/**
 * Экран «Наряды и заявки» — Приложение «Офис Работа»
 * Полный реестр нарядов с фильтрацией, сменой статуса и быстрым вызовом абонента
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  ScrollView,
  Platform,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useStaffTasksStore } from '../../src/store/tasks.store';
import { StaffTask, TaskStatus } from '../../src/types/staff';

export default function TasksScreen() {
  const tasks = useStaffTasksStore((state) => state.tasks);
  const selectedFilter = useStaffTasksStore((state) => state.selectedFilter);
  const setSelectedFilter = useStaffTasksStore((state) => state.setSelectedFilter);
  const searchQuery = useStaffTasksStore((state) => state.searchQuery);
  const setSearchQuery = useStaffTasksStore((state) => state.setSearchQuery);
  const updateTaskStatus = useStaffTasksStore((state) => state.updateTaskStatus);
  const loadTasks = useStaffTasksStore((state) => state.loadTasks);
  const isLoading = useStaffTasksStore((state) => state.isLoading);
  const callPhone = useStaffTasksStore((state) => state.callPhone);
  const getFilteredTasks = useStaffTasksStore((state) => state.getFilteredTasks);

  // Состояние модального окна подробного просмотра наряда
  const [selectedTask, setSelectedTask] = useState<StaffTask | null>(null);

  useEffect(() => {
    loadTasks();
  }, []);

  const filteredTasks = getFilteredTasks();

  // Фильтры
  const filters = [
    { id: 'all', label: 'Все' },
    { id: 'in_progress', label: 'В работе' },
    { id: 'en_route', label: 'В пути' },
    { id: 'assigned', label: 'Новые' },
    { id: 'done', label: 'Выполнены' },
    { id: 'urgent', label: '⚡ Срочные' },
  ];

  // Цвета и названия статусов
  const getStatusBadge = (status: TaskStatus) => {
    switch (status) {
      case 'in_progress':
        return { label: 'В работе', bg: 'rgba(245, 158, 11, 0.2)', text: '#F59E0B' };
      case 'en_route':
        return { label: 'В пути', bg: 'rgba(59, 130, 246, 0.2)', text: '#3B82F6' };
      case 'assigned':
        return { label: 'Назначен', bg: 'rgba(139, 92, 246, 0.2)', text: '#8B5CF6' };
      case 'done':
        return { label: 'Выполнен', bg: 'rgba(16, 185, 129, 0.2)', text: '#10B981' };
      case 'cancelled':
        return { label: 'Отменен', bg: 'rgba(239, 68, 68, 0.2)', text: '#EF4444' };
      default:
        return { label: 'Новый', bg: 'rgba(100, 116, 139, 0.2)', text: '#94A3B8' };
    }
  };

  const renderTaskCard = ({ item }: { item: StaffTask }) => {
    const badge = getStatusBadge(item.status);

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => setSelectedTask(item)}
        activeOpacity={0.7}
      >
        <View style={styles.cardTop}>
          <Text style={styles.taskNum}>{item.task_number}</Text>
          <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
            <Text style={[styles.statusBadgeText, { color: badge.text }]}>{badge.label}</Text>
          </View>
        </View>

        <Text style={styles.cardTitle}>{item.title}</Text>

        <View style={styles.cardAddressRow}>
          <Ionicons name="location-outline" size={16} color="#38BDF8" style={{ marginRight: 4 }} />
          <Text style={styles.cardAddress}>
            {item.address}{item.apartment ? `, кв. ${item.apartment}` : ''}
          </Text>
        </View>

        <View style={styles.cardMetaRow}>
          <Text style={styles.cardClient}>
            👤 {item.client_name}
          </Text>
          {item.priority === 'urgent' && (
            <View style={styles.urgentPill}>
              <Text style={styles.urgentPillText}>СРОЧНО</Text>
            </View>
          )}
        </View>

        <View style={styles.cardActions}>
          <TouchableOpacity
            style={styles.cardCallBtn}
            onPress={() => callPhone(item.client_phone)}
          >
            <Ionicons name="call" size={14} color="#10B981" />
            <Text style={styles.cardCallText}>Позвонить</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cardOpenBtn}
            onPress={() => setSelectedTask(item)}
          >
            <Text style={styles.cardOpenText}>Открыть ➔</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Шапка */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Наряды и заявки</Text>
        <Text style={styles.headerSubtitle}>
          Найдено: {filteredTasks.length} нарядов
        </Text>
      </View>

      {/* Поиск */}
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color="#64748B" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Поиск по адресу, номеру, жильцу..."
          placeholderTextColor="#64748B"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery ? (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={18} color="#64748B" />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Горизонтальные фильтры */}
      <View style={styles.filtersScrollWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersScroll}>
          {filters.map((f) => (
            <TouchableOpacity
              key={f.id}
              style={[styles.filterChip, selectedFilter === f.id && styles.filterChipActive]}
              onPress={() => setSelectedFilter(f.id)}
            >
              <Text style={[styles.filterChipText, selectedFilter === f.id && styles.filterChipTextActive]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Список нарядов */}
      <FlatList
        data={filteredTasks}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderTaskCard}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={loadTasks}
            tintColor="#38BDF8"
            colors={['#38BDF8', '#10B981']}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Ionicons name="checkmark-done-circle-outline" size={48} color="#64748B" />
            <Text style={styles.emptyTitle}>Нет нарядов в этом разделе</Text>
            <Text style={styles.emptySubtitle}>Все текущие заявки выполнены или перенесены</Text>
          </View>
        }
      />

      {/* Модальное окно деталей наряда и смены статуса */}
      {selectedTask && (
        <Modal
          visible={!!selectedTask}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setSelectedTask(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalNumber}>{selectedTask.task_number}</Text>
                  <Text style={styles.modalStatus}>Статус: {getStatusBadge(selectedTask.status).label}</Text>
                </View>
                <TouchableOpacity onPress={() => setSelectedTask(null)} style={styles.modalCloseBtn}>
                  <Ionicons name="close" size={24} color="#F8FAFC" />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalBody}>
                <Text style={styles.modalTaskTitle}>{selectedTask.title}</Text>
                <Text style={styles.modalDesc}>{selectedTask.description}</Text>

                <View style={styles.detailBlock}>
                  <Text style={styles.detailLabel}>📍 АДРЕС И ПОДЪЕЗД</Text>
                  <Text style={styles.detailValue}>
                    {selectedTask.address}{selectedTask.apartment ? `, кв. ${selectedTask.apartment}` : ''}
                  </Text>
                  <Text style={styles.detailSub}>
                    Подъезд: {selectedTask.entrance || '1'} • Этаж: {selectedTask.floor || '–'} • Код: {selectedTask.intercom_code || '–'}
                  </Text>
                </View>

                <View style={styles.detailBlock}>
                  <Text style={styles.detailLabel}>👤 ЖИЛЕЦ / ЗАКАЗЧИК</Text>
                  <Text style={styles.detailValue}>{selectedTask.client_name}</Text>
                  <TouchableOpacity
                    style={styles.modalCallRow}
                    onPress={() => callPhone(selectedTask.client_phone)}
                  >
                    <Ionicons name="call" size={16} color="#10B981" />
                    <Text style={styles.modalCallPhone}>{selectedTask.client_phone}</Text>
                  </TouchableOpacity>
                </View>

                {selectedTask.notes ? (
                  <View style={styles.detailBlock}>
                    <Text style={styles.detailLabel}>📝 ЗАМЕТКИ ДИСПЕТЧЕРА</Text>
                    <Text style={styles.detailNotes}>{selectedTask.notes}</Text>
                  </View>
                ) : null}

                {/* Кнопки смены статуса наряда */}
                <Text style={[styles.detailLabel, { marginTop: 14 }]}>ИЗМЕНИТЬ СТАТУС НА ИСПОЛНЕНИИ:</Text>
                <View style={styles.statusButtonsGroup}>
                  <TouchableOpacity
                    style={[styles.statusChangeBtn, { backgroundColor: '#3B82F6' }]}
                    onPress={() => {
                      updateTaskStatus(selectedTask.id, 'en_route');
                      setSelectedTask({ ...selectedTask, status: 'en_route' });
                    }}
                  >
                    <Ionicons name="car" size={18} color="#FFFFFF" />
                    <Text style={styles.statusChangeBtnText}>Выехал на объект</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.statusChangeBtn, { backgroundColor: '#F59E0B' }]}
                    onPress={() => {
                      updateTaskStatus(selectedTask.id, 'in_progress');
                      setSelectedTask({ ...selectedTask, status: 'in_progress' });
                    }}
                  >
                    <Ionicons name="construct" size={18} color="#FFFFFF" />
                    <Text style={styles.statusChangeBtnText}>Прибыл / В работе</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.statusChangeBtn, { backgroundColor: '#10B981' }]}
                    onPress={() => {
                      updateTaskStatus(selectedTask.id, 'done');
                      setSelectedTask(null);
                    }}
                  >
                    <Ionicons name="checkmark-done" size={18} color="#FFFFFF" />
                    <Text style={styles.statusChangeBtnText}>Завершить наряд</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B132B',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : 36,
    paddingBottom: 12,
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
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    marginHorizontal: 16,
    paddingHorizontal: 12,
    height: 44,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: '#F8FAFC',
    fontSize: 14,
  },
  filtersScrollWrap: {
    marginBottom: 10,
  },
  filtersScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  filterChipActive: {
    backgroundColor: '#2563EB',
    borderColor: '#38BDF8',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 30,
    gap: 12,
  },
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  taskNum: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 6,
    lineHeight: 20,
  },
  cardAddressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardAddress: {
    fontSize: 13,
    color: '#38BDF8',
    fontWeight: '600',
  },
  cardMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardClient: {
    fontSize: 12,
    color: '#94A3B8',
  },
  urgentPill: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  urgentPillText: {
    color: '#EF4444',
    fontSize: 10,
    fontWeight: '800',
  },
  cardActions: {
    flexDirection: 'row',
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: '#334155',
    paddingTop: 10,
  },
  cardCallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#10B981',
  },
  cardCallText: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '600',
    marginLeft: 4,
  },
  cardOpenBtn: {
    flex: 1,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  cardOpenText: {
    fontSize: 13,
    color: '#38BDF8',
    fontWeight: '700',
  },
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F8FAFC',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1E293B',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    paddingBottom: 12,
    marginBottom: 14,
  },
  modalNumber: {
    fontSize: 17,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  modalStatus: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: 6,
  },
  modalBody: {
    paddingBottom: 30,
  },
  modalTaskTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 8,
  },
  modalDesc: {
    fontSize: 13,
    color: '#94A3B8',
    lineHeight: 18,
    marginBottom: 16,
  },
  detailBlock: {
    backgroundColor: '#0F172A',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 10,
  },
  detailLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  detailSub: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 4,
  },
  modalCallRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  modalCallPhone: {
    fontSize: 13,
    color: '#10B981',
    fontWeight: '700',
    marginLeft: 6,
  },
  detailNotes: {
    fontSize: 12,
    color: '#F1F5F9',
    fontStyle: 'italic',
  },
  statusButtonsGroup: {
    gap: 8,
    marginTop: 8,
    marginBottom: 20,
  },
  statusChangeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
  },
  statusChangeBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
