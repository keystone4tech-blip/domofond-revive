import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { BarChart3, Download, Loader2, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { ru } from "date-fns/locale";

const FSMReports = () => {
  const [dateFrom, setDateFrom] = useState(
    format(startOfMonth(new Date()), "yyyy-MM-dd")
  );
  const [dateTo, setDateTo] = useState(
    format(endOfMonth(new Date()), "yyyy-MM-dd")
  );
  const [employeeFilter, setEmployeeFilter] = useState<string>("all");

  const { data: employees } = useQuery({
    queryKey: ["employees-report"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, full_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: reportData, isLoading } = useQuery({
    queryKey: ["fsm-report", dateFrom, dateTo, employeeFilter],
    queryFn: async () => {
      let query = supabase
        .from("tasks")
        .select(`
          id,
          status,
          priority,
          created_at,
          completed_at,
          assigned_to,
          employees (id, full_name)
        `)
        .gte("created_at", `${dateFrom}T00:00:00`)
        .lte("created_at", `${dateTo}T23:59:59`);

      if (employeeFilter !== "all") {
        query = query.eq("assigned_to", employeeFilter);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Агрегация данных
      const tasks = data || [];
      const totalTasks = tasks.length;
      const completedTasks = tasks.filter((t) => t.status === "completed").length;
      const cancelledTasks = tasks.filter((t) => t.status === "cancelled").length;
      const inProgressTasks = tasks.filter((t) => t.status === "in_progress").length;
      const pendingTasks = tasks.filter((t) => ["pending", "assigned"].includes(t.status)).length;

      // Статистика по сотрудникам
      const employeeStats: Record<string, {
        name: string;
        total: number;
        completed: number;
        inProgress: number;
      }> = {};

      tasks.forEach((task) => {
        if (task.employees) {
          const empId = (task.employees as { id: string; full_name: string }).id;
          const empName = (task.employees as { id: string; full_name: string }).full_name;
          
          if (!employeeStats[empId]) {
            employeeStats[empId] = { name: empName, total: 0, completed: 0, inProgress: 0 };
          }
          employeeStats[empId].total++;
          if (task.status === "completed") employeeStats[empId].completed++;
          if (task.status === "in_progress") employeeStats[empId].inProgress++;
        }
      });

      // Статистика по приоритетам
      const priorityStats = {
        low: tasks.filter((t) => t.priority === "low").length,
        medium: tasks.filter((t) => t.priority === "medium").length,
        high: tasks.filter((t) => t.priority === "high").length,
        urgent: tasks.filter((t) => t.priority === "urgent").length,
      };

      return {
        totalTasks,
        completedTasks,
        cancelledTasks,
        inProgressTasks,
        pendingTasks,
        completionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
        employeeStats: Object.values(employeeStats),
        priorityStats,
        tasks,
      };
    },
  });

  // Сравнение с предыдущим периодом
  const { data: previousPeriodData } = useQuery({
    queryKey: ["fsm-report-prev", dateFrom, dateTo],
    queryFn: async () => {
      const periodLength = new Date(dateTo).getTime() - new Date(dateFrom).getTime();
      const prevDateTo = new Date(new Date(dateFrom).getTime() - 1);
      const prevDateFrom = new Date(prevDateTo.getTime() - periodLength);

      const { data, error } = await supabase
        .from("tasks")
        .select("id, status")
        .gte("created_at", prevDateFrom.toISOString())
        .lte("created_at", prevDateTo.toISOString());

      if (error) throw error;
      
      const tasks = data || [];
      return {
        totalTasks: tasks.length,
        completedTasks: tasks.filter((t) => t.status === "completed").length,
      };
    },
  });

  const getTrend = (current: number, previous: number) => {
    if (previous === 0) return { icon: Minus, color: "text-muted-foreground", value: "—" };
    const diff = ((current - previous) / previous) * 100;
    if (diff > 0) return { icon: TrendingUp, color: "text-green-600", value: `+${diff.toFixed(0)}%` };
    if (diff < 0) return { icon: TrendingDown, color: "text-red-600", value: `${diff.toFixed(0)}%` };
    return { icon: Minus, color: "text-muted-foreground", value: "0%" };
  };

  const tasksTrend = getTrend(
    reportData?.totalTasks || 0,
    previousPeriodData?.totalTasks || 0
  );
  const completedTrend = getTrend(
    reportData?.completedTasks || 0,
    previousPeriodData?.completedTasks || 0
  );

  const handleExport = () => {
    if (!reportData) return;

    const csvContent = [
      ["Отчет по задачам", `${dateFrom} - ${dateTo}`],
      [],
      ["Всего задач", reportData.totalTasks],
      ["Выполнено", reportData.completedTasks],
      ["В работе", reportData.inProgressTasks],
      ["Ожидают", reportData.pendingTasks],
      ["Отменено", reportData.cancelledTasks],
      ["Процент выполнения", `${reportData.completionRate}%`],
      [],
      ["Сотрудник", "Всего", "Выполнено", "В работе"],
      ...reportData.employeeStats.map((e) => [e.name, e.total, e.completed, e.inProgress]),
    ]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `fsm-report-${dateFrom}-${dateTo}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6">
      {/* Фильтры */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Отчеты и аналитика
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="space-y-2">
              <Label>Период с</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-[160px]"
              />
            </div>
            <div className="space-y-2">
              <Label>по</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-[160px]"
              />
            </div>
            <div className="space-y-2">
              <Label>Сотрудник</Label>
              <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Все" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все сотрудники</SelectItem>
                  {employees?.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="invisible">Действие</Label>
              <Button variant="outline" onClick={handleExport} disabled={isLoading}>
                <Download className="h-4 w-4 mr-2" />
                Экспорт CSV
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* Общая статистика */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="border-border/50">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold">{reportData?.totalTasks || 0}</p>
                    <p className="text-sm text-muted-foreground">Всего задач</p>
                  </div>
                  <div className={`flex items-center gap-1 ${tasksTrend.color}`}>
                    <tasksTrend.icon className="h-4 w-4" />
                    <span className="text-sm">{tasksTrend.value}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/50">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold text-green-600">{reportData?.completedTasks || 0}</p>
                    <p className="text-sm text-muted-foreground">Выполнено</p>
                  </div>
                  <div className={`flex items-center gap-1 ${completedTrend.color}`}>
                    <completedTrend.icon className="h-4 w-4" />
                    <span className="text-sm">{completedTrend.value}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/50">
              <CardContent className="pt-6">
                <p className="text-2xl font-bold text-orange-600">{reportData?.inProgressTasks || 0}</p>
                <p className="text-sm text-muted-foreground">В работе</p>
              </CardContent>
            </Card>

            <Card className="border-border/50">
              <CardContent className="pt-6">
                <p className="text-2xl font-bold text-primary">{reportData?.completionRate || 0}%</p>
                <p className="text-sm text-muted-foreground">Выполнение</p>
              </CardContent>
            </Card>
          </div>

          {/* Статистика по сотрудникам */}
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-lg">По сотрудникам</CardTitle>
            </CardHeader>
            <CardContent>
              {reportData?.employeeStats.length === 0 ? (
                <p className="text-muted-foreground text-sm">Нет данных</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Сотрудник</TableHead>
                      <TableHead className="text-center">Всего</TableHead>
                      <TableHead className="text-center">Выполнено</TableHead>
                      <TableHead className="text-center">В работе</TableHead>
                      <TableHead className="text-center">Эффективность</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reportData?.employeeStats.map((emp, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{emp.name}</TableCell>
                        <TableCell className="text-center">{emp.total}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="bg-green-100 text-green-700">
                            {emp.completed}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="bg-orange-100 text-orange-700">
                            {emp.inProgress}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          {emp.total > 0 ? Math.round((emp.completed / emp.total) * 100) : 0}%
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Статистика по приоритетам */}
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-lg">По приоритетам</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-lg bg-gray-100 dark:bg-gray-800">
                  <p className="text-2xl font-bold">{reportData?.priorityStats.low || 0}</p>
                  <p className="text-sm text-muted-foreground">Низкий</p>
                </div>
                <div className="p-4 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                  <p className="text-2xl font-bold text-blue-700">{reportData?.priorityStats.medium || 0}</p>
                  <p className="text-sm text-muted-foreground">Средний</p>
                </div>
                <div className="p-4 rounded-lg bg-orange-100 dark:bg-orange-900/30">
                  <p className="text-2xl font-bold text-orange-700">{reportData?.priorityStats.high || 0}</p>
                  <p className="text-sm text-muted-foreground">Высокий</p>
                </div>
                <div className="p-4 rounded-lg bg-red-100 dark:bg-red-900/30">
                  <p className="text-2xl font-bold text-red-700">{reportData?.priorityStats.urgent || 0}</p>
                  <p className="text-sm text-muted-foreground">Срочный</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default FSMReports;
