import React from "react";
import { supabase } from "@/integrations/supabase/client";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { 
  LayoutDashboard, ClipboardList, FileText, Package, 
  Users, Building2, MapPin, BarChart3, ShieldCheck, 
  Home, LogOut, Shield, User
} from "lucide-react";
import { cn } from "@/lib/utils";

// Пропсы для боковой панели FSM
interface FSMSidebarProps {
  activeTab: string;
  setActiveTab: (tab: string, filter?: string) => void;
  isManager: boolean;
  isOpen?: boolean; // Для мобильной шторки
  setIsOpen?: (open: boolean) => void;
}

export const FSMSidebar = ({ activeTab, setActiveTab, isManager, isOpen, setIsOpen }: FSMSidebarProps) => {
  const navigate = useNavigate();

  // Получение количества активных задач и заявок для бейджей (обновление каждые 15 сек)
  const { data: counts } = useQuery({
    queryKey: ["fsm-sidebar-counts"],
    queryFn: async () => {
      console.log("[FSMSidebar] Получение счетчиков для бейджей...");
      const [tasksRes, requestsRes] = await Promise.all([
        supabase.from("tasks").select("status"),
        supabase.from("requests").select("status"),
      ]);
      
      const tasks = tasksRes.data || [];
      const requests = requestsRes.data || [];
      
      return {
        pendingTasks: tasks.filter((t) => t.status === "pending" || t.status === "assigned" || t.status === "in_progress").length,
        pendingRequests: requests.filter((r) => r.status === "pending" || r.status === "in_progress").length,
      };
    },
    refetchInterval: 15000, // Авто-обновление каждые 15 секунд
  });

  // Элементы навигации
  const menuItems = [
    { id: "dashboard", label: "Панель управления", icon: LayoutDashboard },
    { 
      id: "tasks", 
      label: "Задачи", 
      icon: ClipboardList, 
      badge: counts?.pendingTasks || 0 
    },
    { 
      id: "requests", 
      label: "Заявки", 
      icon: FileText, 
      badge: counts?.pendingRequests || 0 
    },
    { id: "products", label: "Товары и услуги", icon: Package },
  ];

  // Элементы навигации только для менеджера
  const managerItems = [
    { id: "employees", label: "Сотрудники", icon: Users },
    { id: "clients", label: "Клиенты / Объекты", icon: Building2 },
    { id: "map", label: "Карта мастеров", icon: MapPin },
    { id: "reports", label: "Финансовые отчеты", icon: BarChart3 },
    { id: "verification", label: "Верификация", icon: ShieldCheck },
  ];

  const visibleItems = isManager ? [...menuItems, ...managerItems] : menuItems;

  // Обработчик выбора вкладки
  const handleTabClick = (tabId: string) => {
    console.log(`[FSMSidebar] Переключение вкладки на: ${tabId}`);
    setActiveTab(tabId);
    if (setIsOpen) setIsOpen(false); // Закрываем мобильное меню при наличии шторки
  };

  // Выход из сессии
  const handleLogout = async () => {
    console.log("[FSMSidebar] Выход из системы...");
    await supabase.auth.signOut();
    navigate("/auth");
  };

  return (
    <aside className={cn(
      "w-64 h-screen flex flex-col justify-between transition-all duration-300",
      "bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-r border-slate-200/50 dark:border-slate-800/50",
      "fixed top-0 left-0 z-50",
      // Мобильное скрытие сайдбара
      isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
    )}>
      {/* Верхний блок: Логотип и Название */}
      <div>
        <div className="h-16 flex items-center gap-3 px-6 border-b border-slate-100 dark:border-slate-800/80">
          <Shield className="h-6 w-6 text-primary animate-pulse" />
          <div className="flex flex-col text-left">
            <span className="font-logo font-extrabold text-sm tracking-wide text-foreground uppercase">LuxTech FSM</span>
            <span className="text-[10px] text-muted-foreground font-semibold">Управление выездами</span>
          </div>
        </div>

        {/* Список разделов навигации */}
        <nav className="p-4 space-y-1 max-h-[calc(100vh-14rem)] overflow-y-auto custom-scrollbar">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleTabClick(item.id)}
                className={cn(
                  "w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 text-left",
                  isActive 
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/20 scale-[1.02]"
                    : "text-muted-foreground hover:bg-slate-100/70 dark:hover:bg-slate-800/50 hover:text-foreground"
                )}
              >
                <div className="flex items-center gap-3 truncate">
                  <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-white" : "text-muted-foreground/80")} />
                  <span className="truncate">{item.label}</span>
                </div>
                {/* Бейдж с количеством активных элементов */}
                {'badge' in item && item.badge > 0 && (
                  <span className={cn(
                    "min-w-[18px] h-[18px] text-[10px] font-bold rounded-full flex items-center justify-center px-1.5",
                    isActive ? "bg-white text-primary" : "bg-destructive text-white animate-pulse"
                  )}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Нижний блок: Навигация на сайт, в ЛК и Выход */}
      <div className="p-4 border-t border-slate-100 dark:border-slate-800/80 space-y-1 bg-white/40 dark:bg-slate-900/40">
        <Link 
          to="/" 
          className="flex items-center gap-3 px-4 py-2 rounded-xl text-sm font-semibold text-muted-foreground hover:bg-slate-100/70 dark:hover:bg-slate-800/50 hover:text-foreground transition-all duration-200"
        >
          <Home className="h-4 w-4 shrink-0" />
          <span>На сайт</span>
        </Link>
        <Link 
          to="/cabinet" 
          className="flex items-center gap-3 px-4 py-2 rounded-xl text-sm font-semibold text-muted-foreground hover:bg-slate-100/70 dark:hover:bg-slate-800/50 hover:text-foreground transition-all duration-200"
        >
          <User className="h-4 w-4 shrink-0" />
          <span>Личный кабинет</span>
        </Link>
        <button 
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-2 rounded-xl text-sm font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 transition-all duration-200 text-left"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          <span>Выйти</span>
        </button>
      </div>
    </aside>
  );
};
