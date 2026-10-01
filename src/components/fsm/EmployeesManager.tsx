import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Plus, Edit, UserCheck, UserX, Loader2,
  Search, User, Users, Shield, ShieldCheck,
  Trash2, Filter, Phone, Cake, MapPin, CalendarClock, ClipboardCheck, Clock, Info
} from "lucide-react";
import { CRMRole } from "@/types/crmRoles";
import { RolesPermissionsManager } from "./RolesPermissionsManager";
import { logDeletion, getCurrentUserIdentity } from "@/lib/audit";

interface Employee {
  id: string;
  user_id: string;
  full_name: string;
  phone: string | null;
  position: string | null;
  role: string | null;
  is_active: boolean;
  created_at: string;
  assigned_by?: string | null;
  assigned_by_name?: string | null;
  assigned_at?: string | null;
  date_of_birth?: string | null;
  residence_address?: string | null;
  contact_phone?: string | null;
  profile_completed?: boolean | null;
  activated_at?: string | null;
}

interface Profile {
  id: string;
  full_name: string | null;
  phone: string | null;
  address: string | null;
}

// Допустимые системные enum-роли в таблице user_roles
const VALID_SYSTEM_APP_ROLES = ["admin", "superadmin", "director", "manager", "dispatcher", "master", "engineer"];

