import { useState, useEffect } from "react";
import { Database, Download, RefreshCw, Trash2, ShieldCheck, HardDrive, Clock, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { getAuthToken } from "@/integrations/supabase/client";

// Интерфейс элемента резервной копии
interface BackupItem {
  filename: string;
  size_bytes: number;
  size_formatted: string;
  created_at: string;
}

export const BackupsManager = () => {
  const { toast } = useToast();
  const [backups, setBackups] = useState<BackupItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [deletingFile, setDeletingFile] = useState<string | null>(null);

  // Получаем гарантированный валидный JWT токен администратора для бэкенда
  const resolveToken = (): string => {
    // 1. Проверяем основной токен сессии через общий клиент Supabase
    const clientToken = getAuthToken();
    if (clientToken && clientToken.startsWith("eyJ")) {
      return clientToken;
    }

    // 2. Резервный поиск во всех хранилищах браузера
    try {
      const direct = localStorage.getItem("auth_token") || sessionStorage.getItem("auth_token");
      if (direct && direct.startsWith("eyJ")) return direct;

      // 3. Поиск по ключам Supabase
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.includes("auth-token") || key.includes("supabase.auth.token") || key.includes("auth_token"))) {
          const item = localStorage.getItem(key);
          if (item) {
            if (item.startsWith("eyJ")) return item;
            try {
              const parsed = JSON.parse(item);
              if (parsed?.access_token) return parsed.access_token;
              if (parsed?.currentSession?.access_token) return parsed.currentSession.access_token;
              if (parsed?.token) return parsed.token;
            } catch {
              // строка не является JSON
            }
          }
        }
      }
    } catch (e) {
      console.error("[BackupsManager] Ошибка чтения токена из хранилища:", e);
    }
    return "";
  };

  // 1. Загрузка списка доступных резервных копий
  const fetchBackups = async () => {
    setLoading(true);
    console.log("[BackupsManager] Запрос списка резервных копий...");
    try {
      const token = resolveToken();
      const res = await fetch("/backend-api/api/admin/backups", {
        headers: {
          "Authorization": `Bearer ${token || ""}`,
        },
      });

      if (!res.ok) {
        throw new Error(`Ошибка сервера: ${res.status}`);
      }

      const data = await res.json();
      console.log(`[BackupsManager] Получено ${data.length} резервных копий`);
      setBackups(data);
    } catch (err: any) {
      console.error("[BackupsManager] Ошибка при загрузке списка бэкапов:", err);
      toast({
        title: "Ошибка загрузки",
        description: "Не удалось получить список резервных копий с сервера",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBackups();
  }, []);

  // 2. Создание новой резервной копии базы данных
  const handleCreateBackup = async () => {
    setCreating(true);
    console.log("[BackupsManager] Запрос на создание резервной копии...");
    toast({
      title: "Создание резервной копии",
      description: "Запущен процесс создания дампа базы данных PostgreSQL...",
    });

    try {
      const token = resolveToken();
      const res = await fetch("/backend-api/api/admin/backups/create", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token || ""}`,
        },
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || `Ошибка: ${res.status}`);
      }

      console.log("[BackupsManager] Резервная копия успешно создана:", result.backup);
      toast({
        title: "Успешно!",
        description: `Резервная копия ${result.backup?.filename || ""} создана (${result.backup?.size_formatted || ""})`,
      });

      // Обновляем список файлов
      fetchBackups();
    } catch (err: any) {
      console.error("[BackupsManager] Ошибка при создании бэкапа:", err);
      toast({
        title: "Сбой создания бэкапа",
        description: err.message || "Не удалось создать резервную копию",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  // 3. Скачивание файла резервной копии на компьютер
  const handleDownloadBackup = async (filename: string) => {
    console.log(`[BackupsManager] Скачивание файла: ${filename}`);
    try {
      const token = resolveToken();
      const downloadUrl = `/backend-api/api/admin/backups/download/${encodeURIComponent(filename)}`;
      
      // Запрашиваем файл с токеном авторизации
      const res = await fetch(downloadUrl, {
        headers: {
          "Authorization": `Bearer ${token || ""}`,
        },
      });

      if (!res.ok) {
        throw new Error(`Ошибка при скачивании: ${res.status}`);
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Скачивание начато",
        description: `Файл ${filename} успешно загружен на ваш компьютер`,
      });
    } catch (err: any) {
      console.error("[BackupsManager] Ошибка скачивания:", err);
      toast({
        title: "Ошибка скачивания",
        description: err.message || "Не удалось загрузить файл",
        variant: "destructive",
      });
    }
  };

  // 4. Удаление старой резервной копии
  const handleDeleteBackup = async (filename: string) => {
    if (!window.confirm(`Вы уверены, что хотите удалить резервную копию ${filename}? Это действие необратимо.`)) {
      return;
    }

    setDeletingFile(filename);
    console.log(`[BackupsManager] Удаление файла: ${filename}`);

    try {
      const token = resolveToken();
      const res = await fetch(`/backend-api/api/admin/backups/${encodeURIComponent(filename)}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token || ""}`,
        },
      });

      if (!res.ok) {
        throw new Error(`Ошибка при удалении: ${res.status}`);
      }

      toast({
        title: "Файл удален",
        description: `Резервная копия ${filename} успешно удалена`,
      });

      setBackups((prev) => prev.filter((b) => b.filename !== filename));
    } catch (err: any) {
      console.error("[BackupsManager] Ошибка удаления:", err);
      toast({
        title: "Ошибка удаления",
        description: err.message || "Не удалось удалить файл",
        variant: "destructive",
      });
    } finally {
      setDeletingFile(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Верхний заголовок и кнопки действий */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card p-6 rounded-2xl border shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 rounded-xl">
              <Database className="h-6 w-6" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight">Резервные копии базы данных</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Полные сжатые снимки базы данных domofondar (PostgreSQL). Доступно создание и прямое скачивание на рабочий компьютер.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchBackups}
            disabled={loading || creating}
            className="rounded-xl gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Обновить
          </Button>

          <Button
            onClick={handleCreateBackup}
            disabled={creating}
            className="rounded-xl gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20"
          >
            {creating ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Создается дамп...
              </>
            ) : (
              <>
                <HardDrive className="h-4 w-4" />
                Создать бэкап сейчас
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Информационная плашка безопасности */}
      <Card className="border-blue-200 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-950/20">
        <CardContent className="p-4 flex items-start gap-3 text-sm text-blue-900 dark:text-blue-200">
          <ShieldCheck className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold">Автоматическая защита данных</p>
            <p className="text-xs text-blue-800 dark:text-blue-300">
              Каждый дамп содержит все таблицы, лицевые счета абонентов 1С, роли, заявки и настройки. Архивы сжаты алгоритмом Gzip. Рекомендуется скачивать копию на внешний защищенный диск перед проведением крупных обновлений.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Таблица / Список резервных копий */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center justify-between">
            <span>Доступные архивы на сервере</span>
            <span className="text-xs font-normal text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
              Всего: {backups.length}
            </span>
          </CardTitle>
          <CardDescription>
            Файлы хранятся в защищенной директории сервера /backups с ротацией
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-muted-foreground gap-3">
              <RefreshCw className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm">Загрузка списка резервных копий...</p>
            </div>
          ) : backups.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center text-muted-foreground space-y-3">
              <AlertCircle className="h-10 w-10 text-muted-foreground/60" />
              <div className="space-y-1">
                <p className="font-medium text-foreground">Архивы резервных копий пока отсутствуют</p>
                <p className="text-sm">Нажмите кнопку «Создать бэкап сейчас», чтобы сделать первый полный снимок базы данных.</p>
              </div>
            </div>
          ) : (
            <div className="divide-y border rounded-xl overflow-hidden">
              {backups.map((backup) => (
                <div
                  key={backup.filename}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-4 hover:bg-muted/40 transition-colors"
                >
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm font-semibold text-foreground break-all">
                        {backup.filename}
                      </span>
                      <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium px-2 py-0.5 rounded">
                        {backup.size_formatted}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      <span>{new Date(backup.created_at).toLocaleString("ru-RU")}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownloadBackup(backup.filename)}
                      className="rounded-lg gap-1.5 text-blue-600 dark:text-blue-400 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                    >
                      <Download className="h-4 w-4" />
                      Скачать
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteBackup(backup.filename)}
                      disabled={deletingFile === backup.filename}
                      className="rounded-lg text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
