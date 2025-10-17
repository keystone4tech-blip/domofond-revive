import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Trash2, Plus, GripVertical } from "lucide-react";
import { Switch } from "@/components/ui/switch";

interface StatsBlock {
  id: string;
  icon: string;
  value: string;
  label: string;
  is_active: boolean;
  order_index: number;
}

const availableIcons = [
  "Users",
  "Clock", 
  "Award",
  "Shield",
  "TrendingUp",
  "Star",
  "CheckCircle",
  "Zap",
];

export const StatsBlocksManager = () => {
  const [blocks, setBlocks] = useState<StatsBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchBlocks();
  }, []);

  const fetchBlocks = async () => {
    try {
      const { data, error } = await supabase
        .from("site_blocks")
        .select("*")
        .eq("page", "index")
        .eq("block_name", "stats")
        .order("order_index", { ascending: true });

      if (error) throw error;

      if (data) {
        const blocksData = data.map((block) => {
          const content = block.content as any;
          return {
            id: block.id,
            icon: content?.icon || "Users",
            value: content?.value || "",
            label: content?.label || "",
            is_active: block.is_active,
            order_index: block.order_index || 0,
          };
        });
        setBlocks(blocksData);
      }
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

  const handleAddBlock = () => {
    const newBlock: StatsBlock = {
      id: `new-${Date.now()}`,
      icon: "Users",
      value: "0",
      label: "Новый блок",
      is_active: true,
      order_index: blocks.length,
    };
    setBlocks([...blocks, newBlock]);
  };

  const handleUpdateBlock = (id: string, field: keyof StatsBlock, value: any) => {
    setBlocks(blocks.map(block => 
      block.id === id ? { ...block, [field]: value } : block
    ));
  };

  const handleDeleteBlock = async (id: string) => {
    if (id.startsWith("new-")) {
      setBlocks(blocks.filter(block => block.id !== id));
      return;
    }

    try {
      const { error } = await supabase
        .from("site_blocks")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setBlocks(blocks.filter(block => block.id !== id));
      toast({
        title: "Успешно",
        description: "Блок удален",
      });
    } catch (error) {
      console.error("Error deleting block:", error);
      toast({
        title: "Ошибка",
        description: "Не удалось удалить блок",
        variant: "destructive",
      });
    }
  };

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      for (const block of blocks) {
        const blockData = {
          page: "index",
          block_name: "stats",
          content: {
            icon: block.icon,
            value: block.value,
            label: block.label,
          },
          is_active: block.is_active,
          order_index: block.order_index,
        };

        if (block.id.startsWith("new-")) {
          const { error } = await supabase
            .from("site_blocks")
            .insert(blockData);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("site_blocks")
            .update(blockData)
            .eq("id", block.id);
          if (error) throw error;
        }
      }

      toast({
        title: "Успешно",
        description: "Все блоки сохранены",
      });
      
      await fetchBlocks();
    } catch (error) {
      console.error("Error saving blocks:", error);
      toast({
        title: "Ошибка",
        description: "Не удалось сохранить блоки",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Статистические блоки</h2>
        <div className="flex gap-2">
          <Button onClick={handleAddBlock} variant="outline">
            <Plus className="h-4 w-4 mr-2" />
            Добавить блок
          </Button>
          <Button onClick={handleSaveAll} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Сохранить все
          </Button>
        </div>
      </div>

      <div className="grid gap-4">
        {blocks.map((block, index) => (
          <Card key={block.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <GripVertical className="h-5 w-5 text-muted-foreground" />
                  <CardTitle className="text-lg">Блок {index + 1}</CardTitle>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`active-${block.id}`}>Активен</Label>
                    <Switch
                      id={`active-${block.id}`}
                      checked={block.is_active}
                      onCheckedChange={(checked) => handleUpdateBlock(block.id, "is_active", checked)}
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteBlock(block.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Иконка</Label>
                  <Select
                    value={block.icon}
                    onValueChange={(value) => handleUpdateBlock(block.id, "icon", value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {availableIcons.map((icon) => (
                        <SelectItem key={icon} value={icon}>
                          {icon}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Значение</Label>
                  <Input
                    value={block.value}
                    onChange={(e) => handleUpdateBlock(block.id, "value", e.target.value)}
                    placeholder="10 000+"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Описание</Label>
                  <Input
                    value={block.label}
                    onChange={(e) => handleUpdateBlock(block.id, "label", e.target.value)}
                    placeholder="Довольных клиентов"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {blocks.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p>Нет статистических блоков. Добавьте первый блок.</p>
        </div>
      )}
    </div>
  );
};
