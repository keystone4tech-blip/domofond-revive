// ============================================================================
// Компонент: VerificationManager (Диспетчер FSM - Верификация жильцов)
// Назначение: Просмотр поступивших документов (выписки ЕГРН, паспорта с пропиской,
//             договоры аренды), подтверждение права доступа к умному домофону или
//             отклонение заявки с указанием точной причины.
// ============================================================================

import React, { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  CheckCircle,
  XCircle,
  Loader2,
  User,
  Phone,
  MapPin,
  Home,
  Edit,
  ShieldCheck,
  Clock,
  FileText,
  Eye,
  Maximize2,
  ExternalLink,
  AlertTriangle,
  FileCheck,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Интерфейс расширенного профиля пользователя
interface Profile {
  id: string;
  full_name: string | null;
  phone: string | null;
  address: string | null;
  apartment: string | null;
  floor?: string | null;
  email?: string | null;
  is_verified: boolean | null;
  verification_status?: string | null; // 'unverified' | 'pending' | 'verified' | 'rejected'
  verification_document_url?: string | null; // Data URL или ссылка на документ
  verification_document_type?: string | null; // 'egrn' | 'passport' | 'rent_contract' | 'other'
  verification_reject_reason?: string | null;
  verification_submitted_at?: string | null;
  verification_reviewed_at?: string | null;
  created_at: string | null;
  updated_at: string | null;
}

// Предустановленные причины отклонения верификации для быстрого выбора
const REJECT_REASONS = [
  "Нечитаемое, размытое или обрезанное фото документа",
  "Адрес в документе не совпадает с указанной квартирой",
  "ФИО в документе не совпадает с данными профиля",
  "Истек срок действия договора аренды жилья",
  "Прикреплен неподходящий документ (требуется ЕГРН, прописка или договор найма)",
];

const VerificationManager: React.FC = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Активная вкладка фильтра
  const [activeFilter, setActiveFilter] = useState<"pending" | "verified" | "rejected">("pending");

  // Выбранный профиль для просмотра в диалоге
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);

  // Режим редактирования реквизитов
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState({
    full_name: "",
    phone: "",
    address: "",
    apartment: "",
  });

  // Диалог отклонения с вводом причины
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [isRejecting, setIsRejecting] = useState(false);

  // Просмотр документа в полноэкранном режиме (Zoom)
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  // Загрузка всех профилей из БД с авто-обновлением в режиме онлайн каждые 5 секунд
  const { data: profiles, isLoading } = useQuery({
    queryKey: ["verification-profiles"],
    queryFn: async () => {
      console.log("[Верификация FSM] Онлайн загрузка списка профилей пользователей...");
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Profile[];
    },
    refetchInterval: 5000, // Обновление каждые 5 секунд для режима онлайн
  });

  // Слушатель событий и кросс-таб синхронизация через localStorage для мгновенного обновления
  useEffect(() => {
    const handleVerificationUpdate = () => {
      console.log("[Верификация FSM] Получен сигнал о новой верификации, обновляем список...");
      queryClient.invalidateQueries({ queryKey: ["verification-profiles"] });
    };

    window.addEventListener("verification_submitted", handleVerificationUpdate);
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "verification_last_update") {
        queryClient.invalidateQueries({ queryKey: ["verification-profiles"] });
      }
    };
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener("verification_submitted", handleVerificationUpdate);
      window.removeEventListener("storage", handleStorage);
    };
  }, [queryClient]);

  // Фильтрация списков по статусу
  const pendingProfiles = (profiles || []).filter((p) => {
    if (p.is_verified) return false;
    if (p.verification_status === "rejected") return false;
    if (p.verification_status === "pending") return true;
    if (p.verification_document_url) return true;
    return false;
  }).sort((a, b) => {
    // Первыми показываем тех, у кого прикреплен документ!
    if (a.verification_document_url && !b.verification_document_url) return -1;
    if (!a.verification_document_url && b.verification_document_url) return 1;
    return (b.verification_submitted_at || b.updated_at || "").localeCompare(a.verification_submitted_at || a.updated_at || "");
  });

  const verifiedProfiles = (profiles || []).filter((p) => p.is_verified);
  const rejectedProfiles = (profiles || []).filter((p) => p.verification_status === "rejected");

  const openProfile = (profile: Profile) => {
    setSelectedProfile(profile);
    setEditMode(false);
    setEditData({
      full_name: profile.full_name || "",
      phone: profile.phone || "",
      address: profile.address || "",
      apartment: profile.apartment || "",
    });
  };

  // Одобрение верификации жильца
  const handleApprove = async (profileId: string) => {
    try {
      console.log(`[Верификация FSM] Одобрение верификации для профиля ID: ${profileId}`);
      const now = new Date().toISOString();

      // 1. Обновляем статус в profiles
      const { data, error } = await supabase
        .from("profiles")
        .update({
          is_verified: true,
          verification_status: "verified",
          verification_reviewed_at: now,
          verification_reject_reason: null,
        })
        .eq("id", profileId)
        .select("*")
        .single();

      if (error || !data) throw error;

      // 2. Завершаем соответствующий наряд в requests
      try {
        await supabase
          .from("requests")
          .update({
            status: "completed",
            completed_at: now,
          })
          .eq("client_id", profileId)
          .eq("order_type", "verification_request");
      } catch (reqErr) {
        console.warn("[Верификация FSM] Заявка в requests не обновлена:", reqErr);
      }

      toast({
        title: "🛡️ Пользователь верифицирован!",
        description: `Профиль ${data.full_name || ""} успешно подтвержден. Доступ к умному домофону открыт.`,
      });

      // Мгновенное обновление списков и счетчиков в меню
      queryClient.invalidateQueries({ queryKey: ["verification-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["fsm-sidebar-counts"] });
      queryClient.invalidateQueries({ queryKey: ["fsm-bottom-nav-counts"] });
      try {
        localStorage.setItem("verification_last_update", Date.now().toString());
        window.dispatchEvent(new Event("verification_submitted"));
      } catch (e) {}

      setSelectedProfile(null);
    } catch (err: any) {
      console.error("[Верификация FSM] Ошибка одобрения:", err);
      toast({
        title: "Ошибка верификации",
        description: err.message || "Не удалось подтвердить пользователя.",
        variant: "destructive",
      });
    }
  };

  // Открытие диалога отклонения заявки
  const handleStartReject = () => {
    setRejectReason(REJECT_REASONS[0]);
    setIsRejectDialogOpen(true);
  };

  // Подтверждение отклонения с фиксацией причины
  const handleConfirmReject = async () => {
    if (!selectedProfile) return;

    try {
      setIsRejecting(true);
      const reason = rejectReason.trim() || "Документ не прошел проверку подлинности";
      console.log(`[Верификация FSM] Отклонение верификации для профиля ID: ${selectedProfile.id}, причина: ${reason}`);
      const now = new Date().toISOString();

      // 1. Обновляем профиль: is_verified = false, verification_status = 'rejected'
      const { error } = await supabase
        .from("profiles")
        .update({
          is_verified: false,
          verification_status: "rejected",
          verification_reject_reason: reason,
          verification_reviewed_at: now,
        })
        .eq("id", selectedProfile.id);

      if (error) throw error;

      // 2. Отклоняем наряд в requests
      try {
        await supabase
          .from("requests")
          .update({
            status: "cancelled",
          })
          .eq("client_id", selectedProfile.id)
          .eq("order_type", "verification_request");
      } catch (reqErr) {
        console.warn("[Верификация FSM] Заявка в requests не обновлена:", reqErr);
      }

      toast({
        title: "Заявка отклонена",
        description: `Причина отказа зафиксирована: ${reason}`,
      });

      setIsRejectDialogOpen(false);
      setSelectedProfile(null);
      
      // Мгновенное обновление списков и счетчиков в меню
      queryClient.invalidateQueries({ queryKey: ["verification-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["fsm-sidebar-counts"] });
      queryClient.invalidateQueries({ queryKey: ["fsm-bottom-nav-counts"] });
      try {
        localStorage.setItem("verification_last_update", Date.now().toString());
        window.dispatchEvent(new Event("verification_submitted"));
      } catch (e) {}
    } catch (err: any) {
      console.error("[Верификация FSM] Ошибка отклонения:", err);
      toast({
        title: "Ошибка отклонения",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsRejecting(false);
    }
  };

  // Сохранение отредактированных диспетчером реквизитов
  const handleSaveEdit = async () => {
    if (!selectedProfile) return;

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: editData.full_name.trim(),
          phone: editData.phone.trim(),
          address: editData.address.trim(),
          apartment: editData.apartment.trim(),
        })
        .eq("id", selectedProfile.id);

      if (error) throw error;

      toast({ title: "Сохранено", description: "Данные абонента обновлены" });
      setEditMode(false);
      queryClient.invalidateQueries({ queryKey: ["verification-profiles"] });
      setSelectedProfile((prev) => prev ? { ...prev, ...editData } : prev);
    } catch (err: any) {
      toast({ title: "Ошибка сохранения", description: err.message, variant: "destructive" });
    }
  };

  // Форматирование типа документа для бейджа
  const getDocumentTypeBadge = (docType?: string | null) => {
    switch (docType) {
      case "egrn":
        return <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30">Выписка ЕГРН</Badge>;
      case "passport":
        return <Badge className="bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30">Паспорт РФ (прописка)</Badge>;
      case "rent_contract":
        return <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30">Договор аренды / найма</Badge>;
      case "other":
        return <Badge variant="secondary">Иной документ</Badge>;
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Шапка и переключатель фильтров */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-xl font-black text-foreground flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-amber-500" />
            <span>Верификация жильцов</span>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Проверка документов на право проживания для выдачи доступов к умному домофону
          </p>
        </div>

        {/* Табы фильтрации */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 text-xs">
          <button
            onClick={() => setActiveFilter("pending")}
            className={cn(
              "px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5",
              activeFilter === "pending"
                ? "bg-amber-500 text-white shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Clock className="h-3.5 w-3.5" />
            <span>На проверке</span>
            {pendingProfiles.length > 0 && (
              <Badge className={cn("text-[10px] px-1.5 py-0", activeFilter === "pending" ? "bg-white/20 text-white" : "bg-amber-500 text-white")}>
                {pendingProfiles.length}
              </Badge>
            )}
          </button>

          <button
            onClick={() => setActiveFilter("verified")}
            className={cn(
              "px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5",
              activeFilter === "verified"
                ? "bg-green-600 text-white shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <CheckCircle className="h-3.5 w-3.5" />
            <span>Одобренные</span>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {verifiedProfiles.length}
            </Badge>
          </button>

          <button
            onClick={() => setActiveFilter("rejected")}
            className={cn(
              "px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5",
              activeFilter === "rejected"
                ? "bg-red-600 text-white shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <XCircle className="h-3.5 w-3.5" />
            <span>Отклоненные</span>
            {rejectedProfiles.length > 0 && (
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                {rejectedProfiles.length}
              </Badge>
            )}
          </button>
        </div>
      </div>

      {/* Список карточек пользователей в выбранной вкладке */}
      {activeFilter === "pending" && (
        <div className="space-y-3">
          {pendingProfiles.length === 0 ? (
            <Card className="border-slate-200 dark:border-slate-800">
              <CardContent className="py-12 text-center text-muted-foreground space-y-2">
                <CheckCircle className="h-8 w-8 text-green-500 mx-auto" />
                <p className="font-bold text-sm text-foreground">Нет заявок, ожидающих верификации</p>
                <p className="text-xs">Все поступившие документы проверены диспетчером.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {pendingProfiles.map((profile) => {
                const hasDoc = !!profile.verification_document_url;
                return (
                  <Card
                    key={profile.id}
                    onClick={() => openProfile(profile)}
                    className={cn(
                      "cursor-pointer transition-all hover:shadow-md border",
                      hasDoc 
                        ? "border-amber-500/40 bg-amber-500/5 hover:border-amber-500" 
                        : "border-slate-200 dark:border-slate-800"
                    )}
                  >
                    <CardContent className="p-4 space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                            hasDoc ? "bg-amber-500 text-white shadow-xs" : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                          )}>
                            {hasDoc ? <FileCheck className="h-5 w-5" /> : <User className="h-5 w-5" />}
                          </div>
                          <div>
                            <p className="font-bold text-sm text-foreground leading-tight">
                              {profile.full_name || "Имя не указано"}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {profile.phone || "Телефон не указан"}
                            </p>
                          </div>
                        </div>

                        {hasDoc ? (
                          <Badge className="bg-amber-500 text-white text-[10px] font-bold shrink-0">
                            📄 Документ прикреплен
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-slate-500 text-[10px] shrink-0">
                            Без документа
                          </Badge>
                        )}
                      </div>

                      <div className="text-xs space-y-1 pt-1 border-t border-slate-100 dark:border-slate-800">
                        <p className="text-foreground font-semibold flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                          <span>{profile.address || "Адрес не указан"}{profile.apartment ? `, кв. ${profile.apartment}` : ""}</span>
                        </p>
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-0.5">
                          {getDocumentTypeBadge(profile.verification_document_type) || <span>Тип: Не указан</span>}
                          {profile.verification_submitted_at && (
                            <span>{new Date(profile.verification_submitted_at).toLocaleDateString("ru-RU", { hour: "2-digit", minute: "2-digit" })}</span>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Одобренные пользователи */}
      {activeFilter === "verified" && (
        <div className="space-y-3">
          {verifiedProfiles.length === 0 ? (
            <Card className="border-slate-200 dark:border-slate-800">
              <CardContent className="py-12 text-center text-muted-foreground">
                Нет верифицированных пользователей
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {verifiedProfiles.map((profile) => (
                <Card
                  key={profile.id}
                  onClick={() => openProfile(profile)}
                  className="cursor-pointer hover:shadow-md transition-all border-slate-200 dark:border-slate-800"
                >
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-green-500/10 text-green-600 dark:text-green-400 flex items-center justify-center shrink-0">
                          <CheckCircle className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-bold text-sm text-foreground">{profile.full_name || "Без имени"}</p>
                          <p className="text-xs text-muted-foreground">{profile.phone || "Нет телефона"}</p>
                        </div>
                      </div>
                      <Badge className="bg-green-600 text-white text-[10px]">
                        Верифицирован
                      </Badge>
                    </div>

                    <div className="text-xs text-muted-foreground pt-1 border-t border-slate-100 dark:border-slate-800">
                      <p className="text-foreground font-medium flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span>{profile.address || "—"}{profile.apartment ? `, кв. ${profile.apartment}` : ""}</span>
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Отклоненные пользователи */}
      {activeFilter === "rejected" && (
        <div className="space-y-3">
          {rejectedProfiles.length === 0 ? (
            <Card className="border-slate-200 dark:border-slate-800">
              <CardContent className="py-12 text-center text-muted-foreground">
                Нет отклоненных заявок
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {rejectedProfiles.map((profile) => (
                <Card
                  key={profile.id}
                  onClick={() => openProfile(profile)}
                  className="cursor-pointer hover:shadow-md transition-all border-red-200 dark:border-red-900/40 bg-red-50/20 dark:bg-red-950/10"
                >
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-red-500/10 text-red-600 flex items-center justify-center shrink-0">
                          <XCircle className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-bold text-sm text-foreground">{profile.full_name || "Без имени"}</p>
                          <p className="text-xs text-muted-foreground">{profile.phone || "Нет телефона"}</p>
                        </div>
                      </div>
                      <Badge variant="destructive" className="text-[10px]">
                        Отклонено
                      </Badge>
                    </div>

                    <div className="text-xs text-muted-foreground pt-1 border-t border-red-100 dark:border-red-900/30 space-y-1">
                      <p className="text-foreground font-medium flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span>{profile.address || "—"}{profile.apartment ? `, кв. ${profile.apartment}` : ""}</span>
                      </p>
                      {profile.verification_reject_reason && (
                        <p className="text-red-600 dark:text-red-400 font-medium">
                          Причина: {profile.verification_reject_reason}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Диалог подробного просмотра заявки и документа */}
      <Dialog open={!!selectedProfile} onOpenChange={() => setSelectedProfile(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between gap-2">
              <DialogTitle className="flex items-center gap-2 text-lg font-bold">
                <User className="h-5 w-5 text-primary" />
                <span>Заявка на верификацию жильца</span>
              </DialogTitle>
              {selectedProfile && (
                <div>
                  {selectedProfile.is_verified ? (
                    <Badge className="bg-green-600 text-white">Верифицирован</Badge>
                  ) : selectedProfile.verification_status === "rejected" ? (
                    <Badge variant="destructive">Отклонено</Badge>
                  ) : (
                    <Badge className="bg-amber-500 text-white">Ожидает проверки</Badge>
                  )}
                </div>
              )}
            </div>
            <DialogDescription className="text-xs">
              Проверьте соответствие ФИО и адреса квартиры прикрепленному документу.
            </DialogDescription>
          </DialogHeader>

          {selectedProfile && !editMode && (
            <div className="space-y-4 py-2">
              {/* Реквизиты заявителя */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-xs">
                <div>
                  <span className="text-muted-foreground uppercase text-[10px] font-semibold block">ФИО заявителя</span>
                  <p className="font-bold text-sm text-foreground">{selectedProfile.full_name || "—"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground uppercase text-[10px] font-semibold block">Телефон</span>
                  <p className="font-bold text-sm text-foreground">{selectedProfile.phone || "—"}</p>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-muted-foreground uppercase text-[10px] font-semibold block">Адрес и квартира</span>
                  <p className="font-bold text-sm text-foreground">
                    {selectedProfile.address || "—"}
                    {selectedProfile.apartment ? `, кв. ${selectedProfile.apartment}` : ""}
                  </p>
                </div>
                {selectedProfile.verification_reject_reason && (
                  <div className="sm:col-span-2 p-2 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-300">
                    <span className="font-bold block">Причина предыдущего отказа:</span>
                    <span>{selectedProfile.verification_reject_reason}</span>
                  </div>
                )}
              </div>

              {/* Блок прикрепленного документа */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Прикрепленный документ:
                    </Label>
                    {getDocumentTypeBadge(selectedProfile.verification_document_type)}
                  </div>
                  {selectedProfile.verification_submitted_at && (
                    <span className="text-[11px] text-muted-foreground">
                      Отправлен: {new Date(selectedProfile.verification_submitted_at).toLocaleString("ru-RU")}
                    </span>
                  )}
                </div>

                {selectedProfile.verification_document_url ? (
                  <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-950/5 dark:bg-slate-950/30 p-2 space-y-2">
                    {/* Если это PDF */}
                    {selectedProfile.verification_document_url.startsWith("data:application/pdf") ? (
                      <div className="p-6 text-center space-y-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                        <FileText className="h-10 w-10 text-red-500 mx-auto" />
                        <div>
                          <p className="font-bold text-sm text-foreground">Документ в формате PDF</p>
                          <p className="text-xs text-muted-foreground">Выписка или скан прикреплен в виде PDF файла</p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const newTab = window.open();
                            newTab?.document.write(`<iframe src="${selectedProfile.verification_document_url}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`);
                          }}
                          className="gap-1.5"
                        >
                          <ExternalLink className="h-4 w-4" />
                          <span>Открыть PDF в новом окне</span>
                        </Button>
                      </div>
                    ) : (
                      /* Если это изображение (фото/скан) */
                      <div className="relative group rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-black/5 dark:bg-black/30 flex items-center justify-center max-h-[380px]">
                        <img
                          src={selectedProfile.verification_document_url}
                          alt="Документ жильца"
                          className="max-h-[380px] w-auto object-contain rounded-lg cursor-pointer"
                          onClick={() => setZoomedImage(selectedProfile.verification_document_url!)}
                        />
                        <button
                          type="button"
                          onClick={() => setZoomedImage(selectedProfile.verification_document_url!)}
                          className="absolute bottom-3 right-3 px-3 py-1.5 rounded-xl bg-black/70 hover:bg-black text-white text-xs font-bold flex items-center gap-1.5 shadow-lg backdrop-blur-sm transition-all"
                        >
                          <Maximize2 className="h-3.5 w-3.5" />
                          <span>На весь экран</span>
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-6 text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/20 text-muted-foreground space-y-1">
                    <AlertTriangle className="h-7 w-7 text-amber-500 mx-auto" />
                    <p className="font-bold text-sm text-foreground">Документ еще не прикреплен</p>
                    <p className="text-xs">Жилец сохранил адрес, но еще не загрузил подтверждающий документ.</p>
                  </div>
                )}
              </div>

              {/* Кнопки действий диспетчера */}
              <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditMode(true)}
                  className="rounded-xl gap-1.5"
                >
                  <Edit className="h-4 w-4" />
                  <span>Редактировать</span>
                </Button>

                <div className="flex-1" />

                {!selectedProfile.is_verified ? (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleStartReject}
                      className="border-red-300 dark:border-red-900/60 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl gap-1.5 font-bold"
                    >
                      <XCircle className="h-4 w-4" />
                      <span>Отклонить</span>
                    </Button>

                    <Button
                      size="sm"
                      onClick={() => handleApprove(selectedProfile.id)}
                      className="bg-green-600 hover:bg-green-700 text-white rounded-xl gap-1.5 font-bold shadow-sm"
                    >
                      <CheckCircle className="h-4 w-4" />
                      <span>Одобрить верификацию</span>
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={handleStartReject}
                    className="rounded-xl gap-1.5 font-bold"
                  >
                    <XCircle className="h-4 w-4" />
                    <span>Отозвать верификацию</span>
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Режим редактирования реквизитов */}
          {selectedProfile && editMode && (
            <div className="space-y-4 py-2">
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label>Полное имя жильца</Label>
                  <Input
                    value={editData.full_name}
                    onChange={(e) => setEditData({ ...editData, full_name: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Телефон</Label>
                  <Input
                    value={editData.phone}
                    onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Адрес (улица и номер дома)</Label>
                  <Input
                    value={editData.address}
                    onChange={(e) => setEditData({ ...editData, address: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Квартира</Label>
                  <Input
                    value={editData.apartment}
                    onChange={(e) => setEditData({ ...editData, apartment: e.target.value })}
                  />
                </div>
              </div>

              <DialogFooter className="gap-2">
                <Button variant="outline" size="sm" onClick={() => setEditMode(false)} className="rounded-xl">
                  Отмена
                </Button>
                <Button size="sm" onClick={handleSaveEdit} className="rounded-xl bg-primary text-primary-foreground">
                  Сохранить
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Диалог отклонения с указанием причины */}
      <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-red-600">
              <AlertCircle className="h-5 w-5" />
              <span>Укажите причину отклонения</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Жилец увидит эту причину в своем личном кабинете и сможет прикрепить верный документ.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <Label className="text-xs font-semibold">Быстрый выбор типовой причины:</Label>
            <div className="space-y-1.5">
              {REJECT_REASONS.map((reason, idx) => (
                <div
                  key={idx}
                  onClick={() => setRejectReason(reason)}
                  className={cn(
                    "p-2 rounded-lg border text-left cursor-pointer transition-all",
                    rejectReason === reason
                      ? "border-red-500 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 font-semibold"
                      : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900"
                  )}
                >
                  {reason}
                </div>
              ))}
            </div>

            <div className="space-y-1 pt-1">
              <Label className="text-xs font-semibold">Или напишите свой комментарий жильцу:</Label>
              <Input
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Например: Не видно штампа прописки..."
                className="text-xs"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsRejectDialogOpen(false)} className="rounded-xl">
              Отмена
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={isRejecting || !rejectReason.trim()}
              onClick={handleConfirmReject}
              className="rounded-xl font-bold gap-1.5"
            >
              {isRejecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
              <span>Подтвердить отказ</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Полноэкранный просмотр изображения (Lightbox Zoom) */}
      <Dialog open={!!zoomedImage} onOpenChange={() => setZoomedImage(null)}>
        <DialogContent className="max-w-4xl p-2 bg-black/95 border-none text-white">
          <div className="relative flex flex-col items-center justify-center p-2">
            <img
              src={zoomedImage || ""}
              alt="Документ (полный размер)"
              className="max-h-[85vh] w-auto object-contain rounded-lg shadow-2xl"
            />
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setZoomedImage(null)}
              className="mt-3 rounded-xl font-bold"
            >
              Закрыть просмотр
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default VerificationManager;

