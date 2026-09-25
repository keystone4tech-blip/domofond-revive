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
  Search, User, Users, Shield, ShieldCheck 
} from "lucide-react";
import { CRMRole } from "@/types/crmRoles";
import { RolesPermissionsManager } from "./RolesPermissionsManager";

interface Employee {
  id: string;
  user_id: string;
  full_name: string;
  phone: string | null;
  position: string | null;
  role: string | null;
  is_active: boolean;
  created_at: string;
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

      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, phone, address")
        .ilike("full_name", `%${searchQuery}%`)
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

      // Создаем запись сотрудника (заполняем ОБЕ колонки: role и position)
      const { error: empError } = await supabase.from("employees").insert({
        user_id: data.userId,
        full_name: data.full_name,
        phone: data.phone || null,
        role: data.roleId,
        position: positionName,
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
      toast({ title: "Сотрудник успешно добавлен" });
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
              {isLoadingEmployees ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : employees?.length === 0 ? (
                <p className="text-center text-muted-foreground py-10">Сотрудники еще не добавлены</p>
              ) : (
                <div className="w-full overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ФИО</TableHead>
                        <TableHead>Телефон</TableHead>
                        <TableHead>Должность / Роль</TableHead>
                        <TableHead>Статус</TableHead>
                        <TableHead className="text-right">Действия</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {employees?.map((emp) => {
                        const roleName = getRoleDisplayName(emp);

                        return (
                          <TableRow key={emp.id} className="hover:bg-muted/40">
                            <TableCell className="font-semibold">{emp.full_name}</TableCell>
                            <TableCell className="text-muted-foreground">{emp.phone || "—"}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="font-medium bg-primary/5 border-primary/20 text-foreground">
                                {roleName}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant={emp.is_active ? "default" : "secondary"}>
                                {emp.is_active ? "Активен" : "Неактивен"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right space-x-1">
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
    </div>
  );
};

export default EmployeesManager;
