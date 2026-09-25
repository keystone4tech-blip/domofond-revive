import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { 
  CheckCircle2, XCircle, Trash2, Eye, Star, Upload, Video, Image as ImageIcon, 
  Plus, Loader2, Sparkles, Building, User, Building2, Phone, Calendar, RefreshCw,
  UserCheck, MapPin
} from "lucide-react";

interface MediaItem {
  url: string;
  type: "image" | "video";
  fileName?: string;
}

interface PortfolioProject {
  id: string;
  author_type: "client" | "tsj" | "company";
  author_display_name: string;
  project_type: string;
  title: string | null;
  review_text: string;
  rating: number;
  media_files: MediaItem[];
  status: "pending" | "approved" | "rejected";
  author_phone: string | null;
  client_info?: {
    is_registered_client?: boolean;
    user_id?: string;
    full_name?: string;
    phone?: string;
    email?: string;
    address?: string;
    apartment?: string;
    floor?: string;
    account_number?: string;
    is_verified?: boolean;
  };
  moderator_comment: string | null;
  created_at: string;
  approved_at: string | null;
}

/**
 * Компонент управления и модерации портфолио и отзывов клиентов в панели администратора.
 * Позволяет:
 * - Модерировать поступившие от клиентов фото/видео и отзывы (одобрить / отклонить);
 * - Просматривать медиафайлы;
 * - Добавлять новые официальные объекты компании.
 */
