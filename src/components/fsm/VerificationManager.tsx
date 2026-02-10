import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
} from "lucide-react";
import { useEffect } from "react";

interface Profile {
  id: string;
  full_name: string | null;
  phone: string | null;
  address: string | null;
  apartment: string | null;
  is_verified: boolean | null;
  created_at: string | null;
  updated_at: string | null;
}

const VerificationManager = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState({
    full_name: "",
    phone: "",
    address: "",
    apartment: "",
  });

  const { data: profiles, isLoading } = useQuery({
    queryKey: ["verification-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data as Profile[];
    },
  });

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("profiles-verification")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["verification-profiles"] });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const pendingProfiles = profiles?.filter((p) => !p.is_verified && p.full_name) || [];
  const verifiedProfiles = profiles?.filter((p) => p.is_verified) || [];

  const handleApprove = async (profileId: string) => {
    const { error } = await supabase
      .from("profiles")
      .update({ is_verified: true })
      .eq("id", profileId);

    if (error) {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Одобрено", description: "Пользователь верифицирован" });
    queryClient.invalidateQueries({ queryKey: ["verification-profiles"] });
    setSelectedProfile(null);
  };

  const handleReject = async (profileId: string) => {
    const { error } = await supabase
      .from("profiles")
      .update({ is_verified: false })
      .eq("id", profileId);

    if (error) {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Отказано", description: "Верификация отклонена" });
    queryClient.invalidateQueries({ queryKey: ["verification-profiles"] });
    setSelectedProfile(null);
  };

  const handleSaveEdit = async () => {
    if (!selectedProfile) return;
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: editData.full_name,
        phone: editData.phone,
        address: editData.address,
        apartment: editData.apartment,
      })
      .eq("id", selectedProfile.id);

    if (error) {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Сохранено", description: "Данные пользователя обновлены" });
    setEditMode(false);
    queryClient.invalidateQueries({ queryKey: ["verification-profiles"] });
    setSelectedProfile(null);
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

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Pending Verification */}
      <div>
        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Clock className="h-5 w-5 text-yellow-600" />
          Ожидают верификации
          {pendingProfiles.length > 0 && (
            <Badge variant="destructive">{pendingProfiles.length}</Badge>
          )}
        </h3>
        {pendingProfiles.length === 0 ? (
          <Card className="border-border/50">
            <CardContent className="py-8 text-center text-muted-foreground">
              Нет пользователей, ожидающих верификации
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {pendingProfiles.map((profile) => (
              <Card
                key={profile.id}
                className="border-border/50 cursor-pointer hover:shadow-md transition-all"
                onClick={() => openProfile(profile)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
                        <User className="h-5 w-5 text-yellow-600" />
                      </div>
                      <div>
                        <p className="font-medium">{profile.full_name || "Без имени"}</p>
                        <p className="text-sm text-muted-foreground">{profile.phone || "Нет телефона"}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-yellow-600 border-yellow-300">
                      Ожидает
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Verified */}
      <div>
        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-green-600" />
          Верифицированные
          <Badge variant="secondary">{verifiedProfiles.length}</Badge>
        </h3>
        {verifiedProfiles.length === 0 ? (
          <Card className="border-border/50">
            <CardContent className="py-8 text-center text-muted-foreground">
              Нет верифицированных пользователей
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {verifiedProfiles.map((profile) => (
              <Card
                key={profile.id}
                className="border-border/50 cursor-pointer hover:shadow-md transition-all"
                onClick={() => openProfile(profile)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      </div>
                      <div>
                        <p className="font-medium">{profile.full_name || "Без имени"}</p>
                        <p className="text-sm text-muted-foreground">{profile.phone || "Нет телефона"}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-green-600 border-green-300">
                      Верифицирован
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Profile Detail Dialog */}
      <Dialog open={!!selectedProfile} onOpenChange={() => setSelectedProfile(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Профиль пользователя
            </DialogTitle>
          </DialogHeader>

          {selectedProfile && !editMode && (
            <div className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Имя:</span>
                  <span className="font-medium">{selectedProfile.full_name || "—"}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Телефон:</span>
                  <span className="font-medium">{selectedProfile.phone || "—"}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Адрес:</span>
                  <span className="font-medium">{selectedProfile.address || "—"}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Home className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Квартира:</span>
                  <span className="font-medium">{selectedProfile.apartment || "—"}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Статус:</span>
                  {selectedProfile.is_verified ? (
                    <Badge className="bg-green-100 text-green-800">Верифицирован</Badge>
                  ) : (
                    <Badge className="bg-yellow-100 text-yellow-800">Не верифицирован</Badge>
                  )}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditMode(true)}
                  className="flex-1"
                >
                  <Edit className="h-4 w-4 mr-1" />
                  Редактировать
                </Button>
                {!selectedProfile.is_verified ? (
                  <Button
                    size="sm"
                    onClick={() => handleApprove(selectedProfile.id)}
                    className="flex-1 bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Одобрить
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleReject(selectedProfile.id)}
                    className="flex-1"
                  >
                    <XCircle className="h-4 w-4 mr-1" />
                    Отозвать
                  </Button>
                )}
              </div>
            </div>
          )}

          {selectedProfile && editMode && (
            <div className="space-y-4">
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label>Полное имя</Label>
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
                  <Label>Адрес</Label>
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

              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setEditMode(false)} className="flex-1">
                  Отмена
                </Button>
                <Button size="sm" onClick={handleSaveEdit} className="flex-1">
                  Сохранить
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default VerificationManager;
