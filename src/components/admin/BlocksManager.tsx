import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Edit, Trash2 } from "lucide-react";

interface SiteBlock {
  id: string;
  page: string;
  block_name: string;
  content: any;
  is_active: boolean;
  order_index: number;
}

export const BlocksManager = () => {
  const { toast } = useToast();
  const [blocks, setBlocks] = useState<SiteBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    page: "index",
    block_name: "",
    content: "{}",
    is_active: true,
    order_index: 0,
  });

  useEffect(() => {
    fetchBlocks();
  }, []);

  const fetchBlocks = async () => {
    try {
      const { data, error } = await supabase
        .from("site_blocks")
        .select("*")
        .order("page")
        .order("order_index");

      if (error) throw error;
      setBlocks(data || []);
    } catch (error) {
      console.error("Error fetching blocks:", error);
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить блоки",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      let content;
      try {
        content = JSON.parse(formData.content);
      } catch {
        toast({
          title: "Ошибка",
          description: "Неверный формат JSON",
          variant: "destructive",
        });
        return;
      }

      const blockData = {
        ...formData,
        content,
      };

      if (editingId) {
        const { error } = await supabase
          .from("site_blocks")
          .update(blockData)
          .eq("id", editingId);

        if (error) throw error;
        toast({ title: "Блок обновлен" });
      } else {
        const { error } = await supabase
          .from("site_blocks")
          .insert([blockData]);

        if (error) throw error;
        toast({ title: "Блок создан" });
      }

      resetForm();
      fetchBlocks();
    } catch (error) {
      console.error("Error saving block:", error);
      toast({
        title: "Ошибка",
        description: "Не удалось сохранить блок",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (block: SiteBlock) => {
    setEditingId(block.id);
    setFormData({
      page: block.page,
      block_name: block.block_name,
      content: JSON.stringify(block.content, null, 2),
      is_active: block.is_active,
      order_index: block.order_index,
    });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Удалить этот блок?")) return;

    try {
      const { error } = await supabase
        .from("site_blocks")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast({ title: "Блок удален" });
      fetchBlocks();
    } catch (error) {
      console.error("Error deleting block:", error);
      toast({
        title: "Ошибка",
        description: "Не удалось удалить блок",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      page: "index",
      block_name: "",
      content: "{}",
      is_active: true,
      order_index: 0,
    });
  };

  if (loading) {
    return <Loader2 className="h-8 w-8 animate-spin mx-auto" />;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{editingId ? "Редактировать блок" : "Создать блок"}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="page">Страница</Label>
              <Select value={formData.page} onValueChange={(value) => setFormData({ ...formData, page: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="index">Главная</SelectItem>
                  <SelectItem value="domofony">Домофоны</SelectItem>
                  <SelectItem value="videonablyudenie">Видеонаблюдение</SelectItem>
                  <SelectItem value="nashi-raboty">Наши работы</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="block_name">Название блока</Label>
              <Input
                id="block_name"
                value={formData.block_name}
                onChange={(e) => setFormData({ ...formData, block_name: e.target.value })}
                required
              />
            </div>

            <div>
              <Label htmlFor="content">Контент (JSON)</Label>
              <Textarea
                id="content"
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                rows={8}
                className="font-mono text-sm"
                required
              />
              <p className="text-xs text-muted-foreground mt-1">
                Пример: {`{"title": "Заголовок", "text": "Текст блока"}`}
              </p>
            </div>

            <div>
              <Label htmlFor="order_index">Порядок отображения</Label>
              <Input
                id="order_index"
                type="number"
                value={formData.order_index}
                onChange={(e) => setFormData({ ...formData, order_index: parseInt(e.target.value) })}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <Label htmlFor="is_active">Активен</Label>
            </div>

            <div className="flex gap-2">
              <Button type="submit">
                <Plus className="h-4 w-4 mr-2" />
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
        {blocks.map((block) => (
          <Card key={block.id}>
            <CardContent className="p-6">
              <div className="flex justify-between items-start gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-1 bg-primary/10 text-primary text-xs rounded">{block.page}</span>
                    <h3 className="text-lg font-semibold">{block.block_name}</h3>
                  </div>
                  <pre className="bg-muted p-3 rounded text-xs overflow-auto">
                    {JSON.stringify(block.content, null, 2)}
                  </pre>
                  <div className="mt-2 flex items-center gap-4">
                    <span className={`inline-block px-2 py-1 rounded text-xs ${block.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                      {block.is_active ? 'Активен' : 'Неактивен'}
                    </span>
                    <span className="text-xs text-muted-foreground">Порядок: {block.order_index}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="icon" variant="outline" onClick={() => handleEdit(block)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="destructive" onClick={() => handleDelete(block.id)}>
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