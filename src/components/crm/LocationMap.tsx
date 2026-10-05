import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Clock, User, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

interface Employee {
  id: string;
  full_name: string;
  position: string | null;
  is_active: boolean;
  current_location: {
    lat: number;
    lng: number;
    updated_at: string;
  } | null;
}

const LocationMap = () => {
  const { data: employees, isLoading } = useQuery({
    queryKey: ["employees-locations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, full_name, position, is_active, current_location")
        .eq("is_active", true);

      if (error) throw error;
      return data as Employee[];
    },
    refetchInterval: 30000, // Обновляем каждые 30 секунд
  });

  const { data: todayTasks } = useQuery({
    queryKey: ["today-tasks-map"],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("tasks")
        .select(`
          id,
          title,
          status,
          clients (name, address, location)
        `)
        .eq("scheduled_date", today)
        .in("status", ["assigned", "in_progress"]);

      if (error) throw error;
      return data;
    },
  });

  const employeesWithLocation = employees?.filter((e) => e.current_location) || [];
  const employeesWithoutLocation = employees?.filter((e) => !e.current_location) || [];

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      {/* Карта-заглушка */}
      <Card className="lg:col-span-2 border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            Карта сотрудников
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="aspect-video bg-muted rounded-lg flex items-center justify-center relative overflow-hidden">
            {/* Простая визуализация карты */}
            <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-green-50 dark:from-blue-950/30 dark:to-green-950/30">
              {/* Сетка */}
              <div className="absolute inset-0" style={{
                backgroundImage: `linear-gradient(rgba(0,0,0,0.05) 1px, transparent 1px),
                                  linear-gradient(90deg, rgba(0,0,0,0.05) 1px, transparent 1px)`,
                backgroundSize: '40px 40px'
              }} />
              
              {/* Точки сотрудников */}
              {employeesWithLocation.map((emp, index) => (
                <div
                  key={emp.id}
                  className="absolute w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold shadow-lg animate-pulse"
                  style={{
                    left: `${20 + (index * 25) % 60}%`,
                    top: `${20 + (index * 30) % 60}%`,
                  }}
                  title={emp.full_name}
                >
                  {emp.full_name.charAt(0)}
                </div>
              ))}

              {/* Точки задач */}
              {todayTasks?.map((task, index) => (
                <div
                  key={task.id}
                  className="absolute w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center text-white text-xs shadow-lg"
                  style={{
                    left: `${15 + (index * 20) % 70}%`,
                    top: `${30 + (index * 25) % 50}%`,
                  }}
                  title={(task.clients as { name: string } | null)?.name || task.title}
                >
                  📍
                </div>
              ))}
            </div>

            <div className="relative z-10 text-center p-4 bg-background/80 rounded-lg">
              <p className="text-muted-foreground text-sm">
                Для полноценной работы с картой интегрируйте Яндекс.Карты или Google Maps
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Сейчас отображается упрощенная визуализация
              </p>
            </div>
          </div>

          <div className="flex gap-4 mt-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-primary" />
              <span className="text-muted-foreground">Сотрудники</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-orange-500" />
              <span className="text-muted-foreground">Задачи на сегодня</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Список сотрудников */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-lg">Сотрудники</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-4">
              {/* С геолокацией */}
              {employeesWithLocation.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">На связи</p>
                  <div className="space-y-2">
                    {employeesWithLocation.map((emp) => (
                      <div
                        key={emp.id}
                        className="p-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                              <User className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                              <p className="font-medium text-sm">{emp.full_name}</p>
                              <p className="text-xs text-muted-foreground">{emp.position || "Сотрудник"}</p>
                            </div>
                          </div>
                          <Badge variant="outline" className="bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 text-xs">
                            Онлайн
                          </Badge>
                        </div>
                        {emp.current_location && (
                          <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            Обновлено: {format(new Date(emp.current_location.updated_at), "HH:mm", { locale: ru })}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Без геолокации */}
              {employeesWithoutLocation.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Оффлайн</p>
                  <div className="space-y-2">
                    {employeesWithoutLocation.map((emp) => (
                      <div
                        key={emp.id}
                        className="p-3 rounded-lg bg-muted/50 border border-border/50"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                              <User className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div>
                              <p className="font-medium text-sm">{emp.full_name}</p>
                              <p className="text-xs text-muted-foreground">{emp.position || "Сотрудник"}</p>
                            </div>
                          </div>
                          <Badge variant="secondary" className="text-xs">
                            Оффлайн
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {employees?.length === 0 && (
                <p className="text-muted-foreground text-sm text-center py-4">
                  Нет активных сотрудников
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default LocationMap;
