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
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  History,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatFullAddress } from "@/lib/addressMatch";

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
  // Счетчик и история изменений данных жильца (для антиспам-фильтра)
  data_changes_count?: number | null;
  data_changes_history?: Array<{
    id: string;
    status: 'approved' | 'rejected' | 'pending';
    timestamp: string;
    reason?: string;
    old_data?: any;
    new_data?: any;
  }> | null;
  // Поля запроса на изменение данных жильца
  pending_data_change?: {
    full_name?: string;
    phone?: string;
    address?: string;
    apartment?: string;
    floor?: string;
    account_number?: string;
    submitted_at?: string;
    old_data?: {
      full_name?: string;
      phone?: string;
      address?: string;
      apartment?: string;
      account_number?: string;
    };
  } | null;
  data_change_notification?: any;
}

// Предустановленные причины отклонения верификации для быстрого выбора
const REJECT_REASONS = [
  "Нечитаемое, размытое или обрезанное фото документа",
  "Адрес в документе не совпадает с указанной квартирой",
  "ФИО в документе не совпадает с данными профиля",
  "Истек срок действия договора аренды жилья",
  "Прикреплен неподходящий документ (требуется ЕГРН, прописка или договор найма)",
];

// Предустановленные причины отклонения изменения персональных данных
const DATA_CHANGE_REJECT_REASONS = [
  "Указанный адрес не обслуживается компанией «Домофондар»",
  "Несоответствие данных собственника или лицевого счёта в реестре",
  "Ошибочно указан номер квартиры или подъезда",
  "Для смены адреса требуется повторное предоставление выписки ЕГРН или договора аренды",
];

interface VerificationManagerProps {
  onNavigate?: (tab: string) => void;
}

