import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { CRMRole, FSM_TABS } from "@/types/crmRoles";

// Базовые системные роли приложения
export type AppRole = "admin" | "user" | "director" | "dispatcher" | "master" | "engineer" | "manager" | "superadmin";

// Интерфейс результата хука useUserRole
interface UseUserRoleResult {
  user: User | null;                          // Авторизованный пользователь Supabase
  roles: AppRole[];                           // Системные роли пользователя (из user_roles)
  assignedRoles: string[];                    // Все назначенные роли (включая кастомные роли из employees)
  permissions: string[];                      // Массив идентификаторов доступных вкладок FSM
  crmRoles: CRMRole[];                        // Справочник всех ролей CRM из базы данных
  isLoading: boolean;                         // Флаг загрузки
  isManager: boolean;                         // Является ли менеджером или выше
  isFSMUser: boolean;                         // Имеет ли доступ к CRM системе
  isAdmin: boolean;                           // Администратор или директор
  isSuperAdmin: boolean;                      // Супер-администратор
  hasRole: (role: AppRole) => boolean;        // Проверка наличия системной роли
  hasPermission: (tabId: string) => boolean;  // Проверка права доступа к конкретной вкладке FSM
  refetchPermissions: () => Promise<void>;    // Функция для ручного обновления прав
}

