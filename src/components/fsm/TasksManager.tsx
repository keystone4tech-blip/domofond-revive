import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, Loader2, CheckCircle2, Play, Eye, HandMetal, CircleDashed } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import TaskDetails from "./TaskDetails";

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  scheduled_date: string | null;
  scheduled_time_start: string | null;
  scheduled_time_end: string | null;
  client_id: string | null;
  assigned_to: string | null;
  accepted_by: string | null;
  accepted_at: string | null;
  completed_at: string | null;
  created_at: string;
  notes: string | null;
  clients: { id: string; name: string; address: string } | null;
  assigned_employee: { id: string; full_name: string; phone: string | null } | null;
  accepted_employee: { id: string; full_name: string; phone: string | null } | null;
}

interface TasksManagerProps {
  isManager: boolean;
  initialFilter?: string;
  initialTaskId?: string;
  onClearInitialTaskId?: () => void;
}

const TasksManager = ({ 
  isManager, 
  initialFilter = "all",
  initialTaskId,
  onClearInitialTaskId
}: TasksManagerProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>(initialFilter);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    client_id: "",
    assigned_to: "",
    priority: "medium",
    scheduled_date: "",
  });
  
  // Update filter when initialFilter changes
  useEffect(() => {
    if (initialFilter && initialFilter !== "all") {
      setStatusFilter(initialFilter);
    }
  }, [initialFilter]);
  const { data: tasks, isLoading } = useQuery({
    queryKey: ["tasks", statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("tasks")
        .select(`
          *,
          clients (id, name, address),
          assigned_employee:employees!tasks_assigned_to_fkey (id, full_name, phone),
          accepted_employee:employees!tasks_accepted_by_fkey (id, full_name, phone)
        `)
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Task[];
    },
  });

  const { data: employees } = useQuery({
    queryKey: ["employees-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, full_name, phone")
        .eq("is_active", true);
      if (error) throw error;
      return data;
    },
    enabled: isManager,
  });

  // Авто-открытие задачи по ID
  useEffect(() => {
    if (initialTaskId && tasks) {
      const found = tasks.find(t => t.id === initialTaskId);
      if (found) {
        console.log(`[TasksManager] Авто-открытие задачи по ID: ${initialTaskId}`);
        setSelectedTask(found);
      }
    }
  }, [initialTaskId, tasks]);


  const { data: clients } = useQuery({
    queryKey: ["clients-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, address");
      if (error) throw error;
      return data;
    },
    enabled: isManager,
  });

  // Polling вместо Supabase Realtime (PostgREST не поддерживает WebSocket)
  // Инвалидируем кэш заявок каждые 30 секунд для имитации реального времени
  useEffect(() => {
    const pollInterval = setInterval(() => {
      console.log("[Задачи] Polling: обновление списка задач..."); // Логирование
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    }, 30000);

    return () => { clearInterval(pollInterval); }; // Очистка при размонтировании
  }, [queryClient]);

  const createTaskMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { data: userData } = await supabase.auth.getUser();
      
      const { error } = await supabase.from("tasks").insert({
        title: data.title,
        description: data.description || null,
        client_id: data.client_id || null,
        assigned_to: data.assigned_to || null,
        assigned_by: userData.user?.id,
        priority: data.priority,
        scheduled_date: data.scheduled_date || null,
        status: data.assigned_to ? "assigned" : "pending",
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast({ title: "Задача создана" });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ id, ...data }: Partial<Task> & { id: string }) => {
      const { error } = await supabase
        .from("tasks")
        .update(data)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast({ title: "Задача обновлена" });
      setEditingTask(null);
      setIsDialogOpen(false);
    },
  });

  // Принять задачу - записываем полную информацию и время начала
  const acceptTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Не авторизован");

      const { data: employee } = await supabase
        .from("employees")
        .select("id, full_name, phone")
        .eq("user_id", userData.user.id)
        .maybeSingle();

      const now = new Date();
      const timeStart = now.toTimeString().slice(0, 5); // HH:mm

      // Формируем заметку с полной информацией о принявшем
      let acceptNote = `Принял: `;
      if (employee) {
        acceptNote += employee.full_name;
        if (employee.phone) acceptNote += `, тел: ${employee.phone}`;
      } else {
        // Для менеджера без записи в employees берем из профиля
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, phone")
          .eq("id", userData.user.id)
          .single();
        if (profile) {
          acceptNote += profile.full_name || "Менеджер";
          if (profile.phone) acceptNote += `, тел: ${profile.phone}`;
        }
      }
      acceptNote += ` • ${format(now, "dd.MM.yyyy HH:mm")}`;

      const { error } = await supabase
        .from("tasks")
        .update({
          status: "in_progress",
          accepted_by: employee?.id || null,
          accepted_at: now.toISOString(),
          scheduled_time_start: timeStart,
          notes: acceptNote,
        })
        .eq("id", taskId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast({ title: "Заявка принята в работу" });
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    },
  });

  // Завершение задачи - записываем время окончания
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const now = new Date();
      const update: { 
        status: string; 
        completed_at?: string | null;
        scheduled_time_end?: string | null;
      } = { status };
      
      if (status === "completed") {
        update.completed_at = now.toISOString();
        update.scheduled_time_end = now.toTimeString().slice(0, 5); // HH:mm
      } else {
        update.completed_at = null;
        update.scheduled_time_end = null;
      }
      
      const { error } = await supabase
        .from("tasks")
        .update(update)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast({ title: "Статус обновлен" });
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast({ title: "Задача удалена" });
    },
  });

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      client_id: "",
      assigned_to: "",
      priority: "medium",
      scheduled_date: "",
    });
    setEditingTask(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingTask) {
      updateTaskMutation.mutate({
        id: editingTask.id,
        title: formData.title,
        description: formData.description || null,
        client_id: formData.client_id || null,
        assigned_to: formData.assigned_to || null,
        priority: formData.priority,
        scheduled_date: formData.scheduled_date || null,
      });
    } else {
      createTaskMutation.mutate(formData);
    }
  };

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
      <Badge className={styles[status]} variant="secondary">
        {labels[status]}
      </Badge>
    );
  };

  const getPriorityBadge = (priority: string) => {
    const styles: Record<string, string> = {
      low: "bg-gray-100 text-gray-700",
      medium: "bg-blue-100 text-blue-700",
      high: "bg-orange-100 text-orange-700",
      urgent: "bg-red-100 text-red-700",
    };
    const labels: Record<string, string> = {
      low: "Низкий",
      medium: "Средний",
      high: "Высокий",
      urgent: "Срочно",
    };
    return (
      <Badge className={styles[priority]} variant="secondary">
        {labels[priority]}
      </Badge>
    );
  };

  if (selectedTask) {
    return (
      <TaskDetails
        task={selectedTask}
        onBack={() => {
          setSelectedTask(null);
          if (onClearInitialTaskId) onClearInitialTaskId();
        }}
        isManager={isManager}
      />
    );
  }


  return (
    <Card className="border-border/50">
      <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <CardTitle>Задачи</CardTitle>
        <div className="flex flex-wrap gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Статус" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все</SelectItem>
              <SelectItem value="pending">Ожидают</SelectItem>
              <SelectItem value="assigned">Назначены</SelectItem>
              <SelectItem value="in_progress">В работе</SelectItem>
              <SelectItem value="completed">Выполнены</SelectItem>
              <SelectItem value="cancelled">Отменены</SelectItem>
            </SelectContent>
          </Select>
          {isManager && (
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={resetForm}>
                  <Plus className="h-4 w-4 mr-2" />
                  Создать
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>{editingTask ? "Редактировать" : "Новая задача"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Название *</Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Описание</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={3}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Клиент</Label>
                      <Select
                        value={formData.client_id}
                        onValueChange={(v) => setFormData({ ...formData, client_id: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Выберите" />
                        </SelectTrigger>
                        <SelectContent>
                          {clients?.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Исполнитель</Label>
                      <Select
                        value={formData.assigned_to}
                        onValueChange={(v) => setFormData({ ...formData, assigned_to: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Выберите" />
                        </SelectTrigger>
                        <SelectContent>
                          {employees?.map((e) => (
                            <SelectItem key={e.id} value={e.id}>
                              {e.full_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Приоритет</Label>
                      <Select
                        value={formData.priority}
                        onValueChange={(v) => setFormData({ ...formData, priority: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Низкий</SelectItem>
                          <SelectItem value="medium">Средний</SelectItem>
                          <SelectItem value="high">Высокий</SelectItem>
                          <SelectItem value="urgent">Срочно</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="date">Дата</Label>
                      <Input
                        id="date"
                        type="date"
                        value={formData.scheduled_date}
                        onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
                      />
                    </div>
                  </div>
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={createTaskMutation.isPending || updateTaskMutation.isPending}
                  >
                    {(createTaskMutation.isPending || updateTaskMutation.isPending) && (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    )}
                    {editingTask ? "Сохранить" : "Создать"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : tasks?.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">Нет задач</p>
        ) : (
          <div className="space-y-3">
            {tasks?.map((task) => (
              <div
                key={task.id}
                className="p-4 rounded-lg border border-border/50 bg-card hover:bg-muted/50 transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-medium text-foreground">{task.title}</h3>
                      {getStatusBadge(task.status)}
                      {getPriorityBadge(task.priority)}
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {task.clients?.name && (
                        <span className="mr-3">📍 {task.clients.name}</span>
                      )}
                      {task.assigned_employee?.full_name && (
                        <span className="mr-3">👤 {task.assigned_employee.full_name}</span>
                      )}
                      {task.scheduled_date && (
                        <span>
                          📅 {format(new Date(task.scheduled_date), "dd MMM", { locale: ru })}
                          {task.scheduled_time_start && ` ${task.scheduled_time_start.slice(0, 5)}`}
                        </span>
                      )}
                    </div>
                    {task.notes && task.status !== "cancelled" && task.status !== "completed" && (
                      <div className="mt-1 text-xs text-muted-foreground">
                        ✅ {task.notes}
                      </div>
                    )}
                    {/* Completed task with result */}
                    {task.status === "completed" && (
                      <div className="mt-2 p-2 rounded bg-green-50 dark:bg-green-900/20 text-xs">
                        <div className="flex items-center gap-1 text-green-700 dark:text-green-400 font-medium">
                          <CheckCircle2 className="h-3 w-3" />
                          Выполнено: {task.completed_at && format(new Date(task.completed_at), "dd.MM.yyyy HH:mm")}
                        </div>
                        {task.notes && (
                          <div className="mt-1 text-green-600 dark:text-green-400">
                            📋 {task.notes.includes("Результат:") 
                              ? task.notes.split("Результат:")[1]?.split("\n")[0]?.trim() 
                              : task.notes}
                          </div>
                        )}
                      </div>
                    )}
                    {/* Cancelled task with reason */}
                    {task.status === "cancelled" && (
                      <div className="mt-2 p-2 rounded bg-red-50 dark:bg-red-900/20 text-xs">
                        <div className="flex items-center gap-1 text-red-700 dark:text-red-400 font-medium">
                          <CircleDashed className="h-3 w-3" />
                          Отменено
                        </div>
                        {task.notes && (
                          <div className="mt-1 text-red-600 dark:text-red-400">
                            ❌ Причина: {task.notes.includes("Причина отмены:") 
                              ? task.notes.split("Причина отмены:")[1]?.split("\n")[0]?.trim() 
                              : task.notes}
                          </div>
                        )}
                      </div>
                    )}
                    {task.scheduled_time_start && task.status !== "completed" && task.status !== "cancelled" && (
                      <div className="mt-1 text-xs text-muted-foreground">
                        ⏱ Начало: {task.scheduled_time_start}
                        {task.scheduled_time_end && ` → Завершено: ${task.scheduled_time_end}`}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setSelectedTask(task)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    {/* Кнопка "Принять" для назначенных задач */}
                    {(task.status === "assigned" || task.status === "pending") && (
                      <Button
                        variant="default"
                        size="sm"
                        className="gap-1"
                        onClick={() => acceptTaskMutation.mutate(task.id)}
                        disabled={acceptTaskMutation.isPending}
                      >
                        {acceptTaskMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <HandMetal className="h-4 w-4" />
                        )}
                        Принял
                      </Button>
                    )}
                    {task.status === "in_progress" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => updateStatusMutation.mutate({ id: task.id, status: "completed" })}
                      >
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      </Button>
                    )}
                    {isManager && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditingTask(task);
                            setFormData({
                              title: task.title,
                              description: task.description || "",
                              client_id: task.client_id || "",
                              assigned_to: task.assigned_to || "",
                              priority: task.priority,
                              scheduled_date: task.scheduled_date || "",
                            });
                            setIsDialogOpen(true);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteTaskMutation.mutate(task.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TasksManager;
