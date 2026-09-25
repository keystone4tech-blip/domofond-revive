import { useState, useEffect } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { 
  Camera, Upload, Star, ChevronLeft, ChevronRight, Video, 
  Image as ImageIcon, Sparkles, Building, User, Building2, 
  CheckCircle2, Loader2, ShieldCheck, Heart, MessageSquarePlus 
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
  likes_count: number;
  created_at: string;
}

/**
 * Интерактивный компонент карусели фото и видео для карточки объекта
 */
const MediaCarousel = ({ media }: { media: MediaItem[] }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  if (!media || media.length === 0) {
    return (
      <div className="h-56 bg-gradient-to-br from-primary/10 via-background to-primary/5 flex items-center justify-center text-muted-foreground">
        <ImageIcon className="h-10 w-10 opacity-30" />
      </div>
    );
  }

  const currentItem = media[currentIndex] || media[0];

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev === 0 ? media.length - 1 : prev - 1));
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev === media.length - 1 ? 0 : prev + 1));
  };

  return (
    <div className="relative h-64 sm:h-72 w-full bg-slate-950 overflow-hidden group select-none">
      {/* Отображение текущего медиа: видео или фото */}
      {currentItem.type === "video" ? (
        <video
          src={currentItem.url}
          controls
          className="w-full h-full object-contain"
          playsInline
        />
      ) : (
        <img
          src={currentItem.url}
          alt="Фото объекта"
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
        />
      )}

      {/* Кнопки перелистывания (если медиа больше 1) */}
      {media.length > 1 && (
        <>
          <button
            type="button"
            onClick={handlePrev}
            aria-label="Предыдущий слайд"
            className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-black/60 hover:bg-black/85 text-white flex items-center justify-center transition-all opacity-80 hover:opacity-100 backdrop-blur-sm shadow-md"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={handleNext}
            aria-label="Следующий слайд"
            className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-black/60 hover:bg-black/85 text-white flex items-center justify-center transition-all opacity-80 hover:opacity-100 backdrop-blur-sm shadow-md"
          >
            <ChevronRight className="h-5 w-5" />
          </button>

          {/* Индикаторы слайдов (точки) */}
          <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-2 py-1 rounded-full bg-black/50 backdrop-blur-sm">
            {media.map((_, idx) => (
              <span
                key={idx}
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentIndex(idx);
                }}
                className={`h-1.5 rounded-full transition-all cursor-pointer ${
                  idx === currentIndex ? "w-4 bg-white" : "w-1.5 bg-white/50"
                }`}
              />
            ))}
          </div>

          {/* Счетчик слайдов */}
          <div className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-black/60 text-white text-[11px] font-medium backdrop-blur-sm">
            {currentIndex + 1} / {media.length}
          </div>
        </>
      )}

      {/* Бейдж типа медиа (видео/фото) */}
      {currentItem.type === "video" && (
        <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-blue-600/90 text-white text-[10px] font-bold flex items-center gap-1 backdrop-blur-sm">
          <Video className="h-3 w-3" />
          <span>Видео</span>
        </div>
      )}
    </div>
  );
};

/**
 * Страница «Наши работы и отзывы клиентов» ООО «ДомофонДар»
 * - Полностью исключены фиктивные заглушки.
 * - Позволяет клиентам и ТСЖ самостоятельно делиться фото/видео и отзывами.
 * - Контент публикуется после CRM-модерации.
 * - Без раскрытия личных персональных данных (точных адресов).
 */
