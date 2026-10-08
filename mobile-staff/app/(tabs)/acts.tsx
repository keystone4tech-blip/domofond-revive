/**
 * Экран «Электронные акты выполненных работ» — Приложение «Офис Работа»
 * Формирование и просмотр актов сдачи-приемки работ с жильцами
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useStaffTasksStore } from '../../src/store/tasks.store';
import { useStaffAuthStore } from '../../src/store/auth.store';
import { WorkAct } from '../../src/types/staff';

export default function ActsScreen() {
  const acts = useStaffTasksStore((state) => state.acts);
  const tasks = useStaffTasksStore((state) => state.tasks);
  const createAct = useStaffTasksStore((state) => state.createAct);
  const user = useStaffAuthStore((state) => state.user);

  // Состояние создания нового акта
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | number>(tasks[0]?.id || '');
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [address, setAddress] = useState('');
  const [worksDone, setWorksDone] = useState('');
  const [materialsUsed, setMaterialsUsed] = useState('');
  const [totalPrice, setTotalPrice] = useState('0');
  const [isSigned, setIsSigned] = useState(true);

  // Открытие формы по наряду
  const openNewActForm = () => {
    const defaultTask = tasks.find((t) => t.status === 'in_progress' || t.status === 'assigned') || tasks[0];
    if (defaultTask) {
      setSelectedTaskId(defaultTask.id);
      setClientName(defaultTask.client_name);
      setClientPhone(defaultTask.client_phone);
      setAddress(`${defaultTask.address}${defaultTask.apartment ? `, кв. ${defaultTask.apartment}` : ''}`);
      setWorksDone(defaultTask.title);
      setMaterialsUsed(defaultTask.materials?.join(', ') || 'Расходные материалы по регламенту');
      setTotalPrice(String(defaultTask.payment_amount || 0));
    }
    setIsModalOpen(true);
  };

  const handleSaveAct = () => {
    if (!worksDone.trim()) {
      Alert.alert('Внимание', 'Укажите перечень выполненных работ');
      return;
    }

    const actNumber = `АКТ-${new Date().getFullYear()}/${Math.floor(100 + Math.random() * 900)}`;

    createAct({
      task_id: selectedTaskId,
      act_number: actNumber,
      client_name: clientName || 'Абонент',
      client_phone: clientPhone || '+7 (900) 000-00-00',
      address: address || 'Адрес объекта',
      employee_name: user?.full_name || 'Шибаев Сергей Викторович',
      employee_role: 'Сервисный мастер',
      works_done: worksDone.trim(),
      materials_used: materialsUsed.trim() || 'Без расходных материалов',
      total_price: Number(totalPrice) || 0,
      client_signed: isSigned,
    });

    setIsModalOpen(false);
    Alert.alert('Успешно', `Электронный ${actNumber} подписан и зарегистрирован в CRM!`);
  };

  const renderActItem = ({ item }: { item: WorkAct }) => (
    <View style={styles.actCard}>
      <View style={styles.actHeader}>
        <View style={styles.actNumberBadge}>
          <Text style={styles.actNumberText}>{item.act_number}</Text>
        </View>
        <Text style={styles.actDate}>
          {new Date(item.created_at).toLocaleDateString('ru-RU')}
        </Text>
      </View>

      <Text style={styles.actAddress}>{item.address}</Text>

      <View style={styles.actDetailSection}>
        <Text style={styles.actLabel}>Выполненные работы:</Text>
        <Text style={styles.actValue}>{item.works_done}</Text>
      </View>

      {item.materials_used ? (
        <View style={styles.actDetailSection}>
          <Text style={styles.actLabel}>Материалы:</Text>
          <Text style={styles.actValue}>{item.materials_used}</Text>
        </View>
      ) : null}

      <View style={styles.actFooter}>
        <View>
          <Text style={styles.actClientLabel}>Заказчик: {item.client_name}</Text>
          <Text style={styles.actEmployeeLabel}>Мастер: {item.employee_name}</Text>
        </View>
        <View style={styles.actPriceBlock}>
          <Text style={styles.actPriceText}>
            {item.total_price > 0 ? `${item.total_price} ₽` : 'По договору ТО'}
          </Text>
          <View style={styles.signedBadge}>
            <Ionicons name="checkmark-circle" size={14} color="#10B981" />
            <Text style={styles.signedBadgeText}>Подписан</Text>
          </View>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Шапка */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Акты работ</Text>
          <Text style={styles.headerSubtitle}>
            Электронные акты сдачи-приемки ({acts.length})
          </Text>
        </View>

        <TouchableOpacity style={styles.addActBtn} onPress={openNewActForm}>
          <Ionicons name="add" size={20} color="#FFFFFF" />
          <Text style={styles.addActBtnText}>Новый акт</Text>
        </TouchableOpacity>
      </View>

      {/* Список актов */}
      <FlatList
        data={acts}
        keyExtractor={(item) => item.id}
        renderItem={renderActItem}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Ionicons name="document-text-outline" size={48} color="#64748B" />
            <Text style={styles.emptyTitle}>Акты еще не составлялись</Text>
            <Text style={styles.emptySubtitle}>После завершения наряда составьте электронный акт</Text>
          </View>
        }
      />

      {/* Модальное окно составления акта */}
      <Modal
        visible={isModalOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Электронный акт выполненных работ</Text>
              <TouchableOpacity onPress={() => setIsModalOpen(false)}>
                <Ionicons name="close" size={24} color="#F8FAFC" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Адрес объекта</Text>
                <TextInput
                  style={styles.modalInput}
                  value={address}
                  onChangeText={setAddress}
                  placeholder="ул. Ленина, 10, кв. 15"
                  placeholderTextColor="#64748B"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>ФИО жильца / заказчика</Text>
                <TextInput
                  style={styles.modalInput}
                  value={clientName}
                  onChangeText={setClientName}
                  placeholder="Иванов Иван Иванович"
                  placeholderTextColor="#64748B"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Выполненные работы</Text>
                <TextInput
                  style={[styles.modalInput, styles.modalTextArea]}
                  value={worksDone}
                  onChangeText={setWorksDone}
                  placeholder="Опишите выполненные операции и результат"
                  placeholderTextColor="#64748B"
                  multiline
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Использованные комплектующие и материалы</Text>
                <TextInput
                  style={styles.modalInput}
                  value={materialsUsed}
                  onChangeText={setMaterialsUsed}
                  placeholder="Трубка, кабель, крепеж..."
                  placeholderTextColor="#64748B"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Сумма к оплате на объекте (руб.)</Text>
                <TextInput
                  style={styles.modalInput}
                  value={totalPrice}
                  onChangeText={setTotalPrice}
                  keyboardType="numeric"
                  placeholderTextColor="#64748B"
                />
              </View>

              {/* Блок подписи */}
              <TouchableOpacity
                style={styles.signatureCheckRow}
                onPress={() => setIsSigned(!isSigned)}
              >
                <Ionicons
                  name={isSigned ? 'checkbox' : 'square-outline'}
                  size={24}
                  color="#10B981"
                />
                <Text style={styles.signatureText}>
                  Работы выполнены в полном объеме, претензий нет. Акт согласован заказчиком.
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.saveActBtn} onPress={handleSaveAct}>
                <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                <Text style={styles.saveActBtnText}>Подписать и отправить в CRM</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  addActBtn: {
    backgroundColor: '#2563EB',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  addActBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 30,
    gap: 12,
  },
  actCard: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  actHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  actNumberBadge: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  actNumberText: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '700',
  },
  actDate: {
    fontSize: 11,
    color: '#64748B',
  },
  actAddress: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 10,
  },
  actDetailSection: {
    marginBottom: 8,
  },
  actLabel: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 2,
  },
  actValue: {
    fontSize: 13,
    color: '#E2E8F0',
    lineHeight: 18,
  },
  actFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: '#334155',
    paddingTop: 10,
    marginTop: 6,
  },
  actClientLabel: {
    fontSize: 11,
    color: '#94A3B8',
  },
  actEmployeeLabel: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  actPriceBlock: {
    alignItems: 'flex-end',
  },
  actPriceText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  signedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  signedBadgeText: {
    fontSize: 11,
    color: '#10B981',
    fontWeight: '600',
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
    maxHeight: '90%',
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    paddingBottom: 12,
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  modalScroll: {
    paddingBottom: 30,
  },
  inputGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
    marginBottom: 6,
  },
  modalInput: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#F8FAFC',
    fontSize: 14,
  },
  modalTextArea: {
    height: 70,
    textAlignVertical: 'top',
  },
  signatureCheckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 8,
    padding: 12,
    marginVertical: 12,
    gap: 10,
  },
  signatureText: {
    flex: 1,
    fontSize: 12,
    color: '#A7F3D0',
    lineHeight: 16,
  },
  saveActBtn: {
    backgroundColor: '#10B981',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
    marginTop: 8,
    marginBottom: 20,
  },
  saveActBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
