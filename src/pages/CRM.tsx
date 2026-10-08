// src/pages/CRM.tsx
// Официальная CRM-панель управления платформы «Домофондар»
// Включает все 17 модулей управления: заявки, задачи, абоненты, монтаж, оборудование,
// лицевые счета, верификацию, отчеты, регламенты и карту мастеров.

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import EmployeeOnboarding from "@/components/EmployeeOnboarding";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  MapPin,
  Building2,
  BarChart3,
  FileText,
  Loader2,
  Package,
  ShieldCheck,
  Menu,
  ChevronRight,
  Shield
} from "lucide-react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import CRMDashboard from "@/components/crm/CRMDashboard";
import EmployeesManager from "@/components/crm/EmployeesManager";
import TasksManager from "@/components/crm/TasksManager";
import ClientsManager from "@/components/crm/ClientsManager";
import LocationMap from "@/components/crm/LocationMap";
import CRMReports from "@/components/crm/CRMReports";
import RequestsManager from "@/components/crm/RequestsManager";
import ProductsManager from "@/components/crm/ProductsManager";
import EquipmentMatchingManager from "@/components/crm/EquipmentMatchingManager";
import NewBuildingsManager from "@/components/crm/NewBuildingsManager";
import UsersManager from "@/components/crm/UsersManager";
import AddressesManager from "@/components/crm/AddressesManager";
import { AccountsManager } from "@/components/admin/AccountsManager";
import { AutopayAnalytics } from "@/components/admin/AutopayAnalytics";
import IntercomLoginsManager from "@/components/crm/IntercomLoginsManager";
import InstallerSheetManager from "@/components/crm/InstallerSheetManager";
import VerificationManager from "@/components/crm/VerificationManager";
import InstructionsManager from "@/components/crm/InstructionsManager";
import CRMBottomNav from "@/components/crm/CRMBottomNav";
import { CRMSidebar } from "@/components/crm/CRMSidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import PushNotificationToggle from "@/components/crm/PushNotificationToggle";
import { CRM_TABS } from "@/types/crmRoles";

