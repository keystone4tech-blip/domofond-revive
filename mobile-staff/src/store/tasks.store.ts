/**
 * Хранилище сервисных нарядов, задач и электронных актов (Zustand)
 * Служебное приложение «Офис Работа»
 */

import { create } from 'zustand';
import { Linking, Alert } from 'react-native';
import { StaffTask, WorkAct, TaskStatus, TaskPriority } from '../types/staff';
import { staffApiClient } from '../api/client';

// Стартовые реалистичные наряды для тестирования и оффлайн-работы
const INITIAL_STAFF_TASKS: StaffTask[] = [
  {
    id: 'task-101',
    task_number: 'НАРЯД-4281',
    title: 'Не открывает дверь с трубки в квартире',
    description: 'Жилец жалуется, что вызов проходит, но при нажатии кнопки открытия замок на подъезде не срабатывает. Требуется диагностика линии и трубки.',
    address: 'ул. Красная, д. 125',
    entrance: '3',
    floor: '5',
    apartment: '42',
    intercom_code: '#3489',
    client_name: 'Семенова Ольга Ивановна',
    client_phone: '+7 (918) 234-56-78',
    status: 'in_progress',
    priority: 'urgent',
    scheduled_time: 'Сегодня, 14:00 – 15:30',
    created_at: '2026-10-08T10:15:00Z',
    work_type: 'repair',
    payment_amount: 550,
    is_paid: false,
    notes: 'Код калитки 1234. Дома будет бабушка, звонить заранее.',
    materials: ['Трубка квартирная УКП-7 (серая)', 'Двухжильный кабель КСПВ 2х0.5'],
  },
  {
    id: 'task-102',
    task_number: 'НАРЯД-4282',
    title: 'Монтаж и подключение новой трубки домофона',
    description: 'Новый абонент, ранее трубки не было. Необходимо провести кабель от этажного щитка и смонтировать трубку Vizit УКП-12M.',
    address: 'ул. Ставропольская, д. 84/1',
    entrance: '1',
    floor: '2',
    apartment: '14',
    intercom_code: '#8401',
    client_name: 'Дмитриев Артем Сергеевич',
    client_phone: '+7 (903) 456-78-90',
    status: 'assigned',
    priority: 'medium',
    scheduled_time: 'Сегодня, 16:00 – 17:00',
    created_at: '2026-10-08T11:30:00Z',
    work_type: 'install',
    payment_amount: 1200,
    is_paid: true,
    notes: 'Оплачено онлайн через приложение. Проверить коммутатор БК-100.',
  },
  {
    id: 'task-103',
    task_number: 'НАРЯД-4283',
    title: 'Регулировка доводчика подъездной двери',
    description: 'Дверь сильно хлопает при закрытии, жалуются жильцы первого этажа. Требуется регулировка скоростей закрытия и дохлопа, протяжка крепежа.',
    address: 'ул. Тургенева, д. 152',
    entrance: '2',
    floor: '1',
    client_name: 'Старший по подъезду (Виктор Николаевич)',
    client_phone: '+7 (918) 789-01-23',
    status: 'en_route',
    priority: 'urgent',
    scheduled_time: 'Сегодня, 17:30 – 18:30',
    created_at: '2026-10-08T12:00:00Z',
    work_type: 'maintenance',
    payment_amount: 0,
    is_paid: true,
    notes: 'В рамках гарантийного обслуживания ТО.',
  },
  {
    id: 'task-104',
    task_number: 'НАРЯД-4279',
    title: 'Доставка и прописка 3-х бесконтактных ключей RFID',
    description: 'Жилец заказал дополнительные электронные ключи-брелоки. Закодировать на месте и передать под подпись.',
    address: 'ул. Северная, д. 210',
    entrance: '4',
    floor: '7',
    apartment: '98',
    intercom_code: '#2104',
    client_name: 'Кузнецов Игорь Павлович',
    client_phone: '+7 (928) 333-44-55',
    status: 'done',
    priority: 'low',
    scheduled_time: 'Сегодня, 12:00',
    created_at: '2026-10-08T09:00:00Z',
    work_type: 'keys',
    payment_amount: 750,
    is_paid: true,
    materials: ['RFID брелок Mifare (синий) — 3 шт.'],
  },
];

interface TasksState {
  tasks: StaffTask[];
  acts: WorkAct[];
  searchQuery: string;
  selectedFilter: string;
  isLoading: boolean;

  // Методы управления
  setSearchQuery: (query: string) => void;
  setSelectedFilter: (filter: string) => void;
  loadTasks: () => Promise<void>;
  updateTaskStatus: (taskId: string | number, newStatus: TaskStatus) => void;
  createAct: (act: Omit<WorkAct, 'id' | 'created_at'>) => void;
  callPhone: (phone: string) => void;
  getFilteredTasks: () => StaffTask[];
}

