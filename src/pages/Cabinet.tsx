import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, LogOut, CheckCircle, AlertCircle, ClipboardList, Calendar, Shield } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  scheduled_date: string | null;
  notes: string | null;
  clients: { name: string; address: string } | null;
}

const Cabinet = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [apartment, setApartment] = useState("");
  const [isVisible, setIsVisible] = useState({
    header: false,
    content: false
  });
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!loading) {
      // Анимация заголовка (0.5 сек)
      setTimeout(() => setIsVisible(prev => ({ ...prev, header: true })), 500);

      // Анимация содержимого (1.0 сек)
      setTimeout(() => setIsVisible(prev => ({ ...prev, content: true })), 1000);
    }
  }, [loading]);

  useEffect(() => {
    checkUser();
  }, []);

  // Realtime subscription for profile updates
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel("cabinet-profile")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${userId}` },
        (payload) => {
          const updated = payload.new as any;
          setProfile(updated);
          setFullName(updated.full_name || "");
          setPhone(updated.phone || "");
          setAddress(updated.address || "");
          setApartment(updated.apartment || "");
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  const checkUser = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        navigate("/auth");
        return;
      }

      setUserId(session.user.id);

      // Получаем роли пользователя
      const { data: rolesData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id);

      if (rolesData) {
        setUserRoles(rolesData.map(r => r.role));
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single();

      if (error) throw error;

      setProfile(data);
      setFullName(data.full_name || "");
      setPhone(data.phone || "");
      setAddress(data.address || "");
      setApartment(data.apartment || "");
    } catch (error: any) {
      console.error("Error loading profile:", error);
    } finally {
      setLoading(false);
    }
  };

  // Получаем задачи пользователя (если он сотрудник)
  const { data: myTasks } = useQuery({
    queryKey: ["my-tasks", userId],
    queryFn: async () => {
      if (!userId) return [];
      
      // Сначала проверяем, есть ли запись сотрудника
      const { data: employee } = await supabase
        .from("employees")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();
      
      if (!employee) return [];

      const { data, error } = await supabase
        .from("tasks")
        .select(`
          id, title, status, priority, scheduled_date, notes,
          clients (name, address)
        `)
        .or(`assigned_to.eq.${employee.id},accepted_by.eq.${employee.id}`)
        .neq("status", "completed")
        .neq("status", "cancelled");

      if (error) throw error;
      
      // Сортировка по приоритету
      const priorityOrder: Record<string, number> = {
        urgent: 1,
        high: 2,
        medium: 3,
        low: 4,
      };
      
      return (data as Task[]).sort((a, b) => 
        (priorityOrder[a.priority] || 5) - (priorityOrder[b.priority] || 5)
      );
    },
    enabled: !!userId,
  });

  const handleSaveAndVerify = async () => {
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: fullName,
          phone,
          address,
          apartment,
          is_verified: false,
        })
        .eq("id", session.user.id);

      if (error) throw error;

      setProfile((prev: any) => prev ? { ...prev, full_name: fullName, phone, address, apartment, is_verified: false } : prev);

      toast({
        title: "Данные отправлены",
        description: "Ваши данные сохранены и отправлены на верификацию",
      });
    } catch (error: any) {
      toast({
        title: "Ошибка сохранения",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: "bg-yellow-100 text-yellow-800",
      assigned: "bg-blue-100 text-blue-800",
      in_progress: "bg-orange-100 text-orange-800",
    };
    const labels: Record<string, string> = {
      pending: "Ожидает",
      assigned: "Назначена",
      in_progress: "В работе",
    };
    return <Badge className={styles[status]} variant="secondary">{labels[status]}</Badge>;
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
    return <Badge className={styles[priority]} variant="secondary">{labels[priority]}</Badge>;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 bg-muted/30 py-8">
        <div className="container max-w-4xl">
          <div className="flex justify-between items-center mb-8">
            <h1
              className={`text-3xl font-bold ${
                isVisible.header ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-10'
              } transition-all duration-700 ease-out`}
            >
              Личный кабинет
            </h1>
            <div
              className={`flex gap-2 ${
                isVisible.header ? 'opacity-100' : 'opacity-0'
              } transition-opacity duration-700 delay-300`}
            >
              {userRoles.includes("admin") && (
                <Button variant="outline" onClick={() => navigate("/admin")}>
                  <Shield className="h-4 w-4 mr-2" />
                  Админ-панель
                </Button>
              )}
              <Button variant="outline" onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-2" />
                Выйти
              </Button>
            </div>
          </div>

          <div className="grid gap-6">
            {/* Мои заявки - показываем если есть задачи */}
            {myTasks && myTasks.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ClipboardList className="h-5 w-5" />
                    Мои заявки
                  </CardTitle>
                  <CardDescription>
                    Активные заявки отсортированы по приоритету
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {myTasks.map((task) => (
                    <div 
                      key={task.id} 
                      className="p-4 rounded-lg border border-border/50 bg-card"
                    >
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className="font-medium">{task.title}</span>
                        {getStatusBadge(task.status)}
                        {getPriorityBadge(task.priority)}
                      </div>
                      {task.clients && (
                        <p className="text-sm text-muted-foreground">
                          📍 {task.clients.name} — {task.clients.address}
                        </p>
                      )}
                      {task.scheduled_date && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(task.scheduled_date), "dd MMMM yyyy", { locale: ru })}
                        </p>
                      )}
                      {task.notes && (
                        <p className="text-xs text-muted-foreground mt-2">
                          {task.notes}
                        </p>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Статус верификации</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  {profile?.is_verified ? (
                    <>
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <span className="text-green-600 font-medium">Верифицирован</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-5 w-5 text-orange-600" />
                      <span className="text-orange-600 font-medium">Ожидает верификации</span>
                      <p className="text-sm text-muted-foreground ml-2">
                        Заполните данные и нажмите "Сохранить и отправить на верификацию"
                      </p>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Личная информация</CardTitle>
                <CardDescription>
                  Заполните данные для верификации вашего аккаунта
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Полное имя</Label>
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Иван Иванович Иванов"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Телефон</Label>
                  <Input
                    id="phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+7 (999) 123-45-67"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Адрес</Label>
                  <Input
                    id="address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="г. Москва, ул. Примерная, д. 1"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="apartment">Квартира</Label>
                  <Input
                    id="apartment"
                    value={apartment}
                    onChange={(e) => setApartment(e.target.value)}
                    placeholder="123"
                  />
                </div>

                <Button onClick={handleSaveAndVerify} disabled={saving} className="w-full">
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Сохранить и отправить на верификацию
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Доступ к системе</CardTitle>
                <CardDescription>
                  Информация о подключенных услугах
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  После верификации здесь будет доступна информация о ваших подключенных услугах,
                  видеоархив с домофона и другие функции.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Cabinet;
