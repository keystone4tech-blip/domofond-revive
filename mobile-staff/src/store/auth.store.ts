/**
 * Хранилище состояния авторизации сотрудника, ролей и прав доступа (Zustand)
 * Служебное приложение «Офис Работа»
 *
 * Единая модель прав с сайтом: роль → permissions (массив id разделов из таблицы crm_roles).
 * Права приходят с бэкенда (/api/user/permissions) и повторяют логику useUserRole на сайте.
 */

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StaffUser, StaffRole, ShiftStatus } from '../types/staff';
import { staffApiClient, setStaffToken, removeStaffToken, getStaffToken } from '../api/client';
import { STORAGE_KEYS } from '../config/constants';

// Полный перечень id разделов CRM (совпадает с CRM_TABS на сайте) — запасной вариант,
// если бэкенд не прислал all_tab_ids.
export const ALL_TAB_IDS: string[] = [
  'dashboard', 'tasks', 'requests', 'new-buildings', 'installer-sheet', 'products',
  'equipment-matching', 'addresses', 'accounts', 'logins', 'autopay', 'employees',
  'clients', 'cabinets', 'map', 'reports', 'verification', 'instructions',
];

// Каталог роли из crm_roles
export interface RoleCatalogItem {
  id: string;
  name: string;
  permissions: string[];
}

// Роли с полным доступом ко всем разделам
const ADMIN_LIKE = ['director', 'admin', 'superadmin'];
// Соответствие ролей приложения ролям в crm_roles
const ROLE_ALIAS: Record<string, string> = { technician: 'engineer', installer: 'engineer' };

/**
 * Разрешения конкретной роли на основе каталога crm_roles.
 * Директор/админ/суперадмин → все разделы.
 */
export function resolveRolePermissions(
  role: string,
  allRoles: RoleCatalogItem[],
  allTabIds: string[],
): string[] {
  const r = String(role || '').toLowerCase();
  if (ADMIN_LIKE.includes(r)) return (allTabIds && allTabIds.length ? allTabIds : ALL_TAB_IDS).slice();
  const target = ROLE_ALIAS[r] || r;
  const found = (allRoles || []).find(
    (x) => x.id.toLowerCase() === target || x.name.toLowerCase() === target,
  );
  return found ? found.permissions.slice() : [];
}

/**
 * Эффективные права: в режиме предпросмотра (супер-админ) — права выбранной роли,
 * иначе реальные права сотрудника.
 */
export function computeEffectivePermissions(
  permissions: string[],
  previewRole: StaffRole | null,
  allRoles: RoleCatalogItem[],
  allTabIds: string[],
): string[] {
  if (previewRole) return resolveRolePermissions(previewRole, allRoles, allTabIds);
  return permissions || [];
}

interface AuthState {
  user: StaffUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  activeViewRole: StaffRole;        // Режим рабочего стола (реальная роль либо предпросмотр)
  shiftStatus: ShiftStatus;
  error: string | null;

  // Права доступа
  permissions: string[];            // Реальные права сотрудника (id разделов CRM)
  roleLabel: string;                // Понятное название роли
  isSuperadminUser: boolean;        // Доступен ли режим предпросмотра ролей
  allRoles: RoleCatalogItem[];      // Каталог ролей из crm_roles (для предпросмотра)
  allTabIds: string[];              // Полный список id разделов
  previewRole: StaffRole | null;    // Активный предпросмотр роли (только супер-админ)

  // Методы
  login: (phone: string, password: string) => Promise<boolean>;
  loginDemo: (role: StaffRole) => void;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  loadPermissions: () => Promise<void>;
  setPreviewRole: (role: StaffRole | null) => void;
  setActiveViewRole: (role: StaffRole) => void;
  getEffectivePermissions: () => string[];
  hasPermission: (tabId: string) => boolean;
  setShiftStatus: (status: ShiftStatus) => void;
  clearError: () => void;
}

