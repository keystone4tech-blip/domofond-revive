import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";
import { useToast } from "@/hooks/use-toast";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  LayoutDashboard, 
  Users, 
  ClipboardList, 
  MapPin, 
  Building2,
  BarChart3,
  Loader2
} from "lucide-react";
import FSMDashboard from "@/components/fsm/FSMDashboard";
import EmployeesManager from "@/components/fsm/EmployeesManager";
import TasksManager from "@/components/fsm/TasksManager";
import ClientsManager from "@/components/fsm/ClientsManager";
import LocationMap from "@/components/fsm/LocationMap";
import FSMReports from "@/components/fsm/FSMReports";

const FSM = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, isFSMUser, isManager, isLoading, roles } = useUserRole();

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
        // Только если роли загружены, но FSM роли нет
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
    if (roles.includes("dispatcher")) return "Диспетчер";
    if (roles.includes("master")) return "Мастер";
    if (roles.includes("engineer")) return "Инженер";
    return "Сотрудник";
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      
      <main className="flex-1 container px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-3">
            <LayoutDashboard className="h-7 w-7 text-primary" />
            FSM Система
          </h1>
          <p className="text-muted-foreground mt-1">
            Управление полевыми сотрудниками • {getRoleLabel()}
          </p>
        </div>

        <Tabs defaultValue="dashboard" className="space-y-6">
          <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/50 p-1">
            <TabsTrigger value="dashboard" className="flex items-center gap-2">
              <LayoutDashboard className="h-4 w-4" />
              <span className="hidden sm:inline">Панель</span>
            </TabsTrigger>
            <TabsTrigger value="tasks" className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4" />
              <span className="hidden sm:inline">Задачи</span>
            </TabsTrigger>
            {isManager && (
              <>
                <TabsTrigger value="employees" className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  <span className="hidden sm:inline">Сотрудники</span>
                </TabsTrigger>
                <TabsTrigger value="clients" className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  <span className="hidden sm:inline">Клиенты</span>
                </TabsTrigger>
                <TabsTrigger value="map" className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  <span className="hidden sm:inline">Карта</span>
                </TabsTrigger>
                <TabsTrigger value="reports" className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  <span className="hidden sm:inline">Отчеты</span>
                </TabsTrigger>
              </>
            )}
          </TabsList>

          <TabsContent value="dashboard">
            <FSMDashboard isManager={isManager} />
          </TabsContent>

          <TabsContent value="tasks">
            <TasksManager isManager={isManager} />
          </TabsContent>

          {isManager && (
            <>
              <TabsContent value="employees">
                <EmployeesManager />
              </TabsContent>

              <TabsContent value="clients">
                <ClientsManager />
              </TabsContent>

              <TabsContent value="map">
                <LocationMap />
              </TabsContent>

              <TabsContent value="reports">
                <FSMReports />
              </TabsContent>
            </>
          )}
        </Tabs>
      </main>

      <Footer />
    </div>
  );
};

export default FSM;
