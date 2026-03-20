import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Bot, Save } from "lucide-react";

export function ChatWidgetManager() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [systemPrompt, setSystemPrompt] = useState("");
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const [knowledgeBase, setKnowledgeBase] = useState("");
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const { data, error } = await supabase
      .from("chat_widget_settings")
      .select("*")
      .limit(1)
      .single();

    if (data) {
      setSettingsId(data.id);
      setSystemPrompt(data.system_prompt || "");
      setWelcomeMessage(data.welcome_message || "");
      setKnowledgeBase(data.knowledge_base || "");
      setIsActive(data.is_active);
    }
    if (error) console.error(error);
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        system_prompt: systemPrompt,
        welcome_message: welcomeMessage,
        knowledge_base: knowledgeBase,
        is_active: isActive,
        updated_at: new Date().toISOString(),
      };

      if (settingsId) {
        const { error } = await supabase
          .from("chat_widget_settings")
          .update(payload)
          .eq("id", settingsId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("chat_widget_settings")
          .insert(payload);
        if (error) throw error;
      }

      toast({ title: "Сохранено", description: "Настройки чат-виджета обновлены" });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Ошибка сохранения";
      toast({ title: "Ошибка", description: msg, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            Настройки AI-помощника
          </CardTitle>
          <CardDescription>
            Настройте поведение чат-виджета на сайте. Виджет автоматически появляется у посетителей и отвечает на их вопросы.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-3">
            <Switch checked={isActive} onCheckedChange={setIsActive} />
            <Label>Виджет {isActive ? "включен" : "выключен"}</Label>
          </div>

          <div className="space-y-2">
            <Label>Приветственное сообщение</Label>
            <Input
              value={welcomeMessage}
              onChange={(e) => setWelcomeMessage(e.target.value)}
              placeholder="Здравствуйте! 👋 Чем могу помочь?"
            />
            <p className="text-xs text-muted-foreground">Первое сообщение, которое видит пользователь</p>
          </div>

          <div className="space-y-2">
            <Label>Системный промт (кто он и как себя вести)</Label>
            <Textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              rows={6}
              placeholder="Ты — виртуальный помощник компании..."
            />
            <p className="text-xs text-muted-foreground">
              Опишите роль ассистента, стиль общения, ограничения. Это инструкция для ИИ.
            </p>
          </div>

          <div className="space-y-2">
            <Label>База знаний</Label>
            <Textarea
              value={knowledgeBase}
              onChange={(e) => setKnowledgeBase(e.target.value)}
              rows={10}
              placeholder="Вставьте сюда информацию о компании, услугах, ценах, часто задаваемых вопросах..."
            />
            <p className="text-xs text-muted-foreground">
              Вся информация, которую ИИ должен использовать для ответов. Можно вставить текст с сайта, FAQ, прайс-лист и т.д.
            </p>
          </div>

          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Сохранить настройки
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
