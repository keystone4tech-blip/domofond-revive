import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Check, X, RefreshCw, FileText } from "lucide-react";

const TARGET_LABELS: Record<string, string> = {
  page_meta: "Meta",
  page_h1: "H1",
  site_block: "Блок",
};

const FIELD_LABELS: Record<string, string> = {
  title: "Заголовок (title)",
  description: "Описание (description)",
  keywords: "Ключевые слова",
  og_title: "OG Title",
  og_description: "OG Description",
  h1: "H1 заголовок",
  json_ld: "JSON-LD данные",
};

export const SEOSuggestions = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("seo_suggestions")
      .select("*")
      .eq("status", "pending")
      .order("page_path")
      .order("created_at", { ascending: false });
    setSuggestions(data || []);
    setSelected(new Set());
    setLoading(false);
  };

  const toggleAll = (checked: boolean) => {
    setSelected(checked ? new Set(suggestions.map((s) => s.id)) : new Set());
  };

  const toggleOne = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const act = async (action: "apply" | "reject", ids: string[]) => {
    if (!ids.length) {
      toast({ title: "Выберите хотя бы одно предложение", variant: "destructive" });
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("seo-apply", {
      body: { action, suggestion_ids: ids },
    });
    setBusy(false);
    if (error) {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
      return;
    }
    if (action === "apply") {
      const applied = data?.applied ?? 0;
      const failed = (data?.failed as { error: string; field_name: string }[] | undefined) || [];
      const total = data?.total ?? ids.length;
      if (failed.length) {
        const firstErr = failed[0]?.error || "неизвестная ошибка";
        toast({
          title: `Применено ${applied} из ${total}`,
          description: `Не удалось: ${failed.length}. Причина: ${firstErr}`,
          variant: failed.length === total ? "destructive" : "default",
        });
      } else {
        toast({ title: "Применено", description: `Обработано: ${applied}` });
      }
    } else {
      toast({ title: "Отклонено", description: `Обработано: ${data?.count ?? ids.length}` });
    }
    load();
  };

  if (loading) return <Loader2 className="h-6 w-6 animate-spin mx-auto" />;

  if (suggestions.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center space-y-2">
          <FileText className="h-10 w-10 text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">
            Нет предложений в очереди.
            <br />
            Запустите анализ во вкладке «Настройки».
          </p>
        </CardContent>
      </Card>
    );
  }

  // Группировка по страницам
  const grouped: Record<string, any[]> = {};
  for (const s of suggestions) {
    if (!grouped[s.page_path]) grouped[s.page_path] = [];
    grouped[s.page_path].push(s);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 sticky top-0 bg-background py-2 z-10 border-b">
        <Checkbox
          checked={selected.size === suggestions.length && suggestions.length > 0}
          onCheckedChange={(v) => toggleAll(!!v)}
        />
        <span className="text-sm">
          Выбрано: {selected.size} / {suggestions.length}
        </span>
        <div className="flex-1" />
        <Button size="sm" variant="outline" onClick={load} disabled={busy}>
          <RefreshCw className="h-4 w-4 mr-1" />
          Обновить
        </Button>
        <Button
          size="sm"
          variant="destructive"
          onClick={() => act("reject", Array.from(selected))}
          disabled={busy || selected.size === 0}
        >
          <X className="h-4 w-4 mr-1" />
          Отклонить
        </Button>
        <Button
          size="sm"
          onClick={() => act("apply", Array.from(selected))}
          disabled={busy || selected.size === 0}
        >
          <Check className="h-4 w-4 mr-1" />
          Применить
        </Button>
      </div>

      {Object.entries(grouped).map(([path, items]) => (
        <div key={path} className="space-y-2">
          <div className="flex items-center gap-2 mt-3">
            <Badge variant="secondary" className="font-mono">{path}</Badge>
            <span className="text-xs text-muted-foreground">{items.length} изм.</span>
          </div>
          {items.map((s) => (
            <Card key={s.id} className="overflow-hidden">
              <CardContent className="p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <Checkbox
                    checked={selected.has(s.id)}
                    onCheckedChange={() => toggleOne(s.id)}
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                      <Badge variant="outline" className="text-xs">
                        {TARGET_LABELS[s.target_type] || s.target_type}
                      </Badge>
                      <span className="text-sm font-medium">
                        {FIELD_LABELS[s.field_name] || s.field_name}
                      </span>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-2 text-xs">
                      <div className="rounded bg-destructive/5 border border-destructive/20 p-2">
                        <p className="text-[10px] uppercase text-destructive mb-1 font-semibold">Было</p>
                        <p className="break-words whitespace-pre-wrap text-muted-foreground">
                          {s.before_value || <em>(пусто)</em>}
                        </p>
                      </div>
                      <div className="rounded bg-primary/5 border border-primary/20 p-2">
                        <p className="text-[10px] uppercase text-primary mb-1 font-semibold">Станет</p>
                        <p className="break-words whitespace-pre-wrap">{s.after_value}</p>
                      </div>
                    </div>

                    {s.reasoning && (
                      <p className="text-xs text-muted-foreground mt-2 italic">
                        💡 {s.reasoning}
                      </p>
                    )}

                    <div className="flex gap-1.5 mt-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => act("apply", [s.id])}
                        disabled={busy}
                      >
                        <Check className="h-3 w-3 mr-1" />
                        Применить
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        onClick={() => act("reject", [s.id])}
                        disabled={busy}
                      >
                        <X className="h-3 w-3 mr-1" />
                        Отклонить
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ))}
    </div>
  );
};