export const VerificationManager: React.FC<VerificationManagerProps> = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Активная вкладка фильтра
  const [activeFilter, setActiveFilter] = useState<"pending" | "verified" | "rejected" | "data_changes">("pending");

  // Подвкладка внутри вкладки "Изменение данных": активные или архив/история
  const [dataChangesSubTab, setDataChangesSubTab] = useState<"pending" | "history">("pending");

  // Поисковый запрос и пагинация
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Сброс страницы на первую при смене вкладок или поискового запроса
  useEffect(() => {
    setCurrentPage(1);
  }, [activeFilter, dataChangesSubTab, searchQuery]);

  // Выбранный профиль для просмотра в диалоге верификации
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);

  // Стейты для отклонения заявки на изменение данных
  const [rejectingDataProfile, setRejectingDataProfile] = useState<Profile | null>(null);
  const [isRejectDataDialogOpen, setIsRejectDataDialogOpen] = useState(false);
  const [dataRejectReason, setDataRejectReason] = useState("");
  const [isRejectingData, setIsRejectingData] = useState(false);

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

  // 1. Загрузка всех профилей из БД с авто-обновлением в режиме онлайн каждые 5 секунд
  const { data: profiles, isLoading: profilesLoading } = useQuery({
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
    refetchInterval: 5000,
  });

  // 2. Загрузка всех заявок на изменение данных из таблицы requests для полной истории и учета спамеров
  const { data: dbDataChangeRequests, isLoading: requestsLoading } = useQuery({
    queryKey: ["verification-db-data-change-requests"],
    queryFn: async () => {
      console.log("[Верификация FSM] Загрузка реестра заявок data_change_request...");
      const { data, error } = await supabase
        .from("requests")
        .select("*")
        .eq("order_type", "data_change_request")
        .order("created_at", { ascending: false });
      if (error) {
        console.warn("[Верификация FSM] Заявки data_change_request не загружены:", error.message);
        return [];
      }
      return data || [];
    },
    refetchInterval: 10000,
  });

  const isLoading = profilesLoading;

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

  // Подсчет количества изменений данных для каждого пользователя (детектор спама)
  const dataChangesCountMap = useMemo(() => {
    const map: Record<string, number> = {};
    (dbDataChangeRequests || []).forEach((req: any) => {
      if (req.client_id) {
        map[req.client_id] = (map[req.client_id] || 0) + 1;
      }
    });
    (profiles || []).forEach((p: any) => {
      const explicitCount = p.data_changes_count || 0;
      const historyLen = Array.isArray(p.data_changes_history) ? p.data_changes_history.length : 0;
      const currentPending = p.pending_data_change ? 1 : 0;
      const maxCount = Math.max(map[p.id] || 0, explicitCount, historyLen, currentPending);
      if (maxCount > 0) {
        map[p.id] = maxCount;
      }
    });
    return map;
  }, [dbDataChangeRequests, profiles]);

  // Фильтрация списков по статусу верификации документов
  const allPendingProfiles = useMemo(() => {
    return (profiles || []).filter((p) => {
      if (p.is_verified) return false;
      if (p.verification_status === "rejected") return false;
      if (p.verification_status === "pending") return true;
      if (p.verification_document_url) return true;
      return false;
    }).sort((a, b) => {
      if (a.verification_document_url && !b.verification_document_url) return -1;
      if (!a.verification_document_url && b.verification_document_url) return 1;
      return (b.verification_submitted_at || b.updated_at || "").localeCompare(a.verification_submitted_at || a.updated_at || "");
    });
  }, [profiles]);

  const allVerifiedProfiles = useMemo(() => {
    return (profiles || []).filter((p) => p.is_verified);
  }, [profiles]);

  const allRejectedProfiles = useMemo(() => {
    return (profiles || []).filter((p) => p.verification_status === "rejected");
  }, [profiles]);

  // Активные заявки на смену персональных данных абонентов
  const allDataChangeRequests = useMemo(() => {
    return (profiles || []).filter(
      (p: any) => p.pending_data_change && typeof p.pending_data_change === "object"
    );
  }, [profiles]);

  // Полная история всех смен данных (завершенные и отклоненные)
  const allDataChangeHistory = useMemo(() => {
    const list: Array<{
      id: string;
      userId: string;
      userName: string;
      phone: string;
      status: "approved" | "rejected" | "pending";
      timestamp: string;
      reason?: string;
      oldData: any;
      newData: any;
      changesCount: number;
    }> = [];

    // 1. Из таблицы requests (order_type = data_change_request)
    (dbDataChangeRequests || []).forEach((req: any) => {
      if (req.status === "pending") return; // активные показываются во вкладке "На проверке"
      let parsedNotes: any = null;
      try {
        if (req.notes && req.notes.startsWith("{")) parsedNotes = JSON.parse(req.notes);
      } catch (e) {}

      const userProfile = (profiles || []).find(p => p.id === req.client_id);
      const changesCount = dataChangesCountMap[req.client_id] || 1;

      list.push({
        id: req.id,
        userId: req.client_id || "",
        userName: req.name || userProfile?.full_name || "Абонент",
        phone: req.phone || userProfile?.phone || "",
        status: req.status === "completed" ? "approved" : "rejected",
        timestamp: req.completed_at || req.updated_at || req.created_at,
        reason: req.notes && !req.notes.startsWith("{") ? req.notes : undefined,
        oldData: parsedNotes?.old_data || {
          address: userProfile?.address,
          apartment: userProfile?.apartment,
          full_name: userProfile?.full_name,
        },
        newData: {
          address: req.address,
          apartment: req.apartment,
          full_name: req.name,
          phone: req.phone,
          account_number: parsedNotes?.account_number,
        },
        changesCount,
      });
    });

    // 2. Из структуры profiles.data_changes_history
    (profiles || []).forEach((p: any) => {
      if (Array.isArray(p.data_changes_history)) {
        p.data_changes_history.forEach((h: any) => {
          if (!list.some(item => item.id === h.id)) {
            list.push({
              id: h.id,
              userId: p.id,
              userName: h.new_data?.full_name || p.full_name || "Абонент",
              phone: h.new_data?.phone || p.phone || "",
              status: h.status,
              timestamp: h.timestamp,
              reason: h.reason,
              oldData: h.old_data || {},
              newData: h.new_data || {},
              changesCount: dataChangesCountMap[p.id] || 1,
            });
          }
        });
      }
    });

    return list.sort((a, b) => (b.timestamp || "").localeCompare(a.timestamp || ""));
  }, [dbDataChangeRequests, profiles, dataChangesCountMap]);

  // Универсальный поиск по массиву записей
  const filterListBySearch = <T extends any>(items: T[], getFields: (item: T) => (string | null | undefined)[]) => {
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase().trim();
    return items.filter(item => {
      const fields = getFields(item);
      return fields.some(f => f && String(f).toLowerCase().includes(q));
    });
  };

  const pendingProfiles = useMemo(() => {
    return filterListBySearch(allPendingProfiles, p => [p.full_name, p.phone, p.address, p.apartment, (p as any).account_number]);
  }, [allPendingProfiles, searchQuery]);

  const verifiedProfiles = useMemo(() => {
    return filterListBySearch(allVerifiedProfiles, p => [p.full_name, p.phone, p.address, p.apartment, (p as any).account_number]);
  }, [allVerifiedProfiles, searchQuery]);

  const rejectedProfiles = useMemo(() => {
    return filterListBySearch(allRejectedProfiles, p => [p.full_name, p.phone, p.address, p.apartment, p.verification_reject_reason, (p as any).account_number]);
  }, [allRejectedProfiles, searchQuery]);

  const dataChangeRequests = useMemo(() => {
    return filterListBySearch(allDataChangeRequests, p => [
      p.full_name, p.phone, p.address, p.apartment,
      p.pending_data_change?.full_name, p.pending_data_change?.phone, p.pending_data_change?.address, p.pending_data_change?.apartment, p.pending_data_change?.account_number
    ]);
  }, [allDataChangeRequests, searchQuery]);

  const dataChangeHistory = useMemo(() => {
    return filterListBySearch(allDataChangeHistory, h => [
      h.userName, h.phone, h.reason,
      h.oldData?.address, h.oldData?.apartment, h.oldData?.full_name,
      h.newData?.address, h.newData?.apartment, h.newData?.full_name, h.newData?.account_number
    ]);
  }, [allDataChangeHistory, searchQuery]);

  // Вспомогательный рендер индикатора антиспама
  const renderSpamBadge = (count: number) => {
    if (count <= 1) {
      return (
        <Badge variant="outline" className="text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700 text-[10px] gap-1 font-medium shrink-0">
          <span>Смен данных: {count}</span>
        </Badge>
      );
    }
    if (count <= 3) {
      return (
        <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-[10px] gap-1 font-bold shrink-0">
          <AlertTriangle className="h-3 w-3 shrink-0" />
          <span>Смен данных: {count}</span>
        </Badge>
      );
    }
    return (
      <Badge className="bg-red-500 text-white border border-red-600 text-[10px] gap-1 font-bold animate-pulse shadow-xs shrink-0">
        <AlertCircle className="h-3 w-3 shrink-0" />
        <span>🚨 Спам-фильтр: {count} смен (подозрение на спам)</span>
      </Badge>
    );
  };

  // Вспомогательный рендер панели пагинации страниц
  const renderPagination = (totalItems: number) => {
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    if (totalPages <= 1) return null;

    const startIdx = (currentPage - 1) * pageSize + 1;
    const endIdx = Math.min(currentPage * pageSize, totalItems);

    return (
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-200 dark:border-slate-800 text-xs text-muted-foreground">
        <div>
          Показано <span className="font-bold text-foreground">{startIdx}–{endIdx}</span> из <span className="font-bold text-foreground">{totalItems}</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0 rounded-lg"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(1)}
            title="В начало"
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0 rounded-lg"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            title="Предыдущая страница"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <span className="px-3 font-semibold text-foreground">
            Стр. {currentPage} из {totalPages}
          </span>

          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0 rounded-lg"
            disabled={currentPage >= totalPages}
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            title="Следующая страница"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0 rounded-lg"
            disabled={currentPage >= totalPages}
            onClick={() => setCurrentPage(totalPages)}
            title="В конец"
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  };

  // Одобрение замены персональных данных абонента диспетчером (с сохранением истории и Optimistic UI)
  const handleApproveDataChange = async (profile: Profile) => {
    try {
      const change = profile.pending_data_change;
      if (!change) return;

      console.log(`[Верификация] Мгновенное подтверждение изменения данных для профиля ID: ${profile.id}`, change);
      const now = new Date().toISOString();

      // Запись в историю изменений
      const existingHistory = Array.isArray(profile.data_changes_history) ? profile.data_changes_history : [];
      const historyItem = {
        id: "chg_" + Date.now(),
        status: "approved" as const,
        timestamp: now,
        old_data: change.old_data || {
          full_name: profile.full_name,
          phone: profile.phone,
          address: profile.address,
          apartment: profile.apartment,
        },
        new_data: {
          full_name: change.full_name?.trim() || profile.full_name,
          phone: change.phone?.trim() || profile.phone,
          address: change.address?.trim() || profile.address,
          apartment: change.apartment !== undefined ? change.apartment?.trim() : profile.apartment,
          floor: change.floor !== undefined ? change.floor?.trim() : profile.floor,
          account_number: change.account_number ? change.account_number.trim() : (profile as any).account_number,
        },
      };
      const updatedHistory = [historyItem, ...existingHistory];
      const newCount = (profile.data_changes_count || 0) + 1;

      // 0. МГНОВЕННЫЙ OPTIMISTIC UI (0 мс)
      queryClient.setQueryData<Profile[]>(["verification-profiles"], (old) => {
        if (!old) return [];
        return old.map((p) =>
          p.id === profile.id
            ? {
                ...p,
                full_name: change.full_name?.trim() || p.full_name,
                phone: change.phone?.trim() || p.phone,
                email: change.email?.trim() || (p as any).email,
                address: change.address?.trim() || p.address,
                apartment: change.apartment !== undefined ? change.apartment?.trim() : p.apartment,
                floor: change.floor !== undefined ? change.floor?.trim() : p.floor,
                account_number: change.account_number ? change.account_number.trim() : (p as any).account_number,
                pending_data_change: null,
                data_changes_count: newCount,
                data_changes_history: updatedHistory,
              }
            : p
        );
      });

      // Мгновенно уменьшаем счетчик бейджа в сайдбаре
      queryClient.setQueryData<any>(["fsm-sidebar-counts"], (old) => {
        if (!old) return old;
        return {
          ...old,
          pendingVerifications: Math.max(0, (old.pendingVerifications || 1) - 1),
        };
      });

      toast({
        title: "✅ Данные обновлены и сохранены в истории!",
        description: `Новые реквизиты для ${change.full_name || profile.full_name} успешно применены (всего смен: ${newCount}).`,
      });

      // 1. Применяем новые реквизиты в PostgreSQL
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: change.full_name?.trim() || profile.full_name,
          phone: change.phone?.trim() || profile.phone,
          email: change.email?.trim() || (profile as any).email,
          address: change.address?.trim() || profile.address,
          apartment: change.apartment !== undefined ? change.apartment?.trim() : profile.apartment,
          floor: change.floor !== undefined ? change.floor?.trim() : profile.floor,
          account_number: change.account_number ? change.account_number.trim() : (profile as any).account_number,
          pending_data_change: null,
          data_changes_count: newCount,
          data_changes_history: updatedHistory as any,
          data_change_notification: {
            type: "approved",
            message: `Ваши новые реквизиты успешно подтверждены оператором: ${
              change.address
                ? (/кв\.?\s*\d+/i.test(change.address) || /квартира\s*\d+/i.test(change.address))
                  ? change.address
                  : `${change.address}${change.apartment ? `, кв. ${change.apartment}` : ""}`
                : ""
            }. Все данные профиля обновлены.`,
            timestamp: now,
          },
        })
        .eq("id", profile.id);

      if (error) throw error;

      // 2. Завершаем соответствующую заявку в requests
      try {
        await supabase
          .from("requests")
          .update({
            status: "completed",
            completed_at: now,
            notes: `✅ Изменение данных подтверждено оператором: ${new Date().toLocaleString()}`,
          })
          .eq("client_id", profile.id)
          .eq("order_type", "data_change_request");
      } catch (reqErr) {
        console.warn("[Верификация] Заявка в requests не обновлена:", reqErr);
      }

      queryClient.invalidateQueries({ queryKey: ["verification-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["verification-db-data-change-requests"] });
      queryClient.invalidateQueries({ queryKey: ["fsm-sidebar-counts"] });
      queryClient.invalidateQueries({ queryKey: ["requests"] });
    } catch (err: any) {
      console.error("[Верификация] Ошибка применения изменений:", err);
      queryClient.invalidateQueries({ queryKey: ["verification-profiles"] });
      toast({
        title: "Ошибка обновления данных",
        description: err.message || "Не удалось сохранить новые данные.",
        variant: "destructive",
      });
    }
  };

  // Открытие диалога отклонения запроса на изменение данных
  const handleStartRejectDataChange = (profile: Profile) => {
    setRejectingDataProfile(profile);
    setDataRejectReason(DATA_CHANGE_REJECT_REASONS[0]);
    setIsRejectDataDialogOpen(true);
  };

  // Фиксация отклонения с записью причины в профиль жильца и историю
  const handleConfirmRejectDataChange = async () => {
    if (!rejectingDataProfile) return;

    try {
      setIsRejectingData(true);
      const reason = dataRejectReason.trim() || "Данные не соответствуют реестру абонентов";
      const targetId = rejectingDataProfile.id;
      const change = rejectingDataProfile.pending_data_change;
      console.log(`[Верификация] Мгновенное отклонение изменения данных для профиля ID: ${targetId}`);
      const now = new Date().toISOString();

      const existingHistory = Array.isArray(rejectingDataProfile.data_changes_history) ? rejectingDataProfile.data_changes_history : [];
      const historyItem = {
        id: "chg_" + Date.now(),
        status: "rejected" as const,
        reason: reason,
        timestamp: now,
        old_data: change?.old_data || {},
        new_data: change || {},
      };
      const updatedHistory = [historyItem, ...existingHistory];
      const newCount = (rejectingDataProfile.data_changes_count || 0) + 1;

      // 0. МГНОВЕННЫЙ OPTIMISTIC UI: заявка сразу убирается с экрана
      queryClient.setQueryData<Profile[]>(["verification-profiles"], (old) => {
        if (!old) return [];
        return old.map((p) =>
          p.id === targetId
            ? { ...p, pending_data_change: null, data_changes_count: newCount, data_changes_history: updatedHistory }
            : p
        );
      });

      queryClient.setQueryData<any>(["fsm-sidebar-counts"], (old) => {
        if (!old) return old;
        return {
          ...old,
          pendingVerifications: Math.max(0, (old.pendingVerifications || 1) - 1),
        };
      });

      setIsRejectDataDialogOpen(false);
      setRejectingDataProfile(null);

      toast({
        title: "Заявка отклонена и сохранена в архиве",
        description: `Запрос на изменение данных отклонен. Причина: ${reason} (всего обращений: ${newCount})`,
      });

      // 1. Очищаем pending_data_change в profiles, записываем историю и уведомление
      const { error } = await supabase
        .from("profiles")
        .update({
          pending_data_change: null,
          data_changes_count: newCount,
          data_changes_history: updatedHistory as any,
          data_change_notification: {
            type: "rejected",
            reason,
            message: `Заявка на изменение данных отклонена оператором. Причина: ${reason}. Ваши прежние реквизиты сохранены.`,
            timestamp: now,
          },
        })
        .eq("id", targetId);

      if (error) throw error;

      // 2. Отклоняем наряд в requests
      try {
        await supabase
          .from("requests")
          .update({
            status: "cancelled",
            notes: `❌ Отклонено оператором. Причина: ${reason}`,
          })
          .eq("client_id", targetId)
          .eq("order_type", "data_change_request");
      } catch (reqErr) {
        console.warn("[Верификация] Заявка в requests не обновлена:", reqErr);
      }

      queryClient.invalidateQueries({ queryKey: ["verification-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["verification-db-data-change-requests"] });
      queryClient.invalidateQueries({ queryKey: ["fsm-sidebar-counts"] });
      queryClient.invalidateQueries({ queryKey: ["requests"] });
    } catch (err: any) {
      console.error("[Верификация] Ошибка отклонения данных:", err);
      queryClient.invalidateQueries({ queryKey: ["verification-profiles"] });
      toast({
        title: "Ошибка отклонения",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsRejectingData(false);
    }
  };

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

  // Одобрение верификации жильца (МГНОВЕННЫЙ ОТКЛИК OPTIMISTIC UI)
  const handleApprove = async (profileId: string) => {
    try {
      console.log(`[Верификация] Мгновенное одобрение верификации для профиля ID: ${profileId}`);
      const now = new Date().toISOString();

      // 0. МГНОВЕННЫЙ OPTIMISTIC UI (0 миллисекунд!):
      // Карточка мгновенно исчезает из вкладки «Ожидают» прямо на глазах у диспетчера!
      queryClient.setQueryData<Profile[]>(["verification-profiles"], (old) => {
        if (!old) return [];
        return old.map((p) =>
          p.id === profileId
            ? {
                ...p,
                is_verified: true,
                verification_status: "verified",
                verification_reviewed_at: now,
                verification_reject_reason: null,
              }
            : p
        );
      });

      // Мгновенно уменьшаем счетчик новых верификаций в сайдбаре
      queryClient.setQueryData<any>(["fsm-sidebar-counts"], (old) => {
        if (!old) return old;
        return {
          ...old,
          pendingVerifications: Math.max(0, (old.pendingVerifications || 1) - 1),
        };
      });

      // Мгновенно закрываем диалог просмотра
      setSelectedProfile(null);

      toast({
        title: "🛡️ Пользователь верифицирован!",
        description: "Профиль успешно подтвержден. Доступ к умному домофону открыт.",
      });

      // 1. Обновляем статус в profiles в PostgreSQL
      const { error } = await supabase
        .from("profiles")
        .update({
          is_verified: true,
          verification_status: "verified",
          verification_reviewed_at: now,
          verification_reject_reason: null,
        })
        .eq("id", profileId);

      if (error) throw error;

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
        console.warn("[Верификация] Заявка в requests не обновлена:", reqErr);
      }

      // Синхронизация между соседними вкладками браузера
      try {
        localStorage.setItem("verification_last_update", Date.now().toString());
        window.dispatchEvent(new Event("verification_submitted"));
      } catch (e) {}

      queryClient.invalidateQueries({ queryKey: ["verification-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["fsm-sidebar-counts"] });
    } catch (err: any) {
      console.error("[Верификация] Ошибка одобрения:", err);
      // При сетевой ошибке откатываем кэш
      queryClient.invalidateQueries({ queryKey: ["verification-profiles"] });
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

  // Подтверждение отклонения с фиксацией причины (МГНОВЕННЫЙ OPTIMISTIC UI)
  const handleConfirmReject = async () => {
    if (!selectedProfile) return;

    try {
      setIsRejecting(true);
      const reason = rejectReason.trim() || "Документ не прошел проверку подлинности";
      const targetId = selectedProfile.id;
      console.log(`[Верификация] Мгновенное отклонение верификации для профиля ID: ${targetId}, причина: ${reason}`);
      const now = new Date().toISOString();

      // 0. МГНОВЕННЫЙ OPTIMISTIC UI: карточка сразу уходит из списка «Ожидают»
      queryClient.setQueryData<Profile[]>(["verification-profiles"], (old) => {
        if (!old) return [];
        return old.map((p) =>
          p.id === targetId
            ? {
                ...p,
                is_verified: false,
                verification_status: "rejected",
                verification_reject_reason: reason,
                verification_reviewed_at: now,
              }
            : p
        );
      });

      // Мгновенно уменьшаем счетчик бейджа
      queryClient.setQueryData<any>(["fsm-sidebar-counts"], (old) => {
        if (!old) return old;
        return {
          ...old,
          pendingVerifications: Math.max(0, (old.pendingVerifications || 1) - 1),
        };
      });

      setIsRejectDialogOpen(false);
      setSelectedProfile(null);

      toast({
        title: "Заявка отклонена",
        description: `Причина отказа зафиксирована: ${reason}`,
      });

      // 1. Обновляем профиль в PostgreSQL: is_verified = false, verification_status = 'rejected'
      const { error } = await supabase
        .from("profiles")
        .update({
          is_verified: false,
          verification_status: "rejected",
          verification_reject_reason: reason,
          verification_reviewed_at: now,
        })
        .eq("id", targetId);

      if (error) throw error;

      // 2. Отклоняем наряд в requests
      try {
        await supabase
          .from("requests")
          .update({
            status: "cancelled",
          })
          .eq("client_id", targetId)
          .eq("order_type", "verification_request");
      } catch (reqErr) {
        console.warn("[Верификация] Заявка в requests не обновлена:", reqErr);
      }

      // Синхронизация между соседними вкладками
      try {
        localStorage.setItem("verification_last_update", Date.now().toString());
        window.dispatchEvent(new Event("verification_submitted"));
      } catch (e) {}

      queryClient.invalidateQueries({ queryKey: ["verification-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["fsm-sidebar-counts"] });
    } catch (err: any) {
      console.error("[Верификация] Ошибка отклонения:", err);
      queryClient.invalidateQueries({ queryKey: ["verification-profiles"] });
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
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-xl font-black text-foreground flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-amber-500" />
            <span>Верификация жильцов</span>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Проверка документов на право проживания, учет смен данных и защита от спама
          </p>
        </div>

        {/* Табы фильтрации */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 text-xs">
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

          {/* Вкладка заявок на изменение персональных данных абонентов */}
          <button
            onClick={() => setActiveFilter("data_changes")}
            className={cn(
              "px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5",
              activeFilter === "data_changes"
                ? "bg-blue-600 text-white shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Edit className="h-3.5 w-3.5" />
            <span>Смена данных</span>
            {dataChangeRequests.length > 0 && (
              <Badge className={cn("text-[10px] px-1.5 py-0 font-bold", activeFilter === "data_changes" ? "bg-white/20 text-white" : "bg-blue-600 text-white")}>
                {dataChangeRequests.length}
              </Badge>
            )}
          </button>
        </div>
      </div>

      {/* Быстрый поиск и фильтрация */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Быстрый поиск по ФИО, телефону, адресу, квартире..."
            className="pl-9 pr-9 h-10 rounded-xl bg-card border-slate-200 dark:border-slate-800 text-sm shadow-xs"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded-md"
              title="Очистить поиск"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {activeFilter === "data_changes" && (
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl text-xs shrink-0">
            <button
              onClick={() => setDataChangesSubTab("pending")}
              className={cn(
                "px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5",
                dataChangesSubTab === "pending"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Clock className="h-3.5 w-3.5" />
              <span>Ожидают ({dataChangeRequests.length})</span>
            </button>
            <button
              onClick={() => setDataChangesSubTab("history")}
              className={cn(
                "px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5",
                dataChangesSubTab === "history"
                  ? "bg-slate-900 text-white dark:bg-slate-700 shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <History className="h-3.5 w-3.5" />
              <span>Архив и история ({dataChangeHistory.length})</span>
            </button>
          </div>
        )}
      </div>

      {/* Список карточек пользователей: На проверке */}
      {activeFilter === "pending" && (
        <div className="space-y-4">
          {pendingProfiles.length === 0 ? (
            <Card className="border-slate-200 dark:border-slate-800">
              <CardContent className="py-12 text-center text-muted-foreground space-y-2">
                <CheckCircle className="h-8 w-8 text-green-500 mx-auto" />
                <p className="font-bold text-sm text-foreground">
                  {searchQuery ? "По запросу ничего не найдено" : "Нет заявок, ожидающих верификации"}
                </p>
                <p className="text-xs">Все поступившие документы проверены диспетчером.</p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {pendingProfiles
                  .slice((currentPage - 1) * pageSize, currentPage * pageSize)
                  .map((profile) => {
                    const hasDoc = !!profile.verification_document_url;
                    const spamCount = dataChangesCountMap[profile.id] || 0;
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

                            <div className="flex flex-col items-end gap-1 shrink-0">
                              {hasDoc ? (
                                <Badge className="bg-amber-500 text-white text-[10px] font-bold">
                                  📄 Документ
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-slate-500 text-[10px]">
                                  Без документа
                                </Badge>
                              )}
                              {renderSpamBadge(spamCount)}
                            </div>
                          </div>

                          <div className="text-xs space-y-1 pt-1 border-t border-slate-100 dark:border-slate-800">
                            <p className="text-foreground font-semibold flex items-center gap-1.5">
                              <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                              <span>{formatFullAddress(profile.address, profile.apartment) || "Адрес не указан"}</span>
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
              {renderPagination(pendingProfiles.length)}
            </>
          )}
        </div>
      )}

      {/* Одобренные пользователи */}
      {activeFilter === "verified" && (
        <div className="space-y-4">
          {verifiedProfiles.length === 0 ? (
            <Card className="border-slate-200 dark:border-slate-800">
              <CardContent className="py-12 text-center text-muted-foreground">
                {searchQuery ? "По запросу ничего не найдено" : "Нет верифицированных пользователей"}
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {verifiedProfiles
                  .slice((currentPage - 1) * pageSize, currentPage * pageSize)
                  .map((profile) => {
                    const spamCount = dataChangesCountMap[profile.id] || 0;
                    return (
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
                            <div className="flex flex-col items-end gap-1 shrink-0">
                              <Badge className="bg-green-600 text-white text-[10px]">
                                Верифицирован
                              </Badge>
                              {renderSpamBadge(spamCount)}
                            </div>
                          </div>

                          <div className="text-xs text-muted-foreground pt-1 border-t border-slate-100 dark:border-slate-800">
                            <p className="text-foreground font-medium flex items-center gap-1.5">
                              <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                              <span>{formatFullAddress(profile.address, profile.apartment) || "—"}</span>
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
              </div>
              {renderPagination(verifiedProfiles.length)}
            </>
          )}
        </div>
      )}

      {/* Отклоненные пользователи */}
      {activeFilter === "rejected" && (
        <div className="space-y-4">
          {rejectedProfiles.length === 0 ? (
            <Card className="border-slate-200 dark:border-slate-800">
              <CardContent className="py-12 text-center text-muted-foreground">
                {searchQuery ? "По запросу ничего не найдено" : "Нет отклоненных заявок"}
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {rejectedProfiles
                  .slice((currentPage - 1) * pageSize, currentPage * pageSize)
                  .map((profile) => {
                    const spamCount = dataChangesCountMap[profile.id] || 0;
                    return (
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
                            <div className="flex flex-col items-end gap-1 shrink-0">
                              <Badge variant="destructive" className="text-[10px]">
                                Отклонено
                              </Badge>
                              {renderSpamBadge(spamCount)}
                            </div>
                          </div>

                          <div className="text-xs text-muted-foreground pt-1 border-t border-red-100 dark:border-red-900/30 space-y-1">
                            <p className="text-foreground font-medium flex items-center gap-1.5">
                              <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                              <span>{formatFullAddress(profile.address, profile.apartment) || "—"}</span>
                            </p>
                            {profile.verification_reject_reason && (
                              <p className="text-red-600 dark:text-red-400 font-medium">
                                Причина: {profile.verification_reject_reason}
                              </p>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
              </div>
              {renderPagination(rejectedProfiles.length)}
            </>
          )}
        </div>
      )}

      {/* 4. Вкладка "Смена данных" */}
      {activeFilter === "data_changes" && (
        <div className="space-y-4">
          {/* Подвкладка: Ожидают подтверждения */}
          {dataChangesSubTab === "pending" && (
            <>
              {dataChangeRequests.length === 0 ? (
                <Card className="border-slate-200 dark:border-slate-800">
                  <CardContent className="py-12 text-center text-muted-foreground space-y-2">
                    <FileCheck className="h-8 w-8 text-blue-500 mx-auto" />
                    <p className="font-bold text-sm text-foreground">
                      {searchQuery ? "По запросу ничего не найдено" : "Нет активных заявок на изменение данных"}
                    </p>
                    <p className="text-xs">Когда абоненты запросят изменение адреса, квартиры или ФИО, запросы появятся здесь.</p>
                  </CardContent>
                </Card>
              ) : (
                <>
                  <div className="grid grid-cols-1 gap-4">
                    {dataChangeRequests
                      .slice((currentPage - 1) * pageSize, currentPage * pageSize)
                      .map((profile) => {
                        const change = profile.pending_data_change;
                        const oldData = change?.old_data || {};
                        const spamCount = dataChangesCountMap[profile.id] || 1;
                        return (
                          <Card key={profile.id} className="border border-blue-500/30 dark:border-blue-500/20 bg-blue-50/15 dark:bg-blue-950/10 rounded-2xl shadow-sm">
                            <CardHeader className="pb-3 border-b border-blue-100 dark:border-blue-900/30">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <Badge className="bg-blue-600 text-white font-bold text-xs">
                                    Заявка на смену данных
                                  </Badge>
                                  {renderSpamBadge(spamCount)}
                                  {change?.submitted_at && (
                                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                                      <Clock className="h-3 w-3" />
                                      {new Date(change.submitted_at).toLocaleString("ru-RU")}
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs font-mono text-muted-foreground">
                                  ID: {profile.id.slice(0, 8)}...
                                </div>
                              </div>
                            </CardHeader>
                            <CardContent className="space-y-4 pt-4">
                              {/* Сравнение реквизитов "Было ➔ Стало" */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Текущие данные (Было) */}
                                <div className="p-3.5 rounded-xl bg-slate-100/90 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs space-y-2 text-left">
                                  <div className="font-bold text-slate-500 uppercase tracking-wider text-[10px] flex items-center gap-1.5 pb-1 border-b border-slate-200 dark:border-slate-700">
                                    <span>Было (Действующие реквизиты)</span>
                                  </div>
                                  <div><span className="text-muted-foreground">ФИО:</span> <span className="font-medium text-foreground">{oldData.full_name || profile.full_name || "—"}</span></div>
                                  <div><span className="text-muted-foreground">Телефон:</span> <span className="font-medium text-foreground font-mono">{oldData.phone || profile.phone || "—"}</span></div>
                                  <div><span className="text-muted-foreground">Адрес:</span> <span className="font-medium text-foreground">{oldData.address || profile.address || "—"}</span></div>
                                  <div><span className="text-muted-foreground">Квартира:</span> <span className="font-medium text-foreground">{oldData.apartment || profile.apartment || "—"}</span></div>
                                  {oldData.account_number && (
                                    <div><span className="text-muted-foreground">Лицевой счёт:</span> <span className="font-medium text-foreground font-mono">{oldData.account_number}</span></div>
                                  )}
                                </div>

                                {/* Запрошенные изменения (Стало) */}
                                <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs space-y-2 text-left">
                                  <div className="font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider text-[10px] flex items-center justify-between pb-1 border-b border-emerald-500/20">
                                    <span>Стало (Новые реквизиты)</span>
                                    <Badge variant="outline" className="border-emerald-500/40 text-emerald-700 dark:text-emerald-300 text-[9px] py-0">На проверке</Badge>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">ФИО:</span>{" "}
                                    <span className={cn("font-medium", change?.full_name !== oldData.full_name && "font-bold text-emerald-700 dark:text-emerald-300 underline decoration-emerald-500/50")}>
                                      {change?.full_name || "—"}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Телефон:</span>{" "}
                                    <span className={cn("font-medium font-mono", change?.phone !== oldData.phone && "font-bold text-emerald-700 dark:text-emerald-300")}>
                                      {change?.phone || "—"}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Адрес:</span>{" "}
                                    <span className={cn("font-medium", change?.address !== oldData.address && "font-bold text-emerald-700 dark:text-emerald-300 underline decoration-emerald-500/50")}>
                                      {change?.address || "—"}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Квартира:</span>{" "}
                                    <span className={cn("font-medium", change?.apartment !== oldData.apartment && "font-bold text-emerald-700 dark:text-emerald-300")}>
                                      {change?.apartment || "—"}
                                    </span>
                                  </div>
                                  {change?.account_number && (
                                    <div>
                                      <span className="text-muted-foreground">Лицевой счёт:</span>{" "}
                                      <span className={cn("font-medium font-mono", change?.account_number !== oldData.account_number && "font-bold text-emerald-700 dark:text-emerald-300")}>
                                        {change.account_number}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Кнопки подтверждения или отклонения */}
                              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-800">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="rounded-xl border-red-500/30 text-red-600 hover:bg-red-500/10 text-xs h-9 px-4 gap-1.5 font-bold"
                                  onClick={() => handleStartRejectDataChange(profile)}
                                >
                                  <XCircle className="h-4 w-4" />
                                  <span>Отклонить</span>
                                </Button>
                                <Button
                                  size="sm"
                                  className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-9 px-4 gap-1.5 shadow-sm"
                                  onClick={() => handleApproveDataChange(profile)}
                                >
                                  <CheckCircle className="h-4 w-4" />
                                  <span>Подтвердить замену данных</span>
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                  </div>
                  {renderPagination(dataChangeRequests.length)}
                </>
              )}
            </>
          )}

          {/* Подвкладка: Архив и история изменений */}
          {dataChangesSubTab === "history" && (
            <>
              {dataChangeHistory.length === 0 ? (
                <Card className="border-slate-200 dark:border-slate-800">
                  <CardContent className="py-12 text-center text-muted-foreground space-y-2">
                    <History className="h-8 w-8 text-slate-400 mx-auto" />
                    <p className="font-bold text-sm text-foreground">
                      {searchQuery ? "По запросу ничего не найдено" : "История изменений пуста"}
                    </p>
                    <p className="text-xs">Все подтвержденные и отклоненные изменения реквизитов абонентов сохраняются в этом журнале.</p>
                  </CardContent>
                </Card>
              ) : (
                <>
                  <div className="grid grid-cols-1 gap-4">
                    {dataChangeHistory
                      .slice((currentPage - 1) * pageSize, currentPage * pageSize)
                      .map((item) => (
                        <Card key={item.id} className="border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
                          <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                {item.status === "approved" ? (
                                  <Badge className="bg-emerald-600 text-white font-bold text-xs gap-1">
                                    <CheckCircle className="h-3.5 w-3.5" />
                                    <span>Одобрено</span>
                                  </Badge>
                                ) : (
                                  <Badge variant="destructive" className="font-bold text-xs gap-1">
                                    <XCircle className="h-3.5 w-3.5" />
                                    <span>Отклонено</span>
                                  </Badge>
                                )}
                                {renderSpamBadge(item.changesCount)}
                                <span className="text-xs font-bold text-foreground">
                                  {item.userName} ({item.phone})
                                </span>
                                {item.timestamp && (
                                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {new Date(item.timestamp).toLocaleString("ru-RU")}
                                  </span>
                                )}
                              </div>
                              <div className="text-xs font-mono text-muted-foreground">
                                Заявка #{item.id.slice(0, 8)}
                              </div>
                            </div>
                            {item.status === "rejected" && item.reason && (
                              <div className="mt-2 p-2 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 text-xs text-red-600 dark:text-red-400 font-medium">
                                Причина отказа: {item.reason}
                              </div>
                            )}
                          </CardHeader>
                          <CardContent className="space-y-4 pt-4">
                            {/* Сравнение Было ➔ Стало */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs space-y-1.5">
                                <div className="font-bold text-slate-500 uppercase tracking-wider text-[10px] pb-1 border-b border-slate-200 dark:border-slate-700">
                                  Было (Прежние реквизиты)
                                </div>
                                <div><span className="text-muted-foreground">ФИО:</span> <span className="font-medium text-foreground">{item.oldData?.full_name || "—"}</span></div>
                                <div><span className="text-muted-foreground">Телефон:</span> <span className="font-medium text-foreground font-mono">{item.oldData?.phone || "—"}</span></div>
                                <div><span className="text-muted-foreground">Адрес:</span> <span className="font-medium text-foreground">{item.oldData?.address || "—"}</span></div>
                                <div><span className="text-muted-foreground">Квартира:</span> <span className="font-medium text-foreground">{item.oldData?.apartment || "—"}</span></div>
                              </div>

                              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs space-y-1.5">
                                <div className="font-bold text-slate-500 uppercase tracking-wider text-[10px] pb-1 border-b border-slate-200 dark:border-slate-700">
                                  Стало (Запрошенные реквизиты)
                                </div>
                                <div><span className="text-muted-foreground">ФИО:</span> <span className="font-medium text-foreground">{item.newData?.full_name || "—"}</span></div>
                                <div><span className="text-muted-foreground">Телефон:</span> <span className="font-medium text-foreground font-mono">{item.newData?.phone || "—"}</span></div>
                                <div><span className="text-muted-foreground">Адрес:</span> <span className="font-medium text-foreground">{item.newData?.address || "—"}</span></div>
                                <div><span className="text-muted-foreground">Квартира:</span> <span className="font-medium text-foreground">{item.newData?.apartment || "—"}</span></div>
                                {item.newData?.account_number && (
                                  <div><span className="text-muted-foreground">Лицевой счёт:</span> <span className="font-medium text-foreground font-mono">{item.newData?.account_number}</span></div>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                  </div>
                  {renderPagination(dataChangeHistory.length)}
                </>
              )}
            </>
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
                    {formatFullAddress(selectedProfile.address, selectedProfile.apartment) || "—"}
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

      {/* Диалог отклонения заявки на изменение данных */}
      <Dialog open={isRejectDataDialogOpen} onOpenChange={setIsRejectDataDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-red-600">
              <AlertCircle className="h-5 w-5" />
              <span>Отклонить изменение данных</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Укажите причину отклонения. Абонент увидит её в личном кабинете, а его прежние реквизиты останутся без изменений.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <Label className="text-xs font-semibold">Выберите типовую причину:</Label>
            <div className="space-y-1.5">
              {DATA_CHANGE_REJECT_REASONS.map((reason, idx) => (
                <div
                  key={idx}
                  onClick={() => setDataRejectReason(reason)}
                  className={cn(
                    "p-2 rounded-lg border text-left cursor-pointer transition-all",
                    dataRejectReason === reason
                      ? "border-red-500 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 font-semibold"
                      : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900"
                  )}
                >
                  {reason}
                </div>
              ))}
            </div>

            <div className="space-y-1 pt-1">
              <Label className="text-xs font-semibold">Или введите свой комментарий:</Label>
              <Input
                value={dataRejectReason}
                onChange={(e) => setDataRejectReason(e.target.value)}
                placeholder="Причина отклонения..."
                className="text-xs"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsRejectDataDialogOpen(false)} className="rounded-xl">
              Отмена
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={isRejectingData || !dataRejectReason.trim()}
              onClick={handleConfirmRejectDataChange}
              className="rounded-xl font-bold gap-1.5"
            >
              {isRejectingData ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
              <span>Отклонить запрос</span>
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

