import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";

export type AppRole = "admin" | "user" | "director" | "dispatcher" | "master" | "engineer" | "manager" | "superadmin";

interface UseUserRoleResult {
  user: User | null;
  roles: AppRole[];
  isLoading: boolean;
  isManager: boolean;
  isFSMUser: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  hasRole: (role: AppRole) => boolean;
}

export const useUserRole = (): UseUserRoleResult => {
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchUserRoles = async (currentUser: User) => {
      try {
        console.log("[useUserRole] Запрос ролей для пользователя:", currentUser.id);
        const { data, error } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", currentUser.id);

        if (error) {
          console.error("[useUserRole] Ошибка при запросе ролей из БД:", error);
          // Фоллбек на локальную роль пользователя из профиля сессии
          const localRole = (currentUser as any)?.role as AppRole;
          if (localRole) {
            console.log("[useUserRole] Использована резервная роль из сессии:", localRole);
            setRoles([localRole]);
          }
          return;
        }

        let rolesList = (data || []).map((r) => r.role as AppRole);
        // Если из таблицы user_roles ничего не вернулось, но у пользователя задана роль в сессии
        const fallbackRole = (currentUser as any)?.role as AppRole;
        if (rolesList.length === 0 && fallbackRole) {
          rolesList = [fallbackRole];
        }
        console.log("[useUserRole] Итоговые роли пользователя установлены:", rolesList);
        setRoles(rolesList);
      } catch (err) {
        console.error("[useUserRole] Критическая ошибка при определении ролей:", err);
        const localRole = (currentUser as any)?.role as AppRole;
        if (localRole) {
          setRoles([localRole]);
        }
      } finally {
        setIsLoading(false); // Завершаем загрузку ролей
      }
    };

    // Слушаем изменения авторизации
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log("[useUserRole] Событие auth:", event);
        const currentUser = session?.user ?? null;
        setUser(currentUser);
        
        if (currentUser) {
          setIsLoading(true);
          fetchUserRoles(currentUser);
        } else {
          setRoles([]);
          setIsLoading(false);
        }
      }
    );

    // Получаем текущую сессию при инициализации
    supabase.auth.getSession().then(({ data: { session } }) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      
      if (currentUser) {
        fetchUserRoles(currentUser);
      } else {
        setIsLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const hasRole = (role: AppRole) => roles.includes(role);
  
  const isManager = roles.some((r) => 
    ["admin", "director", "dispatcher", "manager", "superadmin"].includes(r)
  );
  
  const isFSMUser = roles.some((r) => 
    ["admin", "director", "dispatcher", "master", "engineer", "manager", "superadmin"].includes(r)
  );
  
  const isSuperAdmin = roles.includes("superadmin");
  const isAdmin = roles.includes("admin") || roles.includes("director") || roles.includes("superadmin");

  return {
    user,
    roles,
    isLoading,
    isManager,
    isFSMUser,
    isAdmin,
    isSuperAdmin,
    hasRole,
  };
};

