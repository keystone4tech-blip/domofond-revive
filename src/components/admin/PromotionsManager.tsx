import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Loader2, Plus, Edit, Trash2, Upload } from "lucide-react";

interface Promotion {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  is_active: boolean;
  start_date: string | null;
  end_date: string | null;
}

export const PromotionsManager = () => {
  const { toast } = useToast();
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    is_active: true,
    start_date: "",
    end_date: "",
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchPromotions();
  }, []);

  const fetchPromotions = async () => {
    try {
      const { data, error } = await supabase
        .from("promotions")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setPromotions(data || []);
    } catch (error) {
      console.error("Error fetching promotions:", error);
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить акции",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const uploadImage = async () => {
    if (!imageFile) return null;

    const fileExt = imageFile.name.split(".").pop();
    const fileName = `${Math.random()}.${fileExt}`;
    const filePath = `${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("promotions")
      .upload(filePath, imageFile);

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from("promotions")
      .getPublicUrl(filePath);

    return publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploading(true);

    try {
      let imageUrl = null;
      if (imageFile) {
        imageUrl = await uploadImage();
      }

      const promotionData = {
        ...formData,
        image_url: imageUrl,
        start_date: formData.start_date || null,
        end_date: formData.end_date || null,
      };

      if (editingId) {
        const { error } = await supabase
          .from("promotions")
          .update(promotionData)
          .eq("id", editingId);

        if (error) throw error;
        toast({ title: "Акция обновлена" });
      } else {
        const { error } = await supabase
          .from("promotions")
          .insert([promotionData]);

        if (error) throw error;
        toast({ title: "Акция создана" });
      }

      resetForm();
      fetchPromotions();
    } catch (error) {
      console.error("Error saving promotion:", error);
      toast({
        title: "Ошибка",
        description: "Не удалось сохранить акцию",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleEdit = (promotion: Promotion) => {
    setEditingId(promotion.id);
    setFormData({
      title: promotion.title,
      description: promotion.description || "",
      is_active: promotion.is_active,
      start_date: promotion.start_date?.split("T")[0] || "",
      end_date: promotion.end_date?.split("T")[0] || "",
    });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Удалить эту акцию?")) return;

    try {
      const { error } = await supabase
        .from("promotions")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast({ title: "Акция удалена" });
      fetchPromotions();
    } catch (error) {
      console.error("Error deleting promotion:", error);
      toast({
        title: "Ошибка",
        description: "Не удалось удалить акцию",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      title: "",
      description: "",
      is_active: true,
      start_date: "",
      end_date: "",
    });
    setImageFile(null);
  };

  if (loading) {
    return <Loader2 className="h-8 w-8 animate-spin mx-auto" />;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{editingId ? "Редактировать акцию" : "Создать акцию"}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="title">Заголовок</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
              />
            </div>

            <div>
              <Label htmlFor="description">Описание</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={4}
              />
            </div>

            <div>
              <Label htmlFor="image">Изображение</Label>
              <Input
                id="image"
                type="file"
                accept="image/*"
                onChange={(e) => setImageFile(e.target.files?.[0] || null)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="start_date">Дата начала</Label>
                <Input
                  id="start_date"
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="end_date">Дата окончания</Label>
                <Input
                  id="end_date"
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <Label htmlFor="is_active">Активна</Label>
            </div>

            <div className="flex gap-2">
              <Button type="submit" disabled={uploading}>
                {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                {editingId ? "Обновить" : "Создать"}
              </Button>
              {editingId && (
                <Button type="button" variant="outline" onClick={resetForm}>
                  Отмена
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {promotions.map((promotion) => (
          <Card key={promotion.id}>
            <CardContent className="p-6">
              <div className="flex justify-between items-start gap-4">
                <div className="flex-1">
                  <h3 className="text-xl font-semibold mb-2">{promotion.title}</h3>
                  {promotion.description && (
                    <p className="text-muted-foreground mb-2">{promotion.description}</p>
                  )}
                  {promotion.image_url && (
                    <img src={promotion.image_url} alt={promotion.title} className="w-48 h-32 object-cover rounded mt-2" />
                  )}
                  <div className="flex gap-4 mt-2 text-sm text-muted-foreground">
                    {promotion.start_date && <span>С: {new Date(promotion.start_date).toLocaleDateString()}</span>}
                    {promotion.end_date && <span>До: {new Date(promotion.end_date).toLocaleDateString()}</span>}
                  </div>
                  <div className="mt-2">
                    <span className={`inline-block px-2 py-1 rounded text-xs ${promotion.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                      {promotion.is_active ? 'Активна' : 'Неактивна'}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="icon" variant="outline" onClick={() => handleEdit(promotion)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="destructive" onClick={() => handleDelete(promotion.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};