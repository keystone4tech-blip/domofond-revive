import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";
import { useToast } from "@/hooks/use-toast";
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
import FSMDashboard from "@/components/fsm/FSMDashboard";
import EmployeesManager from "@/components/fsm/EmployeesManager";
import TasksManager from "@/components/fsm/TasksManager";
import ClientsManager from "@/components/fsm/ClientsManager";
import LocationMap from "@/components/fsm/LocationMap";
import FSMReports from "@/components/fsm/FSMReports";
import RequestsManager from "@/components/fsm/RequestsManager";
import ProductsManager from "@/components/fsm/ProductsManager";
import AddressesManager from "@/components/fsm/AddressesManager";
import { AccountsManager } from "@/components/admin/AccountsManager";
import IntercomLoginsManager from "@/components/fsm/IntercomLoginsManager";
import InstallerSheetManager from "@/components/fsm/InstallerSheetManager";
import VerificationManager from "@/components/fsm/VerificationManager";
import FSMBottomNav from "@/components/fsm/FSMBottomNav";
import { FSMSidebar } from "@/components/fsm/FSMSidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import PushNotificationToggle from "@/components/fsm/PushNotificationToggle";
import { FSM_TABS } from "@/types/crmRoles";

const FSM = () => {
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

  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, isFSMUser, isManager, isLoading, roles, permissions, hasPermission } = useUserRole();

  // Анимация плавного появления интерфейса
  useEffect(() => {
    if (!isLoading && user && isFSMUser) {
      console.log("[FSM] Инициализация страницы...");
      setTimeout(() => setIsVisible(prev => ({ ...prev, header: true })), 150);
      setTimeout(() => setIsVisible(prev => ({ ...prev, content: true })), 300);
    }
  }, [isLoading, user, isFSMUser]);

  // Проверка авторизации и доступа к CRM
  useEffect(() => {
    console.log("FSM page access check - isLoading:", isLoading, "user:", !!user, "isFSMUser:", isFSMUser, "roles:", roles);
    
    if (!isLoading) {
      if (!user) {
        toast({
          title: "Требуется авторизация",
          description: "Войдите в систему для доступа к панели управления FSM",
          variant: "destructive",
        });
        navigate("/auth");
      } else if (!isFSMUser && roles.length > 0) {
        toast({
          title: "Доступ запрещен",
          description: "У вас нет прав для доступа к FSM системе",
          variant: "destructive",
        });
        navigate("/");
      }
    }
  }, [user, isFSMUser, isLoading, roles, navigate, toast]);

  // Автоматическая корректировка активной вкладки: если у роли нет доступа к текущей вкладке, переключаем на первую разрешенную
  useEffect(() => {
    if (!isLoading && user && isFSMUser) {
      if (!hasPermission(activeTab)) {
        console.warn(`[FSM] Вкладка "${activeTab}" недоступна для текущей роли. Поиск доступной вкладки...`);
        // Ищем первую вкладку из списка разрешенных
        const firstAllowed = FSM_TABS.find(t => hasPermission(t.id));
        if (firstAllowed) {
          console.log(`[FSM] Авто-переключение на разрешенную вкладку: ${firstAllowed.id}`);
          setActiveTab(firstAllowed.id);
        }
      }
    }
  }, [isLoading, user, isFSMUser, activeTab, hasPermission]);

  // Обработчик переключения вкладок с поддержкой фильтров и ID переходов
  const handleTabChange = (tab: string, filter?: string, id?: string) => {
    // Проверяем право доступа к запрашиваемой вкладке
    if (!hasPermission(tab)) {
      console.warn(`[FSM] Попытка переключения на запрещенную вкладку: ${tab}`);
      toast({
        title: "Ограничение доступа",
        description: "У вашей роли нет разрешения на просмотр этого раздела",
        variant: "destructive",
      });
      return;
    }

    console.log(`[FSM] Переключение вкладки на "${tab}". Фильтр: "${filter || 'нет'}", ID: "${id || 'нет'}"`);
    setActiveTab(tab);
    
    if (filter) {
      setStatusFilter(filter);
    } else {
      // Значения по умолчанию
      if (tab === "requests") {
        setStatusFilter("all");
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

  // Очистка переходов после открытия
  const clearSelectedRequestId = () => setSelectedRequestId(undefined);
  const clearSelectedTaskId = () => setSelectedTaskId(undefined);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !isFSMUser) {
    return null;
  }

  const getRoleLabel = () => {
    if (roles.includes("superadmin")) return "Суперадмин";
    if (roles.includes("admin")) return "Администратор";
    if (roles.includes("director")) return "Директор";
    if (roles.includes("manager")) return "Менеджер";
    if (roles.includes("dispatcher")) return "Диспетчер";
    if (roles.includes("master")) return "Мастер";
    if (roles.includes("engineer")) return "Инженер";
    return "Сотрудник";
  };

  const getTabTitle = () => {
    const tabDef = FSM_TABS.find(t => t.id === activeTab);
    return tabDef ? tabDef.label : "FSM Панель";
  };

  return (
    <div className="min-h-screen flex bg-background overflow-x-hidden w-full">
      {/* Боковой сайдбар для ПК и мобильная шторка */}
      <FSMSidebar 
        activeTab={activeTab} 
        setActiveTab={handleTabChange} 
        isManager={isManager}
        isOpen={isMobileSidebarOpen}
        setIsOpen={setIsMobileSidebarOpen}
      />

      {/* Основной контент-контейнер справа: overflow-x-hidden предотвращает горизонтальный скролл */}
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
                {user.email?.slice(0, 2) || "F"}
              </div>
            </div>
            
            <ThemeToggle />
          </div>
        </header>

        {/* Главная рабочая область контента: отображаем только те вкладки, к которым есть доступ */}
        <main className="flex-1 p-3 sm:p-4 lg:p-6 w-full overflow-x-hidden min-w-0">
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
                <FSMDashboard isManager={isManager} onNavigate={handleTabChange} />
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

            {/* 4. Лист монтажника (сводная выдача оборудования по домам) */}
            {hasPermission("installer-sheet") && (
              <TabsContent value="installer-sheet" className="mt-0 outline-none">
                <InstallerSheetManager />
              </TabsContent>
            )}

            {/* 5. Товары и услуги */}
            {hasPermission("products") && (
              <TabsContent value="products" className="mt-0 outline-none">
                <ProductsManager />
              </TabsContent>
            )}

            {/* 6. Адреса и подъезды */}
            {hasPermission("addresses") && (
              <TabsContent value="addresses" className="mt-0 outline-none">
                <AddressesManager />
              </TabsContent>
            )}

            {/* 7. Лицевые счета и задолженности */}
            {hasPermission("accounts") && (
              <TabsContent value="accounts" className="mt-0 outline-none">
                <AccountsManager />
              </TabsContent>
            )}

            {/* 8. Логопасы умного домофона (выгрузка учетных записей) */}
            {hasPermission("logins") && (
              <TabsContent value="logins" className="mt-0 outline-none">
                <IntercomLoginsManager />
              </TabsContent>
            )}

            {/* 9. Сотрудники и роли */}
            {hasPermission("employees") && (
              <TabsContent value="employees" className="mt-0 outline-none">
                <EmployeesManager />
              </TabsContent>
            )}

            {/* 10. Клиенты / Объекты */}
            {hasPermission("clients") && (
              <TabsContent value="clients" className="mt-0 outline-none">
                <ClientsManager />
              </TabsContent>
            )}

            {/* 11. Карта мастеров */}
            {hasPermission("map") && (
              <TabsContent value="map" className="mt-0 outline-none">
                <LocationMap />
              </TabsContent>
            )}

            {/* 12. Финансовые отчеты */}
            {hasPermission("reports") && (
              <TabsContent value="reports" className="mt-0 outline-none">
                <FSMReports />
              </TabsContent>
            )}

            {/* 13. Верификация аккаунтов и смены данных */}
            {hasPermission("verification") && (
              <TabsContent value="verification" className="mt-0 outline-none">
                <VerificationManager />
              </TabsContent>
            )}
          </Tabs>
        </main>
      </div>

      {/* Мобильная нижняя навигация */}
      <FSMBottomNav 
        activeTab={activeTab} 
        onTabChange={handleTabChange} 
        isManager={isManager} 
      />
    </div>
  );
};

const FSMWithErrorBoundary = () => (
  <ErrorBoundary title="Критическая ошибка FSM панели">
    <FSM />
  </ErrorBoundary>
);

export default FSMWithErrorBoundary;