export const PortfolioManager = () => {
  const { toast } = useToast();
  const [projects, setProjects] = useState<PortfolioProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Стейты модального окна добавления объекта администратором
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newAuthorType, setNewAuthorType] = useState<"client" | "tsj" | "company">("tsj");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newProjectType, setNewProjectType] = useState("Умный домофон");
  const [newTitle, setNewTitle] = useState("");
  const [newReviewText, setNewReviewText] = useState("");
  const [newRating, setNewRating] = useState(5);
  const [newMediaFiles, setNewMediaFiles] = useState<MediaItem[]>([]);
  const [uploadingMedia, setUploadingMedia] = useState(false);

  // Загрузка проектов с бэкенда
  const fetchProjects = async () => {
    try {
      setLoading(true);
      console.log("[PortfolioManager] Запрос списка объектов портфолио...");
      const token = localStorage.getItem("token") || localStorage.getItem("admin_token");
      
      const res = await fetch("/backend-api/api/admin/portfolio", {
        headers: {
          "Authorization": token ? `Bearer ${token}` : ""
        }
      });

      if (!res.ok) {
        throw new Error("Не удалось загрузить объекты");
      }

      const data = await res.json();
      setProjects(data || []);
      console.log(`[PortfolioManager] Загружено ${data?.length || 0} объектов`);
    } catch (err: any) {
      console.error("[PortfolioManager] Ошибка загрузки проектов:", err);
      toast({
        title: "Ошибка загрузки",
        description: "Не удалось получить список объектов на модерацию",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  // Изменение статуса объекта (одобрить / отклонить)
  const handleUpdateStatus = async (id: string, newStatus: "approved" | "rejected") => {
    try {
      setActionLoading(id);
      console.log(`[PortfolioManager] Изменение статуса объекта ${id} на ${newStatus}`);
      const token = localStorage.getItem("token") || localStorage.getItem("admin_token");

      const res = await fetch(`/backend-api/api/admin/portfolio/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": token ? `Bearer ${token}` : ""
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (!res.ok) {
        throw new Error("Ошибка обновления статуса");
      }

      setProjects(prev => prev.map(p => p.id === id ? { ...p, status: newStatus } : p));
      toast({
        title: newStatus === "approved" ? "✅ Объект опубликован!" : "❌ Объект отклонен",
        description: newStatus === "approved" 
          ? "Теперь объект и отзыв отображаются в разделе «Наши работы»." 
          : "Объект скрыт от публикации."
      });
    } catch (err: any) {
      console.error("[PortfolioManager] Ошибка модерации:", err);
      toast({
        title: "Ошибка",
        description: "Не удалось обновить статус объекта",
        variant: "destructive"
      });
    } finally {
      setActionLoading(null);
    }
  };

  // Удаление объекта
  const handleDelete = async (id: string) => {
    if (!window.confirm("Вы уверены, что хотите безвозвратно удалить этот объект?")) return;

    try {
      setActionLoading(id);
      console.log(`[PortfolioManager] Удаление объекта ${id}`);
      const token = localStorage.getItem("token") || localStorage.getItem("admin_token");

      const res = await fetch(`/backend-api/api/admin/portfolio/${id}`, {
        method: "DELETE",
        headers: {
          "Authorization": token ? `Bearer ${token}` : ""
        }
      });

      if (!res.ok) throw new Error("Ошибка удаления");

      setProjects(prev => prev.filter(p => p.id !== id));
      toast({
        title: "🗑️ Удалено",
        description: "Объект успешно удален из базы данных."
      });
    } catch (err: any) {
      console.error("[PortfolioManager] Ошибка при удалении:", err);
      toast({
        title: "Ошибка",
        description: "Не удалось удалить объект",
        variant: "destructive"
      });
    } finally {
      setActionLoading(null);
    }
  };

  // Загрузка фото/видео через FileReader в Base64 на бэкенд
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingMedia(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        console.log(`[PortfolioManager] Загрузка файла: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} МБ)`);

        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        const res = await fetch("/backend-api/api/portfolio/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileBase64: base64,
            fileName: file.name,
            fileType: file.type
          })
        });

        if (!res.ok) throw new Error(`Ошибка загрузки ${file.name}`);
        const data = await res.json();
        setNewMediaFiles(prev => [...prev, { url: data.url, type: data.type, fileName: file.name }]);
      }

      toast({
        title: "Медиафайл загружен!",
        description: "Файлы успешно сохранены на сервере."
      });
    } catch (err: any) {
      console.error("[PortfolioManager] Ошибка загрузки файлов:", err);
      toast({
        title: "Ошибка загрузки файла",
        description: "Проверьте размер файла (до 50 МБ) и формат",
        variant: "destructive"
      });
    } finally {
      setUploadingMedia(false);
      e.target.value = "";
    }
  };

  // Создание нового объекта от администратора
  const handleCreateOfficialProject = async () => {
    if (!newDisplayName.trim()) {
      toast({ title: "Укажите автора/организацию", variant: "destructive" });
      return;
    }
    if (!newReviewText.trim()) {
      toast({ title: "Укажите описание работ", variant: "destructive" });
      return;
    }

    try {
      setActionLoading("create");
      const token = localStorage.getItem("token") || localStorage.getItem("admin_token");

      // Сразу создаем со статусом approved (так как добавляет администратор)
      const res = await fetch("/backend-api/api/portfolio", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          author_type: newAuthorType,
          author_display_name: newDisplayName.trim(),
          project_type: newProjectType,
          title: newTitle.trim() || null,
          review_text: newReviewText.trim(),
          rating: newRating,
          media_files: newMediaFiles
        })
      });

      if (!res.ok) throw new Error("Ошибка создания объекта");
      const result = await res.json();

      // Автоматически одобряем созданный админом объект
      if (result.project?.id) {
        await fetch(`/backend-api/api/admin/portfolio/${result.project.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "Authorization": token ? `Bearer ${token}` : ""
          },
          body: JSON.stringify({ status: "approved" })
        });
      }

      toast({
        title: "🎉 Объект добавлен и опубликован!",
        description: "Работа сразу видна на сайте в разделе «Наши работы»."
      });

      setIsAddDialogOpen(false);
      setNewDisplayName("");
      setNewTitle("");
      setNewReviewText("");
      setNewMediaFiles([]);
      fetchProjects();
    } catch (err: any) {
      console.error("[PortfolioManager] Ошибка создания проекта:", err);
      toast({
        title: "Ошибка добавления",
        description: err.message,
        variant: "destructive"
      });
    } finally {
      setActionLoading(null);
    }
  };

  // Фильтрация проектов по статусу
  const filteredProjects = projects.filter(p => {
    if (activeTab === "all") return true;
    return p.status === activeTab;
  });

  const pendingCount = projects.filter(p => p.status === "pending").length;

  return (
    <div className="space-y-6">
      {/* Шапка раздела */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <span>Модерация объектов и отзывов</span>
            {pendingCount > 0 && (
              <Badge variant="destructive" className="animate-pulse">
                +{pendingCount} на модерации
              </Badge>
            )}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Проверяйте фото, видео и отзывы клиентов перед публикацией на сайте в разделе «Наши работы».
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchProjects} disabled={loading} className="gap-1.5">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            <span>Обновить</span>
          </Button>

          <Button onClick={() => setIsAddDialogOpen(true)} size="sm" className="gradient-primary text-primary-foreground gap-1.5 shadow-sm">
            <Plus className="h-4 w-4" />
            <span>Добавить объект</span>
          </Button>
        </div>
      </div>

      {/* Вкладки фильтрации */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-muted/60 p-1 rounded-xl">
          <TabsTrigger value="all" className="text-xs sm:text-sm">
            Все ({projects.length})
          </TabsTrigger>
          <TabsTrigger value="pending" className="text-xs sm:text-sm gap-1.5">
            <span>На модерации</span>
            {pendingCount > 0 && (
              <span className="h-4 min-w-4 px-1 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center">
                {pendingCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="approved" className="text-xs sm:text-sm">
            Опубликованные ({projects.filter(p => p.status === "approved").length})
          </TabsTrigger>
          <TabsTrigger value="rejected" className="text-xs sm:text-sm">
            Отклоненные ({projects.filter(p => p.status === "rejected").length})
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Список объектов */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin mr-3 text-primary" />
          <span>Загрузка объектов портфолио...</span>
        </div>
      ) : filteredProjects.length === 0 ? (
        <Card className="p-12 text-center border-dashed">
          <Sparkles className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-60" />
          <h3 className="text-base font-semibold text-foreground">Объектов пока нет</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            {activeTab === "pending"
              ? "Новых заявок на модерацию нет. Все объекты проверены."
              : "Нажмите кнопку «Добавить объект», чтобы разместить первую официальную работу компании."}
          </p>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredProjects.map((project) => (
            <Card key={project.id} className="overflow-hidden flex flex-col justify-between border-border/70 hover:shadow-md transition-shadow">
              <div>
                {/* Медиа-галерея в шапке карточки */}
                {project.media_files && project.media_files.length > 0 ? (
                  <div className="relative h-48 bg-slate-950 overflow-hidden group">
                    {project.media_files[0].type === "video" ? (
                      <video 
                        src={project.media_files[0].url} 
                        controls 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <img 
                        src={project.media_files[0].url} 
                        alt="Фото объекта" 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    )}
                    {project.media_files.length > 1 && (
                      <Badge className="absolute top-2 right-2 bg-black/70 text-white backdrop-blur-md text-[10px]">
                        +{project.media_files.length - 1} медиа
                      </Badge>
                    )}
                  </div>
                ) : (
                  <div className="h-32 bg-muted/40 flex items-center justify-center text-muted-foreground text-xs">
                    <ImageIcon className="h-6 w-6 mr-2 opacity-50" />
                    <span>Без медиафайлов</span>
                  </div>
                )}

                <CardHeader className="pb-3 pt-4">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <Badge variant="outline" className="text-xs font-semibold">
                      {project.project_type}
                    </Badge>
                    <Badge
                      className={
                        project.status === "approved"
                          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                          : project.status === "pending"
                          ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30"
                          : "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30"
                      }
                    >
                      {project.status === "approved" && "✅ Опубликован"}
                      {project.status === "pending" && "⏳ На модерации"}
                      {project.status === "rejected" && "❌ Отклонен"}
                    </Badge>
                  </div>

                  <CardTitle className="text-base font-bold leading-tight flex items-center gap-1.5">
                    {project.author_type === "tsj" && <Building className="h-4 w-4 text-primary shrink-0" />}
                    {project.author_type === "company" && <Building2 className="h-4 w-4 text-primary shrink-0" />}
                    {project.author_type === "client" && <User className="h-4 w-4 text-primary shrink-0" />}
                    <span>{project.author_display_name}</span>
                  </CardTitle>

                  {project.title && (
                    <CardDescription className="text-xs font-medium text-foreground">
                      {project.title}
                    </CardDescription>
                  )}
                </CardHeader>

                <CardContent className="space-y-3 pb-3">
                  {/* Рейтинг */}
                  <div className="flex items-center gap-1 text-amber-400">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star 
                        key={i} 
                        className={`h-3.5 w-3.5 ${i < project.rating ? "fill-amber-400" : "text-slate-300 dark:text-slate-700"}`} 
                      />
                    ))}
                  </div>

                  {/* Текст отзыва */}
                  <p className="text-xs text-muted-foreground leading-relaxed bg-muted/30 p-2.5 rounded-lg border border-border/40 italic">
                    «{project.review_text}»
                  </p>

                  {/* Блок информации о заявителе для модератора */}
                  <div className="pt-2 border-t border-border/40 space-y-1.5 text-[11px]">
                    {project.client_info?.is_registered_client ? (
                      <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-950 dark:text-emerald-200 space-y-1">
                        <div className="flex items-center justify-between font-semibold">
                          <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                            <UserCheck className="h-3.5 w-3.5" />
                            <span>Наш абонент (ЛК)</span>
                          </span>
                          {project.client_info.account_number && (
                            <Badge variant="outline" className="text-[10px] h-4 bg-emerald-500/15 border-emerald-500/30 text-emerald-700 dark:text-emerald-300">
                              Л/С: {project.client_info.account_number}
                            </Badge>
                          )}
                        </div>

                        {project.client_info.full_name && (
                          <div className="font-medium text-foreground">
                            ФИО: <span className="font-semibold">{project.client_info.full_name}</span>
                          </div>
                        )}

                        {(project.client_info.phone || project.author_phone) && (
                          <div className="flex items-center gap-1 text-primary font-medium">
                            <Phone className="h-3 w-3 shrink-0" />
                            <a href={`tel:${project.client_info.phone || project.author_phone}`} className="hover:underline">
                              {project.client_info.phone || project.author_phone}
                            </a>
                          </div>
                        )}

                        {project.client_info.address && (
                          <div className="text-muted-foreground flex items-start gap-1">
                            <MapPin className="h-3 w-3 shrink-0 mt-0.5 text-muted-foreground" />
                            <span>
                              {project.client_info.address}
                              {project.client_info.apartment ? `, кв. ${project.client_info.apartment}` : ""}
                              {project.client_info.floor ? `, этаж ${project.client_info.floor}` : ""}
                            </span>
                          </div>
                        )}

                        {project.client_info.email && (
                          <div className="text-muted-foreground">
                            Email: {project.client_info.email}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="p-2.5 rounded-lg bg-muted/40 border border-border/50 space-y-1 text-muted-foreground">
                        <div className="flex items-center gap-1 font-semibold text-foreground">
                          <User className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>Сторонний пользователь / Гость</span>
                        </div>
                        {project.author_display_name && (
                          <div>ФИО / Имя: <span className="font-medium text-foreground">{project.author_display_name}</span></div>
                        )}
                        {project.author_phone ? (
                          <div className="flex items-center gap-1 text-primary font-medium">
                            <Phone className="h-3 w-3" />
                            <a href={`tel:${project.author_phone}`} className="hover:underline">
                              {project.author_phone}
                            </a>
                            <span className="text-[10px] text-muted-foreground">(для связи)</span>
                          </div>
                        ) : (
                          <div className="text-destructive text-[10px]">Телефон не указан</div>
                        )}
                      </div>
                    )}

                    <div className="flex items-center gap-1 text-muted-foreground pt-0.5">
                      <Calendar className="h-3 w-3" />
                      <span>Дата: {new Date(project.created_at).toLocaleString("ru-RU")}</span>
                    </div>
                  </div>
                </CardContent>
              </div>

              {/* Кнопки модерации */}
              <div className="p-3 border-t border-border/50 bg-muted/20 flex items-center justify-between gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDelete(project.id)}
                  disabled={actionLoading === project.id}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 px-2 text-xs"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>

                <div className="flex items-center gap-1.5">
                  {project.status !== "rejected" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleUpdateStatus(project.id, "rejected")}
                      disabled={actionLoading === project.id}
                      className="h-8 text-xs text-red-600 border-red-300 hover:bg-red-50 dark:hover:bg-red-950/20"
                    >
                      <XCircle className="h-3.5 w-3.5 mr-1" />
                      Отклонить
                    </Button>
                  )}

                  {project.status !== "approved" && (
                    <Button
                      size="sm"
                      onClick={() => handleUpdateStatus(project.id, "approved")}
                      disabled={actionLoading === project.id}
                      className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                      Одобрить
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Диалог добавления официального объекта от компании */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Добавить объект в портфолио</DialogTitle>
            <DialogDescription>
              Размещение официального объекта компании или проверенного отзыва ТСЖ.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-3 gap-2">
              <Button
                type="button"
                variant={newAuthorType === "tsj" ? "default" : "outline"}
                size="sm"
                onClick={() => setNewAuthorType("tsj")}
                className="text-xs"
              >
                ТСЖ / Совет дома
              </Button>
              <Button
                type="button"
                variant={newAuthorType === "client" ? "default" : "outline"}
                size="sm"
                onClick={() => setNewAuthorType("client")}
                className="text-xs"
              >
                Частный клиент
              </Button>
              <Button
                type="button"
                variant={newAuthorType === "company" ? "default" : "outline"}
                size="sm"
                onClick={() => setNewAuthorType("company")}
                className="text-xs"
              >
                Организация
              </Button>
            </div>

            <div>
              <Label className="text-xs font-semibold">Имя / Название ТСЖ *</Label>
              <Input
                placeholder={newAuthorType === "tsj" ? "ТСЖ «Солнечное»" : "Иван Иванович (житель дома)"}
                value={newDisplayName}
                onChange={(e) => setNewDisplayName(e.target.value)}
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">Тип работ</Label>
                <select
                  value={newProjectType}
                  onChange={(e) => setNewProjectType(e.target.value)}
                  className="w-full h-10 mt-1 px-3 rounded-md border border-input bg-background text-sm"
                >
                  <option value="Умный домофон">Умный домофон (SIP)</option>
                  <option value="Домофония">Установка домофонии</option>
                  <option value="Видеонаблюдение">Видеонаблюдение</option>
                  <option value="СКУД / Калитка">СКУД / Калитка / Шлагбаум</option>
                  <option value="Модернизация">Модернизация системы</option>
                </select>
              </div>

              <div>
                <Label className="text-xs font-semibold">Оценка</Label>
                <select
                  value={newRating}
                  onChange={(e) => setNewRating(Number(e.target.value))}
                  className="w-full h-10 mt-1 px-3 rounded-md border border-input bg-background text-sm"
                >
                  <option value={5}>⭐️⭐️⭐️⭐️⭐️ (5 из 5)</option>
                  <option value={4}>⭐️⭐️⭐️⭐️ (4 из 5)</option>
                  <option value={3}>⭐️⭐️⭐️ (3 из 5)</option>
                </select>
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold">Краткий заголовок (необязательно)</Label>
              <Input
                placeholder="Монтаж IP-видеодомофона на 4 подъезда"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold">Текст отзыва / описание выполненных работ *</Label>
              <Textarea
                placeholder="Опишите, какие работы были выполнены, какое оборудование установлено и впечатления жильцов..."
                value={newReviewText}
                onChange={(e) => setNewReviewText(e.target.value)}
                rows={3}
                className="mt-1"
              />
            </div>

            {/* Загрузка фото и видео */}
            <div>
              <Label className="text-xs font-semibold block mb-1">Фотографии и видео</Label>
              <div className="flex flex-wrap gap-2 mb-2">
                {newMediaFiles.map((m, idx) => (
                  <div key={idx} className="relative w-20 h-20 rounded-lg overflow-hidden border border-border group bg-slate-900">
                    {m.type === "video" ? (
                      <video src={m.url} className="w-full h-full object-cover" />
                    ) : (
                      <img src={m.url} alt="" className="w-full h-full object-cover" />
                    )}
                    <button
                      type="button"
                      onClick={() => setNewMediaFiles(prev => prev.filter((_, i) => i !== idx))}
                      className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      ×
                    </button>
                  </div>
                ))}

                <label className="w-20 h-20 rounded-lg border-2 border-dashed border-border/80 hover:border-primary/80 cursor-pointer flex flex-col items-center justify-center text-muted-foreground hover:text-primary transition-colors">
                  <Upload className="h-5 w-5 mb-1" />
                  <span className="text-[10px]">Файл</span>
                  <input
                    type="file"
                    multiple
                    accept="image/*,video/*"
                    onChange={handleFileUpload}
                    className="hidden"
                    disabled={uploadingMedia}
                  />
                </label>
              </div>
              {uploadingMedia && (
                <p className="text-xs text-primary flex items-center gap-1.5 animate-pulse">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Сохранение медиафайлов на сервере...</span>
                </p>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Отмена
            </Button>
            <Button
              onClick={handleCreateOfficialProject}
              disabled={actionLoading === "create" || uploadingMedia}
              className="gradient-primary text-primary-foreground font-semibold"
            >
              {actionLoading === "create" && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
              Опубликовать на сайте
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