const EmployeesManager = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Активная вкладка: 'employees' (сотрудники) или 'roles' (роли и права)
  const [activeTab, setActiveTab] = useState<"employees" | "roles">("employees");

  // Состояния для диалога сотрудника
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);

  // Фильтры и поиск по списку сотрудников
  const [listSearch, setListSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all"); // all | active | pending | inactive

  // Карточка сотрудника (детальная информация)
  const [detailEmployee, setDetailEmployee] = useState<Employee | null>(null);
  
  // Форма сотрудника (использует ID роли из таблицы crm_roles)
  const [formData, setFormData] = useState({
    full_name: "",
    phone: "",
    roleId: "master",
  });

  // 1. Загрузка списка сотрудников из employees
  const { data: employees, isLoading: isLoadingEmployees } = useQuery<Employee[]>({
    queryKey: ["employees"],
    queryFn: async () => {
      console.log("[EmployeesManager] Запрос списка сотрудников...");
      const { data, error } = await supabase
        .from("employees")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("[EmployeesManager] Ошибка при запросе сотрудников:", error);
        throw error;
      }
      return data as Employee[];
    },
  });

  // 2. Загрузка доступных ролей из crm_roles для выпадающего списка
  const { data: crmRoles = [], isLoading: isLoadingRoles } = useQuery<CRMRole[]>({
    queryKey: ["crm_roles"],
    queryFn: async () => {
      console.log("[EmployeesManager] Запрос ролей для селекта из crm_roles...");
      const { data, error } = await supabase
        .from("crm_roles")
        .select("*")
        .order("is_system", { ascending: false })
        .order("name", { ascending: true });

      if (error) {
        console.warn("[EmployeesManager] Ошибка загрузки crm_roles:", error);
        return [];
      }
      return (data || []) as CRMRole[];
    },
  });

  // 3. Поиск пользователей по ФИО для назначения нового сотрудника
  const { data: searchResults, isLoading: isSearching } = useQuery({
    queryKey: ["profile-search", searchQuery],
    queryFn: async () => {
      if (searchQuery.length < 2) return [];

      const existingUserIds = employees?.map((e) => e.user_id) || [];

      // Поиск сотрудника и по ФИО, и по номеру телефона (регистрация идёт по телефону)
      const digits = searchQuery.replace(/\D/g, "");
      const orParts = [`full_name.ilike.%${searchQuery}%`];
      if (digits.length >= 3) orParts.push(`phone_clean.ilike.%${digits}%`);
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, phone, address")
        .or(orParts.join(","))
        .limit(10);

      if (error) throw error;
      return (data as Profile[]).filter((p) => !existingUserIds.includes(p.id));
    },
    enabled: searchQuery.length >= 2 && !editingEmployee,
  });

  // Функция для получения читаемого названия должности сотрудника
  const getRoleDisplayName = (emp: Employee): string => {
    // 1) Ищем по role id в crm_roles
    if (emp.role) {
      const found = crmRoles.find((r) => r.id === emp.role);
      if (found) return found.name;
    }
    // 2) Ищем по названию position
    if (emp.position) {
      const found = crmRoles.find((r) => r.name.toLowerCase() === emp.position?.toLowerCase() || r.id === emp.position?.toLowerCase());
      if (found) return found.name;
      return emp.position;
    }
    return emp.role || "Мастер";
  };

  // Статус сотрудника: pending (ожидает анкету) / active / inactive
  const getEmployeeStatus = (emp: Employee): "pending" | "active" | "inactive" => {
    if (!emp.profile_completed) return "pending";
    return emp.is_active ? "active" : "inactive";
  };

  // Фильтрация и поиск по списку сотрудников
  const filteredEmployees = (employees || []).filter((emp) => {
    // Фильтр по роли
    if (roleFilter !== "all") {
      const rid = emp.role || "";
      const byPos = crmRoles.find((r) => r.name.toLowerCase() === emp.position?.toLowerCase());
      if (rid !== roleFilter && byPos?.id !== roleFilter) return false;
    }
    // Фильтр по статусу
    if (statusFilter !== "all" && getEmployeeStatus(emp) !== statusFilter) return false;
    // Поиск по ФИО / телефону
    const q = listSearch.trim().toLowerCase();
    if (q) {
      const hay = [emp.full_name, emp.phone, emp.contact_phone, emp.assigned_by_name]
        .map((x) => String(x || "").toLowerCase()).join(" ");
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const fmtDate = (d?: string | null) => d ? new Date(d).toLocaleDateString("ru-RU") : "—";
  const fmtDateTime = (d?: string | null) => d ? new Date(d).toLocaleString("ru-RU") : "—";

  // Мутация: Назначение нового сотрудника
  const createEmployeeMutation = useMutation({
    mutationFn: async (data: { userId: string; full_name: string; phone: string; roleId: string }) => {
      console.log("[EmployeesManager] Создание сотрудника:", data);

      // Проверяем, не назначен ли уже сотрудник
      const { data: existing } = await supabase
        .from("employees")
        .select("id")
        .eq("user_id", data.userId)
        .maybeSingle();

      if (existing) {
        throw new Error("Этот пользователь уже зарегистрирован как сотрудник");
      }

      // Сохраняем телефон в профиле, если указан
      if (data.phone) {
        await supabase
          .from("profiles")
          .update({ phone: data.phone })
          .eq("id", data.userId);
      }

      // Находим выбранную роль в crm_roles
      const targetRole = crmRoles.find((r) => r.id === data.roleId);
      const positionName = targetRole?.name || data.roleId;

      // Кто назначает (для карточки сотрудника)
      const me = await getCurrentUserIdentity();

      // Создаем запись сотрудника. ВАЖНО: is_active=false и profile_completed=false —
      // сотрудник активируется только после заполнения анкеты о себе.
      const { error: empError } = await supabase.from("employees").insert({
        user_id: data.userId,
        full_name: data.full_name,
        phone: data.phone || null,
        role: data.roleId,
        position: positionName,
        assigned_by: me.id,
        assigned_by_name: me.name || null,
        assigned_at: new Date().toISOString(),
        is_active: false,
        profile_completed: false,
      });

      if (empError) {
        console.error("[EmployeesManager] Ошибка вставки employees:", empError);
        throw empError;
      }

      // Синхронизируем системную роль в user_roles
      // Если это системный enum, пишем его напрямую. Если кастомный - пишем manager
      const sysRoleToAssign = VALID_SYSTEM_APP_ROLES.includes(data.roleId) ? data.roleId : "manager";
      
      // Удаляем старые системные роли сотрудника и вставляем актуальную
      await supabase.from("user_roles").delete().eq("user_id", data.userId);
      const { error: roleError } = await supabase.from("user_roles").insert([
        {
          user_id: data.userId,
          role: sysRoleToAssign as any,
        },
      ]);

      if (roleError) {
        console.warn("[EmployeesManager] Предупреждение при записи в user_roles:", roleError);
      }

      return { id: data.userId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      queryClient.invalidateQueries({ queryKey: ["crm_roles"] });
      toast({
        title: "Сотрудник назначен",
        description: "Статус «Ожидает анкету». Сотрудник увидит приглашение в личном кабинете и активируется после заполнения данных о себе.",
      });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка при добавлении",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Мутация: Обновление существующего сотрудника
  const updateEmployeeMutation = useMutation({
    mutationFn: async ({ id, userId, ...data }: { id: string; userId?: string; full_name: string; phone: string | null; roleId: string }) => {
      console.log(`[EmployeesManager] Обновление сотрудника ${id}:`, data);

      const targetRole = crmRoles.find((r) => r.id === data.roleId);
      const positionName = targetRole?.name || data.roleId;

      // Обновляем запись в таблице employees (ОБЕ колонки: role и position)
      const { error: empError } = await supabase
        .from("employees")
        .update({
          full_name: data.full_name,
          phone: data.phone,
          role: data.roleId,
          position: positionName,
        })
        .eq("id", id);

      if (empError) {
        console.error("[EmployeesManager] Ошибка обновления employees:", empError);
        throw empError;
      }

      // Если известен userId сотрудника, синхронизируем роль и в таблице user_roles
      if (userId) {
        const sysRoleToAssign = VALID_SYSTEM_APP_ROLES.includes(data.roleId) ? data.roleId : "manager";
        console.log(`[EmployeesManager] Синхронизация user_roles для ${userId} -> ${sysRoleToAssign}`);

        // Обновляем или перезаписываем запись роли
        const { data: existingRoles } = await supabase
          .from("user_roles")
          .select("id")
          .eq("user_id", userId);

        if (existingRoles && existingRoles.length > 0) {
          await supabase
            .from("user_roles")
            .update({ role: sysRoleToAssign as any })
            .eq("user_id", userId);
        } else {
          await supabase.from("user_roles").insert([
            {
              user_id: userId,
              role: sysRoleToAssign as any,
            },
          ]);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      queryClient.invalidateQueries({ queryKey: ["crm_roles"] });
      toast({ title: "Данные сотрудника обновлены" });
      setEditingEmployee(null);
      setIsDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка сохранения",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Мутация: Переключение активности сотрудника
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("employees")
        .update({ is_active })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      toast({ title: "Статус сотрудника обновлен" });
    },
  });

  // Мутация: снятие с должности. Удаляем запись сотрудника и его рабочую роль,
  // но САМ АККАУНТ пользователя остаётся. Пишем в журнал «Удалённые».
  const deleteEmployeeMutation = useMutation({
    mutationFn: async (emp: Employee) => {
      // Снимок для журнала
      await logDeletion("employee", emp.id, emp.full_name, emp);
      // Удаляем рабочую роль (доступ к CRM), аккаунт пользователя не трогаем
      if (emp.user_id) {
        await supabase.from("user_roles").delete().eq("user_id", emp.user_id);
      }
      const { error } = await supabase.from("employees").delete().eq("id", emp.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      queryClient.invalidateQueries({ queryKey: ["employees-role-counts"] });
      setDetailEmployee(null);
      toast({ title: "Сотрудник снят с должности", description: "Учётная запись пользователя сохранена." });
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка удаления", description: error.message, variant: "destructive" });
    },
  });

  const handleDeleteEmployee = (emp: Employee) => {
    if (!window.confirm(
      `Снять «${emp.full_name}» с должности?\n\n` +
      `Будет удалена запись сотрудника и его доступ к CRM. ` +
      `Учётная запись пользователя сохранится. Действие попадёт в журнал «Удалённые».`
    )) return;
    deleteEmployeeMutation.mutate(emp);
  };

  const resetForm = () => {
    setFormData({
      full_name: "",
      phone: "",
      roleId: crmRoles[0]?.id || "master",
    });
    setSearchQuery("");
    setSelectedProfile(null);
    setEditingEmployee(null);
  };

  const handleSelectProfile = (profile: Profile) => {
    setSelectedProfile(profile);
    setFormData({
      ...formData,
      full_name: profile.full_name || "",
      phone: profile.phone || "",
    });
    setSearchQuery("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingEmployee) {
      updateEmployeeMutation.mutate({
        id: editingEmployee.id,
        userId: editingEmployee.user_id,
        full_name: formData.full_name,
        phone: formData.phone || null,
        roleId: formData.roleId,
      });
    } else if (selectedProfile) {
      createEmployeeMutation.mutate({
        userId: selectedProfile.id,
        full_name: formData.full_name,
        phone: formData.phone,
        roleId: formData.roleId,
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Главные вкладки раздела: Сотрудники / Роли и права */}
      <Tabs 
        value={activeTab} 
        onValueChange={(v) => setActiveTab(v as "employees" | "roles")}
        className="w-full"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <TabsList className="bg-muted/60 p-1 rounded-xl">
            <TabsTrigger value="employees" className="rounded-lg gap-2 text-xs sm:text-sm font-semibold">
              <Users className="h-4 w-4" />
              Сотрудники ({employees?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="roles" className="rounded-lg gap-2 text-xs sm:text-sm font-semibold">
              <ShieldCheck className="h-4 w-4" />
              Роли и права доступа ({crmRoles.length})
            </TabsTrigger>
          </TabsList>

          {activeTab === "employees" && (
            <Dialog open={isDialogOpen} onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) resetForm();
            }}>
              <DialogTrigger asChild>
                <Button onClick={() => { resetForm(); setEditingEmployee(null); }} className="shadow-sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Назначить сотрудника
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle className="text-lg font-bold flex items-center gap-2">
                    <User className="h-5 w-5 text-primary" />
                    {editingEmployee ? "Редактировать сотрудника" : "Назначить сотрудника"}
                  </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {!editingEmployee && (
                    <div className="space-y-4">
                      {!selectedProfile ? (
                        <>
                          <div className="space-y-2">
                            <Label htmlFor="search" className="text-xs font-bold">
                              Поиск зарегистрированного пользователя по ФИО
                            </Label>
                            <div className="relative">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <Input
                                id="search"
                                placeholder="Введите имя или фамилию жильца/пользователя..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10"
                              />
                            </div>
                          </div>
                          
                          {isSearching && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Loader2 className="h-4 w-4 animate-spin text-primary" />
                              Поиск...
                            </div>
                          )}
                          
                          {searchResults && searchResults.length > 0 && (
                            <div className="border rounded-xl divide-y max-h-56 overflow-auto">
                              {searchResults.map((profile) => (
                                <div
                                  key={profile.id}
                                  className="p-3 hover:bg-muted/50 cursor-pointer transition-colors"
                                  onClick={() => handleSelectProfile(profile)}
                                >
                                  <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                                      <User className="h-4 w-4 text-primary" />
                                    </div>
                                    <div>
                                      <p className="font-semibold text-sm">{profile.full_name || "Без имени"}</p>
                                      <p className="text-xs text-muted-foreground">
                                        {profile.phone || profile.address || "Нет контактных данных"}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                          
                          {searchQuery.length >= 2 && !isSearching && searchResults?.length === 0 && (
                            <p className="text-sm text-muted-foreground text-center py-4">
                              Пользователи не найдены
                            </p>
                          )}
                        </>
                      ) : (
                        <div className="p-3.5 rounded-xl bg-muted/50 border flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                              <User className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <p className="font-bold text-sm">{selectedProfile.full_name}</p>
                              <p className="text-xs text-muted-foreground">{selectedProfile.phone || "Телефон не указан"}</p>
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-xs"
                            onClick={() => {
                              setSelectedProfile(null);
                              setFormData({ ...formData, full_name: "", phone: "" });
                            }}
                          >
                            Сменить
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {(selectedProfile || editingEmployee) && (
                    <>
                      <div className="space-y-1.5">
                        <Label htmlFor="full_name" className="text-xs font-bold">ФИО сотрудника</Label>
                        <Input
                          id="full_name"
                          value={formData.full_name}
                          onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                          required
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="phone" className="text-xs font-bold">Номер телефона</Label>
                        <Input
                          id="phone"
                          placeholder="+7 (___) ___-__-__"
                          value={formData.phone}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold">Должность и роль доступа</Label>
                        <Select
                          value={formData.roleId}
                          onValueChange={(val) => setFormData({ ...formData, roleId: val })}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Выберите роль..." />
                          </SelectTrigger>
                          <SelectContent>
                            {crmRoles.map((role) => (
                              <SelectItem key={role.id} value={role.id}>
                                <div className="flex items-center justify-between w-full gap-3">
                                  <span className="font-semibold">{role.name}</span>
                                  <span className="text-[10px] text-muted-foreground">
                                    {role.is_system ? "системная" : "пользовательская"}
                                  </span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-[11px] text-muted-foreground">
                          Права доступа сотрудника к вкладкам CRM будут соответствовать выбранной роли
                        </p>
                      </div>

                      <Button
                        type="submit"
                        className="w-full mt-4"
                        disabled={createEmployeeMutation.isPending || updateEmployeeMutation.isPending}
                      >
                        {(createEmployeeMutation.isPending || updateEmployeeMutation.isPending) && (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        )}
                        {editingEmployee ? "Сохранить изменения" : "Назначить сотрудником"}
                      </Button>
                    </>
                  )}
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Вкладка 1: Список сотрудников */}
        <TabsContent value="employees" className="mt-0 outline-none">
          <Card className="border-border/60 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Штатный состав сотрудников
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Панель фильтров и поиска */}
              <div className="flex flex-col lg:flex-row gap-2 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={listSearch}
                    onChange={(e) => setListSearch(e.target.value)}
                    placeholder="Поиск по ФИО, телефону, кто назначил…"
                    className="pl-10 h-9"
                  />
                </div>
                <div className="flex gap-2">
                  <Select value={roleFilter} onValueChange={setRoleFilter}>
                    <SelectTrigger className="h-9 w-[180px]">
                      <div className="flex items-center gap-1.5 text-sm">
                        <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                        <SelectValue />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Все роли</SelectItem>
                      {crmRoles.map((r) => (
                        <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="h-9 w-[170px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Любой статус</SelectItem>
                      <SelectItem value="active">Активные</SelectItem>
                      <SelectItem value="pending">Ожидают анкету</SelectItem>
                      <SelectItem value="inactive">Неактивные</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {isLoadingEmployees ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : employees?.length === 0 ? (
                <p className="text-center text-muted-foreground py-10">Сотрудники еще не добавлены</p>
              ) : filteredEmployees.length === 0 ? (
                <p className="text-center text-muted-foreground py-10">По заданным фильтрам ничего не найдено</p>
              ) : (
                <div className="w-full overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ФИО</TableHead>
                        <TableHead>Телефон</TableHead>
                        <TableHead>Должность / Роль</TableHead>
                        <TableHead>Статус</TableHead>
                        <TableHead>Кто назначил</TableHead>
                        <TableHead>Когда</TableHead>
                        <TableHead className="text-right">Действия</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredEmployees.map((emp) => {
                        const roleName = getRoleDisplayName(emp);
                        const status = getEmployeeStatus(emp);

                        return (
                          <TableRow key={emp.id} className="hover:bg-muted/40 cursor-pointer" onClick={() => setDetailEmployee(emp)}>
                            <TableCell className="font-semibold">{emp.full_name}</TableCell>
                            <TableCell className="text-muted-foreground">{emp.contact_phone || emp.phone || "—"}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="font-medium bg-primary/5 border-primary/20 text-foreground">
                                {roleName}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {status === "pending" ? (
                                <Badge variant="outline" className="border-amber-300 text-amber-700 bg-amber-50 gap-1">
                                  <Clock className="h-3 w-3" /> Ожидает анкету
                                </Badge>
                              ) : status === "active" ? (
                                <Badge variant="default" className="gap-1"><UserCheck className="h-3 w-3" /> Активен</Badge>
                              ) : (
                                <Badge variant="secondary">Неактивен</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">{emp.assigned_by_name || "—"}</TableCell>
                            <TableCell className="text-muted-foreground text-sm whitespace-nowrap">{fmtDate(emp.assigned_at)}</TableCell>
                            <TableCell className="text-right space-x-1" onClick={(e) => e.stopPropagation()}>
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Редактировать сотрудника"
                                onClick={() => {
                                  setEditingEmployee(emp);

                                  // Ищем соответствующий ID роли в crmRoles
                                  let matchedRoleId = emp.role;
                                  if (!matchedRoleId && emp.position) {
                                    const byPos = crmRoles.find(
                                      (r) => r.name.toLowerCase() === emp.position?.toLowerCase() || r.id === emp.position?.toLowerCase()
                                    );
                                    matchedRoleId = byPos?.id || "master";
                                  }
                                  if (!matchedRoleId) matchedRoleId = "master";

                                  setFormData({
                                    full_name: emp.full_name,
                                    phone: emp.phone || "",
                                    roleId: matchedRoleId,
                                  });
                                  setIsDialogOpen(true);
                                }}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                title={emp.is_active ? "Деактивировать" : "Активировать"}
                                onClick={() => toggleActiveMutation.mutate({
                                  id: emp.id,
                                  is_active: !emp.is_active,
                                })}
                              >
                                {emp.is_active ? (
                                  <UserX className="h-4 w-4 text-destructive" />
                                ) : (
                                  <UserCheck className="h-4 w-4 text-green-600" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Снять с должности"
                                onClick={() => handleDeleteEmployee(emp)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Вкладка 2: Конструктор ролей и разграничение прав доступа */}
        <TabsContent value="roles" className="mt-0 outline-none">
          <RolesPermissionsManager />
        </TabsContent>
      </Tabs>

      {/* Карточка сотрудника: вся информация по выбранному сотруднику */}
      <Dialog open={!!detailEmployee} onOpenChange={(open) => { if (!open) setDetailEmployee(null); }}>
        <DialogContent className="max-w-lg">
          {detailEmployee && (
            <>
              <DialogHeader>
                <DialogTitle className="text-lg font-bold flex items-center gap-2">
                  <User className="h-5 w-5 text-primary" />
                  {detailEmployee.full_name}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-3">
                {/* Статус и роль */}
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="bg-primary/5 border-primary/20">{getRoleDisplayName(detailEmployee)}</Badge>
                  {getEmployeeStatus(detailEmployee) === "pending" ? (
                    <Badge variant="outline" className="border-amber-300 text-amber-700 bg-amber-50 gap-1"><Clock className="h-3 w-3" /> Ожидает анкету</Badge>
                  ) : getEmployeeStatus(detailEmployee) === "active" ? (
                    <Badge variant="default" className="gap-1"><UserCheck className="h-3 w-3" /> Активен</Badge>
                  ) : (
                    <Badge variant="secondary">Неактивен</Badge>
                  )}
                </div>

                {!detailEmployee.profile_completed && (
                  <div className="flex items-start gap-2 text-xs rounded-lg bg-amber-50 border border-amber-200 text-amber-800 p-2.5">
                    <Info className="h-4 w-4 shrink-0 mt-0.5" />
                    Сотрудник ещё не заполнил анкету о себе. Данные ниже появятся после заполнения в личном кабинете.
                  </div>
                )}

                {/* Контакты и личные данные */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-sm">
                  <div className="flex items-start gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[11px] text-muted-foreground">Телефон для связи</p>
                      <p className="font-medium">{detailEmployee.contact_phone || detailEmployee.phone || "—"}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Cake className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[11px] text-muted-foreground">Дата рождения</p>
                      <p className="font-medium">{fmtDate(detailEmployee.date_of_birth)}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 sm:col-span-2">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[11px] text-muted-foreground">Адрес проживания</p>
                      <p className="font-medium">{detailEmployee.residence_address || "—"}</p>
                    </div>
                  </div>
                </div>

                <div className="border-t pt-3 grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-sm">
                  <div className="flex items-start gap-2">
                    <ClipboardCheck className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[11px] text-muted-foreground">Кто назначил</p>
                      <p className="font-medium">{detailEmployee.assigned_by_name || "—"}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <CalendarClock className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[11px] text-muted-foreground">Дата назначения</p>
                      <p className="font-medium">{fmtDate(detailEmployee.assigned_at)}</p>
                    </div>
                  </div>
                  {detailEmployee.activated_at && (
                    <div className="flex items-start gap-2">
                      <UserCheck className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                      <div>
                        <p className="text-[11px] text-muted-foreground">Активирован</p>
                        <p className="font-medium">{fmtDateTime(detailEmployee.activated_at)}</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    className="flex-1 gap-1.5"
                    onClick={() => {
                      const emp = detailEmployee;
                      setDetailEmployee(null);
                      let matchedRoleId = emp.role;
                      if (!matchedRoleId && emp.position) {
                        const byPos = crmRoles.find((r) => r.name.toLowerCase() === emp.position?.toLowerCase() || r.id === emp.position?.toLowerCase());
                        matchedRoleId = byPos?.id || "master";
                      }
                      if (!matchedRoleId) matchedRoleId = "master";
                      setEditingEmployee(emp);
                      setFormData({ full_name: emp.full_name, phone: emp.phone || "", roleId: matchedRoleId });
                      setIsDialogOpen(true);
                    }}
                  >
                    <Edit className="h-4 w-4" /> Редактировать
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 gap-1.5 text-destructive border-destructive/40 hover:bg-destructive/10"
                    onClick={() => handleDeleteEmployee(detailEmployee)}
                  >
                    <Trash2 className="h-4 w-4" /> Снять с должности
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EmployeesManager;
