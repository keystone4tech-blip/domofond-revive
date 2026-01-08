import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";

export type AppRole = "admin" | "user" | "director" | "dispatcher" | "master" | "engineer";

interface UseUserRoleResult {
  user: User | null;
  roles: AppRole[];
  isLoading: boolean;
  isManager: boolean;
  isFSMUser: boolean;
  isAdmin: boolean;
  hasRole: (role: AppRole) => boolean;
}

export const useUserRole = (): UseUserRoleResult => {
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchUserRoles = async (userId: string) => {
      try {
        console.log("Fetching roles for user:", userId);
        const { data, error } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", userId);

        console.log("Roles response:", data, error);

        if (error) {
          console.error("Error fetching roles:", error);
          return;
        }

        const rolesList = (data || []).map((r) => r.role as AppRole);
        console.log("Setting roles:", rolesList);
        setRoles(rolesList);
      } catch (err) {
        console.error("Error:", err);
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null);
        if (session?.user) {
          setTimeout(() => {
            fetchUserRoles(session.user.id);
          }, 0);
        } else {
          setRoles([]);
        }
        setIsLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserRoles(session.user.id);
      }
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const hasRole = (role: AppRole) => roles.includes(role);
  
  const isManager = roles.some((r) => 
    ["admin", "director", "dispatcher"].includes(r)
  );
  
  const isFSMUser = roles.some((r) => 
    ["admin", "director", "dispatcher", "master", "engineer"].includes(r)
  );
  
  const isAdmin = roles.includes("admin");

  return {
    user,
    roles,
    isLoading,
    isManager,
    isFSMUser,
    isAdmin,
    hasRole,
  };
};
