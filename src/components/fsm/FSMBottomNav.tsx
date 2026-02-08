import { useState } from "react";
import { 
  LayoutDashboard, 
  ClipboardList, 
  FileText, 
  Users, 
  Building2, 
  MapPin, 
  BarChart3,
  Package,
  X,
  Clock,
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  HandMetal,
  Banknote
} from "lucide-react";
import { cn } from "@/lib/utils";

interface FSMBottomNavProps {
  activeTab: string;
  onTabChange: (tab: string, filter?: string) => void;
  isManager: boolean;
}

const FSMBottomNav = ({ activeTab, onTabChange, isManager }: FSMBottomNavProps) => {
  const [showTasksSubmenu, setShowTasksSubmenu] = useState(false);
  const [showRequestsSubmenu, setShowRequestsSubmenu] = useState(false);

  const baseItems: { id: string; label: string; icon: typeof LayoutDashboard; hasSubmenu?: boolean }[] = [
    { id: "dashboard", label: "Панель", icon: LayoutDashboard },
    { id: "tasks", label: "Задачи", icon: ClipboardList, hasSubmenu: true },
    { id: "requests", label: "Заявки", icon: FileText, hasSubmenu: true },
    { id: "products", label: "Товары", icon: Package },
  ];

  const managerItems: { id: string; label: string; icon: typeof LayoutDashboard; hasSubmenu?: boolean }[] = [
    { id: "employees", label: "Кадры", icon: Users },
    { id: "clients", label: "Клиенты", icon: Building2 },
    { id: "map", label: "Карта", icon: MapPin },
    { id: "reports", label: "Отчеты", icon: BarChart3 },
  ];

  const items = isManager ? [...baseItems, ...managerItems] : baseItems;

  const tasksSubmenuItems = [
    { id: "tasks_pending", label: "Ожидают", icon: Clock, filter: "pending" },
    { id: "tasks_in_progress", label: "В работе", icon: AlertTriangle, filter: "in_progress" },
    { id: "tasks_completed", label: "Выполнены", icon: CheckCircle2, filter: "completed" },
    { id: "tasks_cancelled", label: "Отменены", icon: CircleDashed, filter: "cancelled" },
  ];

  const requestsSubmenuItems = [
    { id: "requests_pending", label: "Новые", icon: Clock, filter: "pending" },
    { id: "requests_in_progress", label: "В работе", icon: AlertTriangle, filter: "in_progress" },
    { id: "requests_completed", label: "Выполнены", icon: CheckCircle2, filter: "completed" },
    { id: "requests_cancelled", label: "Отменены", icon: CircleDashed, filter: "cancelled" },
    { id: "requests_masters", label: "По мастерам", icon: HandMetal, filter: "masters" },
    { id: "requests_reports", label: "Финансы", icon: Banknote, filter: "reports" },
  ];

  const handleNavClick = (itemId: string, hasSubmenu?: boolean) => {
    if (hasSubmenu) {
      if (itemId === "tasks") {
        setShowTasksSubmenu(!showTasksSubmenu);
        setShowRequestsSubmenu(false);
      } else if (itemId === "requests") {
        setShowRequestsSubmenu(!showRequestsSubmenu);
        setShowTasksSubmenu(false);
      }
    } else {
      setShowTasksSubmenu(false);
      setShowRequestsSubmenu(false);
      onTabChange(itemId);
    }
  };

  const handleSubmenuClick = (mainTab: string, filter: string) => {
    // Close submenus
    setShowTasksSubmenu(false);
    setShowRequestsSubmenu(false);
    // Navigate to tab with filter
    onTabChange(mainTab, filter);
  };

  const showSubmenu = showTasksSubmenu || showRequestsSubmenu;
  const currentSubmenuItems = showTasksSubmenu ? tasksSubmenuItems : requestsSubmenuItems;
  const currentSubmenuType = showTasksSubmenu ? 'tasks' : 'requests';

  // Show max items based on available items
  const visibleItems = items.slice(0, 8);

  return (
    <>
      {/* Submenu overlay */}
      {showSubmenu && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => {
            setShowTasksSubmenu(false);
            setShowRequestsSubmenu(false);
          }}
        />
      )}

      {/* Submenu popup */}
      {showSubmenu && (
        <div className="fixed bottom-16 left-0 right-0 z-50 lg:hidden bg-background border-t border-border rounded-t-2xl shadow-2xl animate-in slide-in-from-bottom-4 duration-200">
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-foreground">
                {showTasksSubmenu ? "Задачи" : "Заявки"}
              </h3>
              <button
                onClick={() => {
                  setShowTasksSubmenu(false);
                  setShowRequestsSubmenu(false);
                }}
                className="p-1 rounded-full hover:bg-muted transition-colors"
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
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-xl transition-all",
                      "bg-muted/50 hover:bg-muted text-foreground active:scale-95"
                    )}
                  >
                    <div className={cn(
                      "p-2 rounded-lg",
                      item.filter === "pending" && "bg-yellow-500/20 text-yellow-500",
                      item.filter === "in_progress" && "bg-blue-500/20 text-blue-500",
                      item.filter === "completed" && "bg-green-500/20 text-green-500",
                      item.filter === "cancelled" && "bg-muted-foreground/20 text-muted-foreground",
                      item.filter === "masters" && "bg-purple-500/20 text-purple-500",
                      item.filter === "reports" && "bg-emerald-500/20 text-emerald-500"
                    )}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="text-sm font-medium">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Main bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-background/95 backdrop-blur-lg border-t border-border shadow-lg">
        <div className="flex justify-around items-center h-16 px-1 overflow-x-auto">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            const isSubmenuOpen = (item.id === "tasks" && showTasksSubmenu) || 
                                   (item.id === "requests" && showRequestsSubmenu);
            
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id, item.hasSubmenu)}
                className={cn(
                  "flex flex-col items-center justify-center min-w-[56px] py-2 px-1 rounded-lg transition-all relative",
                  isActive || isSubmenuOpen
                    ? "text-primary bg-primary/10" 
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                <Icon className={cn("h-5 w-5 mb-1", (isActive || isSubmenuOpen) && "scale-110")} />
                <span className="text-[10px] font-medium leading-none">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
};

export default FSMBottomNav;
