import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link, useNavigate } from "react-router-dom";
import { 
  LayoutDashboard, ClipboardList, FileText, Package,
  Users, Building2, MapPin, BarChart3, ShieldCheck,
  X, Clock, AlertTriangle, CheckCircle2, CircleDashed,
  HandMetal, Banknote, User, Menu, Home, LogOut
} from "lucide-react";
import { cn } from "@/lib/utils";

interface FSMBottomNavProps {
  activeTab: string;
  onTabChange: (tab: string, filter?: string) => void;
  isManager: boolean;
}

const FSMBottomNav = ({ activeTab, onTabChange, isManager }: FSMBottomNavProps) => {
  const navigate = useNavigate();
  const [showTasksSubmenu, setShowTasksSubmenu] = useState(false);
  const [showRequestsSubmenu, setShowRequestsSubmenu] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false); // Для дополнительных разделов менеджера

  // Запрос счетчиков активных задач и заявок для бейджей
  const { data: counts } = useQuery({
    queryKey: ["fsm-bottom-nav-counts"],
    queryFn: async () => {
      console.log("[FSMBottomNav] Обновление счетчиков задач и заявок...");
      const [tasksRes, requestsRes] = await Promise.all([
        supabase.from("tasks").select("status"),
        supabase.from("requests").select("status"),
      ]);
      
      const tasks = tasksRes.data || [];
      const requests = requestsRes.data || [];
      
      return {
        pendingTasks: tasks.filter((t) => t.status === "pending" || t.status === "assigned").length,
        inProgressTasks: tasks.filter((t) => t.status === "in_progress").length,
        pendingRequests: requests.filter((r) => r.status === "pending").length,
        inProgressRequests: requests.filter((r) => r.status === "in_progress").length,
      };
    },
    refetchInterval: 30000, // Обновление каждые 30 секунд
  });

  // Основные 4 кнопки в нижнем меню
  const mainItems = [
    { id: "dashboard", label: "Панель", icon: LayoutDashboard },
    { 
      id: "tasks", 
      label: "Задачи", 
      icon: ClipboardList, 
      hasSubmenu: true,
      badge: (counts?.pendingTasks || 0) + (counts?.inProgressTasks || 0)
    },
    { 
      id: "requests", 
      label: "Заявки", 
      icon: FileText, 
      hasSubmenu: true,
      badge: (counts?.pendingRequests || 0) + (counts?.inProgressRequests || 0)
    },
  ];

  // Подменю для Задач
  const tasksSubmenuItems = [
    { id: "tasks_pending", label: "Ожидают", icon: Clock, filter: "pending", count: counts?.pendingTasks },
    { id: "tasks_in_progress", label: "В работе", icon: AlertTriangle, filter: "in_progress", count: counts?.inProgressTasks },
    { id: "tasks_completed", label: "Выполнены", icon: CheckCircle2, filter: "completed" },
    { id: "tasks_cancelled", label: "Отменены", icon: CircleDashed, filter: "cancelled" },
  ];

  // Подменю для Заявок
  const requestsSubmenuItems = [
    { id: "requests_pending", label: "Новые", icon: Clock, filter: "pending", count: counts?.pendingRequests },
    { id: "requests_in_progress", label: "В работе", icon: AlertTriangle, filter: "in_progress", count: counts?.inProgressRequests },
    { id: "requests_completed", label: "Выполнены", icon: CheckCircle2, filter: "completed" },
    { id: "requests_cancelled", label: "Отменены", icon: CircleDashed, filter: "cancelled" },
    { id: "requests_masters", label: "По мастерам", icon: HandMetal, filter: "masters" },
    { id: "requests_reports", label: "Финансы", icon: Banknote, filter: "reports" },
  ];

  // Обработчик основных кнопок
  const handleNavClick = (itemId: string, hasSubmenu?: boolean) => {
    if (hasSubmenu) {
      if (itemId === "tasks") {
        setShowTasksSubmenu(!showTasksSubmenu);
        setShowRequestsSubmenu(false);
        setShowMoreMenu(false);
      } else if (itemId === "requests") {
        setShowRequestsSubmenu(!showRequestsSubmenu);
        setShowTasksSubmenu(false);
        setShowMoreMenu(false);
      }
    } else {
      setShowTasksSubmenu(false);
      setShowRequestsSubmenu(false);
      setShowMoreMenu(false);
      onTabChange(itemId);
    }
  };

  // Обработчик подменю
  const handleSubmenuClick = (mainTab: string, filter: string) => {
    setShowTasksSubmenu(false);
    setShowRequestsSubmenu(false);
    onTabChange(mainTab, filter);
  };

  // Обработчик закрытия всех меню
  const closeAllMenus = () => {
    setShowTasksSubmenu(false);
    setShowRequestsSubmenu(false);
    setShowMoreMenu(false);
  };

  const showSubmenu = showTasksSubmenu || showRequestsSubmenu;
  const currentSubmenuItems = showTasksSubmenu ? tasksSubmenuItems : requestsSubmenuItems;
  const currentSubmenuType = showTasksSubmenu ? 'tasks' : 'requests';

  return (
    <>
      {/* Затемнение фона при открытых меню */}
      {(showSubmenu || showMoreMenu) && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden transition-all duration-300"
          onClick={closeAllMenus}
        />
      )}

      {/* Выпадающее подменю для Задач или Заявок */}
      {showSubmenu && (
        <div className="fixed bottom-16 left-4 right-4 z-50 lg:hidden bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200/50 dark:border-slate-800/50 rounded-2xl shadow-2xl p-4 animate-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-foreground text-sm tracking-wide uppercase">
              {showTasksSubmenu ? "Фильтр задач" : "Фильтр заявок"}
            </h3>
            <button
              onClick={closeAllMenus}
              className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {currentSubmenuItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => handleSubmenuClick(currentSubmenuType, item.filter)}
                  className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800 text-foreground active:scale-95 transition-all text-left relative"
                >
                  <div className={cn(
                    "p-1.5 rounded-lg",
                    item.filter === "pending" && "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400",
                    item.filter === "in_progress" && "bg-blue-500/20 text-blue-600 dark:text-blue-400",
                    item.filter === "completed" && "bg-green-500/20 text-green-600 dark:text-green-400",
                    item.filter === "cancelled" && "bg-slate-500/20 text-slate-500 dark:text-slate-400",
                    item.filter === "masters" && "bg-purple-500/20 text-purple-600 dark:text-purple-400",
                    item.filter === "reports" && "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                  )}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="text-xs font-semibold">{item.label}</span>
                  {item.count !== undefined && item.count > 0 && (
                    <span className="absolute top-2 right-2 min-w-[16px] h-[16px] bg-primary text-primary-foreground text-[9px] font-bold rounded-full flex items-center justify-center">
                      {item.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Шторка "Еще" (Дополнительное меню менеджера) */}
      {showMoreMenu && (
        <div className="fixed bottom-16 left-4 right-4 z-50 lg:hidden bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200/50 dark:border-slate-800/50 rounded-2xl shadow-2xl p-4 animate-in slide-in-from-bottom-4 duration-300 max-h-[70vh] overflow-y-auto custom-scrollbar">
          <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-slate-800/80 pb-2">
            <h3 className="font-bold text-foreground text-sm tracking-wide uppercase">Дополнительные разделы</h3>
            <button
              onClick={closeAllMenus}
              className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {/* Раздел Товары */}
            <button
              onClick={() => { onTabChange("products"); closeAllMenus(); }}
              className={cn("flex items-center gap-3 p-3 rounded-xl text-left transition-all active:scale-95 bg-slate-50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800", activeTab === "products" && "bg-primary/10 text-primary")}
            >
              <Package className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <span className="text-xs font-semibold">Товары</span>
            </button>

            {isManager && (
              <>
                <button
                  onClick={() => { onTabChange("employees"); closeAllMenus(); }}
                  className={cn("flex items-center gap-3 p-3 rounded-xl text-left transition-all active:scale-95 bg-slate-50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800", activeTab === "employees" && "bg-primary/10 text-primary")}
                >
                  <Users className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  <span className="text-xs font-semibold">Кадры</span>
                </button>
                <button
                  onClick={() => { onTabChange("clients"); closeAllMenus(); }}
                  className={cn("flex items-center gap-3 p-3 rounded-xl text-left transition-all active:scale-95 bg-slate-50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800", activeTab === "clients" && "bg-primary/10 text-primary")}
                >
                  <Building2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-xs font-semibold">Клиенты</span>
                </button>
                <button
                  onClick={() => { onTabChange("map"); closeAllMenus(); }}
                  className={cn("flex items-center gap-3 p-3 rounded-xl text-left transition-all active:scale-95 bg-slate-50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800", activeTab === "map" && "bg-primary/10 text-primary")}
                >
                  <MapPin className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                  <span className="text-xs font-semibold">Карта</span>
                </button>
                <button
                  onClick={() => { onTabChange("reports"); closeAllMenus(); }}
                  className={cn("flex items-center gap-3 p-3 rounded-xl text-left transition-all active:scale-95 bg-slate-50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800", activeTab === "reports" && "bg-primary/10 text-primary")}
                >
                  <BarChart3 className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  <span className="text-xs font-semibold">Отчеты</span>
                </button>
                <button
                  onClick={() => { onTabChange("verification"); closeAllMenus(); }}
                  className={cn("flex items-center gap-3 p-3 rounded-xl text-left transition-all active:scale-95 bg-slate-50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800", activeTab === "verification" && "bg-primary/10 text-primary")}
                >
                  <ShieldCheck className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                  <span className="text-xs font-semibold">Верификация</span>
                </button>
              </>
            )}
          </div>

          {/* Быстрые действия: на сайт / выход */}
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 grid grid-cols-2 gap-2">
            <Link 
              to="/" 
              className="flex items-center justify-center gap-2 p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-muted-foreground"
            >
              <Home className="h-3.5 w-3.5" />
              <span>На сайт</span>
            </Link>
            <button
              onClick={async () => {
                await supabase.auth.signOut();
                navigate("/auth");
              }}
              className="flex items-center justify-center gap-2 p-2 rounded-xl border border-red-200 dark:border-red-950/30 hover:bg-red-50 dark:hover:bg-red-950/20 text-xs font-semibold text-red-600"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Выйти</span>
            </button>
          </div>
        </div>
      )}

      {/* Основной стеклянный нижний навигационный бар */}
      <nav className="fixed bottom-3 left-4 right-4 z-50 lg:hidden bg-white/75 dark:bg-slate-900/75 backdrop-blur-lg border border-white/20 dark:border-slate-800/50 shadow-2xl rounded-2xl transition-all duration-300">
        <div className="flex justify-around items-center h-16 px-2">
          
          {/* Основные кнопки */}
          {mainItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            const isSubmenuOpen = (item.id === "tasks" && showTasksSubmenu) || 
                                   (item.id === "requests" && showRequestsSubmenu);
            
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id, item.hasSubmenu)}
                className={cn(
                  "flex flex-col items-center justify-center min-w-[50px] py-1 px-2 rounded-xl transition-all active:scale-90 relative",
                  isActive || isSubmenuOpen
                    ? "text-primary bg-primary/10" 
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <div className="relative">
                  <Icon className={cn("h-5 w-5", (isActive || isSubmenuOpen) && "scale-110")} />
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="absolute -top-1.5 -right-2 min-w-[15px] h-[15px] bg-destructive text-destructive-foreground text-[8px] font-bold rounded-full flex items-center justify-center animate-pulse">
                      {item.badge > 99 ? "99+" : item.badge}
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-semibold mt-1 leading-none">{item.label}</span>
              </button>
            );
          })}

          {/* Кнопка "Кабинет" (Выход на сайт / ЛК по правилу) */}
          <Link
            to="/cabinet"
            className={cn(
              "flex flex-col items-center justify-center min-w-[50px] py-1 px-2 rounded-xl transition-all active:scale-90",
              "text-muted-foreground hover:text-foreground"
            )}
          >
            <User className="h-5 w-5" />
            <span className="text-[10px] font-semibold mt-1 leading-none">Кабинет</span>
          </Link>

          {/* Кнопка "Еще" (для менеджеров) или "Товары" (для мастеров) */}
          {isManager ? (
            <button
              onClick={() => {
                setShowMoreMenu(!showMoreMenu);
                setShowTasksSubmenu(false);
                setShowRequestsSubmenu(false);
              }}
              className={cn(
                "flex flex-col items-center justify-center min-w-[50px] py-1 px-2 rounded-xl transition-all active:scale-90",
                showMoreMenu ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Menu className="h-5 w-5" />
              <span className="text-[10px] font-semibold mt-1 leading-none">Еще</span>
            </button>
          ) : (
            <button
              onClick={() => handleNavClick("products")}
              className={cn(
                "flex flex-col items-center justify-center min-w-[50px] py-1 px-2 rounded-xl transition-all active:scale-90",
                activeTab === "products" ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Package className="h-5 w-5" />
              <span className="text-[10px] font-semibold mt-1 leading-none">Товары</span>
            </button>
          )}

        </div>
      </nav>
    </>
  );
};

export default FSMBottomNav;
