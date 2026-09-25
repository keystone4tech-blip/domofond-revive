import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Trash2, Plus, GripVertical, RefreshCw, Sparkles, CheckCircle2, Shield, Users, Clock, Award, TrendingUp, Star, Zap } from "lucide-react";
import { Switch } from "@/components/ui/switch";

interface StatsBlock {
  id: string;
  icon: string;
  value: string;
  label: string;
  source_type: "accounts_db" | "krasnodar_years" | "yufo_years" | "custom";
  is_active: boolean;
  order_index: number;
}

interface IconOption {
  value: string;
  label: string;
}

const availableIcons: IconOption[] = [
  { value: "Users", label: "Пользователи / Абоненты (Users)" },
  { value: "Clock", label: "Часы / Стаж (Clock)" },
  { value: "TrendingUp", label: "Рост / Опыт (TrendingUp)" },
  { value: "Award", label: "Награда / Качество (Award)" },
  { value: "Shield", label: "Щит / Безопасность (Shield)" },
  { value: "Star", label: "Звезда / Рейтинг (Star)" },
  { value: "CheckCircle", label: "Галочка / Гарантия (CheckCircle)" },
  { value: "Zap", label: "Молния / Скорость (Zap)" },
];

export const StatsBlocksManager = () => {
  const [blocks, setBlocks] = useState<StatsBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [serverStats, setServerStats] = useState<{
    accounts_count: number;
    krasnodar_years: number;
    yufo_years: number;
  }>({
    accounts_count: 11244,
    krasnodar_years: 7,
    yufo_years: 22,
  });

  const { toast } = useToast();

  useEffect(() => {
    fetchBlocks();
    fetchServerStats();
  }, []);

  /**
   * Получение актуальных живых метрик с сервера
   */
  const fetchServerStats = async () => {
    try {
      const res = await fetch("/backend-api/api/public-stats");
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.stats) {
          setServerStats({
            accounts_count: json.stats.accounts_count || 11244,
            krasnodar_years: json.stats.krasnodar_years || 7,
            yufo_years: json.stats.yufo_years || 22,
          });
        }
      }
    } catch (err) {
      console.warn("Не удалось загрузить живые метрики сервера:", err);
    }
  };

  /**
   * Загрузка настроенных блоков из таблицы site_blocks
   */
  const fetchBlocks = async () => {
    try {
      const { data, error } = await supabase
        .from("site_blocks")
        .select("*")
        .eq("page", "index")
        .eq("block_name", "stats")
        .order("order_index", { ascending: true });

      if (error) throw error;

      if (data && data.length > 0) {
        const blocksData = data.map((block) => {
          const content = block.content as any;
          return {
            id: block.id,
            icon: content?.icon || "Users",
            value: content?.value || "",
            label: content?.label || "",
            source_type: (content?.source_type as any) || "custom",
            is_active: block.is_active,
            order_index: block.order_index || 0,
          };
        });
        setBlocks(blocksData);
      } else {
        // Если в БД еще нет записей, подставляем эталонный набор
        initDefaultBlocks();
      }
    } catch (error) {
      console.error("Ошибка загрузки блоков статистики:", error);
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить блоки из базы данных",
        variant: "destructive",
      });
      initDefaultBlocks();
    } finally {
      setLoading(false);
    }
  };

  /**
   * Инициализация эталонных блоков с реальными показателями компании
   */
  const initDefaultBlocks = () => {
    setBlocks([
      {
        id: "default-clients",
        icon: "Users",
        value: "{auto_accounts}",
        label: "Довольных клиентов",
        source_type: "accounts_db",
        is_active: true,
        order_index: 0,
      },
      {
        id: "default-krd",
        icon: "Clock",
        value: "{auto_krasnodar}",
        label: "На рынке Краснодара",
        source_type: "krasnodar_years",
        is_active: true,
        order_index: 1,
      },
      {
        id: "default-yufo",
        icon: "TrendingUp",
        value: "{auto_yufo}",
        label: "Опыт работы по ЮФО",
        source_type: "yufo_years",
        is_active: true,
        order_index: 2,
      },
      {
        id: "default-quality",
        icon: "Award",
        value: "100%",
        label: "Гарантия качества",
        source_type: "custom",
        is_active: true,
        order_index: 3,
      },
    ]);
  };

  const handleAddBlock = () => {
    const newBlock: StatsBlock = {
      id: `new-${Date.now()}`,
      icon: "Users",
      value: "100%",
      label: "Новый показатель",
      source_type: "custom",
      is_active: true,
      order_index: blocks.length,
    };
    setBlocks([...blocks, newBlock]);
  };

  const handleUpdateBlock = (id: string, field: keyof StatsBlock, value: any) => {
    setBlocks(blocks.map(block => {
      if (block.id !== id) return block;

      const updated = { ...block, [field]: value };

      // При смене источника данных автоматически настраиваем дефолтное значение
      if (field === "source_type") {
        if (value === "accounts_db") {
          updated.value = "{auto_accounts}";
          if (!updated.label || updated.label === "Новый показатель") updated.label = "Довольных клиентов";
          updated.icon = "Users";
        } else if (value === "krasnodar_years") {
          updated.value = "{auto_krasnodar}";
          if (!updated.label || updated.label === "Новый показатель") updated.label = "На рынке Краснодара";
          updated.icon = "Clock";
        } else if (value === "yufo_years") {
          updated.value = "{auto_yufo}";
          if (!updated.label || updated.label === "Новый показатель") updated.label = "Опыт работы по ЮФО";
          updated.icon = "TrendingUp";
        } else if (value === "custom" && updated.value.startsWith("{auto_")) {
          updated.value = "100%";
        }
      }

      return updated;
    }));
  };

  const handleDeleteBlock = async (id: string) => {
    if (id.startsWith("new-") || id.startsWith("default-")) {
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
      console.error("Ошибка при удалении блока:", error);
      toast({
        title: "Ошибка",
        description: "Не удалось удалить блок",
        variant: "destructive",
      });
    }
  };

  /**
   * Сохранение всех статистических блоков в базу данных
   */
  const handleSaveAll = async () => {
    setSaving(true);
    try {
      for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i];
        const blockData = {
          page: "index",
          block_name: "stats",
          content: {
            icon: block.icon,
            value: block.value,
            label: block.label,
            source_type: block.source_type,
          },
          is_active: block.is_active,
          order_index: i,
        };

        if (block.id.startsWith("new-") || block.id.startsWith("default-")) {
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
        title: "Успешно сохранено",
        description: "Все показатели статистики и счетчиков обновлены на сайте",
      });
      
      await fetchBlocks();
    } catch (error) {
      console.error("Ошибка при сохранении блоков:", error);
      toast({
        title: "Ошибка",
        description: "Не удалось сохранить блоки",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  /**
   * Получение человекопонятного значения для предпросмотра
   */
  const getPreviewValue = (block: StatsBlock) => {
    if (block.source_type === "accounts_db") {
      return `${serverStats.accounts_count.toLocaleString("ru-RU")}`;
    }
    if (block.source_type === "krasnodar_years") {
      return `${serverStats.krasnodar_years} лет`;
    }
    if (block.source_type === "yufo_years") {
      return `${serverStats.yufo_years} года`;
    }
    return block.value;
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
      {/* Шапка менеджера счетчиков */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card/60 p-4 rounded-xl border border-border">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            Счетчики и показатели компании
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Отображаются на главной странице под Hero-шапкой. Доступна автоматическая привязка к реальной базе данных.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={initDefaultBlocks} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Сброс к эталону
          </Button>
          <Button onClick={handleAddBlock} variant="outline" size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Добавить
          </Button>
          <Button onClick={handleSaveAll} disabled={saving} size="sm">
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
            Сохранить все
          </Button>
        </div>
      </div>

      {/* Информационная сводка живых метрик сервера */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-sm">
          <span className="text-muted-foreground block text-xs">Реально в БД (accounts):</span>
          <strong className="text-base text-primary font-bold">{serverStats.accounts_count.toLocaleString("ru-RU")} лицевых счетов</strong>
        </div>
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-sm">
          <span className="text-muted-foreground block text-xs">Стаж в Краснодаре (с 14.02.2019):</span>
          <strong className="text-base text-primary font-bold">{serverStats.krasnodar_years} лет официальной работы</strong>
        </div>
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-sm">
          <span className="text-muted-foreground block text-xs">Опыт команды по ЮФО (с 2004 года):</span>
          <strong className="text-base text-primary font-bold">{serverStats.yufo_years} года на рынке систем безопасности</strong>
        </div>
      </div>

      {/* Список блоков для редактирования */}
      <div className="grid gap-4">
        {blocks.map((block, index) => (
          <Card key={block.id} className="border border-border/80 shadow-sm hover:border-primary/40 transition-colors">
            <CardHeader className="py-3 px-4 border-b border-border/40">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <GripVertical className="h-5 w-5 text-muted-foreground" />
                  <CardTitle className="text-base font-semibold">
                    Блок {index + 1}: <span className="text-primary font-bold">{getPreviewValue(block)}</span> — {block.label}
                  </CardTitle>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`active-${block.id}`} className="text-xs text-muted-foreground">Активен на сайте</Label>
                    <Switch
                      id={`active-${block.id}`}
                      checked={block.is_active}
                      onCheckedChange={(checked) => handleUpdateBlock(block.id, "is_active", checked)}
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:bg-destructive/10"
                    onClick={() => handleDeleteBlock(block.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4">
              <div className="grid gap-4 md:grid-cols-4">
                {/* Источник данных */}
                <div className="space-y-1.5 md:col-span-1">
                  <Label className="text-xs font-medium">Источник данных</Label>
                  <Select
                    value={block.source_type}
                    onValueChange={(value) => handleUpdateBlock(block.id, "source_type", value)}
                  >
                    <SelectTrigger className="text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="accounts_db">📊 Из БД (Абоненты: {serverStats.accounts_count})</SelectItem>
                      <SelectItem value="krasnodar_years">🏢 Авторасчет (Лет в КРД: {serverStats.krasnodar_years})</SelectItem>
                      <SelectItem value="yufo_years">🌍 Авторасчет (Опыт ЮФО: {serverStats.yufo_years})</SelectItem>
                      <SelectItem value="custom">✏️ Ручной ввод значения</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Иконка */}
                <div className="space-y-1.5 md:col-span-1">
                  <Label className="text-xs font-medium">Иконка</Label>
                  <Select
                    value={block.icon}
                    onValueChange={(value) => handleUpdateBlock(block.id, "icon", value)}
                  >
                    <SelectTrigger className="text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {availableIcons.map((icon) => (
                        <SelectItem key={icon.value} value={icon.value}>
                          {icon.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Значение (число / текст) */}
                <div className="space-y-1.5 md:col-span-1">
                  <Label className="text-xs font-medium">
                    {block.source_type === "custom" ? "Значение (ручное)" : "Текущее значение (авто)"}
                  </Label>
                  <Input
                    value={block.source_type === "custom" ? block.value : getPreviewValue(block)}
                    disabled={block.source_type !== "custom"}
                    onChange={(e) => handleUpdateBlock(block.id, "value", e.target.value)}
                    placeholder="Например: 100% или 24/7"
                    className="text-xs font-semibold"
                  />
                </div>

                {/* Подпись (лейбл) */}
                <div className="space-y-1.5 md:col-span-1">
                  <Label className="text-xs font-medium">Подпись (лейбл)</Label>
                  <Input
                    value={block.label}
                    onChange={(e) => handleUpdateBlock(block.id, "label", e.target.value)}
                    placeholder="Например: Довольных клиентов"
                    className="text-xs"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {blocks.length === 0 && (
        <div className="text-center py-12 text-muted-foreground border border-dashed rounded-xl">
          <p className="mb-3">Нет статистических блоков. Вы можете создать первый или загрузить эталонные.</p>
          <Button onClick={initDefaultBlocks} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Загрузить эталонные показатели
          </Button>
        </div>
      )}
    </div>
  );
};
