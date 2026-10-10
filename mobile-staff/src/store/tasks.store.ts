/**
 * Хранилище сервисных нарядов, задач, электронных актов и статистики выработки (Zustand)
 * Служебное приложение «Офис Работа» — полноценная интеграция с бэкендом и PostgreSQL
 */

import { create } from 'zustand';
import { Linking, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StaffTask, WorkAct, TaskStatus, TaskPriority } from '../types/staff';
import { staffApiClient } from '../api/client';

// Ключи локального хранилища для оффлайн-режима
const TASKS_STORAGE_KEY = 'officework_cached_tasks';
const ACTS_STORAGE_KEY = 'officework_cached_acts';

// Резервный стартовый набор на случай полного оффлайна при первом открытии
const FALLBACK_TASKS: StaffTask[] = [
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
    created_at: new Date().toISOString(),
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
    created_at: new Date().toISOString(),
    work_type: 'install',
    payment_amount: 1200,
    is_paid: true,
    notes: 'Оплачено онлайн через приложение. Проверить коммутатор БК-100.',
  },
];

interface StaffStats {
  completed_today: number;
  in_progress: number;
  total_earnings_today: number;
  rating: number;
}

interface TasksState {
  tasks: StaffTask[];
  acts: WorkAct[];
  stats: StaffStats;
  searchQuery: string;
  selectedFilter: string;
  isLoading: boolean;
  isActsLoading: boolean;

  // Методы управления
  setSearchQuery: (query: string) => void;
  setSelectedFilter: (filter: string) => void;
  loadTasks: () => Promise<void>;
  loadActs: () => Promise<void>;
  loadStats: () => Promise<void>;
  updateTaskStatus: (taskId: string | number, newStatus: TaskStatus) => Promise<void>;
  createAct: (act: Omit<WorkAct, 'id' | 'created_at'>) => Promise<boolean>;
  callPhone: (phone: string) => void;
  getFilteredTasks: () => StaffTask[];
}

