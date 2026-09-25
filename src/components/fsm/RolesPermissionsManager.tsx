import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { 
  Shield, Plus, Edit, Trash2, CheckCircle2, 
  Loader2, ShieldAlert, Check, X, Users
} from "lucide-react";
import { CRMRole, FSM_TABS, FSMTabDefinition } from "@/types/crmRoles";

export const RolesPermissionsManager = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Состояния открытия диалогов
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<CRMRole | null>(null);
  const [deletingRoleId, setDeletingRoleId] = useState<string | null>(null);

  // Форма создания/редактирования роли
  const [formName, setFormName] = useState("");
  const [formId, setFormId] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formPermissions, setFormPermissions] = useState<string[]>([]);
  const [isIdManuallyEdited, setIsIdManuallyEdited] = useState(false);

  // 1. Загрузка всех ролей из таблицы crm_roles
  const { data: roles = [], isLoading: isLoadingRoles } = useQuery<CRMRole[]>({
    queryKey: ["crm_roles"],
    queryFn: async () => {
      console.log("[RolesPermissionsManager] Запрос списка ролей из crm_roles...");
      const { data, error } = await supabase
        .from("crm_roles")
        .select("*")
        .order("is_system", { ascending: false })
        .order("name", { ascending: true });

      if (error) {
        console.error("[RolesPermissionsManager] Ошибка при загрузке ролей:", error);
        throw error;
      }
      return (data || []) as CRMRole[];
    },
  });

  // 2. Загрузка сотрудников для подсчета количества привязанных к ролям
  const { data: employees = [] } = useQuery({
    queryKey: ["employees"],
    queryFn: async () => {
      const { data, error } = await supabase.from("employees").select("id, role, position");
      if (error) throw error;
      return data || [];
    },
  });

  // Функция подсчета сотрудников с конкретной ролью
  const getEmployeeCountForRole = (role: CRMRole): number => {
    return employees.filter(emp => 
      emp.role === role.id || 
      emp.position === role.name ||
      emp.position?.toLowerCase() === role.id
    ).length;
  };

  // Простая транслитерация русского текста в латинский slug для поля id
  const slugify = (text: string): string => {
    const ruToEn: Record<string, string> = {
      а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh",
      з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o",
      п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts",
      ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
    };
    return text
      .toLowerCase()
      .split("")
      .map(char => ruToEn[char] || char)
      .join("")
      .replace(/[^a-z0-9_]/g, "_")
      .replace(/_+/g, "_")
      .slice(0, 40);
  };

  // Автогенерация ID при вводе названия роли (только для новых ролей)
  const handleNameChange = (val: string) => {
    setFormName(val);
    if (!editingRole && !isIdManuallyEdited) {
      setFormId(slugify(val));
    }
  };

  // Сброс формы
  const resetForm = () => {
    setFormName("");
    setFormId("");
    setFormDescription("");
    setFormPermissions([]);
    setIsIdManuallyEdited(false);
    setEditingRole(null);
  };

  // Открытие диалога создания новой роли
  const handleOpenCreate = () => {
    resetForm();
    // По умолчанию предлагаем базовые права
    setFormPermissions(["dashboard", "tasks", "requests"]);
    setIsCreateOpen(true);
  };

  // Открытие диалога редактирования роли
  const handleOpenEdit = (role: CRMRole) => {
    setEditingRole(role);
    setFormName(role.name);
    setFormId(role.id);
    setFormDescription(role.description || "");
    setFormPermissions(Array.isArray(role.permissions) ? [...role.permissions] : []);
    setIsIdManuallyEdited(true);
  };

  // Переключение отдельного права доступа
  const togglePermission = (tabId: string) => {
    setFormPermissions(prev => 
      prev.includes(tabId) ? prev.filter(id => id !== tabId) : [...prev, tabId]
    );
  };

  // Выбрать все 13 вкладок
  const handleSelectAll = () => {
    setFormPermissions(FSM_TABS.map(t => t.id));
  };

  // Снять все вкладки
  const handleDeselectAll = () => {
    setFormPermissions([]);
  };

  // Мутация: Создание новой роли
  const createRoleMutation = useMutation({
    mutationFn: async () => {
      const cleanId = formId.trim().toLowerCase();
      const cleanName = formName.trim();

      if (!cleanId || !cleanName) {
        throw new Error("Укажите название и идентификатор роли");
      }

      console.log("[RolesPermissionsManager] Создание роли:", { cleanId, cleanName, formPermissions });
      const { error } = await supabase.from("crm_roles").insert({
        id: cleanId,
        name: cleanName,
        description: formDescription.trim() || null,
        permissions: formPermissions,
        is_system: false,
      });

      if (error) {
        if (error.code === "23505") {
          throw new Error("Роль с таким идентификатором уже существует. Выберите другой ID.");
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm_roles"] });
      toast({
        title: "Роль успешно создана",
        description: `Роль "${formName}" добавлена и готова к назначению сотрудникам`,
      });
      setIsCreateOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      toast({
        title: "Ошибка при создании роли",
        description: err.message || "Не удалось сохранить роль",
        variant: "destructive",
      });
    },
  });

  // Мутация: Обновление прав существующей роли
  const updateRoleMutation = useMutation({
    mutationFn: async () => {
      if (!editingRole) return;
      const cleanName = formName.trim();

      console.log(`[RolesPermissionsManager] Обновление роли ${editingRole.id}:`, {
        name: cleanName,
        permissions: formPermissions,
      });

      const { error } = await supabase
        .from("crm_roles")
        .update({
          name: cleanName,
          description: formDescription.trim() || null,
          permissions: formPermissions,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editingRole.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm_roles"] });
      toast({
        title: "Права роли обновлены",
        description: `Настройки доступа для роли "${formName}" успешно сохранены`,
      });
      setEditingRole(null);
      resetForm();
    },
    onError: (err: any) => {
      toast({
        title: "Ошибка при обновлении",
        description: err.message || "Не удалось сохранить изменения",
        variant: "destructive",
      });
    },
  });

  // Мутация: Удаление роли (только пользовательской)
  const deleteRoleMutation = useMutation({
    mutationFn: async (roleId: string) => {
      console.log(`[RolesPermissionsManager] Удаление роли ${roleId}...`);
      const { error } = await supabase.from("crm_roles").delete().eq("id", roleId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm_roles"] });
      toast({
        title: "Роль удалена",
        description: "Пользовательская роль успешно удалена из системы",
      });
      setDeletingRoleId(null);
    },
    onError: (err: any) => {
      toast({
        title: "Ошибка удаления",
        description: err.message || "Не удалось удалить роль",
        variant: "destructive",
      });
    },
  });

  // Группировка вкладок по 3 понятным категориям
  const categorizedTabs = {
    operations: {
      title: "Операционные разделы",
      tabs: FSM_TABS.filter(t => t.category === "operations"),
    },
    catalog: {
      title: "Справочники и жилой фонд",
      tabs: FSM_TABS.filter(t => t.category === "catalog"),
    },
    management: {
      title: "Управление и аналитика",
      tabs: FSM_TABS.filter(t => t.category === "management"),
    },
  };

  return (
    <div className="space-y-6">
      {/* Верхняя карточка с кнопкой создания */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-muted/40 p-4 rounded-2xl border border-border/50">
        <div>
          <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Роли и разграничение прав доступа CRM
          </h3>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Настраивайте доступ к 13 вкладкам CRM для каждой должности или создавайте новые роли под специфические задачи
          </p>
        </div>
        <Button onClick={handleOpenCreate} className="shrink-0 shadow-sm">
          <Plus className="h-4 w-4 mr-2" />
          Создать роль
        </Button>
      </div>

      {/* Список существующих ролей в виде карточек */}
      {isLoadingRoles ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {roles.map((role) => {
            const empCount = getEmployeeCountForRole(role);
            const rolePerms = Array.isArray(role.permissions) ? role.permissions : [];

            return (
              <Card 
                key={role.id} 
                className="flex flex-col justify-between border-border/60 hover:border-primary/40 transition-all duration-200 shadow-sm hover:shadow-md"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-base font-bold flex items-center gap-2">
                        {role.name}
                        {role.is_system ? (
                          <Badge variant="secondary" className="text-[10px] uppercase font-semibold">
                            Системная
                          </Badge>
                        ) : (
                          <Badge className="bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-200 text-[10px] uppercase font-semibold">
                            Пользовательская
                          </Badge>
                        )}
                      </CardTitle>
                      <span className="text-[11px] text-muted-foreground font-mono">
                        id: {role.id}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded-lg">
                      <Users className="h-3.5 w-3.5 text-primary" />
                      <span className="font-semibold">{empCount}</span>
                    </div>
                  </div>

                  {role.description && (
                    <CardDescription className="text-xs line-clamp-2 mt-2">
                      {role.description}
                    </CardDescription>
                  )}
                </CardHeader>

                <CardContent className="space-y-4 pt-0">
                  {/* Статистика прав и бейджи */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Доступные разделы:</span>
                      <span className="font-bold text-foreground">
                        {rolePerms.length} из {FSM_TABS.length}
                      </span>
                    </div>

                    {/* Полоса прогресса охвата прав */}
                    <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                      <div 
                        className="bg-primary h-full transition-all duration-300"
                        style={{ width: `${(rolePerms.length / FSM_TABS.length) * 100}%` }}
                      />
                    </div>

                    {/* Бейджи разрешенных вкладок */}
                    <div className="flex flex-wrap gap-1 pt-1 max-h-24 overflow-y-auto custom-scrollbar">
                      {FSM_TABS.map((tab) => {
                        const hasAccess = rolePerms.includes(tab.id);
                        if (!hasAccess) return null;
                        return (
                          <Badge 
                            key={tab.id} 
                            variant="outline" 
                            className="text-[10px] font-medium bg-background border-slate-200 dark:border-slate-800"
                          >
                            {tab.label}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>

                  {/* Кнопки управления ролью */}
                  <div className="pt-2 border-t border-border/40 flex items-center justify-between gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full text-xs font-semibold"
                      onClick={() => handleOpenEdit(role)}
                    >
                      <Edit className="h-3.5 w-3.5 mr-1.5" />
                      Настроить права
                    </Button>

                    {!role.is_system && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:bg-destructive/10 shrink-0"
                        onClick={() => setDeletingRoleId(role.id)}
                        title="Удалить роль"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Диалог создания новой роли / редактирования прав */}
      <Dialog 
        open={isCreateOpen || !!editingRole} 
        onOpenChange={(open) => {
          if (!open) {
            setIsCreateOpen(false);
            setEditingRole(null);
            resetForm();
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto custom-scrollbar">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              {editingRole ? `Редактирование роли: ${editingRole.name}` : "Создание новой роли CRM"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Задайте название и выберите разделы CRM-панели, к которым сотрудники с этой ролью будут иметь доступ.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Название и ID */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="role_name" className="text-xs font-bold">
                  Название роли <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="role_name"
                  placeholder="Например: Старший диспетчер"
                  value={formName}
                  onChange={(e) => handleNameChange(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="role_id" className="text-xs font-bold">
                  Идентификатор (ID) <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="role_id"
                  placeholder="senior_dispatcher"
                  value={formId}
                  disabled={!!editingRole?.is_system}
                  onChange={(e) => {
                    setIsIdManuallyEdited(true);
                    setFormId(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""));
                  }}
                />
                {editingRole?.is_system && (
                  <p className="text-[10px] text-muted-foreground">Идентификатор системной роли изменить нельзя</p>
                )}
              </div>
            </div>

            {/* Описание роли */}
            <div className="space-y-1.5">
              <Label htmlFor="role_desc" className="text-xs font-bold">Описание обязанностей</Label>
              <Textarea
                id="role_desc"
                placeholder="Кратко опишите, за какие участки работы отвечает сотрудник..."
                rows={2}
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
              />
            </div>

            {/* Сетка конструктора прав доступа */}
            <div className="space-y-3 pt-2 border-t border-border/50">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <h4 className="text-sm font-bold text-foreground">
                    Права доступа к вкладкам CRM ({formPermissions.length} из {FSM_TABS.length})
                  </h4>
                  <p className="text-[11px] text-muted-foreground">
                    Отметьте разделы, которые будут отображаться в боковом меню сотрудника
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm" 
                    className="text-xs h-7 px-2.5" 
                    onClick={handleSelectAll}
                  >
                    Выбрать все
                  </Button>
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="sm" 
                    className="text-xs h-7 px-2.5 text-muted-foreground" 
                    onClick={handleDeselectAll}
                  >
                    Снять все
                  </Button>
                </div>
              </div>

              {/* Разделение прав по 3 категориям */}
              <div className="space-y-4">
                {Object.entries(categorizedTabs).map(([key, group]) => (
                  <div key={key} className="space-y-2">
                    <h5 className="text-xs font-extrabold text-primary tracking-wide uppercase">
                      {group.title}
                    </h5>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {group.tabs.map((tab) => {
                        const isChecked = formPermissions.includes(tab.id);

                        return (
                          <div
                            key={tab.id}
                            onClick={() => togglePermission(tab.id)}
                            className={`flex items-start gap-3 p-2.5 rounded-xl border cursor-pointer transition-all duration-150 select-none ${
                              isChecked
                                ? "bg-primary/5 border-primary/40 shadow-xs"
                                : "bg-card hover:bg-muted/40 border-border/50"
                            }`}
                          >
                            <Checkbox
                              checked={isChecked}
                              onCheckedChange={() => togglePermission(tab.id)}
                              className="mt-0.5"
                            />
                            <div className="space-y-0.5 text-left">
                              <p className={`text-xs font-bold leading-tight ${isChecked ? "text-primary" : "text-foreground"}`}>
                                {tab.label}
                              </p>
                              <p className="text-[10px] text-muted-foreground leading-snug">
                                {tab.description}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-3 border-t border-border/50">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsCreateOpen(false);
                setEditingRole(null);
                resetForm();
              }}
            >
              Отмена
            </Button>
            <Button
              type="button"
              disabled={
                !formName.trim() || 
                !formId.trim() || 
                createRoleMutation.isPending || 
                updateRoleMutation.isPending
              }
              onClick={() => {
                if (editingRole) {
                  updateRoleMutation.mutate();
                } else {
                  createRoleMutation.mutate();
                }
              }}
            >
              {(createRoleMutation.isPending || updateRoleMutation.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {editingRole ? "Сохранить изменения" : "Создать роль"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Диалог подтверждения удаления кастомной роли */}
      <AlertDialog 
        open={!!deletingRoleId} 
        onOpenChange={(open) => !open && setDeletingRoleId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive flex items-center gap-2">
              <ShieldAlert className="h-5 w-5" />
              Удалить пользовательскую роль?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Это действие необратимо. Роль будет удалена из базы данных. Убедитесь, что ни у одного сотрудника не назначена эта роль перед удалением.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-white"
              onClick={() => deletingRoleId && deleteRoleMutation.mutate(deletingRoleId)}
            >
              {deleteRoleMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Удалить роль
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
