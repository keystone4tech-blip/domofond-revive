import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, HeartHandshake, Phone, Cake, MapPin, User as UserIcon } from "lucide-react";

// ============================================================================
// Анкета сотрудника. Дружелюбная форма: сотрудник заполняет данные о себе,
// чем активирует назначение. Префилл из профиля (ФИО, телефон, адрес).
// Используется и в личном кабинете (баннер), и при входе в CRM (попап).
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
  const [form, setForm] = useState({
    full_name: "",
    contact_phone: "",
    date_of_birth: "",
    residence_address: "",
  });

  // Префилл данных из записи сотрудника и профиля
  useEffect(() => {
    if (!open || !userId) return;
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
      } catch (e) {
        console.warn("[EmployeeOnboarding] Ошибка префилла анкеты:", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, userId]);

  const todayStr = new Date().toISOString().slice(0, 10);

  const validate = (): string | null => {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validate();
    if (err) {
      toast({ title: "Проверьте анкету", description: err, variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
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
        }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(json?.error || `Ошибка ${resp.status}`);
      toast({ title: "Спасибо!", description: "Анкета сохранена, доступ активирован. Добро пожаловать в команду!" });
      onCompleted?.();
      onClose();
    } catch (e: any) {
      toast({ title: "Не удалось сохранить анкету", description: e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !blocking) onClose(); }}>
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

        <p className="text-sm text-muted-foreground -mt-1">
          Вас назначили сотрудником Домофондар. Чтобы активировать доступ, расскажите немного о себе —
          это займёт меньше минуты.
        </p>

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3.5 mt-1">
            <div className="space-y-1.5">
              <Label htmlFor="eo_name" className="text-xs font-bold flex items-center gap-1.5">
                <UserIcon className="h-3.5 w-3.5" /> Полное ФИО
              </Label>
              <Input
                id="eo_name"
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                placeholder="Иванов Иван Иванович"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="eo_phone" className="text-xs font-bold flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5" /> Телефон для связи
              </Label>
              <Input
                id="eo_phone"
                value={form.contact_phone}
                onChange={(e) => setForm({ ...form, contact_phone: e.target.value })}
                placeholder="+7 (___) ___-__-__"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="eo_dob" className="text-xs font-bold flex items-center gap-1.5">
                <Cake className="h-3.5 w-3.5" /> Дата рождения
              </Label>
              <Input
                id="eo_dob"
                type="date"
                max={todayStr}
                value={form.date_of_birth}
                onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="eo_addr" className="text-xs font-bold flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" /> Адрес проживания
              </Label>
              <Input
                id="eo_addr"
                value={form.residence_address}
                onChange={(e) => setForm({ ...form, residence_address: e.target.value })}
                placeholder="Город, улица, дом, квартира"
                required
              />
            </div>

            <div className="flex gap-2 pt-1">
              {!blocking && (
                <Button type="button" variant="ghost" className="flex-1" onClick={onClose} disabled={submitting}>
                  Позже
                </Button>
              )}
              <Button type="submit" className="flex-1" disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Сохранить и активировать
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default EmployeeOnboarding;
