/**
 * Хранилище состояния авторизации сотрудника и активной роли (Zustand)
 * Служебное приложение «Офис Работа»
 */

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StaffUser, StaffRole, ShiftStatus } from '../types/staff';
import { staffApiClient, setStaffToken, removeStaffToken, getStaffToken } from '../api/client';
import { STORAGE_KEYS } from '../config/constants';

interface AuthState {
  user: StaffUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  activeViewRole: StaffRole;        // Режим рабочего стола (для тестирования всех ролей)
  shiftStatus: ShiftStatus;         // Статус смены («На смене» / «Отдых»)
  error: string | null;

  // Методы управления
  login: (phone: string, password: string) => Promise<boolean>;
  loginDemo: (role: StaffRole) => void;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  setActiveViewRole: (role: StaffRole) => void;
  setShiftStatus: (status: ShiftStatus) => void;
  clearError: () => void;
}

export const useStaffAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  activeViewRole: 'master',         // По умолчанию режим Мастера
  shiftStatus: 'on_shift',          // По умолчанию на смене
  error: null,

  clearError: () => set({ error: null }),

  // Быстрый демо-вход для мгновенного тестирования любой роли
  loginDemo: (role: StaffRole) => {
    const roleTitles: Record<StaffRole, string> = {
      master: 'Сервисный мастер',
      technician: 'Инженер ТО',
      installer: 'Монтажник',
      dispatcher: 'Диспетчер смены',
      director: 'Директор филиала',
      admin: 'Администратор системы',
      superadmin: 'Главный инженер',
    };

    const demoUser: StaffUser = {
      id: 'demo-staff-001',
      phone: '+7 (909) 453-62-41',
      full_name: 'Шибаев Сергей Викторович',
      role: role,
      active_view_role: role,
      shiftStatus: 'on_shift',
      completed_today: 4,
      total_earnings_today: 2850,
      rating: 4.96,
    };

    set({
      user: demoUser,
      isAuthenticated: true,
      activeViewRole: role,
      shiftStatus: 'on_shift',
      error: null,
    });
  },

  // Авторизация по номеру телефона и паролю личного кабинета сотрудника
  login: async (phone: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      console.log(`[Staff Auth] Авторизация сотрудника по логину: ${phone}`);
      
      const response = await staffApiClient.post('/api/auth/login', {
        login: phone.trim(),
        password: password.trim(),
      });

      const { token, user: apiUser } = response.data;
      if (!token) {
        throw new Error('Токен авторизации не получен от сервера');
      }

      // Сохраняем полученный JWT токен
      await setStaffToken(token);

      // Запрашиваем полный профиль сотрудника
      let fullProfile: any = null;
      try {
        const profRes = await staffApiClient.get('/api/user/profile');
        fullProfile = profRes.data;
      } catch (profErr) {
        console.warn('[Staff Auth] Профиль не вернул доп. полей, берем данные из сессии');
      }

      // Определяем системную роль
      const systemRole = (apiUser?.role || fullProfile?.role || 'master') as StaffRole;
      const normalizedRole: StaffRole = ['director', 'admin', 'superadmin', 'dispatcher', 'master', 'technician', 'installer'].includes(systemRole)
        ? systemRole
        : 'master';

      const staffUser: StaffUser = {
        id: apiUser?.id || fullProfile?.id || 'staff-1',
        phone: fullProfile?.phone || phone,
        full_name: fullProfile?.full_name || 'Сотрудник компании',
        email: fullProfile?.email || apiUser?.email,
        role: normalizedRole,
        active_view_role: normalizedRole,
        shift_status: 'on_shift',
        completed_today: 3,
        total_earnings_today: 2100,
        rating: 4.9,
      };

      // Сохраняем в локальное хранилище для автологина
      await AsyncStorage.setItem(STORAGE_KEYS.STAFF_USER, JSON.stringify(staffUser));

      set({
        user: staffUser,
        isAuthenticated: true,
        activeViewRole: normalizedRole,
        shiftStatus: 'on_shift',
        isLoading: false,
        error: null,
      });

      return true;
    } catch (err: any) {
      console.error('[Staff Auth] Ошибка авторизации:', err.message);
      const errorMessage = err.response?.data?.error || err.message || 'Неверный логин или пароль сотрудника';
      set({ isLoading: false, error: errorMessage });
      return false;
    }
  },

  // Проверка сессии при запуске приложения
  checkAuth: async () => {
    set({ isLoading: true });
    try {
      const token = await getStaffToken();
      if (!token) {
        set({ isAuthenticated: false, isLoading: false });
        return;
      }

      const savedUserStr = await AsyncStorage.getItem(STORAGE_KEYS.STAFF_USER);
      if (savedUserStr) {
        const savedUser: StaffUser = JSON.parse(savedUserStr);
        set({
          user: savedUser,
          isAuthenticated: true,
          activeViewRole: savedUser.active_view_role || savedUser.role || 'master',
          shiftStatus: savedUser.shift_status || 'on_shift',
          isLoading: false,
        });
        return;
      }

      // Если есть токен, но нет профиля — запрашиваем с сервера
      const profRes = await staffApiClient.get('/api/user/profile');
      const profile = profRes.data;
      if (profile) {
        const staffUser: StaffUser = {
          id: profile.id,
          phone: profile.phone || '',
          full_name: profile.full_name || 'Сотрудник',
          role: (profile.role as StaffRole) || 'master',
          active_view_role: (profile.role as StaffRole) || 'master',
          shift_status: 'on_shift',
          completed_today: 2,
          total_earnings_today: 1400,
          rating: 4.9,
        };
        set({ user: staffUser, isAuthenticated: true, activeViewRole: staffUser.role, isLoading: false });
      } else {
        set({ isAuthenticated: false, isLoading: false });
      }
    } catch (err) {
      console.warn('[Staff Auth] Сессия не подтверждена:', err);
      set({ isAuthenticated: false, isLoading: false });
    }
  },

  // Смена активного режима рабочего стола (для тестирования всех ролей)
  setActiveViewRole: (role: StaffRole) => {
    console.log(`[Staff Auth] Переключение рабочего стола на роль: ${role}`);
    const currentUser = get().user;
    if (currentUser) {
      const updatedUser = { ...currentUser, active_view_role: role };
      set({ activeViewRole: role, user: updatedUser });
      AsyncStorage.setItem(STORAGE_KEYS.STAFF_USER, JSON.stringify(updatedUser)).catch(() => {});
    } else {
      set({ activeViewRole: role });
    }
  },

  // Переключение статуса смены («На смене» / «Отдых»)
  setShiftStatus: (status: ShiftStatus) => {
    set({ shiftStatus: status });
  },

  // Выход из системы
  logout: async () => {
    try {
      await removeStaffToken();
      await AsyncStorage.removeItem(STORAGE_KEYS.STAFF_USER);
    } catch (err) {
      console.warn('[Staff Auth] Ошибка при выходе:', err);
    }
    set({
      user: null,
      isAuthenticated: false,
      error: null,
      shiftStatus: 'off_duty',
    });
  },
}));
