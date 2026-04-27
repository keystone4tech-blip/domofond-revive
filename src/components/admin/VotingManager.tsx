import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Vote, Plus, Trash2, Loader2, Save, Play, Square, BarChart3, X } from "lucide-react";

interface Voting {
  id: string;
  title: string;
  description: string | null;
  voting_type: string;
  building_address: string;
  status: string;
  starts_at: string | null;
  ends_at: string | null;
  legal_basis: string | null;
  total_apartments: number | null;
  quorum_percent: number;
  pass_threshold_percent: number;
}

interface Question {
  id?: string;
  voting_id?: string;
  question_text: string;
  options: string[];
  order_index: number;
}

const DEFAULT_OSS_OPTIONS = ["За", "Против", "Воздержался"];

export const VotingManager = () => {
  const { toast } = useToast();
  const [list, setList] = useState<Voting[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Voting | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [saving, setSaving] = useState(false);
  const [results, setResults] = useState<{ voting: Voting; data: any } | null>(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("votings").select("*").order("created_at", { ascending: false });
    setList((data || []) as Voting[]);
    setLoading(false);
  };

  const startCreate = () => {
    setEditing({
      id: "",
      title: "",
      description: "",
      voting_type: "oss",
      building_address: "",
      status: "draft",
      starts_at: null,
      ends_at: null,
      legal_basis: "ст. 44–48 ЖК РФ — общее собрание собственников",
      total_apartments: null,
      quorum_percent: 50,
      pass_threshold_percent: 50,
    });
    setQuestions([
      { question_text: "Выбрать ООО «Домофондар» в качестве обслуживающей организации систем домофонии и видеонаблюдения", options: DEFAULT_OSS_OPTIONS, order_index: 0 },
    ]);
  };

  const startEdit = async (v: Voting) => {
    setEditing(v);
    const { data } = await supabase.from("voting_questions").select("*").eq("voting_id", v.id).order("order_index");
    setQuestions(((data || []) as any[]).map((q) => ({ ...q, options: Array.isArray(q.options) ? q.options : DEFAULT_OSS_OPTIONS })));
  };

  const saveAll = async () => {
    if (!editing) return;
    if (!editing.title || !editing.building_address) {
      return toast({ title: "Заполните название и адрес", variant: "destructive" });
    }
    setSaving(true);
    const payload: any = {
      title: editing.title,
      description: editing.description,
      voting_type: editing.voting_type,
      building_address: editing.building_address,
      legal_basis: editing.legal_basis,
      total_apartments: editing.total_apartments,
      quorum_percent: editing.quorum_percent,
      pass_threshold_percent: editing.pass_threshold_percent,
      starts_at: editing.starts_at,
      ends_at: editing.ends_at,
      status: editing.status,
    };
    let votingId = editing.id;
    if (votingId) {
      const { error } = await supabase.from("votings").update(payload).eq("id", votingId);
      if (error) { setSaving(false); return toast({ title: "Ошибка", description: error.message, variant: "destructive" }); }
    } else {
      const { data, error } = await supabase.from("votings").insert(payload).select().single();
      if (error) { setSaving(false); return toast({ title: "Ошибка", description: error.message, variant: "destructive" }); }
      votingId = data.id;
    }
    // Удаляем старые вопросы и вставляем новые (простой путь для MVP)
    await supabase.from("voting_questions").delete().eq("voting_id", votingId);
    if (questions.length) {
      const rows = questions.map((q, i) => ({
        voting_id: votingId,
        question_text: q.question_text,
        options: q.options,
        order_index: i,
      }));
      const { error } = await supabase.from("voting_questions").insert(rows);
      if (error) { setSaving(false); return toast({ title: "Ошибка вопросов", description: error.message, variant: "destructive" }); }
    }
    setSaving(false);
    toast({ title: "Сохранено" });
    setEditing(null);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Удалить голосование вместе с бюллетенями?")) return;
    await supabase.from("votings").delete().eq("id", id);
    load();
  };

  const setStatus = async (id: string, status: string) => {
    await supabase.from("votings").update({ status }).eq("id", id);
    load();
  };

  const showResults = async (v: Voting) => {
    const [{ data: qs }, { data: ballots }, { data: ans }] = await Promise.all([
      supabase.from("voting_questions").select("*").eq("voting_id", v.id).order("order_index"),
      supabase.from("voting_ballots").select("*").eq("voting_id", v.id).eq("is_revoked", false),
      supabase.from("voting_answers").select("*, voting_questions!inner(voting_id)").eq("voting_questions.voting_id", v.id),
    ]);
    const totals: Record<string, Record<string, number>> = {};
    const totalArea = (ballots || []).reduce((s: number, b: any) => s + (Number(b.voter_area_sqm) || 0), 0);
    (qs || []).forEach((q: any) => {
      totals[q.id] = {};
      (Array.isArray(q.options) ? q.options : DEFAULT_OSS_OPTIONS).forEach((o: string) => totals[q.id][o] = 0);
    });
    const ballotArea: Record<string, number> = {};
    (ballots || []).forEach((b: any) => { ballotArea[b.id] = Number(b.voter_area_sqm) || 1; });
    (ans || []).forEach((a: any) => {
      const w = ballotArea[a.ballot_id] ?? 1;
      if (totals[a.question_id]) {
        totals[a.question_id][a.selected_option] = (totals[a.question_id][a.selected_option] || 0) + w;
      }
    });
    setResults({ voting: v, data: { questions: qs, totals, ballotsCount: ballots?.length || 0, totalArea } });
  };

  if (loading) return <Loader2 className="h-6 w-6 animate-spin mx-auto" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Vote className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-bold">Голосования собственников</h2>
        </div>
        <Button size="sm" onClick={startCreate}><Plus className="h-3 w-3 mr-1" /> Создать</Button>
      </div>

      <Card>
        <CardContent className="p-3 text-xs text-muted-foreground space-y-1">
          <p><strong>ОСС</strong> — общее собрание собственников по ст. 44–48 ЖК РФ. Юридическая сила — гибридный режим: онлайн-бюллетени + итоговый протокол PDF, который инициатор передаёт в ГИС ЖКХ.</p>
          <p><strong>Опросы</strong> — ни к чему не обязывающее мнение жильцов (например, для решения Совета дома).</p>
        </CardContent>
      </Card>

      {list.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center p-4">Голосований пока нет. Создайте первое.</p>
      ) : (
        list.map((v) => (
          <Card key={v.id}>
            <CardContent className="p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-semibold text-sm">{v.title}</div>
                  <div className="text-xs text-muted-foreground">{v.building_address}</div>
                </div>
                <Badge variant={v.status === "active" ? "default" : v.status === "finished" ? "secondary" : "outline"}>
                  {v.status}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Button size="sm" variant="outline" onClick={() => startEdit(v)} className="h-7 text-xs">Изменить</Button>
                {v.status === "draft" && (
                  <Button size="sm" onClick={() => setStatus(v.id, "active")} className="h-7 text-xs">
                    <Play className="h-3 w-3 mr-1" /> Запустить
                  </Button>
                )}
                {v.status === "active" && (
                  <Button size="sm" variant="secondary" onClick={() => setStatus(v.id, "finished")} className="h-7 text-xs">
                    <Square className="h-3 w-3 mr-1" /> Завершить
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => showResults(v)} className="h-7 text-xs">
                  <BarChart3 className="h-3 w-3 mr-1" /> Результаты
                </Button>
                <Button size="sm" variant="ghost" onClick={() => remove(v.id)} className="h-7 text-xs text-destructive">
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))
      )}

      {/* Редактор */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Редактирование голосования" : "Новое голосование"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Тип</Label>
                  <Select value={editing.voting_type} onValueChange={(v) => setEditing({ ...editing, voting_type: v })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="oss">ОСС (по ЖК РФ)</SelectItem>
                      <SelectItem value="survey">Опрос жильцов</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Статус</Label>
                  <Select value={editing.status} onValueChange={(v) => setEditing({ ...editing, status: v })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Черновик</SelectItem>
                      <SelectItem value="active">Идёт</SelectItem>
                      <SelectItem value="finished">Завершено</SelectItem>
                      <SelectItem value="cancelled">Отменено</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-xs">Название</Label>
                <Input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Адрес дома</Label>
                <Input value={editing.building_address} onChange={(e) => setEditing({ ...editing, building_address: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Описание / повестка</Label>
                <Textarea rows={4} value={editing.description || ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} className="mt-1" />
              </div>
              {editing.voting_type === "oss" && (
                <div>
                  <Label className="text-xs">Правовое основание</Label>
                  <Input value={editing.legal_basis || ""} onChange={(e) => setEditing({ ...editing, legal_basis: e.target.value })} className="mt-1" />
                </div>
              )}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Всего квартир</Label>
                  <Input type="number" value={editing.total_apartments ?? ""} onChange={(e) => setEditing({ ...editing, total_apartments: e.target.value ? parseInt(e.target.value) : null })} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Кворум, %</Label>
                  <Input type="number" value={editing.quorum_percent} onChange={(e) => setEditing({ ...editing, quorum_percent: parseFloat(e.target.value) || 50 })} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Принятие, %</Label>
                  <Input type="number" value={editing.pass_threshold_percent} onChange={(e) => setEditing({ ...editing, pass_threshold_percent: parseFloat(e.target.value) || 50 })} className="mt-1" />
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Начало (МСК)</Label>
                  <Input type="datetime-local" value={editing.starts_at?.slice(0, 16) || ""} onChange={(e) => setEditing({ ...editing, starts_at: e.target.value ? new Date(e.target.value).toISOString() : null })} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Окончание (МСК)</Label>
                  <Input type="datetime-local" value={editing.ends_at?.slice(0, 16) || ""} onChange={(e) => setEditing({ ...editing, ends_at: e.target.value ? new Date(e.target.value).toISOString() : null })} className="mt-1" />
                </div>
              </div>

              <div className="space-y-2 border-t pt-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">Вопросы ({questions.length})</Label>
                  <Button size="sm" variant="outline" onClick={() => setQuestions([...questions, { question_text: "", options: DEFAULT_OSS_OPTIONS, order_index: questions.length }])}>
                    <Plus className="h-3 w-3 mr-1" /> Вопрос
                  </Button>
                </div>
                {questions.map((q, i) => (
                  <div key={i} className="rounded border p-2 space-y-2">
                    <div className="flex items-start gap-2">
                      <span className="text-xs text-muted-foreground mt-2">{i + 1}.</span>
                      <Textarea
                        rows={2}
                        value={q.question_text}
                        onChange={(e) => {
                          const next = [...questions];
                          next[i] = { ...q, question_text: e.target.value };
                          setQuestions(next);
                        }}
                        placeholder="Формулировка вопроса"
                        className="flex-1 text-sm"
                      />
                      <Button size="sm" variant="ghost" onClick={() => setQuestions(questions.filter((_, idx) => idx !== i))}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                    <div>
                      <Label className="text-xs">Варианты (через запятую)</Label>
                      <Input
                        value={q.options.join(", ")}
                        onChange={(e) => {
                          const next = [...questions];
                          next[i] = { ...q, options: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) };
                          setQuestions(next);
                        }}
                        className="mt-1 text-xs"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 flex-col sm:flex-row">
            <Button variant="ghost" onClick={() => setEditing(null)}>Отмена</Button>
            <Button onClick={saveAll} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />} Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Результаты */}
      <Dialog open={!!results} onOpenChange={(o) => !o && setResults(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Результаты: {results?.voting.title}</DialogTitle>
          </DialogHeader>
          {results && (
            <div className="space-y-3">
              <Card>
                <CardContent className="p-3 text-sm">
                  <div>Всего бюллетеней: <strong>{results.data.ballotsCount}</strong></div>
                  <div>Суммарная площадь: <strong>{results.data.totalArea.toFixed(2)} м²</strong></div>
                </CardContent>
              </Card>
              {(results.data.questions || []).map((q: any, i: number) => {
                const tot = results.data.totals[q.id] || {};
                const sum = (Object.values(tot) as number[]).reduce((s, n) => s + Number(n), 0) || 1;
                return (
                  <Card key={q.id}>
                    <CardHeader className="pb-2"><CardTitle className="text-sm">Вопрос {i + 1}. {q.question_text}</CardTitle></CardHeader>
                    <CardContent className="pt-0 space-y-1 text-sm">
                      {Object.entries(tot).map(([opt, val]) => {
                        const v = Number(val);
                        const pct = (v / sum * 100).toFixed(1);
                        return (
                          <div key={opt} className="flex items-center justify-between">
                            <span>{opt}</span>
                            <span className="text-muted-foreground">{v.toFixed(2)} ({pct}%)</span>
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