export const useStaffTasksStore = create<TasksState>((set, get) => ({
  tasks: [],
  acts: [],
  stats: {
    completed_today: 0,
    in_progress: 0,
    total_earnings_today: 0,
    rating: 0,
  },
  searchQuery: '',
  selectedFilter: 'all',
  isLoading: false,
  isActsLoading: false,

  setSearchQuery: (query: string) => set({ searchQuery: query }),
  setSelectedFilter: (filter: string) => set({ selectedFilter: filter }),

  // 1. Загрузка реальных нарядов и сервисных заявок с бэкенда
  loadTasks: async () => {
    set({ isLoading: true });
    try {
      console.log('[Staff Tasks] Загрузка реальных нарядов с сервера /api/tasks...');
      const response = await staffApiClient.get<StaffTask[]>('/api/tasks');

      if (response.data && Array.isArray(response.data) && response.data.length > 0) {
        console.log(`[Staff Tasks] Успешно получено ${response.data.length} нарядов из БД PostgreSQL`);
        set({ tasks: response.data, isLoading: false });
        // Сохраняем в оффлайн-кэш
        AsyncStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(response.data)).catch(() => {});
        return;
      }

      // Если список пустой, пробуем восстановить из оффлайн-кэша
      const cached = await AsyncStorage.getItem(TASKS_STORAGE_KEY);
      if (cached) {
        set({ tasks: JSON.parse(cached), isLoading: false });
        return;
      }
    } catch (err: any) {
      console.warn('[Staff Tasks] Ошибка сети при загрузке нарядов, используем кэш:', err.message);
      try {
        const cached = await AsyncStorage.getItem(TASKS_STORAGE_KEY);
        if (cached) {
          set({ tasks: JSON.parse(cached), isLoading: false });
          return;
        }
      } catch {}
    }
    set({ isLoading: false });
  },

  // 2. Загрузка реестра электронных актов с сервера
  loadActs: async () => {
    set({ isActsLoading: true });
    try {
      console.log('[Staff Tasks] Загрузка электронных актов с сервера /api/acts...');
      const response = await staffApiClient.get<WorkAct[]>('/api/acts');

      if (response.data && Array.isArray(response.data)) {
        console.log(`[Staff Tasks] Получено ${response.data.length} актов из PostgreSQL`);
        set({ acts: response.data, isActsLoading: false });
        AsyncStorage.setItem(ACTS_STORAGE_KEY, JSON.stringify(response.data)).catch(() => {});
        return;
      }

      const cached = await AsyncStorage.getItem(ACTS_STORAGE_KEY);
      if (cached) {
        set({ acts: JSON.parse(cached), isActsLoading: false });
      }
    } catch (err: any) {
      console.warn('[Staff Tasks] Ошибка загрузки актов:', err.message);
      try {
        const cached = await AsyncStorage.getItem(ACTS_STORAGE_KEY);
        if (cached) {
          set({ acts: JSON.parse(cached), isActsLoading: false });
        }
      } catch {}
    }
    set({ isActsLoading: false });
  },

  // 3. Загрузка метрик выработки мастера
  loadStats: async () => {
    try {
      const response = await staffApiClient.get<StaffStats>('/api/staff/stats');
      if (response.data) {
        set({ stats: response.data });
      }
    } catch (err: any) {
      console.warn('[Staff Tasks] Ошибка получения статистики выработки:', err.message);
    }
  },

  // 4. Смена статуса наряда (Принял / Выехал / В работе / Выполнен) с отправкой в БД
  updateTaskStatus: async (taskId: string | number, newStatus: TaskStatus) => {
    console.log(`[Staff Tasks] Изменение статуса наряда ${taskId} ➔ ${newStatus}`);

    // Оптимистичное обновление UI
    set((state) => ({
      tasks: state.tasks.map((task) =>
        task.id === taskId ? { ...task, status: newStatus } : task
      ),
    }));

    try {
      // Отправляем PATCH запрос на боевой сервер
      await staffApiClient.patch(`/api/tasks/${taskId}`, { status: newStatus });
      console.log(`[Staff Tasks] Статус наряда ${taskId} успешно зафиксирован в PostgreSQL`);
      // Обновляем статистику
      get().loadStats().catch(() => {});
    } catch (err: any) {
      console.warn(`[Staff Tasks] Ошибка сохранения статуса ${taskId} на сервере:`, err.message);
    }
  },

  // 5. Создание и регистрация электронного акта в БД PostgreSQL
  createAct: async (actData: Omit<WorkAct, 'id' | 'created_at'>): Promise<boolean> => {
    const tempId = `act-${Date.now()}`;
    const nowIso = new Date().toISOString();

    const localAct: WorkAct = {
      ...actData,
      id: tempId,
      created_at: nowIso,
    };

    // Оптимистично добавляем в локальное состояние
    set((state) => ({
      acts: [localAct, ...state.acts],
      // Наряд сразу переводим в статус "done"
      tasks: state.tasks.map((t) => t.id === actData.task_id ? { ...t, status: 'done' } : t),
    }));

    try {
      console.log('[Staff Tasks] Отправка электронного акта на сервер...');
      const response = await staffApiClient.post<WorkAct>('/api/acts', actData);

      if (response.data && response.data.id) {
        console.log(`[Staff Tasks] Акт ${response.data.act_number} успешно сохранен в PostgreSQL с ID ${response.data.id}`);
        // Заменяем временный локальный акт реальным из БД
        set((state) => ({
          acts: state.acts.map((a) => a.id === tempId ? response.data : a),
        }));
      }

      // Перезагружаем статистику выработки
      get().loadStats().catch(() => {});
      return true;
    } catch (err: any) {
      console.warn('[Staff Tasks] Ошибка отправки акта на сервер, сохранен локально:', err.message);
      return false;
    }
  },

  // Быстрый вызов абонента по номеру телефона через нативную телефонную книгу
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

  // Фильтрация и мгновенный поиск нарядов
  getFilteredTasks: () => {
    const { tasks, searchQuery, selectedFilter } = get();
    return tasks.filter((task) => {
      // Поиск по строке
      const q = searchQuery.toLowerCase().trim();
      const matchQuery = !q ||
        (task.address && task.address.toLowerCase().includes(q)) ||
        (task.client_name && task.client_name.toLowerCase().includes(q)) ||
        (task.task_number && task.task_number.toLowerCase().includes(q)) ||
        (task.title && task.title.toLowerCase().includes(q));

      if (!matchQuery) return false;

      // Фильтр по статусу
      if (selectedFilter === 'all') return true;
      if (selectedFilter === 'urgent') return task.priority === 'urgent' || task.priority === 'high';
      return task.status === selectedFilter;
    });
  },
}));
