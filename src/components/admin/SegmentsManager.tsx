import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Loader2, Plus, Pencil, Trash2, Info, Save } from "lucide-react";

interface Segment {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  tone: string;
  pain_points: string | null;
  cta_style: string | null;
  is_active: boolean;
  weight: number;
  publish_mode: string | null;
}

interface Props {
  segments: Segment[];
  onChange: () => void;
}

const empty: Partial<Segment> = {
  slug: "",
  name: "",
  description: "",
  tone: "профессиональный, доверительный",
  pain_points: "",
  cta_style: "",
  is_active: true,
  weight: 3,
  publish_mode: null,
};

export const SegmentsManager = ({ segments, onChange }: Props) => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Segment> | null>(null);
  const [saving, setSaving] = useState(false);

  const sorted = [...segments].sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0));

  const slugify = (s: string) =>
    s
      .toLowerCase()
      .replace(/[ё]/g, "e")
      .replace(/[а-я]/g, (c) => {
        const map: Record<string, string> = {
          а:"a",б:"b",в:"v",г:"g",д:"d",е:"e",ж:"zh",з:"z",и:"i",й:"y",к:"k",л:"l",м:"m",н:"n",о:"o",п:"p",
          р:"r",с:"s",т:"t",у:"u",ф:"f",х:"h",ц:"ts",ч:"ch",ш:"sh",щ:"sch",ъ:"",ы:"y",ь:"",э:"e",ю:"yu",я:"ya",
        };
        return map[c] ?? c;
      })
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60);

  const startNew = () => {
    setEditing({ ...empty });
    setOpen(true);
  };

  const startEdit = (s: Segment) => {
    setEditing({ ...s });
    setOpen(true);
  };

  const save = async () => {
    if (!editing) return;
    if (!editing.name?.trim()) {
      return toast({ title: "Введите название сегмента", variant: "destructive" });
    }
    setSaving(true);
    const slug = editing.slug?.trim() || slugify(editing.name);
    const payload = {
      slug,
      name: editing.name.trim(),
      description: editing.description?.trim() || null,
      tone: editing.tone?.trim() || "нейтральный",
      pain_points: editing.pain_points?.trim() || null,
      cta_style: editing.cta_style?.trim() || null,
      is_active: editing.is_active ?? true,
      weight: Math.max(1, Math.min(10, Number(editing.weight) || 1)),
      publish_mode: editing.publish_mode || null,
    };
    const { error } = editing.id
      ? await supabase.from("news_segments").update(payload).eq("id", editing.id)
      : await supabase.from("news_segments").insert(payload);
    setSaving(false);
    if (error) return toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    toast({ title: editing.id ? "Сегмент обновлён" : "Сегмент создан" });
    setOpen(false);
    setEditing(null);
    onChange();
  };

  const remove = async (s: Segment) => {
    if (!confirm(`Удалить сегмент «${s.name}»?`)) return;
    const { error } = await supabase.from("news_segments").delete().eq("id", s.id);
    if (error) return toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    toast({ title: "Удалено" });
    onChange();
  };

  const adjustWeight = async (s: Segment, delta: number) => {
    const next = Math.max(1, Math.min(10, (s.weight || 1) + delta));
    if (next === s.weight) return;
    const { error } = await supabase.from("news_segments").update({ weight: next }).eq("id", s.id);
    if (error) return toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    onChange();
  };

  const toggleActive = async (s: Segment) => {
    const { error } = await supabase.from("news_segments").update({ is_active: !s.is_active }).eq("id", s.id);
    if (error) return toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    onChange();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2 pb-3">
        <div>
          <CardTitle className="text-base">Сегменты аудитории ({segments.length})</CardTitle>
          <p className="text-xs text-muted-foreground mt-1 flex items-start gap-1">
            <Info className="h-3 w-3 mt-0.5 shrink-0" />
            <span>
              <b>Вес</b> — приоритет показа сегмента при автогенерации (1–10). Чем выше, тем чаще
              для этого сегмента будут создаваться посты. Например, вес 5 у «УК» и 1 у «Премиум» —
              посты для УК будут выходить в 5 раз чаще.
            </span>
          </p>
        </div>
        <Button size="sm" onClick={startNew} className="shrink-0">
          <Plus className="h-3 w-3 mr-1" /> Добавить
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {sorted.length === 0 && (
          <p className="text-sm text-muted-foreground text-center p-4">Сегментов нет. Добавьте первый.</p>
        )}
        {sorted.map((s) => (
          <div
            key={s.id}
            className={`rounded border p-3 ${s.is_active ? "" : "opacity-60 bg-muted/30"}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">{s.name}</span>
                  <Badge variant="outline" className="text-[10px]">{s.slug}</Badge>
                  {!s.is_active && <Badge variant="secondary" className="text-[10px]">Выкл</Badge>}
                </div>
                {s.description && (
                  <div className="text-xs text-muted-foreground mt-0.5">{s.description}</div>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <div className="flex items-center gap-0.5 border rounded">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => adjustWeight(s, -1)} disabled={s.weight <= 1}>
                    <span className="text-base leading-none">−</span>
                  </Button>
                  <span className="text-xs font-semibold min-w-[20px] text-center">{s.weight}</span>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => adjustWeight(s, 1)} disabled={s.weight >= 10}>
                    <span className="text-base leading-none">+</span>
                  </Button>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-1 mt-2">
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => startEdit(s)}>
                <Pencil className="h-3 w-3 mr-1" /> Изменить
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => toggleActive(s)}>
                {s.is_active ? "Выключить" : "Включить"}
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive hover:text-destructive" onClick={() => remove(s)}>
                <Trash2 className="h-3 w-3 mr-1" /> Удалить
              </Button>
            </div>
          </div>
        ))}
      </CardContent>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Редактирование сегмента" : "Новый сегмент"}</DialogTitle>
            <DialogDescription>
              Сегмент = психологический портрет читателя. AI адаптирует тон и аргументы поста под него.
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Название *</Label>
                <Input
                  value={editing.name || ""}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  placeholder="Премиум-ЖК и бизнес-класс"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Slug (англ., автогенерация)</Label>
                <Input
                  value={editing.slug || ""}
                  onChange={(e) => setEditing({ ...editing, slug: e.target.value })}
                  placeholder="premium-zhk"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Краткое описание</Label>
                <Input
                  value={editing.description || ""}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                  placeholder="Жители элитных комплексов, ценящие технологии и статус"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Тон общения</Label>
                <Input
                  value={editing.tone || ""}
                  onChange={(e) => setEditing({ ...editing, tone: e.target.value })}
                  placeholder="премиальный, экспертный, спокойный"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Боли аудитории</Label>
                <Textarea
                  rows={2}
                  value={editing.pain_points || ""}
                  onChange={(e) => setEditing({ ...editing, pain_points: e.target.value })}
                  placeholder="Что эту аудиторию беспокоит: безопасность детей, посторонние во дворе, цена/срок монтажа..."
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Стиль призыва (CTA)</Label>
                <Input
                  value={editing.cta_style || ""}
                  onChange={(e) => setEditing({ ...editing, cta_style: e.target.value })}
                  placeholder="мягкий, через ценность; жёсткий, со скидкой; через расчёт..."
                  className="mt-1"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Вес (1–10)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    value={editing.weight ?? 3}
                    onChange={(e) => setEditing({ ...editing, weight: parseInt(e.target.value) || 1 })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Режим публикации</Label>
                  <Select
                    value={editing.publish_mode || "inherit"}
                    onValueChange={(v) => setEditing({ ...editing, publish_mode: v === "inherit" ? null : v })}
                  >
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="inherit">Как у всей системы</SelectItem>
                      <SelectItem value="auto">Автопубликация</SelectItem>
                      <SelectItem value="review">С подтверждением</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <Label className="text-sm">Сегмент активен</Label>
                <Switch
                  checked={editing.is_active ?? true}
                  onCheckedChange={(v) => setEditing({ ...editing, is_active: v })}
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 flex-col sm:flex-row">
            <Button variant="ghost" onClick={() => setOpen(false)}>Отмена</Button>
            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
