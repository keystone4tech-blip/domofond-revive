import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Trash2, Sparkles } from "lucide-react";

const PAGES = [
  { path: "/", title: "Главная" },
  { path: "/domofony", title: "Домофоны" },
  { path: "/videonablyudenie", title: "Видеонаблюдение" },
  { path: "/smart-intercom", title: "Умный домофон" },
  { path: "/nashi-raboty", title: "Наши работы" },
  { path: "/voprosy", title: "Вопросы" },
  { path: "/kontakty", title: "Контакты" },
  { path: "/calculator", title: "Калькулятор" },
];

export const SEOKeywords = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [keywords, setKeywords] = useState<any[]>([]);
  const [page, setPage] = useState("/");
  const [newKw, setNewKw] = useState("");

  useEffect(() => {
    load();
  }, [page]);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("seo_keywords")
      .select("*")
      .eq("page_path", page)
      .order("priority", { ascending: false });
    setKeywords(data || []);
    setLoading(false);
  };

  const add = async () => {
    if (!newKw.trim()) return;
    const { error } = await supabase.from("seo_keywords").insert({
      page_path: page,
      keyword: newKw.trim(),
      source: "manual",
      priority: 10,
      is_active: true,
    });
    if (error) {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    } else {
      setNewKw("");
      load();
    }
  };

  const remove = async (id: string) => {
    await supabase.from("seo_keywords").delete().eq("id", id);
    load();
  };

  const toggle = async (id: string, is_active: boolean) => {
    await supabase.from("seo_keywords").update({ is_active }).eq("id", id);
    load();
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div>
          <label className="text-sm font-medium mb-1 block">Страница</label>
          <Select value={page} onValueChange={setPage}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGES.map((p) => (
                <SelectItem key={p.path} value={p.path}>
                  {p.title} ({p.path})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-2">
          <Input
            placeholder="Новое ключевое слово…"
            value={newKw}
            onChange={(e) => setNewKw(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
          />
          <Button onClick={add} size="icon">
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin mx-auto" />
        ) : keywords.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Нет ключевых слов. AI определит их сам при анализе.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {keywords.map((k) => (
              <div
                key={k.id}
                className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${
                  k.is_active ? "bg-secondary" : "opacity-50"
                }`}
              >
                {k.source === "ai" && <Sparkles className="h-3 w-3 text-primary" />}
                <span>{k.keyword}</span>
                <Badge variant="outline" className="text-[10px] h-4 px-1">
                  {k.source === "ai" ? "AI" : "вручную"}
                </Badge>
                <button
                  onClick={() => toggle(k.id, !k.is_active)}
                  className="text-muted-foreground hover:text-foreground"
                  title={k.is_active ? "Отключить" : "Включить"}
                >
                  {k.is_active ? "✓" : "○"}
                </button>
                <button onClick={() => remove(k.id)} className="text-destructive hover:opacity-80">
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
