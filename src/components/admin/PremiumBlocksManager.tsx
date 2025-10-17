import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Edit, Trash2, X } from "lucide-react";

interface PremiumBlock {
  id?: string;
  page: string;
  block_name: string;
  content: {
    id: string;
    badge_text: string;
    title: string;
    description: string;
    features: Array<{
      icon: string;
      title: string;
      description: string;
    }>;
    price: string;
    price_description: string;
    benefits: string[];
    disclaimer: string;
  };
  order_index: number;
  is_active: boolean;
}

const defaultContent = {
  id: "",
  badge_text: "Премиум предложение",
  title: "Умный видеодомофон нового поколения",
  description: "Революционная система безопасности с искусственным интеллектом для вашего дома",
  features: [
    {
      icon: "ScanFace",
      title: "Распознавание лиц",
      description: "Автоматическая идентификация жильцов и уведомления о незнакомых посетителях"
    }
  ],
  price: "от 25 000 ₽",
  price_description: "включая установку",
  benefits: ["Гарантия 3 года", "Бесплатное обслуживание 1 год"],
  disclaimer: "* Окончательная стоимость зависит от конфигурации и особенностей объекта"
};

export const PremiumBlocksManager = () => {
  const [blocks, setBlocks] = useState<PremiumBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingBlock, setEditingBlock] = useState<PremiumBlock | null>(null);
  const [formData, setFormData] = useState<PremiumBlock>({
    page: "index",
    block_name: "premium_offer",
    content: defaultContent,
    order_index: 0,
    is_active: true,
  });
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
        .eq("block_name", "premium_offer")
        .order("order_index", { ascending: true });

      if (error) throw error;
      setBlocks((data || []) as unknown as PremiumBlock[]);
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
      if (editingBlock) {
        const { error } = await supabase
          .from("site_blocks")
          .update({
            content: formData.content,
            order_index: formData.order_index,
            is_active: formData.is_active,
          })
          .eq("id", editingBlock.id!);

        if (error) throw error;

        toast({
          title: "Успешно",
          description: "Блок обновлен",
        });
      } else {
        const { error } = await supabase
          .from("site_blocks")
          .insert({
            page: formData.page,
            block_name: formData.block_name,
            content: formData.content,
            order_index: formData.order_index,
            is_active: formData.is_active,
          });

        if (error) throw error;

        toast({
          title: "Успешно",
          description: "Блок создан",
        });
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

  const handleEdit = (block: PremiumBlock) => {
    setEditingBlock(block);
    setFormData(block);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Вы уверены, что хотите удалить этот блок?")) return;

    try {
      const { error } = await supabase
        .from("site_blocks")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Успешно",
        description: "Блок удален",
      });
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
    setEditingBlock(null);
    setFormData({
      page: "index",
      block_name: "premium_offer",
      content: defaultContent,
      order_index: 0,
      is_active: true,
    });
  };

  const updateContent = (field: string, value: any) => {
    setFormData({
      ...formData,
      content: {
        ...formData.content,
        [field]: value,
      },
    });
  };

  const addFeature = () => {
    setFormData({
      ...formData,
      content: {
        ...formData.content,
        features: [
          ...formData.content.features,
          { icon: "Star", title: "", description: "" }
        ],
      },
    });
  };

  const updateFeature = (index: number, field: string, value: string) => {
    const newFeatures = [...formData.content.features];
    newFeatures[index] = { ...newFeatures[index], [field]: value };
    updateContent("features", newFeatures);
  };

  const removeFeature = (index: number) => {
    const newFeatures = formData.content.features.filter((_, i) => i !== index);
    updateContent("features", newFeatures);
  };

  const addBenefit = () => {
    updateContent("benefits", [...formData.content.benefits, ""]);
  };

  const updateBenefit = (index: number, value: string) => {
    const newBenefits = [...formData.content.benefits];
    newBenefits[index] = value;
    updateContent("benefits", newBenefits);
  };

  const removeBenefit = (index: number) => {
    const newBenefits = formData.content.benefits.filter((_, i) => i !== index);
    updateContent("benefits", newBenefits);
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
      <Card>
        <CardHeader>
          <CardTitle>
            {editingBlock ? "Редактировать блок" : "Создать новый блок"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-4">
              <div>
                <Label htmlFor="badge_text">Текст бейджа</Label>
                <Input
                  id="badge_text"
                  value={formData.content.badge_text}
                  onChange={(e) => updateContent("badge_text", e.target.value)}
                  required
                />
              </div>

              <div>
                <Label htmlFor="title">Заголовок</Label>
                <Input
                  id="title"
                  value={formData.content.title}
                  onChange={(e) => updateContent("title", e.target.value)}
                  required
                />
              </div>

              <div>
                <Label htmlFor="description">Описание</Label>
                <Textarea
                  id="description"
                  value={formData.content.description}
                  onChange={(e) => updateContent("description", e.target.value)}
                  required
                />
              </div>

              <div>
                <Label>Возможности системы</Label>
                <div className="space-y-4 mt-2">
                  {formData.content.features.map((feature, index) => (
                    <Card key={index}>
                      <CardContent className="pt-4 space-y-2">
                        <div className="flex justify-between items-start">
                          <Label>Возможность {index + 1}</Label>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeFeature(index)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                        <Input
                          placeholder="Иконка (ScanFace, Smartphone, Video, HardDrive)"
                          value={feature.icon}
                          onChange={(e) => updateFeature(index, "icon", e.target.value)}
                        />
                        <Input
                          placeholder="Название"
                          value={feature.title}
                          onChange={(e) => updateFeature(index, "title", e.target.value)}
                        />
                        <Textarea
                          placeholder="Описание"
                          value={feature.description}
                          onChange={(e) => updateFeature(index, "description", e.target.value)}
                        />
                      </CardContent>
                    </Card>
                  ))}
                  <Button type="button" variant="outline" onClick={addFeature}>
                    <Plus className="h-4 w-4 mr-2" />
                    Добавить возможность
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="price">Цена</Label>
                  <Input
                    id="price"
                    value={formData.content.price}
                    onChange={(e) => updateContent("price", e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="price_description">Описание цены</Label>
                  <Input
                    id="price_description"
                    value={formData.content.price_description}
                    onChange={(e) => updateContent("price_description", e.target.value)}
                    required
                  />
                </div>
              </div>

              <div>
                <Label>Преимущества</Label>
                <div className="space-y-2 mt-2">
                  {formData.content.benefits.map((benefit, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        value={benefit}
                        onChange={(e) => updateBenefit(index, e.target.value)}
                        placeholder="Преимущество"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeBenefit(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button type="button" variant="outline" onClick={addBenefit}>
                    <Plus className="h-4 w-4 mr-2" />
                    Добавить преимущество
                  </Button>
                </div>
              </div>

              <div>
                <Label htmlFor="disclaimer">Примечание</Label>
                <Input
                  id="disclaimer"
                  value={formData.content.disclaimer}
                  onChange={(e) => updateContent("disclaimer", e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="order_index">Порядок отображения</Label>
                <Input
                  id="order_index"
                  type="number"
                  value={formData.order_index}
                  onChange={(e) => setFormData({ ...formData, order_index: parseInt(e.target.value) })}
                  required
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
            </div>

            <div className="flex gap-2">
              <Button type="submit">
                {editingBlock ? "Обновить" : "Создать"}
              </Button>
              {editingBlock && (
                <Button type="button" variant="outline" onClick={resetForm}>
                  Отмена
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Существующие блоки</h3>
        {blocks.map((block) => (
          <Card key={block.id}>
            <CardContent className="pt-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h4 className="font-semibold text-lg">{block.content.title}</h4>
                  <p className="text-sm text-muted-foreground">{block.content.description}</p>
                  <div className="mt-2 space-y-1">
                    <p className="text-sm">
                      <span className="font-medium">Бейдж:</span> {block.content.badge_text}
                    </p>
                    <p className="text-sm">
                      <span className="font-medium">Цена:</span> {block.content.price}
                    </p>
                    <p className="text-sm">
                      <span className="font-medium">Порядок:</span> {block.order_index}
                    </p>
                    <p className="text-sm">
                      <span className="font-medium">Статус:</span>{" "}
                      <span className={block.is_active ? "text-green-600" : "text-red-600"}>
                        {block.is_active ? "Активен" : "Неактивен"}
                      </span>
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(block)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDelete(block.id!)}
                  >
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
