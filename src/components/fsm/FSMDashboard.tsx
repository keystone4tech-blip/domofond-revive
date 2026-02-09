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
  FileText,
  Banknote,
  HandMetal,
  XCircle
} from "lucide-react";
import { format } from "date-fns";

interface FSMDashboardProps {
  isManager: boolean;
  onNavigate?: (tab: string, filter?: string) => void;
}

type DetailType = "totalTasks" | "pendingTasks" | "inProgressTasks" | "completedTasks" | 
                  "totalRequests" | "pendingRequests" | "inProgressRequests" | "completedRequests" | "cancelledRequests" |
                  "employees" | "clients" | "masters" | "finance" | null;

const FSMDashboard = ({ isManager, onNavigate }: FSMDashboardProps) => {
  const [detailType, setDetailType] = useState<DetailType>(null);

  const { data: stats } = useQuery({
    queryKey: ["fsm-dashboard-stats"],
    queryFn: async () => {
      const [tasksRes, requestsRes, employeesRes, clientsRes] = await Promise.all([
        supabase.from("tasks").select("status"),
        supabase.from("requests").select("status"),
        isManager ? supabase.from("employees").select("id, is_active") : Promise.resolve({ data: [] }),
        isManager ? supabase.from("clients").select("id") : Promise.resolve({ data: [] }),
      ]);

      const tasks = tasksRes.data || [];
      const requests = requestsRes.data || [];
      const employees = employeesRes.data || [];
      const clients = clientsRes.data || [];

      return {
        // Tasks stats
        totalTasks: tasks.length,
        pendingTasks: tasks.filter((t) => t.status === "pending" || t.status === "assigned").length,
        inProgressTasks: tasks.filter((t) => t.status === "in_progress").length,
        completedTasks: tasks.filter((t) => t.status === "completed").length,
        cancelledTasks: tasks.filter((t) => t.status === "cancelled").length,
        // Requests stats
        totalRequests: requests.length,
        pendingRequests: requests.filter((r) => r.status === "pending").length,
        inProgressRequests: requests.filter((r) => r.status === "in_progress").length,
        completedRequests: requests.filter((r) => r.status === "completed").length,
        cancelledRequests: requests.filter((r) => r.status === "cancelled").length,
        // Other stats
        activeEmployees: employees.filter((e) => e.is_active).length,
        totalClients: clients.length,
      };
    },
  });

  const handleCardClick = (id: DetailType, navigateTo?: { tab: string; filter?: string }) => {
    if (navigateTo && onNavigate) {
      onNavigate(navigateTo.tab, navigateTo.filter);
    } else {
      setDetailType(id);
    }
  };

  const taskCards = [
    {
      id: "totalTasks" as DetailType,
      title: "Всего задач",
      value: stats?.totalTasks || 0,
      icon: ClipboardList,
      color: "text-primary",
      bgColor: "bg-primary/10",
      navigateTo: { tab: "tasks", filter: "pending" },
    },
    {
      id: "pendingTasks" as DetailType,
      title: "Ожидают",
      value: stats?.pendingTasks || 0,
      icon: Clock,
      color: "text-yellow-600",
      bgColor: "bg-yellow-100 dark:bg-yellow-900/30",
      navigateTo: { tab: "tasks", filter: "pending" },
    },
    {
      id: "inProgressTasks" as DetailType,
      title: "В работе",
      value: stats?.inProgressTasks || 0,
      icon: AlertTriangle,
      color: "text-orange-600",
      bgColor: "bg-orange-100 dark:bg-orange-900/30",
      navigateTo: { tab: "tasks", filter: "in_progress" },
    },
    {
      id: "completedTasks" as DetailType,
      title: "Выполнено",
      value: stats?.completedTasks || 0,
      icon: CheckCircle2,
      color: "text-green-600",
      bgColor: "bg-green-100 dark:bg-green-900/30",
      navigateTo: { tab: "tasks", filter: "completed" },
    },
  ];

  const requestCards = [
    {
      id: "totalRequests" as DetailType,
      title: "Всего заявок",
      value: stats?.totalRequests || 0,
      icon: FileText,
      color: "text-blue-600",
      bgColor: "bg-blue-100 dark:bg-blue-900/30",
      navigateTo: { tab: "requests", filter: "pending" },
    },
    {
      id: "pendingRequests" as DetailType,
      title: "Новые",
      value: stats?.pendingRequests || 0,
      icon: Clock,
      color: "text-yellow-600",
      bgColor: "bg-yellow-100 dark:bg-yellow-900/30",
      navigateTo: { tab: "requests", filter: "pending" },
    },
    {
      id: "inProgressRequests" as DetailType,
      title: "В работе",
      value: stats?.inProgressRequests || 0,
      icon: AlertTriangle,
      color: "text-blue-600",
      bgColor: "bg-blue-100 dark:bg-blue-900/30",
      navigateTo: { tab: "requests", filter: "in_progress" },
    },
    {
      id: "completedRequests" as DetailType,
      title: "Выполнено",
      value: stats?.completedRequests || 0,
      icon: CheckCircle2,
      color: "text-green-600",
      bgColor: "bg-green-100 dark:bg-green-900/30",
      navigateTo: { tab: "requests", filter: "completed" },
    },
    {
      id: "cancelledRequests" as DetailType,
      title: "Отменено",
      value: stats?.cancelledRequests || 0,
      icon: XCircle,
      color: "text-muted-foreground",
      bgColor: "bg-muted",
      navigateTo: { tab: "requests", filter: "cancelled" },
    },
  ];

  const actionCards: typeof taskCards = isManager ? [
    {
      id: "masters" as DetailType,
      title: "По мастерам",
      value: stats?.activeEmployees || 0,
      icon: HandMetal,
      color: "text-purple-600",
      bgColor: "bg-purple-100 dark:bg-purple-900/30",
      navigateTo: { tab: "requests", filter: "masters" },
    },
    {
      id: "finance" as DetailType,
      title: "Финансы",
      value: 0,
      icon: Banknote,
      color: "text-emerald-600",
      bgColor: "bg-emerald-100 dark:bg-emerald-900/30",
      navigateTo: { tab: "requests", filter: "reports" },
    },
    {
      id: "employees" as DetailType,
      title: "Сотрудники",
      value: stats?.activeEmployees || 0,
      icon: Users,
      color: "text-blue-600",
      bgColor: "bg-blue-100 dark:bg-blue-900/30",
      navigateTo: { tab: "employees", filter: "" },
    },
    {
      id: "clients" as DetailType,
      title: "Клиенты",
      value: stats?.totalClients || 0,
      icon: Building2,
      color: "text-purple-600",
      bgColor: "bg-purple-100 dark:bg-purple-900/30",
      navigateTo: { tab: "clients", filter: "" },
    },
  ] : [];

  const getDialogTitle = (type: DetailType) => {
    switch (type) {
      case "totalTasks": return "Все задачи";
      case "pendingTasks": return "Ожидающие задачи";
      case "inProgressTasks": return "Задачи в работе";
      case "completedTasks": return "Выполненные задачи";
      case "totalRequests": return "Все заявки";
      case "pendingRequests": return "Новые заявки";
      case "inProgressRequests": return "Заявки в работе";
      case "completedRequests": return "Выполненные заявки";
      case "cancelledRequests": return "Отмененные заявки";
      case "employees": return "Сотрудники";
      case "clients": return "Клиенты";
      default: return "";
    }
  };

  const StatCard = ({ stat }: { stat: typeof taskCards[0] }) => (
    <Card 
      className="border-border/50 cursor-pointer hover:shadow-md hover:border-primary/30 transition-all active:scale-95"
      onClick={() => handleCardClick(stat.id, stat.navigateTo)}
    >
      <CardContent className="p-3">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg ${stat.bgColor} flex items-center justify-center flex-shrink-0`}>
            <stat.icon className={`h-5 w-5 ${stat.color}`} />
          </div>
          <div className="min-w-0">
            <p className="text-xl font-bold text-foreground">{stat.value}</p>
            <p className="text-xs text-muted-foreground truncate">{stat.title}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      {/* Tasks Section */}
      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
          <ClipboardList className="h-4 w-4" />
          Задачи
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {taskCards.map((stat) => (
            <StatCard key={stat.id} stat={stat} />
          ))}
        </div>
      </div>

      {/* Requests Section */}
      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Заявки
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {requestCards.map((stat) => (
            <StatCard key={stat.id} stat={stat} />
          ))}
        </div>
      </div>

      {/* Action Cards for Managers */}
      {isManager && (
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
            <Users className="h-4 w-4" />
            Управление
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {actionCards.map((stat) => (
              <StatCard key={stat.id} stat={stat} />
            ))}
          </div>
        </div>
      )}

      {/* Recent Activity */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Последние задачи</CardTitle>
          </CardHeader>
          <CardContent>
            <RecentTasks />
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Последние заявки</CardTitle>
          </CardHeader>
          <CardContent>
            <RecentRequests />
          </CardContent>
        </Card>
      </div>

      {/* Detail Dialog */}
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

// Detail Content Component
const DetailContent = ({ type }: { type: DetailType }) => {
  if (!type) return null;
  if (type === "employees") return <EmployeesList />;
  if (type === "clients") return <ClientsList />;
  if (type.includes("Tasks")) return <TasksList type={type as any} />;
  if (type.includes("Requests")) return <RequestsList type={type as any} />;
  return null;
};

// Tasks List
const TasksList = ({ type }: { type: "totalTasks" | "pendingTasks" | "inProgressTasks" | "completedTasks" }) => {
  const { data: tasks, isLoading } = useQuery({
    queryKey: ["detail-tasks", type],
    queryFn: async () => {
      let query = supabase
        .from("tasks")
        .select(`id, title, status, priority, scheduled_date, created_at, notes,
          clients (name), assigned_employee:employees!tasks_assigned_to_fkey (full_name)`)
        .order("created_at", { ascending: false });

      if (type === "pendingTasks") query = query.in("status", ["pending", "assigned"]);
      else if (type === "inProgressTasks") query = query.eq("status", "in_progress");
      else if (type === "completedTasks") query = query.eq("status", "completed");

      const { data, error } = await query.limit(50);
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!tasks?.length) return <p className="text-center text-muted-foreground py-8">Нет задач</p>;

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
            <TableCell>{(task.clients as any)?.name || "—"}</TableCell>
            <TableCell>{(task.assigned_employee as any)?.full_name || "—"}</TableCell>
            <TableCell><StatusBadge status={task.status} /></TableCell>
            <TableCell>{format(new Date(task.scheduled_date || task.created_at), "dd.MM.yyyy")}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};

// Requests List
const RequestsList = ({ type }: { type: "totalRequests" | "pendingRequests" | "inProgressRequests" | "completedRequests" | "cancelledRequests" }) => {
  const { data: requests, isLoading } = useQuery({
    queryKey: ["detail-requests", type],
    queryFn: async () => {
      let query = supabase
        .from("requests")
        .select(`id, name, phone, address, message, status, created_at, notes,
          assigned_employee:employees!requests_assigned_to_fkey (full_name)`)
        .order("created_at", { ascending: false });

      if (type === "pendingRequests") query = query.eq("status", "pending");
      else if (type === "inProgressRequests") query = query.eq("status", "in_progress");
      else if (type === "completedRequests") query = query.eq("status", "completed");
      else if (type === "cancelledRequests") query = query.eq("status", "cancelled");

      const { data, error } = await query.limit(50);
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!requests?.length) return <p className="text-center text-muted-foreground py-8">Нет заявок</p>;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Клиент</TableHead>
          <TableHead>Адрес</TableHead>
          <TableHead>Исполнитель</TableHead>
          <TableHead>Статус</TableHead>
          <TableHead>Дата</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {requests.map((req) => (
          <TableRow key={req.id}>
            <TableCell className="font-medium">{req.name}</TableCell>
            <TableCell className="max-w-[200px] truncate">{req.address}</TableCell>
            <TableCell>{(req.assigned_employee as any)?.full_name || "—"}</TableCell>
            <TableCell><StatusBadge status={req.status} /></TableCell>
            <TableCell>{format(new Date(req.created_at), "dd.MM.yyyy")}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};

// Status Badge Component
const StatusBadge = ({ status }: { status: string }) => {
  const styles: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800",
    assigned: "bg-blue-100 text-blue-800",
    in_progress: "bg-orange-100 text-orange-800",
    completed: "bg-green-100 text-green-800",
    cancelled: "bg-gray-100 text-gray-800",
  };
  const labels: Record<string, string> = {
    pending: "Ожидает",
    assigned: "Назначена",
    in_progress: "В работе",
    completed: "Выполнена",
    cancelled: "Отменена",
  };
  return <Badge className={styles[status]}>{labels[status]}</Badge>;
};

// Employees List
const EmployeesList = () => {
  const { data: employees, isLoading } = useQuery({
    queryKey: ["detail-employees"],
    queryFn: async () => {
      const { data, error } = await supabase.from("employees").select("*").order("full_name");
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!employees?.length) return <p className="text-center text-muted-foreground py-8">Нет сотрудников</p>;

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

// Clients List
const ClientsList = () => {
  const { data: clients, isLoading } = useQuery({
    queryKey: ["detail-clients"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!clients?.length) return <p className="text-center text-muted-foreground py-8">Нет клиентов</p>;

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

// Recent Tasks Component
const RecentTasks = () => {
  const { data: tasks } = useQuery({
    queryKey: ["recent-tasks-dashboard"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select(`id, title, status, notes, clients (name)`)
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
  });

  if (!tasks?.length) return <p className="text-muted-foreground text-sm">Нет задач</p>;

  return (
    <div className="space-y-2">
      {tasks.map((task) => (
        <div key={task.id} className="flex items-start justify-between p-2 rounded-lg bg-muted/50 gap-2">
          <div className="min-w-0 flex-1">
            <p className="font-medium text-foreground text-sm truncate">{task.title}</p>
            <p className="text-xs text-muted-foreground truncate">
              {(task.clients as any)?.name || "Без клиента"}
            </p>
            {task.status === "completed" && task.notes && (
              <p className="text-xs text-green-600 mt-1 line-clamp-1">✓ {task.notes}</p>
            )}
            {task.status === "cancelled" && task.notes && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-1">✕ {task.notes}</p>
            )}
          </div>
          <MiniStatusBadge status={task.status} />
        </div>
      ))}
    </div>
  );
};

// Recent Requests Component
const RecentRequests = () => {
  const { data: requests } = useQuery({
    queryKey: ["recent-requests-dashboard"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("requests")
        .select(`id, name, address, status, notes`)
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
  });

  if (!requests?.length) return <p className="text-muted-foreground text-sm">Нет заявок</p>;

  return (
    <div className="space-y-2">
      {requests.map((req) => (
        <div key={req.id} className="flex items-start justify-between p-2 rounded-lg bg-muted/50 gap-2">
          <div className="min-w-0 flex-1">
            <p className="font-medium text-foreground text-sm truncate">{req.name}</p>
            <p className="text-xs text-muted-foreground truncate">{req.address}</p>
            {req.status === "completed" && req.notes && (
              <p className="text-xs text-green-600 mt-1 line-clamp-1">✓ {req.notes}</p>
            )}
            {req.status === "cancelled" && req.notes && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-1">✕ {req.notes}</p>
            )}
          </div>
          <MiniStatusBadge status={req.status} />
        </div>
      ))}
    </div>
  );
};

// Mini Status Badge
const MiniStatusBadge = ({ status }: { status: string }) => {
  const styles: Record<string, string> = {
    pending: "bg-yellow-500/20 text-yellow-600",
    assigned: "bg-blue-500/20 text-blue-600",
    in_progress: "bg-orange-500/20 text-orange-600",
    completed: "bg-green-500/20 text-green-600",
    cancelled: "bg-muted-foreground/20 text-muted-foreground",
  };
  const labels: Record<string, string> = {
    pending: "Ждёт",
    assigned: "Назн.",
    in_progress: "В работе",
    completed: "Готово",
    cancelled: "Отмена",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap ${styles[status]}`}>
      {labels[status]}
    </span>
  );
};

export default FSMDashboard;
