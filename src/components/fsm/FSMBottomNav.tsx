import { 
  LayoutDashboard, 
  ClipboardList, 
  FileText, 
  Users, 
  Building2, 
  MapPin, 
  BarChart3,
  Package
} from "lucide-react";
import { cn } from "@/lib/utils";

interface FSMBottomNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  isManager: boolean;
}

const FSMBottomNav = ({ activeTab, onTabChange, isManager }: FSMBottomNavProps) => {
  const baseItems = [
    { id: "dashboard", label: "Панель", icon: LayoutDashboard },
    { id: "tasks", label: "Задачи", icon: ClipboardList },
    { id: "requests", label: "Заявки", icon: FileText },
    { id: "products", label: "Товары", icon: Package },
  ];

  const managerItems = [
    { id: "employees", label: "Кадры", icon: Users },
    { id: "clients", label: "Клиенты", icon: Building2 },
    { id: "map", label: "Карта", icon: MapPin },
    { id: "reports", label: "Отчеты", icon: BarChart3 },
  ];

  const items = isManager ? [...baseItems, ...managerItems] : baseItems;

  // Show max 5 items on mobile, scroll for more
  const visibleItems = items.slice(0, 5);
  const hasMore = items.length > 5;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-background/95 backdrop-blur-lg border-t border-border shadow-lg">
      <div className="flex justify-around items-center h-16 px-1 overflow-x-auto">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={cn(
                "flex flex-col items-center justify-center min-w-[60px] py-2 px-2 rounded-lg transition-all",
                isActive 
                  ? "text-primary bg-primary/10" 
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              <Icon className={cn("h-5 w-5 mb-1", isActive && "scale-110")} />
              <span className="text-[10px] font-medium leading-none">{item.label}</span>
            </button>
          );
        })}
        
        {hasMore && (
          <div className="flex gap-1 overflow-x-auto">
            {items.slice(5).map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              
              return (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  className={cn(
                    "flex flex-col items-center justify-center min-w-[60px] py-2 px-2 rounded-lg transition-all",
                    isActive 
                      ? "text-primary bg-primary/10" 
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  )}
                >
                  <Icon className={cn("h-5 w-5 mb-1", isActive && "scale-110")} />
                  <span className="text-[10px] font-medium leading-none">{item.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </nav>
  );
};

export default FSMBottomNav;