const CRM = () => {
  const [isVisible, setIsVisible] = useState({
    header: false,
    content: false
  });
  
  // Текущая активная вкладка
  const [activeTab, setActiveTab] = useState("dashboard");
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  
  // Состояния для авто-открытия заявок/задач по ID из дашборда
  const [selectedRequestId, setSelectedRequestId] = useState<string | undefined>(undefined);
  const [selectedTaskId, setSelectedTaskId] = useState<string | undefined>(undefined);
  
  // Открытие мобильного сайдбара
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Анкета сотрудника при входе в CRM
  const [onboarding, setOnboarding] = useState<{ show: boolean; blocking: boolean; userId: string } | null>(null);

  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, isCRMUser, isManager, isLoading, roles, hasPermission, getRoleDisplayName } = useUserRole();

  // Анимация плавного появления интерфейса
  useEffect(() => {
    if (!isLoading && user && isCRMUser) {
      console.log("[CRM] Инициализация панели управления...");
      setTimeout(() => setIsVisible(prev => ({ ...prev, header: true })), 150);
      setTimeout(() => setIsVisible(prev => ({ ...prev, content: true })), 300);
    }
  }, [isLoading, user, isCRMUser]);

  // Проверка авторизации и доступа к CRM
  useEffect(() => {
    console.log("[CRM] Проверка прав доступа — isLoading:", isLoading, "user:", !!user, "isCRMUser:", isCRMUser, "roles:", roles);
    
    if (!isLoading) {
      if (!user) {
        toast({
          title: "Требуется авторизация",
          description: "Войдите в систему для доступа к CRM-панели",
          variant: "destructive",
        });
        navigate("/auth");
      } else if (!isCRMUser && roles.length > 0) {
        toast({
          title: "Доступ запрещен",
          description: "У вашей роли нет разрешения на доступ к CRM-системе",
          variant: "destructive",
        });
        navigate("/");
      }
    }
  }, [user, isCRMUser, isLoading, roles, navigate, toast]);

  // Проверка анкеты сотрудника при входе в CRM
  useEffect(() => {
    if (isLoading || !user || !isCRMUser) return;
    let cancelled = false;
    (async () => {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser || cancelled) return;
        const { data: emp } = await supabase
          .from("employees")
          .select("id, is_active, profile_completed")
          .eq("user_id", authUser.id)
          .maybeSingle();
        if (cancelled || !emp) return;
        if (!(emp as any).profile_completed) {
          setOnboarding({ show: true, blocking: !(emp as any).is_active, userId: authUser.id });
        }
      } catch (e) {
        console.warn("[CRM] Проверка анкеты сотрудника не удалась:", e);
      }
    })();
    return () => { cancelled = true; };
  }, [isLoading, user, isCRMUser]);

  // Автоматическая корректировка активной вкладки: если у роли нет доступа к текущей вкладке, переключаем на первую разрешенную
  useEffect(() => {
    if (!isLoading && user && isCRMUser) {
      if (!hasPermission(activeTab)) {
        console.warn(`[CRM] Вкладка "${activeTab}" недоступна для текущей роли. Поиск доступной вкладки...`);
        const firstAllowed = CRM_TABS.find(t => hasPermission(t.id));
        if (firstAllowed) {
          console.log(`[CRM] Авто-переключение на разрешенную вкладку: ${firstAllowed.id}`);
          setActiveTab(firstAllowed.id);
        }
      }
    }
  }, [isLoading, user, isCRMUser, activeTab, hasPermission]);

  // Обработчик переключения вкладок с поддержкой фильтров и ID переходов
  const handleTabChange = (tab: string, filter?: string, id?: string) => {
    if (!hasPermission(tab)) {
      console.warn(`[CRM] Попытка переключения на запрещенную вкладку: ${tab}`);
      toast({
        title: "Ограничение доступа",
        description: "У вашей роли нет разрешения на просмотр этого раздела",
        variant: "destructive",
      });
      return;
    }

    console.log(`[CRM] Переключение вкладки на "${tab}". Фильтр: "${filter || 'нет'}", ID: "${id || 'нет'}"`);
    setActiveTab(tab);
    
    if (filter) {
      setStatusFilter(filter);
    } else {
      if (tab === "requests") {
        setStatusFilter("pending");
      } else if (tab === "tasks") {
        setStatusFilter("pending");
      }
    }

    if (id) {
      if (tab === "requests") {
        setSelectedRequestId(id);
        setSelectedTaskId(undefined);
      } else if (tab === "tasks") {
        setSelectedTaskId(id);
        setSelectedRequestId(undefined);
      }
    }
  };

  const clearSelectedRequestId = () => setSelectedRequestId(undefined);
  const clearSelectedTaskId = () => setSelectedTaskId(undefined);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !isCRMUser) {
    return null;
  }

  const getRoleLabel = () => {
    return getRoleDisplayName();
  };

  const getTabTitle = () => {
    const tabDef = CRM_TABS.find(t => t.id === activeTab);
    return tabDef ? tabDef.label : "CRM Панель";
  };

  return (
    <div className="min-h-screen flex bg-background overflow-x-hidden w-full">
      {/* Боковой сайдбар для ПК и мобильная шторка */}
      <CRMSidebar 
        activeTab={activeTab} 
        setActiveTab={handleTabChange} 
        isManager={isManager}
        isOpen={isMobileSidebarOpen}
        setIsOpen={setIsMobileSidebarOpen}
      />

      {/* Основной контент-контейнер справа */}
      <div className="flex-1 flex flex-col min-h-screen overflow-x-hidden lg:pl-64 pb-20 lg:pb-0 transition-all duration-300">
        
        {/* Адаптивный верхний Top Bar дашборда */}
        <header className="sticky top-0 z-40 bg-white/70 dark:bg-slate-900/75 backdrop-blur-md border-b border-slate-200/50 dark:border-slate-800/50 px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Кнопка открытия мобильного сайдбара */}
            <button
              onClick={() => setIsMobileSidebarOpen(true)}
              className="p-2 -ml-2 rounded-xl lg:hidden text-muted-foreground hover:text-foreground hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <Menu className="h-5 w-5" />
            </button>

            {/* Хлебные крошки / Текущий раздел */}
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground font-semibold uppercase tracking-wider text-[10px] hidden sm:inline">CRM</span>
              <ChevronRight className="h-3 w-3 text-muted-foreground/60 hidden sm:inline" />
              <span className="font-bold text-foreground tracking-tight">{getTabTitle()}</span>
            </div>
          </div>

          {/* Правая часть Top Bar */}
          <div className="flex items-center gap-3">
            <PushNotificationToggle />
            
            {/* Аватар и роль */}
            <div className="flex items-center gap-2 bg-slate-100/55 dark:bg-slate-800/40 p-1.5 pl-3 pr-2.5 rounded-xl border border-slate-200/30 dark:border-slate-850">
              <div className="flex flex-col text-right hidden sm:flex">
                <span className="text-xs font-bold text-foreground leading-tight">
                  {user.email?.split("@")[0] || "Сотрудник"}
                </span>
                <span className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wider">
                  {getRoleLabel()}
                </span>
              </div>
              <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-xs uppercase shadow-inner">
                {user.email?.slice(0, 2) || "C"}
              </div>
            </div>
            
            <ThemeToggle />
          </div>
        </header>

        {/* Главная рабочая область контента */}
        <main className="flex-1 p-3 sm:p-4 lg:p-6 pb-28 sm:pb-32 lg:pb-8 w-full overflow-x-hidden min-w-0">
          <Tabs
            value={activeTab}
            onValueChange={(val) => handleTabChange(val)}
            className={`space-y-4 ${
              isVisible.content ? 'opacity-100' : 'opacity-0'
            } transition-opacity duration-300`}
          >
            {/* 1. Панель управления */}
            {hasPermission("dashboard") && (
              <TabsContent value="dashboard" className="mt-0 outline-none">
                <CRMDashboard isManager={isManager} onNavigate={handleTabChange} />
              </TabsContent>
            )}

            {/* 2. Задачи */}
            {hasPermission("tasks") && (
              <TabsContent value="tasks" className="mt-0 outline-none">
                <TasksManager 
                  isManager={isManager} 
                  initialFilter={statusFilter}
                  initialTaskId={selectedTaskId}
                  onClearInitialTaskId={clearSelectedTaskId}
                />
              </TabsContent>
            )}

            {/* 3. Заявки клиентов */}
            {hasPermission("requests") && (
              <TabsContent value="requests" className="mt-0 outline-none">
                <RequestsManager 
                  initialFilter={statusFilter} 
                  initialRequestId={selectedRequestId}
                  onClearInitialRequestId={clearSelectedRequestId}
                />
              </TabsContent>
            )}

            {/* 4. Новые дома */}
            {hasPermission("new-buildings") && (
              <TabsContent value="new-buildings" className="mt-0 outline-none">
                <NewBuildingsManager onNavigate={handleTabChange} />
              </TabsContent>
            )}

            {/* 5. Лист монтажника */}
            {hasPermission("installer-sheet") && (
              <TabsContent value="installer-sheet" className="mt-0 outline-none">
                <InstallerSheetManager />
              </TabsContent>
            )}

            {/* 6. Товары и услуги */}
            {hasPermission("products") && (
              <TabsContent value="products" className="mt-0 outline-none">
                <ProductsManager />
              </TabsContent>
            )}

            {/* 7. Подбор оборудования */}
            {hasPermission("equipment-matching") && (
              <TabsContent value="equipment-matching" className="mt-0 outline-none">
                <EquipmentMatchingManager />
              </TabsContent>
            )}

            {/* 8. Адреса и подъезды */}
            {hasPermission("addresses") && (
              <TabsContent value="addresses" className="mt-0 outline-none">
                <AddressesManager />
              </TabsContent>
            )}

            {/* 9. Лицевые счета */}
            {hasPermission("accounts") && (
              <TabsContent value="accounts" className="mt-0 outline-none">
                <AccountsManager />
              </TabsContent>
            )}

            {/* 9.1 Автоплатежи (рекуррентные платежи ЮKassa) */}
            {hasPermission("autopay") && (
              <TabsContent value="autopay" className="mt-0 outline-none">
                <AutopayAnalytics />
              </TabsContent>
            )}

            {/* 10. Логопасы домофонов */}
            {hasPermission("logins") && (
              <TabsContent value="logins" className="mt-0 outline-none">
                <IntercomLoginsManager />
              </TabsContent>
            )}

            {/* 11. Сотрудники и роли */}
            {hasPermission("employees") && (
              <TabsContent value="employees" className="mt-0 outline-none">
                <EmployeesManager />
              </TabsContent>
            )}

            {/* 12. Клиенты и объекты */}
            {hasPermission("clients") && (
              <TabsContent value="clients" className="mt-0 outline-none">
                <ClientsManager />
              </TabsContent>
            )}

            {/* 13. Личные кабинеты */}
            {hasPermission("cabinets") && (
              <TabsContent value="cabinets" className="mt-0 outline-none">
                <UsersManager />
              </TabsContent>
            )}

            {/* 14. Карта мастеров */}
            {hasPermission("map") && (
              <TabsContent value="map" className="mt-0 outline-none">
                <LocationMap />
              </TabsContent>
            )}

            {/* 15. Отчеты */}
            {hasPermission("reports") && (
              <TabsContent value="reports" className="mt-0 outline-none">
                <CRMReports />
              </TabsContent>
            )}

            {/* 16. Верификация аккаунтов */}
            {hasPermission("verification") && (
              <TabsContent value="verification" className="mt-0 outline-none">
                <VerificationManager onNavigate={handleTabChange} />
              </TabsContent>
            )}

            {/* 17. Инструкция для сотрудников */}
            {hasPermission("instructions") && (
              <TabsContent value="instructions" className="mt-0 outline-none">
                <InstructionsManager onNavigate={handleTabChange} />
              </TabsContent>
            )}
          </Tabs>
        </main>
      </div>

      {/* Нижняя мобильная навигация CRM */}
      <CRMBottomNav 
        activeTab={activeTab} 
        onTabChange={handleTabChange} 
        onOpenSidebar={() => setIsMobileSidebarOpen(true)}
      />

      {/* Анкета сотрудника */}
      {onboarding && (
        <EmployeeOnboarding
          userId={onboarding.userId}
          isBlocking={onboarding.blocking}
          onCompleted={() => setOnboarding(null)}
          onDismiss={() => setOnboarding(null)}
        />
      )}
    </div>
  );
};

const CRMWithErrorBoundary = () => (
  <ErrorBoundary fallbackTitle="Ошибка панели CRM" fallbackMessage="Произошла непредвиденная ошибка в CRM панели. Нажмите кнопку «Обновить страницу» для восстановления работы.">
    <CRM />
  </ErrorBoundary>
);

export default CRMWithErrorBoundary;