export const useUserRole = (): UseUserRoleResult => {
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [assignedRoles, setAssignedRoles] = useState<string[]>([]);
  const [crmRoles, setCrmRoles] = useState<CRMRole[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Функция загрузки ролей и разрешений пользователя
  const fetchUserRolesAndPermissions = useCallback(async (currentUser: User) => {
    try {
      console.log("[useUserRole] Старт загрузки ролей и прав для пользователя:", currentUser.id);

      // Параллельно загружаем:
      // 1) Системные роли из user_roles
      // 2) Запись сотрудника из employees (где может быть указана кастомная роль)
      // 3) Все роли и их права из таблицы crm_roles
      const [userRolesRes, employeeRes, crmRolesRes] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", currentUser.id),
        supabase.from("employees").select("role, position").eq("user_id", currentUser.id).maybeSingle(),
        supabase.from("crm_roles").select("*"),
      ]);

      if (userRolesRes.error) {
        console.error("[useUserRole] Ошибка запроса user_roles:", userRolesRes.error);
      }
      if (employeeRes.error) {
        console.warn("[useUserRole] Ошибка запроса employees:", employeeRes.error);
      }
      if (crmRolesRes.error) {
        console.warn("[useUserRole] Ошибка запроса crm_roles:", crmRolesRes.error);
      }

      // Сохраняем справочник всех ролей
      const loadedCrmRoles: CRMRole[] = (crmRolesRes.data || []) as CRMRole[];
      setCrmRoles(loadedCrmRoles);

      // Список системных ролей
      let sysRoles = (userRolesRes.data || []).map((r) => r.role as AppRole);
      const fallbackRole = (currentUser as any)?.role as AppRole;
      if (sysRoles.length === 0 && fallbackRole) {
        sysRoles = [fallbackRole];
      }
      setRoles(sysRoles);

      // Все роли пользователя (системные + из карточки сотрудника)
      const allRoleIds = new Set<string>(sysRoles);
      if (employeeRes.data?.role) {
        allRoleIds.add(employeeRes.data.role);
      }
      // Также проверяем position (если там хранится id роли)
      if (employeeRes.data?.position) {
        allRoleIds.add(employeeRes.data.position.toLowerCase());
      }

      const assignedRolesList = Array.from(allRoleIds);
      setAssignedRoles(assignedRolesList);
      console.log("[useUserRole] Назначенные роли пользователя:", assignedRolesList);

      // Проверяем, является ли пользователь директором или супер-админом
      const isDirectorOrAdmin = 
        sysRoles.includes("superadmin") || 
        sysRoles.includes("admin") || 
        sysRoles.includes("director") ||
        assignedRolesList.includes("director") ||
        assignedRolesList.includes("superadmin");

      let resolvedPermissions: string[] = [];

      if (isDirectorOrAdmin) {
        // Директор и администратор имеют полный доступ ко всем 13 вкладкам CRM
        resolvedPermissions = FSM_TABS.map((t) => t.id);
        console.log("[useUserRole] Пользователю предоставлен полный административный доступ ко всем вкладкам");
      } else {
        // Для остальных ролей собираем объединенный список прав из таблицы crm_roles
        const permSet = new Set<string>();
        loadedCrmRoles.forEach((crmRole) => {
          if (assignedRolesList.includes(crmRole.id) || assignedRolesList.includes(crmRole.name.toLowerCase())) {
            if (Array.isArray(crmRole.permissions)) {
              crmRole.permissions.forEach((p) => permSet.add(p));
            }
          }
        });

        // Если для роли в crm_roles ничего не найдено, назначаем базовые права по умолчанию
        if (permSet.size === 0) {
          if (sysRoles.includes("master") || sysRoles.includes("engineer")) {
            ["dashboard", "tasks", "requests", "installer-sheet", "products", "addresses", "logins"].forEach(p => permSet.add(p));
          } else if (sysRoles.includes("dispatcher")) {
            ["dashboard", "tasks", "requests", "installer-sheet", "products", "addresses", "accounts", "logins"].forEach(p => permSet.add(p));
          } else if (sysRoles.includes("manager")) {
            FSM_TABS.filter(t => t.id !== "reports").forEach(t => permSet.add(t.id));
          }
        }

        resolvedPermissions = Array.from(permSet);
      }

      console.log("[useUserRole] Итоговые разрешения пользователя:", resolvedPermissions);
      setPermissions(resolvedPermissions);
    } catch (err) {
      console.error("[useUserRole] Критическая ошибка при получении ролей и прав:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Слушаем изменения авторизации
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log("[useUserRole] Событие auth:", event);
        const currentUser = session?.user ?? null;
        setUser(currentUser);
        
        if (currentUser) {
          setIsLoading(true);
          fetchUserRolesAndPermissions(currentUser);
        } else {
          setRoles([]);
          setAssignedRoles([]);
          setPermissions([]);
          setIsLoading(false);
        }
      }
    );

    // Получаем текущую сессию при инициализации
    supabase.auth.getSession().then(({ data: { session } }) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      
      if (currentUser) {
        fetchUserRolesAndPermissions(currentUser);
      } else {
        setIsLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchUserRolesAndPermissions]);

  // Ручной рефетч прав
  const refetchPermissions = useCallback(async () => {
    if (user) {
      await fetchUserRolesAndPermissions(user);
    }
  }, [user, fetchUserRolesAndPermissions]);

  // Проверка наличия конкретной роли
  const hasRole = useCallback((role: AppRole) => roles.includes(role), [roles]);
  
  // Проверка права доступа к вкладке FSM
  const hasPermission = useCallback((tabId: string): boolean => {
    // Если пользователь - администратор, директор или супер-админ, доступ открыт всегда
    if (roles.includes("admin") || roles.includes("director") || roles.includes("superadmin")) {
      return true;
    }
    if (assignedRoles.includes("director") || assignedRoles.includes("superadmin")) {
      return true;
    }
    // Проверяем наличие вкладки в списке прав
    return permissions.includes(tabId);
  }, [roles, assignedRoles, permissions]);

  const isSuperAdmin = roles.includes("superadmin") || assignedRoles.includes("superadmin");
  const isAdmin = isSuperAdmin || roles.includes("admin") || roles.includes("director") || assignedRoles.includes("director");
  
  // Менеджер или выше (позволяет видеть разделы управления)
  const isManager = isAdmin || roles.includes("manager") || assignedRoles.includes("manager");
  
  // Пользователь FSM (любой сотрудник с доступом к CRM)
  const isFSMUser = isAdmin || isManager || roles.some((r) => 
    ["dispatcher", "master", "engineer"].includes(r)
  ) || permissions.length > 0;

  return {
    user,
    roles,
    assignedRoles,
    permissions,
    crmRoles,
    isLoading,
    isManager,
    isFSMUser,
    isAdmin,
    isSuperAdmin,
    hasRole,
    hasPermission,
    refetchPermissions,
  };
};
