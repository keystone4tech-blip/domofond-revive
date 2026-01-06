import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft, 
  MapPin, 
  User, 
  Calendar, 
  Clock, 
  Plus,
  Camera,
  CheckCircle2,
  Play,
  Loader2
} from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

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
  created_at: string;
  clients: { id: string; name: string; address: string } | null;
  employees: { id: string; full_name: string } | null;
}

interface TaskDetailsProps {
  task: Task;
  onBack: () => void;
  isManager: boolean;
}

const TaskDetails = ({ task, onBack, isManager }: TaskDetailsProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newChecklistItem, setNewChecklistItem] = useState("");

  const { data: checklist } = useQuery({
    queryKey: ["task-checklist", task.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_checklists")
        .select("*")
        .eq("task_id", task.id)
        .order("order_index");
      if (error) throw error;
      return data;
    },
  });

  const { data: photos } = useQuery({
    queryKey: ["task-photos", task.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_photos")
        .select("*")
        .eq("task_id", task.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async (status: string) => {
      const update: { status: string; completed_at?: string | null } = { status };
      if (status === "completed") {
        update.completed_at = new Date().toISOString();
      }
      const { error } = await supabase
        .from("tasks")
        .update(update)
        .eq("id", task.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast({ title: "Статус обновлен" });
      onBack();
    },
  });

  const addChecklistItemMutation = useMutation({
    mutationFn: async (text: string) => {
      const { error } = await supabase.from("task_checklists").insert({
        task_id: task.id,
        item_text: text,
        order_index: (checklist?.length || 0) + 1,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-checklist", task.id] });
      setNewChecklistItem("");
    },
  });

  const toggleChecklistItemMutation = useMutation({
    mutationFn: async ({ id, is_completed }: { id: string; is_completed: boolean }) => {
      const { error } = await supabase
        .from("task_checklists")
        .update({
          is_completed,
          completed_at: is_completed ? new Date().toISOString() : null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-checklist", task.id] });
    },
  });

  const uploadPhotoMutation = useMutation({
    mutationFn: async (file: File) => {
      const { data: userData } = await supabase.auth.getUser();
      const fileName = `${task.id}/${Date.now()}_${file.name}`;
      
      const { error: uploadError } = await supabase.storage
        .from("news")
        .upload(fileName, file);
      
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("news")
        .getPublicUrl(fileName);

      const { error: dbError } = await supabase.from("task_photos").insert({
        task_id: task.id,
        photo_url: urlData.publicUrl,
        uploaded_by: userData.user?.id,
      });
      
      if (dbError) throw dbError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-photos", task.id] });
      toast({ title: "Фото загружено" });
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка загрузки", description: error.message, variant: "destructive" });
    },
  });

  const getStatusBadge = (status: string) => {
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
    return (
      <Badge className={styles[status]} variant="secondary">
        {labels[status]}
      </Badge>
    );
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadPhotoMutation.mutate(file);
    }
  };

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={onBack} className="mb-4">
        <ArrowLeft className="h-4 w-4 mr-2" />
        Назад к задачам
      </Button>

      <Card className="border-border/50">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="text-xl">{task.title}</CardTitle>
              <div className="flex items-center gap-2 mt-2">
                {getStatusBadge(task.status)}
              </div>
            </div>
            <div className="flex gap-2">
              {task.status === "assigned" && (
                <Button
                  onClick={() => updateStatusMutation.mutate("in_progress")}
                  disabled={updateStatusMutation.isPending}
                >
                  <Play className="h-4 w-4 mr-2" />
                  Начать
                </Button>
              )}
              {task.status === "in_progress" && (
                <Button
                  onClick={() => updateStatusMutation.mutate("completed")}
                  disabled={updateStatusMutation.isPending}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Завершить
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {task.description && (
            <div>
              <h4 className="font-medium mb-2">Описание</h4>
              <p className="text-muted-foreground">{task.description}</p>
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-4">
            {task.clients && (
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="font-medium">{task.clients.name}</p>
                  <p className="text-sm text-muted-foreground">{task.clients.address}</p>
                </div>
              </div>
            )}
            {task.employees && (
              <div className="flex items-center gap-3">
                <User className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium">{task.employees.full_name}</p>
                  <p className="text-sm text-muted-foreground">Исполнитель</p>
                </div>
              </div>
            )}
            {task.scheduled_date && (
              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium">
                    {format(new Date(task.scheduled_date), "dd MMMM yyyy", { locale: ru })}
                  </p>
                  <p className="text-sm text-muted-foreground">Дата выполнения</p>
                </div>
              </div>
            )}
            {task.scheduled_time_start && (
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium">
                    {task.scheduled_time_start.slice(0, 5)}
                    {task.scheduled_time_end && ` — ${task.scheduled_time_end.slice(0, 5)}`}
                  </p>
                  <p className="text-sm text-muted-foreground">Время</p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Чек-лист */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-lg">Чек-лист</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {checklist?.map((item) => (
            <div key={item.id} className="flex items-center gap-3">
              <Checkbox
                checked={item.is_completed}
                onCheckedChange={(checked) =>
                  toggleChecklistItemMutation.mutate({
                    id: item.id,
                    is_completed: checked as boolean,
                  })
                }
              />
              <span className={item.is_completed ? "line-through text-muted-foreground" : ""}>
                {item.item_text}
              </span>
            </div>
          ))}
          
          {isManager && (
            <div className="flex gap-2">
              <Input
                placeholder="Добавить пункт..."
                value={newChecklistItem}
                onChange={(e) => setNewChecklistItem(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newChecklistItem.trim()) {
                    addChecklistItemMutation.mutate(newChecklistItem.trim());
                  }
                }}
              />
              <Button
                size="icon"
                onClick={() => {
                  if (newChecklistItem.trim()) {
                    addChecklistItemMutation.mutate(newChecklistItem.trim());
                  }
                }}
                disabled={addChecklistItemMutation.isPending}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Фотоотчет */}
      <Card className="border-border/50">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Фотоотчет</CardTitle>
          <div>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
              id="photo-upload"
            />
            <label htmlFor="photo-upload">
              <Button asChild disabled={uploadPhotoMutation.isPending}>
                <span>
                  {uploadPhotoMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Camera className="h-4 w-4 mr-2" />
                  )}
                  Добавить фото
                </span>
              </Button>
            </label>
          </div>
        </CardHeader>
        <CardContent>
          {photos?.length === 0 ? (
            <p className="text-muted-foreground text-sm">Нет фотографий</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {photos?.map((photo) => (
                <div key={photo.id} className="aspect-square rounded-lg overflow-hidden bg-muted">
                  <img
                    src={photo.photo_url}
                    alt="Фото задачи"
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TaskDetails;
