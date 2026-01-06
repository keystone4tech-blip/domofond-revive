import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  ClipboardList, 
  CheckCircle2, 
  Clock, 
  AlertTriangle,
  Users,
  Building2
} from "lucide-react";

interface FSMDashboardProps {
  isManager: boolean;
}

const FSMDashboard = ({ isManager }: FSMDashboardProps) => {
  const { data: stats } = useQuery({
    queryKey: ["fsm-stats"],
    queryFn: async () => {
      const [tasksRes, employeesRes, clientsRes] = await Promise.all([
        supabase.from("tasks").select("status"),
        isManager ? supabase.from("employees").select("id, is_active") : Promise.resolve({ data: [] }),
        isManager ? supabase.from("clients").select("id") : Promise.resolve({ data: [] }),
      ]);

      const tasks = tasksRes.data || [];
      const employees = employeesRes.data || [];
      const clients = clientsRes.data || [];

      return {
        totalTasks: tasks.length,
        pendingTasks: tasks.filter((t) => t.status === "pending" || t.status === "assigned").length,
        inProgressTasks: tasks.filter((t) => t.status === "in_progress").length,
        completedTasks: tasks.filter((t) => t.status === "completed").length,
        activeEmployees: employees.filter((e) => e.is_active).length,
        totalClients: clients.length,
      };
    },
  });

  const statCards = [
    {
      title: "Всего задач",
      value: stats?.totalTasks || 0,
      icon: ClipboardList,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      title: "Ожидают",
      value: stats?.pendingTasks || 0,
      icon: Clock,
      color: "text-yellow-600",
      bgColor: "bg-yellow-100 dark:bg-yellow-900/30",
    },
    {
      title: "В работе",
      value: stats?.inProgressTasks || 0,
      icon: AlertTriangle,
      color: "text-orange-600",
      bgColor: "bg-orange-100 dark:bg-orange-900/30",
    },
    {
      title: "Выполнено",
      value: stats?.completedTasks || 0,
      icon: CheckCircle2,
      color: "text-green-600",
      bgColor: "bg-green-100 dark:bg-green-900/30",
    },
  ];

  if (isManager) {
    statCards.push(
      {
        title: "Сотрудников",
        value: stats?.activeEmployees || 0,
        icon: Users,
        color: "text-blue-600",
        bgColor: "bg-blue-100 dark:bg-blue-900/30",
      },
      {
        title: "Клиентов",
        value: stats?.totalClients || 0,
        icon: Building2,
        color: "text-purple-600",
        bgColor: "bg-purple-100 dark:bg-purple-900/30",
      }
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.title} className="border-border/50">
            <CardHeader className="pb-2">
              <div className={`w-10 h-10 rounded-lg ${stat.bgColor} flex items-center justify-center`}>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-foreground">{stat.value}</p>
              <p className="text-sm text-muted-foreground">{stat.title}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-lg">Последние задачи</CardTitle>
          </CardHeader>
          <CardContent>
            <RecentTasks />
          </CardContent>
        </Card>

        {isManager && (
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-lg">Активность сотрудников</CardTitle>
            </CardHeader>
            <CardContent>
              <EmployeeActivity />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

const RecentTasks = () => {
  const { data: tasks } = useQuery({
    queryKey: ["recent-tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select(`
          id,
          title,
          status,
          priority,
          scheduled_date,
          clients (name)
        `)
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) throw error;
      return data;
    },
  });

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
      assigned: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
      in_progress: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
      completed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
      cancelled: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
    };
    const labels: Record<string, string> = {
      pending: "Ожидает",
      assigned: "Назначена",
      in_progress: "В работе",
      completed: "Выполнена",
      cancelled: "Отменена",
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status]}`}>
        {labels[status]}
      </span>
    );
  };

  if (!tasks?.length) {
    return <p className="text-muted-foreground text-sm">Нет задач</p>;
  }

  return (
    <div className="space-y-3">
      {tasks.map((task) => (
        <div key={task.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
          <div>
            <p className="font-medium text-foreground">{task.title}</p>
            <p className="text-sm text-muted-foreground">
              {(task.clients as { name: string } | null)?.name || "Без клиента"}
            </p>
          </div>
          {getStatusBadge(task.status)}
        </div>
      ))}
    </div>
  );
};

const EmployeeActivity = () => {
  const { data: employees } = useQuery({
    queryKey: ["employee-activity"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, full_name, position, is_active, current_location")
        .eq("is_active", true)
        .limit(5);

      if (error) throw error;
      return data;
    },
  });

  if (!employees?.length) {
    return <p className="text-muted-foreground text-sm">Нет активных сотрудников</p>;
  }

  return (
    <div className="space-y-3">
      {employees.map((emp) => (
        <div key={emp.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-sm font-medium text-primary">
                {emp.full_name.charAt(0)}
              </span>
            </div>
            <div>
              <p className="font-medium text-foreground">{emp.full_name}</p>
              <p className="text-sm text-muted-foreground">{emp.position || "Сотрудник"}</p>
            </div>
          </div>
          <div className={`w-2 h-2 rounded-full ${emp.current_location ? "bg-green-500" : "bg-gray-400"}`} />
        </div>
      ))}
    </div>
  );
};

export default FSMDashboard;
