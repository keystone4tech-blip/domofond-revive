// src/components/admin/SuperAdminControl.tsx
// Изолированная панель управления Супер-Администратора
// Предоставляет закрытый функционал:
// 1. Создание скрытых ролей (невидимых для обычных директоров в CRM и админке)
// 2. Назначение скрытых ролей на пользователей (по email) поверх их системных ролей
// 3. Управление матрицей скрытых привилегий и режимом «Инкогнито»
// 4. Добавление новых модулей и фичей без изменения структуры существующего сайта

import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { SUPERADMIN_EMAIL } from "@/data/projectChangelog";
import {
  Crown, Shield, UserCheck, Plus, Trash2, Edit3, CheckCircle2,
  AlertTriangle, Lock, Eye, EyeOff, Sparkles, Sliders, Users,
  Layers, Settings, RefreshCw, Key, FileText, Search, Download, Smartphone, ExternalLink
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

// Интерфейс описания скрытой роли
export interface ShadowRole {
  id: string;               // Системный идентификатор (например: general_director)
  name: string;             // Русское название (например: «Генеральный директор»)
  description: string;      // Описание назначения роли
  permissions: string[];    // Массив идентификаторов прав
  color: string;            // Цвет для бейджа и акцентов
  is_active: boolean;       // Статус активности
  created_at?: string;
}

// Интерфейс назначения роли на пользователя
export interface ShadowUserRole {
  id: string;               // Уникальный ID записи
  user_email: string;       // Email пользователя
  user_id?: string;         // ID пользователя в системе
  role_id: string;          // ID скрытой роли
  granted_by: string;       // Кем выдано (суперадмин)
  is_active: boolean;       // Активность назначения
  notes?: string;           // Персональные заметки суперадмина
  created_at?: string;
}

// Интерфейс скрытого разрешения
export interface ShadowPermission {
  id: string;               // Код права (например: fsm_full_view)
  name: string;             // Название права
  description: string;      // Пояснение
  category: string;         // Категория (crm, finance, security, general)
}

// Базовые системные права
const DEFAULT_PERMISSIONS: ShadowPermission[] = [
  { id: "crm_full_view", name: "Скрытый просмотр заявок CRM", description: "Полный доступ ко всем заявкам без назначения мастера и без отметок в журнале", category: "crm" },
  { id: "crm_all_masters", name: "Контроль всех мастеров", description: "Просмотр графиков и выездов всех специалистов компании", category: "crm" },
  { id: "financial_reports", name: "Финансовые показатели", description: "Просмотр отчетов по выручке, платежам ЮKassa и абонентской плате", category: "finance" },
  { id: "incognito_mode", name: "Режим «Инкогнито»", description: "Действия и просмотры пользователя полностью скрыты от директоров", category: "security" },
  { id: "audit_system", name: "Скрытый аудит действий", description: "Ненаблюдаемый аудит работы персонала и директоров в системе", category: "security" },
  { id: "vip_reports", name: "Эксклюзивные сводки", description: "Персональные расширенные сводки по фонду домов и оборудованию", category: "management" },
];

export const SuperAdminControl: React.FC = () => {
  const { user } = useUserRole();
  const { toast } = useToast();

  // Строгая проверка доступа: только владелец системы
  const isAuthorized = (user?.email || "").toLowerCase().trim() === SUPERADMIN_EMAIL;

  // Состояния данных
  const [roles, setRoles] = useState<ShadowRole[]>([]);
  const [assignments, setAssignments] = useState<ShadowUserRole[]>([]);
  const [permissions, setPermissions] = useState<ShadowPermission[]>(DEFAULT_PERMISSIONS);
  const [loading, setLoading] = useState(true);

  // Состояния модалок / форм создания
  const [isCreatingRole, setIsCreatingRole] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleId, setNewRoleId] = useState("");
  const [newRoleDesc, setNewRoleDesc] = useState("");
  const [newRoleColor, setNewRoleColor] = useState("#8B5CF6");
  const [newRolePerms, setNewRolePerms] = useState<string[]>([]);

  // Состояния назначения пользователя
  const [isAssigning, setIsAssigning] = useState(false);
  const [assignEmail, setAssignEmail] = useState("");
  const [assignRoleId, setAssignRoleId] = useState("");
  const [assignNotes, setAssignNotes] = useState("");

  // Поиск
  const [searchQuery, setSearchQuery] = useState("");

  // Загрузка данных при монтировании
  useEffect(() => {
    if (isAuthorized) {
      loadAllData();
    }
  }, [isAuthorized]);

  /**
   * Загрузка ролей, назначений и каталога прав из БД (с резервным хранилищем)
   */
  const loadAllData = async () => {
    setLoading(true);
    console.log("[SuperAdminControl] Загрузка данных скрытых ролей и назначений...");

    try {
      // 1. Загрузка скрытых ролей
      const { data: dbRoles, error: rolesErr } = await (supabase as any)
        .from("shadow_roles")
        .select("*")
        .order("created_at", { ascending: true });

      if (!rolesErr && dbRoles && dbRoles.length > 0) {
        setRoles(dbRoles);
      } else {
        // Резервная предзагрузка роли Генерального директора при первом старте
        const fallbackRoles: ShadowRole[] = [
          {
            id: "general_director",
            name: "Генеральный директор",
            description: "Полные представительские права, финансовый надзор и ненаблюдаемый аудит",
            permissions: ["fsm_full_view", "fsm_all_masters", "financial_reports", "incognito_mode", "audit_system", "vip_reports"],
            color: "#EAB308",
            is_active: true,
          }
        ];
        setRoles(fallbackRoles);
      }

      // 2. Загрузка назначений
      const { data: dbAssignments, error: assignErr } = await (supabase as any)
        .from("shadow_user_roles")
        .select("*")
        .order("created_at", { ascending: false });

      if (!assignErr && dbAssignments) {
        setAssignments(dbAssignments);
      }

      // 3. Загрузка каталога прав
      const { data: dbPerms, error: permsErr } = await (supabase as any)
        .from("shadow_permissions_catalog")
        .select("*");

      if (!permsErr && dbPerms && dbPerms.length > 0) {
        setPermissions(dbPerms);
      }
    } catch (err) {
      console.warn("[SuperAdminControl] Ошибка загрузки из БД, используется локальный кэш:", err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Сохранение новой скрытой роли
   */
  const handleCreateRole = async () => {
    if (!newRoleName.trim()) {
      toast({ title: "Ошибка", description: "Укажите название роли", variant: "destructive" });
      return;
    }

    const slug = newRoleId.trim() || newRoleName.toLowerCase().replace(/[^a-z0-9]/g, "_").replace(/_+/g, "_");

    console.log("[SuperAdminControl] Создание скрытой роли:", { slug, name: newRoleName });

    const newRole: ShadowRole = {
      id: slug,
      name: newRoleName.trim(),
      description: newRoleDesc.trim(),
      permissions: newRolePerms,
      color: newRoleColor,
      is_active: true,
    };

    try {
      const { error } = await (supabase as any).from("shadow_roles").upsert(newRole);
      if (error) throw error;

      toast({ title: "Роль создана", description: `Скрытая роль «${newRoleName}» успешно добавлена` });
      setRoles((prev) => [...prev.filter((r) => r.id !== slug), newRole]);
      setIsCreatingRole(false);
      setNewRoleName("");
      setNewRoleId("");
      setNewRoleDesc("");
      setNewRolePerms([]);
    } catch (err: any) {
      console.error("[SuperAdminControl] Ошибка при сохранении роли в БД:", err);
      // Локальное сохранение при ограничениях сети
      setRoles((prev) => [...prev.filter((r) => r.id !== slug), newRole]);
      setIsCreatingRole(false);
      toast({ title: "Сохранено локально", description: `Роль «${newRoleName}» активна в сессии` });
    }
  };

  /**
   * Удаление скрытой роли
   */
  const handleDeleteRole = async (roleId: string) => {
    console.log("[SuperAdminControl] Удаление роли:", roleId);
    try {
      await (supabase as any).from("shadow_roles").delete().eq("id", roleId);
      setRoles((prev) => prev.filter((r) => r.id !== roleId));
      setAssignments((prev) => prev.filter((a) => a.role_id !== roleId));
      toast({ title: "Роль удалена", description: "Скрытая роль удалена из системы" });
    } catch (err) {
      setRoles((prev) => prev.filter((r) => r.id !== roleId));
    }
  };

  /**
   * Назначение скрытой роли на пользователя
   */
  const handleAssignRole = async () => {
    const cleanEmail = assignEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      toast({ title: "Ошибка", description: "Введите корректный email пользователя", variant: "destructive" });
      return;
    }
    if (!assignRoleId) {
      toast({ title: "Ошибка", description: "Выберите назначаемую скрытую роль", variant: "destructive" });
      return;
    }

    console.log("[SuperAdminControl] Назначение скрытой роли:", { cleanEmail, assignRoleId });

    const newAssignment: ShadowUserRole = {
      id: crypto.randomUUID ? crypto.randomUUID() : `assign_${Date.now()}`,
      user_email: cleanEmail,
      role_id: assignRoleId,
      granted_by: SUPERADMIN_EMAIL,
      is_active: true,
      notes: assignNotes.trim(),
    };

    try {
      const { error } = await (supabase as any).from("shadow_user_roles").upsert(newAssignment);
      if (error) throw error;

      toast({
        title: "Роль назначена",
        description: `Пользователю ${cleanEmail} успешно назначена скрытая роль`,
      });
      setAssignments((prev) => [
        ...prev.filter((a) => !(a.user_email === cleanEmail && a.role_id === assignRoleId)),
        newAssignment,
      ]);
      setIsAssigning(false);
      setAssignEmail("");
      setAssignNotes("");
    } catch (err) {
      console.warn("[SuperAdminControl] Ошибка записи в БД, сохраняем локально:", err);
      setAssignments((prev) => [
        ...prev.filter((a) => !(a.user_email === cleanEmail && a.role_id === assignRoleId)),
        newAssignment,
      ]);
      setIsAssigning(false);
      toast({ title: "Назначено", description: `Скрытая роль привязана к ${cleanEmail}` });
    }
  };

  /**
   * Переключение активности назначения
   */
  const handleToggleAssignment = async (assignId: string, currentStatus: boolean) => {
    const newStatus = !currentStatus;
    console.log(`[SuperAdminControl] Переключение статуса назначения ${assignId} на ${newStatus}`);

    setAssignments((prev) =>
      prev.map((a) => (a.id === assignId ? { ...a, is_active: newStatus } : a))
    );

    try {
      await (supabase as any)
        .from("shadow_user_roles")
        .update({ is_active: newStatus, updated_at: new Date().toISOString() })
        .eq("id", assignId);
    } catch (err) {
      console.warn("[SuperAdminControl] Ошибка обновления статуса в БД:", err);
    }
  };

  /**
   * Удаление назначения скрытой роли
   */
  const handleDeleteAssignment = async (assignId: string) => {
    console.log("[SuperAdminControl] Отзыв скрытой роли:", assignId);
    try {
      await (supabase as any).from("shadow_user_roles").delete().eq("id", assignId);
      setAssignments((prev) => prev.filter((a) => a.id !== assignId));
      toast({ title: "Назначение отозвано", description: "Скрытые права отозваны у пользователя" });
    } catch (err) {
      setAssignments((prev) => prev.filter((a) => a.id !== assignId));
    }
  };

  // Блокировка доступа для посторонних лиц
  if (!isAuthorized) {
    return (
      <div className="p-8 text-center bg-slate-900/40 rounded-2xl border border-red-500/20">
        <Lock className="h-12 w-12 text-red-500 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-white mb-2">Доступ строго ограничен</h2>
        <p className="text-sm text-slate-400 max-w-md mx-auto">
          Этот раздел доступен исключительно Главному Администратору платформы.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Верхний информационный блок */}
      <div className="relative overflow-hidden rounded-2xl p-6 bg-gradient-to-br from-purple-950/40 via-slate-900 to-amber-950/30 border border-purple-500/30 shadow-2xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 shrink-0">
              <Crown className="h-7 w-7 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  Панель Супер-Администратора
                </h1>
                <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold uppercase text-[10px]">
                  Строго конфиденциально
                </Badge>
              </div>
              <p className="text-xs sm:text-sm text-slate-300 mt-1.5 max-w-2xl leading-relaxed">
                Изолированный контур управления скрытыми ролями и правами. Назначенные здесь привилегии работают поверх обычных ролей, не отображаются в общей CRM и скрыты от действующих директоров компании.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadAllData}
              className="bg-slate-800/80 border-slate-700 hover:bg-slate-700 text-xs text-slate-200"
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              Обновить
            </Button>
          </div>
        </div>
      </div>

      {/* Блок прямого скачивания 2 мобильных приложений компании для суперадмина */}
      <div className="rounded-2xl border border-sky-500/30 bg-gradient-to-br from-slate-900 via-[#0B132B] to-[#131D38] p-5 text-white shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400 shrink-0">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30">
                  Прямое скачивание
                </span>
                <span className="text-xs text-slate-400">Автономные установочные APK для Android</span>
              </div>
              <h3 className="text-base font-bold text-white mt-0.5">
                Мобильные приложения компании
              </h3>
            </div>
          </div>
          <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30 text-xs self-start sm:self-auto">
            ● Прямые серверные ссылки активны
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 1. Клиентское приложение */}
          <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-4 flex flex-col justify-between hover:border-sky-500/40 transition-colors">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-sky-400">1. Для абонентов (жителей МКД)</span>
                <span className="text-[11px] font-mono text-slate-400">v1.2.9</span>
              </div>
              <h4 className="text-sm font-bold text-white mb-1">ДомофонДар (ru.domofondar.app)</h4>
              <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                Видеодомофон, открытие дверей, ключи, баланс, оплата абонплаты ТО через СБП/ЮKassa.
              </p>
            </div>
            <div className="space-y-1.5 pt-2 border-t border-slate-800">
              <a
                href="/backend-api/api/app/download"
                download="domofondar.apk"
                className="w-full py-2 px-3 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Скачать domofondar.apk (Сервер)</span>
              </a>
              <a
                href="https://github.com/keystone4tech-blip/domofond-revive/releases/latest/download/domofondar.apk"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] flex items-center justify-center gap-1 transition-colors"
              >
                <ExternalLink className="w-3 h-3 text-slate-400" />
                <span>Зеркало: GitHub Release</span>
              </a>
            </div>
          </div>

          {/* 2. Служебное приложение */}
          <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-4 flex flex-col justify-between hover:border-emerald-500/40 transition-colors">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-emerald-400">2. Для персонала компании</span>
                <span className="text-[11px] font-mono text-slate-400">v1.0.0</span>
              </div>
              <h4 className="text-sm font-bold text-white mb-1">Офис Работа (ru.officework.app)</h4>
              <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                Мастера, монтажники, диспетчеры. Наряды, навигация, электронные акты с подписью, смены.
              </p>
            </div>
            <div className="space-y-1.5 pt-2 border-t border-slate-800">
              <a
                href="/backend-api/api/app/download-staff"
                download="office-work.apk"
                className="w-full py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Скачать office-work.apk (Сервер)</span>
              </a>
              <div className="grid grid-cols-2 gap-1.5">
                <a
                  href="https://github.com/keystone4tech-blip/domofond-revive/releases/download/staff-app-latest/office-work.apk"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-1.5 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] flex items-center justify-center gap-1 transition-colors text-center"
                >
                  <ExternalLink className="w-3 h-3 text-slate-400" />
                  <span>GitHub Релиз</span>
                </a>
                <a
                  href="/office"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-1.5 px-2 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/30 text-sky-300 font-semibold text-[11px] flex items-center justify-center gap-1 transition-colors text-center"
                >
                  <Smartphone className="w-3 h-3 text-sky-400" />
                  <span>Веб / PWA</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Вкладки: Назначения, Роли, Каталог прав */}
      <Tabs defaultValue="assignments" className="w-full">
        <TabsList className="bg-slate-900/80 p-1 rounded-xl border border-slate-800 grid grid-cols-3 max-w-lg mb-6">
          <TabsTrigger value="assignments" className="rounded-lg text-xs font-semibold data-[state=active]:bg-purple-600 data-[state=active]:text-white">
            <UserCheck className="h-3.5 w-3.5 mr-1.5" />
            Назначения ({assignments.length})
          </TabsTrigger>
          <TabsTrigger value="roles" className="rounded-lg text-xs font-semibold data-[state=active]:bg-purple-600 data-[state=active]:text-white">
            <Layers className="h-3.5 w-3.5 mr-1.5" />
            Скрытые роли ({roles.length})
          </TabsTrigger>
          <TabsTrigger value="permissions" className="rounded-lg text-xs font-semibold data-[state=active]:bg-purple-600 data-[state=active]:text-white">
            <Sliders className="h-3.5 w-3.5 mr-1.5" />
            Каталог прав ({permissions.length})
          </TabsTrigger>
        </TabsList>

        {/* ВКЛАДКА 1: НАЗНАЧЕНИЯ НА ПОЛЬЗОВАТЕЛЕЙ */}
        <TabsContent value="assignments" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Users className="h-4 w-4 text-purple-400" />
                Пользователи со скрытыми привилегиями
              </h2>
              <p className="text-xs text-slate-400">
                Пользователь продолжает иметь свою обычную системную роль, но скрыто получает расширенные права
              </p>
            </div>
            <Button
              onClick={() => setIsAssigning(true)}
              className="bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-lg shadow-purple-600/20"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Назначить скрытую роль
            </Button>
          </div>

          {/* Форма быстрого назначения роли */}
          {isAssigning && (
            <Card className="bg-slate-900/90 border-purple-500/40 p-5 rounded-xl shadow-xl">
              <CardHeader className="p-0 pb-4">
                <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
                  <Key className="h-4 w-4 text-amber-400" />
                  Привязать скрытую роль к пользователю
                </CardTitle>
                <CardDescription className="text-xs text-slate-400">
                  Укажите email пользователя (например: Ильи Андреевича) и выберите назначаемые права
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-300">Email пользователя в системе *</Label>
                    <Input
                      placeholder="user@example.com"
                      value={assignEmail}
                      onChangeText={(v: string) => setAssignEmail(v)}
                      onChange={(e) => setAssignEmail(e.target.value)}
                      className="bg-slate-800/80 border-slate-700 text-white text-xs h-9"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-300">Назначаемая скрытая роль *</Label>
                    <select
                      value={assignRoleId}
                      onChange={(e) => setAssignRoleId(e.target.value)}
                      className="w-full bg-slate-800/80 border border-slate-700 text-white text-xs rounded-md h-9 px-3 outline-none"
                    >
                      <option value="">-- Выберите роль --</option>
                      {roles.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name} ({r.permissions.length} прав)
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-300">Конфиденциальная заметка (видна только суперадмину)</Label>
                  <Input
                    placeholder="Например: Илья Андреевич — представитель совета директоров"
                    value={assignNotes}
                    onChange={(e) => setAssignNotes(e.target.value)}
                    className="bg-slate-800/80 border-slate-700 text-white text-xs h-9"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsAssigning(false)}
                    className="text-xs text-slate-400 hover:text-white"
                  >
                    Отмена
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleAssignRole}
                    className="bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold"
                  >
                    Подтвердить и назначить
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Список активных назначений */}
          {assignments.length === 0 ? (
            <div className="p-8 text-center bg-slate-900/30 rounded-xl border border-dashed border-slate-800">
              <EyeOff className="h-8 w-8 text-slate-600 mx-auto mb-2" />
              <p className="text-xs text-slate-400">Пока никому не назначены скрытые роли</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsAssigning(true)}
                className="mt-3 text-xs border-purple-500/30 text-purple-400"
              >
                Назначить первого пользователя
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {assignments.map((item) => {
                const roleObj = roles.find((r) => r.id === item.role_id);
                return (
                  <div
                    key={item.id}
                    className="p-4 rounded-xl bg-slate-900/80 border border-slate-800/80 hover:border-purple-500/40 transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                          <span className="font-bold text-xs sm:text-sm text-white">
                            {item.user_email}
                          </span>
                        </div>
                        {roleObj && (
                          <Badge
                            style={{ backgroundColor: `${roleObj.color}25`, color: roleObj.color, borderColor: `${roleObj.color}60` }}
                            className="text-[10px] font-bold border"
                          >
                            👑 {roleObj.name}
                          </Badge>
                        )}
                      </div>

                      {item.notes && (
                        <p className="text-[11px] text-amber-300/80 bg-amber-500/5 px-2.5 py-1.5 rounded-lg border border-amber-500/20 mb-3">
                          📝 {item.notes}
                        </p>
                      )}

                      {roleObj && (
                        <div className="flex flex-wrap gap-1 mb-3">
                          {roleObj.permissions.slice(0, 3).map((pId) => {
                            const pObj = permissions.find((p) => p.id === pId);
                            return (
                              <span key={pId} className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                                {pObj ? pObj.name : pId}
                              </span>
                            );
                          })}
                          {roleObj.permissions.length > 3 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                              +{roleObj.permissions.length - 3}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 mt-1">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={item.is_active}
                          onCheckedChange={() => handleToggleAssignment(item.id, item.is_active)}
                        />
                        <span className="text-[10px] text-slate-400">
                          {item.is_active ? "Активно" : "Приостановлено"}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteAssignment(item.id)}
                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-7 px-2 text-xs"
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        Отозвать
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ВКЛАДКА 2: СПИСОК СКРЫТЫХ РОЛЕЙ */}
        <TabsContent value="roles" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Layers className="h-4 w-4 text-purple-400" />
                Скрытые роли системы
              </h2>
              <p className="text-xs text-slate-400">
                Каждая роль содержит уникальный набор ненаблюдаемых привилегий
              </p>
            </div>
            <Button
              onClick={() => setIsCreatingRole(true)}
              className="bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Создать скрытую роль
            </Button>
          </div>

          {/* Форма создания роли */}
          {isCreatingRole && (
            <Card className="bg-slate-900/90 border-purple-500/40 p-5 rounded-xl shadow-xl">
              <CardHeader className="p-0 pb-4">
                <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-purple-400" />
                  Конструктор скрытой роли
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-300">Название роли (на русском) *</Label>
                    <Input
                      placeholder="Например: Советник генерального"
                      value={newRoleName}
                      onChange={(e) => setNewRoleName(e.target.value)}
                      className="bg-slate-800/80 border-slate-700 text-white text-xs h-9"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-300">Системный код (латиницей)</Label>
                    <Input
                      placeholder="advisor_director"
                      value={newRoleId}
                      onChange={(e) => setNewRoleId(e.target.value)}
                      className="bg-slate-800/80 border-slate-700 text-white text-xs h-9"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-300">Цвет бейджа</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={newRoleColor}
                        onChange={(e) => setNewRoleColor(e.target.value)}
                        className="w-9 h-9 rounded bg-transparent border-0 cursor-pointer"
                      />
                      <Input
                        value={newRoleColor}
                        onChange={(e) => setNewRoleColor(e.target.value)}
                        className="bg-slate-800/80 border-slate-700 text-white text-xs h-9 flex-1"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-300">Описание назначения</Label>
                  <Input
                    placeholder="Для чего предназначена данная роль"
                    value={newRoleDesc}
                    onChange={(e) => setNewRoleDesc(e.target.value)}
                    className="bg-slate-800/80 border-slate-700 text-white text-xs h-9"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-slate-300 font-bold">Выберите скрытые права:</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {permissions.map((perm) => {
                      const isSelected = newRolePerms.includes(perm.id);
                      return (
                        <div
                          key={perm.id}
                          onClick={() => {
                            setNewRolePerms((prev) =>
                              isSelected ? prev.filter((p) => p !== perm.id) : [...prev, perm.id]
                            );
                          }}
                          className={`p-2.5 rounded-lg border text-left cursor-pointer transition-all ${
                            isSelected
                              ? "bg-purple-600/20 border-purple-500/60 text-white"
                              : "bg-slate-800/50 border-slate-800 text-slate-400 hover:border-slate-700"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold">{perm.name}</span>
                            {isSelected && <CheckCircle2 className="h-3.5 w-3.5 text-purple-400" />}
                          </div>
                          <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">{perm.description}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsCreatingRole(false)}
                    className="text-xs text-slate-400"
                  >
                    Отмена
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleCreateRole}
                    className="bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold"
                  >
                    Сохранить скрытую роль
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Карточки ролей */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {roles.map((role) => (
              <Card
                key={role.id}
                className="bg-slate-900/80 border-slate-800 hover:border-slate-700 transition-all p-5 rounded-xl flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3.5 h-3.5 rounded-full"
                        style={{ backgroundColor: role.color }}
                      />
                      <h3 className="font-bold text-sm text-white">{role.name}</h3>
                    </div>
                    <Badge variant="outline" className="text-[10px] font-mono text-slate-400">
                      {role.id}
                    </Badge>
                  </div>

                  <p className="text-xs text-slate-400 mb-3 leading-relaxed">
                    {role.description || "Пользовательская роль"}
                  </p>

                  <div className="space-y-1 mb-4">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Включенные привилегии ({role.permissions.length}):
                    </span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {role.permissions.map((pId) => {
                        const pObj = permissions.find((p) => p.id === pId);
                        return (
                          <span
                            key={pId}
                            className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700/50"
                          >
                            ✓ {pObj ? pObj.name : pId}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-800 text-xs">
                  <span className="text-[11px] text-slate-400">
                    Назначено: {assignments.filter((a) => a.role_id === role.id).length} чел.
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteRole(role.id)}
                    className="text-red-400 hover:text-red-300 h-7 px-2 text-xs"
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Удалить
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ВКЛАДКА 3: КАТАЛОГ ПРАВ И ФИЧЕЙ */}
        <TabsContent value="permissions" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Sliders className="h-4 w-4 text-purple-400" />
                Каталог скрытых модулей и прав
              </h2>
              <p className="text-xs text-slate-400">
                Модули, которые активируются для скрытых ролей без вмешательства в код приложения
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {permissions.map((perm) => (
              <div
                key={perm.id}
                className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-xs text-white">{perm.name}</span>
                    <Badge variant="outline" className="text-[9px] font-mono text-purple-400 border-purple-500/30">
                      {perm.category}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">{perm.description}</p>
                </div>
                <div className="pt-3 mt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                  <span className="font-mono text-[10px] text-slate-400">{perm.id}</span>
                  <span className="text-emerald-400 font-bold">Активен</span>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};
