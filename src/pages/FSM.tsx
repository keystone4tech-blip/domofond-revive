import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Home
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import FSMDashboard from "@/components/fsm/FSMDashboard";
import EmployeesManager from "@/components/fsm/EmployeesManager";
import TasksManager from "@/components/fsm/TasksManager";
import ClientsManager from "@/components/fsm/ClientsManager";
import LocationMap from "@/components/fsm/LocationMap";
import FSMReports from "@/components/fsm/FSMReports";
import RequestsManager from "@/components/fsm/RequestsManager";
import ProductsManager from "@/components/fsm/ProductsManager";
import FSMBottomNav from "@/components/fsm/FSMBottomNav";
import { ThemeToggle } from "@/components/ThemeToggle";

const FSM = () => {
  const [isVisible, setIsVisible] = useState({
    header: false,
    content: false
  });
  const [activeTab, setActiveTab] = useState("dashboard");

  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, isFSMUser, isManager, isLoading, roles } = useUserRole();

  useEffect(() => {
    if (!isLoading && user && isFSMUser) {
      setTimeout(() => setIsVisible(prev => ({ ...prev, header: true })), 300);
      setTimeout(() => setIsVisible(prev => ({ ...prev, content: true })), 600);
    }
  }, [isLoading, user, isFSMUser]);

  useEffect(() => {
    console.log("FSM page check - isLoading:", isLoading, "user:", !!user, "isFSMUser:", isFSMUser, "roles:", roles);
    
    if (!isLoading) {
      if (!user) {
        toast({
          title: "Требуется авторизация",
          description: "Войдите в систему для доступа к панели управления",
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

  return (
    <div className="min-h-screen flex flex-col bg-background pb-20 lg:pb-0">
      {/* Minimal Header for FSM */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-lg border-b border-border">
        <div className="container flex items-center justify-between h-14 px-4">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
              <Home className="h-5 w-5" />
              <span className="hidden sm:inline text-sm">На сайт</span>
            </Link>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground hidden sm:inline">{getRoleLabel()}</span>
            <ThemeToggle />
          </div>
        </div>
      </header>
      
      <main className="flex-1 container px-4 py-4">
        <div
          className={`mb-4 ${
            isVisible.header ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-10'
          } transition-all duration-500 ease-out`}
        >
          <h1 className="text-xl md:text-2xl font-bold text-foreground flex items-center gap-2">
            <LayoutDashboard className="h-6 w-6 text-primary" />
            FSM Система
          </h1>
          <p className="text-sm text-muted-foreground">
            Управление заявками и сотрудниками • {getRoleLabel()}
          </p>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className={`space-y-4 ${
            isVisible.content ? 'opacity-100' : 'opacity-0'
          } transition-opacity duration-500`}
        >
          {/* Desktop Tabs - hidden on mobile */}
          <TabsList className="hidden lg:flex flex-wrap h-auto gap-1 bg-muted/50 p-1">
            <TabsTrigger value="dashboard" className="flex items-center gap-2">
              <LayoutDashboard className="h-4 w-4" />
              Панель
            </TabsTrigger>
            <TabsTrigger value="tasks" className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4" />
              Задачи
            </TabsTrigger>
            <TabsTrigger value="requests" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Заявки
            </TabsTrigger>
            <TabsTrigger value="products" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Товары
            </TabsTrigger>
            {isManager && (
              <>
                <TabsTrigger value="employees" className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Сотрудники
                </TabsTrigger>
                <TabsTrigger value="clients" className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Клиенты
                </TabsTrigger>
                <TabsTrigger value="map" className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Карта
                </TabsTrigger>
                <TabsTrigger value="reports" className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Отчеты
                </TabsTrigger>
              </>
            )}
          </TabsList>

          <TabsContent value="dashboard" className="mt-0">
            <FSMDashboard isManager={isManager} />
          </TabsContent>

          <TabsContent value="tasks" className="mt-0">
            <TasksManager isManager={isManager} />
          </TabsContent>

          <TabsContent value="requests" className="mt-0">
            <RequestsManager />
          </TabsContent>

          <TabsContent value="products" className="mt-0">
            <ProductsManager />
          </TabsContent>

          {isManager && (
            <>
              <TabsContent value="employees" className="mt-0">
                <EmployeesManager />
              </TabsContent>

              <TabsContent value="clients" className="mt-0">
                <ClientsManager />
              </TabsContent>

              <TabsContent value="map" className="mt-0">
                <LocationMap />
              </TabsContent>

              <TabsContent value="reports" className="mt-0">
                <FSMReports />
              </TabsContent>
            </>
          )}
        </Tabs>
      </main>

      {/* FSM-specific Bottom Navigation for mobile */}
      <FSMBottomNav 
        activeTab={activeTab} 
        onTabChange={setActiveTab} 
        isManager={isManager} 
      />
    </div>
  );
};

export default FSM;