export const useStaffTasksStore = create<TasksState>((set, get) => ({
  tasks: INITIAL_STAFF_TASKS,
  acts: [
    {
      id: 'act-001',
      task_id: 'task-104',
      act_number: 'АКТ-2026/104',
      created_at: '2026-10-08T12:35:00Z',
      client_name: 'Кузнецов Игорь Павлович',
      client_phone: '+7 (928) 333-44-55',
      address: 'ул. Северная, д. 210, кв. 98',
      employee_name: 'Шибаев Сергей Викторович',
      employee_role: 'Сервисный мастер',
      works_done: 'Кодирование и проверка 3 бесконтактных RFID ключей к вызывной панели Vizit',
      materials_used: 'Брелоки Mifare — 3 шт.',
      total_price: 750,
      client_signed: true,
    }
  ],
  searchQuery: '',
  selectedFilter: 'all',
  isLoading: false,

  setSearchQuery: (query: string) => set({ searchQuery: query }),
  setSelectedFilter: (filter: string) => set({ selectedFilter: filter }),

  // Загрузка нарядов с бэкенда
  loadTasks: async () => {
    set({ isLoading: true });
    try {
      console.log('[Staff Tasks] Загрузка нарядов с сервера...');
      const response = await staffApiClient.get('/api/requests');
      if (response.data && Array.isArray(response.data)) {
        // Преобразуем входящие заявки в модель StaffTask
        const mapped: StaffTask[] = response.data.slice(0, 20).map((req: any, index: number) => ({
          id: req.id || `srv-${index}`,
          task_number: `НАРЯД-${req.id || 1000 + index}`,
          title: req.message || req.notes || 'Сервисный выезд мастера',
          description: req.notes || req.message || 'Диагностика домофонного оборудования',
          address: req.address || 'Адрес уточняется',
          apartment: req.apartment || undefined,
          client_name: req.name || 'Абонент',
          client_phone: req.phone || '+7 (900) 000-00-00',
          status: (req.status === 'completed' ? 'done' : req.status === 'in_progress' ? 'in_progress' : 'assigned') as TaskStatus,
          priority: (req.priority === 'urgent' ? 'urgent' : 'medium') as TaskPriority,
          scheduled_time: req.created_at ? new Date(req.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : 'В течение дня',
          created_at: req.created_at || new Date().toISOString(),
          work_type: req.order_type === 'keys' ? 'keys' : 'repair',
          payment_amount: req.price || 0,
          is_paid: req.payment_status === 'paid',
        }));

        if (mapped.length > 0) {
          // Объединяем с нашими задачами
          set({ tasks: [...INITIAL_STAFF_TASKS, ...mapped], isLoading: false });
          return;
        }
      }
    } catch (err: any) {
      console.warn('[Staff Tasks] Не удалось подтянуть внешние заявки, используем локальный реестр:', err.message);
    }
    set({ isLoading: false });
  },

  // Смена статуса наряда (Принял / Выехал / В работе / Выполнен)
  updateTaskStatus: (taskId: string | number, newStatus: TaskStatus) => {
    console.log(`[Staff Tasks] Изменение статуса наряда ${taskId} ➔ ${newStatus}`);
    set((state) => ({
      tasks: state.tasks.map((task) =>
        task.id === taskId ? { ...task, status: newStatus } : task
      ),
    }));

    // Попытка уведомить сервер о смене статуса
    staffApiClient.patch(`/api/requests/${taskId}`, { status: newStatus }).catch(() => {
      console.log(`[Staff Tasks] Статус сохранен локально для наряда ${taskId}`);
    });
  },

  // Создание электронного акта выполненных работ
  createAct: (actData: Omit<WorkAct, 'id' | 'created_at'>) => {
    const newAct: WorkAct = {
      ...actData,
      id: `act-${Date.now()}`,
      created_at: new Date().toISOString(),
    };

    set((state) => ({
      acts: [newAct, ...state.acts],
      // Также переводим наряд в статус "Выполнен"
      tasks: state.tasks.map((t) => t.id === actData.task_id ? { ...t, status: 'done' } : t),
    }));

    console.log('[Staff Tasks] Электронный акт успешно сформирован:', newAct.act_number);
  },

  // Быстрый вызов абонента по номеру телефона
  callPhone: (phone: string) => {
    const cleaned = phone.replace(/[^0-9+]/g, '');
    const url = `tel:${cleaned}`;
    Linking.canOpenURL(url)
      .then((supported) => {
        if (supported) {
          Linking.openURL(url);
        } else {
          Alert.alert('Звонок', `Номер абонента: ${phone}`);
        }
      })
      .catch(() => {
        Alert.alert('Звонок', `Номер абонента: ${phone}`);
      });
  },

  // Фильтрация и поиск нарядов
  getFilteredTasks: () => {
    const { tasks, searchQuery, selectedFilter } = get();
    return tasks.filter((task) => {
      // Поиск по строке
      const q = searchQuery.toLowerCase().trim();
      const matchQuery = !q ||
        task.address.toLowerCase().includes(q) ||
        task.client_name.toLowerCase().includes(q) ||
        task.task_number.toLowerCase().includes(q) ||
        task.title.toLowerCase().includes(q);

      if (!matchQuery) return false;

      // Фильтр по статусу
      if (selectedFilter === 'all') return true;
      if (selectedFilter === 'urgent') return task.priority === 'urgent' || task.priority === 'high';
      return task.status === selectedFilter;
    });
  },
}));
