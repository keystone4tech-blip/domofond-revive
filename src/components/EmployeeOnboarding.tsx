import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { uploadFile } from "@/lib/upload";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, HeartHandshake, Phone, Cake, MapPin, User as UserIcon, Camera, Upload, RefreshCw, Check, ArrowLeft } from "lucide-react";

// ============================================================================
// Анкета сотрудника (2 шага). Дружелюбная форма активации назначения.
//   Шаг 1 — данные о себе (ФИО, телефон, дата рождения, адрес), префилл из профиля.
//   Шаг 2 — фотография: селфи с камеры ИЛИ загрузка файла. Сохраняется в карточку.
//   blocking = true  → нельзя закрыть, пока не заполнит (новые назначенные)
//   blocking = false → можно отложить (действующие сотрудники)
// ============================================================================

interface EmployeeOnboardingProps {
  userId: string;
  open: boolean;
  blocking?: boolean;
  onClose: () => void;
  onCompleted?: () => void;
}

export const EmployeeOnboarding = ({ userId, open, blocking = false, onClose, onCompleted }: EmployeeOnboardingProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState({
    full_name: "",
    contact_phone: "",
    date_of_birth: "",
    residence_address: "",
  });

  // Фото: превью (dataURL или существующий URL), новый файл/снимок для загрузки
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [existingPhotoUrl, setExistingPhotoUrl] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Префилл данных из записи сотрудника и профиля
  useEffect(() => {
    if (!open || !userId) return;
    setStep(1);
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [{ data: emp }, { data: prof }] = await Promise.all([
          supabase.from("employees").select("*").eq("user_id", userId).maybeSingle(),
          supabase.from("profiles").select("full_name, phone, address").eq("id", userId).maybeSingle(),
        ]);
        if (cancelled) return;
        setForm({
          full_name: (emp as any)?.full_name || (prof as any)?.full_name || "",
          contact_phone: (emp as any)?.contact_phone || (emp as any)?.phone || (prof as any)?.phone || "",
          date_of_birth: (emp as any)?.date_of_birth ? String((emp as any).date_of_birth).slice(0, 10) : "",
          residence_address: (emp as any)?.residence_address || (prof as any)?.address || "",
        });
        const existing = (emp as any)?.photo_url || null;
        setExistingPhotoUrl(existing);
        setPhotoPreview(existing);
        setPhotoBlob(null);
      } catch (e) {
        console.warn("[EmployeeOnboarding] Ошибка префилла анкеты:", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, userId]);

  // Останавливаем камеру при закрытии/размонтировании
  const stopCamera = () => {
    try { streamRef.current?.getTracks().forEach((t) => t.stop()); } catch { /* ignore */ }
    streamRef.current = null;
    setCameraActive(false);
  };
  useEffect(() => {
    if (!open) stopCamera();
    return () => stopCamera();
  }, [open]);

  const todayStr = new Date().toISOString().slice(0, 10);

  const validateStep1 = (): string | null => {
    if (!form.full_name.trim()) return "Пожалуйста, укажите полное ФИО";
    if (!form.date_of_birth) return "Пожалуйста, укажите дату рождения";
    const dob = new Date(form.date_of_birth);
    if (isNaN(dob.getTime())) return "Проверьте дату рождения";
    const age = (Date.now() - dob.getTime()) / (365.25 * 24 * 3600 * 1000);
    if (dob > new Date()) return "Дата рождения не может быть в будущем";
    if (age < 14 || age > 100) return "Проверьте дату рождения";
    if (!form.residence_address.trim()) return "Пожалуйста, укажите адрес проживания";
    return null;
  };

  const goToStep2 = () => {
    const err = validateStep1();
    if (err) {
      toast({ title: "Проверьте анкету", description: err, variant: "destructive" });
      return;
    }
    setStep(2);
  };

  // Запуск камеры для селфи
  const startCamera = async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      streamRef.current = stream;
      setCameraActive(true);
      // Привязываем поток к video после рендера
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      }, 50);
    } catch (e: any) {
      console.warn("[EmployeeOnboarding] Камера недоступна:", e);
      setCameraError("Камера недоступна. Разрешите доступ в браузере или загрузите фото файлом.");
      setCameraActive(false);
    }
  };

  // Сделать снимок с камеры
  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video) return;
    const w = video.videoWidth || 640;
    const h = video.videoHeight || 480;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, w, h);
    canvas.toBlob((blob) => {
      if (blob) {
        setPhotoBlob(blob);
        setPhotoPreview(URL.createObjectURL(blob));
        stopCamera();
      }
    }, "image/jpeg", 0.9);
  };

  // Выбор фото файлом
  const handleFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Нужен файл-изображение", description: "Выберите фотографию (jpg, png).", variant: "destructive" });
      return;
    }
    setPhotoBlob(file);
    setPhotoPreview(URL.createObjectURL(file));
    stopCamera();
  };

  const resetPhoto = () => {
    setPhotoBlob(null);
    setPhotoPreview(null);
    setCameraError(null);
  };

  const handleSubmit = async () => {
    if (!photoPreview && !existingPhotoUrl) {
      toast({ title: "Добавьте фото", description: "Сделайте селфи или загрузите фотографию.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      // Если выбран новый снимок/файл — загружаем его и получаем URL
      let photoUrl: string | null = existingPhotoUrl;
      if (photoBlob) {
        const named = photoBlob instanceof File
          ? photoBlob
          : new File([photoBlob], `selfie_${Date.now()}.jpg`, { type: "image/jpeg" });
        photoUrl = await uploadFile(named, "employees");
      }

      let token = "";
      try { token = localStorage.getItem("auth_token") || sessionStorage.getItem("auth_token") || ""; } catch { /* ignore */ }
      const resp = await fetch("/backend-api/api/employees/complete-profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          full_name: form.full_name.trim(),
          contact_phone: form.contact_phone.trim() || null,
          date_of_birth: form.date_of_birth,
          residence_address: form.residence_address.trim(),
          photo_url: photoUrl,
        }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(json?.error || `Ошибка ${resp.status}`);
      toast({ title: "Спасибо!", description: "Анкета сохранена, доступ активирован. Добро пожаловать в команду!" });
      stopCamera();
      onCompleted?.();
      onClose();
    } catch (e: any) {
      toast({ title: "Не удалось сохранить анкету", description: e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !blocking) { stopCamera(); onClose(); } }}>
      <DialogContent
        className="max-w-md"
        onInteractOutside={(e) => { if (blocking) e.preventDefault(); }}
        onEscapeKeyDown={(e) => { if (blocking) e.preventDefault(); }}
      >
        <DialogHeader>
          <DialogTitle className="text-lg font-bold flex items-center gap-2">
            <HeartHandshake className="h-5 w-5 text-primary" />
            Добро пожаловать в команду!
          </DialogTitle>
        </DialogHeader>

        {/* Индикатор шагов */}
        <div className="flex items-center gap-2 -mt-1">
          <div className={`flex-1 h-1.5 rounded-full ${step >= 1 ? "bg-primary" : "bg-muted"}`} />
          <div className={`flex-1 h-1.5 rounded-full ${step >= 2 ? "bg-primary" : "bg-muted"}`} />
        </div>
        <p className="text-xs text-muted-foreground">Шаг {step} из 2 — {step === 1 ? "данные о себе" : "фотография"}</p>

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : step === 1 ? (
          <div className="space-y-3.5 mt-1">
            <p className="text-sm text-muted-foreground">
              Вас назначили сотрудником Домофондар. Чтобы активировать доступ, расскажите немного о себе.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="eo_name" className="text-xs font-bold flex items-center gap-1.5">
                <UserIcon className="h-3.5 w-3.5" /> Полное ФИО
              </Label>
              <Input id="eo_name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="Иванов Иван Иванович" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="eo_phone" className="text-xs font-bold flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5" /> Телефон для связи
              </Label>
              <Input id="eo_phone" value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} placeholder="+7 (___) ___-__-__" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="eo_dob" className="text-xs font-bold flex items-center gap-1.5">
                <Cake className="h-3.5 w-3.5" /> Дата рождения
              </Label>
              <Input id="eo_dob" type="date" max={todayStr} value={form.date_of_birth} onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="eo_addr" className="text-xs font-bold flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" /> Адрес проживания
              </Label>
              <Input id="eo_addr" value={form.residence_address} onChange={(e) => setForm({ ...form, residence_address: e.target.value })} placeholder="Город, улица, дом, квартира" />
            </div>

            <div className="flex gap-2 pt-1">
              {!blocking && (
                <Button type="button" variant="ghost" className="flex-1" onClick={() => { stopCamera(); onClose(); }}>
                  Позже
                </Button>
              )}
              <Button type="button" className="flex-1" onClick={goToStep2}>
                Далее
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3.5 mt-1">
            <p className="text-sm text-muted-foreground">
              Последний шаг — ваша фотография для карточки сотрудника. Сделайте селфи или загрузите фото.
            </p>

            {/* Область превью / камеры */}
            <div className="rounded-2xl border bg-muted/40 overflow-hidden aspect-[4/3] flex items-center justify-center relative">
              {cameraActive ? (
                <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />
              ) : photoPreview ? (
                <img src={photoPreview} alt="Фото сотрудника" className="w-full h-full object-cover" />
              ) : (
                <div className="text-center text-muted-foreground p-6">
                  <Camera className="h-10 w-10 mx-auto mb-2 opacity-60" />
                  <p className="text-xs">Фото ещё не добавлено</p>
                </div>
              )}
            </div>

            {cameraError && <p className="text-xs text-destructive">{cameraError}</p>}

            {/* Кнопки управления фото */}
            {cameraActive ? (
              <div className="flex gap-2">
                <Button type="button" variant="outline" className="flex-1 gap-1.5" onClick={stopCamera}>Отмена</Button>
                <Button type="button" className="flex-1 gap-1.5" onClick={capturePhoto}>
                  <Camera className="h-4 w-4" /> Сфотографировать
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Button type="button" variant="outline" className="flex-1 gap-1.5" onClick={startCamera}>
                  <Camera className="h-4 w-4" /> {photoPreview ? "Переснять" : "Селфи с камеры"}
                </Button>
                <Button type="button" variant="outline" className="flex-1 gap-1.5" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="h-4 w-4" /> Загрузить фото
                </Button>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFilePick} />
              </div>
            )}

            {photoPreview && !cameraActive && (
              <button type="button" onClick={resetPhoto} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mx-auto">
                <RefreshCw className="h-3 w-3" /> Убрать фото
              </button>
            )}

            <div className="flex gap-2 pt-1">
              <Button type="button" variant="ghost" className="gap-1.5" onClick={() => { stopCamera(); setStep(1); }} disabled={submitting}>
                <ArrowLeft className="h-4 w-4" /> Назад
              </Button>
              <Button type="button" className="flex-1 gap-1.5" onClick={handleSubmit} disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Сохранить и активировать
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default EmployeeOnboarding;