const NashiRaboty = () => {
  const { toast } = useToast();
  const [projects, setProjects] = useState<PortfolioProject[]>([]);
  const [loading, setLoading] = useState(true);

  // Стейты формы добавления отзыва / объекта от пользователя
  const [isSubmitOpen, setIsSubmitOpen] = useState(false);
  const [authorType, setAuthorType] = useState<"client" | "tsj" | "company">("client");
  const [displayName, setDisplayName] = useState("");
  const [projectType, setProjectType] = useState("Умный домофон");
  const [title, setTitle] = useState("");
  const [reviewText, setReviewText] = useState("");
  const [rating, setRating] = useState(5);
  const [authorPhone, setAuthorPhone] = useState("");
  const [mediaFiles, setMediaFiles] = useState<MediaItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Загрузка опубликованных объектов с бэкенда
  const fetchPublishedProjects = async () => {
    try {
      setLoading(true);
      console.log("[NashiRaboty] Запрос опубликованных объектов портфолио...");
      const res = await fetch("/backend-api/api/portfolio");
      if (!res.ok) throw new Error("Ошибка загрузки портфолио");
      const data = await res.json();
      setProjects(data || []);
      console.log(`[NashiRaboty] Получено ${data?.length || 0} опубликованных объектов`);
    } catch (err) {
      console.warn("[NashiRaboty] Ошибка загрузки объектов:", err);
      setProjects([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPublishedProjects();
    loadCurrentUserProfile();
  }, []);

  // Если пользователь авторизован, автоматически подставляем его Имя Отчество из базы
  const loadCurrentUserProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, phone")
          .eq("id", user.id)
          .maybeSingle();

        if (profile?.full_name) {
          // Извлекаем Имя и Отчество (без фамилии для конфиденциальности, либо полное имя)
          const parts = profile.full_name.trim().split(/\s+/);
          let safeName = profile.full_name;
          if (parts.length >= 2) {
            // Например: Иван Иванович
            safeName = parts.length >= 3 ? `${parts[1]} ${parts[2]}` : `${parts[0]} ${parts[1]}`;
          }
          console.log(`[NashiRaboty] Подставлено имя авторизованного клиента: ${safeName}`);
          setDisplayName(safeName);
        }
        if (profile?.phone) {
          setAuthorPhone(profile.phone);
        }
      }
    } catch (err) {
      console.warn("[NashiRaboty] Не удалось загрузить профиль текущего пользователя:", err);
    }
  };

  // Загрузка медиафайлов (фото/видео) через бэкенд
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (mediaFiles.length + files.length > 5) {
      toast({
        title: "Лимит файлов",
        description: "Можно прикрепить до 5 фото или видео",
        variant: "destructive"
      });
      return;
    }

    setUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        // Проверка размера (до 50 МБ)
        if (file.size > 50 * 1024 * 1024) {
          toast({
            title: `Файл ${file.name} слишком большой`,
            description: "Максимальный размер файла — 50 МБ",
            variant: "destructive"
          });
          continue;
        }

        console.log(`[NashiRaboty] Загрузка файла: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} МБ)`);

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
        setMediaFiles((prev) => [...prev, { url: data.url, type: data.type, fileName: file.name }]);
      }

      toast({
        title: "Медиафайл загружен!",
        description: "Файлы успешно подготовлены к отправке."
      });
    } catch (err: any) {
      console.error("[NashiRaboty] Ошибка загрузки медиа:", err);
      toast({
        title: "Ошибка загрузки",
        description: "Не удалось сохранить файл. Попробуйте еще раз.",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  // Отправка заявки на модерацию
  const handleSubmitReview = async () => {
    if (!displayName.trim()) {
      toast({ title: "Укажите ваше имя или ТСЖ", variant: "destructive" });
      return;
    }
    if (!reviewText.trim()) {
      toast({ title: "Напишите ваш отзыв или описание", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      console.log("[NashiRaboty] Отправка объекта на модерацию...");
      const res = await fetch("/backend-api/api/portfolio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          author_type: authorType,
          author_display_name: displayName.trim(),
          project_type: projectType,
          title: title.trim() || null,
          review_text: reviewText.trim(),
          rating,
          media_files: mediaFiles,
          author_phone: authorPhone.trim() || null
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Ошибка отправки");
      }

      toast({
        title: "🎉 Спасибо за ваш отзыв!",
        description: "Ваш материал отправлен на быструю модерацию. После проверки он появится на сайте!"
      });

      setIsSubmitOpen(false);
      setTitle("");
      setReviewText("");
      setMediaFiles([]);
    } catch (err: any) {
      console.error("[NashiRaboty] Ошибка отправки:", err);
      toast({
        title: "Ошибка отправки",
        description: err.message,
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1">
        {/* Шапка раздела */}
        <section className="py-10 md:py-16 bg-gradient-to-br from-primary/10 via-background to-primary/5 border-b border-border/50">
          <div className="container px-4 max-w-5xl mx-auto text-center">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold section-title-gradient mb-4">
              Наши работы и отзывы клиентов
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed mb-8">
              Честные примеры установленных систем домофонии, видеонаблюдения и СКУД в Краснодаре с живыми фотографиями и видео от жителей и ТСЖ.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button
                size="lg"
                onClick={() => setIsSubmitOpen(true)}
                className="gradient-primary text-primary-foreground font-semibold px-6 py-6 rounded-2xl shadow-lg hover:shadow-xl transition-all gap-2 text-sm sm:text-base cursor-pointer"
              >
                <MessageSquarePlus className="h-5 w-5" />
                <span>Поделиться фото/видео или отзывом</span>
              </Button>
            </div>
          </div>
        </section>

        {/* Основной контент */}
        <section className="py-10 md:py-14">
          <div className="container px-4 max-w-6xl mx-auto">
            {loading ? (
              <div className="flex items-center justify-center py-20 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin mr-3 text-primary" />
                <span>Загрузка объектов...</span>
              </div>
            ) : projects.length === 0 ? (
              /* Честный блок: раздел наполняется реальными объектами, фейки исключены */
              <div className="max-w-3xl mx-auto">
                <Card className="glass-premium border-blue-200/60 dark:border-blue-900/40 p-6 sm:p-10 text-center rounded-3xl shadow-xl space-y-6">
                  <div className="h-16 w-16 rounded-2xl bg-primary/10 text-primary mx-auto flex items-center justify-center shadow-inner">
                    <Camera className="h-8 w-8" />
                  </div>

                  <div className="space-y-3">
                    <Badge variant="outline" className="text-xs font-semibold px-3 py-1 rounded-full border-primary/30 text-primary bg-primary/5">
                      ✨ Запуск обновленного сайта • Без фейковых фото
                    </Badge>
                    <h2 className="text-xl sm:text-2xl font-bold text-foreground">
                      Готовим реальные фото- и видеоотчеты с объектов Краснодара
                    </h2>
                    <p className="text-sm sm:text-base text-muted-foreground leading-relaxed max-w-2xl mx-auto">
                      Мы запустили новую версию сайта и принципиально не используем чужие картинки из интернета. Сейчас наши инженеры и мастера отбирают живые кадры монтажа вызывных панелей Метаком, Цифрал, IP-домофонов Beward и систем видеонаблюдения.
                    </p>
                  </div>

                  {/* Карточка-призыв для жителей */}
                  <div className="p-5 rounded-2xl bg-blue-50/70 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-800/40 text-left space-y-2">
                    <div className="flex items-center gap-2 text-sm font-bold text-blue-900 dark:text-blue-300">
                      <ShieldCheck className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0" />
                      <span>Уже пользуетесь нашими домофонами?</span>
                    </div>
                    <p className="text-xs sm:text-sm text-blue-800 dark:text-blue-300 leading-relaxed">
                      Вы можете самостоятельно опубликовать фото вашего подъезда, калитки или короткое видео работы умного домофона. Точный адрес указывать не нужно — достаточно указать имя или название вашего ТСЖ. После быстрой проверки мы с гордостью разместим вашу историю здесь!
                    </p>
                  </div>

                  <div className="pt-2">
                    <Button
                      onClick={() => setIsSubmitOpen(true)}
                      className="gradient-primary text-primary-foreground font-semibold px-6 py-5 rounded-xl shadow-md gap-2"
                    >
                      <Camera className="h-4 w-4" />
                      <span>Добавить первое фото или отзыв</span>
                    </Button>
                  </div>
                </Card>
              </div>
            ) : (
              /* Вывод одобренных объектов в виде карточек с каруселями */
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {projects.map((project) => (
                  <Card key={project.id} className="overflow-hidden flex flex-col justify-between border-border/70 hover:shadow-xl transition-all duration-300 rounded-2xl bg-card">
                    <div>
                      {/* Карусель медиафайлов (фото / видео) */}
                      <MediaCarousel media={project.media_files} />

                      <div className="p-5 space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <Badge variant="secondary" className="text-xs font-semibold">
                            {project.project_type}
                          </Badge>

                          {/* Звезды рейтинга */}
                          <div className="flex items-center gap-0.5 text-amber-400">
                            {Array.from({ length: project.rating || 5 }).map((_, i) => (
                              <Star key={i} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                            ))}
                          </div>
                        </div>

                        {/* Автор */}
                        <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                          {project.author_type === "tsj" && <Building className="h-4 w-4 text-primary shrink-0" />}
                          {project.author_type === "company" && <Building2 className="h-4 w-4 text-primary shrink-0" />}
                          {project.author_type === "client" && <User className="h-4 w-4 text-primary shrink-0" />}
                          <span>{project.author_display_name}</span>
                        </div>

                        {project.title && (
                          <h3 className="text-sm font-semibold text-foreground leading-snug">
                            {project.title}
                          </h3>
                        )}

                        {/* Текст отзыва */}
                        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed italic bg-muted/30 p-3 rounded-xl border border-border/40">
                          «{project.review_text}»
                        </p>
                      </div>
                    </div>

                    <div className="px-5 py-3 border-t border-border/50 text-[11px] text-muted-foreground flex items-center justify-between bg-muted/10">
                      <span>{new Date(project.created_at).toLocaleDateString("ru-RU")}</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Проверено модератором
                      </span>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Блок доверия */}
        <section className="py-10 bg-muted/30 border-t border-border/50">
          <div className="container px-4 max-w-5xl mx-auto">
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 text-center">
              <div className="p-4 rounded-2xl bg-background/50 border border-border/40">
                <div className="text-3xl font-extrabold text-primary mb-1">с 2005 г.</div>
                <div className="text-xs text-muted-foreground">20 лет опыта в Краснодаре</div>
              </div>
              <div className="p-4 rounded-2xl bg-background/50 border border-border/40">
                <div className="text-3xl font-extrabold text-primary mb-1">100+</div>
                <div className="text-xs text-muted-foreground">Домов на постоянном ТО</div>
              </div>
              <div className="p-4 rounded-2xl bg-background/50 border border-border/40">
                <div className="text-3xl font-extrabold text-primary mb-1">24/7</div>
                <div className="text-xs text-muted-foreground">Собственная служба мастеров</div>
              </div>
              <div className="p-4 rounded-2xl bg-background/50 border border-border/40">
                <div className="text-3xl font-extrabold text-primary mb-1">100%</div>
                <div className="text-xs text-muted-foreground">Официальная гарантия</div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Диалог добавления фото/видео и отзыва клиентом */}
      <Dialog open={isSubmitOpen} onOpenChange={setIsSubmitOpen}>
        <DialogContent className="sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-2xl p-5 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl font-bold flex items-center gap-2">
              <Camera className="h-5 w-5 text-primary" />
              <span>Поделитесь фото/видео или отзывом</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Точный адрес квартиры указывать не требуется. Все материалы проходят быструю проверку модератором.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-left">
            {/* Выбор типа автора */}
            <div>
              <Label className="text-xs font-semibold block mb-1.5">Кто публикует материал?</Label>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  type="button"
                  variant={authorType === "client" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setAuthorType("client")}
                  className="text-xs h-9"
                >
                  Частный клиент
                </Button>
                <Button
                  type="button"
                  variant={authorType === "tsj" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setAuthorType("tsj")}
                  className="text-xs h-9"
                >
                  ТСЖ / Дом
                </Button>
                <Button
                  type="button"
                  variant={authorType === "company" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setAuthorType("company")}
                  className="text-xs h-9"
                >
                  Компания
                </Button>
              </div>
            </div>

            {/* Имя / Название */}
            <div>
              <Label className="text-xs font-semibold">
                {authorType === "tsj" 
                  ? "Название ТСЖ / ЖСК / Совета дома *" 
                  : authorType === "company" 
                  ? "Название организации *" 
                  : "Ваше имя и отчество (без точного адреса) *"}
              </Label>
              <Input
                placeholder={
                  authorType === "tsj" 
                    ? "ТСЖ «Солнечный берег»" 
                    : authorType === "company" 
                    ? "ООО «Техносервис»" 
                    : "Алексей Михайлович (житель МКД)"
                }
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="mt-1"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                🔒 Для защиты личных данных точный адрес дома и квартиры не требуется.
              </p>
            </div>

            {/* Тип работ и оценка */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">Тип установленной системы</Label>
                <select
                  value={projectType}
                  onChange={(e) => setProjectType(e.target.value)}
                  className="w-full h-10 mt-1 px-3 rounded-xl border border-input bg-background text-xs sm:text-sm"
                >
                  <option value="Умный домофон">Умный домофон (SIP)</option>
                  <option value="Домофония">Установка домофона</option>
                  <option value="Видеонаблюдение">Видеонаблюдение двора/подъезда</option>
                  <option value="СКУД / Калитка">Калитка / Шлагбаум / СКУД</option>
                  <option value="Ремонт и ТО">Ремонт / Техническое обслуживание</option>
                </select>
              </div>

              <div>
                <Label className="text-xs font-semibold">Ваша оценка</Label>
                <div className="flex items-center gap-1.5 mt-2 text-amber-400">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      className="focus:outline-none transition-transform hover:scale-110"
                    >
                      <Star 
                        className={`h-6 w-6 ${star <= rating ? "fill-amber-400 text-amber-400" : "text-slate-300 dark:text-slate-700"}`} 
                      />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Отзыв / описание */}
            <div>
              <Label className="text-xs font-semibold">Ваш отзыв или описание работ *</Label>
              <Textarea
                placeholder="Расскажите о качестве монтажа, удобстве мобильного приложения, работе мастеров..."
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                rows={3}
                className="mt-1 text-sm rounded-xl"
              />
            </div>

            {/* Прикрепление фото и видео */}
            <div>
              <Label className="text-xs font-semibold block mb-1.5">Прикрепите фото или короткое видео (до 5 файлов)</Label>
              <div className="flex flex-wrap gap-2 mb-2">
                {mediaFiles.map((m, idx) => (
                  <div key={idx} className="relative w-20 h-20 rounded-xl overflow-hidden border border-border group bg-slate-900">
                    {m.type === "video" ? (
                      <video src={m.url} className="w-full h-full object-cover" />
                    ) : (
                      <img src={m.url} alt="" className="w-full h-full object-cover" />
                    )}
                    <button
                      type="button"
                      onClick={() => setMediaFiles((prev) => prev.filter((_, i) => i !== idx))}
                      className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/70 text-white flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      ×
                    </button>
                  </div>
                ))}

                {mediaFiles.length < 5 && (
                  <label className="w-20 h-20 rounded-xl border-2 border-dashed border-border/80 hover:border-primary/80 cursor-pointer flex flex-col items-center justify-center text-muted-foreground hover:text-primary transition-colors">
                    <Upload className="h-5 w-5 mb-1" />
                    <span className="text-[10px] text-center font-medium">Фото/Видео</span>
                    <input
                      type="file"
                      multiple
                      accept="image/*,video/*"
                      onChange={handleFileUpload}
                      className="hidden"
                      disabled={uploading}
                    />
                  </label>
                )}
              </div>

              {uploading && (
                <p className="text-xs text-primary flex items-center gap-1.5 animate-pulse">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Загрузка медиафайла на сервер...</span>
                </p>
              )}
            </div>

            {/* Контактный телефон (не публикуется) */}
            <div>
              <Label className="text-xs font-semibold">Контактный телефон (для модератора, на сайте не виден)</Label>
              <Input
                type="tel"
                placeholder="+7 (___) ___-__-__"
                value={authorPhone}
                onChange={(e) => setAuthorPhone(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-border/40">
            <Button variant="outline" onClick={() => setIsSubmitOpen(false)} disabled={submitting}>
              Отмена
            </Button>
            <Button
              onClick={handleSubmitReview}
              disabled={submitting || uploading}
              className="gradient-primary text-primary-foreground font-semibold px-5"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
              Отправить на модерацию
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
};

export default NashiRaboty;
