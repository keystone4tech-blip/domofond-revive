import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Undo2, History as HistoryIcon } from "lucide-react";

export const SEOHistory = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("seo_history")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    setItems(data || []);
    setLoading(false);
  };

  const rollback = async (id: string) => {
    if (!confirm("Откатить это изменение к предыдущему значению?")) return;
    setBusy(true);
    const { error } = await supabase.functions.invoke("seo-apply", {
      body: { action: "rollback", history_id: id },
    });
    setBusy(false);
    if (error) {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Откачено" });
      load();
    }
  };

  if (loading) return <Loader2 className="h-6 w-6 animate-spin mx-auto" />;

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <HistoryIcon className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">История пуста</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((h) => (
        <Card key={h.id} className={h.is_rolled_back ? "opacity-60" : ""}>
          <CardContent className="p-3">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant="secondary" className="font-mono text-xs">{h.page_path}</Badge>
                <Badge variant="outline" className="text-xs">{h.field_name}</Badge>
                {h.is_rolled_back && (
                  <Badge variant="destructive" className="text-xs">Откачено</Badge>
                )}
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {new Date(h.created_at).toLocaleString("ru-RU")}
              </span>
            </div>

            <div className="grid sm:grid-cols-2 gap-2 text-xs mb-2">
              <div className="rounded bg-muted p-2">
                <p className="text-[10px] uppercase mb-1 font-semibold">Было</p>
                <p className="break-words whitespace-pre-wrap text-muted-foreground line-clamp-3">
                  {h.previous_value || <em>(пусто)</em>}
                </p>
              </div>
              <div className="rounded bg-primary/5 border border-primary/20 p-2">
                <p className="text-[10px] uppercase mb-1 font-semibold text-primary">Стало</p>
                <p className="break-words whitespace-pre-wrap line-clamp-3">{h.new_value}</p>
              </div>
            </div>

            {!h.is_rolled_back && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => rollback(h.id)}
                disabled={busy}
              >
                <Undo2 className="h-3 w-3 mr-1" />
                Откатить
              </Button>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
