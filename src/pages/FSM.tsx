import { useEffect, useState } from "react";
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
import VerificationManager from "@/components/fsm/VerificationManager";
import FSMBottomNav from "@/components/fsm/FSMBottomNav";
import { FSMSidebar } from "@/components/fsm/FSMSidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import PushNotificationToggle from "@/components/fsm/PushNotificationToggle";

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
  const { user, isFSMUser, isManager, isLoading, roles } = useUserRole();

  useEffect(() => {
    if (!isLoading && user && isFSMUser) {
      console.log("[FSM] Инициализация страницы...");
      setTimeout(() => setIsVisible(prev => ({ ...prev, header: true })), 150);
      setTimeout(() => setIsVisible(prev => ({ ...prev, content: true })), 300);
    }
  }, [isLoading, user, isFSMUser]);

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

  // Обработчик переключения вкладок с поддержкой фильтров и ID переходов
  const handleTabChange = (tab: string, filter?: string, id?: string) => {
    console.log(`[FSM] Переключение вкладки на "${tab}". Фильтр: "${filter || 'нет'}", ID: "${id || 'нет'}"`);
    setActiveTab(tab);
    
    if (filter) {
      setStatusFilter(filter);
    } else {
      // Значения по умолчанию
      if (tab === "requests" || tab === "tasks") {
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
    if (roles.includes("admin")) return "Администратор";
    if (roles.includes("director")) return "Директор";
    if (roles.includes("manager")) return "Менеджер";
    if (roles.includes("dispatcher")) return "Диспетчер";
    if (roles.includes("master")) return "Мастер";
    if (roles.includes("engineer")) return "Инженер";
    return "Сотрудник";
  };

  const getTabTitle = () => {
    switch (activeTab) {
      case "dashboard": return "Панель управления";
      case "tasks": return "Задачи";
      case "requests": return "Заявки клиентов";
      case "products": return "Товары и услуги";
      case "employees": return "Кадровый состав";
      case "clients": return "Список клиентов";
      case "map": return "Карта выездов";
      case "reports": return "Аналитические отчеты";
      case "verification": return "Верификация аккаунтов";
      default: return "FSM Панель";
    }
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
              <span className="text-muted-foreground font-semibold uppercase tracking-wider text-[10px] hidden sm:inline">FSM</span>
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

        {/* Главная рабочая область контента */}
        <main className="flex-1 p-3 sm:p-4 lg:p-6 w-full overflow-x-hidden min-w-0">
          <Tabs
            value={activeTab}
            onValueChange={(val) => handleTabChange(val)}
            className={`space-y-4 ${
              isVisible.content ? 'opacity-100' : 'opacity-0'
            } transition-opacity duration-300`}
          >
            <TabsContent value="dashboard" className="mt-0 outline-none">
              <FSMDashboard isManager={isManager} onNavigate={handleTabChange} />
            </TabsContent>

            <TabsContent value="tasks" className="mt-0 outline-none">
              <TasksManager 
                isManager={isManager} 
                initialFilter={statusFilter}
                initialTaskId={selectedTaskId}
                onClearInitialTaskId={clearSelectedTaskId}
              />
            </TabsContent>

            <TabsContent value="requests" className="mt-0 outline-none">
              <RequestsManager 
                initialFilter={statusFilter} 
                initialRequestId={selectedRequestId}
                onClearInitialRequestId={clearSelectedRequestId}
              />
            </TabsContent>

            <TabsContent value="products" className="mt-0 outline-none">
              <ProductsManager />
            </TabsContent>

            {isManager && (
              <>
                <TabsContent value="employees" className="mt-0 outline-none">
                  <EmployeesManager />
                </TabsContent>

                <TabsContent value="clients" className="mt-0 outline-none">
                  <ClientsManager />
                </TabsContent>

                <TabsContent value="map" className="mt-0 outline-none">
                  <LocationMap />
                </TabsContent>

                <TabsContent value="reports" className="mt-0 outline-none">
                  <FSMReports />
                </TabsContent>

                <TabsContent value="verification" className="mt-0 outline-none">
                  <VerificationManager />
                </TabsContent>
              </>
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

