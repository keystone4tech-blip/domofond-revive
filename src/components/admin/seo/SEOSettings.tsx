import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Play, Save } from "lucide-react";

export const SEOSettings = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [settings, setSettings] = useState<any>(null);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    const { data } = await supabase.from("seo_settings").select("*").limit(1).maybeSingle();
    setSettings(data);
    setLoading(false);
  };

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    const { error } = await supabase
      .from("seo_settings")
      .update({
        is_enabled: settings.is_enabled,
        auto_apply: settings.auto_apply,
        ai_model: settings.ai_model,
        brand_context: settings.brand_context,
        optimize_meta: settings.optimize_meta,
        optimize_content: settings.optimize_content,
        optimize_alt: settings.optimize_alt,
        optimize_jsonld: settings.optimize_jsonld,
      })
      .eq("id", settings.id);
    setSaving(false);
    if (error) {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Настройки сохранены" });
    }
  };

  const runNow = async () => {
    setRunning(true);
    const { data, error } = await supabase.functions.invoke("seo-analyze", { body: {} });
    setRunning(false);
    if (error) {
      toast({ title: "Ошибка анализа", description: error.message, variant: "destructive" });
    } else {
      toast({
        title: "Анализ завершён",
        description: `Создано ${data?.total_suggestions || 0} предложений по ${data?.pages_analyzed || 0} страницам`,
      });
      load();
    }
  };

  if (loading) return <Loader2 className="h-6 w-6 animate-spin mx-auto" />;
  if (!settings) return <p className="text-sm text-muted-foreground">Настройки не найдены</p>;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Основные настройки</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label className="text-sm font-medium">SEO-система включена</Label>
              <p className="text-xs text-muted-foreground">Разрешить анализ и применение SEO-изменений</p>
            </div>
            <Switch
              checked={settings.is_enabled}
              onCheckedChange={(v) => setSettings({ ...settings, is_enabled: v })}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label className="text-sm font-medium">Автоприменение</Label>
              <p className="text-xs text-muted-foreground">
                Применять изменения автоматически (с возможностью отката из истории)
              </p>
            </div>
            <Switch
              checked={settings.auto_apply}
              onCheckedChange={(v) => setSettings({ ...settings, auto_apply: v })}
            />
          </div>

          <div>
            <Label className="text-sm">AI-модель</Label>
            <Select value={settings.ai_model} onValueChange={(v) => setSettings({ ...settings, ai_model: v })}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="google/gemini-3-flash-preview">Gemini 3 Flash (быстрый, дешёвый)</SelectItem>
                <SelectItem value="google/gemini-2.5-flash">Gemini 2.5 Flash</SelectItem>
                <SelectItem value="google/gemini-2.5-pro">Gemini 2.5 Pro (точный, дороже)</SelectItem>
                <SelectItem value="openai/gpt-5-mini">GPT-5 Mini</SelectItem>
                <SelectItem value="openai/gpt-5">GPT-5 (премиум)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-sm">Контекст бренда (для AI)</Label>
            <Textarea
              className="mt-1"
              rows={4}
              value={settings.brand_context || ""}
              onChange={(e) => setSettings({ ...settings, brand_context: e.target.value })}
              placeholder="Опишите компанию, услуги, регион — это поможет AI делать точные предложения"
            />
          </div>

          {settings.last_run_at && (
            <p className="text-xs text-muted-foreground">
              Последний запуск: {new Date(settings.last_run_at).toLocaleString("ru-RU")}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Что оптимизировать</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { key: "optimize_meta", label: "Meta-теги (title, description, OG)" },
            { key: "optimize_content", label: "Тексты блоков и заголовки H1" },
            { key: "optimize_alt", label: "Alt-теги изображений" },
            { key: "optimize_jsonld", label: "JSON-LD (Schema.org)" },
          ].map((opt) => (
            <div key={opt.key} className="flex items-center justify-between">
              <Label className="text-sm">{opt.label}</Label>
              <Switch
                checked={!!settings[opt.key]}
                onCheckedChange={(v) => setSettings({ ...settings, [opt.key]: v })}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex flex-col sm:flex-row gap-2">
        <Button onClick={save} disabled={saving} className="flex-1">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
          Сохранить настройки
        </Button>
        <Button
          onClick={runNow}
          disabled={running || !settings.is_enabled}
          variant="secondary"
          className="flex-1"
        >
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 mr-1" />}
          Запустить анализ сейчас
        </Button>
      </div>
    </div>
  );
};
