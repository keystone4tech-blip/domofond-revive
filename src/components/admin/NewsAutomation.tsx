import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Play, Save, Check, X, Sparkles, Newspaper, RefreshCw } from "lucide-react";

export const NewsAutomation = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<any>(null);
  const [segments, setSegments] = useState<any[]>([]);
  const [drafts, setDrafts] = useState<any[]>([]);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const [s, sg, d] = await Promise.all([
      supabase.from("news_automation_settings").select("*").limit(1).maybeSingle(),
      supabase.from("news_segments").select("*").order("weight", { ascending: false }),
      supabase.from("news_drafts").select("*").in("status", ["pending", "failed"]).order("created_at", { ascending: false }).limit(50),
    ]);
    setSettings(s.data);
    setSegments(sg.data || []);
    setDrafts(d.data || []);
    setLoading(false);
  };

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    const { error } = await supabase.from("news_automation_settings").update({
      is_enabled: settings.is_enabled,
      publish_mode: settings.publish_mode,
      news_source: settings.news_source,
      image_strategy: settings.image_strategy,
      photo_source: settings.photo_source,
      ai_model: settings.ai_model,
      posts_per_run: settings.posts_per_run,
      brand_pitch: settings.brand_pitch,
      region: settings.region,
    }).eq("id", settings.id);
    setSaving(false);
    toast(error ? { title: "Ошибка", description: error.message, variant: "destructive" } : { title: "Сохранено" });
  };

  const runNow = async () => {
    setRunning(true);
    const { data, error } = await supabase.functions.invoke("news-generate", { body: { count: 1 } });
    setRunning(false);
    if (error) toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    else {
      const ok = (data?.results || []).filter((r: any) => r.ok).length;
      toast({ title: "Готово", description: `Создано: ${ok}` });
      load();
    }
  };

  const approve = async (draft: any) => {
    const { data: news, error } = await supabase.from("news").insert({
      title: draft.title,
      content: draft.content,
      excerpt: draft.excerpt,
      image_url: draft.image_url,
      is_published: true,
      published_at: new Date().toISOString(),
      segment_slug: draft.segment_slug,
      is_auto_generated: true,
      source_urls: draft.source_urls,
    }).select().single();
    if (error) return toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    await supabase.from("news_drafts").update({
      status: "published", published_news_id: news.id, reviewed_at: new Date().toISOString(),
    }).eq("id", draft.id);
    toast({ title: "Опубликовано" });
    load();
  };

  const reject = async (id: string) => {
    await supabase.from("news_drafts").update({ status: "rejected", reviewed_at: new Date().toISOString() }).eq("id", id);
    load();
  };

  if (loading) return <Loader2 className="h-6 w-6 animate-spin mx-auto" />;
  if (!settings) return <p>Настройки не найдены</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Newspaper className="h-5 w-5 text-primary" />
        <h2 className="text-xl font-bold">Авто-новости с AI</h2>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Основные настройки</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <Label>Авто-генерация включена</Label>
            <Switch checked={settings.is_enabled} onCheckedChange={(v) => setSettings({ ...settings, is_enabled: v })} />
          </div>

          <div>
            <Label className="text-sm">Режим публикации</Label>
            <Select value={settings.publish_mode} onValueChange={(v) => setSettings({ ...settings, publish_mode: v })}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Полный автопостинг</SelectItem>
                <SelectItem value="review">С подтверждением админа</SelectItem>
                <SelectItem value="mixed">Гибрид (по сегменту)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-sm">Источник новостей</Label>
            <Select value={settings.news_source} onValueChange={(v) => setSettings({ ...settings, news_source: v })}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="gemini_grounding">Lovable AI (бесплатно, без ключа)</SelectItem>
                <SelectItem value="perplexity">Perplexity (точные свежие новости — нужен ключ)</SelectItem>
                <SelectItem value="firecrawl">Firecrawl (скрапинг сайтов — нужен ключ)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              Если ключа Perplexity/Firecrawl нет — автоматически используется бесплатный Lovable AI.
            </p>
          </div>

          <div>
            <Label className="text-sm">Стратегия картинок</Label>
            <Select value={settings.image_strategy} onValueChange={(v) => setSettings({ ...settings, image_strategy: v })}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ai_generate">AI-генерация (Nano Banana)</SelectItem>
                <SelectItem value="stock_photos">Стоковые фото (Unsplash/Pexels)</SelectItem>
                <SelectItem value="mixed">Смешанная</SelectItem>
                <SelectItem value="none">Без картинок</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {settings.image_strategy !== "ai_generate" && settings.image_strategy !== "none" && (
            <div>
              <Label className="text-sm">Источник стоковых фото</Label>
              <Select value={settings.photo_source} onValueChange={(v) => setSettings({ ...settings, photo_source: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unsplash">Unsplash (бесплатно без ключа)</SelectItem>
                  <SelectItem value="pexels">Pexels (нужен ключ)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label className="text-sm">Контекст бренда / УТП</Label>
            <Textarea rows={3} value={settings.brand_pitch || ""}
              onChange={(e) => setSettings({ ...settings, brand_pitch: e.target.value })} />
          </div>

          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <Button onClick={save} disabled={saving} className="flex-1">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-1" />} Сохранить
            </Button>
            <Button onClick={runNow} disabled={running} variant="secondary" className="flex-1">
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 mr-1" />} Сгенерировать сейчас
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Сегменты ({segments.length})</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {segments.map((s) => (
            <div key={s.id} className="flex items-center justify-between rounded border p-2 text-sm">
              <div>
                <div className="font-medium">{s.name}</div>
                <div className="text-xs text-muted-foreground">{s.description}</div>
              </div>
              <Badge variant="outline">вес: {s.weight}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between mt-4">
        <h3 className="font-semibold flex items-center gap-2">
          <Sparkles className="h-4 w-4" /> Черновики ({drafts.length})
        </h3>
        <Button size="sm" variant="outline" onClick={load}>
          <RefreshCw className="h-3 w-3 mr-1" /> Обновить
        </Button>
      </div>

      {drafts.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center p-4">Нет черновиков. Запустите генерацию.</p>
      ) : (
        drafts.map((d) => (
          <Card key={d.id}>
            <CardContent className="p-3 space-y-2">
              <div className="flex items-start gap-2">
                {d.image_url && <img src={d.image_url} alt="" className="w-20 h-20 object-cover rounded" />}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap gap-1 mb-1">
                    <Badge variant="secondary" className="text-xs">{d.segment_slug || "general"}</Badge>
                    {d.status === "failed" && <Badge variant="destructive" className="text-xs">Ошибка</Badge>}
                  </div>
                  <div className="font-semibold text-sm">{d.title}</div>
                  <p className="text-xs text-muted-foreground line-clamp-2">{d.excerpt}</p>
                </div>
              </div>
              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground">Показать текст</summary>
                <div className="mt-2 whitespace-pre-wrap bg-muted p-2 rounded max-h-60 overflow-y-auto">{d.content}</div>
              </details>
              <div className="flex gap-1.5">
                <Button size="sm" onClick={() => approve(d)} className="h-7 text-xs">
                  <Check className="h-3 w-3 mr-1" /> Опубликовать
                </Button>
                <Button size="sm" variant="ghost" onClick={() => reject(d.id)} className="h-7 text-xs">
                  <X className="h-3 w-3 mr-1" /> Отклонить
                </Button>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
};