export const useStaffAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  activeViewRole: 'master',
  shiftStatus: 'on_shift',
  error: null,

  permissions: [],
  roleLabel: 'Сотрудник',
  isSuperadminUser: false,
  allRoles: [],
  allTabIds: ALL_TAB_IDS,
  previewRole: null,

  clearError: () => set({ error: null }),

  getEffectivePermissions: () => {
    const { permissions, previewRole, allRoles, allTabIds } = get();
    return computeEffectivePermissions(permissions, previewRole, allRoles, allTabIds);
  },

  hasPermission: (tabId: string) => get().getEffectivePermissions().includes(tabId),

  // Загрузка прав сотрудника с бэкенда (единая модель с сайтом)
  loadPermissions: async () => {
    try {
      const res = await staffApiClient.get('/api/user/permissions');
      const d = res.data || {};
      set({
        permissions: Array.isArray(d.permissions) ? d.permissions : [],
        allRoles: Array.isArray(d.all_roles) ? d.all_roles : [],
        allTabIds: Array.isArray(d.all_tab_ids) && d.all_tab_ids.length ? d.all_tab_ids : ALL_TAB_IDS,
        roleLabel: d.role_label || get().roleLabel,
        isSuperadminUser: !!d.is_superadmin,
      });
      // Уточняем реальную роль, если бэкенд прислал primary_role
      const u = get().user;
      if (u && d.primary_role) {
        const primary = String(d.primary_role).toLowerCase() as StaffRole;
        const known: StaffRole[] = ['master', 'technician', 'installer', 'dispatcher', 'director', 'admin', 'superadmin'];
        const realRole = known.includes(primary) ? primary : u.role;
        const updated = { ...u, role: realRole };
        set({ user: updated });
        if (!get().previewRole) set({ activeViewRole: realRole });
        AsyncStorage.setItem(STORAGE_KEYS.STAFF_USER, JSON.stringify(updated)).catch(() => {});
      }
    } catch (e: any) {
      console.warn('[Staff Auth] Не удалось загрузить права доступа:', e?.message);
    }
  },

  // Режим предпросмотра роли (только супер-админ). null — выйти из предпросмотра.
  setPreviewRole: (role: StaffRole | null) => {
    if (role) {
      set({ previewRole: role, activeViewRole: role });
    } else {
      const real = get().user?.role || 'master';
      set({ previewRole: null, activeViewRole: real });
    }
  },

  // Быстрый демо-вход (для локального тестирования без сервера)
  loginDemo: (role: StaffRole) => {
    const demoUser: StaffUser = {
      id: 'demo-staff-001',
      phone: '+7 (900) 000-00-00',
      full_name: 'Демо-сотрудник',
      role,
      active_view_role: role,
      shift_status: 'on_shift',
      completed_today: 0,
      total_earnings_today: 0,
      rating: 0,
    };
    const perms = ADMIN_LIKE.includes(role) ? ALL_TAB_IDS.slice() : [];
    set({
      user: demoUser,
      isAuthenticated: true,
      activeViewRole: role,
      previewRole: null,
      permissions: perms,
      isSuperadminUser: ADMIN_LIKE.includes(role),
      shiftStatus: 'on_shift',
      error: null,
    });
  },

  // Авторизация по логину и паролю личного кабинета сотрудника
  login: async (phone: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await staffApiClient.post('/api/auth/login', {
        login: phone.trim(),
        password: password.trim(),
      });

      const { token, user: apiUser } = response.data;
      if (!token) throw new Error('Токен авторизации не получен от сервера');

      await setStaffToken(token);

      let fullProfile: any = null;
      try {
        const profRes = await staffApiClient.get('/api/user/profile');
        fullProfile = profRes.data;
      } catch (profErr) {
        console.warn('[Staff Auth] Профиль не вернул доп. полей');
      }

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
        completed_today: 0,
        total_earnings_today: 0,
        rating: 0,
      };

      await AsyncStorage.setItem(STORAGE_KEYS.STAFF_USER, JSON.stringify(staffUser));

      set({
        user: staffUser,
        isAuthenticated: true,
        activeViewRole: normalizedRole,
        previewRole: null,
        shiftStatus: 'on_shift',
        isLoading: false,
        error: null,
      });

      // Подтягиваем реальные права и каталог ролей
      await get().loadPermissions();
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
          activeViewRole: savedUser.role || 'master',
          previewRole: null,
          shiftStatus: savedUser.shift_status || 'on_shift',
          isLoading: false,
        });
        // Обновляем права в фоне
        get().loadPermissions();
        return;
      }

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
          completed_today: 0,
          total_earnings_today: 0,
          rating: 0,
        };
        set({ user: staffUser, isAuthenticated: true, activeViewRole: staffUser.role, previewRole: null, isLoading: false });
        get().loadPermissions();
      } else {
        set({ isAuthenticated: false, isLoading: false });
      }
    } catch (err) {
      console.warn('[Staff Auth] Сессия не подтверждена:', err);
      set({ isAuthenticated: false, isLoading: false });
    }
  },

  // Прямая смена рабочего стола (используется предпросмотром)
  setActiveViewRole: (role: StaffRole) => {
    const currentUser = get().user;
    if (currentUser) {
      const updatedUser = { ...currentUser, active_view_role: role };
      set({ activeViewRole: role, user: updatedUser });
      AsyncStorage.setItem(STORAGE_KEYS.STAFF_USER, JSON.stringify(updatedUser)).catch(() => {});
    } else {
      set({ activeViewRole: role });
    }
  },

  setShiftStatus: (status: ShiftStatus) => {
    set({ shiftStatus: status });
  },

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
      permissions: [],
      previewRole: null,
      isSuperadminUser: false,
      roleLabel: 'Сотрудник',
    });
  },
}));
