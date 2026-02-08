import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, UserCheck, UserX, Loader2, Search, User } from "lucide-react";

interface Employee {
  id: string;
  user_id: string;
  full_name: string;
  phone: string | null;
  position: string | null;
  is_active: boolean;
  created_at: string;
}

interface Profile {
  id: string;
  full_name: string | null;
  phone: string | null;
  address: string | null;
}

const EmployeesManager = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [formData, setFormData] = useState({
    full_name: "",
    phone: "",
    position: "master" as "master" | "engineer" | "dispatcher" | "director" | "manager",
  });

  const { data: employees, isLoading } = useQuery({
    queryKey: ["employees"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Employee[];
    },
  });

  // Поиск пользователей по имени/фамилии
  const { data: searchResults, isLoading: isSearching } = useQuery({
    queryKey: ["profile-search", searchQuery],
    queryFn: async () => {
      if (searchQuery.length < 2) return [];

      // Получаем уже добавленных сотрудников
      const { data: existingEmployees } = await supabase
        .from("employees")
        .select("user_id");

      const existingUserIds = existingEmployees?.map(e => e.user_id) || [];

      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, phone, address")
        .ilike("full_name", `%${searchQuery}%`)
        .limit(10);

      if (error) throw error;

      // Фильтруем уже добавленных
      return (data as Profile[]).filter(p => !existingUserIds.includes(p.id));
    },
    enabled: searchQuery.length >= 2 && !editingEmployee,
  });

  const positionLabels: Record<string, string> = {
    master: "Мастер",
    dispatcher: "Диспетчер",
    engineer: "Инженер",
    director: "Директор",
    manager: "Менеджер",
  };

  // Обратный маппинг: русское название -> ключ роли
  const positionKeys: Record<string, "master" | "engineer" | "dispatcher" | "director" | "manager"> = {
    "Мастер": "master",
    "Диспетчер": "dispatcher",
    "Инженер": "engineer",
    "Директор": "director",
    "Менеджер": "manager",
  };

  const createEmployeeMutation = useMutation({
    mutationFn: async (data: { userId: string; full_name: string; phone: string; position: string }) => {
      // Проверяем, не существует ли уже такой сотрудник
      const { data: existing } = await supabase
        .from("employees")
        .select("id")
        .eq("user_id", data.userId)
        .maybeSingle();

      if (existing) {
        throw new Error("Этот пользователь уже является сотрудником");
      }

      // Если телефон введён/изменён, сохраняем его в профиле пользователя
      if (data.phone) {
        await supabase
          .from("profiles")
          .update({ phone: data.phone })
          .eq("id", data.userId);
      }

      // Создаем запись сотрудника с должностью
      const { error: empError } = await supabase.from("employees").insert({
        user_id: data.userId,
        full_name: data.full_name,
        phone: data.phone || null,
        position: positionLabels[data.position] || data.position,
      });

      if (empError) throw empError;

      // Назначаем роль на основе должности
      const { error: roleError } = await supabase.from("user_roles").insert([{
        user_id: data.userId,
        role: data.position as "master" | "engineer" | "dispatcher",
      }]);

      if (roleError) throw roleError;

      return { id: data.userId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      toast({ title: "Сотрудник добавлен" });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateEmployeeMutation = useMutation({
    mutationFn: async ({ id, ...data }: Partial<Employee> & { id: string }) => {
      const { error } = await supabase
        .from("employees")
        .update(data)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      toast({ title: "Данные обновлены" });
      setEditingEmployee(null);
      setIsDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("employees")
        .update({ is_active })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      toast({ title: "Статус обновлен" });
    },
  });

  const resetForm = () => {
    setFormData({
      full_name: "",
      phone: "",
      position: "master",
    });
    setSearchQuery("");
    setSelectedProfile(null);
    setEditingEmployee(null);
  };

  const handleSelectProfile = (profile: Profile) => {
    setSelectedProfile(profile);
    // Телефон берётся из базы данных профиля
    setFormData({
      ...formData,
      full_name: profile.full_name || "",
      phone: profile.phone || "", // Автозаполнение телефона из БД
    });
    setSearchQuery("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingEmployee) {
      updateEmployeeMutation.mutate({
        id: editingEmployee.id,
        full_name: formData.full_name,
        phone: formData.phone || null,
        position: positionLabels[formData.position] || formData.position,
      });
    } else if (selectedProfile) {
      createEmployeeMutation.mutate({
        userId: selectedProfile.id,
        full_name: formData.full_name,
        phone: formData.phone,
        position: formData.position,
      });
    }
  };

  return (
    <Card className="border-border/50">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Сотрудники</CardTitle>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button onClick={() => { resetForm(); setEditingEmployee(null); }}>
              <Plus className="h-4 w-4 mr-2" />
              Добавить
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingEmployee ? "Редактировать сотрудника" : "Назначить сотрудника"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              {!editingEmployee && (
                <div className="space-y-4">
                  {!selectedProfile ? (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="search">Поиск пользователя по ФИО</Label>
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="search"
                            placeholder="Введите имя или фамилию..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10"
                          />
                        </div>
                      </div>
                      
                      {isSearching && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Поиск...
                        </div>
                      )}
                      
                      {searchResults && searchResults.length > 0 && (
                        <div className="border rounded-lg divide-y max-h-60 overflow-auto">
                          {searchResults.map((profile) => (
                            <div
                              key={profile.id}
                              className="p-3 hover:bg-muted/50 cursor-pointer transition-colors"
                              onClick={() => handleSelectProfile(profile)}
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                                  <User className="h-5 w-5 text-primary" />
                                </div>
                                <div>
                                  <p className="font-medium">{profile.full_name || "Без имени"}</p>
                                  <p className="text-sm text-muted-foreground">
                                    {profile.phone || profile.address || "Нет данных"}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {searchQuery.length >= 2 && !isSearching && searchResults?.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          Пользователи не найдены
                        </p>
                      )}
                      
                      {searchQuery.length < 2 && (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          Введите минимум 2 символа для поиска
                        </p>
                      )}
                    </>
                  ) : (
                    <div className="p-4 rounded-lg bg-muted/50 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{selectedProfile.full_name}</p>
                          <p className="text-sm text-muted-foreground">{selectedProfile.phone || "—"}</p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedProfile(null);
                          setFormData({ ...formData, full_name: "", phone: "" });
                        }}
                      >
                        Изменить
                      </Button>
                    </div>
                  )}
                </div>
              )}
              
              {(selectedProfile || editingEmployee) && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="full_name">ФИО</Label>
                    <Input
                      id="full_name"
                      value={formData.full_name}
                      onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Телефон</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Должность</Label>
                    <Select
                      value={formData.position}
                      onValueChange={(v) => setFormData({ ...formData, position: v as typeof formData.position })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="director">Директор</SelectItem>
                        <SelectItem value="manager">Менеджер</SelectItem>
                        <SelectItem value="dispatcher">Диспетчер</SelectItem>
                        <SelectItem value="master">Мастер</SelectItem>
                        <SelectItem value="engineer">Инженер</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={createEmployeeMutation.isPending || updateEmployeeMutation.isPending}
                  >
                    {(createEmployeeMutation.isPending || updateEmployeeMutation.isPending) && (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    )}
                    {editingEmployee ? "Сохранить" : "Назначить сотрудником"}
                  </Button>
                </>
              )}
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : employees?.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">Нет сотрудников</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ФИО</TableHead>
                <TableHead>Телефон</TableHead>
                <TableHead>Должность</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead className="text-right">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees?.map((emp) => (
                <TableRow key={emp.id}>
                  <TableCell className="font-medium">{emp.full_name}</TableCell>
                  <TableCell>{emp.phone || "—"}</TableCell>
                  <TableCell>{emp.position || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={emp.is_active ? "default" : "secondary"}>
                      {emp.is_active ? "Активен" : "Неактивен"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setEditingEmployee(emp);
                        // Преобразуем русскую должность обратно в ключ
                        const posKey = emp.position ? positionKeys[emp.position] || "master" : "master";
                        setFormData({
                          full_name: emp.full_name,
                          phone: emp.phone || "",
                          position: posKey,
                        });
                        setIsDialogOpen(true);
                      }}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => toggleActiveMutation.mutate({
                        id: emp.id,
                        is_active: !emp.is_active,
                      })}
                    >
                      {emp.is_active ? (
                        <UserX className="h-4 w-4 text-destructive" />
                      ) : (
                        <UserCheck className="h-4 w-4 text-green-600" />
                      )}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};

export default EmployeesManager;
