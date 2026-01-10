import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { 
  ClipboardList, 
  CheckCircle2, 
  Clock, 
  AlertTriangle,
  Users,
  Building2,
  Loader2,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

interface FSMDashboardProps {
  isManager: boolean;
}

type DetailType = "totalTasks" | "pendingTasks" | "inProgressTasks" | "completedTasks" | "employees" | "clients" | null;

const FSMDashboard = ({ isManager }: FSMDashboardProps) => {
  const [detailType, setDetailType] = useState<DetailType>(null);

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
      id: "totalTasks" as DetailType,
      title: "Всего задач",
      value: stats?.totalTasks || 0,
      icon: ClipboardList,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      id: "pendingTasks" as DetailType,
      title: "Ожидают",
      value: stats?.pendingTasks || 0,
      icon: Clock,
      color: "text-yellow-600",
      bgColor: "bg-yellow-100 dark:bg-yellow-900/30",
    },
    {
      id: "inProgressTasks" as DetailType,
      title: "В работе",
      value: stats?.inProgressTasks || 0,
      icon: AlertTriangle,
      color: "text-orange-600",
      bgColor: "bg-orange-100 dark:bg-orange-900/30",
    },
    {
      id: "completedTasks" as DetailType,
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
        id: "employees" as DetailType,
        title: "Сотрудников",
        value: stats?.activeEmployees || 0,
        icon: Users,
        color: "text-blue-600",
        bgColor: "bg-blue-100 dark:bg-blue-900/30",
      },
      {
        id: "clients" as DetailType,
        title: "Клиентов",
        value: stats?.totalClients || 0,
        icon: Building2,
        color: "text-purple-600",
        bgColor: "bg-purple-100 dark:bg-purple-900/30",
      }
    );
  }

  const getDialogTitle = (type: DetailType) => {
    switch (type) {
      case "totalTasks": return "Все задачи";
      case "pendingTasks": return "Ожидающие задачи";
      case "inProgressTasks": return "Задачи в работе";
      case "completedTasks": return "Выполненные задачи";
      case "employees": return "Сотрудники";
      case "clients": return "Клиенты";
      default: return "";
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {statCards.map((stat) => (
          <Card 
            key={stat.title} 
            className="border-border/50 cursor-pointer hover:shadow-md hover:border-primary/30 transition-all"
            onClick={() => setDetailType(stat.id)}
          >
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

      {/* Модальное окно с детальной информацией */}
      <Dialog open={!!detailType} onOpenChange={() => setDetailType(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>{getDialogTitle(detailType)}</DialogTitle>
          </DialogHeader>
          <DetailContent type={detailType} />
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Компонент для отображения детальной информации
const DetailContent = ({ type }: { type: DetailType }) => {
  if (!type) return null;

  if (type === "employees") return <EmployeesList />;
  if (type === "clients") return <ClientsList />;
  
  return <TasksList type={type} />;
};

// Список задач по статусу
const TasksList = ({ type }: { type: "totalTasks" | "pendingTasks" | "inProgressTasks" | "completedTasks" }) => {
  const { data: tasks, isLoading } = useQuery({
    queryKey: ["detail-tasks", type],
    queryFn: async () => {
      let query = supabase
        .from("tasks")
        .select(`
          id,
          title,
          status,
          priority,
          scheduled_date,
          created_at,
          clients (name),
          assigned_employee:employees!tasks_assigned_to_fkey (full_name)
        `)
        .order("created_at", { ascending: false });

      if (type === "pendingTasks") {
        query = query.in("status", ["pending", "assigned"]);
      } else if (type === "inProgressTasks") {
        query = query.eq("status", "in_progress");
      } else if (type === "completedTasks") {
        query = query.eq("status", "completed");
      }

      const { data, error } = await query.limit(50);
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  if (!tasks?.length) {
    return <p className="text-center text-muted-foreground py-8">Нет задач</p>;
  }

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: "bg-yellow-100 text-yellow-800",
      assigned: "bg-blue-100 text-blue-800",
      in_progress: "bg-orange-100 text-orange-800",
      completed: "bg-green-100 text-green-800",
    };
    const labels: Record<string, string> = {
      pending: "Ожидает",
      assigned: "Назначена",
      in_progress: "В работе",
      completed: "Выполнена",
    };
    return <Badge className={styles[status]}>{labels[status]}</Badge>;
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Название</TableHead>
          <TableHead>Клиент</TableHead>
          <TableHead>Исполнитель</TableHead>
          <TableHead>Статус</TableHead>
          <TableHead>Дата</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tasks.map((task) => (
          <TableRow key={task.id}>
            <TableCell className="font-medium">{task.title}</TableCell>
            <TableCell>{(task.clients as { name: string } | null)?.name || "—"}</TableCell>
            <TableCell>{(task.assigned_employee as { full_name: string } | null)?.full_name || "—"}</TableCell>
            <TableCell>{getStatusBadge(task.status)}</TableCell>
            <TableCell>
              {task.scheduled_date 
                ? format(new Date(task.scheduled_date), "dd.MM.yyyy")
                : format(new Date(task.created_at), "dd.MM.yyyy")}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};

// Список сотрудников
const EmployeesList = () => {
  const { data: employees, isLoading } = useQuery({
    queryKey: ["detail-employees"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("*")
        .order("full_name");
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  if (!employees?.length) {
    return <p className="text-center text-muted-foreground py-8">Нет сотрудников</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>ФИО</TableHead>
          <TableHead>Телефон</TableHead>
          <TableHead>Должность</TableHead>
          <TableHead>Статус</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {employees.map((emp) => (
          <TableRow key={emp.id}>
            <TableCell className="font-medium">{emp.full_name}</TableCell>
            <TableCell>{emp.phone || "—"}</TableCell>
            <TableCell>{emp.position || "—"}</TableCell>
            <TableCell>
              <Badge variant={emp.is_active ? "default" : "secondary"}>
                {emp.is_active ? "Активен" : "Неактивен"}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};

// Список клиентов
const ClientsList = () => {
  const { data: clients, isLoading } = useQuery({
    queryKey: ["detail-clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  if (!clients?.length) {
    return <p className="text-center text-muted-foreground py-8">Нет клиентов</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Название</TableHead>
          <TableHead>Адрес</TableHead>
          <TableHead>Контактное лицо</TableHead>
          <TableHead>Телефон</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {clients.map((client) => (
          <TableRow key={client.id}>
            <TableCell className="font-medium">{client.name}</TableCell>
            <TableCell>{client.address}</TableCell>
            <TableCell>{client.contact_person || "—"}</TableCell>
            <TableCell>{client.phone || "—"}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
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
