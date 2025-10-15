import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Loader2, Plus, Edit, Trash2 } from "lucide-react";

interface News {
  id: string;
  title: string;
  content: string;
  excerpt: string | null;
  image_url: string | null;
  video_url: string | null;
  is_published: boolean;
  published_at: string | null;
}

export const NewsManager = () => {
  const { toast } = useToast();
  const [news, setNews] = useState<News[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    excerpt: "",
    video_url: "",
    is_published: false,
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchNews();
  }, []);

  const fetchNews = async () => {
    try {
      const { data, error } = await supabase
        .from("news")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setNews(data || []);
    } catch (error) {
      console.error("Error fetching news:", error);
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить новости",
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
      .from("news")
      .upload(filePath, imageFile);

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from("news")
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

      const newsData = {
        ...formData,
        image_url: imageUrl,
        excerpt: formData.excerpt || null,
        video_url: formData.video_url || null,
        published_at: formData.is_published ? new Date().toISOString() : null,
      };

      if (editingId) {
        const { error } = await supabase
          .from("news")
          .update(newsData)
          .eq("id", editingId);

        if (error) throw error;
        toast({ title: "Новость обновлена" });
      } else {
        const { error } = await supabase
          .from("news")
          .insert([newsData]);

        if (error) throw error;
        toast({ title: "Новость создана" });
      }

      resetForm();
      fetchNews();
    } catch (error) {
      console.error("Error saving news:", error);
      toast({
        title: "Ошибка",
        description: "Не удалось сохранить новость",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleEdit = (item: News) => {
    setEditingId(item.id);
    setFormData({
      title: item.title,
      content: item.content,
      excerpt: item.excerpt || "",
      video_url: item.video_url || "",
      is_published: item.is_published,
    });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Удалить эту новость?")) return;

    try {
      const { error } = await supabase
        .from("news")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast({ title: "Новость удалена" });
      fetchNews();
    } catch (error) {
      console.error("Error deleting news:", error);
      toast({
        title: "Ошибка",
        description: "Не удалось удалить новость",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      title: "",
      content: "",
      excerpt: "",
      video_url: "",
      is_published: false,
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
          <CardTitle>{editingId ? "Редактировать новость" : "Создать новость"}</CardTitle>
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
              <Label htmlFor="excerpt">Краткое описание</Label>
              <Input
                id="excerpt"
                value={formData.excerpt}
                onChange={(e) => setFormData({ ...formData, excerpt: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="content">Содержание</Label>
              <Textarea
                id="content"
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                rows={6}
                required
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

            <div>
              <Label htmlFor="video_url">URL видео (YouTube, Vimeo)</Label>
              <Input
                id="video_url"
                type="url"
                value={formData.video_url}
                onChange={(e) => setFormData({ ...formData, video_url: e.target.value })}
                placeholder="https://www.youtube.com/watch?v=..."
              />
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="is_published"
                checked={formData.is_published}
                onCheckedChange={(checked) => setFormData({ ...formData, is_published: checked })}
              />
              <Label htmlFor="is_published">Опубликована</Label>
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
        {news.map((item) => (
          <Card key={item.id}>
            <CardContent className="p-6">
              <div className="flex justify-between items-start gap-4">
                <div className="flex-1">
                  <h3 className="text-xl font-semibold mb-2">{item.title}</h3>
                  {item.excerpt && (
                    <p className="text-sm text-muted-foreground mb-2">{item.excerpt}</p>
                  )}
                  <p className="text-muted-foreground mb-2 line-clamp-2">{item.content}</p>
                  {item.image_url && (
                    <img src={item.image_url} alt={item.title} className="w-48 h-32 object-cover rounded mt-2" />
                  )}
                  {item.video_url && (
                    <a href={item.video_url} target="_blank" rel="noopener noreferrer" className="text-primary text-sm mt-2 inline-block">
                      Видео
                    </a>
                  )}
                  <div className="mt-2">
                    <span className={`inline-block px-2 py-1 rounded text-xs ${item.is_published ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                      {item.is_published ? 'Опубликована' : 'Черновик'}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="icon" variant="outline" onClick={() => handleEdit(item)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="destructive" onClick={() => handleDelete(item.id)}>
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